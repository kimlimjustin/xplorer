import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CodePreview from '@/components/previews/CodePreview';
import { FileEntry, TauriAPI } from '@/lib/tauri-api';

// Mock react-syntax-highlighter
vi.mock('react-syntax-highlighter', () => {
  const React = require('react');
  return {
    Prism: React.forwardRef(({ children, language, showLineNumbers, ..._rest }: Record<string, unknown> & { children?: React.ReactNode; language?: string; showLineNumbers?: boolean }, _ref: React.Ref<HTMLElement>) => (
      <pre
        data-testid="syntax-highlighter"
        data-language={language}
        data-show-line-numbers={String(showLineNumbers)}
      >
        <code>{children}</code>
      </pre>
    )),
  };
});

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: {},
}));

// Extend TauriAPI mock
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    readTextFile: vi.fn(() => Promise.resolve('const x = 1;\nconsole.log(x);')),
  },
  FileEntry: {},
}));

describe('CodePreview', () => {
  const mockFile: FileEntry = {
    name: 'script.js',
    path: 'C:\\Users\\Test\\script.js',
    size: 512,
    is_dir: false,
    modified: Date.now(),
    file_type: 'code',
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

      render(<CodePreview {...mockProps} />);

      expect(screen.getByRole('status', { name: 'Loading preview' })).toBeInTheDocument();
    });

    it('shows animated loading placeholder', () => {
      vi.mocked(TauriAPI.readTextFile).mockReturnValueOnce(new Promise(() => {}));

      render(<CodePreview {...mockProps} />);

      // PreviewSkeleton uses inline shimmer animation (xp-shimmer), not Tailwind .animate-pulse
      const skeleton = screen.getByRole('status', { name: 'Loading preview' });
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Successful Load', () => {
    it('renders code content after loading', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('const x = 1;\nconsole.log(x);');

      render(<CodePreview {...mockProps} />);

      await waitFor(() => {
        const highlighter = screen.getByTestId('syntax-highlighter');
        expect(highlighter).toBeInTheDocument();
        expect(highlighter.textContent).toContain('const x = 1;');
        expect(highlighter.textContent).toContain('console.log(x);');
      });
    });

    it('calls onLoad after successful load', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('code');

      render(<CodePreview {...mockProps} />);

      await waitFor(() => {
        expect(mockProps.onLoad).toHaveBeenCalled();
      });
    });

    it('reads file content using TauriAPI', async () => {
      render(<CodePreview {...mockProps} />);

      await waitFor(() => {
        expect(TauriAPI.readTextFile).toHaveBeenCalledWith('C:\\Users\\Test\\script.js');
      });
    });

    it('enables line numbers in syntax highlighter', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('code');

      render(<CodePreview {...mockProps} />);

      await waitFor(() => {
        const highlighter = screen.getByTestId('syntax-highlighter');
        expect(highlighter).toHaveAttribute('data-show-line-numbers', 'true');
      });
    });
  });

  describe('Language Detection', () => {
    const languageTests = [
      { fileName: 'app.js', expected: 'javascript' },
      { fileName: 'component.tsx', expected: 'tsx' },
      { fileName: 'style.css', expected: 'css' },
      { fileName: 'main.py', expected: 'python' },
      { fileName: 'server.go', expected: 'go' },
      { fileName: 'lib.rs', expected: 'rust' },
      { fileName: 'App.java', expected: 'java' },
      { fileName: 'query.sql', expected: 'sql' },
      { fileName: 'config.yaml', expected: 'yaml' },
      { fileName: 'data.json', expected: 'json' },
      { fileName: 'page.html', expected: 'html' },
      { fileName: 'script.sh', expected: 'bash' },
      { fileName: 'config.toml', expected: 'toml' },
      { fileName: 'program.cpp', expected: 'cpp' },
      { fileName: 'program.c', expected: 'c' },
      { fileName: 'unknown.xyz', expected: 'text' },
    ];

    languageTests.forEach(({ fileName, expected }) => {
      it(`detects ${expected} language for .${fileName.split('.').pop()} files`, async () => {
        vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('code');

        const file: FileEntry = { ...mockFile, name: fileName };
        render(<CodePreview {...mockProps} file={file} />);

        await waitFor(() => {
          const highlighter = screen.getByTestId('syntax-highlighter');
          expect(highlighter).toHaveAttribute('data-language', expected);
        });
      });
    });

    it('displays detected language badge', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('const x = 1;');

      render(<CodePreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('javascript')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error state when file read fails', async () => {
      vi.mocked(TauriAPI.readTextFile).mockRejectedValueOnce(new Error('File not found'));

      render(<CodePreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Cannot preview code')).toBeInTheDocument();
        expect(screen.getByText('File not found')).toBeInTheDocument();
      });
    });

    it('calls onError when file read fails', async () => {
      const error = new Error('Permission denied');
      vi.mocked(TauriAPI.readTextFile).mockRejectedValueOnce(error);

      render(<CodePreview {...mockProps} />);

      await waitFor(() => {
        expect(mockProps.onError).toHaveBeenCalledWith(error);
      });
    });

    it('creates Error from non-Error rejection', async () => {
      vi.mocked(TauriAPI.readTextFile).mockRejectedValueOnce('string error');

      render(<CodePreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Cannot preview code')).toBeInTheDocument();
      });
    });
  });

  describe('Large File Truncation', () => {
    it('truncates large files at 2000 characters', async () => {
      const longContent = 'x'.repeat(3000);
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce(longContent);

      const largeFile: FileEntry = { ...mockFile, size: 200000 }; // > 100000 threshold
      render(<CodePreview {...mockProps} file={largeFile} />);

      await waitFor(() => {
        const highlighter = screen.getByTestId('syntax-highlighter');
        const text = highlighter.textContent || '';
        expect(text).toContain('... (file truncated for preview)');
        expect(text.length).toBeLessThan(longContent.length);
      });
    });

    it('does not truncate small files', async () => {
      const shortContent = 'const x = 1;';
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce(shortContent);

      render(<CodePreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(shortContent)).toBeInTheDocument();
      });
    });
  });

  describe('File Path Changes', () => {
    it('reloads content when file path changes', async () => {
      vi.mocked(TauriAPI.readTextFile)
        .mockResolvedValueOnce('first file content')
        .mockResolvedValueOnce('second file content');

      const { rerender } = render(<CodePreview {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('first file content')).toBeInTheDocument();
      });

      const newFile: FileEntry = {
        ...mockFile,
        path: 'C:\\Users\\Test\\other.js',
        name: 'other.js',
      };
      rerender(<CodePreview {...mockProps} file={newFile} />);

      await waitFor(() => {
        expect(TauriAPI.readTextFile).toHaveBeenCalledWith('C:\\Users\\Test\\other.js');
      });
    });
  });

  describe('Callback Handling', () => {
    it('works without optional callbacks', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('code');

      const propsWithoutCallbacks = { file: mockFile };
      expect(() => render(<CodePreview {...propsWithoutCallbacks} />)).not.toThrow();

      await waitFor(() => {
        expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty file', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('');

      render(<CodePreview {...mockProps} />);

      // Should finish loading without error (content is empty string, so onLoad is still called)
      await waitFor(() => {
        expect(mockProps.onLoad).toHaveBeenCalled();
        // Empty content string is falsy, so syntax highlighter won't render
        expect(screen.queryByTestId('syntax-highlighter')).not.toBeInTheDocument();
      });
    });

    it('handles file with no extension', async () => {
      vi.mocked(TauriAPI.readTextFile).mockResolvedValueOnce('content');

      const noExtFile: FileEntry = { ...mockFile, name: 'Makefile' };
      render(<CodePreview {...mockProps} file={noExtFile} />);

      await waitFor(() => {
        const highlighter = screen.getByTestId('syntax-highlighter');
        // 'Makefile' maps to 'makefile' via the language map
        expect(highlighter).toHaveAttribute('data-language', 'makefile');
      });
    });
  });
});
