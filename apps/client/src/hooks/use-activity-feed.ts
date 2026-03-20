import { useState, useCallback, useRef, useEffect } from 'react';
import { TauriAPI } from '@/lib/tauri-api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  type: 'created' | 'modified' | 'deleted' | 'renamed';
  path: string;
  name: string;
  timestamp: number;
  oldPath?: string; // for renames
  size?: number;
}

export type ActivityFilter = 'all' | 'created' | 'modified' | 'deleted' | 'renamed';

const MAX_ENTRIES = 200;

let entryCounter = 0;
const generateEntryId = () : string => {
  return `activity-${Date.now()}-${entryCounter++}`;
}

/** Map backend fs-change event_type strings to ActivityEntry type */
const mapEventType = (eventType: string) : ActivityEntry['type'] | null => {
  switch (eventType) {
    case 'file-created':
    case 'create':
      return 'created';
    case 'file-modified':
    case 'modify':
      return 'modified';
    case 'file-deleted':
    case 'remove':
      return 'deleted';
    case 'file-renamed':
      return 'renamed';
    default:
      return 'modified';
  }
}

/** Extract file name from a full path */
const extractName = (filePath: string) : string => {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || filePath;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useActivityFeed = () => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');
  const [isPaused, setIsPaused] = useState(false);

  // Buffer entries while paused so they appear on resume
  const pausedBufferRef = useRef<ActivityEntry[]>([]);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const addEntry = useCallback((entry: Omit<ActivityEntry, 'id'>) => {
    const newEntry: ActivityEntry = { ...entry, id: generateEntryId() };

    if (isPausedRef.current) {
      pausedBufferRef.current.push(newEntry);
      // Trim buffer to max
      if (pausedBufferRef.current.length > MAX_ENTRIES) {
        pausedBufferRef.current = pausedBufferRef.current.slice(-MAX_ENTRIES);
      }
      return;
    }

    setEntries((prev) => {
      const next = [...prev, newEntry];
      if (next.length > MAX_ENTRIES) {
        return next.slice(next.length - MAX_ENTRIES);
      }
      return next;
    });
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const willResume = prev; // was paused, now resuming
      if (willResume && pausedBufferRef.current.length > 0) {
        // Flush buffered entries
        const buffered = pausedBufferRef.current;
        pausedBufferRef.current = [];
        setEntries((prevEntries) => {
          const combined = [...prevEntries, ...buffered];
          if (combined.length > MAX_ENTRIES) {
            return combined.slice(combined.length - MAX_ENTRIES);
          }
          return combined;
        });
      }
      return !prev;
    });
  }, []);

  const clearFeed = useCallback(() => {
    setEntries([]);
    pausedBufferRef.current = [];
  }, []);

  // Listen for file watcher events from the Tauri backend (fs-change)
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        unlisten = await TauriAPI.listenToEvent<{
          watcher_id?: string;
          path: string;
          event_type?: string;
          kind?: string;
          timestamp?: number;
        }>('fs-change', (event) => {
          const eventType = event.event_type || event.kind || 'modify';
          const type = mapEventType(eventType);
          if (!type) return;

          addEntry({
            type,
            path: event.path,
            name: extractName(event.path),
            timestamp: event.timestamp || Date.now(),
          });
        });
      } catch (err) {
        console.warn('[activity-feed] Failed to listen for fs-change events:', err);
      }
    })();

    return () => {
      unlisten?.();
    };
  }, [addEntry]);

  // Listen for app-internal file operations via custom DOM events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !detail.type || !detail.path) return;

      const type = mapEventType(detail.type);
      if (!type) return;

      addEntry({
        type,
        path: detail.path,
        name: detail.name || extractName(detail.path),
        timestamp: Date.now(),
        oldPath: detail.oldPath,
        size: detail.size,
      });
    };

    window.addEventListener('file-activity', handler);
    return () => {
      window.removeEventListener('file-activity', handler);
    };
  }, [addEntry]);

  // Compute filtered entries
  const filteredEntries =
    activeFilter === 'all' ? entries : entries.filter((e) => e.type === activeFilter);

  // Count of entries in last 5 minutes (for badge)
  const recentCount = entries.filter((e) => Date.now() - e.timestamp < 5 * 60 * 1000).length;

  return {
    entries,
    filteredEntries,
    activeFilter,
    setActiveFilter,
    isPaused,
    togglePause,
    clearFeed,
    recentCount,
  };
}
