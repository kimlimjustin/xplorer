// ── Clipboard History Manager ────────────────────────────────────────────────
// Stores up to 15 clipboard entries in sessionStorage so history survives
// soft reloads but is cleared when the browser / Tauri window session ends.

const STORAGE_KEY = 'xplorer:clipboard-history';
const MAX_ENTRIES = 15;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClipboardHistoryFile {
  path: string;
  name: string;
  isDir: boolean;
}

export interface ClipboardEntry {
  id: string;
  files: ClipboardHistoryFile[];
  operation: 'copy' | 'cut';
  timestamp: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const generateId = (): string => {
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const readStorage = (): ClipboardEntry[] => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Corrupted — reset
  }
  return [];
};

const writeStorage = (entries: ClipboardEntry[]) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full — silently drop
  }
};

// ── Public API ───────────────────────────────────────────────────────────────

/** Return all clipboard history entries, newest first. */
export const getHistory = (): ClipboardEntry[] => {
  return readStorage();
};

/** Return a single entry by id, or undefined. */
export const getEntry = (id: string): ClipboardEntry | undefined => {
  return readStorage().find((e) => e.id === id);
};

/**
 * Record a new clipboard operation. Deduplicates by matching the exact set of
 * file paths + operation so rapid re-copies don't spam the history.
 */
export const addEntry = (
  files: { path: string; name: string; isDir: boolean }[],
  operation: 'copy' | 'cut',
): ClipboardEntry => {
  const entry: ClipboardEntry = {
    id: generateId(),
    files: files.map((f) => ({ path: f.path, name: f.name, isDir: f.isDir })),
    operation,
    timestamp: Date.now(),
  };

  let history = readStorage();

  // Deduplicate: remove previous entry with the same paths + operation
  const pathKey = files
    .map((f) => f.path)
    .sort()
    .join('|');
  history = history.filter((e) => {
    const ek = e.files
      .map((f) => f.path)
      .sort()
      .join('|');
    return ek !== pathKey || e.operation !== operation;
  });

  // Prepend newest
  history.unshift(entry);

  // Trim to max
  if (history.length > MAX_ENTRIES) {
    history = history.slice(0, MAX_ENTRIES);
  }

  writeStorage(history);

  // Notify listeners
  window.dispatchEvent(new CustomEvent('clipboard-history-changed'));

  return entry;
};

/** Clear all clipboard history. */
export const clearHistory = (): void => {
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('clipboard-history-changed'));
};

/** Return the most recent N entries (defaults to 5). */
export const getRecentEntries = (count = 5): ClipboardEntry[] => {
  return readStorage().slice(0, count);
};
