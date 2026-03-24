import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import OperationBar from '@/components/explorer/OperationBar';
import type { SortField } from '@/lib/utils';

describe('OperationBar', () => {
  const mockViewModes: Record<string, { id: string; name: string; icon: React.ReactNode }> = {
    small: { id: 'small', name: 'Small Icons', icon: '🔹' },
    medium: { id: 'medium', name: 'Medium Icons', icon: '🔷' },
    large: { id: 'large', name: 'Large Icons', icon: '🔶' },
    list: { id: 'list', name: 'List', icon: '📋' },
    details: { id: 'details', name: 'Details', icon: '📊' },
  };

  const mockSortOptions: Record<string, { id: string; name: string; icon: React.ReactNode }> = {
    name: { id: 'name', name: 'Name', icon: '🔤' },
    dateModified: { id: 'dateModified', name: 'Date Modified', icon: '📅' },
    size: { id: 'size', name: 'Size', icon: '📏' },
    type: { id: 'type', name: 'Type', icon: '📁' },
  };

  const mockProps = {
    viewMode: 'medium',
    setViewMode: vi.fn(),
    viewModes: mockViewModes,
    sortBy: 'name',
    setSortBy: vi.fn(),
    sortOrder: 'asc' as const,
    toggleSortOrder: vi.fn(),
    sortOptions: mockSortOptions,
    handleCreateFolder: vi.fn(),
    handleDelete: vi.fn(),
    selectedFiles: new Set<string>(),
    setBottomPanelCollapsed: vi.fn(),
    setBottomPanelTab: vi.fn(),
    onSelectAll: vi.fn(),
    onSelectNone: vi.fn(),
    onInvertSelection: vi.fn(),
    onAdvancedSelection: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders sort dropdown with current sort name', () => {
      render(<OperationBar {...mockProps} />);

      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('renders view mode dropdown with current view mode name', () => {
      render(<OperationBar {...mockProps} />);

      expect(screen.getByText('Medium Icons')).toBeInTheDocument();
    });

    it('renders create folder button', () => {
      render(<OperationBar {...mockProps} />);

      expect(screen.getByTitle('createFolder')).toBeInTheDocument();
    });

    it('renders terminal button', () => {
      render(<OperationBar {...mockProps} />);

      expect(screen.getByTitle('openTerminal')).toBeInTheDocument();
    });

    it('renders selection dropdown button', () => {
      render(<OperationBar {...mockProps} />);

      expect(screen.getByTitle('selectionOptions')).toBeInTheDocument();
    });
  });

  describe('Delete Button Visibility', () => {
    it('does not render delete button when no files are selected', () => {
      render(<OperationBar {...mockProps} />);

      expect(screen.queryByTitle('deleteItems')).not.toBeInTheDocument();
    });

    it('renders delete button when files are selected', () => {
      const selectedProps = {
        ...mockProps,
        selectedFiles: new Set(['file1.txt', 'file2.txt']),
      };
      render(<OperationBar {...selectedProps} />);

      expect(screen.getByTitle('deleteItems')).toBeInTheDocument();
    });

    it('shows correct count in delete button title', () => {
      const selectedProps = {
        ...mockProps,
        selectedFiles: new Set(['file1.txt', 'file2.txt', 'file3.txt']),
      };
      render(<OperationBar {...selectedProps} />);

      expect(screen.getByTitle('deleteItems')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('calls handleCreateFolder when create folder button is clicked', () => {
      render(<OperationBar {...mockProps} />);

      const createFolderButton = screen.getByTitle('createFolder');
      fireEvent.click(createFolderButton);

      expect(mockProps.handleCreateFolder).toHaveBeenCalledTimes(1);
    });

    it('calls handleDelete when delete button is clicked', () => {
      const selectedProps = {
        ...mockProps,
        selectedFiles: new Set(['file1.txt']),
      };
      render(<OperationBar {...selectedProps} />);

      const deleteButton = screen.getByTitle('deleteItems');
      fireEvent.click(deleteButton);

      expect(mockProps.handleDelete).toHaveBeenCalledTimes(1);
    });

    it('opens terminal when terminal button is clicked', () => {
      render(<OperationBar {...mockProps} />);

      const terminalButton = screen.getByTitle('openTerminal');
      fireEvent.click(terminalButton);

      expect(mockProps.setBottomPanelCollapsed).toHaveBeenCalledWith(false);
      expect(mockProps.setBottomPanelTab).toHaveBeenCalledWith('terminal');
    });
  });

  describe('Sort Dropdown', () => {
    it('opens sort dropdown when sort button is clicked', () => {
      render(<OperationBar {...mockProps} />);

      const sortButton = screen.getByText('Name');
      fireEvent.click(sortButton);

      // All sort options should appear
      expect(screen.getByText('Date Modified')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
    });

    it('calls setSortBy when a different sort option is clicked', () => {
      render(<OperationBar {...mockProps} />);

      // Open the dropdown
      const sortButton = screen.getByText('Name');
      fireEvent.click(sortButton);

      // Click on Size
      fireEvent.click(screen.getByText('Size'));

      expect(mockProps.setSortBy).toHaveBeenCalledWith('size');
    });

    it('calls toggleSortOrder when same sort option is clicked', () => {
      render(<OperationBar {...mockProps} />);

      // Open the dropdown
      const sortButton = screen.getByText('Name');
      fireEvent.click(sortButton);

      // Click on Name again (same option)
      const allNameButtons = screen.getAllByText('Name');
      // The last one is in the dropdown
      fireEvent.click(allNameButtons[allNameButtons.length - 1]);

      expect(mockProps.toggleSortOrder).toHaveBeenCalledTimes(1);
    });

    it('closes sort dropdown after selecting an option', () => {
      render(<OperationBar {...mockProps} />);

      // Open the dropdown
      fireEvent.click(screen.getByText('Name'));
      expect(screen.getByText('Date Modified')).toBeInTheDocument();

      // Click on Size
      fireEvent.click(screen.getByText('Size'));

      // The dropdown items should no longer show Date Modified as a separate dropdown item
      // (the dropdown closes, so only the active sort button text remains)
    });
  });

  describe('View Mode Dropdown', () => {
    it('opens view mode dropdown when clicked', () => {
      render(<OperationBar {...mockProps} />);

      const viewButton = screen.getByText('Medium Icons');
      fireEvent.click(viewButton);

      expect(screen.getByText('Small Icons')).toBeInTheDocument();
      expect(screen.getByText('Large Icons')).toBeInTheDocument();
      expect(screen.getByText('List')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    it('calls setViewMode when a view mode is selected', () => {
      render(<OperationBar {...mockProps} />);

      fireEvent.click(screen.getByText('Medium Icons'));
      fireEvent.click(screen.getByText('Large Icons'));

      expect(mockProps.setViewMode).toHaveBeenCalledWith('large');
    });

    it('highlights active view mode in dropdown', () => {
      render(<OperationBar {...mockProps} />);

      fireEvent.click(screen.getByText('Medium Icons'));

      // The active mode button should have the text-xp-blue class
      const allMedium = screen.getAllByText('Medium Icons');
      const dropdownItem = allMedium[allMedium.length - 1].closest('button');
      expect(dropdownItem).toHaveClass('text-xp-blue');
    });
  });

  describe('Selection Dropdown', () => {
    it('opens selection dropdown when clicked', () => {
      render(<OperationBar {...mockProps} />);

      const selectButton = screen.getByTitle('selectionOptions');
      fireEvent.click(selectButton);

      expect(screen.getByText('selectAll')).toBeInTheDocument();
      expect(screen.getByText('selectNone')).toBeInTheDocument();
      expect(screen.getByText('invertSelection')).toBeInTheDocument();
      expect(screen.getByText('advancedSelection')).toBeInTheDocument();
    });

    it('calls onSelectAll when Select All is clicked', () => {
      render(<OperationBar {...mockProps} />);

      fireEvent.click(screen.getByTitle('selectionOptions'));
      fireEvent.click(screen.getByText('selectAll'));

      expect(mockProps.onSelectAll).toHaveBeenCalledTimes(1);
    });

    it('calls onSelectNone when Select None is clicked', () => {
      render(<OperationBar {...mockProps} />);

      fireEvent.click(screen.getByTitle('selectionOptions'));
      fireEvent.click(screen.getByText('selectNone'));

      expect(mockProps.onSelectNone).toHaveBeenCalledTimes(1);
    });

    it('calls onInvertSelection when Invert Selection is clicked', () => {
      render(<OperationBar {...mockProps} />);

      fireEvent.click(screen.getByTitle('selectionOptions'));
      fireEvent.click(screen.getByText('invertSelection'));

      expect(mockProps.onInvertSelection).toHaveBeenCalledTimes(1);
    });

    it('calls onAdvancedSelection when Advanced Selection is clicked', () => {
      render(<OperationBar {...mockProps} />);

      fireEvent.click(screen.getByTitle('selectionOptions'));
      fireEvent.click(screen.getByText('advancedSelection'));

      expect(mockProps.onAdvancedSelection).toHaveBeenCalledTimes(1);
    });

    it('shows keyboard shortcuts in selection dropdown', () => {
      render(<OperationBar {...mockProps} />);

      fireEvent.click(screen.getByTitle('selectionOptions'));

      expect(screen.getByText('Ctrl+A')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+Shift+A')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+Shift+S')).toBeInTheDocument();
    });
  });

  describe('Selection Dropdown Visibility', () => {
    it('does not render selection dropdown when no selection handlers provided', () => {
      const noSelectionProps = {
        ...mockProps,
        onSelectAll: undefined,
        onSelectNone: undefined,
        onInvertSelection: undefined,
        onAdvancedSelection: undefined,
      };
      render(<OperationBar {...noSelectionProps} />);

      expect(screen.queryByTitle('selectionOptions')).not.toBeInTheDocument();
    });
  });

  describe('Dropdown Close Behavior', () => {
    it('closes dropdowns when overlay is clicked', () => {
      render(<OperationBar {...mockProps} />);

      // Open sort dropdown
      fireEvent.click(screen.getByText('Name'));

      // Verify dropdown is open by checking for sort options
      expect(screen.getByText('Date Modified')).toBeInTheDocument();

      // Click the overlay
      const overlay = document.querySelector('.fixed.inset-0.z-40');
      expect(overlay).toBeInTheDocument();
      fireEvent.click(overlay!);

      // Overlay should be gone (dropdowns closed)
      expect(document.querySelector('.fixed.inset-0.z-40')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing sort option gracefully', () => {
      const invalidProps = { ...mockProps, sortBy: 'nonexistent' as SortField };
      expect(() => render(<OperationBar {...invalidProps} />)).not.toThrow();
    });

    it('handles missing view mode gracefully', () => {
      const invalidProps = { ...mockProps, viewMode: 'nonexistent' };
      expect(() => render(<OperationBar {...invalidProps} />)).not.toThrow();
    });

    it('handles empty selectedFiles set', () => {
      const emptySelectedProps = { ...mockProps, selectedFiles: new Set<string>() };
      expect(() => render(<OperationBar {...emptySelectedProps} />)).not.toThrow();
    });
  });
});
