import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VersionHistoryDialog from '@/components/dialogs/VersionHistoryDialog';

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockListVersions = vi.fn();
const mockCreateVersion = vi.fn();
const mockRestoreVersion = vi.fn();
const mockDeleteVersion = vi.fn();
const mockDeleteAllVersions = vi.fn();
const mockReadVersionContent = vi.fn();

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    listVersions: (...args: unknown[]) => mockListVersions(...args),
    createVersion: (...args: unknown[]) => mockCreateVersion(...args),
    restoreVersion: (...args: unknown[]) => mockRestoreVersion(...args),
    deleteVersion: (...args: unknown[]) => mockDeleteVersion(...args),
    deleteAllVersions: (...args: unknown[]) => mockDeleteAllVersions(...args),
    readVersionContent: (...args: unknown[]) => mockReadVersionContent(...args),
  },
  FileVersion: {},
}));

vi.mock('@/lib/utils', () => ({
  formatFileSize: vi.fn((bytes: number) => `${bytes} B`),
}));

describe('VersionHistoryDialog', () => {
  const sampleVersions = [
    { version_number: 1, timestamp: '20260315_120000', size: 1024 },
    { version_number: 2, timestamp: '20260316_140000', size: 2048 },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    filePath: 'C:\\Users\\Test\\notes.txt',
    onRefetch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockListVersions.mockResolvedValue(sampleVersions);
    mockCreateVersion.mockResolvedValue(undefined);
    mockRestoreVersion.mockResolvedValue(undefined);
    mockDeleteVersion.mockResolvedValue(undefined);
    mockDeleteAllVersions.mockResolvedValue(2);
    mockReadVersionContent.mockResolvedValue('Hello World content');
  });

  describe('Visibility', () => {
    it('returns null when not open', () => {
      const { container } = render(<VersionHistoryDialog {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders when open', async () => {
      render(<VersionHistoryDialog {...defaultProps} />);
      expect(screen.getByText('Version History')).toBeInTheDocument();
    });
  });

  describe('Header display', () => {
    it('shows file name in header', () => {
      render(<VersionHistoryDialog {...defaultProps} />);
      expect(screen.getByText('notes.txt')).toBeInTheDocument();
    });
  });

  describe('Version list', () => {
    it('loads and displays versions', async () => {
      render(<VersionHistoryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Version 1')).toBeInTheDocument();
        expect(screen.getByText('Version 2')).toBeInTheDocument();
      });
    });

    it('shows version count', async () => {
      render(<VersionHistoryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('2 versions')).toBeInTheDocument();
      });
    });

    it('shows formatted timestamps', async () => {
      render(<VersionHistoryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('2026-03-15 12:00:00')).toBeInTheDocument();
        expect(screen.getByText('2026-03-16 14:00:00')).toBeInTheDocument();
      });
    });
  });

  describe('Empty state', () => {
    it('shows empty state when no versions', async () => {
      mockListVersions.mockResolvedValue([]);

      render(<VersionHistoryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No versions saved yet')).toBeInTheDocument();
      });
    });

    it('shows instruction text in empty state', async () => {
      mockListVersions.mockResolvedValue([]);

      render(<VersionHistoryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Click "Create Snapshot" to save the current state/),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Create snapshot', () => {
    it('has Create Snapshot button', () => {
      render(<VersionHistoryDialog {...defaultProps} />);
      expect(screen.getByText('Create Snapshot')).toBeInTheDocument();
    });

    it('creates a version when clicking Create Snapshot', async () => {
      render(<VersionHistoryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Version 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Snapshot'));

      await waitFor(() => {
        expect(mockCreateVersion).toHaveBeenCalledWith('C:\\Users\\Test\\notes.txt');
      });
    });

    it('shows success toast after creating version', async () => {
      render(<VersionHistoryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Version 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Snapshot'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Version created' }),
        );
      });
    });
  });

  describe('Delete All', () => {
    it('shows Delete All button when versions exist', async () => {
      render(<VersionHistoryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Delete All')).toBeInTheDocument();
      });
    });

    it('does not show Delete All when no versions', async () => {
      mockListVersions.mockResolvedValue([]);

      render(<VersionHistoryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Delete All')).not.toBeInTheDocument();
      });
    });

    it('deletes all versions when clicked', async () => {
      render(<VersionHistoryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Delete All')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Delete All'));

      await waitFor(() => {
        expect(mockDeleteAllVersions).toHaveBeenCalledWith('C:\\Users\\Test\\notes.txt');
      });
    });
  });

  describe('Error state', () => {
    it('shows error message on load failure', async () => {
      mockListVersions.mockRejectedValue(new Error('Load failed'));

      render(<VersionHistoryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Load failed')).toBeInTheDocument();
      });
    });

    it('shows Try again link on error', async () => {
      mockListVersions.mockRejectedValue(new Error('Load failed'));

      render(<VersionHistoryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Try again')).toBeInTheDocument();
      });
    });
  });

  describe('Close button', () => {
    it('calls onClose when Close footer button is clicked', () => {
      render(<VersionHistoryDialog {...defaultProps} />);
      // There is a "Close" button in the footer
      fireEvent.click(screen.getByText('Close'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });
});
