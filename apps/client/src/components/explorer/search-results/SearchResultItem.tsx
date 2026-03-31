import React from 'react';
import { formatFileSize, getFileIcon } from '@/lib/utils';
import type { FileEntry, SearchResult } from '@/lib/tauri-api';
import type { LiveSearchResult } from '@/hooks/use-live-search';

// ── Highlight helper ─────────────────────────────────────────────────────────

export const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;

  const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return text;

  // Build a regex that matches any of the query parts
  const escaped = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  const segments = text.split(regex);
  if (segments.length <= 1) return text;

  return segments.map((seg, i) => {
    const isMatch = parts.some((p) => seg.toLowerCase() === p);
    if (isMatch) {
      return (
        // eslint-disable-next-line react/no-array-index-key
        <span key={i} style={{ fontWeight: 700, color: 'var(--xp-blue)' }}>
          {seg}
        </span>
      );
    }
    // eslint-disable-next-line react/no-array-index-key
    return <span key={i}>{seg}</span>;
  });
};

// ── Result row component (local mode) ────────────────────────────────────────

interface ResultRowProps {
  item: LiveSearchResult;
  query: string;
  onNavigate: (parentDir: string, file: FileEntry) => void;
  onDoubleClick: (file: FileEntry) => void;
}

export const ResultRow = React.memo(
  ({ item, query, onNavigate, onDoubleClick }: ResultRowProps) => {
    const { file } = item;

    return (
      <div
        role="option"
        tabIndex={0}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '3px 8px 3px 24px',
          cursor: 'pointer',
          fontSize: '12px',
          lineHeight: '20px',
          gap: '6px',
          borderRadius: '4px',
          transition: 'background 0.1s',
        }}
        className="hover:bg-xp-surface-light text-xp-text"
        onClick={() => onNavigate(item.parentDir, file)}
        onDoubleClick={() => onDoubleClick(file)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onNavigate(item.parentDir, file);
          }
        }}
        title={file.path}
      >
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {getFileIcon(file)}
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {highlightMatch(file.name, query)}
        </span>
        {!file.is_dir && (
          <span
            style={{
              flexShrink: 0,
              fontSize: '10px',
              color: 'var(--xp-text-muted)',
              marginLeft: '4px',
            }}
          >
            {formatFileSize(file.size)}
          </span>
        )}
      </div>
    );
  },
);
ResultRow.displayName = 'ResultRow';

// ── AI result row component ──────────────────────────────────────────────────

interface AIResultRowProps {
  result: SearchResult;
  query: string;
  onSelect: (result: SearchResult) => void;
}

export const AIResultRow = React.memo(({ result, query, onSelect }: AIResultRowProps) => {
  const relevanceBadge = (() => {
    switch (result.relevance_type) {
      case 'exact':
        return { label: 'Exact', color: '#22c55e' };
      case 'semantic':
        return { label: 'Semantic', color: '#6366f1' };
      case 'fuzzy':
        return { label: 'Fuzzy', color: '#eab308' };
      case 'metadata':
        return { label: 'Meta', color: '#14b8a6' };
      case 'ai_description':
        return { label: 'AI', color: '#a855f7' };
      case 'ai_reranked':
        return { label: 'AI Ranked', color: '#a855f7' };
      default:
        return { label: result.relevance_type, color: '#6366f1' };
    }
  })();

  return (
    <div
      role="option"
      tabIndex={0}
      style={{
        padding: '6px 8px',
        cursor: 'pointer',
        fontSize: '12px',
        lineHeight: '18px',
        borderBottom: '1px solid var(--xp-border)',
        transition: 'background 0.1s',
      }}
      className="hover:bg-xp-surface-light text-xp-text"
      onClick={() => onSelect(result)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSelect(result);
        }
      }}
      title={result.path}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 500,
          }}
        >
          {highlightMatch(result.filename, query)}
        </span>
        <span
          style={{
            flexShrink: 0,
            fontSize: '9px',
            padding: '1px 5px',
            borderRadius: '8px',
            backgroundColor: `${relevanceBadge.color}20`,
            color: relevanceBadge.color,
            fontWeight: 600,
          }}
        >
          {relevanceBadge.label}
        </span>
        <span
          style={{
            flexShrink: 0,
            fontSize: '9px',
            padding: '1px 5px',
            borderRadius: '8px',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            color: 'var(--xp-blue)',
            fontWeight: 600,
          }}
        >
          {(result.score ?? 0).toFixed(1)}
        </span>
      </div>
      <div
        style={{
          fontSize: '10px',
          color: 'var(--xp-text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {result.path}
      </div>
      {result.snippet && (
        <div
          style={{
            fontSize: '10px',
            color: 'var(--xp-text-secondary)',
            marginTop: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontStyle: 'italic',
            opacity: 0.8,
          }}
        >
          {result.snippet}
        </div>
      )}
      {result.matches && result.matches.length > 0 && (
        <div style={{ marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {result.matches.slice(0, 3).map((match) => (
            <span
              key={match.token}
              style={{
                fontSize: '9px',
                padding: '0 4px',
                borderRadius: '3px',
                backgroundColor: 'rgba(250, 204, 21, 0.15)',
                color: 'var(--xp-text-muted)',
              }}
            >
              {match.token}
              {match.context && match.context !== 'Filename match' ? ` - ${match.context}` : ''}
            </span>
          ))}
          {result.matches.length > 3 && (
            <span style={{ fontSize: '9px', color: 'var(--xp-text-muted)' }}>
              +{result.matches.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
AIResultRow.displayName = 'AIResultRow';

// ── Group header component ───────────────────────────────────────────────────

interface GroupHeaderProps {
  parentDir: string;
  basePath: string;
}

export const GroupHeader = React.memo(({ parentDir, basePath }: GroupHeaderProps) => {
  // Show relative path from basePath
  let display = parentDir;
  if (display.startsWith(basePath)) {
    display = display.slice(basePath.length);
    if (display.startsWith('/') || display.startsWith('\\')) {
      display = display.slice(1);
    }
  }
  if (!display) display = '.';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 8px',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.03em',
        gap: '4px',
        marginTop: '4px',
        color: 'var(--xp-text-muted)',
      }}
    >
      {/* Folder icon inline SVG */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, opacity: 0.7 }}
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {display}
      </span>
    </div>
  );
});
GroupHeader.displayName = 'GroupHeader';

// ── Spinner subcomponent ─────────────────────────────────────────────────────

export const Spinner = () => {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        animation: 'spin 1s linear infinite',
        flexShrink: 0,
      }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
};
