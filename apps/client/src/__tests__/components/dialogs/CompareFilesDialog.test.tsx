import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CompareFilesDialog from '@/components/dialogs/CompareFilesDialog';
import { TauriAPI } from '@/lib/tauri-api';

// Mock TauriAPI
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    fileExists: vi.fn(),
    isDir: vi.fn(),
    getFileProperties: vi.fn(),
    showOpenDialog: vi.fn(),
  },
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  AlertTriangle: ({ className, ...props }: Record<string, unknown> & { className?: string }) => (
    <div data-testid="alert-triangle-icon" className={className} {...props} />
  ),
  Scale: ({ className, ...props }: Record<string, unknown> & { className?: string }) => (
    <div data-testid="scale-icon" className={className} {...props} />
  ),
  FileIcon: ({ className, ...props }: Record<string, unknown> & { className?: string }) => (
    <div data-testid="file-icon" className={className} {...props} />
  ),
  FolderIcon: ({ className, ...props }: Record<string, unknown> & { className?: string }) => (
    <div data-testid="folder-icon" className={className} {...props} />
  ),
  X: ({ className, ...props }: Record<string, unknown> & { className?: string }) => (
    <div data-testid="x-icon" className={className} {...props} />
  ),
}));

// Mock dialog components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children?: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children?: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

// Mock other UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: Record<string, unknown> & {
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler;
    disabled?: boolean;
  }) => (
    <button data-testid="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    ...props
  }: Record<string, unknown> & {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
  }) => (
    <input
      data-testid="input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
    <label data-testid="label" {...props}>
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children?: React.ReactNode; variant?: string }) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

describe('CompareFilesDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnCompare = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (TauriAPI.fileExists as unknown).mockResolvedValue(true);
    (TauriAPI.isDir as unknown).mockResolvedValue(false);
    (TauriAPI.getFileProperties as unknown).mockResolvedValue({
      name: 'test.txt',
      size: 1024,
    });
  });

  it('renders correctly when closed', () => {
    render(<CompareFilesDialog isOpen={false} onClose={mockOnClose} onCompare={mockOnCompare} />);

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders correctly when open', () => {
    render(<CompareFilesDialog isOpen={true} onClose={mockOnClose} onCompare={mockOnCompare} />);

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Compare Files');
    expect(screen.getAllByTestId('scale-icon')).toHaveLength(2); // One in title, one in button
  });

  it('displays file input fields', () => {
    render(<CompareFilesDialog isOpen={true} onClose={mockOnClose} onCompare={mockOnCompare} />);

    expect(
      screen.getByPlaceholderText('Select or enter path to first file...'),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Select or enter path to second file...'),
    ).toBeInTheDocument();
  });

  it('handles file path input', async () => {
    render(<CompareFilesDialog isOpen={true} onClose={mockOnClose} onCompare={mockOnCompare} />);

    const firstFileInput = screen.getByPlaceholderText('Select or enter path to first file...');
    fireEvent.change(firstFileInput, { target: { value: '/test/file1.txt' } });

    await waitFor(() => {
      expect(TauriAPI.fileExists).toHaveBeenCalledWith('/test/file1.txt');
      expect(TauriAPI.isDir).toHaveBeenCalledWith('/test/file1.txt');
      expect(TauriAPI.getFileProperties).toHaveBeenCalledWith('/test/file1.txt');
    });
  });

  it('validates files and shows status badges', async () => {
    render(<CompareFilesDialog isOpen={true} onClose={mockOnClose} onCompare={mockOnCompare} />);

    const firstFileInput = screen.getByPlaceholderText('Select or enter path to first file...');
    fireEvent.change(firstFileInput, { target: { value: '/test/file1.txt' } });

    await waitFor(() => {
      expect(screen.getByText('1.0 KB')).toBeInTheDocument();
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });
  });

  it('handles invalid files', async () => {
    (TauriAPI.fileExists as unknown).mockResolvedValue(false);

    render(<CompareFilesDialog isOpen={true} onClose={mockOnClose} onCompare={mockOnCompare} />);

    const firstFileInput = screen.getByPlaceholderText('Select or enter path to first file...');
    fireEvent.change(firstFileInput, { target: { value: '/test/nonexistent.txt' } });

    await waitFor(() => {
      expect(screen.getByText('Invalid file or directory')).toBeInTheDocument();
    });
  });

  it('handles directories (not supported)', async () => {
    (TauriAPI.isDir as unknown).mockResolvedValue(true);

    render(<CompareFilesDialog isOpen={true} onClose={mockOnClose} onCompare={mockOnCompare} />);

    const firstFileInput = screen.getByPlaceholderText('Select or enter path to first file...');
    fireEvent.change(firstFileInput, { target: { value: '/test/folder' } });

    await waitFor(() => {
      expect(screen.getByText('Invalid file or directory')).toBeInTheDocument();
    });
  });

  it('enables compare button when both files are valid', async () => {
    render(<CompareFilesDialog isOpen={true} onClose={mockOnClose} onCompare={mockOnCompare} />);

    const firstFileInput = screen.getByPlaceholderText('Select or enter path to first file...');
    const secondFileInput = screen.getByPlaceholderText('Select or enter path to second file...');

    fireEvent.change(firstFileInput, { target: { value: '/test/file1.txt' } });
    fireEvent.change(secondFileInput, { target: { value: '/test/file2.txt' } });

    await waitFor(() => {
      const buttons = screen.getAllByText('Compare Files');
      const compareButton = buttons.find((el) => el.tagName === 'BUTTON' || el.closest('button'));
      const buttonElement =
        compareButton?.tagName === 'BUTTON' ? compareButton : compareButton?.closest('button');
      expect(buttonElement).not.toBeDisabled();
    });
  });

  it('disables compare button when files are the same', async () => {
    render(<CompareFilesDialog isOpen={true} onClose={mockOnClose} onCompare={mockOnCompare} />);

    const firstFileInput = screen.getByPlaceholderText('Select or enter path to first file...');
    const secondFileInput = screen.getByPlaceholderText('Select or enter path to second file...');

    fireEvent.change(firstFileInput, { target: { value: '/test/file1.txt' } });
    fireEvent.change(secondFileInput, { target: { value: '/test/file1.txt' } });

    await waitFor(() => {
      expect(
        screen.getByText(/You have selected the same file for both comparisons/),
      ).toBeInTheDocument();
      const buttons = screen.getAllByText('Compare Files');
      const compareButton = buttons.find((el) => el.tagName === 'BUTTON' || el.closest('button'));
      const buttonElement =
        compareButton?.tagName === 'BUTTON' ? compareButton : compareButton?.closest('button');
      expect(buttonElement).toBeDisabled();
    });
  });

  it('calls onCompare when compare button is clicked', async () => {
    render(<CompareFilesDialog isOpen={true} onClose={mockOnClose} onCompare={mockOnCompare} />);

    const firstFileInput = screen.getByPlaceholderText('Select or enter path to first file...');
    const secondFileInput = screen.getByPlaceholderText('Select or enter path to second file...');

    fireEvent.change(firstFileInput, { target: { value: '/test/file1.txt' } });
    fireEvent.change(secondFileInput, { target: { value: '/test/file2.txt' } });

    await waitFor(() => {
      const buttons = screen.getAllByText('Compare Files');
      const compareButton = buttons.find((el) => el.tagName === 'BUTTON' || el.closest('button'));
      const buttonElement =
        compareButton?.tagName === 'BUTTON' ? compareButton : compareButton?.closest('button');
      if (buttonElement) {
        fireEvent.click(buttonElement);
      }
      expect(mockOnCompare).toHaveBeenCalledWith('/test/file1.txt', '/test/file2.txt');
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<CompareFilesDialog isOpen={true} onClose={mockOnClose} onCompare={mockOnCompare} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('handles file browser button', async () => {
    (TauriAPI.showOpenDialog as unknown).mockResolvedValue(['/selected/file.txt']);

    render(<CompareFilesDialog isOpen={true} onClose={mockOnClose} onCompare={mockOnCompare} />);

    const browseButtons = screen.getAllByText('Browse');
    fireEvent.click(browseButtons[0]);

    await waitFor(() => {
      expect(TauriAPI.showOpenDialog).toHaveBeenCalledWith({
        multiple: false,
        directory: false,
        filters: [],
      });
    });
  });

  it('displays initial file paths when provided', async () => {
    render(
      <CompareFilesDialog
        isOpen={true}
        onClose={mockOnClose}
        onCompare={mockOnCompare}
        initialFile1="/initial/file1.txt"
        initialFile2="/initial/file2.txt"
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('/initial/file1.txt')).toBeInTheDocument();
      expect(screen.getByDisplayValue('/initial/file2.txt')).toBeInTheDocument();
    });
  });

  it('shows helpful usage information', () => {
    render(<CompareFilesDialog isOpen={true} onClose={mockOnClose} onCompare={mockOnCompare} />);

    expect(
      screen.getByText('• Both files must be regular files (not directories)'),
    ).toBeInTheDocument();
    expect(screen.getByText('• Large files may take longer to compare')).toBeInTheDocument();
    expect(screen.getByText('• Binary files will be compared byte-by-byte')).toBeInTheDocument();
    expect(
      screen.getByText('• Text files will be compared line-by-line with diff highlighting'),
    ).toBeInTheDocument();
  });
});
