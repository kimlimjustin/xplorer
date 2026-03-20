import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import SmartSearch, { SmartSearchHandle } from '@/components/SmartSearch';

// No lodash mock needed — SmartSearch uses a native debounce implementation

// Mock use-toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock constants
vi.mock('@/lib/constants', () => ({
  SEARCH_INDEX_REFRESH_MS: 60000,
  SEARCH_DEBOUNCE_MS: 0,
  DROPDOWN_BLUR_DELAY_MS: 0,
}));

// Mock TauriAPI
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    getTokenizerStats: vi.fn(() => Promise.resolve(null)),
    findFiles: vi.fn(() => Promise.resolve([])),
    searchTokens: vi.fn(() => Promise.resolve([])),
    enhancedSearch: vi.fn(() => Promise.resolve({ results: [], parsed_query: null })),
    semanticSearch: vi.fn(() => Promise.resolve([])),
    findSimilarFiles: vi.fn(() => Promise.resolve([])),
  },
  SearchResult: {},
  SearchMatch: {},
  TokenIndex: {},
  StructuredQuery: {},
}));

import { TauriAPI } from '@/lib/tauri-api';

describe('SmartSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no index available
    vi.mocked(TauriAPI.getTokenizerStats).mockResolvedValue(null);
  });

  describe('Initial Rendering', () => {
    it('renders the search input with default placeholder', async () => {
      await act(async () => {
        render(<SmartSearch />);
      });

      expect(screen.getByPlaceholderText('Search files and content...')).toBeInTheDocument();
    });

    it('renders with custom placeholder', async () => {
      await act(async () => {
        render(<SmartSearch placeholder="Custom search..." />);
      });

      expect(screen.getByPlaceholderText('Custom search...')).toBeInTheDocument();
    });

    it('renders the search provider selector', async () => {
      await act(async () => {
        render(<SmartSearch />);
      });

      expect(screen.getByTitle(/Search provider: Local/)).toBeInTheDocument();
    });
  });

  describe('Search Input', () => {
    it('updates query when user types', async () => {
      await act(async () => {
        render(<SmartSearch currentPath="C:\\Users\\Test" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test query' } });
      });

      expect(input).toHaveValue('test query');
    });

    it('shows clear button when query is not empty', async () => {
      vi.mocked(TauriAPI.findFiles).mockResolvedValue([]);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Users\\Test" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'something' } });
      });

      // Wait for search to finish
      await waitFor(() => {
        // The clear button uses an SVG X icon, not text
        // We can verify by checking that the number of buttons increased
        // (AI toggle + clear = at least 2 inside the search controls)
        const controlsDiv = input.parentElement?.querySelector('.absolute.right-2');
        const buttons = controlsDiv?.querySelectorAll('button');
        expect(buttons?.length).toBeGreaterThanOrEqual(2); // AI toggle + clear
      });
    });

    it('clears query when clear button is clicked', async () => {
      vi.mocked(TauriAPI.findFiles).mockResolvedValue([]);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Users\\Test" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      // Wait for clear button to appear
      await waitFor(() => {
        const controlsDiv = input.parentElement?.querySelector('.absolute.right-2');
        const buttons = controlsDiv?.querySelectorAll('button');
        expect(buttons?.length).toBeGreaterThanOrEqual(2);
      });

      // Click the last button in the controls (the clear button)
      const controlsDiv = input.parentElement?.querySelector('.absolute.right-2');
      const buttons = controlsDiv?.querySelectorAll('button');
      const clearButton = buttons![buttons!.length - 1];

      await act(async () => {
        fireEvent.click(clearButton);
      });

      expect(input).toHaveValue('');
    });
  });

  describe('Search Results', () => {
    it('triggers a search when user types a query with a currentPath', async () => {
      vi.mocked(TauriAPI.findFiles).mockResolvedValue([]);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Users\\Test" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'readme' } });
        fireEvent.focus(input);
      });

      // The search should execute and show the no-results state
      // (since findFiles mock returns [])
      await waitFor(() => {
        expect(screen.getByText(/No results found for "readme"/)).toBeInTheDocument();
      });
    });

    it('displays search results', async () => {
      vi.mocked(TauriAPI.findFiles).mockResolvedValue([
        'C:\\Users\\Test\\readme.md',
        'C:\\Users\\Test\\readme.txt',
      ]);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Users\\Test" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'readme' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Found 2 results')).toBeInTheDocument();
      });
    });

    it('shows no results message when search returns empty', async () => {
      vi.mocked(TauriAPI.findFiles).mockResolvedValue([]);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Users\\Test" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'nonexistent' } });
        fireEvent.focus(input);
      });

      await waitFor(() => {
        expect(screen.getByText(/No results found/)).toBeInTheDocument();
      });
    });

    it('calls onFileSelect when a result is clicked', async () => {
      const onFileSelect = vi.fn();
      vi.mocked(TauriAPI.findFiles).mockResolvedValue(['C:\\Users\\Test\\readme.md']);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Users\\Test" onFileSelect={onFileSelect} />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'readme' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Found 1 result/)).toBeInTheDocument();
      });

      // Click on the result
      const resultPath = screen.getByText('C:\\Users\\Test\\readme.md');
      const button = resultPath.closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      expect(onFileSelect).toHaveBeenCalledWith('C:\\Users\\Test\\readme.md', false);
    });
  });

  describe('Index Status', () => {
    it('shows file count when tokenizer stats are available', async () => {
      vi.mocked(TauriAPI.getTokenizerStats).mockResolvedValue({
        total_files: 1234,
        total_tokens: 5000,
        total_unique_tokens: 2000,
        avg_tokens_per_file: 4,
      } as Record<string, unknown>);

      await act(async () => {
        render(<SmartSearch />);
      });

      // toLocaleString may use '.' or ',' as separator depending on locale
      // In jsdom the locale may produce '1.234' instead of '1,234'
      await waitFor(() => {
        // Check for the stats span containing the number
        const statsSpan = screen.getByText((content) => {
          return content.includes('1') && content.includes('234');
        });
        expect(statsSpan).toBeInTheDocument();
      });
    });

    it('uses indexed search when index is available', async () => {
      vi.mocked(TauriAPI.getTokenizerStats).mockResolvedValue({
        total_files: 100,
        total_tokens: 500,
        total_unique_tokens: 200,
        avg_tokens_per_file: 5,
      } as Record<string, unknown>);
      vi.mocked(TauriAPI.searchTokens).mockResolvedValue([]);
      vi.mocked(TauriAPI.findFiles).mockResolvedValue([]);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Users\\Test" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      await waitFor(() => {
        expect(TauriAPI.searchTokens).toHaveBeenCalledWith('test', 50);
      });
    });

    it('uses enhanced search for multi-word queries when index is available', async () => {
      vi.mocked(TauriAPI.getTokenizerStats).mockResolvedValue({
        total_files: 100,
        total_tokens: 500,
        total_unique_tokens: 200,
        avg_tokens_per_file: 5,
      } as Record<string, unknown>);
      vi.mocked(TauriAPI.enhancedSearch).mockResolvedValue({
        results: [],
        parsed_query: null,
      } as Record<string, unknown>);
      vi.mocked(TauriAPI.findFiles).mockResolvedValue([]);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Users\\Test" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'large video files today' } });
      });

      await waitFor(() => {
        expect(TauriAPI.enhancedSearch).toHaveBeenCalled();
      });
    });
  });

  describe('Provider Selector', () => {
    it('opens provider dropdown on click', async () => {
      await act(async () => {
        render(<SmartSearch />);
      });

      const providerButton = screen.getByText('Local');
      await act(async () => {
        fireEvent.click(providerButton);
      });

      // Should show provider options
      expect(screen.getByText('Claude')).toBeInTheDocument();
      expect(screen.getByText('GPT')).toBeInTheDocument();
      expect(screen.getByText('Ollama')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('handles Escape key to close results', async () => {
      vi.mocked(TauriAPI.findFiles).mockResolvedValue(['C:\\Users\\Test\\file.txt']);

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Users\\Test" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'file' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Found 1 result/)).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.keyDown(input, { key: 'Escape' });
      });

      // Results should be hidden
      expect(screen.queryByText(/Found 1 result/)).not.toBeInTheDocument();
    });
  });

  describe('Imperative Handle', () => {
    it('exposes focus method via ref', async () => {
      const ref = React.createRef<SmartSearchHandle>();

      await act(async () => {
        render(<SmartSearch ref={ref} />);
      });

      expect(ref.current).not.toBeNull();
      expect(typeof ref.current?.focus).toBe('function');

      // Calling focus should not throw
      await act(async () => {
        ref.current?.focus();
      });
    });
  });

  describe('Edge Cases', () => {
    it('renders without any props', async () => {
      await expect(
        act(async () => {
          render(<SmartSearch />);
        }),
      ).resolves.not.toThrow();
    });

    it('handles findFiles failure gracefully', async () => {
      vi.mocked(TauriAPI.findFiles).mockRejectedValue(new Error('search error'));

      await act(async () => {
        render(<SmartSearch currentPath="C:\\Users\\Test" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      // Should not crash
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search files and content...')).toBeInTheDocument();
      });
    });

    it('handles getTokenizerStats failure gracefully', async () => {
      vi.mocked(TauriAPI.getTokenizerStats).mockRejectedValue(new Error('stats error'));

      await expect(
        act(async () => {
          render(<SmartSearch />);
        }),
      ).resolves.not.toThrow();
    });

    it('does not search for empty/whitespace query', async () => {
      await act(async () => {
        render(<SmartSearch currentPath="C:\\Users\\Test" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: '   ' } });
      });

      expect(TauriAPI.findFiles).not.toHaveBeenCalled();
    });

    it('does not use xplorer:// path for filesystem search', async () => {
      vi.mocked(TauriAPI.findFiles).mockResolvedValue([]);

      await act(async () => {
        render(<SmartSearch currentPath="xplorer://favorites" />);
      });

      const input = screen.getByPlaceholderText('Search files and content...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      // findFiles should not be called with xplorer:// path
      await waitFor(() => {
        expect(TauriAPI.findFiles).not.toHaveBeenCalled();
      });
    });
  });
});
