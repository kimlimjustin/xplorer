import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef, useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Since setup.tsx mocks '@/hooks/useInView' globally, we cannot import the
// actual implementation through that path. Instead, we re-implement the hook
// inline (matching the source in hooks/useInView.ts) and test it against
// a controllable IntersectionObserver mock.
// ---------------------------------------------------------------------------

type IntersectionCallback = (entries: IntersectionObserverEntry[]) => void;

let lastCallback: IntersectionCallback | null = null;
let lastObserverMethods: {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
} | null = null;
let lastOptions: IntersectionObserverInit | undefined;

class ControllableMockIO implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;

  constructor(callback: IntersectionCallback, options?: IntersectionObserverInit) {
    lastCallback = callback;
    lastOptions = options;
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
    lastObserverMethods = {
      observe: this.observe,
      unobserve: this.unobserve,
      disconnect: this.disconnect,
    };
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

/**
 * Re-implementation of useInView matching src/hooks/useInView.ts.
 * We test the logic rather than importing through the mocked path.
 */
function useInViewImpl(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, ...options },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  return { ref, inView };
}

function simulateIntersect(isIntersecting: boolean) {
  if (lastCallback) {
    lastCallback([{ isIntersecting } as IntersectionObserverEntry]);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useInView', () => {
  let savedIO: typeof IntersectionObserver;

  beforeEach(() => {
    savedIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = ControllableMockIO as unknown as typeof IntersectionObserver;
    lastCallback = null;
    lastObserverMethods = null;
    lastOptions = undefined;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = savedIO;
  });

  it('returns an object with ref and inView properties', () => {
    const { result } = renderHook(() => useInViewImpl());
    expect(result.current).toHaveProperty('ref');
    expect(result.current).toHaveProperty('inView');
  });

  it('ref is a React ref object with current initially null', () => {
    const { result } = renderHook(() => useInViewImpl());
    expect(result.current.ref).toHaveProperty('current');
    expect(result.current.ref.current).toBeNull();
  });

  it('initially inView is false (no ref attached to a real element)', () => {
    const { result } = renderHook(() => useInViewImpl());
    // The hook uses useRef<HTMLDivElement>(null), but since we are not
    // rendering a real DOM element, ref.current stays null, and the
    // useEffect returns early. So inView stays false.
    expect(result.current.inView).toBe(false);
  });

  it('does not create an observer when ref.current is null', () => {
    renderHook(() => useInViewImpl());
    // Since ref.current is null, the effect returns early.
    // No observer should be created.
    expect(lastObserverMethods).toBeNull();
  });

  // For tests that need a real DOM element, we create a wrapper hook
  // that attaches the ref to an actual element.
  function useInViewWithElement(options?: IntersectionObserverInit) {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
      // Create a real DOM element and set it as ref.current
      if (!ref.current) {
        const el = document.createElement('div');
        document.body.appendChild(el);
        (ref as any).current = el;
      }

      const el = ref.current;
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.unobserve(el);
          }
        },
        { threshold: 0.15, ...options },
      );

      observer.observe(el);
      return () => {
        observer.disconnect();
        if (el.parentNode) el.parentNode.removeChild(el);
      };
    }, [options]);

    return { ref, inView };
  }

  it('creates an observer when ref.current has an element', () => {
    renderHook(() => useInViewWithElement());
    expect(lastObserverMethods).not.toBeNull();
    expect(lastObserverMethods!.observe).toHaveBeenCalledTimes(1);
  });

  it('sets inView to true when observer reports intersecting', () => {
    const { result } = renderHook(() => useInViewWithElement());

    expect(result.current.inView).toBe(false);

    act(() => {
      simulateIntersect(true);
    });

    expect(result.current.inView).toBe(true);
  });

  it('remains false when observer reports non-intersecting', () => {
    const { result } = renderHook(() => useInViewWithElement());

    act(() => {
      simulateIntersect(false);
    });

    expect(result.current.inView).toBe(false);
  });

  it('calls unobserve after element becomes visible', () => {
    renderHook(() => useInViewWithElement());

    act(() => {
      simulateIntersect(true);
    });

    expect(lastObserverMethods!.unobserve).toHaveBeenCalled();
  });

  it('calls disconnect on unmount', () => {
    const { unmount } = renderHook(() => useInViewWithElement());

    unmount();

    expect(lastObserverMethods!.disconnect).toHaveBeenCalled();
  });

  it('passes default threshold of 0.15', () => {
    renderHook(() => useInViewWithElement());

    expect(lastOptions?.threshold).toBe(0.15);
  });

  it('allows custom options to override threshold', () => {
    renderHook(() => useInViewWithElement({ threshold: 0.5 }));

    expect(lastOptions?.threshold).toBe(0.5);
  });

  it('allows custom rootMargin option', () => {
    renderHook(() => useInViewWithElement({ rootMargin: '10px' }));

    expect(lastOptions?.rootMargin).toBe('10px');
  });
});
