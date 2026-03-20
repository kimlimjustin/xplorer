import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchResultsPanel from '@/components/explorer/SearchResultsPanel';

const mockSetQuery = vi.fn();
const mockSetActiveFilter = vi.fn();
const mockShowMore = vi.fn();
const mockClearSearch = vi.fn();

vi.mock('@/hooks/use-live-search', () => ({
  useLiveSearch: vi.fn(() => ({
    query: '',
    setQuery: mockSetQuery,
    groupedResults: [],
    isSearching: false,
    resultCount: 0,
    totalResultCount: 0,
    folderCount: 0,
    activeFilter: 'all',
    setActiveFilter: mockSetActiveFilter,
    hasMore: false,
    showMore: mockShowMore,
    clearSearch: mockClearSearch,
  })),
}));

vi.mock('@/lib/utils', () => ({
  formatFileSize: vi.fn((bytes: number) => `${bytes} B`),
  getFileIcon: vi.fn((file: { is_dir: boolean; name: string }) => (file.is_dir ? '📁' : '📄')),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getTotalSize: () => 0,
    getVirtualItems: () => [],
  })),
}));

describe('SearchResultsPanel', () => {
  const defaultProps = {
    basePath: 'C:\\Projects',
    navigateToPath: vi.fn(),
    onFileSelect: vi.fn(),
    onFileOpen: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders search input', () => {
      render(<SearchResultsPanel {...defaultProps} />);
      expect(screen.getByLabelText('Search files and folders')).toBeInTheDocument();
    });

    it('renders filter chips', () => {
      render(<SearchResultsPanel {...defaultProps} />);
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Files')).toBeInTheDocument();
      expect(screen.getByText('Folders')).toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Images')).toBeInTheDocument();
      expect(screen.getByText('Code')).toBeInTheDocument();
    });

    it('renders results list container', () => {
      render(<SearchResultsPanel {...defaultProps} />);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows placeholder text when no query', () => {
      render(<SearchResultsPanel {...defaultProps} />);
      expect(screen.getByText('Type to search files and folders')).toBeInTheDocument();
    });

    it('shows keyboard shortcut hint', () => {
      render(<SearchResultsPanel {...defaultProps} />);
      expect(screen.getByText('Ctrl+Shift+F to toggle this panel')).toBeInTheDocument();
    });
  });

  describe('Search input', () => {
    it('calls setQuery when typing', () => {
      render(<SearchResultsPanel {...defaultProps} />);
      const input = screen.getByLabelText('Search files and folders');
      fireEvent.change(input, { target: { value: 'test' } });
      expect(mockSetQuery).toHaveBeenCalledWith('test');
    });
  });

  describe('Filter chips', () => {
    it('calls setActiveFilter when chip is clicked', () => {
      render(<SearchResultsPanel {...defaultProps} />);
      fireEvent.click(screen.getByText('Documents'));
      expect(mockSetActiveFilter).toHaveBeenCalledWith('documents');
    });

    it('marks active filter with aria-pressed', () => {
      render(<SearchResultsPanel {...defaultProps} />);
      const allChip = screen.getByText('All');
      expect(allChip).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('With search results', () => {
    it('shows results list via useLiveSearch hook', async () => {
      // The results are rendered via the virtualizer, which is mocked
      // This test verifies that the hook is properly integrated
      const { useLiveSearch } = await import('@/hooks/use-live-search');
      (useLiveSearch as unknown).mockReturnValue({
        query: 'test',
        setQuery: mockSetQuery,
        groupedResults: [
          {
            parentDir: 'C:\\Projects',
            items: [
              {
                file: {
                  name: 'test.txt',
                  path: 'C:\\Projects\\test.txt',
                  size: 100,
                  is_dir: false,
                  modified: 0,
                  file_type: 'text',
                },
                relevance: 3,
                parentDir: 'C:\\Projects',
                relativePath: 'test.txt',
              },
            ],
          },
        ],
        isSearching: false,
        resultCount: 1,
        totalResultCount: 1,
        folderCount: 1,
        activeFilter: 'all',
        setActiveFilter: mockSetActiveFilter,
        hasMore: false,
        showMore: mockShowMore,
        clearSearch: mockClearSearch,
      });

      render(<SearchResultsPanel {...defaultProps} />);

      // Status line should show result count
      expect(screen.getByText(/Found 1 file in 1 folder/)).toBeInTheDocument();
    });
  });

  describe('Keyboard navigation', () => {
    it('calls clearSearch on Escape in input', () => {
      render(<SearchResultsPanel {...defaultProps} />);
      const input = screen.getByLabelText('Search files and folders');
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(mockClearSearch).toHaveBeenCalled();
    });
  });
});
