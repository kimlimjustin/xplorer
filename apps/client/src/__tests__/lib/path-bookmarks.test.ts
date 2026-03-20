import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getPathBookmarks,
  getBookmarkBySlot,
  getBookmarkForPath,
  setPathBookmark,
  removePathBookmark,
  clearAllBookmarks,
  getFolderName,
} from '@/lib/path-bookmarks';

// ── localStorage mock ─────────────────────────────────────────────────────

const store: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => {
      store[key] = val;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(),
  });
  vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
});

// ── Tests ───────────────────────────────────────────────────────────────

describe('path-bookmarks', () => {
  describe('getPathBookmarks', () => {
    it('returns empty array when no bookmarks exist', () => {
      expect(getPathBookmarks()).toEqual([]);
    });
  });

  describe('setPathBookmark', () => {
    it('creates a bookmark at the specified slot', () => {
      setPathBookmark(1, '/home/user/docs', 'Documents', '\uD83D\uDCC1');

      const bookmarks = getPathBookmarks();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].slot).toBe(1);
      expect(bookmarks[0].path).toBe('/home/user/docs');
      expect(bookmarks[0].label).toBe('Documents');
      expect(bookmarks[0].icon).toBe('\uD83D\uDCC1');
      expect(bookmarks[0].assignedAt).toBeGreaterThan(0);
    });

    it('overwrites existing bookmark at the same slot', () => {
      setPathBookmark(1, '/old/path');
      setPathBookmark(1, '/new/path');

      const bookmarks = getPathBookmarks();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].path).toBe('/new/path');
    });

    it('allows bookmarks at different slots', () => {
      setPathBookmark(1, '/path/a');
      setPathBookmark(2, '/path/b');
      setPathBookmark(9, '/path/z');

      const bookmarks = getPathBookmarks();
      expect(bookmarks).toHaveLength(3);
    });

    it('sorts bookmarks by slot number', () => {
      setPathBookmark(5, '/path/e');
      setPathBookmark(1, '/path/a');
      setPathBookmark(3, '/path/c');

      const bookmarks = getPathBookmarks();
      expect(bookmarks.map((b) => b.slot)).toEqual([1, 3, 5]);
    });

    it('ignores slot < 1', () => {
      setPathBookmark(0, '/invalid');
      expect(getPathBookmarks()).toHaveLength(0);
    });

    it('ignores slot > 9', () => {
      setPathBookmark(10, '/invalid');
      expect(getPathBookmarks()).toHaveLength(0);
    });

    it('dispatches path-bookmarks-changed event', () => {
      setPathBookmark(1, '/test');
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'path-bookmarks-changed' }),
      );
    });
  });

  describe('getBookmarkBySlot', () => {
    it('returns the bookmark at the specified slot', () => {
      setPathBookmark(3, '/my/path', 'Label');
      const bm = getBookmarkBySlot(3);
      expect(bm).not.toBeNull();
      expect(bm!.path).toBe('/my/path');
      expect(bm!.label).toBe('Label');
    });

    it('returns null for empty slot', () => {
      expect(getBookmarkBySlot(5)).toBeNull();
    });

    it('returns null for out-of-range slot', () => {
      expect(getBookmarkBySlot(0)).toBeNull();
      expect(getBookmarkBySlot(10)).toBeNull();
      expect(getBookmarkBySlot(-1)).toBeNull();
    });
  });

  describe('getBookmarkForPath', () => {
    it('returns bookmark matching the given path', () => {
      setPathBookmark(2, '/home/user/music');
      const bm = getBookmarkForPath('/home/user/music');
      expect(bm).not.toBeNull();
      expect(bm!.slot).toBe(2);
    });

    it('returns null when no bookmark has the path', () => {
      setPathBookmark(1, '/some/path');
      expect(getBookmarkForPath('/different/path')).toBeNull();
    });
  });

  describe('removePathBookmark', () => {
    it('removes the bookmark at the specified slot', () => {
      setPathBookmark(1, '/a');
      setPathBookmark(2, '/b');
      removePathBookmark(1);

      const bookmarks = getPathBookmarks();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].slot).toBe(2);
    });

    it('is a no-op for empty slot', () => {
      setPathBookmark(1, '/a');
      removePathBookmark(5);
      expect(getPathBookmarks()).toHaveLength(1);
    });

    it('ignores out-of-range slots', () => {
      setPathBookmark(1, '/a');
      removePathBookmark(0);
      removePathBookmark(10);
      expect(getPathBookmarks()).toHaveLength(1);
    });
  });

  describe('clearAllBookmarks', () => {
    it('removes all bookmarks', () => {
      setPathBookmark(1, '/a');
      setPathBookmark(2, '/b');
      setPathBookmark(3, '/c');

      clearAllBookmarks();
      expect(getPathBookmarks()).toEqual([]);
    });

    it('dispatches event', () => {
      clearAllBookmarks();
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'path-bookmarks-changed' }),
      );
    });
  });

  describe('getFolderName', () => {
    it('extracts folder name from Unix path', () => {
      expect(getFolderName('/home/user/Documents')).toBe('Documents');
    });

    it('extracts folder name from Windows path', () => {
      expect(getFolderName('C:\\Users\\Alice\\Desktop')).toBe('Desktop');
    });

    it('handles trailing slashes', () => {
      expect(getFolderName('/home/user/docs/')).toBe('docs');
    });

    it('handles trailing backslashes', () => {
      expect(getFolderName('C:\\Users\\Alice\\')).toBe('Alice');
    });

    it('returns the path itself for root-like paths', () => {
      expect(getFolderName('/')).toBe('/');
    });

    it('handles single component', () => {
      expect(getFolderName('folder')).toBe('folder');
    });
  });

  describe('storage edge cases', () => {
    it('handles corrupted JSON', () => {
      store['xplorer:path-bookmarks'] = '{{bad';
      expect(getPathBookmarks()).toEqual([]);
    });

    it('handles non-array JSON', () => {
      store['xplorer:path-bookmarks'] = '42';
      expect(getPathBookmarks()).toEqual([]);
    });
  });
});
