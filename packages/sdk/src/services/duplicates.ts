import { transport } from '../transport';
import type { DuplicateFinderResult } from '../types';

export const findDuplicates = async (
  rootPath: string,
  minFileSize?: number,
  maxFileSize?: number,
  includeHidden?: boolean,
  fileExtensions?: string[],
  excludePaths?: string[],
): Promise<DuplicateFinderResult> => {
  return await transport('find_duplicates', {
    rootPath,
    minFileSize,
    maxFileSize,
    includeHidden,
    fileExtensions,
    excludePaths,
  });
};

export const deleteDuplicateFiles = async (filePaths: string[]): Promise<string[]> => {
  return await transport('delete_duplicate_files', { filePaths });
};

export const moveDuplicateFilesToTrash = async (filePaths: string[]): Promise<string[]> => {
  return await transport('move_duplicate_files_to_trash', { filePaths });
};

export const cancelDuplicateScan = async (): Promise<void> => {
  return await transport('cancel_duplicate_scan');
};
