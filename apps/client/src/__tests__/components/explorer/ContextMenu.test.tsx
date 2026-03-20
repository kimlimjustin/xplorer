import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu';

describe('ContextMenu', () => {
  const mockOnClose = vi.fn();

  const basicItems: ContextMenuItem[] = [
    { id: 'open', label: 'Open', action: vi.fn() },
    { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', action: vi.fn() },
    { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V', action: vi.fn() },
  ];

  const defaultProps = {
    isOpen: true,
    x: 100,
    y: 200,
    onClose: mockOnClose,
    items: basicItems,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders menu items correctly', () => {
      render(<ContextMenu {...defaultProps} />);

      expect(screen.getByText('Open')).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Paste')).toBeInTheDocument();
    });

    it('renders nothing when isOpen is false', () => {
      const { container } = render(<ContextMenu {...defaultProps} isOpen={false} />);

      expect(container.innerHTML).toBe('');
    });

    it('renders keyboard shortcuts', () => {
      render(<ContextMenu {...defaultProps} />);

      expect(screen.getByText('Ctrl+C')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+V')).toBeInTheDocument();
    });

    it('renders separators between groups', () => {
      const itemsWithSeparator: ContextMenuItem[] = [
        { id: 'open', label: 'Open', action: vi.fn() },
        { id: 'sep1', label: '', separator: true },
        { id: 'delete', label: 'Delete', action: vi.fn() },
      ];
      const { container } = render(<ContextMenu {...defaultProps} items={itemsWithSeparator} />);

      const separators = container.querySelectorAll('.border-t.border-xp-border');
      expect(separators.length).toBeGreaterThan(0);
    });

    it('hides items with visible set to false', () => {
      const itemsWithHidden: ContextMenuItem[] = [
        { id: 'open', label: 'Open', action: vi.fn() },
        { id: 'hidden', label: 'Hidden Item', action: vi.fn(), visible: false },
        { id: 'delete', label: 'Delete', action: vi.fn() },
      ];
      render(<ContextMenu {...defaultProps} items={itemsWithHidden} />);

      expect(screen.getByText('Open')).toBeInTheDocument();
      expect(screen.queryByText('Hidden Item')).not.toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('renders icons when provided', () => {
      const itemsWithIcons: ContextMenuItem[] = [
        {
          id: 'open',
          label: 'Open',
          icon: <span data-testid="icon-open">O</span>,
          action: vi.fn(),
        },
      ];
      render(<ContextMenu {...defaultProps} items={itemsWithIcons} />);

      expect(screen.getByTestId('icon-open')).toBeInTheDocument();
    });
  });

  describe('Click Interactions', () => {
    it('calls item action and onClose when item is clicked', () => {
      const action = vi.fn();
      const items: ContextMenuItem[] = [{ id: 'open', label: 'Open', action }];
      render(<ContextMenu {...defaultProps} items={items} />);

      fireEvent.click(screen.getByText('Open'));

      expect(action).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call action on disabled items', () => {
      const action = vi.fn();
      const items: ContextMenuItem[] = [
        { id: 'disabled-item', label: 'Disabled', action, disabled: true },
      ];
      render(<ContextMenu {...defaultProps} items={items} />);

      fireEvent.click(screen.getByText('Disabled'));

      expect(action).not.toHaveBeenCalled();
    });

    it('disabled items have cursor-not-allowed styling', () => {
      const items: ContextMenuItem[] = [
        { id: 'disabled-item', label: 'Disabled', action: vi.fn(), disabled: true },
      ];
      render(<ContextMenu {...defaultProps} items={items} />);

      const disabledEl = screen.getByText('Disabled').closest('div[class*="cursor"]');
      expect(disabledEl?.className).toContain('cursor-not-allowed');
    });
  });

  describe('Keyboard Navigation', () => {
    it('closes menu when Escape is pressed', () => {
      render(<ContextMenu {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not react to Escape when menu is closed', () => {
      render(<ContextMenu {...defaultProps} isOpen={false} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Click Outside', () => {
    it('closes menu when backdrop is clicked', () => {
      const { container } = render(<ContextMenu {...defaultProps} />);

      // The backdrop is the first child with class "fixed inset-0 z-40"
      const backdrop = container.querySelector('.fixed.inset-0.z-40');
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop!);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('closes menu when clicking outside via mousedown', () => {
      render(<ContextMenu {...defaultProps} />);

      fireEvent.mouseDown(document.body);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Submenu Items', () => {
    it('renders submenu arrow indicator for items with submenu', () => {
      const itemsWithSubmenu: ContextMenuItem[] = [
        {
          id: 'sort',
          label: 'Sort By',
          submenu: [
            { id: 'sort-name', label: 'Name', action: vi.fn() },
            { id: 'sort-size', label: 'Size', action: vi.fn() },
          ],
        },
      ];
      const { container } = render(<ContextMenu {...defaultProps} items={itemsWithSubmenu} />);

      expect(screen.getByText('Sort By')).toBeInTheDocument();
      // Should have an SVG arrow indicator
      const arrow = container.querySelector('svg.w-3.h-3');
      expect(arrow).toBeInTheDocument();
    });

    it('does not call onClose when clicking a submenu parent item', () => {
      const itemsWithSubmenu: ContextMenuItem[] = [
        {
          id: 'sort',
          label: 'Sort By',
          submenu: [{ id: 'sort-name', label: 'Name', action: vi.fn() }],
        },
      ];
      render(<ContextMenu {...defaultProps} items={itemsWithSubmenu} />);

      fireEvent.click(screen.getByText('Sort By'));

      // Clicking a submenu parent should not close the entire menu
      // (it should open/toggle the submenu instead)
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
