import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileEntry, FolderSizeInfo, FileTag, TauriAPI } from '@/lib/tauri-api';
import { useDroppable } from '@/hooks/use-droppable';
import { useGridLayout } from '@/hooks/use-grid-layout';
import { useTypeAheadSearch } from '@/hooks/use-type-ahead-search';
import { useGridKeyboardNav } from '@/hooks/use-grid-keyboard-nav';
import { useSizePercentiles } from '@/hooks/use-size-percentiles';
import { useThumbnailCache } from '@/hooks/use-thumbnail-cache';
import { ViewComponentProps } from './FileGridTypes';
import { isImageFile } from './FileGridHelpers';
import FileGridItem from './FileGridItem';
import TreeView from './TreeView';
import GalleryView from './GalleryView';
import DetailsView from './DetailsView';
import ColumnView from './ColumnView';
import type { FileGroup } from '@/lib/utils';
import { FileGridSkeleton } from '@/components/ui/Skeleton';
import {
  CROSS_TAB_SELECTION_EVENT,
  type CrossTabSelectionEventDetail,
} from '@/hooks/use-cross-tab-selection';

interface FileGridProps {
  files: FileEntry[];
  fileGroups?: FileGroup[] | null;
  isLoading: boolean;
  viewMode: string;
  selectedFiles: Set<string>;
  currentPath: string;
  groupId: string;
  getFileIcon: (file: FileEntry) => React.ReactNode;
  formatFileSize: (bytes: number) => string;
  formatFolderSize: (folderSizeInfo: FolderSizeInfo | null, isCalculating?: boolean) => string;
  formatDate: (timestamp: number) => string;
  handleFileClick: (file: FileEntry, event: React.MouseEvent) => void;
  handleFileDoubleClick: (file: FileEntry) => void;
  handleFileRightClick: (file: FileEntry, event: React.MouseEvent) => void;
  handleBackgroundRightClick?: (event: React.MouseEvent) => void;
  getFolderSize: (path: string) => FolderSizeInfo | null;
  isCalculatingSize: (path: string) => boolean;
  calculateFolderSize?: (path: string) => void;
  onQuickLook?: (file: FileEntry) => void;
  /** Whether to show color-coded file size badges */
  showSizeBadges?: boolean;
  /** Set of file paths that are part of a cross-tab selection */
  crossTabSelectedPaths?: Set<string>;
  /** Called when an inline rename is confirmed. If not provided, inline rename is disabled. */
  onRenameFile?: (oldPath: string, newName: string) => Promise<boolean>;
  /** Externally controlled renaming path (set by F2 shortcut in parent) */
  renamingPath?: string | null;
  /** Setter to clear/set the renaming path from parent */
  setRenamingPath?: (path: string | null) => void;
}

const FileGrid = ({
  files,
  fileGroups,
  isLoading,
  viewMode,
  selectedFiles,
  currentPath,
  groupId,
  getFileIcon,
  formatFileSize,
  formatFolderSize,
  formatDate,
  handleFileClick,
  handleFileDoubleClick,
  handleFileRightClick,
  handleBackgroundRightClick,
  getFolderSize,
  isCalculatingSize,
  calculateFolderSize,
  onQuickLook,
  showSizeBadges = false,
  crossTabSelectedPaths,
  onRenameFile,
  renamingPath: externalRenamingPath,
  setRenamingPath: externalSetRenamingPath,
}: FileGridProps) => {
  // ─── Git status for the current directory ───────────────────────────────────
  const [gitStatusMap, setGitStatusMap] = useState<Map<string, string>>(new Map());
  const gitRepoCache = useRef(new Map<string, boolean>());

  useEffect(() => {
    if (!currentPath || currentPath.startsWith('xplorer://')) {
      setGitStatusMap(new Map());
      return;
    }

    // Check cache: if we know this path prefix is not a git repo, skip IPC
    const cached = gitRepoCache.current.get(currentPath);
    if (cached === false) {
      setGitStatusMap(new Map());
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const loadGitStatus = async () => {
        try {
          const statuses = await TauriAPI.getGitStatus(currentPath);
          if (!cancelled) {
            gitRepoCache.current.set(currentPath, statuses.length > 0);
            const map = new Map<string, string>();
            for (const s of statuses) {
              const normalized = s.path.replace(/\\/g, '/');
              map.set(normalized, s.status);
              map.set(s.path, s.status);
            }
            setGitStatusMap(map);
          }
        } catch {
          if (!cancelled) {
            gitRepoCache.current.set(currentPath, false);
            setGitStatusMap(new Map());
          }
        }
      };

      loadGitStatus();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentPath]);

  // ─── Batch-load tags for all visible files ──────────────────────────────────
  const [allTags, setAllTags] = useState<Map<string, FileTag[]>>(new Map());

  // Use a stable key derived from file paths to avoid re-fetching on every render
  const filePathsKey = useMemo(() => files.map((f) => f.path).join('\n'), [files]);

  useEffect(() => {
    if (files.length === 0) return;

    // Only fetch tags when on a real filesystem path (not special pages)
    if (currentPath.startsWith('xplorer://') || currentPath.startsWith('gdrive://')) return;

    let cancelled = false;
    const loadAllTags = async () => {
      try {
        const paths = files.map((f) => f.path);
        const batchResult = await TauriAPI.getFileTagsBatch(paths);
        if (!cancelled) {
          const tagMap = new Map<string, FileTag[]>();
          for (const [path, tags] of Object.entries(batchResult)) {
            tagMap.set(path, tags);
          }
          setAllTags(tagMap);
        }
      } catch {
        if (!cancelled) setAllTags(new Map());
      }
    };

    loadAllTags();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePathsKey, currentPath]);

  // ─── Cross-tab selection state (Ctrl+Shift+Click toggles) ────────────────
  const [localCrossTabPaths, setLocalCrossTabPaths] = useState<Set<string>>(new Set());

  // Dispatch cross-tab selection event when the local set changes
  useEffect(() => {
    if (localCrossTabPaths.size === 0) return;
    const selectedEntries = files.filter((f) => localCrossTabPaths.has(f.path));
    if (selectedEntries.length > 0) {
      const detail: CrossTabSelectionEventDetail = {
        tabId: groupId,
        tabPath: currentPath,
        files: selectedEntries,
      };
      window.dispatchEvent(new CustomEvent(CROSS_TAB_SELECTION_EVENT, { detail }));
    }
  }, [localCrossTabPaths, files, groupId, currentPath]);

  // Clear local cross-tab selection when path changes
  useEffect(() => {
    setLocalCrossTabPaths(new Set());
    // Also emit a clear event for this tab
    const detail: CrossTabSelectionEventDetail = {
      tabId: groupId,
      tabPath: currentPath,
      files: [],
    };
    window.dispatchEvent(new CustomEvent(CROSS_TAB_SELECTION_EVENT, { detail }));
  }, [currentPath, groupId]);

  // Merge local + external cross-tab selections for visual indicator
  const mergedCrossTabPaths = useMemo(() => {
    const merged = new Set(localCrossTabPaths);
    if (crossTabSelectedPaths) {
      for (const p of crossTabSelectedPaths) merged.add(p);
    }
    return merged;
  }, [localCrossTabPaths, crossTabSelectedPaths]);

  // Stable callback refs for click handlers
  const onFileClick = useCallback(
    (file: FileEntry, event: React.MouseEvent) => {
      // Ctrl+Shift+Click = toggle cross-tab selection
      if (event.ctrlKey && event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        setLocalCrossTabPaths((prev) => {
          const next = new Set(prev);
          if (next.has(file.path)) {
            next.delete(file.path);
          } else {
            next.add(file.path);
          }
          return next;
        });
        return;
      }
      handleFileClick(file, event);
    },
    [handleFileClick],
  );
  const onFileDoubleClick = useCallback(
    (file: FileEntry) => handleFileDoubleClick(file),
    [handleFileDoubleClick],
  );
  const onFileRightClick = useCallback(
    (file: FileEntry, event: React.MouseEvent) => handleFileRightClick(file, event),
    [handleFileRightClick],
  );
  const emptyTags: FileTag[] = useMemo(() => [], []);

  // ─── Size percentiles for heatmap badges ─────────────────────────────────
  const sizePercentiles = useSizePercentiles(files);

  // ─── Thumbnail cache for image hover previews ───────────────────────────
  const { getThumbnailUrl, preloadThumbnails } = useThumbnailCache(100);

  // Preload thumbnails for visible image files
  useEffect(() => {
    const imagePaths = files.filter(isImageFile).map((f) => f.path);
    if (imagePaths.length > 0) {
      preloadThumbnails(imagePaths.slice(0, 10)); // preload viewport-visible images only
    }
  }, [files, preloadThumbnails]);

  // ─── Inline rename state ─────────────────────────────────────────────────
  const [internalRenamingPath, internalSetRenamingPath] = useState<string | null>(null);

  // Use external state when provided, otherwise fall back to internal state
  const renamingPath =
    externalRenamingPath !== undefined ? externalRenamingPath : internalRenamingPath;
  const setRenamingPath = useCallback(
    (path: string | null) => {
      if (externalSetRenamingPath) {
        externalSetRenamingPath(path);
      } else {
        internalSetRenamingPath(path);
      }
    },
    [externalSetRenamingPath],
  );

  // Build list of existing file names for conflict detection
  const existingNames = useMemo(() => files.map((f) => f.name), [files]);

  // Clear rename mode when path changes or files are refreshed
  useEffect(() => {
    setRenamingPath(null);
  }, [currentPath, setRenamingPath]);

  // Listen for global inline-rename events (dispatched by F2 shortcut in xplorer.tsx)
  useEffect(() => {
    if (!onRenameFile) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      if (detail?.path && files.some((f) => f.path === detail.path)) {
        setRenamingPath(detail.path);
      }
    };
    window.addEventListener('start-inline-rename', handler);
    return () => window.removeEventListener('start-inline-rename', handler);
  }, [onRenameFile, files, setRenamingPath]);

  // ─── Slow double-click detection (click → 500ms pause → click = rename) ──
  const lastClickRef = useRef<{ path: string; time: number } | null>(null);
  const slowDoubleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wrappedFileClick = useCallback(
    (file: FileEntry, event: React.MouseEvent) => {
      // If currently renaming, don't process clicks on other items
      if (renamingPath && renamingPath !== file.path) {
        // Clicking outside the renaming item cancels rename
        setRenamingPath(null);
        handleFileClick(file, event);
        return;
      }

      // If renaming this item, ignore click (let input handle it)
      if (renamingPath === file.path) return;

      // Ctrl/Shift/Meta clicks skip slow-double-click detection
      if (event.ctrlKey || event.shiftKey || event.metaKey) {
        lastClickRef.current = null;
        if (slowDoubleClickTimerRef.current) {
          clearTimeout(slowDoubleClickTimerRef.current);
          slowDoubleClickTimerRef.current = null;
        }
        // Let the cross-tab handler in onFileClick deal with it
        onFileClick(file, event);
        return;
      }

      const now = Date.now();
      const last = lastClickRef.current;

      if (last && last.path === file.path && selectedFiles.has(file.path)) {
        const elapsed = now - last.time;
        // Fast double-click (< 400ms) is handled by onDoubleClick; ignore here.
        // Slow double-click (400-1500ms): enter rename mode
        if (elapsed >= 400 && elapsed <= 1500 && onRenameFile) {
          lastClickRef.current = null;
          if (slowDoubleClickTimerRef.current) {
            clearTimeout(slowDoubleClickTimerRef.current);
            slowDoubleClickTimerRef.current = null;
          }
          setRenamingPath(file.path);
          return;
        }
      }

      // Record this click for potential slow-double-click
      lastClickRef.current = { path: file.path, time: now };
      // Clear the record after 1500ms to prevent stale detection
      if (slowDoubleClickTimerRef.current) {
        clearTimeout(slowDoubleClickTimerRef.current);
      }
      slowDoubleClickTimerRef.current = setTimeout(() => {
        lastClickRef.current = null;
        slowDoubleClickTimerRef.current = null;
      }, 1500);

      onFileClick(file, event);
    },
    [renamingPath, setRenamingPath, selectedFiles, onRenameFile, handleFileClick, onFileClick],
  );

  const wrappedFileDoubleClick = useCallback(
    (file: FileEntry) => {
      if (renamingPath) return; // Suppress double-click while renaming
      // Clear slow-click tracking so a fast double-click doesn't trigger rename
      lastClickRef.current = null;
      if (slowDoubleClickTimerRef.current) {
        clearTimeout(slowDoubleClickTimerRef.current);
        slowDoubleClickTimerRef.current = null;
      }
      onFileDoubleClick(file);
    },
    [renamingPath, onFileDoubleClick],
  );

  // Rename callbacks passed to FileGridItem
  const handleRenameConfirm = useCallback(
    async (oldPath: string, newName: string) => {
      setRenamingPath(null);
      if (onRenameFile) {
        await onRenameFile(oldPath, newName);
      }
    },
    [onRenameFile, setRenamingPath],
  );

  const handleRenameCancel = useCallback(() => {
    setRenamingPath(null);
  }, [setRenamingPath]);

  const handleRenameTab = useCallback(
    async (oldPath: string, newName: string) => {
      // Confirm rename on current file, then move to next file in the list
      if (onRenameFile) {
        const success = await onRenameFile(oldPath, newName);
        if (success) {
          // Find the next file in the list to start renaming
          const currentIndex = files.findIndex((f) => f.path === oldPath);
          if (currentIndex >= 0 && currentIndex < files.length - 1) {
            setRenamingPath(files[currentIndex + 1].path);
            return;
          }
        }
      }
      setRenamingPath(null);
    },
    [onRenameFile, files, setRenamingPath],
  );

  // Background drop target — the whole grid accepts drops into currentPath
  const isSpecialPage = currentPath.startsWith('xplorer://') || currentPath.startsWith('gdrive://');
  const bgDropRef = useDroppable(currentPath, isSpecialPage);

  // ─── Virtual scrolling hooks (must be called before any early returns) ───
  const parentRef = useRef<HTMLDivElement>(null);

  // ─── Grid layout helpers ──────────────────────────────────────────────────
  const {
    getColumnsCount,
    getEstimatedRowHeight,
    getGridLayout,
    getItemSize,
    listView,
    gridView,
    columns,
    gap,
  } = useGridLayout(viewMode, parentRef);

  const rowCount = Math.ceil(files.length / columns);
  const needsVirtualization =
    files.length >= 200 && !['tree', 'gallery', 'details', 'column'].includes(viewMode);

  const virtualizer = useVirtualizer({
    count: needsVirtualization ? rowCount : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => getEstimatedRowHeight(),
    overscan: 5,
    enabled: needsVirtualization,
  });

  // ─── Keyboard grid navigation + type-ahead search ─────────────────────────
  const { handleGridKeyDown: handleTypeAhead } = useTypeAheadSearch({
    files,
    viewMode,
    needsVirtualization,
    columns,
    virtualizer,
    getColumnsCount,
  });

  const { handleKeyDown: handleGridNav } = useGridKeyboardNav({
    files,
    selectedFiles,
    columns,
    viewMode,
    getColumnsCount,
    handleFileClick,
    handleFileDoubleClick,
    needsVirtualization,
    virtualizer,
    onQuickLook,
  });

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // F2 key: enter inline rename mode for the selected file
      if (e.key === 'F2' && onRenameFile && selectedFiles.size === 1 && !renamingPath) {
        e.preventDefault();
        e.stopPropagation();
        const selectedPath = Array.from(selectedFiles)[0];
        setRenamingPath(selectedPath);
        return;
      }
      // Escape during rename: cancel
      if (e.key === 'Escape' && renamingPath) {
        e.preventDefault();
        e.stopPropagation();
        setRenamingPath(null);
        return;
      }
      // While renaming, suppress grid navigation
      if (renamingPath) return;

      handleGridNav(e);
      // If the grid nav didn't consume it, try type-ahead
      if (!e.defaultPrevented) handleTypeAhead(e);
    },
    [handleGridNav, handleTypeAhead, onRenameFile, selectedFiles, renamingPath, setRenamingPath],
  );

  if (isLoading) {
    return <FileGridSkeleton viewMode={viewMode} />;
  }

  if (files.length === 0) {
    return (
      <div
        ref={bgDropRef}
        className="flex h-64 items-center justify-center"
        onContextMenu={handleBackgroundRightClick || undefined}
        role="status"
        aria-label="Empty folder"
      >
        <div className="text-xp-text-secondary text-center">
          <svg
            className="mx-auto mb-4 h-12 w-12"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
              clipRule="evenodd"
            />
          </svg>
          <p>This folder is empty</p>
          <p className="text-xp-text-muted mt-2 text-xs">Right-click to create files or folders</p>
        </div>
      </div>
    );
  }

  // ─── Delegate to specialized views ──────────────────────────────────────
  const viewComponentProps: ViewComponentProps = {
    files,
    selectedFiles,
    currentPath,
    groupId,
    getFileIcon,
    formatFileSize,
    formatFolderSize,
    formatDate,
    handleFileClick,
    handleFileDoubleClick,
    handleFileRightClick,
    handleBackgroundRightClick,
    getFolderSize,
    isCalculatingSize,
    calculateFolderSize,
  };

  if (viewMode === 'tree') {
    return <TreeView {...viewComponentProps} />;
  }

  if (viewMode === 'gallery') {
    return <GalleryView {...viewComponentProps} />;
  }

  if (viewMode === 'details') {
    return <DetailsView {...viewComponentProps} fileGroups={fileGroups} />;
  }

  if (viewMode === 'column') {
    return <ColumnView {...viewComponentProps} />;
  }

  const itemSize = getItemSize();

  // Cross-tab selection visual indicator style
  const crossTabOutlineStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: 8,
    border: '2px solid var(--xp-blue)',
    opacity: 0.6,
    pointerEvents: 'none',
    zIndex: 6,
    boxShadow: '0 0 6px color-mix(in srgb, var(--xp-blue) 40%, transparent)',
  };

  const crossTabBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--xp-blue)',
    zIndex: 7,
    pointerEvents: 'none',
    boxShadow: '0 0 4px var(--xp-blue)',
  };

  const renderFileItem = (file: FileEntry) => {
    const isCrossTabSelected = mergedCrossTabPaths.has(file.path);
    const isFileRenaming = renamingPath === file.path;
    return (
      <div key={file.path} style={{ position: 'relative', overflow: 'hidden', minWidth: 0 }}>
        {isCrossTabSelected && (
          <>
            <div style={crossTabOutlineStyle} />
            <div style={crossTabBadgeStyle} title="Selected for cross-tab operation" />
          </>
        )}
        <FileGridItem
          file={file}
          isSelected={selectedFiles.has(file.path)}
          tags={allTags.get(file.path) || emptyTags}
          gitStatus={
            gitStatusMap.get(file.path) || gitStatusMap.get(file.path.replace(/\\/g, '/')) || null
          }
          isGridView={gridView}
          isListView={listView}
          viewMode={viewMode}
          itemSize={itemSize}
          selectedFiles={selectedFiles}
          allFiles={files}
          getFileIcon={getFileIcon}
          formatFileSize={formatFileSize}
          formatFolderSize={formatFolderSize}
          formatDate={formatDate}
          onFileClick={wrappedFileClick}
          onFileDoubleClick={wrappedFileDoubleClick}
          onFileRightClick={onFileRightClick}
          getFolderSize={getFolderSize}
          isCalculatingSize={isCalculatingSize}
          showSizeBadge={showSizeBadges}
          sizeBadgeInfo={sizePercentiles.get(file.path) || null}
          thumbnailUrl={isImageFile(file) ? getThumbnailUrl(file.path) : undefined}
          isRenaming={isFileRenaming}
          existingNames={isFileRenaming ? existingNames : undefined}
          onRenameConfirm={isFileRenaming ? handleRenameConfirm : undefined}
          onRenameCancel={isFileRenaming ? handleRenameCancel : undefined}
          onRenameTab={isFileRenaming ? handleRenameTab : undefined}
        />
      </div>
    );
  };

  // For small file counts (< 200), skip virtualization for simplicity
  if (!needsVirtualization) {
    // Grouped rendering
    if (fileGroups && fileGroups.length > 0) {
      return (
        <div
          ref={bgDropRef}
          role="listbox"
          aria-label="File list"
          aria-multiselectable={true}
          className="relative"
          onContextMenu={handleBackgroundRightClick || undefined}
          onKeyDown={handleGridKeyDown}
        >
          {fileGroups.map((group) => (
            <div key={group.group}>
              <div className="bg-xp-surface/80 border-xp-border sticky top-0 z-10 border-b px-3 py-2 backdrop-blur-sm">
                <span className="text-xp-text-muted text-xs font-semibold uppercase tracking-wide">
                  {group.group}
                </span>
                <span className="text-xp-text-muted ml-2 text-xs">({group.files.length})</span>
              </div>
              <div className={`${getGridLayout()} p-2`}>{group.files.map(renderFileItem)}</div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div
        ref={bgDropRef}
        role="listbox"
        aria-label="File list"
        aria-multiselectable={true}
        className={`${getGridLayout()} relative p-2`}
        onContextMenu={handleBackgroundRightClick || undefined}
        onKeyDown={handleGridKeyDown}
      >
        {files.map(renderFileItem)}
      </div>
    );
  }

  // Virtualized rendering for large directories
  return (
    <div
      ref={(el) => {
        (parentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        if (bgDropRef && 'current' in bgDropRef) {
          (bgDropRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }
      }}
      role="listbox"
      aria-label="File list"
      aria-multiselectable={true}
      className="relative h-full overflow-auto"
      style={{ padding: '8px' }}
      onContextMenu={handleBackgroundRightClick || undefined}
      onKeyDown={handleGridKeyDown}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowFiles = files.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: listView ? 'block' : 'grid',
                gridTemplateColumns: listView ? undefined : `repeat(${columns}, 1fr)`,
                gap: listView ? undefined : `${gap}px`,
              }}
            >
              {rowFiles.map((file: FileEntry) => {
                const isFileRenaming = renamingPath === file.path;
                return (
                  <FileGridItem
                    key={file.path}
                    file={file}
                    isSelected={selectedFiles.has(file.path)}
                    tags={allTags.get(file.path) || emptyTags}
                    gitStatus={
                      gitStatusMap.get(file.path) ||
                      gitStatusMap.get(file.path.replace(/\\/g, '/')) ||
                      null
                    }
                    isGridView={gridView}
                    isListView={listView}
                    viewMode={viewMode}
                    itemSize={itemSize}
                    selectedFiles={selectedFiles}
                    allFiles={files}
                    getFileIcon={getFileIcon}
                    formatFileSize={formatFileSize}
                    formatFolderSize={formatFolderSize}
                    formatDate={formatDate}
                    onFileClick={wrappedFileClick}
                    onFileDoubleClick={wrappedFileDoubleClick}
                    onFileRightClick={onFileRightClick}
                    getFolderSize={getFolderSize}
                    isCalculatingSize={isCalculatingSize}
                    showSizeBadge={showSizeBadges}
                    sizeBadgeInfo={sizePercentiles.get(file.path) || null}
                    thumbnailUrl={isImageFile(file) ? getThumbnailUrl(file.path) : undefined}
                    isRenaming={isFileRenaming}
                    existingNames={isFileRenaming ? existingNames : undefined}
                    onRenameConfirm={isFileRenaming ? handleRenameConfirm : undefined}
                    onRenameCancel={isFileRenaming ? handleRenameCancel : undefined}
                    onRenameTab={isFileRenaming ? handleRenameTab : undefined}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FileGrid;
