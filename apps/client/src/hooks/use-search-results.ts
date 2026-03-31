import { useState, useRef, useEffect, useCallback } from 'react';
import { TauriAPI, type SearchResult, type FileEntry } from '@/lib/tauri-api';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';

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

// ── Hook ────────────────────────────────────────────────────────────────────

export const useAiSearch = (basePath: string) => {
  const [aiQuery, setAiQuery] = useState('');
  const [aiResults, setAiResults] = useState<SearchResult[]>([]);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiParsedInfo, setAiParsedInfo] = useState<string | null>(null);
  const aiAbortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
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
  }, [aiQuery]);

  const handleAiResultSelect = useCallback(
    (
      result: SearchResult,
      navigateToPath: (path: string) => void,
      onFileSelect: (file: FileEntry) => void,
    ) => {
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
    [basePath],
  );

  const clearAiSearch = useCallback(() => {
    setAiQuery('');
    setAiResults([]);
    setIsAiSearching(false);
    setAiParsedInfo(null);
  }, []);

  return {
    aiQuery,
    setAiQuery,
    aiResults,
    isAiSearching,
    aiParsedInfo,
    handleAiResultSelect,
    clearAiSearch,
  };
};
