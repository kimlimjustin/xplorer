import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSavedSearches,
  saveSearch,
  deleteSavedSearch,
  renameSavedSearch,
  type SavedSearch,
} from '@/lib/saved-searches';

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

// ── getSavedSearches ──────────────────────────────────────────────────────

describe('getSavedSearches', () => {
  it('returns empty array when nothing is stored', () => {
    expect(getSavedSearches()).toEqual([]);
  });

  it('returns parsed searches from localStorage', () => {
    const searches: SavedSearch[] = [
      {
        id: 's1',
        name: 'My Search',
        query: 'hello',
        filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
        created: 1000,
      },
    ];
    store['xplorer:saved-searches'] = JSON.stringify(searches);
    expect(getSavedSearches()).toEqual(searches);
  });

  it('returns empty array for corrupted JSON', () => {
    store['xplorer:saved-searches'] = '{not valid json';
    expect(getSavedSearches()).toEqual([]);
  });

  it('returns empty array when stored value is not an array', () => {
    store['xplorer:saved-searches'] = '{"key": "value"}';
    expect(getSavedSearches()).toEqual([]);
  });

  it('truncates to MAX_SAVED (20) entries', () => {
    const searches: SavedSearch[] = Array.from({ length: 25 }, (_, i) => ({
      id: `s${i}`,
      name: `Search ${i}`,
      query: `query${i}`,
      filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
      created: i,
    }));
    store['xplorer:saved-searches'] = JSON.stringify(searches);
    expect(getSavedSearches()).toHaveLength(20);
  });
});

// ── saveSearch ────────────────────────────────────────────────────────────

describe('saveSearch', () => {
  it('creates a search with generated id and timestamp', () => {
    const result = saveSearch({
      name: 'Test Search',
      query: '*.pdf',
      filters: { fileTypes: ['pdf'], dateRange: null, sizeRange: null, extensions: ['.pdf'] },
    });

    expect(result.id).toBeTruthy();
    expect(result.created).toBeGreaterThan(0);
    expect(result.name).toBe('Test Search');
    expect(result.query).toBe('*.pdf');
  });

  it('prepends new search to the list (most recent first)', () => {
    saveSearch({
      name: 'First',
      query: 'first',
      filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
    });
    saveSearch({
      name: 'Second',
      query: 'second',
      filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
    });

    const all = getSavedSearches();
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe('Second');
    expect(all[1].name).toBe('First');
  });

  it('enforces max 20 saved searches', () => {
    for (let i = 0; i < 22; i++) {
      saveSearch({
        name: `Search ${i}`,
        query: `q${i}`,
        filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
      });
    }

    const all = getSavedSearches();
    expect(all.length).toBeLessThanOrEqual(20);
  });

  it('dispatches saved-searches-changed event', () => {
    saveSearch({
      name: 'Event Test',
      query: 'test',
      filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
    });

    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'saved-searches-changed' }),
    );
  });

  it('persists to localStorage', () => {
    saveSearch({
      name: 'Persist',
      query: 'persist',
      filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
    });

    expect(localStorage.setItem).toHaveBeenCalledWith('xplorer:saved-searches', expect.any(String));
  });
});

// ── deleteSavedSearch ────────────────────────────────────────────────────

describe('deleteSavedSearch', () => {
  it('removes a search by id', () => {
    const s = saveSearch({
      name: 'Delete me',
      query: 'bye',
      filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
    });

    deleteSavedSearch(s.id);
    expect(getSavedSearches()).toHaveLength(0);
  });

  it('does not remove other searches', () => {
    const s1 = saveSearch({
      name: 'Keep',
      query: 'keep',
      filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
    });
    const s2 = saveSearch({
      name: 'Remove',
      query: 'remove',
      filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
    });

    deleteSavedSearch(s2.id);
    const remaining = getSavedSearches();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(s1.id);
  });

  it('is a no-op for non-existent id', () => {
    saveSearch({
      name: 'Only',
      query: 'only',
      filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
    });

    deleteSavedSearch('nonexistent');
    expect(getSavedSearches()).toHaveLength(1);
  });

  it('dispatches saved-searches-changed event', () => {
    const s = saveSearch({
      name: 'Evt',
      query: 'evt',
      filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
    });
    vi.mocked(window.dispatchEvent).mockClear();

    deleteSavedSearch(s.id);
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'saved-searches-changed' }),
    );
  });
});

// ── renameSavedSearch ────────────────────────────────────────────────────

describe('renameSavedSearch', () => {
  it('renames an existing search', () => {
    const s = saveSearch({
      name: 'Old Name',
      query: 'old',
      filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
    });

    renameSavedSearch(s.id, 'New Name');
    const all = getSavedSearches();
    expect(all.find((x) => x.id === s.id)!.name).toBe('New Name');
  });

  it('is a no-op for non-existent id', () => {
    saveSearch({
      name: 'Original',
      query: 'orig',
      filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
    });

    renameSavedSearch('nonexistent', 'Changed');
    expect(getSavedSearches()[0].name).toBe('Original');
  });

  it('dispatches saved-searches-changed event', () => {
    const s = saveSearch({
      name: 'Evt',
      query: 'evt',
      filters: { fileTypes: [], dateRange: null, sizeRange: null, extensions: [] },
    });
    vi.mocked(window.dispatchEvent).mockClear();

    renameSavedSearch(s.id, 'Renamed');
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'saved-searches-changed' }),
    );
  });

  it('preserves other fields when renaming', () => {
    const s = saveSearch({
      name: 'Original',
      query: 'specific-query',
      filters: { fileTypes: ['pdf'], dateRange: null, sizeRange: null, extensions: ['.pdf'] },
    });

    renameSavedSearch(s.id, 'Renamed');
    const updated = getSavedSearches().find((x) => x.id === s.id)!;
    expect(updated.query).toBe('specific-query');
    expect(updated.filters.fileTypes).toEqual(['pdf']);
  });
});
