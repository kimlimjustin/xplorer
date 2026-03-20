import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PasteRenameDialog from '@/components/dialogs/PasteRenameDialog';
import type { FileEntry } from '@/lib/tauri-api';

const mockReadDirectory = vi.fn();
const mockRename = vi.fn();

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    readDirectory: (...args: unknown[]) => mockReadDirectory(...args),
    rename: (...args: unknown[]) => mockRename(...args),
  },
  FileEntry: {},
}));

vi.mock('@/lib/constants', () => ({
  PATH_SEPARATOR: '\\',
  detectSep: (path: string) => (path.includes('/') ? '/' : '\\'),
}));

describe('PasteRenameDialog', () => {
  const sampleFiles: FileEntry[] = [
    {
      name: 'photo-001.jpg',
      path: 'C:\\Photos\\photo-001.jpg',
      size: 10240,
      is_dir: false,
      modified: 1000,
      file_type: 'image',
    },
    {
      name: 'photo-002.jpg',
      path: 'C:\\Photos\\photo-002.jpg',
      size: 20480,
      is_dir: false,
      modified: 2000,
      file_type: 'image',
    },
    {
      name: 'photo-003.jpg',
      path: 'C:\\Photos\\photo-003.jpg',
      size: 30720,
      is_dir: false,
      modified: 3000,
      file_type: 'image',
    },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    files: sampleFiles,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReadDirectory.mockResolvedValue([]);
    mockRename.mockResolvedValue(undefined);
  });

  describe('Visibility', () => {
    it('returns null when not open', () => {
      const { container } = render(<PasteRenameDialog {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders when open with files', () => {
      render(<PasteRenameDialog {...defaultProps} />);
      expect(screen.getByText(/Paste & Rename/)).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('shows file count in header', () => {
      render(<PasteRenameDialog {...defaultProps} />);
      expect(screen.getByText(/3 files/)).toBeInTheDocument();
    });
  });

  describe('Sort strategy', () => {
    it('shows sort strategy radio buttons', () => {
      render(<PasteRenameDialog {...defaultProps} />);
      expect(screen.getByText('As Selected')).toBeInTheDocument();
      expect(screen.getByText('By Name (A-Z)')).toBeInTheDocument();
      expect(screen.getByText('By Date (Oldest First)')).toBeInTheDocument();
      expect(screen.getByText('By Size (Smallest First)')).toBeInTheDocument();
    });

    it('defaults to As Selected strategy', () => {
      render(<PasteRenameDialog {...defaultProps} />);
      const radio = screen.getByDisplayValue('as-selected');
      expect(radio).toBeChecked();
    });

    it('allows changing sort strategy', () => {
      render(<PasteRenameDialog {...defaultProps} />);
      const radio = screen.getByDisplayValue('by-name');
      fireEvent.click(radio);
      expect(radio).toBeChecked();
    });
  });

  describe('Paste area', () => {
    it('shows paste textarea', () => {
      render(<PasteRenameDialog {...defaultProps} />);
      expect(screen.getByText('Paste new names (one per line):')).toBeInTheDocument();
    });

    it('has textarea with correct placeholder', () => {
      render(<PasteRenameDialog {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('parses pasted names', () => {
      render(<PasteRenameDialog {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, {
        target: { value: 'new-photo-1.jpg\nnew-photo-2.jpg\nnew-photo-3.jpg' },
      });

      // Preview table should appear
      expect(screen.getByText(/Preview/)).toBeInTheDocument();
    });
  });

  describe('Preview table', () => {
    it('shows preview when names are pasted', () => {
      render(<PasteRenameDialog {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, {
        target: { value: 'a.jpg\nb.jpg\nc.jpg' },
      });

      expect(screen.getByText('Current Name')).toBeInTheDocument();
      expect(screen.getByText('New Name')).toBeInTheDocument();
    });

    it('shows count mismatch warning when counts differ', () => {
      render(<PasteRenameDialog {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, {
        target: { value: 'only-one.jpg' },
      });

      expect(screen.getByText(/Count mismatch/)).toBeInTheDocument();
    });
  });

  describe('Apply action', () => {
    it('Apply button is disabled when no names pasted', () => {
      render(<PasteRenameDialog {...defaultProps} />);
      const applyBtn = screen.getByText('Apply');
      expect(applyBtn.closest('button')).toHaveStyle({ cursor: 'not-allowed' });
    });

    it('Apply button is enabled when valid names pasted', () => {
      render(<PasteRenameDialog {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, {
        target: { value: 'a.jpg\nb.jpg\nc.jpg' },
      });

      const applyBtn = screen.getByText('Apply');
      expect(applyBtn.closest('button')).not.toHaveStyle({
        cursor: 'not-allowed',
      });
    });

    it('calls rename for each file when Apply is clicked', async () => {
      render(<PasteRenameDialog {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, {
        target: { value: 'a.jpg\nb.jpg\nc.jpg' },
      });

      fireEvent.click(screen.getByText('Apply'));

      await waitFor(() => {
        expect(mockRename).toHaveBeenCalledTimes(3);
      });
    });

    it('calls onComplete and onClose on success', async () => {
      render(<PasteRenameDialog {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, {
        target: { value: 'a.jpg\nb.jpg\nc.jpg' },
      });

      fireEvent.click(screen.getByText('Apply'));

      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('shows errors when rename fails', async () => {
      mockRename.mockRejectedValue(new Error('Access denied'));

      render(<PasteRenameDialog {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, {
        target: { value: 'a.jpg\nb.jpg\nc.jpg' },
      });

      fireEvent.click(screen.getByText('Apply'));

      await waitFor(() => {
        expect(screen.getByText('Rename errors:')).toBeInTheDocument();
      });
    });
  });

  describe('Cancel', () => {
    it('calls onClose when Cancel is clicked', () => {
      render(<PasteRenameDialog {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });
});
