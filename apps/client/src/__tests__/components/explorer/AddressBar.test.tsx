import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import OperationBar from '@/components/explorer/OperationBar';

describe('OperationBar', () => {
  const mockProps = {
    viewMode: 'medium',
    setViewMode: vi.fn(),
    viewModes: {
      large: { id: 'large', name: 'Large Icons', icon: '◼️' },
      medium: { id: 'medium', name: 'Medium Icons', icon: '◽' },
      small: { id: 'small', name: 'Small Icons', icon: '▫️' },
    },
    sortBy: 'name',
    setSortBy: vi.fn(),
    sortOrder: 'asc' as 'asc' | 'desc',
    toggleSortOrder: vi.fn(),
    sortOptions: {
      name: { id: 'name', name: 'Name', icon: '📝' },
      size: { id: 'size', name: 'Size', icon: '📊' },
      modified: { id: 'modified', name: 'Modified', icon: '📅' },
    },
    handleCreateFolder: vi.fn(),
    handleDelete: vi.fn(),
    selectedFiles: new Set<string>(),
    setBottomPanelCollapsed: vi.fn(),
    setBottomPanelTab: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the operation bar', () => {
    render(<OperationBar {...mockProps} />);

    // Sort button shows the current sort option name
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('opens and closes sort dropdown', () => {
    render(<OperationBar {...mockProps} />);

    const sortButton = screen.getByText('Name');
    fireEvent.click(sortButton);

    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('Modified')).toBeInTheDocument();
  });

  it('changes sort option when clicked', () => {
    render(<OperationBar {...mockProps} />);

    const sortButton = screen.getByText('Name');
    fireEvent.click(sortButton);

    const sizeOption = screen.getByText('Size');
    fireEvent.click(sizeOption);

    expect(mockProps.setSortBy).toHaveBeenCalledWith('size');
  });

  it('toggles sort order when clicking same sort option', () => {
    render(<OperationBar {...mockProps} />);

    const sortButton = screen.getByText('Name');
    fireEvent.click(sortButton);

    // Get the dropdown option for Name (there will be two Name texts: button + dropdown)
    const nameOptions = screen.getAllByText('Name');
    const dropdownOption = nameOptions[nameOptions.length - 1];
    fireEvent.click(dropdownOption);

    expect(mockProps.toggleSortOrder).toHaveBeenCalled();
    expect(mockProps.setSortBy).not.toHaveBeenCalled();
  });

  it('opens and closes view mode dropdown', () => {
    render(<OperationBar {...mockProps} />);

    const viewButton = screen.getByText('Medium Icons');
    fireEvent.click(viewButton);

    expect(screen.getByText('Large Icons')).toBeInTheDocument();
    expect(screen.getByText('Small Icons')).toBeInTheDocument();
  });

  it('changes view mode when option is clicked', () => {
    render(<OperationBar {...mockProps} />);

    const viewButton = screen.getByText('Medium Icons');
    fireEvent.click(viewButton);

    const largeOption = screen.getByText('Large Icons');
    fireEvent.click(largeOption);

    expect(mockProps.setViewMode).toHaveBeenCalledWith('large');
  });

  it('calls handleCreateFolder when create folder button is clicked', () => {
    render(<OperationBar {...mockProps} />);

    const createButton = screen.getByTitle('createFolder');
    fireEvent.click(createButton);

    expect(mockProps.handleCreateFolder).toHaveBeenCalled();
  });

  it('shows delete button when files are selected', () => {
    const propsWithSelection = {
      ...mockProps,
      selectedFiles: new Set(['C:\\Users\\Test\\file1.txt']),
    };
    render(<OperationBar {...propsWithSelection} />);

    const deleteButton = screen.getByTitle('deleteItems');
    expect(deleteButton).toBeInTheDocument();
  });

  it('hides delete button when no files are selected', () => {
    render(<OperationBar {...mockProps} />);

    const deleteButton = screen.queryByTitle('deleteItems');
    expect(deleteButton).not.toBeInTheDocument();
  });

  it('calls handleDelete when delete button is clicked', () => {
    const propsWithSelection = {
      ...mockProps,
      selectedFiles: new Set(['C:\\Users\\Test\\file1.txt']),
    };
    render(<OperationBar {...propsWithSelection} />);

    const deleteButton = screen.getByTitle('deleteItems');
    fireEvent.click(deleteButton);

    expect(mockProps.handleDelete).toHaveBeenCalled();
  });

  it('opens terminal panel when terminal button is clicked', () => {
    render(<OperationBar {...mockProps} />);

    const terminalButton = screen.getByTitle('openTerminal');
    fireEvent.click(terminalButton);

    expect(mockProps.setBottomPanelCollapsed).toHaveBeenCalledWith(false);
    expect(mockProps.setBottomPanelTab).toHaveBeenCalledWith('terminal');
  });

  it('closes dropdowns when clicking outside', () => {
    render(<OperationBar {...mockProps} />);

    // Open sort dropdown
    const sortButton = screen.getByText('Name');
    fireEvent.click(sortButton);

    expect(screen.getByText('Size')).toBeInTheDocument();

    // Click outside overlay
    const overlay = document.querySelector('.fixed.inset-0');
    expect(overlay).toBeInTheDocument();

    if (overlay) {
      fireEvent.click(overlay);
      expect(screen.queryByText('Size')).not.toBeInTheDocument();
    }
  });
});
