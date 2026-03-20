/**
 * Small, pure helpers shared across file-operation hooks and utilities.
 */

import { TauriAPI, type FileEntry } from '@/lib/tauri-api';
import { detectSep } from '@/lib/constants';
import { addEntry as addClipboardHistoryEntry } from '@/hooks/use-clipboard-history';

// ── Error formatting ─────────────────────────────────────────────────────────

/** Format an unknown error value into a human-readable string. */
export const formatError = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

// ── Copy-name generation ─────────────────────────────────────────────────────

/** Generate "Name Copy.ext" or "Name Copy N.ext" */
export const generateCopyName = (dir: string, name: string, sep: string, n?: number) : string => {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  const suffix = n && n > 1 ? ` Copy ${n}` : ' Copy';
  return `${dir}${sep}${base}${suffix}${ext}`;
}

/** Find a non-conflicting "Copy" destination path */
export const findCopyName = async (dir: string, name: string, sep: string): Promise<string> => {
  let dest = generateCopyName(dir, name, sep);
  let n = 2;
  while ((await TauriAPI.fileExists(dest)) && n < 100) {
    dest = generateCopyName(dir, name, sep, n);
    n++;
  }
  return dest;
};

// ── Clipboard helpers ────────────────────────────────────────────────────────

export interface ClipboardState {
  files: FileEntry[];
  operation: 'copy' | 'cut';
}

/**
 * Perform a copy-to-clipboard or cut-to-clipboard operation.
 * Updates both the in-memory clipboard and the clipboard history storage.
 */
export const setClipboardEntries = (
  files: FileEntry[],
  operation: 'copy' | 'cut',
  setClipboard: (val: ClipboardState | null) => void,
  updateFactory: (files: FileEntry[], op: 'copy' | 'cut') => void,
  toast: (opts: {
    title?: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }) => void,
): void => {
  setClipboard({ files, operation });
  updateFactory(files, operation);
  addClipboardHistoryEntry(
    files.map((f) => ({ path: f.path, name: f.name, isDir: f.is_dir })),
    operation,
  );
  const label = operation === 'copy' ? 'Copied' : 'Cut';
  toast({
    title: label,
    description: `${files.length} item${files.length > 1 ? 's' : ''} ${label.toLowerCase()}`,
  });
};

// ── Resolved selected files helper ───────────────────────────────────────────

/**
 * Map a Set of selected file paths to a filtered array of FileEntry objects.
 */
export const resolveSelectedFiles = (selectedFiles: Set<string>, files: FileEntry[]) : FileEntry[] => {
  return Array.from(selectedFiles)
    .map((id) => files.find((f) => f.path === id))
    .filter(Boolean) as FileEntry[];
}

// ── Find unique new-file path ────────────────────────────────────────────────

/**
 * Find a non-conflicting path for a new file like "New Text File.txt",
 * incrementing a numeric suffix until a free name is found.
 */
export const findUniqueFilePath = async (
  parentPath: string,
  baseName: string,
  extension: string,
): Promise<string> => {
  const sep = detectSep(parentPath);
  const prefix = parentPath.endsWith(sep) ? parentPath : `${parentPath}${sep}`;
  let filePath = `${prefix}${baseName}${extension}`;
  let n = 2;
  while ((await TauriAPI.fileExists(filePath)) && n < 100) {
    filePath = `${prefix}${baseName} (${n})${extension}`;
    n++;
  }
  return filePath;
};
