import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileEntry } from '@/lib/tauri-api';
import { ViewComponentProps } from './FileGridTypes';
import type { FileGroup } from '@/lib/utils';

interface DetailsViewProps extends ViewComponentProps {
  fileGroups?: FileGroup[] | null;
}

const DETAILS_ROW_HEIGHT = 40;
const DETAILS_VIRTUALIZATION_THRESHOLD = 200;

const FileRow = ({
  file,
  selectedFiles,
  getFileIcon,
  formatFileSize,
  formatFolderSize,
  formatDate,
  handleFileClick,
  handleFileDoubleClick,
  handleFileRightClick,
  getFolderSize,
  isCalculatingSize,
  calculateFolderSize,
}: ViewComponentProps & { file: FileEntry }) => {
  return (
    <div
      role="row"
      aria-selected={selectedFiles.has(file.path)}
      aria-label={file.name}
      tabIndex={0}
      data-file-path={file.path}
      data-drop-target={file.is_dir ? file.path : undefined}
      className={`
        grid grid-cols-12 gap-3 items-center py-2.5 px-3 hover:bg-xp-surface-light cursor-pointer transition-colors
        ${
          selectedFiles.has(file.path)
            ? 'bg-xp-purple/20 border border-xp-purple/40'
            : 'text-xp-text border border-transparent'
        }
      `}
      onClick={(e) => handleFileClick(file, e)}
      onDoubleClick={() => handleFileDoubleClick(file)}
      onContextMenu={(e) => handleFileRightClick(file, e)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleFileDoubleClick(file);
        if (e.key === ' ') {
          e.preventDefault();
          handleFileClick(file, e as unknown as React.MouseEvent);
        }
      }}
    >
      <div className="col-span-1 flex justify-center">
        <span className="text-lg">{getFileIcon(file)}</span>
      </div>
      <div className="col-span-5 min-w-0">
        <div className="font-medium truncate">{file.name}</div>
      </div>
      <div className="col-span-2 text-right text-xs text-xp-text-muted">
        {file.is_dir ? (
          getFolderSize(file.path) || isCalculatingSize(file.path) ? (
            formatFolderSize(getFolderSize(file.path), isCalculatingSize(file.path))
          ) : (
            <button
              className="text-xp-text-muted hover:text-xp-accent transition-colors underline decoration-dotted"
              onClick={(e) => {
                e.stopPropagation();
                calculateFolderSize?.(file.path);
              }}
              title="Click to calculate folder size"
            >
              Calculate
            </button>
          )
        ) : (
          formatFileSize(file.size)
        )}
      </div>
      <div className="col-span-2 text-center text-xs text-xp-text-muted">
        <span className="inline-block px-2 py-1 bg-xp-surface rounded text-xs font-mono capitalize">
          {file.is_dir ? 'Folder' : file.file_type}
        </span>
      </div>
      <div className="col-span-2 text-right text-xs text-xp-text-muted font-mono">
        {formatDate(file.modified)}
      </div>
    </div>
  );
}

const DetailsView = (props: DetailsViewProps) => {
  const { files, handleBackgroundRightClick, fileGroups } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const needsVirtualization =
    files.length >= DETAILS_VIRTUALIZATION_THRESHOLD && !(fileGroups && fileGroups.length > 0);

  const virtualizer = useVirtualizer({
    count: needsVirtualization ? files.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => DETAILS_ROW_HEIGHT,
    overscan: 10,
    enabled: needsVirtualization,
  });

  const header = (
    <div className="sticky top-0 bg-xp-surface border-b border-xp-border z-20" role="row">
      <div className="grid grid-cols-12 gap-3 items-center py-3 px-3 text-xs font-medium text-xp-text-muted">
        <div className="col-span-1" role="columnheader" aria-label="Icon"></div>
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

  if (fileGroups && fileGroups.length > 0) {
    return (
      <div
        className="text-sm"
        role="table"
        aria-label="File list"
        onContextMenu={handleBackgroundRightClick || undefined}
      >
        {header}
        <div role="rowgroup">
          {fileGroups.map((group) => (
            <div key={group.group}>
              <div className="sticky top-[41px] z-10 px-3 py-2 bg-xp-surface/80 backdrop-blur-sm border-b border-xp-border">
                <span className="text-xs font-semibold text-xp-text-muted uppercase tracking-wide">
                  {group.group}
                </span>
                <span className="ml-2 text-xs text-xp-text-muted">({group.files.length})</span>
              </div>
              <div className="divide-y divide-xp-border divide-opacity-30">
                {group.files.map((file: FileEntry) => (
                  <FileRow key={file.path} file={file} {...props} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!needsVirtualization) {
    return (
      <div
        className="text-sm"
        role="table"
        aria-label="File list"
        onContextMenu={handleBackgroundRightClick || undefined}
      >
        {header}
        <div className="divide-y divide-xp-border divide-opacity-30" role="rowgroup">
          {files.map((file: FileEntry) => (
            <FileRow key={file.path} file={file} {...props} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="text-sm overflow-auto h-full"
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
          const file = files[virtualRow.index];
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
              <FileRow file={file} {...props} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DetailsView;
