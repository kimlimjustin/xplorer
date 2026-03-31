import React, { useCallback } from 'react';
import {
  operationIcon,
  operationColor,
  formatTimestamp,
  type UndoHistoryEntry,
  type HistoryGroup,
  type DisplayItem,
} from '../undo-history-helpers';

// ── Chevron Icon ────────────────────────────────────────────────────────────

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

// ── Undo Position Marker ────────────────────────────────────────────────────

const UndoPositionMarker = React.forwardRef<HTMLDivElement>((_props, ref) => (
  <div
    ref={ref}
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
  </div>
));
UndoPositionMarker.displayName = 'UndoPositionMarker';

// ── Props ───────────────────────────────────────────────────────────────────

interface UndoHistoryListProps {
  displayItems: DisplayItem[];
  undoCount: number;
  entries: UndoHistoryEntry[];
  listRef: React.RefObject<HTMLDivElement>;
  markerRef: React.RefObject<HTMLDivElement>;
  onContextMenu: (e: React.MouseEvent, item: DisplayItem) => void;
  onToggleGroup: (groupId: string) => void;
}

// ── Main List Component ─────────────────────────────────────────────────────

const UndoHistoryList = ({
  displayItems,
  undoCount,
  entries,
  listRef,
  markerRef,
  onContextMenu,
  onToggleGroup,
}: UndoHistoryListProps) => {
  const renderEntry = useCallback(
    (entry: UndoHistoryEntry, inGroup: boolean) => {
      const isCurrentDivider = entry.index === undoCount - 1;
      const color = operationColor(entry.operation_type);
      const isRedone = !entry.undoable;

      return (
        <div
          key={entry.index}
          onContextMenu={(e) => onContextMenu(e, { kind: 'single', entry })}
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
          <span style={{ color, flexShrink: 0, display: 'flex' }}>
            {operationIcon(entry.operation_type)}
          </span>
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
          {entry.timestamp_ms > 0 && (
            <span style={{ fontSize: '9px', color: 'var(--xp-text-muted)', flexShrink: 0 }}>
              {formatTimestamp(entry.timestamp_ms)}
            </span>
          )}
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
    [undoCount, onContextMenu],
  );

  const renderGroupHeader = useCallback(
    (group: HistoryGroup) => {
      const color = operationColor(group.type);
      const firstEntry = group.entries[0];
      const isRedone = !firstEntry?.undoable;
      const hasMarker = group.entries.some((e) => e.index === undoCount - 1);

      return (
        <div key={group.id}>
          <div
            onClick={() => onToggleGroup(group.id)}
            onContextMenu={(e) => onContextMenu(e, { kind: 'group', group })}
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
            <ChevronIcon expanded={group.isExpanded} />
            <span style={{ color, flexShrink: 0, display: 'flex' }}>
              {operationIcon(group.type)}
            </span>
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
            {group.timestamp > 0 && (
              <span style={{ fontSize: '9px', color: 'var(--xp-text-muted)', flexShrink: 0 }}>
                {formatTimestamp(group.timestamp)}
              </span>
            )}
          </div>
          {group.isExpanded && (
            <div style={{ borderBottom: '1px solid var(--xp-border, rgba(255,255,255,0.06))' }}>
              {group.entries.map((entry) => renderEntry(entry, true))}
            </div>
          )}
        </div>
      );
    },
    [onToggleGroup, onContextMenu, renderEntry, undoCount],
  );

  const renderItemsWithMarker = useCallback(() => {
    const elements: React.ReactNode[] = [];
    let markerPlaced = false;

    for (const item of displayItems) {
      if (!markerPlaced) {
        const itemEntries = item.kind === 'group' ? item.group.entries : [item.entry];
        const hasRedoEntry = itemEntries.some((e) => !e.undoable);

        if (hasRedoEntry) {
          elements.push(<UndoPositionMarker key="undo-marker" ref={markerRef} />);
          markerPlaced = true;
        }
      }

      if (item.kind === 'single') {
        elements.push(renderEntry(item.entry, false));
        if (!markerPlaced && item.entry.index === undoCount - 1) {
          elements.push(<UndoPositionMarker key="undo-marker" ref={markerRef} />);
          markerPlaced = true;
        }
      } else {
        elements.push(renderGroupHeader(item.group));
        if (!markerPlaced) {
          const lastUndoEntry = item.group.entries.find((e) => e.index === undoCount - 1);
          if (lastUndoEntry) {
            elements.push(<UndoPositionMarker key="undo-marker" ref={markerRef} />);
            markerPlaced = true;
          }
        }
      }
    }

    return elements;
  }, [displayItems, undoCount, renderEntry, renderGroupHeader, markerRef]);

  return (
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
  );
};

export default UndoHistoryList;
