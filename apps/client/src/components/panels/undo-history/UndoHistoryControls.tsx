import React, { useEffect, useRef } from 'react';
import {
  operationIcon,
  operationColor,
  formatTimestamp,
  fileName,
  parentDir,
  type UndoHistoryEntry,
  type DisplayItem,
  type ContextMenuState,
  type DetailsPopoverState,
} from '../undo-history-helpers';

// ── Details Popover ─────────────────────────────────────────────────────────

const DetailsPopover = React.memo(
  ({ state, onClose }: { state: DetailsPopoverState; onClose: () => void }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handle = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) {
          onClose();
        }
      };
      document.addEventListener('mousedown', handle);
      return () => document.removeEventListener('mousedown', handle);
    }, [onClose]);

    const entries: UndoHistoryEntry[] =
      state.item.kind === 'group' ? state.item.group.entries : [state.item.entry];

    const opType = entries[0]?.operation_type ?? '';
    const timestamp = entries[entries.length - 1]?.timestamp_ms ?? 0;
    const firstTs = entries[0]?.timestamp_ms ?? 0;
    const durationMs = timestamp - firstTs;

    return (
      <div
        ref={ref}
        style={{
          position: 'fixed',
          left: Math.min(state.x, window.innerWidth - 320),
          top: Math.min(state.y, window.innerHeight - 300),
          width: '300px',
          maxHeight: '280px',
          backgroundColor: 'var(--xp-surface, #1a1a2e)',
          border: '1px solid var(--xp-border)',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 10000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--xp-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ color: operationColor(opType), display: 'flex' }}>
            {operationIcon(opType)}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--xp-text)' }}>
            {opType} Details
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--xp-text-muted)' }}>
            {formatTimestamp(timestamp)}
          </span>
        </div>

        {entries.length > 1 && durationMs > 0 && (
          <div style={{ padding: '4px 12px', fontSize: '10px', color: 'var(--xp-text-muted)' }}>
            Duration: {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}{' '}
            -- {entries.length} file{entries.length !== 1 ? 's' : ''}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {entries.map((entry) => (
            <div
              key={entry.index}
              style={{
                padding: '3px 12px',
                fontSize: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span
                  style={{
                    color: 'var(--xp-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {fileName(entry.source_path)}
                </span>
              </div>
              {(opType === 'Copy' || opType === 'Move' || opType === 'Rename') &&
                entry.source_path &&
                entry.dest_path && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--xp-text-muted)',
                      fontSize: '9px',
                    }}
                  >
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '120px',
                      }}
                    >
                      {opType === 'Rename'
                        ? fileName(entry.source_path)
                        : parentDir(entry.source_path)}
                    </span>
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0 }}
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '120px',
                      }}
                    >
                      {opType === 'Rename' ? fileName(entry.dest_path) : parentDir(entry.dest_path)}
                    </span>
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>
    );
  },
);
DetailsPopover.displayName = 'DetailsPopover';

// ── Context Menu ────────────────────────────────────────────────────────────

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onUndoThis: (item: DisplayItem) => void;
  onUndoThisAndAfter: (item: DisplayItem) => void;
  onShowDetails: (item: DisplayItem, x: number, y: number) => void;
  onReplayOnSelection: (item: DisplayItem) => void;
  onClearAbove: (item: DisplayItem) => void;
}

const ContextMenu = React.memo(
  ({
    state,
    onClose,
    onUndoThis,
    onUndoThisAndAfter,
    onShowDetails,
    onReplayOnSelection,
    onClearAbove,
  }: ContextMenuProps) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handle = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) {
          onClose();
        }
      };
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('mousedown', handle);
      document.addEventListener('keydown', handleKey);
      return () => {
        document.removeEventListener('mousedown', handle);
        document.removeEventListener('keydown', handleKey);
      };
    }, [onClose]);

    const entries = state.item.kind === 'group' ? state.item.group.entries : [state.item.entry];
    const isUndoable = entries[0]?.undoable ?? false;

    const menuItemStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '5px 12px',
      fontSize: '11px',
      color: 'var(--xp-text)',
      cursor: 'pointer',
      border: 'none',
      backgroundColor: 'transparent',
      width: '100%',
      textAlign: 'left',
      borderRadius: '0',
    };

    const menuItemHover = (e: React.MouseEvent<HTMLButtonElement>) => {
      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.08)';
    };
    const menuItemLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
    };

    return (
      <div
        ref={ref}
        style={{
          position: 'fixed',
          left: Math.min(state.x, window.innerWidth - 220),
          top: Math.min(state.y, window.innerHeight - 200),
          width: '210px',
          backgroundColor: 'var(--xp-surface, #1a1a2e)',
          border: '1px solid var(--xp-border)',
          borderRadius: '6px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 10001,
          padding: '4px 0',
          backdropFilter: 'blur(12px)',
        }}
      >
        {isUndoable && (
          <button
            style={menuItemStyle}
            onMouseEnter={menuItemHover}
            onMouseLeave={menuItemLeave}
            onClick={() => {
              onUndoThis(state.item);
              onClose();
            }}
          >
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
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
            </svg>
            Undo This
          </button>
        )}
        {isUndoable && (
          <button
            style={menuItemStyle}
            onMouseEnter={menuItemHover}
            onMouseLeave={menuItemLeave}
            onClick={() => {
              onUndoThisAndAfter(state.item);
              onClose();
            }}
          >
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
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
            Undo This + All After
          </button>
        )}
        {!isUndoable && (
          <button
            style={menuItemStyle}
            onMouseEnter={menuItemHover}
            onMouseLeave={menuItemLeave}
            onClick={() => {
              onUndoThis(state.item);
              onClose();
            }}
          >
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
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
            Redo This
          </button>
        )}
        <button
          style={menuItemStyle}
          onMouseEnter={menuItemHover}
          onMouseLeave={menuItemLeave}
          onClick={() => {
            onShowDetails(state.item, state.x, state.y);
            onClose();
          }}
        >
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
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          Show Details
        </button>
        <button
          style={menuItemStyle}
          onMouseEnter={menuItemHover}
          onMouseLeave={menuItemLeave}
          onClick={() => {
            onReplayOnSelection(state.item);
            onClose();
          }}
        >
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
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Replay on Selection
        </button>

        <div style={{ height: '1px', backgroundColor: 'var(--xp-border)', margin: '4px 8px' }} />

        <button
          style={{ ...menuItemStyle, color: 'var(--xp-red, #f87171)' }}
          onMouseEnter={menuItemHover}
          onMouseLeave={menuItemLeave}
          onClick={() => {
            onClearAbove(state.item);
            onClose();
          }}
        >
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
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          Clear History Above
        </button>
      </div>
    );
  },
);
ContextMenu.displayName = 'ContextMenu';

// ── Replay Confirm Dialog ───────────────────────────────────────────────────

interface ReplayDialogProps {
  operationType: string;
  operationDescription: string;
  destPath: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const ReplayConfirmDialog = React.memo(
  ({ operationType, operationDescription, destPath, onConfirm, onCancel }: ReplayDialogProps) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
        if (e.key === 'Enter') onConfirm();
      };
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }, [onCancel, onConfirm]);

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10002,
        }}
      >
        <div
          ref={ref}
          style={{
            width: '380px',
            backgroundColor: 'var(--xp-surface, #1a1a2e)',
            border: '1px solid var(--xp-border)',
            borderRadius: '10px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            padding: '20px',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ color: operationColor(operationType), display: 'flex' }}>
              {operationIcon(operationType)}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--xp-text)' }}>
              Replay {operationType}
            </span>
          </div>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--xp-text-muted)',
              marginBottom: '8px',
              lineHeight: '1.5',
            }}
          >
            This will apply the same operation pattern to your currently selected files:
          </p>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--xp-text)',
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderRadius: '6px',
              padding: '8px 10px',
              marginBottom: '16px',
              border: '1px solid var(--xp-border)',
            }}
          >
            <strong>Operation:</strong> {operationDescription}
            {destPath && (
              <div style={{ marginTop: '4px' }}>
                <strong>Destination:</strong> {parentDir(destPath)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '5px 14px',
                fontSize: '11px',
                fontWeight: 500,
                borderRadius: '5px',
                border: '1px solid var(--xp-border)',
                backgroundColor: 'transparent',
                color: 'var(--xp-text-muted)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              style={{
                padding: '5px 14px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '5px',
                border: 'none',
                backgroundColor: operationColor(operationType),
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Replay
            </button>
          </div>
        </div>
      </div>
    );
  },
);
ReplayConfirmDialog.displayName = 'ReplayConfirmDialog';

// ── Toolbar ─────────────────────────────────────────────────────────────────

interface ToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  actionInProgress: boolean;
  loading: boolean;
  undoCount: number;
  totalEntries: number;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onRefresh: () => void;
}

const Toolbar = ({
  canUndo,
  canRedo,
  actionInProgress,
  loading,
  undoCount,
  totalEntries,
  onUndo,
  onRedo,
  onClear,
  onRefresh,
}: ToolbarProps) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderBottom: '1px solid var(--xp-border)',
      backgroundColor: 'var(--xp-surface-light)',
      flexShrink: 0,
    }}
  >
    <button
      onClick={onUndo}
      disabled={!canUndo || actionInProgress}
      title="Undo (Ctrl+Z)"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: 500,
        borderRadius: '4px',
        border: 'none',
        cursor: canUndo && !actionInProgress ? 'pointer' : 'default',
        color: canUndo ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
        backgroundColor: canUndo ? 'rgba(var(--xp-blue-rgb, 96,165,250), 0.12)' : 'transparent',
        opacity: canUndo && !actionInProgress ? 1 : 0.5,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
      </svg>
      Undo
    </button>

    <button
      onClick={onRedo}
      disabled={!canRedo || actionInProgress}
      title="Redo (Ctrl+Y)"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: 500,
        borderRadius: '4px',
        border: 'none',
        cursor: canRedo && !actionInProgress ? 'pointer' : 'default',
        color: canRedo ? 'var(--xp-green, #34d399)' : 'var(--xp-text-muted)',
        backgroundColor: canRedo ? 'rgba(52,211,153,0.12)' : 'transparent',
        opacity: canRedo && !actionInProgress ? 1 : 0.5,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
      </svg>
      Redo
    </button>

    <div style={{ flex: 1 }} />

    <span style={{ fontSize: '10px', color: 'var(--xp-text-muted)' }}>
      {undoCount} undo{undoCount !== 1 ? 's' : ''} / {totalEntries - undoCount} redo
      {totalEntries - undoCount !== 1 ? 's' : ''}
    </span>

    <button
      onClick={onClear}
      disabled={totalEntries === 0 || actionInProgress}
      title="Clear all history"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        padding: '2px 8px',
        fontSize: '10px',
        fontWeight: 500,
        borderRadius: '4px',
        border: 'none',
        cursor: totalEntries > 0 && !actionInProgress ? 'pointer' : 'default',
        color: 'var(--xp-text-muted)',
        backgroundColor: 'transparent',
        opacity: totalEntries > 0 && !actionInProgress ? 1 : 0.4,
      }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
      Clear
    </button>

    <button
      onClick={onRefresh}
      disabled={loading}
      title="Refresh"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '2px 4px',
        borderRadius: '4px',
        border: 'none',
        cursor: loading ? 'default' : 'pointer',
        color: 'var(--xp-text-muted)',
        backgroundColor: 'transparent',
        opacity: loading ? 0.5 : 1,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={loading ? { animation: 'spin 1s linear infinite' } : undefined}
      >
        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  </div>
);

export { DetailsPopover, ContextMenu, ReplayConfirmDialog, Toolbar };
