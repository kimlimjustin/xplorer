import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TauriAPI } from '../lib/tauri-api';
import {
  groupHistoryEntries,
  fileName,
  parentDir,
  type UndoHistoryEntry,
  type UndoHistorySnapshot,
  type DisplayItem,
  type ContextMenuState,
  type DetailsPopoverState,
} from '../components/panels/undo-history-helpers';

export interface UseUndoHistoryReturn {
  snapshot: UndoHistorySnapshot | null;
  loading: boolean;
  actionInProgress: boolean;
  expandedGroups: Set<string>;
  contextMenu: ContextMenuState | null;
  detailsPopover: DetailsPopoverState | null;
  replayDialog: { item: DisplayItem } | null;
  listRef: React.RefObject<HTMLDivElement>;
  markerRef: React.RefObject<HTMLDivElement>;
  entries: UndoHistoryEntry[];
  undoCount: number;
  canUndo: boolean;
  canRedo: boolean;
  displayItems: DisplayItem[];
  replayDialogData: {
    operationType: string;
    operationDescription: string;
    destPath: string | null;
  } | null;
  refresh: () => Promise<void>;
  handleUndo: () => Promise<void>;
  handleRedo: () => Promise<void>;
  handleClear: () => Promise<void>;
  toggleGroup: (groupId: string) => void;
  handleUndoThis: (item: DisplayItem) => Promise<void>;
  handleUndoThisAndAfter: (item: DisplayItem) => Promise<void>;
  handleShowDetails: (item: DisplayItem, x: number, y: number) => void;
  handleReplayOnSelection: (item: DisplayItem) => void;
  executeReplay: () => Promise<void>;
  handleClearAbove: (item: DisplayItem) => Promise<void>;
  handleContextMenu: (e: React.MouseEvent, item: DisplayItem) => void;
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  setDetailsPopover: React.Dispatch<React.SetStateAction<DetailsPopoverState | null>>;
  setReplayDialog: React.Dispatch<React.SetStateAction<{ item: DisplayItem } | null>>;
}

export const useUndoHistory = (): UseUndoHistoryReturn => {
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

  const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
  const undoCount = typeof snapshot?.undo_count === 'number' ? snapshot.undo_count : 0;
  const canUndo = undoCount > 0;
  const canRedo = entries.length > undoCount;

  // Display in reverse order: most recent first
  const displayEntries = [...entries].reverse();

  const displayItems = useMemo(
    () => groupHistoryEntries(displayEntries, expandedGroups),
    [displayEntries, expandedGroups],
  );

  const handleUndo = useCallback(async () => {
    setActionInProgress(true);
    try {
      await TauriAPI.undoOperation();
      await refresh();
    } catch {
      // Silently handle
    } finally {
      setActionInProgress(false);
    }
  }, [refresh]);

  const handleRedo = useCallback(async () => {
    setActionInProgress(true);
    try {
      await TauriAPI.redoOperation();
      await refresh();
    } catch {
      // Silently handle
    } finally {
      setActionInProgress(false);
    }
  }, [refresh]);

  const handleClear = useCallback(async () => {
    setActionInProgress(true);
    try {
      await TauriAPI.clearUndoHistory();
      await refresh();
    } catch {
      // Silently handle
    } finally {
      setActionInProgress(false);
    }
  }, [refresh]);

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

  const handleUndoThis = useCallback(
    async (item: DisplayItem) => {
      setActionInProgress(true);
      try {
        const entriesToUndo = item.kind === 'group' ? item.group.entries : [item.entry];
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
        const lowestIndex = Math.min(...targetEntries.map((e) => e.index));
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
      const replayEntries = item.kind === 'group' ? item.group.entries : [item.entry];
      const opType = replayEntries[0]?.operation_type;

      if (opType === 'Move' || opType === 'Copy') {
        const destDir = replayEntries[0]?.dest_path ? parentDir(replayEntries[0].dest_path) : null;
        if (destDir) {
          window.dispatchEvent(
            new CustomEvent('replay-operation', {
              detail: { type: opType.toLowerCase(), destination: destDir },
            }),
          );
        }
      } else if (opType === 'Rename') {
        const firstEntry = replayEntries[0];
        if (firstEntry?.source_path && firstEntry?.dest_path) {
          const oldName = fileName(firstEntry.source_path);
          const newName = fileName(firstEntry.dest_path);
          let pattern:
            | { type: 'prefix'; value: string }
            | { type: 'suffix'; value: string }
            | { type: 'replace'; from: string; to: string }
            | null = null;

          if (newName.startsWith(oldName)) {
            pattern = { type: 'suffix', value: newName.slice(oldName.length) };
          } else if (newName.endsWith(oldName)) {
            pattern = { type: 'prefix', value: newName.slice(0, newName.length - oldName.length) };
          } else {
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

  const replayDialogData = useMemo(() => {
    if (!replayDialog) return null;
    const { item } = replayDialog;
    const dialogEntries = item.kind === 'group' ? item.group.entries : [item.entry];
    return {
      operationType: dialogEntries[0]?.operation_type ?? '',
      operationDescription:
        item.kind === 'group' ? item.group.description : (dialogEntries[0]?.description ?? ''),
      destPath: dialogEntries[0]?.dest_path ?? null,
    };
  }, [replayDialog]);

  return {
    snapshot,
    loading,
    actionInProgress,
    expandedGroups,
    contextMenu,
    detailsPopover,
    replayDialog,
    listRef,
    markerRef,
    entries,
    undoCount,
    canUndo,
    canRedo,
    displayItems,
    replayDialogData,
    refresh,
    handleUndo,
    handleRedo,
    handleClear,
    toggleGroup,
    handleUndoThis,
    handleUndoThisAndAfter,
    handleShowDetails,
    handleReplayOnSelection,
    executeReplay,
    handleClearAbove,
    handleContextMenu,
    setContextMenu,
    setDetailsPopover,
    setReplayDialog,
  };
};
