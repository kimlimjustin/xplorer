import { useCallback, useRef } from 'react';
import { convertAssetUrl } from '@/lib/transport';

interface ThumbnailCacheEntry {
  url: string;
  lastAccessed: number;
}

interface UseThumbnailCacheReturn {
  /** Convert a local file path to a displayable thumbnail URL, with LRU caching. */
  getThumbnailUrl: (path: string) => string;
  /** Preload thumbnail images for an array of file paths (fires in background). */
  preloadThumbnails: (paths: string[]) => void;
}

/**
 * Hook that manages thumbnail URLs with LRU caching.
 *
 * Converts local file paths to Tauri asset URLs via `convertAssetUrl`,
 * caches the result, and evicts least-recently-used entries when the
 * cache exceeds `maxSize`.
 */
export const useThumbnailCache = (maxSize: number = 100) : UseThumbnailCacheReturn => {
  const cacheRef = useRef<Map<string, ThumbnailCacheEntry>>(new Map());

  const evictIfNeeded = useCallback(() => {
    const cache = cacheRef.current;
    if (cache.size <= maxSize) return;

    // Find and remove the least-recently-accessed entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    if (oldestKey) cache.delete(oldestKey);
  }, [maxSize]);

  const getThumbnailUrl = useCallback(
    (path: string): string => {
      const cache = cacheRef.current;
      const existing = cache.get(path);
      if (existing) {
        existing.lastAccessed = Date.now();
        return existing.url;
      }

      const url = convertAssetUrl(path);
      cache.set(path, { url, lastAccessed: Date.now() });
      evictIfNeeded();
      return url;
    },
    [evictIfNeeded],
  );

  const preloadThumbnails = useCallback(
    (paths: string[]) => {
      for (const path of paths) {
        const url = getThumbnailUrl(path);
        // Use the browser Image constructor to preload into the disk/memory cache
        const img = new Image();
        img.src = url;
      }
    },
    [getThumbnailUrl],
  );

  return { getThumbnailUrl, preloadThumbnails };
}
