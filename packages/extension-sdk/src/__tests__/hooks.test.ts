/**
 * Tests for the extension hooks:
 *   useCurrentPath, useSelectedFiles, navigateTo
 *
 * The hooks rely on the global `React` object (declared but not imported in
 * the hooks module) and `window.__xplorer_state__` / CustomEvent dispatching.
 *
 * We use @testing-library/react's renderHook + act to exercise them in a real
 * React render cycle.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';

// The hooks module accesses `React` as a global (declared const)
// so we must assign it before importing the hooks.
(globalThis as any).React = React;

import { useCurrentPath, useSelectedFiles, navigateTo } from '../hooks';

// ─── useCurrentPath ─────────────────────────────────────────────────────────

describe('useCurrentPath', () => {
  beforeEach(() => {
    delete (window as any).__xplorer_state__;
  });

  it('returns initial empty string when no state exists', () => {
    const { result } = renderHook(() => useCurrentPath());
    expect(result.current).toBe('');
  });

  it('returns initial path from __xplorer_state__', () => {
    (window as any).__xplorer_state__ = { currentPath: '/home/user', selectedFiles: [] };

    const { result } = renderHook(() => useCurrentPath());
    expect(result.current).toBe('/home/user');
  });

  it('updates on xplorer-state-change event with type=currentPath', () => {
    const { result } = renderHook(() => useCurrentPath());
    expect(result.current).toBe('');

    act(() => {
      window.dispatchEvent(
        new CustomEvent('xplorer-state-change', {
          detail: { type: 'currentPath', value: '/new/path' },
        }),
      );
    });

    expect(result.current).toBe('/new/path');
  });

  it('updates multiple times', () => {
    const { result } = renderHook(() => useCurrentPath());

    act(() => {
      window.dispatchEvent(
        new CustomEvent('xplorer-state-change', {
          detail: { type: 'currentPath', value: '/first' },
        }),
      );
    });
    expect(result.current).toBe('/first');

    act(() => {
      window.dispatchEvent(
        new CustomEvent('xplorer-state-change', {
          detail: { type: 'currentPath', value: '/second' },
        }),
      );
    });
    expect(result.current).toBe('/second');
  });

  it('ignores events with wrong type field', () => {
    const { result } = renderHook(() => useCurrentPath());

    act(() => {
      window.dispatchEvent(
        new CustomEvent('xplorer-state-change', {
          detail: { type: 'selectedFiles', value: [{ name: 'a', path: '/a', is_dir: false }] },
        }),
      );
    });

    expect(result.current).toBe('');
  });

  it('ignores events with non-string value for currentPath', () => {
    const { result } = renderHook(() => useCurrentPath());

    act(() => {
      window.dispatchEvent(
        new CustomEvent('xplorer-state-change', {
          detail: { type: 'currentPath', value: 123 },
        }),
      );
    });

    expect(result.current).toBe('');
  });

  it('ignores events with missing detail', () => {
    const { result } = renderHook(() => useCurrentPath());

    act(() => {
      window.dispatchEvent(new CustomEvent('xplorer-state-change'));
    });

    expect(result.current).toBe('');
  });

  it('ignores events with null detail', () => {
    const { result } = renderHook(() => useCurrentPath());

    act(() => {
      window.dispatchEvent(new CustomEvent('xplorer-state-change', { detail: null }));
    });

    expect(result.current).toBe('');
  });

  it('ignores events with non-object detail', () => {
    const { result } = renderHook(() => useCurrentPath());

    act(() => {
      window.dispatchEvent(new CustomEvent('xplorer-state-change', { detail: 'bad' }));
    });

    // 'bad' is typeof 'string', which is not 'object', so the handler returns early
    expect(result.current).toBe('');
  });

  it('cleans up event listener on unmount', () => {
    const removeListenerSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useCurrentPath());

    unmount();

    expect(removeListenerSpy).toHaveBeenCalledWith('xplorer-state-change', expect.any(Function));

    removeListenerSpy.mockRestore();
  });
});

// ─── useSelectedFiles ───────────────────────────────────────────────────────

describe('useSelectedFiles', () => {
  beforeEach(() => {
    delete (window as any).__xplorer_state__;
  });

  it('returns initial empty array when no state exists', () => {
    const { result } = renderHook(() => useSelectedFiles());
    expect(result.current).toEqual([]);
  });

  it('returns initial files from __xplorer_state__', () => {
    const files = [
      { name: 'a.txt', path: '/a.txt', is_dir: false },
      { name: 'b', path: '/b', is_dir: true },
    ];
    (window as any).__xplorer_state__ = { currentPath: '/', selectedFiles: files };

    const { result } = renderHook(() => useSelectedFiles());
    expect(result.current).toEqual(files);
  });

  it('updates on xplorer-state-change event with type=selectedFiles', () => {
    const { result } = renderHook(() => useSelectedFiles());
    expect(result.current).toEqual([]);

    const newFiles = [{ name: 'doc.pdf', path: '/doc.pdf', is_dir: false }];

    act(() => {
      window.dispatchEvent(
        new CustomEvent('xplorer-state-change', {
          detail: { type: 'selectedFiles', value: newFiles },
        }),
      );
    });

    expect(result.current).toEqual(newFiles);
  });

  it('ignores events with wrong type field', () => {
    const { result } = renderHook(() => useSelectedFiles());

    act(() => {
      window.dispatchEvent(
        new CustomEvent('xplorer-state-change', {
          detail: { type: 'currentPath', value: '/path' },
        }),
      );
    });

    expect(result.current).toEqual([]);
  });

  it('ignores events where value is not an array', () => {
    const { result } = renderHook(() => useSelectedFiles());

    act(() => {
      window.dispatchEvent(
        new CustomEvent('xplorer-state-change', {
          detail: { type: 'selectedFiles', value: 'not-an-array' },
        }),
      );
    });

    expect(result.current).toEqual([]);
  });

  it('ignores events where value is an object (not array)', () => {
    const { result } = renderHook(() => useSelectedFiles());

    act(() => {
      window.dispatchEvent(
        new CustomEvent('xplorer-state-change', {
          detail: { type: 'selectedFiles', value: { name: 'fake' } },
        }),
      );
    });

    expect(result.current).toEqual([]);
  });

  it('ignores events with null detail', () => {
    const { result } = renderHook(() => useSelectedFiles());

    act(() => {
      window.dispatchEvent(new CustomEvent('xplorer-state-change', { detail: null }));
    });

    expect(result.current).toEqual([]);
  });

  it('handles empty array update', () => {
    const { result } = renderHook(() => useSelectedFiles());

    // First set some files
    act(() => {
      window.dispatchEvent(
        new CustomEvent('xplorer-state-change', {
          detail: { type: 'selectedFiles', value: [{ name: 'x', path: '/x', is_dir: false }] },
        }),
      );
    });
    expect(result.current).toHaveLength(1);

    // Then clear them
    act(() => {
      window.dispatchEvent(
        new CustomEvent('xplorer-state-change', {
          detail: { type: 'selectedFiles', value: [] },
        }),
      );
    });
    expect(result.current).toEqual([]);
  });

  it('cleans up event listener on unmount', () => {
    const removeListenerSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useSelectedFiles());

    unmount();

    expect(removeListenerSpy).toHaveBeenCalledWith('xplorer-state-change', expect.any(Function));

    removeListenerSpy.mockRestore();
  });
});

// ─── navigateTo ─────────────────────────────────────────────────────────────

describe('navigateTo', () => {
  beforeEach(() => {
    delete (window as any).__xplorer_state__;
  });

  it('calls __xplorer_state__.navigateTo when available', () => {
    const navFn = jest.fn();
    (window as any).__xplorer_state__ = {
      currentPath: '/',
      selectedFiles: [],
      navigateTo: navFn,
    };

    navigateTo('/new/dir');

    expect(navFn).toHaveBeenCalledWith('/new/dir');
  });

  it('does nothing when __xplorer_state__ is not set', () => {
    // Should not throw
    expect(() => navigateTo('/some/path')).not.toThrow();
  });

  it('does nothing when navigateTo function is not on state', () => {
    (window as any).__xplorer_state__ = {
      currentPath: '/',
      selectedFiles: [],
      // no navigateTo
    };

    expect(() => navigateTo('/path')).not.toThrow();
  });
});
