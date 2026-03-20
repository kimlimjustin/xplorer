import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePaneSync, emitPaneSyncNavigate, computeRelativeSyncPath } from '@/hooks/use-pane-sync';

describe('usePaneSync', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => mockStorage[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      mockStorage[key] = value;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial state', () => {
    it('defaults to disabled', () => {
      const { result } = renderHook(() => usePaneSync());
      expect(result.current.enabled).toBe(false);
    });

    it('defaults to mirror sync mode', () => {
      const { result } = renderHook(() => usePaneSync());
      expect(result.current.syncMode).toBe('mirror');
    });

    it('reads enabled state from localStorage', () => {
      mockStorage['xplorer:pane-sync-enabled'] = 'true';
      const { result } = renderHook(() => usePaneSync());
      expect(result.current.enabled).toBe(true);
    });

    it('reads sync mode from localStorage', () => {
      mockStorage['xplorer:pane-sync-mode'] = 'relative';
      const { result } = renderHook(() => usePaneSync());
      expect(result.current.syncMode).toBe('relative');
    });

    it('falls back to mirror for invalid stored mode', () => {
      mockStorage['xplorer:pane-sync-mode'] = 'invalid';
      const { result } = renderHook(() => usePaneSync());
      expect(result.current.syncMode).toBe('mirror');
    });
  });

  describe('toggle', () => {
    it('toggles enabled state from false to true', () => {
      const { result } = renderHook(() => usePaneSync());

      act(() => {
        result.current.toggle();
      });

      expect(result.current.enabled).toBe(true);
    });

    it('toggles enabled state from true to false', () => {
      mockStorage['xplorer:pane-sync-enabled'] = 'true';
      const { result } = renderHook(() => usePaneSync());

      act(() => {
        result.current.toggle();
      });

      expect(result.current.enabled).toBe(false);
    });

    it('persists to localStorage', () => {
      const { result } = renderHook(() => usePaneSync());

      act(() => {
        result.current.toggle();
      });

      expect(mockStorage['xplorer:pane-sync-enabled']).toBe('true');
    });
  });

  describe('setSyncMode', () => {
    it('updates sync mode to relative', () => {
      const { result } = renderHook(() => usePaneSync());

      act(() => {
        result.current.setSyncMode('relative');
      });

      expect(result.current.syncMode).toBe('relative');
    });

    it('updates sync mode to mirror', () => {
      mockStorage['xplorer:pane-sync-mode'] = 'relative';
      const { result } = renderHook(() => usePaneSync());

      act(() => {
        result.current.setSyncMode('mirror');
      });

      expect(result.current.syncMode).toBe('mirror');
    });

    it('persists mode to localStorage', () => {
      const { result } = renderHook(() => usePaneSync());

      act(() => {
        result.current.setSyncMode('relative');
      });

      expect(mockStorage['xplorer:pane-sync-mode']).toBe('relative');
    });
  });
});

describe('emitPaneSyncNavigate', () => {
  it('dispatches pane-sync-navigate custom event', () => {
    const listener = vi.fn();
    window.addEventListener('pane-sync-navigate', listener);

    emitPaneSyncNavigate({
      sourceGroupId: 'pane-1',
      path: 'C:\\Users\\Test\\Documents',
      previousPath: 'C:\\Users\\Test',
      mode: 'mirror',
    });

    expect(listener).toHaveBeenCalledTimes(1);

    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.sourceGroupId).toBe('pane-1');
    expect(event.detail.path).toBe('C:\\Users\\Test\\Documents');
    expect(event.detail.mode).toBe('mirror');

    window.removeEventListener('pane-sync-navigate', listener);
  });
});

describe('computeRelativeSyncPath', () => {
  describe('Navigating down (into a subfolder)', () => {
    it('computes relative path for entering a subfolder', () => {
      const result = computeRelativeSyncPath(
        'C:\\Users\\Alice\\Documents',
        'C:\\Users\\Alice\\Documents\\reports',
        'D:\\Shared\\Documents',
      );
      // The function normalizes to lowercase internally; the output uses
      // the receiver's separator style but the casing comes from normalization
      expect(result?.toLowerCase()).toBe('d:\\shared\\documents\\reports');
    });

    it('handles forward slashes', () => {
      const result = computeRelativeSyncPath(
        '/home/alice/Documents',
        '/home/alice/Documents/reports',
        '/home/bob/Documents',
      );
      expect(result?.toLowerCase()).toBe('/home/bob/documents/reports');
    });

    it('handles nested subfolder navigation', () => {
      const result = computeRelativeSyncPath(
        'C:\\Users\\Alice',
        'C:\\Users\\Alice\\docs\\work',
        'D:\\Backup',
      );
      expect(result?.toLowerCase()).toBe('d:\\backup\\docs\\work');
    });
  });

  describe('Navigating up (to parent folder)', () => {
    it('computes relative path for going up one level', () => {
      const result = computeRelativeSyncPath(
        'C:\\Users\\Alice\\Documents\\reports',
        'C:\\Users\\Alice\\Documents',
        'D:\\Shared\\Documents\\archive',
      );
      // normalizePath lowercases, denormalizePath converts back using receiver sep
      expect(result?.toLowerCase().replace(/\\$/, '')).toBe('d:\\shared\\documents');
    });

    it('handles going up multiple levels', () => {
      const result = computeRelativeSyncPath(
        '/home/alice/docs/work/projects',
        '/home/alice/docs',
        '/home/bob/docs/other/files',
      );
      expect(result?.toLowerCase()).toBe('/home/bob/docs');
    });

    it('returns null when receiver cannot go up further', () => {
      const result = computeRelativeSyncPath(
        'C:\\Users\\Alice\\Documents\\deep\\nested',
        'C:\\Users\\Alice',
        'D:\\short',
      );
      expect(result).toBeNull();
    });
  });

  describe('Unrelated paths', () => {
    it('returns null when paths share no parent-child relationship', () => {
      const result = computeRelativeSyncPath('C:\\Users\\Alice', 'D:\\Other\\Path', 'E:\\Backup');
      expect(result).toBeNull();
    });

    it('returns null for same source paths (no movement)', () => {
      const result = computeRelativeSyncPath('C:\\Users\\Alice', 'C:\\Users\\Alice', 'D:\\Backup');
      expect(result).toBeNull();
    });
  });
});
