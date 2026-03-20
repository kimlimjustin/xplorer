import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClipboardHistoryPanel from '@/components/panels/ClipboardHistoryPanel';
import type { ClipboardEntry } from '@/hooks/use-clipboard-history';

const mockGetHistory = vi.fn();
const mockClearHistory = vi.fn();

vi.mock('@/hooks/use-clipboard-history', () => ({
  getHistory: (...args: unknown[]) => mockGetHistory(...args),
  clearHistory: (...args: unknown[]) => mockClearHistory(...args),
}));

describe('ClipboardHistoryPanel', () => {
  const mockOnPaste = vi.fn();

  const sampleEntries: ClipboardEntry[] = [
    {
      id: 'clip-1',
      files: [{ path: 'C:\\Users\\Test\\file1.txt', name: 'file1.txt', isDir: false }],
      operation: 'copy',
      timestamp: Date.now() - 30_000, // 30 seconds ago
    },
    {
      id: 'clip-2',
      files: [
        { path: 'C:\\Users\\Test\\folder1', name: 'folder1', isDir: true },
        { path: 'C:\\Users\\Test\\file2.txt', name: 'file2.txt', isDir: false },
      ],
      operation: 'cut',
      timestamp: Date.now() - 120_000, // 2 minutes ago
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHistory.mockReturnValue([]);
  });

  describe('Empty state', () => {
    it('shows empty state when no clipboard history', () => {
      mockGetHistory.mockReturnValue([]);
      render(<ClipboardHistoryPanel onPaste={mockOnPaste} />);
      expect(screen.getByText('No clipboard history')).toBeInTheDocument();
      expect(screen.getByText('Copy or cut files to see them here')).toBeInTheDocument();
    });
  });

  describe('Rendering entries', () => {
    it('renders clipboard entries with file names', () => {
      mockGetHistory.mockReturnValue(sampleEntries);
      render(<ClipboardHistoryPanel onPaste={mockOnPaste} />);
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
      expect(screen.getByText('folder1')).toBeInTheDocument();
      expect(screen.getByText('file2.txt')).toBeInTheDocument();
    });

    it('shows entry count in header', () => {
      mockGetHistory.mockReturnValue(sampleEntries);
      render(<ClipboardHistoryPanel onPaste={mockOnPaste} />);
      expect(screen.getByText('2 entries')).toBeInTheDocument();
    });

    it('shows singular "entry" for single item', () => {
      mockGetHistory.mockReturnValue([sampleEntries[0]]);
      render(<ClipboardHistoryPanel onPaste={mockOnPaste} />);
      expect(screen.getByText('1 entry')).toBeInTheDocument();
    });

    it('renders Paste Here buttons for each entry', () => {
      mockGetHistory.mockReturnValue(sampleEntries);
      render(<ClipboardHistoryPanel onPaste={mockOnPaste} />);
      const pasteButtons = screen.getAllByText('Paste Here');
      expect(pasteButtons).toHaveLength(2);
    });

    it('shows relative timestamp (just now)', () => {
      const recentEntry: ClipboardEntry[] = [
        {
          id: 'clip-recent',
          files: [{ path: 'C:\\test.txt', name: 'test.txt', isDir: false }],
          operation: 'copy',
          timestamp: Date.now() - 10_000, // 10 seconds ago
        },
      ];
      mockGetHistory.mockReturnValue(recentEntry);
      render(<ClipboardHistoryPanel onPaste={mockOnPaste} />);
      expect(screen.getByText('just now')).toBeInTheDocument();
    });

    it('shows relative timestamp (minutes ago)', () => {
      const minutesAgoEntry: ClipboardEntry[] = [
        {
          id: 'clip-min',
          files: [{ path: 'C:\\test.txt', name: 'test.txt', isDir: false }],
          operation: 'copy',
          timestamp: Date.now() - 300_000, // 5 minutes ago
        },
      ];
      mockGetHistory.mockReturnValue(minutesAgoEntry);
      render(<ClipboardHistoryPanel onPaste={mockOnPaste} />);
      expect(screen.getByText('5m ago')).toBeInTheDocument();
    });

    it('shows "+N more" when entry has more than 3 files', () => {
      const manyFilesEntry: ClipboardEntry[] = [
        {
          id: 'clip-many',
          files: [
            { path: 'C:\\a.txt', name: 'a.txt', isDir: false },
            { path: 'C:\\b.txt', name: 'b.txt', isDir: false },
            { path: 'C:\\c.txt', name: 'c.txt', isDir: false },
            { path: 'C:\\d.txt', name: 'd.txt', isDir: false },
            { path: 'C:\\e.txt', name: 'e.txt', isDir: false },
          ],
          operation: 'copy',
          timestamp: Date.now(),
        },
      ];
      mockGetHistory.mockReturnValue(manyFilesEntry);
      render(<ClipboardHistoryPanel onPaste={mockOnPaste} />);
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });
  });

  describe('Paste from history', () => {
    it('calls onPaste with entry when Paste Here is clicked', () => {
      mockGetHistory.mockReturnValue([sampleEntries[0]]);
      render(<ClipboardHistoryPanel onPaste={mockOnPaste} />);

      fireEvent.click(screen.getByText('Paste Here'));
      expect(mockOnPaste).toHaveBeenCalledWith(sampleEntries[0]);
    });
  });

  describe('Clear all', () => {
    it('renders Clear button when entries exist', () => {
      mockGetHistory.mockReturnValue(sampleEntries);
      render(<ClipboardHistoryPanel onPaste={mockOnPaste} />);
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('calls clearHistory when Clear button is clicked', () => {
      mockGetHistory.mockReturnValue(sampleEntries);
      render(<ClipboardHistoryPanel onPaste={mockOnPaste} />);

      fireEvent.click(screen.getByText('Clear'));
      expect(mockClearHistory).toHaveBeenCalled();
    });
  });

  describe('Event listener', () => {
    it('refreshes when clipboard-history-changed event fires', () => {
      mockGetHistory.mockReturnValue([]);
      render(<ClipboardHistoryPanel onPaste={mockOnPaste} />);

      // Initially empty
      expect(screen.getByText('No clipboard history')).toBeInTheDocument();

      // Simulate clipboard change event - wrap in act since it causes state update
      mockGetHistory.mockReturnValue(sampleEntries);
      act(() => {
        window.dispatchEvent(new CustomEvent('clipboard-history-changed'));
      });

      // Should now show entries
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
    });
  });
});
