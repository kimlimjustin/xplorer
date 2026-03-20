import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PerformanceDashboard from '@/components/panels/PerformanceDashboard';
import type { FileEntry } from '@/lib/tauri-api';

const mockRefreshStats = vi.fn();
const mockRebuildTokenIndex = vi.fn();
const mockEmptyTrash = vi.fn();

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    rebuildTokenIndex: (...args: unknown[]) => mockRebuildTokenIndex(...args),
    emptyTrash: (...args: unknown[]) => mockEmptyTrash(...args),
  },
}));

vi.mock('@/lib/utils', () => ({
  formatFileSize: vi.fn((bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  }),
}));

vi.mock('@/hooks/use-performance-stats', () => ({
  usePerformanceStats: vi.fn(() => ({
    directoryStats: {
      fileCount: 150,
      folderCount: 25,
      totalSize: 1048576,
      cachedFolderCount: 10,
    },
    indexingStatus: {
      aiIndexed: 50,
      aiQueueLength: 0,
      isAiProcessing: false,
      tokenTotalFiles: 120,
      tokenTotalTokens: 5000,
      tokenLastUpdated: 0,
      isTokenizerIndexing: false,
    },
    recentOps: [
      {
        id: 'op-1',
        operation: 'Copy',
        success: true,
        timestamp: new Date().toISOString(),
        paths: ['file1.txt', 'file2.txt'],
        details: 'Copied 2 files',
      },
      {
        id: 'op-2',
        operation: 'Delete',
        success: true,
        timestamp: new Date(Date.now() - 60000).toISOString(),
        paths: ['old.txt'],
        details: 'Deleted 1 file',
      },
    ],
    suggestions: [
      {
        id: 'trash',
        title: 'Empty Trash',
        description: 'Clear deleted files from trash',
        estimatedSize: 5242880,
        actionLabel: 'Empty',
        actionType: 'action',
      },
    ],
    memoryUsage: 15728640,
    isLoading: false,
    refreshStats: mockRefreshStats,
  })),
}));

describe('PerformanceDashboard', () => {
  const sampleFiles: FileEntry[] = [
    {
      name: 'test.txt',
      path: 'C:\\Projects\\test.txt',
      size: 1024,
      is_dir: false,
      modified: 0,
      file_type: 'text',
    },
  ];

  const defaultProps = {
    currentPath: 'C:\\Projects',
    allFiles: sampleFiles,
    navigateToPath: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRebuildTokenIndex.mockResolvedValue(undefined);
    mockEmptyTrash.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('renders Performance Metrics title', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
    });

    it('renders Refresh button', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  describe('System Stats card', () => {
    it('shows System Stats section', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('System Stats')).toBeInTheDocument();
    });

    it('shows file count', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('Files')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
    });

    it('shows folder count', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('Folders')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('shows total size', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('Total Size')).toBeInTheDocument();
    });

    it('shows JS Heap Usage', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('JS Heap Usage')).toBeInTheDocument();
    });
  });

  describe('Indexing Status card', () => {
    it('shows Indexing Status section', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('Indexing Status')).toBeInTheDocument();
    });

    it('shows AI Indexer status', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('AI Indexer')).toBeInTheDocument();
      expect(screen.getByText('Idle')).toBeInTheDocument();
    });

    it('shows Search Tokenizer status', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('Search Tokenizer')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('shows Reindex button', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('Reindex')).toBeInTheDocument();
    });

    it('calls rebuildTokenIndex when Reindex is clicked', async () => {
      render(<PerformanceDashboard {...defaultProps} />);
      fireEvent.click(screen.getByText('Reindex'));

      await waitFor(() => {
        expect(mockRebuildTokenIndex).toHaveBeenCalled();
      });
    });
  });

  describe('Recent Operations card', () => {
    it('shows Recent Operations section', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('Recent Operations')).toBeInTheDocument();
    });

    it('shows operation names', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('shows file counts for operations', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('2 files')).toBeInTheDocument();
      expect(screen.getByText('1 file')).toBeInTheDocument();
    });
  });

  describe('Cleanup Suggestions card', () => {
    it('shows Cleanup Suggestions section', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('Cleanup Suggestions')).toBeInTheDocument();
    });

    it('shows suggestion title and action', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('Empty Trash')).toBeInTheDocument();
      expect(screen.getByText('Empty')).toBeInTheDocument();
    });

    it('shows suggestion description', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      expect(screen.getByText('Clear deleted files from trash')).toBeInTheDocument();
    });

    it('calls emptyTrash when Empty button is clicked', async () => {
      render(<PerformanceDashboard {...defaultProps} />);
      fireEvent.click(screen.getByText('Empty'));

      await waitFor(() => {
        expect(mockEmptyTrash).toHaveBeenCalled();
      });
    });
  });

  describe('Refresh', () => {
    it('calls refreshStats when Refresh button is clicked', () => {
      render(<PerformanceDashboard {...defaultProps} />);
      fireEvent.click(screen.getByText('Refresh'));
      expect(mockRefreshStats).toHaveBeenCalled();
    });
  });
});
