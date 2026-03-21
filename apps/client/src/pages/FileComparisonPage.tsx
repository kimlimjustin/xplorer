import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { convertAssetUrl } from '@/lib/transport';
import {
  FileComparison,
  type FileComparisonResult,
  type ComparisonOptions,
  type SideBySideLine,
} from '@/lib/file-comparison';
import {
  RefreshCw,
  AlertTriangle,
  FileIcon,
  ChevronDown,
  Columns,
  Rows,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react';
import {
  getLanguageFromPath,
  tokenizeLine,
  detectHunks,
  buildSegments,
  type DiffHunk,
  type DiffSegment,
  type ViewMode,
  type FileComparisonPageProps,
} from './file-comparison-helpers';

// ─── Main component ────────────────────────────────────────────────────────
const FileComparisonPage = ({ file1Path, file2Path, onError }: FileComparisonPageProps) => {
  const [result, setResult] = useState<FileComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [currentHunkIdx, setCurrentHunkIdx] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const unifiedRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  // ─── Comparison ────────────────────────────────────────────────────
  useEffect(() => {
    if (file1Path && file2Path) {
      runComparison();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file1Path, file2Path]);

  const runComparison = async () => {
    setLoading(true);
    setExpandedSections(new Set());
    setCurrentHunkIdx(0);
    try {
      const options: ComparisonOptions = {
        ignoreWhitespace: false,
        ignoreCase: false,
        ignoreLineEndings: true,
        algorithm: 'myers',
        maxFileSize: 50 * 1024 * 1024,
      };
      const r = await FileComparison.compareFiles(file1Path, file2Path, options);
      setResult(r);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Comparison failed';
      onError?.(msg);
      console.error('File comparison error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Derived data ──────────────────────────────────────────────────
  const diffLines: SideBySideLine[] = useMemo(() => {
    if (!result) return [];
    const { identical, file1, sideBySide } = result;
    if (identical && file1.lines) {
      return file1.lines.map((line, i) => ({
        type: 'unchanged' as const,
        lineLeft: i + 1,
        lineRight: i + 1,
        contentLeft: line,
        contentRight: line,
      }));
    }
    return sideBySide?.lines ?? [];
  }, [result]);

  const hunks = useMemo(() => detectHunks(diffLines), [diffLines]);
  const language = useMemo(() => getLanguageFromPath(file1Path), [file1Path]);

  const segments = useMemo(() => {
    const base = buildSegments(diffLines);
    // Expand sections that are toggled
    return base.map((seg, idx) => {
      if (seg.kind === 'collapsed' && expandedSections.has(idx)) {
        return { kind: 'lines' as const, lines: seg.lines };
      }
      return seg;
    });
  }, [diffLines, expandedSections]);

  // ─── Synchronized scrolling ────────────────────────────────────────
  const handleScroll = useCallback((source: 'left' | 'right') => {
    if (syncing.current) return;
    syncing.current = true;
    const from = source === 'left' ? leftRef.current : rightRef.current;
    const to = source === 'left' ? rightRef.current : leftRef.current;
    if (from && to) {
      to.scrollTop = from.scrollTop;
      to.scrollLeft = from.scrollLeft;
    }
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }, []);

  // ─── Navigation helpers ────────────────────────────────────────────
  const scrollToHunk = useCallback(
    (hunkIdx: number) => {
      if (hunkIdx < 0 || hunkIdx >= hunks.length) return;
      setCurrentHunkIdx(hunkIdx);
      const hunk = hunks[hunkIdx];
      const dataIdx = hunk.startIndex;

      // Find the DOM element with matching data-diff-idx
      const container = viewMode === 'unified' ? unifiedRef.current : leftRef.current;
      if (!container) return;
      const el = container.querySelector(`[data-diff-idx="${dataIdx}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    [hunks, viewMode],
  );

  const goNextHunk = useCallback(() => {
    const next = Math.min(currentHunkIdx + 1, hunks.length - 1);
    scrollToHunk(next);
  }, [currentHunkIdx, hunks.length, scrollToHunk]);

  const goPrevHunk = useCallback(() => {
    const prev = Math.max(currentHunkIdx - 1, 0);
    scrollToHunk(prev);
  }, [currentHunkIdx, scrollToHunk]);

  // ─── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'ArrowDown') {
        e.preventDefault();
        goNextHunk();
      } else if (e.ctrlKey && e.key === 'ArrowUp') {
        e.preventDefault();
        goPrevHunk();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNextHunk, goPrevHunk]);

  // ─── Utility ───────────────────────────────────────────────────────
  const formatSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let i = 0;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
  };

  const toggleSection = (segIdx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(segIdx)) next.delete(segIdx);
      else next.add(segIdx);
      return next;
    });
  };

  // ─── Loading state ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--xp-surface)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <RefreshCw
            style={{
              width: 24,
              height: 24,
              color: 'var(--xp-blue)',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div style={{ fontSize: 13, color: 'var(--xp-text)' }}>Comparing files...</div>
        </div>
      </div>
    );
  }

  // ─── Error / no result ─────────────────────────────────────────────
  if (!result) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--xp-surface)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <AlertTriangle
            style={{
              width: 40,
              height: 40,
              margin: '0 auto 12px',
              color: 'var(--xp-text-secondary)',
            }}
          />
          <div style={{ fontSize: 13, color: 'var(--xp-text)', marginBottom: 12 }}>
            Comparison failed
          </div>
          <button
            onClick={runComparison}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              borderRadius: 4,
              backgroundColor: 'var(--xp-blue)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { file1, file2, identical, similarity, comparisonType, metadata } = result;

  // ─── Image comparison ──────────────────────────────────────────────
  if (comparisonType === 'image') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--xp-surface)',
          overflow: 'hidden',
        }}
      >
        <StatsHeader
          file1={file1}
          file2={file2}
          metadata={metadata}
          identical={identical}
          similarity={similarity}
          formatSize={formatSize}
        />
        <FileNameBar
          file1={file1}
          file2={file2}
          similarity={similarity}
          identical={identical}
          onRefresh={runComparison}
          formatSize={formatSize}
        />
        <div
          style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}
        >
          {[file1, file2].map((file, i) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                overflow: 'auto',
                borderRight: i === 0 ? '1px solid var(--xp-border)' : undefined,
              }}
            >
              <img
                src={convertAssetUrl(file.path)}
                alt={file.name}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Video comparison ──────────────────────────────────────────────
  if (comparisonType === 'video') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--xp-surface)',
          overflow: 'hidden',
        }}
      >
        <StatsHeader
          file1={file1}
          file2={file2}
          metadata={metadata}
          identical={identical}
          similarity={similarity}
          formatSize={formatSize}
        />
        <FileNameBar
          file1={file1}
          file2={file2}
          similarity={similarity}
          identical={identical}
          onRefresh={runComparison}
          formatSize={formatSize}
        />
        <div
          style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}
        >
          {[file1, file2].map((file, i) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                overflow: 'auto',
                borderRight: i === 0 ? '1px solid var(--xp-border)' : undefined,
              }}
            >
              <video
                src={convertAssetUrl(file.path)}
                controls
                style={{ maxWidth: '100%', maxHeight: '100%' }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Text diff ─────────────────────────────────────────────────────
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--xp-surface)',
        overflow: 'hidden',
      }}
    >
      {/* Statistics header */}
      <StatsHeader
        file1={file1}
        file2={file2}
        metadata={metadata}
        identical={identical}
        similarity={similarity}
        formatSize={formatSize}
      />

      {/* Toolbar: view mode toggle + navigation */}
      <DiffToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        hunks={hunks}
        currentHunkIdx={currentHunkIdx}
        onNext={goNextHunk}
        onPrev={goPrevHunk}
        onRefresh={runComparison}
      />

      {/* File name bar */}
      <FileNameBar
        file1={file1}
        file2={file2}
        similarity={similarity}
        identical={identical}
        onRefresh={runComparison}
        formatSize={formatSize}
        viewMode={viewMode}
      />

      {/* Diff body */}
      {viewMode === 'side-by-side' ? (
        <SideBySideView
          segments={segments}
          language={language}
          leftRef={leftRef}
          rightRef={rightRef}
          onScroll={handleScroll}
          onToggleSection={toggleSection}
        />
      ) : (
        <UnifiedView
          segments={segments}
          language={language}
          unifiedRef={unifiedRef}
          onToggleSection={toggleSection}
        />
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '5px 16px',
          borderTop: '1px solid var(--xp-border)',
          fontSize: 10,
          color: 'var(--xp-text-secondary)',
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'var(--xp-green)' }}>+{metadata.linesAdded}</span>
        <span style={{ color: 'var(--xp-red)' }}>-{metadata.linesRemoved}</span>
        <span>
          {metadata.totalLines1} / {metadata.totalLines2} lines
        </span>
        <span>
          {hunks.length} change{hunks.length !== 1 ? 's' : ''}
        </span>
        <span style={{ marginLeft: 'auto' }}>{metadata.processingTime}ms</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

// ─── Statistics header ───────────────────────────────────────────────────
const StatsHeader = ({
  file1,
  file2,
  metadata,
  identical,
  similarity,
  formatSize,
}: {
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
}) => {
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
const DiffToolbar = ({
  viewMode,
  onViewModeChange,
  hunks,
  currentHunkIdx,
  onNext,
  onPrev,
  onRefresh,
}: {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  hunks: DiffHunk[];
  currentHunkIdx: number;
  onNext: () => void;
  onPrev: () => void;
  onRefresh: () => void;
}) => {
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
const FileNameBar = ({
  file1,
  file2,
  similarity: _similarity,
  identical: _identical,
  onRefresh: _onRefresh,
  formatSize,
  viewMode,
}: {
  file1: { name: string; path: string; size: number };
  file2: { name: string; path: string; size: number };
  similarity: number;
  identical: boolean;
  onRefresh: () => void;
  formatSize: (b: number) => string;
  viewMode?: ViewMode;
}) => {
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

// ─── Side-by-side view ───────────────────────────────────────────────────
const SideBySideView = ({
  segments,
  language,
  leftRef,
  rightRef,
  onScroll,
  onToggleSection,
}: {
  segments: DiffSegment[];
  language: string;
  leftRef: React.RefObject<HTMLDivElement>;
  rightRef: React.RefObject<HTMLDivElement>;
  onScroll: (source: 'left' | 'right') => void;
  onToggleSection: (idx: number) => void;
}) => {
  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      {/* Left */}
      <div
        ref={leftRef as React.RefObject<HTMLDivElement>}
        style={{ overflow: 'auto', borderRight: '1px solid var(--xp-border)' }}
        onScroll={() => onScroll('left')}
      >
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: '20px',
            minWidth: 'max-content',
          }}
        >
          {segments.map((seg, segIdx) =>
            seg.kind === 'collapsed' ? (
              <CollapsedSection
                // eslint-disable-next-line react/no-array-index-key
                key={`c-${segIdx}`}
                count={seg.count}
                onExpand={() => onToggleSection(segIdx)}
              />
            ) : (
              seg.lines.map(({ line, originalIndex }) => (
                <DiffRowEnhanced
                  key={`l-${originalIndex}`}
                  row={line}
                  side="left"
                  language={language}
                  dataIdx={originalIndex}
                />
              ))
            ),
          )}
        </div>
      </div>
      {/* Right */}
      <div
        ref={rightRef as React.RefObject<HTMLDivElement>}
        style={{ overflow: 'auto' }}
        onScroll={() => onScroll('right')}
      >
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: '20px',
            minWidth: 'max-content',
          }}
        >
          {segments.map((seg, segIdx) =>
            seg.kind === 'collapsed' ? (
              <CollapsedSection
                // eslint-disable-next-line react/no-array-index-key
                key={`c-${segIdx}`}
                count={seg.count}
                onExpand={() => onToggleSection(segIdx)}
              />
            ) : (
              seg.lines.map(({ line, originalIndex }) => (
                <DiffRowEnhanced
                  key={`r-${originalIndex}`}
                  row={line}
                  side="right"
                  language={language}
                  dataIdx={originalIndex}
                />
              ))
            ),
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Unified view ────────────────────────────────────────────────────────
const UnifiedView = ({
  segments,
  language,
  unifiedRef,
  onToggleSection,
}: {
  segments: DiffSegment[];
  language: string;
  unifiedRef: React.RefObject<HTMLDivElement>;
  onToggleSection: (idx: number) => void;
}) => {
  return (
    <div
      ref={unifiedRef as React.RefObject<HTMLDivElement>}
      style={{ flex: 1, overflow: 'auto', minHeight: 0 }}
    >
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 12,
          lineHeight: '20px',
          minWidth: 'max-content',
        }}
      >
        {segments.map((seg, segIdx) =>
          seg.kind === 'collapsed' ? (
            <CollapsedSection
              // eslint-disable-next-line react/no-array-index-key
              key={`c-${segIdx}`}
              count={seg.count}
              onExpand={() => onToggleSection(segIdx)}
            />
          ) : (
            seg.lines.map(({ line, originalIndex }) => (
              <UnifiedDiffRow
                key={`u-${originalIndex}`}
                row={line}
                language={language}
                dataIdx={originalIndex}
              />
            ))
          ),
        )}
      </div>
    </div>
  );
};

// ─── Enhanced diff row (side-by-side) ────────────────────────────────────
const DiffRowEnhanced = ({
  row,
  side,
  language,
  dataIdx,
}: {
  row: SideBySideLine;
  side: 'left' | 'right';
  language: string;
  dataIdx: number;
}) => {
  const lineNum = side === 'left' ? row.lineLeft : row.lineRight;
  const content = side === 'left' ? row.contentLeft : row.contentRight;
  const isPadding = lineNum === undefined;

  // Background color
  let bgColor = 'transparent';
  let gutterBg = 'transparent';
  let gutterMarker = ' ';
  let gutterColor = 'var(--xp-text-muted)';

  if (row.type === 'removed') {
    if (side === 'left') {
      bgColor = 'rgba(248, 113, 113, 0.08)';
      gutterBg = 'rgba(248, 113, 113, 0.15)';
      gutterMarker = '-';
      gutterColor = 'var(--xp-red)';
    } else {
      bgColor = 'rgba(255, 255, 255, 0.02)';
    }
  } else if (row.type === 'added') {
    if (side === 'right') {
      bgColor = 'rgba(52, 211, 153, 0.08)';
      gutterBg = 'rgba(52, 211, 153, 0.15)';
      gutterMarker = '+';
      gutterColor = 'var(--xp-green)';
    } else {
      bgColor = 'rgba(255, 255, 255, 0.02)';
    }
  }

  // Syntax highlighting tokens
  const tokens = useMemo(() => {
    if (isPadding || !content) return [{ text: content || '', color: 'var(--xp-text)' }];
    return tokenizeLine(content, language);
  }, [content, language, isPadding]);

  return (
    <div
      data-diff-idx={dataIdx}
      style={{
        display: 'flex',
        backgroundColor: bgColor,
        minHeight: 20,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.filter = 'brightness(1.15)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.filter = '';
      }}
    >
      {/* Line number gutter */}
      <span
        style={{
          width: 48,
          flexShrink: 0,
          textAlign: 'right',
          paddingRight: 8,
          userSelect: 'none',
          color: gutterColor,
          backgroundColor: gutterBg,
          opacity: isPadding ? 0 : 1,
          fontSize: 11,
        }}
      >
        {isPadding ? '' : lineNum}
      </span>
      {/* Marker gutter */}
      <span
        style={{
          width: 18,
          flexShrink: 0,
          textAlign: 'center',
          userSelect: 'none',
          color: gutterColor,
          fontWeight: 700,
          backgroundColor: gutterBg,
        }}
      >
        {isPadding ? '' : gutterMarker}
      </span>
      {/* Content with syntax highlighting */}
      <span style={{ flex: 1, whiteSpace: 'pre', paddingRight: 16 }}>
        {tokens.map((t, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={i} style={{ color: t.color }}>
            {t.text}
          </span>
        ))}
      </span>
    </div>
  );
};

// ─── Unified diff row ────────────────────────────────────────────────────
const UnifiedDiffRow = ({
  row,
  language,
  dataIdx,
}: {
  row: SideBySideLine;
  language: string;
  dataIdx: number;
}) => {
  let bgColor = 'transparent';
  let gutterBg = 'transparent';
  let marker = ' ';
  let markerColor = 'var(--xp-text-muted)';
  let content = '';

  if (row.type === 'removed') {
    bgColor = 'rgba(248, 113, 113, 0.08)';
    gutterBg = 'rgba(248, 113, 113, 0.15)';
    marker = '-';
    markerColor = 'var(--xp-red)';
    content = row.contentLeft;
  } else if (row.type === 'added') {
    bgColor = 'rgba(52, 211, 153, 0.08)';
    gutterBg = 'rgba(52, 211, 153, 0.15)';
    marker = '+';
    markerColor = 'var(--xp-green)';
    content = row.contentRight;
  } else {
    content = row.contentLeft || row.contentRight;
  }

  const tokens = useMemo(() => tokenizeLine(content, language), [content, language]);

  return (
    <div
      data-diff-idx={dataIdx}
      style={{ display: 'flex', backgroundColor: bgColor, minHeight: 20 }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.filter = 'brightness(1.15)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.filter = '';
      }}
    >
      {/* Left line number */}
      <span
        style={{
          width: 48,
          flexShrink: 0,
          textAlign: 'right',
          paddingRight: 4,
          userSelect: 'none',
          color: 'var(--xp-text-muted)',
          backgroundColor: gutterBg,
          fontSize: 11,
          opacity: row.lineLeft != null ? 1 : 0.3,
        }}
      >
        {row.lineLeft ?? ''}
      </span>
      {/* Right line number */}
      <span
        style={{
          width: 48,
          flexShrink: 0,
          textAlign: 'right',
          paddingRight: 8,
          userSelect: 'none',
          color: 'var(--xp-text-muted)',
          backgroundColor: gutterBg,
          fontSize: 11,
          opacity: row.lineRight != null ? 1 : 0.3,
        }}
      >
        {row.lineRight ?? ''}
      </span>
      {/* Marker */}
      <span
        style={{
          width: 18,
          flexShrink: 0,
          textAlign: 'center',
          userSelect: 'none',
          color: markerColor,
          fontWeight: 700,
          backgroundColor: gutterBg,
        }}
      >
        {marker}
      </span>
      {/* Content */}
      <span style={{ flex: 1, whiteSpace: 'pre', paddingRight: 16 }}>
        {tokens.map((t, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={i} style={{ color: t.color }}>
            {t.text}
          </span>
        ))}
      </span>
    </div>
  );
};

// ─── Collapsed section ───────────────────────────────────────────────────
const CollapsedSection = ({ count, onExpand }: { count: number; onExpand: () => void }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 0',
        minHeight: 24,
        cursor: 'pointer',
        backgroundColor: 'rgba(99, 102, 241, 0.06)',
        borderTop: '1px solid rgba(99, 102, 241, 0.15)',
        borderBottom: '1px solid rgba(99, 102, 241, 0.15)',
        transition: 'background-color 0.15s',
      }}
      onClick={onExpand}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(99, 102, 241, 0.12)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(99, 102, 241, 0.06)';
      }}
      title={`Click to expand ${count} unchanged lines`}
    >
      <ChevronDown style={{ width: 12, height: 12, color: 'var(--xp-blue)', marginRight: 6 }} />
      <span style={{ fontSize: 11, color: 'var(--xp-blue)', userSelect: 'none' }}>
        Show {count} unchanged line{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
};

export default FileComparisonPage;
