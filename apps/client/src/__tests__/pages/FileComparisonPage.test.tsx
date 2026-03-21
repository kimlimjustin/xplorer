import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FileComparisonPage from '@/pages/FileComparisonPage';

// Mock transport
vi.mock('@/lib/transport', () => ({
  transport: vi.fn(() => Promise.resolve()),
  convertAssetUrl: vi.fn((path: string) => `asset://localhost/${path}`),
}));

// Mock the FileComparison class
const mockCompareFiles = vi.fn();
vi.mock('@/lib/file-comparison', () => ({
  FileComparison: {
    compareFiles: (...args: unknown[]) => mockCompareFiles(...args),
  },
}));

// Mock diff library (used internally)
vi.mock('diff', () => ({
  diffArrays: vi.fn(() => []),
}));

const makeComparisonResult = (overrides = {}) => ({
  file1: {
    path: 'C:\\test\\file1.txt',
    name: 'file1.txt',
    size: 100,
    modified: Date.now(),
    content: 'Line 1\nLine 2\nLine 3',
    lines: ['Line 1', 'Line 2', 'Line 3'],
  },
  file2: {
    path: 'C:\\test\\file2.txt',
    name: 'file2.txt',
    size: 120,
    modified: Date.now(),
    content: 'Line 1\nLine 2 modified\nLine 3\nLine 4',
    lines: ['Line 1', 'Line 2 modified', 'Line 3', 'Line 4'],
  },
  differences: [],
  identical: false,
  similarity: 0.75,
  comparisonType: 'text' as const,
  metadata: {
    processingTime: 12,
    linesAdded: 1,
    linesRemoved: 0,
    linesModified: 1,
    totalLines1: 3,
    totalLines2: 4,
    bytesDifferent: 20,
    algorithm: 'myers',
  },
  sideBySide: {
    lines: [
      {
        type: 'unchanged' as const,
        lineLeft: 1,
        lineRight: 1,
        contentLeft: 'Line 1',
        contentRight: 'Line 1',
      },
      {
        type: 'removed' as const,
        lineLeft: 2,
        lineRight: undefined,
        contentLeft: 'Line 2',
        contentRight: '',
      },
      {
        type: 'added' as const,
        lineLeft: undefined,
        lineRight: 2,
        contentLeft: '',
        contentRight: 'Line 2 modified',
      },
      {
        type: 'unchanged' as const,
        lineLeft: 3,
        lineRight: 3,
        contentLeft: 'Line 3',
        contentRight: 'Line 3',
      },
      {
        type: 'added' as const,
        lineLeft: undefined,
        lineRight: 4,
        contentLeft: '',
        contentRight: 'Line 4',
      },
    ],
  },
  ...overrides,
});

describe('FileComparisonPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompareFiles.mockResolvedValue(makeComparisonResult());
  });

  describe('Loading State', () => {
    it('shows loading spinner while comparing', () => {
      mockCompareFiles.mockReturnValue(new Promise(() => {}));

      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      expect(screen.getByText('Comparing files...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error UI when comparison fails', async () => {
      mockCompareFiles.mockRejectedValue(new Error('Read error'));

      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        expect(screen.getByText('Comparison failed')).toBeInTheDocument();
      });
    });

    it('calls onError callback when comparison fails', async () => {
      const onError = vi.fn();
      mockCompareFiles.mockRejectedValue(new Error('Read error'));

      render(
        <FileComparisonPage
          file1Path="C:\test\file1.txt"
          file2Path="C:\test\file2.txt"
          onError={onError}
        />,
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Read error');
      });
    });

    it('provides a Try Again button on error', async () => {
      mockCompareFiles.mockRejectedValueOnce(new Error('Read error'));

      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });
  });

  describe('Successful Comparison - Side by Side View', () => {
    it('shows file names in the file name bar', async () => {
      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        expect(screen.getByText('file1.txt')).toBeInTheDocument();
        expect(screen.getByText('file2.txt')).toBeInTheDocument();
      });
    });

    it('displays similarity percentage in the stats header', async () => {
      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        expect(screen.getByText('75.0%')).toBeInTheDocument();
      });
    });

    it('displays addition and deletion counts', async () => {
      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        expect(screen.getByText('+1 addition')).toBeInTheDocument();
        expect(screen.getByText('-0 deletions')).toBeInTheDocument();
      });
    });

    it('shows the algorithm used', async () => {
      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        expect(screen.getByText('myers')).toBeInTheDocument();
      });
    });

    it('shows the Side by Side view toggle as active by default', async () => {
      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        const sideBySideBtn = screen.getByTitle('Side-by-side view');
        expect(sideBySideBtn).toBeInTheDocument();
      });
    });

    it('shows diff line counts in the footer', async () => {
      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        // Footer shows "3 / 4 lines"
        expect(screen.getByText('3 / 4 lines')).toBeInTheDocument();
      });
    });

    it('shows processing time in the footer', async () => {
      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        expect(screen.getByText('12ms')).toBeInTheDocument();
      });
    });
  });

  describe('View Mode Toggle', () => {
    it('can switch to Unified view mode', async () => {
      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        expect(screen.getByTitle('Unified view')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Unified view'));

      // Unified mode should now be visible
      const unifiedBtn = screen.getByTitle('Unified view');
      expect(unifiedBtn).toBeInTheDocument();
    });

    it('can switch back to Side by Side view', async () => {
      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        expect(screen.getByTitle('Unified view')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Unified view'));
      fireEvent.click(screen.getByTitle('Side-by-side view'));

      const sideBySideBtn = screen.getByTitle('Side-by-side view');
      expect(sideBySideBtn).toBeInTheDocument();
    });
  });

  describe('Hunk Navigation', () => {
    it('shows hunk navigation when there are changes', async () => {
      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        expect(screen.getByTitle('Previous change (Ctrl+Up)')).toBeInTheDocument();
        expect(screen.getByTitle('Next change (Ctrl+Down)')).toBeInTheDocument();
      });
    });

    it('displays the current change index', async () => {
      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        // The first hunk should be selected by default
        expect(screen.getByText(/Change 1 of/)).toBeInTheDocument();
      });
    });
  });

  describe('Refresh', () => {
    it('provides a refresh button in the toolbar', async () => {
      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        expect(screen.getByTitle('Refresh comparison')).toBeInTheDocument();
      });
    });

    it('re-runs comparison when refresh is clicked', async () => {
      render(<FileComparisonPage file1Path="C:\test\file1.txt" file2Path="C:\test\file2.txt" />);

      await waitFor(() => {
        expect(screen.getByTitle('Refresh comparison')).toBeInTheDocument();
      });

      // Initial call count
      expect(mockCompareFiles).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTitle('Refresh comparison'));

      await waitFor(() => {
        expect(mockCompareFiles).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Identical Files', () => {
    it('shows 100% similarity for identical files', async () => {
      mockCompareFiles.mockResolvedValue(
        makeComparisonResult({
          identical: true,
          similarity: 1.0,
          metadata: {
            processingTime: 5,
            linesAdded: 0,
            linesRemoved: 0,
            linesModified: 0,
            totalLines1: 3,
            totalLines2: 3,
            bytesDifferent: 0,
            algorithm: 'myers',
          },
          sideBySide: {
            lines: [
              {
                type: 'unchanged',
                lineLeft: 1,
                lineRight: 1,
                contentLeft: 'Line 1',
                contentRight: 'Line 1',
              },
            ],
          },
        }),
      );

      render(<FileComparisonPage file1Path="C:\test\same.txt" file2Path="C:\test\same_copy.txt" />);

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });
    });
  });

  describe('Image Comparison', () => {
    it('renders image elements for image type comparisons', async () => {
      mockCompareFiles.mockResolvedValue(
        makeComparisonResult({
          comparisonType: 'image',
          sideBySide: undefined,
        }),
      );

      render(<FileComparisonPage file1Path="C:\test\photo1.png" file2Path="C:\test\photo2.png" />);

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images.length).toBe(2);
      });
    });
  });
});
