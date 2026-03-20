import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EncryptionDialog from '@/components/dialogs/EncryptionDialog';

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockEncryptFile = vi.fn();
const mockDecryptFile = vi.fn();

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    encryptFile: (...args: unknown[]) => mockEncryptFile(...args),
    decryptFile: (...args: unknown[]) => mockDecryptFile(...args),
  },
}));

describe('EncryptionDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    filePath: 'C:\\Users\\Test\\document.pdf',
    mode: 'encrypt' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEncryptFile.mockResolvedValue('C:\\Users\\Test\\document.pdf.enc');
    mockDecryptFile.mockResolvedValue('C:\\Users\\Test\\document.pdf');
  });

  describe('Visibility', () => {
    it('returns null when not open', () => {
      const { container } = render(<EncryptionDialog {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders when open', () => {
      render(<EncryptionDialog {...defaultProps} />);
      expect(screen.getByText('Encrypt File')).toBeInTheDocument();
    });
  });

  describe('Encrypt mode', () => {
    it('shows Encrypt File title', () => {
      render(<EncryptionDialog {...defaultProps} />);
      expect(screen.getByText('Encrypt File')).toBeInTheDocument();
    });

    it('shows file name', () => {
      render(<EncryptionDialog {...defaultProps} />);
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    it('shows AES-256-GCM description', () => {
      render(<EncryptionDialog {...defaultProps} />);
      expect(screen.getByText(/AES-256-GCM/)).toBeInTheDocument();
    });

    it('shows password and confirm password fields', () => {
      render(<EncryptionDialog {...defaultProps} />);
      expect(screen.getByText('Password')).toBeInTheDocument();
      expect(screen.getByText('Confirm Password')).toBeInTheDocument();
    });

    it('shows Encrypt button', () => {
      render(<EncryptionDialog {...defaultProps} />);
      expect(screen.getByLabelText('Encrypt file')).toBeInTheDocument();
    });
  });

  describe('Decrypt mode', () => {
    const decryptProps = { ...defaultProps, mode: 'decrypt' as const };

    it('shows Decrypt File title', () => {
      render(<EncryptionDialog {...decryptProps} />);
      expect(screen.getByText('Decrypt File')).toBeInTheDocument();
    });

    it('does not show confirm password field', () => {
      render(<EncryptionDialog {...decryptProps} />);
      expect(screen.queryByText('Confirm Password')).not.toBeInTheDocument();
    });

    it('shows Decrypt button', () => {
      render(<EncryptionDialog {...decryptProps} />);
      expect(screen.getByLabelText('Decrypt file')).toBeInTheDocument();
    });
  });

  describe('Password validation', () => {
    it('shows error when password is empty', () => {
      render(<EncryptionDialog {...defaultProps} />);
      // The submit button should be disabled when password is empty
      expect(screen.getByLabelText('Encrypt file')).toBeDisabled();
    });

    it('shows error when password is too short', async () => {
      render(<EncryptionDialog {...defaultProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter password...');
      fireEvent.change(passwordInput, { target: { value: 'ab' } });

      const confirmInput = screen.getByPlaceholderText('Confirm password...');
      fireEvent.change(confirmInput, { target: { value: 'ab' } });

      fireEvent.click(screen.getByLabelText('Encrypt file'));

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 4 characters')).toBeInTheDocument();
      });
    });

    it('shows error when passwords do not match', async () => {
      render(<EncryptionDialog {...defaultProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter password...');
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      const confirmInput = screen.getByPlaceholderText('Confirm password...');
      fireEvent.change(confirmInput, { target: { value: 'different' } });

      fireEvent.click(screen.getByLabelText('Encrypt file'));

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });
  });

  describe('Show/hide password', () => {
    it('toggles password visibility', () => {
      render(<EncryptionDialog {...defaultProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter password...');
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleBtn = screen.getByLabelText('Show password');
      fireEvent.click(toggleBtn);

      expect(passwordInput).toHaveAttribute('type', 'text');
    });

    it('toggles confirm password visibility', () => {
      render(<EncryptionDialog {...defaultProps} />);

      const confirmInput = screen.getByPlaceholderText('Confirm password...');
      expect(confirmInput).toHaveAttribute('type', 'password');

      const toggleBtn = screen.getByLabelText('Show confirm password');
      fireEvent.click(toggleBtn);

      expect(confirmInput).toHaveAttribute('type', 'text');
    });
  });

  describe('Encrypt action', () => {
    it('calls encryptFile with correct arguments on submit', async () => {
      render(<EncryptionDialog {...defaultProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter password...');
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      const confirmInput = screen.getByPlaceholderText('Confirm password...');
      fireEvent.change(confirmInput, { target: { value: 'password123' } });

      fireEvent.click(screen.getByLabelText('Encrypt file'));

      await waitFor(() => {
        expect(mockEncryptFile).toHaveBeenCalledWith(
          'C:\\Users\\Test\\document.pdf',
          'password123',
        );
      });
    });

    it('calls onComplete and onClose on success', async () => {
      render(<EncryptionDialog {...defaultProps} />);

      fireEvent.change(screen.getByPlaceholderText('Enter password...'), {
        target: { value: 'password123' },
      });
      fireEvent.change(screen.getByPlaceholderText('Confirm password...'), {
        target: { value: 'password123' },
      });

      fireEvent.click(screen.getByLabelText('Encrypt file'));

      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('shows success toast on encrypt', async () => {
      render(<EncryptionDialog {...defaultProps} />);

      fireEvent.change(screen.getByPlaceholderText('Enter password...'), {
        target: { value: 'password123' },
      });
      fireEvent.change(screen.getByPlaceholderText('Confirm password...'), {
        target: { value: 'password123' },
      });

      fireEvent.click(screen.getByLabelText('Encrypt file'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'File Encrypted' }),
        );
      });
    });

    it('shows error toast on failure', async () => {
      mockEncryptFile.mockRejectedValue(new Error('Encryption failed'));

      render(<EncryptionDialog {...defaultProps} />);

      fireEvent.change(screen.getByPlaceholderText('Enter password...'), {
        target: { value: 'password123' },
      });
      fireEvent.change(screen.getByPlaceholderText('Confirm password...'), {
        target: { value: 'password123' },
      });

      fireEvent.click(screen.getByLabelText('Encrypt file'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Encryption Failed',
            variant: 'destructive',
          }),
        );
      });
    });
  });

  describe('Decrypt action', () => {
    const decryptProps = { ...defaultProps, mode: 'decrypt' as const };

    it('calls decryptFile on submit', async () => {
      render(<EncryptionDialog {...decryptProps} />);

      fireEvent.change(screen.getByPlaceholderText('Enter password...'), {
        target: { value: 'password123' },
      });

      fireEvent.click(screen.getByLabelText('Decrypt file'));

      await waitFor(() => {
        expect(mockDecryptFile).toHaveBeenCalledWith(
          'C:\\Users\\Test\\document.pdf',
          'password123',
        );
      });
    });
  });

  describe('Cancel and Close', () => {
    it('calls onClose when Cancel is clicked', () => {
      render(<EncryptionDialog {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Cancel'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', () => {
      render(<EncryptionDialog {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Close encryption dialog'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose on Escape key', () => {
      render(<EncryptionDialog {...defaultProps} />);
      const dialog = screen.getByText('Encrypt File').closest('div[class*="bg-xp-surface"]')!;
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Keyboard shortcuts', () => {
    it('submits on Enter key with valid password', async () => {
      render(<EncryptionDialog {...defaultProps} />);

      fireEvent.change(screen.getByPlaceholderText('Enter password...'), {
        target: { value: 'password123' },
      });
      fireEvent.change(screen.getByPlaceholderText('Confirm password...'), {
        target: { value: 'password123' },
      });

      const dialog = screen.getByText('Encrypt File').closest('div[class*="bg-xp-surface"]')!;
      fireEvent.keyDown(dialog, { key: 'Enter' });

      await waitFor(() => {
        expect(mockEncryptFile).toHaveBeenCalled();
      });
    });
  });
});
