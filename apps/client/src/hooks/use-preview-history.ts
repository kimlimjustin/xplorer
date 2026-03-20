import { useRef, useCallback } from 'react';
import type { FileEntry } from '@/lib/tauri-api';

const MAX_HISTORY = 10;

export interface PreviewHistoryEntry {
  file: FileEntry;
  timestamp: number;
}

/**
 * Tracks the last N previewed files in session memory (not persisted).
 * Returns { history, addToHistory, clearHistory }.
 */
export const usePreviewHistory = () => {
  // Use a ref so we don't trigger re-renders on every addition;
  // consumers pull the snapshot when they need it (e.g. dropdown open).
  const historyRef = useRef<PreviewHistoryEntry[]>([]);
  // A simple counter to allow consumers to know when history changed
  const versionRef = useRef(0);

  const addToHistory = useCallback((file: FileEntry) => {
    const existing = historyRef.current;
    // Deduplicate: remove if already present
    const filtered = existing.filter((e) => e.file.path !== file.path);
    const entry: PreviewHistoryEntry = { file, timestamp: Date.now() };
    // Prepend (most recent first) and cap at MAX_HISTORY
    historyRef.current = [entry, ...filtered].slice(0, MAX_HISTORY);
    versionRef.current += 1;
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    versionRef.current += 1;
  }, []);

  const getHistory = useCallback((): PreviewHistoryEntry[] => {
    return historyRef.current;
  }, []);

  return { getHistory, addToHistory, clearHistory, versionRef };
}
