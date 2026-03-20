import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { FileEntry } from '@/lib/tauri-api';

const {
  mockCopy,
  mockMoveFile,
  mockRename,
  mockMoveToTrash,
  mockFileExists,
  mockCreateDirRecursive,
  mockCreateFile,
} = vi.hoisted(() => ({
  mockCopy: vi.fn(() => Promise.resolve()),
  mockMoveFile: vi.fn(() => Promise.resolve()),
  mockRename: vi.fn(() => Promise.resolve()),
  mockMoveToTrash: vi.fn(() => Promise.resolve()),
  mockFileExists: vi.fn(() => Promise.resolve(false)),
  mockCreateDirRecursive: vi.fn(() => Promise.resolve()),
  mockCreateFile: vi.fn(() => Promise.resolve()),
}));

const { mockShowConfirmationToast, mockShowInputToast } = vi.hoisted(() => ({
  mockShowConfirmationToast: vi.fn(() => Promise.resolve(true)),
  mockShowInputToast: vi.fn(() => Promise.resolve('new-name.txt')),
}));

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    copy: mockCopy,
    moveFile: mockMoveFile,
    rename: mockRename,
    moveToTrash: mockMoveToTrash,
    fileExists: mockFileExists,
    createDirRecursive: mockCreateDirRecursive,
    createFile: mockCreateFile,
    createFileWithContent: vi.fn(() => Promise.resolve()),
    acceleratedCopyFile: vi.fn(() => Promise.resolve()),
    openInTerminal: vi.fn(() => Promise.resolve()),
    openFile: vi.fn(() => Promise.resolve()),
    openRecycleBin: vi.fn(() => Promise.resolve()),
    indexDirectory: vi.fn(() => Promise.resolve()),
    setSearchContext: vi.fn(() => Promise.resolve()),
    startWatching: vi.fn(() => Promise.resolve()),
    addWhitelistedPath: vi.fn(() => Promise.resolve()),
    addBookmark: vi.fn(() => Promise.resolve()),
    checkConflicts: vi.fn(() => Promise.resolve([])),
    getRenameDest: vi.fn((dir: string, name: string) => Promise.resolve(`${dir}\\${name}`)),
  },
  FileEntry: {},
}));

vi.mock('@/components/ui/Toast', () => ({
  showConfirmationToast: mockShowConfirmationToast,
  showInputToast: mockShowInputToast,
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(() => ({ id: '1', dismiss: vi.fn(), update: vi.fn() })),
}));

vi.mock('@/hooks/use-clipboard-history', () => ({
  addEntry: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  getFileIcon: vi.fn(() => '📄'),
  formatFileSize: vi.fn(() => '1 KB'),
  formatDate: vi.fn(() => '2024-01-01'),
  sortFiles: vi.fn((files: FileEntry[]) => files),
  cn: vi.fn((...classes: string[]) => classes.filter(Boolean).join(' ')),
  formatError: vi.fn((err: unknown) => (err instanceof Error ? err.message : String(err))),
}));

vi.mock('@/lib/constants', () => ({
  isWindows: true,
  PATH_SEPARATOR: '\\',
  ROOT_PATH: 'C:\\',
  detectSep: vi.fn(() => '\\'),
}));

vi.mock('@/lib/context-menu-factory', () => {
  class MockContextMenuFactory {
    updateClipboard = vi.fn();
    clearClipboard = vi.fn();
    buildContextMenu = vi.fn(() => []);
  }
  return {
    ContextMenuFactory: MockContextMenuFactory,
    contextMenuRegistry: { getItems: vi.fn(() => []) },
  };
});

vi.mock('@/extensions/advanced-selection/selection-utils', () => ({
  invertSelection: vi.fn((files: FileEntry[], selected: Set<string>) =>
    files.filter((f) => !selected.has(f.path)).map((f) => f.path),
  ),
}));

vi.mock('@/lib/extension-host', () => ({
  extensionHost: {
    getContextMenuItems: vi.fn(() => []),
    isExtensionScheme: vi.fn(() => false),
    getTabRenderer: vi.fn(() => null),
  },
}));

import { useFileOperations } from '@/hooks/use-file-operations';

const createTestFiles = (): FileEntry[] => {
  return [
    {
      name: 'document.txt',
      path: 'C:\\Users\\Test\\document.txt',
      size: 1024,
      is_dir: false,
      modified: Date.now(),
      file_type: 'text',
    },
    {
      name: 'image.png',
      path: 'C:\\Users\\Test\\image.png',
      size: 2048,
      is_dir: false,
      modified: Date.now(),
      file_type: 'image',
    },
    {
      name: 'folder1',
      path: 'C:\\Users\\Test\\folder1',
      size: 0,
      is_dir: true,
      modified: Date.now(),
      file_type: 'folder',
    },
  ];
};

const createDeps = (overrides: Record<string, unknown> = {}) => {
  const files = createTestFiles();
  return {
    currentPath: 'C:\\Users\\Test',
    selectedFiles: new Set<string>(),
    setSelectedFiles: vi.fn(),
    files,
    refetch: vi.fn(),
    toast: vi.fn(),
    splitLayout: { addTab: vi.fn() },
    activeGroupId: 'default',
    fileComparison: {
      markedFile: null,
      compareFiles: vi.fn(),
      markFileForComparison: vi.fn(),
      clearComparisonMark: vi.fn(),
    },
    dialogs: {
      openPropertiesDialog: vi.fn(),
      openOpenWithDialog: vi.fn(),
      openCompressDialog: vi.fn(),
      openBulkRenameDialog: vi.fn(),
      openExtractDialog: vi.fn(),
      openFileTagsDialog: vi.fn(),
      openFileDetailsDialog: vi.fn(),
      openEncryptionDialog: vi.fn(),
      openSecureDeleteDialog: vi.fn(),
      openVersionHistoryDialog: vi.fn(),
      openSymlinkDialog: vi.fn(),
      openPasteRenameDialog: vi.fn(),
      openTemplatePicker: vi.fn(),
      openFolderCompare: vi.fn(),
      setShowAdvancedSelect: vi.fn(),
      openBatchConfirmDialog: vi.fn((_op: string, _files: unknown, onConfirm: () => void) => {
        // Auto-confirm batch operations in tests
        onConfirm();
      }),
      openBatchMetadataDialog: vi.fn(),
    },
    setBottomPanelCollapsed: vi.fn(),
    setBottomPanelTab: vi.fn(),
    setTerminalCwd: vi.fn(),
    setViewMode: vi.fn(),
    setSortBy: vi.fn(),
    setSortOrder: vi.fn(),
    navigateToPath: vi.fn(),
    ...overrides,
  };
};

describe('File Operations Integration', () => {
  let filesChangedHandler: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileExists.mockResolvedValue(false);
    filesChangedHandler = null;
    window.addEventListener('files-changed', () => {
      filesChangedHandler?.();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Copy Operation Flow', () => {
    it('copies files to clipboard and pastes them to the current directory', async () => {
      const deps = createDeps();
      const { result } = renderHook(() => useFileOperations(deps));
      const files = createTestFiles();

      act(() => {
        result.current.contextMenuActions.copy([files[0]]);
      });

      expect(result.current.clipboard).toEqual({
        files: [files[0]],
        operation: 'copy',
      });

      mockFileExists.mockResolvedValue(false);

      await act(async () => {
        await result.current.contextMenuActions.paste('C:\\Users\\Destination');
      });

      expect(mockCopy).toHaveBeenCalledWith(
        'C:\\Users\\Test\\document.txt',
        'C:\\Users\\Destination\\document.txt',
      );
    });

    it('copies multiple files in a single paste operation', async () => {
      const deps = createDeps();
      const { result } = renderHook(() => useFileOperations(deps));
      const files = createTestFiles();

      act(() => {
        result.current.contextMenuActions.copy([files[0], files[1]]);
      });

      await act(async () => {
        await result.current.contextMenuActions.paste('D:\\Backup');
      });

      expect(mockCopy).toHaveBeenCalledTimes(2);
      expect(mockCopy).toHaveBeenCalledWith(
        'C:\\Users\\Test\\document.txt',
        'D:\\Backup\\document.txt',
      );
      expect(mockCopy).toHaveBeenCalledWith('C:\\Users\\Test\\image.png', 'D:\\Backup\\image.png');
    });

    it('handles copy failure gracefully and reports errors', async () => {
      const toastFn = vi.fn();
      const deps = createDeps({ toast: toastFn });
      const { result } = renderHook(() => useFileOperations(deps));
      const files = createTestFiles();

      act(() => {
        result.current.contextMenuActions.copy([files[0]]);
      });

      mockCopy.mockRejectedValueOnce(new Error('Permission denied'));

      await act(async () => {
        await result.current.contextMenuActions.paste('D:\\Backup');
      });

      expect(toastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('error'),
          variant: 'destructive',
        }),
      );
    });

    it('shows toast when pasting with empty clipboard', async () => {
      const toastFn = vi.fn();
      const deps = createDeps({ toast: toastFn });
      const { result } = renderHook(() => useFileOperations(deps));

      await act(async () => {
        await result.current.contextMenuActions.paste('C:\\Users\\Destination');
      });

      expect(toastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Nothing to paste',
        }),
      );
    });
  });

  describe('Cut / Move Operation', () => {
    it('cuts files to clipboard and moves them on paste', async () => {
      const deps = createDeps();
      const { result } = renderHook(() => useFileOperations(deps));
      const files = createTestFiles();

      act(() => {
        result.current.contextMenuActions.cut([files[0]]);
      });

      expect(result.current.clipboard).toEqual({
        files: [files[0]],
        operation: 'cut',
      });

      await act(async () => {
        await result.current.contextMenuActions.paste('D:\\Destination');
      });

      expect(mockMoveFile).toHaveBeenCalledWith(
        'C:\\Users\\Test\\document.txt',
        'D:\\Destination\\document.txt',
      );
    });

    it('clears clipboard after successful cut-paste', async () => {
      const deps = createDeps();
      const { result } = renderHook(() => useFileOperations(deps));
      const files = createTestFiles();

      act(() => {
        result.current.contextMenuActions.cut([files[0]]);
      });

      await act(async () => {
        await result.current.contextMenuActions.paste('D:\\Destination');
      });

      expect(result.current.clipboard).toBeNull();
    });
  });

  describe('Rename Operation', () => {
    it('renames a file using the input toast dialog', async () => {
      mockShowInputToast.mockResolvedValueOnce('renamed-file.txt');

      const deps = createDeps();
      const { result } = renderHook(() => useFileOperations(deps));
      const files = createTestFiles();

      await act(async () => {
        await result.current.contextMenuActions.rename(files[0]);
      });

      expect(mockShowInputToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Rename',
          placeholder: 'document.txt',
        }),
      );

      expect(mockRename).toHaveBeenCalledWith(
        'C:\\Users\\Test\\document.txt',
        expect.stringContaining('renamed-file.txt'),
      );
    });

    it('cancels rename when user dismisses the dialog', async () => {
      mockShowInputToast.mockResolvedValueOnce(null);

      const deps = createDeps();
      const { result } = renderHook(() => useFileOperations(deps));
      const files = createTestFiles();

      await act(async () => {
        await result.current.contextMenuActions.rename(files[0]);
      });

      expect(mockRename).not.toHaveBeenCalled();
    });

    it('does not rename if new name is same as old name', async () => {
      mockShowInputToast.mockResolvedValueOnce('document.txt');

      const deps = createDeps();
      const { result } = renderHook(() => useFileOperations(deps));
      const files = createTestFiles();

      await act(async () => {
        await result.current.contextMenuActions.rename(files[0]);
      });

      expect(mockRename).not.toHaveBeenCalled();
    });

    it('handles rename errors gracefully', async () => {
      mockShowInputToast.mockResolvedValueOnce('new-name.txt');
      mockRename.mockRejectedValueOnce(new Error('File in use'));

      const toastFn = vi.fn();
      const deps = createDeps({ toast: toastFn });
      const { result } = renderHook(() => useFileOperations(deps));
      const files = createTestFiles();

      await act(async () => {
        await result.current.contextMenuActions.rename(files[0]);
      });

      expect(toastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Rename failed',
          variant: 'destructive',
        }),
      );
    });
  });

  describe('Delete with Confirmation', () => {
    it('shows confirmation before deleting and proceeds on confirm', async () => {
      const setSelectedFiles = vi.fn();
      const deps = createDeps({ setSelectedFiles });
      const { result } = renderHook(() => useFileOperations(deps));
      const files = createTestFiles();

      await act(async () => {
        await result.current.contextMenuActions.delete([files[0], files[1]]);
      });

      // Multi-file delete uses openBatchConfirmDialog (which auto-confirms in our mock)
      expect(deps.dialogs.openBatchConfirmDialog).toHaveBeenCalledWith(
        'delete',
        [files[0], files[1]],
        expect.any(Function),
      );

      expect(mockMoveToTrash).toHaveBeenCalledTimes(2);
      expect(mockMoveToTrash).toHaveBeenCalledWith('C:\\Users\\Test\\document.txt');
      expect(mockMoveToTrash).toHaveBeenCalledWith('C:\\Users\\Test\\image.png');
      expect(setSelectedFiles).toHaveBeenCalledWith(new Set());
    });

    it('cancels delete when user rejects confirmation', async () => {
      mockShowConfirmationToast.mockResolvedValueOnce(false);

      const deps = createDeps();
      const { result } = renderHook(() => useFileOperations(deps));
      const files = createTestFiles();

      await act(async () => {
        await result.current.contextMenuActions.delete([files[0]]);
      });

      expect(mockMoveToTrash).not.toHaveBeenCalled();
    });

    it('handles delete errors gracefully', async () => {
      mockShowConfirmationToast.mockResolvedValueOnce(true);
      mockMoveToTrash.mockRejectedValueOnce(new Error('Permission denied'));

      const toastFn = vi.fn();
      const deps = createDeps({ toast: toastFn });
      const { result } = renderHook(() => useFileOperations(deps));
      const files = createTestFiles();

      await act(async () => {
        await result.current.contextMenuActions.delete([files[0]]);
      });

      expect(toastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete failed',
          variant: 'destructive',
        }),
      );
    });
  });

  describe('Create Operations', () => {
    it('creates a new folder via the context menu action', async () => {
      mockShowInputToast.mockResolvedValueOnce('New Folder');

      const deps = createDeps();
      const { result } = renderHook(() => useFileOperations(deps));

      await act(async () => {
        await result.current.contextMenuActions.createFolder('C:\\Users\\Test');
      });

      expect(mockCreateDirRecursive).toHaveBeenCalledWith('C:\\Users\\Test\\New Folder');
    });

    it('creates a new file via the context menu action', async () => {
      mockShowInputToast.mockResolvedValueOnce('newfile.txt');

      const deps = createDeps();
      const { result } = renderHook(() => useFileOperations(deps));

      await act(async () => {
        await result.current.contextMenuActions.createFile('C:\\Users\\Test');
      });

      expect(mockCreateFile).toHaveBeenCalledWith('C:\\Users\\Test\\newfile.txt');
    });

    it('cancels folder creation when user dismisses dialog', async () => {
      mockShowInputToast.mockResolvedValueOnce(null);

      const deps = createDeps();
      const { result } = renderHook(() => useFileOperations(deps));

      await act(async () => {
        await result.current.contextMenuActions.createFolder('C:\\Users\\Test');
      });

      expect(mockCreateDirRecursive).not.toHaveBeenCalled();
    });
  });

  describe('Clipboard Shortcut Handlers', () => {
    it('copies selected files via keyboard shortcut handler', () => {
      const files = createTestFiles();
      const toastFn = vi.fn();
      const deps = createDeps({
        selectedFiles: new Set(['C:\\Users\\Test\\document.txt']),
        files,
        toast: toastFn,
      });
      const { result } = renderHook(() => useFileOperations(deps));

      act(() => {
        result.current.copySelectedFiles();
      });

      expect(result.current.clipboard).toEqual({
        files: [files[0]],
        operation: 'copy',
      });
    });

    it('cuts selected files via keyboard shortcut handler', () => {
      const files = createTestFiles();
      const toastFn = vi.fn();
      const deps = createDeps({
        selectedFiles: new Set(['C:\\Users\\Test\\image.png']),
        files,
        toast: toastFn,
      });
      const { result } = renderHook(() => useFileOperations(deps));

      act(() => {
        result.current.cutSelectedFiles();
      });

      expect(result.current.clipboard).toEqual({
        files: [files[1]],
        operation: 'cut',
      });
    });

    it('does nothing when copy is called with no selection', () => {
      const toastFn = vi.fn();
      const deps = createDeps({ toast: toastFn });
      const { result } = renderHook(() => useFileOperations(deps));

      act(() => {
        result.current.copySelectedFiles();
      });

      expect(result.current.clipboard).toBeNull();
    });
  });

  describe('Select All and Invert', () => {
    it('selects all files via selectAll action', () => {
      const setSelectedFiles = vi.fn();
      const files = createTestFiles();
      const deps = createDeps({ setSelectedFiles, files });
      const { result } = renderHook(() => useFileOperations(deps));

      act(() => {
        result.current.contextMenuActions.selectAll();
      });

      expect(setSelectedFiles).toHaveBeenCalledWith(new Set(files.map((f) => f.path)));
    });

    it('inverts selection via invertSelection action', () => {
      const setSelectedFiles = vi.fn();
      const files = createTestFiles();
      const deps = createDeps({
        setSelectedFiles,
        files,
        selectedFiles: new Set(['C:\\Users\\Test\\document.txt']),
      });
      const { result } = renderHook(() => useFileOperations(deps));

      act(() => {
        result.current.contextMenuActions.invertSelection();
      });

      expect(setSelectedFiles).toHaveBeenCalled();
    });
  });

  describe('Files Changed Event', () => {
    it('dispatches files-changed event after successful paste', async () => {
      const listener = vi.fn();
      window.addEventListener('files-changed', listener);

      const deps = createDeps();
      const { result } = renderHook(() => useFileOperations(deps));
      const files = createTestFiles();

      act(() => {
        result.current.contextMenuActions.copy([files[0]]);
      });

      await act(async () => {
        await result.current.contextMenuActions.paste('D:\\Backup');
      });

      expect(listener).toHaveBeenCalled();

      window.removeEventListener('files-changed', listener);
    });

    it('dispatches files-changed event after successful delete', async () => {
      mockShowConfirmationToast.mockResolvedValueOnce(true);
      const listener = vi.fn();
      window.addEventListener('files-changed', listener);

      const deps = createDeps();
      const { result } = renderHook(() => useFileOperations(deps));
      const files = createTestFiles();

      await act(async () => {
        await result.current.contextMenuActions.delete([files[0]]);
      });

      expect(listener).toHaveBeenCalled();

      window.removeEventListener('files-changed', listener);
    });
  });
});
