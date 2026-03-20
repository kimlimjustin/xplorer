import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useVimMode,
  isVimModeEnabled,
  setVimModeSetting,
  isVimLearningModeEnabled,
  setVimLearningModeSetting,
  type UseVimModeOptions,
  type VimModeActions,
} from '@/hooks/use-vim-mode';
import type { FileEntry } from '@/lib/tauri-api';

const makeFile = (name: string, path: string, is_dir = false): FileEntry => {
  return { name, path, is_dir, size: 100, modified: Date.now(), file_type: is_dir ? 'dir' : 'file' };
};

const makeActions = (): VimModeActions => {
  return {
    navigateToPath: vi.fn(),
    navigateUp: vi.fn(),
    openFile: vi.fn(),
    setSelectedFiles: vi.fn(),
    setSelectedFile: vi.fn(),
    focusSearch: vi.fn(),
    copyFiles: vi.fn(),
    pasteFiles: vi.fn(),
    deleteFiles: vi.fn(),
    renameFile: vi.fn(),
    addBookmark: vi.fn(),
    refetch: vi.fn(),
    toast: vi.fn(),
  };
};

const makeOptions = (overrides: Partial<UseVimModeOptions> = {}): UseVimModeOptions => {
  return {
    enabled: true,
    files: [
      makeFile('a.txt', '/a.txt'),
      makeFile('b.txt', '/b.txt'),
      makeFile('c.txt', '/c.txt'),
      makeFile('folder', '/folder', true),
    ],
    selectedFiles: new Set<string>(),
    currentPath: '/home/user',
    clipboard: null,
    actions: makeActions(),
    ...overrides,
  };
};

const pressKey = (key: string, opts: Partial<KeyboardEventInit> = {}) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  document.dispatchEvent(event);
};

describe('Vim mode utility functions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isVimModeEnabled', () => {
    it('returns false when not set', () => {
      expect(isVimModeEnabled()).toBe(false);
    });

    it('returns true when set to "true"', () => {
      localStorage.setItem('xplorer-vim-mode', 'true');
      expect(isVimModeEnabled()).toBe(true);
    });

    it('returns false for other values', () => {
      localStorage.setItem('xplorer-vim-mode', 'false');
      expect(isVimModeEnabled()).toBe(false);
    });
  });

  describe('setVimModeSetting', () => {
    it('sets localStorage to "true"', () => {
      setVimModeSetting(true);
      expect(localStorage.getItem('xplorer-vim-mode')).toBe('true');
    });

    it('sets localStorage to "false"', () => {
      setVimModeSetting(false);
      expect(localStorage.getItem('xplorer-vim-mode')).toBe('false');
    });
  });

  describe('isVimLearningModeEnabled', () => {
    it('returns false when not set', () => {
      expect(isVimLearningModeEnabled()).toBe(false);
    });

    it('returns true when set', () => {
      localStorage.setItem('xplorer-vim-learning-mode', 'true');
      expect(isVimLearningModeEnabled()).toBe(true);
    });
  });

  describe('setVimLearningModeSetting', () => {
    it('persists the value', () => {
      setVimLearningModeSetting(true);
      expect(localStorage.getItem('xplorer-vim-learning-mode')).toBe('true');
    });
  });
});

describe('useVimMode hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts in normal mode', () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useVimMode(opts));

      expect(result.current.mode).toBe('normal');
      expect(result.current.visualAnchor).toBeNull();
      expect(result.current.pendingKeys).toBe('');
    });

    it('reflects enabled from options', () => {
      const opts = makeOptions({ enabled: false });
      const { result } = renderHook(() => useVimMode(opts));
      expect(result.current.enabled).toBe(false);
    });
  });

  describe('j/k navigation', () => {
    it('j moves selection down', () => {
      const actions = makeActions();
      const opts = makeOptions({
        actions,
        selectedFiles: new Set(['/a.txt']),
      });
      renderHook(() => useVimMode(opts));

      act(() => { pressKey('j'); });

      expect(actions.setSelectedFiles).toHaveBeenCalled();
      expect(actions.setSelectedFile).toHaveBeenCalled();
    });

    it('k moves selection up', () => {
      const actions = makeActions();
      const opts = makeOptions({
        actions,
        selectedFiles: new Set(['/b.txt']),
      });
      renderHook(() => useVimMode(opts));

      act(() => { pressKey('k'); });

      expect(actions.setSelectedFiles).toHaveBeenCalled();
      expect(actions.setSelectedFile).toHaveBeenCalled();
    });
  });

  describe('h/l navigation', () => {
    it('h navigates to parent', () => {
      const actions = makeActions();
      const opts = makeOptions({ actions });
      renderHook(() => useVimMode(opts));

      act(() => { pressKey('h'); });

      expect(actions.navigateUp).toHaveBeenCalled();
    });

    it('l opens entry (directory navigation)', () => {
      const actions = makeActions();
      // Select a directory
      const opts = makeOptions({
        actions,
        selectedFiles: new Set(['/folder']),
      });
      renderHook(() => useVimMode(opts));

      act(() => { pressKey('l'); });

      expect(actions.navigateToPath).toHaveBeenCalledWith('/folder');
    });
  });

  describe('G goes to last file', () => {
    it('selects the last file', () => {
      const actions = makeActions();
      const opts = makeOptions({ actions });
      renderHook(() => useVimMode(opts));

      act(() => { pressKey('G'); });

      // Last file index is 3 (files has 4 entries)
      expect(actions.setSelectedFiles).toHaveBeenCalled();
      expect(actions.setSelectedFile).toHaveBeenCalled();
    });
  });

  describe('gg goes to first file', () => {
    it('selects the first file via gg sequence', () => {
      const actions = makeActions();
      const opts = makeOptions({
        actions,
        selectedFiles: new Set(['/c.txt']),
      });
      renderHook(() => useVimMode(opts));

      act(() => {
        pressKey('g');
        pressKey('g');
      });

      expect(actions.setSelectedFiles).toHaveBeenCalled();
      expect(actions.setSelectedFile).toHaveBeenCalled();
    });
  });

  describe('dd deletes', () => {
    it('calls deleteFiles on dd sequence', () => {
      const actions = makeActions();
      const opts = makeOptions({
        actions,
        selectedFiles: new Set(['/a.txt']),
      });
      renderHook(() => useVimMode(opts));

      act(() => {
        pressKey('d');
        pressKey('d');
      });

      expect(actions.deleteFiles).toHaveBeenCalled();
    });
  });

  describe('yy copies', () => {
    it('calls copyFiles on yy sequence', () => {
      const actions = makeActions();
      const opts = makeOptions({
        actions,
        selectedFiles: new Set(['/b.txt']),
      });
      renderHook(() => useVimMode(opts));

      act(() => {
        pressKey('y');
        pressKey('y');
      });

      expect(actions.copyFiles).toHaveBeenCalled();
    });
  });

  describe('p pastes', () => {
    it('calls pasteFiles', () => {
      const actions = makeActions();
      const opts = makeOptions({ actions });
      renderHook(() => useVimMode(opts));

      act(() => { pressKey('p'); });

      expect(actions.pasteFiles).toHaveBeenCalled();
    });
  });

  describe('/ focuses search', () => {
    it('calls focusSearch', () => {
      const actions = makeActions();
      const opts = makeOptions({ actions });
      renderHook(() => useVimMode(opts));

      act(() => { pressKey('/'); });

      expect(actions.focusSearch).toHaveBeenCalled();
    });
  });

  describe('r renames', () => {
    it('calls renameFile on current selection', () => {
      const actions = makeActions();
      const opts = makeOptions({
        actions,
        selectedFiles: new Set(['/a.txt']),
      });
      renderHook(() => useVimMode(opts));

      act(() => { pressKey('r'); });

      expect(actions.renameFile).toHaveBeenCalled();
    });
  });

  describe('m bookmarks', () => {
    it('calls addBookmark with current path', () => {
      const actions = makeActions();
      const opts = makeOptions({
        actions,
        currentPath: '/home/user/docs',
      });
      renderHook(() => useVimMode(opts));

      act(() => { pressKey('m'); });

      expect(actions.addBookmark).toHaveBeenCalledWith('/home/user/docs');
    });
  });

  describe('v toggles visual mode', () => {
    it('switches to visual mode on v', () => {
      const actions = makeActions();
      const opts = makeOptions({
        actions,
        selectedFiles: new Set(['/a.txt']),
      });
      const { result } = renderHook(() => useVimMode(opts));

      act(() => { pressKey('v'); });

      expect(result.current.mode).toBe('visual');
    });

    it('switches back to normal on second v', () => {
      const actions = makeActions();
      const opts = makeOptions({
        actions,
        selectedFiles: new Set(['/a.txt']),
      });
      const { result } = renderHook(() => useVimMode(opts));

      act(() => { pressKey('v'); });
      expect(result.current.mode).toBe('visual');

      act(() => { pressKey('v'); });
      expect(result.current.mode).toBe('normal');
    });
  });

  describe('i enters insert mode', () => {
    it('switches to insert mode', () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useVimMode(opts));

      act(() => { pressKey('i'); });

      expect(result.current.mode).toBe('insert');
    });

    it('Escape from insert returns to normal', () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useVimMode(opts));

      act(() => { pressKey('i'); });
      expect(result.current.mode).toBe('insert');

      act(() => { pressKey('Escape'); });
      expect(result.current.mode).toBe('normal');
    });
  });

  describe('Escape in normal mode', () => {
    it('clears selection', () => {
      const actions = makeActions();
      const opts = makeOptions({ actions });
      renderHook(() => useVimMode(opts));

      act(() => { pressKey('Escape'); });

      expect(actions.setSelectedFiles).toHaveBeenCalledWith(new Set());
      expect(actions.setSelectedFile).toHaveBeenCalledWith(null);
    });
  });

  describe(': enters command mode', () => {
    it('dispatches vim-command-mode event', () => {
      const opts = makeOptions();
      renderHook(() => useVimMode(opts));
      const eventSpy = vi.fn();
      window.addEventListener('vim-command-mode', eventSpy);

      act(() => { pressKey(':'); });

      expect(eventSpy).toHaveBeenCalled();
      window.removeEventListener('vim-command-mode', eventSpy);
    });
  });

  describe('disabled state', () => {
    it('does not respond to keys when disabled', () => {
      const actions = makeActions();
      const opts = makeOptions({ enabled: false, actions });
      renderHook(() => useVimMode(opts));

      act(() => { pressKey('j'); });

      expect(actions.setSelectedFiles).not.toHaveBeenCalled();
    });
  });

  describe('ignores keys in inputs', () => {
    it('does not intercept keydown when target is an INPUT', () => {
      const actions = makeActions();
      const opts = makeOptions({ actions });
      renderHook(() => useVimMode(opts));

      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: 'j',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: input });
      document.dispatchEvent(event);

      expect(actions.setSelectedFiles).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });
  });

  describe('ignores modifier keys', () => {
    it('does not intercept Ctrl+key', () => {
      const actions = makeActions();
      const opts = makeOptions({ actions });
      renderHook(() => useVimMode(opts));

      act(() => { pressKey('j', { ctrlKey: true }); });

      expect(actions.setSelectedFiles).not.toHaveBeenCalled();
    });
  });

  describe('pending key timeout', () => {
    it('clears pending key after 500ms timeout', () => {
      const actions = makeActions();
      const opts = makeOptions({ actions });
      const { result } = renderHook(() => useVimMode(opts));

      act(() => { pressKey('g'); });
      expect(result.current.pendingKeys).toBe('g');

      act(() => { vi.advanceTimersByTime(600); });
      expect(result.current.pendingKeys).toBe('');
    });
  });

  describe('. repeat', () => {
    it('repeats the last action', () => {
      const actions = makeActions();
      const opts = makeOptions({ actions });
      renderHook(() => useVimMode(opts));

      act(() => { pressKey('p'); });
      expect(actions.pasteFiles).toHaveBeenCalledTimes(1);

      act(() => { pressKey('.'); });
      expect(actions.pasteFiles).toHaveBeenCalledTimes(2);
    });
  });
});
