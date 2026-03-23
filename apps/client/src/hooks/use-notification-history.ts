import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '@/lib/storage-keys';

export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  timestamp: number;
  read: boolean;
}

const MAX_NOTIFICATIONS = 100;
const STORAGE_KEY = STORAGE_KEYS.NOTIFICATION_HISTORY;

const loadFromSession = (): AppNotification[] => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
};

const saveToSession = (notifications: AppNotification[]) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    // ignore
  }
};

// Global state so multiple hook consumers stay in sync
let globalNotifications: AppNotification[] = loadFromSession();
const listeners = new Set<(n: AppNotification[]) => void>();

const notify = (notifications: AppNotification[]) => {
  globalNotifications = notifications;
  saveToSession(notifications);
  listeners.forEach((fn) => fn(notifications));
};

let idCounter = 0;

export const addNotification = (
  type: AppNotification['type'],
  title: string,
  description?: string,
): AppNotification => {
  const notification: AppNotification = {
    id: `notif-${Date.now()}-${++idCounter}`,
    type,
    title,
    description,
    timestamp: Date.now(),
    read: false,
  };

  const next = [notification, ...globalNotifications].slice(0, MAX_NOTIFICATIONS);
  notify(next);
  return notification;
};

export const clearAllNotifications = () => {
  notify([]);
};

export const clearNotificationById = (id: string) => {
  notify(globalNotifications.filter((n) => n.id !== id));
};

export const markAllAsRead = () => {
  if (globalNotifications.every((n) => n.read)) return;
  notify(globalNotifications.map((n) => (n.read ? n : { ...n, read: true })));
};

export const useNotificationHistory = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>(globalNotifications);

  useEffect(() => {
    // Sync with global state on mount
    setNotifications(globalNotifications);
    listeners.add(setNotifications);
    return () => {
      listeners.delete(setNotifications);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    addNotification,
    clearAll: clearAllNotifications,
    clearById: clearNotificationById,
    markAllAsRead,
    unreadCount,
  };
};
