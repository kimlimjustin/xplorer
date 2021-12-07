import { fs, invoke, } from "@tauri-apps/api"
import {
  copyFile as copyFileNative,
  renameFile as renameFileNative,
  removeDir as removeDirNative,
  removeFile as removeFileNative
} from '@tauri-apps/api/fs';
import { convertFileSrc } from "@tauri-apps/api/tauri";
import { Buffer } from "buffer";

import FileMetaData from "../Typings/fileMetaData";
import { TrashData, FileTrashMeta } from '../Typings/Store/files';

/**
 * Read text file
 * @returns {Promise<any>}
 */
export const readFile = async (fileName: string): Promise<string> => await fs.readTextFile(fileName);

export const readBuffer = async (fileName: string): Promise<Buffer> => {
  const fileContent = await fs.readBinaryFile(fileName);
  return Buffer.from(fileContent);
}

/**
 * Open file on default app
 * @returns {Promise<void>}
 */
export const openFile = async (fileName: string): Promise<void> => invoke('open_file', { filePath: fileName });

/**
 * Get tauri url of local assets
 * @returns {string}
 */
export const readAsset = (fileName: string): string => convertFileSrc(fileName);

/**
 * Read file and return as JSON
 * @returns {Promise<JSON>}
 */
export const readJSONFile = async (fileName: string): Promise<JSON> => {
  const fileContent = await readFile(fileName);
  return JSON.parse(fileContent);
}

/**
 * Create file if it doesn't exist
 * @returns {Promise<void>}
 */
export const createFile = async (fileName: string): Promise<void> => {
  await invoke('create_dir_recursive', { dirPath: fileName });
  return invoke('create_file', { filePath: fileName });
}

/**
 * Read properties of a file
 * @returns {Promise<FileMetaData>}
 */
export const fetchFileProperties = async (fileName: string): Promise<FileMetaData> => invoke<FileMetaData>('get_file_properties', { filePath: fileName });

/**
 * Check if given path is directory
 * @returns {Promise<boolean>}
 */
export const isDirectory = async (fileName: string): Promise<boolean> => invoke<boolean>('is_dir', { path: fileName });

/**
 * Extract icon of executable file
 * @returns {Promise<string>}
 */
export const extractIcon = async (fileName: string): Promise<string> => invoke<string>('extract_icon', { filePath: fileName });

/**
 * Calculate total size of given file paths
 * @returns {number} - Size in bytes
 */
export const calculateFileSize = async (fileName: string): Promise<number> => invoke<number>('calculate_files_total_size', { files: fileName });

/**
 * Rename file/dir
 * @returns {any}
 */
export const renameFile = async (fileName: string, dest: string): Promise<void> => renameFileNative(fileName, dest);

/**
 * Copy files/dirs
 * @returns {Promise<void>}
 */
export const copyFile = async (fileName: string, dest: string): Promise<void> => copyFileNative(fileName, dest);

/**
 * Copy and delete files/dirs
 * @returns {Promise<void>}
 */
export const cutFile = async (fileName: string, dest: string): Promise<void> => {
  copyFile(fileName, dest);
  removeFile(fileName);
}

/**
 * Deletes files/dirs
 * @returns {Promise<void>}
 */
export const removeFile = async (fileName: string): Promise<void> => {
  if (isDirectory(fileName)) return removeDirNative(fileName, { recursive: true });
  else return removeFileNative(fileName);
}

/**
 * Open file/dir in a specified application
 * @returns {any}
 */
export const revealFile = async (path: string, app: string): Promise<void> => {
  switch (app) {
    case 'vscode':
      return invoke('open_in_vscode', { path });
    case 'terminal':
      return invoke('open_in_terminal', { folderPath: path });
    default:
      return;
  }
}

/**
 * Get list of files in trash
 *
 * @returns {Promise<TrashData>}
 */
export const getTrashedFiles = async (): Promise<TrashData> => invoke<TrashData>('get_trashed_items');

/**
 * Move files/dirs to trash
 * @param {string} paths - Paths to be deleted
 * @returns {Promise<void>}
 */
export const deleteFiles = async (paths: string[]): Promise<void> => invoke('delete_file', { paths });

/**
 * Restore a file according with original parent and basename known
 * @param {string} original_parent
 * @param {string} basename
 * @returns {Promise<void>}
 */
export const restoreFile = async (originalParent: string, basename: string): Promise<void> => invoke('restore_trash', { originalParent, basename });

/**
 * Restore files/dirs from trash
 * @param {string[]} paths - Paths to be restored
 * @param force - Force restore
 * @returns {Promise<FileTrashMeta>} - Promise that resolves when files are restored
 */
export const restoreFiles = async (paths: string[], force = false): Promise<FileTrashMeta> => invoke<FileTrashMeta>('restore_files', { paths, force });

/**
 * Delete files/dirs from trash permanently
 * @param {string[]} paths
 * @returns {Promise<void>}
 */
export const purgeFiles = (paths: string[]): Promise<void> => invoke('purge_trashes', { paths });
