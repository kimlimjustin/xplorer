import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotesPanel from '@/components/panels/NotesPanel';
import { TauriAPI } from '@/lib/tauri-api';

// Extend TauriAPI mock
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    getAllNotes: vi.fn(() => Promise.resolve({})),
    searchNotes: vi.fn(() => Promise.resolve([])),
  },
}));

describe('NotesPanel', () => {
  const mockProps = {
    onClose: vi.fn(),
    navigateToPath: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('renders the panel title', async () => {
      render(<NotesPanel {...mockProps} />);

      expect(screen.getByText('Notes')).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(<NotesPanel {...mockProps} />);

      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
    });

    it('renders refresh button', () => {
      render(<NotesPanel {...mockProps} />);

      expect(screen.getByTitle('Refresh')).toBeInTheDocument();
    });

    it('renders close button when onClose provided', () => {
      render(<NotesPanel {...mockProps} />);

      expect(screen.getByTitle('Close panel')).toBeInTheDocument();
    });

    it('does not render close button when onClose not provided', () => {
      render(<NotesPanel navigateToPath={vi.fn()} />);

      expect(screen.queryByTitle('Close panel')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state message when no notes exist', async () => {
      vi.mocked(TauriAPI.getAllNotes).mockResolvedValueOnce({});

      render(<NotesPanel {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('No notes yet.')).toBeInTheDocument();
        expect(screen.getByText('Right-click a file and choose Notes...')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading message while notes are loading', () => {
      // Make getAllNotes never resolve
      vi.mocked(TauriAPI.getAllNotes).mockReturnValueOnce(new Promise(() => {}));

      render(<NotesPanel {...mockProps} />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Notes List', () => {
    const mockNotes = {
      'C:\\Users\\Test\\file1.txt': [
        {
          id: 'note1',
          title: 'First Note',
          content: 'Some content here',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'note2',
          title: 'Second Note',
          content: 'More content',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ],
      'C:\\Users\\Test\\file2.txt': [
        {
          id: 'note3',
          title: 'Another Note',
          content: 'Different content',
          created_at: '2024-01-03T00:00:00Z',
          updated_at: '2024-01-03T00:00:00Z',
        },
      ],
    };

    it('displays notes grouped by file', async () => {
      vi.mocked(TauriAPI.getAllNotes).mockResolvedValueOnce(mockNotes);

      render(<NotesPanel {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('file1.txt')).toBeInTheDocument();
        expect(screen.getByText('file2.txt')).toBeInTheDocument();
      });
    });

    it('shows note count per file', async () => {
      vi.mocked(TauriAPI.getAllNotes).mockResolvedValueOnce(mockNotes);

      render(<NotesPanel {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('2 notes')).toBeInTheDocument();
        expect(screen.getByText('1 note')).toBeInTheDocument();
      });
    });

    it('shows latest note title for each group', async () => {
      vi.mocked(TauriAPI.getAllNotes).mockResolvedValueOnce(mockNotes);

      render(<NotesPanel {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Second Note')).toBeInTheDocument();
        expect(screen.getByText('Another Note')).toBeInTheDocument();
      });
    });

    it('shows footer with total count', async () => {
      vi.mocked(TauriAPI.getAllNotes).mockResolvedValueOnce(mockNotes);

      render(<NotesPanel {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/3 notes across 2 files/)).toBeInTheDocument();
      });
    });

    it('calls navigateToPath when a note group is clicked', async () => {
      vi.mocked(TauriAPI.getAllNotes).mockResolvedValueOnce(mockNotes);

      render(<NotesPanel {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('file1.txt')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('file1.txt'));

      expect(mockProps.navigateToPath).toHaveBeenCalledWith('C:\\Users\\Test');
    });
  });

  describe('Search Functionality', () => {
    it('calls searchNotes when text is entered in search', async () => {
      vi.mocked(TauriAPI.getAllNotes).mockResolvedValueOnce({});

      render(<NotesPanel {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(searchInput, { target: { value: 'test query' } });

      await waitFor(
        () => {
          expect(TauriAPI.searchNotes).toHaveBeenCalledWith('test query');
        },
        { timeout: 500 },
      );
    });

    it('shows search results', async () => {
      vi.mocked(TauriAPI.getAllNotes).mockResolvedValueOnce({});
      vi.mocked(TauriAPI.searchNotes).mockResolvedValueOnce([
        {
          path: 'C:\\Users\\Test\\result.txt',
          note: {
            id: 'sr1',
            title: 'Search Result',
            content: 'Found this note',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        },
      ]);

      render(<NotesPanel {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(searchInput, { target: { value: 'search' } });

      await waitFor(
        () => {
          expect(screen.getByText('Search Result')).toBeInTheDocument();
          expect(screen.getByText('Found this note')).toBeInTheDocument();
        },
        { timeout: 500 },
      );
    });

    it('shows "No matching notes found." when search returns no results', async () => {
      vi.mocked(TauriAPI.getAllNotes).mockResolvedValueOnce({});
      vi.mocked(TauriAPI.searchNotes).mockResolvedValueOnce([]);

      render(<NotesPanel {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(
        () => {
          expect(screen.getByText('No matching notes found.')).toBeInTheDocument();
        },
        { timeout: 500 },
      );
    });

    it('clears search results when search input is emptied', async () => {
      vi.mocked(TauriAPI.getAllNotes).mockResolvedValue({
        'C:\\Users\\Test\\file1.txt': [
          {
            id: 'note1',
            title: 'Note Title',
            content: 'Note content',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      render(<NotesPanel {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('file1.txt')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search notes...');

      // Type a query
      fireEvent.change(searchInput, { target: { value: 'something' } });

      // Clear the query
      fireEvent.change(searchInput, { target: { value: '' } });

      // Should go back to showing grouped notes
      await waitFor(
        () => {
          expect(screen.getByText('file1.txt')).toBeInTheDocument();
        },
        { timeout: 500 },
      );
    });
  });

  describe('Refresh', () => {
    it('reloads notes when refresh button is clicked', async () => {
      vi.mocked(TauriAPI.getAllNotes).mockResolvedValue({});

      render(<NotesPanel {...mockProps} />);

      await waitFor(() => {
        expect(TauriAPI.getAllNotes).toHaveBeenCalledTimes(1);
      });

      fireEvent.click(screen.getByTitle('Refresh'));

      await waitFor(() => {
        expect(TauriAPI.getAllNotes).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Close Button', () => {
    it('calls onClose when close button is clicked', () => {
      render(<NotesPanel {...mockProps} />);

      fireEvent.click(screen.getByTitle('Close panel'));

      expect(mockProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles getAllNotes failure gracefully', async () => {
      vi.mocked(TauriAPI.getAllNotes).mockRejectedValueOnce(new Error('DB error'));

      expect(() => render(<NotesPanel {...mockProps} />)).not.toThrow();
    });

    it('handles searchNotes failure gracefully', async () => {
      vi.mocked(TauriAPI.getAllNotes).mockResolvedValueOnce({});
      vi.mocked(TauriAPI.searchNotes).mockRejectedValueOnce(new Error('Search error'));

      render(<NotesPanel {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(searchInput, { target: { value: 'test' } });

      // Should not crash
      await waitFor(
        () => {
          expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
        },
        { timeout: 500 },
      );
    });

    it('renders without navigateToPath', () => {
      expect(() => render(<NotesPanel onClose={vi.fn()} />)).not.toThrow();
    });
  });
});
