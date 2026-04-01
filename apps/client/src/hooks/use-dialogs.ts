import { useState, useCallback, useRef } from 'react';
import { FileEntry } from '@/lib/tauri-api';
import type { OpenHandler } from '@/hooks/use-open-with-prefs';
import type { FileDetailsTab } from '@/components/dialogs/FileDetailsDialog';
import type { EncryptionMode } from '@/components/dialogs/EncryptionDialog';
import type { BatchOperationType } from '@/components/dialogs/BatchConfirmDialog';
import type { MoveTreePreviewData } from '@/components/dialogs/MoveTreePreviewDialog';
import type { ConflictResolutionType } from '@/lib/move-tree-preview';
import type { FileCollection } from '@/lib/collections';

export interface DialogState {
  // Properties
  propertiesDialogOpen: boolean;
  propertiesDialogFile: string;
  openPropertiesDialog: (filePath: string) => void;
  closePropertiesDialog: () => void;

  // Open With
  openWithDialogOpen: boolean;
  openWithDialogFile: string;
  openWithDialogOnChoose: ((handler: OpenHandler) => void) | null;
  openOpenWithDialog: (filePath: string, onChoose?: (handler: OpenHandler) => void) => void;
  closeOpenWithDialog: () => void;

  // Compress
  compressDialogOpen: boolean;
  compressDialogFiles: FileEntry[];
  openCompressDialog: (files: FileEntry[]) => void;
  closeCompressDialog: () => void;

  // Bulk Rename
  bulkRenameDialogOpen: boolean;
  bulkRenameDialogFiles: FileEntry[];
  openBulkRenameDialog: (files: FileEntry[]) => void;
  closeBulkRenameDialog: () => void;

  // File Tags
  fileTagsDialogOpen: boolean;
  fileTagsDialogFile: string;
  openFileTagsDialog: (filePath: string) => void;
  closeFileTagsDialog: () => void;

  // File Details (merged Notes + Annotations + Metadata)
  fileDetailsDialogOpen: boolean;
  fileDetailsDialogFile: string;
  fileDetailsDialogTab: FileDetailsTab;
  openFileDetailsDialog: (filePath: string, tab?: FileDetailsTab) => void;
  closeFileDetailsDialog: () => void;

  // Extract
  extractDialogOpen: boolean;
  extractDialogFile: string;
  openExtractDialog: (filePath: string) => void;
  closeExtractDialog: () => void;

  // Password Prompt
  passwordPromptOpen: boolean;
  passwordPromptData: PasswordPromptData | null;
  openPasswordPrompt: (data: PasswordPromptData) => void;
  closePasswordPrompt: () => void;

  // Encryption
  encryptionDialogOpen: boolean;
  encryptionDialogFile: string;
  encryptionDialogMode: EncryptionMode;
  openEncryptionDialog: (filePath: string, mode: EncryptionMode) => void;
  closeEncryptionDialog: () => void;

  // Secure Delete
  secureDeleteDialogOpen: boolean;
  secureDeleteDialogFiles: FileEntry[];
  openSecureDeleteDialog: (files: FileEntry[]) => void;
  closeSecureDeleteDialog: () => void;

  // Version History
  versionHistoryDialogOpen: boolean;
  versionHistoryDialogFile: string;
  openVersionHistoryDialog: (filePath: string) => void;
  closeVersionHistoryDialog: () => void;

  // Batch Confirm
  batchConfirmDialogOpen: boolean;
  batchConfirmDialogFiles: FileEntry[];
  batchConfirmDialogOperation: BatchOperationType;
  batchConfirmDialogDestination: string | undefined;
  batchConfirmDialogOnConfirm: (() => void) | null;
  openBatchConfirmDialog: (
    operation: BatchOperationType,
    files: FileEntry[],
    onConfirm: () => void,
    destination?: string,
  ) => void;
  closeBatchConfirmDialog: () => void;

  // Create Symlink
  symlinkDialogOpen: boolean;
  symlinkDialogTarget: string;
  openSymlinkDialog: (targetPath: string) => void;
  closeSymlinkDialog: () => void;

  // Paste Rename
  pasteRenameDialogOpen: boolean;
  pasteRenameDialogFiles: FileEntry[];
  openPasteRenameDialog: (files: FileEntry[]) => void;
  closePasteRenameDialog: () => void;

  // Batch Metadata
  batchMetadataDialogOpen: boolean;
  batchMetadataDialogFiles: FileEntry[];
  openBatchMetadataDialog: (files: FileEntry[]) => void;
  closeBatchMetadataDialog: () => void;

  // Move Tree Preview
  moveTreePreviewOpen: boolean;
  moveTreePreviewData: MoveTreePreviewData | null;
  moveTreePreviewOnConfirm: ((resolutions: Map<string, ConflictResolutionType>) => void) | null;
  openMoveTreePreview: (
    data: MoveTreePreviewData,
    onConfirm: (resolutions: Map<string, ConflictResolutionType>) => void,
  ) => void;
  closeMoveTreePreview: () => void;

  // Advanced Select
  showAdvancedSelect: boolean;
  setShowAdvancedSelect: (show: boolean) => void;

  // Command Palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Workspace Layout dialog
  workspaceLayoutDialogOpen: boolean;
  setWorkspaceLayoutDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Path Bookmarks dialog
  pathBookmarksDialogOpen: boolean;
  setPathBookmarksDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Template Picker
  templatePickerOpen: boolean;
  setTemplatePickerOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Folder Compare dialog
  folderCompareOpen: boolean;
  setFolderCompareOpen: React.Dispatch<React.SetStateAction<boolean>>;
  folderComparePaths: { left: string; right: string };
  setFolderComparePaths: React.Dispatch<React.SetStateAction<{ left: string; right: string }>>;

  // Keyboard Shortcuts dialog
  shortcutsDialogOpen: boolean;
  setShortcutsDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Cross-tab batch operations dialog
  crossTabDialogOpen: boolean;
  setCrossTabDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Quick Look overlay
  quickLookFile: FileEntry | null;
  setQuickLookFile: React.Dispatch<React.SetStateAction<FileEntry | null>>;
  handleQuickLook: (file: FileEntry) => void;

  // Collection editor dialog
  collectionEditorOpen: boolean;
  setCollectionEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingCollection: FileCollection | null;
  setEditingCollection: React.Dispatch<React.SetStateAction<FileCollection | null>>;

  // Active collection filter (a collection applied as a filter on the current directory)
  activeCollectionFilter: FileCollection | null;
  setActiveCollectionFilter: React.Dispatch<React.SetStateAction<FileCollection | null>>;

  // Change summary toast
  showChangeSummaryToast: boolean;
  setShowChangeSummaryToast: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface PasswordPromptData {
  title: string;
  description: string;
  connectionId?: string;
  operation?: string;
  operationData?: Record<string, unknown>;
  onSuccess?: (password: string) => void;
}

export const useDialogs = (): DialogState => {
  // Properties
  const [propertiesDialogOpen, setPropertiesDialogOpen] = useState(false);
  const [propertiesDialogFile, setPropertiesDialogFile] = useState('');
  const openPropertiesDialog = useCallback((filePath: string) => {
    setPropertiesDialogFile(filePath);
    setPropertiesDialogOpen(true);
  }, []);
  const closePropertiesDialog = useCallback(() => setPropertiesDialogOpen(false), []);

  // Open With
  const [openWithDialogOpen, setOpenWithDialogOpen] = useState(false);
  const [openWithDialogFile, setOpenWithDialogFile] = useState('');
  const openWithOnChooseRef = useRef<((handler: OpenHandler) => void) | null>(null);
  const openOpenWithDialog = useCallback(
    (filePath: string, onChoose?: (handler: OpenHandler) => void) => {
      setOpenWithDialogFile(filePath);
      openWithOnChooseRef.current = onChoose ?? null;
      setOpenWithDialogOpen(true);
    },
    [],
  );
  const closeOpenWithDialog = useCallback(() => {
    setOpenWithDialogOpen(false);
    openWithOnChooseRef.current = null;
  }, []);

  // Compress
  const [compressDialogOpen, setCompressDialogOpen] = useState(false);
  const [compressDialogFiles, setCompressDialogFiles] = useState<FileEntry[]>([]);
  const openCompressDialog = useCallback((files: FileEntry[]) => {
    setCompressDialogFiles(files);
    setCompressDialogOpen(true);
  }, []);
  const closeCompressDialog = useCallback(() => setCompressDialogOpen(false), []);

  // Bulk Rename
  const [bulkRenameDialogOpen, setBulkRenameDialogOpen] = useState(false);
  const [bulkRenameDialogFiles, setBulkRenameDialogFiles] = useState<FileEntry[]>([]);
  const openBulkRenameDialog = useCallback((files: FileEntry[]) => {
    setBulkRenameDialogFiles(files);
    setBulkRenameDialogOpen(true);
  }, []);
  const closeBulkRenameDialog = useCallback(() => setBulkRenameDialogOpen(false), []);

  // File Tags
  const [fileTagsDialogOpen, setFileTagsDialogOpen] = useState(false);
  const [fileTagsDialogFile, setFileTagsDialogFile] = useState('');
  const openFileTagsDialog = useCallback((filePath: string) => {
    setFileTagsDialogFile(filePath);
    setFileTagsDialogOpen(true);
  }, []);
  const closeFileTagsDialog = useCallback(() => setFileTagsDialogOpen(false), []);

  // File Details (merged Notes + Annotations + Metadata)
  const [fileDetailsDialogOpen, setFileDetailsDialogOpen] = useState(false);
  const [fileDetailsDialogFile, setFileDetailsDialogFile] = useState('');
  const [fileDetailsDialogTab, setFileDetailsDialogTab] = useState<FileDetailsTab>('notes');
  const openFileDetailsDialog = useCallback((filePath: string, tab: FileDetailsTab = 'notes') => {
    setFileDetailsDialogFile(filePath);
    setFileDetailsDialogTab(tab);
    setFileDetailsDialogOpen(true);
  }, []);
  const closeFileDetailsDialog = useCallback(() => setFileDetailsDialogOpen(false), []);

  // Extract
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [extractDialogFile, setExtractDialogFile] = useState('');
  const openExtractDialog = useCallback((filePath: string) => {
    setExtractDialogFile(filePath);
    setExtractDialogOpen(true);
  }, []);
  const closeExtractDialog = useCallback(() => setExtractDialogOpen(false), []);

  // Password Prompt
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [passwordPromptData, setPasswordPromptData] = useState<PasswordPromptData | null>(null);
  const openPasswordPrompt = useCallback((data: PasswordPromptData) => {
    setPasswordPromptData(data);
    setPasswordPromptOpen(true);
  }, []);
  const closePasswordPrompt = useCallback(() => setPasswordPromptOpen(false), []);

  // Encryption
  const [encryptionDialogOpen, setEncryptionDialogOpen] = useState(false);
  const [encryptionDialogFile, setEncryptionDialogFile] = useState('');
  const [encryptionDialogMode, setEncryptionDialogMode] = useState<EncryptionMode>('encrypt');
  const openEncryptionDialog = useCallback((filePath: string, mode: EncryptionMode) => {
    setEncryptionDialogFile(filePath);
    setEncryptionDialogMode(mode);
    setEncryptionDialogOpen(true);
  }, []);
  const closeEncryptionDialog = useCallback(() => setEncryptionDialogOpen(false), []);

  // Secure Delete
  const [secureDeleteDialogOpen, setSecureDeleteDialogOpen] = useState(false);
  const [secureDeleteDialogFiles, setSecureDeleteDialogFiles] = useState<FileEntry[]>([]);
  const openSecureDeleteDialog = useCallback((files: FileEntry[]) => {
    setSecureDeleteDialogFiles(files);
    setSecureDeleteDialogOpen(true);
  }, []);
  const closeSecureDeleteDialog = useCallback(() => setSecureDeleteDialogOpen(false), []);

  // Version History
  const [versionHistoryDialogOpen, setVersionHistoryDialogOpen] = useState(false);
  const [versionHistoryDialogFile, setVersionHistoryDialogFile] = useState('');
  const openVersionHistoryDialog = useCallback((filePath: string) => {
    setVersionHistoryDialogFile(filePath);
    setVersionHistoryDialogOpen(true);
  }, []);
  const closeVersionHistoryDialog = useCallback(() => setVersionHistoryDialogOpen(false), []);

  // Batch Confirm
  const [batchConfirmDialogOpen, setBatchConfirmDialogOpen] = useState(false);
  const [batchConfirmDialogFiles, setBatchConfirmDialogFiles] = useState<FileEntry[]>([]);
  const [batchConfirmDialogOperation, setBatchConfirmDialogOperation] =
    useState<BatchOperationType>('delete');
  const [batchConfirmDialogDestination, setBatchConfirmDialogDestination] = useState<
    string | undefined
  >(undefined);
  const batchConfirmOnConfirmRef = useRef<(() => void) | null>(null);
  const openBatchConfirmDialog = useCallback(
    (
      operation: BatchOperationType,
      files: FileEntry[],
      onConfirm: () => void,
      destination?: string,
    ) => {
      setBatchConfirmDialogOperation(operation);
      setBatchConfirmDialogFiles(files);
      setBatchConfirmDialogDestination(destination);
      batchConfirmOnConfirmRef.current = onConfirm;
      setBatchConfirmDialogOpen(true);
    },
    [],
  );
  const closeBatchConfirmDialog = useCallback(() => {
    setBatchConfirmDialogOpen(false);
    batchConfirmOnConfirmRef.current = null;
  }, []);

  // Create Symlink
  const [symlinkDialogOpen, setSymlinkDialogOpen] = useState(false);
  const [symlinkDialogTarget, setSymlinkDialogTarget] = useState('');
  const openSymlinkDialog = useCallback((targetPath: string) => {
    setSymlinkDialogTarget(targetPath);
    setSymlinkDialogOpen(true);
  }, []);
  const closeSymlinkDialog = useCallback(() => setSymlinkDialogOpen(false), []);

  // Paste Rename
  const [pasteRenameDialogOpen, setPasteRenameDialogOpen] = useState(false);
  const [pasteRenameDialogFiles, setPasteRenameDialogFiles] = useState<FileEntry[]>([]);
  const openPasteRenameDialog = useCallback((files: FileEntry[]) => {
    setPasteRenameDialogFiles(files);
    setPasteRenameDialogOpen(true);
  }, []);
  const closePasteRenameDialog = useCallback(() => setPasteRenameDialogOpen(false), []);

  // Batch Metadata
  const [batchMetadataDialogOpen, setBatchMetadataDialogOpen] = useState(false);
  const [batchMetadataDialogFiles, setBatchMetadataDialogFiles] = useState<FileEntry[]>([]);
  const openBatchMetadataDialog = useCallback((files: FileEntry[]) => {
    setBatchMetadataDialogFiles(files);
    setBatchMetadataDialogOpen(true);
  }, []);
  const closeBatchMetadataDialog = useCallback(() => setBatchMetadataDialogOpen(false), []);

  // Move Tree Preview
  const [moveTreePreviewOpen, setMoveTreePreviewOpen] = useState(false);
  const [moveTreePreviewData, setMoveTreePreviewData] = useState<MoveTreePreviewData | null>(null);
  const moveTreePreviewOnConfirmRef = useRef<
    ((resolutions: Map<string, ConflictResolutionType>) => void) | null
  >(null);
  const openMoveTreePreview = useCallback(
    (
      data: MoveTreePreviewData,
      onConfirm: (resolutions: Map<string, ConflictResolutionType>) => void,
    ) => {
      setMoveTreePreviewData(data);
      moveTreePreviewOnConfirmRef.current = onConfirm;
      setMoveTreePreviewOpen(true);
    },
    [],
  );
  const closeMoveTreePreview = useCallback(() => {
    setMoveTreePreviewOpen(false);
    moveTreePreviewOnConfirmRef.current = null;
  }, []);

  // Advanced Select
  const [showAdvancedSelect, setShowAdvancedSelect] = useState(false);

  // Command Palette
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Workspace Layout dialog
  const [workspaceLayoutDialogOpen, setWorkspaceLayoutDialogOpen] = useState(false);

  // Path Bookmarks dialog
  const [pathBookmarksDialogOpen, setPathBookmarksDialogOpen] = useState(false);

  // Template Picker
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  // Folder Compare dialog
  const [folderCompareOpen, setFolderCompareOpen] = useState(false);
  const [folderComparePaths, setFolderComparePaths] = useState<{ left: string; right: string }>({
    left: '',
    right: '',
  });

  // Keyboard Shortcuts dialog
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);

  // Cross-tab batch operations dialog
  const [crossTabDialogOpen, setCrossTabDialogOpen] = useState(false);

  // Quick Look overlay
  const [quickLookFile, setQuickLookFile] = useState<FileEntry | null>(null);
  const handleQuickLook = useCallback((file: FileEntry) => {
    setQuickLookFile((prev) => (prev && prev.path === file.path ? null : file));
  }, []);

  // Collection editor dialog
  const [collectionEditorOpen, setCollectionEditorOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<FileCollection | null>(null);

  // Active collection filter
  const [activeCollectionFilter, setActiveCollectionFilter] = useState<FileCollection | null>(null);

  // Change summary toast
  const [showChangeSummaryToast, setShowChangeSummaryToast] = useState(false);

  // Expose dialog state setters on window for E2E testing
  // This is a no-op in production (no overhead beyond the property assignment)
  if (
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).__XPLORER_E2E__
  ) {
    (window as unknown as Record<string, unknown>).__dialogStates__ = {
      setCommandPaletteOpen,
      setWorkspaceLayoutDialogOpen,
      setPathBookmarksDialogOpen,
      setTemplatePickerOpen,
      setFolderCompareOpen,
      setFolderComparePaths,
      setShortcutsDialogOpen,
      setCrossTabDialogOpen,
      setCollectionEditorOpen,
    };
  }

  return {
    propertiesDialogOpen,
    propertiesDialogFile,
    openPropertiesDialog,
    closePropertiesDialog,
    openWithDialogOpen,
    openWithDialogFile,
    openWithDialogOnChoose: openWithOnChooseRef.current,
    openOpenWithDialog,
    closeOpenWithDialog,
    compressDialogOpen,
    compressDialogFiles,
    openCompressDialog,
    closeCompressDialog,
    bulkRenameDialogOpen,
    bulkRenameDialogFiles,
    openBulkRenameDialog,
    closeBulkRenameDialog,
    fileTagsDialogOpen,
    fileTagsDialogFile,
    openFileTagsDialog,
    closeFileTagsDialog,
    fileDetailsDialogOpen,
    fileDetailsDialogFile,
    fileDetailsDialogTab,
    openFileDetailsDialog,
    closeFileDetailsDialog,
    extractDialogOpen,
    extractDialogFile,
    openExtractDialog,
    closeExtractDialog,
    passwordPromptOpen,
    passwordPromptData,
    openPasswordPrompt,
    closePasswordPrompt,
    encryptionDialogOpen,
    encryptionDialogFile,
    encryptionDialogMode,
    openEncryptionDialog,
    closeEncryptionDialog,
    secureDeleteDialogOpen,
    secureDeleteDialogFiles,
    openSecureDeleteDialog,
    closeSecureDeleteDialog,
    versionHistoryDialogOpen,
    versionHistoryDialogFile,
    openVersionHistoryDialog,
    closeVersionHistoryDialog,
    batchConfirmDialogOpen,
    batchConfirmDialogFiles,
    batchConfirmDialogOperation,
    batchConfirmDialogDestination,
    batchConfirmDialogOnConfirm: batchConfirmOnConfirmRef.current,
    openBatchConfirmDialog,
    closeBatchConfirmDialog,
    symlinkDialogOpen,
    symlinkDialogTarget,
    openSymlinkDialog,
    closeSymlinkDialog,
    pasteRenameDialogOpen,
    pasteRenameDialogFiles,
    openPasteRenameDialog,
    closePasteRenameDialog,
    batchMetadataDialogOpen,
    batchMetadataDialogFiles,
    openBatchMetadataDialog,
    closeBatchMetadataDialog,
    moveTreePreviewOpen,
    moveTreePreviewData,
    moveTreePreviewOnConfirm: moveTreePreviewOnConfirmRef.current,
    openMoveTreePreview,
    closeMoveTreePreview,
    showAdvancedSelect,
    setShowAdvancedSelect,
    commandPaletteOpen,
    setCommandPaletteOpen,
    workspaceLayoutDialogOpen,
    setWorkspaceLayoutDialogOpen,
    pathBookmarksDialogOpen,
    setPathBookmarksDialogOpen,
    templatePickerOpen,
    setTemplatePickerOpen,
    folderCompareOpen,
    setFolderCompareOpen,
    folderComparePaths,
    setFolderComparePaths,
    shortcutsDialogOpen,
    setShortcutsDialogOpen,
    crossTabDialogOpen,
    setCrossTabDialogOpen,
    quickLookFile,
    setQuickLookFile,
    handleQuickLook,
    collectionEditorOpen,
    setCollectionEditorOpen,
    editingCollection,
    setEditingCollection,
    activeCollectionFilter,
    setActiveCollectionFilter,
    showChangeSummaryToast,
    setShowChangeSummaryToast,
  };
};
