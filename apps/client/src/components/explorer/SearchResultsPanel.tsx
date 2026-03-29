import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useLiveSearch,
  type SearchFilterType,
  type LiveSearchResult,
} from '@/hooks/use-live-search';
import { formatFileSize, getFileIcon } from '@/lib/utils';
import { TauriAPI, type FileEntry, type SearchResult } from '@/lib/tauri-api';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';

// ── Types ────────────────────────────────────────────────────────────────────

export type SearchMode = 'local' | 'ai';

interface SearchResultsPanelProps {
  basePath: string;
  navigateToPath: (path: string) => void;
  onFileSelect: (file: FileEntry) => void;
  onFileOpen?: (file: FileEntry) => void;
  width?: number;
}

export interface SearchResultsPanelHandle {
  focus: () => void;
}

// ── Filter chips ─────────────────────────────────────────────────────────────

const FILTERS: { key: SearchFilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'files', label: 'Files' },
  { key: 'folders', label: 'Folders' },
  { key: 'documents', label: 'Documents' },
  { key: 'images', label: 'Images' },
  { key: 'code', label: 'Code' },
];

// ── Highlight helper ─────────────────────────────────────────────────────────

const highlightMatch = (text: string, query: string): React.ReactNode => {
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

const ResultRow = React.memo(({ item, query, onNavigate, onDoubleClick }: ResultRowProps) => {
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
});
ResultRow.displayName = 'ResultRow';

// ── AI result row component ──────────────────────────────────────────────────

interface AIResultRowProps {
  result: SearchResult;
  query: string;
  onSelect: (result: SearchResult) => void;
}

const AIResultRow = React.memo(({ result, query, onSelect }: AIResultRowProps) => {
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

const GroupHeader = React.memo(({ parentDir, basePath }: GroupHeaderProps) => {
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

// ── Filter words that trigger enhanced NL search ─────────────────────────────

const FILTER_INDICATORS = [
  'large',
  'largest',
  'big',
  'biggest',
  'huge',
  'small',
  'smallest',
  'tiny',
  'heavy',
  'heaviest',
  'light',
  'lightest',
  'today',
  'yesterday',
  'recent',
  'recently',
  'newest',
  'latest',
  'oldest',
  'new',
  'last week',
  'last month',
  'this week',
  'this month',
  'this year',
  'old',
  'videos',
  'video',
  'movies',
  'images',
  'image',
  'photos',
  'photo',
  'picture',
  'pictures',
  'documents',
  'document',
  'docs',
  'pdfs',
  'spreadsheets',
  'presentations',
  'code',
  'scripts',
  'source code',
  'audio',
  'music',
  'songs',
  'archives',
  'compressed',
  'zips',
];

const shouldUseEnhancedSearch = (query: string): boolean => {
  const words = query.trim().split(/\s+/);
  if (words.length >= 3) return true;
  const lower = query.toLowerCase();
  return FILTER_INDICATORS.some((indicator) => lower.includes(indicator));
};

// ── Main component ───────────────────────────────────────────────────────────

const SearchResultsPanel = React.forwardRef<SearchResultsPanelHandle, SearchResultsPanelProps>(
  function SearchResultsPanel({ basePath, navigateToPath, onFileSelect, onFileOpen, width }, ref) {
    const [searchMode, setSearchMode] = useState<SearchMode>('local');

    // ── Local search ────────────────────────────────────────────────────────
    const {
      query: localQuery,
      setQuery: setLocalQuery,
      groupedResults,
      isSearching: isLocalSearching,
      resultCount: localResultCount,
      totalResultCount: localTotalResultCount,
      folderCount,
      activeFilter,
      setActiveFilter,
      hasMore,
      showMore,
      clearSearch: clearLocalSearch,
    } = useLiveSearch(basePath);

    // ── AI search state ──────────────────────────────────────────────────────
    const [aiQuery, setAiQuery] = useState('');
    const [aiResults, setAiResults] = useState<SearchResult[]>([]);
    const [isAiSearching, setIsAiSearching] = useState(false);
    const [aiParsedInfo, setAiParsedInfo] = useState<string | null>(null);
    const aiAbortRef = useRef<{ aborted: boolean }>({ aborted: false });
    const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Expose focus method via ref
    React.useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
    }));

    // Unified query getter/setter based on mode
    const query = searchMode === 'local' ? localQuery : aiQuery;
    const setQuery = searchMode === 'local' ? setLocalQuery : setAiQuery;
    const isSearching = searchMode === 'local' ? isLocalSearching : isAiSearching;

    // ── AI search effect ─────────────────────────────────────────────────────
    useEffect(() => {
      if (searchMode !== 'ai') return;

      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
      aiAbortRef.current.aborted = true;

      const trimmed = aiQuery.trim();
      if (!trimmed) {
        setAiResults([]);
        setIsAiSearching(false);
        setAiParsedInfo(null);
        return;
      }

      setIsAiSearching(true);

      aiDebounceRef.current = setTimeout(async () => {
        const signal = { aborted: false };
        aiAbortRef.current = signal;

        try {
          let results: SearchResult[] = [];
          let info: string | null = null;

          // Try enhanced search (BM25F + structured query) first
          if (shouldUseEnhancedSearch(trimmed)) {
            try {
              const enhanced = await TauriAPI.enhancedSearch(trimmed, undefined, 50);
              if (!signal.aborted) {
                results = enhanced.results;
                const pq = enhanced.parsed_query;
                if (pq) {
                  const parts: string[] = [];
                  if (pq.file_type_filter) parts.push(`type: ${pq.file_type_filter}`);
                  if (pq.sort_hint) parts.push(`sort: ${pq.sort_hint}`);
                  if (pq.keywords?.length) parts.push(`"${pq.keywords.join(' ')}"`);
                  info = parts.length > 0 ? parts.join(' | ') : null;
                }
              }
            } catch {
              // Enhanced search unavailable, try semantic
            }
          }

          // If enhanced search returned nothing, try indexed search
          if (results.length === 0 && !signal.aborted) {
            try {
              const tokenResults = await TauriAPI.searchTokens(trimmed, 50);
              if (!signal.aborted) {
                results = tokenResults;
                info = 'Indexed search (BM25F)';
              }
            } catch {
              // Index not available
            }
          }

          // If still nothing, try semantic search as final fallback
          if (results.length === 0 && !signal.aborted) {
            try {
              const semanticResults = await TauriAPI.semanticSearch(trimmed, 50);
              if (!signal.aborted) {
                results = semanticResults;
                info = 'Semantic search (embeddings)';
              }
            } catch {
              // Semantic search unavailable (Ollama not running, etc.)
            }
          }

          if (!signal.aborted) {
            setAiResults(results);
            setAiParsedInfo(info);
            setIsAiSearching(false);
          }
        } catch (err) {
          if (!signal.aborted) {
            console.error('AI search error:', err);
            setAiResults([]);
            setIsAiSearching(false);
          }
        }
      }, SEARCH_DEBOUNCE_MS);

      return () => {
        if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
        aiAbortRef.current.aborted = true;
      };
    }, [aiQuery, searchMode]);

    // Build a flat list of renderable items for virtualization (local mode):
    type FlatItem =
      | { type: 'group-header'; parentDir: string }
      | { type: 'result'; item: LiveSearchResult };

    const flatItems: FlatItem[] = useMemo(() => {
      const items: FlatItem[] = [];
      for (const group of groupedResults) {
        items.push({ type: 'group-header', parentDir: group.parentDir });
        for (const item of group.items) {
          items.push({ type: 'result', item });
        }
      }
      return items;
    }, [groupedResults]);

    // Virtualizer (local mode only)
    const virtualizer = useVirtualizer({
      count: searchMode === 'local' ? flatItems.length + (hasMore ? 1 : 0) : 0,
      getScrollElement: () => scrollContainerRef.current,
      estimateSize: (index: number) => {
        if (index >= flatItems.length) return 32;
        const item = flatItems[index];
        return item.type === 'group-header' ? 28 : 26;
      },
      overscan: 10,
    });

    // Focus input on mount
    useEffect(() => {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }, []);

    // Handle navigating to a file's parent and selecting it (local mode)
    const handleNavigateToResult = useCallback(
      (parentDir: string, file: FileEntry) => {
        navigateToPath(parentDir);
        onFileSelect(file);
      },
      [navigateToPath, onFileSelect],
    );

    // Handle double-click to open file
    const handleDoubleClickResult = useCallback(
      (file: FileEntry) => {
        if (onFileOpen) {
          onFileOpen(file);
        }
      },
      [onFileOpen],
    );

    // Handle AI result selection
    const handleAiResultSelect = useCallback(
      (result: SearchResult) => {
        // Navigate to parent directory and select file
        const sep = result.path.includes('/') ? '/' : '\\';
        const parts = result.path.split(sep);
        parts.pop();
        const parentDir = parts.join(sep);
        const hasExt = result.filename.includes('.') && !result.filename.startsWith('.');

        navigateToPath(parentDir || basePath);

        // Create a synthetic FileEntry for selection
        const syntheticFile: FileEntry = {
          name: result.filename,
          path: result.path,
          size: 0,
          modified: 0,
          is_dir: !hasExt,
          file_type: hasExt ? result.filename.split('.').pop() || '' : 'folder',
          is_readonly: false,
        };
        onFileSelect(syntheticFile);
      },
      [navigateToPath, onFileSelect, basePath],
    );

    // Clear search for current mode
    const clearSearch = useCallback(() => {
      if (searchMode === 'local') {
        clearLocalSearch();
      } else {
        setAiQuery('');
        setAiResults([]);
        setIsAiSearching(false);
        setAiParsedInfo(null);
      }
    }, [searchMode, clearLocalSearch]);

    // Keyboard navigation
    const handleInputKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (searchMode === 'local') {
            for (const flatItem of flatItems) {
              if (flatItem.type === 'result') {
                handleNavigateToResult(flatItem.item.parentDir, flatItem.item.file);
                break;
              }
            }
          } else if (aiResults.length > 0) {
            handleAiResultSelect(aiResults[0]);
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const firstResultEl = scrollContainerRef.current?.querySelector(
            '[role="option"]',
          ) as HTMLElement;
          if (firstResultEl) {
            firstResultEl.focus();
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          clearSearch();
        }
      },
      [searchMode, flatItems, aiResults, handleNavigateToResult, handleAiResultSelect, clearSearch],
    );

    const noQuery = !query.trim();
    const resultCount = searchMode === 'local' ? localResultCount : aiResults.length;
    const noResults = !noQuery && !isSearching && resultCount === 0;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: width ?? '100%',
          overflow: 'hidden',
        }}
      >
        {/* Search mode toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 8px',
            borderBottom: '1px solid var(--xp-border)',
            gap: '4px',
          }}
        >
          <button
            onClick={() => setSearchMode('local')}
            style={{
              flex: 1,
              padding: '3px 0',
              fontSize: '10px',
              fontWeight: searchMode === 'local' ? 600 : 400,
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: searchMode === 'local' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: searchMode === 'local' ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            aria-pressed={searchMode === 'local'}
            title="Search files by name in the current directory tree"
          >
            {/* Folder icon */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Local
          </button>
          <button
            onClick={() => setSearchMode('ai')}
            style={{
              flex: 1,
              padding: '3px 0',
              fontSize: '10px',
              fontWeight: searchMode === 'ai' ? 600 : 400,
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: searchMode === 'ai' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
              color: searchMode === 'ai' ? '#a855f7' : 'var(--xp-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            aria-pressed={searchMode === 'ai'}
            title="AI-powered search: natural language queries, content search, semantic matching"
          >
            {/* Sparkles icon */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              <path d="M5 3v4" />
              <path d="M19 17v4" />
              <path d="M3 5h4" />
              <path d="M17 19h4" />
            </svg>
            AI Search
          </button>
        </div>

        {/* Search input */}
        <div style={{ padding: '8px', borderBottom: '1px solid var(--xp-border)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--xp-surface-light)',
              borderRadius: '6px',
              padding: '0 8px',
              gap: '6px',
              border: `1px solid ${searchMode === 'ai' ? 'rgba(168, 85, 247, 0.3)' : 'var(--xp-border)'}`,
            }}
          >
            {/* Search icon */}
            {searchMode === 'local' ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--xp-text-muted)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#a855f7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            )}

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={
                searchMode === 'local'
                  ? 'Search files and folders...'
                  : 'Natural language search...'
              }
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '6px 0',
                fontSize: '12px',
                color: 'var(--xp-text)',
                lineHeight: '18px',
              }}
              aria-label={searchMode === 'local' ? 'Search files and folders' : 'AI search'}
            />

            {/* Searching spinner */}
            {isSearching && <Spinner />}

            {/* Clear button */}
            {query && (
              <button
                onClick={clearSearch}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--xp-text-muted)',
                  borderRadius: '3px',
                  transition: 'color 0.15s',
                }}
                className="hover:text-xp-text"
                aria-label="Clear search"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filter chips (local mode only) */}
        {searchMode === 'local' && (
          <div
            style={{
              display: 'flex',
              gap: '4px',
              padding: '6px 8px',
              borderBottom: '1px solid var(--xp-border)',
              flexWrap: 'wrap',
            }}
          >
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                style={{
                  padding: '2px 8px',
                  fontSize: '10px',
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: activeFilter === key ? 'var(--xp-blue)' : 'var(--xp-border)',
                  background:
                    activeFilter === key
                      ? 'rgba(var(--xp-blue-rgb, 99, 102, 241), 0.15)'
                      : 'transparent',
                  color: activeFilter === key ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontWeight: activeFilter === key ? 600 : 400,
                  lineHeight: '18px',
                }}
                aria-pressed={activeFilter === key}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* AI search info */}
        {searchMode === 'ai' && !noQuery && (
          <div
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              color: 'var(--xp-text-muted)',
              borderBottom: '1px solid var(--xp-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {(() => {
              if (isAiSearching) {
                return (
                  <>
                    <Spinner />
                    <span>Searching with AI...</span>
                  </>
                );
              }
              if (noResults) {
                return <span>No results for &apos;{query}&apos;</span>;
              }
              if (aiResults.length > 0) {
                return (
                  <span>
                    {aiResults.length} result{aiResults.length !== 1 ? 's' : ''}
                    {aiParsedInfo && (
                      <span style={{ marginLeft: '4px', opacity: 0.7 }}>({aiParsedInfo})</span>
                    )}
                  </span>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* Result count / status (local mode) */}
        {searchMode === 'local' && !noQuery && (
          <div
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              color: 'var(--xp-text-muted)',
              borderBottom: '1px solid var(--xp-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {(() => {
              if (isLocalSearching) {
                return (
                  <>
                    <Spinner />
                    <span>Searching...</span>
                  </>
                );
              }
              if (noResults) {
                return <span>No files matching &apos;{query}&apos;</span>;
              }
              return (
                <span>
                  Found {localResultCount} file{localResultCount !== 1 ? 's' : ''} in {folderCount}{' '}
                  folder
                  {folderCount !== 1 ? 's' : ''}
                  {localTotalResultCount > localResultCount && (
                    <> ({localTotalResultCount} total)</>
                  )}
                </span>
              );
            })()}
          </div>
        )}

        {/* Results list */}
        <div
          ref={scrollContainerRef}
          style={{
            flex: 1,
            overflow: 'auto',
            minHeight: 0,
          }}
          role="listbox"
          aria-label="Search results"
        >
          {(() => {
            if (noQuery) {
              return (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '32px 16px',
                    gap: '12px',
                    color: 'var(--xp-text-muted)',
                  }}
                >
                  {searchMode === 'local' ? (
                    <>
                      {/* Large search icon */}
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ opacity: 0.4 }}
                      >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <span style={{ fontSize: '12px', textAlign: 'center' }}>
                        Type to search files and folders
                      </span>
                      <span style={{ fontSize: '10px', opacity: 0.7, textAlign: 'center' }}>
                        Ctrl+Shift+F to toggle this panel
                      </span>
                    </>
                  ) : (
                    <>
                      {/* AI sparkles icon */}
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ opacity: 0.4 }}
                      >
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                        <path d="M5 3v4" />
                        <path d="M19 17v4" />
                        <path d="M3 5h4" />
                        <path d="M17 19h4" />
                      </svg>
                      <span style={{ fontSize: '12px', textAlign: 'center' }}>
                        AI-powered search
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          opacity: 0.7,
                          textAlign: 'center',
                          maxWidth: '200px',
                        }}
                      >
                        Try natural language like &quot;large images from last week&quot; or
                        &quot;recently modified code files&quot;
                      </span>
                    </>
                  )}
                </div>
              );
            }
            if (isSearching && resultCount === 0) {
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '32px 16px',
                    gap: '8px',
                    color: 'var(--xp-text-muted)',
                  }}
                >
                  <Spinner />
                  <span style={{ fontSize: '12px' }}>
                    {searchMode === 'ai' ? 'Searching with AI...' : 'Searching...'}
                  </span>
                </div>
              );
            }
            if (noResults) {
              return (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '32px 16px',
                    gap: '8px',
                    color: 'var(--xp-text-muted)',
                  }}
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: 0.4 }}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                  <span style={{ fontSize: '12px', textAlign: 'center' }}>
                    No files matching &apos;{query}&apos;
                  </span>
                  {searchMode === 'local' && (
                    <button
                      onClick={() => {
                        setSearchMode('ai');
                        setAiQuery(localQuery);
                      }}
                      style={{
                        marginTop: '4px',
                        fontSize: '11px',
                        color: '#a855f7',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'opacity 0.15s',
                      }}
                    >
                      Try AI search instead
                    </button>
                  )}
                </div>
              );
            }
            if (searchMode === 'ai') {
              return (
                /* AI results list */
                <div>
                  {aiResults.map((result) => (
                    <AIResultRow
                      key={result.path}
                      result={result}
                      query={aiQuery}
                      onSelect={handleAiResultSelect}
                    />
                  ))}
                </div>
              );
            }
            return (
              /* Local results list (virtualized) */
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const index = virtualRow.index;

                  // "Show more" button at the end
                  if (index >= flatItems.length) {
                    return (
                      <div
                        key="show-more"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <button
                          onClick={showMore}
                          style={{
                            background: 'none',
                            border: '1px solid var(--xp-border)',
                            borderRadius: '4px',
                            padding: '4px 12px',
                            fontSize: '11px',
                            color: 'var(--xp-blue)',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                          }}
                          className="hover:bg-xp-surface-light"
                        >
                          Show more... ({localTotalResultCount - localResultCount} remaining)
                        </button>
                      </div>
                    );
                  }

                  const flatItem = flatItems[index];

                  if (flatItem.type === 'group-header') {
                    return (
                      <div
                        key={`header-${flatItem.parentDir}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <GroupHeader parentDir={flatItem.parentDir} basePath={basePath} />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={flatItem.item.file.path}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <ResultRow
                        item={flatItem.item}
                        query={localQuery}
                        onNavigate={handleNavigateToResult}
                        onDoubleClick={handleDoubleClickResult}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    );
  },
);

// ── Spinner subcomponent ─────────────────────────────────────────────────────

const Spinner = () => {
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

export default React.memo(SearchResultsPanel);
