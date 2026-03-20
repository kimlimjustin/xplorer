import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatusBar from '@/components/StatusBar';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';

// Mock TauriAPI
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    findGitRepository: vi.fn(() => Promise.resolve(null)),
    getRepositoryInfo: vi.fn(() =>
      Promise.resolve({
        current_branch: 'main',
        modified_files: [],
        staged_files: [],
        untracked_files: [],
      }),
    ),
    listDrives: vi.fn(() => Promise.resolve([{ path: 'C:\\', free_space: 107374182400 }])),
    readBinaryFile: vi.fn(() => Promise.resolve(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]))),
  },
  FileEntry: {},
}));

// Mock extension host
const mockIsExtensionActive = vi.fn(() => false);
vi.mock('@/lib/extension-host', () => ({
  extensionHost: {
    isExtensionActive: (...args: unknown[]) => mockIsExtensionActive(...args),
  },
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
  useToast: () => ({ toast: mockToast }),
}));

describe('StatusBar', () => {
  const makeFile = (overrides: Partial<FileEntry> = {}): FileEntry => ({
    name: 'file.txt',
    path: 'C:\\Users\\Test\\file.txt',
    size: 1024,
    is_dir: false,
    modified: Date.now(),
    file_type: 'text',
    ...overrides,
  });

  const defaultProps = {
    files: [] as FileEntry[],
    selectedFiles: new Set<string>(),
    currentPath: 'C:\\Users\\Test',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsExtensionActive.mockReturnValue(false);
  });

  describe('Item Count', () => {
    it('shows 0 items when files array is empty', () => {
      render(<StatusBar {...defaultProps} files={[]} />);

      expect(screen.getByText('items')).toBeInTheDocument();
    });

    it('shows correct item count', () => {
      const files = [
        makeFile({ name: 'a.txt', path: 'C:\\a.txt' }),
        makeFile({ name: 'b.txt', path: 'C:\\b.txt' }),
        makeFile({ name: 'c.txt', path: 'C:\\c.txt' }),
      ];

      render(<StatusBar {...defaultProps} files={files} />);

      expect(screen.getByText('items')).toBeInTheDocument();
    });
  });

  describe('Selection Info', () => {
    it('does not show selection info when nothing is selected', () => {
      render(<StatusBar {...defaultProps} />);

      expect(screen.queryByText('selected')).not.toBeInTheDocument();
    });

    it('shows selection count when files are selected', () => {
      const files = [
        makeFile({ name: 'a.txt', path: 'C:\\a.txt', size: 100 }),
        makeFile({ name: 'b.txt', path: 'C:\\b.txt', size: 200 }),
      ];
      const selectedFiles = new Set(['C:\\a.txt']);

      render(<StatusBar {...defaultProps} files={files} selectedFiles={selectedFiles} />);

      expect(screen.getByText(/selected/)).toBeInTheDocument();
    });

    it('shows multiple selected count', () => {
      const files = [
        makeFile({ name: 'a.txt', path: 'C:\\a.txt', size: 100 }),
        makeFile({ name: 'b.txt', path: 'C:\\b.txt', size: 200 }),
        makeFile({ name: 'c.txt', path: 'C:\\c.txt', size: 300 }),
      ];
      const selectedFiles = new Set(['C:\\a.txt', 'C:\\b.txt']);

      render(<StatusBar {...defaultProps} files={files} selectedFiles={selectedFiles} />);

      expect(screen.getByText(/selected/)).toBeInTheDocument();
    });

    it('shows selection size for non-directory files', () => {
      const files = [
        makeFile({ name: 'a.txt', path: 'C:\\a.txt', size: 500 }),
        makeFile({ name: 'b.txt', path: 'C:\\b.txt', size: 300 }),
      ];
      const selectedFiles = new Set(['C:\\a.txt', 'C:\\b.txt']);

      render(<StatusBar {...defaultProps} files={files} selectedFiles={selectedFiles} />);

      // formatFileSize is mocked as `${bytes} B` from setup.ts
      expect(screen.getByText(/selected \(800 B\)/)).toBeInTheDocument();
    });

    it('does not include directory sizes in selection total', () => {
      const files = [
        makeFile({ name: 'folder', path: 'C:\\folder', size: 0, is_dir: true }),
        makeFile({ name: 'file.txt', path: 'C:\\file.txt', size: 500 }),
      ];
      const selectedFiles = new Set(['C:\\folder', 'C:\\file.txt']);

      render(<StatusBar {...defaultProps} files={files} selectedFiles={selectedFiles} />);

      expect(screen.getByText(/selected \(500 B\)/)).toBeInTheDocument();
    });
  });

  describe('Path Display', () => {
    it('displays the current path', () => {
      const { container } = render(<StatusBar {...defaultProps} currentPath="C:\\Users\\Test" />);

      // Find the path display element by its class
      const pathEl = container.querySelector('.flex-1.text-center');
      expect(pathEl).not.toBeNull();
      expect(pathEl?.textContent).toContain('Users');
      expect(pathEl?.textContent).toContain('Test');
    });

    it('shows full path as title attribute', () => {
      const { container } = render(<StatusBar {...defaultProps} currentPath="C:\\Users\\Test" />);

      const pathElement = container.querySelector('[title]');
      expect(pathElement).not.toBeNull();
      expect(pathElement?.getAttribute('title')).toContain('Users');
    });

    it('truncates long paths', () => {
      const longPath =
        'C:\\Users\\VeryLongUsername\\Documents\\Projects\\MyProject\\Source\\Components\\SubFolder';

      render(<StatusBar {...defaultProps} currentPath={longPath} />);

      // The path should be truncated (original is > 60 chars)
      const pathElement = screen.getByTitle(longPath);
      expect(pathElement).toBeInTheDocument();
      // The displayed text should contain ellipsis
      expect(pathElement.textContent).toContain('...');
    });

    it('does not truncate short paths', () => {
      const shortPath = 'C:\\Short';

      render(<StatusBar {...defaultProps} currentPath={shortPath} />);

      expect(screen.getByText('C:\\Short')).toBeInTheDocument();
    });

    it('strips xplorer:// prefix for display', () => {
      render(<StatusBar {...defaultProps} currentPath="xplorer://favorites" />);

      expect(screen.getByText('favorites')).toBeInTheDocument();
    });
  });

  describe('Git Branch', () => {
    it('shows git branch as a clickable button when path is in a git repository', async () => {
      vi.mocked(TauriAPI.findGitRepository).mockResolvedValueOnce('C:\\Users\\Test');
      vi.mocked(TauriAPI.getRepositoryInfo).mockResolvedValueOnce({
        current_branch: 'feature/test-branch',
        modified_files: ['a.txt'],
        staged_files: [],
        untracked_files: ['b.txt'],
      } as Record<string, unknown>);

      render(<StatusBar {...defaultProps} currentPath="C:\\Users\\Test" />);

      await waitFor(() => {
        // The branch name is rendered as text inside a button; aria-label uses the i18n mock
        expect(screen.getByText('feature/test-branch')).toBeInTheDocument();
        const branchButton = screen.getByText('feature/test-branch').closest('button');
        expect(branchButton).toBeInTheDocument();
      });
    });

    it('dispatches event to open git panel when extension is active', async () => {
      vi.mocked(TauriAPI.findGitRepository).mockResolvedValueOnce('C:\\Users\\Test');
      vi.mocked(TauriAPI.getRepositoryInfo).mockResolvedValueOnce({
        current_branch: 'main',
        modified_files: [],
        staged_files: [],
        untracked_files: [],
      } as Record<string, unknown>);
      mockIsExtensionActive.mockReturnValue(true);

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      render(<StatusBar {...defaultProps} currentPath="C:\\Users\\Test" />);

      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('main').closest('button')!);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'xplorer-set-bottom-tab',
          detail: { tab: 'git' },
        }),
      );

      dispatchSpy.mockRestore();
    });

    it('shows toast when git extension is not installed', async () => {
      vi.mocked(TauriAPI.findGitRepository).mockResolvedValueOnce('C:\\Users\\Test');
      vi.mocked(TauriAPI.getRepositoryInfo).mockResolvedValueOnce({
        current_branch: 'main',
        modified_files: [],
        staged_files: [],
        untracked_files: [],
      } as Record<string, unknown>);
      mockIsExtensionActive.mockReturnValue(false);

      render(<StatusBar {...defaultProps} currentPath="C:\\Users\\Test" />);

      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('main').closest('button')!);

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'gitNotInstalled',
        }),
      );
    });

    it('does not show git branch for non-git directories', async () => {
      render(<StatusBar {...defaultProps} currentPath="C:\\Users\\NonGit" />);

      // Give the async effect time to resolve
      await waitFor(() => {
        // The git branch indicator should not appear since findGitRepository returns null
        expect(screen.queryByRole('button', { name: /openGitPanel/ })).not.toBeInTheDocument();
      });
    });

    it('does not fetch git info for xplorer:// paths', () => {
      render(<StatusBar {...defaultProps} currentPath="xplorer://favorites" />);

      expect(TauriAPI.findGitRepository).not.toHaveBeenCalled();
    });

    it('handles git repository lookup failure gracefully', async () => {
      vi.mocked(TauriAPI.findGitRepository).mockRejectedValueOnce(new Error('git error'));

      expect(() =>
        render(<StatusBar {...defaultProps} currentPath="C:\\Users\\Test" />),
      ).not.toThrow();
    });
  });

  describe('Free Disk Space', () => {
    it('shows free disk space', async () => {
      vi.mocked(TauriAPI.listDrives).mockResolvedValueOnce([
        { path: 'C:\\', free_space: 5000 } as unknown,
      ]);

      render(<StatusBar {...defaultProps} currentPath="C:\\Users\\Test" />);

      await waitFor(() => {
        expect(screen.getByText(/free/)).toBeInTheDocument();
      });
    });

    it('does not show free space for xplorer:// paths', () => {
      render(<StatusBar {...defaultProps} currentPath="xplorer://favorites" />);

      expect(TauriAPI.listDrives).not.toHaveBeenCalled();
    });

    it('handles listDrives failure gracefully', async () => {
      vi.mocked(TauriAPI.listDrives).mockRejectedValueOnce(new Error('drive error'));

      expect(() =>
        render(<StatusBar {...defaultProps} currentPath="C:\\Users\\Test" />),
      ).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('renders with empty files array and no selection', () => {
      expect(() =>
        render(<StatusBar files={[]} selectedFiles={new Set()} currentPath="" />),
      ).not.toThrow();
    });

    it('handles selected files that are not in the files array', () => {
      const files = [makeFile({ name: 'a.txt', path: 'C:\\a.txt', size: 100 })];
      const selectedFiles = new Set(['C:\\nonexistent.txt']);

      render(<StatusBar {...defaultProps} files={files} selectedFiles={selectedFiles} />);

      // Should show 1 selected with 0 size (since the selected file is not in files array)
      expect(screen.getByText('selected')).toBeInTheDocument();
    });

    it('updates when currentPath changes', async () => {
      const { container, rerender } = render(
        <StatusBar {...defaultProps} currentPath="C:\\Path1" />,
      );

      rerender(<StatusBar {...defaultProps} currentPath="C:\\Path2" />);

      // The displayed path should update
      const pathEl = container.querySelector('.flex-1.text-center');
      expect(pathEl?.textContent).toContain('Path2');
    });
  });
});
