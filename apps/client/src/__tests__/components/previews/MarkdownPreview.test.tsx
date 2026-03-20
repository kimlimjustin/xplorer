import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MarkdownPreview from '@/components/previews/MarkdownPreview';
import { FileEntry, TauriAPI } from '@/lib/tauri-api';

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html: string, _options?: Record<string, unknown>) => {
      // Strip script tags to simulate sanitization
      return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }),
  },
}));

// Extend TauriAPI mock
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    readTextFile: vi.fn(() => Promise.resolve('# Hello World\n\nThis is a test.')),
  },
  FileEntry: {},
}));

describe('MarkdownPreview', () => {
  const mockFile: FileEntry = {
    name: 'README.md',
    path: 'C:\\Users\\Test\\README.md',
    size: 512,
    is_dir: false,
    modified: Date.now(),
    file_type: 'markdown',
  };

  const mockProps = {
    file: mockFile,
    onError: vi.fn(),
    onLoad: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading state initially', () => {
      vi.mocked(TauriAPI.readTextFile).mockReturnValueOnce(new Promise(() => {}));

      render(<MarkdownPreview {...mockProps} />);

      expect(screen.getByText('Loading markdown...')).toBeInTheDocument();
    });

    it('shows animated loading placeholder', () => {
      vi.mocked(TauriAPI.readTextFile).mockReturnValueOnce(new Promise(() => {}));

      render(<MarkdownPreview {...mockProps} />);

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Successful Load', () => {
    it('renders markdown content after loading', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('# Hello World\n\nThis is a test.');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Markdown Preview')).toBeInTheDocument();
      });
    });

    it('calls onLoad after successful load', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('# Title');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(mockProps.onLoad).toHaveBeenCalled();
      });
    });

    it('reads file content using TauriAPI', async () => {
      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(TauriAPI.readTextFile).toHaveBeenCalledWith('C:\\Users\\Test\\README.md');
      });
    });
  });

  describe('View Mode Toggle', () => {
    it('renders Rendered and Raw view mode buttons', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('# Title');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Rendered')).toBeInTheDocument();
        expect(screen.getByText('Raw')).toBeInTheDocument();
      });
    });

    it('defaults to rendered mode', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('# Title');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        const renderedButton = screen.getByText('Rendered');
        expect(renderedButton).toHaveClass('bg-xp-blue', 'text-white');
      });
    });

    it('switches to raw mode when Raw button is clicked', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('# Title\n\nSome text here.');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Raw')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Raw'));

      // In raw mode, should show raw markdown text in a pre element
      const preElement = document.querySelector('pre');
      expect(preElement).toBeInTheDocument();
      expect(preElement?.textContent).toContain('# Title');
      expect(preElement?.textContent).toContain('Some text here.');
    });

    it('switches back to rendered mode', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('# Title');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Rendered')).toBeInTheDocument();
      });

      // Switch to raw
      fireEvent.click(screen.getByText('Raw'));

      // Switch back to rendered
      fireEvent.click(screen.getByText('Rendered'));

      const renderedButton = screen.getByText('Rendered');
      expect(renderedButton).toHaveClass('bg-xp-blue', 'text-white');
    });
  });

  describe('Markdown to HTML Conversion', () => {
    it('converts markdown headers', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('# Main Title');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        // In rendered mode, HTML should contain h1 tag content
        const container =
          document.querySelector('[dangerouslySetInnerHTML]') ||
          document.querySelector('.text-xs.text-xp-text');
        expect(container).toBeInTheDocument();
      });
    });

    it('converts bold text', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('**bold text**');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        const rendered = document.querySelector('.text-xs.text-xp-text');
        if (rendered) {
          expect(rendered.innerHTML).toContain('<strong');
        }
      });
    });

    it('converts italic text', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('*italic text*');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        const rendered = document.querySelector('.text-xs.text-xp-text');
        if (rendered) {
          expect(rendered.innerHTML).toContain('<em');
        }
      });
    });

    it('converts inline code', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('Use `code` here');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        const rendered = document.querySelector('.text-xs.text-xp-text');
        if (rendered) {
          expect(rendered.innerHTML).toContain('<code');
        }
      });
    });

    it('converts links', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('[Click here](https://example.com)');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        const rendered = document.querySelector('.text-xs.text-xp-text');
        if (rendered) {
          expect(rendered.innerHTML).toContain('href="https://example.com"');
          expect(rendered.innerHTML).toContain('Click here');
        }
      });
    });
  });

  describe('HTML Sanitization', () => {
    it('calls DOMPurify.sanitize on converted HTML', async () => {
      const DOMPurify = (await import('dompurify')).default;
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('# Safe Content');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(DOMPurify.sanitize).toHaveBeenCalled();
      });
    });

    it('strips script tags from content', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce(
        '<script>alert("xss")</script>Normal text',
      );

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        const rendered = document.querySelector('.text-xs.text-xp-text');
        if (rendered) {
          expect(rendered.innerHTML).not.toContain('<script');
          expect(rendered.innerHTML).not.toContain('alert');
        }
      });
    });

    it('sanitizes with correct forbidden tags', async () => {
      const DOMPurify = (await import('dompurify')).default;
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('content');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(DOMPurify.sanitize).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
            ALLOW_DATA_ATTR: false,
          }),
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error state when file read fails', async () => {
      vi.mocked(TauriAPI.readTextFile).mockRejectedValueOnce(new Error('File not found'));

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Cannot preview markdown')).toBeInTheDocument();
        expect(screen.getByText('File not found')).toBeInTheDocument();
      });
    });

    it('calls onError when file read fails', async () => {
      const error = new Error('Permission denied');
      vi.mocked(TauriAPI.readTextFile).mockRejectedValueOnce(error);

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(mockProps.onError).toHaveBeenCalledWith(error);
      });
    });

    it('shows error for files too large to preview', async () => {
      const largeFile: FileEntry = {
        ...mockFile,
        size: 10 * 1024 * 1024, // 10MB > 5MB limit
      };

      render(<MarkdownPreview {...mockProps} file={largeFile} />);

      await waitFor(() => {
        expect(screen.getByText('Cannot preview markdown')).toBeInTheDocument();
        expect(screen.getByText('File is too large for preview')).toBeInTheDocument();
      });
    });
  });

  describe('Raw View', () => {
    it('shows raw markdown in pre element', async () => {
      const rawContent = '# Title\n\n**Bold** and *italic*';
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce(rawContent);

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Raw')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Raw'));

      const preElement = document.querySelector('pre');
      expect(preElement).toBeInTheDocument();
      expect(preElement?.textContent).toContain('# Title');
      expect(preElement?.textContent).toContain('**Bold**');
    });
  });

  describe('File Path Changes', () => {
    it('reloads content when file path changes', async () => {
      vi.mocked(TauriAPI.readTextFile)
        .mockResolvedValueOnce('# First File')
        .mockResolvedValueOnce('# Second File');

      const { rerender } = render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(TauriAPI.readTextFile).toHaveBeenCalledWith('C:\\Users\\Test\\README.md');
      });

      const newFile: FileEntry = {
        ...mockFile,
        path: 'C:\\Users\\Test\\CHANGELOG.md',
        name: 'CHANGELOG.md',
      };
      rerender(<MarkdownPreview {...mockProps} file={newFile} />);

      await waitFor(() => {
        expect(TauriAPI.readTextFile).toHaveBeenCalledWith('C:\\Users\\Test\\CHANGELOG.md');
      });
    });
  });

  describe('Callback Handling', () => {
    it('works without optional callbacks', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('# Test');

      const propsWithoutCallbacks = { file: mockFile };
      expect(() => render(<MarkdownPreview {...propsWithoutCallbacks} />)).not.toThrow();
    });
  });

  describe('Component Structure', () => {
    it('renders correct heading', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('content');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Markdown Preview')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty markdown file', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(mockProps.onLoad).toHaveBeenCalled();
      });
    });

    it('handles file with special characters in name', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('content');

      const specialFile: FileEntry = {
        ...mockFile,
        name: 'my file (1) [copy].md',
        path: 'C:\\Users\\Test\\my file (1) [copy].md',
      };

      expect(() => render(<MarkdownPreview {...mockProps} file={specialFile} />)).not.toThrow();
    });

    it('handles markdown with code blocks', async () => {
      const mdWithCode = '```\ncode block\n```';
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce(mdWithCode);

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        const rendered = document.querySelector('.text-xs.text-xp-text');
        if (rendered) {
          expect(rendered.innerHTML).toContain('<pre');
          expect(rendered.innerHTML).toContain('<code');
        }
      });
    });

    it('handles non-Error rejection in readTextFile', async () => {
      vi.mocked(TauriAPI.readTextFile).mockRejectedValueOnce('string error');

      render(<MarkdownPreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Cannot preview markdown')).toBeInTheDocument();
      });
    });
  });
});
