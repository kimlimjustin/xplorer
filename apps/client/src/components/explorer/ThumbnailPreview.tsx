import React, { useState, useEffect, useRef } from 'react';
import { formatFileSize } from '@/lib/utils';

interface ThumbnailPreviewProps {
  /** Resolved thumbnail URL (from useThumbnailCache) */
  thumbnailUrl: string;
  /** Original file name */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** Bounding rect of the hovered element (for positioning) */
  anchorRect: DOMRect;
  /** Whether the tooltip is visible (controls fade animation) */
  visible: boolean;
}

/**
 * Tooltip that shows a 200x200 image thumbnail preview on hover.
 *
 * Positioned above or below the anchor element depending on available
 * viewport space. Displays image dimensions and file size below the
 * thumbnail. Uses a fade-in / fade-out animation.
 */
const ThumbnailPreview = React.memo(
  ({ thumbnailUrl, fileName, fileSize, anchorRect, visible }: ThumbnailPreviewProps) => {
    const [imgDimensions, setImgDimensions] = useState<{ w: number; h: number } | null>(null);
    const [loadError, setLoadError] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Reset state when URL changes
    useEffect(() => {
      setImgDimensions(null);
      setLoadError(false);
    }, [thumbnailUrl]);

    // Calculate position: prefer above, fall back to below
    const tooltipHeight = 260; // approximate max height (200 img + padding + info)
    const tooltipWidth = 216; // 200 + 16 padding
    const gap = 8;

    const spaceAbove = anchorRect.top;
    const showAbove = spaceAbove >= tooltipHeight + gap;

    const top = showAbove ? anchorRect.top - tooltipHeight - gap : anchorRect.bottom + gap;

    // Center horizontally on the anchor, clamped to viewport
    let left = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));

    const containerStyle: React.CSSProperties = {
      position: 'fixed',
      top,
      left,
      width: tooltipWidth,
      zIndex: 9999,
      pointerEvents: 'none',
      opacity: visible ? 1 : 0,
      transform: (() => {
        if (visible) return 'translateY(0)';
        return showAbove ? 'translateY(6px)' : 'translateY(-6px)';
      })(),
      transition: 'opacity 0.15s ease, transform 0.15s ease',
    };

    const cardStyle: React.CSSProperties = {
      background: 'var(--xp-surface)',
      border: '1px solid var(--xp-border)',
      borderRadius: 8,
      padding: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
      backdropFilter: 'blur(12px)',
    };

    const imgContainerStyle: React.CSSProperties = {
      width: 200,
      height: 200,
      borderRadius: 4,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--xp-bg)',
    };

    const imgStyle: React.CSSProperties = {
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain',
      display: 'block',
    };

    const infoStyle: React.CSSProperties = {
      marginTop: 6,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    };

    const fileNameStyle: React.CSSProperties = {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--xp-text)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    };

    const metaStyle: React.CSSProperties = {
      fontSize: 10,
      color: 'var(--xp-text-muted)',
      display: 'flex',
      gap: 8,
    };

    if (loadError) return null;

    return (
      <div ref={tooltipRef} style={containerStyle}>
        <div style={cardStyle}>
          <div style={imgContainerStyle}>
            <img
              src={thumbnailUrl}
              alt={fileName}
              style={imgStyle}
              onLoad={(e) => {
                const img = e.currentTarget;
                setImgDimensions({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              onError={() => setLoadError(true)}
            />
          </div>
          <div style={infoStyle}>
            <div style={fileNameStyle} title={fileName}>
              {fileName}
            </div>
            <div style={metaStyle}>
              {imgDimensions && (
                <span>
                  {imgDimensions.w} x {imgDimensions.h}
                </span>
              )}
              <span>{formatFileSize(fileSize)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

ThumbnailPreview.displayName = 'ThumbnailPreview';

export default ThumbnailPreview;
