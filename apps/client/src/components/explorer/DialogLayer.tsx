import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { FileEntry, ConflictFileInfo } from '@/lib/tauri-api';
import {
  FileConflictDialog,
  type ConflictResolution,
} from '@/components/dialogs/FileConflictDialog';
import type { FileDetailsTab } from '@/components/dialogs/FileDetailsDialog';
import type { Toast } from '@/hooks/use-toast';
import type { EncryptionMode } from '@/components/dialogs/EncryptionDialog';
import { extensionHost } from '@/lib/extension-host';
import type { OpenHandler } from '@/hooks/use-open-with-prefs';

import type { BatchOperationType } from '@/components/dialogs/BatchConfirmDialog';

// Lazy-loaded built-in dialogs (fallbacks when no extension is registered)
const BatchConfirmDialog = React.lazy(() => import('@/components/dialogs/BatchConfirmDialog'));
const CompareFilesDialog = React.lazy(() => import('@/components/dialogs/CompareFilesDialog'));
const OpenWithDialog = React.lazy(() => import('@/components/dialogs/OpenWithDialog'));
const CompressDialog = React.lazy(() => import('@/components/dialogs/CompressDialog'));
const BulkRenameDialog = React.lazy(() => import('@/components/dialogs/BulkRenameDialog'));
const ExtractDialog = React.lazy(() => import('@/components/dialogs/ExtractDialog'));
const FileTagsDialog = React.lazy(() => import('@/components/dialogs/FileTagsDialog'));
const FileDetailsDialog = React.lazy(() => import('@/components/dialogs/FileDetailsDialog'));
const EncryptionDialog = React.lazy(() => import('@/components/dialogs/EncryptionDialog'));
const SecureDeleteDialog = React.lazy(() => import('@/components/dialogs/SecureDeleteDialog'));
const PasswordPromptDialog = React.lazy(() =>
  import('@/components/dialogs/PasswordPromptDialog').then((m) => ({
    default: m.PasswordPromptDialog,
  })),
);
const VersionHistoryDialog = React.lazy(() => import('@/components/dialogs/VersionHistoryDialog'));
const CreateSymlinkDialog = React.lazy(() => import('@/components/dialogs/CreateSymlinkDialog'));
const PasteRenameDialog = React.lazy(() => import('@/components/dialogs/PasteRenameDialog'));
const BatchMetadataDialog = React.lazy(() => import('@/components/dialogs/BatchMetadataDialog'));
import AdvancedSelectDialog from '@/components/explorer/AdvancedSelectDialog';
import { AdvancedSelectionExtension } from '@/extensions/advanced-selection';

export interface DialogLayerProps {
  dialogManager: {
    openWithDialogOpen: boolean;
    closeOpenWithDialog: () => void;
    openWithDialogFile: string;
    openWithDialogOnChoose: ((handler: OpenHandler) => void) | null;
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
  sortedFiles: FileEntry[];
  selectedFiles: Set<string>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  toast: (opts: Toast) => void;
  refetch: () => void;
}

/**
 * Helper: Render an extension-registered dialog if available, otherwise fall back to built-in.
 * Returns true if an extension dialog was rendered.
 */
const ExtensionDialog = ({
  dialogId,
  isOpen,
  onClose,
  data,
}: {
  dialogId: string;
  isOpen: boolean;
  onClose: () => void;
  data: Record<string, unknown>;
}) => {
  const renderer = extensionHost.getDialogRenderer(dialogId);
  if (!renderer) return null;
  return <ErrorBoundary>{renderer({ isOpen, onClose, data })}</ErrorBoundary>;
};

const DialogLayer = ({
  dialogManager,
  fileComparison,
  fileConflict,
  sortedFiles,
  selectedFiles,
  setSelectedFiles,
  toast,
  refetch,
}: DialogLayerProps) => {
  // Check which extension dialogs are registered
  const hasCompareExt = extensionHost.hasDialog('compare-files-dialog');
  const hasOpenWithExt = extensionHost.hasDialog('open-with-dialog');
  const hasCompressExt = extensionHost.hasDialog('compress-dialog');
  const hasBulkRenameExt = extensionHost.hasDialog('bulk-rename-dialog');
  const hasTagsExt = extensionHost.hasDialog('file-tags-dialog');
  const hasExtractExt = extensionHost.hasDialog('extract-dialog');

  return (
    <>
      {/* Compare Files Dialog */}
      {hasCompareExt ? (
        <ExtensionDialog
          dialogId="compare-files-dialog"
          isOpen={fileComparison.selectionDialogOpen}
          onClose={fileComparison.closeSelectionDialog}
          data={{
            onCompare: dialogManager.handleComparisonFromDialog,
            initialFile1: fileComparison.file1Path,
            initialFile2: fileComparison.file2Path,
          }}
        />
      ) : (
        <ErrorBoundary>
          <React.Suspense fallback={null}>
            <CompareFilesDialog
              isOpen={fileComparison.selectionDialogOpen}
              onClose={fileComparison.closeSelectionDialog}
              onCompare={dialogManager.handleComparisonFromDialog}
              initialFile1={fileComparison.file1Path}
              initialFile2={fileComparison.file2Path}
            />
          </React.Suspense>
        </ErrorBoundary>
      )}

      {/* Open With Dialog */}
      {hasOpenWithExt ? (
        <ExtensionDialog
          dialogId="open-with-dialog"
          isOpen={dialogManager.openWithDialogOpen}
          onClose={dialogManager.closeOpenWithDialog}
          data={{ filePath: dialogManager.openWithDialogFile }}
        />
      ) : (
        <ErrorBoundary>
          <React.Suspense fallback={null}>
            <OpenWithDialog
              isOpen={dialogManager.openWithDialogOpen}
              onClose={dialogManager.closeOpenWithDialog}
              filePath={dialogManager.openWithDialogFile}
              onChoose={dialogManager.openWithDialogOnChoose ?? (() => {})}
            />
          </React.Suspense>
        </ErrorBoundary>
      )}

      {/* Compress Dialog */}
      {hasCompressExt ? (
        <ExtensionDialog
          dialogId="compress-dialog"
          isOpen={dialogManager.compressDialogOpen}
          onClose={dialogManager.closeCompressDialog}
          data={{
            files: dialogManager.compressDialogFiles,
            onComplete: () => refetch(),
          }}
        />
      ) : (
        <ErrorBoundary>
          <React.Suspense fallback={null}>
            <CompressDialog
              isOpen={dialogManager.compressDialogOpen}
              onClose={dialogManager.closeCompressDialog}
              onComplete={() => refetch()}
              files={dialogManager.compressDialogFiles}
            />
          </React.Suspense>
        </ErrorBoundary>
      )}

      {/* Bulk Rename Dialog */}
      {hasBulkRenameExt ? (
        <ExtensionDialog
          dialogId="bulk-rename-dialog"
          isOpen={dialogManager.bulkRenameDialogOpen}
          onClose={dialogManager.closeBulkRenameDialog}
          data={{
            files: dialogManager.bulkRenameDialogFiles,
            onComplete: () => refetch(),
          }}
        />
      ) : (
        <ErrorBoundary>
          <React.Suspense fallback={null}>
            <BulkRenameDialog
              isOpen={dialogManager.bulkRenameDialogOpen}
              onClose={dialogManager.closeBulkRenameDialog}
              files={dialogManager.bulkRenameDialogFiles}
              onComplete={() => refetch()}
            />
          </React.Suspense>
        </ErrorBoundary>
      )}

      {/* File Tags Dialog */}
      {hasTagsExt ? (
        <ExtensionDialog
          dialogId="file-tags-dialog"
          isOpen={dialogManager.fileTagsDialogOpen}
          onClose={dialogManager.closeFileTagsDialog}
          data={{ filePath: dialogManager.fileTagsDialogFile }}
        />
      ) : (
        <ErrorBoundary>
          <React.Suspense fallback={null}>
            <FileTagsDialog
              isOpen={dialogManager.fileTagsDialogOpen}
              onClose={dialogManager.closeFileTagsDialog}
              filePath={dialogManager.fileTagsDialogFile}
            />
          </React.Suspense>
        </ErrorBoundary>
      )}

      {/* File Details Dialog (stays built-in — not one of the 7 extracted) */}
      <ErrorBoundary>
        <React.Suspense fallback={null}>
          <FileDetailsDialog
            isOpen={dialogManager.fileDetailsDialogOpen}
            onClose={dialogManager.closeFileDetailsDialog}
            filePath={dialogManager.fileDetailsDialogFile}
            initialTab={dialogManager.fileDetailsDialogTab}
          />
        </React.Suspense>
      </ErrorBoundary>

      {/* Extract Dialog */}
      {hasExtractExt ? (
        <ExtensionDialog
          dialogId="extract-dialog"
          isOpen={dialogManager.extractDialogOpen}
          onClose={dialogManager.closeExtractDialog}
          data={{
            archivePath: dialogManager.extractDialogFile,
            onComplete: () => refetch(),
          }}
        />
      ) : (
        <ErrorBoundary>
          <React.Suspense fallback={null}>
            <ExtractDialog
              isOpen={dialogManager.extractDialogOpen}
              onClose={dialogManager.closeExtractDialog}
              onComplete={() => refetch()}
              archivePath={dialogManager.extractDialogFile}
            />
          </React.Suspense>
        </ErrorBoundary>
      )}

      {/* Encryption Dialog */}
      <ErrorBoundary>
        <React.Suspense fallback={null}>
          <EncryptionDialog
            isOpen={dialogManager.encryptionDialogOpen}
            onClose={dialogManager.closeEncryptionDialog}
            onComplete={() => refetch()}
            filePath={dialogManager.encryptionDialogFile}
            mode={dialogManager.encryptionDialogMode}
          />
        </React.Suspense>
      </ErrorBoundary>

      {/* Secure Delete Dialog */}
      <ErrorBoundary>
        <React.Suspense fallback={null}>
          <SecureDeleteDialog
            isOpen={dialogManager.secureDeleteDialogOpen}
            onClose={dialogManager.closeSecureDeleteDialog}
            onComplete={() => refetch()}
            files={dialogManager.secureDeleteDialogFiles}
          />
        </React.Suspense>
      </ErrorBoundary>

      {/* Version History Dialog */}
      <ErrorBoundary>
        <React.Suspense fallback={null}>
          <VersionHistoryDialog
            isOpen={dialogManager.versionHistoryDialogOpen}
            onClose={dialogManager.closeVersionHistoryDialog}
            filePath={dialogManager.versionHistoryDialogFile}
            onRefetch={() => refetch()}
          />
        </React.Suspense>
      </ErrorBoundary>

      {/* Create Symlink Dialog */}
      <ErrorBoundary>
        <React.Suspense fallback={null}>
          <CreateSymlinkDialog
            isOpen={dialogManager.symlinkDialogOpen}
            onClose={dialogManager.closeSymlinkDialog}
            onComplete={() => refetch()}
            targetPath={dialogManager.symlinkDialogTarget}
          />
        </React.Suspense>
      </ErrorBoundary>

      {/* Paste & Rename Dialog */}
      <ErrorBoundary>
        <React.Suspense fallback={null}>
          <PasteRenameDialog
            isOpen={dialogManager.pasteRenameDialogOpen}
            onClose={dialogManager.closePasteRenameDialog}
            files={dialogManager.pasteRenameDialogFiles}
            onComplete={() => refetch()}
          />
        </React.Suspense>
      </ErrorBoundary>

      {/* Password Prompt Dialog (stays built-in — core infrastructure) */}
      <ErrorBoundary>
        <React.Suspense fallback={null}>
          <PasswordPromptDialog
            isOpen={dialogManager.passwordPromptOpen}
            onClose={dialogManager.handlePasswordPromptClose}
            onSubmit={dialogManager.handlePasswordPromptSubmit}
            title={dialogManager.passwordPromptData?.title || 'Password Required'}
            description={
              dialogManager.passwordPromptData?.description ||
              'Please enter your password to continue.'
            }
            showRememberOption={true}
          />
        </React.Suspense>
      </ErrorBoundary>

      {/* Advanced Selection Extension */}
      <AdvancedSelectionExtension
        files={sortedFiles}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        showToast={toast}
      />

      {/* Advanced Selection Dialog */}
      <AdvancedSelectDialog
        isOpen={dialogManager.showAdvancedSelect}
        onClose={() => dialogManager.setShowAdvancedSelect(false)}
        files={sortedFiles}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        showToast={toast}
      />

      {/* Batch Confirm Dialog */}
      <ErrorBoundary>
        <React.Suspense fallback={null}>
          <BatchConfirmDialog
            isOpen={dialogManager.batchConfirmDialogOpen}
            operation={dialogManager.batchConfirmDialogOperation}
            files={dialogManager.batchConfirmDialogFiles}
            destination={dialogManager.batchConfirmDialogDestination}
            onConfirm={() => {
              const cb = dialogManager.batchConfirmDialogOnConfirm;
              dialogManager.closeBatchConfirmDialog();
              if (cb) cb();
            }}
            onCancel={dialogManager.closeBatchConfirmDialog}
          />
        </React.Suspense>
      </ErrorBoundary>

      {/* Batch Metadata Dialog */}
      <ErrorBoundary>
        <React.Suspense fallback={null}>
          <BatchMetadataDialog
            isOpen={dialogManager.batchMetadataDialogOpen}
            onClose={dialogManager.closeBatchMetadataDialog}
            files={dialogManager.batchMetadataDialogFiles}
            onComplete={() => refetch()}
          />
        </React.Suspense>
      </ErrorBoundary>

      {/* File Conflict Resolution Dialog */}
      {fileConflict && (
        <FileConflictDialog
          isOpen={true}
          fileName={fileConflict.fileName}
          isDir={fileConflict.isDir}
          destination={fileConflict.destination}
          remaining={fileConflict.remaining}
          sourceInfo={fileConflict.sourceInfo}
          destInfo={fileConflict.destInfo}
          onResolve={fileConflict.resolve}
        />
      )}

      {/* Extension-registered dialogs (opened via extensionHost.openDialog) */}
      <ExtensionDialogRenderer />
    </>
  );
};

/**
 * Renders extension dialogs that were opened via extensionHost.openDialog().
 * These are dialogs opened programmatically by extensions themselves.
 */
const ExtensionDialogRenderer = () => {
  const _extVersion = React.useSyncExternalStore(
    extensionHost.subscribe,
    extensionHost.getSnapshotVersion,
  );

  const openDialogs = extensionHost.getOpenDialogs();
  const elements: React.ReactElement[] = [];

  openDialogs.forEach((data, dialogId) => {
    const renderer = extensionHost.getDialogRenderer(dialogId);
    if (renderer) {
      elements.push(
        // eslint-disable-next-line react/no-array-index-key
        <ErrorBoundary key={dialogId}>
          {renderer({
            isOpen: true,
            onClose: () => extensionHost.closeDialog(dialogId),
            data,
          })}
        </ErrorBoundary>,
      );
    }
  });

  return <>{elements}</>;
};

export default DialogLayer;
