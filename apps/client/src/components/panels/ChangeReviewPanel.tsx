import React, { useCallback } from 'react';
import type { FileChangeSet, FileChange } from '@/hooks/use-focus-change-tracker';

interface ChangeReviewPanelProps {
  changes: FileChangeSet;
  onDismiss: () => void;
  onNavigate?: (path: string) => void;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatTimestamp = (ts: number): string => {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return `${d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })} ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};

const sectionHeaderStyle = (color: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  fontSize: 11,
  fontWeight: 600,
  color,
  background: 'var(--xp-surface-light, rgba(255,255,255,0.03))',
  borderBottom: '1px solid var(--xp-border, rgba(255,255,255,0.06))',
  position: 'sticky',
  top: 0,
  zIndex: 1,
});

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 12px 4px 24px',
  fontSize: 11,
  cursor: 'pointer',
  borderBottom: '1px solid var(--xp-border, rgba(255,255,255,0.03))',
  transition: 'background 0.1s',
};

const dotStyle = (color: string): React.CSSProperties => ({
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: color,
  flexShrink: 0,
});

const nameStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--xp-text, #c0caf5)',
};

const metaStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--xp-text-muted, #565f89)',
  whiteSpace: 'nowrap',
};

const FileIcon = React.memo(function FileIcon() {
  return (
    <svg
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      style={{ color: 'var(--xp-text-muted, #565f89)', flexShrink: 0 }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
});

const ChangeSection = ({
  title,
  color,
  icon,
  changes,
  onClickChange,
}: {
  title: string;
  color: string;
  icon: React.ReactNode;
  changes: FileChange[];
  onClickChange: (change: FileChange) => void;
}) => {
  if (changes.length === 0) return null;

  return (
    <>
      <div style={sectionHeaderStyle(color)}>
        {icon}
        {title} ({changes.length})
      </div>
      {changes.map((change) => (
        <div
          key={change.path}
          style={rowStyle}
          onClick={() => onClickChange(change)}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background =
              'var(--xp-surface-light, rgba(255,255,255,0.06))';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = '';
          }}
          title={change.path}
        >
          <div style={dotStyle(color)} />
          <FileIcon />
          <span style={nameStyle}>{change.name}</span>
          {change.size != null && change.size > 0 && (
            <span style={metaStyle}>{formatSize(change.size)}</span>
          )}
          {change.modifiedAt != null && change.modifiedAt > 0 && (
            <span style={metaStyle}>{formatTimestamp(change.modifiedAt)}</span>
          )}
        </div>
      ))}
    </>
  );
};

const ChangeReviewPanel = React.memo(function ChangeReviewPanel({
  changes,
  onDismiss,
  onNavigate,
}: ChangeReviewPanelProps) {
  const handleClickChange = useCallback(
    (change: FileChange) => {
      if (!onNavigate) return;
      // Navigate to the parent directory of the changed file
      const sep = change.path.includes('/') ? '/' : '\\';
      const parts = change.path.split(sep);
      parts.pop();
      const parentDir = parts.join(sep);
      if (parentDir) {
        onNavigate(parentDir);
      }
    },
    [onNavigate],
  );

  const toolbarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderBottom: '1px solid var(--xp-border, rgba(255,255,255,0.06))',
    background: 'var(--xp-surface-light, rgba(255,255,255,0.03))',
  };

  const summaryStyle: React.CSSProperties = {
    flex: 1,
    fontSize: 11,
    color: 'var(--xp-text-muted, #565f89)',
  };

  const acceptBtnStyle: React.CSSProperties = {
    padding: '3px 10px',
    fontSize: 10,
    fontWeight: 600,
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    background: 'var(--xp-blue, #7aa2f7)',
    color: '#fff',
    transition: 'opacity 0.15s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <svg
          width={14}
          height={14}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          style={{ color: 'var(--xp-blue, #7aa2f7)', flexShrink: 0 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <span style={summaryStyle}>
          {changes.totalCount} change{changes.totalCount !== 1 ? 's' : ''} detected
          {changes.added.length > 0 && (
            <span style={{ color: '#9ece6a', marginLeft: 8 }}>+{changes.added.length}</span>
          )}
          {changes.removed.length > 0 && (
            <span style={{ color: '#f7768e', marginLeft: 6 }}>-{changes.removed.length}</span>
          )}
          {changes.modified.length > 0 && (
            <span style={{ color: '#e0af68', marginLeft: 6 }}>~{changes.modified.length}</span>
          )}
        </span>
        <button
          style={acceptBtnStyle}
          onClick={onDismiss}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '1';
          }}
        >
          Accept All
        </button>
      </div>

      {/* Changes list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <ChangeSection
          title="Added"
          color="#9ece6a"
          icon={
            <svg width={12} height={12} fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
          }
          changes={changes.added}
          onClickChange={handleClickChange}
        />
        <ChangeSection
          title="Removed"
          color="#f7768e"
          icon={
            <svg width={12} height={12} fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
          }
          changes={changes.removed}
          onClickChange={handleClickChange}
        />
        <ChangeSection
          title="Modified"
          color="#e0af68"
          icon={
            <svg
              width={12}
              height={12}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          }
          changes={changes.modified}
          onClickChange={handleClickChange}
        />

        {changes.totalCount === 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              fontSize: 12,
              color: 'var(--xp-text-muted, #565f89)',
            }}
          >
            No changes detected
          </div>
        )}
      </div>
    </div>
  );
});

export default ChangeReviewPanel;
