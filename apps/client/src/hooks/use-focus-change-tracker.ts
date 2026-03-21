import { useState, useEffect, useRef, useCallback } from 'react';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FileChange {
  path: string;
  name: string;
  type: 'added' | 'removed' | 'modified';
  size?: number;
  modifiedAt?: number;
}

export interface FileChangeSet {
  added: FileChange[];
  removed: FileChange[];
  modified: FileChange[];
  totalCount: number;
  detectedAt: number;
}

interface SnapshotEntry {
  size: number;
  mtime: number;
}

const MIN_AWAY_TIME = 300_000; // 5 minutes in ms

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useFocusChangeTracker = (currentPath: string) => {
  const [changes, setChanges] = useState<FileChangeSet | null>(null);

  // Snapshot of the directory at the time focus was lost
  const snapshotRef = useRef<Map<string, SnapshotEntry> | null>(null);
  const snapshotPathRef = useRef<string>('');
  const focusLostAtRef = useRef<number | null>(null);
  const scanningRef = useRef(false);

  // Take a snapshot of the current directory listing
  const takeSnapshot = useCallback(async (path: string) => {
    if (
      !path ||
      path.startsWith('xplorer://') ||
      path.startsWith('gdrive://') ||
      path.startsWith('comparison://')
    ) {
      snapshotRef.current = null;
      snapshotPathRef.current = '';
      return;
    }

    try {
      const entries = await TauriAPI.readDirectory(path);
      const map = new Map<string, SnapshotEntry>();
      for (const entry of entries) {
        map.set(entry.path, { size: entry.size, mtime: entry.modified });
      }
      snapshotRef.current = map;
      snapshotPathRef.current = path;
    } catch {
      snapshotRef.current = null;
      snapshotPathRef.current = '';
    }
  }, []);

  // Compare current directory against snapshot
  const detectChanges = useCallback(async (path: string): Promise<FileChangeSet | null> => {
    const snapshot = snapshotRef.current;
    if (!snapshot || snapshotPathRef.current !== path) return null;

    try {
      const currentEntries = await TauriAPI.readDirectory(path);
      const currentMap = new Map<string, FileEntry>();
      for (const entry of currentEntries) {
        currentMap.set(entry.path, entry);
      }

      const added: FileChange[] = [];
      const removed: FileChange[] = [];
      const modified: FileChange[] = [];

      // Check for added and modified files
      for (const [entryPath, entry] of currentMap) {
        const oldEntry = snapshot.get(entryPath);
        if (!oldEntry) {
          added.push({
            path: entry.path,
            name: entry.name,
            type: 'added',
            size: entry.size,
            modifiedAt: entry.modified,
          });
        } else if (oldEntry.size !== entry.size || oldEntry.mtime !== entry.modified) {
          modified.push({
            path: entry.path,
            name: entry.name,
            type: 'modified',
            size: entry.size,
            modifiedAt: entry.modified,
          });
        }
      }

      // Check for removed files
      for (const [entryPath] of snapshot) {
        if (!currentMap.has(entryPath)) {
          // Extract name from path
          const parts = entryPath.split(/[/\\]/);
          const name = parts[parts.length - 1] || entryPath;
          removed.push({
            path: entryPath,
            name,
            type: 'removed',
          });
        }
      }

      const totalCount = added.length + removed.length + modified.length;
      if (totalCount === 0) return null;

      return {
        added,
        removed,
        modified,
        totalCount,
        detectedAt: Date.now(),
      };
    } catch {
      return null;
    }
  }, []);

  const dismissChanges = useCallback(() => {
    setChanges(null);
  }, []);

  // Listen for visibility changes
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Window lost focus: record time and take snapshot
        focusLostAtRef.current = Date.now();
        await takeSnapshot(currentPath);
      } else {
        // Window gained focus: check if away long enough
        const lostAt = focusLostAtRef.current;
        if (lostAt && !scanningRef.current) {
          const awayTime = Date.now() - lostAt;
          if (
            awayTime >= MIN_AWAY_TIME &&
            snapshotRef.current &&
            snapshotPathRef.current === currentPath
          ) {
            scanningRef.current = true;
            try {
              const detected = await detectChanges(currentPath);
              if (detected) {
                setChanges(detected);
              }
            } finally {
              scanningRef.current = false;
            }
          }
        }
        focusLostAtRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentPath, takeSnapshot, detectChanges]);

  // Reset changes when navigating to a different directory
  useEffect(() => {
    setChanges(null);
  }, [currentPath]);

  return { changes, dismissChanges };
};
