import { transport } from '../transport';
import type { FileComparisonResult } from '../types';

export const compareFiles = async (
  file1Path: string,
  file2Path: string,
  options?: { ignoreWhitespace?: boolean; contextLines?: number },
): Promise<FileComparisonResult> => {
  return await transport('compare_files', {
    file1Path,
    file2Path,
    options: options || null,
  });
};
