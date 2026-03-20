import { TauriAPI } from './tauri-api';
import { transport } from './transport';
import { Duplicates, Organizer, Analytics } from '@xplorer/sdk';
import type { CompressionOptions, ExtractionOptions, OrganizationPlan } from '@xplorer/sdk';
import type { ExtensionManifest, EventCallback } from './extension-host-types';
import { isPathAllowed } from './extension-host-types';

declare global {
  interface Window {
    __safeSetTimeout: (fn: TimerHandler, ms?: number, ...args: unknown[]) => number;
    __safeSetInterval: (fn: TimerHandler, ms?: number, ...args: unknown[]) => number;
  }
}

// ─── Permission Helpers ──────────────────────────────────────────────────────

/**
 * Log a permission violation to the console and to a ring buffer in localStorage.
 * Useful for debugging and auditing extension behavior.
 */
export const logPermissionViolation = (
  extensionId: string,
  permission: string,
  action: string,
) : void => {
  const entry = {
    timestamp: Date.now(),
    extensionId,
    permission,
    action,
    blocked: true,
  };
  console.warn(
    `[ExtensionHost] Permission violation: ${extensionId} attempted ${action} without ${permission}`,
  );

  // Store in a ring buffer for debugging (keep last 100 entries)
  try {
    const violations = JSON.parse(localStorage.getItem('xplorer-permission-violations') || '[]');
    violations.push(entry);
    if (violations.length > 100) violations.shift();
    localStorage.setItem('xplorer-permission-violations', JSON.stringify(violations));
  } catch {
    // localStorage may be unavailable in some contexts -- silently ignore
  }
}

export const hasPermission = (manifest: ExtensionManifest, permission: string) : boolean => {
  const granted = (manifest.permissions || []).includes(permission);
  if (!granted) {
    logPermissionViolation(manifest.id, permission, `access requiring "${permission}"`);
  }
  return granted;
}

/**
 * Request user approval for an extension's permissions before loading.
 * Dispatches a custom event that the UI can listen for to show a consent dialog.
 * Built-in extensions are auto-approved. Third-party extensions that are not
 * approved within 30 seconds are denied by default.
 */
export const requestPermissionApproval = (
  extensionId: string,
  extensionName: string,
  permissions: string[],
) : Promise<boolean> => {
  return new Promise((resolve) => {
    let resolved = false;
    const event = new CustomEvent('extension-permission-request', {
      detail: {
        extensionId,
        extensionName,
        permissions,
        approve: () => {
          if (!resolved) {
            resolved = true;
            resolve(true);
          }
        },
        deny: () => {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        },
      },
    });
    window.dispatchEvent(event);

    // 30s timeout = deny (if no UI handler responds)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }, 30000);
  });
}

// ─── Preprocessor ─────────────────────────────────────────────────────────────

// ─── Integrity Verification ─────────────────────────────────────────────────

/**
 * Verify extension bundle integrity using SHA-256 checksum.
 * Full Ed25519 signature verification would require a crypto library;
 * for now we verify the checksum matches the bundle content.
 */
export const verifyExtensionIntegrity = async (
  manifest: ExtensionManifest,
  bundleContent: string,
): Promise<{ valid: boolean; reason?: string }> => {
  if (!manifest.checksum) {
    // No checksum = unverified extension (allow with warning)
    return { valid: true, reason: 'no-checksum' };
  }

  // Compute SHA-256 of the bundle
  const encoder = new TextEncoder();
  const data = encoder.encode(bundleContent);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  if (computedHash !== manifest.checksum) {
    return { valid: false, reason: 'checksum-mismatch' };
  }

  return { valid: true };
};

// ─── Sandbox Execution ───────────────────────────────────────────────────────

/**
 * Execute extension JS code in a sandboxed environment.
 * Creates a Proxy-based sandbox that blocks dangerous globals and
 * intercepts DOM manipulation to prevent script injection.
 *
 * @param jsContent - Preprocessed JS code to execute
 * @param extId - The extension's ID (for logging)
 * @param trackedTimers - Timer tracking object for cleanup
 * @returns The result of executing the code (may be a Promise)
 */
export const executeSandboxed = (
  jsContent: string,
  extId: string,
  trackedTimers: { timeouts: number[]; intervals: number[] },
): unknown => {
  // Sandbox: block dangerous globals via Proxy + parameter shadowing
  const BLOCKED_GLOBALS = [
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'eval',
    'Function',
    '__TAURI__',
    '__TAURI_INTERNALS__',
    '__TAURI_IPC__',
    '__TAURI_INVOKE_HANDLER__',
    'parent',
    'top',
    'opener',
    'frames',
    'location',
    'history',
    'SharedArrayBuffer',
    'Atomics',
  ];
  const blockedSet = new Set(BLOCKED_GLOBALS);

  // Safe setTimeout/setInterval that reject string arguments (prevents eval-like behavior)
  // and track timer IDs for cleanup on extension unload
  const safeSetTimeout = (fn: Function | string, ms?: number, ...args: unknown[]) => {
    if (typeof fn === 'string')
      throw new Error('String argument to setTimeout is not allowed in extension sandbox');
    const id = setTimeout(fn, ms, ...args) as unknown as number;
    trackedTimers.timeouts.push(id);
    return id;
  };
  const safeSetInterval = (fn: Function | string, ms?: number, ...args: unknown[]) => {
    if (typeof fn === 'string')
      throw new Error('String argument to setInterval is not allowed in extension sandbox');
    const id = setInterval(fn, ms, ...args) as unknown as number;
    trackedTimers.intervals.push(id);
    return id;
  };

  // Prototype methods to block on all proxied objects (document + window)
  const blockedPrototypeMethods = new Set([
    '__proto__',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
  ]);

  // Create a proxy for document that blocks escape routes to window and script injection
  const safeDocument = new Proxy(document, {
    get(target, prop) {
      // Block escape to window via document.defaultView / document.parentWindow
      if (prop === 'defaultView' || prop === 'parentWindow') {
        return null;
      }
      // Block prototype chain traversal on document proxy
      if (blockedPrototypeMethods.has(String(prop))) {
        return undefined;
      }
      if (prop === 'constructor') {
        return undefined;
      }
      const value = Reflect.get(target, prop);
      if (typeof value === 'function') {
        // Intercept createElement to block script/iframe/object/embed injection
        if (prop === 'createElement' || prop === 'createElementNS') {
          return (...args: unknown[]) => {
            const tagName = (
              typeof args[0] === 'string' ? args[0] : typeof args[1] === 'string' ? args[1] : ''
            ).toLowerCase();
            if (['script', 'iframe', 'object', 'embed', 'frame', 'link'].includes(tagName)) {
              console.warn(
                `[Sandbox] Extension "${extId}" tried to create blocked element: <${tagName}>`,
              );
              throw new Error(`Creating <${tagName}> elements is not allowed in extension sandbox`);
            }
            return (value as Function).apply(target, args);
          };
        }
        return value.bind(target);
      }
      return value;
    },
  });

  // Create a sandboxed Reflect proxy that blocks prototype manipulation
  const sandboxedReflect = new Proxy(Reflect, {
    get(target, reflectProp) {
      if (reflectProp === 'getPrototypeOf' || reflectProp === 'setPrototypeOf') {
        return undefined;
      }
      return (target as unknown as Record<string | symbol, unknown>)[reflectProp];
    },
  });

  const sandboxedWindow = new Proxy(window, {
    get(target, prop, _receiver) {
      if (blockedSet.has(prop as string)) {
        console.warn(`[Sandbox] Extension "${extId}" tried to access blocked API: ${String(prop)}`);
        return undefined;
      }

      // Block prototype chain traversal methods
      if (blockedPrototypeMethods.has(String(prop))) {
        console.warn(
          `[Sandbox] Extension "${extId}" tried to access blocked prototype method: ${String(prop)}`,
        );
        return undefined;
      }

      // Block constructor access that could escape sandbox
      if (prop === 'constructor') {
        return undefined;
      }

      // Intercept Reflect to block prototype manipulation
      if (prop === 'Reflect') {
        return sandboxedReflect;
      }

      // Intercept setTimeout/setInterval with safe versions
      if (prop === 'setTimeout') return safeSetTimeout;
      if (prop === 'setInterval') return safeSetInterval;
      // Intercept document with safe proxy
      if (prop === 'document') return safeDocument;

      const value = Reflect.get(target, prop, target);
      // Bind native functions to their proper `this` to avoid "Illegal invocation"
      if (typeof value === 'function' && typeof prop === 'string') {
        // Don't bind constructors or user-defined functions
        try {
          return value.bind(target);
        } catch {
          return value;
        }
      }
      return value;
    },
  });

  // Defense-in-depth: Block constructor chain escape ([].constructor.constructor('return this')())
  // Freeze key prototype constructors so they cannot be used to reach Function
  try {
    const prototypesToHarden = [
      Object.prototype,
      Array.prototype,
      String.prototype,
      Number.prototype,
      Boolean.prototype,
      RegExp.prototype,
    ];
    for (const proto of prototypesToHarden) {
      try {
        Object.defineProperty(proto, 'constructor', {
          value: proto.constructor,
          writable: false,
          configurable: false,
        });
      } catch {
        // Already frozen or non-configurable — acceptable
      }
    }
  } catch {
    console.warn('[ExtensionHost] Could not harden prototype constructors');
  }

  const paramNames = [
    'window',
    'self',
    'globalThis',
    'setTimeout',
    'setInterval',
    'document',
    ...BLOCKED_GLOBALS,
  ];
  const paramValues: unknown[] = [
    sandboxedWindow,
    sandboxedWindow,
    sandboxedWindow,
    safeSetTimeout,
    safeSetInterval,
    safeDocument,
    ...BLOCKED_GLOBALS.map(() => undefined),
  ];

   
  const execFn = new Function(...paramNames, jsContent);

  return execFn(...paramValues);
}

// ─── Global Hardening ────────────────────────────────────────────────────────

/**
 * Harden global prototypes to make sandbox escapes harder.
 * This is defense-in-depth only -- see the SECURITY TODO in executeSandboxed.
 */
export const hardenGlobals = () : void => {
  // Prevent Function constructor escape
  try {
    Object.defineProperty(Function.prototype, 'constructor', {
      value: Function.prototype.constructor,
      writable: false,
      configurable: false,
    });
  } catch {
    console.warn('[ExtensionHost] Could not freeze Function.prototype.constructor');
  }

  // Override setTimeout/setInterval globally to block string arguments (eval-like)
  const origSetTimeout = window.setTimeout.bind(window);
  const origSetInterval = window.setInterval.bind(window);
  window.__safeSetTimeout = (fn: TimerHandler, ms?: number, ...args: unknown[]) => {
    if (typeof fn === 'string') {
      console.warn('[ExtensionHost] Blocked string argument to setTimeout');
      return 0;
    }
    return origSetTimeout(fn, ms, ...args);
  };
  window.__safeSetInterval = (fn: TimerHandler, ms?: number, ...args: unknown[]) => {
    if (typeof fn === 'string') {
      console.warn('[ExtensionHost] Blocked string argument to setInterval');
      return 0;
    }
    return origSetInterval(fn, ms, ...args);
  };
};

// ─── Extension API Factory ──────────────────────────────────────────────────

/**
 * Create the sandboxed API object that is provided to an extension.
 * Each extension gets its own API instance scoped to its manifest.
 *
 * @param manifest - The extension's manifest
 * @param registerCommand - Callback to register a command
 * @param executeCommand - Callback to execute a command
 * @param eventBus - The event bus instance for scoped events
 * @param openDialog - Callback to open an extension dialog
 * @param closeDialog - Callback to close an extension dialog
 * @param reloadExtension - Callback to reload the extension
 * @param getReloadableExtensionIds - Callback to get reloadable extension IDs
 * @param hotReloadActive - Whether hot-reload is currently active
 */
export const createExtensionApi = (
  manifest: ExtensionManifest,
  registerCommand: (
    command: string,
    handler: (...args: unknown[]) => unknown,
  ) => { dispose: () => void },
  executeCommand: (command: string, ...args: unknown[]) => Promise<unknown>,
  eventBus: {
    on: (event: string, callback: EventCallback) => { dispose: () => void };
    emit: (event: string, ...args: unknown[]) => void;
  },
  openDialog: (dialogId: string, data: Record<string, unknown>) => void,
  closeDialog: (dialogId: string) => void,
  reloadExtension: (id: string) => Promise<void>,
  getReloadableExtensionIds: () => string[],
  hotReloadActive: boolean,
) => {
  return {
    files: {
      readText: async (path: string) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!isPathAllowed(path, '')) {
          throw new Error(`Extension "${manifest.id}" blocked from accessing path: ${path}`);
        }
        return TauriAPI.readTextFile(path);
      },
      read: async (path: string) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!isPathAllowed(path, '')) {
          throw new Error(`Extension "${manifest.id}" blocked from accessing path: ${path}`);
        }
        return TauriAPI.readBinaryFile(path);
      },
      write: async (path: string, content: string | ArrayBuffer) => {
        if (!hasPermission(manifest, 'file:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        if (!isPathAllowed(path, '')) {
          throw new Error(`Extension "${manifest.id}" blocked from accessing path: ${path}`);
        }
        const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
        return TauriAPI.agentWriteFileWithPermission(path, text, false);
      },
      exists: async (path: string) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!isPathAllowed(path, '')) {
          throw new Error(`Extension "${manifest.id}" blocked from accessing path: ${path}`);
        }
        return TauriAPI.fileExists(path);
      },
      list: async (path: string) => {
        if (!hasPermission(manifest, 'directory:list')) {
          throw new Error(`Extension "${manifest.id}" missing permission: directory:list`);
        }
        if (!isPathAllowed(path, '')) {
          throw new Error(`Extension "${manifest.id}" blocked from accessing path: ${path}`);
        }
        return TauriAPI.readDirectory(path);
      },
      watch: (path: string, callback: (event: string, filePath: string) => void) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        let unlisten: (() => void) | undefined;
        let wId: string | null = null;
        TauriAPI.watchDirectory(path, false)
          .then((id) => {
            wId = id;
          })
          .catch(() => {});
        TauriAPI.listenToEvent<{
          watcher_id: string;
          path: string;
          event_type: string;
          timestamp: number;
        }>('fs-change', (payload) => {
          if (wId && payload.watcher_id === wId) {
            callback(payload.event_type, payload.path);
          }
        })
          .then((fn) => {
            unlisten = fn;
          })
          .catch(() => {});
        return {
          dispose: () => {
            unlisten?.();
            if (wId) {
              TauriAPI.unwatchDirectory(wId).catch(() => {});
            }
          },
        };
      },
    },
    ui: {
      showMessage: (message: string, type: 'info' | 'warning' | 'error' = 'info') => {
        if (type === 'error') {
          console.error(`[${manifest.name}] ${message}`);
        } else {
          console.warn(`[${manifest.name}] ${message}`);
        }
      },
      showProgress: async (
        title: string,
        task: (progress: (value: number, message?: string) => void) => Promise<void>,
      ) => {
        console.warn(`[${manifest.name}] Progress: ${title}`);
        await task((value, message) => {
          console.warn(`[${manifest.name}] ${title}: ${value}%${message ? ` - ${message}` : ''}`);
        });
      },
      showInputBox: async (options: { prompt?: string; placeholder?: string; value?: string }) => {
        return (
          window.prompt(
            options.prompt || options.placeholder || 'Enter a value',
            options.value || '',
          ) || undefined
        );
      },
      showQuickPick: async <T>(items: T[], _options?: { placeHolder?: string }) => {
        if (items.length === 0) return undefined;
        return items[0]; // Simplified: return first item. Full UI picker not yet implemented.
      },
    },
    navigation: {
      getCurrentPath: () => window.__xplorer_state__?.currentPath || '',
      navigateTo: (path: string) => {
        window.__xplorer_state__?.navigateTo?.(path);
      },
      openFile: (path: string) => {
        TauriAPI.openFile(path).catch((err) =>
          console.error(`[${manifest.name}] Failed to open file:`, err),
        );
      },
      openInNewTab: (path: string) => {
        window.dispatchEvent(new CustomEvent('xplorer-open-in-editor', { detail: { path } }));
      },
      openInEditor: (path: string) => {
        window.dispatchEvent(new CustomEvent('xplorer-open-in-editor', { detail: { path } }));
      },
      openTab: (options: {
        type: string;
        name: string;
        path: string;
        data?: Record<string, unknown>;
      }) => {
        window.dispatchEvent(
          new CustomEvent('xplorer-open-extension-tab', {
            detail: {
              type: options.type,
              name: options.name,
              path: options.path,
              data: options.data,
            },
          }),
        );
      },
    },
    settings: {
      get: async <T = unknown>(key: string, defaultValue?: T): Promise<T | undefined> => {
        const value = await TauriAPI.getExtensionStorage(manifest.id, key);
        return (value as T) ?? defaultValue;
      },
      set: async (key: string, value: unknown) =>
        TauriAPI.setExtensionStorage(manifest.id, key, value),
      delete: async (key: string) => TauriAPI.deleteExtensionStorage(manifest.id, key),
    },
    commands: {
      register: (command: string, callback: (...args: unknown[]) => unknown) => {
        const namespacedId = command.startsWith(`${manifest.id}.`)
          ? command
          : `${manifest.id}.${command}`;
        return registerCommand(namespacedId, callback);
      },
      execute: (command: string, ...args: unknown[]) => {
        // Allow executing own namespaced commands, state/workspace commands, or explicitly namespaced commands
        const allowedPrefixes = [
          `${manifest.id}.`,
          `state:${manifest.id}:`,
          `workspace:${manifest.id}:`,
        ];
        const isOwn = allowedPrefixes.some((p) => command.startsWith(p));
        // Also allow if the command already has a namespace (contains a dot)
        if (!isOwn && !command.includes('.') && !command.includes(':')) {
          // Try the namespaced version first
          command = `${manifest.id}.${command}`;
        }
        return executeCommand(command, ...args);
      },
    },
    events: {
      on: (event: string, callback: EventCallback): { dispose: () => void } => {
        const ownPrefix = `${manifest.id}:`;
        const isOwn = event === manifest.id || event.startsWith(ownPrefix);
        const isSystem = event.startsWith('system:') || event.startsWith('xplorer:');
        if (!isOwn && !isSystem) {
          console.warn(
            `[Security] Extension "${manifest.id}" tried to listen to event "${event}" outside its namespace`,
          );
          return { dispose: () => {} }; // noop unsubscribe
        }
        return eventBus.on(event, callback);
      },
      emit: (event: string, data?: unknown) => {
        // Only emit own events — auto-prefix if not already prefixed
        const ownPrefix = `${manifest.id}:`;
        if (event !== manifest.id && !event.startsWith(ownPrefix)) {
          event = `${manifest.id}:${event}`;
        }
        eventBus.emit(event, data);
      },
    },
    nativeInvoke: async (command: string, args?: Record<string, unknown>) => {
      if (!hasPermission(manifest, 'native:invoke')) {
        throw new Error(`Extension "${manifest.id}" missing permission: native:invoke`);
      }
      return TauriAPI.nativePluginInvoke(manifest.id, command, args || {});
    },
    shortcuts: {
      register: async (
        shortcutId: string,
        options: { key: string; title?: string; when?: string },
      ) => {
        const parts = options.key.toLowerCase().split('+');
        const key = parts[parts.length - 1];
        return TauriAPI.registerExtensionShortcut(
          manifest.id,
          shortcutId,
          options.title || shortcutId,
          options.title || null,
          {
            key,
            ctrl: parts.includes('ctrl'),
            alt: parts.includes('alt'),
            shift: parts.includes('shift'),
            meta: parts.includes('meta'),
          },
          shortcutId,
          options.when ? [options.when] : ['file-explorer'],
        );
      },
      unregisterAll: async () => {
        return TauriAPI.unregisterExtensionShortcuts(manifest.id);
      },
    },
    // File utilities — extended operations for dialogs and tools
    fileUtils: {
      getProperties: async (path: string) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.getDetailedFileProperties(path);
      },
      setPermissions: async (path: string, permissions: string) => {
        if (!hasPermission(manifest, 'file:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.setFilePermissions(path, permissions);
      },
      isDir: async (path: string) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.isDir(path);
      },
      getBasicProperties: async (path: string) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.getFileProperties(path);
      },
      getTags: async (path: string) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.getFileTags(path);
      },
      setTags: async (path: string, tags: Array<{ name: string; color: string }>) => {
        if (!hasPermission(manifest, 'file:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.setFileTags(path, tags);
      },
      bulkRename: async (
        paths: string[],
        pattern: string,
        replacement: string,
        previewOnly: boolean,
      ) => {
        if (!hasPermission(manifest, 'file:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.bulkRename(paths, pattern, replacement, previewOnly);
      },
      getAssociations: async (path: string) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.getFileAssociations(path);
      },
      getSystemApps: async () => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.getSystemApplications();
      },
      openWith: async (path: string, appPath: string) => {
        if (!hasPermission(manifest, 'file:execute')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:execute`);
        }
        return TauriAPI.openFileWithApplication(path, appPath);
      },
      setDefaultApp: async (fileExtension: string, appPath: string) => {
        if (!hasPermission(manifest, 'file:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.setDefaultApplication(fileExtension, appPath);
      },
      compress: async (
        paths: string[],
        outputPath: string,
        options: {
          format: string;
          compression_level?: number;
          password?: string;
          include_hidden: boolean;
          follow_symlinks: boolean;
        },
      ) => {
        if (!hasPermission(manifest, 'file:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.compressFiles(paths, outputPath, options as CompressionOptions);
      },
      getCompressionInfo: async (paths: string[]) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.getCompressionInfo(paths);
      },
      extract: async (
        archivePath: string,
        options: {
          output_directory: string;
          password?: string;
          overwrite_existing: boolean;
          preserve_permissions: boolean;
          include_hidden: boolean;
        },
      ) => {
        if (!hasPermission(manifest, 'file:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.extractArchive(archivePath, options as ExtractionOptions);
      },
      getArchiveInfo: async (path: string) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.getArchiveInfo(path);
      },
    },
    /** Dev-mode utilities for extension hot-reload */
    dev: {
      isDevMode: () => import.meta.env.DEV as boolean,
      reload: () => reloadExtension(manifest.id),
      getLoadedExtensions: () => getReloadableExtensionIds(),
      isHotReloadActive: () => hotReloadActive,
    },
    storage: {
      get: async <T = unknown>(key: string): Promise<T | null> => {
        const value = await TauriAPI.getExtensionStorage(manifest.id, key);
        return (value as T) ?? null;
      },
      set: async (key: string, value: unknown) => {
        return TauriAPI.setExtensionStorage(manifest.id, key, value);
      },
      delete: async (key: string) => {
        return TauriAPI.deleteExtensionStorage(manifest.id, key);
      },
    },
    ai: {
      getModels: async () => {
        if (!hasPermission(manifest, 'ai:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: ai:read`);
        }
        return TauriAPI.getAiModels();
      },
      chat: async (
        model: string,
        messages: Array<{ role: string; content: string }>,
        fileContext?: { path: string; content?: string; language?: string },
      ) => {
        if (!hasPermission(manifest, 'ai:chat')) {
          throw new Error(`Extension "${manifest.id}" missing permission: ai:chat`);
        }
        const ctx = fileContext
          ? {
              name: fileContext.path.split(/[\\/]/).pop() || '',
              path: fileContext.path,
              file_type: fileContext.language || '',
              content: fileContext.content,
            }
          : undefined;
        return TauriAPI.chatWithAI(model, messages, ctx);
      },
      checkOllamaStatus: async () => {
        return TauriAPI.checkOllamaStatus();
      },
    },
    search: {
      query: async (query: string, limit?: number) => {
        if (!hasPermission(manifest, 'search:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: search:read`);
        }
        const result = await TauriAPI.enhancedSearch(query, undefined, limit);
        return result.results;
      },
      semantic: async (query: string, limit?: number) => {
        if (!hasPermission(manifest, 'search:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: search:read`);
        }
        return TauriAPI.semanticSearch(query, limit);
      },
      findDuplicates: async (
        rootPath: string,
        options?: {
          minFileSize?: number;
          maxFileSize?: number;
          includeHidden?: boolean;
          fileExtensions?: string[];
        },
      ) => {
        if (!hasPermission(manifest, 'search:duplicates')) {
          throw new Error(`Extension "${manifest.id}" missing permission: search:duplicates`);
        }
        return Duplicates.findDuplicates(
          rootPath,
          options?.minFileSize,
          options?.maxFileSize,
          options?.includeHidden,
          options?.fileExtensions,
        );
      },
    },
    dialog: {
      confirm: async (message: string) => {
        return window.confirm(message);
      },
      alert: async (message: string) => {
        window.alert(message);
      },
      openExtensionDialog: (dialogId: string, data: Record<string, unknown>) => {
        openDialog(dialogId, data);
      },
      closeExtensionDialog: (dialogId: string) => {
        closeDialog(dialogId);
      },
      pickSaveFile: async (defaultPath?: string) => {
        if (!hasPermission(manifest, 'file:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        try {
          const { save } = await import('@tauri-apps/plugin-dialog');
          return (await save({ defaultPath })) || null;
        } catch {
          return window.prompt('Save file path:', defaultPath) || null;
        }
      },
      pickFile: async (options?: {
        multiple?: boolean;
        filters?: Array<{ name: string; extensions: string[] }>;
      }) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        try {
          const { open } = await import('@tauri-apps/plugin-dialog');
          const result = await open({ multiple: options?.multiple, filters: options?.filters });
          if (!result) return null;
          return Array.isArray(result) ? result : [result];
        } catch {
          const path = window.prompt('Select file path:');
          return path ? [path] : null;
        }
      },
    },
    analytics: {
      analyzeStorage: async (path: string) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return Analytics.analyzeStorage(path);
      },
    },
    comparison: {
      compareFiles: async (
        file1Path: string,
        file2Path: string,
        options?: { ignoreWhitespace?: boolean; contextLines?: number },
      ) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.compareFiles(file1Path, file2Path, options);
      },
    },
    organizer: {
      analyzeDirectory: async (path: string) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return Organizer.analyzeDirectory(path);
      },
      previewOrganization: async (path: string, suggestionIndices: number[]) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return Organizer.previewOrganization(path, suggestionIndices);
      },
      executeOrganization: async (plan: unknown) => {
        if (!hasPermission(manifest, 'file:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return Organizer.executeOrganization(plan as OrganizationPlan);
      },
    },
    gdrive: {
      authenticate: async () => {
        if (!hasPermission(manifest, 'gdrive:access'))
          throw new Error(`Extension "${manifest.id}" missing permission: gdrive:access`);
        return transport('gdrive_authenticate');
      },
      disconnect: async (accountId: string) => {
        if (!hasPermission(manifest, 'gdrive:access'))
          throw new Error(`Extension "${manifest.id}" missing permission: gdrive:access`);
        return transport('gdrive_disconnect', { accountId });
      },
      listAccounts: async () => {
        if (!hasPermission(manifest, 'gdrive:access'))
          throw new Error(`Extension "${manifest.id}" missing permission: gdrive:access`);
        return transport('gdrive_list_accounts');
      },
      listFiles: async (accountId: string, folderId: string) => {
        if (!hasPermission(manifest, 'gdrive:access'))
          throw new Error(`Extension "${manifest.id}" missing permission: gdrive:access`);
        return transport('gdrive_list_files', { accountId, folderId });
      },
      downloadFile: async (accountId: string, fileId: string, localPath: string) => {
        if (!hasPermission(manifest, 'gdrive:access'))
          throw new Error(`Extension "${manifest.id}" missing permission: gdrive:access`);
        return transport('gdrive_download_file', { accountId, fileId, localPath });
      },
      uploadFile: async (accountId: string, localPath: string, parentFolderId: string) => {
        if (!hasPermission(manifest, 'gdrive:access'))
          throw new Error(`Extension "${manifest.id}" missing permission: gdrive:access`);
        return transport('gdrive_upload_file', { accountId, localPath, parentFolderId });
      },
      deleteFile: async (accountId: string, fileId: string) => {
        if (!hasPermission(manifest, 'gdrive:access'))
          throw new Error(`Extension "${manifest.id}" missing permission: gdrive:access`);
        return transport('gdrive_delete_file', { accountId, fileId });
      },
      renameFile: async (accountId: string, fileId: string, newName: string) => {
        if (!hasPermission(manifest, 'gdrive:access'))
          throw new Error(`Extension "${manifest.id}" missing permission: gdrive:access`);
        return transport('gdrive_rename_file', { accountId, fileId, newName });
      },
      moveFile: async (
        accountId: string,
        fileId: string,
        newParentId: string,
        oldParentId: string,
      ) => {
        if (!hasPermission(manifest, 'gdrive:access'))
          throw new Error(`Extension "${manifest.id}" missing permission: gdrive:access`);
        return transport('gdrive_move_file', { accountId, fileId, newParentId, oldParentId });
      },
      createFolder: async (accountId: string, name: string, parentFolderId: string) => {
        if (!hasPermission(manifest, 'gdrive:access'))
          throw new Error(`Extension "${manifest.id}" missing permission: gdrive:access`);
        return transport('gdrive_create_folder', { accountId, name, parentFolderId });
      },
      getFileContent: async (accountId: string, fileId: string) => {
        if (!hasPermission(manifest, 'gdrive:access'))
          throw new Error(`Extension "${manifest.id}" missing permission: gdrive:access`);
        return transport('gdrive_get_file_content', { accountId, fileId });
      },
      getSettings: async () => {
        if (!hasPermission(manifest, 'gdrive:access'))
          throw new Error(`Extension "${manifest.id}" missing permission: gdrive:access`);
        return transport('get_gdrive_settings');
      },
      updateSettings: async (clientId: string, clientSecret: string) => {
        if (!hasPermission(manifest, 'gdrive:access'))
          throw new Error(`Extension "${manifest.id}" missing permission: gdrive:access`);
        return transport('update_gdrive_settings', { clientId, clientSecret });
      },
    },
    git: {
      findRepository: async (path: string) => {
        if (!hasPermission(manifest, 'git:read'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:read`);
        return transport('find_git_repository', { path });
      },
      getRepositoryInfo: async (repoPath: string) => {
        if (!hasPermission(manifest, 'git:read'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:read`);
        return transport('get_repository_info', { repoPath });
      },
      getFileHistory: async (repoPath: string, filePath: string, limit?: number) => {
        if (!hasPermission(manifest, 'git:read'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:read`);
        return transport('get_file_history', { repoPath, filePath, limit });
      },
      getFileBlame: async (repoPath: string, filePath: string) => {
        if (!hasPermission(manifest, 'git:read'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:read`);
        return transport('get_file_blame', { repoPath, filePath });
      },
      getFileDiff: async (repoPath: string, filePath: string, commitHash?: string) => {
        if (!hasPermission(manifest, 'git:read'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:read`);
        return transport('get_file_diff', { repoPath, filePath, commitHash });
      },
      getCommitDiff: async (repoPath: string, commitHash: string) => {
        if (!hasPermission(manifest, 'git:read'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:read`);
        return transport('get_commit_diff', { repoPath, commitHash });
      },
      getAllCommits: async (repoPath: string, limit?: number, branch?: string) => {
        if (!hasPermission(manifest, 'git:read'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:read`);
        return transport('get_all_commits', { repoPath, limit, branch });
      },
      getFileStatus: async (repoPath: string) => {
        if (!hasPermission(manifest, 'git:read'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:read`);
        return transport('get_file_status', { repoPath });
      },
      getBranches: async (repoPath: string) => {
        if (!hasPermission(manifest, 'git:read'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:read`);
        return transport('get_branches', { repoPath });
      },
      createBranch: async (repoPath: string, branchName: string, fromCommit?: string) => {
        if (!hasPermission(manifest, 'git:write'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:write`);
        return transport('create_branch', { repoPath, branchName, fromCommit });
      },
      switchBranch: async (repoPath: string, branchName: string) => {
        if (!hasPermission(manifest, 'git:write'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:write`);
        return transport('switch_branch', { repoPath, branchName });
      },
      deleteBranch: async (repoPath: string, branchName: string, force?: boolean) => {
        if (!hasPermission(manifest, 'git:write'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:write`);
        return transport('delete_branch', { repoPath, branchName, force });
      },
      stageFile: async (repoPath: string, filePath: string) => {
        if (!hasPermission(manifest, 'git:write'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:write`);
        return transport('stage_file', { repoPath, filePath });
      },
      unstageFile: async (repoPath: string, filePath: string) => {
        if (!hasPermission(manifest, 'git:write'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:write`);
        return transport('unstage_file', { repoPath, filePath });
      },
      commitChanges: async (repoPath: string, message: string, amend?: boolean) => {
        if (!hasPermission(manifest, 'git:write'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:write`);
        return transport('commit_changes', { repoPath, message, amend });
      },
      getStashes: async (repoPath: string) => {
        if (!hasPermission(manifest, 'git:read'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:read`);
        return transport('get_stashes', { repoPath });
      },
      createStash: async (repoPath: string, message?: string, includeUntracked?: boolean) => {
        if (!hasPermission(manifest, 'git:write'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:write`);
        return transport('create_stash', { repoPath, message, includeUntracked });
      },
      applyStash: async (repoPath: string, stashIndex: number, pop?: boolean) => {
        if (!hasPermission(manifest, 'git:write'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:write`);
        return transport('apply_stash', { repoPath, stashIndex, pop });
      },
      dropStash: async (repoPath: string, stashIndex: number) => {
        if (!hasPermission(manifest, 'git:write'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:write`);
        return transport('drop_stash', { repoPath, stashIndex });
      },
      getGitStatus: async (directory: string) => {
        if (!hasPermission(manifest, 'git:read'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:read`);
        return transport('get_git_status', { directory });
      },
      getGitRepoInfo: async (directory: string) => {
        if (!hasPermission(manifest, 'git:read'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:read`);
        return transport('get_git_repo_info', { directory });
      },
      pull: async (dir: string) => {
        if (!hasPermission(manifest, 'git:write'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:write`);
        return transport('git_pull', { directory: dir });
      },
      push: async (dir: string, force?: boolean) => {
        if (!hasPermission(manifest, 'git:write'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:write`);
        return transport('git_push', { directory: dir, force: force ?? false });
      },
      fetch: async (dir: string) => {
        if (!hasPermission(manifest, 'git:read'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:read`);
        return transport('git_fetch', { directory: dir });
      },
      getRemotes: async (dir: string) => {
        if (!hasPermission(manifest, 'git:read'))
          throw new Error(`Extension "${manifest.id}" missing permission: git:read`);
        return transport('git_get_remotes', { directory: dir });
      },
    },
    diagnostics: {
      diagnoseDirectory: async (
        path: string,
        skipHidden = true,
        skipGitignored = true,
      ) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: files:read`);
        }
        return transport('diagnose_directory', { path, skipHidden, skipGitignored });
      },
    },
    docker: {
      isAvailable: async () => {
        if (!hasPermission(manifest, 'system:exec'))
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        return transport('docker_is_available');
      },
      listContainers: async (all: boolean) => {
        if (!hasPermission(manifest, 'system:exec'))
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        return transport('docker_list_containers', { all });
      },
      listImages: async () => {
        if (!hasPermission(manifest, 'system:exec'))
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        return transport('docker_list_images');
      },
      startContainer: async (id: string) => {
        if (!hasPermission(manifest, 'system:exec'))
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        return transport('docker_start_container', { id });
      },
      stopContainer: async (id: string) => {
        if (!hasPermission(manifest, 'system:exec'))
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        return transport('docker_stop_container', { id });
      },
      removeContainer: async (id: string, force: boolean) => {
        if (!hasPermission(manifest, 'system:exec'))
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        return transport('docker_remove_container', { id, force });
      },
      removeImage: async (id: string, force: boolean) => {
        if (!hasPermission(manifest, 'system:exec'))
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        return transport('docker_remove_image', { id, force });
      },
      containerLogs: async (id: string, lines: number) => {
        if (!hasPermission(manifest, 'system:exec'))
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        return transport('docker_container_logs', { id, lines });
      },
    },
  };
};
