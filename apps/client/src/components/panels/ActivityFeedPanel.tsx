import React, { useRef, useEffect, useCallback } from 'react';
import type { ActivityEntry, ActivityFilter } from '@/hooks/use-activity-feed';

// ── Types ────────────────────────────────────────────────────────────────────

interface ActivityFeedPanelProps {
  entries: ActivityEntry[];
  filteredEntries: ActivityEntry[];
  activeFilter: ActivityFilter;
  setActiveFilter: (filter: ActivityFilter) => void;
  isPaused: boolean;
  togglePause: () => void;
  clearFeed: () => void;
  onNavigate?: (path: string) => void;
}

// ── Time bucket helpers ──────────────────────────────────────────────────────

type TimeBucket = 'just-now' | 'last-5-min' | 'last-30-min' | 'earlier-today';

const BUCKET_LABELS: Record<TimeBucket, string> = {
  'just-now': 'Just Now',
  'last-5-min': 'Last 5 minutes',
  'last-30-min': 'Last 30 minutes',
  'earlier-today': 'Earlier today',
};

const getBucket = (timestamp: number) : TimeBucket => {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'just-now';
  if (diff < 5 * 60_000) return 'last-5-min';
  if (diff < 30 * 60_000) return 'last-30-min';
  return 'earlier-today';
}

const groupByBucket = (entries: ActivityEntry[]) : Map<TimeBucket, ActivityEntry[]> => {
  const buckets = new Map<TimeBucket, ActivityEntry[]>();
  // Iterate in reverse so newest entries appear first within each bucket
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const bucket = getBucket(entry.timestamp);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(entry);
  }
  return buckets;
}

/** Format a timestamp as relative time ("2s ago", "5m ago", "1h ago") */
const formatRelativeTime = (timestamp: number) : string => {
  const diff = Math.max(0, Date.now() - timestamp);
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / (60 * 60_000))}h ago`;
}

/** Extract parent directory as a relative-looking path */
const getRelativePath = (fullPath: string) : string => {
  const normalized = fullPath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts.length <= 2) return normalized;
  return '.../' + parts.slice(-3, -1).join('/');
}

// ── Filter chip definitions ──────────────────────────────────────────────────

const FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'created', label: 'Created' },
  { value: 'modified', label: 'Modified' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'renamed', label: 'Renamed' },
];

// ── SVG Icons ────────────────────────────────────────────────────────────────

const TypeIcon: React.FC<{ type: ActivityEntry['type'] }> = React.memo(({ type }) => {
  switch (type) {
    case 'created':
      return (
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="10" cy="10" r="8" stroke="#4ade80" strokeWidth="2" />
          <path d="M10 6v8M6 10h8" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'modified':
      return (
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
          <path
            d="M13.586 3.586a2 2 0 112.828 2.828l-8.914 8.914-3.5.5.5-3.5 8.914-8.914z"
            stroke="#facc15"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'deleted':
      return (
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
          <path
            d="M6 6h8M7 6V5a1 1 0 011-1h4a1 1 0 011 1v1M8 9v5M12 9v5M5 6h10l-.867 9.736A2 2 0 0112.14 17H7.86a2 2 0 01-1.993-1.264L5 6z"
            stroke="#f87171"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'renamed':
      return (
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
          <path
            d="M4 10h12M12 6l4 4-4 4"
            stroke="#60a5fa"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
});
TypeIcon.displayName = 'TypeIcon';

// ── Quick Action Buttons ─────────────────────────────────────────────────────

const QuickActions: React.FC<{ entry: ActivityEntry; onNavigate?: (path: string) => void }> =
  React.memo(({ entry, onNavigate }) => {
    const handleOpen = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (entry.type === 'deleted') return;
        // Navigate to the file's parent directory
        const normalized = entry.path.replace(/\\/g, '/');
        const sep = normalized.lastIndexOf('/');
        const parent = sep > 0 ? entry.path.substring(0, sep) : entry.path;
        onNavigate?.(parent);
      },
      [entry, onNavigate],
    );

    const handleShowInExplorer = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (entry.type === 'deleted') return;
        const normalized = entry.path.replace(/\\/g, '/');
        const sep = normalized.lastIndexOf('/');
        const parent = sep > 0 ? entry.path.substring(0, sep) : entry.path;
        onNavigate?.(parent);
      },
      [entry, onNavigate],
    );

    if (entry.type === 'deleted') return null;

    return (
      <div
        style={{
          display: 'flex',
          gap: '4px',
          opacity: 0,
          transition: 'opacity 0.15s ease',
          pointerEvents: 'none',
        }}
        className="activity-quick-actions"
      >
        <button
          onClick={handleOpen}
          title="Show in Explorer"
          style={{
            background: 'var(--xp-surface-light, rgba(255,255,255,0.06))',
            border: '1px solid var(--xp-border, rgba(255,255,255,0.08))',
            borderRadius: '3px',
            padding: '1px 6px',
            fontSize: '10px',
            color: 'var(--xp-text-muted)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Open
        </button>
        <button
          onClick={handleShowInExplorer}
          title="Show in Explorer"
          style={{
            background: 'var(--xp-surface-light, rgba(255,255,255,0.06))',
            border: '1px solid var(--xp-border, rgba(255,255,255,0.08))',
            borderRadius: '3px',
            padding: '1px 6px',
            fontSize: '10px',
            color: 'var(--xp-text-muted)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Show
        </button>
      </div>
    );
  });
QuickActions.displayName = 'QuickActions';

// ── Single Entry Row ─────────────────────────────────────────────────────────

const ActivityRow: React.FC<{ entry: ActivityEntry; onNavigate?: (path: string) => void }> =
  React.memo(({ entry, onNavigate }) => {
    const handleClick = useCallback(() => {
      if (entry.type === 'deleted') return;
      const normalized = entry.path.replace(/\\/g, '/');
      const sep = normalized.lastIndexOf('/');
      const parent = sep > 0 ? entry.path.substring(0, sep) : entry.path;
      onNavigate?.(parent);
    }, [entry, onNavigate]);

    return (
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 12px',
          cursor: entry.type !== 'deleted' ? 'pointer' : 'default',
          animation: 'activity-slide-in 0.25s ease-out',
          borderBottom: '1px solid var(--xp-border, rgba(255,255,255,0.04))',
          position: 'relative',
        }}
        className="activity-row"
      >
        <TypeIcon type={entry.type} />

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--xp-text, #cdd6f4)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.name}
            </span>
            {entry.type === 'renamed' && entry.oldPath && (
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--xp-text-muted, #6c7086)',
                  fontStyle: 'italic',
                }}
              >
                from {extractName(entry.oldPath)}
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--xp-text-muted, #6c7086)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {getRelativePath(entry.path)}
          </span>
        </div>

        <span
          style={{
            fontSize: '10px',
            color: 'var(--xp-text-muted, #6c7086)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {formatRelativeTime(entry.timestamp)}
        </span>

        <QuickActions entry={entry} onNavigate={onNavigate} />
      </div>
    );
  });
ActivityRow.displayName = 'ActivityRow';

const extractName = (fullPath: string) : string => {
  const parts = fullPath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || fullPath;
}

// ── Main Panel Component ─────────────────────────────────────────────────────

const ActivityFeedPanel: React.FC<ActivityFeedPanelProps> = React.memo(
  ({
    filteredEntries,
    activeFilter,
    setActiveFilter,
    isPaused,
    togglePause,
    clearFeed,
    onNavigate,
  }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const userScrolledUpRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [, forceUpdate] = React.useState(0);

    // Auto-scroll to bottom unless user has scrolled up
    useEffect(() => {
      const el = scrollRef.current;
      if (!el || userScrolledUpRef.current) return;
      el.scrollTop = el.scrollHeight;
    }, [filteredEntries.length]);

    // Detect user scroll direction
    const handleScroll = useCallback(() => {
      const el = scrollRef.current;
      if (!el) return;
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      userScrolledUpRef.current = !isAtBottom;
    }, []);

    // Periodically re-render for relative time updates
    useEffect(() => {
      timerRef.current = setInterval(() => forceUpdate((n) => n + 1), 15_000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }, []);

    const grouped = groupByBucket(filteredEntries);
    const bucketOrder: TimeBucket[] = ['just-now', 'last-5-min', 'last-30-min', 'earlier-today'];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Toolbar: filters + actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderBottom: '1px solid var(--xp-border, rgba(255,255,255,0.08))',
            background: 'var(--xp-surface-light, rgba(255,255,255,0.03))',
            flexShrink: 0,
          }}
        >
          {/* Filter chips */}
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              style={{
                padding: '2px 8px',
                fontSize: '10px',
                borderRadius: '3px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                background:
                  activeFilter === f.value ? 'var(--xp-blue, #89b4fa)' + '33' : 'transparent',
                color:
                  activeFilter === f.value
                    ? 'var(--xp-blue, #89b4fa)'
                    : 'var(--xp-text-muted, #6c7086)',
              }}
            >
              {f.label}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Pause/Resume toggle */}
          <button
            onClick={togglePause}
            title={isPaused ? 'Resume feed' : 'Pause feed'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px 6px',
              fontSize: '10px',
              borderRadius: '3px',
              border: 'none',
              cursor: 'pointer',
              background: isPaused ? 'rgba(250, 204, 21, 0.15)' : 'transparent',
              color: isPaused ? '#facc15' : 'var(--xp-text-muted, #6c7086)',
            }}
          >
            {isPaused ? (
              // Play icon
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.5 4.5l10 5.5-10 5.5V4.5z" />
              </svg>
            ) : (
              // Pause icon
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                <rect x="5" y="4" width="3" height="12" rx="1" />
                <rect x="12" y="4" width="3" height="12" rx="1" />
              </svg>
            )}
          </button>

          {/* Clear button */}
          <button
            onClick={clearFeed}
            title="Clear activity feed"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px 6px',
              fontSize: '10px',
              borderRadius: '3px',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: 'var(--xp-text-muted, #6c7086)',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Paused banner */}
        {isPaused && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '4px 12px',
              background: 'rgba(250, 204, 21, 0.08)',
              borderBottom: '1px solid rgba(250, 204, 21, 0.15)',
              fontSize: '10px',
              color: '#facc15',
              flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
              <rect x="5" y="4" width="3" height="12" rx="1" />
              <rect x="12" y="4" width="3" height="12" rx="1" />
            </svg>
            Feed paused — entries are being collected
          </div>
        )}

        {/* Activity list */}
        <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto' }}>
          {filteredEntries.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                fontSize: '11px',
                color: 'var(--xp-text-muted, #6c7086)',
                gap: '8px',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ opacity: 0.5 }}
              >
                <circle cx="10" cy="10" r="8" />
                <path d="M10 6v4l2.5 2.5" strokeLinecap="round" />
              </svg>
              No activity recorded yet
            </div>
          ) : (
            bucketOrder.map((bucket) => {
              const bucketEntries = grouped.get(bucket);
              if (!bucketEntries || bucketEntries.length === 0) return null;
              return (
                <div key={bucket}>
                  {/* Bucket header */}
                  <div
                    style={{
                      padding: '4px 12px 2px',
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--xp-text-muted, #6c7086)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      background: 'var(--xp-surface, rgba(255,255,255,0.02))',
                      borderBottom: '1px solid var(--xp-border, rgba(255,255,255,0.06))',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    {BUCKET_LABELS[bucket]}
                    <span style={{ marginLeft: '6px', fontWeight: 400, opacity: 0.7 }}>
                      ({bucketEntries.length})
                    </span>
                  </div>
                  {/* Entries */}
                  {bucketEntries.map((entry) => (
                    <ActivityRow key={entry.id} entry={entry} onNavigate={onNavigate} />
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Inline styles for animations and hover effects */}
        <style>{`
        @keyframes activity-slide-in {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .activity-row:hover {
          background: var(--xp-surface-light, rgba(255,255,255,0.04));
        }
        .activity-row:hover .activity-quick-actions {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>
      </div>
    );
  },
);
ActivityFeedPanel.displayName = 'ActivityFeedPanel';

export default ActivityFeedPanel;
