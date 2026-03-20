import { useMemo, useState, useEffect, RefObject } from 'react';

const getMinItemWidth = (viewMode: string) : number => {
  switch (viewMode) {
    case 'large':
      return 120;
    case 'medium':
      return 100;
    case 'small':
      return 80;
    case 'tiles':
      return 140;
    case 'content':
      return 200;
    default:
      return 100;
  }
}

const getGapSize = (viewMode: string) : number => {
  switch (viewMode) {
    case 'large':
      return 24;
    case 'medium':
      return 16;
    case 'small':
      return 8;
    case 'tiles':
      return 12;
    case 'content':
      return 16;
    case 'list':
      return 4;
    default:
      return 16;
  }
}

const computeColumns = (containerWidth: number, viewMode: string) : number => {
  if (viewMode === 'list') return 1;
  const minWidth = getMinItemWidth(viewMode);
  const gap = getGapSize(viewMode);
  if (containerWidth <= 0) return 1;
  const cols = Math.floor((containerWidth + gap) / (minWidth + gap));
  return Math.max(1, cols);
}

const getFallbackColumns = (viewMode: string) : number => {
  switch (viewMode) {
    case 'large':
      return 6;
    case 'medium':
      return 8;
    case 'small':
      return 12;
    case 'tiles':
      return 8;
    case 'list':
      return 1;
    case 'content':
      return 3;
    default:
      return 8;
  }
}

export const useGridLayout = (viewMode: string, containerRef?: RefObject<HTMLElement | null>) => {
  const [measuredColumns, setMeasuredColumns] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) {
      setMeasuredColumns(null);
      return;
    }

    const measure = () => {
      const width = el.clientWidth;
      if (width > 0) {
        setMeasuredColumns(computeColumns(width, viewMode));
      }
    };

    measure();

    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, viewMode]);

  const getColumnsCount = useMemo(() => {
    return () => getFallbackColumns(viewMode);
  }, [viewMode]);

  const getEstimatedRowHeight = useMemo(() => {
    return () => {
      switch (viewMode) {
        case 'large':
          return 120;
        case 'medium':
          return 100;
        case 'small':
          return 48;
        case 'tiles':
          return 100;
        case 'list':
          return 36;
        case 'content':
          return 100;
        default:
          return 100;
      }
    };
  }, [viewMode]);

  const getGridLayout = useMemo(() => {
    return () => {
      switch (viewMode) {
        case 'large':
          return 'grid grid-cols-auto-fill-large gap-6';
        case 'medium':
          return 'grid grid-cols-auto-fill-medium gap-4';
        case 'small':
          return 'grid grid-cols-auto-fill-small gap-2';
        case 'tiles':
          return 'grid grid-cols-auto-fill-tiles gap-3';
        case 'list':
          return 'grid grid-cols-auto-fill-list gap-1';
        case 'details':
          return 'space-y-0';
        case 'content':
          return 'grid grid-cols-2 lg:grid-cols-3 gap-4';
        case 'tree':
          return 'space-y-0';
        default:
          return 'grid grid-cols-auto-fill-medium gap-4';
      }
    };
  }, [viewMode]);

  const getItemSize = useMemo(() => {
    return () => {
      switch (viewMode) {
        case 'large':
          return 'text-4xl';
        case 'medium':
          return 'text-2xl';
        case 'small':
          return 'text-lg';
        case 'tiles':
          return 'text-2xl';
        case 'list':
          return 'text-sm';
        case 'details':
          return 'text-sm';
        case 'tree':
          return 'text-sm';
        default:
          return 'text-2xl';
      }
    };
  }, [viewMode]);

  const listView = viewMode === 'list';
  const gridView = ['large', 'medium', 'small', 'tiles', 'content'].includes(viewMode);
  const columns = listView ? 1 : (measuredColumns ?? getColumnsCount());
  const gap = getGapSize(viewMode);

  return {
    getColumnsCount,
    getEstimatedRowHeight,
    getGridLayout,
    getItemSize,
    listView,
    gridView,
    columns,
    gap,
  };
}
