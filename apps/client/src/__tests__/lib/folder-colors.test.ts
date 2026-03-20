import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getFolderColor,
  setFolderColor,
  removeFolderColor,
  getAllFolderColors,
  getFolderColorHex,
  getColorHex,
  FOLDER_COLORS,
} from '@/lib/folder-colors';

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

// ── Tests ───────────────────────────────────────────────────────────────

describe('folder-colors', () => {
  describe('FOLDER_COLORS palette', () => {
    it('has 8 predefined colors', () => {
      expect(FOLDER_COLORS).toHaveLength(8);
    });

    it('each color has id, hex, and label', () => {
      for (const color of FOLDER_COLORS) {
        expect(color.id).toBeTruthy();
        expect(color.hex).toMatch(/^#[0-9a-f]{6}$/i);
        expect(color.label).toBeTruthy();
      }
    });
  });

  describe('getColorHex', () => {
    it('returns hex for known color ids', () => {
      expect(getColorHex('red')).toBe('#ef4444');
      expect(getColorHex('blue')).toBe('#3b82f6');
      expect(getColorHex('green')).toBe('#22c55e');
    });

    it('returns null for unknown color id', () => {
      expect(getColorHex('magenta')).toBeNull();
    });
  });

  describe('setFolderColor / getFolderColor', () => {
    it('returns null when no color is set', () => {
      expect(getFolderColor('/home/user/docs')).toBeNull();
    });

    it('sets and retrieves a folder color', () => {
      setFolderColor('/home/user/docs', 'red', 'Urgent');
      const result = getFolderColor('/home/user/docs');
      expect(result).toEqual({
        path: '/home/user/docs',
        colorId: 'red',
        label: 'Urgent',
      });
    });

    it('updates an existing folder color', () => {
      setFolderColor('/home/user/docs', 'red');
      setFolderColor('/home/user/docs', 'blue', 'Archive');

      const result = getFolderColor('/home/user/docs');
      expect(result!.colorId).toBe('blue');
      expect(result!.label).toBe('Archive');
    });

    it('handles multiple folders independently', () => {
      setFolderColor('/path/a', 'red');
      setFolderColor('/path/b', 'green');

      expect(getFolderColor('/path/a')!.colorId).toBe('red');
      expect(getFolderColor('/path/b')!.colorId).toBe('green');
    });

    it('dispatches folder-colors-changed event on set', () => {
      setFolderColor('/path/a', 'red');
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'folder-colors-changed' }),
      );
    });
  });

  describe('removeFolderColor', () => {
    it('removes an existing color assignment', () => {
      setFolderColor('/home/user/docs', 'red');
      removeFolderColor('/home/user/docs');
      expect(getFolderColor('/home/user/docs')).toBeNull();
    });

    it('does not dispatch event when path not found', () => {
      // Clear any previous dispatch calls from beforeEach
      (window.dispatchEvent as ReturnType<typeof vi.fn>).mockClear();
      removeFolderColor('/nonexistent');
      // Should NOT dispatch because nothing changed
      expect(window.dispatchEvent).not.toHaveBeenCalled();
    });

    it('dispatches event when a color is actually removed', () => {
      setFolderColor('/path/a', 'blue');
      (window.dispatchEvent as ReturnType<typeof vi.fn>).mockClear();
      removeFolderColor('/path/a');
      expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAllFolderColors', () => {
    it('returns empty array when none set', () => {
      expect(getAllFolderColors()).toEqual([]);
    });

    it('returns all assigned colors', () => {
      setFolderColor('/a', 'red');
      setFolderColor('/b', 'blue');
      const all = getAllFolderColors();
      expect(all).toHaveLength(2);
    });
  });

  describe('getFolderColorHex', () => {
    it('returns hex string for a folder with a known color', () => {
      setFolderColor('/docs', 'purple');
      expect(getFolderColorHex('/docs')).toBe('#a855f7');
    });

    it('returns null for folder with no color', () => {
      expect(getFolderColorHex('/unknown')).toBeNull();
    });

    it('returns null for folder with unknown color id', () => {
      // Manually inject a folder with an unknown color id
      store['xplorer:folder-colors'] = JSON.stringify([{ path: '/test', colorId: 'neon' }]);
      expect(getFolderColorHex('/test')).toBeNull();
    });
  });

  describe('storage edge cases', () => {
    it('handles corrupted JSON', () => {
      store['xplorer:folder-colors'] = '{bad';
      expect(getAllFolderColors()).toEqual([]);
    });
  });
});
