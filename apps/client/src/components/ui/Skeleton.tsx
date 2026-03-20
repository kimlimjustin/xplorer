import React from 'react';

// ─── Shared shimmer style ────────────────────────────────────────────────────
// All skeleton primitives use CSS variables (--xp-*) and the @keyframes
// xp-shimmer defined in index.css.  No Tailwind classes are used.

const shimmerStyle: React.CSSProperties = {
  background:
    'linear-gradient(90deg, var(--xp-surface) 25%, var(--xp-surface-light) 50%, var(--xp-surface) 75%)',
  backgroundSize: '200% 100%',
  animation: 'xp-shimmer 1.5s ease-in-out infinite',
  borderRadius: 4,
};

// ─── SkeletonLine ────────────────────────────────────────────────────────────
// A single-line shimmer bar.  Width/height are configurable.

interface SkeletonLineProps {
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
}

export const SkeletonLine = ({ width = '100%', height = 12, style }: SkeletonLineProps) => {
  return (
    <div
      aria-hidden="true"
      style={{
        ...shimmerStyle,
        width,
        height,
        ...style,
      }}
    />
  );
}

// ─── SkeletonBlock ───────────────────────────────────────────────────────────
// A rectangular shimmer placeholder.

interface SkeletonBlockProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export const SkeletonBlock = ({
  width = '100%',
  height = 80,
  borderRadius = 6,
  style,
}: SkeletonBlockProps) => {
  return (
    <div
      aria-hidden="true"
      style={{
        ...shimmerStyle,
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

// ─── SkeletonCircle ──────────────────────────────────────────────────────────
// A circular shimmer placeholder (avatars, icons, etc.).

interface SkeletonCircleProps {
  size?: number;
  style?: React.CSSProperties;
}

export const SkeletonCircle = ({ size = 40, style }: SkeletonCircleProps) => {
  return (
    <div
      aria-hidden="true"
      style={{
        ...shimmerStyle,
        width: size,
        height: size,
        borderRadius: '50%',
        ...style,
      }}
    />
  );
}

// ─── FileGridSkeleton ────────────────────────────────────────────────────────
// Matches the FileGrid layout: a grid of file-item-shaped placeholders.
// Default count = 12 to fill a typical viewport.

interface FileGridSkeletonProps {
  count?: number;
  viewMode?: string;
}

export const FileGridSkeleton = ({ count = 12, viewMode = 'medium' }: FileGridSkeletonProps) => {
  const isListView = viewMode === 'list';

  if (isListView) {
    return <FileListSkeleton count={count} />;
  }

  // Grid view: cards with icon placeholder + text lines
  return (
    <div
      role="status"
      aria-label="Loading files"
      aria-live="polite"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: 8,
        padding: 8,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            borderRadius: 8,
            border: '1px solid var(--xp-border)',
            backgroundColor: 'transparent',
          }}
        >
          {/* Icon placeholder */}
          <SkeletonBlock width={40} height={40} borderRadius={6} />
          {/* Filename placeholder */}
          <SkeletonLine width="80%" height={10} />
        </div>
      ))}
    </div>
  );
}

// ─── FileListSkeleton ────────────────────────────────────────────────────────
// Matches the list/details view: rows with icon + text.

interface FileListSkeletonProps {
  count?: number;
}

export const FileListSkeleton = ({ count = 10 }: FileListSkeletonProps) => {
  return (
    <div
      role="status"
      aria-label="Loading files"
      aria-live="polite"
      style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 8px',
            borderRadius: 6,
          }}
        >
          {/* Icon */}
          <SkeletonBlock width={20} height={20} borderRadius={4} />
          {/* Filename */}
          <SkeletonLine width={`${55 + (i % 4) * 10}%`} height={10} />
          {/* Size column */}
          <SkeletonLine width={48} height={10} style={{ marginLeft: 'auto', flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

// ─── PreviewSkeleton ─────────────────────────────────────────────────────────
// Placeholder for the preview panel while content is loading.

export const PreviewSkeleton = () => {
  return (
    <div
      role="status"
      aria-label="Loading preview"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 16,
        padding: 24,
      }}
    >
      {/* Large preview area placeholder */}
      <SkeletonBlock width="100%" height={160} borderRadius={8} />
      {/* Title line */}
      <SkeletonLine width="60%" height={14} />
      {/* Subtitle / metadata lines */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonLine width="80%" height={10} />
        <SkeletonLine width="45%" height={10} />
      </div>
    </div>
  );
}

// ─── SidebarSkeleton ─────────────────────────────────────────────────────────
// Placeholder for the sidebar tree while it loads (quick links, drives, etc.).

interface SidebarSkeletonProps {
  sections?: number;
  itemsPerSection?: number;
}

export const SidebarSkeleton = ({ sections = 3, itemsPerSection = 4 }: SidebarSkeletonProps) => {
  return (
    <div
      role="status"
      aria-label="Loading sidebar"
      aria-live="polite"
      style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {Array.from({ length: sections }, (_, s) => (
        <div key={s} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Section header */}
          <SkeletonLine width={80} height={10} style={{ marginBottom: 4 }} />
          {/* Items */}
          {Array.from({ length: itemsPerSection }, (_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                paddingLeft: 8,
              }}
            >
              <SkeletonBlock width={16} height={16} borderRadius={3} />
              <SkeletonLine width={`${50 + (i % 3) * 15}%`} height={10} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
