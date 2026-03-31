import React from 'react';
import { RefreshCw, FileIcon, Columns, Rows, ChevronsDown, ChevronsUp } from 'lucide-react';
import type { DiffHunk, ViewMode } from '@/pages/file-comparison-helpers';

// ─── Statistics header ───────────────────────────────────────────────────
interface StatsHeaderProps {
  file1: { name: string; path: string; size: number };
  file2: { name: string; path: string; size: number };
  metadata: {
    linesAdded: number;
    linesRemoved: number;
    linesModified: number;
    totalLines1: number;
    totalLines2: number;
    processingTime: number;
    algorithm: string;
  };
  identical: boolean;
  similarity: number;
  formatSize: (b: number) => string;
}

export const StatsHeader = ({
  file1,
  file2,
  metadata,
  identical,
  similarity,
  formatSize,
}: StatsHeaderProps) => {
  const sizeDiff = file2.size - file1.size;
  let sizeDiffStr: string;
  if (sizeDiff > 0) {
    sizeDiffStr = `+${formatSize(sizeDiff)}`;
  } else if (sizeDiff < 0) {
    sizeDiffStr = `-${formatSize(Math.abs(sizeDiff))}`;
  } else {
    sizeDiffStr = 'same';
  }

  let sizeBgColor: string;
  if (sizeDiff === 0) {
    sizeBgColor = 'rgba(255,255,255,0.05)';
  } else if (sizeDiff > 0) {
    sizeBgColor = 'rgba(52,211,153,0.12)';
  } else {
    sizeBgColor = 'rgba(248,113,113,0.12)';
  }

  let sizeTextColor: string;
  if (sizeDiff === 0) {
    sizeTextColor = 'var(--xp-text-muted)';
  } else if (sizeDiff > 0) {
    sizeTextColor = 'var(--xp-green)';
  } else {
    sizeTextColor = 'var(--xp-red)';
  }

  let similarityColor: string;
  if (identical) {
    similarityColor = 'var(--xp-green)';
  } else if (similarity > 0.8) {
    similarityColor = 'var(--xp-yellow)';
  } else {
    similarityColor = 'var(--xp-red)';
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '6px 16px',
        borderBottom: '1px solid var(--xp-border)',
        fontSize: 11,
        backgroundColor: 'var(--xp-surface-light)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {/* Change counts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--xp-green)', fontWeight: 600 }}>
          +{metadata.linesAdded} addition{metadata.linesAdded !== 1 ? 's' : ''}
        </span>
        <span style={{ color: 'var(--xp-red)', fontWeight: 600 }}>
          -{metadata.linesRemoved} deletion{metadata.linesRemoved !== 1 ? 's' : ''}
        </span>
        {metadata.linesModified > 0 && (
          <span style={{ color: 'var(--xp-yellow)', fontWeight: 600 }}>
            ~{metadata.linesModified} modification{metadata.linesModified !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Separator */}
      <span style={{ color: 'var(--xp-border)', userSelect: 'none' }}>|</span>

      {/* File sizes */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--xp-text-secondary)' }}
      >
        <span>{formatSize(file1.size)}</span>
        <span style={{ color: 'var(--xp-text-muted)' }}>vs</span>
        <span>{formatSize(file2.size)}</span>
        <span
          style={{
            fontSize: 10,
            padding: '1px 5px',
            borderRadius: 3,
            backgroundColor: sizeBgColor,
            color: sizeTextColor,
          }}
        >
          {sizeDiffStr}
        </span>
      </div>

      {/* Separator */}
      <span style={{ color: 'var(--xp-border)', userSelect: 'none' }}>|</span>

      {/* Similarity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'var(--xp-text-secondary)' }}>Similarity:</span>
        <span
          style={{
            fontWeight: 600,
            color: similarityColor,
          }}
        >
          {(similarity * 100).toFixed(1)}%
        </span>
      </div>

      {/* Encoding (both are UTF-8 text in this comparison) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: 'var(--xp-text-muted)',
          marginLeft: 'auto',
        }}
      >
        <span>UTF-8</span>
        <span style={{ color: 'var(--xp-border)' }}>|</span>
        <span>{metadata.algorithm}</span>
      </div>
    </div>
  );
};

// ─── Diff toolbar with navigation and view toggle ────────────────────────
interface DiffToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  hunks: DiffHunk[];
  currentHunkIdx: number;
  onNext: () => void;
  onPrev: () => void;
  onRefresh: () => void;
}

export const DiffToolbar = ({
  viewMode,
  onViewModeChange,
  hunks,
  currentHunkIdx,
  onNext,
  onPrev,
  onRefresh,
}: DiffToolbarProps) => {
  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3px 8px',
    fontSize: 11,
    borderRadius: 4,
    border: '1px solid var(--xp-border)',
    backgroundColor: 'transparent',
    color: 'var(--xp-text-secondary)',
    cursor: 'pointer',
    transition: 'background-color 0.15s, color 0.15s',
  };
  const btnActiveStyle: React.CSSProperties = {
    ...btnStyle,
    backgroundColor: 'var(--xp-blue)',
    color: '#fff',
    borderColor: 'var(--xp-blue)',
  };
  const navBtnStyle: React.CSSProperties = {
    ...btnStyle,
    padding: '3px 6px',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 16px',
        borderBottom: '1px solid var(--xp-border)',
        fontSize: 11,
        flexShrink: 0,
      }}
    >
      {/* View mode toggle */}
      <div style={{ display: 'flex', gap: 2 }}>
        <button
          style={viewMode === 'side-by-side' ? btnActiveStyle : btnStyle}
          onClick={() => onViewModeChange('side-by-side')}
          title="Side-by-side view"
        >
          <Columns style={{ width: 13, height: 13, marginRight: 4 }} />
          Side by Side
        </button>
        <button
          style={viewMode === 'unified' ? btnActiveStyle : btnStyle}
          onClick={() => onViewModeChange('unified')}
          title="Unified view"
        >
          <Rows style={{ width: 13, height: 13, marginRight: 4 }} />
          Unified
        </button>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Change navigation */}
      {hunks.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            style={{
              ...navBtnStyle,
              opacity: currentHunkIdx <= 0 ? 0.4 : 1,
              cursor: currentHunkIdx <= 0 ? 'default' : 'pointer',
            }}
            onClick={onPrev}
            disabled={currentHunkIdx <= 0}
            title="Previous change (Ctrl+Up)"
          >
            <ChevronsUp style={{ width: 13, height: 13 }} />
          </button>
          <span
            style={{
              padding: '2px 8px',
              fontSize: 10,
              color: 'var(--xp-text-secondary)',
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderRadius: 3,
              fontVariantNumeric: 'tabular-nums',
              minWidth: 60,
              textAlign: 'center',
            }}
          >
            Change {hunks.length > 0 ? currentHunkIdx + 1 : 0} of {hunks.length}
          </span>
          <button
            style={{
              ...navBtnStyle,
              opacity: currentHunkIdx >= hunks.length - 1 ? 0.4 : 1,
              cursor: currentHunkIdx >= hunks.length - 1 ? 'default' : 'pointer',
            }}
            onClick={onNext}
            disabled={currentHunkIdx >= hunks.length - 1}
            title="Next change (Ctrl+Down)"
          >
            <ChevronsDown style={{ width: 13, height: 13 }} />
          </button>
        </div>
      )}

      {/* Refresh */}
      <button style={navBtnStyle} onClick={onRefresh} title="Refresh comparison">
        <RefreshCw style={{ width: 13, height: 13 }} />
      </button>
    </div>
  );
};

// ─── File name bar ───────────────────────────────────────────────────────
interface FileNameBarProps {
  file1: { name: string; path: string; size: number };
  file2: { name: string; path: string; size: number };
  similarity: number;
  identical: boolean;
  onRefresh: () => void;
  formatSize: (b: number) => string;
  viewMode?: ViewMode;
}

export const FileNameBar = ({
  file1,
  file2,
  similarity: _similarity,
  identical: _identical,
  onRefresh: _onRefresh,
  formatSize,
  viewMode,
}: FileNameBarProps) => {
  if (viewMode === 'unified') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '5px 16px',
          borderBottom: '1px solid var(--xp-border)',
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        <FileIcon style={{ width: 14, height: 14, color: 'var(--xp-red)', flexShrink: 0 }} />
        <span style={{ color: 'var(--xp-text)', fontWeight: 500 }} title={file1.path}>
          {file1.name}
        </span>
        <span style={{ color: 'var(--xp-text-muted)' }}>{formatSize(file1.size)}</span>
        <span style={{ color: 'var(--xp-text-muted)', margin: '0 4px' }}>vs</span>
        <FileIcon style={{ width: 14, height: 14, color: 'var(--xp-green)', flexShrink: 0 }} />
        <span style={{ color: 'var(--xp-text)', fontWeight: 500 }} title={file2.path}>
          {file2.name}
        </span>
        <span style={{ color: 'var(--xp-text-muted)' }}>{formatSize(file2.size)}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--xp-border)',
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      {/* Left file */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 16px',
          borderRight: '1px solid var(--xp-border)',
          minWidth: 0,
        }}
      >
        <FileIcon style={{ width: 14, height: 14, color: 'var(--xp-red)', flexShrink: 0 }} />
        <span
          style={{
            color: 'var(--xp-text)',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={file1.path}
        >
          {file1.name}
        </span>
        <span style={{ color: 'var(--xp-text-muted)', flexShrink: 0, fontSize: 11 }}>
          {formatSize(file1.size)}
        </span>
      </div>
      {/* Right file */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 16px',
          minWidth: 0,
        }}
      >
        <FileIcon style={{ width: 14, height: 14, color: 'var(--xp-green)', flexShrink: 0 }} />
        <span
          style={{
            color: 'var(--xp-text)',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={file2.path}
        >
          {file2.name}
        </span>
        <span style={{ color: 'var(--xp-text-muted)', flexShrink: 0, fontSize: 11 }}>
          {formatSize(file2.size)}
        </span>
      </div>
    </div>
  );
};
