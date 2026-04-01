import React from 'react';
import type { FileEntry, ConflictFileInfo } from '@/lib/tauri-api';
import type { ConflictResolution } from '@/components/dialogs/FileConflictDialog';
import type { FileCollection } from '@/lib/collections';
import type { Toast } from '@/hooks/use-toast';
import type { FileChangeSet } from '@/hooks/use-focus-change-tracker';
import type { CrossTabSelection } from '@/hooks/use-cross-tab-selection';
import type { WorkspaceLayoutUiState } from '@/lib/workspace-layouts';
import type { SplitLayoutState } from '@/types/split-view';
import type { Command } from '@/components/CommandPalette';
import type { EncryptionMode } from '@/components/dialogs/EncryptionDialog';
import type { FileDetailsTab } from '@/components/dialogs/FileDetailsDialog';
import type { BatchOperationType } from '@/components/dialogs/BatchConfirmDialog';

// Components (lightweight, always needed)
import DialogLayer from '@/components/explorer/DialogLayer';
import { Toaster } from '@/components/ui/Toast';
import ChangeSummaryToast from '@/components/ui/ChangeSummaryToast';

// Lazy-loaded dialogs and overlays -- only loaded when opened
const TemplatePickerDialog = React.lazy(() => import('@/components/dialogs/TemplatePickerDialog'));
const PathBookmarksDialog = React.lazy(() => import('@/components/dialogs/PathBookmarksDialog'));
const CrossTabOperationsDialog = React.lazy(
  () => import('@/components/dialogs/CrossTabOperationsDialog'),
);
const ExtensionPermissionDialog = React.lazy(
  () => import('@/components/dialogs/ExtensionPermissionDialog'),
);
const WorkspaceLayoutDialog = React.lazy(
  () => import('@/components/dialogs/WorkspaceLayoutDialog'),
);
const BetaWarningDialog = React.lazy(() => import('@/components/dialogs/BetaWarningDialog'));
const CommandPalette = React.lazy(() => import('@/components/CommandPalette'));
const TourOverlay = React.lazy(() => import('@/components/tour/TourOverlay'));
const FileOperationProgressDialog = React.lazy(
  () => import('@/components/dialogs/FileOperationProgressDialog'),
);
const QuickLookOverlay = React.lazy(() => import('@/components/QuickLookOverlay'));
const CollectionEditorDialog = React.lazy(
  () => import('@/components/dialogs/CollectionEditorDialog'),
);
const KeyboardShortcutsDialog = React.lazy(
  () => import('@/components/dialogs/KeyboardShortcutsDialog'),
);
const FolderCompareDialog = React.lazy(() => import('@/components/dialogs/FolderCompareDialog'));

// ── Types ────────────────────────────────────────────────────────────────────

export interface DialogsOverlayProps {
  // ── DialogLayer props ────────────────────────────────────────────────────
  dialogManager: {
    openWithDialogOpen: boolean;
    closeOpenWithDialog: () => void;
    openWithDialogFile: string;
    openWithDialogOnChoose:
      | ((handler: import('@/hooks/use-open-with-prefs').OpenHandler) => void)
      | null;
    compressDialogOpen: boolean;
    closeCompressDialog: () => void;
    compressDialogFiles: FileEntry[];
    bulkRenameDialogOpen: boolean;
    closeBulkRenameDialog: () => void;
    bulkRenameDialogFiles: FileEntry[];
    fileDetailsDialogTab: FileDetailsTab;
    extractDialogOpen: boolean;
    closeExtractDialog: () => void;
    extractDialogFile: string;
    fileTagsDialogOpen: boolean;
    closeFileTagsDialog: () => void;
    fileTagsDialogFile: string;
    fileDetailsDialogOpen: boolean;
    closeFileDetailsDialog: () => void;
    fileDetailsDialogFile: string;
    passwordPromptOpen: boolean;
    handlePasswordPromptClose: () => void;
    handlePasswordPromptSubmit: (password: string, remember: boolean) => void;
    passwordPromptData: { title?: string; description?: string } | null;
    encryptionDialogOpen: boolean;
    encryptionDialogFile: string;
    encryptionDialogMode: EncryptionMode;
    closeEncryptionDialog: () => void;
    secureDeleteDialogOpen: boolean;
    secureDeleteDialogFiles: FileEntry[];
    closeSecureDeleteDialog: () => void;
    versionHistoryDialogOpen: boolean;
    versionHistoryDialogFile: string;
    closeVersionHistoryDialog: () => void;
    showAdvancedSelect: boolean;
    setShowAdvancedSelect: (open: boolean) => void;
    handleComparisonFromDialog: (file1: string, file2: string) => void;
    batchConfirmDialogOpen: boolean;
    batchConfirmDialogFiles: FileEntry[];
    batchConfirmDialogOperation: BatchOperationType;
    batchConfirmDialogDestination: string | undefined;
    batchConfirmDialogOnConfirm: (() => void) | null;
    closeBatchConfirmDialog: () => void;
    symlinkDialogOpen: boolean;
    symlinkDialogTarget: string;
    closeSymlinkDialog: () => void;
    pasteRenameDialogOpen: boolean;
    pasteRenameDialogFiles: FileEntry[];
    closePasteRenameDialog: () => void;
    batchMetadataDialogOpen: boolean;
    batchMetadataDialogFiles: FileEntry[];
    closeBatchMetadataDialog: () => void;
  };
  fileComparison: {
    selectionDialogOpen: boolean;
    closeSelectionDialog: () => void;
    file1Path: string;
    file2Path: string;
  };
  fileConflict: {
    fileName: string;
    isDir: boolean;
    destination: string;
    remaining: number;
    sourceInfo?: ConflictFileInfo | null;
    destInfo?: ConflictFileInfo | null;
    resolve: (resolution: ConflictResolution, applyToAll: boolean) => void;
  } | null;
  /** Sorted (and possibly filtered) files for advanced selection */
  sortedFiles: FileEntry[];
  selectedFiles: Set<string>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  toast: (opts: Toast) => void;
  refetch: () => void;

  // ── Template Picker ──────────────────────────────────────────────────────
  templatePickerOpen: boolean;
  onCloseTemplatePicker: () => void;
  onCreateFileFromTemplate: (filename: string, content: string) => void;
  currentPath: string;

  // ── Folder Compare ───────────────────────────────────────────────────────
  folderCompareOpen: boolean;
  onCloseFolderCompare: () => void;
  folderComparePaths: { left: string; right: string };

  currentFiles: FileEntry[];

  // ── Command Palette ──────────────────────────────────────────────────────
  commandPaletteOpen: boolean;
  onCloseCommandPalette: () => void;
  commandPaletteCommands: Command[];
  onCommandPaletteFileSelect: (filePath: string, isDir: boolean) => void;

  // ── Change Summary Toast ─────────────────────────────────────────────────
  showChangeSummaryToast: boolean;
  fileChanges: FileChangeSet | null;
  onDismissChangesToast: () => void;
  onReviewChanges: () => void;

  // ── Quick Look ───────────────────────────────────────────────────────────
  quickLookFile: FileEntry | null;
  onCloseQuickLook: () => void;

  // ── Path Bookmarks ───────────────────────────────────────────────────────
  pathBookmarksDialogOpen: boolean;
  onClosePathBookmarks: () => void;
  onNavigate: (path: string) => void;

  // ── Workspace Layout ─────────────────────────────────────────────────────
  workspaceLayoutDialogOpen: boolean;
  onCloseWorkspaceLayout: () => void;
  currentLayout: SplitLayoutState;
  currentUiState: WorkspaceLayoutUiState;
  onApplyLayout: (layout: SplitLayoutState, uiState: WorkspaceLayoutUiState) => void;

  // ── Cross-Tab Operations ─────────────────────────────────────────────────
  crossTabDialogOpen: boolean;
  onCloseCrossTabDialog: () => void;
  crossTabSelections: Map<string, CrossTabSelection>;
  crossTabTotalSelectedCount: number;
  crossTabSelectedTabCount: number;
  onCrossTabMoveAll: (destination: string) => Promise<void>;
  onCrossTabCopyAll: (destination: string) => Promise<void>;
  onCrossTabCompressAll: (destination: string) => Promise<void>;
  onCrossTabDeleteAll: () => Promise<void>;
  onCrossTabPickFolder: () => Promise<string | null>;

  // ── Keyboard Shortcuts ───────────────────────────────────────────────────
  shortcutsDialogOpen: boolean;
  onCloseShortcutsDialog: () => void;
  onOpenSettings: () => void;

  // ── Collection Editor ────────────────────────────────────────────────────
  collectionEditorOpen: boolean;
  onCloseCollectionEditor: () => void;
  editingCollection: FileCollection | null;
}

// ── Component ────────────────────────────────────────────────────────────────

const DialogsOverlay = ({
  // DialogLayer
  dialogManager,
  fileComparison,
  fileConflict,
  sortedFiles,
  selectedFiles,
  setSelectedFiles,
  toast,
  refetch,
  // Template Picker
  templatePickerOpen,
  onCloseTemplatePicker,
  onCreateFileFromTemplate,
  currentPath,
  // Folder Compare
  folderCompareOpen,
  onCloseFolderCompare,
  folderComparePaths,
  currentFiles,
  // Command Palette
  commandPaletteOpen,
  onCloseCommandPalette,
  commandPaletteCommands,
  onCommandPaletteFileSelect,
  // Change Summary Toast
  showChangeSummaryToast,
  fileChanges,
  onDismissChangesToast,
  onReviewChanges,
  // Quick Look
  quickLookFile,
  onCloseQuickLook,
  // Path Bookmarks
  pathBookmarksDialogOpen,
  onClosePathBookmarks,
  onNavigate,
  // Workspace Layout
  workspaceLayoutDialogOpen,
  onCloseWorkspaceLayout,
  currentLayout,
  currentUiState,
  onApplyLayout,
  // Cross-Tab Operations
  crossTabDialogOpen,
  onCloseCrossTabDialog,
  crossTabSelections,
  crossTabTotalSelectedCount,
  crossTabSelectedTabCount,
  onCrossTabMoveAll,
  onCrossTabCopyAll,
  onCrossTabCompressAll,
  onCrossTabDeleteAll,
  onCrossTabPickFolder,
  // Keyboard Shortcuts
  shortcutsDialogOpen,
  onCloseShortcutsDialog,
  onOpenSettings,
  // Collection Editor
  collectionEditorOpen,
  onCloseCollectionEditor,
  editingCollection,
}: DialogsOverlayProps) => {
  return (
    <>
      {/* DialogLayer (compress, extract, bulk rename, properties, open-with, etc.) */}
      <DialogLayer
        dialogManager={dialogManager}
        fileComparison={fileComparison}
        fileConflict={fileConflict}
        sortedFiles={sortedFiles}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        toast={toast}
        refetch={refetch}
      />

      {/* All lazy-loaded dialogs share a single Suspense boundary */}
      <React.Suspense fallback={null}>
        {/* Template Picker */}
        {templatePickerOpen && (
          <TemplatePickerDialog
            isOpen={templatePickerOpen}
            onClose={onCloseTemplatePicker}
            onCreateFile={onCreateFileFromTemplate}
            currentPath={currentPath}
          />
        )}

        {/* Folder Compare Dialog */}
        {folderCompareOpen && (
          <FolderCompareDialog
            isOpen={folderCompareOpen}
            onClose={onCloseFolderCompare}
            onOpenDiff={dialogManager.handleComparisonFromDialog}
            initialLeft={folderComparePaths.left}
            initialRight={folderComparePaths.right}
          />
        )}

        {/* Filter Preset Editor */}
        {/* Command Palette */}
        {commandPaletteOpen && (
          <CommandPalette
            isOpen={commandPaletteOpen}
            onClose={onCloseCommandPalette}
            commands={commandPaletteCommands}
            currentPath={currentPath}
            onFileSelect={onCommandPaletteFileSelect}
          />
        )}

        {/* Path Bookmarks Dialog */}
        {pathBookmarksDialogOpen && (
          <PathBookmarksDialog
            isOpen={pathBookmarksDialogOpen}
            onClose={onClosePathBookmarks}
            currentPath={currentPath}
            onNavigate={onNavigate}
          />
        )}

        {/* Workspace Layout Dialog */}
        {workspaceLayoutDialogOpen && (
          <WorkspaceLayoutDialog
            isOpen={workspaceLayoutDialogOpen}
            onClose={onCloseWorkspaceLayout}
            currentLayout={currentLayout}
            currentUiState={currentUiState}
            onApplyLayout={onApplyLayout}
          />
        )}

        {/* Cross-Tab Batch Operations Dialog */}
        {crossTabDialogOpen && (
          <CrossTabOperationsDialog
            isOpen={crossTabDialogOpen}
            onClose={onCloseCrossTabDialog}
            selections={crossTabSelections}
            totalSelectedCount={crossTabTotalSelectedCount}
            selectedTabCount={crossTabSelectedTabCount}
            onMoveAll={onCrossTabMoveAll}
            onCopyAll={onCrossTabCopyAll}
            onCompressAll={onCrossTabCompressAll}
            onDeleteAll={onCrossTabDeleteAll}
            onPickFolder={onCrossTabPickFolder}
          />
        )}

        {/* Keyboard Shortcuts Dialog */}
        {shortcutsDialogOpen && (
          <KeyboardShortcutsDialog
            isOpen={shortcutsDialogOpen}
            onClose={onCloseShortcutsDialog}
            onOpenSettings={onOpenSettings}
          />
        )}

        {/* Collection Editor Dialog */}
        {collectionEditorOpen && (
          <CollectionEditorDialog
            isOpen={collectionEditorOpen}
            onClose={onCloseCollectionEditor}
            collection={editingCollection}
            currentFiles={currentFiles}
            currentPath={currentPath}
          />
        )}

        {/* Quick Look Overlay (pulls in react-syntax-highlighter) */}
        {quickLookFile && <QuickLookOverlay file={quickLookFile} onClose={onCloseQuickLook} />}

        {/* Beta Warning (first launch) */}
        <BetaWarningDialog />

        {/* Extension Permission Consent Dialog */}
        <ExtensionPermissionDialog />

        {/* Onboarding Tour */}
        <TourOverlay />

        {/* File Operation Progress Overlay */}
        <FileOperationProgressDialog />
      </React.Suspense>

      {/* Toast Notifications (lightweight, always needed) */}
      <Toaster />

      {/* File Change Summary Toast */}
      {showChangeSummaryToast && fileChanges && fileChanges.totalCount > 0 && (
        <ChangeSummaryToast
          changes={fileChanges}
          onDismiss={onDismissChangesToast}
          onReview={onReviewChanges}
        />
      )}
    </>
  );
};

export default DialogsOverlay;
