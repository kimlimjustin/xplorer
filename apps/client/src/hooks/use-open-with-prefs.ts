import { useCallback, useSyncExternalStore } from 'react';
import { STORAGE_KEYS } from '@/lib/storage-keys';

/**
 * Supported open-with handler identifiers.
 * - `xplorer-editor`: open in the built-in code editor tab
 * - `vscode`: launch VS Code via `code` CLI
 * - `system`: open with the OS-default application
 */
export type OpenHandler = 'xplorer-editor' | 'vscode' | 'system';

/** Map of file extension (without dot) -> chosen handler. */
export type FileOpenPrefs = Record<string, OpenHandler>;

const STORE_KEY = STORAGE_KEYS.FILE_OPEN_PREFS;

// ── Tiny external-store so every consumer re-renders on change ──────────────

let snapshot: FileOpenPrefs = loadPrefs();

const listeners = new Set<() => void>();

const emitChange = () => {
  snapshot = loadPrefs();
  listeners.forEach((l) => l());
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const getSnapshot = () => snapshot;

// ── localStorage helpers ────────────────────────────────────────────────────

function loadPrefs(): FileOpenPrefs {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as FileOpenPrefs;
  } catch {
    /* ignore */
  }
  return {};
}

const persistPrefs = (prefs: FileOpenPrefs) => {
  localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
  emitChange();
};

// ── Public helpers (usable outside React too) ───────────────────────────────

export const getOpenPreference = (ext: string): OpenHandler | null => {
  const prefs = loadPrefs();
  return prefs[ext] ?? null;
};

export const setOpenPreference = (ext: string, handler: OpenHandler): void => {
  const prefs = loadPrefs();
  prefs[ext] = handler;
  persistPrefs(prefs);
};

export const clearOpenPreference = (ext: string): void => {
  const prefs = loadPrefs();
  delete prefs[ext];
  persistPrefs(prefs);
};

export const clearAllOpenPreferences = (): void => {
  persistPrefs({});
};

export const getAllOpenPreferences = (): FileOpenPrefs => loadPrefs();

// ── Extensions that qualify as "code / text" files ──────────────────────────

export const CODE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'py',
  'rs',
  'go',
  'java',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'rb',
  'php',
  'swift',
  'kt',
  'scala',
  'html',
  'css',
  'scss',
  'sass',
  'less',
  'json',
  'yaml',
  'yml',
  'toml',
  'xml',
  'md',
  'txt',
  'sh',
  'bash',
  'zsh',
  'sql',
  'graphql',
  'prisma',
  'vue',
  'svelte',
  'astro',
  'dockerfile',
  'makefile',
]);

/** Return the bare extension (no dot) for a file path, lower-cased. */
export const getFileExtension = (filePath: string): string => {
  const name = filePath.split(/[/\\]/).pop() ?? '';
  // Handle extensionless names like "Dockerfile", "Makefile"
  const lower = name.toLowerCase();
  if (lower === 'dockerfile' || lower === 'makefile') return lower;
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return name.slice(dotIndex + 1).toLowerCase();
};

export const isCodeFile = (filePath: string): boolean => {
  const ext = getFileExtension(filePath);
  return ext !== '' && CODE_EXTENSIONS.has(ext);
};

// ── React hook ──────────────────────────────────────────────────────────────

export const useOpenWithPrefs = () => {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setPreference = useCallback((ext: string, handler: OpenHandler) => {
    setOpenPreference(ext, handler);
  }, []);

  const clearPreference = useCallback((ext: string) => {
    clearOpenPreference(ext);
  }, []);

  const clearAll = useCallback(() => {
    clearAllOpenPreferences();
  }, []);

  return {
    prefs,
    setPreference,
    clearPreference,
    clearAll,
    getPreference: getOpenPreference,
  };
};
