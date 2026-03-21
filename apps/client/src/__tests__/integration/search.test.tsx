import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/constants', () => ({
  SEARCH_INDEX_REFRESH_MS: 60000,
  SEARCH_DEBOUNCE_MS: 0,
  DROPDOWN_BLUR_DELAY_MS: 0,
}));

const {
  mockFindFiles,
  mockSearchTokens,
  mockEnhancedSearch,
  mockGetTokenizerStats,
  mockSemanticSearch,
} = vi.hoisted(() => ({
  mockFindFiles: vi.fn(() => Promise.resolve([])),
  mockSearchTokens: vi.fn(() => Promise.resolve([])),
  mockEnhancedSearch: vi.fn(() => Promise.resolve({ results: [], parsed_query: null })),
  mockGetTokenizerStats: vi.fn(() => Promise.resolve(null)),
  mockSemanticSearch: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    getTokenizerStats: mockGetTokenizerStats,
    findFiles: mockFindFiles,
    searchTokens: mockSearchTokens,
    enhancedSearch: mockEnhancedSearch,
    semanticSearch: mockSemanticSearch,
    findSimilarFiles: vi.fn(() => Promise.resolve([])),
    aiSearch: vi.fn(() => Promise.resolve({ results: [] })),
  },
  SearchResult: {},
  SearchMatch: {},
  TokenIndex: {},
  StructuredQuery: {},
}));

import SmartSearch from '@/components/SmartSearch';

describe('Search Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTokenizerStats.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Search Query Parsing', () => {
    it('performs simple filename search with single-word query', async () => {
      mockFindFiles.mockResolvedValue(['C:\\Projects\\readme.md']);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Projects" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'readme' } });
        fireEvent.focus(input);
      });

      await waitFor(() => {
        expect(screen.getByText(/Found 1 result/)).toBeInTheDocument();
      });
    });

    it('uses enhanced search for multi-word natural language queries', async () => {
      mockGetTokenizerStats.mockResolvedValue({
        total_files: 500,
        total_tokens: 2000,
        total_unique_tokens: 1000,
        avg_tokens_per_file: 4,
      } as Record<string, unknown>);
      mockEnhancedSearch.mockResolvedValue({
        results: [
          {
            path: 'C:\\Docs\\report.pdf',
            filename: 'report.pdf',
            matches: [],
            score: 0.9,
            relevance_type: 'exact',
          },
        ],
        parsed_query: {
          raw: 'large documents today',
          file_type: null,
          size_filter: null,
          date_filter: null,
          extensions: [],
          extension_filter: [],
          keywords: ['large', 'documents', 'today'],
        },
      } as Record<string, unknown>);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Docs" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'large documents today' } });
        fireEvent.focus(input);
      });

      await waitFor(() => {
        expect(mockEnhancedSearch).toHaveBeenCalled();
      });
    });

    it('triggers enhanced search for queries containing filter indicators', async () => {
      mockGetTokenizerStats.mockResolvedValue({
        total_files: 100,
        total_tokens: 500,
        total_unique_tokens: 200,
        avg_tokens_per_file: 5,
      } as Record<string, unknown>);
      mockEnhancedSearch.mockResolvedValue({ results: [], parsed_query: null } as Record<
        string,
        unknown
      >);
      mockFindFiles.mockResolvedValue([]);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Users\\Test" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'recent videos' } });
      });

      await waitFor(() => {
        expect(mockEnhancedSearch).toHaveBeenCalled();
      });
    });

    it('falls back to simple token search for short queries without filter keywords', async () => {
      mockGetTokenizerStats.mockResolvedValue({
        total_files: 100,
        total_tokens: 500,
        total_unique_tokens: 200,
        avg_tokens_per_file: 5,
      } as Record<string, unknown>);
      mockSearchTokens.mockResolvedValue([]);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Projects" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'config' } });
      });

      await waitFor(() => {
        expect(mockSearchTokens).toHaveBeenCalledWith('config', 50);
      });
    });
  });

  describe('Search Results Rendering', () => {
    it('renders multiple search results with file paths', async () => {
      mockFindFiles.mockResolvedValue([
        'C:\\Projects\\src\\index.ts',
        'C:\\Projects\\src\\utils.ts',
        'C:\\Projects\\package.json',
      ]);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Projects" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'ts' } });
        fireEvent.focus(input);
      });

      await waitFor(() => {
        expect(screen.getByText('Found 3 results')).toBeInTheDocument();
      });
    });

    it('renders "no results" message when no matches found', async () => {
      mockFindFiles.mockResolvedValue([]);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Projects" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'zzz_no_match_zzz' } });
        fireEvent.focus(input);
      });

      await waitFor(() => {
        expect(screen.getByText(/No results found/)).toBeInTheDocument();
      });
    });

    it('calls onFileSelect when a search result is clicked', async () => {
      const onFileSelect = vi.fn();
      mockFindFiles.mockResolvedValue(['C:\\Projects\\found-file.ts']);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Projects" onFileSelect={onFileSelect} />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'found' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Found 1 result/)).toBeInTheDocument();
      });

      const resultPath = screen.getByText('C:\\Projects\\found-file.ts');
      const button = resultPath.closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      expect(onFileSelect).toHaveBeenCalledWith('C:\\Projects\\found-file.ts', false);
    });

    it('clears results and query after selecting a result', async () => {
      const onFileSelect = vi.fn();
      mockFindFiles.mockResolvedValue(['C:\\Projects\\config.json']);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Projects" onFileSelect={onFileSelect} />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'config' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Found 1 result/)).toBeInTheDocument();
      });

      const resultPath = screen.getByText('C:\\Projects\\config.json');
      const button = resultPath.closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      expect(input).toHaveValue('');
    });
  });

  describe('Search Filters', () => {
    it('does not perform filesystem search when currentPath is xplorer:// URI', async () => {
      await act(async () => {
        render(<SmartSearch currentPath="xplorer://home" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      await waitFor(() => {
        expect(mockFindFiles).not.toHaveBeenCalled();
      });
    });

    it('does not search for whitespace-only queries', async () => {
      await act(async () => {
        render(<SmartSearch currentPath="C:\\Projects" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: '    ' } });
      });

      expect(mockFindFiles).not.toHaveBeenCalled();
      expect(mockSearchTokens).not.toHaveBeenCalled();
      expect(mockEnhancedSearch).not.toHaveBeenCalled();
    });

    it('respects maxResults prop to limit returned results', async () => {
      const manyPaths = Array.from({ length: 100 }, (_, i) => `C:\\Projects\\file${i}.txt`);
      mockFindFiles.mockResolvedValue(manyPaths);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Projects" maxResults={5} />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'file' } });
        fireEvent.focus(input);
      });

      await waitFor(() => {
        expect(screen.getByText(/Found 5 results/)).toBeInTheDocument();
      });
    });
  });

  describe('Search Provider Selector', () => {
    it('renders the search provider button with Local as default', async () => {
      await act(async () => {
        render(<SmartSearch />);
      });

      expect(screen.getByText('Local')).toBeInTheDocument();
    });

    it('shows available providers when the selector is clicked', async () => {
      await act(async () => {
        render(<SmartSearch />);
      });

      const providerButton = screen.getByText('Local');
      await act(async () => {
        fireEvent.click(providerButton);
      });

      expect(screen.getByText('Claude')).toBeInTheDocument();
      expect(screen.getByText('GPT')).toBeInTheDocument();
      expect(screen.getByText('Ollama')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('closes search results on Escape key', async () => {
      mockFindFiles.mockResolvedValue(['C:\\Projects\\file.txt']);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Projects" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'file' } });
        fireEvent.focus(input);
      });

      await waitFor(() => {
        expect(screen.getByText(/Found 1 result/)).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.keyDown(input, { key: 'Escape' });
      });

      expect(screen.queryByText(/Found 1 result/)).not.toBeInTheDocument();
    });

    it('navigates results with ArrowDown and ArrowUp keys', async () => {
      mockFindFiles.mockResolvedValue(['C:\\Projects\\alpha.txt', 'C:\\Projects\\beta.txt']);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Projects" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'txt' } });
        fireEvent.focus(input);
      });

      await waitFor(() => {
        expect(screen.getByText('Found 2 results')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.keyDown(input, { key: 'ArrowDown' });
      });

      await act(async () => {
        fireEvent.keyDown(input, { key: 'ArrowDown' });
      });

      await act(async () => {
        fireEvent.keyDown(input, { key: 'ArrowUp' });
      });

      // No assertions on the selected index visual state since it's CSS-based,
      // but we verify that keyboard navigation does not throw.
    });

    it('selects a result with Enter key after navigating', async () => {
      const onFileSelect = vi.fn();
      mockFindFiles.mockResolvedValue(['C:\\Projects\\first.txt', 'C:\\Projects\\second.txt']);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Projects" onFileSelect={onFileSelect} />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'txt' } });
        fireEvent.focus(input);
      });

      await waitFor(() => {
        expect(screen.getByText('Found 2 results')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.keyDown(input, { key: 'ArrowDown' });
      });

      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      expect(onFileSelect).toHaveBeenCalled();
    });
  });

  describe('Index Status Integration', () => {
    it('shows indexed file count when tokenizer stats are available', async () => {
      mockGetTokenizerStats.mockResolvedValue({
        total_files: 2500,
        total_tokens: 10000,
        total_unique_tokens: 4000,
        avg_tokens_per_file: 4,
      } as Record<string, unknown>);

      await act(async () => {
        render(<SmartSearch />);
      });

      await waitFor(() => {
        const statsElement = screen.getByText((content) => {
          return content.includes('2') && content.includes('500');
        });
        expect(statsElement).toBeInTheDocument();
      });
    });

    it('handles tokenizer stats failure without crashing', async () => {
      mockGetTokenizerStats.mockRejectedValue(new Error('Index not ready'));

      await expect(
        act(async () => {
          render(<SmartSearch />);
        }),
      ).resolves.not.toThrow();

      expect(screen.getByPlaceholderText('Search files and content...')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles search API failure gracefully', async () => {
      mockFindFiles.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Projects" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search files and content...')).toBeInTheDocument();
      });
    });

    it('handles enhanced search failure and falls back to filesystem search', async () => {
      mockGetTokenizerStats.mockResolvedValue({
        total_files: 100,
        total_tokens: 500,
        total_unique_tokens: 200,
        avg_tokens_per_file: 5,
      } as Record<string, unknown>);
      mockEnhancedSearch.mockRejectedValue(new Error('Index corrupted'));
      mockFindFiles.mockResolvedValue(['C:\\Projects\\fallback-result.txt']);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Projects" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'large video files' } });
        fireEvent.focus(input);
      });

      await waitFor(() => {
        expect(screen.getByText(/Found 1 result/)).toBeInTheDocument();
      });
    });
  });
});
