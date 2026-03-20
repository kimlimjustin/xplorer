import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TextPreview from '@/components/previews/TextPreview';
import { FileEntry, TauriAPI } from '@/lib/tauri-api';

// Mock TauriAPI
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    readTextFile: vi.fn(),
  },
  FileEntry: {}, // Mock FileEntry type export
}));

describe('TextPreview', () => {
  const mockFile: FileEntry = {
    name: 'test.txt',
    path: 'C:\\Users\\Test\\test.txt',
    size: 1024,
    is_dir: false,
    modified: Date.now(),
    file_type: 'text',
  };

  const mockProps = {
    file: mockFile,
    onError: vi.fn(),
    onLoad: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading States', () => {
    it('shows loading state initially', () => {
      vi.mocked(TauriAPI.readTextFile).mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<TextPreview {...mockProps} />);

      expect(screen.getByText('Loading text...')).toBeInTheDocument();
    });
  });

  describe('Success Cases', () => {
    it('displays text content when loaded successfully', async () => {
      const mockContent = 'This is test content\nWith multiple lines';
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue(mockContent);

      render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        const preElement = screen.getByText(/This is test content/);
        expect(preElement).toBeInTheDocument();
        expect(preElement.textContent).toBe(mockContent);
      });

      expect(mockProps.onLoad).toHaveBeenCalled();
    });

    it('truncates large content for preview', async () => {
      const longContent = 'a'.repeat(6000);
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue(longContent);

      render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        const preElement = screen.getByText(/\.\.\. \(file truncated for preview\)/);
        const displayedText = preElement.textContent;
        expect(displayedText).toContain('... (file truncated for preview)');
        expect(displayedText?.length).toBeLessThan(longContent.length);
      });
    });

    it('preserves formatting with pre tag', async () => {
      const formattedContent = 'Line 1\n  Indented Line\nLine 3';
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue(formattedContent);

      render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        const preElement = screen.getByText(/Line 1/).closest('pre');
        expect(preElement).toHaveClass('whitespace-pre-wrap');
        expect(preElement?.textContent).toBe(formattedContent);
      });
    });

    it('displays preview title', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('test content');

      render(<TextPreview {...mockProps} />);

      expect(screen.getByText('Text Preview')).toBeInTheDocument();
    });
  });

  describe('Error Cases', () => {
    it('shows error when file is too large', async () => {
      const largeFile = { ...mockFile, size: 6 * 1024 * 1024 }; // 6MB

      render(<TextPreview {...mockProps} file={largeFile} />);

      await waitFor(() => {
        expect(screen.getByText('Cannot preview text')).toBeInTheDocument();
        expect(screen.getByText('File is too large for preview')).toBeInTheDocument();
      });

      expect(mockProps.onError).not.toHaveBeenCalled(); // Not called for size limit
    });

    it('shows error when file read fails', async () => {
      const error = new Error('File not found');
      vi.mocked(TauriAPI.readTextFile).mockRejectedValue(error);

      render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Cannot preview text')).toBeInTheDocument();
        expect(screen.getByText('File not found')).toBeInTheDocument();
      });

      expect(mockProps.onError).toHaveBeenCalledWith(error);
    });

    it('handles non-Error rejections', async () => {
      vi.mocked(TauriAPI.readTextFile).mockRejectedValue('String error');

      render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Cannot preview text')).toBeInTheDocument();
        expect(screen.getByText('Failed to load text file')).toBeInTheDocument();
      });

      expect(mockProps.onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('shows appropriate error icon', async () => {
      vi.mocked(TauriAPI.readTextFile).mockRejectedValue(new Error('Test error'));

      render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        const errorMessage = screen.getByText('Cannot preview text');
        const svgIcon = errorMessage.parentElement?.querySelector('svg');
        expect(svgIcon).toBeInTheDocument();
        expect(svgIcon).toHaveAttribute('viewBox', '0 0 20 20');
      });
    });
  });

  describe('File Dependencies', () => {
    it('reloads content when file path changes', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('initial content');

      const { rerender } = render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('initial content')).toBeInTheDocument();
      });

      // Change file path
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('updated content');
      const updatedFile = { ...mockFile, path: 'C:\\Users\\Test\\updated.txt' };
      rerender(<TextPreview {...mockProps} file={updatedFile} />);

      await waitFor(() => {
        expect(screen.getByText('updated content')).toBeInTheDocument();
      });

      expect(vi.mocked(TauriAPI.readTextFile)).toHaveBeenCalledTimes(2);
    });

    it('reloads content when file size changes', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('initial content');

      const { rerender } = render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('initial content')).toBeInTheDocument();
      });

      // Change file size
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('updated content');
      const updatedFile = { ...mockFile, size: 2048 };
      rerender(<TextPreview {...mockProps} file={updatedFile} />);

      await waitFor(() => {
        expect(screen.getByText('updated content')).toBeInTheDocument();
      });

      expect(vi.mocked(TauriAPI.readTextFile)).toHaveBeenCalledTimes(2);
    });
  });

  describe('Callback Handling', () => {
    it('calls onLoad when content loads successfully', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('test content');

      render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        expect(mockProps.onLoad).toHaveBeenCalled();
      });
    });

    it('does not call onLoad when there is an error', async () => {
      vi.mocked(TauriAPI.readTextFile).mockRejectedValue(new Error('Test error'));

      render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Cannot preview text')).toBeInTheDocument();
      });

      expect(mockProps.onLoad).not.toHaveBeenCalled();
    });

    it('works without optional callbacks', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('test content');

      const propsWithoutCallbacks = { file: mockFile };

      expect(() => render(<TextPreview {...propsWithoutCallbacks} />)).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('test content')).toBeInTheDocument();
      });
    });
  });

  describe('CSS Classes and Styling', () => {
    it('applies correct CSS classes', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('test content');

      render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        const preElement = screen.getByText('test content').closest('pre');
        expect(preElement).toHaveClass(
          'text-xs',
          'font-mono',
          'whitespace-pre-wrap',
          'text-xp-text',
          'break-words',
        );
      });
    });

    it('applies correct container classes', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('test content');

      render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        const preElement = screen.getByText('test content').closest('pre');
        const container = preElement?.parentElement;
        expect(container).toHaveClass(
          'bg-xp-surface',
          'border',
          'border-xp-border',
          'rounded',
          'p-3',
          'max-h-64',
          'overflow-y-auto',
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty file content', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue('');

      render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        expect(mockProps.onLoad).toHaveBeenCalled();
      });

      // Should not render content section but should call onLoad
      const preElement = screen.queryByRole('group');
      expect(preElement).toBeNull();
    });

    it('handles whitespace-only content', async () => {
      const whitespaceContent = '   \n\n\t  ';
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue(whitespaceContent);

      render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        // Find the pre element - it should contain the whitespace
        const container = screen.getByText('Text Preview').parentElement;
        const preElement = container?.querySelector('pre');
        expect(preElement).toBeInTheDocument();
        expect(preElement?.textContent).toBe(whitespaceContent);
      });
    });

    it('handles special characters and Unicode', async () => {
      const specialContent = 'Special chars: åäö 한국어 🌟 © ® ™';
      vi.mocked(TauriAPI.readTextFile).mockResolvedValue(specialContent);

      render(<TextPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(specialContent)).toBeInTheDocument();
      });
    });
  });
});
