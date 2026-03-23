import { useCallback, useMemo, useRef } from 'react';
import { TauriAPI, type FileEntry, type ConflictFileInfo } from '@/lib/tauri-api';
import { STORAGE_KEYS } from '@/lib/storage-keys';
import { PATH_SEPARATOR, detectSep } from '@/lib/constants';
import { isEditableFile } from '@/lib/editable-files';
import { showConfirmationToast, showInputToast } from '@/components/ui/Toast';
import type { TabItem, EditorGroup } from '@/types/split-view';
import type { SharedPaneActions } from '@/components/split-view/EditorGroupPane';
import type { WorkspaceLayoutUiState } from '@/lib/workspace-layouts';
import type { ConflictResolution } from '@/components/dialogs/FileConflictDialog';
import type { BottomPanelTabId } from '@/hooks/use-layout-state';
import type { SplitLayoutHook } from '@/hooks/use-split-layout';
import type { Toast } from '@/hooks/use-toast';
import type { ClipboardState } from '@/hooks/use-context-menu';
import type { ContextMenuAction } from '@/lib/context-menu-factory';
import type { DialogManagerResult } from '@/hooks/use-dialog-manager';
import type { CrossTabSelectionState } from '@/hooks/use-cross-tab-selection';
import type { TopBarHandle } from '@/components/explorer/TopBar';
import type { LeftSidebarHandle } from '@/components/explorer/LeftSidebar';
import type { FileCollection } from '@/lib/collections';

// ── Types ────────────────────────────────────────────────────────────────────

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

export interface XplorerActionsDeps {
  currentPath: string;
  splitLayout: SplitLayoutHook;
  activeGroup: EditorGroup;
  selectedFiles: Set<string>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedFile: React.Dispatch<React.SetStateAction<FileEntry | null>>;
  files: FileEntry[];
  refetch: () => void;
  toast: (opts: Toast) => void;
  fileOps: {
    clipboard: ClipboardState | null;
    setClipboard: (val: ClipboardState | null) => void;
    contextMenuActions: ContextMenuAction;
    pasteFiles: () => Promise<void>;
    renameFileInline: (oldPath: string, newName: string) => Promise<boolean>;
  };
  ctxMenu: {
    handleFileRightClick: (file: FileEntry, event: React.MouseEvent) => void;
    handleBackgroundRightClick: (event: React.MouseEvent) => void;
  };
  dialogManager: DialogManagerResult;
  crossTabSelection: CrossTabSelectionState;
  theme: string;
  setTheme: (theme: string) => void;
  handleQuickLook: (file: FileEntry) => void;
  handleGDriveFileSelect: (file: FileEntry) => void;
  setPaneFiles: React.Dispatch<React.SetStateAction<FileEntry[]>>;
  paneRefetchRef: React.MutableRefObject<() => void>;
  pendingSelectRef: React.MutableRefObject<string | null>;
  topBarRef: React.RefObject<TopBarHandle | null>;
  leftSidebarRef: React.RefObject<LeftSidebarHandle | null>;
  dismissFileChanges: () => void;

  // Layout state + setters
  viewMode: string;
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  bottomPanelCollapsed: boolean;
  setLeftSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setRightSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setBottomPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setBottomPanelTab: React.Dispatch<React.SetStateAction<BottomPanelTabId>>;
  setViewMode: React.Dispatch<React.SetStateAction<string>>;

  // Dialog state setters
  setShowChangeSummaryToast: React.Dispatch<React.SetStateAction<boolean>>;
  setFileConflict: React.Dispatch<
    React.SetStateAction<{
      fileName: string;
      isDir: boolean;
      destination: string;
      remaining: number;
      sourceInfo?: ConflictFileInfo | null;
      destInfo?: ConflictFileInfo | null;
      resolve: (resolution: ConflictResolution, applyToAll: boolean) => void;
    } | null>
  >;
  setTemplatePickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFolderCompareOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFolderComparePaths: React.Dispatch<React.SetStateAction<{ left: string; right: string }>>;
  setCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setQuickLookFile: React.Dispatch<React.SetStateAction<FileEntry | null>>;
  setPathBookmarksDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setWorkspaceLayoutDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCrossTabDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShortcutsDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCollectionEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingCollection: React.Dispatch<React.SetStateAction<FileCollection | null>>;
}

export const useXplorerActions = (deps: XplorerActionsDeps) => {
  const {
    currentPath,
    splitLayout,
    activeGroup,
    selectedFiles: _selectedFiles,
    setSelectedFiles,
    setSelectedFile,
    files,
    refetch,
    toast,
    fileOps,
    ctxMenu,
    dialogManager,
    crossTabSelection,
    theme,
    setTheme,
    handleQuickLook,
    handleGDriveFileSelect,
    setPaneFiles,
    paneRefetchRef,
    pendingSelectRef,
    topBarRef: _topBarRef,
    leftSidebarRef,
    dismissFileChanges,
    viewMode,
    leftSidebarCollapsed,
    rightSidebarCollapsed,
    bottomPanelCollapsed,
    setLeftSidebarCollapsed,
    setRightSidebarCollapsed,
    setBottomPanelCollapsed,
    setBottomPanelTab,
    setViewMode,
    setShowChangeSummaryToast,
    setFileConflict,
    setTemplatePickerOpen,
    setFolderCompareOpen,
    setFolderComparePaths: _setFolderComparePaths,
    setCommandPaletteOpen,
    setQuickLookFile,
    setPathBookmarksDialogOpen,
    setWorkspaceLayoutDialogOpen,
    setCrossTabDialogOpen,
    setShortcutsDialogOpen,
    setCollectionEditorOpen,
    setEditingCollection,
  } = deps;

  // Refs for splitLayout and activeGroup so callbacks stay stable
  const splitLayoutRef = useRef(splitLayout);
  splitLayoutRef.current = splitLayout;
  const activeGroupRef = useRef(activeGroup);
  activeGroupRef.current = activeGroup;
  const ctxMenuRef = useRef(ctxMenu);
  ctxMenuRef.current = ctxMenu;
  const dialogManagerRef = useRef(dialogManager);
  dialogManagerRef.current = dialogManager;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const navigateToPathRef = useRef<(path: string) => void>(() => {});

  // ── Navigation helpers ─────────────────────────────────────────────────────

  const setCurrentPath = useCallback((path: string) => {
    splitLayoutRef.current.navigate(
      activeGroupRef.current.id,
      path,
      path.split(/[/\\]/).pop() || path,
    );
  }, []);

  const navigateWithHistory = useCallback(
    (newPath: string, _addToHistory: boolean = true) => {
      if (newPath === currentPath) return;

      const ag = activeGroupRef.current;
      const sl = splitLayoutRef.current;

      const activeTabObj = ag.tabs.find((t: TabItem) => t.id === ag.activeTabId);
      const isGDriveTab =
        activeTabObj?.type === 'gdrive' || activeTabObj?.type === 'gdrive-manager';
      const isLocalPath =
        !newPath.startsWith('gdrive://') && !newPath.startsWith('xplorer://gdrive-manager');

      if (isGDriveTab && isLocalPath) {
        const folderTab = ag.tabs.find((t: TabItem) => t.type === 'folder' || t.type === undefined);
        if (folderTab) {
          sl.switchTab(ag.id, folderTab.id);
          setTimeout(() => sl.navigate(ag.id, newPath, newPath.split(/[/\\]/).pop() || newPath), 0);
        } else {
          const newTab: TabItem = {
            id: `tab-folder-${Date.now()}`,
            name: newPath.split(/[/\\]/).pop() || newPath,
            path: newPath,
            type: 'folder',
          };
          sl.addTab(ag.id, newTab, true);
        }
      } else {
        sl.navigate(ag.id, newPath, newPath.split(/[/\\]/).pop() || newPath);
      }

      if (
        !newPath.startsWith('xplorer://') &&
        !newPath.startsWith('gdrive://') &&
        !newPath.startsWith('comparison://') &&
        !newPath.startsWith('collection://')
      ) {
        TauriAPI.indexDirectory(newPath).catch((err) =>
          console.error('Failed to index directory:', err),
        );
        TauriAPI.setSearchContext(newPath).catch((err) =>
          console.error('Failed to set search context:', err),
        );
        if (localStorage.getItem(STORAGE_KEYS.AUTO_WHITELIST_VISITED) !== 'false') {
          TauriAPI.addWhitelistedPath(newPath).catch((err) =>
            console.error('Failed to whitelist path:', err),
          );
        }
      }
    },
    [currentPath],
  );

  const navigateUp = useCallback(() => {
    if (currentPath === 'xplorer://home') return;
    if (currentPath === 'xplorer://gdrive-manager') return;
    if (currentPath.startsWith('gdrive://')) return;
    if (currentPath.startsWith('collection://')) return;
    if (currentPath.startsWith('/')) {
      const parts = currentPath.split('/').filter(Boolean);
      if (parts.length <= 1) return;
      const parentPath = `/${parts.slice(0, -1).join('/')}`;
      navigateWithHistory(parentPath);
      return;
    }
    const pathParts = currentPath.split(/[\\/]/).filter((p) => p);
    if (pathParts.length <= 1) return;
    const parentPath = pathParts.slice(0, -1).join(PATH_SEPARATOR) + PATH_SEPARATOR;
    navigateWithHistory(parentPath);
  }, [currentPath, navigateWithHistory]);

  const navigateToPath = useCallback(
    (path: string) => {
      navigateWithHistory(path);
    },
    [navigateWithHistory],
  );
  navigateToPathRef.current = navigateToPath;

  const navigateToHome = useCallback(() => {
    navigateWithHistory('xplorer://home');
  }, [navigateWithHistory]);

  const navigateFromHome = useCallback((path: string) => {
    const tabId = path;
    const tabName = path.split(/[\\/]/).pop() || path;
    const newTab: TabItem = { id: tabId, name: tabName, path, type: 'folder' };
    splitLayoutRef.current.addTab(activeGroupRef.current.id, newTab, true);
  }, []);

  const navigateBackInHistory = useCallback(() => {
    splitLayoutRef.current.navigateBack(activeGroupRef.current.id);
  }, []);
  const navigateForwardInHistory = useCallback(() => {
    splitLayoutRef.current.navigateForward(activeGroupRef.current.id);
  }, []);
  const canNavigateBackInHistory = useCallback(
    () => activeGroup.historyIndex > 0,
    [activeGroup.historyIndex],
  );
  const canNavigateForwardInHistory = useCallback(
    () => activeGroup.historyIndex < activeGroup.pathHistory.length - 1,
    [activeGroup.historyIndex, activeGroup.pathHistory.length],
  );

  // ── File click handlers ────────────────────────────────────────────────────

  const addTab = useCallback((file: FileEntry) => {
    const newTab: TabItem = {
      id: file.path,
      name: file.name,
      path: file.path,
      type: file.is_dir ? 'folder' : 'file',
    };
    splitLayoutRef.current.addTab(activeGroupRef.current.id, newTab, true);
  }, []);

  const toggleFileSelection = useCallback(
    (filePath: string) => {
      setSelectedFiles((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(filePath)) {
          newSet.delete(filePath);
        } else {
          newSet.add(filePath);
        }
        return newSet;
      });
    },
    [setSelectedFiles],
  );

  const handleFileClick = useCallback(
    (file: FileEntry, event?: React.MouseEvent) => {
      setSelectedFile(file);
      if (event && (event.ctrlKey || event.metaKey)) {
        toggleFileSelection(file.path);
        return;
      }
      setSelectedFiles(new Set([file.path]));
    },
    [setSelectedFile, setSelectedFiles, toggleFileSelection],
  );

  const handleFileDoubleClick = useCallback(
    async (file: FileEntry) => {
      TauriAPI.addRecentFile(file.path).catch((err) =>
        console.error('Failed to add recent file:', err),
      );
      if (!file.is_dir) {
        try {
          await TauriAPI.openFile(file.path);
        } catch (error) {
          console.error('Failed to open file:', error);
          toast({
            variant: 'destructive',
            title: 'Open File Failed',
            description: `Failed to open "${file.name}": ${formatError(error)}`,
          });
        }
      } else {
        navigateWithHistory(file.path);
      }
    },
    [toast, navigateWithHistory],
  );

  // ── Change summary toast handlers ──────────────────────────────────────────

  const handleReviewChanges = useCallback(() => {
    setShowChangeSummaryToast(false);
    setBottomPanelCollapsed(false);
    setBottomPanelTab('changes');
  }, [setShowChangeSummaryToast, setBottomPanelCollapsed, setBottomPanelTab]);

  const handleDismissChangesToast = useCallback(() => {
    setShowChangeSummaryToast(false);
  }, [setShowChangeSummaryToast]);

  const handleDismissAllChanges = useCallback(() => {
    setShowChangeSummaryToast(false);
    dismissFileChanges();
  }, [dismissFileChanges, setShowChangeSummaryToast]);

  // ── Google Drive ───────────────────────────────────────────────────────────

  const openGDriveTab = useCallback((accountId: string, accountName: string) => {
    const ag = activeGroupRef.current;
    const sl = splitLayoutRef.current;
    const existingTab = ag.tabs.find(
      (tab: TabItem) => tab.type === 'gdrive' && tab.gdriveData?.accountId === accountId,
    );
    if (existingTab) {
      sl.switchTab(ag.id, existingTab.id);
      return;
    }
    const gdriveTab: TabItem = {
      id: `gdrive-${accountId}-${Date.now()}`,
      name: `\u2601 ${accountName}`,
      path: `gdrive://${accountId}/root`,
      type: 'gdrive',
      gdriveData: { accountId, folderId: 'root', folderName: 'My Drive' },
    };
    sl.addTab(ag.id, gdriveTab, true);
  }, []);

  const openGDriveManager = useCallback(() => {
    const managerTab: TabItem = {
      id: 'gdrive-manager',
      name: 'Google Drive',
      path: 'xplorer://gdrive-manager',
      type: 'gdrive-manager',
    };
    splitLayoutRef.current.addTab(activeGroupRef.current.id, managerTab, true);
  }, []);

  // ── Cross-tab batch operation handlers ────────────────────────────────────

  const handleCrossTabPickFolder = useCallback(async (): Promise<string | null> => {
    const result = await TauriAPI.showOpenDialog({ directory: true });
    return result && result.length > 0 ? result[0] : null;
  }, []);

  const handleCrossTabMoveAll = useCallback(
    async (destination: string) => {
      const allFiles = crossTabSelection.getAllSelectedFiles();
      let moved = 0;
      for (const { file } of allFiles) {
        try {
          const sep = destination.includes('/') ? '/' : '\\';
          const destPath = `${destination}${sep}${file.name}`;
          await TauriAPI.moveFile(file.path, destPath);
          moved++;
        } catch (err) {
          toast({
            variant: 'destructive',
            title: 'Move Failed',
            description: `Failed to move "${file.name}": ${formatError(err)}`,
          });
        }
      }
      if (moved > 0) {
        toast({
          title: 'Moved',
          description: `Moved ${moved} file${moved !== 1 ? 's' : ''} to ${destination}`,
        });
        crossTabSelection.clearAll();
        refetch();
      }
    },
    [crossTabSelection, toast, refetch],
  );

  const handleCrossTabCopyAll = useCallback(
    async (destination: string) => {
      const allFiles = crossTabSelection.getAllSelectedFiles();
      let copied = 0;
      for (const { file } of allFiles) {
        try {
          const sep = destination.includes('/') ? '/' : '\\';
          const destPath = `${destination}${sep}${file.name}`;
          if (file.is_dir) {
            await TauriAPI.acceleratedCopyDirectory(file.path, destPath);
          } else {
            await TauriAPI.acceleratedCopyFile(file.path, destPath);
          }
          copied++;
        } catch (err) {
          toast({
            variant: 'destructive',
            title: 'Copy Failed',
            description: `Failed to copy "${file.name}": ${formatError(err)}`,
          });
        }
      }
      if (copied > 0) {
        toast({
          title: 'Copied',
          description: `Copied ${copied} file${copied !== 1 ? 's' : ''} to ${destination}`,
        });
        crossTabSelection.clearAll();
        refetch();
      }
    },
    [crossTabSelection, toast, refetch],
  );

  const handleCrossTabCompressAll = useCallback(
    async (destination: string) => {
      const allFiles = crossTabSelection.getAllSelectedFiles();
      const filePaths = allFiles.map(({ file }: { file: FileEntry }) => file.path);
      if (filePaths.length === 0) return;
      try {
        const sep = destination.includes('/') ? '/' : '\\';
        const archiveName = `batch-${Date.now()}.zip`;
        const outputPath = `${destination}${sep}${archiveName}`;
        await TauriAPI.compressFiles(filePaths, outputPath, {
          format: 'Zip',
          compression_level: 6,
          include_hidden: false,
          follow_symlinks: false,
        });
        toast({
          title: 'Compressed',
          description: `Created ${archiveName} with ${filePaths.length} file${filePaths.length !== 1 ? 's' : ''}`,
        });
        crossTabSelection.clearAll();
        refetch();
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Compression Failed',
          description: formatError(err),
        });
      }
    },
    [crossTabSelection, toast, refetch],
  );

  const handleCrossTabDeleteAll = useCallback(async () => {
    const allFiles = crossTabSelection.getAllSelectedFiles();
    const confirmed = await showConfirmationToast({
      title: 'Delete All Cross-Tab Files',
      description: `Are you sure you want to move ${allFiles.length} file(s) from ${crossTabSelection.selectedTabCount} tab(s) to the recycle bin?`,
      confirmText: 'Move to Recycle Bin',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;
    let deleted = 0;
    for (const { file } of allFiles) {
      try {
        await TauriAPI.moveToTrash(file.path);
        deleted++;
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Delete Failed',
          description: `Failed to delete "${file.name}": ${formatError(err)}`,
        });
      }
    }
    if (deleted > 0) {
      toast({
        title: 'Deleted',
        description: `Moved ${deleted} file${deleted !== 1 ? 's' : ''} to recycle bin`,
      });
      crossTabSelection.clearAll();
      refetch();
    }
  }, [crossTabSelection, toast, refetch]);

  // ── Workspace layout save/restore ─────────────────────────────────────────

  const workspaceUiState: WorkspaceLayoutUiState = useMemo(
    () => ({
      viewMode,
      theme,
      leftSidebarCollapsed,
      rightSidebarCollapsed,
      bottomPanelCollapsed,
    }),
    [viewMode, theme, leftSidebarCollapsed, rightSidebarCollapsed, bottomPanelCollapsed],
  );

  const handleApplyLayout = useCallback(
    (newLayout: import('@/types/split-view').SplitLayoutState, uiState: WorkspaceLayoutUiState) => {
      splitLayoutRef.current.dispatch({ type: 'REPLACE_STATE', state: newLayout });
      setViewMode(uiState.viewMode);
      setTheme(uiState.theme);
      setLeftSidebarCollapsed(uiState.leftSidebarCollapsed);
      setRightSidebarCollapsed(uiState.rightSidebarCollapsed);
      setBottomPanelCollapsed(uiState.bottomPanelCollapsed);
    },
    [
      setTheme,
      setViewMode,
      setLeftSidebarCollapsed,
      setRightSidebarCollapsed,
      setBottomPanelCollapsed,
    ],
  );

  // ── Dialog close/action callbacks ─────────────────────────────────────────

  const handleCloseTemplatePicker = useCallback(
    () => setTemplatePickerOpen(false),
    [setTemplatePickerOpen],
  );
  const handleCloseFolderCompare = useCallback(
    () => setFolderCompareOpen(false),
    [setFolderCompareOpen],
  );
  const handleCloseCommandPalette = useCallback(
    () => setCommandPaletteOpen(false),
    [setCommandPaletteOpen],
  );
  const handleCommandPaletteFileSelect = useCallback(
    (filePath: string, isDir: boolean) => {
      if (isDir) {
        navigateWithHistory(filePath);
      } else {
        const sep = detectSep(filePath);
        const parts = filePath.split(sep);
        const parentDir = parts.slice(0, -1).join(sep) + (parts.length > 2 ? '' : sep);
        pendingSelectRef.current = filePath;
        if (parentDir && parentDir !== currentPath) {
          navigateWithHistory(parentDir);
        } else {
          const file = files.find((f) => f.path === filePath);
          if (file) {
            setSelectedFile(file);
            setSelectedFiles(new Set([file.path]));
          }
          pendingSelectRef.current = null;
        }
      }
    },
    [navigateWithHistory, currentPath, files, pendingSelectRef, setSelectedFile, setSelectedFiles],
  );
  const handleCloseQuickLook = useCallback(() => setQuickLookFile(null), [setQuickLookFile]);
  const handleClosePathBookmarks = useCallback(
    () => setPathBookmarksDialogOpen(false),
    [setPathBookmarksDialogOpen],
  );
  const handleCloseWorkspaceLayout = useCallback(
    () => setWorkspaceLayoutDialogOpen(false),
    [setWorkspaceLayoutDialogOpen],
  );
  const handleCloseCrossTabDialog = useCallback(
    () => setCrossTabDialogOpen(false),
    [setCrossTabDialogOpen],
  );
  const handleCloseShortcutsDialog = useCallback(
    () => setShortcutsDialogOpen(false),
    [setShortcutsDialogOpen],
  );
  const handleOpenSettings = useCallback(
    () => navigateWithHistory('xplorer://settings'),
    [navigateWithHistory],
  );
  const handleCloseCollectionEditor = useCallback(() => {
    setCollectionEditorOpen(false);
    setEditingCollection(null);
  }, [setCollectionEditorOpen, setEditingCollection]);

  // ── Shared actions bag for split panes ─────────────────────────────────────

  const sharedActions: SharedPaneActions = useMemo(
    () => ({
      handleFileOpen: async (file: FileEntry) => {
        if (isEditableFile(file)) {
          const sl = splitLayoutRef.current;
          const group = sl.state.groups[sl.state.activeGroupId];
          const existing = group?.tabs.find(
            (t: TabItem) => t.type === 'editor' && t.path === file.path,
          );
          if (existing) {
            sl.switchTab(group.id, existing.id);
            return;
          }
          const editorTab: TabItem = {
            id: `editor-${file.path}-${Date.now()}`,
            name: file.name,
            path: file.path,
            type: 'editor',
          };
          sl.addTab(sl.state.activeGroupId, editorTab, true);
        } else {
          try {
            await TauriAPI.openFile(file.path);
          } catch (err) {
            toastRef.current({
              variant: 'destructive',
              title: 'Open File Failed',
              description: formatError(err),
            });
          }
        }
      },
      handleFileRightClick: (file: FileEntry, event: React.MouseEvent, _groupId: string) =>
        ctxMenuRef.current.handleFileRightClick(file, event),
      handleBackgroundRightClick: (event: React.MouseEvent, _groupId: string) =>
        ctxMenuRef.current.handleBackgroundRightClick(event),
      handleDelete: async (_selectedFiles: Set<string>, refetchFn: () => void) => {
        if (_selectedFiles.size === 0) return;
        const confirmed = await showConfirmationToast({
          title: 'Move to Recycle Bin',
          description: `Are you sure you want to move ${_selectedFiles.size} item(s) to the recycle bin?`,
          confirmText: 'Move to Recycle Bin',
          cancelText: 'Cancel',
        });
        if (!confirmed) return;
        try {
          for (const fp of Array.from(_selectedFiles)) await TauriAPI.moveToTrash(fp);
          refetchFn();
          toastRef.current({
            title: 'Moved to Recycle Bin',
            description: `Moved ${_selectedFiles.size} item(s)`,
          });
        } catch (err) {
          toastRef.current({
            variant: 'destructive',
            title: 'Delete Failed',
            description: formatError(err),
          });
        }
      },
      handleCreateFolder: async (path: string, refetchFn: () => void) => {
        const folderName = await showInputToast({
          title: 'Create New Folder',
          description: 'Enter a name for the new folder',
          placeholder: 'Folder name',
          submitText: 'Create',
          cancelText: 'Cancel',
        });
        if (!folderName) return;
        try {
          const fp = path + (path.endsWith(PATH_SEPARATOR) ? '' : PATH_SEPARATOR) + folderName;
          await TauriAPI.createDirRecursive(fp);
          refetchFn();
          toastRef.current({ title: 'Folder Created', description: `Created "${folderName}"` });
        } catch (err) {
          toastRef.current({
            variant: 'destructive',
            title: 'Create Folder Failed',
            description: formatError(err),
          });
        }
      },
      theme,
      setTheme,
      setBottomPanelCollapsed,
      setBottomPanelTab: (tab: string) => setBottomPanelTab(tab as BottomPanelTabId),
      onNavigateFromHome: (path: string, groupId: string) => {
        const newTab: TabItem = {
          id: path,
          name: path.split(/[\\/]/).pop() || path,
          path,
          type: 'folder',
        };
        splitLayoutRef.current.addTab(groupId, newTab, true);
      },
      onGDriveNavigate: (
        accountId: string,
        folderId: string,
        _folderName: string,
        groupId: string,
      ) => {
        splitLayoutRef.current.navigate(groupId, `gdrive://${accountId}/${folderId}`, folderId);
      },
      onGDriveFileSelect: handleGDriveFileSelect,
      onError: (title: string, description: string) => {
        toastRef.current({ variant: 'destructive', title, description });
      },
      onSelectAll: (_files: FileEntry[]) => {
        setSelectedFiles(new Set(_files.map((f) => f.path)));
      },
      onAdvancedSelection: () => dialogManagerRef.current.setShowAdvancedSelect(true),
      onQuickLook: handleQuickLook,
      renameFileInline: fileOps.renameFileInline,
      onFilesChange: (newFiles: FileEntry[], newRefetch: () => void) => {
        setPaneFiles(newFiles);
        paneRefetchRef.current = newRefetch;
      },
      navigateBackInHistory,
      navigateForwardInHistory,
      canNavigateBackInHistory,
      canNavigateForwardInHistory,
      navigateUp,
      navigateToPath: navigateWithHistory,
      refetchFiles: refetch,
    }),
    [
      theme,
      setTheme,
      setBottomPanelCollapsed,
      setBottomPanelTab,
      setPaneFiles,
      setSelectedFiles,
      paneRefetchRef,
      handleGDriveFileSelect,
      navigateBackInHistory,
      navigateForwardInHistory,
      canNavigateBackInHistory,
      canNavigateForwardInHistory,
      navigateUp,
      navigateWithHistory,
      refetch,
      handleQuickLook,
      fileOps.renameFileInline,
    ],
  );

  // ── Vim actions ───────────────────────────────────────────────────────────

  const vimActions = useMemo(
    () => ({
      navigateToPath: (path: string) => navigateWithHistory(path),
      navigateUp,
      openFile: (file: FileEntry) => handleFileDoubleClick(file),
      setSelectedFiles,
      setSelectedFile,
      focusSearch: () => leftSidebarRef.current?.focusSearch(),
      copyFiles: (filesToCopy: FileEntry[]) => {
        fileOps.setClipboard({ files: filesToCopy, operation: 'copy' });
        toast({
          title: 'Copied',
          description: `${filesToCopy.length} item${filesToCopy.length > 1 ? 's' : ''} yanked`,
        });
      },
      pasteFiles: () => {
        fileOps.pasteFiles();
      },
      deleteFiles: (filesToDelete: FileEntry[]) => {
        fileOps.contextMenuActions.delete(filesToDelete);
      },
      renameFile: (file: FileEntry) => {
        fileOps.contextMenuActions.rename(file);
      },
      addBookmark: (path: string) => {
        const name = path.split(/[/\\]/).pop() || path;
        TauriAPI.addBookmark(path, name)
          .then(() => toast({ title: 'Bookmarked', description: `Added "${name}" to bookmarks` }))
          .catch((err: unknown) =>
            toast({
              title: 'Bookmark failed',
              description: formatError(err),
              variant: 'destructive',
            }),
          );
      },
      refetch,
      toast: (opts: { title: string; description?: string; variant?: string }) => {
        toast(opts as Parameters<typeof toast>[0]);
      },
    }),
    [
      fileOps,
      leftSidebarRef,
      refetch,
      toast,
      navigateWithHistory,
      navigateUp,
      handleFileDoubleClick,
      setSelectedFiles,
      setSelectedFile,
    ],
  );

  // ── File conflict resolver ────────────────────────────────────────────────

  const resolveConflict = useCallback(
    (
      fileName: string,
      isDir: boolean,
      destination: string,
      remaining: number,
      sourceInfo?: ConflictFileInfo | null,
      destInfo?: ConflictFileInfo | null,
    ) => {
      return new Promise<{ resolution: ConflictResolution; applyToAll: boolean }>((resolve) => {
        setFileConflict({
          fileName,
          isDir,
          destination,
          remaining,
          sourceInfo: sourceInfo ?? null,
          destInfo: destInfo ?? null,
          resolve: (resolution: ConflictResolution, applyToAll: boolean) => {
            setFileConflict(null);
            resolve({ resolution, applyToAll });
          },
        });
      });
    },
    [setFileConflict],
  );

  return {
    // Navigation
    setCurrentPath,
    navigateWithHistory,
    navigateUp,
    navigateToPath,
    navigateToHome,
    navigateFromHome,
    navigateBackInHistory,
    navigateForwardInHistory,
    canNavigateBackInHistory,
    canNavigateForwardInHistory,

    // File click handlers
    addTab,
    toggleFileSelection,
    handleFileClick,
    handleFileDoubleClick,

    // Change summary
    handleReviewChanges,
    handleDismissChangesToast,
    handleDismissAllChanges,

    // Google Drive
    openGDriveTab,
    openGDriveManager,

    // Cross-tab
    handleCrossTabPickFolder,
    handleCrossTabMoveAll,
    handleCrossTabCopyAll,
    handleCrossTabCompressAll,
    handleCrossTabDeleteAll,

    // Workspace
    workspaceUiState,
    handleApplyLayout,

    // Dialog callbacks
    handleCloseTemplatePicker,
    handleCloseFolderCompare,
    handleCloseCommandPalette,
    handleCommandPaletteFileSelect,
    handleCloseQuickLook,
    handleClosePathBookmarks,
    handleCloseWorkspaceLayout,
    handleCloseCrossTabDialog,
    handleCloseShortcutsDialog,
    handleOpenSettings,
    handleCloseCollectionEditor,

    // Shared actions for panes
    sharedActions,

    // Vim
    vimActions,

    // File conflict
    resolveConflict,

    // Expose refs for effects hook
    splitLayoutRef,
    activeGroupRef,
    navigateToPathRef,
  };
};
