import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast, toast, reducer } from '@/hooks/use-toast';

vi.mock('@/hooks/use-notification-history', () => ({
  addNotification: vi.fn(),
}));

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clean up global toast state before each test
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.remove();
    });
  });

  afterEach(() => {
    // Clean up after each test
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.remove();
    });
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Initial state', () => {
    it('starts with empty toasts array', () => {
      const { result } = renderHook(() => useToast());
      expect(result.current.toasts).toEqual([]);
    });

    it('provides toast function', () => {
      const { result } = renderHook(() => useToast());
      expect(typeof result.current.toast).toBe('function');
    });

    it('provides dismiss function', () => {
      const { result } = renderHook(() => useToast());
      expect(typeof result.current.dismiss).toBe('function');
    });

    it('provides remove function', () => {
      const { result } = renderHook(() => useToast());
      expect(typeof result.current.remove).toBe('function');
    });
  });

  describe('Adding toasts', () => {
    it('adds a toast with title', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({ title: 'Test Toast' });
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Test Toast');
      expect(result.current.toasts[0].open).toBe(true);
    });

    it('adds a toast with title and description', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({ title: 'Success', description: 'File saved' });
      });

      expect(result.current.toasts[0].title).toBe('Success');
      expect(result.current.toasts[0].description).toBe('File saved');
    });

    it('adds a destructive toast', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({ title: 'Error', variant: 'destructive' });
      });

      expect(result.current.toasts[0].variant).toBe('destructive');
    });

    it('returns toast id and controls', () => {
      let toastResult: unknown;
      act(() => {
        toastResult = toast({ title: 'Test' });
      });

      expect(toastResult).toHaveProperty('id');
      expect(toastResult).toHaveProperty('dismiss');
      expect(toastResult).toHaveProperty('update');
    });
  });

  describe('Toast limit', () => {
    it('limits toasts to 3', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({ title: 'Toast 1' });
        toast({ title: 'Toast 2' });
        toast({ title: 'Toast 3' });
        toast({ title: 'Toast 4' });
      });

      expect(result.current.toasts.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Dismissing toasts', () => {
    it('dismisses a specific toast', () => {
      const { result } = renderHook(() => useToast());

      let toastId: string;
      act(() => {
        const t = toast({ title: 'Dismissable' });
        toastId = t.id;
      });

      act(() => {
        result.current.dismiss(toastId!);
      });

      const dismissed = result.current.toasts.find((t) => t.id === toastId!);
      expect(dismissed?.open).toBe(false);
    });

    it('dismisses all toasts when no id provided', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({ title: 'Toast 1' });
        toast({ title: 'Toast 2' });
      });

      act(() => {
        result.current.dismiss();
      });

      result.current.toasts.forEach((t) => {
        expect(t.open).toBe(false);
      });
    });
  });

  describe('Removing toasts', () => {
    it('removes a specific toast', () => {
      const { result } = renderHook(() => useToast());

      let toastId: string;
      act(() => {
        const t = toast({ title: 'Removable' });
        toastId = t.id;
      });

      act(() => {
        result.current.remove(toastId!);
      });

      expect(result.current.toasts.find((t) => t.id === toastId!)).toBeUndefined();
    });

    it('removes all toasts when no id provided', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({ title: 'Toast 1' });
        toast({ title: 'Toast 2' });
      });

      act(() => {
        result.current.remove();
      });

      expect(result.current.toasts).toEqual([]);
    });
  });

  describe('Auto-dismiss', () => {
    it('auto-dismisses toast after 10 seconds', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({ title: 'Auto-dismiss' });
      });

      expect(result.current.toasts[0].open).toBe(true);

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // After 10 seconds, toast should be dismissed
      const found = result.current.toasts.find((t) => t.title === 'Auto-dismiss');
      expect(found?.open).toBe(false);
    });
  });

  describe('Multiple listeners', () => {
    it('notifies multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useToast());
      const { result: result2 } = renderHook(() => useToast());

      act(() => {
        toast({ title: 'Shared Toast' });
      });

      expect(result1.current.toasts.length).toBeGreaterThan(0);
      expect(result2.current.toasts.length).toBeGreaterThan(0);
    });
  });
});

describe('reducer', () => {
  const initialState = { toasts: [] as unknown[] };

  it('handles ADD_TOAST', () => {
    const newToast = { id: '1', title: 'Test', open: true };
    const state = reducer(initialState, { type: 'ADD_TOAST', toast: newToast });
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].id).toBe('1');
  });

  it('handles UPDATE_TOAST', () => {
    const state = { toasts: [{ id: '1', title: 'Old', open: true }] };
    const newState = reducer(state as unknown, {
      type: 'UPDATE_TOAST',
      toast: { id: '1', title: 'New' },
    });
    expect(newState.toasts[0].title).toBe('New');
  });

  it('handles DISMISS_TOAST for specific id', () => {
    const state = { toasts: [{ id: '1', title: 'Test', open: true }] };
    const newState = reducer(state as unknown, {
      type: 'DISMISS_TOAST',
      toastId: '1',
    });
    expect(newState.toasts[0].open).toBe(false);
  });

  it('handles DISMISS_TOAST for all toasts', () => {
    const state = {
      toasts: [
        { id: '1', title: 'A', open: true },
        { id: '2', title: 'B', open: true },
      ],
    };
    const newState = reducer(state as unknown, { type: 'DISMISS_TOAST' });
    newState.toasts.forEach((t: unknown) => {
      expect(t.open).toBe(false);
    });
  });

  it('handles REMOVE_TOAST for specific id', () => {
    const state = { toasts: [{ id: '1', title: 'Test', open: true }] };
    const newState = reducer(state as unknown, {
      type: 'REMOVE_TOAST',
      toastId: '1',
    });
    expect(newState.toasts).toHaveLength(0);
  });

  it('handles REMOVE_TOAST for all toasts', () => {
    const state = {
      toasts: [
        { id: '1', title: 'A', open: true },
        { id: '2', title: 'B', open: true },
      ],
    };
    const newState = reducer(state as unknown, { type: 'REMOVE_TOAST' });
    expect(newState.toasts).toHaveLength(0);
  });

  it('prepends new toast (newest first)', () => {
    const state = { toasts: [{ id: '1', title: 'Old', open: true }] };
    const newState = reducer(state as unknown, {
      type: 'ADD_TOAST',
      toast: { id: '2', title: 'New', open: true },
    });
    expect(newState.toasts[0].id).toBe('2');
    expect(newState.toasts[1].id).toBe('1');
  });

  it('limits toasts to TOAST_LIMIT', () => {
    let state: typeof initialState = initialState;
    for (let i = 0; i < 5; i++) {
      state = reducer(state, {
        type: 'ADD_TOAST',
        toast: { id: String(i), title: `Toast ${i}`, open: true },
      });
    }
    expect(state.toasts.length).toBeLessThanOrEqual(3);
  });
});
