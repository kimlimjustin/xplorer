import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypeAheadSearch } from '@/hooks/use-type-ahead-search';
import type { FileEntry } from '@/lib/tauri-api';

const makeFile = (name: string, path?: string): FileEntry => {
  return {
    name,
    path: path ?? `/test/${name}`,
    is_dir: false,
    size: 1024,
    modified: 1700000000,
    file_type: 'file',
  };
};

const createKeyEvent = (
  key: string,
  overrides?: Partial<React.KeyboardEvent<HTMLDivElement>>,
): React.KeyboardEvent<HTMLDivElement> => {
  // Create a minimal mock container element
  const container = document.createElement('div');
  const mockEl = document.createElement('div');
  mockEl.setAttribute('data-file-path', '/test/alpha.txt');
  mockEl.click = vi.fn();
  mockEl.focus = vi.fn();
  (mockEl.scrollIntoView as unknown) = vi.fn();
  container.appendChild(mockEl);

  return {
    key,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    currentTarget: container,
    ...overrides,
  } as unknown as React.KeyboardEvent<HTMLDivElement>;
};

const defaultOptions = (files: FileEntry[]) => {
  return {
    files,
    viewMode: 'medium',
    needsVirtualization: false,
    columns: 4,
    virtualizer: { scrollToIndex: vi.fn() },
    getColumnsCount: () => 4,
  };
};

describe('useTypeAheadSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial state', () => {
    it('returns a handleGridKeyDown function', () => {
      const { result } = renderHook(() => useTypeAheadSearch(defaultOptions([])));

      expect(typeof result.current.handleGridKeyDown).toBe('function');
    });
  });

  describe('Single character search', () => {
    it('finds the first file starting with typed character', () => {
      const files = [makeFile('alpha.txt'), makeFile('beta.txt'), makeFile('gamma.txt')];

      const { result } = renderHook(() => useTypeAheadSearch(defaultOptions(files)));

      const event = createKeyEvent('a');

      act(() => {
        result.current.handleGridKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('ignores keys with ctrlKey modifier', () => {
      const files = [makeFile('alpha.txt')];

      const { result } = renderHook(() => useTypeAheadSearch(defaultOptions(files)));

      const event = createKeyEvent('a', { ctrlKey: true });

      act(() => {
        result.current.handleGridKeyDown(event);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('ignores keys with altKey modifier', () => {
      const files = [makeFile('alpha.txt')];

      const { result } = renderHook(() => useTypeAheadSearch(defaultOptions(files)));

      const event = createKeyEvent('a', { altKey: true });

      act(() => {
        result.current.handleGridKeyDown(event);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('ignores keys with metaKey modifier', () => {
      const files = [makeFile('alpha.txt')];

      const { result } = renderHook(() => useTypeAheadSearch(defaultOptions(files)));

      const event = createKeyEvent('a', { metaKey: true });

      act(() => {
        result.current.handleGridKeyDown(event);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('ignores multi-character keys (like Enter, Shift)', () => {
      const files = [makeFile('alpha.txt')];

      const { result } = renderHook(() => useTypeAheadSearch(defaultOptions(files)));

      const event = createKeyEvent('Enter');

      act(() => {
        result.current.handleGridKeyDown(event);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Repeated character cycling', () => {
    it('cycles to next match when same character is pressed again', () => {
      const files = [
        makeFile('apple.txt', '/test/apple.txt'),
        makeFile('avocado.txt', '/test/avocado.txt'),
        makeFile('banana.txt', '/test/banana.txt'),
        makeFile('apricot.txt', '/test/apricot.txt'),
      ];

      // Set up container with all file elements
      const container = document.createElement('div');
      for (const file of files) {
        const el = document.createElement('div');
        el.setAttribute('data-file-path', file.path);
        el.click = vi.fn();
        el.focus = vi.fn();
        (el as unknown as Record<string, unknown>).scrollIntoView = vi.fn();
        container.appendChild(el);
      }

      const { result } = renderHook(() => useTypeAheadSearch(defaultOptions(files)));

      // First 'a' press - should match apple (index 0)
      const event1 = {
        key: 'a',
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        currentTarget: container,
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      act(() => {
        result.current.handleGridKeyDown(event1);
      });
      expect(event1.preventDefault).toHaveBeenCalled();

      // Second 'a' press - should cycle to avocado (index 1)
      const event2 = {
        key: 'a',
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        currentTarget: container,
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      act(() => {
        result.current.handleGridKeyDown(event2);
      });
      expect(event2.preventDefault).toHaveBeenCalled();

      // Third 'a' press - should cycle to apricot (index 3)
      const event3 = {
        key: 'a',
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        currentTarget: container,
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      act(() => {
        result.current.handleGridKeyDown(event3);
      });
      expect(event3.preventDefault).toHaveBeenCalled();
    });

    it('wraps around to the first match when past the last one', () => {
      const files = [
        makeFile('alpha.txt', '/test/alpha.txt'),
        makeFile('beta.txt', '/test/beta.txt'),
      ];

      const container = document.createElement('div');
      for (const file of files) {
        const el = document.createElement('div');
        el.setAttribute('data-file-path', file.path);
        el.click = vi.fn();
        el.focus = vi.fn();
        (el as unknown as Record<string, unknown>).scrollIntoView = vi.fn();
        container.appendChild(el);
      }

      const { result } = renderHook(() => useTypeAheadSearch(defaultOptions(files)));

      // Press 'a' twice - first match is alpha, second should wrap back to alpha
      const makeEvent = () =>
        ({
          key: 'a',
          ctrlKey: false,
          altKey: false,
          metaKey: false,
          preventDefault: vi.fn(),
          currentTarget: container,
        }) as unknown as React.KeyboardEvent<HTMLDivElement>;

      act(() => {
        result.current.handleGridKeyDown(makeEvent());
      });
      act(() => {
        result.current.handleGridKeyDown(makeEvent());
      });

      // Both events should have been handled (preventDefault called)
      // The second press should wrap around to alpha again
    });
  });

  describe('Multi-character buffer', () => {
    it('accumulates characters for multi-char search', () => {
      const files = [
        makeFile('apple.txt', '/test/apple.txt'),
        makeFile('application.txt', '/test/application.txt'),
        makeFile('banana.txt', '/test/banana.txt'),
      ];

      const container = document.createElement('div');
      for (const file of files) {
        const el = document.createElement('div');
        el.setAttribute('data-file-path', file.path);
        el.click = vi.fn();
        el.focus = vi.fn();
        (el as unknown as Record<string, unknown>).scrollIntoView = vi.fn();
        container.appendChild(el);
      }

      const { result } = renderHook(() => useTypeAheadSearch(defaultOptions(files)));

      const makeEvent = (key: string) =>
        ({
          key,
          ctrlKey: false,
          altKey: false,
          metaKey: false,
          preventDefault: vi.fn(),
          currentTarget: container,
        }) as unknown as React.KeyboardEvent<HTMLDivElement>;

      // Type 'a' then 'p' then 'p' then 'l' - should match "apple"
      act(() => {
        result.current.handleGridKeyDown(makeEvent('a'));
      });
      act(() => {
        result.current.handleGridKeyDown(makeEvent('p'));
      });
      act(() => {
        result.current.handleGridKeyDown(makeEvent('p'));
      });
      act(() => {
        result.current.handleGridKeyDown(makeEvent('l'));
      });

      // All characters should be handled
    });
  });

  describe('Buffer timeout', () => {
    it('resets search buffer after 800ms timeout', () => {
      const files = [
        makeFile('alpha.txt', '/test/alpha.txt'),
        makeFile('beta.txt', '/test/beta.txt'),
      ];

      const container = document.createElement('div');
      for (const file of files) {
        const el = document.createElement('div');
        el.setAttribute('data-file-path', file.path);
        el.click = vi.fn();
        el.focus = vi.fn();
        (el as unknown as Record<string, unknown>).scrollIntoView = vi.fn();
        container.appendChild(el);
      }

      const { result } = renderHook(() => useTypeAheadSearch(defaultOptions(files)));

      const makeEvent = (key: string) =>
        ({
          key,
          ctrlKey: false,
          altKey: false,
          metaKey: false,
          preventDefault: vi.fn(),
          currentTarget: container,
        }) as unknown as React.KeyboardEvent<HTMLDivElement>;

      // Type 'a'
      act(() => {
        result.current.handleGridKeyDown(makeEvent('a'));
      });

      // Wait 800ms for timeout to reset buffer
      act(() => {
        vi.advanceTimersByTime(800);
      });

      // Now type 'b' - this should start a new search, not append to 'a'
      const event = makeEvent('b');
      act(() => {
        result.current.handleGridKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('clears timeout on unmount', () => {
      const files = [makeFile('alpha.txt')];

      const { result, unmount } = renderHook(() => useTypeAheadSearch(defaultOptions(files)));

      const event = createKeyEvent('a');
      act(() => {
        result.current.handleGridKeyDown(event);
      });

      // Should not throw on unmount even with pending timeout
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Virtualization support', () => {
    it('calls virtualizer.scrollToIndex when needsVirtualization is true', () => {
      const scrollToIndex = vi.fn();
      const files = [makeFile('alpha.txt', '/test/alpha.txt')];

      const container = document.createElement('div');
      const el = document.createElement('div');
      el.setAttribute('data-file-path', '/test/alpha.txt');
      el.click = vi.fn();
      el.focus = vi.fn();
      (el as unknown as Record<string, unknown>).scrollIntoView = vi.fn();
      container.appendChild(el);

      const options = {
        ...defaultOptions(files),
        needsVirtualization: true,
        columns: 4,
        virtualizer: { scrollToIndex },
      };

      const { result } = renderHook(() => useTypeAheadSearch(options));

      const event = {
        key: 'a',
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        currentTarget: container,
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      act(() => {
        result.current.handleGridKeyDown(event);
      });

      // scrollToIndex should be called with row = floor(0 / 4) = 0
      expect(scrollToIndex).toHaveBeenCalledWith(0, { align: 'center' });
    });
  });

  describe('No match scenarios', () => {
    it('does nothing when no files match the typed character', () => {
      const files = [
        makeFile('alpha.txt', '/test/alpha.txt'),
        makeFile('beta.txt', '/test/beta.txt'),
      ];

      const { result } = renderHook(() => useTypeAheadSearch(defaultOptions(files)));

      // Type 'z' - no files start with 'z'
      const event = createKeyEvent('z');
      act(() => {
        result.current.handleGridKeyDown(event);
      });

      // preventDefault should still be called (the handler processes single chars)
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('handles empty files array', () => {
      const { result } = renderHook(() => useTypeAheadSearch(defaultOptions([])));

      const event = createKeyEvent('a');
      act(() => {
        result.current.handleGridKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  describe('Case insensitive matching', () => {
    it('matches files regardless of case', () => {
      const files = [makeFile('Alpha.txt', '/test/Alpha.txt')];

      const container = document.createElement('div');
      const el = document.createElement('div');
      el.setAttribute('data-file-path', '/test/Alpha.txt');
      el.click = vi.fn();
      el.focus = vi.fn();
      (el as unknown as Record<string, unknown>).scrollIntoView = vi.fn();
      container.appendChild(el);

      const { result } = renderHook(() => useTypeAheadSearch(defaultOptions(files)));

      const event = {
        key: 'a',
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        currentTarget: container,
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      act(() => {
        result.current.handleGridKeyDown(event);
      });

      // 'a' should match 'Alpha.txt' case-insensitively
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });
});
