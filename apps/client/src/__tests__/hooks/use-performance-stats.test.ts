import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePerformanceStats } from '@/hooks/use-performance-stats';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';

const makeFile = (name: string, size = 1024, isDir = false): FileEntry => {
  return {
    name,
    path: `/test/${name}`,
    is_dir: isDir,
    size,
    modified: 1700000000,
    file_type: isDir ? 'directory' : 'file',
  };
};

// eslint-safe mock helper – avoids `as any` while allowing property assignment
const mockAPI = TauriAPI as unknown as Record<string, ReturnType<typeof vi.fn>>;

const setupDefaultMocks = () => {
  mockAPI.getAuditLog = vi.fn().mockResolvedValue({ entries: [] });
  mockAPI.getAIIndexStatus = vi.fn().mockResolvedValue({
    enabled: false,
    total_indexed: 0,
    queue_length: 0,
    is_processing: false,
  });
  mockAPI.getTokenizerStats = vi.fn().mockResolvedValue(null);
  mockAPI.isTokenizerIndexing = vi.fn().mockResolvedValue(false);
  mockAPI.getTrashItems = vi.fn().mockResolvedValue([]);
  mockAPI.getFileTagsBatch = vi.fn().mockResolvedValue({});
};

// Stable empty files reference to avoid infinite re-render loops.
// The hook's fetchStats is a useCallback with [visible, files] deps.
// A new [] on each render creates a new fetchStats, re-triggering useEffects.
const EMPTY_FILES: FileEntry[] = [];

interface HookProps {
  path: string;
  files: FileEntry[];
  visible: boolean;
}

const useHookWithProps = ({ path, files, visible }: HookProps) => {
  return usePerformanceStats(path, files, visible);
};

describe('usePerformanceStats', () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('directoryStats (synchronous computation)', () => {
    it('computes file and folder counts from files array', () => {
      const files = [
        makeFile('a.txt', 100),
        makeFile('b.txt', 200),
        makeFile('docs', 0, true),
        makeFile('images', 0, true),
      ];

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files, visible: false },
      });

      expect(result.current.directoryStats.fileCount).toBe(2);
      expect(result.current.directoryStats.folderCount).toBe(2);
      expect(result.current.directoryStats.totalSize).toBe(300);
      expect(result.current.directoryStats.cachedFolderCount).toBe(2);
    });

    it('returns zero counts for empty files array', () => {
      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: false },
      });

      expect(result.current.directoryStats.fileCount).toBe(0);
      expect(result.current.directoryStats.folderCount).toBe(0);
      expect(result.current.directoryStats.totalSize).toBe(0);
    });

    it('handles files only (no folders)', () => {
      const files = [makeFile('a.txt', 500), makeFile('b.txt', 300)];

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files, visible: false },
      });

      expect(result.current.directoryStats.fileCount).toBe(2);
      expect(result.current.directoryStats.folderCount).toBe(0);
      expect(result.current.directoryStats.totalSize).toBe(800);
    });

    it('handles folders only (no files)', () => {
      const files = [makeFile('docs', 0, true), makeFile('images', 0, true)];

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files, visible: false },
      });

      expect(result.current.directoryStats.fileCount).toBe(0);
      expect(result.current.directoryStats.folderCount).toBe(2);
      expect(result.current.directoryStats.totalSize).toBe(0);
    });

    it('updates when files array changes', () => {
      const files1 = [makeFile('a.txt', 100)];
      const files2 = [makeFile('a.txt', 100), makeFile('b.txt', 200)];

      const { result, rerender } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: files1, visible: false },
      });

      expect(result.current.directoryStats.fileCount).toBe(1);

      rerender({ path: '/test', files: files2, visible: false });

      expect(result.current.directoryStats.fileCount).toBe(2);
      expect(result.current.directoryStats.totalSize).toBe(300);
    });
  });

  describe('Initial state', () => {
    it('has default indexing status values', () => {
      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: false },
      });

      expect(result.current.indexingStatus.aiIndexed).toBe(0);
      expect(result.current.indexingStatus.aiQueueLength).toBe(0);
      expect(result.current.indexingStatus.isAiProcessing).toBe(false);
      expect(result.current.indexingStatus.tokenTotalFiles).toBe(0);
      expect(result.current.indexingStatus.tokenTotalTokens).toBe(0);
      expect(result.current.indexingStatus.tokenLastUpdated).toBe(0);
      expect(result.current.indexingStatus.isTokenizerIndexing).toBe(false);
    });

    it('has empty recent operations', () => {
      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: false },
      });

      expect(result.current.recentOps).toEqual([]);
    });

    it('has empty suggestions', () => {
      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: false },
      });

      expect(result.current.suggestions).toEqual([]);
    });

    it('has null memory usage initially', () => {
      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: false },
      });

      expect(result.current.memoryUsage).toBeNull();
    });
  });

  describe('Visibility behavior', () => {
    it('does not fetch stats when not visible', async () => {
      renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: false },
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(TauriAPI.getAuditLog).not.toHaveBeenCalled();
    });

    it('fetches stats when visible', async () => {
      renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: true },
      });

      await waitFor(() => {
        expect(TauriAPI.getAuditLog).toHaveBeenCalled();
      });
    });
  });

  describe('Async data fetching', () => {
    it('fetches audit log entries', async () => {
      const mockEntries = [
        {
          id: 1,
          timestamp: '2025-01-01',
          operation: 'copy',
          paths: ['/test/a.txt'],
          user: 'test',
          details: null,
          success: true,
        },
      ];
      mockAPI.getAuditLog = vi.fn().mockResolvedValue({ entries: mockEntries });

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: true },
      });

      await waitFor(() => {
        expect(result.current.recentOps).toEqual(mockEntries);
      });
    });

    it('fetches AI index status', async () => {
      mockAPI.getAIIndexStatus = vi.fn().mockResolvedValue({
        enabled: true,
        total_indexed: 42,
        queue_length: 5,
        is_processing: true,
        current_file: '/test/image.jpg',
        vision_model: 'llava',
        embedding_model: 'nomic',
      });

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: true },
      });

      await waitFor(() => {
        expect(result.current.indexingStatus.aiIndexed).toBe(42);
      });

      expect(result.current.indexingStatus.aiQueueLength).toBe(5);
      expect(result.current.indexingStatus.isAiProcessing).toBe(true);
      expect(result.current.indexingStatus.currentAiFile).toBe('/test/image.jpg');
    });

    it('fetches tokenizer stats', async () => {
      mockAPI.getTokenizerStats = vi.fn().mockResolvedValue({
        files: {},
        word_to_files: {},
        metadata_files: {},
        last_updated: 1700000000,
        total_files: 100,
        total_tokens: 5000,
      });
      mockAPI.isTokenizerIndexing = vi.fn().mockResolvedValue(true);

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: true },
      });

      await waitFor(() => {
        expect(result.current.indexingStatus.tokenTotalFiles).toBe(100);
      });

      expect(result.current.indexingStatus.tokenTotalTokens).toBe(5000);
      expect(result.current.indexingStatus.tokenLastUpdated).toBe(1700000000);
      expect(result.current.indexingStatus.isTokenizerIndexing).toBe(true);
    });

    it('handles partial API failures gracefully', async () => {
      mockAPI.getAuditLog = vi.fn().mockRejectedValue(new Error('fail'));
      mockAPI.getAIIndexStatus = vi.fn().mockRejectedValue(new Error('fail'));
      mockAPI.getTokenizerStats = vi.fn().mockResolvedValue(null);
      mockAPI.isTokenizerIndexing = vi.fn().mockResolvedValue(false);

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: true },
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.recentOps).toEqual([]);
      expect(result.current.indexingStatus.aiIndexed).toBe(0);
    });
  });

  describe('Cleanup suggestions', () => {
    it('generates trash suggestion when trash has items', async () => {
      mockAPI.getTrashItems = vi.fn().mockResolvedValue([
        {
          name: 'deleted.txt',
          path: '/trash/deleted.txt',
          original_path: '/test/deleted.txt',
          size: 5000,
          deleted_at: 1700000000,
          is_dir: false,
        },
      ]);

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: true },
      });

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      });

      const trashSuggestion = result.current.suggestions.find((s) => s.id === 'trash');
      expect(trashSuggestion).toBeDefined();
      expect(trashSuggestion!.title).toContain('Trash');
      expect(trashSuggestion!.estimatedSize).toBe(5000);
      expect(trashSuggestion!.actionLabel).toBe('Empty Trash');
      expect(trashSuggestion!.actionType).toBe('action');
    });

    it('generates large files suggestion for files > 100MB', async () => {
      const largeSize = 150 * 1024 * 1024; // 150 MB
      const files = [makeFile('big.bin', largeSize), makeFile('small.txt', 1024)];

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files, visible: true },
      });

      await waitFor(() => {
        const largeSuggestion = result.current.suggestions.find((s) => s.id === 'large-files');
        expect(largeSuggestion).toBeDefined();
      });

      const largeSuggestion = result.current.suggestions.find((s) => s.id === 'large-files');
      expect(largeSuggestion!.title).toContain('1 files');
      expect(largeSuggestion!.estimatedSize).toBe(largeSize);
      expect(largeSuggestion!.actionLabel).toBe('Show Large Files');
      expect(largeSuggestion!.actionType).toBe('navigate');
    });

    it('does not generate large files suggestion when no files exceed 100MB', async () => {
      const files = [makeFile('small.txt', 1024), makeFile('medium.txt', 50 * 1024 * 1024)];

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files, visible: true },
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const largeSuggestion = result.current.suggestions.find((s) => s.id === 'large-files');
      expect(largeSuggestion).toBeUndefined();
    });

    it('generates untagged files suggestion', async () => {
      const files = [makeFile('a.txt', 100), makeFile('b.txt', 200)];

      mockAPI.getFileTagsBatch = vi.fn().mockResolvedValue({
        '/test/a.txt': [],
        '/test/b.txt': [],
      });

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files, visible: true },
      });

      await waitFor(() => {
        const s = result.current.suggestions.find((s) => s.id === 'untagged');
        expect(s).toBeDefined();
      });

      const untaggedSuggestion = result.current.suggestions.find((s) => s.id === 'untagged');
      expect(untaggedSuggestion!.title).toContain('Untagged files');
      expect(untaggedSuggestion!.actionLabel).toBe('Tag Files');
    });

    it('does not generate untagged suggestion when all files are tagged', async () => {
      const files = [makeFile('a.txt', 100)];

      mockAPI.getFileTagsBatch = vi.fn().mockResolvedValue({
        '/test/a.txt': [{ name: 'important', color: '#ff0000' }],
      });

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files, visible: true },
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const untaggedSuggestion = result.current.suggestions.find((s) => s.id === 'untagged');
      expect(untaggedSuggestion).toBeUndefined();
    });

    it('does not generate untagged suggestion for directories only', async () => {
      const files = [makeFile('docs', 0, true)];

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files, visible: true },
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const untaggedSuggestion = result.current.suggestions.find((s) => s.id === 'untagged');
      expect(untaggedSuggestion).toBeUndefined();
    });
  });

  describe('refreshStats', () => {
    it('provides a manual refresh function', async () => {
      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: true },
      });

      await waitFor(() => {
        expect(TauriAPI.getAuditLog).toHaveBeenCalled();
      });

      const callCountBefore = (TauriAPI.getAuditLog as ReturnType<typeof vi.fn>).mock.calls.length;

      await act(async () => {
        result.current.refreshStats();
      });

      await waitFor(() => {
        expect(
          (TauriAPI.getAuditLog as ReturnType<typeof vi.fn>).mock.calls.length,
        ).toBeGreaterThan(callCountBefore);
      });
    });
  });

  describe('Path change behavior', () => {
    it('refetches when currentPath changes while visible', async () => {
      const { rerender } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: true },
      });

      await waitFor(() => {
        expect(TauriAPI.getAuditLog).toHaveBeenCalled();
      });

      const callCountBefore = (TauriAPI.getAuditLog as ReturnType<typeof vi.fn>).mock.calls.length;

      rerender({ path: '/other', files: EMPTY_FILES, visible: true });

      await waitFor(() => {
        expect(
          (TauriAPI.getAuditLog as ReturnType<typeof vi.fn>).mock.calls.length,
        ).toBeGreaterThan(callCountBefore);
      });
    });
  });

  describe('Null / default handling', () => {
    it('handles null tokenizer stats gracefully', async () => {
      mockAPI.getTokenizerStats = vi.fn().mockResolvedValue(null);

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: true },
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.indexingStatus.tokenTotalFiles).toBe(0);
      expect(result.current.indexingStatus.tokenTotalTokens).toBe(0);
      expect(result.current.indexingStatus.tokenLastUpdated).toBe(0);
    });

    it('handles all Promise.allSettled rejections gracefully', async () => {
      mockAPI.getAuditLog = vi.fn().mockRejectedValue(new Error('fail'));
      mockAPI.getAIIndexStatus = vi.fn().mockRejectedValue(new Error('fail'));
      mockAPI.getTokenizerStats = vi.fn().mockRejectedValue(new Error('fail'));
      mockAPI.isTokenizerIndexing = vi.fn().mockRejectedValue(new Error('fail'));
      mockAPI.getTrashItems = vi.fn().mockRejectedValue(new Error('fail'));

      const { result } = renderHook(useHookWithProps, {
        initialProps: { path: '/test', files: EMPTY_FILES, visible: true },
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.recentOps).toEqual([]);
      expect(result.current.indexingStatus.aiIndexed).toBe(0);
      expect(result.current.indexingStatus.isTokenizerIndexing).toBe(false);
      expect(result.current.suggestions).toEqual([]);
    });
  });
});
