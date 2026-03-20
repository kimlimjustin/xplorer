import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  matchesFilter,
  matchesCollection,
  filterTypeLabel,
  FILTER_TYPES,
  COLLECTION_ICONS,
  type FileCollection,
  type CollectionFilter,
} from '@/lib/collections';
import type { FileEntry } from '@/lib/tauri-api';

// ── localStorage mock ─────────────────────────────────────────────────────

const store: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => {
      store[key] = val;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(),
  });
  vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
});

// ── Helper to create a FileEntry ────────────────────────────────────────

const makeFile = (overrides: Partial<FileEntry> = {}): FileEntry => {
  return {
    name: 'test.txt',
    path: '/home/user/test.txt',
    size: 1024,
    is_dir: false,
    modified: Date.now() / 1000,
    file_type: 'text',
    ...overrides,
  };
};

// ── CRUD Tests ──────────────────────────────────────────────────────────

describe('collections CRUD', () => {
  it('returns empty array when no collections exist', () => {
    expect(getCollections()).toEqual([]);
  });

  it('creates a collection and persists it', () => {
    const filters: CollectionFilter[] = [{ type: 'extension', value: '.pdf' }];
    const col = createCollection('PDFs', filters, '\uD83D\uDCC4', '/docs');

    expect(col.name).toBe('PDFs');
    expect(col.icon).toBe('\uD83D\uDCC4');
    expect(col.basePath).toBe('/docs');
    expect(col.filters).toEqual(filters);
    expect(col.id).toMatch(/^col-/);
    expect(col.createdAt).toBeGreaterThan(0);
    expect(col.updatedAt).toBe(col.createdAt);

    const all = getCollections();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(col.id);
  });

  it('creates collection with default icon, basePath, and color', () => {
    const col = createCollection('Empty', []);
    expect(col.icon).toBe('Folder');
    expect(col.basePath).toBe('');
    expect(col.color).toBe('#3b82f6');
  });

  it('retrieves a collection by id', () => {
    const col = createCollection('Find me', []);
    expect(getCollection(col.id)).toEqual(expect.objectContaining({ name: 'Find me' }));
  });

  it('returns null for non-existent collection id', () => {
    expect(getCollection('nonexistent')).toBeNull();
  });

  it('updates a collection', () => {
    const col = createCollection('Old Name', []);
    updateCollection(col.id, { name: 'New Name' });

    const updated = getCollection(col.id);
    expect(updated!.name).toBe('New Name');
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(col.updatedAt);
  });

  it('update is a no-op for non-existent id', () => {
    createCollection('Only One', []);
    updateCollection('does-not-exist', { name: 'Nope' });
    expect(getCollections()).toHaveLength(1);
    expect(getCollections()[0].name).toBe('Only One');
  });

  it('deletes a collection', () => {
    const col = createCollection('Delete me', []);
    expect(getCollections()).toHaveLength(1);

    deleteCollection(col.id);
    expect(getCollections()).toHaveLength(0);
  });

  it('dispatches events on create, update, delete', () => {
    const col = createCollection('Evt', []);
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'collections-changed' }),
    );

    updateCollection(col.id, { name: 'Changed' });
    expect(window.dispatchEvent).toHaveBeenCalledTimes(2);

    deleteCollection(col.id);
    expect(window.dispatchEvent).toHaveBeenCalledTimes(3);
  });
});

// ── Storage edge cases ──────────────────────────────────────────────────

describe('collections storage edge cases', () => {
  it('handles corrupted JSON in localStorage', () => {
    store['xplorer:collections'] = 'not-json!!';
    expect(getCollections()).toEqual([]);
  });

  it('handles non-array JSON in localStorage', () => {
    store['xplorer:collections'] = '{"id": "oops"}';
    expect(getCollections()).toEqual([]);
  });
});

// ── Filter matching ────────────────────────────────────────────────────

describe('matchesFilter', () => {
  it('matches extension filter with leading dot', () => {
    const file = makeFile({ name: 'report.PDF' });
    expect(matchesFilter(file, { type: 'extension', value: '.pdf' })).toBe(true);
  });

  it('matches extension filter without leading dot', () => {
    const file = makeFile({ name: 'image.png' });
    expect(matchesFilter(file, { type: 'extension', value: 'png' })).toBe(true);
  });

  it('rejects non-matching extension', () => {
    const file = makeFile({ name: 'script.js' });
    expect(matchesFilter(file, { type: 'extension', value: '.ts' })).toBe(false);
  });

  it('matches size_gt filter', () => {
    const file = makeFile({ size: 2000 });
    expect(matchesFilter(file, { type: 'size_gt', value: '1000' })).toBe(true);
    expect(matchesFilter(file, { type: 'size_gt', value: '5000' })).toBe(false);
  });

  it('returns false for size_gt with invalid value', () => {
    const file = makeFile({ size: 2000 });
    expect(matchesFilter(file, { type: 'size_gt', value: 'notanumber' })).toBe(false);
  });

  it('matches size_lt filter', () => {
    const file = makeFile({ size: 500 });
    expect(matchesFilter(file, { type: 'size_lt', value: '1000' })).toBe(true);
    expect(matchesFilter(file, { type: 'size_lt', value: '100' })).toBe(false);
  });

  it('matches modified_after filter', () => {
    // 2026-01-15 in seconds
    const ts = new Date('2026-01-15T00:00:00Z').getTime() / 1000;
    const file = makeFile({ modified: ts + 86400 });
    expect(matchesFilter(file, { type: 'modified_after', value: '2026-01-15' })).toBe(true);
    expect(matchesFilter(file, { type: 'modified_after', value: '2026-02-01' })).toBe(false);
  });

  it('matches modified_before filter', () => {
    const ts = new Date('2026-01-01T00:00:00Z').getTime() / 1000;
    const file = makeFile({ modified: ts });
    expect(matchesFilter(file, { type: 'modified_before', value: '2026-06-01' })).toBe(true);
  });

  it('matches name_contains filter case-insensitively', () => {
    const file = makeFile({ name: 'MyReport2026.pdf' });
    expect(matchesFilter(file, { type: 'name_contains', value: 'report' })).toBe(true);
    expect(matchesFilter(file, { type: 'name_contains', value: 'budget' })).toBe(false);
  });

  it('tag filter always passes (handled async elsewhere)', () => {
    const file = makeFile();
    expect(matchesFilter(file, { type: 'tag', value: 'anything' })).toBe(true);
  });

  it('matches is_directory filter', () => {
    const dir = makeFile({ is_dir: true });
    const file = makeFile({ is_dir: false });
    expect(matchesFilter(dir, { type: 'is_directory', value: 'true' })).toBe(true);
    expect(matchesFilter(file, { type: 'is_directory', value: 'true' })).toBe(false);
    expect(matchesFilter(file, { type: 'is_directory', value: 'false' })).toBe(true);
  });

  it('returns true for unknown filter type', () => {
    const file = makeFile();
    expect(matchesFilter(file, { type: 'unknown_type' as unknown, value: '' })).toBe(true);
  });
});

describe('matchesCollection', () => {
  it('requires all filters to pass (AND logic)', () => {
    const file = makeFile({ name: 'report.pdf', size: 5000 });
    const col: FileCollection = {
      id: 'test',
      name: 'Test',
      icon: '',
      color: '#3b82f6',
      basePath: '',
      createdAt: 0,
      updatedAt: 0,
      filters: [
        { type: 'extension', value: '.pdf' },
        { type: 'size_gt', value: '1000' },
      ],
    };
    expect(matchesCollection(file, col)).toBe(true);
  });

  it('returns false when one filter fails', () => {
    const file = makeFile({ name: 'report.pdf', size: 500 });
    const col: FileCollection = {
      id: 'test',
      name: 'Test',
      icon: '',
      color: '#3b82f6',
      basePath: '',
      createdAt: 0,
      updatedAt: 0,
      filters: [
        { type: 'extension', value: '.pdf' },
        { type: 'size_gt', value: '1000' },
      ],
    };
    expect(matchesCollection(file, col)).toBe(false);
  });

  it('returns true for collection with no filters', () => {
    const file = makeFile();
    const col: FileCollection = {
      id: 'test',
      name: 'Test',
      icon: '',
      color: '#3b82f6',
      basePath: '',
      createdAt: 0,
      updatedAt: 0,
      filters: [],
    };
    expect(matchesCollection(file, col)).toBe(true);
  });
});

// ── Helper constants ────────────────────────────────────────────────────

describe('filterTypeLabel', () => {
  it('returns human-readable labels for all types', () => {
    expect(filterTypeLabel('extension')).toBe('File Extension');
    expect(filterTypeLabel('size_gt')).toBe('Min Size (bytes)');
    expect(filterTypeLabel('size_lt')).toBe('Max Size (bytes)');
    expect(filterTypeLabel('modified_after')).toBe('Modified After');
    expect(filterTypeLabel('modified_before')).toBe('Modified Before');
    expect(filterTypeLabel('name_contains')).toBe('Name Contains');
    expect(filterTypeLabel('name_regex')).toBe('Name Regex');
    expect(filterTypeLabel('tag')).toBe('Has Tag');
    expect(filterTypeLabel('is_directory')).toBe('Is Directory');
    expect(filterTypeLabel('is_hidden')).toBe('Is Hidden');
  });

  it('falls back to stringified type for unknown type', () => {
    expect(filterTypeLabel('unknown' as unknown)).toBe('unknown');
  });
});

describe('constants', () => {
  it('FILTER_TYPES contains all 10 types', () => {
    expect(FILTER_TYPES).toHaveLength(10);
    expect(FILTER_TYPES).toContain('extension');
    expect(FILTER_TYPES).toContain('is_directory');
    expect(FILTER_TYPES).toContain('name_regex');
    expect(FILTER_TYPES).toContain('is_hidden');
  });

  it('COLLECTION_ICONS is non-empty', () => {
    expect(COLLECTION_ICONS.length).toBeGreaterThan(0);
  });
});
