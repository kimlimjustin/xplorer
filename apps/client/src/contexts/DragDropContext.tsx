import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { isTauri } from '@/lib/transport';
import { TauriAPI } from '@/lib/tauri-api';
import { validateDrop, buildDestinationPath } from '@/lib/drag-utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface DragState {
  isDragging: boolean;
  dragSource: 'internal' | 'external' | null;
  draggedPaths: string[];
  hoveredDropTarget: string | null; // path from data-drop-target
  operation: 'copy' | 'move';
}

type DragAction =
  | { type: 'START_DRAG'; paths: string[]; source: 'internal' | 'external'; op: 'copy' | 'move' }
  | { type: 'SET_HOVER'; targetPath: string | null }
  | { type: 'SET_OPERATION'; op: 'copy' | 'move' }
  | { type: 'END_DRAG' };

interface DragDropContextValue {
  dragState: DragState;
  /** Register an element as a drop target. Returns cleanup function. */
  registerDropTarget: (path: string, element: HTMLElement) => () => void;
  /** Notify context that an internal drag is starting (from useDraggable) */
  startInternalDrag: (paths: string[]) => void;
}

// ── Reducer ──────────────────────────────────────────────────────────────────

const initialState: DragState = {
  isDragging: false,
  dragSource: null,
  draggedPaths: [],
  hoveredDropTarget: null,
  operation: 'move',
};

const dragReducer = (state: DragState, action: DragAction): DragState => {
  switch (action.type) {
    case 'START_DRAG':
      return {
        isDragging: true,
        dragSource: action.source,
        draggedPaths: action.paths,
        hoveredDropTarget: null,
        operation: action.op,
      };
    case 'SET_HOVER':
      if (state.hoveredDropTarget === action.targetPath) return state;
      return { ...state, hoveredDropTarget: action.targetPath };
    case 'SET_OPERATION':
      if (state.operation === action.op) return state;
      return { ...state, operation: action.op };
    case 'END_DRAG':
      return initialState;
    default:
      return state;
  }
};

// ── Context ──────────────────────────────────────────────────────────────────

const DragDropContext = createContext<DragDropContextValue | null>(null);

export const DragDropProvider = ({ children }: { children: React.ReactNode }) => {
  const [dragState, dispatch] = useReducer(dragReducer, initialState);
  const stateRef = useRef(dragState);
  stateRef.current = dragState;

  // Track the currently highlighted element for cleanup
  const highlightedRef = useRef<HTMLElement | null>(null);
  // Track the last hovered target path to avoid redundant DOM updates
  const lastHoverPathRef = useRef<string | null>(null);

  // Cursor position stored in a ref (not state) — only the overlay reads it
  // via requestAnimationFrame, avoiding React re-renders on every mouse move.
  const cursorRef = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number>(0);

  const clearHighlight = useCallback(() => {
    if (highlightedRef.current) {
      highlightedRef.current.removeAttribute('data-drop-hover');
      highlightedRef.current.removeAttribute('data-drop-invalid');
      highlightedRef.current.classList.remove('xp-drop-folder-highlight');
      highlightedRef.current = null;
    }
    lastHoverPathRef.current = null;
  }, []);

  const findDropTarget = useCallback(
    (x: number, y: number): { element: HTMLElement; path: string } | null => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const target = (el as HTMLElement).closest('[data-drop-target]') as HTMLElement | null;
      if (!target) return null;
      const path = target.getAttribute('data-drop-target');
      if (!path) return null;
      return { element: target, path };
    },
    [],
  );

  // Listen for Tauri drag-drop events (handles BOTH external file drops AND
  // internal startDrag loops). In web mode, native DnD is not available.
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;

    (async () => {
      const { getCurrentWebview } = await import('@tauri-apps/api/webview');
      getCurrentWebview()
        .onDragDropEvent((event) => {
          const payload = event.payload;

          if (payload.type === 'enter') {
            // Files entering the window (from OS or from our own startDrag)
            const paths = (payload as { type: string; paths: string[] }).paths;
            if (paths?.length > 0) {
              if (!stateRef.current.isDragging) {
                dispatch({ type: 'START_DRAG', paths, source: 'external', op: 'copy' });
              }
            }
          } else if (payload.type === 'over') {
            // Hovering — update cursor position and find drop target
            const pos = (payload as { type: string; position: { x: number; y: number } }).position;
            if (pos) {
              const scale = window.devicePixelRatio || 1;
              const x = pos.x / scale;
              const y = pos.y / scale;

              // Update cursor ref (no React re-render)
              cursorRef.current.x = x;
              cursorRef.current.y = y;

              // Move overlay via rAF (GPU-accelerated transform)
              cancelAnimationFrame(rafIdRef.current);
              rafIdRef.current = requestAnimationFrame(() => {
                if (overlayRef.current) {
                  overlayRef.current.style.transform = `translate(${x + 16}px, ${y + 16}px)`;
                }
              });

              // Find drop target and update highlight only if target changed
              const target = findDropTarget(x, y);
              const targetPath = target?.path ?? null;

              if (targetPath !== lastHoverPathRef.current) {
                clearHighlight();

                if (target) {
                  const { draggedPaths } = stateRef.current;
                  const valid =
                    draggedPaths.length === 0 || validateDrop(draggedPaths, target.path).valid;
                  if (valid) {
                    target.element.setAttribute('data-drop-hover', 'true');
                    target.element.classList.add('xp-drop-folder-highlight');
                  } else {
                    target.element.setAttribute('data-drop-invalid', 'true');
                  }
                  highlightedRef.current = target.element;
                }
                lastHoverPathRef.current = targetPath;
                dispatch({ type: 'SET_HOVER', targetPath });
              }
            }
          } else if (payload.type === 'drop') {
            // Files dropped
            const { paths, position } = payload as {
              type: string;
              paths: string[];
              position: { x: number; y: number };
            };
            clearHighlight();

            if (paths?.length > 0 && position) {
              const scale = window.devicePixelRatio || 1;
              const x = position.x / scale;
              const y = position.y / scale;
              const target = findDropTarget(x, y);

              if (target) {
                const validation = validateDrop(paths, target.path);
                if (validation.valid) {
                  const op = stateRef.current.operation;
                  // Execute the drop
                  (async () => {
                    try {
                      for (const sourcePath of paths) {
                        const dest = buildDestinationPath(sourcePath, target.path);
                        if (op === 'copy' || stateRef.current.dragSource === 'external') {
                          await TauriAPI.copy(sourcePath, dest);
                        } else {
                          await TauriAPI.moveFile(sourcePath, dest);
                        }
                      }
                      window.dispatchEvent(new CustomEvent('files-changed'));
                    } catch (error) {
                      window.dispatchEvent(
                        new CustomEvent('drag-drop-error', {
                          detail: { message: String(error) },
                        }),
                      );
                    }
                  })();
                }
              }
            }
            dispatch({ type: 'END_DRAG' });
          } else if (payload.type === 'leave') {
            clearHighlight();
            // Only end drag if it was external — internal startDrag returns to our window
            if (stateRef.current.dragSource === 'external') {
              dispatch({ type: 'END_DRAG' });
            }
          }
        })
        .then((fn) => {
          unlisten = fn;
        });
    })();

    return () => {
      unlisten?.();
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [findDropTarget, clearHighlight]);

  // Listen for Ctrl key press/release to toggle copy vs. move during drag
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Control' &&
        stateRef.current.isDragging &&
        stateRef.current.dragSource === 'internal'
      ) {
        dispatch({ type: 'SET_OPERATION', op: 'copy' });
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (
        e.key === 'Control' &&
        stateRef.current.isDragging &&
        stateRef.current.dragSource === 'internal'
      ) {
        dispatch({ type: 'SET_OPERATION', op: 'move' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const registerDropTarget = useCallback((_path: string, _element: HTMLElement) => {
    return () => {};
  }, []);

  const startInternalDrag = useCallback((paths: string[]) => {
    dispatch({ type: 'START_DRAG', paths, source: 'internal', op: 'move' });
  }, []);

  return (
    <DragDropContext.Provider value={{ dragState, registerDropTarget, startInternalDrag }}>
      {children}
      {dragState.isDragging && <DragOverlay state={dragState} overlayRef={overlayRef} />}
    </DragDropContext.Provider>
  );
};

// ── DragOverlay ──────────────────────────────────────────────────────────────

/** Floating badge near the cursor showing copy/move operation + file count. */
const DragOverlay = ({
  state,
  overlayRef,
}: {
  state: DragState;
  overlayRef: React.MutableRefObject<HTMLDivElement | null>;
}) => {
  const { draggedPaths, operation } = state;
  const count = draggedPaths.length;
  if (count === 0) return null;

  const isCopy = operation === 'copy';
  const fileName = draggedPaths[0]?.split(/[/\\]/).pop() || '';
  const label = count > 1 ? `${count} files` : fileName;

  return createPortal(
    <div
      ref={overlayRef}
      className="xp-drag-overlay"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        willChange: 'transform',
        pointerEvents: 'none',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 500,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        background: isCopy ? 'rgba(52, 211, 153, 0.15)' : 'rgba(99, 102, 241, 0.15)',
        border: `1px solid ${isCopy ? 'var(--xp-green)' : 'var(--xp-blue)'}`,
        color: isCopy ? 'var(--xp-green)' : 'var(--xp-blue)',
        boxShadow: isCopy
          ? '0 2px 12px rgba(52, 211, 153, 0.25)'
          : '0 2px 12px rgba(99, 102, 241, 0.25)',
      }}
    >
      <span style={{ fontSize: '14px' }}>{isCopy ? '+' : '\u2192'}</span>
      <span>{isCopy ? 'Copy' : 'Move'}</span>
      <span
        style={{
          opacity: 0.7,
          fontSize: '11px',
          maxWidth: '140px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </span>
    </div>,
    document.body,
  );
};

export const useDragDropContext = (): DragDropContextValue => {
  const ctx = useContext(DragDropContext);
  if (!ctx) throw new Error('useDragDropContext must be used within DragDropProvider');
  return ctx;
};
