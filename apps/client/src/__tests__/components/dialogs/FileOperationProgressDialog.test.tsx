import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import FileOperationProgressDialog from '@/components/dialogs/FileOperationProgressDialog';
import { TauriAPI, type FileOperationProgress } from '@/lib/tauri-api';

// Capture the callback passed to listenToFileOperationProgress
let progressCallback: ((progress: FileOperationProgress) => void) | null = null;

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    listenToFileOperationProgress: vi.fn((cb) => {
      progressCallback = cb;
      return Promise.resolve(() => {
        progressCallback = null;
      });
    }),
  },
  FileOperationProgress: {},
}));

describe('FileOperationProgressDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    progressCallback = null;
    // Re-establish the default mock that captures the callback
    vi.mocked(TauriAPI.listenToFileOperationProgress).mockImplementation((cb) => {
      progressCallback = cb;
      return Promise.resolve(() => {
        progressCallback = null;
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeProgress = (overrides: Partial<FileOperationProgress> = {}): FileOperationProgress =>
    ({
      operation_id: 'op-1',
      operation_type: 'Copy',
      status: 'InProgress',
      progress_percentage: 50,
      current_file: 'C:\\Users\\Test\\file.txt',
      source_path: 'C:\\Users\\Test\\file.txt',
      total_files: 10,
      files_processed: 5,
      total_bytes: 10240,
      speed_bytes_per_second: 1024,
      estimated_remaining_seconds: 5,
      error_message: null,
      ...overrides,
    }) as FileOperationProgress;

  describe('Initial State', () => {
    it('renders nothing when there are no operations', async () => {
      const { container } = render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(container.firstChild).toBeNull();
    });

    it('subscribes to file operation progress on mount', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(TauriAPI.listenToFileOperationProgress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Active Operation Display', () => {
    it('shows operation when progress event is received', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(makeProgress());
      });

      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('displays the current file name', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            current_file: 'C:\\Users\\Test\\Documents\\report.pdf',
          }),
        );
      });

      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    it('displays progress percentage', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            progress_percentage: 75,
          }),
        );
      });

      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('displays file count for multi-file operations', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            files_processed: 3,
            total_files: 10,
          }),
        );
      });

      expect(screen.getByText(/3\/10 files/)).toBeInTheDocument();
    });

    it('does not show file count for single-file operations', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            total_files: 1,
            files_processed: 0,
          }),
        );
      });

      expect(screen.queryByText(/files/)).not.toBeInTheDocument();
    });

    it('shows operation type in header', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            operation_type: 'Move',
          }),
        );
      });

      expect(screen.getByText('Move')).toBeInTheDocument();
    });
  });

  describe('Completed Operations', () => {
    it('shows Done for completed operations', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            status: 'Completed',
            progress_percentage: 100,
          }),
        );
      });

      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('auto-dismisses completed operations after 4 seconds', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            status: 'Completed',
            progress_percentage: 100,
          }),
        );
      });

      expect(screen.getByText('Done')).toBeInTheDocument();

      // Advance past the 4s auto-dismiss
      await act(async () => {
        vi.advanceTimersByTime(4500);
      });

      expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });

    it('shows total bytes for completed operations', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            status: 'Completed',
            total_bytes: 5000,
          }),
        );
      });

      // formatFileSize is mocked as `${bytes} B`
      expect(screen.getByText('5000 B')).toBeInTheDocument();
    });
  });

  describe('Failed Operations', () => {
    it('shows error message for failed operations', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            status: 'Failed',
            error_message: 'Permission denied',
          }),
        );
      });

      expect(screen.getByText('Permission denied')).toBeInTheDocument();
    });

    it('shows generic "Failed" when no error message', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            status: 'Failed',
            error_message: null,
          }),
        );
      });

      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('auto-dismisses failed operations after 4 seconds', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            status: 'Failed',
            error_message: 'Error occurred',
          }),
        );
      });

      expect(screen.getByText('Error occurred')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(4500);
      });

      expect(screen.queryByText('Error occurred')).not.toBeInTheDocument();
    });
  });

  describe('Dismiss Button', () => {
    it('dismisses an operation when close button is clicked', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(makeProgress());
      });

      expect(screen.getByText('Copy')).toBeInTheDocument();

      // Find and click the dismiss button (the X icon button)
      const dismissButton = screen
        .getByText('Copy')
        .closest('.bg-xp-surface')
        ?.querySelector('button');
      expect(dismissButton).not.toBeNull();

      await act(async () => {
        fireEvent.click(dismissButton!);
      });

      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });
  });

  describe('Multiple Operations', () => {
    it('shows multiple operations simultaneously', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            operation_id: 'op-1',
            operation_type: 'Copy',
            current_file: 'C:\\file1.txt',
          }),
        );
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            operation_id: 'op-2',
            operation_type: 'Move',
            current_file: 'C:\\file2.txt',
          }),
        );
      });

      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Move')).toBeInTheDocument();
    });

    it('updates an existing operation by operation_id', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            operation_id: 'op-1',
            progress_percentage: 25,
          }),
        );
      });

      expect(screen.getByText(/25%/)).toBeInTheDocument();

      await act(async () => {
        progressCallback?.(
          makeProgress({
            operation_id: 'op-1',
            progress_percentage: 75,
          }),
        );
      });

      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.queryByText(/25%/)).not.toBeInTheDocument();
    });
  });

  describe('Fallback File Name', () => {
    it('uses source_path when current_file is not set', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            current_file: undefined as unknown,
            source_path: 'C:\\Users\\backup.zip',
          }),
        );
      });

      expect(screen.getByText('backup.zip')).toBeInTheDocument();
    });

    it('shows "Unknown" when no file paths are available', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            current_file: undefined as unknown,
            source_path: undefined as unknown,
          }),
        );
      });

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('unsubscribes from events on unmount', async () => {
      const unlisten = vi.fn();
      vi.mocked(TauriAPI.listenToFileOperationProgress).mockResolvedValue(unlisten);

      const { unmount } = render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      unmount();

      expect(unlisten).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles progress_percentage of 0', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            status: 'Starting',
            progress_percentage: 0,
          }),
        );
      });

      expect(screen.getByText(/0%/)).toBeInTheDocument();
    });

    it('handles progress_percentage exceeding 100', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            progress_percentage: 150,
          }),
        );
      });

      // Should clamp to 100% in the progress bar style (but text may show raw value)
      // The component shows Math.round(op.progress_percentage || 0) as text
      // and Math.min(100, op.progress_percentage || 0) for bar width
      expect(screen.getByText(/150%/)).toBeInTheDocument();
    });

    it('handles null operation_type gracefully', async () => {
      render(<FileOperationProgressDialog />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        progressCallback?.(
          makeProgress({
            operation_type: undefined as unknown,
          }),
        );
      });

      expect(screen.getByText('File Operation')).toBeInTheDocument();
    });
  });
});
