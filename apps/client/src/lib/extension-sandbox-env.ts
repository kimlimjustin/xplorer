/**
 * Shared sandbox environment creation for extension execution.
 *
 * Both extension-host.ts (ExtensionHost.loadExtensionJS) and
 * extension-sandbox.ts (executeSandboxed) use identical proxy-based
 * sandboxing. This module is the single source of truth for that logic.
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Globals that are blocked both via Proxy interception AND as
 * Function parameter shadowing.
 *
 * NOTE: 'eval' and 'arguments' CANNOT be used as parameter names in strict
 * mode (SyntaxError), so they are listed separately in PROXY_ONLY_BLOCKED.
 */
export const BLOCKED_GLOBALS: readonly string[] = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'localStorage',
  'sessionStorage',
  'indexedDB',
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

/**
 * Globals that can only be blocked via the Proxy (not as parameter names
 * because strict-mode forbids them as formal parameters).
 */
export const PROXY_ONLY_BLOCKED: readonly string[] = ['eval', 'arguments'];

/**
 * Prototype traversal methods blocked on proxied objects.
 */
export const BLOCKED_PROTOTYPE_METHODS: ReadonlySet<string> = new Set([
  '__proto__',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

/**
 * HTML elements that extensions are never allowed to create.
 */
const BLOCKED_ELEMENTS: readonly string[] = [
  'script',
  'iframe',
  'object',
  'embed',
  'frame',
  'link',
];

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TimerTracker {
  timeouts: number[];
  intervals: number[];
}

export interface SandboxEnvironment {
  /** Proxied document that blocks script injection and window escape */
  safeDocument: typeof document;
  /** Proxied window that blocks dangerous globals and prototype traversal */
  sandboxedWindow: typeof window;
  /** Sandboxed Object that blocks prototype introspection */
  sandboxedObject: typeof Object;
  /** Sandboxed Reflect that blocks prototype manipulation */
  sandboxedReflect: typeof Reflect;
  /** Safe setTimeout that rejects string arguments */
  safeSetTimeout: (fn: Function | string, ms?: number, ...args: unknown[]) => number;
  /** Safe setInterval that rejects string arguments */
  safeSetInterval: (fn: Function | string, ms?: number, ...args: unknown[]) => number;
  /** The full set of blocked global names (param-safe + proxy-only) */
  blockedSet: ReadonlySet<string>;
}

export interface SandboxEnvironmentOptions {
  /** Extension ID used in warning/error messages */
  extId: string;
  /** Optional timer tracker for cleanup on extension unload */
  trackedTimers?: TimerTracker;
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a fully sandboxed environment for extension execution.
 *
 * Returns proxied document, window, Object, Reflect, and safe timer
 * functions. The caller is responsible for wiring these into the
 * Function constructor call that runs the extension bundle.
 */
export const createSandboxedEnvironment = (
  options: SandboxEnvironmentOptions,
): SandboxEnvironment => {
  const { extId, trackedTimers } = options;

  const blockedSet: ReadonlySet<string> = new Set([...BLOCKED_GLOBALS, ...PROXY_ONLY_BLOCKED]);

  // ── Safe timers ───────────────────────────────────────────────────────
  const safeSetTimeout = (fn: Function | string, ms?: number, ...args: unknown[]): number => {
    if (typeof fn === 'string') {
      throw new Error('String argument to setTimeout is not allowed in extension sandbox');
    }
    const id = setTimeout(fn, ms, ...args) as unknown as number;
    if (trackedTimers) {
      trackedTimers.timeouts.push(id);
    }
    return id;
  };

  const safeSetInterval = (fn: Function | string, ms?: number, ...args: unknown[]): number => {
    if (typeof fn === 'string') {
      throw new Error('String argument to setInterval is not allowed in extension sandbox');
    }
    const id = setInterval(fn, ms, ...args) as unknown as number;
    if (trackedTimers) {
      trackedTimers.intervals.push(id);
    }
    return id;
  };

  // ── Document proxy ────────────────────────────────────────────────────
  const safeDocument = new Proxy(document, {
    get(target, prop) {
      // Respect Proxy invariant: non-configurable non-writable props must return real value
      const desc = Object.getOwnPropertyDescriptor(target, prop);
      if (desc && !desc.configurable && !desc.writable && desc.value !== undefined) {
        return desc.value;
      }
      // Block escape to window via document.defaultView / document.parentWindow
      if (prop === 'defaultView' || prop === 'parentWindow') {
        return null;
      }
      // Block prototype chain traversal on document proxy
      if (BLOCKED_PROTOTYPE_METHODS.has(String(prop))) {
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
            let rawTag = '';
            if (typeof args[0] === 'string') {
              rawTag = args[0];
            } else if (typeof args[1] === 'string') {
              rawTag = args[1];
            }
            const tagName = rawTag.toLowerCase();
            if (BLOCKED_ELEMENTS.includes(tagName)) {
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

  // ── Sandboxed Object ──────────────────────────────────────────────────
  // Mutable ref so sandboxedObject can reference sandboxedWindow before it is created
  const windowRef: { current: typeof window | null } = { current: null };

  const sandboxedObject = Object.create(Object) as typeof Object;
  sandboxedObject.getPrototypeOf = (_target: unknown) => null;
  sandboxedObject.getOwnPropertyDescriptor = (target: unknown, prop: PropertyKey) => {
    // Block reading descriptors from the window proxy (could expose unproxied values)
    if (target === windowRef.current || target === window) {
      return undefined;
    }
    return Object.getOwnPropertyDescriptor(target as object, prop);
  };
  Object.freeze(sandboxedObject);

  // ── Sandboxed Reflect ─────────────────────────────────────────────────
  const sandboxedReflect = new Proxy(Reflect, {
    get(target, reflectProp) {
      // Respect Proxy invariant: non-configurable non-writable props must return real value
      const desc = Object.getOwnPropertyDescriptor(target, reflectProp);
      if (desc && !desc.configurable && !desc.writable && desc.value !== undefined) {
        return desc.value;
      }
      if (reflectProp === 'getPrototypeOf' || reflectProp === 'setPrototypeOf') {
        return undefined;
      }
      return (target as unknown as Record<string | symbol, unknown>)[reflectProp];
    },
  });

  // ── Window proxy ──────────────────────────────────────────────────────
  const sandboxedWindow = new Proxy(window, {
    get(target, prop, _receiver) {
      // Respect Proxy invariant: non-configurable non-writable props must return real value
      const desc = Object.getOwnPropertyDescriptor(target, prop);
      if (desc && !desc.configurable && !desc.writable && desc.value !== undefined) {
        return desc.value;
      }

      if (blockedSet.has(prop as string)) {
        console.warn(`[Sandbox] Extension "${extId}" tried to access blocked API: ${String(prop)}`);
        return undefined;
      }

      // Block prototype chain traversal methods
      if (BLOCKED_PROTOTYPE_METHODS.has(String(prop))) {
        console.warn(
          `[Sandbox] Extension "${extId}" tried to access blocked prototype method: ${String(prop)}`,
        );
        return undefined;
      }

      // Block constructor access that could escape sandbox
      if (prop === 'constructor') {
        return undefined;
      }

      // Intercept Object to block prototype introspection escape
      if (prop === 'Object') {
        return sandboxedObject;
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

  // Complete the forward reference so sandboxedObject can check against it
  windowRef.current = sandboxedWindow;

  // ── Prototype hardening ───────────────────────────────────────────────
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

  return {
    safeDocument: safeDocument as unknown as typeof document,
    sandboxedWindow: sandboxedWindow as unknown as typeof window,
    sandboxedObject,
    sandboxedReflect,
    safeSetTimeout,
    safeSetInterval,
    blockedSet,
  };
};
