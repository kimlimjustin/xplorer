import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  getHistory,
  getEntry,
  addEntry,
  clearHistory,
  getRecentEntries,
} from '@/hooks/use-clipboard-history';

const STORAGE_KEY = 'xplorer:clipboard-history';

describe('use-clipboard-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe('getHistory', () => {
    it('returns empty array when sessionStorage is empty', () => {
      expect(getHistory()).toEqual([]);
    });

    it('returns parsed entries from sessionStorage', () => {
      const entries = [
        {
          id: 'clip-1',
          files: [{ path: '/a.txt', name: 'a.txt', isDir: false }],
          operation: 'copy',
          timestamp: 1000,
        },
      ];
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const result = getHistory();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('clip-1');
    });

    it('returns empty array on corrupted JSON', () => {
      sessionStorage.setItem(STORAGE_KEY, '{not valid json');

      expect(getHistory()).toEqual([]);
    });

    it('returns empty array when stored value is not an array', () => {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));

      expect(getHistory()).toEqual([]);
    });
  });

  describe('addEntry', () => {
    it('adds a new clipboard entry to storage', () => {
      const files = [{ path: '/test/a.txt', name: 'a.txt', isDir: false }];

      const entry = addEntry(files, 'copy');

      expect(entry.id).toMatch(/^clip-/);
      expect(entry.files).toEqual(files);
      expect(entry.operation).toBe('copy');
      expect(entry.timestamp).toBeGreaterThan(0);
    });

    it('prepends new entries (newest first)', () => {
      addEntry([{ path: '/first.txt', name: 'first.txt', isDir: false }], 'copy');
      addEntry([{ path: '/second.txt', name: 'second.txt', isDir: false }], 'copy');

      const history = getHistory();
      expect(history[0].files[0].path).toBe('/second.txt');
      expect(history[1].files[0].path).toBe('/first.txt');
    });

    it('deduplicates entries with the same paths and operation', () => {
      const files = [{ path: '/test.txt', name: 'test.txt', isDir: false }];

      addEntry(files, 'copy');
      addEntry(files, 'copy');

      const history = getHistory();
      expect(history).toHaveLength(1);
    });

    it('does NOT deduplicate when operation differs (copy vs cut)', () => {
      const files = [{ path: '/test.txt', name: 'test.txt', isDir: false }];

      addEntry(files, 'copy');
      addEntry(files, 'cut');

      const history = getHistory();
      expect(history).toHaveLength(2);
    });

    it('does NOT deduplicate when paths differ', () => {
      addEntry([{ path: '/a.txt', name: 'a.txt', isDir: false }], 'copy');
      addEntry([{ path: '/b.txt', name: 'b.txt', isDir: false }], 'copy');

      const history = getHistory();
      expect(history).toHaveLength(2);
    });

    it('trims history to MAX_ENTRIES (15)', () => {
      for (let i = 0; i < 20; i++) {
        addEntry([{ path: `/file-${i}.txt`, name: `file-${i}.txt`, isDir: false }], 'copy');
      }

      const history = getHistory();
      expect(history.length).toBeLessThanOrEqual(15);
    });

    it('keeps the most recent entries when trimming', () => {
      for (let i = 0; i < 20; i++) {
        addEntry([{ path: `/file-${i}.txt`, name: `file-${i}.txt`, isDir: false }], 'copy');
      }

      const history = getHistory();
      const paths = history.map((e) => e.files[0].path);
      // The latest entry should be present
      expect(paths).toContain('/file-19.txt');
    });

    it('dispatches clipboard-history-changed event', () => {
      const handler = vi.fn();
      window.addEventListener('clipboard-history-changed', handler);

      addEntry([{ path: '/a.txt', name: 'a.txt', isDir: false }], 'copy');

      expect(handler).toHaveBeenCalledTimes(1);

      window.removeEventListener('clipboard-history-changed', handler);
    });

    it('handles multi-file entries', () => {
      const files = [
        { path: '/a.txt', name: 'a.txt', isDir: false },
        { path: '/b.txt', name: 'b.txt', isDir: false },
        { path: '/folder', name: 'folder', isDir: true },
      ];

      const entry = addEntry(files, 'cut');

      expect(entry.files).toHaveLength(3);
      expect(entry.operation).toBe('cut');
    });
  });

  describe('getEntry', () => {
    it('returns entry by id', () => {
      const entry = addEntry([{ path: '/a.txt', name: 'a.txt', isDir: false }], 'copy');

      const found = getEntry(entry.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(entry.id);
    });

    it('returns undefined for non-existent id', () => {
      expect(getEntry('clip-nonexistent')).toBeUndefined();
    });
  });

  describe('clearHistory', () => {
    it('removes all entries', () => {
      addEntry([{ path: '/a.txt', name: 'a.txt', isDir: false }], 'copy');
      addEntry([{ path: '/b.txt', name: 'b.txt', isDir: false }], 'cut');

      clearHistory();

      expect(getHistory()).toEqual([]);
    });

    it('dispatches clipboard-history-changed event', () => {
      const handler = vi.fn();
      window.addEventListener('clipboard-history-changed', handler);

      clearHistory();

      expect(handler).toHaveBeenCalledTimes(1);

      window.removeEventListener('clipboard-history-changed', handler);
    });
  });

  describe('getRecentEntries', () => {
    it('returns first N entries (default 5)', () => {
      for (let i = 0; i < 10; i++) {
        addEntry([{ path: `/file-${i}.txt`, name: `file-${i}.txt`, isDir: false }], 'copy');
      }

      const recent = getRecentEntries();
      expect(recent).toHaveLength(5);
    });

    it('returns custom count when specified', () => {
      for (let i = 0; i < 10; i++) {
        addEntry([{ path: `/file-${i}.txt`, name: `file-${i}.txt`, isDir: false }], 'copy');
      }

      const recent = getRecentEntries(3);
      expect(recent).toHaveLength(3);
    });

    it('returns all entries when count exceeds available', () => {
      addEntry([{ path: '/a.txt', name: 'a.txt', isDir: false }], 'copy');
      addEntry([{ path: '/b.txt', name: 'b.txt', isDir: false }], 'copy');

      const recent = getRecentEntries(10);
      expect(recent).toHaveLength(2);
    });

    it('returns empty array when no history exists', () => {
      expect(getRecentEntries()).toEqual([]);
    });
  });
});
