import { transport, listenToEvent } from '../transport';
import type {
  FileEntry,
  FileProperties,
  DetailedFileProperties,
  DirectorySize,
  TrashItem,
  BulkRenameResult,
  FolderSizeInfo,
  FileAssociation,
  Application,
  FileOperationProgress,
  ConflictInfo,
} from '../types';

export const readDirectory = async (path: string): Promise<FileEntry[]> => {
  return await transport('read_directory', { path });
};

export const getFileProperties = async (path: string): Promise<FileProperties> => {
  return await transport('get_file_properties', { path });
};

export const getFileMetaData = async (path: string): Promise<FileProperties> => {
  return await transport('get_file_meta_data', { path });
};

export const getDetailedFileProperties = async (filePath: string): Promise<DetailedFileProperties> => {
  return await transport('get_detailed_file_properties', { filePath });
};

export const getDirectorySize = async (dirPath: string): Promise<number> => {
  return await transport('get_directory_size', { dirPath });
};

export const getDirectoryItemCount = async (dirPath: string): Promise<number> => {
  return await transport('get_directory_item_count', { dirPath });
};

export const setFilePermissions = async (filePath: string, permissions: string): Promise<void> => {
  return await transport('set_file_permissions', { filePath, permissions });
};

export const isDir = async (path: string): Promise<boolean> => {
  return await transport('is_dir', { path });
};

export const getFilesInDirectory = async (path: string): Promise<FileEntry[]> => {
  return await transport('get_files_in_directory', { path });
};

export const fileExists = async (path: string): Promise<boolean> => {
  return await transport('file_exist', { path });
};

export const createDirRecursive = async (path: string): Promise<void> => {
  return await transport('create_dir_recursive', { path });
};

export const createFile = async (path: string): Promise<void> => {
  return await transport('create_file', { path });
};

export const openFile = async (path: string): Promise<void> => {
  return await transport('open_file', { path });
};

export const getDirSize = async (path: string): Promise<DirectorySize> => {
  return await transport('get_dir_size', { path });
};

export const readTextFile = async (path: string): Promise<string> => {
  return await transport('read_text_file', { path });
};

export const readBinaryFile = async (path: string): Promise<Uint8Array> => {
  const data = await transport('read_binary_file', { path });
  return new Uint8Array(data as number[]);
};

export const showInFolder = async (path: string): Promise<void> => {
  return await transport('show_in_folder', { path });
};

export const copy = async (source: string, destination: string): Promise<void> => {
  return await transport('copy', { source, destination });
};

export const moveFile = async (source: string, destination: string): Promise<void> => {
  return await transport('move_file', { source, destination });
};

export const rename = async (oldPath: string, newPath: string): Promise<void> => {
  return await transport('rename', { oldPath, newPath });
};

export const bulkRename = async (
  files: string[],
  pattern: string,
  replacement: string,
  previewOnly: boolean,
): Promise<BulkRenameResult[]> => {
  return await transport('bulk_rename', { files, pattern, replacement, previewOnly });
};

export const removeDir = async (path: string): Promise<void> => {
  return await transport('remove_dir', { path });
};

export const removeFile = async (path: string): Promise<void> => {
  return await transport('remove_file', { path });
};

export const copyWithProgress = async (source: string, destination: string): Promise<string> => {
  return await transport('copy_with_progress', { source, destination });
};

export const moveWithProgress = async (source: string, destination: string): Promise<string> => {
  return await transport('move_with_progress', { source, destination });
};

export const acceleratedCopyFile = async (source: string, destination: string): Promise<string> => {
  return await transport('accelerated_copy_file', { source, destination });
};

export const acceleratedCopyDirectory = async (source: string, destination: string): Promise<string> => {
  return await transport('accelerated_copy_directory', { source, destination });
};

export const computeFileHash = async (path: string, algorithm: string = 'sha256'): Promise<string> => {
  return await transport('compute_file_hash', { path, algorithm });
};

export const getFileAssociations = async (filePath: string): Promise<FileAssociation> => {
  return await transport('get_file_associations', { filePath });
};

export const openFileWithApplication = async (filePath: string, appPath: string): Promise<void> => {
  return await transport('open_file_with_application', { filePath, appPath });
};

export const getSystemApplications = async (): Promise<Application[]> => {
  return await transport('get_system_applications');
};

export const setDefaultApplication = async (fileExtension: string, appPath: string): Promise<void> => {
  return await transport('set_default_application', { fileExtension, appPath });
};

export const startWatching = async (path: string): Promise<void> => {
  return await transport('start_watching', { path });
};

export const stopWatching = async (): Promise<void> => {
  return await transport('stop_watching');
};

export interface FileChangeEvent {
  watcher_id: string;
  path: string;
  event_type: string;
  timestamp: number;
}

export interface WatcherInfo {
  id: string;
  path: string;
  recursive: boolean;
}

export const watchDirectory = async (path: string, recursive: boolean = false): Promise<string> => {
  return await transport('watch_directory', { path, recursive });
};

export const unwatchDirectory = async (watcherId: string): Promise<void> => {
  return await transport('unwatch_directory', { watcherId });
};

export const getActiveWatchers = async (): Promise<WatcherInfo[]> => {
  return await transport('get_active_watchers');
};

export const listenToFileCreated = (
  callback: (event: FileChangeEvent) => void,
): Promise<() => void> => {
  return listenToEvent<FileChangeEvent>('file-created', callback);
};

export const listenToFileModified = (
  callback: (event: FileChangeEvent) => void,
): Promise<() => void> => {
  return listenToEvent<FileChangeEvent>('file-modified', callback);
};

export const listenToFileDeleted = (
  callback: (event: FileChangeEvent) => void,
): Promise<() => void> => {
  return listenToEvent<FileChangeEvent>('file-deleted', callback);
};

export const listenToFileRenamed = (
  callback: (event: FileChangeEvent) => void,
): Promise<() => void> => {
  return listenToEvent<FileChangeEvent>('file-renamed', callback);
};

export const listenToFsChange = (
  callback: (event: FileChangeEvent) => void,
): Promise<() => void> => {
  return listenToEvent<FileChangeEvent>('fs-change', callback);
};

export const getFileTemplates = async (): Promise<
  { id: string; name: string; default_filename: string; extension: string; description: string }[]
> => {
  return await transport('get_file_templates');
};

export const createFromTemplate = async (
  directory: string,
  templateId: string,
  filename: string,
): Promise<string> => {
  return await transport('create_from_template', { directory, templateId, filename });
};

export const undoOperation = async (): Promise<{ success: boolean; message: string; operation_type: string }> => {
  return await transport('undo_operation');
};

export const redoOperation = async (): Promise<{ success: boolean; message: string; operation_type: string }> => {
  return await transport('redo_operation');
};

export interface FileOperationRecord {
  Copy?: { source: string; destination: string };
  Move?: { source: string; destination: string };
  Rename?: { path: string; old_name: string; new_name: string };
  Delete?: { path: string; trash_path: string | null };
  CreateFile?: { path: string };
  CreateFolder?: { path: string };
}

export interface UndoRedoState {
  can_undo: boolean;
  can_redo: boolean;
  undo_description: string | null;
  redo_description: string | null;
}

export const recordFileOperation = async (operation: FileOperationRecord, description: string): Promise<void> => {
  return await transport('record_file_operation', { operation, description });
};

export const getUndoRedoState = async (): Promise<UndoRedoState> => {
  return await transport('get_undo_redo_state');
};

export const moveToTrash = async (path: string): Promise<void> => {
  return await transport('move_to_trash', { path });
};

export const openRecycleBin = async (): Promise<void> => {
  return await transport('open_recycle_bin');
};

export const getTrashItems = async (): Promise<TrashItem[]> => {
  return await transport('get_trash_items');
};

export const restoreFromTrash = async (itemPath: string): Promise<string> => {
  return await transport('restore_trash_item', { itemPath });
};

export const emptyTrash = async (): Promise<number> => {
  return await transport('empty_recycle_bin');
};

export const permanentlyDeleteFromTrash = async (itemPath: string): Promise<void> => {
  return await transport('permanently_delete_trash_item', { itemPath });
};

export const calculateFolderSize = async (folderPath: string): Promise<FolderSizeInfo> => {
  return await transport('calculate_folder_size', { folderPath });
};

export const getCachedFolderSizes = async (folderPaths: string[]): Promise<Record<string, FolderSizeInfo>> => {
  return await transport('get_cached_folder_sizes', { folderPaths });
};

export const clearFolderSizeCache = async (): Promise<void> => {
  return await transport('clear_folder_size_cache');
};

export const getDirectorySizes = async (
  dirPath: string,
): Promise<{ name: string; path: string; size: number; is_dir: boolean; children_count: number }[]> => {
  return await transport('get_directory_sizes', { dirPath });
};

export const checkConflicts = async (
  sources: string[],
  destinationDir: string,
): Promise<ConflictInfo[]> => {
  return await transport('check_conflicts', { sources, destinationDir });
};

export const getRenameDest = async (
  destinationDir: string,
  fileName: string,
): Promise<string> => {
  return await transport('get_rename_destination', { destinationDir, fileName });
};

export const listenToFileOperationProgress = (
  callback: (progress: FileOperationProgress) => void,
): Promise<() => void> => {
  return listenToEvent<FileOperationProgress>('file-operation-progress', callback);
};

export const encryptFile = async (path: string, password: string): Promise<string> => {
  return await transport('encrypt_file', { path, password });
};

export const decryptFile = async (path: string, password: string): Promise<string> => {
  return await transport('decrypt_file', { path, password });
};

export const isEncryptedFile = async (path: string): Promise<boolean> => {
  return await transport('is_encrypted_file', { path });
};

export interface SecureDeleteResult {
  files_deleted: number;
  errors: string[];
  passes: number;
}

export const secureDelete = async (
  paths: string[],
  passes: number = 3,
): Promise<SecureDeleteResult> => {
  return await transport('secure_delete', { paths, passes });
};

export interface SecureDeleteProgressEvent {
  file: string;
  pass: number;
  total_passes: number;
  pass_label: string;
  bytes_written: number;
  file_size: number;
}

export const listenToSecureDeleteProgress = (
  callback: (event: SecureDeleteProgressEvent) => void,
): Promise<() => void> => {
  return listenToEvent<SecureDeleteProgressEvent>('secure-delete-progress', callback);
};
