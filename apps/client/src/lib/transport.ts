/**
 * Transport abstraction layer for Xplorer.
 *
 * Auto-detects whether the app is running inside Tauri (desktop) or a plain
 * browser (web app mode). In Tauri mode every call is forwarded to the native
 * `invoke()` IPC. In HTTP mode, calls are made to a configurable backend URL.
 *
 * Configuration (via Vite env vars / .env):
 *   VITE_API_MODE  – "tauri" | "http"  (auto-detected when omitted)
 *   VITE_API_URL   – backend base URL   (default: http://localhost:8080)
 */

// ---------------------------------------------------------------------------
// Mode detection
// ---------------------------------------------------------------------------

const detectMode = (): 'tauri' | 'http' => {
  const override = import.meta.env.VITE_API_MODE;
  if (override === 'http') return 'http';
  if (override === 'tauri') return 'tauri';
  if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
    return 'tauri';
  }
  return 'http';
};

const API_MODE = detectMode();
const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/** Returns true when running inside a Tauri webview. */
export const isTauri = (): boolean => {
  return API_MODE === 'tauri';
};

/** Returns the backend API base URL (only meaningful in HTTP mode). */
export const getApiUrl = (): string => {
  return API_URL;
};

// ---------------------------------------------------------------------------
// Command transport  (drop-in replacement for Tauri `invoke`)
// ---------------------------------------------------------------------------

/**
 * Send a command to the backend and return the result.
 *
 * - **Tauri mode** → `invoke(command, args)`
 * - **HTTP mode**  → `POST {API_URL}/api/{command}` with JSON body
 */
export const transport = async <T = unknown>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> => {
  if (API_MODE === 'tauri') {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
  }

  const res = await fetch(`${API_URL}/api/${command}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: args ? JSON.stringify(args) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  // Some commands return no body (void)
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
};

// ---------------------------------------------------------------------------
// Asset URL conversion  (replaces `convertFileSrc`)
// ---------------------------------------------------------------------------

// Eagerly cache Tauri's own convertFileSrc so we use the exact same encoding
let _tauriConvertFileSrc: ((path: string, protocol?: string) => string) | null = null;
if (API_MODE === 'tauri') {
  import('@tauri-apps/api/core')
    .then((m) => {
      _tauriConvertFileSrc = m.convertFileSrc;
    })
    .catch((err) => console.warn('[Transport] Failed to load convertFileSrc:', err));
}

/**
 * Convert a local file path to a URL the webview / browser can load.
 *
 * - **Tauri mode** → delegates to `convertFileSrc` from `@tauri-apps/api/core`
 * - **HTTP mode**  → `{API_URL}/api/asset?path={encoded_path}`
 */
export const convertAssetUrl = (filePath: string): string => {
  if (API_MODE === 'tauri') {
    if (_tauriConvertFileSrc) return _tauriConvertFileSrc(filePath);
    // Fallback before dynamic import resolves
    return `https://asset.localhost/${encodeURIComponent(filePath)}`;
  }
  return `${API_URL}/api/asset?path=${encodeURIComponent(filePath)}`;
};

// ---------------------------------------------------------------------------
// Event listener  (replaces `listen` from @tauri-apps/api/event)
// ---------------------------------------------------------------------------

/**
 * Subscribe to a backend event.
 *
 * - **Tauri mode** → native event listener via `@tauri-apps/api/event`
 * - **HTTP mode**  → Server-Sent Events on `{API_URL}/api/events/{event}`
 *
 * Returns an unsubscribe function.
 */
export const listenToEvent = async <T = unknown>(
  event: string,
  callback: (payload: T) => void,
): Promise<() => void> => {
  if (API_MODE === 'tauri') {
    const { listen } = await import('@tauri-apps/api/event');
    return listen(event, (e) => callback(e.payload as T));
  }

  const es = new EventSource(`${API_URL}/api/events/${event}`);
  es.onmessage = (e) => {
    try {
      callback(JSON.parse(e.data) as T);
    } catch {
      // ignore parse errors
    }
  };
  return () => es.close();
};
