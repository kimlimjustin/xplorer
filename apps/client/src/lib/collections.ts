/**
 * Smart File Collections — saved filter groups that act as virtual directories.
 *
 * Collections are persisted in localStorage under the key `xplorer:collections`.
 * Each collection stores a list of filters that are ANDed together at query time.
 */

import type { FileEntry } from '@/lib/tauri-api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CollectionFilter {
  type:
    | 'extension'
    | 'size_gt'
    | 'size_lt'
    | 'modified_after'
    | 'modified_before'
    | 'name_contains'
    | 'name_regex'
    | 'tag'
    | 'is_directory'
    | 'is_hidden';
  /** e.g. ".pdf", "1048576" (bytes), "2026-01-01", "report" */
  value: string;
}

export interface FileCollection {
  id: string;
  name: string;
  icon: string; // lucide-react icon name (e.g. "Folder", "Music")
  filters: CollectionFilter[];
  /** Base path to scan when the collection is opened. Empty string = current directory filter. */
  basePath: string;
  /** Hex color for visual coding (used when applied as a filter). */
  color: string;
  createdAt: number;
  updatedAt: number;
  /** Built-in collections cannot be deleted. */
  builtin?: boolean;
}

// ── Storage key ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'xplorer:collections';

const readAll = (): FileCollection[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as FileCollection[];
  } catch {
    return [];
  }
};

const writeAll = (collections: FileCollection[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
};

// ── CRUD ─────────────────────────────────────────────────────────────────────

export const getCollections = (): FileCollection[] => {
  return readAll();
};

export const getCollection = (id: string): FileCollection | null => {
  // Check built-ins first
  const builtin = BUILTIN_COLLECTIONS.find((c) => c.id === id);
  if (builtin) return builtin;
  return readAll().find((c) => c.id === id) ?? null;
};

export const createCollection = (
  name: string,
  filters: CollectionFilter[],
  icon: string = 'Folder',
  basePath: string = '',
  color: string = '#3b82f6',
): FileCollection => {
  const collections = readAll();
  const now = Date.now();
  const collection: FileCollection = {
    id: `col-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    icon,
    filters,
    basePath,
    color,
    createdAt: now,
    updatedAt: now,
  };
  collections.push(collection);
  writeAll(collections);
  window.dispatchEvent(new CustomEvent('collections-changed'));
  return collection;
};

export const updateCollection = (
  id: string,
  updates: Partial<Omit<FileCollection, 'id' | 'createdAt'>>,
): void => {
  const collections = readAll();
  const idx = collections.findIndex((c) => c.id === id);
  if (idx === -1) return;
  collections[idx] = { ...collections[idx], ...updates, updatedAt: Date.now() };
  writeAll(collections);
  window.dispatchEvent(new CustomEvent('collections-changed'));
};

export const deleteCollection = (id: string): void => {
  const collections = readAll().filter((c) => c.id !== id);
  writeAll(collections);
  window.dispatchEvent(new CustomEvent('collections-changed'));
};

// ── Filter matching ──────────────────────────────────────────────────────────

/**
 * Returns true when `file` satisfies **all** filters in `collection` (AND logic).
 */
export const matchesCollection = (file: FileEntry, collection: FileCollection): boolean => {
  return collection.filters.every((f) => matchesFilter(file, f));
};

export const matchesFilter = (file: FileEntry, filter: CollectionFilter): boolean => {
  switch (filter.type) {
    case 'extension': {
      const extensions = filter.value
        .split(',')
        .map((e) =>
          e.trim().startsWith('.') ? e.trim().toLowerCase() : `.${e.trim().toLowerCase()}`,
        );
      const fileName = file.name.toLowerCase();
      return extensions.some((ext) => fileName.endsWith(ext));
    }
    case 'size_gt': {
      const threshold = parseInt(filter.value, 10);
      return !isNaN(threshold) && file.size > threshold;
    }
    case 'size_lt': {
      const threshold = parseInt(filter.value, 10);
      return !isNaN(threshold) && file.size < threshold;
    }
    case 'modified_after': {
      let dateStr = filter.value;
      if (dateStr === '__DYNAMIC_7_DAYS__') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        dateStr = d.toISOString().split('T')[0];
      }
      const ts = new Date(dateStr).getTime() / 1000;
      return !isNaN(ts) && file.modified > ts;
    }
    case 'modified_before': {
      const ts = new Date(filter.value).getTime() / 1000;
      return !isNaN(ts) && file.modified < ts;
    }
    case 'name_contains':
      return file.name.toLowerCase().includes(filter.value.toLowerCase());
    case 'name_regex': {
      try {
        const re = new RegExp(filter.value, 'i');
        return re.test(file.name);
      } catch {
        return false;
      }
    }
    case 'tag':
      // Tag matching requires async lookup; we handle it in the hook instead.
      // At the pure-filter level we always pass so the hook can handle it.
      return true;
    case 'is_directory':
      return filter.value === 'true' ? file.is_dir : !file.is_dir;
    case 'is_hidden':
      return filter.value === 'true' ? file.name.startsWith('.') : !file.name.startsWith('.');
    default:
      return true;
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Human-readable label for a filter type. */
export const filterTypeLabel = (type: CollectionFilter['type']): string => {
  switch (type) {
    case 'extension':
      return 'File Extension';
    case 'size_gt':
      return 'Min Size (bytes)';
    case 'size_lt':
      return 'Max Size (bytes)';
    case 'modified_after':
      return 'Modified After';
    case 'modified_before':
      return 'Modified Before';
    case 'name_contains':
      return 'Name Contains';
    case 'name_regex':
      return 'Name Regex';
    case 'tag':
      return 'Has Tag';
    case 'is_directory':
      return 'Is Directory';
    case 'is_hidden':
      return 'Is Hidden';
    default:
      return String(type);
  }
};

export const filterValuePlaceholder = (type: CollectionFilter['type']): string => {
  switch (type) {
    case 'extension':
      return '.pdf,.docx,.txt';
    case 'size_gt':
      return '104857600 (100 MB)';
    case 'size_lt':
      return '1048576 (1 MB)';
    case 'modified_after':
      return '2026-01-01';
    case 'modified_before':
      return '2026-12-31';
    case 'name_contains':
      return 'report';
    case 'name_regex':
      return '\\.(test|spec)\\.tsx?$';
    case 'tag':
      return 'tag name';
    case 'is_directory':
      return 'true or false';
    case 'is_hidden':
      return 'true or false';
    default:
      return '';
  }
};

export const FILTER_TYPES: CollectionFilter['type'][] = [
  'extension',
  'size_gt',
  'size_lt',
  'modified_after',
  'modified_before',
  'name_contains',
  'name_regex',
  'tag',
  'is_directory',
  'is_hidden',
];

export const COLLECTION_ICONS = [
  'Folder',
  'FileText',
  'Image',
  'Music',
  'Clapperboard',
  'BarChart3',
  'PenLine',
  'Laptop',
  'Wrench',
  'Star',
  'Disc',
  'Clock',
];

export const COLLECTION_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#64748b', // slate
];

// ── Built-in Collections (replaces former "Filter Presets") ─────────────────

export const BUILTIN_COLLECTIONS: FileCollection[] = [
  {
    id: 'builtin-large-files',
    name: 'Large Files',
    icon: 'Disc',
    color: '#ef4444',
    filters: [{ type: 'size_gt', value: String(100 * 1024 * 1024) }],
    basePath: '',
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
  {
    id: 'builtin-recent-files',
    name: 'Recent Files',
    icon: 'Clock',
    color: '#3b82f6',
    filters: [{ type: 'modified_after', value: '__DYNAMIC_7_DAYS__' }],
    basePath: '',
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
  {
    id: 'builtin-images',
    name: 'Images',
    icon: 'Image',
    color: '#a855f7',
    filters: [{ type: 'extension', value: '.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp' }],
    basePath: '',
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
  {
    id: 'builtin-documents',
    name: 'Documents',
    icon: 'FileText',
    color: '#f59e0b',
    filters: [{ type: 'extension', value: '.pdf,.doc,.docx,.txt,.md,.xlsx,.pptx' }],
    basePath: '',
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
  {
    id: 'builtin-code-files',
    name: 'Code Files',
    icon: 'Laptop',
    color: '#10b981',
    filters: [{ type: 'extension', value: '.js,.ts,.tsx,.jsx,.py,.rs,.go,.java,.cpp,.c,.h' }],
    basePath: '',
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
];

/**
 * Returns all collections (built-in + user-created).
 * Built-in collections appear first.
 */
export const getAllCollections = (): FileCollection[] => {
  return [...BUILTIN_COLLECTIONS, ...readAll()];
};

/**
 * Applies a collection's filters to a list of files (synchronous, excluding tag filters).
 * Useful when the collection is applied as a filter to the current directory.
 */
export const applyCollectionToFiles = (
  files: FileEntry[],
  collection: FileCollection,
): FileEntry[] => {
  if (!collection.filters.length) return files;
  return files.filter((file) => matchesCollection(file, collection));
};

/** Returns true if a collection acts as a directory-scoped filter (has a basePath). */
export const isSmartFolder = (collection: FileCollection): boolean => {
  return collection.basePath.length > 0;
};

/** Returns true if a collection acts as a current-directory filter (no basePath). */
export const isQuickFilter = (collection: FileCollection): boolean => {
  return collection.basePath.length === 0;
};
