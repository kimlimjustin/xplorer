import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock variables so they are available inside vi.mock factory
const { mockCheckConflicts, mockFileExists, mockMoveFile, mockCopy, mockGetRenameDest } =
  vi.hoisted(() => ({
    mockCheckConflicts: vi.fn(() => Promise.resolve([])),
    mockFileExists: vi.fn(() => Promise.resolve(false)),
    mockMoveFile: vi.fn(() => Promise.resolve()),
    mockCopy: vi.fn(() => Promise.resolve()),
    mockGetRenameDest: vi.fn((dir: string, name: string) => Promise.resolve(`${dir}/${name} (2)`)),
  }));

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    checkConflicts: mockCheckConflicts,
    fileExists: mockFileExists,
    moveFile: mockMoveFile,
    copy: mockCopy,
    getRenameDest: mockGetRenameDest,
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

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(() => ({
    id: 'mock-toast',
    update: vi.fn(),
    dismiss: vi.fn(),
  })),
}));

vi.mock('@/lib/file-operation-helpers', () => ({
  formatError: vi.fn((err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return String(err);
  }),
}));

import {
  executePaste,
  showPasteResultToast,
  type PasteContext,
  type PasteResult,
} from '@/lib/paste-helpers';
import type { FileEntry } from '@/lib/tauri-api';

const makeFile = (name: string, path?: string): FileEntry => {
  return {
    name,
    path: path ?? `/source/${name}`,
    size: 1024,
    is_dir: false,
    modified: Date.now() / 1000,
    file_type: 'file',
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckConflicts.mockResolvedValue([]);
  mockFileExists.mockResolvedValue(false);
});

// ── executePaste ────────────────────────────────────────────────────────

describe('executePaste', () => {
  it('copies files without conflicts', async () => {
    const files = [makeFile('a.txt'), makeFile('b.txt')];
    const emitFileActivity = vi.fn();
    const emitFilesChanged = vi.fn();

    const ctx: PasteContext = {
      files,
      operation: 'copy',
      targetPath: '/dest',
      emitFileActivity,
      emitFilesChanged,
    };

    const result = await executePaste(ctx);

    expect(result.succeeded).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(result.isCut).toBe(false);
    expect(mockCopy).toHaveBeenCalledTimes(2);
    expect(emitFileActivity).toHaveBeenCalledTimes(2);
    expect(emitFilesChanged).toHaveBeenCalledTimes(1);
  });

  it('moves files when operation is cut', async () => {
    const files = [makeFile('a.txt')];
    const emitFileActivity = vi.fn();
    const emitFilesChanged = vi.fn();

    const ctx: PasteContext = {
      files,
      operation: 'cut',
      targetPath: '/dest',
      emitFileActivity,
      emitFilesChanged,
    };

    const result = await executePaste(ctx);

    expect(result.succeeded).toBe(1);
    expect(result.isCut).toBe(true);
    expect(mockMoveFile).toHaveBeenCalledTimes(1);
    expect(mockCopy).not.toHaveBeenCalled();
  });

  it('handles copy errors gracefully', async () => {
    mockCopy.mockRejectedValueOnce(new Error('Permission denied'));

    const files = [makeFile('a.txt')];
    const ctx: PasteContext = {
      files,
      operation: 'copy',
      targetPath: '/dest',
      emitFileActivity: vi.fn(),
      emitFilesChanged: vi.fn(),
    };

    const result = await executePaste(ctx);

    expect(result.succeeded).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Permission denied');
  });

  it('calls resolveConflict when file exists at destination', async () => {
    mockFileExists.mockResolvedValue(true);

    const resolveConflict = vi.fn().mockResolvedValue({
      resolution: 'replace',
      applyToAll: false,
    });

    const files = [makeFile('a.txt')];
    const ctx: PasteContext = {
      files,
      operation: 'copy',
      targetPath: '/dest',
      resolveConflict,
      emitFileActivity: vi.fn(),
      emitFilesChanged: vi.fn(),
    };

    const result = await executePaste(ctx);

    expect(resolveConflict).toHaveBeenCalledTimes(1);
    expect(result.succeeded).toBe(1);
    expect(mockCopy).toHaveBeenCalledTimes(1);
  });

  it('skips file when conflict resolution is "skip"', async () => {
    mockFileExists.mockResolvedValue(true);

    const resolveConflict = vi.fn().mockResolvedValue({
      resolution: 'skip',
      applyToAll: false,
    });

    const files = [makeFile('a.txt')];
    const ctx: PasteContext = {
      files,
      operation: 'copy',
      targetPath: '/dest',
      resolveConflict,
      emitFileActivity: vi.fn(),
      emitFilesChanged: vi.fn(),
    };

    const result = await executePaste(ctx);

    expect(result.succeeded).toBe(1); // skipped counts as succeeded
    expect(mockCopy).not.toHaveBeenCalled();
  });

  it('renames when conflict resolution is "keep-both"', async () => {
    mockFileExists.mockResolvedValue(true);
    mockGetRenameDest.mockResolvedValue('/dest/a (2).txt');

    const resolveConflict = vi.fn().mockResolvedValue({
      resolution: 'keep-both',
      applyToAll: false,
    });

    const files = [makeFile('a.txt')];
    const ctx: PasteContext = {
      files,
      operation: 'copy',
      targetPath: '/dest',
      resolveConflict,
      emitFileActivity: vi.fn(),
      emitFilesChanged: vi.fn(),
    };

    await executePaste(ctx);

    expect(mockGetRenameDest).toHaveBeenCalledWith('/dest', 'a.txt');
    expect(mockCopy).toHaveBeenCalledWith('/source/a.txt', '/dest/a (2).txt');
  });

  it('applies applyToAll resolution to subsequent files', async () => {
    mockFileExists.mockResolvedValue(true);

    const resolveConflict = vi.fn().mockResolvedValue({
      resolution: 'skip',
      applyToAll: true,
    });

    const files = [makeFile('a.txt'), makeFile('b.txt'), makeFile('c.txt')];
    const ctx: PasteContext = {
      files,
      operation: 'copy',
      targetPath: '/dest',
      resolveConflict,
      emitFileActivity: vi.fn(),
      emitFilesChanged: vi.fn(),
    };

    await executePaste(ctx);

    // resolveConflict should only be called once (for the first file)
    expect(resolveConflict).toHaveBeenCalledTimes(1);
    // All files should be skipped
    expect(mockCopy).not.toHaveBeenCalled();
  });

  it('auto-renames when copying to same directory', async () => {
    // Source path normalizes to same as destination
    const file = makeFile('a.txt', '/dest/a.txt');
    mockGetRenameDest.mockResolvedValue('/dest/a Copy.txt');

    const ctx: PasteContext = {
      files: [file],
      operation: 'copy',
      targetPath: '/dest',
      emitFileActivity: vi.fn(),
      emitFilesChanged: vi.fn(),
    };

    await executePaste(ctx);

    expect(mockGetRenameDest).toHaveBeenCalledWith('/dest', 'a.txt');
    expect(mockCopy).toHaveBeenCalledWith('/dest/a.txt', '/dest/a Copy.txt');
  });
});

// ── showPasteResultToast ────────────────────────────────────────────────

describe('showPasteResultToast', () => {
  it('shows success toast for copy', () => {
    const toast = vi.fn();
    const result: PasteResult = { succeeded: 3, errors: [], isCut: false };

    showPasteResultToast(result, toast);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Copied',
        description: expect.stringContaining('3 items copied'),
      }),
    );
  });

  it('shows success toast for move with singular item', () => {
    const toast = vi.fn();
    const result: PasteResult = { succeeded: 1, errors: [], isCut: true };

    showPasteResultToast(result, toast);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Moved',
        description: '1 item moved',
      }),
    );
  });

  it('shows error toast when there are failures', () => {
    const toast = vi.fn();
    const result: PasteResult = {
      succeeded: 2,
      errors: ['file1: Permission denied', 'file2: Not found'],
      isCut: false,
    };

    showPasteResultToast(result, toast);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Paste completed with errors',
        variant: 'destructive',
      }),
    );
  });

  it('truncates error list to 3 items', () => {
    const toast = vi.fn();
    const result: PasteResult = {
      succeeded: 0,
      errors: ['err1', 'err2', 'err3', 'err4'],
      isCut: false,
    };

    showPasteResultToast(result, toast);

    const call = toast.mock.calls[0][0];
    expect(call.description).toContain('...');
  });
});
