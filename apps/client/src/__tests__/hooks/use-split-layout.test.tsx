import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// We need to mock localStorage before the hook module is imported
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

import { useSplitLayout } from '@/hooks/use-split-layout';

describe('useSplitLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('creates default layout when localStorage is empty', () => {
      const { result } = renderHook(() => useSplitLayout());

      expect(result.current.state).toBeDefined();
      expect(result.current.state.rootNode).toBeDefined();
      expect(result.current.state.rootNode.type).toBe('leaf');
      expect(result.current.state.activeGroupId).toBeDefined();
      expect(result.current.activeGroup).toBeDefined();
    });

    it('has a default group with a Home tab', () => {
      const { result } = renderHook(() => useSplitLayout());

      const group = result.current.activeGroup;
      expect(group.tabs).toHaveLength(1);
      expect(group.tabs[0].name).toBe('Home');
      expect(group.tabs[0].path).toBe('xplorer://home');
      expect(group.currentPath).toBe('xplorer://home');
    });

    it('has correct initial path history', () => {
      const { result } = renderHook(() => useSplitLayout());

      const group = result.current.activeGroup;
      expect(group.pathHistory).toEqual(['xplorer://home']);
      expect(group.historyIndex).toBe(0);
    });
  });

  describe('Navigation', () => {
    it('navigates to a new path', () => {
      const { result } = renderHook(() => useSplitLayout());
      const groupId = result.current.state.activeGroupId;

      act(() => {
        result.current.navigate(groupId, 'C:\\Users\\Test', 'Test');
      });

      expect(result.current.activeGroup.currentPath).toBe('C:\\Users\\Test');
      expect(result.current.activeGroup.pathHistory).toContain('C:\\Users\\Test');
    });

    it('can navigate back', () => {
      const { result } = renderHook(() => useSplitLayout());
      const groupId = result.current.state.activeGroupId;

      act(() => {
        result.current.navigate(groupId, 'C:\\Users\\Test', 'Test');
      });
      act(() => {
        result.current.navigateBack(groupId);
      });

      expect(result.current.activeGroup.currentPath).toBe('xplorer://home');
    });

    it('can navigate forward after going back', () => {
      const { result } = renderHook(() => useSplitLayout());
      const groupId = result.current.state.activeGroupId;

      act(() => {
        result.current.navigate(groupId, 'C:\\Users\\Test', 'Test');
      });
      act(() => {
        result.current.navigateBack(groupId);
      });
      act(() => {
        result.current.navigateForward(groupId);
      });

      expect(result.current.activeGroup.currentPath).toBe('C:\\Users\\Test');
    });
  });

  describe('Path History Limit', () => {
    it('caps path history to MAX 200 entries', () => {
      const { result } = renderHook(() => useSplitLayout());
      const groupId = result.current.state.activeGroupId;

      // Navigate 250 times
      for (let i = 0; i < 250; i++) {
        act(() => {
          result.current.navigate(groupId, `/path/${i}`, `dir${i}`);
        });
      }

      // The path history should be capped at 200
      expect(result.current.activeGroup.pathHistory.length).toBeLessThanOrEqual(200);
    });

    it('keeps the most recent paths when trimming', () => {
      const { result } = renderHook(() => useSplitLayout());
      const groupId = result.current.state.activeGroupId;

      for (let i = 0; i < 250; i++) {
        act(() => {
          result.current.navigate(groupId, `/path/${i}`, `dir${i}`);
        });
      }

      const history = result.current.activeGroup.pathHistory;
      // The last entry should be the most recent navigation
      expect(history[history.length - 1]).toBe('/path/249');
      // The history index should point to the last element
      expect(result.current.activeGroup.historyIndex).toBe(history.length - 1);
    });
  });

  describe('Corrupted localStorage', () => {
    it('handles corrupted JSON in localStorage gracefully', () => {
      localStorageMock.setItem('xplorer:split-layout', 'not valid json {{');

      const { result } = renderHook(() => useSplitLayout());

      // Should fall back to defaults
      expect(result.current.state.rootNode.type).toBe('leaf');
      expect(result.current.activeGroup.tabs).toHaveLength(1);
    });

    it('handles invalid object shape in localStorage gracefully', () => {
      localStorageMock.setItem('xplorer:split-layout', JSON.stringify({ foo: 'bar' }));

      const { result } = renderHook(() => useSplitLayout());

      // Should fall back to defaults because rootNode and groups are missing
      expect(result.current.state.rootNode.type).toBe('leaf');
      expect(result.current.activeGroup.tabs).toHaveLength(1);
    });

    it('handles null value in localStorage gracefully', () => {
      localStorageMock.setItem('xplorer:split-layout', 'null');

      const { result } = renderHook(() => useSplitLayout());

      expect(result.current.state.rootNode.type).toBe('leaf');
      expect(result.current.activeGroup.tabs).toHaveLength(1);
    });
  });

  describe('Tabs', () => {
    it('adds a new tab', () => {
      const { result } = renderHook(() => useSplitLayout());
      const groupId = result.current.state.activeGroupId;

      act(() => {
        result.current.addTab(groupId, {
          id: 'tab-new',
          name: 'Documents',
          path: 'C:\\Documents',
          type: 'folder',
        });
      });

      expect(result.current.activeGroup.tabs).toHaveLength(2);
      expect(result.current.activeGroup.tabs[1].name).toBe('Documents');
    });

    it('switches to an existing tab', () => {
      const { result } = renderHook(() => useSplitLayout());
      const groupId = result.current.state.activeGroupId;

      act(() => {
        result.current.addTab(groupId, {
          id: 'tab-new',
          name: 'Documents',
          path: 'C:\\Documents',
          type: 'folder',
        });
      });

      const homeTabId = result.current.activeGroup.tabs[0].id;

      act(() => {
        result.current.switchTab(groupId, homeTabId);
      });

      expect(result.current.activeGroup.activeTabId).toBe(homeTabId);
      expect(result.current.activeGroup.currentPath).toBe('xplorer://home');
    });

    it('closes a tab', () => {
      const { result } = renderHook(() => useSplitLayout());
      const groupId = result.current.state.activeGroupId;

      act(() => {
        result.current.addTab(groupId, {
          id: 'tab-new',
          name: 'Documents',
          path: 'C:\\Documents',
          type: 'folder',
        });
      });

      act(() => {
        result.current.closeTab(groupId, 'tab-new');
      });

      expect(result.current.activeGroup.tabs).toHaveLength(1);
    });
  });

  describe('Persistence', () => {
    it('saves layout to localStorage on state change', () => {
      const { result } = renderHook(() => useSplitLayout());
      const groupId = result.current.state.activeGroupId;

      act(() => {
        result.current.navigate(groupId, 'C:\\Test', 'Test');
      });

      // Flush debounced save
      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'xplorer:split-layout',
        expect.any(String),
      );
    });
  });
});
