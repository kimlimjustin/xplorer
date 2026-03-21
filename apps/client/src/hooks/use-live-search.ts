import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';

// ── Types ────────────────────────────────────────────────────────────────────

export type SearchFilterType = 'all' | 'files' | 'folders' | 'documents' | 'images' | 'code';

export interface LiveSearchResult {
  file: FileEntry;
  /** Relevance score: 3 = exact match, 2 = starts with, 1 = contains */
  relevance: number;
  /** Parent directory path */
  parentDir: string;
  /** Relative path from basePath */
  relativePath: string;
}

export interface GroupedResults {
  parentDir: string;
  items: LiveSearchResult[];
}

// ── Extension sets for filter matching ────────────────────────────────────────

const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  'rtf',
  'txt',
  'csv',
  'md',
]);

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'svg',
  'webp',
  'ico',
  'tiff',
  'tif',
  'avif',
  'heic',
  'heif',
]);

const CODE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'rs',
  'py',
  'go',
  'java',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'rb',
  'php',
  'swift',
  'kt',
  'scala',
  'vue',
  'svelte',
  'css',
  'scss',
  'less',
  'html',
  'json',
  'yaml',
  'yml',
  'toml',
  'xml',
  'sh',
  'bash',
  'sql',
  'lua',
  'r',
  'dart',
  'zig',
  'nim',
]);

// ── Filter helpers ───────────────────────────────────────────────────────────

const matchesFilter = (file: FileEntry, filter: SearchFilterType): boolean => {
  if (filter === 'all') return true;
  if (filter === 'folders') return file.is_dir;
  if (filter === 'files') return !file.is_dir;

  // Extension-based filters only apply to files
  if (file.is_dir) return false;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (filter === 'documents') return DOCUMENT_EXTENSIONS.has(ext);
  if (filter === 'images') return IMAGE_EXTENSIONS.has(ext);
  if (filter === 'code') return CODE_EXTENSIONS.has(ext);
  return true;
};

// ── Relevance scoring ────────────────────────────────────────────────────────

const scoreRelevance = (name: string, queryParts: string[]): number => {
  const lower = name.toLowerCase();
  let minScore = 3; // Start high and take the minimum across all query parts

  for (const part of queryParts) {
    if (lower === part) {
      // Exact match stays at 3
      continue;
    } else if (lower.startsWith(part)) {
      minScore = Math.min(minScore, 2);
    } else if (lower.includes(part)) {
      minScore = Math.min(minScore, 1);
    } else {
      // Part doesn't match at all
      return 0;
    }
  }

  return minScore;
};

// ── Recursive directory walker ───────────────────────────────────────────────

async function walkDirectory(
  basePath: string,
  queryParts: string[],
  filter: SearchFilterType,
  maxResults: number,
  abortSignal: { aborted: boolean },
): Promise<LiveSearchResult[]> {
  const results: LiveSearchResult[] = [];
  const queue: string[] = [basePath];
  const maxDepth = 8; // Prevent extremely deep traversal
  const depthMap = new Map<string, number>();
  depthMap.set(basePath, 0);

  while (queue.length > 0 && results.length < maxResults && !abortSignal.aborted) {
    const dirPath = queue.shift()!;
    const depth = depthMap.get(dirPath) ?? 0;

    let entries: FileEntry[];
    try {
      entries = await TauriAPI.readDirectory(dirPath);
    } catch {
      // Permission denied, inaccessible, etc.
      continue;
    }

    for (const entry of entries) {
      if (abortSignal.aborted) break;
      if (results.length >= maxResults) break;

      // Skip hidden files (starting with .)
      if (entry.name.startsWith('.')) continue;

      const relevance = scoreRelevance(entry.name, queryParts);

      if (relevance > 0 && matchesFilter(entry, filter)) {
        // Build relative path from basePath
        let relativePath = entry.path;
        if (relativePath.startsWith(basePath)) {
          relativePath = relativePath.slice(basePath.length);
          // Remove leading separator
          if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
            relativePath = relativePath.slice(1);
          }
        }

        // Determine parent directory
        const sep = entry.path.includes('/') ? '/' : '\\';
        const parts = entry.path.split(sep);
        parts.pop();
        const parentDir = parts.join(sep);

        results.push({
          file: entry,
          relevance,
          parentDir,
          relativePath,
        });
      }

      // Enqueue subdirectories for traversal (even if they matched, to search within them)
      if (entry.is_dir && depth < maxDepth) {
        queue.push(entry.path);
        depthMap.set(entry.path, depth + 1);
      }
    }
  }

  // Sort by relevance (desc), then name (asc)
  results.sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    return a.file.name.toLowerCase().localeCompare(b.file.name.toLowerCase());
  });

  return results;
}

// ── Main hook ────────────────────────────────────────────────────────────────

const MAX_RESULTS = 250; // Fetch slightly more than 200 so we can show "Show more"
const DISPLAY_LIMIT = 200;

export const useLiveSearch = (basePath: string) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LiveSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SearchFilterType>('all');
  const [displayLimit, setDisplayLimit] = useState(DISPLAY_LIMIT);

  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset display limit when query or filter changes
  useEffect(() => {
    setDisplayLimit(DISPLAY_LIMIT);
  }, [query, activeFilter]);

  // Perform the search with debounce
  useEffect(() => {
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Abort any in-progress search
    abortRef.current.aborted = true;

    const trimmed = query.trim();

    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    debounceRef.current = setTimeout(async () => {
      const signal = { aborted: false };
      abortRef.current = signal;

      try {
        const queryParts = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
        const searchResults = await walkDirectory(
          basePath,
          queryParts,
          activeFilter,
          MAX_RESULTS,
          signal,
        );

        if (!signal.aborted) {
          setResults(searchResults);
          setIsSearching(false);
        }
      } catch (err) {
        if (!signal.aborted) {
          console.error('Live search error:', err);
          setResults([]);
          setIsSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      abortRef.current.aborted = true;
    };
  }, [query, basePath, activeFilter]);

  // Group results by parent directory
  const groupedResults = useMemo((): GroupedResults[] => {
    const limited = results.slice(0, displayLimit);
    const groups = new Map<string, LiveSearchResult[]>();

    for (const result of limited) {
      const group = groups.get(result.parentDir);
      if (group) {
        group.push(result);
      } else {
        groups.set(result.parentDir, [result]);
      }
    }

    return Array.from(groups.entries()).map(([parentDir, items]) => ({
      parentDir,
      items,
    }));
  }, [results, displayLimit]);

  // Count of unique parent dirs in displayed results
  const folderCount = useMemo(() => groupedResults.length, [groupedResults]);

  const resultCount = useMemo(
    () => Math.min(results.length, displayLimit),
    [results.length, displayLimit],
  );

  const totalResultCount = results.length;

  const hasMore = results.length > displayLimit;

  const showMore = useCallback(() => {
    setDisplayLimit((prev) => prev + DISPLAY_LIMIT);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setIsSearching(false);
  }, []);

  return {
    query,
    setQuery,
    results,
    groupedResults,
    isSearching,
    resultCount,
    totalResultCount,
    folderCount,
    activeFilter,
    setActiveFilter,
    hasMore,
    showMore,
    displayLimit,
    clearSearch,
  };
};
