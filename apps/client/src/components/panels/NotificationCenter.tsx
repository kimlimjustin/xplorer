import React, { useState, useEffect } from 'react';
import { useNotificationHistory, type AppNotification } from '@/hooks/use-notification-history';

type FilterTab = 'all' | 'error' | 'warning' | 'success';

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'error', label: 'Errors' },
  { key: 'warning', label: 'Warnings' },
  { key: 'success', label: 'Success' },
];

const typeToFilterKey = (type: AppNotification['type']): FilterTab | null => {
  if (type === 'error') return 'error';
  if (type === 'warning') return 'warning';
  if (type === 'success') return 'success';
  return null; // 'info' only shows under 'all'
};

const TypeIcon = ({ type }: { type: AppNotification['type'] }) => {
  const size = '14';
  switch (type) {
    case 'success':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 20 20"
          fill="var(--xp-green, #4ade80)"
          style={{ flexShrink: 0 }}
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'error':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 20 20"
          fill="#f87171"
          style={{ flexShrink: 0 }}
        >
          <circle cx="10" cy="10" r="8" />
          <path
            d="M7.5 7.5l5 5M12.5 7.5l-5 5"
            stroke="var(--xp-bg, #0a0a1a)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'warning':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 20 20"
          fill="#fbbf24"
          style={{ flexShrink: 0 }}
        >
          <path d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495z" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 20 20"
          fill="#60a5fa"
          style={{ flexShrink: 0 }}
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
};

const relativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function NotificationCenter() {
  const { notifications, clearAll, clearById, markAllAsRead } = useNotificationHistory();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [, setTick] = useState(0);

  // Mark everything as read when this panel is visible
  useEffect(() => {
    markAllAsRead();
  }, [notifications.length, markAllAsRead]);

  // Tick every 15s so relative timestamps update
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const filtered =
    filter === 'all'
      ? notifications
      : notifications.filter((n) => {
          if (filter === 'error') return n.type === 'error';
          if (filter === 'warning') return n.type === 'warning';
          if (filter === 'success') return n.type === 'success';
          return true;
        });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 12px',
          borderBottom: '1px solid var(--xp-border)',
          background: 'var(--xp-surface-light, rgba(255,255,255,0.03))',
        }}
      >
        {filterTabs.map((tab) => {
          const count =
            tab.key === 'all'
              ? notifications.length
              : notifications.filter((n) => typeToFilterKey(n.type) === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '2px 8px',
                fontSize: 10,
                fontWeight: 500,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                background:
                  filter === tab.key ? 'var(--xp-blue-alpha, rgba(56,139,253,0.2))' : 'transparent',
                color:
                  filter === tab.key ? 'var(--xp-blue, #388bfd)' : 'var(--xp-text-muted, #6b7280)',
              }}
            >
              {tab.label} ({count})
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        {notifications.length > 0 && (
          <button
            onClick={clearAll}
            style={{
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 500,
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: 'var(--xp-text-muted, #6b7280)',
            }}
            title="Clear all notifications"
          >
            Clear All
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              fontSize: 12,
              color: 'var(--xp-text-muted, #6b7280)',
            }}
          >
            No notifications
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '6px 12px',
                borderBottom: '1px solid var(--xp-border-alpha, rgba(255,255,255,0.06))',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                  'var(--xp-surface-light, rgba(255,255,255,0.04))';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
              }}
            >
              <div style={{ marginTop: 2 }}>
                <TypeIcon type={n.type} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--xp-text, #e0e0e0)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {n.title}
                </div>
                {n.description && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--xp-text-muted, #6b7280)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: 1,
                    }}
                  >
                    {n.description}
                  </div>
                )}
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: 'var(--xp-text-muted, #6b7280)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {relativeTime(n.timestamp)}
              </div>

              <button
                onClick={() => clearById(n.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  color: 'var(--xp-text-muted, #6b7280)',
                  opacity: 0.5,
                  flexShrink: 0,
                  marginTop: 1,
                }}
                title="Dismiss"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '0.5';
                }}
              >
                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
