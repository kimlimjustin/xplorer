import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import KeyboardShortcutsDialog from '@/components/dialogs/KeyboardShortcutsDialog';
import { TauriAPI, ShortcutBinding } from '@/lib/tauri-api';

// Mock shortcut-utils
vi.mock('@/lib/shortcut-utils', () => ({
  formatKeyComboForDisplay: vi.fn((combo: string) => {
    if (!combo) return '';
    return combo
      .split('+')
      .map((p: string) => {
        if (p === 'ctrl') return 'Ctrl';
        if (p === 'shift') return 'Shift';
        if (p === 'alt') return 'Alt';
        return p.length === 1 ? p.toUpperCase() : p;
      })
      .join(' + ');
  }),
  getCategoryForAction: vi.fn((action: string) => {
    const map: Record<string, string> = {
      Copy: 'file-operations',
      Paste: 'file-operations',
      Search: 'search',
      Refresh: 'view',
      OpenSettings: 'application',
    };
    return map[action] || 'other';
  }),
  getLabelForAction: vi.fn((action: string) => {
    const map: Record<string, string> = {
      Copy: 'Copy',
      Paste: 'Paste',
      Search: 'Search',
      Refresh: 'Refresh',
      OpenSettings: 'Open Settings',
    };
    return map[action as string] || String(action);
  }),
}));

// Extend TauriAPI mock with getShortcuts
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    getShortcuts: vi.fn(() => Promise.resolve([])),
  },
  ShortcutBinding: {},
}));

const mockShortcuts: ShortcutBinding[] = [
  {
    id: 'copy',
    keys: ['ctrl+c'],
    action: 'Copy',
    context: null,
    enabled: true,
    profile: 'default',
    description: 'Copy selected files',
    global: false,
    key_combination: 'ctrl+c',
  },
  {
    id: 'paste',
    keys: ['ctrl+v'],
    action: 'Paste',
    context: null,
    enabled: true,
    profile: 'default',
    description: 'Paste files',
    global: false,
    key_combination: 'ctrl+v',
  },
  {
    id: 'search',
    keys: ['ctrl+f'],
    action: 'Search',
    context: null,
    enabled: true,
    profile: 'default',
    description: 'Search files',
    global: false,
    key_combination: 'ctrl+f',
  },
  {
    id: 'refresh',
    keys: ['f5'],
    action: 'Refresh',
    context: null,
    enabled: true,
    profile: 'default',
    description: 'Refresh directory',
    global: false,
    key_combination: 'f5',
  },
  {
    id: 'settings',
    keys: ['ctrl+,'],
    action: 'OpenSettings',
    context: null,
    enabled: true,
    profile: 'default',
    description: 'Open Settings',
    global: false,
    key_combination: 'ctrl+,',
  },
];

describe('KeyboardShortcutsDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onOpenSettings: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(TauriAPI.getShortcuts).mockResolvedValue(mockShortcuts);
  });

  describe('Dialog Visibility', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(<KeyboardShortcutsDialog {...defaultProps} isOpen={false} />);
      expect(container.innerHTML).toBe('');
    });

    it('renders the dialog when isOpen is true', async () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Basic Rendering', () => {
    it('displays the dialog title', async () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    it('has the correct aria-label', () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Keyboard Shortcuts');
    });

    it('displays a search input with placeholder', () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      expect(screen.getByPlaceholderText('Search shortcuts...')).toBeInTheDocument();
    });

    it('displays a close button with aria-label', () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('displays the Esc hint in the footer', () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      expect(screen.getByText('Esc')).toBeInTheDocument();
      expect(screen.getByText(/to close/)).toBeInTheDocument();
    });

    it('displays the "Customize in Settings" link when onOpenSettings is provided', () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      expect(screen.getByText('Customize in Settings')).toBeInTheDocument();
    });

    it('hides the "Customize in Settings" link when onOpenSettings is not provided', () => {
      render(<KeyboardShortcutsDialog isOpen={true} onClose={vi.fn()} />);
      expect(screen.queryByText('Customize in Settings')).not.toBeInTheDocument();
    });
  });

  describe('Loading Shortcuts', () => {
    it('shows loading state initially', () => {
      // Use a never-resolving promise to keep the loading state
      vi.mocked(TauriAPI.getShortcuts).mockReturnValue(new Promise(() => {}));
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      expect(screen.getByText('Loading shortcuts...')).toBeInTheDocument();
    });

    it('fetches shortcuts from TauriAPI when dialog opens', async () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      await waitFor(() => {
        expect(TauriAPI.getShortcuts).toHaveBeenCalledTimes(1);
      });
    });

    it('displays shortcut count badge after loading', async () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('5 shortcuts')).toBeInTheDocument();
      });
    });

    it('displays shortcut descriptions after loading', async () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Copy selected files')).toBeInTheDocument();
        expect(screen.getByText('Paste files')).toBeInTheDocument();
        expect(screen.getByText('Search files')).toBeInTheDocument();
      });
    });

    it('displays category headers after loading', async () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('File Operations')).toBeInTheDocument();
      });
    });

    it('shows "No shortcuts configured" when API returns empty array', async () => {
      vi.mocked(TauriAPI.getShortcuts).mockResolvedValue([]);
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('No shortcuts configured')).toBeInTheDocument();
      });
    });

    it('handles API errors gracefully', async () => {
      vi.mocked(TauriAPI.getShortcuts).mockRejectedValue(new Error('Network error'));
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      // Should still render dialog, just with empty/no-shortcuts state
      await waitFor(() => {
        expect(screen.getByText('No shortcuts configured')).toBeInTheDocument();
      });
    });
  });

  describe('Search Filtering', () => {
    it('filters shortcuts by search query in description', async () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Copy selected files')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search shortcuts...');
      fireEvent.change(searchInput, { target: { value: 'copy' } });

      expect(screen.getByText('Copy selected files')).toBeInTheDocument();
      expect(screen.queryByText('Search files')).not.toBeInTheDocument();
    });

    it('shows no-match message when search yields no results', async () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Copy selected files')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search shortcuts...');
      fireEvent.change(searchInput, { target: { value: 'zzznomatch' } });

      expect(screen.getByText(/No shortcuts matching "zzznomatch"/)).toBeInTheDocument();
    });

    it('updates the shortcut count badge when filtering', async () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('5 shortcuts')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search shortcuts...');
      fireEvent.change(searchInput, { target: { value: 'copy' } });

      expect(screen.getByText('1 shortcuts')).toBeInTheDocument();
    });
  });

  describe('Close Behavior', () => {
    it('calls onClose when the close button is clicked', () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the overlay background', () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      const overlay = screen.getByRole('dialog');
      // Click the overlay element directly (not the inner dialog)
      fireEvent.click(overlay);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Settings Link', () => {
    it('calls onClose and onOpenSettings when "Customize in Settings" is clicked', () => {
      render(<KeyboardShortcutsDialog {...defaultProps} />);
      fireEvent.click(screen.getByText('Customize in Settings'));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      expect(defaultProps.onOpenSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('Disabled/Unbound Shortcuts', () => {
    it('does not display disabled shortcuts', async () => {
      vi.mocked(TauriAPI.getShortcuts).mockResolvedValue([
        {
          ...mockShortcuts[0],
          enabled: false,
          description: 'Disabled shortcut',
        },
        mockShortcuts[1],
      ]);

      render(<KeyboardShortcutsDialog {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Paste files')).toBeInTheDocument();
      });
      expect(screen.queryByText('Disabled shortcut')).not.toBeInTheDocument();
    });

    it('does not display shortcuts with empty key_combination', async () => {
      vi.mocked(TauriAPI.getShortcuts).mockResolvedValue([
        {
          ...mockShortcuts[0],
          key_combination: '',
          description: 'Unbound shortcut',
        },
        mockShortcuts[1],
      ]);

      render(<KeyboardShortcutsDialog {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Paste files')).toBeInTheDocument();
      });
      expect(screen.queryByText('Unbound shortcut')).not.toBeInTheDocument();
    });
  });

  describe('Reopen Behavior', () => {
    it('resets search query when dialog is reopened', async () => {
      const { rerender } = render(<KeyboardShortcutsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Copy selected files')).toBeInTheDocument();
      });

      // Type a search query
      const searchInput = screen.getByPlaceholderText('Search shortcuts...');
      fireEvent.change(searchInput, { target: { value: 'test' } });
      expect(searchInput).toHaveValue('test');

      // Close
      rerender(<KeyboardShortcutsDialog {...defaultProps} isOpen={false} />);

      // Reopen
      rerender(<KeyboardShortcutsDialog {...defaultProps} isOpen={true} />);

      // Search should be reset
      const newSearchInput = screen.getByPlaceholderText('Search shortcuts...');
      expect(newSearchInput).toHaveValue('');
    });

    it('re-fetches shortcuts when dialog is reopened', async () => {
      const { rerender } = render(<KeyboardShortcutsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(TauriAPI.getShortcuts).toHaveBeenCalledTimes(1);
      });

      // Close
      rerender(<KeyboardShortcutsDialog {...defaultProps} isOpen={false} />);

      // Reopen
      rerender(<KeyboardShortcutsDialog {...defaultProps} isOpen={true} />);

      await waitFor(() => {
        expect(TauriAPI.getShortcuts).toHaveBeenCalledTimes(2);
      });
    });
  });
});
