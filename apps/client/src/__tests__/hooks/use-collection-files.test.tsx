import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock collections module (NOT globally mocked by setup)
vi.mock('@/lib/collections', () => ({
  getCollection: vi.fn(),
  matchesFilter: vi.fn(),
}));

import { useCollectionFiles } from '@/hooks/use-collection-files';
import { TauriAPI } from '@/lib/tauri-api';
import type { FileEntry } from '@/lib/tauri-api';
import { getCollection, matchesFilter } from '@/lib/collections';

const mockReadDirectory = vi.mocked(TauriAPI.readDirectory);
const mockGetCollection = vi.mocked(getCollection);
const mockMatchesFilter = vi.mocked(matchesFilter);
const mockAPI = TauriAPI as unknown as Record<string, ReturnType<typeof vi.fn>>;

const makeFile = (name: string, overrides: Record<string, unknown> = {}): FileEntry => {
  return {
    name,
    path: `/test/${name}`,
    is_dir: false,
    size: 1024,
    modified: 1700000000,
    file_type: 'file',
    ...overrides,
  };
};

describe('useCollectionFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchesFilter.mockReturnValue(true);
    mockReadDirectory.mockResolvedValue([]);

    // Add getFileTagsBatch to the TauriAPI mock if not present
    mockAPI.getFileTagsBatch = vi.fn().mockResolvedValue({});
  });

  describe('Initial State', () => {
    it('returns empty files and null collection when collectionId is null', () => {
      const { result } = renderHook(() => useCollectionFiles(null, '/fallback'));

      expect(result.current.files).toEqual([]);
      expect(result.current.collection).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Loading a Collection', () => {
    it('loads files matching non-tag filters', async () => {
      const collection = {
        id: 'col-1',
        name: 'PDFs',
        icon: '',
        filters: [{ type: 'extension' as const, value: '.pdf' }],
        basePath: '/docs',
        createdAt: 1000,
        updatedAt: 1000,
      };
      mockGetCollection.mockReturnValue(collection);

      const files = [makeFile('report.pdf'), makeFile('readme.txt')];
      mockReadDirectory.mockResolvedValue(files as FileEntry[]);

      // matchesFilter: only the PDF matches
      mockMatchesFilter.mockImplementation((file: FileEntry, filter: { type: string; value: string }) => {
        if (filter.type === 'extension') {
          return file.name.endsWith(filter.value);
        }
        return true;
      });

      const { result } = renderHook(() => useCollectionFiles('col-1', '/fallback'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].name).toBe('report.pdf');
      expect(result.current.collection).toEqual(collection);
    });

    it('uses fallbackBasePath when collection has no basePath', async () => {
      const collection = {
        id: 'col-2',
        name: 'All Files',
        icon: '',
        filters: [],
        basePath: '',
        createdAt: 1000,
        updatedAt: 1000,
      };
      mockGetCollection.mockReturnValue(collection);
      mockReadDirectory.mockResolvedValue([makeFile('a.txt')]);

      const { result } = renderHook(() => useCollectionFiles('col-2', '/fallback-dir'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockReadDirectory).toHaveBeenCalledWith('/fallback-dir');
    });

    it('uses collection basePath over fallback', async () => {
      const collection = {
        id: 'col-3',
        name: 'Custom',
        icon: '',
        filters: [],
        basePath: '/my-custom-path',
        createdAt: 1000,
        updatedAt: 1000,
      };
      mockGetCollection.mockReturnValue(collection);
      mockReadDirectory.mockResolvedValue([]);

      const { result } = renderHook(() => useCollectionFiles('col-3', '/fallback'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockReadDirectory).toHaveBeenCalledWith('/my-custom-path');
    });
  });

  describe('Non-existent Collection', () => {
    it('returns empty files when collection does not exist', async () => {
      mockGetCollection.mockReturnValue(null);

      const { result } = renderHook(() => useCollectionFiles('col-nonexistent', '/fallback'));

      // Should resolve quickly with empty state
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.files).toEqual([]);
      expect(result.current.collection).toBeNull();
    });
  });

  describe('Special Protocol Paths', () => {
    it('returns empty files when basePath starts with xplorer://', async () => {
      const collection = {
        id: 'col-4',
        name: 'Proto',
        icon: '',
        filters: [],
        basePath: 'xplorer://home',
        createdAt: 1000,
        updatedAt: 1000,
      };
      mockGetCollection.mockReturnValue(collection);

      const { result } = renderHook(() => useCollectionFiles('col-4', ''));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.files).toEqual([]);
      expect(mockReadDirectory).not.toHaveBeenCalled();
    });

    it('returns empty files when basePath starts with collection://', async () => {
      const collection = {
        id: 'col-5',
        name: 'Nested',
        icon: '',
        filters: [],
        basePath: 'collection://other',
        createdAt: 1000,
        updatedAt: 1000,
      };
      mockGetCollection.mockReturnValue(collection);

      const { result } = renderHook(() => useCollectionFiles('col-5', ''));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.files).toEqual([]);
    });
  });

  describe('Tag Filters', () => {
    it('applies tag filters using getFileTagsBatch', async () => {
      const collection = {
        id: 'col-tag',
        name: 'Tagged',
        icon: '',
        filters: [{ type: 'tag' as const, value: 'important' }],
        basePath: '/docs',
        createdAt: 1000,
        updatedAt: 1000,
      };
      mockGetCollection.mockReturnValue(collection);

      const files = [makeFile('a.txt'), makeFile('b.txt')];
      mockReadDirectory.mockResolvedValue(files as FileEntry[]);

      // Only a.txt has the "important" tag
      mockAPI.getFileTagsBatch = vi.fn().mockResolvedValue({
        '/test/a.txt': [{ name: 'important', color: '#ff0000' }],
        '/test/b.txt': [{ name: 'draft', color: '#00ff00' }],
      });

      const { result } = renderHook(() => useCollectionFiles('col-tag', '/fallback'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].name).toBe('a.txt');
    });

    it('handles getFileTagsBatch failure gracefully (skips tag filters)', async () => {
      const collection = {
        id: 'col-tag-fail',
        name: 'Tagged',
        icon: '',
        filters: [{ type: 'tag' as const, value: 'important' }],
        basePath: '/docs',
        createdAt: 1000,
        updatedAt: 1000,
      };
      mockGetCollection.mockReturnValue(collection);

      const files = [makeFile('a.txt')];
      mockReadDirectory.mockResolvedValue(files as FileEntry[]);
      mockAPI.getFileTagsBatch = vi.fn().mockRejectedValue(new Error('Backend error'));

      const { result } = renderHook(() => useCollectionFiles('col-tag-fail', '/fallback'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still return all files since tag fetch failed
      expect(result.current.files).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('sets files to empty on readDirectory failure', async () => {
      const collection = {
        id: 'col-err',
        name: 'Err',
        icon: '',
        filters: [],
        basePath: '/nonexistent',
        createdAt: 1000,
        updatedAt: 1000,
      };
      mockGetCollection.mockReturnValue(collection);
      mockReadDirectory.mockRejectedValue(new Error('Directory not found'));

      const { result } = renderHook(() => useCollectionFiles('col-err', '/fallback'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.files).toEqual([]);
    });
  });

  describe('Refetch', () => {
    it('provides a refetch function that reloads data', async () => {
      const collection = {
        id: 'col-refetch',
        name: 'Refetch',
        icon: '',
        filters: [],
        basePath: '/docs',
        createdAt: 1000,
        updatedAt: 1000,
      };
      mockGetCollection.mockReturnValue(collection);
      mockReadDirectory.mockResolvedValue([makeFile('a.txt')]);

      const { result } = renderHook(() => useCollectionFiles('col-refetch', '/fallback'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.files).toHaveLength(1);

      // Now simulate a new file appearing
      mockReadDirectory.mockResolvedValue([makeFile('a.txt'), makeFile('b.txt')]);

      await act(async () => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.files).toHaveLength(2);
      });
    });
  });

  describe('Collection ID change', () => {
    it('resets files when collectionId changes to null', async () => {
      const collection = {
        id: 'col-change',
        name: 'Change',
        icon: '',
        filters: [],
        basePath: '/docs',
        createdAt: 1000,
        updatedAt: 1000,
      };
      mockGetCollection.mockReturnValue(collection);
      mockReadDirectory.mockResolvedValue([makeFile('a.txt')]);

      const { result, rerender } = renderHook(
        ({ id }: { id: string | null }) => useCollectionFiles(id, '/fallback'),
        { initialProps: { id: 'col-change' as string | null } },
      );

      await waitFor(() => {
        expect(result.current.files).toHaveLength(1);
      });

      // Change to null
      mockGetCollection.mockReturnValue(null);
      rerender({ id: null });

      await waitFor(() => {
        expect(result.current.files).toEqual([]);
        expect(result.current.collection).toBeNull();
      });
    });
  });
});
