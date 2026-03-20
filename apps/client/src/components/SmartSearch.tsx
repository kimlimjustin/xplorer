import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { TauriAPI, SearchResult, SearchMatch, StructuredQuery } from '@/lib/tauri-api';
import { useToast } from '@/hooks/use-toast';
import {
  getSavedSearches,
  saveSearch,
  type SavedSearch,
} from '@/lib/saved-searches';
// Native debounce — replaces lodash dependency
const debounce = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  ms: number,
): T & { cancel: () => void } => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return debounced as T & { cancel: () => void };
};
import {
  SEARCH_INDEX_REFRESH_MS,
  SEARCH_DEBOUNCE_MS,
  DROPDOWN_BLUR_DELAY_MS,
} from '@/lib/constants';
import {
  FileCode,
  Globe,
  Palette,
  FileJson,
  BookOpen,
  FileText,
  ScrollText,
  BookMarked,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Film,
  Music,
  Package,
  File as FileIcon,
  ChevronDown,
  Star,
} from 'lucide-react';

export type SearchProvider = 'local' | 'claude' | 'openai' | 'ollama';

interface SmartSearchProps {
  className?: string;
  onFileSelect?: (filePath: string, isDir: boolean) => void;
  placeholder?: string;
  maxResults?: number;
  currentPath?: string;
}

export interface SmartSearchHandle {
  focus: () => void;
}

// Filter words that trigger enhanced NL search
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

const PROVIDER_LABELS: Record<SearchProvider, string> = {
  local: 'Local',
  claude: 'Claude',
  openai: 'GPT',
  ollama: 'Ollama',
};

const SmartSearch = forwardRef<SmartSearchHandle, SmartSearchProps>(
  (
    {
      className,
      onFileSelect,
      placeholder = 'Search files and content...',
      maxResults = 50,
      currentPath,
    },
    ref,
  ) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [indexedFileCount, setIndexedFileCount] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [showResults, setShowResults] = useState(false);
    const [parsedQuery, setParsedQuery] = useState<StructuredQuery | null>(null);
    const [searchProvider, setSearchProvider] = useState<SearchProvider>('local');
    const [showProviderMenu, setShowProviderMenu] = useState(false);
    const [searchContent, setSearchContent] = useState(false);

    const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() => getSavedSearches());
    const [showSavedSearches, setShowSavedSearches] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const { toast } = useToast();

    // Keep saved searches in sync with localStorage changes
    useEffect(() => {
      const handleChanged = () => setSavedSearches(getSavedSearches());
      window.addEventListener('saved-searches-changed', handleChanged);
      return () => window.removeEventListener('saved-searches-changed', handleChanged);
    }, []);

    const handleSaveSearch = () => {
      if (!query.trim()) return;
      const name = query.trim().length > 30 ? query.trim().slice(0, 30) + '...' : query.trim();
      saveSearch({
        name,
        query: query.trim(),
        filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
      });
      toast({ title: 'Search Saved', description: `"${name}" saved to your searches.` });
    };

    // Check index stats periodically
    useEffect(() => {
      const checkStats = async () => {
        try {
          const stats = await TauriAPI.getTokenizerStats();
          if (stats) setIndexedFileCount(stats.total_files);
        } catch {
          // Index may not be ready yet
        }
      };
      checkStats();
      const interval = setInterval(checkStats, SEARCH_INDEX_REFRESH_MS);
      return () => clearInterval(interval);
    }, []);

    useImperativeHandle(ref, () => ({
      focus: () => {
        searchInputRef.current?.focus();
      },
    }));

    // Check if query should use enhanced NL search
    const shouldUseEnhancedSearch = (searchQuery: string): boolean => {
      const words = searchQuery.trim().split(/\s+/);
      if (words.length >= 3) return true;
      const lower = searchQuery.toLowerCase();
      return FILTER_INDICATORS.some((indicator) => lower.includes(indicator));
    };

    // Compute relevance score for filesystem results
    const computeFilesystemScore = (filename: string, queryStr: string): number => {
      const nameLower = filename.toLowerCase();
      const queryLower = queryStr.toLowerCase();
      if (nameLower === queryLower) return 0.9;
      if (nameLower.startsWith(queryLower)) return 0.7;
      if (nameLower.includes(queryLower)) return 0.5;
      return 0.3;
    };

    // Unified search function
    const debouncedSearch = useMemo(() =>
      debounce(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
          setResults([]);
          setParsedQuery(null);
          setIsSearching(false);
          return;
        }

        // Cancel previous in-flight search
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setIsSearching(true);

        try {
          let searchResults: SearchResult[] = [];

          if (searchProvider !== 'local') {
            // AI-powered search: BM25F pre-filter → AI re-rank
            try {
              const aiResult = await TauriAPI.aiSearch(
                searchQuery,
                searchProvider,
                undefined, // API key from env/settings
                undefined, // model default
                maxResults,
              );
              searchResults = aiResult.results;
            } catch (err) {
              // AI search failed, fall through to local
              console.warn('AI search failed, falling back to local:', err);
              toast({
                title: 'AI Search Unavailable',
                description: `${PROVIDER_LABELS[searchProvider]} search failed. Using local search.`,
                variant: 'destructive',
              });
            }
          }

          // Local search (or AI fallback)
          if (searchResults.length === 0) {
            // Always try indexed search first (BM25F scored)
            try {
              if (shouldUseEnhancedSearch(searchQuery)) {
                const enhanced = await TauriAPI.enhancedSearch(searchQuery, undefined, maxResults);
                if (!controller.signal.aborted) {
                  setParsedQuery(enhanced.parsed_query);
                  searchResults = enhanced.results;
                }
              } else {
                const tokenResults = await TauriAPI.searchTokens(searchQuery, maxResults);
                if (!controller.signal.aborted) {
                  setParsedQuery(null);
                  searchResults = tokenResults;
                }
              }
            } catch {
              // Index search failed — not a problem, we'll fall back
              if (!controller.signal.aborted) setParsedQuery(null);
            }

            // If index returned nothing, fall back to filesystem search
            if (searchResults.length === 0 && !controller.signal.aborted) {
              const searchPath =
                currentPath && !currentPath.startsWith('xplorer://') ? currentPath : undefined;
              if (searchPath) {
                try {
                  const paths = await TauriAPI.findFiles(searchQuery, searchPath);
                  if (!controller.signal.aborted) {
                    searchResults = paths.slice(0, maxResults).map((p) => {
                      const filename = p.split(/[/\\]/).pop() || p;
                      return {
                        path: p,
                        filename,
                        matches: [{ token: searchQuery, context: 'Filename match' }],
                        score: computeFilesystemScore(filename, searchQuery),
                        relevance_type: 'exact',
                      } as SearchResult;
                    });
                  }
                } catch {
                  // Filesystem search also failed
                }
              }
            }
          }

          if (controller.signal.aborted) return;

          // Sort results: by default name matches first, or pure score if content mode
          if (searchContent) {
            searchResults.sort((a, b) => b.score - a.score);
          } else {
            const queryLower = searchQuery.toLowerCase();
            searchResults.sort((a, b) => {
              const aNameMatch = a.filename.toLowerCase().includes(queryLower) ? 1 : 0;
              const bNameMatch = b.filename.toLowerCase().includes(queryLower) ? 1 : 0;
              if (aNameMatch !== bNameMatch) return bNameMatch - aNameMatch;
              return b.score - a.score;
            });
          }
          setResults(searchResults.slice(0, maxResults));
          setSelectedIndex(-1);
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error('Search failed:', error);
            setResults([]);
          }
        } finally {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        }
      }, SEARCH_DEBOUNCE_MS),
      [maxResults, searchProvider, currentPath, searchContent, toast],
    );

    useEffect(() => {
      debouncedSearch(query);
      return () => {
        debouncedSearch.cancel();
      };
    }, [query, debouncedSearch]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!showResults || results.length === 0) return;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && results[selectedIndex]) {
            handleFileSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowResults(false);
          setSelectedIndex(-1);
          break;
      }
    };

    const handleFileSelect = (result: SearchResult) => {
      setShowResults(false);
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
      setParsedQuery(null);
      // A result is a directory if its filename has no extension (no dot after last separator)
      const hasExt = result.filename.includes('.') && !result.filename.startsWith('.');
      onFileSelect?.(result.path, !hasExt);
    };

    const handleFindSimilar = async (e: React.MouseEvent, filePath: string) => {
      e.stopPropagation();
      try {
        const similarResults = await TauriAPI.findSimilarFiles(filePath, maxResults);
        setResults(similarResults);
        setParsedQuery(null);
      } catch {
        toast({
          title: 'Find Similar Failed',
          description: 'Semantic search requires Ollama with an embedding model.',
          variant: 'destructive',
        });
      }
    };

    const handleFocus = () => {
      if (results.length > 0) setShowResults(true);
    };

    const handleBlur = (e: React.FocusEvent) => {
      setTimeout(() => {
        if (!resultsRef.current?.contains(e.relatedTarget as Node)) {
          setShowResults(false);
          setSelectedIndex(-1);
          setShowProviderMenu(false);
        }
      }, DROPDOWN_BLUR_DELAY_MS);
    };

    const getFileIcon = (filename: string): React.ReactNode => {
      const ext = filename.split('.').pop()?.toLowerCase();
      const props = { size: '1em' as const, className: 'inline-block' };
      switch (ext) {
        case 'js':
        case 'ts':
          return <FileCode {...props} className="inline-block text-xp-yellow" />;
        case 'jsx':
        case 'tsx':
          return <FileCode {...props} className="inline-block text-xp-cyan" />;
        case 'html':
          return <Globe {...props} className="inline-block text-xp-orange" />;
        case 'css':
        case 'scss':
        case 'sass':
          return <Palette {...props} className="inline-block text-xp-purple" />;
        case 'json':
        case 'xml':
        case 'yaml':
        case 'yml':
          return <FileJson {...props} className="inline-block text-xp-green" />;
        case 'md':
          return <BookOpen {...props} className="inline-block text-xp-blue" />;
        case 'txt':
          return <FileText {...props} className="inline-block text-xp-text-muted" />;
        case 'log':
          return <ScrollText {...props} className="inline-block text-xp-text-muted" />;
        case 'pdf':
          return <BookMarked {...props} className="inline-block text-xp-red" />;
        case 'docx':
          return <FileText {...props} className="inline-block text-xp-blue" />;
        case 'xlsx':
          return <FileSpreadsheet {...props} className="inline-block text-xp-green" />;
        case 'pptx':
          return <Presentation {...props} className="inline-block text-xp-orange" />;
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'svg':
          return <ImageIcon {...props} className="inline-block text-xp-purple" />;
        case 'mp4':
        case 'avi':
        case 'mov':
        case 'mkv':
          return <Film {...props} className="inline-block text-xp-red" />;
        case 'mp3':
        case 'wav':
        case 'flac':
          return <Music {...props} className="inline-block text-xp-cyan" />;
        case 'zip':
        case 'rar':
        case 'tar':
        case 'gz':
          return <Package {...props} className="inline-block text-xp-orange" />;
        default:
          return <FileIcon {...props} className="inline-block text-xp-text-muted" />;
      }
    };

    const getRelevanceBadge = (relevanceType: string): { label: string; color: string } => {
      switch (relevanceType) {
        case 'exact':
          return { label: 'Exact', color: 'bg-xp-green' };
        case 'semantic':
          return { label: 'Semantic', color: 'bg-indigo-500' };
        case 'fuzzy':
          return { label: 'Fuzzy', color: 'bg-yellow-500' };
        case 'metadata':
          return { label: 'Metadata', color: 'bg-teal-500' };
        case 'ai_description':
          return { label: 'AI', color: 'bg-purple-500' };
        case 'ai_reranked':
          return { label: 'AI Ranked', color: 'bg-purple-500' };
        default:
          return { label: relevanceType, color: 'bg-xp-blue' };
      }
    };

    const highlightMatches = (text: string, matches: SearchMatch[]): JSX.Element => {
      if (matches.length === 0) return <span>{text}</span>;
      const tokens = matches
        .map((m) => m.token.toLowerCase())
        .filter((t) => t !== 'metadata' && t !== 'semantic' && t !== 'similar');
      if (tokens.length === 0) return <span>{text}</span>;

      let highlightedText = text;
      tokens.forEach((token) => {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        highlightedText = highlightedText.replace(regex, '|||$1|||');
      });

      return (
        <span>
          {highlightedText.split('|||').map((part, index) => {
            const isHighlighted = tokens.some(
              (token) => part.toLowerCase() === token.toLowerCase(),
            );
            return isHighlighted ? (
              <mark key={index} className="bg-yellow-300 bg-opacity-30 px-1 rounded">
                {part}
              </mark>
            ) : (
              <span key={index}>{part}</span>
            );
          })}
        </span>
      );
    };

    const getFilterChips = (pq: StructuredQuery): { label: string; type: string }[] => {
      const chips: { label: string; type: string }[] = [];
      if (pq.file_type_filter) chips.push({ label: pq.file_type_filter, type: 'type' });
      if (pq.size_filter) {
        if (pq.size_filter.min_bytes && pq.size_filter.min_bytes >= 1024 * 1024 * 1024)
          chips.push({ label: '>1GB', type: 'size' });
        else if (pq.size_filter.min_bytes && pq.size_filter.min_bytes >= 100 * 1024 * 1024)
          chips.push({ label: '>100MB', type: 'size' });
        else if (pq.size_filter.max_bytes && pq.size_filter.max_bytes <= 100 * 1024)
          chips.push({ label: '<100KB', type: 'size' });
        else if (pq.size_filter.max_bytes && pq.size_filter.max_bytes <= 1024 * 1024)
          chips.push({ label: '<1MB', type: 'size' });
      }
      if (pq.date_filter) {
        if (pq.date_filter.after) {
          const daysAgo = Math.round((Date.now() / 1000 - pq.date_filter.after) / 86400);
          if (daysAgo <= 1) chips.push({ label: 'Today', type: 'date' });
          else if (daysAgo <= 2) chips.push({ label: 'Yesterday', type: 'date' });
          else if (daysAgo <= 7) chips.push({ label: 'Last Week', type: 'date' });
          else if (daysAgo <= 30) chips.push({ label: 'Last Month', type: 'date' });
          else if (daysAgo <= 365) chips.push({ label: 'This Year', type: 'date' });
        }
        if (pq.date_filter.before && !pq.date_filter.after)
          chips.push({ label: 'Old', type: 'date' });
      }
      if (pq.extension_filter.length > 0)
        chips.push({ label: `.${pq.extension_filter.join(', .')}`, type: 'ext' });
      return chips;
    };

    return (
      <div className={`relative ${className || ''}`}>
        {/* Search Input */}
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim()) setShowResults(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="w-full px-4 py-2 pl-10 pr-28 bg-xp-bg border border-xp-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-xp-blue focus:border-transparent"
          />

          {/* Search Icon */}
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            {isSearching ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-xp-blue border-t-transparent"></div>
            ) : (
              <svg className="w-4 h-4 text-xp-text-muted" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>

          {/* Right side controls — preventDefault on mouseDown keeps input focused */}
          <div
            className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1"
            onMouseDown={(e) => e.preventDefault()}
          >
            {/* Provider selector */}
            <div className="relative">
              <button
                onClick={() => setShowProviderMenu(!showProviderMenu)}
                className={`text-xs px-1.5 py-0.5 rounded transition-colors flex items-center gap-0.5 ${
                  searchProvider !== 'local'
                    ? 'bg-purple-500 bg-opacity-20 text-purple-400 border border-purple-500 border-opacity-30'
                    : 'text-xp-text-muted hover:text-xp-text'
                }`}
                title={`Search provider: ${PROVIDER_LABELS[searchProvider]}`}
              >
                {PROVIDER_LABELS[searchProvider]}
                <ChevronDown size={10} />
              </button>

              {showProviderMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProviderMenu(false)} />
                  <div
                    className="absolute right-0 top-full mt-1 bg-xp-popover border border-xp-border rounded shadow-xl z-50 min-w-[120px]"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {(Object.keys(PROVIDER_LABELS) as SearchProvider[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setSearchProvider(p);
                          setShowProviderMenu(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-xs hover:bg-xp-surface-light transition-colors ${
                          searchProvider === p ? 'bg-xp-blue bg-opacity-20 text-xp-blue' : ''
                        }`}
                      >
                        {PROVIDER_LABELS[p]}
                        {p === 'local' && <span className="text-xp-text-muted ml-1">(BM25F)</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Content search toggle */}
            <button
              onClick={() => {
                setSearchContent((v) => !v);
                if (query.trim()) debouncedSearch(query);
              }}
              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                searchContent
                  ? 'bg-blue-500 bg-opacity-20 text-blue-400 border border-blue-500 border-opacity-30'
                  : 'text-xp-text-muted hover:text-xp-text'
              }`}
              title={
                searchContent ? 'Sorting by content relevance' : 'Sorting by file/folder name match'
              }
            >
              {searchContent ? 'Content' : 'Name'}
            </button>

            {/* Index Stats */}
            {indexedFileCount > 0 && (
              <span className="text-xs text-xp-text-muted">
                {indexedFileCount.toLocaleString()}
              </span>
            )}

            {/* Save Search Button */}
            {query.trim() && (
              <button
                onClick={handleSaveSearch}
                className="text-xp-text-muted hover:text-yellow-400 transition-colors"
                title="Save this search"
              >
                <Star size={14} />
              </button>
            )}

            {/* Saved Searches Toggle */}
            {savedSearches.length > 0 && (
              <button
                onClick={() => {
                  setShowSavedSearches((v) => !v);
                  setShowResults(false);
                }}
                className={`transition-colors ${
                  showSavedSearches ? 'text-yellow-400' : 'text-xp-text-muted hover:text-xp-text'
                }`}
                title="Saved searches"
              >
                <Star size={14} fill={showSavedSearches ? 'currentColor' : 'none'} />
              </button>
            )}

            {/* Clear Button */}
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setShowResults(false);
                  setSelectedIndex(-1);
                  setParsedQuery(null);
                  searchInputRef.current?.focus();
                }}
                className="text-xp-text-muted hover:text-xp-text"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Detected Filter Chips */}
        {parsedQuery &&
          showResults &&
          (() => {
            const chips = getFilterChips(parsedQuery);
            return chips.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1 px-1">
                {chips.map((chip) => (
                  <span
                    key={`${chip.type}-${chip.label}`}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      chip.type === 'type'
                        ? 'bg-blue-500 bg-opacity-20 text-blue-400'
                        : chip.type === 'size'
                          ? 'bg-green-500 bg-opacity-20 text-green-400'
                          : chip.type === 'date'
                            ? 'bg-orange-500 bg-opacity-20 text-orange-400'
                            : 'bg-purple-500 bg-opacity-20 text-purple-400'
                    }`}
                  >
                    {chip.label}
                  </span>
                ))}
                {parsedQuery.keywords.length > 0 && (
                  <span className="text-xs text-xp-text-muted px-1">
                    + "{parsedQuery.keywords.join(' ')}"
                  </span>
                )}
              </div>
            ) : null;
          })()}

        {/* Search Results */}
        {showResults && results.length > 0 && (
          <div
            ref={resultsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-xp-popover border border-xp-border rounded-lg shadow-xl backdrop-blur-xl z-50 max-h-96 overflow-y-auto"
            style={{
              marginTop: parsedQuery && getFilterChips(parsedQuery).length > 0 ? '28px' : '4px',
            }}
          >
            {results.map((result, index) => (
              <button
                key={`${result.path}-${index}`}
                onClick={() => handleFileSelect(result)}
                className={`w-full p-3 text-left hover:bg-xp-surface-light transition-colors border-b border-xp-border last:border-b-0 ${
                  index === selectedIndex ? 'bg-xp-surface-light' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 text-lg">{getFileIcon(result.filename)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium truncate">
                        {highlightMatches(result.filename, result.matches)}
                      </h4>
                      <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                        {(() => {
                          const badge = getRelevanceBadge(result.relevance_type);
                          return (
                            <span
                              className={`text-xs ${badge.color} bg-opacity-20 text-white px-1.5 py-0.5 rounded`}
                            >
                              {badge.label}
                            </span>
                          );
                        })()}
                        <span className="text-xs bg-xp-blue bg-opacity-20 text-xp-blue px-1.5 py-0.5 rounded">
                          {result.score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-xp-text-muted mb-1 truncate">{result.path}</div>
                    {result.snippet && (
                      <div className="text-xs text-xp-text-secondary mb-1.5 line-clamp-2 italic opacity-80">
                        &ldquo;{result.snippet}&rdquo;
                      </div>
                    )}
                    {result.matches.length > 0 && (
                      <div className="space-y-1">
                        {result.matches.slice(0, 2).map((match, matchIndex) => (
                          <div key={matchIndex} className="text-xs">
                            <span className="text-xp-text-muted">Match: </span>
                            <span className="bg-yellow-300 bg-opacity-20 px-1 rounded">
                              {match.token}
                            </span>
                            {match.context && (
                              <span className="text-xp-text-muted ml-1">- {match.context}</span>
                            )}
                          </div>
                        ))}
                        {result.matches.length > 2 && (
                          <div className="text-xs text-xp-text-muted">
                            +{result.matches.length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={(e) => handleFindSimilar(e, result.path)}
                      className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      title="Find semantically similar files"
                    >
                      Find Similar
                    </button>
                  </div>
                </div>
              </button>
            ))}

            <div className="p-3 bg-xp-bg border-t border-xp-border text-xs text-xp-text-muted text-center">
              Found {results.length} results
              {results.length >= maxResults && ` (showing first ${maxResults})`}
              {searchProvider !== 'local' && ` via ${PROVIDER_LABELS[searchProvider]}`}
              {parsedQuery?.sort_hint === 'size_desc' && ' · Sorted by size (largest first)'}
              {parsedQuery?.sort_hint === 'size_asc' && ' · Sorted by size (smallest first)'}
              {parsedQuery?.sort_hint === 'date_desc' && ' · Sorted by date (newest first)'}
              {parsedQuery?.sort_hint === 'date_asc' && ' · Sorted by date (oldest first)'}
            </div>
          </div>
        )}

        {/* No Results */}
        {showResults && !isSearching && query.trim() && results.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-xp-popover border border-xp-border rounded-lg shadow-xl backdrop-blur-xl z-50 p-4 text-center">
            <div className="text-xp-text-secondary">
              <svg className="w-8 h-8 mx-auto mb-2 text-xp-text-muted" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-xp-text">No results found for "{query}"</p>
              <p className="text-xs mt-1 text-xp-text-muted">
                Try different keywords or navigate to the target folder first
              </p>
              {searchProvider === 'local' && (
                <button
                  onClick={() => {
                    setSearchProvider('claude');
                    debouncedSearch(query);
                  }}
                  className="mt-2 text-xs text-purple-400 hover:text-purple-300"
                >
                  Try AI-powered search with Claude
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

SmartSearch.displayName = 'SmartSearch';

export default SmartSearch;
