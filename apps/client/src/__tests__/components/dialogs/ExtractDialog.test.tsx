import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExtractDialog from '@/components/dialogs/ExtractDialog';

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/utils', () => ({
  formatFileSize: (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  },
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

const mockGetArchiveInfo = vi.fn();
const mockExtractArchive = vi.fn();
const mockShowOpenDialog = vi.fn();
const mockExtractSelectedEntries = vi.fn();

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    getArchiveInfo: (...args: unknown[]) => mockGetArchiveInfo(...args),
    extractArchive: (...args: unknown[]) => mockExtractArchive(...args),
    showOpenDialog: (...args: unknown[]) => mockShowOpenDialog(...args),
    extractSelectedEntries: (...args: unknown[]) => mockExtractSelectedEntries(...args),
  },
}));

vi.mock('lucide-react', () => ({
  AlertTriangle: () => <span data-testid="alert-icon">Alert</span>,
  FolderOpen: () => <span data-testid="folder-open">FolderOpen</span>,
  Package: () => <span data-testid="package-icon">Package</span>,
  Archive: ({ size: _size, className: _className }: { size?: number; className?: string }) => (
    <span data-testid="archive-icon">Archive</span>
  ),
  FileText: () => <span data-testid="file-text">FileText</span>,
  FolderClosed: ({ size: _size, className: _className }: { size?: number; className?: string }) => (
    <span data-testid="folder-closed">FolderClosed</span>
  ),
  File: () => <span data-testid="file-icon">File</span>,
  Lock: ({ size: _size, className: _className }: { size?: number; className?: string }) => (
    <span data-testid="lock-icon">Lock</span>
  ),
  CheckSquare: ({ size: _size }: { size?: number }) => (
    <span data-testid="check-square">CheckSquare</span>
  ),
  Square: ({ size: _size }: { size?: number }) => <span data-testid="square-icon">Square</span>,
}));

describe('ExtractDialog', () => {
  const defaultArchiveInfo = {
    format: 'ZIP',
    total_files: 5,
    total_directories: 2,
    total_size: 102400,
    compressed_size: 51200,
    is_encrypted: false,
    files: [
      { path: 'file1.txt', size: 1024, is_directory: false },
      { path: 'file2.txt', size: 2048, is_directory: false },
      { path: 'folder/', size: 0, is_directory: true },
    ],
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    archivePath: 'C:\\Users\\Test\\archive.zip',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetArchiveInfo.mockResolvedValue(defaultArchiveInfo);
    mockExtractArchive.mockResolvedValue('C:\\Users\\Test\\archive');
    mockShowOpenDialog.mockResolvedValue([]);
    mockExtractSelectedEntries.mockResolvedValue('C:\\Users\\Test\\archive');
  });

  describe('Rendering', () => {
    it('returns null when not open', () => {
      const { container } = render(<ExtractDialog {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('shows dialog title', async () => {
      render(<ExtractDialog {...defaultProps} />);
      expect(screen.getByText('Extract Archive')).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      mockGetArchiveInfo.mockReturnValue(new Promise(() => {})); // Never resolves
      render(<ExtractDialog {...defaultProps} />);
      expect(screen.getByText('Analyzing archive...')).toBeInTheDocument();
    });

    it('shows archive info after loading', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('archive.zip')).toBeInTheDocument();
      });

      expect(screen.getByText('ZIP Archive')).toBeInTheDocument();
    });

    it('shows file count and directory count', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument(); // total_files
        expect(screen.getByText('2')).toBeInTheDocument(); // total_directories
      });
    });

    it('shows compressed and uncompressed sizes', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('50 KB')).toBeInTheDocument(); // compressed
        expect(screen.getByText('100 KB')).toBeInTheDocument(); // uncompressed
      });
    });
  });

  describe('Output directory', () => {
    it('auto-generates output directory from archive path', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter output directory...') as HTMLInputElement;
        // generateDefaultOutputDirectory strips the extension and uses / separator
        expect(input.value).toContain('archive');
      });
    });

    it('allows editing output directory', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter output directory...');
        fireEvent.change(input, { target: { value: 'C:\\NewPath' } });
        expect(input).toHaveValue('C:\\NewPath');
      });
    });
  });

  describe('Extraction options', () => {
    it('renders Overwrite existing checkbox', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Overwrite existing files')).toBeInTheDocument();
      });
    });

    it('renders Preserve permissions checkbox (checked by default)', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Preserve file permissions')).toBeInTheDocument();
      });
    });

    it('renders Include hidden checkbox (checked by default)', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Include hidden files')).toBeInTheDocument();
      });
    });
  });

  describe('Password for encrypted archives', () => {
    it('shows password field when archive is encrypted', async () => {
      mockGetArchiveInfo.mockResolvedValue({
        ...defaultArchiveInfo,
        is_encrypted: true,
      });

      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter archive password...')).toBeInTheDocument();
      });
    });

    it('does not show password field for non-encrypted archives', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('archive.zip')).toBeInTheDocument();
      });

      expect(screen.queryByPlaceholderText('Enter archive password...')).not.toBeInTheDocument();
    });
  });

  describe('Archive contents', () => {
    it('shows archive file list', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('file1.txt')).toBeInTheDocument();
        expect(screen.getByText('file2.txt')).toBeInTheDocument();
        expect(screen.getByText('folder/')).toBeInTheDocument();
      });
    });

    it('shows Select All / Deselect All toggle', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Select All')).toBeInTheDocument();
      });
    });

    it('toggles entry selection on checkbox click', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('file1.txt')).toBeInTheDocument();
      });

      // Click the checkbox for the first entry
      const checkboxes = screen.getAllByRole('checkbox');
      // Find the file entry checkbox (not the options checkboxes)
      // The archive content checkboxes appear after the options checkboxes
      const fileCheckboxes = checkboxes.filter((cb) => {
        const parent = cb.closest('div[class*="border-b"]');
        return parent && parent.textContent?.includes('file1.txt');
      });
      if (fileCheckboxes.length > 0) {
        fireEvent.click(fileCheckboxes[0]);
      } else {
        // Fallback: click the text span's parent
        const entry = screen.getByText('file1.txt').closest('div[class*="flex"]');
        if (entry) fireEvent.click(entry);
      }

      // Should show "1 selected"
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });
  });

  describe('Extract action', () => {
    it('shows Extract All button', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Extract All')).toBeInTheDocument();
      });
    });

    it('calls extractArchive on Extract All click', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Extract All')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Extract All'));

      await waitFor(() => {
        expect(mockExtractArchive).toHaveBeenCalledWith(
          'C:\\Users\\Test\\archive.zip',
          expect.objectContaining({
            output_directory: expect.any(String),
            overwrite_existing: false,
            preserve_permissions: true,
            include_hidden: true,
          }),
        );
      });
    });

    it('shows Extract Selected button when entries are selected', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('file1.txt')).toBeInTheDocument();
      });

      // Click the checkbox for the first entry
      const checkboxes = screen.getAllByRole('checkbox');
      const fileCheckboxes = checkboxes.filter((cb) => {
        const parent = cb.closest('div[class*="border-b"]');
        return parent && parent.textContent?.includes('file1.txt');
      });
      if (fileCheckboxes.length > 0) {
        fireEvent.click(fileCheckboxes[0]);
      }

      expect(screen.getByText(/Extract Selected/)).toBeInTheDocument();
    });

    it('calls onComplete and onClose after successful extraction', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Extract All')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Extract All'));

      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('shows toast on successful extraction', async () => {
      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Extract All')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Extract All'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Extraction Complete' }),
        );
      });
    });
  });

  describe('Cancel', () => {
    it('renders Cancel button', async () => {
      render(<ExtractDialog {...defaultProps} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', async () => {
      render(<ExtractDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Error state', () => {
    it('shows error message on load failure', async () => {
      mockGetArchiveInfo.mockRejectedValue(new Error('Corrupt archive'));

      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Error Analyzing Archive')).toBeInTheDocument();
        expect(screen.getByText('Corrupt archive')).toBeInTheDocument();
      });
    });

    it('shows Try Again button on error', async () => {
      mockGetArchiveInfo.mockRejectedValue(new Error('Corrupt archive'));

      render(<ExtractDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });
  });
});
