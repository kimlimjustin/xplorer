import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreviewHistory } from '@/hooks/use-preview-history';
import type { FileEntry } from '@/lib/tauri-api';

const makeFile = (name: string, path?: string): FileEntry => {
  return {
    name,
    path: path ?? `/home/user/${name}`,
    is_dir: false,
    size: 100,
    modified: Date.now(),
    file_type: 'file',
  };
};

describe('usePreviewHistory', () => {
  describe('initial state', () => {
    it('starts with empty history', () => {
      const { result } = renderHook(() => usePreviewHistory());
      expect(result.current.getHistory()).toEqual([]);
    });

    it('has versionRef starting at 0', () => {
      const { result } = renderHook(() => usePreviewHistory());
      expect(result.current.versionRef.current).toBe(0);
    });
  });

  describe('addToHistory', () => {
    it('adds a file to history', () => {
      const { result } = renderHook(() => usePreviewHistory());
      const file = makeFile('test.txt');

      act(() => {
        result.current.addToHistory(file);
      });

      const history = result.current.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].file.name).toBe('test.txt');
    });

    it('prepends most recent entry first', () => {
      const { result } = renderHook(() => usePreviewHistory());
      const file1 = makeFile('first.txt');
      const file2 = makeFile('second.txt');

      act(() => {
        result.current.addToHistory(file1);
        result.current.addToHistory(file2);
      });

      const history = result.current.getHistory();
      expect(history[0].file.name).toBe('second.txt');
      expect(history[1].file.name).toBe('first.txt');
    });

    it('deduplicates by path', () => {
      const { result } = renderHook(() => usePreviewHistory());
      const file = makeFile('test.txt', '/home/user/test.txt');

      act(() => {
        result.current.addToHistory(file);
        result.current.addToHistory(file);
      });

      expect(result.current.getHistory()).toHaveLength(1);
    });

    it('moves duplicate to front on re-add', () => {
      const { result } = renderHook(() => usePreviewHistory());
      const file1 = makeFile('a.txt', '/a.txt');
      const file2 = makeFile('b.txt', '/b.txt');

      act(() => {
        result.current.addToHistory(file1);
        result.current.addToHistory(file2);
        // Re-add file1 — should move to front
        result.current.addToHistory(file1);
      });

      const history = result.current.getHistory();
      expect(history[0].file.path).toBe('/a.txt');
      expect(history[1].file.path).toBe('/b.txt');
    });

    it('caps history at 10 entries (MAX_HISTORY)', () => {
      const { result } = renderHook(() => usePreviewHistory());

      act(() => {
        for (let i = 0; i < 15; i++) {
          result.current.addToHistory(makeFile(`file${i}.txt`, `/file${i}`));
        }
      });

      expect(result.current.getHistory()).toHaveLength(10);
    });

    it('increments versionRef on each add', () => {
      const { result } = renderHook(() => usePreviewHistory());

      act(() => {
        result.current.addToHistory(makeFile('a.txt'));
      });
      expect(result.current.versionRef.current).toBe(1);

      act(() => {
        result.current.addToHistory(makeFile('b.txt'));
      });
      expect(result.current.versionRef.current).toBe(2);
    });

    it('sets timestamp on each entry', () => {
      const { result } = renderHook(() => usePreviewHistory());

      act(() => {
        result.current.addToHistory(makeFile('a.txt'));
      });

      const entry = result.current.getHistory()[0];
      expect(typeof entry.timestamp).toBe('number');
      expect(entry.timestamp).toBeGreaterThan(0);
    });
  });

  describe('clearHistory', () => {
    it('clears all entries', () => {
      const { result } = renderHook(() => usePreviewHistory());

      act(() => {
        result.current.addToHistory(makeFile('a.txt'));
        result.current.addToHistory(makeFile('b.txt'));
      });
      expect(result.current.getHistory()).toHaveLength(2);

      act(() => {
        result.current.clearHistory();
      });
      expect(result.current.getHistory()).toEqual([]);
    });

    it('increments versionRef', () => {
      const { result } = renderHook(() => usePreviewHistory());

      act(() => {
        result.current.addToHistory(makeFile('a.txt'));
      });
      const vBefore = result.current.versionRef.current;

      act(() => {
        result.current.clearHistory();
      });
      expect(result.current.versionRef.current).toBe(vBefore + 1);
    });

    it('is safe to call on empty history', () => {
      const { result } = renderHook(() => usePreviewHistory());

      act(() => {
        result.current.clearHistory();
      });
      expect(result.current.getHistory()).toEqual([]);
    });
  });

  describe('getHistory', () => {
    it('returns a snapshot of the history array', () => {
      const { result } = renderHook(() => usePreviewHistory());

      act(() => {
        result.current.addToHistory(makeFile('a.txt'));
      });

      const snap1 = result.current.getHistory();
      expect(snap1).toHaveLength(1);

      act(() => {
        result.current.addToHistory(makeFile('b.txt'));
      });

      const snap2 = result.current.getHistory();
      expect(snap2).toHaveLength(2);
    });
  });
});
