import { useEffect, useRef } from 'react';

/**
 * Attaches an event listener to `window` and automatically removes it on
 * cleanup. Supports both standard DOM events (typed via `WindowEventMap`)
 * and custom/non-standard event names.
 *
 * Usage — standard event:
 *   useWindowEvent('storage', (e) => { ... });
 *
 * Usage — custom event:
 *   useWindowEvent('bookmarks-changed', () => { ... });
 *   useWindowEvent('collections-changed', () => { ... });
 */
const useWindowEvent = <K extends string>(
  event: K,
  handler: K extends keyof WindowEventMap ? (e: WindowEventMap[K]) => void : (e: Event) => void,
  deps?: React.DependencyList,
): void => {
  // Keep a stable ref to the handler so we don't re-subscribe on every render
  // when the caller passes an inline function without `useCallback`.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(
    () => {
      const listener = (e: Event) => {
        // Cast is safe — the ref always holds the latest version of handler.
        (handlerRef.current as (e: Event) => void)(e);
      };
      window.addEventListener(event, listener);
      return () => window.removeEventListener(event, listener);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps !== undefined ? [event, ...deps] : [event],
  );
};

export { useWindowEvent };
