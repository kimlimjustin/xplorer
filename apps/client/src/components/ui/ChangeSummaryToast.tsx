import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { FileChangeSet } from '@/hooks/use-focus-change-tracker';

const AUTO_DISMISS_MS = 30_000; // 30 seconds

interface ChangeSummaryToastProps {
  changes: FileChangeSet;
  onDismiss: () => void;
  onReview: () => void;
}

const ChangeSummaryToast = React.memo(
  ({ changes, onDismiss, onReview }: ChangeSummaryToastProps) => {
    const [visible, setVisible] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [interacted, setInteracted] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Animate in on mount
    useEffect(() => {
      const t = setTimeout(() => setVisible(true), 20);
      return () => clearTimeout(t);
    }, []);

    // Auto-dismiss after 30 seconds if not interacted
    useEffect(() => {
      if (interacted) return;
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, AUTO_DISMISS_MS);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, [interacted, onDismiss]);

    const handleDismiss = useCallback(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, [onDismiss]);

    const handleReview = useCallback(() => {
      setInteracted(true);
      setVisible(false);
      setTimeout(onReview, 300);
    }, [onReview]);

    const handleExpand = useCallback(() => {
      setInteracted(true);
      setExpanded((prev) => !prev);
    }, []);

    const containerStyle: React.CSSProperties = {
      position: 'fixed',
      bottom: 40,
      right: 16,
      zIndex: 9999,
      minWidth: 320,
      maxWidth: 420,
      background: 'var(--xp-surface, rgba(30, 30, 46, 0.95))',
      border: '1px solid var(--xp-border, rgba(255, 255, 255, 0.1))',
      borderRadius: 8,
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.3s ease, opacity 0.3s ease',
      overflow: 'hidden',
    };

    const headerStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 12px',
    };

    const iconStyle: React.CSSProperties = {
      width: 18,
      height: 18,
      color: 'var(--xp-blue, #7aa2f7)',
      flexShrink: 0,
    };

    const titleStyle: React.CSSProperties = {
      flex: 1,
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--xp-text, #c0caf5)',
    };

    const subtitleStyle: React.CSSProperties = {
      fontSize: 11,
      color: 'var(--xp-text-muted, #565f89)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 12px 8px 38px',
    };

    const countStyle = (color: string): React.CSSProperties => ({
      fontSize: 11,
      fontWeight: 600,
      color,
    });

    const buttonRowStyle: React.CSSProperties = {
      display: 'flex',
      gap: 6,
      padding: '0 12px 10px 38px',
    };

    const btnBase: React.CSSProperties = {
      padding: '4px 12px',
      fontSize: 11,
      fontWeight: 500,
      borderRadius: 4,
      border: 'none',
      cursor: 'pointer',
      transition: 'background 0.15s ease',
    };

    const reviewBtnStyle: React.CSSProperties = {
      ...btnBase,
      background: 'var(--xp-blue, #7aa2f7)',
      color: '#fff',
    };

    const expandBtnStyle: React.CSSProperties = {
      ...btnBase,
      background: 'var(--xp-surface-light, rgba(255,255,255,0.06))',
      color: 'var(--xp-text-muted, #565f89)',
    };

    const dismissBtnStyle: React.CSSProperties = {
      ...btnBase,
      background: 'transparent',
      color: 'var(--xp-text-muted, #565f89)',
    };

    const listStyle: React.CSSProperties = {
      maxHeight: 180,
      overflowY: 'auto',
      borderTop: '1px solid var(--xp-border, rgba(255,255,255,0.06))',
      padding: '6px 0',
    };

    const listItemStyle = (_color: string): React.CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 12px',
      fontSize: 11,
      color: 'var(--xp-text, #c0caf5)',
    });

    const typeIndicatorStyle = (color: string): React.CSSProperties => ({
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
    });

    const allChanges = [
      ...changes.added.map((c) => ({ ...c, color: '#9ece6a' })),
      ...changes.removed.map((c) => ({ ...c, color: '#f7768e' })),
      ...changes.modified.map((c) => ({ ...c, color: '#e0af68' })),
    ];

    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          {/* Bell/change icon */}
          <svg
            style={iconStyle}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span style={titleStyle}>
            {changes.totalCount} file{changes.totalCount !== 1 ? 's' : ''} changed while you were
            away
          </span>
        </div>

        <div style={subtitleStyle}>
          {changes.added.length > 0 && (
            <span style={countStyle('#9ece6a')}>+{changes.added.length} new</span>
          )}
          {changes.removed.length > 0 && (
            <span style={countStyle('#f7768e')}>-{changes.removed.length} deleted</span>
          )}
          {changes.modified.length > 0 && (
            <span style={countStyle('#e0af68')}>~{changes.modified.length} modified</span>
          )}
        </div>

        <div style={buttonRowStyle}>
          <button style={reviewBtnStyle} onClick={handleReview}>
            Review
          </button>
          <button style={expandBtnStyle} onClick={handleExpand}>
            {expanded ? 'Collapse' : 'Details'}
          </button>
          <button style={dismissBtnStyle} onClick={handleDismiss}>
            Dismiss
          </button>
        </div>

        {expanded && (
          <div style={listStyle}>
            {allChanges.map((change) => (
              <div key={change.path} style={listItemStyle(change.color)}>
                <div style={typeIndicatorStyle(change.color)} />
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {change.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--xp-text-muted, #565f89)' }}>
                  {change.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);
ChangeSummaryToast.displayName = 'ChangeSummaryToast';

export default ChangeSummaryToast;
