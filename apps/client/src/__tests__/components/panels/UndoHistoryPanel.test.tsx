import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UndoHistoryPanel from '@/components/panels/UndoHistoryPanel';

const mockGetUndoHistory = vi.fn();
const mockUndoOperation = vi.fn();
const mockRedoOperation = vi.fn();
const mockClearUndoHistory = vi.fn();

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    getUndoHistory: (...args: unknown[]) => mockGetUndoHistory(...args),
    undoOperation: (...args: unknown[]) => mockUndoOperation(...args),
    redoOperation: (...args: unknown[]) => mockRedoOperation(...args),
    clearUndoHistory: (...args: unknown[]) => mockClearUndoHistory(...args),
  },
}));

describe('UndoHistoryPanel', () => {
  const sampleSnapshot = {
    entries: [
      {
        index: 0,
        operation_type: 'Copy',
        description: 'Copied file.txt to backup/',
        undoable: true,
        timestamp_ms: Date.now() - 60000,
        source_path: 'C:\\src\\file.txt',
        dest_path: 'C:\\backup\\file.txt',
      },
      {
        index: 1,
        operation_type: 'Rename',
        description: 'Renamed old.txt to new.txt',
        undoable: true,
        timestamp_ms: Date.now() - 30000,
        source_path: 'C:\\src\\old.txt',
        dest_path: 'C:\\src\\new.txt',
      },
    ],
    undo_count: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockGetUndoHistory.mockResolvedValue(sampleSnapshot);
    mockUndoOperation.mockResolvedValue(undefined);
    mockRedoOperation.mockResolvedValue(undefined);
    mockClearUndoHistory.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders the panel', async () => {
      render(<UndoHistoryPanel />);

      await waitFor(() => {
        expect(mockGetUndoHistory).toHaveBeenCalled();
      });
    });

    it('shows history entries after loading', async () => {
      render(<UndoHistoryPanel />);

      await waitFor(() => {
        // The entries should display the operation descriptions
        expect(screen.getByText(/Copied file.txt/)).toBeInTheDocument();
      });
    });
  });

  describe('Undo/Redo buttons', () => {
    it('shows Undo button', async () => {
      render(<UndoHistoryPanel />);

      await waitFor(() => {
        expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeInTheDocument();
      });
    });

    it('shows Redo button', async () => {
      render(<UndoHistoryPanel />);

      await waitFor(() => {
        expect(screen.getByTitle('Redo (Ctrl+Y)')).toBeInTheDocument();
      });
    });

    it('calls undoOperation when Undo is clicked', async () => {
      render(<UndoHistoryPanel />);

      await waitFor(() => {
        expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Undo (Ctrl+Z)'));

      await waitFor(() => {
        expect(mockUndoOperation).toHaveBeenCalled();
      });
    });
  });

  describe('Empty state', () => {
    it('shows empty state when no history', async () => {
      mockGetUndoHistory.mockResolvedValue({ entries: [], undo_count: 0 });

      render(<UndoHistoryPanel />);

      await waitFor(() => {
        expect(screen.getByText('No operations in history')).toBeInTheDocument();
      });
    });
  });

  describe('Clear history', () => {
    it('shows Clear button', async () => {
      render(<UndoHistoryPanel />);

      await waitFor(() => {
        expect(screen.getByTitle('Clear all history')).toBeInTheDocument();
      });
    });

    it('calls clearUndoHistory when Clear is clicked', async () => {
      render(<UndoHistoryPanel />);

      await waitFor(() => {
        expect(screen.getByTitle('Clear all history')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Clear all history'));

      await waitFor(() => {
        expect(mockClearUndoHistory).toHaveBeenCalled();
      });
    });
  });

  describe('Loading state', () => {
    it('loads data on mount', async () => {
      render(<UndoHistoryPanel />);

      await waitFor(() => {
        expect(mockGetUndoHistory).toHaveBeenCalled();
      });
    });
  });

  describe('Error handling', () => {
    it('handles API failure gracefully', async () => {
      mockGetUndoHistory.mockRejectedValue(new Error('API Error'));

      render(<UndoHistoryPanel />);

      await waitFor(() => {
        // Should show empty state or handle error gracefully
        expect(screen.getByText('No operations in history')).toBeInTheDocument();
      });
    });
  });
});
