import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const STORAGE_KEY = 'xplorer-notification-history';

// We need to use dynamic import with resetModules to handle the module-level
// global state (globalNotifications, listeners, idCounter) that persists
// between tests.
let useNotificationHistory: typeof import('@/hooks/use-notification-history').useNotificationHistory;
let addNotification: typeof import('@/hooks/use-notification-history').addNotification;
let clearAllNotifications: typeof import('@/hooks/use-notification-history').clearAllNotifications;
let clearNotificationById: typeof import('@/hooks/use-notification-history').clearNotificationById;
let markAllAsRead: typeof import('@/hooks/use-notification-history').markAllAsRead;

describe('use-notification-history', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();

    // Reset the module to clear global state between tests
    vi.resetModules();

    const mod = await import('@/hooks/use-notification-history');
    useNotificationHistory = mod.useNotificationHistory;
    addNotification = mod.addNotification;
    clearAllNotifications = mod.clearAllNotifications;
    clearNotificationById = mod.clearNotificationById;
    markAllAsRead = mod.markAllAsRead;
  });

  describe('Initial State', () => {
    it('starts with empty notifications', () => {
      const { result } = renderHook(() => useNotificationHistory());

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
    });

    it('loads existing notifications from sessionStorage on init', async () => {
      const existing = [
        {
          id: 'notif-1',
          type: 'info',
          title: 'Test',
          timestamp: Date.now(),
          read: false,
        },
      ];
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

      // Re-import to pick up the sessionStorage state
      vi.resetModules();
      const mod = await import('@/hooks/use-notification-history');

      const { result } = renderHook(() => mod.useNotificationHistory());

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].title).toBe('Test');
    });
  });

  describe('addNotification', () => {
    it('adds a notification with correct fields', () => {
      const { result } = renderHook(() => useNotificationHistory());

      act(() => {
        addNotification('success', 'File copied', 'Copied 3 files');
      });

      expect(result.current.notifications).toHaveLength(1);
      const notif = result.current.notifications[0];
      expect(notif.type).toBe('success');
      expect(notif.title).toBe('File copied');
      expect(notif.description).toBe('Copied 3 files');
      expect(notif.read).toBe(false);
      expect(notif.id).toMatch(/^notif-/);
      expect(notif.timestamp).toBeGreaterThan(0);
    });

    it('prepends new notifications (newest first)', () => {
      const { result } = renderHook(() => useNotificationHistory());

      act(() => {
        addNotification('info', 'First');
      });
      act(() => {
        addNotification('info', 'Second');
      });

      expect(result.current.notifications[0].title).toBe('Second');
      expect(result.current.notifications[1].title).toBe('First');
    });

    it('supports all notification types', () => {
      const { result } = renderHook(() => useNotificationHistory());

      act(() => {
        addNotification('success', 'Success');
        addNotification('error', 'Error');
        addNotification('warning', 'Warning');
        addNotification('info', 'Info');
      });

      const types = result.current.notifications.map((n) => n.type);
      expect(types).toContain('success');
      expect(types).toContain('error');
      expect(types).toContain('warning');
      expect(types).toContain('info');
    });

    it('handles missing description', () => {
      const { result } = renderHook(() => useNotificationHistory());

      act(() => {
        addNotification('info', 'No description');
      });

      expect(result.current.notifications[0].description).toBeUndefined();
    });

    it('returns the created notification', () => {
      let created: unknown;

      renderHook(() => useNotificationHistory());

      act(() => {
        created = addNotification('info', 'Test');
      });

      expect(created).toBeDefined();
      expect(created.title).toBe('Test');
      expect(created.id).toMatch(/^notif-/);
    });

    it('trims to MAX_NOTIFICATIONS (100)', () => {
      const { result } = renderHook(() => useNotificationHistory());

      act(() => {
        for (let i = 0; i < 110; i++) {
          addNotification('info', `Notification ${i}`);
        }
      });

      expect(result.current.notifications.length).toBeLessThanOrEqual(100);
    });

    it('keeps the most recent notifications when trimming', () => {
      const { result } = renderHook(() => useNotificationHistory());

      act(() => {
        for (let i = 0; i < 110; i++) {
          addNotification('info', `Notification ${i}`);
        }
      });

      const titles = result.current.notifications.map((n) => n.title);
      expect(titles).toContain('Notification 109');
    });

    it('persists to sessionStorage', () => {
      renderHook(() => useNotificationHistory());

      act(() => {
        addNotification('info', 'Persisted');
      });

      const stored = sessionStorage.getItem(STORAGE_KEY);
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].title).toBe('Persisted');
    });
  });

  describe('clearAllNotifications', () => {
    it('removes all notifications', () => {
      const { result } = renderHook(() => useNotificationHistory());

      act(() => {
        addNotification('info', 'A');
        addNotification('error', 'B');
      });

      expect(result.current.notifications).toHaveLength(2);

      act(() => {
        clearAllNotifications();
      });

      expect(result.current.notifications).toEqual([]);
    });

    it('resets unreadCount to 0', () => {
      const { result } = renderHook(() => useNotificationHistory());

      act(() => {
        addNotification('info', 'Unread');
      });

      expect(result.current.unreadCount).toBe(1);

      act(() => {
        clearAllNotifications();
      });

      expect(result.current.unreadCount).toBe(0);
    });
  });

  describe('clearNotificationById', () => {
    it('removes a specific notification by id', () => {
      const { result } = renderHook(() => useNotificationHistory());

      let first: unknown;
      let second: unknown;
      act(() => {
        first = addNotification('info', 'First');
        second = addNotification('info', 'Second');
      });

      act(() => {
        clearNotificationById(first.id);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].id).toBe(second.id);
    });

    it('does nothing when id does not exist', () => {
      const { result } = renderHook(() => useNotificationHistory());

      act(() => {
        addNotification('info', 'Only');
      });

      act(() => {
        clearNotificationById('notif-nonexistent');
      });

      expect(result.current.notifications).toHaveLength(1);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all unread notifications as read', () => {
      const { result } = renderHook(() => useNotificationHistory());

      act(() => {
        addNotification('info', 'A');
        addNotification('error', 'B');
      });

      expect(result.current.unreadCount).toBe(2);

      act(() => {
        markAllAsRead();
      });

      expect(result.current.unreadCount).toBe(0);
      expect(result.current.notifications.every((n) => n.read)).toBe(true);
    });

    it('is a no-op when all are already read', () => {
      const { result } = renderHook(() => useNotificationHistory());

      act(() => {
        addNotification('info', 'Test');
      });

      act(() => {
        markAllAsRead();
      });

      // Call again; should not trigger unnecessary updates
      const prevNotifications = result.current.notifications;

      act(() => {
        markAllAsRead();
      });

      // The reference should be the same since nothing changed
      expect(result.current.notifications).toBe(prevNotifications);
    });
  });

  describe('unreadCount', () => {
    it('reflects the number of unread notifications', () => {
      const { result } = renderHook(() => useNotificationHistory());

      act(() => {
        addNotification('info', 'A');
        addNotification('error', 'B');
        addNotification('warning', 'C');
      });

      expect(result.current.unreadCount).toBe(3);

      act(() => {
        markAllAsRead();
      });

      expect(result.current.unreadCount).toBe(0);

      act(() => {
        addNotification('success', 'D');
      });

      expect(result.current.unreadCount).toBe(1);
    });
  });

  describe('Multiple Hook Consumers (Global State Sync)', () => {
    it('syncs state across multiple hook instances', () => {
      const { result: consumer1 } = renderHook(() => useNotificationHistory());
      const { result: consumer2 } = renderHook(() => useNotificationHistory());

      act(() => {
        addNotification('info', 'Shared');
      });

      // Both consumers should see the notification
      expect(consumer1.current.notifications).toHaveLength(1);
      expect(consumer2.current.notifications).toHaveLength(1);
      expect(consumer1.current.notifications[0].title).toBe('Shared');
      expect(consumer2.current.notifications[0].title).toBe('Shared');
    });
  });

  describe('Corrupted sessionStorage', () => {
    it('handles corrupted JSON gracefully', async () => {
      sessionStorage.setItem(STORAGE_KEY, '{not valid json');

      vi.resetModules();
      const mod = await import('@/hooks/use-notification-history');

      const { result } = renderHook(() => mod.useNotificationHistory());

      expect(result.current.notifications).toEqual([]);
    });

    it('handles non-array JSON gracefully', async () => {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));

      vi.resetModules();
      const mod = await import('@/hooks/use-notification-history');

      const { result } = renderHook(() => mod.useNotificationHistory());

      expect(result.current.notifications).toEqual([]);
    });
  });
});
