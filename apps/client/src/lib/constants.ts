// ── Platform constants ───────────────────────────────────────────────────────

export const isWindows = navigator.platform.startsWith('Win');
export const isMac = navigator.platform.startsWith('Mac');
export const PATH_SEPARATOR = isWindows ? '\\' : '/';
export const ROOT_PATH = isWindows ? 'C:\\' : '/';

/** Join path parts using the platform-aware separator. Avoids doubled separators. */
export const joinPath = (...parts: string[]): string => {
  return parts.reduce((acc, part) => {
    if (!acc) return part;
    if (!part) return acc;
    const needsSep = !acc.endsWith('/') && !acc.endsWith('\\');
    return acc + (needsSep ? PATH_SEPARATOR : '') + part;
  }, '');
};

/** Detect the separator used in a given path string. */
export const detectSep = (filePath: string): string => {
  return filePath.includes('/') ? '/' : PATH_SEPARATOR;
};

// ── Timing constants ─────────────────────────────────────────────────────────

/** Debounce delay for path input in the address bar (ms) */
export const PATH_INPUT_DEBOUNCE_MS = 300;

/** Debounce delay for search inputs (ms) */
export const SEARCH_DEBOUNCE_MS = 300;

/** Debounce delay for persisting UI state to localStorage (ms) */
export const UI_STATE_SAVE_DEBOUNCE_MS = 300;

/** Duration to show copy-to-clipboard feedback (ms) */
export const COPY_FEEDBACK_MS = 2000;

/** Duration to show copied-tag feedback (ms) */
export const TAG_COPY_FEEDBACK_MS = 1500;

/** Auto-close delay after successful upload/download (ms) */
export const AUTO_CLOSE_DELAY_MS = 1500;

/** Interval for checking tokenizer status (ms) */
export const TOKENIZER_STATUS_INTERVAL_MS = 10_000;

/** Interval for refreshing tokenizer stats panel (ms) */
export const TOKENIZER_PANEL_REFRESH_MS = 5_000;

/** Interval for refreshing smart search index stats (ms) */
export const SEARCH_INDEX_REFRESH_MS = 60_000;

/** Delay before closing context menu submenu (ms) */
export const SUBMENU_CLOSE_DELAY_MS = 120;

/** Delay before hiding search result dropdown on blur (ms) */
export const DROPDOWN_BLUR_DELAY_MS = 200;

/** Debounce delay for window resize events (ms) */
export const RESIZE_DEBOUNCE_MS = 150;

/** Delay before auto-starting onboarding tour (ms) */
export const TOUR_START_DELAY_MS = 800;

/** Clock update interval on home page (ms) */
export const CLOCK_UPDATE_INTERVAL_MS = 1_000;

// ── Layout constants ─────────────────────────────────────────────────────────

/** Minimum left sidebar width (px) */
export const LEFT_SIDEBAR_MIN_WIDTH = 180;

/** Maximum left sidebar width (px) */
export const LEFT_SIDEBAR_MAX_WIDTH = 480;

/** Minimum right sidebar width (px) */
export const RIGHT_SIDEBAR_MIN_WIDTH = 240;

/** Maximum right sidebar width (px) */
export const RIGHT_SIDEBAR_MAX_WIDTH = 560;

/** Minimum bottom panel height (px) */
export const BOTTOM_PANEL_MIN_HEIGHT = 120;

/** Maximum bottom panel height (px) */
export const BOTTOM_PANEL_MAX_HEIGHT = 500;

// ── File size thresholds ─────────────────────────────────────────────────────

/** Maximum file size for inline previews (bytes) — 10 MB */
export const MAX_PREVIEW_SIZE_BYTES = 10 * 1024 * 1024;

/** Default minimum file size for duplicate scan (bytes) */
export const DEFAULT_MIN_DUPLICATE_SIZE = 1024;

/** Size categories for duplicate finder badges (bytes) */
export const SIZE_BADGE_THRESHOLDS = {
  HUGE: 100 * 1024 * 1024, // 100 MB — red
  LARGE: 10 * 1024 * 1024, // 10 MB  — orange
  MEDIUM: 1024 * 1024, // 1 MB   — yellow
  SMALL: 100 * 1024, // 100 KB — blue
} as const;

// ── Search & results constants ───────────────────────────────────────────────

/** Default max search results returned */
export const DEFAULT_MAX_SEARCH_RESULTS = 50;

/** Max search matches to show per result entry */
export const MAX_MATCHES_SHOWN = 3;

/** Number of archive files to preview in extract dialog */
export const ARCHIVE_PREVIEW_LIMIT = 20;

// ── Route constants ─────────────────────────────────────────────────────────

export const ROUTES = {
  HOME: 'xplorer://home',
  TRASH: 'xplorer://trash',
  SETTINGS: 'xplorer://settings',
  GDRIVE_MANAGER: 'xplorer://gdrive-manager',
} as const;

// ── Byte-size multipliers ───────────────────────────────────────────────────

export const BYTES = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 } as const;

// ── Toast defaults ──────────────────────────────────────────────────────────

/** Default toast auto-dismiss delay, also defined in use-toast.ts */
export const TOAST_DURATION_MS = 3000;

/** Delay before removing a dismissed toast from DOM (for exit animation) */
export const TOAST_REMOVE_DELAY_MS = 150;
