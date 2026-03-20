import { useEffect, useCallback, useRef } from 'react';
import { TauriAPI, ShortcutAction, ShortcutBinding } from '@/lib/tauri-api';
import { listenToEvent } from '@/lib/transport';
import { getKeyString } from '@/lib/shortcut-utils';

export interface ShortcutHandlers {
  // File operations
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onRename?: () => void;
  onNewFolder?: () => void;
  onNewFile?: () => void;
  onDuplicate?: () => void;
  onRefresh?: () => void;
  onSelectAll?: () => void;

  // Navigation
  onNavigateUp?: () => void;
  onNavigateBack?: () => void;
  onNavigateForward?: () => void;
  onGoHome?: () => void;
  onGoToPath?: () => void;
  onToggleHiddenFiles?: () => void;

  // View operations
  onTogglePreview?: () => void;
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
  onToggleBottomPanel?: () => void;
  onSwitchViewMode?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;

  // Search and selection
  onSearch?: () => void;
  onQuickSearch?: () => void;
  onNaturalLanguageSearch?: () => void;
  onFilterFiles?: () => void;
  onClearSelection?: () => void;
  onInvertSelection?: () => void;

  // Application
  onOpenSettings?: () => void;
  onToggleFullscreen?: () => void;
  onQuit?: () => void;
  onNewWindow?: () => void;
  onCloseTab?: () => void;
  onNextTab?: () => void;
  onPreviousTab?: () => void;

  // Terminal
  onOpenTerminal?: () => void;

  // Extension actions
  onExtensionAction?: (
    extensionId: string,
    actionId: string,
    params?: Record<string, string>,
  ) => void;
}

// ── Module-level shortcut cache ───────────────────────────────────────────
// Loaded once, shared across all instances of useShortcuts.
// Map: "key_combination" → ShortcutBinding (for matching context + enabled)

let shortcutMap: Map<string, ShortcutBinding[]> = new Map();
let shortcutsLoaded = false;
let loadPromise: Promise<void> | null = null;

const buildMap = (bindings: ShortcutBinding[]) => {
  const map = new Map<string, ShortcutBinding[]>();
  for (const b of bindings) {
    if (!b.enabled) continue;
    const key = b.key_combination;
    const list = map.get(key);
    if (list) list.push(b);
    else map.set(key, [b]);
  }
  shortcutMap = map;
  shortcutsLoaded = true;
}

async function ensureLoaded() {
  if (shortcutsLoaded) return;
  if (!loadPromise) {
    loadPromise = TauriAPI.getShortcuts()
      .then(buildMap)
      .catch((err) => console.error('Failed to load shortcuts:', err))
      .finally(() => {
        loadPromise = null;
      });
  }
  await loadPromise;
}

/** Reload the shortcut map (e.g. after settings change). */
export const reloadShortcuts = () => {
  shortcutsLoaded = false;
  loadPromise = null;
  ensureLoaded();
}

/** Synchronous lookup — returns the action if a binding matches. */
const resolveAction = (keyCombo: string, context: string) : ShortcutAction | null => {
  const bindings = shortcutMap.get(keyCombo);
  if (!bindings) return null;
  for (const b of bindings) {
    if (b.context === null || b.context === context) {
      return b.action;
    }
  }
  return null;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export const useShortcuts = (handlers: ShortcutHandlers, context: string = 'file-explorer') => {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const executeAction = useCallback((action: ShortcutAction) => {
    const h = handlersRef.current;
    switch (action) {
      case 'Copy':
        h.onCopy?.();
        break;
      case 'Cut':
        h.onCut?.();
        break;
      case 'Paste':
        h.onPaste?.();
        break;
      case 'Delete':
        h.onDelete?.();
        break;
      case 'Rename':
        h.onRename?.();
        break;
      case 'NewFolder':
        h.onNewFolder?.();
        break;
      case 'NewFile':
        h.onNewFile?.();
        break;
      case 'Duplicate':
        h.onDuplicate?.();
        break;
      case 'Refresh':
        h.onRefresh?.();
        break;
      case 'SelectAll':
        h.onSelectAll?.();
        break;
      case 'NavigateUp':
        h.onNavigateUp?.();
        break;
      case 'NavigateBack':
        h.onNavigateBack?.();
        break;
      case 'NavigateForward':
        h.onNavigateForward?.();
        break;
      case 'GoHome':
        h.onGoHome?.();
        break;
      case 'GoToPath':
        h.onGoToPath?.();
        break;
      case 'ToggleHiddenFiles':
        h.onToggleHiddenFiles?.();
        break;
      case 'TogglePreview':
        h.onTogglePreview?.();
        break;
      case 'ToggleLeftSidebar':
        h.onToggleLeftSidebar?.();
        break;
      case 'ToggleRightSidebar':
        h.onToggleRightSidebar?.();
        break;
      case 'ToggleBottomPanel':
        h.onToggleBottomPanel?.();
        break;
      case 'SwitchViewMode':
        h.onSwitchViewMode?.();
        break;
      case 'ZoomIn':
        h.onZoomIn?.();
        break;
      case 'ZoomOut':
        h.onZoomOut?.();
        break;
      case 'Search':
        h.onSearch?.();
        break;
      case 'QuickSearch':
        h.onQuickSearch?.();
        break;
      case 'NaturalLanguageSearch':
        h.onNaturalLanguageSearch?.();
        break;
      case 'FilterFiles':
        h.onFilterFiles?.();
        break;
      case 'ClearSelection':
        h.onClearSelection?.();
        break;
      case 'InvertSelection':
        h.onInvertSelection?.();
        break;
      case 'OpenSettings':
        h.onOpenSettings?.();
        break;
      case 'ToggleFullscreen':
        h.onToggleFullscreen?.();
        break;
      case 'Quit':
        h.onQuit?.();
        break;
      case 'NewWindow':
        h.onNewWindow?.();
        break;
      case 'CloseTab':
        h.onCloseTab?.();
        break;
      case 'NextTab':
        h.onNextTab?.();
        break;
      case 'PreviousTab':
        h.onPreviousTab?.();
        break;
      case 'OpenTerminal':
        h.onOpenTerminal?.();
        break;
      default:
        if (typeof action === 'object' && 'ExtensionAction' in action) {
          const ea = action.ExtensionAction;
          h.onExtensionAction?.(ea.extension_id, ea.action_id, ea.params);
        }
        break;
    }
  }, []);

  useEffect(() => {
    // Ensure shortcuts are loaded before keydown events fire
    ensureLoaded();

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      // Ignore if a modal dialog or command palette is open
      if (target.closest('[role="dialog"]') || document.querySelector('[data-command-palette]')) {
        return;
      }

      const keyString = getKeyString(event);
      if (!keyString) return;

      // Synchronous lookup — no IPC roundtrip
      const action = resolveAction(keyString, context);
      if (action) {
        event.preventDefault();
        event.stopPropagation();
        executeAction(action);
      }
    };

    // Listen for global shortcuts from the backend
    const unlistenGlobal = listenToEvent<ShortcutAction>('global_shortcut_triggered', (action) => {
      executeAction(action);
    });

    // Reload map when shortcuts are changed from settings
    const handleShortcutsChanged = () => reloadShortcuts();
    window.addEventListener('shortcuts-changed', handleShortcutsChanged);

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('shortcuts-changed', handleShortcutsChanged);
      unlistenGlobal.then((unlisten) => unlisten()).catch(console.error);
    };
  }, [context, executeAction]);
}
