import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FileConflictDialog } from '@/components/dialogs/FileConflictDialog';

vi.mock('lucide-react', () => ({
  AlertTriangle: ({ className }: { className?: string }) => (
    <span data-testid="alert-icon" className={className} />
  ),
  FileIcon: ({ className }: { className?: string }) => (
    <span data-testid="file-icon" className={className} />
  ),
  FolderClosed: ({ className }: { className?: string }) => (
    <span data-testid="folder-icon" className={className} />
  ),
  Replace: ({ className }: { className?: string }) => (
    <span data-testid="replace-icon" className={className} />
  ),
  Copy: ({ className }: { className?: string }) => (
    <span data-testid="copy-icon" className={className} />
  ),
  X: ({ className }: { className?: string }) => <span data-testid="x-icon" className={className} />,
  ArrowRight: ({ className }: { className?: string }) => (
    <span data-testid="arrow-right" className={className} />
  ),
}));

describe('FileConflictDialog', () => {
  const mockOnResolve = vi.fn();

  const defaultProps = {
    isOpen: true,
    fileName: 'document.txt',
    isDir: false,
    destination: 'C:\\Users\\Test\\Documents',
    remaining: 0,
    sourceInfo: null,
    destInfo: null,
    onResolve: mockOnResolve,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('returns null when not open', () => {
      const { container } = render(<FileConflictDialog {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders when open', () => {
      render(<FileConflictDialog {...defaultProps} />);
      expect(screen.getByText('File Conflict')).toBeInTheDocument();
    });
  });

  describe('File info display', () => {
    it('shows conflicting file name', () => {
      render(<FileConflictDialog {...defaultProps} />);
      expect(screen.getByText('document.txt')).toBeInTheDocument();
    });

    it('shows file icon for file conflicts', () => {
      render(<FileConflictDialog {...defaultProps} />);
      expect(screen.getByTestId('file-icon')).toBeInTheDocument();
    });

    it('shows folder icon for directory conflicts', () => {
      render(<FileConflictDialog {...defaultProps} isDir={true} />);
      expect(screen.getByTestId('folder-icon')).toBeInTheDocument();
    });

    it('describes the conflict correctly for files', () => {
      render(<FileConflictDialog {...defaultProps} />);
      expect(screen.getByText(/already has a file named/)).toBeInTheDocument();
    });

    it('describes the conflict correctly for folders', () => {
      render(<FileConflictDialog {...defaultProps} isDir={true} />);
      expect(screen.getByText(/already has a folder named/)).toBeInTheDocument();
    });
  });

  describe('Resolution buttons', () => {
    it('shows Replace button', () => {
      render(<FileConflictDialog {...defaultProps} />);
      expect(screen.getByText('Replace')).toBeInTheDocument();
      expect(screen.getByText(/Overwrite the existing file/)).toBeInTheDocument();
    });

    it('shows Keep Both button', () => {
      render(<FileConflictDialog {...defaultProps} />);
      expect(screen.getByText('Keep Both')).toBeInTheDocument();
      expect(screen.getByText(/Save with a renamed copy/)).toBeInTheDocument();
    });

    it('shows Skip button', () => {
      render(<FileConflictDialog {...defaultProps} />);
      expect(screen.getByText('Skip')).toBeInTheDocument();
      expect(screen.getByText(/Don't paste this file/)).toBeInTheDocument();
    });

    it('calls onResolve with replace when Replace is clicked', () => {
      render(<FileConflictDialog {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Replace existing file'));
      expect(mockOnResolve).toHaveBeenCalledWith('replace', false);
    });

    it('calls onResolve with keep-both when Keep Both is clicked', () => {
      render(<FileConflictDialog {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Keep both files'));
      expect(mockOnResolve).toHaveBeenCalledWith('keep-both', false);
    });

    it('calls onResolve with skip when Skip is clicked', () => {
      render(<FileConflictDialog {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Skip this file'));
      expect(mockOnResolve).toHaveBeenCalledWith('skip', false);
    });
  });

  describe('Keep both suggestion', () => {
    it('suggests renamed file name with (1) suffix', () => {
      render(<FileConflictDialog {...defaultProps} />);
      expect(screen.getByText(/document \(1\)\.txt/)).toBeInTheDocument();
    });

    it('suggests renamed folder name with (1) suffix', () => {
      render(<FileConflictDialog {...defaultProps} fileName="MyFolder" isDir={true} />);
      expect(screen.getByText(/MyFolder \(1\)/)).toBeInTheDocument();
    });
  });

  describe('Apply to all', () => {
    it('does not show apply-to-all section when remaining is 0', () => {
      render(<FileConflictDialog {...defaultProps} remaining={0} />);
      expect(screen.queryByText('Replace All')).not.toBeInTheDocument();
    });

    it('shows apply-to-all section when remaining > 0', () => {
      render(<FileConflictDialog {...defaultProps} remaining={5} />);
      expect(screen.getByText('Replace All')).toBeInTheDocument();
      expect(screen.getByText('Rename All')).toBeInTheDocument();
      expect(screen.getByText('Skip All')).toBeInTheDocument();
    });

    it('shows remaining count', () => {
      render(<FileConflictDialog {...defaultProps} remaining={5} />);
      expect(screen.getByText(/5 more conflicts remaining/)).toBeInTheDocument();
    });

    it('shows singular remaining text for 1 conflict', () => {
      render(<FileConflictDialog {...defaultProps} remaining={1} />);
      expect(screen.getByText(/1 more conflict remaining/)).toBeInTheDocument();
    });

    it('calls onResolve with applyToAll=true when Replace All clicked', () => {
      render(<FileConflictDialog {...defaultProps} remaining={3} />);
      fireEvent.click(screen.getByText('Replace All'));
      expect(mockOnResolve).toHaveBeenCalledWith('replace', true);
    });

    it('calls onResolve with applyToAll=true when Rename All clicked', () => {
      render(<FileConflictDialog {...defaultProps} remaining={3} />);
      fireEvent.click(screen.getByText('Rename All'));
      expect(mockOnResolve).toHaveBeenCalledWith('keep-both', true);
    });

    it('calls onResolve with applyToAll=true when Skip All clicked', () => {
      render(<FileConflictDialog {...defaultProps} remaining={3} />);
      fireEvent.click(screen.getByText('Skip All'));
      expect(mockOnResolve).toHaveBeenCalledWith('skip', true);
    });
  });

  describe('Metadata comparison', () => {
    it('shows metadata comparison when source and dest info provided', () => {
      render(
        <FileConflictDialog
          {...defaultProps}
          sourceInfo={{ size: 2048, modified: 1710000000 }}
          destInfo={{ size: 1024, modified: 1709000000 }}
        />,
      );

      expect(screen.getByText('Source')).toBeInTheDocument();
      expect(screen.getByText('Existing')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByText('Modified')).toBeInTheDocument();
    });

    it('does not show metadata when no info provided', () => {
      render(<FileConflictDialog {...defaultProps} />);
      expect(screen.queryByText('Source')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard navigation', () => {
    it('resolves skip on Escape key', () => {
      render(<FileConflictDialog {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(mockOnResolve).toHaveBeenCalledWith('skip', false);
    });
  });
});
