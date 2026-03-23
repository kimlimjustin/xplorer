import React, { useState, useEffect, useCallback } from 'react';
import { getHistory, clearHistory, type ClipboardEntry } from '@/hooks/use-clipboard-history';
import { useWindowEvent } from '@/hooks/use-window-event';

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatTimestamp = (ts: number): string => {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ── Icons (inline SVG) ──────────────────────────────────────────────────────

const CopyIcon = () => {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
};

const ScissorsIcon = () => {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
};

const TrashIcon = () => {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
};

const ClipboardIcon = () => {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
};

const FolderIcon = () => {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
};

const FileIcon = () => {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
};

// ── Props ────────────────────────────────────────────────────────────────────

interface ClipboardHistoryPanelProps {
  /** Called when user clicks "Paste Here" on an entry */
  onPaste: (entry: ClipboardEntry) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

const ClipboardHistoryPanel = ({ onPaste }: ClipboardHistoryPanelProps) => {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);

  const refresh = useCallback(() => {
    setEntries(getHistory());
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);
  // Listen for changes
  useWindowEvent('clipboard-history-changed', refresh);

  const handleClear = useCallback(() => {
    clearHistory();
  }, []);

  if (entries.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 8,
          color: 'var(--xp-text-muted)',
          fontSize: 12,
        }}
      >
        <ClipboardIcon />
        <span>No clipboard history</span>
        <span style={{ fontSize: 11, opacity: 0.7 }}>Copy or cut files to see them here</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          borderBottom: '1px solid var(--xp-border)',
          backgroundColor: 'rgba(var(--xp-surface-light-rgb, 255,255,255), 0.03)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--xp-text-muted)' }}>
          {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
        </span>
        <button
          onClick={handleClear}
          title="Clear clipboard history"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            fontSize: 11,
            color: 'var(--xp-text-muted)',
            background: 'none',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = 'var(--xp-surface-light)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          <TrashIcon />
          Clear
        </button>
      </div>

      {/* Entry list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {entries.map((entry) => (
          <div
            key={entry.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '6px 12px',
              borderBottom: '1px solid var(--xp-border, rgba(255,255,255,0.06))',
              cursor: 'default',
              transition: 'background-color 0.1s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-surface-light)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            {/* Operation icon */}
            <div
              style={{
                flexShrink: 0,
                marginTop: 2,
                color:
                  entry.operation === 'cut'
                    ? 'var(--xp-yellow, #e0af68)'
                    : 'var(--xp-blue, #7aa2f7)',
              }}
              title={entry.operation === 'cut' ? 'Cut' : 'Copy'}
            >
              {entry.operation === 'cut' ? <ScissorsIcon /> : <CopyIcon />}
            </div>

            {/* File info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* File list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {entry.files.slice(0, 3).map((f, i) => (
                  <div
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      color: 'var(--xp-text)',
                    }}
                  >
                    <span style={{ flexShrink: 0, color: 'var(--xp-text-muted)' }}>
                      {f.isDir ? <FolderIcon /> : <FileIcon />}
                    </span>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.name}
                    </span>
                  </div>
                ))}
                {entry.files.length > 3 && (
                  <span style={{ fontSize: 11, color: 'var(--xp-text-muted)' }}>
                    +{entry.files.length - 3} more
                  </span>
                )}
              </div>

              {/* Timestamp */}
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--xp-text-muted)',
                  marginTop: 2,
                  opacity: 0.7,
                }}
              >
                {formatTimestamp(entry.timestamp)}
              </div>
            </div>

            {/* Paste button */}
            <button
              onClick={() => onPaste(entry)}
              title="Paste these files to current directory"
              style={{
                flexShrink: 0,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--xp-blue, #7aa2f7)',
                backgroundColor: 'rgba(122, 162, 247, 0.1)',
                border: '1px solid rgba(122, 162, 247, 0.2)',
                borderRadius: 4,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                marginTop: 2,
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'rgba(122, 162, 247, 0.2)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'rgba(122, 162, 247, 0.1)';
              }}
            >
              Paste Here
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClipboardHistoryPanel;
