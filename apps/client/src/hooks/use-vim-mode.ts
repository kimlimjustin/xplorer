import { useEffect, useRef, useCallback, useState } from 'react';
import type { FileEntry } from '@/lib/tauri-api';
import { STORAGE_KEYS } from '@/lib/storage-keys';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VimMode = 'normal' | 'insert' | 'visual' | 'command';

export interface VimModeState {
  /** Current mode: normal, insert, visual (multi-select), or command */
  mode: VimMode;
  /** Whether vim mode is globally enabled */
  enabled: boolean;
  /** Visual mode anchor index (start of range selection) */
  visualAnchor: number | null;
  /** Pending key sequence (e.g. "d" waiting for motion) */
  pendingKeys: string;
  /** Whether learning mode hints are enabled */
  learningMode: boolean;
}

export interface VimModeActions {
  /** Navigate to a path (directory navigation) */
  navigateToPath: (path: string) => void;
  /** Navigate to parent directory */
  navigateUp: () => void;
  /** Open a file (double-click equivalent) */
  openFile: (file: FileEntry) => void;
  /** Set selected files */
  setSelectedFiles: (files: Set<string>) => void;
  /** Set the preview file */
  setSelectedFile: (file: FileEntry | null) => void;
  /** Focus the search input */
  focusSearch: () => void;
  /** Copy files to clipboard */
  copyFiles: (files: FileEntry[]) => void;
  /** Paste from clipboard */
  pasteFiles: () => void;
  /** Delete files (with confirmation) */
  deleteFiles: (files: FileEntry[]) => void;
  /** Rename a file */
  renameFile: (file: FileEntry) => void;
  /** Add bookmark for current directory */
  addBookmark: (path: string) => void;
  /** Refetch / refresh directory listing */
  refetch: () => void;
  /** Show a toast notification */
  toast: (opts: { title: string; description?: string; variant?: string }) => void;
}

export interface UseVimModeOptions {
  /** Whether vim mode is enabled in settings */
  enabled: boolean;
  /** Current list of files in the directory */
  files: FileEntry[];
  /** Currently selected file paths */
  selectedFiles: Set<string>;
  /** Current directory path */
  currentPath: string;
  /** Clipboard state */
  clipboard: { files: FileEntry[]; operation: 'copy' | 'cut' } | null;
  /** Actions the hook can invoke */
  actions: VimModeActions;
}

interface LastAction {
  type: string;
  payload?: unknown;
}

const VIM_MODE_STORAGE_KEY = STORAGE_KEYS.VIM_MODE;
const VIM_LEARNING_MODE_KEY = STORAGE_KEYS.VIM_LEARNING_MODE;

// ─── Helper: read vim mode setting from localStorage ──────────────────────────

export const isVimModeEnabled = (): boolean => {
  try {
    return localStorage.getItem(VIM_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setVimModeSetting = (enabled: boolean): void => {
  try {
    localStorage.setItem(VIM_MODE_STORAGE_KEY, String(enabled));
  } catch {
    /* ignore localStorage errors */
  }
};

export const isVimLearningModeEnabled = (): boolean => {
  try {
    return localStorage.getItem(VIM_LEARNING_MODE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setVimLearningModeSetting = (enabled: boolean): void => {
  try {
    localStorage.setItem(VIM_LEARNING_MODE_KEY, String(enabled));
  } catch {
    /* ignore localStorage errors */
  }
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useVimMode = (options: UseVimModeOptions): VimModeState => {
  const { enabled, files, selectedFiles, currentPath, clipboard, actions } = options;

  const [mode, setMode] = useState<VimMode>('normal');
  const [visualAnchor, setVisualAnchor] = useState<number | null>(null);
  const [pendingKeys, setPendingKeys] = useState<string>('');
  const [learningMode, setLearningMode] = useState(() => isVimLearningModeEnabled());

  // Pending key buffer for multi-key commands (e.g. "gg", "dd", "yy")
  const pendingKeyRef = useRef<string>('');
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync learning mode from localStorage on window focus
  useEffect(() => {
    const onFocus = () => setLearningMode(isVimLearningModeEnabled());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === VIM_LEARNING_MODE_KEY) setLearningMode(e.newValue === 'true');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Last action for "." repeat
  const lastActionRef = useRef<LastAction | null>(null);

  // Refs to always have latest values in the keydown handler without re-registering
  const filesRef = useRef(files);
  const selectedFilesRef = useRef(selectedFiles);
  const currentPathRef = useRef(currentPath);
  const clipboardRef = useRef(clipboard);
  const actionsRef = useRef(actions);
  const modeRef = useRef(mode);
  const visualAnchorRef = useRef(visualAnchor);
  const enabledRef = useRef(enabled);

  filesRef.current = files;
  selectedFilesRef.current = selectedFiles;
  currentPathRef.current = currentPath;
  clipboardRef.current = clipboard;
  actionsRef.current = actions;
  modeRef.current = mode;
  visualAnchorRef.current = visualAnchor;
  enabledRef.current = enabled;

  // Reset mode when navigating to a new directory
  useEffect(() => {
    setMode('normal');
    setVisualAnchor(null);
    pendingKeyRef.current = '';
  }, [currentPath]);

  // ── Helper: find index of the currently focused file ──────────────────────
  const getFocusedIndex = useCallback((): number => {
    const f = filesRef.current;
    const sel = selectedFilesRef.current;
    if (f.length === 0) return -1;
    // Use the last selected file as the "cursor"
    const selArray = Array.from(sel);
    if (selArray.length === 0) return -1;
    const lastSelected = selArray[selArray.length - 1];
    const idx = f.findIndex((file) => file.path === lastSelected);
    return idx;
  }, []);

  // ── Helper: select a file at a given index ────────────────────────────────
  const selectIndex = useCallback((index: number, extendVisual: boolean = false) => {
    const f = filesRef.current;
    if (index < 0 || index >= f.length) return;
    const file = f[index];
    const act = actionsRef.current;

    if (extendVisual && modeRef.current === 'visual') {
      const anchor = visualAnchorRef.current ?? index;
      const start = Math.min(anchor, index);
      const end = Math.max(anchor, index);
      const newSel = new Set<string>();
      for (let i = start; i <= end; i++) {
        newSel.add(f[i].path);
      }
      act.setSelectedFiles(newSel);
    } else {
      act.setSelectedFiles(new Set([file.path]));
    }
    act.setSelectedFile(file);
  }, []);

  // ── Execute an action (also records it for "." repeat) ────────────────────
  const executeAction = useCallback(
    (actionType: string, _payload?: unknown) => {
      const f = filesRef.current;
      const sel = selectedFilesRef.current;
      const act = actionsRef.current;
      const currentIdx = getFocusedIndex();

      switch (actionType) {
        case 'move_down': {
          const newIdx = currentIdx < 0 ? 0 : Math.min(currentIdx + 1, f.length - 1);
          selectIndex(newIdx, modeRef.current === 'visual');
          lastActionRef.current = { type: actionType };
          break;
        }

        case 'move_up': {
          const newIdx = currentIdx < 0 ? 0 : Math.max(currentIdx - 1, 0);
          selectIndex(newIdx, modeRef.current === 'visual');
          lastActionRef.current = { type: actionType };
          break;
        }

        case 'go_parent': {
          act.navigateUp();
          lastActionRef.current = { type: actionType };
          break;
        }

        case 'open_entry': {
          if (currentIdx < 0) break;
          const file = f[currentIdx];
          if (file.is_dir) {
            act.navigateToPath(file.path);
          } else {
            act.openFile(file);
          }
          lastActionRef.current = { type: actionType };
          break;
        }

        case 'go_first': {
          if (f.length === 0) break;
          selectIndex(0, modeRef.current === 'visual');
          lastActionRef.current = { type: actionType };
          break;
        }

        case 'go_last': {
          if (f.length === 0) break;
          selectIndex(f.length - 1, modeRef.current === 'visual');
          lastActionRef.current = { type: actionType };
          break;
        }

        case 'focus_search': {
          act.focusSearch();
          // Don't record search focus as a repeatable action
          break;
        }

        case 'delete': {
          const selArray = Array.from(sel)
            .map((path) => f.find((file) => file.path === path))
            .filter(Boolean) as FileEntry[];
          if (selArray.length > 0) {
            act.deleteFiles(selArray);
          }
          lastActionRef.current = { type: actionType };
          break;
        }

        case 'yank': {
          const selArray = Array.from(sel)
            .map((path) => f.find((file) => file.path === path))
            .filter(Boolean) as FileEntry[];
          if (selArray.length > 0) {
            act.copyFiles(selArray);
          }
          lastActionRef.current = { type: actionType };
          break;
        }

        case 'paste': {
          act.pasteFiles();
          lastActionRef.current = { type: actionType };
          break;
        }

        case 'toggle_visual': {
          if (modeRef.current === 'visual') {
            setMode('normal');
            setVisualAnchor(null);
          } else {
            setMode('visual');
            setVisualAnchor(currentIdx >= 0 ? currentIdx : 0);
            // If nothing selected, select current
            if (currentIdx >= 0) {
              selectIndex(currentIdx, false);
            }
          }
          // Don't record mode toggles as repeatable
          break;
        }

        case 'visual_line': {
          // V — select all between current and previously selected
          if (currentIdx < 0 || f.length === 0) break;
          const anchor = visualAnchorRef.current ?? 0;
          setMode('visual');
          setVisualAnchor(anchor);
          const start = Math.min(anchor, currentIdx);
          const end = Math.max(anchor, currentIdx);
          const newSel = new Set<string>();
          for (let i = start; i <= end; i++) {
            newSel.add(f[i].path);
          }
          act.setSelectedFiles(newSel);
          break;
        }

        case 'open_default': {
          if (currentIdx < 0) break;
          const file = f[currentIdx];
          act.openFile(file);
          lastActionRef.current = { type: actionType };
          break;
        }

        case 'rename': {
          if (currentIdx < 0) break;
          const file = f[currentIdx];
          act.renameFile(file);
          lastActionRef.current = { type: actionType };
          break;
        }

        case 'bookmark': {
          act.addBookmark(currentPathRef.current);
          lastActionRef.current = { type: actionType };
          break;
        }

        case 'repeat': {
          const last = lastActionRef.current;
          if (last) {
            executeAction(last.type, last.payload);
          }
          break;
        }

        case 'escape': {
          setMode('normal');
          setVisualAnchor(null);
          act.setSelectedFiles(new Set());
          act.setSelectedFile(null);
          break;
        }
      }
    },
    [getFocusedIndex, selectIndex],
  );

  // ── Clear pending key buffer ──────────────────────────────────────────────
  const clearPending = useCallback(() => {
    pendingKeyRef.current = '';
    setPendingKeys('');
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  }, []);

  // ── Main keyboard handler ─────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;

      // Never intercept when focus is in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Ignore if any modifier key other than Shift is pressed (let normal shortcuts work)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key;

      // In insert mode, only intercept Escape to return to normal mode
      if (modeRef.current === 'insert') {
        if (key === 'Escape') {
          e.preventDefault();
          setMode('normal');
        }
        return;
      }

      // ── Handle pending multi-key sequences ──────────────────────────
      const pending = pendingKeyRef.current;

      if (pending === 'g') {
        clearPending();
        if (key === 'g') {
          e.preventDefault();
          executeAction('go_first');
        }
        // Any other key after 'g' is ignored (invalid sequence)
        return;
      }

      if (pending === 'd') {
        clearPending();
        if (key === 'd') {
          e.preventDefault();
          executeAction('delete');
        }
        return;
      }

      if (pending === 'y') {
        clearPending();
        if (key === 'y') {
          e.preventDefault();
          executeAction('yank');
        }
        return;
      }

      // ── Start multi-key sequences ───────────────────────────────────
      if (key === 'g' || key === 'd' || key === 'y') {
        e.preventDefault();
        pendingKeyRef.current = key;
        setPendingKeys(key);
        // Auto-clear after a short timeout so stale pending keys don't linger
        pendingTimerRef.current = setTimeout(() => {
          pendingKeyRef.current = '';
          setPendingKeys('');
        }, 500);
        return;
      }

      // ── Single-key commands ─────────────────────────────────────────

      switch (key) {
        // "i" enters insert mode (focus on rename / allow text inputs through)
        case 'i': {
          e.preventDefault();
          setMode('insert');
          break;
        }

        // ":" enters command mode (opens command palette)
        case ':': {
          e.preventDefault();
          setMode('command');
          // Dispatch a custom event that the command palette can listen for
          window.dispatchEvent(new CustomEvent('vim-command-mode'));
          // Return to normal mode after a short delay (command palette takes over)
          setTimeout(() => {
            setMode('normal');
          }, 200);
          break;
        }

        case 'j': {
          e.preventDefault();
          executeAction('move_down');
          break;
        }

        case 'k': {
          e.preventDefault();
          executeAction('move_up');
          break;
        }

        case 'h': {
          e.preventDefault();
          executeAction('go_parent');
          break;
        }

        case 'l':
        case 'Enter': {
          e.preventDefault();
          executeAction('open_entry');
          break;
        }

        case 'G': {
          e.preventDefault();
          executeAction('go_last');
          break;
        }

        case '/': {
          e.preventDefault();
          executeAction('focus_search');
          break;
        }

        case 'p': {
          e.preventDefault();
          executeAction('paste');
          break;
        }

        case 'v': {
          e.preventDefault();
          executeAction('toggle_visual');
          break;
        }

        case 'V': {
          e.preventDefault();
          executeAction('visual_line');
          break;
        }

        case 'o': {
          e.preventDefault();
          executeAction('open_default');
          break;
        }

        case 'r': {
          e.preventDefault();
          executeAction('rename');
          break;
        }

        case 'm': {
          e.preventDefault();
          executeAction('bookmark');
          break;
        }

        case '.': {
          e.preventDefault();
          executeAction('repeat');
          break;
        }

        case 'Escape': {
          e.preventDefault();
          // Insert mode Escape is handled by the early return above;
          // here we handle Escape in normal/visual/command modes.
          executeAction('escape');
          break;
        }

        // Unrecognized key — do nothing, let it propagate
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearPending();
    };
  }, [enabled, executeAction, clearPending]);

  // Clean up pending timer on unmount
  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
      }
    };
  }, []);

  return {
    mode,
    enabled,
    visualAnchor,
    pendingKeys,
    learningMode,
  };
};
