import React from 'react';
import type { FileEntry, FolderSizeInfo, ConflictFileInfo } from '@/lib/tauri-api';
import {
  getFileIcon,
  formatFileSize,
  formatDate,
  type ThemeDef,
  type SortField,
} from '@/lib/utils';
import type { TabItem, SplitLayoutState } from '@/types/split-view';
import type { FileCollection } from '@/lib/collections';
import type { SharedPaneActions } from '@/components/split-view/EditorGroupPane';
import type { BottomPanelTabId } from '@/hooks/use-layout-state';
import type { SplitLayoutHook } from '@/hooks/use-split-layout';
import type { DialogManagerResult } from '@/hooks/use-dialog-manager';
import type { useFileComparison } from '@/hooks/use-file-comparison';
import type { VimModeState } from '@/hooks/use-vim-mode';
import type { CrossTabSelectionState } from '@/hooks/use-cross-tab-selection';
import type { PaneSyncState } from '@/hooks/use-pane-sync';
import type { Toast } from '@/hooks/use-toast';
import type { Command } from '@/components/CommandPalette';
import type { WorkspaceLayoutUiState } from '@/lib/workspace-layouts';
import type { FileChangeSet } from '@/hooks/use-focus-change-tracker';
import type { ConflictResolution } from '@/components/dialogs/FileConflictDialog';

import TopBar, { TopBarHandle } from '@/components/explorer/TopBar';
import LeftSidebar, { type LeftSidebarHandle } from '@/components/explorer/LeftSidebar';
import VerticalExtensionsBar from '@/components/explorer/VerticalExtensionsBar';
import RightSidebar from '@/components/panels/RightSidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import BottomPanel from '@/components/panels/BottomPanel';
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu';
import DialogsOverlay from '@/components/explorer/DialogsOverlay';
import PanelToggleButtons from '@/components/explorer/PanelToggleButtons';
import ResizeHandle from '@/components/ui/ResizeHandle';
import StatusBar from '@/components/StatusBar';
import SplitContainer from '@/components/split-view/SplitContainer';
import ArchitectView from '@/components/explorer/ArchitectView';
import { DragDropProvider } from '@/contexts/DragDropContext';
import { CrossTabSelectionProvider } from '@/contexts/CrossTabSelectionContext';
import { ExplorerProvider, type ExplorerContextValue } from '@/contexts/ExplorerContext';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MainLayoutProps {
  // Refs
  topBarRef: React.Ref<TopBarHandle>;
  leftSidebarRef: React.Ref<LeftSidebarHandle>;
  pendingSelectRef: React.MutableRefObject<string | null>;

  // Core state
  currentPath: string;
  files: FileEntry[];
  filteredFiles: FileEntry[];
  selectedFiles: Set<string>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedFile: FileEntry | null;
  setSelectedFile: React.Dispatch<React.SetStateAction<FileEntry | null>>;
  refetch: () => void;
  toast: (opts: Toast) => void;

  // Split layout
  splitLayout: SplitLayoutHook;
  layoutState: SplitLayoutState;
  activeGroup: import('@/types/split-view').EditorGroup;
  sharedActions: SharedPaneActions;

  // Layout state
  leftSidebarCollapsed: boolean;
  setLeftSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  rightSidebarCollapsed: boolean;
  setRightSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  bottomPanelCollapsed: boolean;
  setBottomPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  bottomPanelHeight: number;
  handleLeftResize: (delta: number) => void;
  handleRightResize: (delta: number) => void;
  handleBottomResize: (delta: number) => void;
  rightPanelTab: string;
  setRightPanelTab: React.Dispatch<React.SetStateAction<string>>;
  bottomPanelTab: BottomPanelTabId;
  setBottomPanelTab: React.Dispatch<React.SetStateAction<BottomPanelTabId>>;
  searchPanelOpen: boolean;
  setSearchPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  viewMode: string;
  setViewMode: React.Dispatch<React.SetStateAction<string>>;
  sortBy: SortField;
  setSortBy: React.Dispatch<React.SetStateAction<SortField>>;
  sortOrder: 'asc' | 'desc';
  setSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;

  // Architecture mode
  architectMode: boolean;
  setArchitectMode: React.Dispatch<React.SetStateAction<boolean>>;

  // Navigation
  navigateWithHistory: (path: string) => void;
  navigateUp: () => void;
  navigateToPath: (path: string) => void;
  navigateBackInHistory: () => void;
  navigateForwardInHistory: () => void;
  canNavigateBackInHistory: () => boolean;
  canNavigateForwardInHistory: () => boolean;

  // File handlers
  handleFileClick: (file: FileEntry, event?: React.MouseEvent) => void;
  handleFileDoubleClick: (file: FileEntry) => void;

  // Context menu
  ctxMenu: {
    contextMenuVisible: boolean;
    contextMenuPosition: { x: number; y: number } | null;
    contextMenuItems: ContextMenuItem[];
    contextMenuFile: FileEntry | null;
    closeContextMenu: () => void;
    handleFileRightClick: (file: FileEntry, event: React.MouseEvent) => void;
    handleBackgroundRightClick: (event: React.MouseEvent) => void;
  };

  // Dialog manager
  dialogManager: DialogManagerResult;
  fileComparison: ReturnType<typeof useFileComparison>;
  fileConflict: {
    fileName: string;
    isDir: boolean;
    destination: string;
    remaining: number;
    sourceInfo?: ConflictFileInfo | null;
    destInfo?: ConflictFileInfo | null;
    resolve: (resolution: ConflictResolution, applyToAll: boolean) => void;
  } | null;

  // Terminal
  terminal: ReturnType<typeof import('@/hooks/use-terminal').useTerminal>;

  // Theme
  themes: Record<string, ThemeDef>;
  theme: string;
  handleApplyTheme: (themeId: string) => void;

  // Folder sizes
  getFolderSize: (path: string) => FolderSizeInfo | null;
  isCalculatingSize: (path: string) => boolean;

  // Vim
  vimState: VimModeState;

  // Cross-tab
  crossTabSelection: CrossTabSelectionState;
  setCrossTabDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Active collection filter (collection applied as filter on current directory)
  activeCollectionFilter: FileCollection | null;
  setActiveCollectionFilter: React.Dispatch<React.SetStateAction<FileCollection | null>>;

  // Collections
  setCollectionEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingCollection: React.Dispatch<React.SetStateAction<FileCollection | null>>;

  // Pane sync
  paneSync: PaneSyncState;

  // File operations
  fileOps: ReturnType<typeof import('@/hooks/use-file-operations').useFileOperations>;

  // Dialogs overlay props
  templatePickerOpen: boolean;
  handleCloseTemplatePicker: () => void;
  folderCompareOpen: boolean;
  handleCloseFolderCompare: () => void;
  folderComparePaths: { left: string; right: string };
  commandPaletteOpen: boolean;
  handleCloseCommandPalette: () => void;
  commandPaletteCommands: Command[];
  handleCommandPaletteFileSelect: (filePath: string, isDir: boolean) => void;
  showChangeSummaryToast: boolean;
  fileChanges: FileChangeSet | null;
  handleDismissChangesToast: () => void;
  handleReviewChanges: () => void;
  quickLookFile: FileEntry | null;
  handleCloseQuickLook: () => void;
  pathBookmarksDialogOpen: boolean;
  handleClosePathBookmarks: () => void;
  workspaceLayoutDialogOpen: boolean;
  handleCloseWorkspaceLayout: () => void;
  workspaceUiState: WorkspaceLayoutUiState;
  handleApplyLayout: (layout: SplitLayoutState, uiState: WorkspaceLayoutUiState) => void;
  crossTabDialogOpen: boolean;
  handleCloseCrossTabDialog: () => void;
  handleCrossTabMoveAll: (destination: string) => Promise<void>;
  handleCrossTabCopyAll: (destination: string) => Promise<void>;
  handleCrossTabCompressAll: (destination: string) => Promise<void>;
  handleCrossTabDeleteAll: () => Promise<void>;
  handleCrossTabPickFolder: () => Promise<string | null>;
  shortcutsDialogOpen: boolean;
  handleCloseShortcutsDialog: () => void;
  handleOpenSettings: () => void;
  collectionEditorOpen: boolean;
  handleCloseCollectionEditor: () => void;
  editingCollection: FileCollection | null;
  handleDismissAllChanges: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

const MainLayout = (props: MainLayoutProps) => {
  const {
    topBarRef,
    leftSidebarRef,
    pendingSelectRef: _pendingSelectRef,
    currentPath,
    files,
    filteredFiles,
    selectedFiles,
    setSelectedFiles,
    selectedFile,
    setSelectedFile,
    refetch,
    toast,
    splitLayout,
    layoutState,
    activeGroup,
    sharedActions,
    leftSidebarCollapsed,
    setLeftSidebarCollapsed,
    rightSidebarCollapsed,
    setRightSidebarCollapsed,
    bottomPanelCollapsed,
    setBottomPanelCollapsed,
    leftSidebarWidth,
    rightSidebarWidth,
    bottomPanelHeight,
    handleLeftResize,
    handleRightResize,
    handleBottomResize,
    rightPanelTab,
    setRightPanelTab,
    bottomPanelTab,
    setBottomPanelTab,
    searchPanelOpen,
    setSearchPanelOpen,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    architectMode,
    setArchitectMode,
    navigateWithHistory,
    navigateUp,
    navigateToPath,
    navigateBackInHistory,
    navigateForwardInHistory,
    canNavigateBackInHistory,
    canNavigateForwardInHistory,
    handleFileClick,
    handleFileDoubleClick,
    ctxMenu,
    dialogManager,
    fileComparison,
    fileConflict,
    terminal,
    themes,
    theme,
    handleApplyTheme,
    getFolderSize,
    isCalculatingSize,
    vimState,
    crossTabSelection,
    setCrossTabDialogOpen,
    activeCollectionFilter,
    setActiveCollectionFilter,
    setCollectionEditorOpen,
    setEditingCollection,
    paneSync,
    fileOps,
    // Dialogs overlay
    templatePickerOpen,
    handleCloseTemplatePicker,
    folderCompareOpen,
    handleCloseFolderCompare,
    folderComparePaths,
    commandPaletteOpen,
    handleCloseCommandPalette,
    commandPaletteCommands,
    handleCommandPaletteFileSelect,
    showChangeSummaryToast,
    fileChanges,
    handleDismissChangesToast,
    handleReviewChanges,
    quickLookFile,
    handleCloseQuickLook,
    pathBookmarksDialogOpen,
    handleClosePathBookmarks,
    workspaceLayoutDialogOpen,
    handleCloseWorkspaceLayout,
    workspaceUiState,
    handleApplyLayout,
    crossTabDialogOpen,
    handleCloseCrossTabDialog,
    handleCrossTabMoveAll,
    handleCrossTabCopyAll,
    handleCrossTabCompressAll,
    handleCrossTabDeleteAll,
    handleCrossTabPickFolder,
    shortcutsDialogOpen,
    handleCloseShortcutsDialog,
    handleOpenSettings,
    collectionEditorOpen,
    handleCloseCollectionEditor,
    editingCollection,
    handleDismissAllChanges,
  } = props;

  const activeTabObj = activeGroup.tabs.find((t: TabItem) => t.id === activeGroup.activeTabId);

  // ── Build ExplorerContext value ───────────────────────────────────────────
  const explorerContextValue: ExplorerContextValue = React.useMemo(
    () => ({
      selection: {
        selectedFiles,
        setSelectedFiles,
        selectedFile,
        setSelectedFile,
      },
      viewSort: {
        viewMode,
        setViewMode,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
      },
      splitActions: {
        sharedActions,
        onSwitchTab: splitLayout.switchTab,
        onCloseTab: splitLayout.closeTab,
        onAddTab: (groupId: string) => {
          const newTab: TabItem = {
            id: `tab-${Date.now()}`,
            name: 'Home',
            path: 'xplorer://home',
            type: 'folder',
          };
          splitLayout.addTab(groupId, newTab, true);
        },
        onSplitHorizontal: (groupId: string) => splitLayout.splitGroup(groupId, 'horizontal'),
        onSplitVertical: (groupId: string) => splitLayout.splitGroup(groupId, 'vertical'),
        onCloseGroup: splitLayout.closeGroup,
        onSetActiveGroup: splitLayout.setActiveGroup,
        onNavigate: splitLayout.navigate,
        onResizeSplit: splitLayout.resizeSplit,
        maximizedGroupId: layoutState.maximizedGroupId,
        onMaximizePane: splitLayout.maximizePane,
        onRestorePane: splitLayout.restorePane,
        onTogglePin: splitLayout.togglePinTab,
        onDuplicateTab: splitLayout.duplicateTab,
        onCloseOtherTabs: splitLayout.closeOtherTabs,
        onCloseTabsToRight: splitLayout.closeTabsToRight,
        onCloseAllTabs: splitLayout.closeAllTabs,
        onReorderTab: splitLayout.reorderTab,
      },
      paneSync: {
        paneSyncEnabled: paneSync.enabled,
        paneSyncMode: paneSync.syncMode,
        onTogglePaneSync: paneSync.toggle,
        onSwitchPaneSyncMode: paneSync.setSyncMode,
      },
      clipboard: {
        copySelectedFiles: fileOps.copySelectedFiles,
        cutSelectedFiles: fileOps.cutSelectedFiles,
        pasteFiles: fileOps.pasteFiles,
        hasClipboard: fileOps.clipboard !== null,
      },
      activeCollectionFilter,
    }),
    [
      selectedFiles,
      setSelectedFiles,
      selectedFile,
      setSelectedFile,
      viewMode,
      setViewMode,
      sortBy,
      setSortBy,
      sortOrder,
      setSortOrder,
      sharedActions,
      splitLayout,
      layoutState.maximizedGroupId,
      paneSync.enabled,
      paneSync.syncMode,
      paneSync.toggle,
      paneSync.setSyncMode,
      fileOps.copySelectedFiles,
      fileOps.cutSelectedFiles,
      fileOps.pasteFiles,
      fileOps.clipboard,
      activeCollectionFilter,
    ],
  );

  return (
    <DragDropProvider>
      <CrossTabSelectionProvider value={crossTabSelection}>
        <div
          className="text-xp-text"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--xp-bg-gradient, var(--xp-bg, #1e1e2e))',
          }}
        >
          {/* Top Bar */}
          <TopBar
            data-tour="top-bar"
            ref={topBarRef}
            leftSidebarCollapsed={leftSidebarCollapsed}
            setLeftSidebarCollapsed={setLeftSidebarCollapsed}
            currentPath={currentPath}
            navigateUp={navigateUp}
            refetch={refetch}
            navigateBackInHistory={navigateBackInHistory}
            navigateForwardInHistory={navigateForwardInHistory}
            canNavigateBackInHistory={canNavigateBackInHistory}
            canNavigateForwardInHistory={canNavigateForwardInHistory}
            tabs={activeGroup.tabs}
            activeTabId={activeGroup.activeTabId}
            onSwitchTab={(tabId) => splitLayout.switchTab(activeGroup.id, tabId)}
            onCloseTab={(tabId) => splitLayout.closeTab(activeGroup.id, tabId)}
            onAddTab={() => {
              const newTab: TabItem = {
                id: `tab-${Date.now()}`,
                name: 'Home',
                path: 'xplorer://home',
                type: 'folder',
              };
              splitLayout.addTab(activeGroup.id, newTab, true);
            }}
            onSplitRight={() => splitLayout.splitGroup(activeGroup.id, 'horizontal')}
            onSplitDown={() => splitLayout.splitGroup(activeGroup.id, 'vertical')}
            crossTabTotalCount={crossTabSelection.totalSelectedCount}
            crossTabTabCount={crossTabSelection.selectedTabCount}
            hasMultiTabSelection={crossTabSelection.hasMultiTabSelection}
            onOpenBatchActions={() => setCrossTabDialogOpen(true)}
            onClearCrossTabSelection={crossTabSelection.clearAll}
            activeCollectionFilter={activeCollectionFilter}
            onToggleCollectionFilter={(col) => {
              setActiveCollectionFilter((prev) => (prev?.id === col.id ? null : col));
            }}
            onClearCollectionFilter={() => setActiveCollectionFilter(null)}
          />

          {/* Main Content Area */}
          <div style={{ flex: '1 1 0%', display: 'flex', overflow: 'hidden', minHeight: 0 }}>
            {/* Left Sidebar */}
            {!leftSidebarCollapsed && (
              <>
                <LeftSidebar
                  ref={leftSidebarRef}
                  data-tour="sidebar"
                  width={leftSidebarWidth}
                  currentPath={currentPath}
                  navigateToPath={navigateToPath}
                  handleFileClick={handleFileClick}
                  handleFileRightClick={ctxMenu.handleFileRightClick}
                  handleFileOpen={handleFileDoubleClick}
                  getFileIcon={getFileIcon}
                  searchPanelOpen={searchPanelOpen}
                  onToggleSearchPanel={() => setSearchPanelOpen((prev) => !prev)}
                  onCreateCollection={() => {
                    setEditingCollection(null);
                    setCollectionEditorOpen(true);
                  }}
                  onEditCollection={(col) => {
                    setEditingCollection(col);
                    setCollectionEditorOpen(true);
                  }}
                  activeCollectionFilter={activeCollectionFilter}
                  onToggleCollectionFilter={(col) => {
                    setActiveCollectionFilter((prev) => (prev?.id === col.id ? null : col));
                  }}
                  architectMode={architectMode}
                  setArchitectMode={setArchitectMode}
                />
                <ResizeHandle direction="horizontal" onResize={handleLeftResize} />
              </>
            )}

            {/* Center Content -- Split Panes or Architecture View */}
            <div
              className="flex flex-1 flex-col overflow-hidden"
              style={{ minHeight: 0, position: 'relative' }}
              data-tour="file-grid"
            >
              {architectMode ? (
                <ArchitectView currentPath={currentPath} onClose={() => setArchitectMode(false)} />
              ) : (
                <>
                  <ErrorBoundary>
                    <ExplorerProvider value={explorerContextValue}>
                      <SplitContainer
                        node={layoutState.rootNode}
                        groups={layoutState.groups}
                        activeGroupId={layoutState.activeGroupId}
                        path={[]}
                      />
                    </ExplorerProvider>
                  </ErrorBoundary>

                  {/* Pane sync visual connector line */}
                  {paneSync.enabled && Object.keys(layoutState.groups).length > 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        pointerEvents: 'none',
                        zIndex: 50,
                        border: '2px solid var(--xp-blue)',
                        opacity: 0.3,
                        borderRadius: 4,
                      }}
                    />
                  )}
                </>
              )}
            </div>

            {/* Vertical Extensions Bar */}
            <VerticalExtensionsBar
              data-tour="extensions-bar"
              rightPanelTab={rightPanelTab}
              setRightPanelTab={setRightPanelTab}
              rightSidebarCollapsed={rightSidebarCollapsed}
              setRightSidebarCollapsed={setRightSidebarCollapsed}
            />

            {/* Right Sidebar */}
            {!rightSidebarCollapsed && (
              <ResizeHandle direction="horizontal" onResize={handleRightResize} />
            )}
            <ErrorBoundary>
              <RightSidebar
                rightSidebarCollapsed={rightSidebarCollapsed}
                setRightSidebarCollapsed={setRightSidebarCollapsed}
                rightPanelTab={rightPanelTab}
                width={rightSidebarWidth}
                selectedFile={selectedFile}
                formatFileSize={formatFileSize}
                formatDate={formatDate}
                themes={themes}
                theme={theme}
                applyTheme={handleApplyTheme}
                allFiles={files}
                selectedFiles={selectedFiles}
                getFolderSize={getFolderSize}
                currentPath={currentPath}
                isCalculatingSize={isCalculatingSize}
                navigateToPath={navigateToPath}
              />
            </ErrorBoundary>
          </div>

          {/* Bottom Panel */}
          {!bottomPanelCollapsed && (
            <ResizeHandle direction="vertical" onResize={handleBottomResize} />
          )}
          <ErrorBoundary>
            <BottomPanel
              bottomPanelCollapsed={bottomPanelCollapsed}
              setBottomPanelCollapsed={setBottomPanelCollapsed}
              bottomPanelTab={bottomPanelTab}
              setBottomPanelTab={setBottomPanelTab}
              height={bottomPanelHeight}
              terminalHistory={terminal.terminalHistory}
              terminalInput={terminal.terminalInput}
              setTerminalInput={terminal.setTerminalInput}
              terminalCwd={terminal.terminalCwd}
              executeTerminalCommand={terminal.executeTerminalCommand}
              files={files}
              currentPath={currentPath}
              themes={themes}
              theme={theme}
              selectedFiles={selectedFiles}
              selectedFile={selectedFile}
              outputMessages={terminal.outputMessages}
              onNavigate={navigateWithHistory}
              onPasteFromHistory={(entry) => {
                if (fileOps.contextMenuActions.pasteFromHistory) {
                  fileOps.contextMenuActions.pasteFromHistory(currentPath, entry);
                }
              }}
              fileChanges={fileChanges}
              onDismissChanges={handleDismissAllChanges}
              propertiesFilePath={dialogManager.propertiesDialogFile || selectedFile?.path || ''}
            />
          </ErrorBoundary>

          {/* Global Status Bar */}
          <StatusBar
            files={files}
            selectedFiles={selectedFiles}
            currentPath={currentPath}
            activeTab={activeTabObj}
            vimState={vimState}
          />

          {/* Panel Toggle Buttons */}
          <PanelToggleButtons
            rightSidebarCollapsed={rightSidebarCollapsed}
            bottomPanelCollapsed={bottomPanelCollapsed}
            onToggleRightSidebar={() => setRightSidebarCollapsed(false)}
            onToggleBottomPanel={() => setBottomPanelCollapsed(false)}
          />

          {/* Context Menu */}
          {ctxMenu.contextMenuVisible && ctxMenu.contextMenuPosition && (
            <ContextMenu
              isOpen={ctxMenu.contextMenuVisible}
              x={ctxMenu.contextMenuPosition.x}
              y={ctxMenu.contextMenuPosition.y}
              items={ctxMenu.contextMenuItems}
              file={ctxMenu.contextMenuFile || undefined}
              selectedFiles={selectedFiles}
              onClose={ctxMenu.closeContextMenu}
            />
          )}

          {/* All dialogs, toasts, and overlays */}
          <DialogsOverlay
            dialogManager={dialogManager}
            fileComparison={fileComparison}
            fileConflict={fileConflict}
            sortedFiles={filteredFiles}
            selectedFiles={selectedFiles}
            setSelectedFiles={setSelectedFiles}
            toast={toast}
            refetch={refetch}
            templatePickerOpen={templatePickerOpen}
            onCloseTemplatePicker={handleCloseTemplatePicker}
            onCreateFileFromTemplate={fileOps.createFileFromTemplate}
            currentPath={currentPath}
            folderCompareOpen={folderCompareOpen}
            onCloseFolderCompare={handleCloseFolderCompare}
            folderComparePaths={folderComparePaths}
            currentFiles={files}
            commandPaletteOpen={commandPaletteOpen}
            onCloseCommandPalette={handleCloseCommandPalette}
            commandPaletteCommands={commandPaletteCommands}
            onCommandPaletteFileSelect={handleCommandPaletteFileSelect}
            showChangeSummaryToast={showChangeSummaryToast}
            fileChanges={fileChanges}
            onDismissChangesToast={handleDismissChangesToast}
            onReviewChanges={handleReviewChanges}
            quickLookFile={quickLookFile}
            onCloseQuickLook={handleCloseQuickLook}
            pathBookmarksDialogOpen={pathBookmarksDialogOpen}
            onClosePathBookmarks={handleClosePathBookmarks}
            onNavigate={navigateWithHistory}
            workspaceLayoutDialogOpen={workspaceLayoutDialogOpen}
            onCloseWorkspaceLayout={handleCloseWorkspaceLayout}
            currentLayout={layoutState}
            currentUiState={workspaceUiState}
            onApplyLayout={handleApplyLayout}
            crossTabDialogOpen={crossTabDialogOpen}
            onCloseCrossTabDialog={handleCloseCrossTabDialog}
            crossTabSelections={crossTabSelection.selections}
            crossTabTotalSelectedCount={crossTabSelection.totalSelectedCount}
            crossTabSelectedTabCount={crossTabSelection.selectedTabCount}
            onCrossTabMoveAll={handleCrossTabMoveAll}
            onCrossTabCopyAll={handleCrossTabCopyAll}
            onCrossTabCompressAll={handleCrossTabCompressAll}
            onCrossTabDeleteAll={handleCrossTabDeleteAll}
            onCrossTabPickFolder={handleCrossTabPickFolder}
            shortcutsDialogOpen={shortcutsDialogOpen}
            onCloseShortcutsDialog={handleCloseShortcutsDialog}
            onOpenSettings={handleOpenSettings}
            collectionEditorOpen={collectionEditorOpen}
            onCloseCollectionEditor={handleCloseCollectionEditor}
            editingCollection={editingCollection}
          />
        </div>
      </CrossTabSelectionProvider>
    </DragDropProvider>
  );
};

export default MainLayout;
