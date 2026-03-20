import React, { useState, useEffect, useRef } from 'react';
import { FileEntry, TauriAPI } from '@/lib/tauri-api';
import { useDraggable } from '@/hooks/use-draggable';
import { useDroppable } from '@/hooks/use-droppable';
import { useThumbnailCache } from '@/hooks/use-thumbnail-cache';
import { isImageFile } from './FileGridHelpers';
import { ViewComponentProps } from './FileGridTypes';

// Filmstrip thumbnail item
const GalleryStripThumb = React.memo(
  ({
    file,
    isFocused,
    isSelected,
    selectedFiles,
    allFiles,
    getFileIcon,
    thumbnailUrl,
    onClick,
    onDoubleClick,
    onRightClick,
  }: {
    file: FileEntry;
    isFocused: boolean;
    isSelected: boolean;
    selectedFiles: Set<string>;
    allFiles: FileEntry[];
    getFileIcon: (file: FileEntry) => React.ReactNode;
    thumbnailUrl?: string;
    onClick: (e: React.MouseEvent) => void;
    onDoubleClick: () => void;
    onRightClick: (e: React.MouseEvent) => void;
  }) => {
    const [thumbError, setThumbError] = useState(false);
    const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
    const isImage = isImageFile(file);
    const dragHandlers = useDraggable({ file, selectedFiles, allFiles });
    const dropRef = useDroppable(file.path, !file.is_dir);

    const dimensionOverlayStyle: React.CSSProperties = {
      position: 'absolute',
      bottom: 1,
      right: 1,
      fontSize: 7,
      lineHeight: 1,
      padding: '1px 3px',
      borderRadius: 3,
      background: 'rgba(0,0,0,0.6)',
      color: '#fff',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    };

    return (
      <div
        ref={dropRef}
        {...dragHandlers}
        role="option"
        aria-selected={isSelected}
        aria-label={`${file.name}${file.is_dir ? ', folder' : ', file'}`}
        data-gallery-path={file.path}
        className={`
        flex-shrink-0 w-16 h-16 rounded-md overflow-hidden cursor-pointer transition-all
        border-2
        ${
          isFocused
            ? 'border-xp-blue/70 ring-1 ring-xp-blue/50 scale-105'
            : isSelected
              ? 'border-xp-blue/50'
              : 'border-transparent hover:border-xp-text-muted/30'
        }
      `}
        style={{ position: 'relative' }}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onRightClick}
        title={file.name}
      >
        {isImage && !thumbError && thumbnailUrl ? (
          <>
            <img
              src={thumbnailUrl}
              alt={file.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onLoad={(e) => {
                const img = e.currentTarget;
                setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              onError={() => setThumbError(true)}
            />
            {dimensions && (
              <span style={dimensionOverlayStyle}>
                {dimensions.w}x{dimensions.h}
              </span>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-xp-surface-light">
            <span className="text-xl opacity-60">{getFileIcon(file)}</span>
          </div>
        )}
      </div>
    );
  },
);

GalleryStripThumb.displayName = 'GalleryStripThumb';

// Gallery View Component -- filmstrip style with large preview + thumbnail strip
const GalleryView = ({
  files,
  selectedFiles,
  currentPath,
  getFileIcon,
  formatFileSize,
  formatDate,
  handleFileClick,
  handleFileDoubleClick,
  handleFileRightClick,
  handleBackgroundRightClick,
}: ViewComponentProps) => {
  const [focusedFile, setFocusedFile] = useState<FileEntry | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [previewDimensions, setPreviewDimensions] = useState<{ w: number; h: number } | null>(null);
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [indexingStatus, setIndexingStatus] = useState<'idle' | 'indexing' | 'done'>('idle');
  const stripRef = useRef<HTMLDivElement>(null);
  const { getThumbnailUrl, preloadThumbnails } = useThumbnailCache(100);

  // Preload thumbnails for all image files in this folder
  useEffect(() => {
    const imagePaths = files.filter(isImageFile).map((f) => f.path);
    if (imagePaths.length > 0) preloadThumbnails(imagePaths);
  }, [files, preloadThumbnails]);
  const bgDropRef = useDroppable(
    currentPath,
    currentPath.startsWith('xplorer://') || currentPath.startsWith('gdrive://'),
  );

  // Reset focused file when files change (navigated to a new folder)
  useEffect(() => {
    setFocusedFile(null);
    setPreviewError(false);
  }, [currentPath]);

  // Auto-focus: use selected file, or first file
  const displayFile =
    focusedFile ?? files.find((f) => selectedFiles.has(f.path)) ?? files[0] ?? null;
  const isDisplayImage = displayFile ? isImageFile(displayFile) : false;

  // Reset preview error, fetch AI description, and auto-index current + nearby images
  useEffect(() => {
    setPreviewError(false);
    setPreviewDimensions(null);
    setAiDescription(null);
    setIndexingStatus('idle');

    if (!displayFile || !isImageFile(displayFile)) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      // 1. Check if current image already has a description
      const currentEntry = await TauriAPI.getAIIndexEntry(displayFile.path).catch(() => null);
      if (cancelled) return;
      if (currentEntry?.description) {
        setAiDescription(currentEntry.description);
        setIndexingStatus('done');
      }

      // 2. Collect current +/- 3 nearby image files
      const imageFiles = files.filter(isImageFile);
      const idx = imageFiles.findIndex((f) => f.path === displayFile.path);
      if (idx === -1) return;
      const start = Math.max(0, idx - 3);
      const end = Math.min(imageFiles.length, idx + 4);
      const nearby = imageFiles.slice(start, end);

      // 3. Check which nearby images need indexing
      const unindexed: string[] = [];
      for (const f of nearby) {
        if (f.path === displayFile.path && currentEntry?.description) continue;
        const entry = await TauriAPI.getAIIndexEntry(f.path).catch(() => null);
        if (cancelled) return;
        if (!entry?.description) unindexed.push(f.path);
      }

      if (cancelled || unindexed.length === 0) return;

      // 4. Trigger indexing for unindexed files
      setIndexingStatus('indexing');
      await TauriAPI.triggerAIIndexing(unindexed).catch((err) =>
        console.warn('[GalleryView] AI indexing failed:', err),
      );
      if (cancelled) return;

      // 5. Poll for current image's description if it was unindexed
      if (unindexed.includes(displayFile.path)) {
        pollTimer = setInterval(async () => {
          if (cancelled) {
            if (pollTimer) clearInterval(pollTimer);
            return;
          }
          const entry = await TauriAPI.getAIIndexEntry(displayFile.path).catch(() => null);
          if (entry?.description) {
            setAiDescription(entry.description);
            setIndexingStatus('done');
            if (pollTimer) clearInterval(pollTimer);
            if (timeoutTimer) clearTimeout(timeoutTimer);
          }
        }, 3000);

        // Timeout after 90s
        timeoutTimer = setTimeout(() => {
          if (pollTimer) clearInterval(pollTimer);
          if (!cancelled) setIndexingStatus('idle');
        }, 90000);
      }
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
    // displayFile?.path is sufficient; we don't need the full object reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayFile?.path, files]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!displayFile) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return;

      const idx = files.indexOf(displayFile);
      if (idx === -1) return;

      if (e.key === 'ArrowRight' && idx < files.length - 1) {
        e.preventDefault();
        const next = files[idx + 1];
        setFocusedFile(next);
        handleFileClick(next, e as unknown as React.MouseEvent);
      } else if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault();
        const prev = files[idx - 1];
        setFocusedFile(prev);
        handleFileClick(prev, e as unknown as React.MouseEvent);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [files, displayFile, handleFileClick]);

  // Scroll the active thumbnail into view
  useEffect(() => {
    if (!displayFile || !stripRef.current) return;
    const el = stripRef.current.querySelector(
      `[data-gallery-path="${CSS.escape(displayFile.path)}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [displayFile]);

  return (
    <div
      ref={bgDropRef}
      className="flex flex-col h-full overflow-hidden"
      aria-label="Gallery view"
      onContextMenu={handleBackgroundRightClick || undefined}
    >
      {/* -- Large preview area -- */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center bg-xp-bg/50 relative overflow-hidden"
        aria-label={displayFile ? `Preview of ${displayFile.name}` : 'No file selected'}
        onDoubleClick={() => displayFile && handleFileDoubleClick(displayFile)}
        onContextMenu={(e) => displayFile && handleFileRightClick(displayFile, e)}
      >
        {displayFile ? (
          isDisplayImage && !previewError ? (
            <>
              <img
                src={getThumbnailUrl(displayFile.path)}
                alt={displayFile.name}
                className="max-w-full max-h-full object-contain select-none"
                draggable={false}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setPreviewDimensions({ w: img.naturalWidth, h: img.naturalHeight });
                }}
                onError={() => setPreviewError(true)}
              />
              {/* Image dimensions overlay */}
              {previewDimensions && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    pointerEvents: 'none',
                    backdropFilter: 'blur(4px)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {previewDimensions.w} x {previewDimensions.h}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 text-xp-text-muted">
              <span className="text-7xl opacity-50">{getFileIcon(displayFile)}</span>
              <span className="text-sm font-medium">{displayFile.name}</span>
              <span className="text-xs">
                {displayFile.is_dir ? 'Folder' : formatFileSize(displayFile.size)}
              </span>
            </div>
          )
        ) : (
          <div className="text-xp-text-muted text-sm">No files</div>
        )}

        {/* File info overlay */}
        {displayFile && (
          <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-gradient-to-t from-black/50 to-transparent">
            <div className="text-sm font-medium text-white truncate">{displayFile.name}</div>
            <div className="text-xs text-white/70">
              {displayFile.is_dir ? 'Folder' : formatFileSize(displayFile.size)}
              {displayFile.modified > 0 && <> &middot; {formatDate(displayFile.modified)}</>}
            </div>
            {aiDescription ? (
              <div className="text-xs text-white/60 mt-1 line-clamp-2 italic">{aiDescription}</div>
            ) : indexingStatus === 'indexing' && isDisplayImage ? (
              <div className="text-xs text-white/50 mt-1 italic flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />
                Generating description...
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* -- Horizontal filmstrip -- */}
      <div className="flex-shrink-0 border-t border-xp-border bg-xp-surface">
        <div ref={stripRef} className="flex gap-1 p-2 overflow-x-auto gallery-filmstrip">
          {files.map((file) => (
            <GalleryStripThumb
              key={file.path}
              file={file}
              isFocused={displayFile?.path === file.path}
              isSelected={selectedFiles.has(file.path)}
              selectedFiles={selectedFiles}
              allFiles={files}
              getFileIcon={getFileIcon}
              thumbnailUrl={isImageFile(file) ? getThumbnailUrl(file.path) : undefined}
              onClick={(e) => {
                setFocusedFile(file);
                handleFileClick(file, e);
              }}
              onDoubleClick={() => handleFileDoubleClick(file)}
              onRightClick={(e) => handleFileRightClick(file, e)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default GalleryView;
