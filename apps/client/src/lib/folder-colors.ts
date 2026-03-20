/**
 * Folder Color Coding — assign color labels to folders, persisted in localStorage.
 *
 * Colors are stored under the key `xplorer:folder-colors` as a JSON array of FolderColor entries.
 * Mutations dispatch a `folder-colors-changed` CustomEvent on window so listeners can re-render.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface FolderColor {
  path: string;
  colorId: string;
  label?: string;
}

export interface FolderColorDef {
  id: string;
  hex: string;
  label: string;
}

// ── Predefined palette ───────────────────────────────────────────────────────

export const FOLDER_COLORS: FolderColorDef[] = [
  { id: 'red', hex: '#ef4444', label: 'Urgent' },
  { id: 'orange', hex: '#f97316', label: 'Important' },
  { id: 'yellow', hex: '#eab308', label: 'In Progress' },
  { id: 'green', hex: '#22c55e', label: 'Active' },
  { id: 'blue', hex: '#3b82f6', label: 'Archive' },
  { id: 'purple', hex: '#a855f7', label: 'Personal' },
  { id: 'pink', hex: '#ec4899', label: 'Review' },
  { id: 'gray', hex: '#6b7280', label: 'Inactive' },
];

// Quick lookup map: colorId -> hex
const COLOR_HEX_MAP = new Map<string, string>(FOLDER_COLORS.map((c) => [c.id, c.hex]));

// ── Storage key ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'xplorer:folder-colors';

// ── Internal helpers ─────────────────────────────────────────────────────────

const readAll = () : FolderColor[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FolderColor[];
  } catch {
    return [];
  }
}

const writeAll = (entries: FolderColor[]) : void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent('folder-colors-changed'));
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get the color entry for a specific folder path, or null if none. */
export const getFolderColor = (path: string) : FolderColor | null => {
  const all = readAll();
  return all.find((e) => e.path === path) ?? null;
}

/** Set or update the color for a folder path. */
export const setFolderColor = (path: string, colorId: string, label?: string) : void => {
  const all = readAll();
  const idx = all.findIndex((e) => e.path === path);
  const entry: FolderColor = { path, colorId, label };
  if (idx >= 0) {
    all[idx] = entry;
  } else {
    all.push(entry);
  }
  writeAll(all);
}

/** Remove the color assignment for a folder path. */
export const removeFolderColor = (path: string) : void => {
  const all = readAll();
  const filtered = all.filter((e) => e.path !== path);
  if (filtered.length !== all.length) {
    writeAll(filtered);
  }
}

/** Get all folder color assignments. */
export const getAllFolderColors = () : FolderColor[] => {
  return readAll();
}

/** Quick hex lookup: returns the hex color string for a folder, or null. */
export const getFolderColorHex = (path: string) : string | null => {
  const entry = getFolderColor(path);
  if (!entry) return null;
  return COLOR_HEX_MAP.get(entry.colorId) ?? null;
}

/** Get the hex value for a color ID. */
export const getColorHex = (colorId: string) : string | null => {
  return COLOR_HEX_MAP.get(colorId) ?? null;
}
