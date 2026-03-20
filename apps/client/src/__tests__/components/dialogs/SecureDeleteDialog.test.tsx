import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SecureDeleteDialog from '@/components/dialogs/SecureDeleteDialog';
import type { FileEntry } from '@/lib/tauri-api';

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockSecureDelete = vi.fn();

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    secureDelete: (...args: unknown[]) => mockSecureDelete(...args),
  },
}));

vi.mock('@/lib/transport', () => ({
  listenToEvent: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock('lucide-react', () => ({
  ShieldAlert: ({ size: _size, className }: { size?: number; className?: string }) => (
    <span data-testid="shield-icon" className={className}>
      Shield
    </span>
  ),
  AlertTriangle: ({ size: _size, className }: { size?: number; className?: string }) => (
    <span data-testid="alert-icon" className={className}>
      Alert
    </span>
  ),
  Trash2: ({ size: _size }: { size?: number }) => <span data-testid="trash-icon">Trash</span>,
}));

describe('SecureDeleteDialog', () => {
  const sampleFiles: FileEntry[] = [
    {
      name: 'secret.txt',
      path: 'C:\\Users\\Test\\secret.txt',
      size: 1024,
      is_dir: false,
      modified: 0,
      file_type: 'text',
    },
    {
      name: 'private.doc',
      path: 'C:\\Users\\Test\\private.doc',
      size: 2048,
      is_dir: false,
      modified: 0,
      file_type: 'document',
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
    mockSecureDelete.mockResolvedValue({
      files_deleted: 2,
      passes: 3,
      errors: [],
    });
  });

  describe('Visibility', () => {
    it('returns null when not open', () => {
      const { container } = render(<SecureDeleteDialog {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null when files array is empty', () => {
      const { container } = render(<SecureDeleteDialog {...defaultProps} files={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders when open with files', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      // "Secure Delete" appears in both the heading and the button
      const elements = screen.getAllByText('Secure Delete');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Warning display', () => {
    it('shows irreversibility warning', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      expect(screen.getByText('This action is irreversible.')).toBeInTheDocument();
    });

    it('shows DoD standard description', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      expect(screen.getByText(/DoD 5220.22-M standard/)).toBeInTheDocument();
    });
  });

  describe('File info', () => {
    it('shows file names', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      expect(screen.getByText('secret.txt, private.doc')).toBeInTheDocument();
    });

    it('shows "Files (N)" label for multiple files', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      expect(screen.getByText('Files (2)')).toBeInTheDocument();
    });

    it('shows "File" label for single file', () => {
      render(<SecureDeleteDialog {...defaultProps} files={[sampleFiles[0]]} />);
      expect(screen.getByText('File')).toBeInTheDocument();
    });

    it('truncates long file lists with "and N more"', () => {
      const manyFiles: FileEntry[] = Array.from({ length: 5 }, (_, i) => ({
        name: `file${i}.txt`,
        path: `C:\\file${i}.txt`,
        size: 100,
        is_dir: false,
        modified: 0,
        file_type: 'text',
      }));
      render(<SecureDeleteDialog {...defaultProps} files={manyFiles} />);
      expect(screen.getByText(/and 2 more/)).toBeInTheDocument();
    });
  });

  describe('Pass count selection', () => {
    it('defaults to 3 passes', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('3');
    });

    it('shows pass options', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      expect(screen.getByText('1 pass (quick)')).toBeInTheDocument();
      expect(screen.getByText('3 passes (DoD 5220.22-M)')).toBeInTheDocument();
      expect(screen.getByText('7 passes (maximum)')).toBeInTheDocument();
    });

    it('shows pass description for 3 passes', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      expect(screen.getByText('Zeros, ones, then random data')).toBeInTheDocument();
    });

    it('allows changing pass count', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '7' } });
      expect(select).toHaveValue('7');
    });

    it('shows overwrite pattern description', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      expect(screen.getByText('Pass 1: Fill with zeros (0x00)')).toBeInTheDocument();
      expect(screen.getByText('Pass 2: Fill with ones (0xFF)')).toBeInTheDocument();
      expect(screen.getByText('Pass 3: Fill with random data')).toBeInTheDocument();
    });
  });

  describe('Confirmation checkbox', () => {
    it('shows confirmation checkbox', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      expect(screen.getByText(/permanently destroy the selected/)).toBeInTheDocument();
    });

    it('delete button is disabled without confirmation', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      const deleteButton = screen.getByLabelText('Securely delete files');
      expect(deleteButton).toBeDisabled();
    });

    it('delete button is enabled after confirmation', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      const deleteButton = screen.getByLabelText('Securely delete files');
      expect(deleteButton).not.toBeDisabled();
    });
  });

  describe('Delete action', () => {
    it('calls secureDelete with correct args', async () => {
      render(<SecureDeleteDialog {...defaultProps} />);

      // Check confirmation
      fireEvent.click(screen.getByRole('checkbox'));

      // Click delete
      fireEvent.click(screen.getByLabelText('Securely delete files'));

      await waitFor(() => {
        expect(mockSecureDelete).toHaveBeenCalledWith(
          ['C:\\Users\\Test\\secret.txt', 'C:\\Users\\Test\\private.doc'],
          3,
        );
      });
    });

    it('calls onComplete and onClose on success', async () => {
      render(<SecureDeleteDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByLabelText('Securely delete files'));

      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('shows success toast', async () => {
      render(<SecureDeleteDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByLabelText('Securely delete files'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Securely Deleted' }),
        );
      });
    });

    it('shows error toast on failure', async () => {
      mockSecureDelete.mockRejectedValue(new Error('Permission denied'));

      render(<SecureDeleteDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByLabelText('Securely delete files'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Secure Delete Failed',
            variant: 'destructive',
          }),
        );
      });
    });

    it('shows error when all files fail', async () => {
      mockSecureDelete.mockResolvedValue({
        files_deleted: 0,
        passes: 3,
        errors: ['Cannot delete secret.txt'],
      });

      render(<SecureDeleteDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByLabelText('Securely delete files'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Secure Delete Failed',
            variant: 'destructive',
          }),
        );
      });
    });
  });

  describe('Cancel', () => {
    it('renders Cancel button', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      expect(screen.getByLabelText('Cancel')).toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Cancel'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('disables cancel button during processing', async () => {
      // Create a promise that never resolves to simulate processing
      mockSecureDelete.mockReturnValue(new Promise(() => {}));

      render(<SecureDeleteDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByLabelText('Securely delete files'));

      // Wait for the processing state to be set
      await waitFor(() => {
        // The cancel button should be disabled during processing
        expect(screen.getByLabelText('Cancel')).toBeDisabled();
      });
    });
  });

  describe('Keyboard shortcuts', () => {
    it('triggers delete on Enter when confirmed', async () => {
      render(<SecureDeleteDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole('checkbox'));

      // Find the dialog container by the heading
      const heading = screen.getByRole('heading', { name: 'Secure Delete' });
      const dialog = heading.closest('div[class*="bg-xp-surface"]')!;
      fireEvent.keyDown(dialog, { key: 'Enter' });

      await waitFor(() => {
        expect(mockSecureDelete).toHaveBeenCalled();
      });
    });

    it('closes on Escape key', () => {
      render(<SecureDeleteDialog {...defaultProps} />);

      const heading = screen.getByRole('heading', { name: 'Secure Delete' });
      const dialog = heading.closest('div[class*="bg-xp-surface"]')!;
      fireEvent.keyDown(dialog, { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Delete button label', () => {
    it('shows Secure Delete button with trash icon', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      expect(screen.getByLabelText('Securely delete files')).toBeInTheDocument();
      expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
    });
  });

  describe('Close button', () => {
    it('renders close button in header', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      expect(screen.getByLabelText('Close secure delete dialog')).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', () => {
      render(<SecureDeleteDialog {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Close secure delete dialog'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });
});
