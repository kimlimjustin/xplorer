import { STORAGE_KEYS } from '@/lib/storage-keys';

/**
 * Search token parser for key:value syntax.
 *
 * Supported tokens:
 *   kind:image | kind:video | kind:audio | kind:document | kind:code
 *   size:>1MB | size:<100KB | size:>10MB | size:<1GB  (any numeric prefix + unit)
 *   date:today | date:week | date:month
 *   ext:pdf  (any single extension)
 */

export type SearchScope = 'folder' | 'everywhere';

// ── Extension sets ────────────────────────────────────────────────────────────

const KIND_EXTENSIONS: Record<string, readonly string[]> = {
  image: [
    'png',
    'jpg',
    'jpeg',
    'gif',
    'svg',
    'webp',
    'bmp',
    'ico',
    'tiff',
    'tif',
    'avif',
    'heic',
    'heif',
  ],
  video: ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', '3gp'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'aiff'],
  document: [
    'pdf',
    'docx',
    'doc',
    'xlsx',
    'xls',
    'pptx',
    'ppt',
    'txt',
    'odt',
    'ods',
    'odp',
    'rtf',
    'csv',
    'md',
  ],
  code: [
    'ts',
    'tsx',
    'js',
    'jsx',
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
    'vue',
    'svelte',
    'sh',
    'bash',
    'lua',
    'r',
    'dart',
    'zig',
    'nim',
  ],
} as const;

// ── Size parser ───────────────────────────────────────────────────────────────

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
};

const parseSize = (value: string): { min?: number; max?: number } | null => {
  const match = /^([<>])(\d+(?:\.\d+)?)(b|kb|mb|gb)$/i.exec(value);
  if (!match) return null;
  const [, op, numStr, unit] = match;
  const bytes = parseFloat(numStr) * (SIZE_UNITS[unit.toLowerCase()] ?? 1);
  return op === '>' ? { min: bytes } : { max: bytes };
};

// ── Date parser ───────────────────────────────────────────────────────────────

const parseDate = (value: string): { after?: number } | null => {
  const now = Math.floor(Date.now() / 1000);
  switch (value.toLowerCase()) {
    case 'today':
      return { after: now - 86400 };
    case 'week':
      return { after: now - 7 * 86400 };
    case 'month':
      return { after: now - 30 * 86400 };
    default:
      return null;
  }
};

// ── Result types ──────────────────────────────────────────────────────────────

export interface ParsedTokens {
  /** Remaining query text after removing all recognised tokens */
  remainingQuery: string;
  /** Extensions to filter by (derived from kind: or ext: tokens) */
  extensionFilter: string[];
  /** Minimum file size in bytes */
  sizeMin?: number;
  /** Maximum file size in bytes */
  sizeMax?: number;
  /** Modified-after Unix timestamp */
  dateAfter?: number;
  /** Human-readable token chips for display */
  chips: TokenChip[];
}

export interface TokenChip {
  key: string;
  rawValue: string;
  /** Colour variant for the chip pill */
  variant: 'kind' | 'size' | 'date' | 'ext';
}

// ── Parser ────────────────────────────────────────────────────────────────────

export const parseSearchTokens = (rawQuery: string): ParsedTokens => {
  const chips: TokenChip[] = [];
  const extensionFilter: string[] = [];
  let sizeMin: number | undefined;
  let sizeMax: number | undefined;
  let dateAfter: number | undefined;

  // Split on whitespace, but keep quoted phrases intact
  const tokenRegex = /(\w+):(\S+)/g;
  const remainingParts: string[] = [];
  let lastIndex = 0;

  for (const match of rawQuery.matchAll(tokenRegex)) {
    const [full, key, value] = match;
    const start = match.index ?? 0;

    // Everything before this token is kept as plain text
    if (start > lastIndex) {
      remainingParts.push(rawQuery.slice(lastIndex, start));
    }
    lastIndex = start + full.length;

    const keyLower = key.toLowerCase();
    const valueLower = value.toLowerCase();

    if (keyLower === 'kind') {
      const exts = KIND_EXTENSIONS[valueLower];
      if (exts) {
        extensionFilter.push(...exts);
        chips.push({ key: 'kind', rawValue: value, variant: 'kind' });
        continue;
      }
    }

    if (keyLower === 'ext') {
      const ext = valueLower.replace(/^\./, '');
      extensionFilter.push(ext);
      chips.push({ key: 'ext', rawValue: value, variant: 'ext' });
      continue;
    }

    if (keyLower === 'size') {
      const parsed = parseSize(valueLower);
      if (parsed) {
        if (parsed.min !== undefined) sizeMin = parsed.min;
        if (parsed.max !== undefined) sizeMax = parsed.max;
        chips.push({ key: 'size', rawValue: value, variant: 'size' });
        continue;
      }
    }

    if (keyLower === 'date') {
      const parsed = parseDate(valueLower);
      if (parsed) {
        if (parsed.after !== undefined) dateAfter = parsed.after;
        chips.push({ key: 'date', rawValue: value, variant: 'date' });
        continue;
      }
    }

    // Unrecognised token — keep in remaining text
    remainingParts.push(full);
  }

  // Append any trailing text
  if (lastIndex < rawQuery.length) {
    remainingParts.push(rawQuery.slice(lastIndex));
  }

  const remainingQuery = remainingParts
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { remainingQuery, extensionFilter, sizeMin, sizeMax, dateAfter, chips };
};

// ── localStorage helpers ──────────────────────────────────────────────────────

const SCOPE_KEY = STORAGE_KEYS.SEARCH_SCOPE;

export const loadSearchScope = (): SearchScope => {
  try {
    const stored = localStorage.getItem(SCOPE_KEY);
    if (stored === 'everywhere') return 'everywhere';
  } catch {
    // localStorage unavailable
  }
  return 'folder';
};

export const saveSearchScope = (scope: SearchScope): void => {
  try {
    localStorage.setItem(SCOPE_KEY, scope);
  } catch {
    // localStorage unavailable
  }
};
