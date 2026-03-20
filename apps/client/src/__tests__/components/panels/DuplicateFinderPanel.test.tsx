import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DuplicateFinderPanel from '@/components/panels/DuplicateFinderPanel';
import { TauriAPI } from '@/lib/tauri-api';

// Mock use-toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

// Mock tauri-apps event API
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

// Extend TauriAPI mock
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    findDuplicates: vi.fn(() =>
      Promise.resolve({
        duplicate_groups: [],
        total_duplicates: 0,
        total_wasted_space: 0,
        files_scanned: 0,
        scan_time_ms: 0,
      }),
    ),
    cancelDuplicateScan: vi.fn(() => Promise.resolve()),
    moveDuplicateFilesToTrash: vi.fn(() => Promise.resolve()),
    openFile: vi.fn(() => Promise.resolve()),
  },
}));

describe('DuplicateFinderPanel', () => {
  const mockProps = {
    currentPath: 'C:\\Users\\Test\\Documents',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('renders the panel title', () => {
      render(<DuplicateFinderPanel {...mockProps} />);

      expect(screen.getByText('Duplicate Finder')).toBeInTheDocument();
    });

    it('renders the scan path input with currentPath', () => {
      render(<DuplicateFinderPanel {...mockProps} />);

      const input = screen.getByPlaceholderText('Path to scan...');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('C:\\Users\\Test\\Documents');
    });

    it('renders Scan button', () => {
      render(<DuplicateFinderPanel {...mockProps} />);

      expect(screen.getByText('Scan')).toBeInTheDocument();
    });

    it('shows initial empty state message', () => {
      render(<DuplicateFinderPanel {...mockProps} />);

      expect(screen.getByText('Configure path and click Scan')).toBeInTheDocument();
      expect(screen.getByText('to find duplicate files')).toBeInTheDocument();
    });

    it('renders min file size input', () => {
      render(<DuplicateFinderPanel {...mockProps} />);

      const minSizeInput = screen.getByDisplayValue('1024');
      expect(minSizeInput).toBeInTheDocument();
    });

    it('shows current path in header', () => {
      render(<DuplicateFinderPanel {...mockProps} />);

      expect(screen.getByTitle('C:\\Users\\Test\\Documents')).toBeInTheDocument();
    });
  });

  describe('Scan Path Input', () => {
    it('allows user to type a new path', () => {
      render(<DuplicateFinderPanel {...mockProps} />);

      const input = screen.getByPlaceholderText('Path to scan...');
      fireEvent.change(input, { target: { value: 'D:\\NewPath' } });

      expect(input).toHaveValue('D:\\NewPath');
    });

    it('updates min file size when user types', () => {
      render(<DuplicateFinderPanel {...mockProps} />);

      const minSizeInput = screen.getByDisplayValue('1024');
      fireEvent.change(minSizeInput, { target: { value: '4096' } });

      expect(minSizeInput).toHaveValue(4096);
    });
  });

  describe('Scan Behavior', () => {
    it('calls findDuplicates when Scan is clicked', async () => {
      render(<DuplicateFinderPanel {...mockProps} />);

      const scanButton = screen.getByText('Scan');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(TauriAPI.findDuplicates).toHaveBeenCalledWith('C:\\Users\\Test\\Documents', 1024);
      });
    });

    it('shows Cancel button during scanning', async () => {
      // Make findDuplicates never resolve to keep scanning state
      vi.mocked(TauriAPI.findDuplicates).mockReturnValueOnce(new Promise(() => {}));

      render(<DuplicateFinderPanel {...mockProps} />);

      const scanButton = screen.getByText('Scan');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });

    it('disables path input during scanning', async () => {
      vi.mocked(TauriAPI.findDuplicates).mockReturnValueOnce(new Promise(() => {}));

      render(<DuplicateFinderPanel {...mockProps} />);

      const scanButton = screen.getByText('Scan');
      fireEvent.click(scanButton);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Path to scan...');
        expect(input).toBeDisabled();
      });
    });
  });

  describe('Empty Results', () => {
    it('shows "No duplicates found" when scan returns empty results', async () => {
      vi.mocked(TauriAPI.findDuplicates).mockResolvedValueOnce({
        duplicate_groups: [],
        total_duplicates: 0,
        total_wasted_space: 0,
        files_scanned: 100,
        scan_time_ms: 500,
      });

      render(<DuplicateFinderPanel {...mockProps} />);

      fireEvent.click(screen.getByText('Scan'));

      await waitFor(() => {
        expect(screen.getByText('No duplicates found')).toBeInTheDocument();
        expect(screen.getByText('All files in this directory are unique')).toBeInTheDocument();
      });
    });
  });

  describe('Results Display', () => {
    const mockResultsWithDuplicates = {
      duplicate_groups: [
        {
          hash: 'abc123def456',
          size: 1024,
          total_wasted_space: 1024,
          files: [
            {
              name: 'file1.txt',
              path: 'C:\\Users\\Test\\file1.txt',
              size: 1024,
              modified: Date.now(),
            },
            {
              name: 'file1_copy.txt',
              path: 'C:\\Users\\Test\\file1_copy.txt',
              size: 1024,
              modified: Date.now(),
            },
          ],
        },
      ],
      total_duplicates: 2,
      total_wasted_space: 1024,
      files_scanned: 50,
      scan_time_ms: 250,
    };

    it('displays duplicate groups after scan', async () => {
      vi.mocked(TauriAPI.findDuplicates).mockResolvedValueOnce(mockResultsWithDuplicates);

      render(<DuplicateFinderPanel {...mockProps} />);

      fireEvent.click(screen.getByText('Scan'));

      await waitFor(() => {
        expect(screen.getByText('2 files')).toBeInTheDocument();
      });
    });

    it('displays summary row with stats', async () => {
      vi.mocked(TauriAPI.findDuplicates).mockResolvedValueOnce(mockResultsWithDuplicates);

      render(<DuplicateFinderPanel {...mockProps} />);

      fireEvent.click(screen.getByText('Scan'));

      await waitFor(() => {
        // Look for the summary text showing duplicate groups and files count
        expect(screen.getByText('2 files')).toBeInTheDocument();
        expect(screen.getByText(/duplicate group/)).toBeInTheDocument();
        expect(screen.getByText(/duplicate files/)).toBeInTheDocument();
      });
    });

    it('shows truncated hash in group header', async () => {
      vi.mocked(TauriAPI.findDuplicates).mockResolvedValueOnce(mockResultsWithDuplicates);

      render(<DuplicateFinderPanel {...mockProps} />);

      fireEvent.click(screen.getByText('Scan'));

      await waitFor(() => {
        expect(screen.getByText('abc123de...')).toBeInTheDocument();
      });
    });

    it('renders Export Report button in actions bar', async () => {
      vi.mocked(TauriAPI.findDuplicates).mockResolvedValueOnce(mockResultsWithDuplicates);

      render(<DuplicateFinderPanel {...mockProps} />);

      fireEvent.click(screen.getByText('Scan'));

      await waitFor(() => {
        expect(screen.getByText('Export Report')).toBeInTheDocument();
      });
    });

    it('expands group to show individual files when clicked', async () => {
      vi.mocked(TauriAPI.findDuplicates).mockResolvedValueOnce(mockResultsWithDuplicates);

      render(<DuplicateFinderPanel {...mockProps} />);

      fireEvent.click(screen.getByText('Scan'));

      await waitFor(() => {
        expect(screen.getByText('2 files')).toBeInTheDocument();
      });

      // Click the group header to expand
      fireEvent.click(screen.getByText('2 files'));

      await waitFor(() => {
        expect(screen.getByText('file1.txt')).toBeInTheDocument();
        expect(screen.getByText('file1_copy.txt')).toBeInTheDocument();
      });
    });

    it('marks first file as "(keep)"', async () => {
      vi.mocked(TauriAPI.findDuplicates).mockResolvedValueOnce(mockResultsWithDuplicates);

      render(<DuplicateFinderPanel {...mockProps} />);

      fireEvent.click(screen.getByText('Scan'));

      await waitFor(() => {
        expect(screen.getByText('2 files')).toBeInTheDocument();
      });

      // Expand the group
      fireEvent.click(screen.getByText('2 files'));

      await waitFor(() => {
        expect(screen.getByText('(keep)')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('renders without currentPath', () => {
      expect(() => render(<DuplicateFinderPanel />)).not.toThrow();
    });

    it('updates scan path when currentPath prop changes', () => {
      const path1 = 'C:/Users/Test';
      const path2 = 'D:/Other';
      const { rerender } = render(<DuplicateFinderPanel currentPath={path1} />);

      const input = screen.getByPlaceholderText('Path to scan...');
      expect(input).toHaveValue(path1);

      rerender(<DuplicateFinderPanel currentPath={path2} />);

      expect(input).toHaveValue(path2);
    });
  });
});
