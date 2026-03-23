import React, { useState, useEffect, useCallback, useRef } from 'react';
import { STORAGE_KEYS } from '@/lib/storage-keys';

type SectionId = 'quickAccess' | 'recent' | 'favorites' | 'collections' | 'drives' | 'fileTree';

interface UseSidebarResizeReturn {
  sectionCollapsed: Record<SectionId, boolean>;
  sectionHeights: Record<string, number>;
  toggleSection: (id: SectionId) => void;
  onResizeStart: (sectionId: string, e: React.MouseEvent) => void;
}

const useSidebarResize = (): UseSidebarResizeReturn => {
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<SectionId, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_SECTIONS);
      if (saved) return JSON.parse(saved) as Record<SectionId, boolean>;
    } catch {
      /* ignore */
    }
    return {
      quickAccess: false,
      recent: true,
      favorites: false,
      collections: false,
      drives: false,
      fileTree: false,
    };
  });

  const [sectionHeights, setSectionHeights] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_HEIGHTS);
      if (saved) return JSON.parse(saved) as Record<string, number>;
    } catch {
      /* ignore */
    }
    return {};
  });

  const toggleSection = useCallback((id: SectionId) => {
    setSectionCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_SECTIONS, JSON.stringify(next));
      return next;
    });
  }, []);

  const resizingRef = useRef<{ sectionId: string; startY: number; startHeight: number } | null>(
    null,
  );
  const resizeListenersRef = useRef<{
    onMove: ((ev: MouseEvent) => void) | null;
    onUp: (() => void) | null;
  }>({ onMove: null, onUp: null });

  useEffect(() => {
    const listenersRef = resizeListenersRef.current;
    return () => {
      if (listenersRef.onMove) {
        document.removeEventListener('mousemove', listenersRef.onMove);
      }
      if (listenersRef.onUp) {
        document.removeEventListener('mouseup', listenersRef.onUp);
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  const onResizeStart = useCallback((sectionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const sectionEl = document.querySelector(
      `[data-sidebar-section="${sectionId}"]`,
    ) as HTMLElement | null;
    if (!sectionEl) return;
    const startHeight = sectionEl.getBoundingClientRect().height;
    resizingRef.current = { sectionId, startY: e.clientY, startHeight };

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientY - resizingRef.current.startY;
      const newHeight = Math.max(32, resizingRef.current.startHeight + delta);
      setSectionHeights((prev) => {
        const next = { ...prev, [sectionId]: newHeight };
        localStorage.setItem(STORAGE_KEYS.SIDEBAR_HEIGHTS, JSON.stringify(next));
        return next;
      });
    };
    const onUp = () => {
      resizingRef.current = null;
      resizeListenersRef.current.onMove = null;
      resizeListenersRef.current.onUp = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    resizeListenersRef.current.onMove = onMove;
    resizeListenersRef.current.onUp = onUp;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return { sectionCollapsed, sectionHeights, toggleSection, onResizeStart };
};

export { useSidebarResize };
export type { SectionId };
