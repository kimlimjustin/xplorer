import { describe, it, expect, vi } from 'vitest';

// Mock the constants module to control path separator
vi.mock('@/lib/constants', () => ({
  detectSep: vi.fn((path: string) => (path.includes('/') ? '/' : '\\')),
  isWindows: false,
  PATH_SEPARATOR: '/',
}));

import {
  computeMoveTree,
  allConflictsResolved,
  unresolvedConflictCount,
  type TreeNode,
} from '@/lib/move-tree-preview';
import type { FileEntry } from '@/lib/tauri-api';

// ── Helper to create FileEntry ──────────────────────────────────────────

const makeFile = (name: string, overrides: Partial<FileEntry> = {}): FileEntry => {
  return {
    name,
    path: `/source/${name}`,
    size: 1024,
    is_dir: false,
    modified: Date.now() / 1000,
    file_type: 'file',
    ...overrides,
  };
};

const makeDir = (name: string, overrides: Partial<FileEntry> = {}): FileEntry => {
  return {
    name,
    path: `/source/${name}`,
    size: 0,
    is_dir: true,
    modified: Date.now() / 1000,
    file_type: 'folder',
    ...overrides,
  };
};

// ── computeMoveTree ─────────────────────────────────────────────────────

describe('computeMoveTree', () => {
  it('produces incoming nodes when no conflicts', () => {
    const sourceFiles = [makeFile('new-file.txt')];
    const destFiles = [makeFile('existing.txt', { path: '/dest/existing.txt' })];

    const result = computeMoveTree(sourceFiles, '/dest', destFiles);

    expect(result.tree).toHaveLength(2);
    expect(result.conflicts).toHaveLength(0);

    const incoming = result.tree.find((n) => n.name === 'new-file.txt');
    expect(incoming).toBeDefined();
    expect(incoming!.status).toBe('incoming');
    expect(incoming!.path).toBe('/dest/new-file.txt');
    expect(incoming!.sourcePath).toBe('/source/new-file.txt');

    const existing = result.tree.find((n) => n.name === 'existing.txt');
    expect(existing).toBeDefined();
    expect(existing!.status).toBe('existing');
  });

  it('detects conflicts when file names collide (case-insensitive)', () => {
    const sourceFiles = [makeFile('README.md')];
    const destFiles = [makeFile('readme.md', { path: '/dest/readme.md' })];

    const result = computeMoveTree(sourceFiles, '/dest', destFiles);

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].name).toBe('README.md');
    expect(result.conflicts[0].status).toBe('conflict');
    expect(result.conflicts[0].sourcePath).toBe('/source/README.md');
  });

  it('replaces existing node with conflict node in merged tree', () => {
    const sourceFiles = [makeFile('data.json')];
    const destFiles = [makeFile('data.json', { path: '/dest/data.json' })];

    const result = computeMoveTree(sourceFiles, '/dest', destFiles);

    // Merged tree should have only 1 node (the conflict replacing the existing)
    const dataNodes = result.tree.filter((n) => n.name.toLowerCase() === 'data.json');
    expect(dataNodes).toHaveLength(1);
    expect(dataNodes[0].status).toBe('conflict');
  });

  it('calculates totalIncomingSize and totalExistingSize', () => {
    const sourceFiles = [makeFile('a.txt', { size: 100 }), makeFile('b.txt', { size: 200 })];
    const destFiles = [makeFile('c.txt', { path: '/dest/c.txt', size: 500 })];

    const result = computeMoveTree(sourceFiles, '/dest', destFiles);

    expect(result.totalIncomingSize).toBe(300);
    expect(result.totalExistingSize).toBe(500);
  });

  it('excludes directory sizes from totals', () => {
    const sourceFiles = [makeDir('src-dir', { size: 4096 }), makeFile('file.txt', { size: 100 })];
    const destFiles = [makeDir('dest-dir', { path: '/dest/dest-dir', size: 4096 })];

    const result = computeMoveTree(sourceFiles, '/dest', destFiles);

    expect(result.totalIncomingSize).toBe(100); // only file.txt
    expect(result.totalExistingSize).toBe(0); // only dir, excluded
  });

  it('sorts merged tree: directories first, then alphabetically', () => {
    const sourceFiles = [makeFile('zebra.txt'), makeDir('alpha-dir')];
    const destFiles = [makeFile('middle.txt', { path: '/dest/middle.txt' })];

    const result = computeMoveTree(sourceFiles, '/dest', destFiles);

    // Directories first
    expect(result.tree[0].isDir).toBe(true);
    expect(result.tree[0].name).toBe('alpha-dir');

    // Then files alphabetically
    const fileNames = result.tree.filter((n) => !n.isDir).map((n) => n.name);
    expect(fileNames).toEqual(['middle.txt', 'zebra.txt']);
  });

  it('handles empty source files', () => {
    const destFiles = [makeFile('existing.txt', { path: '/dest/existing.txt' })];
    const result = computeMoveTree([], '/dest', destFiles);

    expect(result.tree).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
    expect(result.totalIncomingSize).toBe(0);
  });

  it('handles empty destination', () => {
    const sourceFiles = [makeFile('new.txt')];
    const result = computeMoveTree(sourceFiles, '/dest', []);

    expect(result.tree).toHaveLength(1);
    expect(result.tree[0].status).toBe('incoming');
    expect(result.conflicts).toHaveLength(0);
  });

  it('handles destination path with trailing separator', () => {
    const sourceFiles = [makeFile('test.txt')];
    const result = computeMoveTree(sourceFiles, '/dest/', []);

    expect(result.tree[0].path).toBe('/dest/test.txt');
  });

  it('handles Windows paths', () => {
    const sourceFiles = [makeFile('doc.txt', { path: 'C:\\source\\doc.txt' })];
    const result = computeMoveTree(sourceFiles, 'C:\\dest', []);

    expect(result.tree[0].path).toBe('C:\\dest\\doc.txt');
  });

  it('handles multiple conflicts', () => {
    const sourceFiles = [makeFile('a.txt'), makeFile('b.txt')];
    const destFiles = [
      makeFile('a.txt', { path: '/dest/a.txt' }),
      makeFile('b.txt', { path: '/dest/b.txt' }),
    ];

    const result = computeMoveTree(sourceFiles, '/dest', destFiles);
    expect(result.conflicts).toHaveLength(2);
  });
});

// ── allConflictsResolved ────────────────────────────────────────────────

describe('allConflictsResolved', () => {
  it('returns true when all conflicts have a resolution', () => {
    const conflicts: TreeNode[] = [
      {
        name: 'a.txt',
        path: '/dest/a.txt',
        isDir: false,
        size: 100,
        children: [],
        status: 'conflict',
        conflictResolution: 'overwrite',
      },
      {
        name: 'b.txt',
        path: '/dest/b.txt',
        isDir: false,
        size: 200,
        children: [],
        status: 'conflict',
        conflictResolution: 'skip',
      },
    ];
    expect(allConflictsResolved(conflicts)).toBe(true);
  });

  it('returns false when any conflict is unresolved', () => {
    const conflicts: TreeNode[] = [
      {
        name: 'a.txt',
        path: '/dest/a.txt',
        isDir: false,
        size: 100,
        children: [],
        status: 'conflict',
        conflictResolution: 'overwrite',
      },
      {
        name: 'b.txt',
        path: '/dest/b.txt',
        isDir: false,
        size: 200,
        children: [],
        status: 'conflict',
        conflictResolution: undefined,
      },
    ];
    expect(allConflictsResolved(conflicts)).toBe(false);
  });

  it('returns true for empty conflicts array', () => {
    expect(allConflictsResolved([])).toBe(true);
  });
});

// ── unresolvedConflictCount ──────────────────────────────────────────────

describe('unresolvedConflictCount', () => {
  it('counts unresolved conflicts', () => {
    const conflicts: TreeNode[] = [
      {
        name: 'a.txt',
        path: '/a',
        isDir: false,
        size: 100,
        children: [],
        status: 'conflict',
        conflictResolution: 'overwrite',
      },
      {
        name: 'b.txt',
        path: '/b',
        isDir: false,
        size: 200,
        children: [],
        status: 'conflict',
        conflictResolution: undefined,
      },
      {
        name: 'c.txt',
        path: '/c',
        isDir: false,
        size: 300,
        children: [],
        status: 'conflict',
        conflictResolution: undefined,
      },
    ];
    expect(unresolvedConflictCount(conflicts)).toBe(2);
  });

  it('returns 0 when all resolved', () => {
    const conflicts: TreeNode[] = [
      {
        name: 'a.txt',
        path: '/a',
        isDir: false,
        size: 100,
        children: [],
        status: 'conflict',
        conflictResolution: 'rename',
      },
    ];
    expect(unresolvedConflictCount(conflicts)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(unresolvedConflictCount([])).toBe(0);
  });
});
