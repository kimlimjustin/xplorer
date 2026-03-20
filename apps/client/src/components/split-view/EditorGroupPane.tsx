import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';
import { sortFiles, groupFilesByDate, type FileGroup } from '@/lib/utils';
import { useFolderSizes } from '@/hooks/use-folder-sizes';
import { useCollectionFiles } from '@/hooks/use-collection-files';
import type { EditorGroup } from '@/types/split-view';
import { extensionHost } from '@/lib/extension-host';
import { type FileCollection, applyCollectionToFiles } from '@/lib/collections';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PaneTabBar from './PaneTabBar';
import NavigationBar from '@/components/explorer/NavigationBar';
import {
  type PaneSyncMode,
  type PaneSyncNavigateDetail,
  emitPaneSyncNavigate,
  computeRelativeSyncPath,
} from '@/hooks/use-pane-sync';

// Re-export components needed by the pane content
import HomePage from '@/pages/HomePage';
import TrashPage from '@/components/TrashPage';
import FileComparisonPage from '@/pages/FileComparisonPage';
import PaneFileExplorer from './PaneFileExplorer';

const ChatFileView = React.lazy(() => import('@/pages/ChatFileView'));
const FileEditorView = React.lazy(() => import('@/pages/FileEditorView'));

export interface SharedPaneActions {
  // File operations
  handleFileOpen: (file: FileEntry) => void;
  handleFileRightClick: (file: FileEntry, event: React.MouseEvent, groupId: string) => void;
  handleBackgroundRightClick: (event: React.MouseEvent, groupId: string) => void;
  handleDelete: (selectedFiles: Set<string>, refetch: () => void) => void;
  handleCreateFolder: (currentPath: string, refetch: () => void) => void;

  // Theme
  theme: string;
  setTheme: (theme: string) => void;

  // Bottom panel controls
  setBottomPanelCollapsed: (collapsed: boolean) => void;
  setBottomPanelTab: (tab: string) => void;

  // Navigation from home
  onNavigateFromHome: (path: string, groupId: string) => void;

  // GDrive
  onGDriveNavigate?: (
    accountId: string,
    folderId: string,
    folderName: string,
    groupId: string,
  ) => void;
  onGDriveFileSelect?: (file: FileEntry) => void;

  // Toast
  onError: (title: string, description: string) => void;

  // Advanced selection
  onSelectAll: (files: FileEntry[]) => void;
  onAdvancedSelection: () => void;

  // Quick Look
  onQuickLook?: (file: FileEntry) => void;

  // Inline rename
  renameFileInline?: (oldPath: string, newName: string) => Promise<boolean>;

  // Files change callback: active pane pushes its files + refetch to parent
  onFilesChange?: (files: FileEntry[], refetch: () => void) => void;

  // Navigation (for address bar in each pane)
  navigateBackInHistory?: () => void;
  navigateForwardInHistory?: () => void;
  canNavigateBackInHistory?: () => boolean;
  canNavigateForwardInHistory?: () => boolean;
  navigateUp?: () => void;
  navigateToPath?: (path: string) => void;
  refetchFiles?: () => void;
}

interface EditorGroupPaneProps {
  group: EditorGroup;
  isActive: boolean;
  canClose: boolean;
  totalGroups: number;
  sharedActions: SharedPaneActions;
  /** Shared selection state from parent -- the pane is a controlled component. */
  selectedFiles: Set<string>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** Shared single-file selection from parent (for preview). */
  selectedFile: FileEntry | null;
  setSelectedFile: React.Dispatch<React.SetStateAction<FileEntry | null>>;
  /** Controlled view/sort state from parent. */
  viewMode: string;
  setViewMode: React.Dispatch<React.SetStateAction<string>>;
  sortBy: string;
  setSortBy: React.Dispatch<React.SetStateAction<string>>;
  sortOrder: 'asc' | 'desc';
  setSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  // Split layout actions
  onSwitchTab: (groupId: string, tabId: string) => void;
  onCloseTab: (groupId: string, tabId: string) => void;
  onAddTab: (groupId: string) => void;
  onSplitHorizontal: (groupId: string) => void;
  onSplitVertical: (groupId: string) => void;
  onCloseGroup: (groupId: string) => void;
  onSetActiveGroup: (groupId: string) => void;
  onNavigate: (groupId: string, path: string, name: string) => void;
  // Tab management actions
  onTogglePin?: (groupId: string, tabId: string) => void;
  onDuplicateTab?: (groupId: string, tabId: string) => void;
  onCloseOtherTabs?: (groupId: string, tabId: string) => void;
  onCloseTabsToRight?: (groupId: string, tabId: string) => void;
  onCloseAllTabs?: (groupId: string) => void;
  onReorderTab?: (groupId: string, fromIndex: number, toIndex: number) => void;
  // Maximize/restore
  isMaximized?: boolean;
  onMaximizePane?: (groupId: string) => void;
  onRestorePane?: () => void;
  // Filter presets
  activeCollectionFilter?: FileCollection | null;
  // Pane sync navigation
  paneSyncEnabled?: boolean;
  paneSyncMode?: PaneSyncMode;
  onTogglePaneSync?: () => void;
  onSwitchPaneSyncMode?: (mode: PaneSyncMode) => void;
}

export default function EditorGroupPane({
  group,
  isActive,
  canClose,
  totalGroups,
  sharedActions,
  selectedFiles,
  setSelectedFiles,
  selectedFile: _selectedFile,
  setSelectedFile,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  onSwitchTab,
  onCloseTab,
  onAddTab,
  onSplitHorizontal,
  onSplitVertical,
  onCloseGroup,
  onSetActiveGroup,
  onNavigate,
  onTogglePin,
  onDuplicateTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseAllTabs,
  onReorderTab,
  isMaximized,
  onMaximizePane,
  onRestorePane,
  activeCollectionFilter,
  paneSyncEnabled,
  paneSyncMode,
  onTogglePaneSync,
  onSwitchPaneSyncMode,
}: EditorGroupPaneProps) {
  const {
    theme,
    setTheme,
    setBottomPanelCollapsed,
    setBottomPanelTab,
    onNavigateFromHome,
    handleFileOpen,
    handleFileRightClick,
    handleBackgroundRightClick,
    handleDelete,
    handleCreateFolder,
    onGDriveNavigate: _onGDriveNavigate,
    onGDriveFileSelect: _onGDriveFileSelect,
    onError,
    onAdvancedSelection,
    onQuickLook,
    renameFileInline,
  } = sharedActions;

  // Per-pane state (most state is controlled from parent)
  const toggleSortOrder = useCallback(
    () => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc')),
    [setSortOrder],
  );
  const [groupByDate, setGroupByDate] = useState(false);

  const activeTab = group.tabs.find((t) => t.id === group.activeTabId);
  const { currentPath } = group;

  // Detect collection paths
  const isCollectionPath = currentPath.startsWith('collection://');
  const collectionId = isCollectionPath ? currentPath.replace('collection://', '') : null;

  // Stable empty array to avoid creating a new [] reference on every render
  // when useQuery returns undefined (query disabled or data not yet loaded).
  const EMPTY_FILES = useRef<FileEntry[]>([]).current;

  // Per-pane file query (authoritative source of files for this pane)
  const {
    data: queryFilesRaw,
    isLoading: queryLoading,
    refetch: queryRefetch,
  } = useQuery<FileEntry[]>({
    queryKey: ['files', group.id, currentPath],
    queryFn: async () => {
      if (currentPath.startsWith('gdrive://')) {
        const match = currentPath.match(/^gdrive:\/\/([^/]+)\/(.*)$/);
        if (match) {
          const [, accountId, folderId] = match;
          return await TauriAPI.gdriveListFiles(accountId, folderId || 'root');
        }
        return [];
      }
      return await TauriAPI.readDirectory(currentPath);
    },
    staleTime: 0,
    enabled:
      activeTab?.type !== 'editor' &&
      currentPath !== 'xplorer://home' &&
      currentPath !== 'xplorer://trash' &&
      currentPath !== 'xplorer://gdrive-manager' &&
      !currentPath.startsWith('comparison://') &&
      !isCollectionPath,
  });
  const queryFiles = queryFilesRaw ?? EMPTY_FILES;

  // Fallback base path for collection scanning (memoized to avoid re-renders)
  const collectionFallbackPath = useMemo(() => {
    // collectionId triggers re-read of localStorage when collection changes
    void collectionId;
    try {
      const raw = localStorage.getItem('xplorer:ui-state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.lastRealPath) return parsed.lastRealPath as string;
      }
    } catch { /* ignore localStorage/parse errors */ }
    return '';
  }, [collectionId]);

  // Collection files hook (only active when on a collection:// path)
  const collectionResult = useCollectionFiles(collectionId, collectionFallbackPath);

  // Merge: pick the right file source based on the current path
  const files = isCollectionPath ? collectionResult.files : queryFiles;
  const isLoading = isCollectionPath ? collectionResult.isLoading : queryLoading;
  const refetch = isCollectionPath ? collectionResult.refetch : queryRefetch;

  // Push files + refetch up to parent when this pane is active.
  // Guard: only push when the files array reference actually changes to avoid
  // infinite re-render loops (parent setState → re-render → effect fires → repeat).
  const onFilesChangeRef = useRef(sharedActions.onFilesChange);
  onFilesChangeRef.current = sharedActions.onFilesChange;
  const prevPushedFilesRef = useRef<FileEntry[]>(EMPTY_FILES);
  const prevPushedRefetchRef = useRef<() => void>(refetch);
  useEffect(() => {
    if (!isActive) return;
    if (files === prevPushedFilesRef.current && refetch === prevPushedRefetchRef.current) return;
    prevPushedFilesRef.current = files;
    prevPushedRefetchRef.current = refetch;
    onFilesChangeRef.current?.(files, refetch);
  }, [files, isActive, refetch]);

  const queryClient = useQueryClient();
  const { getFolderSize, isCalculatingSize, calculateFolderSize, calculateMissingSizes } =
    useFolderSizes(files);

  // Auto-calculate folder sizes if the setting is enabled
  useEffect(() => {
    try {
      const saved = localStorage.getItem('xplorer:settings');
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.autoCalculateFolderSizes && files.some((f) => f.is_dir)) {
          calculateMissingSizes();
        }
      }
    } catch { /* ignore localStorage/parse errors */ }
  }, [files, calculateMissingSizes]);

  // Listen for files-changed events (from drag-drop operations) to refetch
  useEffect(() => {
    const onFilesChanged = () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    };
    window.addEventListener('files-changed', onFilesChanged);
    return () => window.removeEventListener('files-changed', onFilesChanged);
  }, [queryClient]);

  // Auto-enable date grouping for Downloads / Desktop / Documents
  useEffect(() => {
    const lowerPath = currentPath.toLowerCase().replace(/\\/g, '/');
    const isDateFolder = /\/(downloads|desktop|documents)\/?$/i.test(lowerPath);
    if (isDateFolder) {
      setSortBy('dateModified');
      setSortOrder('desc');
      setGroupByDate(true);
    } else {
      setGroupByDate(false);
    }
  }, [currentPath, setSortBy, setSortOrder]);

  // Sort files
  const sortedFilesRaw = useMemo(
    () => sortFiles(files, sortBy, sortOrder),
    [files, sortBy, sortOrder],
  );

  // Apply filter preset if one is active
  const sortedFiles = useMemo(
    () =>
      activeCollectionFilter ? applyCollectionToFiles(sortedFilesRaw, activeCollectionFilter) : sortedFilesRaw,
    [sortedFilesRaw, activeCollectionFilter],
  );

  // Grouped files (only computed when grouping is active)
  const fileGroups: FileGroup[] | null = useMemo(
    () => (groupByDate ? groupFilesByDate(sortedFiles) : null),
    [groupByDate, sortedFiles],
  );

  // Clear selection when this pane navigates to a new path
  React.useEffect(() => {
    if (!isActive) return;
    setSelectedFiles(new Set());
    setSelectedFile(null);
  }, [currentPath, isActive, setSelectedFiles, setSelectedFile]);

  // Track last-clicked index for shift-click range selection
  const lastClickedIndexRef = useRef<number>(-1);
  const sortedFilesRef = useRef(sortedFiles);
  sortedFilesRef.current = sortedFiles;

  // File click handler (per-pane) — uses parent's setSelectedFile directly
  const handleFileClick = useCallback(
    (file: FileEntry, event?: React.MouseEvent) => {
      setSelectedFile(file);

      const currentFiles = sortedFilesRef.current;
      const clickedIndex = currentFiles.findIndex((f) => f.path === file.path);

      if (event && event.shiftKey && lastClickedIndexRef.current >= 0) {
        // Shift+click: select range from last clicked to current
        const start = Math.min(lastClickedIndexRef.current, clickedIndex);
        const end = Math.max(lastClickedIndexRef.current, clickedIndex);
        const rangePaths = currentFiles.slice(start, end + 1).map((f) => f.path);

        if (event.ctrlKey || event.metaKey) {
          // Shift+Ctrl: add range to existing selection
          setSelectedFiles((prev) => {
            const next = new Set(prev);
            for (const p of rangePaths) next.add(p);

            return next;
          });
        } else {
          // Shift only: replace selection with range
          const newSet = new Set(rangePaths);
          setSelectedFiles(newSet);
        }
        return;
      }

      if (event && (event.ctrlKey || event.metaKey)) {
        // Ctrl+click: toggle individual file
        lastClickedIndexRef.current = clickedIndex;
        setSelectedFiles((prev) => {
          const next = new Set(prev);
          if (next.has(file.path)) next.delete(file.path);
          else next.add(file.path);

          return next;
        });
        return;
      }

      // Normal click: select single file
      lastClickedIndexRef.current = clickedIndex;
      const newSet = new Set([file.path]);
      setSelectedFiles(newSet);
    },
    [setSelectedFiles, setSelectedFile],
  );

  // File double click (per-pane)
  const handleFileDoubleClick = useCallback(
    async (file: FileEntry) => {
      TauriAPI.addRecentFile(file.path).catch(() => {
        /* fire-and-forget */
      });
      if (!file.is_dir) {
        handleFileOpen(file);
      } else {
        onNavigate(group.id, file.path, file.name);
      }
    },
    [group.id, onNavigate, handleFileOpen],
  );

  // File right-click adapter
  const onFileRightClick = useCallback(
    (file: FileEntry, event: React.MouseEvent) => {
      handleFileRightClick(file, event, group.id);
    },
    [group.id, handleFileRightClick],
  );

  // Background right-click adapter
  const onBgRightClick = useCallback(
    (event: React.MouseEvent) => {
      handleBackgroundRightClick(event, group.id);
    },
    [group.id, handleBackgroundRightClick],
  );

  // ── Pane sync navigation ─────────────────────────────────────────────────

  // Guard flag: set to true while this pane is reacting to a sync event, so
  // the resulting navigation does NOT re-emit another sync event (prevents
  // infinite ping-pong loops).
  const syncGuardRef = useRef(false);

  // Track the previous path so we can compute relative navigations.
  const prevPathRef2 = useRef(currentPath);
  useEffect(() => {
    prevPathRef2.current = currentPath;
  }, [currentPath]);

  // Emit sync event whenever this pane navigates AND sync is enabled AND
  // the navigation was NOT triggered by an incoming sync event.
  const prevSyncEmitPathRef = useRef(currentPath);
  useEffect(() => {
    if (!paneSyncEnabled) return;
    if (syncGuardRef.current) {
      // This navigation was triggered by an incoming sync event — do not
      // re-emit.  Reset the guard so subsequent user-initiated navigations
      // will emit normally.
      syncGuardRef.current = false;
      prevSyncEmitPathRef.current = currentPath;
      return;
    }
    if (currentPath === prevSyncEmitPathRef.current) return;

    const previousPath = prevSyncEmitPathRef.current;
    prevSyncEmitPathRef.current = currentPath;

    // Don't sync special protocol paths
    if (currentPath.startsWith('xplorer://') || currentPath.startsWith('comparison://')) return;

    emitPaneSyncNavigate({
      sourceGroupId: group.id,
      path: currentPath,
      previousPath,
      mode: paneSyncMode ?? 'mirror',
    });
  }, [currentPath, paneSyncEnabled, paneSyncMode, group.id]);

  // Listen for sync events from other panes.
  useEffect(() => {
    if (!paneSyncEnabled) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PaneSyncNavigateDetail>).detail;
      // Ignore events emitted by this pane.
      if (detail.sourceGroupId === group.id) return;
      // Don't react to special protocol paths.
      if (detail.path.startsWith('xplorer://') || detail.path.startsWith('comparison://')) return;

      let targetPath: string | null;

      if (detail.mode === 'mirror') {
        targetPath = detail.path;
      } else {
        // Relative mode: compute where this pane should go.
        targetPath = computeRelativeSyncPath(detail.previousPath, detail.path, currentPath);
      }

      if (targetPath && targetPath !== currentPath) {
        // Set guard so the resulting navigation does NOT re-emit a sync event.
        syncGuardRef.current = true;
        onNavigate(group.id, targetPath, targetPath.split(/[/\\]/).pop() || targetPath);
      }
    };

    window.addEventListener('pane-sync-navigate', handler);
    return () => window.removeEventListener('pane-sync-navigate', handler);
  }, [paneSyncEnabled, paneSyncMode, group.id, currentPath, onNavigate]);

  // Render content based on current path / tab type
  const renderContent = () => {
    if (currentPath === 'xplorer://home') {
      return (
        <div className="flex-1 overflow-auto">
          <HomePage
            onNavigate={(path: string) => onNavigateFromHome(path, group.id)}
            theme={theme}
            setTheme={setTheme}
          />
        </div>
      );
    }

    if (currentPath === 'xplorer://trash') {
      return (
        <div className="flex-1 overflow-auto">
          <TrashPage onClose={() => onNavigate(group.id, 'xplorer://home', 'Home')} />
        </div>
      );
    }

    if (
      activeTab?.type === 'gdrive-manager' ||
      (activeTab?.type === 'gdrive' && activeTab.gdriveData)
    ) {
      return (
        <div className="flex-1 overflow-auto flex items-center justify-center text-xp-text-muted text-sm">
          Install the Google Drive extension
        </div>
      );
    }

    if (activeTab?.type === 'comparison' && activeTab.comparisonData) {
      return (
        <FileComparisonPage
          file1Path={activeTab.comparisonData.file1Path}
          file2Path={activeTab.comparisonData.file2Path}
          onError={(error: string) => onError('Comparison Error', error)}
        />
      );
    }

    // Chat file view
    if (activeTab?.path?.endsWith('.chat')) {
      return (
        <div className="flex-1 overflow-auto">
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center h-full text-xp-text-muted">
                Loading chat...
              </div>
            }
          >
            <ChatFileView filePath={activeTab.path} />
          </React.Suspense>
        </div>
      );
    }

    // Editor tab (text/code files) — check extension editors first, fallback to built-in
    if (activeTab?.type === 'editor' && activeTab.path) {
      const extEditor = extensionHost.getEditorForFile(activeTab.path);
      if (extEditor) {
        return (
          <div className="flex-1 overflow-hidden flex flex-col">
            {extEditor.render({ filePath: activeTab.path })}
          </div>
        );
      }
      return (
        <div className="flex-1 overflow-hidden flex flex-col">
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center h-full text-xp-text-muted">
                Loading editor...
              </div>
            }
          >
            <FileEditorView filePath={activeTab.path} />
          </React.Suspense>
        </div>
      );
    }

    // Default: file explorer
    return (
      <PaneFileExplorer
        viewMode={viewMode}
        setViewMode={setViewMode}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        toggleSortOrder={toggleSortOrder}
        groupByDate={groupByDate}
        setGroupByDate={setGroupByDate}
        sortedFiles={sortedFiles}
        fileGroups={fileGroups}
        isLoading={isLoading}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        currentPath={currentPath}
        groupId={group.id}
        handleCreateFolder={() => handleCreateFolder(currentPath, refetch)}
        handleDelete={() => handleDelete(selectedFiles, refetch)}
        handleFileClick={handleFileClick}
        handleFileDoubleClick={handleFileDoubleClick}
        onFileRightClick={onFileRightClick}
        onBgRightClick={onBgRightClick}
        getFolderSize={getFolderSize}
        isCalculatingSize={isCalculatingSize}
        calculateFolderSize={calculateFolderSize}
        setBottomPanelCollapsed={setBottomPanelCollapsed}
        setBottomPanelTab={setBottomPanelTab}
        onAdvancedSelection={onAdvancedSelection}
        onQuickLook={onQuickLook}
        onRenameFile={renameFileInline}
      />
    );
  };

  // Pane-level drop target: allows dropping files anywhere in the pane
  // (cross-pane drag, or dropping on empty space). Folder-level data-drop-target
  // attributes inside FileGrid take priority via closest().
  const isEditorTab = activeTab?.type === 'editor';
  const isDroppablePath =
    !isEditorTab &&
    !currentPath.startsWith('xplorer://') &&
    !currentPath.startsWith('gdrive://') &&
    !currentPath.startsWith('collection://');

  // Only show PaneTabBar when there are multiple tabs or multiple panes
  const showTabBar = group.tabs.length > 1 || totalGroups > 1;

  return (
    <div
      className={`flex flex-col h-full overflow-hidden ${isActive ? 'ring-1 ring-xp-blue/30' : ''}`}
      data-drop-target={isDroppablePath ? currentPath : undefined}
      onMouseDown={() => {
        if (!isActive) onSetActiveGroup(group.id);
      }}
    >
      {/* Tab bar — shown when multiple tabs or multiple panes */}
      {showTabBar && (
        <PaneTabBar
          groupId={group.id}
          tabs={group.tabs}
          activeTabId={group.activeTabId}
          isActiveGroup={isActive}
          canClose={canClose}
          onSwitchTab={(tabId) => onSwitchTab(group.id, tabId)}
          onCloseTab={(tabId) => onCloseTab(group.id, tabId)}
          onAddTab={() => onAddTab(group.id)}
          onSplitHorizontal={() => onSplitHorizontal(group.id)}
          onSplitVertical={() => onSplitVertical(group.id)}
          onCloseGroup={() => onCloseGroup(group.id)}
          onFocus={() => {
            if (!isActive) onSetActiveGroup(group.id);
          }}
          onTogglePin={onTogglePin ? (tabId) => onTogglePin(group.id, tabId) : undefined}
          onDuplicateTab={onDuplicateTab ? (tabId) => onDuplicateTab(group.id, tabId) : undefined}
          onCloseOtherTabs={
            onCloseOtherTabs ? (tabId) => onCloseOtherTabs(group.id, tabId) : undefined
          }
          onCloseTabsToRight={
            onCloseTabsToRight ? (tabId) => onCloseTabsToRight(group.id, tabId) : undefined
          }
          onCloseAllTabs={onCloseAllTabs ? () => onCloseAllTabs(group.id) : undefined}
          onReorderTab={onReorderTab ? (from, to) => onReorderTab(group.id, from, to) : undefined}
          isMaximized={isMaximized}
          onMaximizePane={onMaximizePane ? () => onMaximizePane(group.id) : undefined}
          onRestorePane={onRestorePane}
          paneSyncEnabled={paneSyncEnabled}
          paneSyncMode={paneSyncMode}
          onTogglePaneSync={onTogglePaneSync}
          onSwitchPaneSyncMode={onSwitchPaneSyncMode}
          hasMultiplePanes={totalGroups > 1}
        />
      )}

      {/* Navigation / Address Bar — shown for filesystem paths */}
      {isDroppablePath && (
        <NavigationBar
          currentPath={currentPath}
          navigateToPath={sharedActions.navigateToPath}
          refetch={refetch}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <ErrorBoundary>{renderContent()}</ErrorBoundary>
      </div>
    </div>
  );
}
