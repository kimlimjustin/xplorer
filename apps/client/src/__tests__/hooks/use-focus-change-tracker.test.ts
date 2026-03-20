import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFocusChangeTracker } from '@/hooks/use-focus-change-tracker';
import { TauriAPI } from '@/lib/tauri-api';
import type { FileEntry } from '@/lib/tauri-api';

const makeFile = (name: string, path: string, size = 1024, modified = 1700000000): FileEntry => {
  return {
    name,
    path,
    is_dir: false,
    size,
    modified,
    file_type: 'file',
  };
};

describe('useFocusChangeTracker', () => {
  let originalHidden: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    originalHidden = document.hidden;
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restore document.hidden
    Object.defineProperty(document, 'hidden', {
      value: originalHidden,
      writable: true,
      configurable: true,
    });
  });

  const simulateVisibilityChange = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', {
      value: hidden,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  describe('Initial state', () => {
    it('returns null changes initially', () => {
      const { result } = renderHook(() => useFocusChangeTracker('/test'));

      expect(result.current.changes).toBeNull();
    });

    it('returns a dismissChanges function', () => {
      const { result } = renderHook(() => useFocusChangeTracker('/test'));

      expect(typeof result.current.dismissChanges).toBe('function');
    });
  });

  describe('Visibility change - losing focus', () => {
    it('takes a snapshot when document becomes hidden', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      mockReadDir.mockResolvedValue([makeFile('a.txt', '/test/a.txt')]);

      renderHook(() => useFocusChangeTracker('/test'));

      await act(async () => {
        simulateVisibilityChange(true);
      });

      // readDirectory should be called to snapshot
      expect(mockReadDir).toHaveBeenCalledWith('/test');
    });

    it('does not take snapshot for xplorer:// paths', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);

      renderHook(() => useFocusChangeTracker('xplorer://home'));

      await act(async () => {
        simulateVisibilityChange(true);
      });

      expect(mockReadDir).not.toHaveBeenCalled();
    });

    it('does not take snapshot for gdrive:// paths', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);

      renderHook(() => useFocusChangeTracker('gdrive://root'));

      await act(async () => {
        simulateVisibilityChange(true);
      });

      expect(mockReadDir).not.toHaveBeenCalled();
    });

    it('does not take snapshot for comparison:// paths', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);

      renderHook(() => useFocusChangeTracker('comparison://test'));

      await act(async () => {
        simulateVisibilityChange(true);
      });

      expect(mockReadDir).not.toHaveBeenCalled();
    });

    it('does not take snapshot for empty path', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);

      renderHook(() => useFocusChangeTracker(''));

      await act(async () => {
        simulateVisibilityChange(true);
      });

      expect(mockReadDir).not.toHaveBeenCalled();
    });
  });

  describe('Visibility change - regaining focus', () => {
    it('does not detect changes if away less than 5 minutes', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      mockReadDir.mockResolvedValue([makeFile('a.txt', '/test/a.txt')]);

      const { result } = renderHook(() => useFocusChangeTracker('/test'));

      // Lose focus
      await act(async () => {
        simulateVisibilityChange(true);
      });

      // Only advance 1 minute (less than MIN_AWAY_TIME of 5 minutes)
      vi.advanceTimersByTime(60_000);

      // Regain focus
      await act(async () => {
        simulateVisibilityChange(false);
      });

      expect(result.current.changes).toBeNull();
    });

    it('detects added files when away for 5+ minutes', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);

      // Snapshot: only a.txt
      const snapshotFiles = [makeFile('a.txt', '/test/a.txt', 100, 1700000000)];

      // After returning: a.txt + b.txt (new file)
      const currentFiles = [
        makeFile('a.txt', '/test/a.txt', 100, 1700000000),
        makeFile('b.txt', '/test/b.txt', 200, 1700001000),
      ];

      let callCount = 0;
      mockReadDir.mockImplementation(async () => {
        callCount++;
        // First call is for snapshot, second is for comparison
        if (callCount <= 1) return snapshotFiles;
        return currentFiles;
      });

      const { result } = renderHook(() => useFocusChangeTracker('/test'));

      // Lose focus
      await act(async () => {
        simulateVisibilityChange(true);
      });

      // Advance 6 minutes (>5 min MIN_AWAY_TIME)
      vi.advanceTimersByTime(360_000);

      // Regain focus
      await act(async () => {
        simulateVisibilityChange(false);
      });

      expect(result.current.changes).not.toBeNull();
      expect(result.current.changes!.added).toHaveLength(1);
      expect(result.current.changes!.added[0].name).toBe('b.txt');
      expect(result.current.changes!.added[0].type).toBe('added');
      expect(result.current.changes!.totalCount).toBe(1);
    });

    it('detects removed files', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);

      const snapshotFiles = [
        makeFile('a.txt', '/test/a.txt', 100, 1700000000),
        makeFile('b.txt', '/test/b.txt', 200, 1700001000),
      ];

      // After returning: only a.txt (b.txt removed)
      const currentFiles = [makeFile('a.txt', '/test/a.txt', 100, 1700000000)];

      let callCount = 0;
      mockReadDir.mockImplementation(async () => {
        callCount++;
        if (callCount <= 1) return snapshotFiles;
        return currentFiles;
      });

      const { result } = renderHook(() => useFocusChangeTracker('/test'));

      await act(async () => {
        simulateVisibilityChange(true);
      });

      vi.advanceTimersByTime(360_000);

      await act(async () => {
        simulateVisibilityChange(false);
      });

      expect(result.current.changes).not.toBeNull();
      expect(result.current.changes!.removed).toHaveLength(1);
      expect(result.current.changes!.removed[0].name).toBe('b.txt');
      expect(result.current.changes!.removed[0].type).toBe('removed');
    });

    it('detects modified files (size change)', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);

      const snapshotFiles = [makeFile('a.txt', '/test/a.txt', 100, 1700000000)];

      // After returning: a.txt with different size
      const currentFiles = [makeFile('a.txt', '/test/a.txt', 500, 1700000000)];

      let callCount = 0;
      mockReadDir.mockImplementation(async () => {
        callCount++;
        if (callCount <= 1) return snapshotFiles;
        return currentFiles;
      });

      const { result } = renderHook(() => useFocusChangeTracker('/test'));

      await act(async () => {
        simulateVisibilityChange(true);
      });

      vi.advanceTimersByTime(360_000);

      await act(async () => {
        simulateVisibilityChange(false);
      });

      expect(result.current.changes).not.toBeNull();
      expect(result.current.changes!.modified).toHaveLength(1);
      expect(result.current.changes!.modified[0].name).toBe('a.txt');
      expect(result.current.changes!.modified[0].type).toBe('modified');
    });

    it('detects modified files (mtime change)', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);

      const snapshotFiles = [makeFile('a.txt', '/test/a.txt', 100, 1700000000)];

      const currentFiles = [makeFile('a.txt', '/test/a.txt', 100, 1700009999)];

      let callCount = 0;
      mockReadDir.mockImplementation(async () => {
        callCount++;
        if (callCount <= 1) return snapshotFiles;
        return currentFiles;
      });

      const { result } = renderHook(() => useFocusChangeTracker('/test'));

      await act(async () => {
        simulateVisibilityChange(true);
      });

      vi.advanceTimersByTime(360_000);

      await act(async () => {
        simulateVisibilityChange(false);
      });

      expect(result.current.changes).not.toBeNull();
      expect(result.current.changes!.modified).toHaveLength(1);
    });

    it('returns null when no changes detected', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);

      const files = [makeFile('a.txt', '/test/a.txt', 100, 1700000000)];

      mockReadDir.mockResolvedValue(files);

      const { result } = renderHook(() => useFocusChangeTracker('/test'));

      await act(async () => {
        simulateVisibilityChange(true);
      });

      vi.advanceTimersByTime(360_000);

      await act(async () => {
        simulateVisibilityChange(false);
      });

      expect(result.current.changes).toBeNull();
    });
  });

  describe('dismissChanges', () => {
    it('sets changes back to null', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);

      let callCount = 0;
      mockReadDir.mockImplementation(async () => {
        callCount++;
        if (callCount <= 1) return [makeFile('a.txt', '/test/a.txt')];
        return [makeFile('a.txt', '/test/a.txt'), makeFile('b.txt', '/test/b.txt')];
      });

      const { result } = renderHook(() => useFocusChangeTracker('/test'));

      await act(async () => {
        simulateVisibilityChange(true);
      });

      vi.advanceTimersByTime(360_000);

      await act(async () => {
        simulateVisibilityChange(false);
      });

      expect(result.current.changes).not.toBeNull();

      act(() => {
        result.current.dismissChanges();
      });

      expect(result.current.changes).toBeNull();
    });
  });

  describe('Path changes', () => {
    it('resets changes when currentPath changes', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);

      let callCount = 0;
      mockReadDir.mockImplementation(async () => {
        callCount++;
        if (callCount <= 1) return [makeFile('a.txt', '/test/a.txt')];
        return [makeFile('a.txt', '/test/a.txt'), makeFile('b.txt', '/test/b.txt')];
      });

      const { result, rerender } = renderHook(
        ({ path }: { path: string }) => useFocusChangeTracker(path),
        { initialProps: { path: '/test' } },
      );

      // Trigger changes
      await act(async () => {
        simulateVisibilityChange(true);
      });

      vi.advanceTimersByTime(360_000);

      await act(async () => {
        simulateVisibilityChange(false);
      });

      // Changes were detected
      expect(result.current.changes).not.toBeNull();

      // Navigate to a different directory
      rerender({ path: '/other' });

      // Changes should be cleared
      expect(result.current.changes).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('handles readDirectory errors during snapshot gracefully', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);
      mockReadDir.mockRejectedValue(new Error('Access denied'));

      const { result } = renderHook(() => useFocusChangeTracker('/test'));

      await act(async () => {
        simulateVisibilityChange(true);
      });

      vi.advanceTimersByTime(360_000);

      await act(async () => {
        simulateVisibilityChange(false);
      });

      // Should not crash, changes remain null
      expect(result.current.changes).toBeNull();
    });

    it('handles readDirectory errors during comparison gracefully', async () => {
      const mockReadDir = vi.mocked(TauriAPI.readDirectory);

      let callCount = 0;
      mockReadDir.mockImplementation(async () => {
        callCount++;
        if (callCount <= 1) return [makeFile('a.txt', '/test/a.txt')];
        throw new Error('Read error');
      });

      const { result } = renderHook(() => useFocusChangeTracker('/test'));

      await act(async () => {
        simulateVisibilityChange(true);
      });

      vi.advanceTimersByTime(360_000);

      await act(async () => {
        simulateVisibilityChange(false);
      });

      expect(result.current.changes).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('removes event listener on unmount', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => useFocusChangeTracker('/test'));

      unmount();

      expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

      removeSpy.mockRestore();
    });
  });
});
