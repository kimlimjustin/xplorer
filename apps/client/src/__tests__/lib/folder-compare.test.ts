import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compareFolders } from '@/lib/folder-compare';
import type { FileEntry } from '@/lib/tauri-api';

// ── Mock TauriAPI ─────────────────────────────────────────────────────────

const mockReadDirectory = vi.fn<(path: string) => Promise<FileEntry[]>>();

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    readDirectory: (...args: unknown[]) => mockReadDirectory(args[0] as string),
  },
}));

beforeEach(() => {
  mockReadDirectory.mockReset();
});

// ── Helper ────────────────────────────────────────────────────────────────

const makeEntry = (overrides: Partial<FileEntry> = {}): FileEntry => {
  return {
    name: 'file.txt',
    path: '/dir/file.txt',
    size: 100,
    is_dir: false,
    modified: 1700000000,
    file_type: 'text/plain',
    ...overrides,
  };
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('compareFolders', () => {
  it('returns empty result for two empty directories', async () => {
    mockReadDirectory.mockResolvedValue([]);

    const result = await compareFolders('/left', '/right');

    expect(result.onlyInLeft).toEqual([]);
    expect(result.onlyInRight).toEqual([]);
    expect(result.different).toEqual([]);
    expect(result.identical).toEqual([]);
    expect(result.summary).toEqual({
      totalLeft: 0,
      totalRight: 0,
      onlyLeft: 0,
      onlyRight: 0,
      different: 0,
      identical: 0,
    });
  });

  it('detects files only in left', async () => {
    mockReadDirectory
      .mockResolvedValueOnce([makeEntry({ name: 'a.txt', path: '/left/a.txt', size: 50 })])
      .mockResolvedValueOnce([]);

    const result = await compareFolders('/left', '/right');

    expect(result.onlyInLeft).toHaveLength(1);
    expect(result.onlyInLeft[0].name).toBe('a.txt');
    expect(result.onlyInRight).toHaveLength(0);
    expect(result.summary.onlyLeft).toBe(1);
    expect(result.summary.totalLeft).toBe(1);
    expect(result.summary.totalRight).toBe(0);
  });

  it('detects files only in right', async () => {
    mockReadDirectory
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeEntry({ name: 'b.txt', path: '/right/b.txt', size: 75 })]);

    const result = await compareFolders('/left', '/right');

    expect(result.onlyInRight).toHaveLength(1);
    expect(result.onlyInRight[0].name).toBe('b.txt');
    expect(result.onlyInLeft).toHaveLength(0);
    expect(result.summary.onlyRight).toBe(1);
  });

  it('detects identical files (same name and size)', async () => {
    mockReadDirectory
      .mockResolvedValueOnce([
        makeEntry({ name: 'shared.txt', path: '/left/shared.txt', size: 200 }),
      ])
      .mockResolvedValueOnce([
        makeEntry({ name: 'shared.txt', path: '/right/shared.txt', size: 200 }),
      ]);

    const result = await compareFolders('/left', '/right');

    expect(result.identical).toHaveLength(1);
    expect(result.identical[0]).toEqual({
      name: 'shared.txt',
      leftPath: '/left/shared.txt',
      rightPath: '/right/shared.txt',
      size: 200,
    });
    expect(result.summary.identical).toBe(1);
  });

  it('detects different files (same name, different size)', async () => {
    mockReadDirectory
      .mockResolvedValueOnce([
        makeEntry({ name: 'config.json', path: '/left/config.json', size: 100, modified: 1000 }),
      ])
      .mockResolvedValueOnce([
        makeEntry({ name: 'config.json', path: '/right/config.json', size: 250, modified: 2000 }),
      ]);

    const result = await compareFolders('/left', '/right');

    expect(result.different).toHaveLength(1);
    expect(result.different[0]).toEqual({
      name: 'config.json',
      leftPath: '/left/config.json',
      rightPath: '/right/config.json',
      leftSize: 100,
      rightSize: 250,
      leftModified: 1000,
      rightModified: 2000,
    });
    expect(result.summary.different).toBe(1);
  });

  it('handles a complex mixed scenario', async () => {
    mockReadDirectory
      .mockResolvedValueOnce([
        makeEntry({ name: 'both-same.txt', path: '/left/both-same.txt', size: 100 }),
        makeEntry({ name: 'both-diff.txt', path: '/left/both-diff.txt', size: 100 }),
        makeEntry({ name: 'left-only.txt', path: '/left/left-only.txt', size: 50 }),
      ])
      .mockResolvedValueOnce([
        makeEntry({ name: 'both-same.txt', path: '/right/both-same.txt', size: 100 }),
        makeEntry({ name: 'both-diff.txt', path: '/right/both-diff.txt', size: 200 }),
        makeEntry({ name: 'right-only.txt', path: '/right/right-only.txt', size: 75 }),
      ]);

    const result = await compareFolders('/left', '/right');

    expect(result.identical).toHaveLength(1);
    expect(result.identical[0].name).toBe('both-same.txt');

    expect(result.different).toHaveLength(1);
    expect(result.different[0].name).toBe('both-diff.txt');

    expect(result.onlyInLeft).toHaveLength(1);
    expect(result.onlyInLeft[0].name).toBe('left-only.txt');

    expect(result.onlyInRight).toHaveLength(1);
    expect(result.onlyInRight[0].name).toBe('right-only.txt');

    expect(result.summary).toEqual({
      totalLeft: 3,
      totalRight: 3,
      onlyLeft: 1,
      onlyRight: 1,
      different: 1,
      identical: 1,
    });
  });

  it('sorts all groups alphabetically by name', async () => {
    mockReadDirectory
      .mockResolvedValueOnce([
        makeEntry({ name: 'zebra.txt', path: '/left/zebra.txt', size: 10 }),
        makeEntry({ name: 'apple.txt', path: '/left/apple.txt', size: 20 }),
        makeEntry({ name: 'mango.txt', path: '/left/mango.txt', size: 30 }),
      ])
      .mockResolvedValueOnce([]);

    const result = await compareFolders('/left', '/right');

    const names = result.onlyInLeft.map((f) => f.name);
    expect(names).toEqual(['apple.txt', 'mango.txt', 'zebra.txt']);
  });

  it('calls TauriAPI.readDirectory with correct paths', async () => {
    mockReadDirectory.mockResolvedValue([]);

    await compareFolders('/path/to/left', '/path/to/right');

    expect(mockReadDirectory).toHaveBeenCalledWith('/path/to/left');
    expect(mockReadDirectory).toHaveBeenCalledWith('/path/to/right');
    expect(mockReadDirectory).toHaveBeenCalledTimes(2);
  });

  it('propagates errors from TauriAPI', async () => {
    mockReadDirectory.mockRejectedValue(new Error('Permission denied'));

    await expect(compareFolders('/left', '/right')).rejects.toThrow('Permission denied');
  });
});
