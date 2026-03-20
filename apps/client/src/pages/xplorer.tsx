import React, { useState, useMemo, useRef, useCallback } from 'react';
import { type FileEntry } from '@/lib/tauri-api';
import { useToast } from '@/hooks/use-toast';
import { sortFiles } from '@/lib/utils';
import type { ConflictFileInfo } from '@/lib/tauri-api';
import type { ConflictResolution } from '@/components/dialogs/FileConflictDialog';

import { useFolderSizes } from '@/hooks/use-folder-sizes';
import { useFileComparison } from '@/hooks/use-file-comparison';

// Extracted hooks
import { useFileOperations } from '@/hooks/use-file-operations';
import { useContextMenu } from '@/hooks/use-context-menu';
import { useDialogManager } from '@/hooks/use-dialog-manager';
import { useTerminal } from '@/hooks/use-terminal';
import { useThemeManager } from '@/hooks/use-theme-manager';
import { useFocusChangeTracker } from '@/hooks/use-focus-change-tracker';
import { useLayoutState } from '@/hooks/use-layout-state';
import { useXplorerActions } from '@/hooks/use-xplorer-actions';
import { useXplorerEffects } from '@/hooks/use-xplorer-effects';

// Components
import { TopBarHandle } from '@/components/explorer/TopBar';
import type { LeftSidebarHandle } from '@/components/explorer/LeftSidebar';
import MainLayout from '@/components/explorer/MainLayout';
import { useSplitLayout } from '@/hooks/use-split-layout';
import { useCrossTabSelection } from '@/hooks/use-cross-tab-selection';
import { applyCollectionToFiles } from '@/lib/collections';
import { usePaneSync } from '@/hooks/use-pane-sync';

// ── Component ────────────────────────────────────────────────────────────────

const ExplorerUnified = () => {
  const { toast } = useToast();

  // Refs
  const topBarRef = useRef<TopBarHandle>(null);
  const leftSidebarRef = useRef<LeftSidebarHandle>(null);
  const pendingSelectRef = useRef<string | null>(null);

  // ── Split layout ──────────────────────────────────────────────────────────
  const splitLayout = useSplitLayout();
  const { state: layoutState, activeGroup } = splitLayout;
  const paneSync = usePaneSync();

  const currentPath = activeGroup.currentPath;
  const tabs = activeGroup.tabs;
  const activeTab = activeGroup.activeTabId;
  const activeTabObj = tabs.find(t => t.id === activeTab);
  const pathHistory = activeGroup.pathHistory;
  const historyIndex = activeGroup.historyIndex;

  // Per-pane selection
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // ── Layout state ────────────────────────────────────────────────────────────
  const layout = useLayoutState();

  // File conflict dialog state
  const [fileConflict, setFileConflict] = useState<{
    fileName: string; isDir: boolean; destination: string; remaining: number;
    sourceInfo?: ConflictFileInfo | null;
    destInfo?: ConflictFileInfo | null;
    resolve: (resolution: ConflictResolution, applyToAll: boolean) => void;
  } | null>(null);

  // Expose for E2E testing
  if (typeof window !== 'undefined' && (window as any).__XPLORER_E2E__) {
    (window as any).__setFileConflict__ = setFileConflict;
  }

  // Selected file for preview
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);

  // ── Dependent hooks ───────────────────────────────────────────────────────
  const { changes: fileChanges, dismissChanges: dismissFileChanges } = useFocusChangeTracker(currentPath);
  const crossTabSelection = useCrossTabSelection();
  const { themes, theme, setTheme, handleApplyTheme } = useThemeManager();
  const fileComparison = useFileComparison();

  // Files from active pane
  const [paneFiles, setPaneFiles] = useState<FileEntry[]>([]);
  const paneRefetchRef = useRef<() => void>(() => {});
  const files = paneFiles;
  const refetch = useCallback(() => paneRefetchRef.current(), []);

  // Dialog manager
  const dialogManager = useDialogManager({
    splitLayout, activeGroupId: activeGroup.id,
    fileComparison, refetch: () => refetch(),
  });

  // Terminal
  const terminal = useTerminal({
    currentPath,
    setCurrentPath: (path: string) => {
      splitLayout.navigate(activeGroup.id, path, path.split(/[/\\]/).pop() || path);
    },
    refetch: () => refetch(),
  });

  // Sorted + filtered files
  const sortedFiles = useMemo(() => sortFiles(files, layout.sortBy, layout.sortOrder), [files, layout.sortBy, layout.sortOrder]);
  const filteredFiles = useMemo(() => {
    if (!dialogManager.activeCollectionFilter) return sortedFiles;
    return applyCollectionToFiles(sortedFiles, dialogManager.activeCollectionFilter);
  }, [sortedFiles, dialogManager.activeCollectionFilter]);

  const handleGDriveFileSelect = useCallback((file: FileEntry) => { setSelectedFiles(new Set([file.path])); }, []);

  // ── File operations ───────────────────────────────────────────────────────
  const fileOps = useFileOperations({
    currentPath, selectedFiles, setSelectedFiles, files, refetch, toast,
    splitLayout, activeGroupId: activeGroup.id, fileComparison,
    dialogs: {
      openPropertiesDialog: dialogManager.openPropertiesDialog,
      openOpenWithDialog: dialogManager.openOpenWithDialog,
      openCompressDialog: dialogManager.openCompressDialog,
      openBulkRenameDialog: dialogManager.openBulkRenameDialog,
      openExtractDialog: dialogManager.openExtractDialog,
      openFileTagsDialog: dialogManager.openFileTagsDialog,
      openFileDetailsDialog: dialogManager.openFileDetailsDialog,
      openEncryptionDialog: dialogManager.openEncryptionDialog,
      openSecureDeleteDialog: dialogManager.openSecureDeleteDialog,
      openVersionHistoryDialog: dialogManager.openVersionHistoryDialog,
      openSymlinkDialog: dialogManager.openSymlinkDialog,
      openPasteRenameDialog: dialogManager.openPasteRenameDialog,
      openTemplatePicker: () => dialogManager.setTemplatePickerOpen(true),
      openFolderCompare: (leftPath: string, rightPath: string) => {
        dialogManager.setFolderComparePaths({ left: leftPath, right: rightPath });
        dialogManager.setFolderCompareOpen(true);
      },
      setShowAdvancedSelect: dialogManager.setShowAdvancedSelect,
      openBatchConfirmDialog: dialogManager.openBatchConfirmDialog,
      openBatchMetadataDialog: dialogManager.openBatchMetadataDialog,
    },
    setBottomPanelCollapsed: layout.setBottomPanelCollapsed,
    setBottomPanelTab: layout.setBottomPanelTab,
    setTerminalCwd: terminal.setTerminalCwd,
    setViewMode: layout.setViewMode,
    setSortBy: layout.setSortBy,
    setSortOrder: layout.setSortOrder,
    navigateToPath: (path: string) => {
      splitLayout.navigate(activeGroup.id, path, path.split(/[/\\]/).pop() || path);
    },
    resolveConflict: (fileName, isDir, destination, remaining, sourceInfo, destInfo) => {
      return new Promise((resolve) => {
        setFileConflict({
          fileName, isDir, destination, remaining,
          sourceInfo: sourceInfo ?? null, destInfo: destInfo ?? null,
          resolve: (resolution, applyToAll) => { setFileConflict(null); resolve({ resolution, applyToAll }); },
        });
      });
    },
  });

  // ── Context menu ──────────────────────────────────────────────────────────
  const ctxMenu = useContextMenu({
    contextMenuFactoryRef: fileOps.contextMenuFactoryRef,
    selectedFiles, clipboard: fileOps.clipboard,
    currentPath, markedFile: fileComparison.markedFile,
  });

  // ── Folder sizes ──────────────────────────────────────────────────────────
  const { getFolderSize, isCalculatingSize } = useFolderSizes(files);

  // ── Actions ───────────────────────────────────────────────────────────────
  const actions = useXplorerActions({
    currentPath, splitLayout, activeGroup,
    selectedFiles, setSelectedFiles, setSelectedFile,
    files, refetch, toast, fileOps, ctxMenu, dialogManager,
    crossTabSelection, theme, setTheme,
    handleQuickLook: dialogManager.handleQuickLook, handleGDriveFileSelect,
    setPaneFiles, paneRefetchRef, pendingSelectRef, topBarRef, leftSidebarRef,
    dismissFileChanges,
    viewMode: layout.viewMode, leftSidebarCollapsed: layout.leftSidebarCollapsed,
    rightSidebarCollapsed: layout.rightSidebarCollapsed, bottomPanelCollapsed: layout.bottomPanelCollapsed,
    setLeftSidebarCollapsed: layout.setLeftSidebarCollapsed,
    setRightSidebarCollapsed: layout.setRightSidebarCollapsed,
    setBottomPanelCollapsed: layout.setBottomPanelCollapsed,
    setBottomPanelTab: layout.setBottomPanelTab, setViewMode: layout.setViewMode,
    setShowChangeSummaryToast: dialogManager.setShowChangeSummaryToast, setFileConflict,
    setTemplatePickerOpen: dialogManager.setTemplatePickerOpen,
    setFolderCompareOpen: dialogManager.setFolderCompareOpen,
    setFolderComparePaths: dialogManager.setFolderComparePaths,
    setCommandPaletteOpen: dialogManager.setCommandPaletteOpen,
    setQuickLookFile: dialogManager.setQuickLookFile,
    setPathBookmarksDialogOpen: dialogManager.setPathBookmarksDialogOpen,
    setWorkspaceLayoutDialogOpen: dialogManager.setWorkspaceLayoutDialogOpen,
    setCrossTabDialogOpen: dialogManager.setCrossTabDialogOpen,
    setShortcutsDialogOpen: dialogManager.setShortcutsDialogOpen,
    setCollectionEditorOpen: dialogManager.setCollectionEditorOpen,
    setEditingCollection: dialogManager.setEditingCollection,
  });

  // ── Effects ───────────────────────────────────────────────────────────────
  const effects = useXplorerEffects({
    currentPath, files, selectedFiles, setSelectedFiles,
    selectedFile, setSelectedFile, filteredFiles, refetch, toast,
    pendingSelectRef, topBarRef, leftSidebarRef,
    navigateWithHistory: actions.navigateWithHistory, navigateUp: actions.navigateUp,
    navigateBackInHistory: actions.navigateBackInHistory,
    navigateForwardInHistory: actions.navigateForwardInHistory,
    setCurrentPath: actions.setCurrentPath, handleFileDoubleClick: actions.handleFileDoubleClick,
    splitLayoutRef: actions.splitLayoutRef, activeGroupRef: actions.activeGroupRef,
    navigateToPathRef: actions.navigateToPathRef,
    splitLayout, activeGroup, activeTabObj, tabs, activeTab,
    pathHistory, historyIndex,
    viewMode: layout.viewMode, setViewMode: layout.setViewMode,
    leftSidebarCollapsed: layout.leftSidebarCollapsed, setLeftSidebarCollapsed: layout.setLeftSidebarCollapsed,
    rightSidebarCollapsed: layout.rightSidebarCollapsed, setRightSidebarCollapsed: layout.setRightSidebarCollapsed,
    bottomPanelCollapsed: layout.bottomPanelCollapsed, setBottomPanelCollapsed: layout.setBottomPanelCollapsed,
    rightPanelTab: layout.rightPanelTab, setRightPanelTab: layout.setRightPanelTab,
    bottomPanelTab: layout.bottomPanelTab, setBottomPanelTab: layout.setBottomPanelTab,
    leftSidebarWidth: layout.leftSidebarWidth, rightSidebarWidth: layout.rightSidebarWidth,
    bottomPanelHeight: layout.bottomPanelHeight,
    searchPanelOpen: layout.searchPanelOpen, setSearchPanelOpen: layout.setSearchPanelOpen,
    sortBy: layout.sortBy, sortOrder: layout.sortOrder, theme,
    setCommandPaletteOpen: dialogManager.setCommandPaletteOpen, commandPaletteOpen: dialogManager.commandPaletteOpen,
    setWorkspaceLayoutDialogOpen: dialogManager.setWorkspaceLayoutDialogOpen,
    setPathBookmarksDialogOpen: dialogManager.setPathBookmarksDialogOpen,
    setShortcutsDialogOpen: dialogManager.setShortcutsDialogOpen,
    setShowChangeSummaryToast: dialogManager.setShowChangeSummaryToast,
    fileOps, fileChanges,
    openGDriveTab: actions.openGDriveTab, openGDriveManager: actions.openGDriveManager,
    vimActions: actions.vimActions,
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <MainLayout
      topBarRef={topBarRef}
      leftSidebarRef={leftSidebarRef}
      pendingSelectRef={pendingSelectRef}
      currentPath={currentPath}
      files={files}
      filteredFiles={filteredFiles}
      selectedFiles={selectedFiles}
      setSelectedFiles={setSelectedFiles}
      selectedFile={selectedFile}
      setSelectedFile={setSelectedFile}
      refetch={refetch}
      toast={toast}
      splitLayout={splitLayout}
      layoutState={layoutState}
      activeGroup={activeGroup}
      sharedActions={actions.sharedActions}
      {...layout}
      navigateWithHistory={actions.navigateWithHistory}
      navigateUp={actions.navigateUp}
      navigateToPath={actions.navigateToPath}
      navigateBackInHistory={actions.navigateBackInHistory}
      navigateForwardInHistory={actions.navigateForwardInHistory}
      canNavigateBackInHistory={actions.canNavigateBackInHistory}
      canNavigateForwardInHistory={actions.canNavigateForwardInHistory}
      handleFileClick={actions.handleFileClick}
      handleFileDoubleClick={actions.handleFileDoubleClick}
      ctxMenu={ctxMenu}
      dialogManager={dialogManager}
      fileComparison={fileComparison}
      fileConflict={fileConflict}
      terminal={terminal}
      themes={themes}
      theme={theme}
      handleApplyTheme={handleApplyTheme}
      getFolderSize={getFolderSize}
      isCalculatingSize={isCalculatingSize}
      vimState={effects.vimState}
      crossTabSelection={crossTabSelection}
      setCrossTabDialogOpen={dialogManager.setCrossTabDialogOpen}
      activeCollectionFilter={dialogManager.activeCollectionFilter}
      setActiveCollectionFilter={dialogManager.setActiveCollectionFilter}
      setCollectionEditorOpen={dialogManager.setCollectionEditorOpen}
      setEditingCollection={dialogManager.setEditingCollection}
      paneSync={paneSync}
      fileOps={fileOps}
      templatePickerOpen={dialogManager.templatePickerOpen}
      handleCloseTemplatePicker={actions.handleCloseTemplatePicker}
      folderCompareOpen={dialogManager.folderCompareOpen}
      handleCloseFolderCompare={actions.handleCloseFolderCompare}
      folderComparePaths={dialogManager.folderComparePaths}
      commandPaletteOpen={dialogManager.commandPaletteOpen}
      handleCloseCommandPalette={actions.handleCloseCommandPalette}
      commandPaletteCommands={effects.commandPaletteCommands}
      handleCommandPaletteFileSelect={actions.handleCommandPaletteFileSelect}
      showChangeSummaryToast={dialogManager.showChangeSummaryToast}
      fileChanges={fileChanges}
      handleDismissChangesToast={actions.handleDismissChangesToast}
      handleReviewChanges={actions.handleReviewChanges}
      quickLookFile={dialogManager.quickLookFile}
      handleCloseQuickLook={actions.handleCloseQuickLook}
      pathBookmarksDialogOpen={dialogManager.pathBookmarksDialogOpen}
      handleClosePathBookmarks={actions.handleClosePathBookmarks}
      workspaceLayoutDialogOpen={dialogManager.workspaceLayoutDialogOpen}
      handleCloseWorkspaceLayout={actions.handleCloseWorkspaceLayout}
      workspaceUiState={actions.workspaceUiState}
      handleApplyLayout={actions.handleApplyLayout}
      crossTabDialogOpen={dialogManager.crossTabDialogOpen}
      handleCloseCrossTabDialog={actions.handleCloseCrossTabDialog}
      handleCrossTabMoveAll={actions.handleCrossTabMoveAll}
      handleCrossTabCopyAll={actions.handleCrossTabCopyAll}
      handleCrossTabCompressAll={actions.handleCrossTabCompressAll}
      handleCrossTabDeleteAll={actions.handleCrossTabDeleteAll}
      handleCrossTabPickFolder={actions.handleCrossTabPickFolder}
      shortcutsDialogOpen={dialogManager.shortcutsDialogOpen}
      handleCloseShortcutsDialog={actions.handleCloseShortcutsDialog}
      handleOpenSettings={actions.handleOpenSettings}
      collectionEditorOpen={dialogManager.collectionEditorOpen}
      handleCloseCollectionEditor={actions.handleCloseCollectionEditor}
      editingCollection={dialogManager.editingCollection}
      handleDismissAllChanges={actions.handleDismissAllChanges}
    />
  );
}

export default ExplorerUnified;
