import { transport, listenToEvent as transportListen } from '../transport';
import type {
  FileEntry,
  FileProperties,
  DetailedFileProperties,
  FileAssociation,
  Application,
  CompressionOptions,
  CompressionInfo,
  ExtractionOptions,
  ArchiveInfo,
  BulkRenameResult,
  TrashItem,
  FolderSizeInfo,
  DuplicateFinderResult,
  FileComparisonResult,
  OrganizationAnalysis,
  OrganizationPlan,
  ImageOperations,
  ImageInfo,
  BatchImageResult,
  RecentFile,
  FileOperationProgress,
  ConflictInfo,
  DirectorySize,
} from '../tauri-api-types';

// ── File read / metadata ────────────────────────────────────────────────────

export const readDirectory = async (path: string): Promise<FileEntry[]> =>
  await transport('read_directory', { path });

export const getFileProperties = async (path: string): Promise<FileProperties> =>
  await transport('get_file_properties', { path });

export const getFileMetaData = async (path: string): Promise<FileProperties> =>
  await transport('get_file_meta_data', { path });

export const getDetailedFileProperties = async (
  filePath: string,
): Promise<DetailedFileProperties> => await transport('get_detailed_file_properties', { filePath });

export const getDirectorySize = async (dirPath: string): Promise<number> =>
  await transport('get_directory_size', { dirPath });

export const getDirectoryItemCount = async (dirPath: string): Promise<number> =>
  await transport('get_directory_item_count', { dirPath });

export const setFilePermissions = async (filePath: string, permissions: string): Promise<void> =>
  await transport('set_file_permissions', { filePath, permissions });

// ── File association operations ─────────────────────────────────────────────

export const getFileAssociations = async (filePath: string): Promise<FileAssociation> =>
  await transport('get_file_associations', { filePath });

export const openFileWithApplication = async (filePath: string, appPath: string): Promise<void> =>
  await transport('open_file_with_application', { filePath, appPath });

export const getSystemApplications = async (): Promise<Application[]> =>
  await transport('get_system_applications');

export const setDefaultApplication = async (
  fileExtension: string,
  appPath: string,
): Promise<void> => await transport('set_default_application', { fileExtension, appPath });

// ── Compression operations ──────────────────────────────────────────────────

export const compressFiles = async (
  filePaths: string[],
  outputPath: string,
  options: CompressionOptions,
): Promise<string> => await transport('compress_files', { filePaths, outputPath, options });

export const getCompressionInfo = async (filePaths: string[]): Promise<CompressionInfo> =>
  await transport('get_compression_info', { filePaths });

// ── Extraction operations ───────────────────────────────────────────────────

export const extractArchive = async (
  archivePath: string,
  options: ExtractionOptions,
): Promise<string> => await transport('extract_archive', { archivePath, options });

export const getArchiveInfo = async (archivePath: string): Promise<ArchiveInfo> =>
  await transport('get_archive_info', { archivePath });

export const extractSelectedEntries = async (
  archivePath: string,
  entries: string[],
  outputDir: string,
  overwrite: boolean,
): Promise<string> =>
  await transport('extract_selected_entries', {
    archivePath,
    entries,
    outputDir,
    overwrite,
  });

export const isArchive = async (filePath: string): Promise<boolean> =>
  await transport('is_archive', { filePath });

// ── Encryption operations ───────────────────────────────────────────────────

export const encryptFile = async (path: string, password: string): Promise<string> =>
  await transport('encrypt_file', { path, password });

export const decryptFile = async (path: string, password: string): Promise<string> =>
  await transport('decrypt_file', { path, password });

export const isEncryptedFile = async (path: string): Promise<boolean> =>
  await transport('is_encrypted_file', { path });

export const secureDelete = async (
  paths: string[],
  passes: number = 3,
): Promise<{ files_deleted: number; errors: string[]; passes: number }> =>
  await transport('secure_delete', { paths, passes });

// ── Copy / Move / Rename / Delete ───────────────────────────────────────────

export const copy = async (source: string, destination: string): Promise<void> =>
  await transport('copy', { source, destination });

export const moveFile = async (source: string, destination: string): Promise<void> =>
  await transport('move_file', { source, destination });

export const rename = async (oldPath: string, newPath: string): Promise<void> =>
  await transport('rename', { oldPath, newPath });

export const bulkRename = async (
  files: string[],
  pattern: string,
  replacement: string,
  previewOnly: boolean,
): Promise<BulkRenameResult[]> =>
  await transport('bulk_rename', { files, pattern, replacement, previewOnly });

export const removeDir = async (path: string): Promise<void> =>
  await transport('remove_dir', { path });

export const removeFile = async (path: string): Promise<void> =>
  await transport('remove_file', { path });

// ── Trash / Recycle Bin ─────────────────────────────────────────────────────

export const moveToTrash = async (path: string): Promise<void> =>
  await transport('move_to_trash', { path });

export const openRecycleBin = async (): Promise<void> => await transport('open_recycle_bin');

export const getTrashItems = async (): Promise<TrashItem[]> => await transport('get_trash_items');

export const restoreFromTrash = async (itemPath: string): Promise<string> =>
  await transport('restore_trash_item', { itemPath });

export const emptyTrash = async (): Promise<number> => await transport('empty_recycle_bin');

export const permanentlyDeleteFromTrash = async (itemPath: string): Promise<void> =>
  await transport('permanently_delete_trash_item', { itemPath });

// ── Directory / file helpers ────────────────────────────────────────────────

export const isDir = async (path: string): Promise<boolean> => await transport('is_dir', { path });

export const getFilesInDirectory = async (path: string): Promise<FileEntry[]> =>
  await transport('get_files_in_directory', { path });

export const openFile = async (path: string): Promise<void> =>
  await transport('open_file', { path });

export const fileExists = async (path: string): Promise<boolean> =>
  await transport('file_exist', { path });

export const createDirRecursive = async (path: string): Promise<void> =>
  await transport('create_dir_recursive', { path });

export const createFile = async (path: string): Promise<void> =>
  await transport('create_file', { path });

export const createFileWithContent = async (path: string, content: string): Promise<void> =>
  await transport('create_file_with_content', { path, content });

export const createSymlink = async (target: string, linkPath: string): Promise<void> =>
  await transport('create_symlink', { target, link_path: linkPath });

export const getDirSize = async (path: string): Promise<DirectorySize> =>
  await transport('get_dir_size', { path });

export const readTextFile = async (path: string): Promise<string> =>
  await transport('read_text_file', { path });

export const readBinaryFile = async (path: string): Promise<Uint8Array> => {
  const data = await transport('read_binary_file', { path });
  return new Uint8Array(data as number[]);
};

// ── Folder size operations ──────────────────────────────────────────────────

export const calculateFolderSize = async (folderPath: string): Promise<FolderSizeInfo> =>
  await transport('calculate_folder_size', { folderPath });

export const getCachedFolderSizes = async (
  folderPaths: string[],
): Promise<Record<string, FolderSizeInfo>> =>
  await transport('get_cached_folder_sizes', { folderPaths });

export const clearFolderSizeCache = async (): Promise<void> =>
  await transport('clear_folder_size_cache');

// ── Undo / Redo ─────────────────────────────────────────────────────────────

export const undoOperation = async (): Promise<{
  success: boolean;
  message: string;
  operation_type: string;
}> => await transport('undo_operation');

export const redoOperation = async (): Promise<{
  success: boolean;
  message: string;
  operation_type: string;
}> => await transport('redo_operation');

export const getUndoHistory = async (): Promise<{
  entries: {
    index: number;
    operation_type: string;
    description: string;
    undoable: boolean;
    timestamp_ms: number;
    source_path: string | null;
    dest_path: string | null;
  }[];
  undo_count: number;
}> => await transport('get_undo_history');

export const clearUndoHistory = async (): Promise<void> => await transport('clear_undo_history');

// ── File templates ──────────────────────────────────────────────────────────

export const getFileTemplates = async (): Promise<
  { id: string; name: string; default_filename: string; extension: string; description: string }[]
> => await transport('get_file_templates');

export const createFromTemplate = async (
  directory: string,
  templateId: string,
  filename: string,
): Promise<string> => await transport('create_from_template', { directory, templateId, filename });

// ── Disk usage ──────────────────────────────────────────────────────────────

export const getDirectorySizes = async (
  dirPath: string,
): Promise<
  { name: string; path: string; size: number; is_dir: boolean; children_count: number }[]
> => await transport('get_directory_sizes', { dirPath });

// ── Conflict checking ───────────────────────────────────────────────────────

export const checkConflicts = async (
  sources: string[],
  destinationDir: string,
): Promise<ConflictInfo[]> => await transport('check_conflicts', { sources, destinationDir });

export const getRenameDest = async (destinationDir: string, fileName: string): Promise<string> =>
  await transport('get_rename_destination', { destinationDir, fileName });

export const showInFolder = async (path: string): Promise<void> =>
  await transport('show_in_folder', { path });

// ── Progress-aware file operations ──────────────────────────────────────────

export const copyWithProgress = async (source: string, destination: string): Promise<string> =>
  await transport('copy_with_progress', { source, destination });

export const moveWithProgress = async (source: string, destination: string): Promise<string> =>
  await transport('move_with_progress', { source, destination });

// ── Hardware-Accelerated file operations ────────────────────────────────────

export const acceleratedCopyFile = async (source: string, destination: string): Promise<string> =>
  await transport('accelerated_copy_file', { source, destination });

export const acceleratedCopyDirectory = async (
  source: string,
  destination: string,
): Promise<string> => await transport('accelerated_copy_directory', { source, destination });

// ── Progress monitoring ─────────────────────────────────────────────────────

export const listenToFileOperationProgress = async (
  callback: (progress: FileOperationProgress) => void,
): Promise<() => void> =>
  transportListen<FileOperationProgress>('file-operation-progress', callback);

// ── File comparison ─────────────────────────────────────────────────────────

export const computeFileHash = async (
  path: string,
  algorithm: string = 'sha256',
): Promise<string> => await transport('compute_file_hash', { path, algorithm });

export const compareFiles = async (
  file1Path: string,
  file2Path: string,
  options?: { ignoreWhitespace?: boolean; contextLines?: number },
): Promise<FileComparisonResult> =>
  await transport('compare_files', {
    file1Path,
    file2Path,
    options: options || null,
  });

// ── Duplicate finder ────────────────────────────────────────────────────────

export const findDuplicates = async (
  rootPath: string,
  minFileSize?: number,
  maxFileSize?: number,
  includeHidden?: boolean,
  fileExtensions?: string[],
  excludePaths?: string[],
): Promise<DuplicateFinderResult> =>
  await transport('find_duplicates', {
    rootPath,
    minFileSize,
    maxFileSize,
    includeHidden,
    fileExtensions,
    excludePaths,
  });

export const deleteDuplicateFiles = async (filePaths: string[]): Promise<string[]> =>
  await transport('delete_duplicate_files', { filePaths });

export const moveDuplicateFilesToTrash = async (filePaths: string[]): Promise<string[]> =>
  await transport('move_duplicate_files_to_trash', { filePaths });

export const cancelDuplicateScan = async (): Promise<void> =>
  await transport('cancel_duplicate_scan');

// ── File Organizer ──────────────────────────────────────────────────────────

export const analyzeDirectory = async (path: string): Promise<OrganizationAnalysis> =>
  await transport('analyze_directory', { path });

export const previewOrganization = async (
  path: string,
  suggestionIndices: number[],
): Promise<OrganizationPlan> =>
  await transport('preview_organization', { path, suggestionIndices });

export const executeOrganization = async (plan: OrganizationPlan): Promise<number> =>
  await transport('execute_organization', { plan });

// ── Recent files ────────────────────────────────────────────────────────────

export const addRecentFile = async (path: string): Promise<void> =>
  await transport('add_recent_file', { path });

export const getRecentFiles = async (limit?: number): Promise<RecentFile[]> =>
  await transport('get_recent_files', { limit: limit ?? null });

export const clearRecentFiles = async (): Promise<void> => await transport('clear_recent_files');

export const removeRecentFile = async (path: string): Promise<void> =>
  await transport('remove_recent_file', { path });

// ── Image processing ────────────────────────────────────────────────────────

export const resizeImage = async (
  path: string,
  width: number,
  height: number,
  maintainAspect: boolean,
  outputPath: string,
): Promise<string> =>
  await transport('resize_image', { path, width, height, maintainAspect, outputPath });

export const convertImage = async (
  path: string,
  outputFormat: string,
  quality: number,
  outputPath: string,
): Promise<string> => await transport('convert_image', { path, outputFormat, quality, outputPath });

export const getImageInfo = async (path: string): Promise<ImageInfo> =>
  await transport('get_image_info', { path });

export const batchProcessImages = async (
  paths: string[],
  operations: ImageOperations,
  outputDir: string,
): Promise<BatchImageResult[]> =>
  await transport('batch_process_images', { paths, operations, outputDir });

export const rotateImage = async (
  path: string,
  degrees: number,
  outputPath: string,
): Promise<string> => await transport('rotate_image', { path, degrees, outputPath });

export const flipImage = async (
  path: string,
  direction: string,
  outputPath: string,
): Promise<string> => await transport('flip_image', { path, direction, outputPath });

export const cropImage = async (
  path: string,
  x: number,
  y: number,
  width: number,
  height: number,
  outputPath: string,
): Promise<string> => await transport('crop_image', { path, x, y, width, height, outputPath });

export const adjustBrightness = async (
  path: string,
  value: number,
  outputPath: string,
): Promise<string> => await transport('adjust_brightness', { path, value, outputPath });

export const adjustContrast = async (
  path: string,
  value: number,
  outputPath: string,
): Promise<string> => await transport('adjust_contrast', { path, value, outputPath });

export const grayscaleImage = async (path: string, outputPath: string): Promise<string> =>
  await transport('grayscale_image', { path, outputPath });

// ── File watcher operations ─────────────────────────────────────────────────

export const startWatching = async (path: string): Promise<void> =>
  await transport('start_watching', { path });

export const stopWatching = async (): Promise<void> => await transport('stop_watching');

export const watchDirectory = async (path: string, recursive: boolean = false): Promise<string> =>
  await transport('watch_directory', { path, recursive });

export const unwatchDirectory = async (watcherId: string): Promise<void> =>
  await transport('unwatch_directory', { watcherId });

export const getActiveWatchers = async (): Promise<
  Array<{ id: string; path: string; recursive: boolean }>
> => await transport('get_active_watchers');

// ── Open dialog ─────────────────────────────────────────────────────────────

export const showOpenDialog = async (options: {
  multiple?: boolean;
  directory?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<string[] | null> => {
  try {
    // Use Tauri dialog plugin
    const { open } = await import('@tauri-apps/plugin-dialog');

    const result = await open({
      multiple: options.multiple || false,
      directory: options.directory || false,
      filters: options.filters || [],
    });

    if (result === null) return null;

    return Array.isArray(result) ? result : [result];
  } catch (error) {
    console.error('Error opening dialog:', error);
    return null;
  }
};
