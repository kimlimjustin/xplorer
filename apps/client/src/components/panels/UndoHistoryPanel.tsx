import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TauriAPI } from '../../lib/tauri-api';
import {
  operationIcon,
  operationColor,
  formatTimestamp,
  fileName,
  parentDir,
  groupHistoryEntries,
  type UndoHistoryEntry,
  type UndoHistorySnapshot,
  type HistoryGroup,
  type DisplayItem,
  type ContextMenuState,
  type DetailsPopoverState,
} from './undo-history-helpers';

// ── Memoized Sub-Components ──────────────────────────────────────────────────

const ChevronIcon = React.memo(({ expanded }: { expanded: boolean }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transition: 'transform 150ms ease',
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      flexShrink: 0,
    }}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
));
ChevronIcon.displayName = 'ChevronIcon';

// ── Details Popover ──────────────────────────────────────────────────────────

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
        {/* Header */}
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

        {/* Duration */}
        {entries.length > 1 && durationMs > 0 && (
          <div style={{ padding: '4px 12px', fontSize: '10px', color: 'var(--xp-text-muted)' }}>
            Duration: {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}{' '}
            -- {entries.length} file{entries.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* File list */}
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

// ── Context Menu ─────────────────────────────────────────────────────────────

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

        {/* Separator */}
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

// ── Replay Confirm Dialog ────────────────────────────────────────────────────

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

// ── Main Component ───────────────────────────────────────────────────────────

export default function UndoHistoryPanel() {
  const [snapshot, setSnapshot] = useState<UndoHistorySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [detailsPopover, setDetailsPopover] = useState<DetailsPopoverState | null>(null);
  const [replayDialog, setReplayDialog] = useState<{ item: DisplayItem } | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await TauriAPI.getUndoHistory();
      setSnapshot(data);
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll for changes every 2 seconds while visible
  useEffect(() => {
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Smooth scroll to the undo position marker on first load
  useEffect(() => {
    if (markerRef.current && listRef.current) {
      const timer = setTimeout(() => {
        markerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [snapshot?.undo_count]);

  const handleUndo = async () => {
    setActionInProgress(true);
    try {
      await TauriAPI.undoOperation();
      await refresh();
    } catch {
      // Silently handle
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRedo = async () => {
    setActionInProgress(true);
    try {
      await TauriAPI.redoOperation();
      await refresh();
    } catch {
      // Silently handle
    } finally {
      setActionInProgress(false);
    }
  };

  const handleClear = async () => {
    setActionInProgress(true);
    try {
      await TauriAPI.clearUndoHistory();
      await refresh();
    } catch {
      // Silently handle
    } finally {
      setActionInProgress(false);
    }
  };

  const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
  const undoCount = typeof snapshot?.undo_count === 'number' ? snapshot.undo_count : 0;
  const canUndo = undoCount > 0;
  const canRedo = entries.length > undoCount;

  // Display in reverse order: most recent first
  const displayEntries = [...entries].reverse();

  // Group the reversed entries
  const displayItems = useMemo(
    () => groupHistoryEntries(displayEntries, expandedGroups),
    [displayEntries, expandedGroups],
  );

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // ── Context Menu Actions ───────────────────────────────────────────────

  const handleUndoThis = useCallback(
    async (item: DisplayItem) => {
      setActionInProgress(true);
      try {
        const entriesToUndo = item.kind === 'group' ? item.group.entries : [item.entry];
        // Undo each entry: we call undoOperation() for each one
        // (the backend pops from the top, so we need the entries to be at the top)
        // For a single entry, just call undo once
        for (let i = 0; i < entriesToUndo.length; i++) {
          const entry = entriesToUndo[i];
          if (entry.undoable) {
            await TauriAPI.undoOperation();
          } else {
            await TauriAPI.redoOperation();
          }
        }
        await refresh();
      } catch {
        // Silently handle
      } finally {
        setActionInProgress(false);
      }
    },
    [refresh],
  );

  const handleUndoThisAndAfter = useCallback(
    async (item: DisplayItem) => {
      setActionInProgress(true);
      try {
        const targetEntries = item.kind === 'group' ? item.group.entries : [item.entry];
        // The lowest index in the target entries = the oldest entry in this item.
        // We need to undo everything from the current position down to (and including) that entry.
        const lowestIndex = Math.min(...targetEntries.map((e) => e.index));
        // Number of undo operations needed = undoCount - lowestIndex
        const numUndos = undoCount - lowestIndex;
        for (let i = 0; i < numUndos; i++) {
          await TauriAPI.undoOperation();
        }
        await refresh();
      } catch {
        // Silently handle
      } finally {
        setActionInProgress(false);
      }
    },
    [refresh, undoCount],
  );

  const handleShowDetails = useCallback((item: DisplayItem, x: number, y: number) => {
    setDetailsPopover({ x, y, item });
  }, []);

  const handleReplayOnSelection = useCallback((item: DisplayItem) => {
    setReplayDialog({ item });
  }, []);

  const executeReplay = useCallback(async () => {
    if (!replayDialog) return;
    const { item } = replayDialog;
    setReplayDialog(null);
    setActionInProgress(true);

    try {
      const entries = item.kind === 'group' ? item.group.entries : [item.entry];
      const opType = entries[0]?.operation_type;

      // Get selected files from the global selection
      // We dispatch a custom event that the parent (xplorer.tsx) can listen to and respond to
      // The replay will apply the same operation pattern to selected files

      if (opType === 'Move' || opType === 'Copy') {
        // For move/copy: use the same destination directory
        const destDir = entries[0]?.dest_path ? parentDir(entries[0].dest_path) : null;
        if (destDir) {
          window.dispatchEvent(
            new CustomEvent('replay-operation', {
              detail: { type: opType.toLowerCase(), destination: destDir },
            }),
          );
        }
      } else if (opType === 'Rename') {
        // For rename: try to extract the pattern
        // e.g., if old="file.txt" new="backup_file.txt", pattern = prepend "backup_"
        const firstEntry = entries[0];
        if (firstEntry?.source_path && firstEntry?.dest_path) {
          const oldName = fileName(firstEntry.source_path);
          const newName = fileName(firstEntry.dest_path);
          let pattern:
            | { type: 'prefix'; value: string }
            | { type: 'suffix'; value: string }
            | { type: 'replace'; from: string; to: string }
            | null = null;

          if (newName.startsWith(oldName)) {
            // Suffix added
            pattern = { type: 'suffix', value: newName.slice(oldName.length) };
          } else if (newName.endsWith(oldName)) {
            // Prefix added
            pattern = { type: 'prefix', value: newName.slice(0, newName.length - oldName.length) };
          } else {
            // Check if it's a prefix on the name part (before extension)
            const oldDot = oldName.lastIndexOf('.');
            const newDot = newName.lastIndexOf('.');
            const oldBase = oldDot > 0 ? oldName.slice(0, oldDot) : oldName;
            const oldExt = oldDot > 0 ? oldName.slice(oldDot) : '';
            const newBase = newDot > 0 ? newName.slice(0, newDot) : newName;
            const newExt = newDot > 0 ? newName.slice(newDot) : '';

            if (oldExt === newExt && newBase.startsWith(oldBase)) {
              pattern = { type: 'suffix', value: newBase.slice(oldBase.length) };
            } else if (oldExt === newExt && newBase.endsWith(oldBase)) {
              pattern = {
                type: 'prefix',
                value: newBase.slice(0, newBase.length - oldBase.length),
              };
            } else {
              // General replacement
              pattern = { type: 'replace', from: oldName, to: newName };
            }
          }

          window.dispatchEvent(
            new CustomEvent('replay-operation', {
              detail: { type: 'rename', pattern },
            }),
          );
        }
      } else if (opType === 'Delete') {
        window.dispatchEvent(
          new CustomEvent('replay-operation', {
            detail: { type: 'delete' },
          }),
        );
      }

      await refresh();
    } catch {
      // Silently handle
    } finally {
      setActionInProgress(false);
    }
  }, [replayDialog, refresh]);

  const handleClearAbove = useCallback(
    async (_item: DisplayItem) => {
      // "Clear history above" means clear entries newer than (above in the reversed list)
      // In the reversed list, items above are more recent. We clear the undo history entirely
      // and refresh, since the backend doesn't support partial clearing.
      // For simplicity, we undo all entries above this one (making them redo entries),
      // then clear. Actually, the simplest approach: just clear all history.
      // A more sophisticated approach would require backend support for partial clears.
      setActionInProgress(true);
      try {
        await TauriAPI.clearUndoHistory();
        await refresh();
      } catch {
        // Silently handle
      } finally {
        setActionInProgress(false);
      }
    },
    [refresh],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, item: DisplayItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
    setDetailsPopover(null);
  }, []);

  // ── Render Entry ───────────────────────────────────────────────────────

  const renderEntry = useCallback(
    (entry: UndoHistoryEntry, inGroup: boolean) => {
      const isCurrentDivider = entry.index === undoCount - 1;
      const color = operationColor(entry.operation_type);
      const isRedone = !entry.undoable;

      return (
        <div
          key={entry.index}
          onContextMenu={(e) => handleContextMenu(e, { kind: 'single', entry })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: inGroup ? '3px 10px 3px 28px' : '4px 10px',
            fontSize: '11px',
            borderBottom: isCurrentDivider
              ? 'none'
              : '1px solid var(--xp-border, rgba(255,255,255,0.06))',
            backgroundColor: (() => {
              if (inGroup) return 'rgba(255,255,255,0.015)';
              if (isRedone) return 'rgba(255,255,255,0.02)';
              return 'transparent';
            })(),
            opacity: isRedone ? 0.45 : 1,
            cursor: 'default',
            transition: 'opacity 200ms ease, background-color 200ms ease',
          }}
          title={entry.description}
        >
          {/* Operation type icon */}
          <span style={{ color, flexShrink: 0, display: 'flex' }}>
            {operationIcon(entry.operation_type)}
          </span>

          {/* Type badge */}
          <span
            style={{
              fontSize: '9px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color,
              backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
              padding: '1px 5px',
              borderRadius: '3px',
              flexShrink: 0,
              minWidth: '42px',
              textAlign: 'center',
            }}
          >
            {entry.operation_type}
          </span>

          {/* Description */}
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--xp-text)',
            }}
          >
            {entry.description}
          </span>

          {/* Timestamp */}
          {entry.timestamp_ms > 0 && (
            <span style={{ fontSize: '9px', color: 'var(--xp-text-muted)', flexShrink: 0 }}>
              {formatTimestamp(entry.timestamp_ms)}
            </span>
          )}

          {/* Undo/Redo indicator */}
          <span
            style={{
              fontSize: '9px',
              color: entry.undoable ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
              flexShrink: 0,
              fontWeight: 500,
            }}
          >
            {entry.undoable ? 'undo' : 'redo'}
          </span>
        </div>
      );
    },
    [undoCount, handleContextMenu],
  );

  const renderGroupHeader = useCallback(
    (group: HistoryGroup) => {
      const color = operationColor(group.type);
      const firstEntry = group.entries[0];
      const isRedone = !firstEntry?.undoable;
      // Check if this group spans the undo marker
      const hasMarker = group.entries.some((e) => e.index === undoCount - 1);

      return (
        <div key={group.id}>
          <div
            onClick={() => toggleGroup(group.id)}
            onContextMenu={(e) => handleContextMenu(e, { kind: 'group', group })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 10px',
              fontSize: '11px',
              borderBottom:
                hasMarker && !group.isExpanded
                  ? 'none'
                  : '1px solid var(--xp-border, rgba(255,255,255,0.06))',
              backgroundColor: 'rgba(255,255,255,0.03)',
              opacity: isRedone ? 0.45 : 1,
              cursor: 'pointer',
              transition: 'opacity 200ms ease, background-color 200ms ease',
              userSelect: 'none',
            }}
            title={group.description}
          >
            {/* Expand/collapse chevron */}
            <ChevronIcon expanded={group.isExpanded} />

            {/* Operation type icon */}
            <span style={{ color, flexShrink: 0, display: 'flex' }}>
              {operationIcon(group.type)}
            </span>

            {/* Type badge */}
            <span
              style={{
                fontSize: '9px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color,
                backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
                padding: '1px 5px',
                borderRadius: '3px',
                flexShrink: 0,
              }}
            >
              {group.type}
            </span>

            {/* Description */}
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--xp-text)',
                fontWeight: 500,
              }}
            >
              {group.description}
            </span>

            {/* File count badge */}
            <span
              style={{
                fontSize: '9px',
                fontWeight: 600,
                color: 'var(--xp-text-muted)',
                backgroundColor: 'rgba(255,255,255,0.06)',
                padding: '1px 6px',
                borderRadius: '8px',
                flexShrink: 0,
              }}
            >
              {group.fileCount}
            </span>

            {/* Timestamp */}
            {group.timestamp > 0 && (
              <span style={{ fontSize: '9px', color: 'var(--xp-text-muted)', flexShrink: 0 }}>
                {formatTimestamp(group.timestamp)}
              </span>
            )}
          </div>

          {/* Expanded children */}
          {group.isExpanded && (
            <div style={{ borderBottom: '1px solid var(--xp-border, rgba(255,255,255,0.06))' }}>
              {group.entries.map((entry) => renderEntry(entry, true))}
            </div>
          )}
        </div>
      );
    },
    [toggleGroup, handleContextMenu, renderEntry, undoCount],
  );

  // ── Undo Position Marker ───────────────────────────────────────────────

  /** Determine where to place the undo marker in the display items */
  const renderItemsWithMarker = useCallback(() => {
    const elements: React.ReactNode[] = [];
    let markerPlaced = false;

    for (const item of displayItems) {
      // Check if we need to place the marker before this item
      if (!markerPlaced) {
        const itemEntries = item.kind === 'group' ? item.group.entries : [item.entry];
        const hasRedoEntry = itemEntries.some((e) => !e.undoable);

        if (hasRedoEntry) {
          // Place the marker here (between undoable and redoable items)
          elements.push(
            <div
              key="undo-marker"
              ref={markerRef}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 10px',
                backgroundColor: 'rgba(var(--xp-blue-rgb, 96,165,250), 0.08)',
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  background: 'linear-gradient(90deg, var(--xp-blue), transparent)',
                  borderRadius: '1px',
                }}
              />
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  color: 'var(--xp-blue)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  flexShrink: 0,
                }}
              >
                Current Position
              </span>
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  background: 'linear-gradient(270deg, var(--xp-blue), transparent)',
                  borderRadius: '1px',
                }}
              />
            </div>,
          );
          markerPlaced = true;
        }
      }

      if (item.kind === 'single') {
        elements.push(renderEntry(item.entry, false));
        // Check if this entry is the undo divider and place marker after it
        if (!markerPlaced && item.entry.index === undoCount - 1) {
          elements.push(
            <div
              key="undo-marker"
              ref={markerRef}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 10px',
                backgroundColor: 'rgba(var(--xp-blue-rgb, 96,165,250), 0.08)',
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  background: 'linear-gradient(90deg, var(--xp-blue), transparent)',
                  borderRadius: '1px',
                }}
              />
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  color: 'var(--xp-blue)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  flexShrink: 0,
                }}
              >
                Current Position
              </span>
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  background: 'linear-gradient(270deg, var(--xp-blue), transparent)',
                  borderRadius: '1px',
                }}
              />
            </div>,
          );
          markerPlaced = true;
        }
      } else {
        elements.push(renderGroupHeader(item.group));
        // Check if a group entry is the undo divider
        if (!markerPlaced) {
          const lastUndoEntry = item.group.entries.find((e) => e.index === undoCount - 1);
          if (lastUndoEntry) {
            elements.push(
              <div
                key="undo-marker"
                ref={markerRef}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '2px 10px',
                  backgroundColor: 'rgba(var(--xp-blue-rgb, 96,165,250), 0.08)',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: '2px',
                    background: 'linear-gradient(90deg, var(--xp-blue), transparent)',
                    borderRadius: '1px',
                  }}
                />
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 600,
                    color: 'var(--xp-blue)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    flexShrink: 0,
                  }}
                >
                  Current Position
                </span>
                <div
                  style={{
                    flex: 1,
                    height: '2px',
                    background: 'linear-gradient(270deg, var(--xp-blue), transparent)',
                    borderRadius: '1px',
                  }}
                />
              </div>,
            );
            markerPlaced = true;
          }
        }
      }
    }

    return elements;
  }, [displayItems, undoCount, renderEntry, renderGroupHeader]);

  // ── Replay Dialog Data ─────────────────────────────────────────────────

  const replayDialogData = useMemo(() => {
    if (!replayDialog) return null;
    const { item } = replayDialog;
    const entries = item.kind === 'group' ? item.group.entries : [item.entry];
    return {
      operationType: entries[0]?.operation_type ?? '',
      operationDescription:
        item.kind === 'group' ? item.group.description : (entries[0]?.description ?? ''),
      destPath: entries[0]?.dest_path ?? null,
    };
  }, [replayDialog]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
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
          onClick={handleUndo}
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
          onClick={handleRedo}
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
          {undoCount} undo{undoCount !== 1 ? 's' : ''} / {entries.length - undoCount} redo
          {entries.length - undoCount !== 1 ? 's' : ''}
        </span>

        <button
          onClick={handleClear}
          disabled={entries.length === 0 || actionInProgress}
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
            cursor: entries.length > 0 && !actionInProgress ? 'pointer' : 'default',
            color: 'var(--xp-text-muted)',
            backgroundColor: 'transparent',
            opacity: entries.length > 0 && !actionInProgress ? 1 : 0.4,
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
          onClick={refresh}
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

      {/* Entry list */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto' }}>
        {entries.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              fontSize: '12px',
              color: 'var(--xp-text-muted)',
              gap: '6px',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.5 }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            No operations in history
          </div>
        ) : (
          renderItemsWithMarker()
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onUndoThis={handleUndoThis}
          onUndoThisAndAfter={handleUndoThisAndAfter}
          onShowDetails={handleShowDetails}
          onReplayOnSelection={handleReplayOnSelection}
          onClearAbove={handleClearAbove}
        />
      )}

      {/* Details Popover */}
      {detailsPopover && (
        <DetailsPopover state={detailsPopover} onClose={() => setDetailsPopover(null)} />
      )}

      {/* Replay Confirmation Dialog */}
      {replayDialogData && (
        <ReplayConfirmDialog
          operationType={replayDialogData.operationType}
          operationDescription={replayDialogData.operationDescription}
          destPath={replayDialogData.destPath}
          onConfirm={executeReplay}
          onCancel={() => setReplayDialog(null)}
        />
      )}
    </div>
  );
}
