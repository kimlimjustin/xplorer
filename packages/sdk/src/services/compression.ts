import { transport } from '../transport';
import type {
  CompressionOptions,
  CompressionInfo,
  ExtractionOptions,
  ArchiveInfo,
} from '../types';

export const compressFiles = async (
  filePaths: string[],
  outputPath: string,
  options: CompressionOptions,
): Promise<string> => {
  return await transport('compress_files', { filePaths, outputPath, options });
};

export const getCompressionInfo = async (filePaths: string[]): Promise<CompressionInfo> => {
  return await transport('get_compression_info', { filePaths });
};

export const extractArchive = async (archivePath: string, options: ExtractionOptions): Promise<string> => {
  return await transport('extract_archive', { archivePath, options });
};

export const getArchiveInfo = async (archivePath: string): Promise<ArchiveInfo> => {
  return await transport('get_archive_info', { archivePath });
};

export const extractSelectedEntries = async (
  archivePath: string,
  entries: string[],
  outputDir: string,
  overwrite: boolean,
): Promise<string> => {
  return await transport('extract_selected_entries', { archivePath, entries, outputDir, overwrite });
};

export const isArchive = async (filePath: string): Promise<boolean> => {
  return await transport('is_archive', { filePath });
};
