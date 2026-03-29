// Platform constants (mock for web — used by imported client components)
export const isWindows = typeof navigator !== 'undefined' ? navigator.platform?.startsWith('Win') ?? true : true;
export const PATH_SEPARATOR = isWindows ? '\\' : '/';
export const ROOT_PATH = isWindows ? 'C:\\' : '/';

export function joinPath(...parts: string[]): string {
  return parts.reduce((acc, part) => {
    if (!acc) return part;
    if (!part) return acc;
    const needsSep = !acc.endsWith('/') && !acc.endsWith('\\');
    return acc + (needsSep ? PATH_SEPARATOR : '') + part;
  }, '');
}

export const SITE_NAME = 'Xplorer';
export const SITE_DESCRIPTION =
  'A modern, AI-powered file explorer built with Rust, Tauri v2, and React. Blazing fast, fully extensible, and privacy-first.';
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://xplorer.dev';

export const GITHUB_SPONSOR_URL = 'https://github.com/sponsors/kimlimjustin';

export const MAX_FREE_EXTENSIONS = 20;
export const TRIAL_DURATION_MS = 30 * 60 * 1000; // 30 minutes
export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB

export const EXTENSION_CATEGORIES = [
  'Themes',
  'Previews',
  'Productivity',
  'Developer Tools',
  'Cloud Storage',
  'Security',
  'Media',
  'Utilities',
] as const;

export type ExtensionCategory = (typeof EXTENSION_CATEGORIES)[number];
export const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');
export const SEARCH_DEBOUNCE_MS = 300;
