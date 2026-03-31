import React, { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SideBySideLine } from '@/lib/file-comparison';
import { tokenizeLine, type DiffSegment } from '@/pages/file-comparison-helpers';

// ─── Side-by-side view ───────────────────────────────────────────────────
interface SideBySideViewProps {
  segments: DiffSegment[];
  language: string;
  leftRef: React.RefObject<HTMLDivElement>;
  rightRef: React.RefObject<HTMLDivElement>;
  onScroll: (source: 'left' | 'right') => void;
  onToggleSection: (idx: number) => void;
}

export const SideBySideView = ({
  segments,
  language,
  leftRef,
  rightRef,
  onScroll,
  onToggleSection,
}: SideBySideViewProps) => {
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
interface UnifiedViewProps {
  segments: DiffSegment[];
  language: string;
  unifiedRef: React.RefObject<HTMLDivElement>;
  onToggleSection: (idx: number) => void;
}

export const UnifiedView = ({
  segments,
  language,
  unifiedRef,
  onToggleSection,
}: UnifiedViewProps) => {
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
