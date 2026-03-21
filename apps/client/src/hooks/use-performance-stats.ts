import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TauriAPI,
  type FileEntry,
  type AuditEntry,
  type AIIndexStatus,
  type TokenIndex,
} from '@/lib/tauri-api';

export interface DirectoryStats {
  fileCount: number;
  folderCount: number;
  totalSize: number;
  cachedFolderCount: number;
}

export interface IndexingStatus {
  aiIndexed: number;
  aiQueueLength: number;
  isAiProcessing: boolean;
  currentAiFile?: string;
  tokenTotalFiles: number;
  tokenTotalTokens: number;
  tokenLastUpdated: number;
  isTokenizerIndexing: boolean;
}

export interface CleanupSuggestion {
  id: string;
  title: string;
  description: string;
  estimatedSize: number;
  actionLabel: string;
  actionType: 'navigate' | 'action';
}

export interface PerformanceStats {
  directoryStats: DirectoryStats;
  indexingStatus: IndexingStatus;
  recentOps: AuditEntry[];
  suggestions: CleanupSuggestion[];
  memoryUsage: number | null;
  isLoading: boolean;
  refreshStats: () => void;
}

const REFRESH_INTERVAL = 30_000;

export const usePerformanceStats = (
  currentPath: string,
  files: FileEntry[],
  visible: boolean,
): PerformanceStats => {
  const [recentOps, setRecentOps] = useState<AuditEntry[]>([]);
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus>({
    aiIndexed: 0,
    aiQueueLength: 0,
    isAiProcessing: false,
    tokenTotalFiles: 0,
    tokenTotalTokens: 0,
    tokenLastUpdated: 0,
    isTokenizerIndexing: false,
  });
  const [suggestions, setSuggestions] = useState<CleanupSuggestion[]>([]);
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compute directory stats synchronously from the files array
  const directoryStats: DirectoryStats = (() => {
    let fileCount = 0;
    let folderCount = 0;
    let totalSize = 0;
    for (const f of files) {
      if (f.is_dir) {
        folderCount++;
      } else {
        fileCount++;
        totalSize += f.size;
      }
    }
    return { fileCount, folderCount, totalSize, cachedFolderCount: folderCount };
  })();

  const fetchStats = useCallback(async () => {
    if (!visible) return;
    setIsLoading(true);
    try {
      // Fetch all async data in parallel
      const [auditResult, aiStatus, tokenizerStats, tokenizerIndexing, trashItems] =
        await Promise.allSettled([
          TauriAPI.getAuditLog(10, 0),
          TauriAPI.getAIIndexStatus(),
          TauriAPI.getTokenizerStats(),
          TauriAPI.isTokenizerIndexing(),
          TauriAPI.getTrashItems(),
        ]);

      // Audit log
      if (auditResult.status === 'fulfilled') {
        const auditData = auditResult.value;
        // Handle both { entries: [...] } (real API) and plain array (mock/fallback)
        let entries: AuditEntry[];
        if (Array.isArray(auditData)) {
          entries = auditData;
        } else if (Array.isArray(auditData?.entries)) {
          entries = auditData.entries;
        } else {
          entries = [];
        }
        setRecentOps(entries);
      }

      // Indexing status
      const ai: AIIndexStatus | null = aiStatus.status === 'fulfilled' ? aiStatus.value : null;
      const tok: TokenIndex | null =
        tokenizerStats.status === 'fulfilled' ? tokenizerStats.value : null;
      const tokIsIndexing =
        tokenizerIndexing.status === 'fulfilled' ? tokenizerIndexing.value : false;

      setIndexingStatus({
        aiIndexed: ai?.total_indexed ?? 0,
        aiQueueLength: ai?.queue_length ?? 0,
        isAiProcessing: ai?.is_processing ?? false,
        currentAiFile: ai?.current_file,
        tokenTotalFiles: tok?.total_files ?? 0,
        tokenTotalTokens: tok?.total_tokens ?? 0,
        tokenLastUpdated: tok?.last_updated ?? 0,
        isTokenizerIndexing: tokIsIndexing,
      });

      // Cleanup suggestions
      const newSuggestions: CleanupSuggestion[] = [];

      // Trash size
      const trashList =
        trashItems.status === 'fulfilled' && Array.isArray(trashItems.value)
          ? trashItems.value
          : [];
      if (trashList.length > 0) {
        const trashSize = trashList.reduce(
          (sum: number, item: { size: number }) => sum + item.size,
          0,
        );
        newSuggestions.push({
          id: 'trash',
          title: `Trash: ${trashList.length} items`,
          description: `Recycle bin contains ${trashList.length} item${trashList.length !== 1 ? 's' : ''}`,
          estimatedSize: trashSize,
          actionLabel: 'Empty Trash',
          actionType: 'action',
        });
      }

      // Large files in current directory (>100 MB)
      const largeFiles = files.filter((f) => !f.is_dir && f.size > 100 * 1024 * 1024);
      if (largeFiles.length > 0) {
        const largeSize = largeFiles.reduce((sum, f) => sum + f.size, 0);
        newSuggestions.push({
          id: 'large-files',
          title: `Large files: ${largeFiles.length} files`,
          description: `Files larger than 100 MB in this folder`,
          estimatedSize: largeSize,
          actionLabel: 'Show Large Files',
          actionType: 'navigate',
        });
      }

      // Untagged files — count files without tags (sample first 50 to avoid heavy calls)
      try {
        const samplePaths = files
          .filter((f) => !f.is_dir)
          .slice(0, 50)
          .map((f) => f.path);
        if (samplePaths.length > 0) {
          const tagBatch = await TauriAPI.getFileTagsBatch(samplePaths);
          // Guard against null/array returns from mock API
          const tagMap =
            tagBatch && typeof tagBatch === 'object' && !Array.isArray(tagBatch) ? tagBatch : {};
          const untaggedCount = samplePaths.filter(
            (p) => !tagMap[p] || tagMap[p].length === 0,
          ).length;
          if (untaggedCount > 0) {
            newSuggestions.push({
              id: 'untagged',
              title: `Untagged files: ${untaggedCount}${samplePaths.length < files.filter((f) => !f.is_dir).length ? '+' : ''}`,
              description: `Files without any tags in this folder`,
              estimatedSize: 0,
              actionLabel: 'Tag Files',
              actionType: 'navigate',
            });
          }
        }
      } catch {
        // Tag batch may fail silently
      }

      setSuggestions(newSuggestions);

      // Memory usage (Chrome-only API, may not be available)
      const perf = performance as Performance & {
        memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
      };
      if (perf.memory) {
        setMemoryUsage(perf.memory.usedJSHeapSize);
      }
    } catch {
      // Silently handle errors — partial data is fine
    } finally {
      setIsLoading(false);
    }
  }, [visible, files]);

  // Initial fetch and refresh interval
  useEffect(() => {
    if (!visible) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    fetchStats();
    timerRef.current = setInterval(fetchStats, REFRESH_INTERVAL);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, fetchStats]);

  // Refetch when currentPath changes
  useEffect(() => {
    if (visible) {
      fetchStats();
    }
  }, [currentPath, visible, fetchStats]);

  return {
    directoryStats,
    indexingStatus,
    recentOps,
    suggestions,
    memoryUsage,
    isLoading,
    refreshStats: fetchStats,
  };
};
