import { useState, useEffect, useCallback } from 'react';
import { TauriAPI, type FileEntry, type FolderSizeInfo } from '@/lib/tauri-api';

interface FolderSizeState {
  folderSizes: Record<string, FolderSizeInfo>;
  isCalculating: Set<string>;
  errors: Record<string, string | undefined>;
}

export const useFolderSizes = (files: FileEntry[]) => {
  const [state, setState] = useState<FolderSizeState>({
    folderSizes: {},
    isCalculating: new Set(),
    errors: {},
  });

  // Get folder paths from files
  const folderPaths = files.filter((file) => file.is_dir).map((file) => file.path);
  const folderPathsKey = folderPaths.join(',');

  // Load cached folder sizes on mount or when folder paths change
  useEffect(() => {
    const loadCachedSizes = async () => {
      if (folderPaths.length === 0) return;

      try {
        const cachedSizes = await TauriAPI.getCachedFolderSizes(folderPaths);
        setState((prev) => ({
          ...prev,
          folderSizes: { ...prev.folderSizes, ...cachedSizes },
        }));
      } catch (error) {
        console.error('Failed to load cached folder sizes:', error);
      }
    };

    loadCachedSizes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderPathsKey]);

  // Calculate folder size for a specific folder
  const calculateFolderSize = useCallback(
    async (folderPath: string) => {
      // Don't calculate if already calculating
      if (state.isCalculating.has(folderPath)) return;

      setState((prev) => {
        const newCalculating = new Set(prev.isCalculating);
        newCalculating.add(folderPath);
        return {
          ...prev,
          isCalculating: newCalculating,
          errors: { ...prev.errors, [folderPath]: undefined },
        };
      });

      try {
        const sizeInfo = await TauriAPI.calculateFolderSize(folderPath);
        setState((prev) => {
          const newCalculating = new Set(prev.isCalculating);
          newCalculating.delete(folderPath);
          return {
            ...prev,
            folderSizes: { ...prev.folderSizes, [folderPath]: sizeInfo },
            isCalculating: newCalculating,
          };
        });
      } catch (error) {
        setState((prev) => {
          const newCalculating = new Set(prev.isCalculating);
          newCalculating.delete(folderPath);
          return {
            ...prev,
            isCalculating: newCalculating,
            errors: { ...prev.errors, [folderPath]: (error as Error).message },
          };
        });
      }
    },
    [state.isCalculating],
  );

  // Calculate sizes for all folders that don't have cached sizes
  const calculateMissingSizes = useCallback(async () => {
    const missingFolders = folderPaths.filter(
      (path) => !state.folderSizes[path] && !state.isCalculating.has(path),
    );

    // Calculate sizes in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < missingFolders.length; i += batchSize) {
      const batch = missingFolders.slice(i, i + batchSize);
      await Promise.all(batch.map((path) => calculateFolderSize(path)));

      // Small delay between batches
      if (i + batchSize < missingFolders.length) {
        await new Promise((resolve) => {
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => resolve(undefined));
          } else {
            setTimeout(resolve, 100);
          }
        });
      }
    }
  }, [folderPaths, state.folderSizes, state.isCalculating, calculateFolderSize]);

  // Clear cache
  const clearCache = useCallback(async () => {
    try {
      await TauriAPI.clearFolderSizeCache();
      setState((prev) => ({
        ...prev,
        folderSizes: {},
        errors: {},
      }));
    } catch (error) {
      console.error('Failed to clear folder size cache:', error);
    }
  }, []);

  // Get size info for a specific folder
  const getFolderSize = useCallback(
    (folderPath: string): FolderSizeInfo | null => {
      return state.folderSizes[folderPath] || null;
    },
    [state.folderSizes],
  );

  // Check if folder size is being calculated
  const isCalculatingSize = useCallback(
    (folderPath: string): boolean => {
      return state.isCalculating.has(folderPath);
    },
    [state.isCalculating],
  );

  // Get error for a specific folder
  const getFolderError = useCallback(
    (folderPath: string): string | undefined => {
      return state.errors[folderPath];
    },
    [state.errors],
  );

  return {
    folderSizes: state.folderSizes,
    calculateFolderSize,
    calculateMissingSizes,
    clearCache,
    getFolderSize,
    isCalculatingSize,
    getFolderError,
    hasAnyCalculating: state.isCalculating.size > 0,
  };
};
