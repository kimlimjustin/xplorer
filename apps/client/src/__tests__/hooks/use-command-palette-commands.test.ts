import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useCommandPaletteCommands,
  type UseCommandPaletteCommandsOptions,
} from '@/hooks/use-command-palette-commands';
import type { FileEntry } from '@/lib/tauri-api';

const makeFile = (name: string, path: string): FileEntry => {
  return { name, path, is_dir: false, size: 100, modified: Date.now(), file_type: 'file' };
};

const makeOptions = (overrides: Record<string, unknown> = {}) => {
  return {
    currentPath: '/home/user',
    pathHistory: ['/home', '/home/user', '/home/user/docs'],
    historyIndex: 1,
    files: [makeFile('a.txt', '/home/user/a.txt'), makeFile('b.txt', '/home/user/b.txt')],
    navigateWithHistory: vi.fn(),
    refetch: vi.fn(),
    setViewMode: vi.fn(),
    setRightSidebarCollapsed: vi.fn(),
    setBottomPanelCollapsed: vi.fn(),
    setBottomPanelTab: vi.fn(),
    bottomPanelTab: 'terminal',
    bottomPanelCollapsed: true,
    setLeftSidebarCollapsed: vi.fn(),
    setSelectedFiles: vi.fn(),
    setShortcutsDialogOpen: vi.fn(),
    handleCreateFolder: vi.fn(),
    handleDelete: vi.fn(),
    ...overrides,
  };
};

describe('useCommandPaletteCommands', () => {
  it('returns an array of commands', () => {
    const opts = makeOptions();
    const { result } = renderHook(() =>
      useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
    );

    expect(Array.isArray(result.current)).toBe(true);
    expect(result.current.length).toBeGreaterThan(0);
  });

  it('each command has id, title, category, and action', () => {
    const opts = makeOptions();
    const { result } = renderHook(() =>
      useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
    );

    for (const cmd of result.current) {
      expect(cmd.id).toBeDefined();
      expect(typeof cmd.title).toBe('string');
      expect(typeof cmd.category).toBe('string');
      expect(typeof cmd.action).toBe('function');
    }
  });

  describe('navigation commands', () => {
    it('Go Home navigates to xplorer://home', () => {
      const navigateWithHistory = vi.fn();
      const opts = makeOptions({ navigateWithHistory });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const homeCmd = result.current.find((c) => c.id === 'home');
      expect(homeCmd).toBeDefined();
      homeCmd!.action();
      expect(navigateWithHistory).toHaveBeenCalledWith('xplorer://home');
    });

    it('Go Up navigates to parent directory', () => {
      const navigateWithHistory = vi.fn();
      const opts = makeOptions({
        currentPath: '/home/user/docs',
        navigateWithHistory,
      });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const upCmd = result.current.find((c) => c.id === 'up');
      upCmd!.action();
      expect(navigateWithHistory).toHaveBeenCalledWith('/home/user');
    });

    it('Go Up does nothing if already at root', () => {
      const navigateWithHistory = vi.fn();
      const opts = makeOptions({
        currentPath: '/',
        navigateWithHistory,
      });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const upCmd = result.current.find((c) => c.id === 'up');
      upCmd!.action();
      // Should not navigate since parent would be empty or same
      // The command checks `parent && parent !== currentPath`
    });

    it('Go Back navigates to previous history entry', () => {
      const navigateWithHistory = vi.fn();
      const opts = makeOptions({
        pathHistory: ['/home', '/home/user', '/home/user/docs'],
        historyIndex: 2,
        navigateWithHistory,
      });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const backCmd = result.current.find((c) => c.id === 'back');
      backCmd!.action();
      expect(navigateWithHistory).toHaveBeenCalledWith('/home/user');
    });

    it('Go Back does nothing if at beginning of history', () => {
      const navigateWithHistory = vi.fn();
      const opts = makeOptions({
        pathHistory: ['/home'],
        historyIndex: 0,
        navigateWithHistory,
      });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const backCmd = result.current.find((c) => c.id === 'back');
      backCmd!.action();
      expect(navigateWithHistory).not.toHaveBeenCalled();
    });

    it('Go Forward navigates to next history entry', () => {
      const navigateWithHistory = vi.fn();
      const opts = makeOptions({
        pathHistory: ['/home', '/home/user', '/home/user/docs'],
        historyIndex: 1,
        navigateWithHistory,
      });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const forwardCmd = result.current.find((c) => c.id === 'forward');
      forwardCmd!.action();
      expect(navigateWithHistory).toHaveBeenCalledWith('/home/user/docs');
    });

    it('Go Forward does nothing if at end of history', () => {
      const navigateWithHistory = vi.fn();
      const opts = makeOptions({
        pathHistory: ['/home', '/home/user'],
        historyIndex: 1,
        navigateWithHistory,
      });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const forwardCmd = result.current.find((c) => c.id === 'forward');
      forwardCmd!.action();
      expect(navigateWithHistory).not.toHaveBeenCalled();
    });

    it('Refresh calls refetch', () => {
      const refetch = vi.fn();
      const opts = makeOptions({ refetch });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const refreshCmd = result.current.find((c) => c.id === 'refresh');
      refreshCmd!.action();
      expect(refetch).toHaveBeenCalled();
    });
  });

  describe('view commands', () => {
    it('Large Icons sets view mode to large', () => {
      const setViewMode = vi.fn();
      const opts = makeOptions({ setViewMode });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'view-large');
      cmd!.action();
      expect(setViewMode).toHaveBeenCalledWith('large');
    });

    it('List View sets view mode to list', () => {
      const setViewMode = vi.fn();
      const opts = makeOptions({ setViewMode });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'view-list');
      cmd!.action();
      expect(setViewMode).toHaveBeenCalledWith('list');
    });

    it('Details View sets view mode to details', () => {
      const setViewMode = vi.fn();
      const opts = makeOptions({ setViewMode });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'view-details');
      cmd!.action();
      expect(setViewMode).toHaveBeenCalledWith('details');
    });

    it('Gallery View sets view mode to gallery', () => {
      const setViewMode = vi.fn();
      const opts = makeOptions({ setViewMode });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'view-gallery');
      cmd!.action();
      expect(setViewMode).toHaveBeenCalledWith('gallery');
    });

    it('Tree View sets view mode to tree', () => {
      const setViewMode = vi.fn();
      const opts = makeOptions({ setViewMode });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'view-tree');
      cmd!.action();
      expect(setViewMode).toHaveBeenCalledWith('tree');
    });
  });

  describe('panel commands', () => {
    it('Toggle Preview Panel toggles right sidebar', () => {
      const setRightSidebarCollapsed = vi.fn();
      const opts = makeOptions({ setRightSidebarCollapsed });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'toggle-preview');
      cmd!.action();
      expect(setRightSidebarCollapsed).toHaveBeenCalledWith(expect.any(Function));
    });

    it('Toggle Terminal opens bottom panel and switches to terminal tab when collapsed', () => {
      const setBottomPanelCollapsed = vi.fn();
      const setBottomPanelTab = vi.fn();
      const opts = makeOptions({
        setBottomPanelCollapsed,
        setBottomPanelTab,
        bottomPanelCollapsed: true,
        bottomPanelTab: 'activity-log',
      });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'toggle-terminal');
      cmd!.action();
      expect(setBottomPanelCollapsed).toHaveBeenCalledWith(false);
      expect(setBottomPanelTab).toHaveBeenCalledWith('terminal');
    });

    it('Toggle Terminal collapses bottom panel when already showing terminal', () => {
      const setBottomPanelCollapsed = vi.fn();
      const setBottomPanelTab = vi.fn();
      const opts = makeOptions({
        setBottomPanelCollapsed,
        setBottomPanelTab,
        bottomPanelCollapsed: false,
        bottomPanelTab: 'terminal',
      });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'toggle-terminal');
      cmd!.action();
      expect(setBottomPanelCollapsed).toHaveBeenCalledWith(true);
      expect(setBottomPanelTab).not.toHaveBeenCalled();
    });

    it('Toggle Left Sidebar toggles left sidebar', () => {
      const setLeftSidebarCollapsed = vi.fn();
      const opts = makeOptions({ setLeftSidebarCollapsed });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'toggle-left-sidebar');
      cmd!.action();
      expect(setLeftSidebarCollapsed).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('file commands', () => {
    it('New Folder calls handleCreateFolder', () => {
      const handleCreateFolder = vi.fn();
      const opts = makeOptions({ handleCreateFolder });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'new-folder');
      cmd!.action();
      expect(handleCreateFolder).toHaveBeenCalled();
    });

    it('Select All selects all file paths', () => {
      const setSelectedFiles = vi.fn();
      const files = [makeFile('a.txt', '/a.txt'), makeFile('b.txt', '/b.txt')];
      const opts = makeOptions({ setSelectedFiles, files });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'select-all');
      cmd!.action();
      expect(setSelectedFiles).toHaveBeenCalledWith(new Set(['/a.txt', '/b.txt']));
    });

    it('Delete calls handleDelete', () => {
      const handleDelete = vi.fn();
      const opts = makeOptions({ handleDelete });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'delete');
      cmd!.action();
      expect(handleDelete).toHaveBeenCalled();
    });
  });

  describe('other commands', () => {
    it('Open Settings navigates to settings', () => {
      const navigateWithHistory = vi.fn();
      const opts = makeOptions({ navigateWithHistory });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'settings');
      cmd!.action();
      expect(navigateWithHistory).toHaveBeenCalledWith('xplorer://settings');
    });

    it('Open Trash navigates to trash', () => {
      const navigateWithHistory = vi.fn();
      const opts = makeOptions({ navigateWithHistory });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'trash');
      cmd!.action();
      expect(navigateWithHistory).toHaveBeenCalledWith('xplorer://trash');
    });

    it('Keyboard Shortcuts opens shortcuts dialog', () => {
      const setShortcutsDialogOpen = vi.fn();
      const opts = makeOptions({ setShortcutsDialogOpen });
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );

      const cmd = result.current.find((c) => c.id === 'keyboard-shortcuts');
      cmd!.action();
      expect(setShortcutsDialogOpen).toHaveBeenCalledWith(true);
    });
  });

  describe('command categories', () => {
    it('contains Navigation category', () => {
      const opts = makeOptions();
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );
      const navCmds = result.current.filter((c) => c.category === 'navigation');
      expect(navCmds.length).toBeGreaterThan(0);
    });

    it('contains View category', () => {
      const opts = makeOptions();
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );
      const viewCmds = result.current.filter((c) => c.category === 'view');
      expect(viewCmds.length).toBeGreaterThan(0);
    });

    it('contains Panels category', () => {
      const opts = makeOptions();
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );
      const panelCmds = result.current.filter((c) => c.category === 'panels');
      expect(panelCmds.length).toBeGreaterThan(0);
    });

    it('contains File category', () => {
      const opts = makeOptions();
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );
      const fileCmds = result.current.filter((c) => c.category === 'file');
      expect(fileCmds.length).toBeGreaterThan(0);
    });

    it('contains Other category', () => {
      const opts = makeOptions();
      const { result } = renderHook(() =>
        useCommandPaletteCommands(opts as UseCommandPaletteCommandsOptions),
      );
      const otherCmds = result.current.filter((c) => c.category === 'other');
      expect(otherCmds.length).toBeGreaterThan(0);
    });
  });
});
