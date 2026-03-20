import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the split-view types module
vi.mock('@/types/split-view', () => ({
  createDefaultLayout: vi.fn(() => ({
    rootNode: { type: 'leaf', groupId: 'default' },
    groups: {
      default: {
        id: 'default',
        tabs: [{ id: 'tab-home-default', name: 'Home', path: 'xplorer://home', type: 'folder' }],
        activeTabId: 'tab-home-default',
        currentPath: 'xplorer://home',
        pathHistory: ['xplorer://home'],
        historyIndex: 0,
      },
    },
    activeGroupId: 'default',
    maximizedGroupId: null,
  })),
}));

import {
  getLayouts,
  saveLayout,
  loadLayout,
  deleteLayout,
  renameLayout,
  getDefaultLayout,
  countTabs,
  type WorkspaceLayoutUiState,
} from '@/lib/workspace-layouts';
import type { SplitLayoutState } from '@/types/split-view';

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
});

// ── Test fixtures ───────────────────────────────────────────────────────

const makeLayoutState = (): SplitLayoutState => {
  return {
    rootNode: { type: 'leaf', groupId: 'g1' },
    groups: {
      g1: {
        id: 'g1',
        tabs: [
          { id: 't1', name: 'Tab 1', path: '/path/a', type: 'folder' as const },
          { id: 't2', name: 'Tab 2', path: '/path/b', type: 'file' as const },
        ],
        activeTabId: 't1',
        currentPath: '/path/a',
        pathHistory: ['/path/a'],
        historyIndex: 0,
      },
    },
    activeGroupId: 'g1',
    maximizedGroupId: null,
  };
};

const makeUiState = (): WorkspaceLayoutUiState => {
  return {
    viewMode: 'grid',
    theme: 'glass',
    leftSidebarCollapsed: false,
    rightSidebarCollapsed: true,
    bottomPanelCollapsed: false,
  };
};

// ── Tests ───────────────────────────────────────────────────────────────

describe('workspace-layouts', () => {
  describe('getLayouts', () => {
    it('returns empty array when no layouts saved', () => {
      expect(getLayouts()).toEqual([]);
    });
  });

  describe('saveLayout', () => {
    it('saves a layout and returns it', () => {
      const layout = saveLayout('My Layout', makeLayoutState(), makeUiState());

      expect(layout.id).toMatch(/^wl-/);
      expect(layout.name).toBe('My Layout');
      expect(layout.created).toBeGreaterThan(0);
      expect(layout.layout.activeGroupId).toBe('g1');
      expect(layout.uiState.viewMode).toBe('grid');
    });

    it('trims whitespace from name and defaults to "Untitled Layout"', () => {
      const layout = saveLayout('  ', makeLayoutState(), makeUiState());
      expect(layout.name).toBe('Untitled Layout');
    });

    it('returned layouts are sorted newest first', () => {
      saveLayout('First', makeLayoutState(), makeUiState());
      saveLayout('Second', makeLayoutState(), makeUiState());
      saveLayout('Third', makeLayoutState(), makeUiState());

      const all = getLayouts();
      expect(all).toHaveLength(3);
      expect(all[0].name).toBe('Third');
      expect(all[2].name).toBe('First');
    });

    it('enforces maximum of 10 layouts', () => {
      for (let i = 0; i < 12; i++) {
        saveLayout(`Layout ${i}`, makeLayoutState(), makeUiState());
      }
      expect(getLayouts()).toHaveLength(10);
    });

    it('keeps newest layouts when truncating', () => {
      for (let i = 0; i < 12; i++) {
        saveLayout(`Layout ${i}`, makeLayoutState(), makeUiState());
      }
      const all = getLayouts();
      // The most recent should be "Layout 11"
      expect(all[0].name).toBe('Layout 11');
    });
  });

  describe('loadLayout', () => {
    it('returns saved layout by id', () => {
      const saved = saveLayout('Load Test', makeLayoutState(), makeUiState());
      const loaded = loadLayout(saved.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('Load Test');
      expect(loaded!.layout.activeGroupId).toBe('g1');
    });

    it('returns null for non-existent id', () => {
      expect(loadLayout('nope')).toBeNull();
    });
  });

  describe('deleteLayout', () => {
    it('deletes a layout and returns true', () => {
      const saved = saveLayout('Delete Me', makeLayoutState(), makeUiState());
      expect(deleteLayout(saved.id)).toBe(true);
      expect(getLayouts()).toHaveLength(0);
    });

    it('returns false for non-existent id', () => {
      expect(deleteLayout('nope')).toBe(false);
    });
  });

  describe('renameLayout', () => {
    it('renames a layout and returns true', () => {
      const saved = saveLayout('Old Name', makeLayoutState(), makeUiState());
      expect(renameLayout(saved.id, 'New Name')).toBe(true);

      const loaded = loadLayout(saved.id);
      expect(loaded!.name).toBe('New Name');
    });

    it('trims whitespace from new name', () => {
      const saved = saveLayout('Original', makeLayoutState(), makeUiState());
      renameLayout(saved.id, '  Trimmed  ');
      expect(loadLayout(saved.id)!.name).toBe('Trimmed');
    });

    it('keeps original name when new name is empty/whitespace', () => {
      const saved = saveLayout('Keep This', makeLayoutState(), makeUiState());
      renameLayout(saved.id, '   ');
      expect(loadLayout(saved.id)!.name).toBe('Keep This');
    });

    it('returns false for non-existent id', () => {
      expect(renameLayout('nope', 'Fail')).toBe(false);
    });
  });

  describe('countTabs', () => {
    it('counts tabs across all editor groups', () => {
      const layout = makeLayoutState();
      expect(countTabs(layout)).toBe(2);
    });

    it('returns 0 for empty groups', () => {
      const layout: SplitLayoutState = {
        rootNode: { type: 'leaf', groupId: 'empty' },
        groups: {
          empty: {
            id: 'empty',
            tabs: [],
            activeTabId: '',
            currentPath: '',
            pathHistory: [],
            historyIndex: 0,
          },
        },
        activeGroupId: 'empty',
        maximizedGroupId: null,
      };
      expect(countTabs(layout)).toBe(0);
    });

    it('sums tabs across multiple groups', () => {
      const layout: SplitLayoutState = {
        rootNode: { type: 'leaf', groupId: 'g1' },
        groups: {
          g1: {
            id: 'g1',
            tabs: [{ id: 't1', name: 'A', path: '/a', type: 'file' as const }],
            activeTabId: 't1',
            currentPath: '/a',
            pathHistory: ['/a'],
            historyIndex: 0,
          },
          g2: {
            id: 'g2',
            tabs: [
              { id: 't2', name: 'B', path: '/b', type: 'file' as const },
              { id: 't3', name: 'C', path: '/c', type: 'file' as const },
              { id: 't4', name: 'D', path: '/d', type: 'file' as const },
            ],
            activeTabId: 't2',
            currentPath: '/b',
            pathHistory: ['/b'],
            historyIndex: 0,
          },
        },
        activeGroupId: 'g1',
        maximizedGroupId: null,
      };
      expect(countTabs(layout)).toBe(4);
    });
  });

  describe('getDefaultLayout', () => {
    it('returns a default layout', () => {
      const layout = getDefaultLayout();
      expect(layout).toBeDefined();
      expect(layout.rootNode).toBeDefined();
      expect(layout.groups).toBeDefined();
      expect(layout.activeGroupId).toBeDefined();
    });
  });

  describe('storage edge cases', () => {
    it('handles corrupted JSON', () => {
      store['xplorer:workspace-layouts'] = 'bad{';
      expect(getLayouts()).toEqual([]);
    });

    it('handles non-array JSON', () => {
      store['xplorer:workspace-layouts'] = '{"id": "oops"}';
      expect(getLayouts()).toEqual([]);
    });
  });
});
