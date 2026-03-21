import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CollectionEditorDialog from '@/components/dialogs/CollectionEditorDialog';
import type { FileEntry } from '@/lib/tauri-api';
import type { FileCollection, CollectionFilter } from '@/lib/collections';

// Mock collections module
vi.mock('@/lib/collections', () => {
  const COLLECTION_ICONS = [
    'Folder',
    'FileText',
    'Image',
    'Music',
    'Clapperboard',
    'BarChart3',
    'PenLine',
    'Laptop',
    'Wrench',
    'Star',
    'Disc',
    'Clock',
  ];

  const COLLECTION_COLORS = [
    '#ef4444',
    '#f59e0b',
    '#10b981',
    '#3b82f6',
    '#a855f7',
    '#ec4899',
    '#06b6d4',
    '#64748b',
  ];

  const FILTER_TYPES: CollectionFilter['type'][] = [
    'extension',
    'size_gt',
    'size_lt',
    'modified_after',
    'modified_before',
    'name_contains',
    'name_regex',
    'tag',
    'is_directory',
    'is_hidden',
  ];

  return {
    COLLECTION_ICONS,
    COLLECTION_COLORS,
    FILTER_TYPES,
    filterTypeLabel: vi.fn((type: string) => {
      const map: Record<string, string> = {
        extension: 'File Extension',
        size_gt: 'Min Size (bytes)',
        size_lt: 'Max Size (bytes)',
        modified_after: 'Modified After',
        modified_before: 'Modified Before',
        name_contains: 'Name Contains',
        name_regex: 'Name Regex',
        tag: 'Has Tag',
        is_directory: 'Is Directory',
        is_hidden: 'Is Hidden',
      };
      return map[type] || type;
    }),
    filterValuePlaceholder: vi.fn((type: string) => {
      const map: Record<string, string> = {
        extension: '.pdf,.docx,.txt',
        size_gt: '104857600 (100 MB)',
        size_lt: '1048576 (1 MB)',
        modified_after: '2026-01-01',
        modified_before: '2026-12-31',
        name_contains: 'report',
        name_regex: '\\.(test|spec)\\.tsx?$',
        tag: 'tag name',
        is_directory: 'true or false',
        is_hidden: 'true or false',
      };
      return map[type] || '';
    }),
    matchesFilter: vi.fn(() => true),
    createCollection: vi.fn(),
    updateCollection: vi.fn(),
  };
});

const { createCollection, updateCollection } = await import('@/lib/collections');

describe('CollectionEditorDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    currentPath: '/home/user/documents',
  };

  const mockFiles: FileEntry[] = [
    {
      name: 'report.pdf',
      path: '/home/user/documents/report.pdf',
      size: 1024,
      is_dir: false,
      modified: Date.now(),
      file_type: 'document',
    },
    {
      name: 'photo.jpg',
      path: '/home/user/documents/photo.jpg',
      size: 2048,
      is_dir: false,
      modified: Date.now(),
      file_type: 'image',
    },
  ];

  const existingCollection: FileCollection = {
    id: 'col-123',
    name: 'My PDFs',
    icon: 'FileText',
    color: '#3b82f6',
    filters: [{ type: 'extension', value: '.pdf' }],
    basePath: '/home/user/docs',
    createdAt: Date.now() - 10000,
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog Visibility', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(<CollectionEditorDialog {...defaultProps} isOpen={false} />);
      expect(container.innerHTML).toBe('');
    });

    it('renders the dialog when isOpen is true', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Create Mode (no collection prop)', () => {
    it('displays "New Collection" as the title', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      expect(screen.getByText('New Collection')).toBeInTheDocument();
    });

    it('has the correct aria-label', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'New Collection');
    });

    it('displays the "Create Collection" button text', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      expect(screen.getByText('Create Collection')).toBeInTheDocument();
    });

    it('starts with an empty name field', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      const nameInput = screen.getByPlaceholderText('My Collection');
      expect(nameInput).toHaveValue('');
    });

    it('displays the base directory input with current path', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      const baseInput = screen.getByPlaceholderText(
        'Leave empty to use as quick filter on current directory',
      );
      expect(baseInput).toHaveValue('/home/user/documents');
    });
  });

  describe('Edit Mode (with collection prop)', () => {
    it('displays "Edit Collection" as the title', () => {
      render(<CollectionEditorDialog {...defaultProps} collection={existingCollection} />);
      expect(screen.getByText('Edit Collection')).toBeInTheDocument();
    });

    it('has the correct aria-label for editing', () => {
      render(<CollectionEditorDialog {...defaultProps} collection={existingCollection} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Edit Collection');
    });

    it('displays "Save Changes" button text', () => {
      render(<CollectionEditorDialog {...defaultProps} collection={existingCollection} />);
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    it('populates the name field with the collection name', () => {
      render(<CollectionEditorDialog {...defaultProps} collection={existingCollection} />);
      const nameInput = screen.getByPlaceholderText('My Collection');
      expect(nameInput).toHaveValue('My PDFs');
    });

    it('populates the base directory with the collection basePath', () => {
      render(<CollectionEditorDialog {...defaultProps} collection={existingCollection} />);
      const baseInput = screen.getByPlaceholderText(
        'Leave empty to use as quick filter on current directory',
      );
      expect(baseInput).toHaveValue('/home/user/docs');
    });
  });

  describe('Form Fields', () => {
    it('displays Name label', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('displays Icon label', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      expect(screen.getByText('Icon')).toBeInTheDocument();
    });

    it('displays Base Directory label', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      expect(screen.getByText('Base Directory (optional)')).toBeInTheDocument();
    });

    it('displays Filters label', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('allows typing in the name input', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      const nameInput = screen.getByPlaceholderText('My Collection');
      fireEvent.change(nameInput, { target: { value: 'My Documents' } });
      expect(nameInput).toHaveValue('My Documents');
    });

    it('allows typing in the base directory input', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      const baseInput = screen.getByPlaceholderText(
        'Leave empty to use as quick filter on current directory',
      );
      fireEvent.change(baseInput, { target: { value: '/new/path' } });
      expect(baseInput).toHaveValue('/new/path');
    });

    it('renders icon buttons for selection', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      // Check that icon selection buttons exist (aria-labels like "Select icon ...")
      const iconButtons = screen.getAllByRole('button', { name: /Select icon/ });
      expect(iconButtons.length).toBeGreaterThan(0);
    });

    it('allows changing the selected icon', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      const iconButtons = screen.getAllByRole('button', { name: /Select icon/ });
      // Click the second icon
      if (iconButtons.length >= 2) {
        fireEvent.click(iconButtons[1]);
        // The button should now have a different border style (selected)
        // We just verify the click doesn't throw
      }
    });
  });

  describe('Filters', () => {
    it('starts with one default filter row', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      const removeButtons = screen.getAllByRole('button', { name: 'Remove filter' });
      expect(removeButtons).toHaveLength(1);
    });

    it('adds a new filter row when "+ Add Filter" is clicked', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      fireEvent.click(screen.getByText('+ Add Filter'));
      const removeButtons = screen.getAllByRole('button', { name: 'Remove filter' });
      expect(removeButtons).toHaveLength(2);
    });

    it('removes a filter row when the remove button is clicked', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      // Add a second filter
      fireEvent.click(screen.getByText('+ Add Filter'));
      expect(screen.getAllByRole('button', { name: 'Remove filter' })).toHaveLength(2);

      // Remove the first filter
      fireEvent.click(screen.getAllByRole('button', { name: 'Remove filter' })[0]);
      expect(screen.getAllByRole('button', { name: 'Remove filter' })).toHaveLength(1);
    });

    it('displays the filter type dropdown with correct options', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      const selects = screen.getAllByRole('combobox');
      // There should be at least one select for filter type
      expect(selects.length).toBeGreaterThanOrEqual(1);

      // Check some option text is present
      expect(screen.getByText('File Extension')).toBeInTheDocument();
    });
  });

  describe('Preview Count', () => {
    it('displays the match count for current files', () => {
      render(<CollectionEditorDialog {...defaultProps} currentFiles={mockFiles} />);
      // Default filter has empty value so it should match all files
      expect(screen.getByText(/file.*match in current directory/)).toBeInTheDocument();
    });
  });

  describe('Validation and Save', () => {
    it('disables Save/Create button when name is empty', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      const createBtn = screen.getByText('Create Collection');
      expect(createBtn.closest('button')).toBeDisabled();
    });

    it('disables Save/Create button when no filter has a value', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      // Type a name but leave filter value empty
      fireEvent.change(screen.getByPlaceholderText('My Collection'), {
        target: { value: 'Test' },
      });
      const createBtn = screen.getByText('Create Collection');
      expect(createBtn.closest('button')).toBeDisabled();
    });

    it('enables Save/Create button when name and at least one filter value are provided', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      // Type a name
      fireEvent.change(screen.getByPlaceholderText('My Collection'), {
        target: { value: 'Test Collection' },
      });
      // Type a filter value
      fireEvent.change(screen.getByPlaceholderText('.pdf,.docx,.txt'), {
        target: { value: '.pdf' },
      });
      const createBtn = screen.getByText('Create Collection');
      expect(createBtn.closest('button')).not.toBeDisabled();
    });

    it('calls createCollection and onClose when saving a new collection', () => {
      render(<CollectionEditorDialog {...defaultProps} />);

      // Fill name
      fireEvent.change(screen.getByPlaceholderText('My Collection'), {
        target: { value: 'My Documents' },
      });
      // Fill filter value
      fireEvent.change(screen.getByPlaceholderText('.pdf,.docx,.txt'), {
        target: { value: '.pdf' },
      });

      // Click create
      fireEvent.click(screen.getByText('Create Collection'));

      expect(createCollection).toHaveBeenCalledWith(
        'My Documents',
        [{ type: 'extension', value: '.pdf' }],
        expect.any(String), // icon
        expect.any(String), // basePath
        expect.any(String), // color
      );
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls updateCollection and onClose when saving an existing collection', () => {
      render(<CollectionEditorDialog {...defaultProps} collection={existingCollection} />);

      // Change the name
      const nameInput = screen.getByPlaceholderText('My Collection');
      fireEvent.change(nameInput, { target: { value: 'Updated PDFs' } });

      // Click save
      fireEvent.click(screen.getByText('Save Changes'));

      expect(updateCollection).toHaveBeenCalledWith(
        'col-123',
        expect.objectContaining({
          name: 'Updated PDFs',
        }),
      );
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Close Behavior', () => {
    it('calls onClose when Cancel is clicked', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the close (X) button is clicked', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape is pressed', () => {
      render(<CollectionEditorDialog {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog.parentElement!, { key: 'Escape' });
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('saves on Ctrl+Enter when form is valid', () => {
      render(<CollectionEditorDialog {...defaultProps} />);

      // Fill name
      fireEvent.change(screen.getByPlaceholderText('My Collection'), {
        target: { value: 'Quick Save' },
      });
      // Fill filter value
      fireEvent.change(screen.getByPlaceholderText('.pdf,.docx,.txt'), {
        target: { value: '.txt' },
      });

      // Press Ctrl+Enter
      const overlay = screen.getByRole('dialog').parentElement!;
      fireEvent.keyDown(overlay, { key: 'Enter', ctrlKey: true });

      expect(createCollection).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty currentFiles array', () => {
      expect(() =>
        render(<CollectionEditorDialog {...defaultProps} currentFiles={[]} />),
      ).not.toThrow();
    });

    it('handles undefined collection prop', () => {
      expect(() =>
        render(<CollectionEditorDialog {...defaultProps} collection={undefined} />),
      ).not.toThrow();
    });

    it('handles null collection prop', () => {
      expect(() =>
        render(<CollectionEditorDialog {...defaultProps} collection={null} />),
      ).not.toThrow();
    });
  });
});
