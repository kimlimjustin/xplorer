import React, { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, X, Clock, Filter, FolderOpen } from 'lucide-react';
import type {
  FileTypeFilter,
  SizeFilter,
  DateFilter,
  SearchResult,
  SearchMatch,
} from '@/lib/tauri-api';
const SEARCH_HISTORY_KEY = 'xplorer-search-history';
const MAX_HISTORY = 10;

export interface SearchFilters {
  fileTypes: FileTypeFilter[];
  dateRange: DateRangeOption;
  customDateAfter?: string;
  customDateBefore?: string;
  sizeRange: SizeRangeOption;
  extensions: string;
}

export type DateRangeOption = 'any' | 'today' | 'last7' | 'last30' | 'thisYear' | 'custom';
export type SizeRangeOption = 'any' | 'lt1kb' | '1kb-1mb' | '1mb-100mb' | 'gt100mb';

const FILE_TYPE_OPTIONS: { value: FileTypeFilter; label: string }[] = [
  { value: 'Images', label: 'Images' },
  { value: 'Documents', label: 'Documents' },
  { value: 'Videos', label: 'Videos' },
  { value: 'Audio', label: 'Audio' },
  { value: 'Code', label: 'Code' },
  { value: 'Archives', label: 'Archives' },
];

const DATE_RANGE_OPTIONS: { value: DateRangeOption; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'thisYear', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

const SIZE_RANGE_OPTIONS: { value: SizeRangeOption; label: string }[] = [
  { value: 'any', label: 'Any size' },
  { value: 'lt1kb', label: '< 1 KB' },
  { value: '1kb-1mb', label: '1 KB - 1 MB' },
  { value: '1mb-100mb', label: '1 MB - 100 MB' },
  { value: 'gt100mb', label: '> 100 MB' },
];

export const DEFAULT_FILTERS: SearchFilters = {
  fileTypes: [],
  dateRange: 'any',
  sizeRange: 'any',
  extensions: '',
};

export const hasActiveFilters = (filters: SearchFilters): boolean => {
  return (
    filters.fileTypes.length > 0 ||
    filters.dateRange !== 'any' ||
    filters.sizeRange !== 'any' ||
    filters.extensions.trim() !== ''
  );
};

export const buildDateFilter = (filters: SearchFilters): DateFilter | undefined => {
  const now = Math.floor(Date.now() / 1000);
  switch (filters.dateRange) {
    case 'today':
      return { after: now - 86400 };
    case 'last7':
      return { after: now - 7 * 86400 };
    case 'last30':
      return { after: now - 30 * 86400 };
    case 'thisYear': {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime() / 1000;
      return { after: Math.floor(startOfYear) };
    }
    case 'custom': {
      const result: DateFilter = {};
      if (filters.customDateAfter) {
        result.after = Math.floor(new Date(filters.customDateAfter).getTime() / 1000);
      }
      if (filters.customDateBefore) {
        result.before = Math.floor(new Date(filters.customDateBefore).getTime() / 1000);
      }
      if (result.after || result.before) return result;
      return undefined;
    }
    default:
      return undefined;
  }
};

export const buildSizeFilter = (filters: SearchFilters): SizeFilter | undefined => {
  switch (filters.sizeRange) {
    case 'lt1kb':
      return { max_bytes: 1024 };
    case '1kb-1mb':
      return { min_bytes: 1024, max_bytes: 1024 * 1024 };
    case '1mb-100mb':
      return { min_bytes: 1024 * 1024, max_bytes: 100 * 1024 * 1024 };
    case 'gt100mb':
      return { min_bytes: 100 * 1024 * 1024 };
    default:
      return undefined;
  }
};

export const parseExtensionFilter = (input: string): string[] => {
  if (!input.trim()) return [];
  return input
    .split(',')
    .map((e) => e.trim().replace(/^\./, ''))
    .filter(Boolean);
};

export const clientFilterResults = (
  results: SearchResult[],
  filters: SearchFilters,
): SearchResult[] => {
  if (!hasActiveFilters(filters)) return results;

  const extensionList = parseExtensionFilter(filters.extensions).map((e) => e.toLowerCase());
  const sizeFilter = buildSizeFilter(filters);
  const dateFilter = buildDateFilter(filters);

  const fileTypeExtMap: Record<string, string[]> = {
    Images: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif', 'avif'],
    Documents: [
      'pdf',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
      'txt',
      'rtf',
      'odt',
      'ods',
      'odp',
      'csv',
    ],
    Videos: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mpg', 'mpeg'],
    Audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'],
    Code: [
      'js',
      'ts',
      'jsx',
      'tsx',
      'py',
      'rs',
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
      'sh',
      'bat',
      'ps1',
      'html',
      'css',
      'scss',
      'sass',
      'less',
      'vue',
      'svelte',
    ],
    Archives: ['zip', 'rar', 'tar', 'gz', 'bz2', '7z', 'xz', 'zst'],
  };

  return results.filter((r) => {
    const ext = r.filename.split('.').pop()?.toLowerCase() || '';

    if (filters.fileTypes.length > 0) {
      const allowedExts = filters.fileTypes.flatMap((ft) => fileTypeExtMap[ft] || []);
      if (!allowedExts.includes(ext)) return false;
    }

    if (extensionList.length > 0) {
      if (!extensionList.includes(ext)) return false;
    }

    if (sizeFilter) {
      const sizeMatch = r.matches.find((m) => m.context.startsWith('Size:'));
      if (sizeMatch) {
        const sizeBytes = parseSizeFromContext(sizeMatch.context);
        if (sizeBytes !== null) {
          if (sizeFilter.min_bytes && sizeBytes < sizeFilter.min_bytes) return false;
          if (sizeFilter.max_bytes && sizeBytes > sizeFilter.max_bytes) return false;
        }
      }
    }

    if (dateFilter) {
      const dateMatch = r.matches.find((m) => m.context.startsWith('Modified:'));
      if (dateMatch) {
        const ts = parseDateFromContext(dateMatch.context);
        if (ts !== null) {
          if (dateFilter.after && ts < dateFilter.after) return false;
          if (dateFilter.before && ts > dateFilter.before) return false;
        }
      }
    }

    return true;
  });
};

const parseSizeFromContext = (ctx: string): number | null => {
  const match = ctx.match(/Size:\s*([\d.]+)\s*(B|KB|MB|GB|TB)/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };
  return num * (multipliers[unit] || 1);
};

const parseDateFromContext = (ctx: string): number | null => {
  const match = ctx.match(/Modified:\s*(.+)/);
  if (!match) return null;
  const ts = new Date(match[1]).getTime();
  if (isNaN(ts)) return null;
  return ts / 1000;
};

// --- Search History helpers ---

export const getSearchHistory = (): string[] => {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
};

export const addSearchHistory = (query: string): void => {
  if (!query.trim()) return;
  const history = getSearchHistory().filter((h) => h !== query);
  history.unshift(query);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // localStorage may be full
  }
};

export const clearSearchHistory = (): void => {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    // ignore
  }
};

// --- Grouped Results helpers ---

export interface GroupedResults {
  folder: string;
  results: SearchResult[];
}

export const groupResultsByFolder = (results: SearchResult[]): GroupedResults[] => {
  const map = new Map<string, SearchResult[]>();
  for (const r of results) {
    const lastSep = Math.max(r.path.lastIndexOf('/'), r.path.lastIndexOf('\\'));
    const folder = lastSep > 0 ? r.path.substring(0, lastSep) : 'Root';
    if (!map.has(folder)) map.set(folder, []);
    map.get(folder)!.push(r);
  }
  return Array.from(map.entries())
    .map(([folder, results]) => ({ folder, results }))
    .sort((a, b) => b.results.length - a.results.length);
};

// --- Search History Dropdown ---

interface SearchHistoryDropdownProps {
  onSelect: (query: string) => void;
  onClear: () => void;
}

export const SearchHistoryDropdown = ({ onSelect, onClear }: SearchHistoryDropdownProps) => {
  const history = getSearchHistory();
  if (history.length === 0) return null;

  return (
    <div className="bg-xp-popover border-xp-border absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border shadow-xl backdrop-blur-xl">
      <div className="border-xp-border flex items-center justify-between border-b px-3 py-2">
        <span className="text-xp-text-muted flex items-center gap-1.5 text-xs font-medium">
          <Clock size={12} />
          Recent Searches
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClear();
          }}
          className="text-xp-text-muted hover:text-xp-red text-xs transition-colors"
        >
          Clear
        </button>
      </div>
      {history.map((item) => (
        <button
          key={item}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          className="hover:bg-xp-surface-light border-xp-border flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm transition-colors last:border-b-0"
        >
          <Clock size={12} className="text-xp-text-muted flex-shrink-0" />
          <span className="truncate">{item}</span>
        </button>
      ))}
    </div>
  );
};

// --- Search Filter Panel ---

interface SearchFilterPanelProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onClose: () => void;
}

const SearchFilterPanel = ({ filters, onChange, onClose }: SearchFilterPanelProps) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    fileType: true,
    dateRange: true,
    sizeRange: true,
    extensions: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleFileType = (ft: FileTypeFilter) => {
    const next = filters.fileTypes.includes(ft)
      ? filters.fileTypes.filter((t) => t !== ft)
      : [...filters.fileTypes, ft];
    onChange({ ...filters, fileTypes: next });
  };

  const setDateRange = (dr: DateRangeOption) => {
    onChange({ ...filters, dateRange: dr });
  };

  const setSizeRange = (sr: SizeRangeOption) => {
    onChange({ ...filters, sizeRange: sr });
  };

  const setExtensions = (val: string) => {
    onChange({ ...filters, extensions: val });
  };

  const clearAll = () => {
    onChange({ ...DEFAULT_FILTERS });
  };

  const activeCount =
    filters.fileTypes.length +
    (filters.dateRange !== 'any' ? 1 : 0) +
    (filters.sizeRange !== 'any' ? 1 : 0) +
    (filters.extensions.trim() ? 1 : 0);

  return (
    <div
      className="bg-xp-popover border-xp-border overflow-hidden rounded-lg border shadow-xl backdrop-blur-xl"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="border-xp-border flex items-center justify-between border-b px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <Filter size={12} className="text-xp-blue" />
          Search Filters
          {activeCount > 0 && (
            <span className="bg-xp-blue text-xp-blue rounded-full bg-opacity-20 px-1.5 py-0.5 text-xs font-semibold">
              {activeCount}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              onClick={clearAll}
              className="text-xp-text-muted hover:text-xp-red text-xs transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={onClose}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text rounded p-0.5 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="max-h-80 space-y-1 overflow-y-auto p-2">
        {/* File Type Section */}
        <FilterSection
          title="File Type"
          expanded={expandedSections.fileType}
          onToggle={() => toggleSection('fileType')}
          badge={filters.fileTypes.length > 0 ? String(filters.fileTypes.length) : undefined}
        >
          <div className="grid grid-cols-3 gap-1.5">
            {FILE_TYPE_OPTIONS.map((opt) => {
              const active = filters.fileTypes.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleFileType(opt.value)}
                  className={`rounded px-2 py-1.5 text-center text-xs transition-colors ${
                    active
                      ? 'bg-xp-blue text-xp-blue border-xp-blue border border-opacity-40 bg-opacity-20'
                      : 'bg-xp-surface hover:bg-xp-surface-light border-xp-border border'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* Date Range Section */}
        <FilterSection
          title="Date Modified"
          expanded={expandedSections.dateRange}
          onToggle={() => toggleSection('dateRange')}
          badge={filters.dateRange !== 'any' ? '1' : undefined}
        >
          <div className="grid grid-cols-3 gap-1.5">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`rounded px-2 py-1.5 text-center text-xs transition-colors ${
                  filters.dateRange === opt.value
                    ? 'bg-xp-blue text-xp-blue border-xp-blue border border-opacity-40 bg-opacity-20'
                    : 'bg-xp-surface hover:bg-xp-surface-light border-xp-border border'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {filters.dateRange === 'custom' && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="date"
                value={filters.customDateAfter || ''}
                onChange={(e) => onChange({ ...filters, customDateAfter: e.target.value })}
                className="bg-xp-bg border-xp-border focus:ring-xp-blue flex-1 rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1"
                placeholder="From"
              />
              <span className="text-xp-text-muted text-xs">to</span>
              <input
                type="date"
                value={filters.customDateBefore || ''}
                onChange={(e) => onChange({ ...filters, customDateBefore: e.target.value })}
                className="bg-xp-bg border-xp-border focus:ring-xp-blue flex-1 rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1"
                placeholder="To"
              />
            </div>
          )}
        </FilterSection>

        {/* Size Range Section */}
        <FilterSection
          title="File Size"
          expanded={expandedSections.sizeRange}
          onToggle={() => toggleSection('sizeRange')}
          badge={filters.sizeRange !== 'any' ? '1' : undefined}
        >
          <div className="grid grid-cols-3 gap-1.5">
            {SIZE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSizeRange(opt.value)}
                className={`rounded px-2 py-1.5 text-center text-xs transition-colors ${
                  filters.sizeRange === opt.value
                    ? 'bg-xp-blue text-xp-blue border-xp-blue border border-opacity-40 bg-opacity-20'
                    : 'bg-xp-surface hover:bg-xp-surface-light border-xp-border border'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Extension Filter Section */}
        <FilterSection
          title="File Extensions"
          expanded={expandedSections.extensions}
          onToggle={() => toggleSection('extensions')}
          badge={filters.extensions.trim() ? '1' : undefined}
        >
          <input
            type="text"
            value={filters.extensions}
            onChange={(e) => setExtensions(e.target.value)}
            placeholder="e.g. .ts, .tsx, .json"
            className="bg-xp-bg border-xp-border focus:ring-xp-blue placeholder-xp-text-muted w-full rounded border px-2 py-1.5 text-xs focus:outline-none focus:ring-1"
          />
          {filters.extensions.trim() && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {parseExtensionFilter(filters.extensions).map((ext) => (
                <span
                  key={ext}
                  className="bg-xp-surface border-xp-border rounded border px-1.5 py-0.5 text-xs"
                >
                  .{ext}
                </span>
              ))}
            </div>
          )}
        </FilterSection>
      </div>
    </div>
  );
};

// --- Collapsible filter section ---

interface FilterSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}

const FilterSection = ({ title, expanded, onToggle, badge, children }: FilterSectionProps) => {
  return (
    <div className="border-xp-border overflow-hidden rounded border">
      <button
        onClick={onToggle}
        className="hover:bg-xp-surface-light flex w-full items-center justify-between px-2.5 py-1.5 text-xs font-medium transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {title}
          {badge && (
            <span className="bg-xp-blue text-xp-blue rounded-full bg-opacity-20 px-1 py-0 text-xs">
              {badge}
            </span>
          )}
        </span>
      </button>
      {expanded && <div className="px-2.5 pb-2.5">{children}</div>}
    </div>
  );
};

// --- Grouped Search Results ---

interface GroupedSearchResultsProps {
  results: SearchResult[];
  query: string;
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
  onFindSimilar: (e: React.MouseEvent, filePath: string) => void;
  getFileIcon: (filename: string) => React.ReactNode;
  getRelevanceBadge: (type: string) => { label: string; color: string };
  maxResults: number;
  searchProvider: string;
  parsedQuery: { sort_hint?: string } | null;
}

export const GroupedSearchResults = ({
  results,
  query: _query,
  selectedIndex,
  onSelect,
  onFindSimilar,
  getFileIcon,
  getRelevanceBadge,
  maxResults,
  searchProvider,
  parsedQuery,
}: GroupedSearchResultsProps) => {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupResultsByFolder(results), [results]);

  const toggleFolder = useCallback((folder: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }, []);

  let flatIndex = -1;

  const highlightMatch = (text: string, matches: SearchMatch[]): JSX.Element => {
    if (matches.length === 0) return <span>{text}</span>;
    const tokens = matches
      .map((m) => m.token.toLowerCase())
      .filter((t) => t !== 'metadata' && t !== 'semantic' && t !== 'similar');
    if (tokens.length === 0) return <span>{text}</span>;

    let highlighted = text;
    tokens.forEach((token) => {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      highlighted = highlighted.replace(regex, '|||$1|||');
    });

    return (
      <span>
        {highlighted.split('|||').map((part, i) => {
          const isHL = tokens.some((t) => part.toLowerCase() === t.toLowerCase());
          return isHL ? (
            // eslint-disable-next-line react/no-array-index-key
            <mark key={i} className="rounded bg-yellow-300 bg-opacity-30 px-0.5">
              {part}
            </mark>
          ) : (
            // eslint-disable-next-line react/no-array-index-key
            <span key={i}>{part}</span>
          );
        })}
      </span>
    );
  };

  return (
    <div>
      {groups.map((group) => {
        const isCollapsed = collapsedFolders.has(group.folder);
        return (
          <div key={group.folder}>
            <button
              onClick={() => toggleFolder(group.folder)}
              className="bg-xp-bg border-xp-border hover:bg-xp-surface-light sticky top-0 z-10 flex w-full items-center gap-1.5 border-b px-3 py-1.5 text-xs font-medium transition-colors"
              onMouseDown={(e) => e.preventDefault()}
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <FolderOpen size={12} className="text-xp-blue" />
              <span className="text-xp-text-muted truncate" title={group.folder}>
                {group.folder}
              </span>
              <span className="bg-xp-surface text-xp-text-muted ml-auto flex-shrink-0 rounded-full px-1.5 py-0 text-xs">
                {group.results.length}
              </span>
            </button>
            {!isCollapsed &&
              group.results.map((result) => {
                flatIndex++;
                const currentFlatIndex = flatIndex;
                const badge = getRelevanceBadge(result.relevance_type);
                return (
                  <button
                    key={result.path}
                    onClick={() => onSelect(result)}
                    className={`hover:bg-xp-surface-light border-xp-border w-full border-b p-3 pl-6 text-left transition-colors last:border-b-0 ${
                      currentFlatIndex === selectedIndex ? 'bg-xp-surface-light' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 text-lg">{getFileIcon(result.filename)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center justify-between">
                          <h4 className="truncate text-sm font-medium">
                            {highlightMatch(result.filename, result.matches)}
                          </h4>
                          <div className="ml-2 flex flex-shrink-0 items-center space-x-1">
                            <span
                              className={`text-xs ${badge.color} rounded bg-opacity-20 px-1.5 py-0.5 text-white`}
                            >
                              {badge.label}
                            </span>
                            <span className="bg-xp-blue text-xp-blue rounded bg-opacity-20 px-1.5 py-0.5 text-xs">
                              {result.score.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        <div className="text-xp-text-muted truncate text-xs">{result.filename}</div>
                        {result.snippet && (
                          <div className="text-xp-text-secondary mt-0.5 line-clamp-2 text-xs italic opacity-80">
                            &ldquo;{result.snippet}&rdquo;
                          </div>
                        )}
                        {result.matches.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {result.matches.slice(0, 2).map((match) => (
                              <div key={match.token} className="text-xs">
                                <span className="text-xp-text-muted">Match: </span>
                                <span className="rounded bg-yellow-300 bg-opacity-20 px-1">
                                  {match.token}
                                </span>
                                {match.context && (
                                  <span className="text-xp-text-muted ml-1">- {match.context}</span>
                                )}
                              </div>
                            ))}
                            {result.matches.length > 2 && (
                              <div className="text-xp-text-muted text-xs">
                                +{result.matches.length - 2} more
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          onClick={(e) => onFindSimilar(e, result.path)}
                          className="mt-1 text-xs text-indigo-400 transition-colors hover:text-indigo-300"
                          title="Find semantically similar files"
                        >
                          Find Similar
                        </button>
                      </div>
                    </div>
                  </button>
                );
              })}
            {isCollapsed && (
              <div className="hidden">{(flatIndex += group.results.length) && null}</div>
            )}
          </div>
        );
      })}

      <div className="bg-xp-bg border-xp-border text-xp-text-muted border-t p-3 text-center text-xs">
        Found {results.length} results in {groups.length} folder{groups.length !== 1 ? 's' : ''}
        {results.length >= maxResults && ` (showing first ${maxResults})`}
        {searchProvider !== 'local' && ` via ${searchProvider}`}
        {parsedQuery?.sort_hint === 'size_desc' && ' \u00B7 Sorted by size (largest first)'}
        {parsedQuery?.sort_hint === 'size_asc' && ' \u00B7 Sorted by size (smallest first)'}
        {parsedQuery?.sort_hint === 'date_desc' && ' \u00B7 Sorted by date (newest first)'}
        {parsedQuery?.sort_hint === 'date_asc' && ' \u00B7 Sorted by date (oldest first)'}
      </div>
    </div>
  );
};

export default SearchFilterPanel;
