import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TauriAPI } from '@/lib/tauri-api';
import { useActivityFeed } from '@/hooks/use-activity-feed';

// The global setup already mocks @/lib/tauri-api. We need to add listenToEvent
// which is not in the default global mock.
const mockAPI = TauriAPI as unknown as Record<string, ReturnType<typeof vi.fn>>;
mockAPI.listenToEvent = vi.fn().mockResolvedValue(() => {});

describe('useActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set the mock because clearAllMocks wipes it
    mockAPI.listenToEvent = vi.fn().mockResolvedValue(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('starts with an empty entries list', () => {
      const { result } = renderHook(() => useActivityFeed());

      expect(result.current.entries).toEqual([]);
      expect(result.current.filteredEntries).toEqual([]);
    });

    it('starts with activeFilter set to "all"', () => {
      const { result } = renderHook(() => useActivityFeed());

      expect(result.current.activeFilter).toBe('all');
    });

    it('starts unpaused', () => {
      const { result } = renderHook(() => useActivityFeed());

      expect(result.current.isPaused).toBe(false);
    });

    it('has recentCount of 0 when empty', () => {
      const { result } = renderHook(() => useActivityFeed());

      expect(result.current.recentCount).toBe(0);
    });
  });

  describe('Adding Entries', () => {
    it('adds an entry via the file-activity custom DOM event', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: {
              type: 'create',
              path: '/home/user/doc.txt',
              name: 'doc.txt',
            },
          }),
        );
      });

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0].type).toBe('created');
      expect(result.current.entries[0].path).toBe('/home/user/doc.txt');
      expect(result.current.entries[0].name).toBe('doc.txt');
    });

    it('maps "modify" event type to "modified"', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: { type: 'modify', path: '/test/file.txt' },
          }),
        );
      });

      expect(result.current.entries[0].type).toBe('modified');
    });

    it('maps "remove" event type to "deleted"', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: { type: 'remove', path: '/test/file.txt' },
          }),
        );
      });

      expect(result.current.entries[0].type).toBe('deleted');
    });

    it('maps "file-renamed" event type to "renamed"', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: {
              type: 'file-renamed',
              path: '/test/new.txt',
              oldPath: '/test/old.txt',
            },
          }),
        );
      });

      expect(result.current.entries[0].type).toBe('renamed');
      expect(result.current.entries[0].oldPath).toBe('/test/old.txt');
    });

    it('extracts name from path when no name is provided', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: { type: 'create', path: '/home/user/photos/image.png' },
          }),
        );
      });

      expect(result.current.entries[0].name).toBe('image.png');
    });

    it('ignores events without path or type', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: { type: 'create' }, // no path
          }),
        );
      });

      expect(result.current.entries).toHaveLength(0);

      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: { path: '/test/file.txt' }, // no type
          }),
        );
      });

      expect(result.current.entries).toHaveLength(0);
    });

    it('generates unique IDs for each entry', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: { type: 'create', path: '/a.txt' },
          }),
        );
      });

      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: { type: 'create', path: '/b.txt' },
          }),
        );
      });

      expect(result.current.entries[0].id).not.toBe(result.current.entries[1].id);
    });

    it('includes size when provided', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: { type: 'create', path: '/a.txt', size: 4096 },
          }),
        );
      });

      expect(result.current.entries[0].size).toBe(4096);
    });
  });

  describe('Filtering', () => {
    function addMultipleEntries(_result: { current: ReturnType<typeof useActivityFeed> }) {
      const events = [
        { type: 'create', path: '/a.txt' },
        { type: 'modify', path: '/b.txt' },
        { type: 'remove', path: '/c.txt' },
        { type: 'file-renamed', path: '/d.txt', oldPath: '/e.txt' },
      ];
      for (const detail of events) {
        act(() => {
          window.dispatchEvent(new CustomEvent('file-activity', { detail }));
        });
      }
    }

    it('shows all entries when filter is "all"', () => {
      const { result } = renderHook(() => useActivityFeed());
      addMultipleEntries(result);

      expect(result.current.filteredEntries).toHaveLength(4);
    });

    it('filters to only "created" entries', () => {
      const { result } = renderHook(() => useActivityFeed());
      addMultipleEntries(result);

      act(() => {
        result.current.setActiveFilter('created');
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].type).toBe('created');
    });

    it('filters to only "modified" entries', () => {
      const { result } = renderHook(() => useActivityFeed());
      addMultipleEntries(result);

      act(() => {
        result.current.setActiveFilter('modified');
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].type).toBe('modified');
    });

    it('filters to only "deleted" entries', () => {
      const { result } = renderHook(() => useActivityFeed());
      addMultipleEntries(result);

      act(() => {
        result.current.setActiveFilter('deleted');
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].type).toBe('deleted');
    });

    it('filters to only "renamed" entries', () => {
      const { result } = renderHook(() => useActivityFeed());
      addMultipleEntries(result);

      act(() => {
        result.current.setActiveFilter('renamed');
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].type).toBe('renamed');
    });

    it('returns empty filteredEntries when no entries match the filter', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: { type: 'create', path: '/a.txt' },
          }),
        );
      });

      act(() => {
        result.current.setActiveFilter('deleted');
      });

      expect(result.current.filteredEntries).toHaveLength(0);
    });
  });

  describe('Clearing', () => {
    it('clears all entries', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: { type: 'create', path: '/a.txt' },
          }),
        );
      });

      expect(result.current.entries).toHaveLength(1);

      act(() => {
        result.current.clearFeed();
      });

      expect(result.current.entries).toHaveLength(0);
      expect(result.current.filteredEntries).toHaveLength(0);
    });
  });

  describe('Pause / Resume', () => {
    it('toggles isPaused state', () => {
      const { result } = renderHook(() => useActivityFeed());

      expect(result.current.isPaused).toBe(false);

      act(() => {
        result.current.togglePause();
      });

      expect(result.current.isPaused).toBe(true);

      act(() => {
        result.current.togglePause();
      });

      expect(result.current.isPaused).toBe(false);
    });

    it('buffers entries while paused and flushes on resume', () => {
      const { result } = renderHook(() => useActivityFeed());

      // Pause the feed
      act(() => {
        result.current.togglePause();
      });

      expect(result.current.isPaused).toBe(true);

      // Dispatch events while paused
      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: { type: 'create', path: '/buffered1.txt' },
          }),
        );
      });

      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: { type: 'modify', path: '/buffered2.txt' },
          }),
        );
      });

      // Entries should NOT appear while paused
      expect(result.current.entries).toHaveLength(0);

      // Resume => buffered entries should flush
      act(() => {
        result.current.togglePause();
      });

      expect(result.current.isPaused).toBe(false);
      expect(result.current.entries).toHaveLength(2);
    });
  });

  describe('MAX_ENTRIES limit (200)', () => {
    it('trims entries beyond 200', () => {
      const { result } = renderHook(() => useActivityFeed());

      for (let i = 0; i < 210; i++) {
        act(() => {
          window.dispatchEvent(
            new CustomEvent('file-activity', {
              detail: { type: 'create', path: `/file-${i}.txt` },
            }),
          );
        });
      }

      expect(result.current.entries.length).toBeLessThanOrEqual(200);
    });

    it('keeps the most recent entries when trimming', () => {
      const { result } = renderHook(() => useActivityFeed());

      for (let i = 0; i < 210; i++) {
        act(() => {
          window.dispatchEvent(
            new CustomEvent('file-activity', {
              detail: { type: 'create', path: `/file-${i}.txt` },
            }),
          );
        });
      }

      const paths = result.current.entries.map((e) => e.path);
      // The latest entry should be present
      expect(paths).toContain('/file-209.txt');
      // The very first entry should have been trimmed
      expect(paths).not.toContain('/file-0.txt');
    });
  });

  describe('recentCount', () => {
    it('counts entries within the last 5 minutes', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        window.dispatchEvent(
          new CustomEvent('file-activity', {
            detail: { type: 'create', path: '/recent.txt' },
          }),
        );
      });

      // Just added, so it's within 5 minutes
      expect(result.current.recentCount).toBe(1);
    });
  });
});
