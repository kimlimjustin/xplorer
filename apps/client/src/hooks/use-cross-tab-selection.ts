import { useState, useCallback, useEffect, useMemo } from 'react';
import type { FileEntry } from '@/lib/tauri-api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CrossTabSelection {
  tabId: string;
  tabPath: string;
  files: FileEntry[];
}

export interface CrossTabSelectedFile {
  file: FileEntry;
  sourceTabPath: string;
}

export interface CrossTabSelectionState {
  /** Map of tab ID to the selection for that tab */
  selections: Map<string, CrossTabSelection>;
  /** Total number of files selected across all tabs */
  totalSelectedCount: number;
  /** Number of tabs that have selections */
  selectedTabCount: number;
  /** Whether 2+ tabs have selections */
  hasMultiTabSelection: boolean;
  /** Add or replace selection for a given tab */
  addSelection: (tabId: string, tabPath: string, files: FileEntry[]) => void;
  /** Clear selection for a specific tab */
  clearSelection: (tabId: string) => void;
  /** Clear all cross-tab selections */
  clearAll: () => void;
  /** Get a flat list of all selected files with their source tab paths */
  getAllSelectedFiles: () => CrossTabSelectedFile[];
}

// ── Custom event name ────────────────────────────────────────────────────────

export const CROSS_TAB_SELECTION_EVENT = 'cross-tab-selection-changed';

export interface CrossTabSelectionEventDetail {
  tabId: string;
  tabPath: string;
  files: FileEntry[];
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useCrossTabSelection = () : CrossTabSelectionState => {
  const [selections, setSelections] = useState<Map<string, CrossTabSelection>>(() => new Map());

  const addSelection = useCallback((tabId: string, tabPath: string, files: FileEntry[]) => {
    setSelections((prev) => {
      const next = new Map(prev);
      if (files.length === 0) {
        next.delete(tabId);
      } else {
        next.set(tabId, { tabId, tabPath, files });
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback((tabId: string) => {
    setSelections((prev) => {
      const next = new Map(prev);
      next.delete(tabId);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSelections(new Map());
  }, []);

  const getAllSelectedFiles = useCallback((): CrossTabSelectedFile[] => {
    const result: CrossTabSelectedFile[] = [];
    for (const sel of selections.values()) {
      for (const file of sel.files) {
        result.push({ file, sourceTabPath: sel.tabPath });
      }
    }
    return result;
  }, [selections]);

  // Listen for the custom event dispatched from FileGrid
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CrossTabSelectionEventDetail>).detail;
      if (detail) {
        addSelection(detail.tabId, detail.tabPath, detail.files);
      }
    };
    window.addEventListener(CROSS_TAB_SELECTION_EVENT, handler);
    return () => window.removeEventListener(CROSS_TAB_SELECTION_EVENT, handler);
  }, [addSelection]);

  const totalSelectedCount = useMemo(() => {
    let count = 0;
    for (const sel of selections.values()) {
      count += sel.files.length;
    }
    return count;
  }, [selections]);

  const selectedTabCount = useMemo(() => selections.size, [selections]);

  const hasMultiTabSelection = useMemo(() => selections.size >= 2, [selections]);

  return {
    selections,
    totalSelectedCount,
    selectedTabCount,
    hasMultiTabSelection,
    addSelection,
    clearSelection,
    clearAll,
    getAllSelectedFiles,
  };
}
