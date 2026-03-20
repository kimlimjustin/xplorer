import React from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UndoHistoryEntry {
  index: number;
  operation_type: string;
  description: string;
  undoable: boolean;
  timestamp_ms: number;
  source_path: string | null;
  dest_path: string | null;
}

export interface UndoHistorySnapshot {
  entries: UndoHistoryEntry[];
  undo_count: number;
}

export interface HistoryGroup {
  id: string;
  entries: UndoHistoryEntry[];
  type: string;
  description: string;
  fileCount: number;
  timestamp: number;
  isExpanded: boolean;
}

export type DisplayItem =
  | { kind: 'single'; entry: UndoHistoryEntry }
  | { kind: 'group'; group: HistoryGroup };

export interface ContextMenuState {
  x: number;
  y: number;
  item: DisplayItem;
}

export interface DetailsPopoverState {
  x: number;
  y: number;
  item: DisplayItem;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Group operations of the same type within this time window (ms) */
export const GROUP_WINDOW_MS = 2000;

// ── Helpers ──────────────────────────────────────────────────────────────────

export const operationIcon = (type: string) => {
  switch (type) {
    case 'Copy':
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
    case 'Move':
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
          <path d="M5 12h14" />
          <path d="M12 5l7 7-7 7" />
        </svg>
      );
    case 'Delete':
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
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
      );
    case 'Rename':
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
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      );
    default:
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
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
};

export const operationColor = (type: string): string => {
  switch (type) {
    case 'Copy':
      return 'var(--xp-blue)';
    case 'Move':
      return 'var(--xp-purple, #a78bfa)';
    case 'Delete':
      return 'var(--xp-red, #f87171)';
    case 'Rename':
      return 'var(--xp-green, #34d399)';
    default:
      return 'var(--xp-text-muted)';
  }
};

/** Format a Unix ms timestamp as a relative or absolute time string */
export const formatTimestamp = (ms: number) : string => {
  if (!ms) return '';
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Extract the file name from a full path */
export const fileName = (path: string | null) : string => {
  if (!path) return '';
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

/** Extract the parent directory from a full path */
export const parentDir = (path: string | null) : string => {
  if (!path) return '';
  const normalized = path.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(0, idx) : path;
}

// ── Grouping Logic ───────────────────────────────────────────────────────────

export const groupHistoryEntries = (
  entries: UndoHistoryEntry[],
  expandedGroups: Set<string>,
) : DisplayItem[] => {
  if (entries.length === 0) return [];

  const result: DisplayItem[] = [];
  let i = 0;

  while (i < entries.length) {
    const current = entries[i];
    // Collect consecutive entries of the same type within the time window
    const groupEntries: UndoHistoryEntry[] = [current];
    let j = i + 1;
    while (
      j < entries.length &&
      entries[j].operation_type === current.operation_type &&
      entries[j].undoable === current.undoable &&
      Math.abs(entries[j].timestamp_ms - entries[j - 1].timestamp_ms) <= GROUP_WINDOW_MS
    ) {
      groupEntries.push(entries[j]);
      j++;
    }

    if (groupEntries.length === 1) {
      // Single entry -- no group needed
      result.push({ kind: 'single', entry: current });
    } else {
      // Create a group
      const groupId = `group-${current.index}-${groupEntries[groupEntries.length - 1].index}`;
      const group: HistoryGroup = {
        id: groupId,
        entries: groupEntries,
        type: current.operation_type,
        description: `Bulk ${current.operation_type} (${groupEntries.length} files)`,
        fileCount: groupEntries.length,
        timestamp: groupEntries[groupEntries.length - 1].timestamp_ms,
        isExpanded: expandedGroups.has(groupId),
      };
      result.push({ kind: 'group', group });
    }

    i = j;
  }

  return result;
}
