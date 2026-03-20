import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getContextMenuRules,
  createRule,
  updateRule,
  deleteRule,
  resetRules,
  getAvailableMenuItems,
  shouldShowMenuItem,
  type ContextMenuRule,
} from '@/lib/context-menu-rules';
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
});

// ── Helper ────────────────────────────────────────────────────────────────

const makeFile = (overrides: Partial<FileEntry> = {}): FileEntry => {
  return {
    name: 'test.txt',
    path: '/home/user/test.txt',
    size: 1024,
    is_dir: false,
    modified: Date.now() / 1000,
    file_type: 'text/plain',
    ...overrides,
  };
};

// ── CRUD Tests ────────────────────────────────────────────────────────────

describe('getContextMenuRules', () => {
  it('returns empty array when no rules stored', () => {
    expect(getContextMenuRules()).toEqual([]);
  });

  it('returns parsed rules from localStorage', () => {
    const rules: ContextMenuRule[] = [
      {
        id: 'r1',
        menuItemId: 'open',
        menuItemLabel: 'Open',
        condition: 'show_only_for',
        matcher: { type: 'extension', value: '.txt' },
        enabled: true,
      },
    ];
    store['xplorer:context-menu-rules'] = JSON.stringify(rules);
    expect(getContextMenuRules()).toEqual(rules);
  });

  it('returns empty array for corrupted JSON', () => {
    store['xplorer:context-menu-rules'] = 'not-valid-json!!!';
    expect(getContextMenuRules()).toEqual([]);
  });
});

describe('createRule', () => {
  it('creates a rule with a generated id and persists it', () => {
    const rule = createRule({
      menuItemId: 'delete',
      menuItemLabel: 'Delete',
      condition: 'hide_for',
      matcher: { type: 'is_directory', value: 'true' },
      enabled: true,
    });

    expect(rule.id).toBeTruthy();
    expect(rule.menuItemId).toBe('delete');
    expect(rule.condition).toBe('hide_for');
    expect(rule.enabled).toBe(true);

    const all = getContextMenuRules();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(rule.id);
  });

  it('appends to existing rules', () => {
    createRule({
      menuItemId: 'open',
      menuItemLabel: 'Open',
      condition: 'show_only_for',
      matcher: { type: 'extension', value: '.txt' },
      enabled: true,
    });
    createRule({
      menuItemId: 'delete',
      menuItemLabel: 'Delete',
      condition: 'hide_for',
      matcher: { type: 'is_directory', value: 'true' },
      enabled: false,
    });

    expect(getContextMenuRules()).toHaveLength(2);
  });
});

describe('updateRule', () => {
  it('updates an existing rule by id', () => {
    const rule = createRule({
      menuItemId: 'open',
      menuItemLabel: 'Open',
      condition: 'show_only_for',
      matcher: { type: 'extension', value: '.txt' },
      enabled: true,
    });

    updateRule(rule.id, { enabled: false });

    const updated = getContextMenuRules().find((r) => r.id === rule.id);
    expect(updated!.enabled).toBe(false);
    expect(updated!.menuItemId).toBe('open'); // unchanged fields preserved
  });

  it('is a no-op for non-existent id', () => {
    createRule({
      menuItemId: 'open',
      menuItemLabel: 'Open',
      condition: 'show_only_for',
      matcher: { type: 'extension', value: '.txt' },
      enabled: true,
    });

    updateRule('nonexistent', { enabled: false });

    const all = getContextMenuRules();
    expect(all).toHaveLength(1);
    expect(all[0].enabled).toBe(true);
  });
});

describe('deleteRule', () => {
  it('removes a rule by id', () => {
    const rule = createRule({
      menuItemId: 'open',
      menuItemLabel: 'Open',
      condition: 'show_only_for',
      matcher: { type: 'extension', value: '.txt' },
      enabled: true,
    });

    deleteRule(rule.id);
    expect(getContextMenuRules()).toHaveLength(0);
  });

  it('does not remove other rules', () => {
    const r1 = createRule({
      menuItemId: 'open',
      menuItemLabel: 'Open',
      condition: 'show_only_for',
      matcher: { type: 'extension', value: '.txt' },
      enabled: true,
    });
    const r2 = createRule({
      menuItemId: 'delete',
      menuItemLabel: 'Delete',
      condition: 'hide_for',
      matcher: { type: 'is_directory', value: 'true' },
      enabled: true,
    });

    deleteRule(r1.id);
    const remaining = getContextMenuRules();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(r2.id);
  });
});

describe('resetRules', () => {
  it('clears all rules from localStorage', () => {
    createRule({
      menuItemId: 'open',
      menuItemLabel: 'Open',
      condition: 'show_only_for',
      matcher: { type: 'extension', value: '.txt' },
      enabled: true,
    });

    resetRules();
    expect(getContextMenuRules()).toEqual([]);
    expect(localStorage.removeItem).toHaveBeenCalledWith('xplorer:context-menu-rules');
  });
});

describe('getAvailableMenuItems', () => {
  it('returns a non-empty array of known menu items', () => {
    const items = getAvailableMenuItems();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toHaveProperty('id');
    expect(items[0]).toHaveProperty('label');
  });

  it('contains the "open" menu item', () => {
    const items = getAvailableMenuItems();
    expect(items.find((i) => i.id === 'open')).toBeDefined();
  });

  it('contains the "delete" menu item', () => {
    const items = getAvailableMenuItems();
    expect(items.find((i) => i.id === 'delete')).toBeDefined();
  });
});

// ── shouldShowMenuItem (rule evaluation logic) ────────────────────────────

describe('shouldShowMenuItem', () => {
  it('returns true when no rules exist', () => {
    const file = makeFile();
    expect(shouldShowMenuItem('open', file)).toBe(true);
  });

  it('returns true when only disabled rules exist', () => {
    createRule({
      menuItemId: 'open',
      menuItemLabel: 'Open',
      condition: 'hide_for',
      matcher: { type: 'extension', value: '.txt' },
      enabled: false,
    });

    const file = makeFile({ name: 'readme.txt' });
    expect(shouldShowMenuItem('open', file)).toBe(true);
  });

  it('returns true when rules target a different menu item', () => {
    createRule({
      menuItemId: 'delete',
      menuItemLabel: 'Delete',
      condition: 'hide_for',
      matcher: { type: 'extension', value: '.txt' },
      enabled: true,
    });

    const file = makeFile({ name: 'readme.txt' });
    expect(shouldShowMenuItem('open', file)).toBe(true);
  });

  describe('hide_for rules', () => {
    it('hides item when file matches a hide_for rule', () => {
      createRule({
        menuItemId: 'open',
        menuItemLabel: 'Open',
        condition: 'hide_for',
        matcher: { type: 'extension', value: '.exe' },
        enabled: true,
      });

      expect(shouldShowMenuItem('open', makeFile({ name: 'app.exe' }))).toBe(false);
    });

    it('shows item when file does not match hide_for rule', () => {
      createRule({
        menuItemId: 'open',
        menuItemLabel: 'Open',
        condition: 'hide_for',
        matcher: { type: 'extension', value: '.exe' },
        enabled: true,
      });

      expect(shouldShowMenuItem('open', makeFile({ name: 'readme.txt' }))).toBe(true);
    });
  });

  describe('show_only_for rules', () => {
    it('shows item when file matches show_only_for rule', () => {
      createRule({
        menuItemId: 'compress',
        menuItemLabel: 'Add to archive...',
        condition: 'show_only_for',
        matcher: { type: 'is_directory', value: 'true' },
        enabled: true,
      });

      expect(shouldShowMenuItem('compress', makeFile({ is_dir: true }))).toBe(true);
    });

    it('hides item when file does not match any show_only_for rule', () => {
      createRule({
        menuItemId: 'compress',
        menuItemLabel: 'Add to archive...',
        condition: 'show_only_for',
        matcher: { type: 'is_directory', value: 'true' },
        enabled: true,
      });

      expect(shouldShowMenuItem('compress', makeFile({ is_dir: false }))).toBe(false);
    });
  });

  describe('combined show_only_for + hide_for', () => {
    it('show_only_for filters first, then hide_for is applied on top', () => {
      // show_only_for: images
      createRule({
        menuItemId: 'open-with',
        menuItemLabel: 'Open with...',
        condition: 'show_only_for',
        matcher: { type: 'extension', value: '.jpg,.png,.gif' },
        enabled: true,
      });
      // hide_for: specifically .gif
      createRule({
        menuItemId: 'open-with',
        menuItemLabel: 'Open with...',
        condition: 'hide_for',
        matcher: { type: 'extension', value: '.gif' },
        enabled: true,
      });

      // .jpg passes show_only_for and not hidden
      expect(shouldShowMenuItem('open-with', makeFile({ name: 'photo.jpg' }))).toBe(true);
      // .gif passes show_only_for but IS hidden
      expect(shouldShowMenuItem('open-with', makeFile({ name: 'anim.gif' }))).toBe(false);
      // .txt fails show_only_for => hidden
      expect(shouldShowMenuItem('open-with', makeFile({ name: 'readme.txt' }))).toBe(false);
    });
  });

  describe('matcher: extension', () => {
    it('matches comma-separated extensions', () => {
      createRule({
        menuItemId: 'open',
        menuItemLabel: 'Open',
        condition: 'show_only_for',
        matcher: { type: 'extension', value: '.jpg, .png, .gif' },
        enabled: true,
      });

      expect(shouldShowMenuItem('open', makeFile({ name: 'photo.jpg' }))).toBe(true);
      expect(shouldShowMenuItem('open', makeFile({ name: 'icon.PNG' }))).toBe(true);
      expect(shouldShowMenuItem('open', makeFile({ name: 'doc.pdf' }))).toBe(false);
    });

    it('handles extensions without leading dot', () => {
      createRule({
        menuItemId: 'open',
        menuItemLabel: 'Open',
        condition: 'show_only_for',
        matcher: { type: 'extension', value: 'txt' },
        enabled: true,
      });

      expect(shouldShowMenuItem('open', makeFile({ name: 'readme.txt' }))).toBe(true);
    });

    it('returns false for file without extension', () => {
      createRule({
        menuItemId: 'open',
        menuItemLabel: 'Open',
        condition: 'show_only_for',
        matcher: { type: 'extension', value: '.txt' },
        enabled: true,
      });

      expect(shouldShowMenuItem('open', makeFile({ name: 'Makefile' }))).toBe(false);
    });
  });

  describe('matcher: file_type', () => {
    it('matches exact file_type', () => {
      createRule({
        menuItemId: 'open',
        menuItemLabel: 'Open',
        condition: 'show_only_for',
        matcher: { type: 'file_type', value: 'text/plain' },
        enabled: true,
      });

      expect(shouldShowMenuItem('open', makeFile({ file_type: 'text/plain' }))).toBe(true);
      expect(shouldShowMenuItem('open', makeFile({ file_type: 'image/png' }))).toBe(false);
    });

    it('matches wildcard file_type like image/*', () => {
      createRule({
        menuItemId: 'open',
        menuItemLabel: 'Open',
        condition: 'show_only_for',
        matcher: { type: 'file_type', value: 'image/*' },
        enabled: true,
      });

      expect(shouldShowMenuItem('open', makeFile({ file_type: 'image/png' }))).toBe(true);
      expect(shouldShowMenuItem('open', makeFile({ file_type: 'image/jpeg' }))).toBe(true);
      expect(shouldShowMenuItem('open', makeFile({ file_type: 'text/plain' }))).toBe(false);
    });

    it('returns false for empty pattern', () => {
      createRule({
        menuItemId: 'open',
        menuItemLabel: 'Open',
        condition: 'show_only_for',
        matcher: { type: 'file_type', value: '' },
        enabled: true,
      });

      expect(shouldShowMenuItem('open', makeFile({ file_type: 'text/plain' }))).toBe(false);
    });
  });

  describe('matcher: name_pattern', () => {
    it('matches exact name (case-insensitive)', () => {
      createRule({
        menuItemId: 'open',
        menuItemLabel: 'Open',
        condition: 'show_only_for',
        matcher: { type: 'name_pattern', value: 'readme.md' },
        enabled: true,
      });

      expect(shouldShowMenuItem('open', makeFile({ name: 'README.md' }))).toBe(true);
      expect(shouldShowMenuItem('open', makeFile({ name: 'readme.md' }))).toBe(true);
      expect(shouldShowMenuItem('open', makeFile({ name: 'other.md' }))).toBe(false);
    });

    it('matches wildcard pattern', () => {
      createRule({
        menuItemId: 'open',
        menuItemLabel: 'Open',
        condition: 'show_only_for',
        matcher: { type: 'name_pattern', value: '*.md' },
        enabled: true,
      });

      expect(shouldShowMenuItem('open', makeFile({ name: 'README.md' }))).toBe(true);
      expect(shouldShowMenuItem('open', makeFile({ name: 'notes.md' }))).toBe(true);
      expect(shouldShowMenuItem('open', makeFile({ name: 'notes.txt' }))).toBe(false);
    });

    it('matches prefix wildcard', () => {
      createRule({
        menuItemId: 'open',
        menuItemLabel: 'Open',
        condition: 'show_only_for',
        matcher: { type: 'name_pattern', value: 'readme*' },
        enabled: true,
      });

      expect(shouldShowMenuItem('open', makeFile({ name: 'README.md' }))).toBe(true);
      expect(shouldShowMenuItem('open', makeFile({ name: 'readme' }))).toBe(true);
      expect(shouldShowMenuItem('open', makeFile({ name: 'changelog.md' }))).toBe(false);
    });

    it('returns false for empty pattern', () => {
      createRule({
        menuItemId: 'open',
        menuItemLabel: 'Open',
        condition: 'show_only_for',
        matcher: { type: 'name_pattern', value: '' },
        enabled: true,
      });

      expect(shouldShowMenuItem('open', makeFile({ name: 'anything.txt' }))).toBe(false);
    });
  });

  describe('matcher: is_directory', () => {
    it('matches directories when value is "true"', () => {
      createRule({
        menuItemId: 'open-terminal',
        menuItemLabel: 'Open in Terminal',
        condition: 'show_only_for',
        matcher: { type: 'is_directory', value: 'true' },
        enabled: true,
      });

      expect(shouldShowMenuItem('open-terminal', makeFile({ is_dir: true }))).toBe(true);
      expect(shouldShowMenuItem('open-terminal', makeFile({ is_dir: false }))).toBe(false);
    });

    it('matches files when value is "false"', () => {
      createRule({
        menuItemId: 'open',
        menuItemLabel: 'Open',
        condition: 'show_only_for',
        matcher: { type: 'is_directory', value: 'false' },
        enabled: true,
      });

      expect(shouldShowMenuItem('open', makeFile({ is_dir: false }))).toBe(true);
      expect(shouldShowMenuItem('open', makeFile({ is_dir: true }))).toBe(false);
    });
  });
});
