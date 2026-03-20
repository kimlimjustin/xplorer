import { useState, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type PaneSyncMode = 'mirror' | 'relative';

export interface PaneSyncState {
  enabled: boolean;
  toggle: () => void;
  syncMode: PaneSyncMode;
  setSyncMode: (mode: PaneSyncMode) => void;
}

/**
 * Detail payload for the `pane-sync-navigate` custom event.
 *
 * - `sourceGroupId`: the pane that initiated the navigation
 * - `path`:          the absolute path being navigated to
 * - `previousPath`:  the path the source pane was on before navigating
 *                    (used by relative mode to compute the subfolder name)
 * - `mode`:          mirror | relative
 */
export interface PaneSyncNavigateDetail {
  sourceGroupId: string;
  path: string;
  previousPath: string;
  mode: PaneSyncMode;
}

// ── localStorage key ──────────────────────────────────────────────────────────

const LS_KEY_ENABLED = 'xplorer:pane-sync-enabled';
const LS_KEY_MODE = 'xplorer:pane-sync-mode';

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Manages the enabled/disabled state and sync mode for dual-pane sync
 * navigation. Persists both values to localStorage.
 */
export const usePaneSync = () : PaneSyncState => {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_KEY_ENABLED) === 'true';
    } catch {
      return false;
    }
  });

  const [syncMode, setSyncModeRaw] = useState<PaneSyncMode>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_MODE);
      if (saved === 'mirror' || saved === 'relative') return saved;
    } catch { /* ignore localStorage errors */ }
    return 'mirror';
  });

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LS_KEY_ENABLED, String(next));
      } catch { /* ignore localStorage errors */ }
      return next;
    });
  }, []);

  const setSyncMode = useCallback((mode: PaneSyncMode) => {
    setSyncModeRaw(mode);
    try {
      localStorage.setItem(LS_KEY_MODE, mode);
    } catch { /* ignore localStorage errors */ }
  }, []);

  return { enabled, toggle, syncMode, setSyncMode };
}

// ── Event helpers ─────────────────────────────────────────────────────────────

/**
 * Emit a sync-navigate event.  The `_syncGuard` ref should be checked by the
 * caller so that a pane receiving the event does not re-emit.
 */
export const emitPaneSyncNavigate = (detail: PaneSyncNavigateDetail) : void => {
  window.dispatchEvent(new CustomEvent<PaneSyncNavigateDetail>('pane-sync-navigate', { detail }));
}

/**
 * Given a `relative` mode sync event, compute the target path for the
 * receiving pane.
 *
 * Example:
 *   source previous = C:\Users\Alice\Documents
 *   source current  = C:\Users\Alice\Documents\reports
 *   receiver current = D:\Shared\Documents
 *   => result = D:\Shared\Documents\reports   (if it exists, caller must verify)
 *
 * For "go up" navigations the function walks up by the same number of segments.
 */
export const computeRelativeSyncPath = (
  sourcePreviousPath: string,
  sourceNewPath: string,
  receiverCurrentPath: string,
) : string | null => {
  const normSrc = normalizePath(sourcePreviousPath);
  const normNew = normalizePath(sourceNewPath);
  const normRecv = normalizePath(receiverCurrentPath);

  // Check if the new path is a child of the previous path (navigating down)
  if (normNew.startsWith(normSrc + '/')) {
    const relativePart = normNew.slice(normSrc.length); // includes leading /
    return denormalizePath(normRecv + relativePart, receiverCurrentPath);
  }

  // Check if the new path is a parent of the previous path (navigating up)
  if (normSrc.startsWith(normNew + '/')) {
    const droppedPart = normSrc.slice(normNew.length); // e.g. /reports
    const droppedSegments = droppedPart.split('/').filter(Boolean).length;

    const recvParts = normRecv.split('/').filter(Boolean);
    if (recvParts.length <= droppedSegments) return null; // can't go up further

    const newRecvParts = recvParts.slice(0, recvParts.length - droppedSegments);

    // Reconstruct with the receiver's original separator style
    const sep = receiverCurrentPath.includes('\\') ? '\\' : '/';
    let result = newRecvParts.join(sep);

    // Preserve Windows drive letter format (e.g., "C:\")
    if (/^[a-zA-Z]:/.test(receiverCurrentPath) && !result.endsWith(sep)) {
      result += sep;
    }
    // Preserve Unix root
    if (receiverCurrentPath.startsWith('/') && !result.startsWith('/')) {
      result = '/' + result;
    }

    return result;
  }

  // Paths share no parent-child relationship — can't compute relative
  return null;
}

// ── Internal utilities ────────────────────────────────────────────────────────

/** Normalize a path to forward slashes and lowercase for comparison. */
const normalizePath = (p: string) : string => {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/** Convert a normalized path back using the separator style of the reference path. */
const denormalizePath = (normalized: string, reference: string) : string => {
  if (reference.includes('\\')) {
    return normalized.replace(/\//g, '\\');
  }
  return normalized;
}
