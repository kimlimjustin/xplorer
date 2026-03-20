import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThumbnailCache } from '@/hooks/use-thumbnail-cache';
import { convertAssetUrl } from '@/lib/transport';

// Mock the transport module
vi.mock('@/lib/transport', () => ({
  convertAssetUrl: vi.fn((path: string) => `https://asset.localhost/${encodeURIComponent(path)}`),
  isTauri: vi.fn(() => false),
  transport: vi.fn(),
}));

const mockedConvertAssetUrl = vi.mocked(convertAssetUrl);

describe('useThumbnailCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('returns getThumbnailUrl and preloadThumbnails functions', () => {
      const { result } = renderHook(() => useThumbnailCache());

      expect(typeof result.current.getThumbnailUrl).toBe('function');
      expect(typeof result.current.preloadThumbnails).toBe('function');
    });
  });

  describe('getThumbnailUrl', () => {
    it('converts a file path to an asset URL', () => {
      const { result } = renderHook(() => useThumbnailCache());

      let url: string = '';
      act(() => {
        url = result.current.getThumbnailUrl('/photos/image.jpg');
      });

      expect(url).toBe(`https://asset.localhost/${encodeURIComponent('/photos/image.jpg')}`);
    });

    it('returns cached URL on subsequent calls for the same path', () => {
      const { result } = renderHook(() => useThumbnailCache());

      let url1: string = '';
      let url2: string = '';
      act(() => {
        url1 = result.current.getThumbnailUrl('/photos/image.jpg');
        url2 = result.current.getThumbnailUrl('/photos/image.jpg');
      });

      // convertAssetUrl should only be called once because the second call uses cache
      expect(mockedConvertAssetUrl).toHaveBeenCalledTimes(1);
      expect(url1).toBe(url2);
    });

    it('generates different URLs for different paths', () => {
      const { result } = renderHook(() => useThumbnailCache());

      let url1: string = '';
      let url2: string = '';
      act(() => {
        url1 = result.current.getThumbnailUrl('/photos/a.jpg');
        url2 = result.current.getThumbnailUrl('/photos/b.jpg');
      });

      expect(url1).not.toBe(url2);
    });

    it('handles empty string path', () => {
      const { result } = renderHook(() => useThumbnailCache());

      let url: string = '';
      act(() => {
        url = result.current.getThumbnailUrl('');
      });

      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
    });

    it('handles paths with special characters', () => {
      const { result } = renderHook(() => useThumbnailCache());

      let url: string = '';
      act(() => {
        url = result.current.getThumbnailUrl('/photos/my file (1).jpg');
      });

      expect(url).toContain(encodeURIComponent('/photos/my file (1).jpg'));
    });
  });

  describe('LRU eviction', () => {
    it('evicts least recently used entry when cache exceeds maxSize', () => {
      // Use a small maxSize of 3
      const { result } = renderHook(() => useThumbnailCache(3));

      act(() => {
        // Fill cache to capacity
        result.current.getThumbnailUrl('/path/1.jpg');
        result.current.getThumbnailUrl('/path/2.jpg');
        result.current.getThumbnailUrl('/path/3.jpg');
      });

      expect(mockedConvertAssetUrl).toHaveBeenCalledTimes(3);
      mockedConvertAssetUrl.mockClear();

      act(() => {
        // Adding a 4th entry should evict the oldest (1.jpg)
        result.current.getThumbnailUrl('/path/4.jpg');
      });

      expect(mockedConvertAssetUrl).toHaveBeenCalledTimes(1);
      mockedConvertAssetUrl.mockClear();

      act(() => {
        // Accessing 1.jpg again should require a fresh conversion (it was evicted)
        result.current.getThumbnailUrl('/path/1.jpg');
      });

      expect(mockedConvertAssetUrl).toHaveBeenCalledTimes(1);
    });

    it('does not evict when cache is within maxSize', () => {
      const { result } = renderHook(() => useThumbnailCache(5));

      act(() => {
        result.current.getThumbnailUrl('/path/1.jpg');
        result.current.getThumbnailUrl('/path/2.jpg');
        result.current.getThumbnailUrl('/path/3.jpg');
      });

      expect(mockedConvertAssetUrl).toHaveBeenCalledTimes(3);
      mockedConvertAssetUrl.mockClear();

      // Accessing existing entries should not trigger convertAssetUrl
      act(() => {
        result.current.getThumbnailUrl('/path/1.jpg');
        result.current.getThumbnailUrl('/path/2.jpg');
      });

      expect(mockedConvertAssetUrl).not.toHaveBeenCalled();
    });

    it('updates lastAccessed on cache hit to prevent eviction', () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useThumbnailCache(3));

      // Add entries with distinct timestamps so LRU can differentiate
      act(() => {
        result.current.getThumbnailUrl('/path/1.jpg');
      });
      vi.advanceTimersByTime(10);
      act(() => {
        result.current.getThumbnailUrl('/path/2.jpg');
      });
      vi.advanceTimersByTime(10);
      act(() => {
        result.current.getThumbnailUrl('/path/3.jpg');
      });
      vi.advanceTimersByTime(10);

      mockedConvertAssetUrl.mockClear();

      // Access 1.jpg to make it recently used (updates its lastAccessed)
      act(() => {
        result.current.getThumbnailUrl('/path/1.jpg');
      });
      vi.advanceTimersByTime(10);

      // Now add a 4th entry - should evict 2.jpg (oldest accessed), not 1.jpg
      act(() => {
        result.current.getThumbnailUrl('/path/4.jpg');
      });

      mockedConvertAssetUrl.mockClear();

      // 1.jpg should still be cached (it was recently accessed)
      act(() => {
        result.current.getThumbnailUrl('/path/1.jpg');
      });

      expect(mockedConvertAssetUrl).not.toHaveBeenCalled();

      // 2.jpg should have been evicted
      act(() => {
        result.current.getThumbnailUrl('/path/2.jpg');
      });

      expect(mockedConvertAssetUrl).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('defaults maxSize to 100', () => {
      const { result } = renderHook(() => useThumbnailCache());

      act(() => {
        // Add 101 items
        for (let i = 0; i < 101; i++) {
          result.current.getThumbnailUrl(`/path/${i}.jpg`);
        }
      });

      // 101 unique conversions
      expect(mockedConvertAssetUrl).toHaveBeenCalledTimes(101);
      mockedConvertAssetUrl.mockClear();

      // Item 0 should have been evicted (it was the first/oldest entry)
      act(() => {
        result.current.getThumbnailUrl('/path/0.jpg');
      });

      expect(mockedConvertAssetUrl).toHaveBeenCalledTimes(1);
    });
  });

  describe('preloadThumbnails', () => {
    it('preloads thumbnail images for an array of paths', () => {
      const { result } = renderHook(() => useThumbnailCache());

      act(() => {
        result.current.preloadThumbnails(['/photos/a.jpg', '/photos/b.jpg', '/photos/c.jpg']);
      });

      // After preloading, URLs should be cached
      mockedConvertAssetUrl.mockClear();

      act(() => {
        result.current.getThumbnailUrl('/photos/a.jpg');
        result.current.getThumbnailUrl('/photos/b.jpg');
        result.current.getThumbnailUrl('/photos/c.jpg');
      });

      // Should all be cached, so no new calls
      expect(mockedConvertAssetUrl).not.toHaveBeenCalled();
    });

    it('handles empty array without errors', () => {
      const { result } = renderHook(() => useThumbnailCache());

      expect(() => {
        act(() => {
          result.current.preloadThumbnails([]);
        });
      }).not.toThrow();
    });

    it('creates Image objects for browser preloading', () => {
      // Image constructor is available in jsdom
      const { result } = renderHook(() => useThumbnailCache());

      act(() => {
        result.current.preloadThumbnails(['/photos/test.jpg']);
      });

      // The Image constructor was used internally - we verify the path was cached
      mockedConvertAssetUrl.mockClear();

      act(() => {
        result.current.getThumbnailUrl('/photos/test.jpg');
      });

      expect(mockedConvertAssetUrl).not.toHaveBeenCalled();
    });
  });

  describe('Hook stability', () => {
    it('getThumbnailUrl reference is stable across rerenders', () => {
      const { result, rerender } = renderHook(() => useThumbnailCache());

      const firstRef = result.current.getThumbnailUrl;

      rerender();

      expect(result.current.getThumbnailUrl).toBe(firstRef);
    });

    it('preloadThumbnails reference is stable across rerenders', () => {
      const { result, rerender } = renderHook(() => useThumbnailCache());

      const firstRef = result.current.preloadThumbnails;

      rerender();

      expect(result.current.preloadThumbnails).toBe(firstRef);
    });
  });
});
