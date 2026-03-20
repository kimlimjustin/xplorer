import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NavigationBar from '@/components/explorer/NavigationBar';

// Mock lucide-react icons - use non-conflicting text in icon mocks
vi.mock('lucide-react', () => ({
  ChevronRight: () => <span data-testid="chevron-right">&gt;</span>,
  Pencil: () => <span data-testid="pencil-icon" />,
  HardDrive: () => <span data-testid="hard-drive-icon" />,
  Home: () => <span data-testid="home-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
  Cloud: () => <span data-testid="cloud-icon" />,
  Folder: () => <span data-testid="folder-icon" />,
}));

vi.mock('@/lib/constants', () => ({
  PATH_SEPARATOR: '\\',
  isWindows: true,
}));

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    getUserDirectories: vi.fn(() => Promise.resolve({ home: 'C:\\Users\\Test' })),
    readDirectory: vi.fn(() => Promise.resolve([])),
    getFileProperties: vi.fn(() => Promise.resolve({})),
  },
}));

vi.mock('@/lib/collections', () => ({
  getCollection: vi.fn(() => null),
}));

describe('NavigationBar', () => {
  const mockNavigateToPath = vi.fn();
  const mockRefetch = vi.fn();

  const defaultProps = {
    currentPath: 'C:\\Users\\Test\\Documents',
    navigateToPath: mockNavigateToPath,
    refetch: mockRefetch,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Breadcrumb rendering', () => {
    it('renders breadcrumb segments for a Windows path', () => {
      render(<NavigationBar {...defaultProps} />);

      expect(screen.getByText('C:')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    it('renders chevron separators between segments', () => {
      render(<NavigationBar {...defaultProps} />);

      const chevrons = screen.getAllByTestId('chevron-right');
      // Between 4 segments there should be 3 separators
      expect(chevrons).toHaveLength(3);
    });

    it('renders edit path button', () => {
      render(<NavigationBar {...defaultProps} />);
      expect(screen.getByLabelText('editPath')).toBeInTheDocument();
    });

    it('last segment has current location aria attribute', () => {
      render(<NavigationBar {...defaultProps} />);
      const lastSegment = screen.getByText('Documents');
      expect(lastSegment.closest('button')).toHaveAttribute('aria-current', 'location');
    });
  });

  describe('Special paths', () => {
    it('displays "Home" label for xplorer://home', () => {
      render(<NavigationBar {...defaultProps} currentPath="xplorer://home" />);
      expect(screen.getByText('home')).toBeInTheDocument();
    });

    it('displays "Trash" label for xplorer://trash', () => {
      render(<NavigationBar {...defaultProps} currentPath="xplorer://trash" />);
      expect(screen.getByText('trash')).toBeInTheDocument();
    });

    it('displays "Google Drive" label for xplorer://gdrive-manager', () => {
      render(<NavigationBar {...defaultProps} currentPath="xplorer://gdrive-manager" />);
      expect(screen.getByText('googleDrive')).toBeInTheDocument();
    });
  });

  describe('Breadcrumb navigation', () => {
    it('calls navigateToPath when clicking a breadcrumb segment', () => {
      render(<NavigationBar {...defaultProps} />);

      fireEvent.click(screen.getByText('Users'));
      expect(mockNavigateToPath).toHaveBeenCalledWith(expect.stringContaining('Users'));
    });

    it('navigates to root drive when clicking drive segment', () => {
      render(<NavigationBar {...defaultProps} />);

      fireEvent.click(screen.getByText('C:'));
      expect(mockNavigateToPath).toHaveBeenCalledWith(expect.stringContaining('C:'));
    });
  });

  describe('Path editing mode', () => {
    it('enters editing mode when clicking the edit button', () => {
      render(<NavigationBar {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('editPath'));

      const input = screen.getByLabelText('filePath');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('C:\\Users\\Test\\Documents');
    });

    it('shows placeholder text in edit mode', () => {
      render(<NavigationBar {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('editPath'));

      expect(screen.getByPlaceholderText('pathPlaceholder')).toBeInTheDocument();
    });

    it('cancels editing on Escape', () => {
      render(<NavigationBar {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('editPath'));
      const input = screen.getByLabelText('filePath');

      fireEvent.keyDown(input, { key: 'Escape' });

      // Should return to breadcrumb mode
      expect(screen.queryByLabelText('filePath')).not.toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    it('submits path on Enter', async () => {
      render(<NavigationBar {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('editPath'));
      const input = screen.getByLabelText('filePath');

      fireEvent.change(input, { target: { value: 'C:\\NewPath' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // handleSubmit is async (expandTilde), so wait for navigation
      await waitFor(() => {
        expect(mockNavigateToPath).toHaveBeenCalledWith('C:\\NewPath');
      });
    });

    it('does not navigate when submitting same path', () => {
      render(<NavigationBar {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('editPath'));
      const input = screen.getByLabelText('filePath');

      // Submit without changing the value
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockNavigateToPath).not.toHaveBeenCalled();
    });

    it('has correct ARIA attributes for autocomplete', () => {
      render(<NavigationBar {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('editPath'));
      const input = screen.getByLabelText('filePath');

      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('spellcheck', 'false');
    });
  });

  describe('Drive letter display', () => {
    it('shows hard drive icon for root drive segment', () => {
      render(<NavigationBar {...defaultProps} />);
      expect(screen.getByTestId('hard-drive-icon')).toBeInTheDocument();
    });
  });

  describe('Empty path', () => {
    it('handles empty path without crashing', () => {
      render(<NavigationBar {...defaultProps} currentPath="" />);
      // Should render the container without breadcrumbs
      const { container } = render(<NavigationBar {...defaultProps} currentPath="" />);
      expect(container).toBeInTheDocument();
    });
  });
});
