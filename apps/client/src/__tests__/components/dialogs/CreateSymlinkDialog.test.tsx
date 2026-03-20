import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateSymlinkDialog from '@/components/dialogs/CreateSymlinkDialog';

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockCreateSymlink = vi.fn();

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    createSymlink: (...args: unknown[]) => mockCreateSymlink(...args),
  },
}));

vi.mock('@/lib/constants', () => ({
  PATH_SEPARATOR: '\\',
  detectSep: (path: string) => (path.includes('/') ? '/' : '\\'),
}));

describe('CreateSymlinkDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    targetPath: 'C:\\Users\\Test\\document.pdf',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSymlink.mockResolvedValue(undefined);
  });

  describe('Visibility', () => {
    it('returns null when not open', () => {
      const { container } = render(<CreateSymlinkDialog {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders when open', () => {
      render(<CreateSymlinkDialog {...defaultProps} />);
      expect(screen.getByText('Create Symbolic Link')).toBeInTheDocument();
    });
  });

  describe('Target display', () => {
    it('shows target file name', () => {
      render(<CreateSymlinkDialog {...defaultProps} />);
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    it('shows target full path', () => {
      render(<CreateSymlinkDialog {...defaultProps} />);
      const elements = screen.getAllByTitle('C:\\Users\\Test\\document.pdf');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows Target label', () => {
      render(<CreateSymlinkDialog {...defaultProps} />);
      expect(screen.getByText('Target')).toBeInTheDocument();
    });
  });

  describe('Link path input', () => {
    it('shows Link Location label', () => {
      render(<CreateSymlinkDialog {...defaultProps} />);
      expect(screen.getByText('Link Location')).toBeInTheDocument();
    });

    it('auto-generates default link path with - Link suffix', () => {
      render(<CreateSymlinkDialog {...defaultProps} />);
      const input = screen.getByPlaceholderText('Enter the full path for the symbolic link...');
      expect(input).toHaveValue('C:\\Users\\Test\\document - Link.pdf');
    });

    it('allows editing the link path', () => {
      render(<CreateSymlinkDialog {...defaultProps} />);
      const input = screen.getByPlaceholderText('Enter the full path for the symbolic link...');
      fireEvent.change(input, {
        target: { value: 'C:\\Links\\my-link.pdf' },
      });
      expect(input).toHaveValue('C:\\Links\\my-link.pdf');
    });
  });

  describe('Windows warning', () => {
    it('shows Windows admin warning for Windows paths', () => {
      render(<CreateSymlinkDialog {...defaultProps} />);
      expect(
        screen.getByText(/creating symbolic links requires Developer Mode/),
      ).toBeInTheDocument();
    });

    it('does not show Windows warning for Unix paths', () => {
      render(<CreateSymlinkDialog {...defaultProps} targetPath="/home/user/document.pdf" />);
      expect(
        screen.queryByText(/creating symbolic links requires Developer Mode/),
      ).not.toBeInTheDocument();
    });
  });

  describe('Create action', () => {
    it('calls createSymlink with correct arguments', async () => {
      render(<CreateSymlinkDialog {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Create symbolic link'));

      await waitFor(() => {
        expect(mockCreateSymlink).toHaveBeenCalledWith(
          'C:\\Users\\Test\\document.pdf',
          'C:\\Users\\Test\\document - Link.pdf',
        );
      });
    });

    it('calls onComplete and onClose on success', async () => {
      render(<CreateSymlinkDialog {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Create symbolic link'));

      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('shows success toast', async () => {
      render(<CreateSymlinkDialog {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Create symbolic link'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Link Created' }));
      });
    });

    it('shows error on failure', async () => {
      mockCreateSymlink.mockRejectedValue(new Error('Permission denied'));

      render(<CreateSymlinkDialog {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Create symbolic link'));

      await waitFor(() => {
        expect(screen.getByText('Permission denied')).toBeInTheDocument();
      });
    });

    it('shows error toast on failure', async () => {
      mockCreateSymlink.mockRejectedValue(new Error('Permission denied'));

      render(<CreateSymlinkDialog {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Create symbolic link'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Create Link Failed',
            variant: 'destructive',
          }),
        );
      });
    });
  });

  describe('Validation', () => {
    it('shows error when link path is empty', async () => {
      render(<CreateSymlinkDialog {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter the full path for the symbolic link...');
      fireEvent.change(input, { target: { value: '' } });

      // The create button should be disabled when path is empty
      expect(screen.getByLabelText('Create symbolic link')).toHaveStyle({
        opacity: '0.5',
      });
    });
  });

  describe('Cancel and Close', () => {
    it('calls onClose when Cancel is clicked', () => {
      render(<CreateSymlinkDialog {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Cancel'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', () => {
      render(<CreateSymlinkDialog {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Close dialog'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Keyboard shortcuts', () => {
    it('submits on Enter key', async () => {
      render(<CreateSymlinkDialog {...defaultProps} />);

      const dialogContent = screen.getByText('Create Symbolic Link').closest('div')!.parentElement!;
      fireEvent.keyDown(dialogContent, { key: 'Enter' });

      await waitFor(() => {
        expect(mockCreateSymlink).toHaveBeenCalled();
      });
    });

    it('closes on Escape key', () => {
      render(<CreateSymlinkDialog {...defaultProps} />);

      const dialogContent = screen.getByText('Create Symbolic Link').closest('div')!.parentElement!;
      fireEvent.keyDown(dialogContent, { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });
});
