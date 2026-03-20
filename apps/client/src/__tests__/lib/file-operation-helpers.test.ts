import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock so it can be used inside vi.mock factory
const { mockFileExists } = vi.hoisted(() => ({
  mockFileExists: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    fileExists: mockFileExists,
    readDirectory: vi.fn(() => Promise.resolve([])),
    getFileIcon: vi.fn(() => ''),
    formatFileSize: vi.fn(() => ''),
    formatDate: vi.fn(() => ''),
  },
  FileEntry: {},
}));

vi.mock('@/lib/constants', () => ({
  detectSep: vi.fn((path: string) => (path.includes('/') ? '/' : '\\')),
  isWindows: false,
  PATH_SEPARATOR: '/',
}));

vi.mock('@/hooks/use-clipboard-history', () => ({
  addEntry: vi.fn(),
}));

import {
  formatError,
  generateCopyName,
  findCopyName,
  setClipboardEntries,
  resolveSelectedFiles,
  findUniqueFilePath,
} from '@/lib/file-operation-helpers';
import type { FileEntry } from '@/lib/tauri-api';

beforeEach(() => {
  vi.clearAllMocks();
  mockFileExists.mockResolvedValue(false);
});

const makeFile = (name: string, path?: string): FileEntry => {
  return {
    name,
    path: path ?? `/home/${name}`,
    size: 1024,
    is_dir: false,
    modified: Date.now() / 1000,
    file_type: 'file',
  };
};

// ── formatError ─────────────────────────────────────────────────────────

describe('formatError', () => {
  it('returns message from Error objects', () => {
    expect(formatError(new Error('Something went wrong'))).toBe('Something went wrong');
  });

  it('returns string values directly', () => {
    expect(formatError('plain string error')).toBe('plain string error');
  });

  it('JSON-stringifies objects', () => {
    expect(formatError({ code: 42 })).toBe('{"code":42}');
  });

  it('stringifies null', () => {
    expect(formatError(null)).toBe('null');
  });

  it('returns undefined for undefined input (JSON.stringify returns undefined for undefined)', () => {
    // JSON.stringify(undefined) returns the JS value `undefined` (not a string),
    // so formatError returns `undefined` rather than the string 'undefined'.
    const result = formatError(undefined);
    expect(result).toBeUndefined();
  });

  it('stringifies numbers', () => {
    expect(formatError(404)).toBe('404');
  });

  it('handles circular references gracefully', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    // JSON.stringify will throw, so it falls back to String()
    const result = formatError(obj);
    expect(typeof result).toBe('string');
  });
});

// ── generateCopyName ────────────────────────────────────────────────────

describe('generateCopyName', () => {
  it('generates "Name Copy.ext" for first copy', () => {
    expect(generateCopyName('/dir', 'file.txt', '/')).toBe('/dir/file Copy.txt');
  });

  it('generates "Name Copy N.ext" for subsequent copies', () => {
    expect(generateCopyName('/dir', 'file.txt', '/', 2)).toBe('/dir/file Copy 2.txt');
    expect(generateCopyName('/dir', 'file.txt', '/', 3)).toBe('/dir/file Copy 3.txt');
  });

  it('handles files without extension', () => {
    expect(generateCopyName('/dir', 'Makefile', '/')).toBe('/dir/Makefile Copy');
  });

  it('handles n=1 (treated as first copy, no number)', () => {
    expect(generateCopyName('/dir', 'file.txt', '/', 1)).toBe('/dir/file Copy.txt');
  });

  it('uses Windows separator when specified', () => {
    expect(generateCopyName('C:\\dir', 'file.txt', '\\')).toBe('C:\\dir\\file Copy.txt');
  });

  it('handles dotfiles (only extension, no base)', () => {
    // .gitignore has no base before extension, dot at index 0
    expect(generateCopyName('/dir', '.gitignore', '/')).toBe('/dir/.gitignore Copy');
  });

  it('preserves last extension for multi-dot files', () => {
    expect(generateCopyName('/dir', 'archive.tar.gz', '/')).toBe('/dir/archive.tar Copy.gz');
  });
});

// ── findCopyName ────────────────────────────────────────────────────────

describe('findCopyName', () => {
  it('returns first copy name when it does not exist', async () => {
    const result = await findCopyName('/dir', 'file.txt', '/');
    expect(result).toBe('/dir/file Copy.txt');
  });

  it('increments until a free name is found', async () => {
    mockFileExists
      .mockResolvedValueOnce(true) // "file Copy.txt" exists
      .mockResolvedValueOnce(true) // "file Copy 2.txt" exists
      .mockResolvedValueOnce(false); // "file Copy 3.txt" is free

    const result = await findCopyName('/dir', 'file.txt', '/');
    expect(result).toBe('/dir/file Copy 3.txt');
  });
});

// ── setClipboardEntries ─────────────────────────────────────────────────

describe('setClipboardEntries', () => {
  it('updates clipboard state and shows toast', () => {
    const files = [makeFile('a.txt'), makeFile('b.txt')];
    const setClipboard = vi.fn();
    const updateFactory = vi.fn();
    const toast = vi.fn();

    setClipboardEntries(files, 'copy', setClipboard, updateFactory, toast);

    expect(setClipboard).toHaveBeenCalledWith({ files, operation: 'copy' });
    expect(updateFactory).toHaveBeenCalledWith(files, 'copy');
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Copied',
        description: '2 items copied',
      }),
    );
  });

  it('uses singular form for single file', () => {
    const files = [makeFile('a.txt')];
    const toast = vi.fn();

    setClipboardEntries(files, 'cut', vi.fn(), vi.fn(), toast);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cut',
        description: '1 item cut',
      }),
    );
  });
});

// ── resolveSelectedFiles ────────────────────────────────────────────────

describe('resolveSelectedFiles', () => {
  it('maps selected paths to file entries', () => {
    const files = [
      makeFile('a.txt', '/path/a.txt'),
      makeFile('b.txt', '/path/b.txt'),
      makeFile('c.txt', '/path/c.txt'),
    ];
    const selected = new Set(['/path/a.txt', '/path/c.txt']);

    const result = resolveSelectedFiles(selected, files);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.name)).toEqual(['a.txt', 'c.txt']);
  });

  it('skips paths that do not match any file', () => {
    const files = [makeFile('a.txt', '/path/a.txt')];
    const selected = new Set(['/path/a.txt', '/path/missing.txt']);

    const result = resolveSelectedFiles(selected, files);
    expect(result).toHaveLength(1);
  });

  it('returns empty array for empty selection', () => {
    const files = [makeFile('a.txt')];
    const result = resolveSelectedFiles(new Set(), files);
    expect(result).toEqual([]);
  });
});

// ── findUniqueFilePath ──────────────────────────────────────────────────

describe('findUniqueFilePath', () => {
  it('returns base path when it does not exist', async () => {
    const result = await findUniqueFilePath('/parent', 'New File', '.txt');
    expect(result).toBe('/parent/New File.txt');
  });

  it('increments number until free path is found', async () => {
    mockFileExists
      .mockResolvedValueOnce(true) // "New File.txt" exists
      .mockResolvedValueOnce(true) // "New File (2).txt" exists
      .mockResolvedValueOnce(false); // "New File (3).txt" is free

    const result = await findUniqueFilePath('/parent', 'New File', '.txt');
    expect(result).toBe('/parent/New File (3).txt');
  });

  it('handles parent path with trailing separator', async () => {
    const result = await findUniqueFilePath('/parent/', 'test', '.js');
    expect(result).toBe('/parent/test.js');
  });

  it('handles empty extension', async () => {
    const result = await findUniqueFilePath('/parent', 'Makefile', '');
    expect(result).toBe('/parent/Makefile');
  });
});
