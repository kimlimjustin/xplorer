/**
 * Path Bookmarks — assign number keys (1-9) to frequently used directories.
 *
 * Stored in localStorage under `xplorer:path-bookmarks`.
 * Emits a `path-bookmarks-changed` CustomEvent on every mutation so that
 * any listening component can stay in sync.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface PathBookmark {
  /** Slot number, 1 through 9. */
  slot: number;
  /** Absolute filesystem path. */
  path: string;
  /** Optional custom label; defaults to the trailing folder name. */
  label?: string;
  /** Optional lucide-react icon name for the bookmark (e.g. "Folder", "Star"). */
  icon?: string;
  /** Epoch-ms timestamp when the bookmark was assigned. */
  assignedAt: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'xplorer:path-bookmarks';
const EVENT_NAME = 'path-bookmarks-changed';

// ── Internal helpers ─────────────────────────────────────────────────────────

const readStore = () : PathBookmark[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PathBookmark[];
  } catch {
    return [];
  }
}

const writeStore = (bookmarks: PathBookmark[]) : void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Return all assigned path bookmarks (may be fewer than 9). */
export const getPathBookmarks = () : PathBookmark[] => {
  return readStore();
}

/** Return the bookmark for a specific slot (1-9), or null if empty. */
export const getBookmarkBySlot = (slot: number) : PathBookmark | null => {
  if (slot < 1 || slot > 9) return null;
  return readStore().find((b) => b.slot === slot) ?? null;
}

/** Find the bookmark whose path matches, or null. */
export const getBookmarkForPath = (path: string) : PathBookmark | null => {
  return readStore().find((b) => b.path === path) ?? null;
}

/** Assign (or overwrite) a path bookmark for the given slot. */
export const setPathBookmark = (slot: number, path: string, label?: string, icon?: string) : void => {
  if (slot < 1 || slot > 9) return;
  const bookmarks = readStore().filter((b) => b.slot !== slot);
  bookmarks.push({
    slot,
    path,
    label,
    icon,
    assignedAt: Date.now(),
  });
  bookmarks.sort((a, b) => a.slot - b.slot);
  writeStore(bookmarks);
}

/** Remove the bookmark at the given slot. */
export const removePathBookmark = (slot: number) : void => {
  if (slot < 1 || slot > 9) return;
  writeStore(readStore().filter((b) => b.slot !== slot));
}

/** Clear every path bookmark. */
export const clearAllBookmarks = () : void => {
  writeStore([]);
}

/** Extract the folder name from a path (last segment). */
export const getFolderName = (path: string) : string => {
  const segments = path.replace(/[\\/]+$/, '').split(/[\\/]/);
  return segments[segments.length - 1] || path;
}
