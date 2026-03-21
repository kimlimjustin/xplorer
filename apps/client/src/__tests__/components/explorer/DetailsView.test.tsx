import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DetailsView from '@/components/explorer/DetailsView';
import type { FileEntry } from '@/lib/tauri-api';

// Mock @tanstack/react-virtual
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    scrollToIndex: vi.fn(),
  }),
}));

// Mock hooks used by FileRow
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {},
  FileEntry: {},
}));

describe('DetailsView', () => {
  const mockHandleFileClick = vi.fn();
  const mockHandleFileDoubleClick = vi.fn();
  const mockHandleFileRightClick = vi.fn();
  const mockHandleBackgroundRightClick = vi.fn();
  const mockGetFolderSize = vi.fn(() => null);
  const mockIsCalculatingSize = vi.fn(() => false);
  const mockCalculateFolderSize = vi.fn();

  const sampleFiles: FileEntry[] = [
    {
      name: 'document.txt',
      path: 'C:\\Users\\Test\\document.txt',
      size: 1024,
      is_dir: false,
      modified: 1710000000,
      file_type: 'text',
    },
    {
      name: 'images',
      path: 'C:\\Users\\Test\\images',
      size: 0,
      is_dir: true,
      modified: 1710001000,
      file_type: 'folder',
    },
    {
      name: 'script.js',
      path: 'C:\\Users\\Test\\script.js',
      size: 2048,
      is_dir: false,
      modified: 1710002000,
      file_type: 'javascript',
    },
  ];

  const defaultProps = {
    files: sampleFiles,
    selectedFiles: new Set<string>(),
    currentPath: 'C:\\Users\\Test',
    groupId: 'main',
    getFileIcon: (file: FileEntry) => <span data-testid={`icon-${file.name}`}>icon</span>,
    formatFileSize: (bytes: number) => `${bytes} B`,
    formatFolderSize: (info: unknown, isCalc?: boolean) => {
      if (isCalc) return 'Calculating...';
      return info ? '1 MB' : '';
    },
    formatDate: (ts: number) => `date-${ts}`,
    handleFileClick: mockHandleFileClick,
    handleFileDoubleClick: mockHandleFileDoubleClick,
    handleFileRightClick: mockHandleFileRightClick,
    handleBackgroundRightClick: mockHandleBackgroundRightClick,
    getFolderSize: mockGetFolderSize,
    isCalculatingSize: mockIsCalculatingSize,
    calculateFolderSize: mockCalculateFolderSize,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Table structure', () => {
    it('renders with table role', () => {
      render(<DetailsView {...defaultProps} />);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('renders column headers', () => {
      render(<DetailsView {...defaultProps} />);
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Modified')).toBeInTheDocument();
    });

    it('has correct aria-label on table', () => {
      render(<DetailsView {...defaultProps} />);
      expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'File list');
    });
  });

  describe('File rows', () => {
    it('renders all file entries', () => {
      render(<DetailsView {...defaultProps} />);

      expect(screen.getByText('document.txt')).toBeInTheDocument();
      expect(screen.getByText('images')).toBeInTheDocument();
      expect(screen.getByText('script.js')).toBeInTheDocument();
    });

    it('renders file type badges', () => {
      render(<DetailsView {...defaultProps} />);
      expect(screen.getByText('text')).toBeInTheDocument();
      expect(screen.getByText('Folder')).toBeInTheDocument();
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });

    it('renders file sizes', () => {
      render(<DetailsView {...defaultProps} />);
      expect(screen.getByText('1024 B')).toBeInTheDocument();
      expect(screen.getByText('2048 B')).toBeInTheDocument();
    });

    it('renders formatted dates', () => {
      render(<DetailsView {...defaultProps} />);
      expect(screen.getByText('date-1710000000')).toBeInTheDocument();
      expect(screen.getByText('date-1710002000')).toBeInTheDocument();
    });

    it('renders icons for each file', () => {
      render(<DetailsView {...defaultProps} />);
      expect(screen.getByTestId('icon-document.txt')).toBeInTheDocument();
      expect(screen.getByTestId('icon-images')).toBeInTheDocument();
    });

    it('renders rows with correct role and aria-label', () => {
      render(<DetailsView {...defaultProps} />);
      const rows = screen.getAllByRole('row');
      // 1 header row + 3 data rows
      expect(rows.length).toBe(4);
    });
  });

  describe('Selection highlighting', () => {
    it('applies selected styling when file is in selectedFiles', () => {
      const selectedFiles = new Set(['C:\\Users\\Test\\document.txt']);
      render(<DetailsView {...defaultProps} selectedFiles={selectedFiles} />);

      const row = screen.getByRole('row', { name: 'document.txt' });
      expect(row).toHaveAttribute('aria-selected', 'true');
    });

    it('does not apply selected styling for unselected files', () => {
      render(<DetailsView {...defaultProps} />);

      const row = screen.getByRole('row', { name: 'document.txt' });
      expect(row).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Click handlers', () => {
    it('calls handleFileClick on click', () => {
      render(<DetailsView {...defaultProps} />);

      const row = screen.getByRole('row', { name: 'document.txt' });
      fireEvent.click(row);
      expect(mockHandleFileClick).toHaveBeenCalledWith(sampleFiles[0], expect.any(Object));
    });

    it('calls handleFileDoubleClick on double click', () => {
      render(<DetailsView {...defaultProps} />);

      const row = screen.getByRole('row', { name: 'document.txt' });
      fireEvent.doubleClick(row);
      expect(mockHandleFileDoubleClick).toHaveBeenCalledWith(sampleFiles[0]);
    });

    it('calls handleFileRightClick on context menu', () => {
      render(<DetailsView {...defaultProps} />);

      const row = screen.getByRole('row', { name: 'document.txt' });
      fireEvent.contextMenu(row);
      expect(mockHandleFileRightClick).toHaveBeenCalledWith(sampleFiles[0], expect.any(Object));
    });

    it('calls handleFileDoubleClick on Enter key', () => {
      render(<DetailsView {...defaultProps} />);

      const row = screen.getByRole('row', { name: 'document.txt' });
      fireEvent.keyDown(row, { key: 'Enter' });
      expect(mockHandleFileDoubleClick).toHaveBeenCalledWith(sampleFiles[0]);
    });

    it('calls handleBackgroundRightClick on background context menu', () => {
      render(<DetailsView {...defaultProps} />);

      const table = screen.getByRole('table');
      fireEvent.contextMenu(table);
      expect(mockHandleBackgroundRightClick).toHaveBeenCalled();
    });
  });

  describe('Folder size', () => {
    it('shows Calculate button for folders without size info', () => {
      mockGetFolderSize.mockReturnValue(null);
      mockIsCalculatingSize.mockReturnValue(false);
      render(<DetailsView {...defaultProps} />);

      expect(screen.getByText('Calculate')).toBeInTheDocument();
    });

    it('calls calculateFolderSize when Calculate button is clicked', () => {
      mockGetFolderSize.mockReturnValue(null);
      mockIsCalculatingSize.mockReturnValue(false);
      render(<DetailsView {...defaultProps} />);

      fireEvent.click(screen.getByText('Calculate'));
      expect(mockCalculateFolderSize).toHaveBeenCalledWith('C:\\Users\\Test\\images');
    });
  });

  describe('File groups', () => {
    it('renders grouped view when fileGroups are provided', () => {
      const fileGroups = [
        {
          group: 'Documents',
          files: [sampleFiles[0]],
        },
        {
          group: 'Folders',
          files: [sampleFiles[1]],
        },
      ];
      render(<DetailsView {...defaultProps} fileGroups={fileGroups} />);

      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Folders')).toBeInTheDocument();
      // Both groups have (1) count
      const counts = screen.getAllByText('(1)');
      expect(counts).toHaveLength(2);
    });
  });

  describe('Empty state', () => {
    it('renders header even with no files', () => {
      render(<DetailsView {...defaultProps} files={[]} />);
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });
});
