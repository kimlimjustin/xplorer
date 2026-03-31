import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { convertAssetUrl } from '@/lib/transport';
import {
  FileComparison,
  type FileComparisonResult,
  type ComparisonOptions,
  type SideBySideLine,
} from '@/lib/file-comparison';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import {
  getLanguageFromPath,
  detectHunks,
  buildSegments,
  type ViewMode,
  type FileComparisonPageProps,
} from './file-comparison-helpers';
import { formatFileSize } from '@/lib/utils';
import { StatsHeader, DiffToolbar, FileNameBar } from '@/components/comparison/ComparisonToolbar';
import { SideBySideView, UnifiedView } from '@/components/comparison/ComparisonViewer';

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
  const formatSize = formatFileSize;

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

export default FileComparisonPage;
