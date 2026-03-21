import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RightSidebar from '@/components/panels/RightSidebar';

// Helper to render with Suspense boundary for lazy-loaded child components
const renderWithSuspense = (ui: React.ReactElement) => {
  return render(<React.Suspense fallback={<div>Loading...</div>}>{ui}</React.Suspense>);
};

// Mock sub-components
vi.mock('@/components/panels/PreviewPanel', () => ({
  default: ({ selectedFile }: { selectedFile?: { name: string } | null }) => (
    <div data-testid="preview-panel">
      {selectedFile ? `Preview: ${selectedFile.name}` : 'No file selected'}
    </div>
  ),
}));
vi.mock('@/components/panels/TokenizerStatusPanel', () => ({
  default: () => <div data-testid="tokenizer-panel">Content Search</div>,
}));
vi.mock('@/components/panels/ExtensionsPanel', () => ({
  default: () => <div data-testid="extensions-panel">Extensions</div>,
}));
vi.mock('@/components/panels/MarketplacePanel', () => ({
  default: () => <div data-testid="marketplace-panel">Marketplace</div>,
}));
vi.mock('@/components/panels/PerformanceDashboard', () => ({
  default: () => <div data-testid="performance-dashboard">Performance</div>,
}));
vi.mock('@/components/panels/ExtensionPanelHost', () => ({
  default: ({ panelId }: { panelId?: string }) => (
    <div data-testid="extension-panel-host" data-panel-id={panelId}>
      Extension: {panelId}
    </div>
  ),
}));
vi.mock('@/components/panels/PreviewNavigationBar', () => ({
  default: () => <div data-testid="preview-nav-bar">Preview Nav</div>,
}));
vi.mock('@/components/previews/ComparePreview', () => ({
  default: ({
    leftFile,
    rightFile,
    onDismiss,
  }: {
    leftFile?: string;
    rightFile?: string;
    onDismiss?: () => void;
  }) => (
    <div data-testid="compare-preview">
      Compare: {leftFile?.name} vs {rightFile?.name}
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  ),
}));
vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/extension-host', () => ({
  extensionHost: {
    getPanel: vi.fn(() => null),
  },
}));
vi.mock('@/hooks/use-preview-history', () => ({
  usePreviewHistory: () => ({
    getHistory: vi.fn(() => []),
    addToHistory: vi.fn(),
    versionRef: { current: 0 },
  }),
}));
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    openFile: vi.fn(),
  },
  FileEntry: {},
}));

describe('RightSidebar', () => {
  const mockSetRightSidebarCollapsed = vi.fn();
  const mockApplyTheme = vi.fn();
  const mockNavigateToPath = vi.fn();

  const defaultProps = {
    rightSidebarCollapsed: false,
    setRightSidebarCollapsed: mockSetRightSidebarCollapsed,
    rightPanelTab: 'preview',
    selectedFile: null as unknown,
    formatFileSize: (bytes: number) => `${bytes} B`,
    formatDate: (ts: number) => new Date(ts).toISOString(),
    themes: { glass: { name: 'Glass', primary: '', bg: '', surface: '', text: '' } },
    theme: 'glass',
    applyTheme: mockApplyTheme,
    allFiles: [] as unknown[],
    selectedFiles: new Set<string>(),
    currentPath: 'C:\\Users\\Test',
    navigateToPath: mockNavigateToPath,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Collapsed state', () => {
    it('returns null when collapsed', () => {
      const { container } = render(<RightSidebar {...defaultProps} rightSidebarCollapsed={true} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders when not collapsed', () => {
      const { container } = render(<RightSidebar {...defaultProps} />);
      expect(container.firstChild).not.toBeNull();
    });
  });

  describe('Header', () => {
    it('renders close button', () => {
      render(<RightSidebar {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('calls setRightSidebarCollapsed when close button is clicked', () => {
      render(<RightSidebar {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);
      expect(mockSetRightSidebarCollapsed).toHaveBeenCalledWith(true);
    });
  });

  describe('Tab titles', () => {
    it('shows extensions panel when tab is extensions', async () => {
      renderWithSuspense(<RightSidebar {...defaultProps} rightPanelTab="extensions" />);
      expect(await screen.findByTestId('extensions-panel')).toBeInTheDocument();
      const elements = screen.getAllByText('Extensions');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows marketplace panel when tab is marketplace', async () => {
      renderWithSuspense(<RightSidebar {...defaultProps} rightPanelTab="marketplace" />);
      expect(await screen.findByTestId('marketplace-panel')).toBeInTheDocument();
      const elements = screen.getAllByText('Marketplace');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows performance dashboard when tab is performance', async () => {
      renderWithSuspense(<RightSidebar {...defaultProps} rightPanelTab="performance" />);
      expect(await screen.findByTestId('performance-dashboard')).toBeInTheDocument();
      const elements = screen.getAllByText('Performance');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Preview panel', () => {
    it('renders PreviewPanel for preview tab with no file selected', async () => {
      renderWithSuspense(<RightSidebar {...defaultProps} rightPanelTab="preview" />);
      expect(await screen.findByTestId('preview-panel')).toBeInTheDocument();
      expect(screen.getByText('No file selected')).toBeInTheDocument();
    });

    it('passes selected file to PreviewPanel', async () => {
      const file = {
        name: 'test.txt',
        path: 'C:\\test.txt',
        is_dir: false,
        size: 100,
        modified: Date.now(),
        file_type: 'text',
      };
      renderWithSuspense(
        <RightSidebar {...defaultProps} rightPanelTab="preview" selectedFile={file} />,
      );
      expect(await screen.findByText('Preview: test.txt')).toBeInTheDocument();
    });

    it('renders TokenizerStatusPanel for tokenizer tab', async () => {
      renderWithSuspense(<RightSidebar {...defaultProps} rightPanelTab="tokenizer" />);
      expect(await screen.findByTestId('tokenizer-panel')).toBeInTheDocument();
    });
  });

  describe('Compare mode', () => {
    it('shows compare preview when exactly 2 files are selected', async () => {
      const file1 = {
        name: 'a.txt',
        path: 'C:\\a.txt',
        is_dir: false,
        size: 100,
        modified: Date.now(),
        file_type: 'text',
      };
      const file2 = {
        name: 'b.txt',
        path: 'C:\\b.txt',
        is_dir: false,
        size: 200,
        modified: Date.now(),
        file_type: 'text',
      };
      const allFiles = [file1, file2];
      const selectedFiles = new Set(['C:\\a.txt', 'C:\\b.txt']);

      renderWithSuspense(
        <RightSidebar
          {...defaultProps}
          rightPanelTab="preview"
          allFiles={allFiles}
          selectedFiles={selectedFiles}
        />,
      );
      expect(await screen.findByTestId('compare-preview')).toBeInTheDocument();
      expect(screen.getByText(/Compare: a.txt vs b.txt/)).toBeInTheDocument();
    });

    it('dismisses compare preview when dismiss button clicked', async () => {
      const file1 = {
        name: 'a.txt',
        path: 'C:\\a.txt',
        is_dir: false,
        size: 100,
        modified: Date.now(),
        file_type: 'text',
      };
      const file2 = {
        name: 'b.txt',
        path: 'C:\\b.txt',
        is_dir: false,
        size: 200,
        modified: Date.now(),
        file_type: 'text',
      };
      const allFiles = [file1, file2];
      const selectedFiles = new Set(['C:\\a.txt', 'C:\\b.txt']);

      renderWithSuspense(
        <RightSidebar
          {...defaultProps}
          rightPanelTab="preview"
          allFiles={allFiles}
          selectedFiles={selectedFiles}
        />,
      );

      await screen.findByTestId('compare-preview');
      fireEvent.click(screen.getByText('Dismiss'));
      await waitFor(() => {
        expect(screen.queryByTestId('compare-preview')).not.toBeInTheDocument();
      });
    });
  });

  describe('Width prop', () => {
    it('uses default width of 320 when not specified', () => {
      const { container } = render(<RightSidebar {...defaultProps} />);
      const sidebar = container.firstChild as HTMLElement;
      expect(sidebar.style.width).toBe('320px');
    });

    it('uses custom width when specified', () => {
      const { container } = render(<RightSidebar {...defaultProps} width={400} />);
      const sidebar = container.firstChild as HTMLElement;
      expect(sidebar.style.width).toBe('400px');
    });
  });

  describe('Multi-select scrubber', () => {
    it('shows preview navigation bar when multiple files are selected on preview tab', () => {
      const file1 = {
        name: 'a.txt',
        path: 'C:\\a.txt',
        is_dir: false,
        size: 100,
        modified: Date.now(),
        file_type: 'text',
      };
      const file2 = {
        name: 'b.txt',
        path: 'C:\\b.txt',
        is_dir: false,
        size: 200,
        modified: Date.now(),
        file_type: 'text',
      };
      const file3 = {
        name: 'c.txt',
        path: 'C:\\c.txt',
        is_dir: false,
        size: 300,
        modified: Date.now(),
        file_type: 'text',
      };
      const allFiles = [file1, file2, file3];
      const selectedFiles = new Set(['C:\\a.txt', 'C:\\b.txt', 'C:\\c.txt']);

      render(
        <RightSidebar
          {...defaultProps}
          rightPanelTab="preview"
          allFiles={allFiles}
          selectedFiles={selectedFiles}
        />,
      );

      expect(screen.getByTestId('preview-nav-bar')).toBeInTheDocument();
    });

    it('does not show scrubber on non-preview tabs', () => {
      const file1 = {
        name: 'a.txt',
        path: 'C:\\a.txt',
        is_dir: false,
        size: 100,
        modified: Date.now(),
        file_type: 'text',
      };
      const file2 = {
        name: 'b.txt',
        path: 'C:\\b.txt',
        is_dir: false,
        size: 200,
        modified: Date.now(),
        file_type: 'text',
      };
      const file3 = {
        name: 'c.txt',
        path: 'C:\\c.txt',
        is_dir: false,
        size: 300,
        modified: Date.now(),
        file_type: 'text',
      };
      const allFiles = [file1, file2, file3];
      const selectedFiles = new Set(['C:\\a.txt', 'C:\\b.txt', 'C:\\c.txt']);

      render(
        <RightSidebar
          {...defaultProps}
          rightPanelTab="extensions"
          allFiles={allFiles}
          selectedFiles={selectedFiles}
        />,
      );

      expect(screen.queryByTestId('preview-nav-bar')).not.toBeInTheDocument();
    });
  });

  describe('Extension panel host', () => {
    it('renders ExtensionPanelHost for unknown panel tabs', async () => {
      renderWithSuspense(<RightSidebar {...defaultProps} rightPanelTab="some-extension-panel" />);
      expect(await screen.findByTestId('extension-panel-host')).toBeInTheDocument();
    });
  });
});
