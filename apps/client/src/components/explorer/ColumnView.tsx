import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileEntry, TauriAPI } from '@/lib/tauri-api';
import { ViewComponentProps } from './FileGridTypes';

interface ColumnData {
  path: string;
  files: FileEntry[];
  selectedFile: string | null;
}

const COLUMN_ROW_HEIGHT = 30;
const COLUMN_VIRTUALIZATION_THRESHOLD = 200;

const ColumnFileRow = ({
  file,
  isActive,
  isSelected,
  getFileIcon,
  onClick,
  onDoubleClick,
  onRightClick,
}: {
  file: FileEntry;
  isActive: boolean;
  isSelected: boolean;
  getFileIcon: (file: FileEntry) => React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onRightClick: (e: React.MouseEvent) => void;
}) => {
  return (
    <div
      role="option"
      aria-selected={isActive || isSelected}
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onRightClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDoubleClick();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 12px',
        cursor: 'pointer',
        fontSize: '13px',
        color: 'var(--xp-text)',
        backgroundColor: isActive
          ? 'var(--xp-accent)'
          : isSelected
            ? 'rgba(99, 102, 241, 0.2)'
            : 'transparent',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        outline: 'none',
        height: `${COLUMN_ROW_HEIGHT}px`,
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive && !isSelected) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        } else if (isSelected && !isActive) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(99, 102, 241, 0.2)';
        }
      }}
      onFocus={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.boxShadow = 'inset 0 0 0 1px var(--xp-accent)';
        }
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: '16px',
          height: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {getFileIcon(file)}
      </span>
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {file.name}
      </span>
      {file.is_dir && (
        <span
          style={{
            color: 'var(--xp-text-secondary)',
            fontSize: '14px',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ›
        </span>
      )}
    </div>
  );
}

const VirtualizedColumnPane = ({
  column,
  colIndex,
  selectedFiles,
  getFileIcon,
  handleColumnFileClick,
  handleFileDoubleClick,
  handleFileRightClick,
}: {
  column: ColumnData;
  colIndex: number;
  selectedFiles: Set<string>;
  getFileIcon: (file: FileEntry) => React.ReactNode;
  handleColumnFileClick: (file: FileEntry, colIndex: number, e: React.MouseEvent) => void;
  handleFileDoubleClick: (file: FileEntry) => void;
  handleFileRightClick: (file: FileEntry, e: React.MouseEvent) => void;
}) => {
  const columnScrollRef = useRef<HTMLDivElement>(null);
  const needsVirtualization = column.files.length >= COLUMN_VIRTUALIZATION_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: needsVirtualization ? column.files.length : 0,
    getScrollElement: () => columnScrollRef.current,
    estimateSize: () => COLUMN_ROW_HEIGHT,
    overscan: 10,
    enabled: needsVirtualization,
  });

  if (!needsVirtualization) {
    return (
      <div
        key={`${column.path}-${colIndex}`}
        style={{
          minWidth: '220px',
          maxWidth: '280px',
          width: '250px',
          height: '100%',
          borderRight: '1px solid var(--xp-border)',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        {column.files.map((file) => (
          <ColumnFileRow
            key={file.path}
            file={file}
            isActive={column.selectedFile === file.path}
            isSelected={selectedFiles.has(file.path)}
            getFileIcon={getFileIcon}
            onClick={(e) => handleColumnFileClick(file, colIndex, e)}
            onDoubleClick={() => handleFileDoubleClick(file)}
            onRightClick={(e) => handleFileRightClick(file, e)}
          />
        ))}
        {column.files.length === 0 && (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: 'var(--xp-text-secondary)',
              fontSize: '12px',
            }}
          >
            Empty folder
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={columnScrollRef}
      style={{
        minWidth: '220px',
        maxWidth: '280px',
        width: '250px',
        height: '100%',
        borderRight: '1px solid var(--xp-border)',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const file = column.files[virtualRow.index];
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
              <ColumnFileRow
                file={file}
                isActive={column.selectedFile === file.path}
                isSelected={selectedFiles.has(file.path)}
                getFileIcon={getFileIcon}
                onClick={(e) => handleColumnFileClick(file, colIndex, e)}
                onDoubleClick={() => handleFileDoubleClick(file)}
                onRightClick={(e) => handleFileRightClick(file, e)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ColumnView = ({
  files,
  currentPath,
  selectedFiles,
  handleFileClick,
  handleFileDoubleClick,
  handleFileRightClick,
  handleBackgroundRightClick,
  getFileIcon,
  formatFileSize,
  formatDate,
}: ViewComponentProps) => {
  const [columns, setColumns] = useState<ColumnData[]>([
    { path: currentPath, files, selectedFile: null },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setColumns([{ path: currentPath, files, selectedFile: null }]);
    // Only reset columns on path change; file updates handled by next effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  useEffect(() => {
    setColumns((prev) => {
      const updated = [...prev];
      if (updated.length > 0 && updated[0].path === currentPath) {
        updated[0] = { ...updated[0], files };
      }
      return updated;
    });
  }, [files, currentPath]);

  const handleColumnFileClick = useCallback(
    async (file: FileEntry, columnIndex: number, event: React.MouseEvent) => {
      handleFileClick(file, event);

      if (file.is_dir) {
        setColumns((prev) => {
          const updated = prev.slice(0, columnIndex + 1);
          updated[columnIndex] = { ...updated[columnIndex], selectedFile: file.path };
          return updated;
        });

        try {
          const dirFiles = await TauriAPI.readDirectory(file.path);
          setColumns((prev) => [...prev, { path: file.path, files: dirFiles, selectedFile: null }]);
          setTimeout(() => {
            scrollRef.current?.scrollTo({
              left: scrollRef.current.scrollWidth,
              behavior: 'smooth',
            });
          }, 50);
        } catch (err) {
          console.error('Failed to load directory:', err);
        }
      } else {
        setColumns((prev) => {
          const updated = prev.slice(0, columnIndex + 1);
          updated[columnIndex] = { ...updated[columnIndex], selectedFile: file.path };
          return updated;
        });
      }
    },
    [handleFileClick],
  );

  const getExtension = (name: string): string | null => {
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex > 0 && dotIndex < name.length - 1) {
      return name.substring(dotIndex + 1);
    }
    return null;
  };

  const selectedFileForPreview = columns.reduce<FileEntry | null>((acc, col) => {
    if (col.selectedFile) {
      const file = col.files.find((f) => f.path === col.selectedFile);
      if (file && !file.is_dir) return file;
    }
    return acc;
  }, null);

  return (
    <div
      ref={scrollRef}
      onContextMenu={handleBackgroundRightClick || undefined}
      style={{
        display: 'flex',
        height: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
    >
      {columns.map((column, colIndex) => (
        <VirtualizedColumnPane
          key={`${column.path}-${colIndex}`}
          column={column}
          colIndex={colIndex}
          selectedFiles={selectedFiles}
          getFileIcon={getFileIcon}
          handleColumnFileClick={handleColumnFileClick}
          handleFileDoubleClick={handleFileDoubleClick}
          handleFileRightClick={handleFileRightClick}
        />
      ))}

      {selectedFileForPreview && (
        <div
          style={{
            minWidth: '250px',
            width: '300px',
            height: '100%',
            padding: '16px',
            overflowY: 'auto',
            flexShrink: 0,
            borderRight: '1px solid var(--xp-border)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <div
              style={{
                fontSize: '48px',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              {getFileIcon(selectedFileForPreview)}
            </div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--xp-text)',
                wordBreak: 'break-all',
              }}
            >
              {selectedFileForPreview.name}
            </div>
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--xp-text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Size:</span>
              <span>{formatFileSize(selectedFileForPreview.size)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Modified:</span>
              <span>{formatDate(selectedFileForPreview.modified)}</span>
            </div>
            {selectedFileForPreview.file_type && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Type:</span>
                <span>{selectedFileForPreview.file_type}</span>
              </div>
            )}
            {getExtension(selectedFileForPreview.name) && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Extension:</span>
                <span>.{getExtension(selectedFileForPreview.name)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ColumnView;
