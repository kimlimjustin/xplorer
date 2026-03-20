import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BulkRenameDialog from '@/components/dialogs/BulkRenameDialog';
import { FileEntry, TauriAPI } from '@/lib/tauri-api';

// Mock use-toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

// Extend TauriAPI mock
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    bulkRename: vi.fn(() => Promise.resolve([])),
  },
  FileEntry: {},
}));

describe('BulkRenameDialog', () => {
  const mockFiles: FileEntry[] = [
    {
      name: 'photo_001.jpg',
      path: 'C:\\Users\\Test\\photo_001.jpg',
      size: 1024,
      is_dir: false,
      modified: Date.now(),
      file_type: 'image',
    },
    {
      name: 'photo_002.jpg',
      path: 'C:\\Users\\Test\\photo_002.jpg',
      size: 2048,
      is_dir: false,
      modified: Date.now(),
      file_type: 'image',
    },
    {
      name: 'photo_003.jpg',
      path: 'C:\\Users\\Test\\photo_003.jpg',
      size: 3072,
      is_dir: false,
      modified: Date.now(),
      file_type: 'image',
    },
  ];

  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    files: mockFiles,
    onComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog Visibility', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(<BulkRenameDialog {...mockProps} isOpen={false} />);

      expect(container.innerHTML).toBe('');
    });

    it('renders the dialog when isOpen is true', () => {
      render(<BulkRenameDialog {...mockProps} />);

      expect(screen.getByText('Bulk Rename')).toBeInTheDocument();
    });
  });

  describe('Basic Rendering', () => {
    it('displays the dialog title', () => {
      render(<BulkRenameDialog {...mockProps} />);

      expect(screen.getByText('Bulk Rename')).toBeInTheDocument();
    });

    it('displays file count summary', () => {
      render(<BulkRenameDialog {...mockProps} />);

      expect(screen.getByText(/3\s*files/)).toBeInTheDocument();
    });

    it('displays singular file count when only one file', () => {
      render(<BulkRenameDialog {...mockProps} files={[mockFiles[0]]} />);

      expect(screen.getByText(/1\s*file(?!s)/)).toBeInTheDocument();
    });

    it('displays pattern input', () => {
      render(<BulkRenameDialog {...mockProps} />);

      expect(screen.getByText('Pattern (Regex)')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/find_this/)).toBeInTheDocument();
    });

    it('displays replacement input', () => {
      render(<BulkRenameDialog {...mockProps} />);

      expect(screen.getByText('Replacement')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/\$1_renamed/)).toBeInTheDocument();
    });

    it('displays Cancel button', () => {
      render(<BulkRenameDialog {...mockProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('displays Preview button', () => {
      render(<BulkRenameDialog {...mockProps} />);

      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('displays Rename button', () => {
      render(<BulkRenameDialog {...mockProps} />);

      expect(screen.getByText('Rename')).toBeInTheDocument();
    });
  });

  describe('Quick Presets', () => {
    it('displays preset buttons', () => {
      render(<BulkRenameDialog {...mockProps} />);

      expect(screen.getByText('Quick Presets')).toBeInTheDocument();
      expect(screen.getByText('Add prefix')).toBeInTheDocument();
      expect(screen.getByText('Add suffix')).toBeInTheDocument();
      expect(screen.getByText('Replace text')).toBeInTheDocument();
      expect(screen.getByText('Sequential numbering')).toBeInTheDocument();
    });

    it('applies Add prefix preset when clicked', () => {
      render(<BulkRenameDialog {...mockProps} />);

      fireEvent.click(screen.getByText('Add prefix'));

      const patternInput = screen.getByPlaceholderText(/find_this/) as HTMLInputElement;
      expect(patternInput.value).toBe('^(.+)$');
    });

    it('applies Replace text preset when clicked', () => {
      render(<BulkRenameDialog {...mockProps} />);

      fireEvent.click(screen.getByText('Replace text'));

      const patternInput = screen.getByPlaceholderText(/find_this/) as HTMLInputElement;
      expect(patternInput.value).toBe('find');
    });

    it('shows preset descriptions', () => {
      render(<BulkRenameDialog {...mockProps} />);

      expect(screen.getByText('Add text before filename')).toBeInTheDocument();
      expect(screen.getByText('Add text before extension')).toBeInTheDocument();
      expect(screen.getByText('Find and replace in filename')).toBeInTheDocument();
      expect(screen.getByText('Rename to prefix_001, prefix_002...')).toBeInTheDocument();
    });
  });

  describe('Pattern and Replacement Inputs', () => {
    it('allows typing in pattern input', () => {
      render(<BulkRenameDialog {...mockProps} />);

      const patternInput = screen.getByPlaceholderText(/find_this/) as HTMLInputElement;
      fireEvent.change(patternInput, { target: { value: 'test_pattern' } });

      expect(patternInput.value).toBe('test_pattern');
    });

    it('allows typing in replacement input', () => {
      render(<BulkRenameDialog {...mockProps} />);

      const replacementInput = screen.getByPlaceholderText(/\$1_renamed/) as HTMLInputElement;
      fireEvent.change(replacementInput, { target: { value: 'new_$1' } });

      expect(replacementInput.value).toBe('new_$1');
    });
  });

  describe('Preview Functionality', () => {
    it('calls TauriAPI.bulkRename in preview mode when Preview is clicked', async () => {
      vi.mocked(TauriAPI.bulkRename).mockResolvedValueOnce([
        { original_name: 'photo_001.jpg', new_name: 'test_photo_001.jpg', success: true },
      ]);

      render(<BulkRenameDialog {...mockProps} />);

      // Set a pattern first
      const patternInput = screen.getByPlaceholderText(/find_this/) as HTMLInputElement;
      fireEvent.change(patternInput, { target: { value: 'photo' } });

      // Wait for auto-preview debounce
      await waitFor(
        () => {
          expect(TauriAPI.bulkRename).toHaveBeenCalled();
        },
        { timeout: 500 },
      );
    });

    it('shows preview table with original and new names', async () => {
      vi.mocked(TauriAPI.bulkRename).mockResolvedValue([
        { original_name: 'photo_001.jpg', new_name: 'img_001.jpg', success: true },
        { original_name: 'photo_002.jpg', new_name: 'img_002.jpg', success: true },
      ]);

      render(<BulkRenameDialog {...mockProps} />);

      const patternInput = screen.getByPlaceholderText(/find_this/) as HTMLInputElement;
      fireEvent.change(patternInput, { target: { value: 'photo' } });

      const replacementInput = screen.getByPlaceholderText(/\$1_renamed/) as HTMLInputElement;
      fireEvent.change(replacementInput, { target: { value: 'img' } });

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument();
      });

      // Click explicit preview
      fireEvent.click(screen.getByText('Preview'));

      await waitFor(() => {
        // DiffText renders names across multiple <span> elements,
        // so use the title attribute on the <td> cells instead.
        expect(screen.getByTitle('photo_001.jpg')).toBeInTheDocument();
        expect(screen.getByTitle('img_001.jpg')).toBeInTheDocument();
      });
    });

    it('shows preview table headers', async () => {
      vi.mocked(TauriAPI.bulkRename).mockResolvedValue([
        { original_name: 'file.txt', new_name: 'new_file.txt', success: true },
      ]);

      render(<BulkRenameDialog {...mockProps} />);

      const patternInput = screen.getByPlaceholderText(/find_this/) as HTMLInputElement;
      fireEvent.change(patternInput, { target: { value: 'file' } });

      await waitFor(
        () => {
          expect(screen.getByText('Current Name')).toBeInTheDocument();
          expect(screen.getByText('New Name')).toBeInTheDocument();
        },
        { timeout: 500 },
      );
    });
  });

  describe('Pattern Error', () => {
    it('displays pattern error when regex is invalid', async () => {
      vi.mocked(TauriAPI.bulkRename).mockRejectedValueOnce(new Error('Invalid regex pattern'));

      render(<BulkRenameDialog {...mockProps} />);

      const patternInput = screen.getByPlaceholderText(/find_this/) as HTMLInputElement;
      fireEvent.change(patternInput, { target: { value: '[invalid' } });

      await waitFor(
        () => {
          expect(screen.getByText('Invalid regex pattern')).toBeInTheDocument();
        },
        { timeout: 500 },
      );
    });
  });

  describe('Rename Execution', () => {
    it('disables Rename button when pattern is empty', () => {
      render(<BulkRenameDialog {...mockProps} />);

      const renameSpan = screen.getByText('Rename');
      const renameButton = renameSpan.closest('button');
      expect(renameButton).toBeDisabled();
    });

    it('disables Preview button when pattern is empty', () => {
      render(<BulkRenameDialog {...mockProps} />);

      const previewSpan = screen.getByText('Preview');
      const previewButton = previewSpan.closest('button');
      expect(previewButton).toBeDisabled();
    });
  });

  describe('Close Behavior', () => {
    it('calls onClose when Cancel is clicked', () => {
      render(<BulkRenameDialog {...mockProps} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close (X) button is clicked', () => {
      render(<BulkRenameDialog {...mockProps} />);

      const closeButtons = document.querySelectorAll('button');
      // Find the close button (the one in the header with an SVG X icon)
      const closeButton = Array.from(closeButtons).find(
        (btn) => btn.querySelector('svg') && btn.closest('.border-b'),
      );

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(mockProps.onClose).toHaveBeenCalled();
      }
    });

    it('resets state when dialog closes and reopens', async () => {
      const { rerender } = render(<BulkRenameDialog {...mockProps} />);

      // Type a pattern
      const patternInput = screen.getByPlaceholderText(/find_this/) as HTMLInputElement;
      fireEvent.change(patternInput, { target: { value: 'test' } });
      expect(patternInput.value).toBe('test');

      // Close
      rerender(<BulkRenameDialog {...mockProps} isOpen={false} />);

      // Reopen
      rerender(<BulkRenameDialog {...mockProps} isOpen={true} />);

      // Pattern should be reset
      const newPatternInput = screen.getByPlaceholderText(/find_this/) as HTMLInputElement;
      expect(newPatternInput.value).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty files array', () => {
      expect(() => render(<BulkRenameDialog {...mockProps} files={[]} />)).not.toThrow();
    });

    it('handles dialog with no onComplete', () => {
      const props = { ...mockProps, onComplete: undefined };
      expect(() => render(<BulkRenameDialog {...props} />)).not.toThrow();
    });
  });
});
