import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MoveTreePreviewDialog, {
  type MoveTreePreviewData,
} from '@/components/dialogs/MoveTreePreviewDialog';
import type { FileEntry } from '@/lib/tauri-api';

const mockReadDirectory = vi.fn();

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    readDirectory: (...args: unknown[]) => mockReadDirectory(...args),
  },
}));

vi.mock('@/lib/utils', () => ({
  formatFileSize: vi.fn((bytes: number) => `${bytes} B`),
}));

vi.mock('@/lib/constants', () => ({
  detectSep: (path: string) => (path.includes('/') ? '/' : '\\'),
  PATH_SEPARATOR: '\\',
}));

vi.mock('@/lib/move-tree-preview', () => ({
  computeMoveTree: vi.fn((sourceFiles: FileEntry[], destPath: string, destFiles: FileEntry[]) => ({
    tree: sourceFiles.map((f) => ({
      name: f.name,
      path: `${destPath}\\${f.name}`,
      isDir: f.is_dir,
      status: 'incoming' as const,
      size: f.size,
      children: [],
      sourcePath: f.path,
    })),
    conflicts: [],
    totalIncomingSize: sourceFiles.reduce((acc, f) => acc + f.size, 0),
    totalExistingSize: destFiles.reduce((acc, f) => acc + f.size, 0),
  })),
  unresolvedConflictCount: vi.fn(() => 0),
}));

describe('MoveTreePreviewDialog', () => {
  const sourceFiles: FileEntry[] = [
    {
      name: 'file1.txt',
      path: 'C:\\Source\\file1.txt',
      size: 1024,
      is_dir: false,
      modified: 0,
      file_type: 'text',
    },
    {
      name: 'file2.txt',
      path: 'C:\\Source\\file2.txt',
      size: 2048,
      is_dir: false,
      modified: 0,
      file_type: 'text',
    },
  ];

  const data: MoveTreePreviewData = {
    sourceFiles,
    destPath: 'C:\\Destination',
    operation: 'move',
  };

  const defaultProps = {
    isOpen: true,
    data,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReadDirectory.mockResolvedValue([]);
  });

  describe('Visibility', () => {
    it('returns null when not open', () => {
      const { container } = render(<MoveTreePreviewDialog {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null when data is null', () => {
      const { container } = render(<MoveTreePreviewDialog {...defaultProps} data={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders when open with data', () => {
      render(<MoveTreePreviewDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('shows move operation title with file count', () => {
      render(<MoveTreePreviewDialog {...defaultProps} />);
      expect(screen.getByText('Move 2 files to Destination')).toBeInTheDocument();
    });

    it('shows copy operation title for copy mode', () => {
      const copyData: MoveTreePreviewData = { ...data, operation: 'copy' };
      render(<MoveTreePreviewDialog {...defaultProps} data={copyData} />);
      expect(screen.getByText('Copy 2 files to Destination')).toBeInTheDocument();
    });

    it('shows preview description', () => {
      render(<MoveTreePreviewDialog {...defaultProps} />);
      expect(
        screen.getByText(/Preview the resulting directory structure before move/),
      ).toBeInTheDocument();
    });
  });

  describe('Source panel', () => {
    it('shows source panel header with item count', () => {
      render(<MoveTreePreviewDialog {...defaultProps} />);
      expect(screen.getByText('Source (2 items)')).toBeInTheDocument();
    });

    it('shows source file names', async () => {
      render(<MoveTreePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('file1.txt')).toBeInTheDocument();
        expect(screen.getByText('file2.txt')).toBeInTheDocument();
      });
    });
  });

  describe('Destination panel', () => {
    it('shows destination panel header', () => {
      render(<MoveTreePreviewDialog {...defaultProps} />);
      expect(screen.getByText('Destination: Destination')).toBeInTheDocument();
    });
  });

  describe('Confirm and Cancel', () => {
    it('shows Move button for move operation', () => {
      render(<MoveTreePreviewDialog {...defaultProps} />);
      expect(screen.getByText('Move')).toBeInTheDocument();
    });

    it('shows Copy button for copy operation', () => {
      const copyData: MoveTreePreviewData = { ...data, operation: 'copy' };
      render(<MoveTreePreviewDialog {...defaultProps} data={copyData} />);
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('shows Cancel button', () => {
      render(<MoveTreePreviewDialog {...defaultProps} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('calls onCancel when Cancel is clicked', () => {
      render(<MoveTreePreviewDialog {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when close button is clicked', () => {
      render(<MoveTreePreviewDialog {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Close'));
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('calls onCancel on Escape key', () => {
      render(<MoveTreePreviewDialog {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('Confirm action', () => {
    it('calls onConfirm with resolutions when Move is clicked', async () => {
      render(<MoveTreePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        const moveBtn = screen.getByText('Move');
        expect(moveBtn.closest('button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByText('Move'));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith(expect.any(Map));
    });
  });
});
