import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGridLayout } from '@/hooks/use-grid-layout';
import type { RefObject } from 'react';

describe('useGridLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state without containerRef', () => {
    it('returns fallback columns for medium view mode', () => {
      const { result } = renderHook(() => useGridLayout('medium'));

      expect(result.current.columns).toBe(8);
      expect(result.current.gridView).toBe(true);
      expect(result.current.listView).toBe(false);
    });

    it('returns 1 column for list view mode', () => {
      const { result } = renderHook(() => useGridLayout('list'));

      expect(result.current.columns).toBe(1);
      expect(result.current.listView).toBe(true);
      expect(result.current.gridView).toBe(false);
    });
  });

  describe('Fallback columns per view mode', () => {
    const fallbackCases: Array<[string, number]> = [
      ['large', 6],
      ['medium', 8],
      ['small', 12],
      ['tiles', 8],
      ['list', 1],
      ['content', 3],
    ];

    it.each(fallbackCases)(
      'returns %i fallback columns for "%s" view mode',
      (viewMode, expectedColumns) => {
        const { result } = renderHook(() => useGridLayout(viewMode));
        expect(result.current.columns).toBe(expectedColumns);
      },
    );

    it('returns 8 fallback columns for unknown view mode', () => {
      const { result } = renderHook(() => useGridLayout('unknown'));
      expect(result.current.columns).toBe(8);
    });
  });

  describe('getColumnsCount', () => {
    it('returns a function that gives fallback column count', () => {
      const { result } = renderHook(() => useGridLayout('large'));

      expect(typeof result.current.getColumnsCount).toBe('function');
      expect(result.current.getColumnsCount()).toBe(6);
    });
  });

  describe('getEstimatedRowHeight', () => {
    const heightCases: Array<[string, number]> = [
      ['large', 120],
      ['medium', 100],
      ['small', 48],
      ['tiles', 100],
      ['list', 36],
      ['content', 100],
    ];

    it.each(heightCases)('returns %i for "%s" view mode', (viewMode, expectedHeight) => {
      const { result } = renderHook(() => useGridLayout(viewMode));
      expect(result.current.getEstimatedRowHeight()).toBe(expectedHeight);
    });

    it('returns 100 for unknown view mode', () => {
      const { result } = renderHook(() => useGridLayout('unknown'));
      expect(result.current.getEstimatedRowHeight()).toBe(100);
    });
  });

  describe('getGridLayout', () => {
    it('returns correct CSS classes for large mode', () => {
      const { result } = renderHook(() => useGridLayout('large'));
      expect(result.current.getGridLayout()).toBe('grid grid-cols-auto-fill-large gap-6');
    });

    it('returns correct CSS classes for medium mode', () => {
      const { result } = renderHook(() => useGridLayout('medium'));
      expect(result.current.getGridLayout()).toBe('grid grid-cols-auto-fill-medium gap-4');
    });

    it('returns correct CSS classes for small mode', () => {
      const { result } = renderHook(() => useGridLayout('small'));
      expect(result.current.getGridLayout()).toBe('grid grid-cols-auto-fill-small gap-2');
    });

    it('returns correct CSS classes for tiles mode', () => {
      const { result } = renderHook(() => useGridLayout('tiles'));
      expect(result.current.getGridLayout()).toBe('grid grid-cols-auto-fill-tiles gap-3');
    });

    it('returns correct CSS classes for list mode', () => {
      const { result } = renderHook(() => useGridLayout('list'));
      expect(result.current.getGridLayout()).toBe('grid grid-cols-auto-fill-list gap-1');
    });

    it('returns correct CSS classes for details mode', () => {
      const { result } = renderHook(() => useGridLayout('details'));
      expect(result.current.getGridLayout()).toBe('space-y-0');
    });

    it('returns correct CSS classes for content mode', () => {
      const { result } = renderHook(() => useGridLayout('content'));
      expect(result.current.getGridLayout()).toBe('grid grid-cols-2 lg:grid-cols-3 gap-4');
    });

    it('returns correct CSS classes for tree mode', () => {
      const { result } = renderHook(() => useGridLayout('tree'));
      expect(result.current.getGridLayout()).toBe('space-y-0');
    });

    it('returns medium layout for unknown view mode', () => {
      const { result } = renderHook(() => useGridLayout('unknown'));
      expect(result.current.getGridLayout()).toBe('grid grid-cols-auto-fill-medium gap-4');
    });
  });

  describe('getItemSize', () => {
    const sizeCases: Array<[string, string]> = [
      ['large', 'text-4xl'],
      ['medium', 'text-2xl'],
      ['small', 'text-lg'],
      ['tiles', 'text-2xl'],
      ['list', 'text-sm'],
      ['details', 'text-sm'],
      ['tree', 'text-sm'],
    ];

    it.each(sizeCases)('returns "%s" for "%s" view mode', (viewMode, expectedSize) => {
      const { result } = renderHook(() => useGridLayout(viewMode));
      expect(result.current.getItemSize()).toBe(expectedSize);
    });

    it('returns text-2xl for unknown view mode', () => {
      const { result } = renderHook(() => useGridLayout('unknown'));
      expect(result.current.getItemSize()).toBe('text-2xl');
    });
  });

  describe('listView and gridView flags', () => {
    it('listView is true only for list mode', () => {
      const { result: listResult } = renderHook(() => useGridLayout('list'));
      expect(listResult.current.listView).toBe(true);

      const { result: medResult } = renderHook(() => useGridLayout('medium'));
      expect(medResult.current.listView).toBe(false);
    });

    it('gridView is true for large, medium, small, tiles, content', () => {
      const gridModes = ['large', 'medium', 'small', 'tiles', 'content'];
      for (const mode of gridModes) {
        const { result } = renderHook(() => useGridLayout(mode));
        expect(result.current.gridView).toBe(true);
      }
    });

    it('gridView is false for list, details, tree', () => {
      const nonGridModes = ['list', 'details', 'tree'];
      for (const mode of nonGridModes) {
        const { result } = renderHook(() => useGridLayout(mode));
        expect(result.current.gridView).toBe(false);
      }
    });
  });

  describe('gap sizes', () => {
    const gapCases: Array<[string, number]> = [
      ['large', 24],
      ['medium', 16],
      ['small', 8],
      ['tiles', 12],
      ['content', 16],
      ['list', 4],
    ];

    it.each(gapCases)('returns gap %i for "%s" view mode', (viewMode, expectedGap) => {
      const { result } = renderHook(() => useGridLayout(viewMode));
      expect(result.current.gap).toBe(expectedGap);
    });

    it('returns 16 gap for unknown view mode', () => {
      const { result } = renderHook(() => useGridLayout('unknown'));
      expect(result.current.gap).toBe(16);
    });
  });

  describe('View mode changes', () => {
    it('updates layout when view mode changes', () => {
      const { result, rerender } = renderHook(({ mode }: { mode: string }) => useGridLayout(mode), {
        initialProps: { mode: 'medium' },
      });

      expect(result.current.getGridLayout()).toBe('grid grid-cols-auto-fill-medium gap-4');
      expect(result.current.gap).toBe(16);

      rerender({ mode: 'large' });

      expect(result.current.getGridLayout()).toBe('grid grid-cols-auto-fill-large gap-6');
      expect(result.current.gap).toBe(24);
    });

    it('updates columns when switching to list mode', () => {
      const { result, rerender } = renderHook(({ mode }: { mode: string }) => useGridLayout(mode), {
        initialProps: { mode: 'medium' },
      });

      expect(result.current.columns).toBe(8);

      rerender({ mode: 'list' });

      expect(result.current.columns).toBe(1);
    });
  });

  describe('containerRef with ResizeObserver', () => {
    it('sets measuredColumns to null when containerRef.current is null', () => {
      const containerRef = { current: null } as RefObject<HTMLElement | null>;
      const { result } = renderHook(() => useGridLayout('medium', containerRef));

      // Falls back to getColumnsCount() because measuredColumns is null
      expect(result.current.columns).toBe(8);
    });

    it('observes container element when ref is provided', () => {
      const mockElement = {
        clientWidth: 800,
      } as HTMLElement;

      const containerRef = { current: mockElement } as RefObject<HTMLElement | null>;

      // ResizeObserver is mocked in setup.ts
      renderHook(() => useGridLayout('medium', containerRef));

      // The ResizeObserver constructor should have been called
      expect(global.ResizeObserver).toHaveBeenCalled();
    });

    it('disconnects observer on cleanup', () => {
      const mockDisconnect = vi.fn();
      (global.ResizeObserver as unknown) = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: mockDisconnect,
      }));

      const mockElement = { clientWidth: 800 } as HTMLElement;
      const containerRef = { current: mockElement } as RefObject<HTMLElement | null>;

      const { unmount } = renderHook(() => useGridLayout('medium', containerRef));

      unmount();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('Memoization', () => {
    it('getGridLayout returns same function reference when viewMode is stable', () => {
      const { result, rerender } = renderHook(({ mode }: { mode: string }) => useGridLayout(mode), {
        initialProps: { mode: 'medium' },
      });

      const firstRef = result.current.getGridLayout;

      rerender({ mode: 'medium' });

      expect(result.current.getGridLayout).toBe(firstRef);
    });

    it('getGridLayout changes reference when viewMode changes', () => {
      const { result, rerender } = renderHook(({ mode }: { mode: string }) => useGridLayout(mode), {
        initialProps: { mode: 'medium' },
      });

      const firstRef = result.current.getGridLayout;

      rerender({ mode: 'large' });

      expect(result.current.getGridLayout).not.toBe(firstRef);
    });
  });
});
