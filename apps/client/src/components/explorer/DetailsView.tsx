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

const FileRow = React.memo(
  ({
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
        className={`hover:bg-xp-surface-light grid cursor-pointer grid-cols-12 items-center gap-3 px-3 py-2.5 transition-colors ${
          selectedFiles.has(file.path)
            ? 'bg-xp-purple/20 border-xp-purple/40 border'
            : 'text-xp-text border border-transparent'
        } `}
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
                onClick={(e) => {
                  e.stopPropagation();
                  calculateFolderSize?.(file.path);
                }}
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
              <div className="bg-xp-surface/80 border-xp-border sticky top-[41px] z-10 border-b px-3 py-2 backdrop-blur-sm">
                <span className="text-xp-text-muted text-xs font-semibold uppercase tracking-wide">
                  {group.group}
                </span>
                <span className="text-xp-text-muted ml-2 text-xs">({group.files.length})</span>
              </div>
              <div className="divide-xp-border divide-y divide-opacity-30">
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
        <div className="divide-xp-border divide-y divide-opacity-30" role="rowgroup">
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
};

export default DetailsView;
