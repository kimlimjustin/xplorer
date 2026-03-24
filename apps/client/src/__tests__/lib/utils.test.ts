import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FileEntry, FolderSizeInfo } from '@/lib/tauri-api';

// The global setup.ts mocks @/lib/utils. We need to unmock it so we can test
// the real implementation. We still need lucide-react mocked (done in setup.ts).
vi.unmock('@/lib/utils');

import {
  cn,
  isVideoFile,
  isAudioFile,
  formatFileSize,
  formatFolderSize,
  formatDate,
  sortFiles,
  getDateGroup,
  groupFilesByDate,
  themes,
  slugifyThemeName,
  loadCustomThemes,
  saveCustomThemes,
  applyFontSize,
  loadFontSize,
  applyTheme,
  applyCustomThemeVars,
  type CustomThemeColors,
  type SortField,
} from '@/lib/utils';

// ── localStorage + document mocks ─────────────────────────────────────────

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

  // Reset document.documentElement mock classes and styles
  const classList = new Set<string>();
  vi.stubGlobal('document', {
    documentElement: {
      classList: {
        add: vi.fn((cls: string) => classList.add(cls)),
        remove: vi.fn((cls: string) => classList.delete(cls)),
        forEach: vi.fn((fn: (cls: string) => void) => classList.forEach(fn)),
        contains: vi.fn((cls: string) => classList.has(cls)),
      },
      style: {
        setProperty: vi.fn(),
      },
    },
  });
});

// ── Helper ────────────────────────────────────────────────────────────────

const makeFile = (overrides: Partial<FileEntry> = {}): FileEntry => {
  return {
    name: 'test.txt',
    path: '/home/user/test.txt',
    size: 1024,
    is_dir: false,
    modified: 1700000000,
    file_type: 'text/plain',
    ...overrides,
  };
};

// ── cn ────────────────────────────────────────────────────────────────────

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    const isHidden = false;
    expect(cn('base', isHidden && 'hidden', 'visible')).toBe('base visible');
  });

  it('deduplicates Tailwind classes via twMerge', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('handles undefined and null', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b');
  });
});

// ── isVideoFile ───────────────────────────────────────────────────────────

describe('isVideoFile', () => {
  it('returns true for video extensions', () => {
    expect(isVideoFile('movie.mp4')).toBe(true);
    expect(isVideoFile('clip.webm')).toBe(true);
    expect(isVideoFile('film.mkv')).toBe(true);
    expect(isVideoFile('vid.avi')).toBe(true);
    expect(isVideoFile('screen.mov')).toBe(true);
    expect(isVideoFile('video.m4v')).toBe(true);
    expect(isVideoFile('stream.ogv')).toBe(true);
  });

  it('returns false for non-video extensions', () => {
    expect(isVideoFile('song.mp3')).toBe(false);
    expect(isVideoFile('doc.pdf')).toBe(false);
    expect(isVideoFile('image.png')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isVideoFile('MOVIE.MP4')).toBe(true);
    expect(isVideoFile('Video.MKV')).toBe(true);
  });

  it('returns false for file without extension', () => {
    expect(isVideoFile('noext')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isVideoFile('')).toBe(false);
  });
});

// ── isAudioFile ───────────────────────────────────────────────────────────

describe('isAudioFile', () => {
  it('returns true for audio extensions', () => {
    expect(isAudioFile('song.mp3')).toBe(true);
    expect(isAudioFile('sound.wav')).toBe(true);
    expect(isAudioFile('track.ogg')).toBe(true);
    expect(isAudioFile('music.flac')).toBe(true);
    expect(isAudioFile('audio.m4a')).toBe(true);
    expect(isAudioFile('clip.aac')).toBe(true);
    expect(isAudioFile('old.wma')).toBe(true);
    expect(isAudioFile('voice.opus')).toBe(true);
    expect(isAudioFile('lossless.aiff')).toBe(true);
  });

  it('returns false for non-audio extensions', () => {
    expect(isAudioFile('video.mp4')).toBe(false);
    expect(isAudioFile('doc.txt')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isAudioFile('SONG.MP3')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isAudioFile('')).toBe(false);
  });
});

// ── formatFileSize ────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('returns "Calculating..." when isCalculating is true', () => {
    expect(formatFileSize(1000, true)).toBe('Calculating...');
  });

  it('returns "0 B" for 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('returns "0 B" for negative values', () => {
    expect(formatFileSize(-100)).toBe('0 B');
  });

  it('returns "0 B" for NaN', () => {
    expect(formatFileSize(NaN)).toBe('0 B');
  });

  it('returns "0 B" for Infinity', () => {
    expect(formatFileSize(Infinity)).toBe('0 B');
  });

  it('formats bytes correctly', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes correctly', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes correctly', () => {
    expect(formatFileSize(1048576)).toBe('1 MB');
  });

  it('formats gigabytes correctly', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB');
  });

  it('formats terabytes correctly', () => {
    expect(formatFileSize(1099511627776)).toBe('1 TB');
  });
});

// ── formatFolderSize ──────────────────────────────────────────────────────

describe('formatFolderSize', () => {
  it('returns "Calculating..." when isCalculating is true', () => {
    expect(formatFolderSize(null, true)).toBe('Calculating...');
  });

  it('returns em-dash for null info', () => {
    expect(formatFolderSize(null)).toBe('\u2014');
  });

  it('returns "Empty" for zero items', () => {
    const info: FolderSizeInfo = { total_size: 0, file_count: 0, dir_count: 0 };
    expect(formatFolderSize(info)).toBe('Empty');
  });

  it('formats size with item count', () => {
    const info: FolderSizeInfo = { total_size: 2048, file_count: 3, dir_count: 1 };
    expect(formatFolderSize(info)).toBe('2 KB (4 items)');
  });
});

// ── formatDate ────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('returns em-dash for 0 timestamp', () => {
    expect(formatDate(0)).toBe('\u2014');
  });

  it('returns em-dash for NaN', () => {
    expect(formatDate(NaN)).toBe('\u2014');
  });

  it('returns em-dash for Infinity', () => {
    expect(formatDate(Infinity)).toBe('\u2014');
  });

  it('returns a formatted date string for valid timestamp', () => {
    const result = formatDate(1700000000);
    expect(result).not.toBe('\u2014');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── sortFiles ─────────────────────────────────────────────────────────────

describe('sortFiles', () => {
  const dirA = makeFile({ name: 'alpha', is_dir: true, size: 0, modified: 1000 });
  const fileB = makeFile({
    name: 'beta.txt',
    is_dir: false,
    size: 200,
    modified: 2000,
    file_type: 'text/plain',
  });
  const fileC = makeFile({
    name: 'charlie.js',
    is_dir: false,
    size: 100,
    modified: 3000,
    file_type: 'application/javascript',
  });

  it('always puts directories first', () => {
    const sorted = sortFiles([fileB, dirA, fileC], 'name', 'asc');
    expect(sorted[0].name).toBe('alpha');
    expect(sorted[0].is_dir).toBe(true);
  });

  it('sorts by name ascending', () => {
    const sorted = sortFiles([fileC, fileB], 'name', 'asc');
    expect(sorted.map((f) => f.name)).toEqual(['beta.txt', 'charlie.js']);
  });

  it('sorts by name descending', () => {
    const sorted = sortFiles([fileB, fileC], 'name', 'desc');
    expect(sorted.map((f) => f.name)).toEqual(['charlie.js', 'beta.txt']);
  });

  it('sorts by dateModified ascending', () => {
    const sorted = sortFiles([fileC, fileB], 'dateModified', 'asc');
    expect(sorted[0].name).toBe('beta.txt');
  });

  it('sorts by size ascending', () => {
    const sorted = sortFiles([fileB, fileC], 'size', 'asc');
    expect(sorted[0].name).toBe('charlie.js');
  });

  it('sorts by type ascending', () => {
    const sorted = sortFiles([fileB, fileC], 'type', 'asc');
    expect(sorted[0].file_type).toBe('application/javascript');
  });

  it('sorts by extension ascending', () => {
    const sorted = sortFiles([fileB, fileC], 'extension', 'asc');
    expect(sorted[0].name).toBe('charlie.js');
  });

  it('does not mutate the original array', () => {
    const original = [fileC, fileB];
    const sorted = sortFiles(original, 'name', 'asc');
    expect(original[0].name).toBe('charlie.js');
    expect(sorted[0].name).toBe('beta.txt');
  });

  it('uses natural sort (numeric awareness)', () => {
    const f2 = makeFile({ name: 'file2.txt' });
    const f10 = makeFile({ name: 'file10.txt' });
    const sorted = sortFiles([f10, f2], 'name', 'asc');
    expect(sorted[0].name).toBe('file2.txt');
    expect(sorted[1].name).toBe('file10.txt');
  });

  it('falls back to name sort for unknown sortBy', () => {
    const sorted = sortFiles([fileC, fileB], 'unknown' as SortField, 'asc');
    expect(sorted[0].name).toBe('beta.txt');
  });

  it('handles empty array', () => {
    expect(sortFiles([], 'name', 'asc')).toEqual([]);
  });

  it('handles single-element array', () => {
    const sorted = sortFiles([fileB], 'name', 'asc');
    expect(sorted).toHaveLength(1);
  });
});

// ── getDateGroup ──────────────────────────────────────────────────────────

describe('getDateGroup', () => {
  it('returns "Today" for current timestamp', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(getDateGroup(nowSeconds)).toBe('Today');
  });

  it('returns "Older" for very old timestamp', () => {
    const old = new Date('2020-01-01T00:00:00Z').getTime() / 1000;
    expect(getDateGroup(old)).toBe('Older');
  });

  it('returns "Yesterday" for yesterday timestamp', () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0);
    const ts = Math.floor(yesterday.getTime() / 1000);
    expect(getDateGroup(ts)).toBe('Yesterday');
  });
});

// ── groupFilesByDate ──────────────────────────────────────────────────────

describe('groupFilesByDate', () => {
  it('returns empty array for empty input', () => {
    expect(groupFilesByDate([])).toEqual([]);
  });

  it('groups files and omits empty groups', () => {
    const now = Math.floor(Date.now() / 1000);
    const old = Math.floor(new Date('2020-01-01').getTime() / 1000);

    const files = [
      makeFile({ name: 'today.txt', modified: now }),
      makeFile({ name: 'old.txt', modified: old }),
    ];

    const groups = groupFilesByDate(files);
    expect(groups.length).toBeGreaterThanOrEqual(2);

    const groupNames = groups.map((g) => g.group);
    expect(groupNames).toContain('Today');
    expect(groupNames).toContain('Older');

    const todayGroup = groups.find((g) => g.group === 'Today')!;
    expect(todayGroup.files).toHaveLength(1);
    expect(todayGroup.files[0].name).toBe('today.txt');
  });

  it('preserves date group ordering (Today first, Older last)', () => {
    const now = Math.floor(Date.now() / 1000);
    const old = Math.floor(new Date('2020-01-01').getTime() / 1000);

    const files = [
      makeFile({ name: 'old.txt', modified: old }),
      makeFile({ name: 'today.txt', modified: now }),
    ];

    const groups = groupFilesByDate(files);
    const groupNames = groups.map((g) => g.group);
    const todayIdx = groupNames.indexOf('Today');
    const olderIdx = groupNames.indexOf('Older');
    expect(todayIdx).toBeLessThan(olderIdx);
  });
});

// ── themes ────────────────────────────────────────────────────────────────

describe('themes', () => {
  it('has glass and light themes', () => {
    expect(themes).toHaveProperty('glass');
    expect(themes).toHaveProperty('light');
  });

  it('glass theme has expected structure', () => {
    expect(themes.glass.name).toBe('Xplorer Glass');
    expect(themes.glass.primary).toBeTruthy();
    expect(themes.glass.bg).toBeDefined();
    expect(themes.glass.surface).toBeDefined();
    expect(themes.glass.text).toBeDefined();
  });
});

// ── slugifyThemeName ──────────────────────────────────────────────────────

describe('slugifyThemeName', () => {
  it('converts to lowercase kebab-case', () => {
    expect(slugifyThemeName('My Custom Theme')).toBe('my-custom-theme');
  });

  it('strips leading/trailing hyphens', () => {
    expect(slugifyThemeName('--test--')).toBe('test');
  });

  it('replaces special characters', () => {
    expect(slugifyThemeName('Theme @#$ Name!')).toBe('theme-name');
  });

  it('handles empty string', () => {
    expect(slugifyThemeName('')).toBe('');
  });

  it('handles whitespace-only string', () => {
    expect(slugifyThemeName('   ')).toBe('');
  });

  it('collapses multiple non-alphanumeric chars', () => {
    expect(slugifyThemeName('a   b   c')).toBe('a-b-c');
  });
});

// ── loadCustomThemes / saveCustomThemes ───────────────────────────────────

describe('loadCustomThemes', () => {
  it('returns empty object when no themes stored', () => {
    expect(loadCustomThemes()).toEqual({});
  });

  it('returns parsed themes from localStorage', () => {
    const data = { 'my-theme': { name: 'My Theme' } };
    store['xplorer:custom-themes'] = JSON.stringify(data);
    expect(loadCustomThemes()).toEqual(data);
  });

  it('returns empty object for corrupted JSON', () => {
    store['xplorer:custom-themes'] = 'not json!';
    expect(loadCustomThemes()).toEqual({});
  });
});

describe('saveCustomThemes', () => {
  it('persists themes to localStorage', () => {
    const data = {
      'my-theme': { name: 'My Theme' },
    } as unknown as Record<string, CustomThemeColors>;
    saveCustomThemes(data);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'xplorer:custom-themes',
      JSON.stringify(data),
    );
  });
});

// ── applyFontSize / loadFontSize ──────────────────────────────────────────

describe('applyFontSize', () => {
  it('removes old font classes and adds the new one', () => {
    applyFontSize('large');

    const root = document.documentElement;
    expect(root.classList.remove).toHaveBeenCalledWith(
      'font-small',
      'font-medium',
      'font-large',
      'font-xl',
    );
    expect(root.classList.add).toHaveBeenCalledWith('font-large');
  });

  it('saves the font size to localStorage', () => {
    applyFontSize('small');
    expect(localStorage.setItem).toHaveBeenCalledWith('xplorer:font-size', 'small');
  });
});

describe('loadFontSize', () => {
  it('loads saved font size from localStorage', () => {
    store['xplorer:font-size'] = 'xl';
    loadFontSize();
    expect(document.documentElement.classList.add).toHaveBeenCalledWith('font-xl');
  });

  it('defaults to medium when no saved size exists', () => {
    loadFontSize();
    expect(document.documentElement.classList.add).toHaveBeenCalledWith('font-medium');
  });
});

// ── applyTheme ────────────────────────────────────────────────────────────

describe('applyTheme', () => {
  it('adds the theme class to document root', () => {
    applyTheme('glass');
    expect(document.documentElement.classList.add).toHaveBeenCalledWith('theme-glass');
  });

  it('sets CSS custom properties for built-in themes', () => {
    applyTheme('glass');
    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--xp-bg',
      themes.glass.bg,
    );
    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--xp-text',
      themes.glass.text,
    );
  });

  it('adds theme class for extension themes without setting CSS vars', () => {
    applyTheme('dracula');
    expect(document.documentElement.classList.add).toHaveBeenCalledWith('theme-dracula');
  });
});

// ── applyCustomThemeVars ──────────────────────────────────────────────────

describe('applyCustomThemeVars', () => {
  it('sets all expected CSS custom properties', () => {
    const theme: CustomThemeColors = {
      name: 'Test Theme',
      background: '#000',
      backgroundSecondary: '#111',
      text: '#fff',
      textSecondary: '#ccc',
      accent: '#00f',
      accentHover: '#33f',
      border: '#333',
      surface: '#222',
      surfaceHover: '#444',
      sidebarBg: '#1a1a1a',
      success: '#0f0',
      warning: '#ff0',
      error: '#f00',
    };

    applyCustomThemeVars(theme);

    const setProperty = document.documentElement.style.setProperty;
    expect(setProperty).toHaveBeenCalledWith('--xp-bg', '#000');
    expect(setProperty).toHaveBeenCalledWith('--xp-bg-secondary', '#111');
    expect(setProperty).toHaveBeenCalledWith('--xp-text', '#fff');
    expect(setProperty).toHaveBeenCalledWith('--xp-text-secondary', '#ccc');
    expect(setProperty).toHaveBeenCalledWith('--xp-blue', '#00f');
    expect(setProperty).toHaveBeenCalledWith('--xp-accent', '#00f');
    expect(setProperty).toHaveBeenCalledWith('--xp-accent-hover', '#33f');
    expect(setProperty).toHaveBeenCalledWith('--xp-border', '#333');
    expect(setProperty).toHaveBeenCalledWith('--xp-surface', '#222');
    expect(setProperty).toHaveBeenCalledWith('--xp-surface-light', '#444');
    expect(setProperty).toHaveBeenCalledWith('--xp-sidebar-bg', '#1a1a1a');
    expect(setProperty).toHaveBeenCalledWith('--xp-green', '#0f0');
    expect(setProperty).toHaveBeenCalledWith('--xp-yellow', '#ff0');
    expect(setProperty).toHaveBeenCalledWith('--xp-red', '#f00');
  });
});
