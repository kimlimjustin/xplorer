import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FileGrid from '@/components/explorer/FileGrid';
import { FileEntry, FolderSizeInfo } from '@/lib/tauri-api';

// Mock the drag/drop hooks
vi.mock('@/hooks/use-draggable', () => ({
  useDraggable: () => ({
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
    onMouseLeave: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-droppable', () => ({
  useDroppable: () => ({ current: null }),
}));

vi.mock('@/contexts/DragDropContext', () => ({
  useDragDropContext: () => ({
    startInternalDrag: vi.fn(),
  }),
}));

vi.mock('@crabnebula/tauri-plugin-drag', () => ({
  startDrag: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 0,
    getVirtualItems: () => [],
    scrollToIndex: vi.fn(),
  }),
}));

describe('FileGrid', () => {
  const mockFiles: FileEntry[] = [
    {
      name: 'folder1',
      path: 'C:\\Users\\Test\\folder1',
      size: 0,
      is_dir: true,
      modified: Date.now(),
      file_type: 'folder',
    },
    {
      name: 'document.txt',
      path: 'C:\\Users\\Test\\document.txt',
      size: 1024,
      is_dir: false,
      modified: Date.now() - 86400000,
      file_type: 'text',
    },
    {
      name: 'image.png',
      path: 'C:\\Users\\Test\\image.png',
      size: 2048,
      is_dir: false,
      modified: Date.now() - 172800000,
      file_type: 'image',
    },
  ];

  const mockProps = {
    files: mockFiles,
    isLoading: false,
    viewMode: 'medium',
    selectedFiles: new Set<string>(),
    currentPath: 'C:\\Users\\Test',
    groupId: 'main',
    getFileIcon: vi.fn((file: FileEntry) => (file.is_dir ? '📁' : '📄')),
    formatFileSize: vi.fn((bytes: number) => `${bytes} B`),
    formatFolderSize: vi.fn((info: FolderSizeInfo | null, isCalculating?: boolean) => {
      if (isCalculating) return 'Calculating...';
      return info ? `${info.file_count} items` : '--';
    }),
    formatDate: vi.fn((timestamp: number) => new Date(timestamp).toLocaleDateString()),
    handleFileClick: vi.fn(),
    handleFileDoubleClick: vi.fn(),
    handleFileRightClick: vi.fn(),
    handleBackgroundRightClick: vi.fn(),
    getFolderSize: vi.fn(
      () =>
        ({
          file_count: 5,
          total_size: 10240,
          dir_count: 1,
          is_cached: false,
          cache_timestamp: 0,
        }) as FolderSizeInfo,
    ),
    isCalculatingSize: vi.fn(() => false),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading and Empty States', () => {
    it('shows loading state', () => {
      const loadingProps = { ...mockProps, isLoading: true };
      render(<FileGrid {...loadingProps} />);

      // FileGrid renders a FileGridSkeleton with role="status" and aria-label="Loading files"
      expect(screen.getByRole('status', { name: 'Loading files' })).toBeInTheDocument();
    });

    it('shows empty state when no files', () => {
      const emptyProps = { ...mockProps, files: [] };
      render(<FileGrid {...emptyProps} />);

      expect(screen.getByText('This folder is empty')).toBeInTheDocument();
    });
  });

  describe('File Interactions', () => {
    it('renders all files', () => {
      render(<FileGrid {...mockProps} />);

      expect(screen.getByText('folder1')).toBeInTheDocument();
      expect(screen.getByText('document.txt')).toBeInTheDocument();
      expect(screen.getByText('image.png')).toBeInTheDocument();
    });

    it('calls handleFileClick when file is clicked', () => {
      render(<FileGrid {...mockProps} />);

      const file = screen.getByText('document.txt');
      const fileItem = file.closest('[role="option"]')!;
      fireEvent.click(fileItem);

      expect(mockProps.handleFileClick).toHaveBeenCalledWith(mockFiles[1], expect.any(Object));
    });

    it('calls handleFileDoubleClick when file is double-clicked', () => {
      render(<FileGrid {...mockProps} />);

      const file = screen.getByText('document.txt');
      const fileItem = file.closest('[role="option"]')!;
      fireEvent.doubleClick(fileItem);

      expect(mockProps.handleFileDoubleClick).toHaveBeenCalledWith(mockFiles[1]);
    });

    it('calls handleFileRightClick when file is right-clicked', () => {
      render(<FileGrid {...mockProps} />);

      const file = screen.getByText('document.txt');
      const fileItem = file.closest('[role="option"]')!;
      fireEvent.contextMenu(fileItem);

      expect(mockProps.handleFileRightClick).toHaveBeenCalledWith(mockFiles[1], expect.any(Object));
    });

    it('calls handleBackgroundRightClick when background is right-clicked', () => {
      render(<FileGrid {...mockProps} />);

      const grid = document.querySelector('.grid, .space-y-0');
      if (grid) {
        fireEvent.contextMenu(grid);
        expect(mockProps.handleBackgroundRightClick).toHaveBeenCalled();
      }
    });
  });

  describe('File Selection', () => {
    it('highlights selected files', () => {
      const selectedProps = {
        ...mockProps,
        selectedFiles: new Set(['C:\\Users\\Test\\document.txt']),
      };
      render(<FileGrid {...selectedProps} />);

      const selectedFile = screen.getByText('document.txt').closest('[role="option"]');
      expect(selectedFile?.className).toContain('bg-xp-blue');
    });

    it('does not highlight unselected files', () => {
      render(<FileGrid {...mockProps} />);

      const unselectedFile = screen.getByText('document.txt').closest('[role="option"]');
      expect(unselectedFile?.className).not.toContain('bg-xp-blue');
    });
  });

  describe('View Modes', () => {
    it('renders medium view mode correctly', () => {
      render(<FileGrid {...mockProps} />);

      const grid = document.querySelector('.grid');
      expect(grid).toHaveClass('grid-cols-auto-fill-medium');
    });

    it('renders large view mode correctly', () => {
      const largeProps = { ...mockProps, viewMode: 'large' };
      render(<FileGrid {...largeProps} />);

      const grid = document.querySelector('.grid');
      expect(grid).toHaveClass('grid-cols-auto-fill-large');
    });

    it('renders small view mode correctly', () => {
      const smallProps = { ...mockProps, viewMode: 'small' };
      render(<FileGrid {...smallProps} />);

      const grid = document.querySelector('.grid');
      expect(grid).toHaveClass('grid-cols-auto-fill-small');
    });

    it('renders list view mode correctly', () => {
      const listProps = { ...mockProps, viewMode: 'list' };
      render(<FileGrid {...listProps} />);

      const grid = document.querySelector('.grid');
      expect(grid).toHaveClass('grid-cols-auto-fill-list');
    });

    it('renders details view mode with table structure', () => {
      const detailsProps = { ...mockProps, viewMode: 'details' };
      render(<FileGrid {...detailsProps} />);

      // Details view should show column headers
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Modified')).toBeInTheDocument();
    });

    it('renders tree view mode', () => {
      const treeProps = { ...mockProps, viewMode: 'tree' };
      render(<FileGrid {...treeProps} />);

      // Tree view should render files in tree structure
      expect(screen.getByText('folder1')).toBeInTheDocument();
      expect(screen.getByText('document.txt')).toBeInTheDocument();
    });
  });

  describe('File Icons and Formatting', () => {
    it('calls getFileIcon for each file', () => {
      render(<FileGrid {...mockProps} />);

      expect(mockProps.getFileIcon).toHaveBeenCalledTimes(3);
      expect(mockProps.getFileIcon).toHaveBeenCalledWith(mockFiles[0]);
      expect(mockProps.getFileIcon).toHaveBeenCalledWith(mockFiles[1]);
      expect(mockProps.getFileIcon).toHaveBeenCalledWith(mockFiles[2]);
    });

    it('formats file sizes correctly', () => {
      const detailsProps = { ...mockProps, viewMode: 'details' };
      render(<FileGrid {...detailsProps} />);

      expect(mockProps.formatFileSize).toHaveBeenCalledWith(1024);
      expect(mockProps.formatFileSize).toHaveBeenCalledWith(2048);
    });

    it('formats folder sizes correctly', () => {
      const detailsProps = { ...mockProps, viewMode: 'details' };
      render(<FileGrid {...detailsProps} />);

      expect(mockProps.formatFolderSize).toHaveBeenCalled();
    });

    it('formats dates correctly', () => {
      const detailsProps = { ...mockProps, viewMode: 'details' };
      render(<FileGrid {...detailsProps} />);

      // formatDate is called once per file; async effects may cause additional renders
      expect(mockProps.formatDate.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(mockProps.formatDate).toHaveBeenCalledWith(mockFiles[0].modified);
      expect(mockProps.formatDate).toHaveBeenCalledWith(mockFiles[1].modified);
      expect(mockProps.formatDate).toHaveBeenCalledWith(mockFiles[2].modified);
    });
  });

  describe('Tree View Functionality', () => {
    it('toggles folder expansion in tree view', async () => {
      const treeProps = { ...mockProps, viewMode: 'tree' };
      render(<FileGrid {...treeProps} />);

      const folderToggle = screen.getAllByRole('button')[0];
      fireEvent.click(folderToggle);

      // Should show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper cursor styles for interactive elements', () => {
      render(<FileGrid {...mockProps} />);

      const fileElements = document.querySelectorAll('[class*="cursor-pointer"]');
      expect(fileElements.length).toBeGreaterThan(0);
    });

    it('provides hover states', () => {
      render(<FileGrid {...mockProps} />);

      const fileElements = document.querySelectorAll('[class*="hover:bg-xp-surface-light"]');
      expect(fileElements.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles files with no file type', () => {
      const filesWithoutType = [
        {
          ...mockFiles[0],
          file_type: '',
        },
      ];
      const propsWithoutType = { ...mockProps, files: filesWithoutType };

      expect(() => render(<FileGrid {...propsWithoutType} />)).not.toThrow();
    });

    it('handles very long file names', () => {
      const filesWithLongNames = [
        {
          ...mockFiles[0],
          name: 'This is a very very very long file name that should be truncated properly',
        },
      ];
      const propsWithLongNames = { ...mockProps, files: filesWithLongNames };

      render(<FileGrid {...propsWithLongNames} />);

      const longNameElement = document.querySelector('.truncate');
      expect(longNameElement).toBeInTheDocument();
    });

    it('handles missing folder size info', () => {
      const propsWithoutSize = {
        ...mockProps,
        getFolderSize: vi.fn(() => null),
        viewMode: 'details',
      };

      render(<FileGrid {...propsWithoutSize} />);

      // In details view, folder size shows a "Calculate" button when there's no cached info
      expect(propsWithoutSize.getFolderSize).toHaveBeenCalled();
    });
  });
});
