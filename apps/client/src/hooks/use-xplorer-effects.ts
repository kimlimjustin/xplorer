import { useEffect, useMemo, useRef, useState } from 'react';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';
import { PATH_SEPARATOR } from '@/lib/constants';
import { showInputToast } from '@/components/ui/Toast';
import { invertSelection } from '@/extensions/advanced-selection/selection-utils';
import {
  getBookmarkBySlot,
  setPathBookmark as assignPathBookmark,
  getFolderName,
} from '@/lib/path-bookmarks';
import { extensionHost } from '@/lib/extension-host';
import { startTour, isTourCompleted } from '@/hooks/use-tour';
import { useShortcuts } from '@/hooks/use-shortcuts';
import { useVimMode, isVimModeEnabled, type VimModeActions } from '@/hooks/use-vim-mode';
import { useCommandPaletteCommands } from '@/hooks/use-command-palette-commands';
import type { TabItem, EditorGroup } from '@/types/split-view';
import type { BottomPanelTabId } from '@/hooks/use-layout-state';
import type { SplitLayoutHook } from '@/hooks/use-split-layout';
import type { Toast } from '@/hooks/use-toast';
import type { ClipboardState } from '@/hooks/use-context-menu';
import type { ContextMenuAction } from '@/lib/context-menu-factory';
import type { FileChangeSet } from '@/hooks/use-focus-change-tracker';
import type { TopBarHandle } from '@/components/explorer/TopBar';
import type { LeftSidebarHandle } from '@/components/explorer/LeftSidebar';

// ── Types ────────────────────────────────────────────────────────────────────

interface XplorerWindowState {
  currentPath: string;
  selectedFiles: Array<{ name: string; path: string; is_dir: boolean }>;
  navigateTo: (path: string) => void;
}

interface WindowWithXplorer {
  __xplorer_state__?: XplorerWindowState;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const UI_STATE_KEY = 'xplorer:ui-state';

const saveUiState = (patch: Record<string, unknown>) => {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    const parsedRaw = raw ? JSON.parse(raw) : {};
    const existing = typeof parsedRaw === 'object' && parsedRaw !== null ? parsedRaw : {};
    localStorage.setItem(UI_STATE_KEY, JSON.stringify({ ...existing, ...patch }));
  } catch (e) {
    console.warn('Failed to save UI state:', e);
  }
};

const formatError = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch (e) {
    console.warn('Failed to stringify error:', e);
    return String(err);
  }
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface XplorerEffectsDeps {
  currentPath: string;
  files: FileEntry[];
  selectedFiles: Set<string>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedFile: FileEntry | null;
  setSelectedFile: React.Dispatch<React.SetStateAction<FileEntry | null>>;
  filteredFiles: FileEntry[];
  refetch: () => void;
  toast: (opts: Toast) => void;
  pendingSelectRef: React.MutableRefObject<string | null>;
  topBarRef: React.RefObject<TopBarHandle | null>;
  leftSidebarRef?: React.RefObject<LeftSidebarHandle | null>;

  // Navigation
  navigateWithHistory: (path: string) => void;
  navigateUp: () => void;
  navigateBackInHistory: () => void;
  navigateForwardInHistory: () => void;
  setCurrentPath: (path: string) => void;
  handleFileDoubleClick: (file: FileEntry) => void;

  // Split layout
  splitLayoutRef: React.MutableRefObject<SplitLayoutHook>;
  activeGroupRef: React.MutableRefObject<EditorGroup>;
  navigateToPathRef: React.MutableRefObject<(path: string) => void>;
  splitLayout: SplitLayoutHook;
  activeGroup: EditorGroup;
  activeTabObj: TabItem | undefined;
  tabs: TabItem[];
  activeTab: string | null;
  pathHistory: string[];
  historyIndex: number;

  // Layout state
  viewMode: string;
  setViewMode: React.Dispatch<React.SetStateAction<string>>;
  leftSidebarCollapsed: boolean;
  setLeftSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  rightSidebarCollapsed: boolean;
  setRightSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  bottomPanelCollapsed: boolean;
  setBottomPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  rightPanelTab: string;
  setRightPanelTab: React.Dispatch<React.SetStateAction<string>>;
  bottomPanelTab: BottomPanelTabId;
  setBottomPanelTab: React.Dispatch<React.SetStateAction<BottomPanelTabId>>;
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  bottomPanelHeight: number;
  searchPanelOpen: boolean;
  setSearchPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  theme: string;

  // Dialog state setters
  setCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  commandPaletteOpen: boolean;
  setWorkspaceLayoutDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPathBookmarksDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShortcutsDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowChangeSummaryToast: React.Dispatch<React.SetStateAction<boolean>>;

  // File operations
  fileOps: {
    clipboard: ClipboardState | null;
    setClipboard: (val: ClipboardState | null) => void;
    copySelectedFiles: () => void;
    cutSelectedFiles: () => void;
    pasteFiles: () => Promise<void>;
    deleteSelectedFiles: () => Promise<void>;
    handleDelete: () => Promise<void>;
    handleCreateFolder: () => Promise<void>;
    contextMenuActions: ContextMenuAction;
  };

  // File changes
  fileChanges: FileChangeSet | null;

  // Google Drive
  openGDriveTab: (accountId: string, accountName: string) => void;
  openGDriveManager: () => void;

  // Vim actions
  vimActions: VimModeActions;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useXplorerEffects = (deps: XplorerEffectsDeps) => {
  const {
    currentPath,
    files,
    selectedFiles,
    setSelectedFiles,
    selectedFile,
    setSelectedFile,
    filteredFiles,
    refetch,
    toast,
    pendingSelectRef,
    topBarRef: _topBarRef,
    leftSidebarRef,
    navigateWithHistory,
    navigateUp,
    navigateBackInHistory,
    navigateForwardInHistory,
    setCurrentPath,
    handleFileDoubleClick: _handleFileDoubleClick,
    splitLayoutRef,
    activeGroupRef,
    navigateToPathRef,
    splitLayout,
    activeGroup,
    activeTabObj,
    tabs,
    activeTab,
    pathHistory,
    historyIndex,
    viewMode,
    setViewMode,
    leftSidebarCollapsed,
    setLeftSidebarCollapsed,
    rightSidebarCollapsed,
    setRightSidebarCollapsed,
    bottomPanelCollapsed,
    setBottomPanelCollapsed,
    rightPanelTab,
    setRightPanelTab,
    bottomPanelTab,
    setBottomPanelTab,
    leftSidebarWidth,
    rightSidebarWidth,
    bottomPanelHeight,
    searchPanelOpen: _searchPanelOpen,
    setSearchPanelOpen,
    sortBy,
    sortOrder,
    theme,
    setCommandPaletteOpen,
    commandPaletteOpen,
    setWorkspaceLayoutDialogOpen,
    setPathBookmarksDialogOpen,
    setShortcutsDialogOpen,
    setShowChangeSummaryToast,
    fileOps,
    fileChanges,
    openGDriveTab,
    openGDriveManager,
    vimActions,
  } = deps;

  // ── Show toast when file changes are detected ──────────────────────────────
  useEffect(() => {
    if (fileChanges && fileChanges.totalCount > 0) {
      setShowChangeSummaryToast(true);
    }
  }, [fileChanges, setShowChangeSummaryToast]);

  // ── Auto-select file after navigating from search results ──────────────────
  useEffect(() => {
    if (pendingSelectRef.current && files.length > 0) {
      const target = pendingSelectRef.current;
      pendingSelectRef.current = null;
      const file = files.find((f) => f.path === target);
      if (file) {
        setSelectedFile(file);
        setSelectedFiles(new Set([file.path]));
      }
    }
  }, [files, pendingSelectRef, setSelectedFile, setSelectedFiles]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useShortcuts(
    {
      onCopy: fileOps.copySelectedFiles,
      onCut: fileOps.cutSelectedFiles,
      onPaste: fileOps.pasteFiles,
      onDelete: fileOps.deleteSelectedFiles,
      onRename: () => {
        if (selectedFiles.size === 1) {
          const filePath = Array.from(selectedFiles)[0];
          window.dispatchEvent(
            new CustomEvent('start-inline-rename', { detail: { path: filePath } }),
          );
        }
      },
      onNewFolder: async () => {
        if (
          !currentPath ||
          currentPath.startsWith('xplorer://') ||
          currentPath.startsWith('collection://')
        ) {
          return;
        }
        const folderName = await showInputToast({
          title: 'Create New Folder',
          description: 'Enter a name for the new folder',
          placeholder: 'Folder name',
          submitText: 'Create',
          cancelText: 'Cancel',
        });
        if (!folderName) return;
        try {
          const fp =
            currentPath + (currentPath.endsWith(PATH_SEPARATOR) ? '' : PATH_SEPARATOR) + folderName;
          await TauriAPI.createDirRecursive(fp);
          refetch();
          toast({ title: 'Folder Created', description: `Created "${folderName}"` });
        } catch (err) {
          toast({
            variant: 'destructive',
            title: 'Create Folder Failed',
            description: formatError(err),
          });
        }
      },
      onSelectAll: () => {
        if (files) setSelectedFiles(new Set(files.map((f) => f.path)));
      },
      onClearSelection: () => {
        setSelectedFiles(new Set());
      },
      onInvertSelection: () => {
        if (files) {
          const inverted = invertSelection(files, selectedFiles);
          setSelectedFiles(new Set(inverted));
        }
      },
      onDuplicate: async () => {
        if (
          selectedFiles.size === 0 ||
          !currentPath ||
          currentPath.startsWith('xplorer://') ||
          currentPath.startsWith('collection://')
        ) {
          return;
        }
        const filesToDuplicate = Array.from(selectedFiles);
        let duplicated = 0;
        for (const filePath of filesToDuplicate) {
          try {
            const sep = filePath.includes('/') ? '/' : '\\';
            const lastSepIdx = filePath.lastIndexOf(sep);
            const parentDir = filePath.substring(0, lastSepIdx);
            const fileName = filePath.substring(lastSepIdx + 1);
            const dotIdx = fileName.lastIndexOf('.');
            const baseName = dotIdx > 0 ? fileName.substring(0, dotIdx) : fileName;
            const ext = dotIdx > 0 ? fileName.substring(dotIdx) : '';
            const destPath = `${parentDir}${sep}${baseName} - Copy${ext}`;
            await TauriAPI.acceleratedCopyFile(filePath, destPath);
            duplicated++;
          } catch (err) {
            toast({
              variant: 'destructive',
              title: 'Duplicate Failed',
              description: formatError(err),
            });
          }
        }
        if (duplicated > 0) {
          refetch();
          toast({
            title: 'Duplicated',
            description: `Duplicated ${duplicated} item${duplicated > 1 ? 's' : ''}`,
          });
        }
      },
      onRefresh: () => {
        refetch();
      },
      onNavigateUp: () => {
        navigateUp();
      },
      onNavigateBack: () => {
        navigateBackInHistory();
      },
      onNavigateForward: () => {
        navigateForwardInHistory();
      },
      onGoHome: () => {
        setCurrentPath('xplorer://home');
      },
      onGoToPath: () => {
        leftSidebarRef?.current?.focusSearch();
      },
      onToggleLeftSidebar: () => {
        setLeftSidebarCollapsed((prev) => !prev);
      },
      onToggleRightSidebar: () => {
        setRightSidebarCollapsed((prev) => !prev);
      },
      onToggleBottomPanel: () => {
        setBottomPanelCollapsed((prev) => !prev);
      },
      onTogglePreview: () => {
        setRightSidebarCollapsed(!rightSidebarCollapsed);
        if (rightSidebarCollapsed) setRightPanelTab('preview');
      },
      onOpenTerminal: () => {
        setBottomPanelCollapsed(false);
        setBottomPanelTab('terminal');
      },
      onSearch: () => {
        leftSidebarRef?.current?.focusSearch();
      },
      onQuickSearch: () => {
        setCommandPaletteOpen(true);
      },
      onNaturalLanguageSearch: () => {
        leftSidebarRef?.current?.focusSearch();
      },
      onOpenSettings: () => {
        navigateWithHistory('xplorer://settings');
      },
      onToggleFullscreen: () => {
        document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen();
      },
      onNewWindow: () => {
        window.open(window.location.href, '_blank');
      },
      onSwitchViewMode: () => {
        const modes = ['list', 'small', 'medium', 'large'];
        const currentIndex = modes.indexOf(viewMode);
        setViewMode(modes[(currentIndex + 1) % modes.length]);
      },
      onZoomIn: () => {
        const current = parseFloat(document.documentElement.style.fontSize || '16');
        document.documentElement.style.fontSize = `${Math.min(current + 1, 24)}px`;
      },
      onZoomOut: () => {
        const current = parseFloat(document.documentElement.style.fontSize || '16');
        document.documentElement.style.fontSize = `${Math.max(current - 1, 10)}px`;
      },
      onCloseTab: () => {
        splitLayout.closeTab(activeGroup.id, activeGroup.activeTabId);
      },
      onNextTab: () => {
        const ci = tabs.findIndex((t) => t.id === activeTab);
        splitLayout.switchTab(activeGroup.id, tabs[(ci + 1) % tabs.length].id);
      },
      onPreviousTab: () => {
        const ci = tabs.findIndex((t) => t.id === activeTab);
        splitLayout.switchTab(activeGroup.id, tabs[ci === 0 ? tabs.length - 1 : ci - 1].id);
      },
    },
    'file-explorer',
  );

  // ── Split-pane keyboard shortcuts ─────────────────────────────────────────
  useEffect(() => {
    const handleSplitShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault();
        const ag = activeGroupRef.current;
        if (e.shiftKey) {
          splitLayoutRef.current.splitGroup(ag.id, 'horizontal');
        } else {
          splitLayoutRef.current.splitGroup(ag.id, 'vertical');
        }
      }
    };
    document.addEventListener('keydown', handleSplitShortcuts);
    return () => document.removeEventListener('keydown', handleSplitShortcuts);
  }, [activeGroupRef, splitLayoutRef]);

  // ── Command Palette, Quick Look, Undo/Redo ────────────────────────────────
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearchPanelOpen((prev) => !prev);
        setLeftSidebarCollapsed(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setWorkspaceLayoutDialogOpen((prev) => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShortcutsDialogOpen((prev) => !prev);
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '?' && !isInput) {
        e.preventDefault();
        setShortcutsDialogOpen((prev) => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !isInput) {
        e.preventDefault();
        TauriAPI.undoOperation()
          .then((result) => {
            if (result.success) {
              toast({ title: 'Undo', description: result.message });
              refetch();
            }
          })
          .catch((err) => {
            console.error('Undo operation failed:', err);
            toast({ variant: 'destructive', title: 'Undo Failed', description: formatError(err) });
          });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z' && !isInput) {
        e.preventDefault();
        TauriAPI.redoOperation()
          .then((result) => {
            if (result.success) {
              toast({ title: 'Redo', description: result.message });
              refetch();
            }
          })
          .catch((err) => {
            console.error('Redo operation failed:', err);
            toast({ variant: 'destructive', title: 'Redo Failed', description: formatError(err) });
          });
        return;
      }
      if (e.key === ' ' && !isInput && !commandPaletteOpen) {
        e.preventDefault();
        if (selectedFile) {
          if (!rightSidebarCollapsed && rightPanelTab === 'preview') {
            setRightSidebarCollapsed(true);
          } else {
            setRightPanelTab('preview');
            setRightSidebarCollapsed(false);
          }
        }
      }
    };
    document.addEventListener('keydown', handleGlobalKeys, true);
    return () => document.removeEventListener('keydown', handleGlobalKeys, true);
  }, [
    commandPaletteOpen,
    selectedFile,
    rightSidebarCollapsed,
    rightPanelTab,
    toast,
    refetch,
    setCommandPaletteOpen,
    setSearchPanelOpen,
    setLeftSidebarCollapsed,
    setWorkspaceLayoutDialogOpen,
    setShortcutsDialogOpen,
    setRightSidebarCollapsed,
    setRightPanelTab,
  ]);

  // ── Path Bookmarks keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    const handleBookmarkKeys = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return;

      if (!e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        e.stopPropagation();
        setPathBookmarksDialogOpen((prev) => !prev);
        return;
      }

      const digitFromKey = /^[1-9]$/.test(e.key) ? parseInt(e.key, 10) : 0;
      const digitFromCode = /^Digit[1-9]$/.test(e.code)
        ? parseInt(e.code.replace('Digit', ''), 10)
        : 0;
      const slot = digitFromKey || digitFromCode;
      if (slot < 1 || slot > 9) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.shiftKey) {
        if (currentPath && !currentPath.startsWith('xplorer://')) {
          assignPathBookmark(slot, currentPath);
          toast({ title: `Saved to bookmark ${slot}`, description: getFolderName(currentPath) });
        }
      } else {
        const bm = getBookmarkBySlot(slot);
        if (bm) {
          navigateWithHistory(bm.path);
          toast({ title: `Bookmark ${slot}`, description: bm.label || getFolderName(bm.path) });
        }
      }
    };
    document.addEventListener('keydown', handleBookmarkKeys, true);
    return () => document.removeEventListener('keydown', handleBookmarkKeys, true);
  }, [currentPath, toast, navigateWithHistory, setPathBookmarksDialogOpen]);

  // ── Initialize extension system ───────────────────────────────────────────
  useEffect(() => {
    extensionHost.loadInstalledExtensions();
    (window as unknown as WindowWithXplorer).__xplorer_state__ = {
      currentPath: '',
      selectedFiles: [] as Array<{ name: string; path: string; is_dir: boolean }>,
      navigateTo: (path: string) => navigateToPathRef.current(path),
    };
    return () => {
      delete (window as unknown as WindowWithXplorer).__xplorer_state__;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync currentPath to extension state ───────────────────────────────────
  useEffect(() => {
    const state = (window as unknown as WindowWithXplorer).__xplorer_state__;
    if (state) {
      state.currentPath = currentPath;
    }
    window.dispatchEvent(
      new CustomEvent('xplorer-state-change', {
        detail: { type: 'currentPath', value: currentPath },
      }),
    );
  }, [currentPath]);

  // ── Auto-start onboarding tour ────────────────────────────────────────────
  useEffect(() => {
    if (!isTourCompleted()) {
      const timer = setTimeout(() => startTour(), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // ── Sync selectedFiles to extension state ─────────────────────────────────
  useEffect(() => {
    const state = (window as unknown as WindowWithXplorer).__xplorer_state__;
    if (state) {
      const mapped = Array.from(selectedFiles).map((p) => {
        const entry = files?.find((f) => f.path === p);
        const name = p.split(/[/\\]/).pop() || p;
        return { name: entry?.name || name, path: p, is_dir: entry?.is_dir ?? false };
      });
      state.selectedFiles = mapped;
      window.dispatchEvent(
        new CustomEvent('xplorer-state-change', {
          detail: { type: 'selectedFiles', value: mapped },
        }),
      );
    }
  }, [selectedFiles, files]);

  // ── File watcher ──────────────────────────────────────────────────────────
  useEffect(() => {
    const isRealPath =
      currentPath &&
      activeTabObj?.type !== 'editor' &&
      !currentPath.startsWith('xplorer://') &&
      !currentPath.startsWith('gdrive://') &&
      !currentPath.startsWith('comparison://') &&
      !currentPath.startsWith('collection://');
    if (!isRealPath) return;
    let watcherId: string | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let unlisten: (() => void) | undefined;
    const debouncedRefetch = () => {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        refetch();
      }, 1000);
    };
    (async () => {
      try {
        watcherId = await TauriAPI.watchDirectory(currentPath, false);
      } catch (err) {
        console.warn('[watcher] Failed to watch directory:', err);
      }
      try {
        unlisten = await TauriAPI.listenToEvent<{
          watcher_id: string;
          path: string;
          event_type: string;
          timestamp: number;
        }>('fs-change', (event) => {
          if (watcherId && event.watcher_id === watcherId) {
            debouncedRefetch();
          }
        });
      } catch (err) {
        console.warn('[watcher] Failed to listen for fs-change events:', err);
      }
    })();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unlisten?.();
      if (watcherId) {
        TauriAPI.unwatchDirectory(watcherId).catch((err) =>
          console.error('Failed to unwatch directory:', err),
        );
      }
    };
  }, [currentPath, refetch, activeTabObj]);

  // ── Vim mode ──────────────────────────────────────────────────────────────
  const [vimEnabled, setVimEnabled] = useState(() => isVimModeEnabled());
  useEffect(() => {
    const onFocus = () => setVimEnabled(isVimModeEnabled());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'xplorer-vim-mode') setVimEnabled(e.newValue === 'true');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const vimState = useVimMode({
    enabled: vimEnabled,
    files: filteredFiles,
    selectedFiles,
    currentPath,
    clipboard: fileOps.clipboard,
    actions: vimActions,
  });

  // ── GDrive event listeners ────────────────────────────────────────────────
  useEffect(() => {
    const handleOpenGDriveTab = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.accountId) {
        openGDriveTab(detail.accountId, detail.accountName || detail.accountId);
      }
    };
    const handleOpenGDriveManager = () => openGDriveManager();
    window.addEventListener('open-gdrive-tab', handleOpenGDriveTab);
    window.addEventListener('open-gdrive-setup', handleOpenGDriveManager);
    window.addEventListener('open-gdrive-management', handleOpenGDriveManager);
    return () => {
      window.removeEventListener('open-gdrive-tab', handleOpenGDriveTab);
      window.removeEventListener('open-gdrive-setup', handleOpenGDriveManager);
      window.removeEventListener('open-gdrive-management', handleOpenGDriveManager);
    };
  }, [openGDriveManager, openGDriveTab]);

  // ── Listen for folder-opened event (from shell integration / "Open with Xplorer") ──
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    import('@tauri-apps/api/event')
      .then(({ listen }) => {
        listen<string>('folder-opened', (event) => {
          if (event.payload && typeof event.payload === 'string') {
            navigateWithHistory(event.payload);
          }
        }).then((fn) => {
          unlisten = fn;
        });
      })
      .catch(() => {});

    return () => {
      unlisten?.();
    };
  }, [navigateWithHistory]);

  // ── Persist UI state to localStorage (debounced) ──────────────────────────
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const patch: Record<string, unknown> = {
        viewMode,
        leftSidebarCollapsed,
        rightSidebarCollapsed,
        bottomPanelCollapsed,
        rightPanelTab,
        bottomPanelTab,
        leftSidebarWidth,
        rightSidebarWidth,
        bottomPanelHeight,
        theme,
        sortBy,
        sortOrder,
      };
      if (
        currentPath &&
        !currentPath.startsWith('xplorer://') &&
        !currentPath.startsWith('collection://') &&
        !currentPath.startsWith('gdrive://') &&
        !currentPath.startsWith('comparison://')
      ) {
        patch.lastRealPath = currentPath;
      }
      saveUiState(patch);
    }, 300);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [
    viewMode,
    leftSidebarCollapsed,
    rightSidebarCollapsed,
    bottomPanelCollapsed,
    rightPanelTab,
    bottomPanelTab,
    leftSidebarWidth,
    rightSidebarWidth,
    bottomPanelHeight,
    theme,
    sortBy,
    sortOrder,
    currentPath,
  ]);

  // ── Extension: openInEditor event ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { path } = (e as CustomEvent).detail;
      if (!path) return;
      const name = path.split(/[/\\]/).pop() || path;
      const sl = splitLayoutRef.current;
      const group = sl.state.groups[sl.state.activeGroupId];
      const existing = group?.tabs.find((t: TabItem) => t.type === 'editor' && t.path === path);
      if (existing) {
        sl.switchTab(group.id, existing.id);
        return;
      }
      const tab: TabItem = { id: `editor-${path}-${Date.now()}`, name, path, type: 'editor' };
      sl.addTab(sl.state.activeGroupId, tab, true);
    };
    window.addEventListener('xplorer-open-in-editor', handler);
    return () => window.removeEventListener('xplorer-open-in-editor', handler);
  }, [splitLayoutRef]);

  // ── Command Palette commands ──────────────────────────────────────────────
  const builtinCommands = useCommandPaletteCommands({
    currentPath,
    pathHistory,
    historyIndex,
    files,
    navigateWithHistory,
    refetch,
    setViewMode,
    setRightSidebarCollapsed,
    setBottomPanelCollapsed,
    setBottomPanelTab,
    bottomPanelTab,
    bottomPanelCollapsed,
    setLeftSidebarCollapsed,
    setSelectedFiles,
    setShortcutsDialogOpen,
    handleCreateFolder: fileOps.handleCreateFolder,
    handleDelete: fileOps.handleDelete,
  });

  // Merge extension commands into the palette
  const [extCommandVersion, setExtCommandVersion] = useState(0);
  useEffect(() => {
    const sub = extensionHost.onCommandsChanged(() => setExtCommandVersion((v) => v + 1));
    return () => sub.dispose();
  }, []);

  const commandPaletteCommands = useMemo(() => {
    void extCommandVersion; // trigger re-compute when extension commands change
    const extCommands = extensionHost.getCommandPaletteEntries();
    return extCommands.length > 0 ? [...builtinCommands, ...extCommands] : builtinCommands;
  }, [builtinCommands, extCommandVersion]);

  return {
    vimState,
    vimEnabled,
    commandPaletteCommands,
  };
};
