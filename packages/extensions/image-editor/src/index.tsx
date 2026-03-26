import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Editor, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Types ────────────────────────────────────────────────────────────────────

interface ImageInfo {
  width: number;
  height: number;
  format: string;
  file_size: number;
  color_type: string;
}

type ActiveTool = 'none' | 'crop';

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']);

const MIME_MAP: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getExtension(path: string): string {
  return path.split('.').pop()?.toLowerCase() || '';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDirectory(path: string): string {
  const sep = path.includes('/') ? '/' : '\\';
  const parts = path.split(sep);
  parts.pop();
  return parts.join(sep);
}

function getStem(path: string): string {
  const name = path.split(/[/\\]/).pop() || '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.substring(0, dot) : name;
}

// ── SVG Icons ────────────────────────────────────────────────────────────────

function RotateLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 2v6h6" />
      <path d="M2.5 8C5.5 3.5 11 2 15.5 4s7.5 7.5 5.5 12-7.5 7.5-12 5.5" />
    </svg>
  );
}

function RotateRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6" />
      <path d="M21.5 8C18.5 3.5 13 2 8.5 4S1 11.5 3 16s7.5 7.5 12 5.5" />
    </svg>
  );
}

function FlipHIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" />
      <path d="M16 7l4 5-4 5" />
      <path d="M8 7l-4 5 4 5" />
    </svg>
  );
}

function FlipVIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h18" />
      <path d="M7 8L12 4l5 4" />
      <path d="M7 16l5 4 5-4" />
    </svg>
  );
}

function CropIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2v14a2 2 0 002 2h14" />
      <path d="M18 22V8a2 2 0 00-2-2H2" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function ContrastIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20" />
      <path d="M12 2a10 10 0 010 20" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function btnStyle(active?: boolean): React.CSSProperties {
  return {
    background: active ? 'var(--xp-blue, #7aa2f7)' : 'var(--xp-surface-light, #1e1e2e)',
    border: '1px solid var(--xp-border, #333)',
    borderRadius: 4,
    color: active ? '#fff' : 'var(--xp-text, #c0caf5)',
    cursor: 'pointer',
    padding: '4px 8px',
    fontSize: 12,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  };
}

function separatorStyle(): React.CSSProperties {
  return {
    width: 1,
    height: 20,
    background: 'var(--xp-border, #333)',
    margin: '0 4px',
    flexShrink: 0,
  };
}

// ── Image Editor Component ───────────────────────────────────────────────────

function ImageEditorView({ filePath }: { filePath: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<ImageInfo | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [activeTool, setActiveTool] = useState<ActiveTool>('none');
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 });

  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1.0);
  const [isGrayscale, setIsGrayscale] = useState(false);

  const [currentPath, setCurrentPath] = useState(filePath);
  const [modified, setModified] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load image
  const loadImage = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCropRect(null);
    setActiveTool('none');

    try {
      const [buffer, imgInfo] = await Promise.all([
        api.files.read(path),
        api.images.getInfo(path),
      ]);
      const ext = getExtension(path);
      const mime = MIME_MAP[ext] || 'image/png';
      const blob = new Blob([buffer], { type: mime });
      const url = URL.createObjectURL(blob);

      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setInfo(imgInfo);
      setLoading(false);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCurrentPath(filePath);
    setBrightness(0);
    setContrast(1.0);
    setIsGrayscale(false);
    setModified(false);
    loadImage(filePath);
  }, [filePath, loadImage]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  // Build a temporary output path for editing operations
  function tempOutputPath(): string {
    const dir = getDirectory(currentPath);
    const ext = getExtension(currentPath);
    const stem = getStem(currentPath);
    const sep = currentPath.includes('/') ? '/' : '\\';
    return `${dir}${sep}${stem}_xplorer_edit_tmp.${ext}`;
  }

  // Apply an edit operation, reload the image from the result path, then
  // move the result to overwrite the temp working file.
  async function applyEdit(
    operation: () => Promise<string>,
    statusText: string,
  ) {
    setSaving(true);
    setStatusMsg(statusText);
    try {
      const result = await operation();
      setCurrentPath(result);
      setModified(true);
      await loadImage(result);
      setStatusMsg(null);
    } catch (err) {
      setError(String(err));
      setStatusMsg(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Tool actions ─────────────────────────────────────────────────────────

  const handleRotateLeft = () => {
    const out = tempOutputPath();
    applyEdit(() => api.images.rotate(currentPath, 270, out), 'Rotating...');
  };

  const handleRotateRight = () => {
    const out = tempOutputPath();
    applyEdit(() => api.images.rotate(currentPath, 90, out), 'Rotating...');
  };

  const handleFlipH = () => {
    const out = tempOutputPath();
    applyEdit(() => api.images.flip(currentPath, 'horizontal', out), 'Flipping...');
  };

  const handleFlipV = () => {
    const out = tempOutputPath();
    applyEdit(() => api.images.flip(currentPath, 'vertical', out), 'Flipping...');
  };

  const handleApplyCrop = () => {
    if (!cropRect || !dimensions) return;
    const imgEl = imgRef.current;
    if (!imgEl) return;

    // The crop coordinates from the overlay are in display (CSS) pixels.
    // We need to convert them back to actual image pixels.
    const displayW = imgEl.clientWidth;
    const displayH = imgEl.clientHeight;
    const scaleX = dimensions.width / displayW;
    const scaleY = dimensions.height / displayH;

    const cx = Math.round(cropRect.x * scaleX);
    const cy = Math.round(cropRect.y * scaleY);
    const cw = Math.round(cropRect.width * scaleX);
    const ch = Math.round(cropRect.height * scaleY);

    if (cw < 1 || ch < 1) return;

    const out = tempOutputPath();
    applyEdit(() => api.images.crop(currentPath, cx, cy, cw, ch, out), 'Cropping...');
    setCropRect(null);
    setActiveTool('none');
  };

  const handleCancelCrop = () => {
    setCropRect(null);
    setActiveTool('none');
  };

  const handleApplyBrightness = () => {
    if (brightness === 0) return;
    const out = tempOutputPath();
    applyEdit(() => api.images.adjustBrightness(currentPath, brightness, out), 'Adjusting brightness...');
    setBrightness(0);
  };

  const handleApplyContrast = () => {
    if (contrast === 1.0) return;
    const out = tempOutputPath();
    applyEdit(() => api.images.adjustContrast(currentPath, contrast, out), 'Adjusting contrast...');
    setContrast(1.0);
  };

  const handleToggleGrayscale = () => {
    if (!isGrayscale) {
      const out = tempOutputPath();
      applyEdit(() => api.images.grayscale(currentPath, out), 'Converting to grayscale...');
      setIsGrayscale(true);
    }
  };

  const handleSave = async () => {
    if (!modified) return;
    setSaving(true);
    setStatusMsg('Saving...');
    try {
      // If the current working path differs from the original, copy it over
      if (currentPath !== filePath) {
        const ext = getExtension(filePath);
        const out = filePath;
        // Use resize as an identity operation to save to the target
        if (dimensions) {
          await api.images.resize(currentPath, dimensions.width, dimensions.height, false, out);
        }
      }
      setModified(false);
      setStatusMsg('Saved');
      setTimeout(() => setStatusMsg(null), 2000);
    } catch (err) {
      setError(String(err));
      setStatusMsg(null);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAs = async () => {
    setSaving(true);
    setStatusMsg('Saving...');
    try {
      const dir = getDirectory(filePath);
      const ext = getExtension(filePath);
      const stem = getStem(filePath);
      const sep = filePath.includes('/') ? '/' : '\\';
      const newPath = `${dir}${sep}${stem}_edited.${ext}`;

      if (dimensions) {
        await api.images.resize(currentPath, dimensions.width, dimensions.height, false, newPath);
      }
      setStatusMsg(`Saved as ${stem}_edited.${ext}`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      setError(String(err));
      setStatusMsg(null);
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = () => {
    setCurrentPath(filePath);
    setBrightness(0);
    setContrast(1.0);
    setIsGrayscale(false);
    setModified(false);
    setCropRect(null);
    setActiveTool('none');
    loadImage(filePath);
  };

  // ── Zoom & Pan ───────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.max(0.1, Math.min(10, z + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (activeTool === 'crop') {
      // Start crop selection
      const rect = canvasRef.current?.getBoundingClientRect();
      const imgEl = imgRef.current;
      if (!rect || !imgEl) return;

      const imgRect = imgEl.getBoundingClientRect();
      const sx = e.clientX - imgRect.left;
      const sy = e.clientY - imgRect.top;

      if (sx >= 0 && sy >= 0 && sx <= imgEl.clientWidth && sy <= imgEl.clientHeight) {
        setIsCropping(true);
        setCropStart({ x: sx, y: sy });
        setCropRect({ x: sx, y: sy, width: 0, height: 0 });
      }
      return;
    }

    // Pan mode
    if (zoom > 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [activeTool, zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isCropping) {
      const imgEl = imgRef.current;
      if (!imgEl) return;
      const imgRect = imgEl.getBoundingClientRect();

      const cx = e.clientX - imgRect.left;
      const cy = e.clientY - imgRect.top;

      const clampedX = Math.max(0, Math.min(cx, imgEl.clientWidth));
      const clampedY = Math.max(0, Math.min(cy, imgEl.clientHeight));

      const x = Math.min(cropStart.x, clampedX);
      const y = Math.min(cropStart.y, clampedY);
      const w = Math.abs(clampedX - cropStart.x);
      const h = Math.abs(clampedY - cropStart.y);

      setCropRect({ x, y, width: w, height: h });
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [isCropping, isPanning, cropStart, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsCropping(false);
    setIsPanning(false);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--xp-text-muted, #888)', fontSize: 13 }}>
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

  const filename = filePath.split(/[/\\]/).pop() || '';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', background: 'var(--xp-bg, #1a1b26)' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 8px', borderBottom: '1px solid var(--xp-border, #333)',
        flexShrink: 0, flexWrap: 'wrap' as const, background: 'var(--xp-surface, #24283b)',
      }}>
        {/* Rotate */}
        <button onClick={handleRotateLeft} style={btnStyle()} title="Rotate left 90" disabled={saving}>
          <RotateLeftIcon />
        </button>
        <button onClick={handleRotateRight} style={btnStyle()} title="Rotate right 90" disabled={saving}>
          <RotateRightIcon />
        </button>

        <div style={separatorStyle()} />

        {/* Flip */}
        <button onClick={handleFlipH} style={btnStyle()} title="Flip horizontal" disabled={saving}>
          <FlipHIcon />
        </button>
        <button onClick={handleFlipV} style={btnStyle()} title="Flip vertical" disabled={saving}>
          <FlipVIcon />
        </button>

        <div style={separatorStyle()} />

        {/* Crop */}
        <button
          onClick={() => {
            if (activeTool === 'crop') { handleCancelCrop(); } else { setActiveTool('crop'); setCropRect(null); }
          }}
          style={btnStyle(activeTool === 'crop')}
          title="Crop tool"
          disabled={saving}
        >
          <CropIcon />
          <span>Crop</span>
        </button>
        {activeTool === 'crop' && cropRect && cropRect.width > 2 && cropRect.height > 2 && (
          <button onClick={handleApplyCrop} style={btnStyle()} title="Apply crop" disabled={saving}>
            Apply
          </button>
        )}
        {activeTool === 'crop' && (
          <button onClick={handleCancelCrop} style={btnStyle()} title="Cancel crop">
            Cancel
          </button>
        )}

        <div style={separatorStyle()} />

        {/* Brightness */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
          <SunIcon />
          <input
            type="range"
            min="-100"
            max="100"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            style={{ width: 80, accentColor: 'var(--xp-blue, #7aa2f7)' }}
            title={`Brightness: ${brightness}`}
            disabled={saving}
          />
          <span style={{ color: 'var(--xp-text-muted, #888)', minWidth: 24, textAlign: 'right' as const }}>{brightness}</span>
          {brightness !== 0 && (
            <button onClick={handleApplyBrightness} style={btnStyle()} title="Apply brightness" disabled={saving}>
              Apply
            </button>
          )}
        </div>

        <div style={separatorStyle()} />

        {/* Contrast */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
          <ContrastIcon />
          <input
            type="range"
            min="0"
            max="300"
            value={Math.round(contrast * 100)}
            onChange={(e) => setContrast(Number(e.target.value) / 100)}
            style={{ width: 80, accentColor: 'var(--xp-blue, #7aa2f7)' }}
            title={`Contrast: ${contrast.toFixed(2)}`}
            disabled={saving}
          />
          <span style={{ color: 'var(--xp-text-muted, #888)', minWidth: 30, textAlign: 'right' as const }}>{contrast.toFixed(1)}</span>
          {contrast !== 1.0 && (
            <button onClick={handleApplyContrast} style={btnStyle()} title="Apply contrast" disabled={saving}>
              Apply
            </button>
          )}
        </div>

        <div style={separatorStyle()} />

        {/* Grayscale */}
        <button
          onClick={handleToggleGrayscale}
          style={btnStyle(isGrayscale)}
          title="Convert to grayscale"
          disabled={saving || isGrayscale}
        >
          Grayscale
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Undo */}
        <button onClick={handleUndo} style={btnStyle()} title="Undo all changes" disabled={saving || !modified}>
          <UndoIcon />
          <span>Undo</span>
        </button>

        <div style={separatorStyle()} />

        {/* Save */}
        <button onClick={handleSave} style={btnStyle()} title="Save (overwrite original)" disabled={saving || !modified}>
          <SaveIcon />
          <span>Save</span>
        </button>
        <button onClick={handleSaveAs} style={btnStyle()} title="Save as new file" disabled={saving}>
          <SaveIcon />
          <span>Save As</span>
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={canvasRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative' as const,
          cursor: activeTool === 'crop' ? 'crosshair' : (zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default'),
          background: 'var(--xp-bg, #1a1b26)',
          backgroundImage: 'linear-gradient(45deg, var(--xp-surface, #24283b) 25%, transparent 25%), linear-gradient(-45deg, var(--xp-surface, #24283b) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--xp-surface, #24283b) 75%), linear-gradient(-45deg, transparent 75%, var(--xp-surface, #24283b) 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div style={{
          position: 'relative' as const,
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          transition: isPanning ? 'none' : 'transform 0.1s ease',
        }}>
          {imageUrl && (
            <img
              ref={imgRef}
              src={imageUrl}
              onLoad={handleImageLoad}
              style={{
                maxWidth: zoom === 1 ? '100%' : 'none',
                maxHeight: zoom === 1 ? 'calc(100vh - 120px)' : 'none',
                width: zoom !== 1 && dimensions ? dimensions.width * zoom : undefined,
                objectFit: 'contain' as const,
                imageRendering: zoom > 2 ? 'pixelated' as const : 'auto' as const,
                display: 'block',
                userSelect: 'none' as const,
              }}
              alt={filename}
              draggable={false}
            />
          )}

          {/* Crop overlay */}
          {activeTool === 'crop' && cropRect && cropRect.width > 0 && cropRect.height > 0 && (
            <div style={{
              position: 'absolute' as const,
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none' as const,
            }}>
              {/* Darkened area outside crop */}
              <div style={{
                position: 'absolute' as const,
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0, 0, 0, 0.5)',
                clipPath: `polygon(
                  0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                  ${cropRect.x}px ${cropRect.y}px,
                  ${cropRect.x}px ${cropRect.y + cropRect.height}px,
                  ${cropRect.x + cropRect.width}px ${cropRect.y + cropRect.height}px,
                  ${cropRect.x + cropRect.width}px ${cropRect.y}px,
                  ${cropRect.x}px ${cropRect.y}px
                )`,
              }} />
              {/* Crop border */}
              <div style={{
                position: 'absolute' as const,
                left: cropRect.x,
                top: cropRect.y,
                width: cropRect.width,
                height: cropRect.height,
                border: '2px dashed var(--xp-blue, #7aa2f7)',
                boxSizing: 'border-box' as const,
              }} />
              {/* Crop dimensions label */}
              {dimensions && imgRef.current && (
                <div style={{
                  position: 'absolute' as const,
                  left: cropRect.x,
                  top: cropRect.y + cropRect.height + 4,
                  fontSize: 10,
                  color: 'var(--xp-blue, #7aa2f7)',
                  background: 'rgba(0,0,0,0.7)',
                  padding: '1px 4px',
                  borderRadius: 2,
                }}>
                  {`${Math.round(cropRect.width * (dimensions.width / imgRef.current.clientWidth))} x ${Math.round(cropRect.height * (dimensions.height / imgRef.current.clientHeight))}`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status message overlay */}
        {statusMsg && (
          <div style={{
            position: 'absolute' as const,
            top: 8,
            right: 8,
            background: 'var(--xp-surface, #24283b)',
            border: '1px solid var(--xp-border, #333)',
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: 11,
            color: 'var(--xp-text, #c0caf5)',
          }}>
            {statusMsg}
          </div>
        )}
      </div>

      {/* Info bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 10px', borderTop: '1px solid var(--xp-border, #333)',
        fontSize: 11, color: 'var(--xp-text-muted, #888)', flexShrink: 0,
        background: 'var(--xp-surface, #24283b)',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1, marginRight: 8 }}>
          {filename}
          {modified && <span style={{ color: 'var(--xp-orange, #ff9e64)', marginLeft: 4 }}>(modified)</span>}
        </span>
        <span style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {dimensions && <span>{`${dimensions.width} x ${dimensions.height}`}</span>}
          {info && <span>{info.format}</span>}
          {info && <span>{formatSize(info.file_size)}</span>}
          <span>{`${Math.round(zoom * 100)}%`}</span>
        </span>
      </div>
    </div>
  );
}

// ── Extension Registration ───────────────────────────────────────────────────

let api: XplorerAPI;

Editor.register({
  id: 'image-editor',
  title: 'Image Editor',
  extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'],
  priority: 15,
  permissions: ['files:read', 'files:write'],

  onActivate: (injectedApi) => { api = injectedApi; },

  render: (props) => {
    return <ImageEditorView filePath={props.filePath} />;
  },
});
