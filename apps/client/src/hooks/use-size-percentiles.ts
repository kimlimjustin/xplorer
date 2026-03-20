import { useMemo } from 'react';
import type { FileEntry } from '@/lib/tauri-api';

export interface SizePercentileInfo {
  percentile: number;
  color: string;
  label: string;
}

/**
 * Calculates the size percentile of each file relative to all files
 * in the current directory, returning color-coded badge info.
 *
 * Color mapping:
 *   Top 10% (>=90th percentile) -> red (#ef4444) "Largest"
 *   Top 25% (>=75th)            -> orange (#f97316) "Large"
 *   Top 50% (>=50th)            -> yellow (#eab308) "Medium"
 *   Bottom 50%                  -> green (#22c55e) "Small"
 *   Directories without size    -> gray (#6b7280) (no label)
 */
export const useSizePercentiles = (files: FileEntry[]) : Map<string, SizePercentileInfo> => {
  // Memoize keyed on file count + total size to avoid recalculating
  // when nothing meaningful changed
  const fileCount = files.length;
  const totalSize = useMemo(() => files.reduce((sum, f) => sum + (f.size || 0), 0), [files]);

  return useMemo(() => {
    const result = new Map<string, SizePercentileInfo>();

    if (fileCount === 0) return result;

    // Collect sizes of files that have a valid size (> 0, not dir without size)
    const fileSizes: { path: string; size: number; isDir: boolean }[] = [];

    for (const file of files) {
      if (file.is_dir) {
        // Directories get a gray badge (no computed size)
        result.set(file.path, {
          percentile: -1,
          color: '#6b7280',
          label: 'Folder',
        });
      } else if (file.size > 0) {
        fileSizes.push({ path: file.path, size: file.size, isDir: false });
      } else {
        // Zero-size file
        result.set(file.path, {
          percentile: 0,
          color: '#22c55e',
          label: 'Small',
        });
      }
    }

    if (fileSizes.length === 0) return result;

    // Sort ascending by size to compute percentiles
    const sorted = [...fileSizes].sort((a, b) => a.size - b.size);
    const count = sorted.length;

    for (let i = 0; i < count; i++) {
      // Percentile: fraction of files that are smaller or equal
      const percentile = ((i + 1) / count) * 100;

      let color: string;
      let label: string;

      if (percentile >= 90) {
        color = '#ef4444'; // red
        label = 'Largest';
      } else if (percentile >= 75) {
        color = '#f97316'; // orange
        label = 'Large';
      } else if (percentile >= 50) {
        color = '#eab308'; // yellow
        label = 'Medium';
      } else {
        color = '#22c55e'; // green
        label = 'Small';
      }

      result.set(sorted[i].path, { percentile, color, label });
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileCount, totalSize, files]);
}
