import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompressDialog from '@/components/dialogs/CompressDialog';
import { FileEntry, TauriAPI } from '@/lib/tauri-api';

// Mock use-toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

// Mock formatFileSize from utils
vi.mock('@/lib/utils', () => ({
  getFileIcon: vi.fn(() => '📄'),
  formatFileSize: vi.fn((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }),
  cn: vi.fn((...classes: unknown[]) => classes.filter(Boolean).join(' ')),
}));

// Extend TauriAPI mock
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    getCompressionInfo: vi.fn(() =>
      Promise.resolve({
        total_size: 10240,
        total_files: 3,
        total_directories: 1,
        estimated_compressed_size: 5120,
      }),
    ),
    compressFiles: vi.fn(() => Promise.resolve('C:\\output\\archive.zip')),
    showOpenDialog: vi.fn(() => Promise.resolve([])),
  },
  FileEntry: {},
}));

describe('CompressDialog', () => {
  const mockFiles: FileEntry[] = [
    {
      name: 'file1.txt',
      path: 'C:\\Users\\Test\\file1.txt',
      size: 1024,
      is_dir: false,
      modified: Date.now(),
      file_type: 'text',
    },
    {
      name: 'file2.txt',
      path: 'C:\\Users\\Test\\file2.txt',
      size: 2048,
      is_dir: false,
      modified: Date.now(),
      file_type: 'text',
    },
  ];

  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    files: mockFiles,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog Visibility', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(<CompressDialog {...mockProps} isOpen={false} />);

      expect(container.innerHTML).toBe('');
    });

    it('renders the dialog when isOpen is true', async () => {
      render(<CompressDialog {...mockProps} />);

      expect(screen.getByText('Compress Files')).toBeInTheDocument();
    });
  });

  describe('Basic Rendering', () => {
    it('displays the dialog title', () => {
      render(<CompressDialog {...mockProps} />);

      expect(screen.getByText('Compress Files')).toBeInTheDocument();
    });

    it('displays Compress button', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Compress')).toBeInTheDocument();
      });
    });

    it('displays Cancel button', () => {
      render(<CompressDialog {...mockProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('displays close button with aria-label', () => {
      render(<CompressDialog {...mockProps} />);

      expect(screen.getByLabelText('Close compress dialog')).toBeInTheDocument();
    });
  });

  describe('Compression Info', () => {
    it('loads and displays compression info', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Files to compress:')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument(); // total_files
        expect(screen.getByText('1')).toBeInTheDocument(); // total_directories
      });
    });

    it('calls getCompressionInfo on mount', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(TauriAPI.getCompressionInfo).toHaveBeenCalledWith([
          'C:\\Users\\Test\\file1.txt',
          'C:\\Users\\Test\\file2.txt',
        ]);
      });
    });

    it('shows loading state while analyzing files', () => {
      vi.mocked(TauriAPI.getCompressionInfo).mockReturnValueOnce(new Promise(() => {}));

      render(<CompressDialog {...mockProps} />);

      expect(screen.getByText('Analyzing files...')).toBeInTheDocument();
    });

    it('shows error state when compression info fails', async () => {
      vi.mocked(TauriAPI.getCompressionInfo).mockRejectedValueOnce(new Error('Access denied'));

      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Error Analyzing Files')).toBeInTheDocument();
        expect(screen.getByText('Access denied')).toBeInTheDocument();
      });
    });

    it('shows Try Again button on error', async () => {
      vi.mocked(TauriAPI.getCompressionInfo).mockRejectedValueOnce(new Error('Fail'));

      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });
  });

  describe('Output Path', () => {
    it('generates default output path', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Output Path')).toBeInTheDocument();
      });

      // Should have an auto-generated output path
      const outputInput = screen.getByPlaceholderText('Enter output path...');
      expect(outputInput).toBeInTheDocument();
    });

    it('allows editing output path', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Output Path')).toBeInTheDocument();
      });

      const outputInput = screen.getByPlaceholderText('Enter output path...');
      fireEvent.change(outputInput, { target: { value: 'D:\\archives\\my_archive.zip' } });

      expect(outputInput).toHaveValue('D:\\archives\\my_archive.zip');
    });

    it('renders browse button', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Browse for output directory')).toBeInTheDocument();
      });
    });
  });

  describe('Compression Format', () => {
    it('renders format selection buttons', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Compression Format')).toBeInTheDocument();
        expect(screen.getByText('Zip')).toBeInTheDocument();
        expect(screen.getByText('TarGz')).toBeInTheDocument();
        expect(screen.getByText('TarBz2')).toBeInTheDocument();
      });
    });

    it('highlights selected format', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        const zipButton = screen.getByText('Zip').closest('button');
        expect(zipButton).toHaveClass('border-xp-blue');
      });
    });

    it('changes format when a different format is clicked', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('TarGz')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('TarGz'));

      const tarGzButton = screen.getByText('TarGz').closest('button');
      expect(tarGzButton).toHaveClass('border-xp-blue');
    });
  });

  describe('Compression Level', () => {
    it('renders compression level slider', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Compression Level: 6/)).toBeInTheDocument();
      });
    });

    it('shows level range labels', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fastest (1)')).toBeInTheDocument();
        expect(screen.getByText('Best (9)')).toBeInTheDocument();
      });
    });
  });

  describe('Password Protection', () => {
    it('renders password input', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Password Protection (Optional)')).toBeInTheDocument();
        expect(
          screen.getByPlaceholderText('Enter password to protect archive...'),
        ).toBeInTheDocument();
      });
    });

    it('allows typing a password', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        const passwordInput = screen.getByPlaceholderText('Enter password to protect archive...');
        fireEvent.change(passwordInput, { target: { value: 'secret123' } });
        expect(passwordInput).toHaveValue('secret123');
      });
    });
  });

  describe('Options', () => {
    it('renders include hidden files checkbox', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Include hidden files')).toBeInTheDocument();
      });
    });

    it('renders follow symbolic links checkbox', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Follow symbolic links')).toBeInTheDocument();
      });
    });

    it('toggles include hidden files checkbox', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        const checkbox = screen.getByText('Include hidden files')
          .previousElementSibling as HTMLInputElement;
        expect(checkbox.checked).toBe(false);
        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(true);
      });
    });
  });

  describe('Compress Action', () => {
    it('calls compressFiles when Compress is clicked', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Compress')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Compress'));

      await waitFor(() => {
        expect(TauriAPI.compressFiles).toHaveBeenCalled();
      });
    });

    it('disables Compress button when output path is empty', async () => {
      render(<CompressDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Output Path')).toBeInTheDocument();
      });

      const outputInput = screen.getByPlaceholderText('Enter output path...');
      fireEvent.change(outputInput, { target: { value: '' } });

      const compressButton = screen.getByLabelText('Compress files');
      expect(compressButton).toBeDisabled();
    });
  });

  describe('Close Behavior', () => {
    it('calls onClose when Cancel is clicked', () => {
      render(<CompressDialog {...mockProps} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close button is clicked', () => {
      render(<CompressDialog {...mockProps} />);

      fireEvent.click(screen.getByLabelText('Close compress dialog'));

      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty files array', () => {
      expect(() => render(<CompressDialog {...mockProps} files={[]} />)).not.toThrow();
    });

    it('handles single directory file', async () => {
      const dirFiles = [
        {
          name: 'MyFolder',
          path: 'C:\\Users\\Test\\MyFolder',
          size: 0,
          is_dir: true,
          modified: Date.now(),
          file_type: 'folder',
        },
      ];

      expect(() => render(<CompressDialog {...mockProps} files={dirFiles} />)).not.toThrow();
    });
  });
});
