import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkspaceLayoutDialog from '@/components/dialogs/WorkspaceLayoutDialog';
import type { SplitLayoutState } from '@/types/split-view';

const mockGetLayouts = vi.fn();
const mockSaveLayout = vi.fn();
const mockDeleteLayout = vi.fn();
const mockRenameLayout = vi.fn();
const mockCountTabs = vi.fn();
const mockGetDefaultLayout = vi.fn();

vi.mock('@/lib/workspace-layouts', () => ({
  getLayouts: (...args: unknown[]) => mockGetLayouts(...args),
  saveLayout: (...args: unknown[]) => mockSaveLayout(...args),
  deleteLayout: (...args: unknown[]) => mockDeleteLayout(...args),
  renameLayout: (...args: unknown[]) => mockRenameLayout(...args),
  countTabs: (...args: unknown[]) => mockCountTabs(...args),
  getDefaultLayout: (...args: unknown[]) => mockGetDefaultLayout(...args),
}));

vi.mock('@/types/split-view', () => ({
  createDefaultLayout: vi.fn(() => ({
    groups: { g1: { tabs: [], activeTab: null } },
    tree: { type: 'leaf', groupId: 'g1' },
    activeGroupId: 'g1',
  })),
}));

describe('WorkspaceLayoutDialog', () => {
  const mockLayout: SplitLayoutState = {
    groups: {
      g1: { tabs: [{ id: 't1', path: '/test', title: 'Test' }], activeTab: 't1' },
    },
    tree: { type: 'leaf', groupId: 'g1' },
    activeGroupId: 'g1',
  } as Record<string, unknown>;

  const mockUiState = {
    viewMode: 'medium',
    theme: 'glass',
    leftSidebarCollapsed: false,
    rightSidebarCollapsed: false,
    bottomPanelCollapsed: true,
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    currentLayout: mockLayout,
    currentUiState: mockUiState,
    onApplyLayout: vi.fn(),
  };

  const sampleLayouts = [
    {
      id: 'wl-1',
      name: 'Work Layout',
      created: Date.now() - 60000,
      layout: mockLayout,
      uiState: mockUiState,
    },
    {
      id: 'wl-2',
      name: 'Reading Layout',
      created: Date.now() - 120000,
      layout: mockLayout,
      uiState: mockUiState,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLayouts.mockReturnValue(sampleLayouts);
    mockCountTabs.mockReturnValue(3);
    mockGetDefaultLayout.mockReturnValue(mockLayout);
    mockSaveLayout.mockReturnValue(undefined);
    mockDeleteLayout.mockReturnValue(true);
    mockRenameLayout.mockReturnValue(true);
  });

  describe('Visibility', () => {
    it('returns null when not open', () => {
      const { container } = render(<WorkspaceLayoutDialog {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders when open', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      expect(screen.getByText('Workspace Layouts')).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('shows title', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      expect(screen.getByText('Workspace Layouts')).toBeInTheDocument();
    });

    it('shows layout count badge', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      expect(screen.getByText('2 / 10')).toBeInTheDocument();
    });

    it('shows close button', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Close'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Layout list', () => {
    it('shows saved layout names', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      expect(screen.getByText('Work Layout')).toBeInTheDocument();
      expect(screen.getByText('Reading Layout')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows empty state when no layouts saved', () => {
      mockGetLayouts.mockReturnValue([]);
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      expect(screen.getByText(/No saved layouts yet/)).toBeInTheDocument();
    });
  });

  describe('Save Current', () => {
    it('shows Save Current button', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      expect(screen.getByText('Save Current')).toBeInTheDocument();
    });

    it('shows save input when Save Current is clicked', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      fireEvent.click(screen.getByText('Save Current'));
      expect(screen.getByPlaceholderText('Layout name...')).toBeInTheDocument();
    });

    it('saves layout when name is entered and submitted', async () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('Save Current'));

      const input = screen.getByPlaceholderText('Layout name...');
      fireEvent.change(input, { target: { value: 'My New Layout' } });

      // Submit the form
      fireEvent.click(screen.getByText('Save'));

      expect(mockSaveLayout).toHaveBeenCalledWith('My New Layout', mockLayout, mockUiState);
    });

    it('shows Cancel button in save mode', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      fireEvent.click(screen.getByText('Save Current'));
      // There should now be a Cancel button alongside the Save button in toolbar
      const cancelBtns = screen.getAllByText('Cancel');
      expect(cancelBtns.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Default Layout', () => {
    it('shows Default Layout button', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      expect(screen.getByText('Default Layout')).toBeInTheDocument();
    });

    it('calls onApplyLayout and onClose when Default Layout is clicked', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      fireEvent.click(screen.getByText('Default Layout'));

      expect(defaultProps.onApplyLayout).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Delete layout', () => {
    it('shows delete button for each layout on hover', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      // Buttons are hidden by opacity, but they exist in the DOM
      const deleteBtns = screen.getAllByTitle('Delete');
      expect(deleteBtns.length).toBe(2);
    });

    it('calls deleteLayout when delete button is clicked', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      const deleteBtns = screen.getAllByTitle('Delete');
      fireEvent.click(deleteBtns[0]);

      expect(mockDeleteLayout).toHaveBeenCalledWith('wl-1');
    });
  });

  describe('Footer', () => {
    it('shows Esc key hint', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      expect(screen.getByText('Esc')).toBeInTheDocument();
    });

    it('shows toggle shortcut hint', () => {
      render(<WorkspaceLayoutDialog {...defaultProps} />);
      expect(screen.getByText('Ctrl+Shift+L to toggle')).toBeInTheDocument();
    });
  });
});
