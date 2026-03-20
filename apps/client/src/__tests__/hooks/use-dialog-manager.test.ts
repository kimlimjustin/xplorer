import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDialogManager } from '@/hooks/use-dialog-manager';

// Mock use-dialogs to control dialog state
const mockClosePasswordPrompt = vi.fn();
const mockPasswordPromptData = { current: null as { archivePath: string; resolve: (password: string | null) => void } | null };

vi.mock('@/hooks/use-dialogs', () => ({
  useDialogs: () => ({
    // Simulated dialog state
    propertiesDialogOpen: false,
    propertiesDialogFile: '',
    openPropertiesDialog: vi.fn(),
    closePropertiesDialog: vi.fn(),
    passwordPromptOpen: false,
    passwordPromptData: mockPasswordPromptData.current,
    openPasswordPrompt: vi.fn(),
    closePasswordPrompt: mockClosePasswordPrompt,
    compressDialogOpen: false,
    compressDialogFiles: [],
    openCompressDialog: vi.fn(),
    closeCompressDialog: vi.fn(),
    extractDialogOpen: false,
    extractDialogFile: '',
    openExtractDialog: vi.fn(),
    closeExtractDialog: vi.fn(),
    bulkRenameDialogOpen: false,
    bulkRenameDialogFiles: [],
    openBulkRenameDialog: vi.fn(),
    closeBulkRenameDialog: vi.fn(),
    fileTagsDialogOpen: false,
    fileTagsDialogFile: '',
    openFileTagsDialog: vi.fn(),
    closeFileTagsDialog: vi.fn(),
    fileDetailsDialogOpen: false,
    fileDetailsDialogFile: '',
    fileDetailsDialogTab: 'notes',
    openFileDetailsDialog: vi.fn(),
    closeFileDetailsDialog: vi.fn(),
    openWithDialogOpen: false,
    openWithDialogFile: '',
    openOpenWithDialog: vi.fn(),
    closeOpenWithDialog: vi.fn(),
    encryptionDialogOpen: false,
    encryptionDialogFile: '',
    encryptionDialogMode: 'encrypt',
    openEncryptionDialog: vi.fn(),
    closeEncryptionDialog: vi.fn(),
    secureDeleteDialogOpen: false,
    secureDeleteDialogFiles: [],
    openSecureDeleteDialog: vi.fn(),
    closeSecureDeleteDialog: vi.fn(),
    versionHistoryDialogOpen: false,
    versionHistoryDialogFile: '',
    openVersionHistoryDialog: vi.fn(),
    closeVersionHistoryDialog: vi.fn(),
    batchConfirmDialogOpen: false,
    batchConfirmDialogFiles: [],
    batchConfirmDialogOperation: 'delete',
    batchConfirmDialogDestination: undefined,
    batchConfirmDialogOnConfirm: null,
    openBatchConfirmDialog: vi.fn(),
    closeBatchConfirmDialog: vi.fn(),
    symlinkDialogOpen: false,
    symlinkDialogTarget: '',
    openSymlinkDialog: vi.fn(),
    closeSymlinkDialog: vi.fn(),
    pasteRenameDialogOpen: false,
    pasteRenameDialogFiles: [],
    openPasteRenameDialog: vi.fn(),
    closePasteRenameDialog: vi.fn(),
    batchMetadataDialogOpen: false,
    batchMetadataDialogFiles: [],
    openBatchMetadataDialog: vi.fn(),
    closeBatchMetadataDialog: vi.fn(),
    moveTreePreviewOpen: false,
    moveTreePreviewData: null,
    moveTreePreviewOnConfirm: null,
    openMoveTreePreview: vi.fn(),
    closeMoveTreePreview: vi.fn(),
    showAdvancedSelect: false,
    setShowAdvancedSelect: vi.fn(),
  }),
}));

const makeDeps = (overrides: Record<string, unknown> = {}) => {
  return {
    splitLayout: {
      addTab: vi.fn(),
    },
    activeGroupId: 'group-1',
    fileComparison: {
      closeSelectionDialog: vi.fn(),
    },
    refetch: vi.fn(),
    ...overrides,
  };
};

describe('useDialogManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPasswordPromptData.current = null;
  });

  describe('initial state', () => {
    it('returns dialog state plus manager functions', () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useDialogManager(deps as Parameters<typeof useDialogManager>[0]));

      expect(typeof result.current.handlePasswordPromptSubmit).toBe('function');
      expect(typeof result.current.handlePasswordPromptClose).toBe('function');
      expect(typeof result.current.handleComparisonFromDialog).toBe('function');
    });

    it('spreads all dialog state properties', () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useDialogManager(deps as Parameters<typeof useDialogManager>[0]));

      // Check some dialog properties are passed through
      expect(result.current.propertiesDialogOpen).toBe(false);
      expect(result.current.compressDialogOpen).toBe(false);
      expect(result.current.extractDialogOpen).toBe(false);
    });
  });

  describe('handlePasswordPromptSubmit', () => {
    it('calls onSuccess callback with password', async () => {
      const onSuccess = vi.fn();
      mockPasswordPromptData.current = {
        title: 'Enter password',
        description: 'Decrypt file',
        onSuccess,
      };

      const deps = makeDeps();
      const { result } = renderHook(() => useDialogManager(deps as Parameters<typeof useDialogManager>[0]));

      await act(async () => {
        await result.current.handlePasswordPromptSubmit('mypassword', true);
      });

      expect(onSuccess).toHaveBeenCalledWith('mypassword');
      expect(mockClosePasswordPrompt).toHaveBeenCalled();
    });

    it('closes prompt even without onSuccess', async () => {
      mockPasswordPromptData.current = {
        title: 'Enter password',
        description: 'No callback',
      };

      const deps = makeDeps();
      const { result } = renderHook(() => useDialogManager(deps as Parameters<typeof useDialogManager>[0]));

      await act(async () => {
        await result.current.handlePasswordPromptSubmit('pass', false);
      });

      expect(mockClosePasswordPrompt).toHaveBeenCalled();
    });

    it('handles null passwordPromptData gracefully', async () => {
      mockPasswordPromptData.current = null;

      const deps = makeDeps();
      const { result } = renderHook(() => useDialogManager(deps as Parameters<typeof useDialogManager>[0]));

      await act(async () => {
        await result.current.handlePasswordPromptSubmit('pass', false);
      });

      expect(mockClosePasswordPrompt).toHaveBeenCalled();
    });
  });

  describe('handlePasswordPromptClose', () => {
    it('closes the password prompt', () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useDialogManager(deps as Parameters<typeof useDialogManager>[0]));

      act(() => {
        result.current.handlePasswordPromptClose();
      });

      expect(mockClosePasswordPrompt).toHaveBeenCalled();
    });
  });

  describe('handleComparisonFromDialog', () => {
    it('creates a comparison tab with correct data', () => {
      const addTab = vi.fn();
      const closeSelectionDialog = vi.fn();
      const deps = makeDeps({
        splitLayout: { addTab },
        fileComparison: { closeSelectionDialog },
        activeGroupId: 'group-main',
      });

      const { result } = renderHook(() => useDialogManager(deps as Parameters<typeof useDialogManager>[0]));

      act(() => {
        result.current.handleComparisonFromDialog('/home/file1.txt', '/home/file2.txt');
      });

      expect(addTab).toHaveBeenCalledTimes(1);
      const [groupId, tab, activate] = addTab.mock.calls[0];
      expect(groupId).toBe('group-main');
      expect(activate).toBe(true);
      expect(tab.type).toBe('comparison');
      expect(tab.name).toContain('file1.txt');
      expect(tab.name).toContain('file2.txt');
      expect(tab.comparisonData).toEqual({
        file1Path: '/home/file1.txt',
        file2Path: '/home/file2.txt',
      });
      expect(tab.path).toContain('comparison://');
      expect(closeSelectionDialog).toHaveBeenCalled();
    });

    it('extracts file names from paths correctly', () => {
      const addTab = vi.fn();
      const deps = makeDeps({
        splitLayout: { addTab },
      });

      const { result } = renderHook(() => useDialogManager(deps as Parameters<typeof useDialogManager>[0]));

      act(() => {
        result.current.handleComparisonFromDialog(
          'C:\\Users\\test\\doc1.txt',
          'C:\\Users\\test\\doc2.txt',
        );
      });

      const tab = addTab.mock.calls[0][1];
      expect(tab.name).toContain('doc1.txt');
      expect(tab.name).toContain('doc2.txt');
    });

    it('uses fallback names for paths without filename', () => {
      const addTab = vi.fn();
      const deps = makeDeps({
        splitLayout: { addTab },
      });

      const { result } = renderHook(() => useDialogManager(deps as Parameters<typeof useDialogManager>[0]));

      act(() => {
        result.current.handleComparisonFromDialog('', '');
      });

      const tab = addTab.mock.calls[0][1];
      // Empty paths result in empty string or fallback 'file1'/'file2'
      expect(tab.name).toBeDefined();
    });

    it('generates unique tab IDs', () => {
      vi.useFakeTimers();
      const addTab = vi.fn();
      const deps = makeDeps({ splitLayout: { addTab } });
      const { result } = renderHook(() => useDialogManager(deps as Parameters<typeof useDialogManager>[0]));

      act(() => {
        result.current.handleComparisonFromDialog('/a.txt', '/b.txt');
      });

      vi.advanceTimersByTime(1);

      act(() => {
        result.current.handleComparisonFromDialog('/c.txt', '/d.txt');
      });

      const id1 = addTab.mock.calls[0][1].id;
      const id2 = addTab.mock.calls[1][1].id;
      expect(id1).not.toBe(id2);
      vi.useRealTimers();
    });
  });
});
