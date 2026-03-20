import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import MarketplacePanel from '@/components/panels/MarketplacePanel';
import { TauriAPI } from '@/lib/tauri-api';

// Mock TauriAPI
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    getInstalledExtensions: vi.fn(),
    downloadAndInstallExtension: vi.fn(),
    showOpenDialog: vi.fn(),
    installXtensionFile: vi.fn(),
  },
}));

// Mock extensionHost
vi.mock('@/lib/extension-host', () => ({
  extensionHost: {
    loadExtension: vi.fn(),
    activateExtension: vi.fn(),
    uninstallExtension: vi.fn(),
  },
}));

// Mock ExtensionDetailDialog
vi.mock('@/components/panels/ExtensionDetailDialog', () => ({
  default: () => null,
}));

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.open
Object.defineProperty(window, 'open', {
  value: vi.fn(),
  writable: true,
});

// Mock marketplace API response data
const MOCK_EXTENSIONS = [
  {
    id: 'xplorer-tokyo-night-theme',
    name: 'Tokyo Night Theme',
    displayName: 'Tokyo Night',
    slug: 'xplorer-tokyo-night-theme',
    description: 'A beautiful dark theme inspired by the lights of downtown Tokyo',
    version: '1.0.0',
    checksum: '',
    icon: 'moon',
    downloadCount: 100,
    averageRating: 4.5,
    reviewCount: 10,
    author: { username: 'xplorer', name: 'Xplorer' },
    categories: [{ name: 'Theme', slug: 'theme' }],
    downloadUrl: '',
  },
  {
    id: 'xplorer-dracula-theme',
    name: 'Dracula Theme',
    displayName: 'Dracula',
    slug: 'xplorer-dracula-theme',
    description: 'A dark theme inspired by Dracula',
    version: '1.0.0',
    checksum: '',
    icon: 'palette',
    downloadCount: 80,
    averageRating: 4.2,
    reviewCount: 5,
    author: { username: 'xplorer', name: 'Xplorer' },
    categories: [{ name: 'Theme', slug: 'theme' }],
    downloadUrl: '',
  },
  {
    id: 'code-editor',
    name: 'Code Editor',
    displayName: 'Code Editor',
    slug: 'code-editor',
    description: 'Edit code files directly',
    version: '1.0.0',
    checksum: '',
    icon: 'code',
    downloadCount: 200,
    averageRating: 4.8,
    reviewCount: 20,
    author: { username: 'xplorer', name: 'Xplorer' },
    categories: [{ name: 'Editor', slug: 'editor' }],
    downloadUrl: '',
  },
];

const setupMocks = () => {
  (TauriAPI.getInstalledExtensions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

  // Mock successful marketplace API responses
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/categories')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          categories: [
            { id: 'all', name: 'All', slug: 'all' },
            { id: 'theme', name: 'Theme', slug: 'theme' },
            { id: 'editor', name: 'Editor', slug: 'editor' },
          ],
        }),
      });
    }
    if (url.includes('/extensions')) {
      const urlObj = new URL(url, 'http://localhost:3000');
      const search = urlObj.searchParams.get('search') || '';
      let filtered = [...MOCK_EXTENSIONS];
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            e.displayName.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q) ||
            e.name.toLowerCase().includes(q),
        );
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          extensions: filtered,
          pagination: { page: 1, limit: 20, total: filtered.length, totalPages: 1 },
        }),
      });
    }
    return Promise.resolve({ ok: false, json: async () => ({}) });
  });
};

describe('MarketplacePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('renders without crashing', async () => {
    await act(async () => {
      render(<MarketplacePanel />);
    });
    expect(screen.getByText('Extension Marketplace')).toBeInTheDocument();
  });

  it('displays search input', async () => {
    await act(async () => {
      render(<MarketplacePanel />);
    });
    expect(screen.getByPlaceholderText('Search extensions...')).toBeInTheDocument();
  });

  it('shows packs view by default with extension packs', async () => {
    await act(async () => {
      render(<MarketplacePanel />);
    });

    expect(screen.getByText('Extension Packs')).toBeInTheDocument();
    expect(screen.getByText('Essentials')).toBeInTheDocument();
    expect(screen.getByText('Developer Tools')).toBeInTheDocument();
  });

  it('shows marketplace extensions when switched to extensions view', async () => {
    await act(async () => {
      render(<MarketplacePanel />);
    });

    const extensionsTab = screen.getByText('All Extensions');
    await act(async () => {
      fireEvent.click(extensionsTab);
    });

    await waitFor(() => {
      expect(screen.getByText('Tokyo Night')).toBeInTheDocument();
      expect(screen.getByText('Dracula')).toBeInTheDocument();
      expect(screen.getByText('Code Editor')).toBeInTheDocument();
    });
  });

  it('filters extensions based on search term', async () => {
    await act(async () => {
      render(<MarketplacePanel />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('All Extensions'));
    });

    await waitFor(() => {
      expect(screen.getByText('Tokyo Night')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search extensions...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Dracula' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Dracula')).toBeInTheDocument();
      expect(screen.queryByText('Tokyo Night')).not.toBeInTheDocument();
    });
  });

  it('shows install button for non-installed extensions', async () => {
    await act(async () => {
      render(<MarketplacePanel />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('All Extensions'));
    });

    await waitFor(() => {
      const installButtons = screen.getAllByText('Install');
      expect(installButtons.length).toBeGreaterThan(0);
    });
  });

  it('shows installed status for installed extensions', async () => {
    (TauriAPI.getInstalledExtensions as ReturnType<typeof vi.fn>).mockResolvedValue([
      { manifest: { id: 'xplorer-tokyo-night-theme' } },
    ]);

    await act(async () => {
      render(<MarketplacePanel />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('All Extensions'));
    });

    await waitFor(() => {
      expect(screen.getByText('Uninstall')).toBeInTheDocument();
    });
  });

  it('handles extension installation via web API', async () => {
    (TauriAPI.downloadAndInstallExtension as ReturnType<typeof vi.fn>).mockResolvedValue({
      manifest: {
        id: 'xplorer-tokyo-night-theme',
        name: 'Tokyo Night Theme',
        display_name: 'Tokyo Night',
      },
    });

    await act(async () => {
      render(<MarketplacePanel />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('All Extensions'));
    });

    await waitFor(() => {
      const installButton = screen.getAllByText('Install')[0];
      act(() => {
        fireEvent.click(installButton);
      });
    });

    await waitFor(() => {
      expect(TauriAPI.downloadAndInstallExtension).toHaveBeenCalled();
    });
  });

  it('shows error state when marketplace is unavailable', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<MarketplacePanel />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('All Extensions'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Marketplace is currently unavailable/)).toBeInTheDocument();
    });
  });

  it('refreshes extension list when refresh button is clicked', async () => {
    await act(async () => {
      render(<MarketplacePanel />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('All Extensions'));
    });

    await waitFor(() => {
      expect(screen.getByText('Tokyo Night')).toBeInTheDocument();
    });

    const refreshButton = screen.getByTitle('Refresh');
    expect(refreshButton).toBeTruthy();
    await act(async () => {
      fireEvent.click(refreshButton);
    });

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('opens marketplace website when external link is clicked', async () => {
    await act(async () => {
      render(<MarketplacePanel />);
    });

    const externalLinkButton = screen.getByTitle('Open Marketplace Website');
    await act(async () => {
      fireEvent.click(externalLinkButton);
    });

    expect(window.open).toHaveBeenCalledWith('http://localhost:3000', '_blank');
  });

  it('displays extension details correctly', async () => {
    await act(async () => {
      render(<MarketplacePanel />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('All Extensions'));
    });

    await waitFor(() => {
      expect(screen.getByText('Tokyo Night')).toBeInTheDocument();
      expect(
        screen.getByText(/A beautiful dark theme inspired by the lights of downtown Tokyo/),
      ).toBeInTheDocument();
      expect(screen.getAllByText('Install').length).toBeGreaterThan(0);
    });
  });

  it('shows no extensions message when search returns no results', async () => {
    await act(async () => {
      render(<MarketplacePanel />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('All Extensions'));
    });

    await waitFor(() => {
      expect(screen.getByText('Tokyo Night')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search extensions...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'NonexistentExtension' } });
    });

    await waitFor(() => {
      expect(screen.getByText('No extensions found')).toBeInTheDocument();
    });
  });

  it('handles loading state', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ extensions: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
              }),
            1000,
          ),
        ),
    );

    await act(async () => {
      render(<MarketplacePanel />);
    });

    // Switch to extensions view to see loading state
    await act(async () => {
      fireEvent.click(screen.getByText('All Extensions'));
    });

    expect(screen.getByText('Loading extensions...')).toBeInTheDocument();
  });

  it('opens publish extension link', async () => {
    await act(async () => {
      render(<MarketplacePanel />);
    });

    await waitFor(() => {
      const publishButton = screen.getByText('Publish Your Extension');
      act(() => {
        fireEvent.click(publishButton);
      });
    });

    expect(window.open).toHaveBeenCalledWith('http://localhost:3000/publish', '_blank');
  });

  describe('Extension Packs', () => {
    it('shows install pack buttons', async () => {
      await act(async () => {
        render(<MarketplacePanel />);
      });

      const installButtons = screen.getAllByText('Install Pack');
      expect(installButtons.length).toBeGreaterThan(0);
    });

    it('shows recommended badge on recommended packs', async () => {
      await act(async () => {
        render(<MarketplacePanel />);
      });

      expect(screen.getByText('Recommended')).toBeInTheDocument();
    });
  });
});
