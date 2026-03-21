import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDraggable } from '@/hooks/use-draggable';
import { useDroppable } from '@/hooks/use-droppable';
import { TagDots, GitStatusDot, isImageFile } from './FileGridHelpers';
import { FileGridItemProps, SizeBadgeInfo } from './FileGridTypes';
import { formatFileSize } from '@/lib/utils';
import { getFolderColorHex } from '@/lib/folder-colors';
import { validateFileName } from '@/lib/validate-filename';
import ThumbnailPreview from './ThumbnailPreview';

// ─── Chat file display name helper ───────────────────────────────────────────

const getChatDisplayName = (filename: string): string => {
  let name = filename.replace(/\.chat$/, '');
  // Remove date prefix like "2026-03-14_"
  name = name.replace(/^\d{4}-\d{2}-\d{2}_/, '');
  // Replace hyphens/underscores with spaces
  return name.replace(/[-_]/g, ' ');
};

// ─── Size badge component ────────────────────────────────────────────────────

const SizeBadge = ({
  file,
  info,
}: {
  file: { name: string; size: number; is_dir: boolean };
  info: SizeBadgeInfo;
}) => {
  let percentileLabel: string;
  if (info.percentile >= 90) {
    percentileLabel = 'Top 10%';
  } else if (info.percentile >= 75) {
    percentileLabel = 'Top 25%';
  } else if (info.percentile >= 50) {
    percentileLabel = 'Top 50%';
  } else {
    percentileLabel = 'Bottom 50%';
  }

  const tooltipText = file.is_dir
    ? `${file.name} — Folder`
    : `${file.name} — ${formatFileSize(file.size)} (${percentileLabel} in this folder)`;

  return (
    <div
      title={tooltipText}
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        width: 12,
        height: 12,
        borderRadius: '50%',
        backgroundColor: info.color,
        border: '1.5px solid var(--xp-border)',
        zIndex: 5,
        cursor: 'default',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        transition: 'transform 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1.3)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
      }}
    />
  );
};

// ─── Inline rename validation icon ──────────────────────────────────────────

const ValidationIcon = ({ valid, warning }: { valid: boolean; warning: boolean }) => {
  if (warning) {
    // Yellow warning triangle
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        style={{ flexShrink: 0, marginLeft: 4 }}
      >
        <path
          d="M12 2L1 21h22L12 2z"
          fill="var(--xp-yellow, #e2b340)"
          stroke="var(--xp-yellow, #e2b340)"
          strokeWidth="1"
        />
        <path d="M12 10v4" stroke="#000" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill="#000" />
      </svg>
    );
  }
  if (!valid) {
    // Red X
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        style={{ flexShrink: 0, marginLeft: 4 }}
      >
        <circle cx="12" cy="12" r="10" fill="var(--xp-red, #f44747)" />
        <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  // Green checkmark
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{ flexShrink: 0, marginLeft: 4 }}
    >
      <circle cx="12" cy="12" r="10" fill="var(--xp-green, #4ec9b0)" />
      <path
        d="M7 12l3 3 7-7"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ─── Helper: select filename without extension ──────────────────────────────

const selectFileNameWithoutExtension = (input: HTMLInputElement, name: string, isDir: boolean) => {
  if (isDir) {
    input.select();
    return;
  }
  const lastDot = name.lastIndexOf('.');
  if (lastDot > 0) {
    input.setSelectionRange(0, lastDot);
  } else {
    input.select();
  }
};

// ─── Inline rename input component ──────────────────────────────────────────

const InlineRenameInput = React.memo(
  ({
    fileName,
    isDir,
    isListView,
    existingNames,
    onConfirm,
    onCancel,
    onTab,
    filePath,
  }: {
    fileName: string;
    isDir: boolean;
    isListView: boolean;
    existingNames: string[];
    onConfirm: (oldPath: string, newName: string) => void;
    onCancel: () => void;
    onTab: (oldPath: string, newName: string) => void;
    filePath: string;
  }) => {
    const [value, setValue] = useState(fileName);
    const inputRef = useRef<HTMLInputElement>(null);
    const confirmedRef = useRef(false);

    // Auto-focus and select filename (without extension) on mount
    useEffect(() => {
      const input = inputRef.current;
      if (input) {
        input.focus();
        selectFileNameWithoutExtension(input, fileName, isDir);
      }
    }, [fileName, isDir]);

    const validation = validateFileName(value, existingNames, fileName);

    const handleConfirm = useCallback(() => {
      if (confirmedRef.current) return;
      const trimmed = value.trim();
      if (trimmed.length === 0 || trimmed === fileName) {
        onCancel();
        return;
      }
      if (!validation.valid) {
        onCancel();
        return;
      }
      confirmedRef.current = true;
      onConfirm(filePath, trimmed);
    }, [value, fileName, validation.valid, onConfirm, onCancel, filePath]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          handleConfirm();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          confirmedRef.current = true; // prevent blur from also firing
          onCancel();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          const trimmed = value.trim();
          if (trimmed.length > 0 && validation.valid && trimmed !== fileName) {
            confirmedRef.current = true;
            onTab(filePath, trimmed);
          } else {
            confirmedRef.current = true;
            onCancel();
          }
        }
      },
      [handleConfirm, onCancel, onTab, value, validation.valid, fileName, filePath],
    );

    const handleBlur = useCallback(() => {
      if (confirmedRef.current) return;
      handleConfirm();
    }, [handleConfirm]);

    // Determine border color based on validation
    let borderColor = 'var(--xp-green, #4ec9b0)';
    if (!validation.valid && !validation.warning) {
      borderColor = 'var(--xp-red, #f44747)';
    } else if (validation.warning) {
      borderColor = 'var(--xp-yellow, #e2b340)';
    }

    return (
      <div
        style={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          title={validation.message || undefined}
          aria-label="Rename file"
          aria-invalid={!validation.valid}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '2px 6px',
            fontSize: isListView ? '0.75rem' : '0.875rem',
            fontWeight: 500,
            fontFamily: 'inherit',
            color: 'var(--xp-text)',
            background: 'var(--xp-surface, rgba(30, 30, 50, 0.9))',
            border: `2px solid ${borderColor}`,
            borderRadius: 4,
            outline: 'none',
            boxShadow: `0 0 6px ${borderColor}40`,
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          }}
        />
        <ValidationIcon valid={validation.valid} warning={validation.warning} />
        {validation.message && (
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: '100%',
              marginTop: 2,
              padding: '2px 6px',
              fontSize: '0.65rem',
              lineHeight: 1.3,
              color: (() => {
                if (validation.warning) return 'var(--xp-yellow, #e2b340)';
                if (!validation.valid) return 'var(--xp-red, #f44747)';
                return 'var(--xp-text-muted)';
              })(),
              background: 'var(--xp-surface, rgba(30, 30, 50, 0.95))',
              border: '1px solid var(--xp-border)',
              borderRadius: 3,
              whiteSpace: 'nowrap',
              zIndex: 20,
              pointerEvents: 'none',
            }}
          >
            {validation.message}
          </span>
        )}
      </div>
    );
  },
);

InlineRenameInput.displayName = 'InlineRenameInput';

// ─── Memoized file grid item ─────────────────────────────────────────────────

const FileGridItem = React.memo(
  ({
    file,
    isSelected,
    tags,
    gitStatus,
    isGridView,
    isListView,
    viewMode,
    itemSize,
    selectedFiles,
    allFiles,
    getFileIcon,
    formatFileSize,
    formatFolderSize,
    formatDate,
    onFileClick,
    onFileDoubleClick,
    onFileRightClick,
    getFolderSize,
    isCalculatingSize,
    showSizeBadge,
    sizeBadgeInfo,
    thumbnailUrl,
    isRenaming,
    existingNames,
    onRenameConfirm,
    onRenameCancel,
    onRenameTab,
  }: FileGridItemProps) => {
    // Native drag via tauri-plugin-drag (mousedown/mousemove/mouseup)
    const dragHandlers = useDraggable({ file, selectedFiles, allFiles });

    // Folders are drop targets via data-drop-target attribute
    // Visual feedback is applied by DragDropContext setting data-drop-hover / data-drop-invalid
    const dropRef = useDroppable(file.path, !file.is_dir);

    // Folder color coding
    const folderColorHex = file.is_dir ? getFolderColorHex(file.path) : null;

    // ─── Thumbnail hover preview (image files only) ──────────────────────────
    const [showThumb, setShowThumb] = useState(false);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isImage = isImageFile(file);

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isImage || !thumbnailUrl) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setAnchorRect(rect);
        hoverTimerRef.current = setTimeout(() => {
          setShowThumb(true);
        }, 300);
      },
      [isImage, thumbnailUrl],
    );

    const handleMouseLeave = useCallback(() => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      setShowThumb(false);
    }, []);

    // ─── Render the file name area (normal label or inline rename input) ──────

    const renderNameArea = () => {
      if (isRenaming && onRenameConfirm && onRenameCancel && onRenameTab && existingNames) {
        return (
          <InlineRenameInput
            fileName={file.name}
            isDir={file.is_dir}
            isListView={isListView}
            existingNames={existingNames}
            onConfirm={onRenameConfirm}
            onCancel={onRenameCancel}
            onTab={onRenameTab}
            filePath={file.path}
          />
        );
      }

      return (
        <>
          <span className="min-w-0 truncate">
            {file.name.endsWith('.chat') ? getChatDisplayName(file.name) : file.name}
          </span>
          <GitStatusDot status={gitStatus} />
        </>
      );
    };

    return (
      <div
        ref={dropRef}
        {...(isRenaming ? {} : dragHandlers)}
        role="option"
        aria-selected={isSelected}
        aria-label={`${file.name}${file.is_dir ? ', folder' : ', file'}`}
        data-file-path={file.path}
        tabIndex={
          isSelected || (selectedFiles.size === 0 && allFiles[0]?.path === file.path) ? 0 : -1
        }
        className={`cursor-pointer rounded-lg transition-colors duration-150 ${
          isSelected
            ? 'bg-xp-blue/20 ring-xp-blue/80 border-xp-blue border ring-2'
            : 'hover:bg-xp-surface-light border border-transparent'
        } ${(() => {
          if (isGridView) return 'min-w-0 overflow-hidden p-3 text-center';
          if (isListView)
            {return 'flex min-w-0 items-center space-x-2 overflow-hidden p-2 text-left';}
          return 'flex items-center space-x-3 overflow-hidden p-2';
        })()} `}
        style={{ position: 'relative' }}
        onClick={(e) => {
          if (!isRenaming) onFileClick(file, e);
        }}
        onDoubleClick={() => {
          if (!isRenaming) onFileDoubleClick(file);
        }}
        onContextMenu={(e) => {
          if (!isRenaming) onFileRightClick(file, e);
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Folder color bar — left edge indicator */}
        {folderColorHex && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              borderRadius: '4px 0 0 4px',
              backgroundColor: folderColorHex,
              zIndex: 4,
            }}
          />
        )}
        {showSizeBadge && sizeBadgeInfo && <SizeBadge file={file} info={sizeBadgeInfo} />}
        <div
          className={`${itemSize} ${isGridView ? 'mb-2' : ''} flex-shrink-0`}
          style={folderColorHex ? { color: folderColorHex } : undefined}
        >
          {getFileIcon(file)}
        </div>
        <div className={`${isGridView ? 'w-full min-w-0' : 'min-w-0 flex-1'} select-none`}>
          <div
            className={`text-xp-text font-medium ${isRenaming ? '' : 'overflow-hidden'} ${isListView ? 'text-xs' : 'text-sm'} ${isGridView ? 'justify-center' : ''} flex items-center`}
            style={isRenaming ? { position: 'relative', overflow: 'visible' } : undefined}
          >
            {renderNameArea()}
          </div>
          {file.name.endsWith('.chat') && !isRenaming && (
            <span className="bg-xp-purple/20 text-xp-purple mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px]">
              Chat
            </span>
          )}
          {isGridView && !isRenaming && <TagDots tags={tags} />}
          {!isGridView && !isListView && !isRenaming && (
            <div className="text-xp-text-muted flex items-center space-x-4 text-xs">
              <span>
                {file.is_dir
                  ? formatFolderSize(getFolderSize(file.path), isCalculatingSize(file.path))
                  : formatFileSize(file.size)}
              </span>
              <span>{formatDate(file.modified)}</span>
              <span className="capitalize">{file.file_type}</span>
              <TagDots tags={tags} />
            </div>
          )}
          {viewMode === 'content' && !isRenaming && (
            <div className="text-xp-text-muted mt-1 text-xs">
              <div>
                {file.is_dir
                  ? formatFolderSize(getFolderSize(file.path), isCalculatingSize(file.path))
                  : formatFileSize(file.size)}
              </div>
              <div>{formatDate(file.modified)}</div>
              <TagDots tags={tags} />
            </div>
          )}
        </div>
        {/* Thumbnail preview tooltip (portal) */}
        {showThumb &&
          thumbnailUrl &&
          anchorRect &&
          !isRenaming &&
          createPortal(
            <ThumbnailPreview
              thumbnailUrl={thumbnailUrl}
              fileName={file.name}
              fileSize={file.size}
              anchorRect={anchorRect}
              visible={showThumb}
            />,
            document.body,
          )}
      </div>
    );
  },
);

FileGridItem.displayName = 'FileGridItem';

export default FileGridItem;
