import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCrossTabSelection,
  CROSS_TAB_SELECTION_EVENT,
  type CrossTabSelectionEventDetail,
} from '@/hooks/use-cross-tab-selection';
import type { FileEntry } from '@/lib/tauri-api';

const makeFile = (name: string, path: string): FileEntry => {
  return { name, path, is_dir: false, size: 100, modified: Date.now(), file_type: 'file' };
};

describe('useCrossTabSelection', () => {
  describe('initial state', () => {
    it('starts with empty selections', () => {
      const { result } = renderHook(() => useCrossTabSelection());

      expect(result.current.selections.size).toBe(0);
      expect(result.current.totalSelectedCount).toBe(0);
      expect(result.current.selectedTabCount).toBe(0);
      expect(result.current.hasMultiTabSelection).toBe(false);
    });
  });

  describe('addSelection', () => {
    it('adds a selection for a tab', () => {
      const { result } = renderHook(() => useCrossTabSelection());
      const files = [makeFile('a.txt', '/a.txt')];

      act(() => {
        result.current.addSelection('tab1', '/home', files);
      });

      expect(result.current.selections.size).toBe(1);
      expect(result.current.totalSelectedCount).toBe(1);
      expect(result.current.selectedTabCount).toBe(1);
    });

    it('replaces selection for the same tab', () => {
      const { result } = renderHook(() => useCrossTabSelection());

      act(() => {
        result.current.addSelection('tab1', '/home', [makeFile('a.txt', '/a.txt')]);
      });
      expect(result.current.totalSelectedCount).toBe(1);

      act(() => {
        result.current.addSelection('tab1', '/home', [
          makeFile('a.txt', '/a.txt'),
          makeFile('b.txt', '/b.txt'),
        ]);
      });
      expect(result.current.totalSelectedCount).toBe(2);
      expect(result.current.selectedTabCount).toBe(1);
    });

    it('removes tab entry when files array is empty', () => {
      const { result } = renderHook(() => useCrossTabSelection());

      act(() => {
        result.current.addSelection('tab1', '/home', [makeFile('a.txt', '/a.txt')]);
      });
      expect(result.current.selectedTabCount).toBe(1);

      act(() => {
        result.current.addSelection('tab1', '/home', []);
      });
      expect(result.current.selectedTabCount).toBe(0);
    });

    it('supports multi-tab selections', () => {
      const { result } = renderHook(() => useCrossTabSelection());

      act(() => {
        result.current.addSelection('tab1', '/home', [makeFile('a.txt', '/a.txt')]);
        result.current.addSelection('tab2', '/docs', [makeFile('b.txt', '/b.txt')]);
      });

      expect(result.current.selectedTabCount).toBe(2);
      expect(result.current.hasMultiTabSelection).toBe(true);
      expect(result.current.totalSelectedCount).toBe(2);
    });
  });

  describe('clearSelection', () => {
    it('clears selection for a specific tab', () => {
      const { result } = renderHook(() => useCrossTabSelection());

      act(() => {
        result.current.addSelection('tab1', '/home', [makeFile('a.txt', '/a.txt')]);
        result.current.addSelection('tab2', '/docs', [makeFile('b.txt', '/b.txt')]);
      });
      expect(result.current.selectedTabCount).toBe(2);

      act(() => {
        result.current.clearSelection('tab1');
      });

      expect(result.current.selectedTabCount).toBe(1);
      expect(result.current.selections.has('tab1')).toBe(false);
      expect(result.current.selections.has('tab2')).toBe(true);
    });

    it('is safe when tab does not exist', () => {
      const { result } = renderHook(() => useCrossTabSelection());

      act(() => {
        result.current.clearSelection('nonexistent');
      });

      expect(result.current.selectedTabCount).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('clears all selections', () => {
      const { result } = renderHook(() => useCrossTabSelection());

      act(() => {
        result.current.addSelection('tab1', '/home', [makeFile('a.txt', '/a.txt')]);
        result.current.addSelection('tab2', '/docs', [makeFile('b.txt', '/b.txt')]);
      });

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.selections.size).toBe(0);
      expect(result.current.totalSelectedCount).toBe(0);
      expect(result.current.selectedTabCount).toBe(0);
      expect(result.current.hasMultiTabSelection).toBe(false);
    });
  });

  describe('getAllSelectedFiles', () => {
    it('returns empty array when no selections', () => {
      const { result } = renderHook(() => useCrossTabSelection());
      expect(result.current.getAllSelectedFiles()).toEqual([]);
    });

    it('returns flat list with sourceTabPath from all tabs', () => {
      const { result } = renderHook(() => useCrossTabSelection());
      const fileA = makeFile('a.txt', '/a.txt');
      const fileB = makeFile('b.txt', '/b.txt');

      act(() => {
        result.current.addSelection('tab1', '/home', [fileA]);
        result.current.addSelection('tab2', '/docs', [fileB]);
      });

      const all = result.current.getAllSelectedFiles();
      expect(all).toHaveLength(2);

      const tab1File = all.find((f) => f.file.path === '/a.txt');
      expect(tab1File?.sourceTabPath).toBe('/home');

      const tab2File = all.find((f) => f.file.path === '/b.txt');
      expect(tab2File?.sourceTabPath).toBe('/docs');
    });

    it('includes multiple files from same tab', () => {
      const { result } = renderHook(() => useCrossTabSelection());

      act(() => {
        result.current.addSelection('tab1', '/home', [
          makeFile('a.txt', '/a.txt'),
          makeFile('b.txt', '/b.txt'),
          makeFile('c.txt', '/c.txt'),
        ]);
      });

      const all = result.current.getAllSelectedFiles();
      expect(all).toHaveLength(3);
      all.forEach((entry) => {
        expect(entry.sourceTabPath).toBe('/home');
      });
    });
  });

  describe('computed properties', () => {
    it('totalSelectedCount sums files across all tabs', () => {
      const { result } = renderHook(() => useCrossTabSelection());

      act(() => {
        result.current.addSelection('tab1', '/home', [
          makeFile('a.txt', '/a.txt'),
          makeFile('b.txt', '/b.txt'),
        ]);
        result.current.addSelection('tab2', '/docs', [makeFile('c.txt', '/c.txt')]);
      });

      expect(result.current.totalSelectedCount).toBe(3);
    });

    it('hasMultiTabSelection is false with only one tab', () => {
      const { result } = renderHook(() => useCrossTabSelection());

      act(() => {
        result.current.addSelection('tab1', '/home', [makeFile('a.txt', '/a.txt')]);
      });

      expect(result.current.hasMultiTabSelection).toBe(false);
    });

    it('hasMultiTabSelection is true with two or more tabs', () => {
      const { result } = renderHook(() => useCrossTabSelection());

      act(() => {
        result.current.addSelection('tab1', '/home', [makeFile('a.txt', '/a.txt')]);
        result.current.addSelection('tab2', '/docs', [makeFile('b.txt', '/b.txt')]);
      });

      expect(result.current.hasMultiTabSelection).toBe(true);
    });
  });

  describe('custom event listener', () => {
    it('responds to CROSS_TAB_SELECTION_EVENT', () => {
      const { result } = renderHook(() => useCrossTabSelection());

      const detail: CrossTabSelectionEventDetail = {
        tabId: 'tab-ext',
        tabPath: '/external',
        files: [makeFile('ext.txt', '/ext.txt')],
      };

      act(() => {
        window.dispatchEvent(
          new CustomEvent(CROSS_TAB_SELECTION_EVENT, { detail }),
        );
      });

      expect(result.current.selections.has('tab-ext')).toBe(true);
      expect(result.current.totalSelectedCount).toBe(1);
    });

    it('ignores event without detail', () => {
      const { result } = renderHook(() => useCrossTabSelection());

      act(() => {
        window.dispatchEvent(new CustomEvent(CROSS_TAB_SELECTION_EVENT));
      });

      expect(result.current.selections.size).toBe(0);
    });
  });
});
