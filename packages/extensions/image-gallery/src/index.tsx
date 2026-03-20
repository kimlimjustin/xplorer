/**
 * Image Gallery Extension
 *
 * Demonstrates: Preview.register() with binary file reading, image rendering,
 * zoom controls, prev/next navigation between images, dimensions display.
 *
 * Usage: Select an image file and it renders in the preview panel with zoom controls.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Preview, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Types ───────────────────────────────────────────────────────────────────

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified?: number;
  extension?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif']);

const MIME_MAP: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
  svg: 'image/svg+xml', ico: 'image/x-icon', avif: 'image/avif',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function getExtension(path: string): string {
  return path.split('.').pop()?.toLowerCase() || '';
}

function isImageFile(path: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(path));
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Image Viewer Component ──────────────────────────────────────────────────

function ImageViewer({ filePath, allImages }: { filePath: string; allImages: FileEntry[] }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  // Find current image index in the image list
  useEffect(() => {
    const idx = allImages.findIndex(f => f.path === filePath);
    if (idx >= 0) setCurrentIndex(idx);
  }, [filePath, allImages]);

  const currentFile = allImages[currentIndex] || { path: filePath, name: filePath.split(/[/\\]/).pop() || '', size: 0 };

  // Load image
  useEffect(() => {
    let cancelled = false;
    const path = currentFile.path;
    setLoading(true);
    setError(null);
    setDimensions(null);
    setZoom(1);

    const ext = getExtension(path);

    // For SVG, read as text and create a blob
    if (ext === 'svg') {
      api.files.read(path)
        .then((buffer) => {
          if (cancelled) return;
          const blob = new Blob([buffer], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
          setLoading(false);
        })
        .catch((err) => {
          if (!cancelled) { setError(String(err)); setLoading(false); }
        });
      return () => { cancelled = true; };
    }

    // For raster images, read as binary and create object URL
    api.files.read(path)
      .then((buffer) => {
        if (cancelled) return;
        const mime = MIME_MAP[ext] || 'image/png';
        const blob = new Blob([buffer], { type: mime });
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) { setError(String(err)); setLoading(false); }
      });

    return () => {
      cancelled = true;
    };
  }, [currentFile.path]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  const zoomIn = () => setZoom(z => Math.min(5, z + 0.25));
  const zoomOut = () => setZoom(z => Math.max(0.1, z - 0.25));
  const zoomReset = () => setZoom(1);
  const goPrev = () => setCurrentIndex(i => (i > 0 ? i - 1 : allImages.length - 1));
  const goNext = () => setCurrentIndex(i => (i < allImages.length - 1 ? i + 1 : 0));

  const filename = currentFile.name;
  const ext = getExtension(currentFile.path).toUpperCase();

  if (loading) {
    return (
      <div style={{ padding: 16, color: 'var(--xp-text-muted, #888)', fontSize: 13, textAlign: 'center' as const }}>
        Loading image...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, color: 'var(--xp-red, #f7768e)', fontSize: 13 }}>
        {`Error: ${error}`}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', borderBottom: '1px solid var(--xp-border, #333)',
        fontSize: 12, flexShrink: 0,
      }}>
        {/* Nav buttons */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {allImages.length > 1 && (
            <button onClick={goPrev} style={btnStyle()} title="Previous image">
              ◀
            </button>
          )}
          {allImages.length > 1 && (
            <span style={{ fontSize: 11, color: 'var(--xp-text-muted, #888)', margin: '0 4px' }}>
              {`${currentIndex + 1}/${allImages.length}`}
            </span>
          )}
          {allImages.length > 1 && (
            <button onClick={goNext} style={btnStyle()} title="Next image">
              ▶
            </button>
          )}
        </div>
        {/* Zoom controls */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={zoomOut} style={btnStyle()} title="Zoom out">−</button>
          <button
            onClick={zoomReset}
            style={{ ...btnStyle(), minWidth: 45, fontSize: 11 }}
            title="Reset zoom"
          >
            {`${Math.round(zoom * 100)}%`}
          </button>
          <button onClick={zoomIn} style={btnStyle()} title="Zoom in">+</button>
        </div>
      </div>

      {/* Image area */}
      <div style={{
        flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--xp-bg, #1a1b26)',
        // Checkerboard pattern for transparency
        backgroundImage: 'linear-gradient(45deg, var(--xp-surface, #24283b) 25%, transparent 25%), linear-gradient(-45deg, var(--xp-surface, #24283b) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--xp-surface, #24283b) 75%), linear-gradient(-45deg, transparent 75%, var(--xp-surface, #24283b) 75%)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
      }}>
        {imageUrl && (
          <img
            ref={imgRef}
            src={imageUrl}
            onLoad={handleImageLoad}
            style={{
              maxWidth: zoom === 1 ? '100%' : 'none',
              maxHeight: zoom === 1 ? '100%' : 'none',
              width: zoom !== 1 && dimensions ? dimensions.width * zoom : undefined,
              objectFit: 'contain' as const,
              imageRendering: zoom > 2 ? 'pixelated' as const : 'auto' as const,
              transition: 'width 0.15s ease',
            }}
            alt={filename}
            draggable={false}
          />
        )}
      </div>

      {/* Info bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 10px', borderTop: '1px solid var(--xp-border, #333)',
        fontSize: 11, color: 'var(--xp-text-muted, #888)', flexShrink: 0,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1, marginRight: 8 }}>
          {filename}
        </span>
        <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {dimensions && <span>{`${dimensions.width}×${dimensions.height}`}</span>}
          <span>{ext}</span>
          <span>{formatSize(currentFile.size || 0)}</span>
        </span>
      </div>
    </div>
  );
}

function btnStyle(): React.CSSProperties {
  return {
    background: 'var(--xp-surface-light, #1e1e2e)',
    border: '1px solid var(--xp-border, #333)',
    borderRadius: 4,
    color: 'var(--xp-text, #c0caf5)',
    cursor: 'pointer',
    padding: '3px 8px',
    fontSize: 12,
    lineHeight: 1,
  };
}

// ── Extension Registration ──────────────────────────────────────────────────

let api: XplorerAPI;

Preview.register({
  id: 'xplorer-image-gallery',
  title: 'Image Gallery',
  description: 'Enhanced image preview with zoom controls and navigation',
  icon: 'image',
  permissions: ['file:read', 'directory:list'],

  canPreview: (file) => !file.is_dir && isImageFile(file.path),
  priority: 10,

  onActivate: (injectedApi) => { api = injectedApi; },

  render: (props) => {
    const selectedFiles = (props.selectedFiles || []) as FileEntry[];
    const imageFile = selectedFiles.find(f => isImageFile(f.path));

    if (!imageFile) {
      return (
        <div style={{ padding: 16, color: 'var(--xp-text-muted, #888)', fontSize: 13, textAlign: 'center' as const }}>
          <div style={{ marginBottom: 8, fontSize: 24 }}>🖼️</div>
          Select an image to preview
        </div>
      );
    }

    const allImages = selectedFiles.filter(f => isImageFile(f.path));

    return <ImageViewer filePath={imageFile.path} allImages={allImages.length > 0 ? allImages : [imageFile]} />;
  },
});
