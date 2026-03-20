import { FileEntry } from '@/lib/tauri-api';
import { SelectionCriteria, SelectionResult } from './types';

/**
 * Apply selection criteria to a list of files
 */
export const applySelectionCriteria = (
  files: FileEntry[],
  criteria: SelectionCriteria,
  currentSelection: Set<string>,
) : SelectionResult => {
  let matched: string[] = [];

  switch (criteria.type) {
    case 'extension':
      matched = selectByExtension(files, criteria.extensions || []);
      break;

    case 'dateRange':
      matched = selectByDateRange(files, criteria.dateFrom, criteria.dateTo);
      break;

    case 'sizeRange':
      matched = selectBySizeRange(files, criteria.minSize, criteria.maxSize);
      break;

    case 'similar':
      if (criteria.similarTo) {
        matched = selectSimilar(files, criteria.similarTo);
      }
      break;

    case 'invert':
      matched = invertSelection(files, currentSelection);
      break;

    case 'pattern':
      if (criteria.pattern) {
        matched = selectByPattern(files, criteria.pattern);
      }
      break;
  }

  return {
    matched,
    total: files.length,
  };
}

/**
 * Select files by extension
 */
export const selectByExtension = (files: FileEntry[], extensions: string[]) : string[] => {
  const normalizedExtensions = extensions.map((ext) => ext.toLowerCase().replace(/^\./, ''));

  return files
    .filter((file) => {
      if (file.is_dir) return false;
      const fileExt = getFileExtension(file.name).toLowerCase();
      return normalizedExtensions.includes(fileExt);
    })
    .map((file) => file.path);
}

/**
 * Select files by date range
 */
export const selectByDateRange = (files: FileEntry[], dateFrom?: Date, dateTo?: Date) : string[] => {
  return files
    .filter((file) => {
      const fileDate = new Date(file.modified * 1000); // Convert Unix timestamp to Date

      if (dateFrom && fileDate < dateFrom) return false;
      if (dateTo && fileDate > dateTo) return false;

      return true;
    })
    .map((file) => file.path);
}

/**
 * Select files by size range
 */
export const selectBySizeRange = (
  files: FileEntry[],
  minSize?: number,
  maxSize?: number,
) : string[] => {
  return files
    .filter((file) => {
      if (file.is_dir) return false;

      if (minSize !== undefined && file.size < minSize) return false;
      if (maxSize !== undefined && maxSize !== Infinity && file.size > maxSize) return false;

      return true;
    })
    .map((file) => file.path);
}

/**
 * Select files similar to a reference file
 * Similarity is determined by: same extension, similar size (within 50%), or same type
 */
export const selectSimilar = (files: FileEntry[], referenceFile: FileEntry) : string[] => {
  const refExtension = getFileExtension(referenceFile.name).toLowerCase();
  const refSize = referenceFile.size;
  const refType = referenceFile.file_type;
  const sizeThreshold = 0.5; // 50% size tolerance

  return files
    .filter((file) => {
      // Skip the reference file itself
      if (file.path === referenceFile.path) return false;

      // Skip if comparing file to directory or vice versa
      if (file.is_dir !== referenceFile.is_dir) return false;

      // For directories, match by type
      if (file.is_dir) {
        return file.file_type === refType;
      }

      // For files, check multiple criteria
      const fileExt = getFileExtension(file.name).toLowerCase();

      // Same extension is a strong match
      if (fileExt === refExtension) return true;

      // Same file type category
      if (file.file_type === refType) return true;

      // Similar size (within threshold)
      if (refSize > 0) {
        const sizeDiff = Math.abs(file.size - refSize) / refSize;
        if (sizeDiff <= sizeThreshold) return true;
      }

      return false;
    })
    .map((file) => file.path);
}

/**
 * Invert current selection
 */
export const invertSelection = (files: FileEntry[], currentSelection: Set<string>) : string[] => {
  return files.filter((file) => !currentSelection.has(file.path)).map((file) => file.path);
}

/**
 * Select files by name pattern (glob-like)
 */
export const selectByPattern = (files: FileEntry[], pattern: string) : string[] => {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except * and ?
    .replace(/\*/g, '.*') // * matches any characters
    .replace(/\?/g, '.'); // ? matches single character

  const regex = new RegExp(`^${regexPattern}$`, 'i');

  return files.filter((file) => regex.test(file.name)).map((file) => file.path);
}

/**
 * Get all unique extensions from files
 */
export const getUniqueExtensions = (files: FileEntry[]) : string[] => {
  const extensions = new Set<string>();

  files.forEach((file) => {
    if (!file.is_dir) {
      const ext = getFileExtension(file.name).toLowerCase();
      if (ext) {
        extensions.add(ext);
      }
    }
  });

  return Array.from(extensions).sort();
}

/**
 * Get file size statistics
 */
export const getFileSizeStats = (files: FileEntry[]): {
  min: number;
  max: number;
  avg: number;
  total: number;
} => {
  const fileSizes = files.filter((f) => !f.is_dir).map((f) => f.size);

  if (fileSizes.length === 0) {
    return { min: 0, max: 0, avg: 0, total: 0 };
  }

  return {
    min: Math.min(...fileSizes),
    max: Math.max(...fileSizes),
    avg: fileSizes.reduce((a, b) => a + b, 0) / fileSizes.length,
    total: fileSizes.reduce((a, b) => a + b, 0),
  };
}

/**
 * Get date range of files
 */
export const getFileDateRange = (files: FileEntry[]): {
  oldest: Date;
  newest: Date;
} => {
  const dates = files.map((f) => f.modified * 1000);

  if (dates.length === 0) {
    const now = new Date();
    return { oldest: now, newest: now };
  }

  return {
    oldest: new Date(Math.min(...dates)),
    newest: new Date(Math.max(...dates)),
  };
}

/**
 * Helper: Get file extension
 */
const getFileExtension = (filename: string) : string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return '';
  return filename.substring(lastDot + 1);
}

/**
 * Count files by extension
 */
export const countByExtension = (files: FileEntry[]) : Map<string, number> => {
  const counts = new Map<string, number>();

  files.forEach((file) => {
    if (!file.is_dir) {
      const ext = getFileExtension(file.name).toLowerCase() || '(no extension)';
      counts.set(ext, (counts.get(ext) || 0) + 1);
    }
  });

  return counts;
}
