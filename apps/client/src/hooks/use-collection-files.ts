/**
 * Hook: useCollectionFiles
 *
 * Given a collection ID and a base path, reads the directory from the backend,
 * then filters the results using the collection's filter criteria.
 *
 * Tag filters are resolved asynchronously via TauriAPI.getFileTagsBatch.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';
import {
  getCollection,
  matchesFilter,
  type FileCollection,
  type CollectionFilter,
} from '@/lib/collections';

interface UseCollectionFilesResult {
  files: FileEntry[];
  isLoading: boolean;
  collection: FileCollection | null;
  refetch: () => void;
}

export const useCollectionFiles = (
  collectionId: string | null,
  fallbackBasePath: string,
): UseCollectionFilesResult => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [collection, setCollection] = useState<FileCollection | null>(null);
  const fetchIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!collectionId) {
      setFiles([]);
      setCollection(null);
      return;
    }

    const col = getCollection(collectionId);
    setCollection(col);

    if (!col) {
      setFiles([]);
      return;
    }

    const basePath = col.basePath || fallbackBasePath;
    if (!basePath || basePath.startsWith('xplorer://') || basePath.startsWith('collection://')) {
      setFiles([]);
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setIsLoading(true);

    try {
      const allFiles = await TauriAPI.readDirectory(basePath);

      // If this fetch is stale, discard
      if (fetchId !== fetchIdRef.current) return;

      // Separate tag filters from non-tag filters
      const tagFilters = col.filters.filter((f) => f.type === 'tag');
      const nonTagFilters = col.filters.filter((f) => f.type !== 'tag');

      // Apply non-tag filters first (synchronous)
      let filtered = allFiles.filter((file) => nonTagFilters.every((f) => matchesFilter(file, f)));

      // Apply tag filters if any (requires async batch lookup)
      if (tagFilters.length > 0 && filtered.length > 0) {
        try {
          const paths = filtered.map((f) => f.path);
          const tagMap = await TauriAPI.getFileTagsBatch(paths);

          if (fetchId !== fetchIdRef.current) return;

          filtered = filtered.filter((file) => {
            const fileTags = tagMap[file.path] || [];
            return tagFilters.every((tf: CollectionFilter) =>
              fileTags.some((t) => t.name.toLowerCase() === tf.value.toLowerCase()),
            );
          });
        } catch (err) {
          console.warn('[useCollectionFiles] Failed to fetch tags, skipping tag filters:', err);
        }
      }

      setFiles(filtered);
    } catch (err) {
      console.error('[useCollectionFiles] Failed to load collection files:', err);
      if (fetchId === fetchIdRef.current) setFiles([]);
    } finally {
      if (fetchId === fetchIdRef.current) setIsLoading(false);
    }
  }, [collectionId, fallbackBasePath]);

  useEffect(() => {
    load();
  }, [load]);

  // Listen for collection changes to re-evaluate
  useEffect(() => {
    const handler = () => {
      if (collectionId) {
        const updated = getCollection(collectionId);
        setCollection(updated);
      }
    };
    window.addEventListener('collections-changed', handler);
    return () => window.removeEventListener('collections-changed', handler);
  }, [collectionId]);

  return { files, isLoading, collection, refetch: load };
};
