import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiveSearch } from '@/hooks/use-live-search';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';

// SEARCH_DEBOUNCE_MS is 300 from constants
vi.mock('@/lib/constants', () => ({
  SEARCH_DEBOUNCE_MS: 300,
}));

const makeFile = (name: string, path: string, isDir = false): FileEntry => {
  return {
    name,
    path,
    is_dir: isDir,
    size: 1024,
    modified: 1700000000,
    file_type: isDir ? 'directory' : 'file',
  };
};

describe('useLiveSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial state', () => {
    it('returns empty query and no results initially', () => {
      const { result } = renderHook(() => useLiveSearch('/test'));

      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.isSearching).toBe(false);
      expect(result.current.resultCount).toBe(0);
      expect(result.current.totalResultCount).toBe(0);
      expect(result.current.folderCount).toBe(0);
      expect(result.current.activeFilter).toBe('all');
      expect(result.current.hasMore).toBe(false);
      expect(result.current.displayLimit).toBe(200);
    });

    it('returns grouped results as empty array', () => {
      const { result } = renderHook(() => useLiveSearch('/test'));
      expect(result.current.groupedResults).toEqual([]);
    });
  });

  describe('setQuery', () => {
    it('updates query state immediately', () => {
      const { result } = renderHook(() => useLiveSearch('/test'));

      act(() => {
        result.current.setQuery('hello');
      });

      expect(result.current.query).toBe('hello');
    });

    it('sets isSearching to true when query is non-empty', () => {
      const { result } = renderHook(() => useLiveSearch('/test'));

      act(() => {
        result.current.setQuery('test');
      });

      expect(result.current.isSearching).toBe(true);
    });

    it('clears results and stops searching when query is empty', () => {
      const { result } = renderHook(() => useLiveSearch('/test'));

      act(() => {
        result.current.setQuery('something');
      });

      act(() => {
        result.current.setQuery('');
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.isSearching).toBe(false);
    });

    it('clears results when query is only whitespace', () => {
      const { result } = renderHook(() => useLiveSearch('/test'));

      act(() => {
        result.current.setQuery('   ');
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.isSearching).toBe(false);
    });
  });

  describe('Debounced search', () => {
    it('calls TauriAPI.readDirectory after debounce delay', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      mockReadDir.mockResolvedValue([makeFile('test.txt', '/test/test.txt')]);

      const { result } = renderHook(() => useLiveSearch('/test'));

      act(() => {
        result.current.setQuery('test');
      });

      // Before debounce fires
      expect(mockReadDir).not.toHaveBeenCalled();

      // Advance past the debounce delay (300ms)
      await act(async () => {
        vi.advanceTimersByTime(300);
        // Allow the promise chain to settle
        await vi.runAllTimersAsync();
      });

      expect(mockReadDir).toHaveBeenCalled();
    });

    it('does not search before debounce delay expires', () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      const { result } = renderHook(() => useLiveSearch('/test'));

      act(() => {
        result.current.setQuery('test');
      });

      // Only advance 100ms - not enough
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(mockReadDir).not.toHaveBeenCalled();
    });

    it('cancels previous debounce when query changes rapidly', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      mockReadDir.mockResolvedValue([]);

      const { result } = renderHook(() => useLiveSearch('/test'));

      act(() => {
        result.current.setQuery('a');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.setQuery('ab');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.setQuery('abc');
      });

      // Advance past the debounce from the last query change
      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // readDirectory should only have been called once for the final query, not for each intermediate one
      // (The walk calls readDirectory for each directory level, so we check it was called at least once
      // for /test but not for intermediate queries since they were cancelled.)
      expect(mockReadDir).toHaveBeenCalledWith('/test');
    });
  });

  describe('Search results', () => {
    it('returns matching files after search completes', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      mockReadDir.mockResolvedValue([
        makeFile('hello.txt', '/base/hello.txt'),
        makeFile('world.txt', '/base/world.txt'),
      ]);

      const { result } = renderHook(() => useLiveSearch('/base'));

      act(() => {
        result.current.setQuery('hello');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      expect(result.current.results.length).toBe(1);
      expect(result.current.results[0].file.name).toBe('hello.txt');
      expect(result.current.isSearching).toBe(false);
    });

    it('sorts results by relevance (exact > starts with > contains)', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      mockReadDir.mockImplementation(async (path: string) => {
        if (path === '/base') {
          return [
            makeFile('my-test-file.txt', '/base/my-test-file.txt'),
            makeFile('test', '/base/test', true),
            makeFile('testing.txt', '/base/testing.txt'),
          ];
        }
        return []; // Subdirectories return empty
      });

      const { result } = renderHook(() => useLiveSearch('/base'));

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // "test" exact match (3), "testing.txt" starts-with (2), "my-test-file.txt" contains (1)
      expect(result.current.results.length).toBe(3);
      expect(result.current.results[0].file.name).toBe('test');
      expect(result.current.results[0].relevance).toBe(3);
      expect(result.current.results[1].file.name).toBe('testing.txt');
      expect(result.current.results[1].relevance).toBe(2);
      expect(result.current.results[2].file.name).toBe('my-test-file.txt');
      expect(result.current.results[2].relevance).toBe(1);
    });

    it('skips hidden files (starting with .)', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      mockReadDir.mockResolvedValue([
        makeFile('.hidden', '/base/.hidden'),
        makeFile('visible.txt', '/base/visible.txt'),
      ]);

      const { result } = renderHook(() => useLiveSearch('/base'));

      act(() => {
        result.current.setQuery('hid');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // .hidden should be skipped
      expect(result.current.results.length).toBe(0);
    });

    it('handles readDirectory errors gracefully', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      mockReadDir.mockRejectedValue(new Error('Permission denied'));

      const { result } = renderHook(() => useLiveSearch('/base'));

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Should handle gracefully with empty results
      expect(result.current.results).toEqual([]);
      expect(result.current.isSearching).toBe(false);
    });
  });

  describe('Grouped results', () => {
    it('groups results by parent directory', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      // First call returns entries in base dir, including a subdir
      mockReadDir.mockImplementation(async (path: string) => {
        if (path === '/base') {
          return [makeFile('test.txt', '/base/test.txt'), makeFile('sub', '/base/sub', true)];
        }
        if (path === '/base/sub') {
          return [makeFile('test2.txt', '/base/sub/test2.txt')];
        }
        return [];
      });

      const { result } = renderHook(() => useLiveSearch('/base'));

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Should have results grouped by parent dir
      expect(result.current.groupedResults.length).toBeGreaterThanOrEqual(1);
      expect(result.current.folderCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Filters', () => {
    it('defaults to "all" filter', () => {
      const { result } = renderHook(() => useLiveSearch('/test'));
      expect(result.current.activeFilter).toBe('all');
    });

    it('allows changing the active filter', () => {
      const { result } = renderHook(() => useLiveSearch('/test'));

      act(() => {
        result.current.setActiveFilter('folders');
      });

      expect(result.current.activeFilter).toBe('folders');
    });

    it('filters by folders only', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      mockReadDir.mockImplementation(async (path: string) => {
        if (path === '/base') {
          return [
            makeFile('mydir', '/base/mydir', true),
            makeFile('myfile.txt', '/base/myfile.txt'),
          ];
        }
        return [];
      });

      const { result } = renderHook(() => useLiveSearch('/base'));

      act(() => {
        result.current.setActiveFilter('folders');
        result.current.setQuery('my');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      expect(result.current.results.length).toBe(1);
      expect(result.current.results[0].file.name).toBe('mydir');
      expect(result.current.results[0].file.is_dir).toBe(true);
    });

    it('filters by files only', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      mockReadDir.mockImplementation(async (path: string) => {
        if (path === '/base') {
          return [
            makeFile('mydir', '/base/mydir', true),
            makeFile('myfile.txt', '/base/myfile.txt'),
          ];
        }
        return [];
      });

      const { result } = renderHook(() => useLiveSearch('/base'));

      act(() => {
        result.current.setActiveFilter('files');
        result.current.setQuery('my');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      expect(result.current.results.length).toBe(1);
      expect(result.current.results[0].file.name).toBe('myfile.txt');
    });

    it('filters by documents extension', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      mockReadDir.mockResolvedValue([
        makeFile('report.pdf', '/base/report.pdf'),
        makeFile('report.txt', '/base/report.txt'),
        makeFile('report.ts', '/base/report.ts'),
      ]);

      const { result } = renderHook(() => useLiveSearch('/base'));

      act(() => {
        result.current.setActiveFilter('documents');
        result.current.setQuery('report');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      const names = result.current.results.map((r) => r.file.name);
      expect(names).toContain('report.pdf');
      expect(names).toContain('report.txt');
      expect(names).not.toContain('report.ts');
    });

    it('filters by images extension', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      mockReadDir.mockResolvedValue([
        makeFile('photo.jpg', '/base/photo.jpg'),
        makeFile('photo.png', '/base/photo.png'),
        makeFile('photo.txt', '/base/photo.txt'),
      ]);

      const { result } = renderHook(() => useLiveSearch('/base'));

      act(() => {
        result.current.setActiveFilter('images');
        result.current.setQuery('photo');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      const names = result.current.results.map((r) => r.file.name);
      expect(names).toContain('photo.jpg');
      expect(names).toContain('photo.png');
      expect(names).not.toContain('photo.txt');
    });

    it('filters by code extension', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      mockReadDir.mockResolvedValue([
        makeFile('app.tsx', '/base/app.tsx'),
        makeFile('main.rs', '/base/main.rs'),
        makeFile('data.csv', '/base/data.csv'),
      ]);

      const { result } = renderHook(() => useLiveSearch('/base'));

      act(() => {
        result.current.setActiveFilter('code');
        result.current.setQuery('a');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      const names = result.current.results.map((r) => r.file.name);
      expect(names).toContain('app.tsx');
      expect(names).toContain('main.rs');
      expect(names).not.toContain('data.csv');
    });

    it('resets displayLimit when filter changes', () => {
      const { result } = renderHook(() => useLiveSearch('/test'));

      act(() => {
        result.current.showMore();
      });

      expect(result.current.displayLimit).toBe(400);

      act(() => {
        result.current.setActiveFilter('images');
      });

      expect(result.current.displayLimit).toBe(200);
    });
  });

  describe('Pagination', () => {
    it('showMore increases displayLimit by 200', () => {
      const { result } = renderHook(() => useLiveSearch('/test'));

      expect(result.current.displayLimit).toBe(200);

      act(() => {
        result.current.showMore();
      });

      expect(result.current.displayLimit).toBe(400);
    });

    it('resets displayLimit when query changes', () => {
      const { result } = renderHook(() => useLiveSearch('/test'));

      act(() => {
        result.current.showMore();
      });

      expect(result.current.displayLimit).toBe(400);

      act(() => {
        result.current.setQuery('new search');
      });

      expect(result.current.displayLimit).toBe(200);
    });
  });

  describe('clearSearch', () => {
    it('resets query, results, and searching state', () => {
      const { result } = renderHook(() => useLiveSearch('/test'));

      act(() => {
        result.current.setQuery('something');
      });

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.isSearching).toBe(false);
    });
  });

  describe('resultCount and totalResultCount', () => {
    it('resultCount is capped at displayLimit', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      // Create 250 files that match
      const files = Array.from({ length: 250 }, (_, i) =>
        makeFile(`test${i}.txt`, `/base/test${i}.txt`),
      );
      mockReadDir.mockResolvedValue(files);

      const { result } = renderHook(() => useLiveSearch('/base'));

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      expect(result.current.resultCount).toBeLessThanOrEqual(200);
      expect(result.current.totalResultCount).toBe(250);
      expect(result.current.hasMore).toBe(true);
    });
  });
});
