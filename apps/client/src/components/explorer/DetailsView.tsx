import React, { useRef, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileEntry, FolderSizeInfo } from '@/lib/tauri-api';
import { ViewComponentProps } from './FileGridTypes';
import type { FileGroup } from '@/lib/utils';

interface DetailsViewProps extends ViewComponentProps {
  fileGroups?: FileGroup[] | null;
}

const DETAILS_ROW_HEIGHT = 40;
const GROUP_HEADER_HEIGHT = 36;
const DETAILS_VIRTUALIZATION_THRESHOLD = 200;

type FlatItem =
  | { type: 'header'; group: { name: string; count: number } }
  | { type: 'file'; file: FileEntry };

interface FileRowProps {
  file: FileEntry;
  selectedFiles: Set<string>;
  getFileIcon: (file: FileEntry) => React.ReactNode;
  formatFileSize: (bytes: number) => string;
  formatFolderSize: (folderSizeInfo: FolderSizeInfo | null, isCalculating?: boolean) => string;
  formatDate: (timestamp: number) => string;
  onFileClick: (filePath: string, event: React.MouseEvent) => void;
  onFileDoubleClick: (filePath: string) => void;
  onFileRightClick: (filePath: string, event: React.MouseEvent) => void;
  getFolderSize: (path: string) => FolderSizeInfo | null;
  isCalculatingSize: (path: string) => boolean;
  onCalculateFolderSize?: (path: string) => void;
}

const FileRow = React.memo(
  ({
    file,
    selectedFiles,
    getFileIcon,
    formatFileSize,
    formatFolderSize,
    formatDate,
    onFileClick,
    onFileDoubleClick,
    onFileRightClick,
    getFolderSize,
    isCalculatingSize,
    onCalculateFolderSize,
  }: FileRowProps) => {
    const handleClick = useCallback(
      (e: React.MouseEvent) => onFileClick(file.path, e),
      [onFileClick, file.path],
    );
    const handleDoubleClick = useCallback(
      () => onFileDoubleClick(file.path),
      [onFileDoubleClick, file.path],
    );
    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => onFileRightClick(file.path, e),
      [onFileRightClick, file.path],
    );
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') onFileDoubleClick(file.path);
        if (e.key === ' ') {
          e.preventDefault();
          onFileClick(file.path, e as unknown as React.MouseEvent);
        }
      },
      [onFileDoubleClick, onFileClick, file.path],
    );
    const handleCalculateClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onCalculateFolderSize?.(file.path);
      },
      [onCalculateFolderSize, file.path],
    );

    return (
      <div
        role="row"
        aria-selected={selectedFiles.has(file.path)}
        aria-label={file.name}
        tabIndex={0}
        data-file-path={file.path}
        data-drop-target={file.is_dir ? file.path : undefined}
        className={`hover:bg-xp-surface-light grid cursor-pointer grid-cols-12 items-center gap-3 px-3 py-2.5 transition-colors ${
          selectedFiles.has(file.path)
            ? 'bg-xp-purple/20 border-xp-purple/40 border'
            : 'text-xp-text border border-transparent'
        } `}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      >
        <div className="col-span-1 flex justify-center">
          <span className="text-lg">{getFileIcon(file)}</span>
        </div>
        <div className="col-span-5 min-w-0">
          <div className="truncate font-medium">{file.name}</div>
        </div>
        <div className="text-xp-text-muted col-span-2 text-right text-xs">
          {(() => {
            if (!file.is_dir) return formatFileSize(file.size);
            if (getFolderSize(file.path) || isCalculatingSize(file.path)) {
              return formatFolderSize(getFolderSize(file.path), isCalculatingSize(file.path));
            }
            return (
              <button
                className="text-xp-text-muted hover:text-xp-accent underline decoration-dotted transition-colors"
                onClick={handleCalculateClick}
                title="Click to calculate folder size"
              >
                Calculate
              </button>
            );
          })()}
        </div>
        <div className="text-xp-text-muted col-span-2 text-center text-xs">
          <span className="bg-xp-surface inline-block rounded px-2 py-1 font-mono text-xs capitalize">
            {file.is_dir ? 'Folder' : file.file_type}
          </span>
        </div>
        <div className="text-xp-text-muted col-span-2 text-right font-mono text-xs">
          {formatDate(file.modified)}
        </div>
      </div>
    );
  },
);

const GroupHeader = React.memo(({ name, count }: { name: string; count: number }) => (
  <div
    className="bg-xp-surface-secondary border-xp-border flex items-center border-b px-3 py-2"
    style={{ height: GROUP_HEADER_HEIGHT }}
  >
    <span className="text-xp-text-secondary text-xs font-semibold uppercase tracking-wide">
      {name}
    </span>
    <span className="text-xp-text-muted ml-2 text-xs">({count})</span>
  </div>
));

const DetailsView = (props: DetailsViewProps) => {
  const {
    files,
    selectedFiles,
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
    fileGroups,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);

  const filesByPath = useMemo(() => {
    const map = new Map<string, FileEntry>();
    for (const file of files) {
      map.set(file.path, file);
    }
    if (fileGroups && fileGroups.length > 0) {
      for (const group of fileGroups) {
        for (const file of group.files) {
          map.set(file.path, file);
        }
      }
    }
    return map;
  }, [files, fileGroups]);

  const onFileClick = useCallback(
    (filePath: string, event: React.MouseEvent) => {
      const file = filesByPath.get(filePath);
      if (file) handleFileClick(file, event);
    },
    [filesByPath, handleFileClick],
  );

  const onFileDoubleClick = useCallback(
    (filePath: string) => {
      const file = filesByPath.get(filePath);
      if (file) handleFileDoubleClick(file);
    },
    [filesByPath, handleFileDoubleClick],
  );

  const onFileRightClick = useCallback(
    (filePath: string, event: React.MouseEvent) => {
      const file = filesByPath.get(filePath);
      if (file) handleFileRightClick(file, event);
    },
    [filesByPath, handleFileRightClick],
  );

  const flatItems = useMemo<FlatItem[]>(() => {
    if (fileGroups && fileGroups.length > 0) {
      const items: FlatItem[] = [];
      for (const group of fileGroups) {
        items.push({ type: 'header', group: { name: group.group, count: group.files.length } });
        for (const file of group.files) {
          items.push({ type: 'file', file });
        }
      }
      return items;
    }
    return files.map((file) => ({ type: 'file' as const, file }));
  }, [fileGroups, files]);

  const needsVirtualization = flatItems.length >= DETAILS_VIRTUALIZATION_THRESHOLD;

  const estimateSize = useCallback(
    (index: number) => {
      const item = flatItems[index];
      return item?.type === 'header' ? GROUP_HEADER_HEIGHT : DETAILS_ROW_HEIGHT;
    },
    [flatItems],
  );

  const virtualizer = useVirtualizer({
    count: needsVirtualization ? flatItems.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: 10,
    enabled: needsVirtualization,
  });

  const header = (
    <div className="bg-xp-surface border-xp-border sticky top-0 z-20 border-b" role="row">
      <div className="text-xp-text-muted grid grid-cols-12 items-center gap-3 px-3 py-3 text-xs font-medium">
        <div className="col-span-1" role="columnheader" aria-label="Icon" />
        <div className="col-span-5" role="columnheader">
          Name
        </div>
        <div className="col-span-2 text-right" role="columnheader">
          Size
        </div>
        <div className="col-span-2 text-center" role="columnheader">
          Type
        </div>
        <div className="col-span-2 text-right" role="columnheader">
          Modified
        </div>
      </div>
    </div>
  );

  const stableRowProps = {
    selectedFiles,
    getFileIcon,
    formatFileSize,
    formatFolderSize,
    formatDate,
    onFileClick,
    onFileDoubleClick,
    onFileRightClick,
    getFolderSize,
    isCalculatingSize,
    onCalculateFolderSize: calculateFolderSize,
  };

  const renderFlatItem = (item: FlatItem) => {
    if (item.type === 'header') {
      return <GroupHeader name={item.group.name} count={item.group.count} />;
    }
    return <FileRow file={item.file} {...stableRowProps} />;
  };

  if (!needsVirtualization) {
    return (
      <div
        className="text-sm"
        role="table"
        aria-label="File list"
        onContextMenu={handleBackgroundRightClick || undefined}
      >
        {header}
        <div className="divide-xp-border divide-y divide-opacity-30" role="rowgroup">
          {flatItems.map((item) => (
            <div key={item.type === 'header' ? `group-${item.group.name}` : item.file.path}>
              {renderFlatItem(item)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto text-sm"
      role="table"
      aria-label="File list"
      onContextMenu={handleBackgroundRightClick || undefined}
    >
      {header}
      <div
        role="rowgroup"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = flatItems[virtualRow.index];
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
              }}
            >
              {renderFlatItem(item)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DetailsView;
