import React from 'react';
import { TauriAPI } from './tauri-api';
import { listen } from '@tauri-apps/api/event';
import { resolveIcon } from './extension-host-icon';
import {
  EventBus,
  type ExtensionManifest,
  type ExtensionPackage,
  type PanelRegistration,
  type PanelRenderProps,
  type FileDecoration,
  type FileDecorator,
  type ContextMenuEntry,
  type EditorRegistration,
  type PreviewRegistration,
  type ExtensionFileInfo,
  type CommandHandler,
  type EventCallback,
  type LoadedExtension,
} from './extension-host-types';
import { createExtensionApi } from './extension-api-factory';
import { STORAGE_KEYS } from './storage-keys';
import { createSandboxedEnvironment, BLOCKED_GLOBALS } from './extension-sandbox-env';
import { registerSidebarTab, registerBottomTab } from './extension-registration-helpers';
import {
  cleanupExtensionRegistrations,
  queryPreviewProvider,
  findEditorForFile,
  getActivePanels,
  getActiveFileDecorations,
  getActiveContextMenuItems,
  buildCommandPaletteEntries,
  getActiveSidebarTabs,
  getActiveBottomTabs,
  checkForUpdates,
} from './extension-host-queries';

// Re-export all types and helpers so consumers can import from either location
export * from './extension-host-types';
export { resolveIcon } from './extension-host-icon';

// ─── Extension Host ────────────────────────────────────────────────────────────

type DialogRenderer = (props: {
  isOpen: boolean;
  onClose: () => void;
  data: Record<string, unknown>;
}) => React.ReactElement;
type TabRenderer = (props: Record<string, unknown>) => React.ReactElement;

class ExtensionHost {
  private extensions = new Map<string, LoadedExtension>();
  private panelRegistry = new Map<string, PanelRegistration>();
  private editorRegistry = new Map<string, EditorRegistration>();
  private previewRegistry = new Map<string, PreviewRegistration>();
  private commandRegistry = new Map<string, CommandHandler>();
  private commandMetadata = new Map<
    string,
    { title: string; shortcut?: string; category?: string }
  >();
  private commandChangeListeners = new Set<() => void>();
  private decoratorRegistry = new Map<string, FileDecorator>();
  private contextMenuEntries = new Map<string, ContextMenuEntry[]>();
  private dialogRegistry = new Map<string, DialogRenderer>();
  private openDialogsMap = new Map<string, Record<string, unknown>>();
  private bundleCache = new Map<string, string>();
  private extensionPackages = new Map<string, ExtensionPackage>();
  private devReloadCounts = new Map<string, number>();
  private tabRendererRegistry = new Map<string, TabRenderer>();
  private sidebarTabRegistry = new Map<
    string,
    {
      id: string;
      extensionId: string;
      title: string;
      icon: React.ReactNode;
      render: (props: { currentPath?: string; isActive?: boolean }) => React.ReactElement;
    }
  >();
  private bottomTabRegistry = new Map<
    string,
    {
      id: string;
      extensionId: string;
      title: string;
      icon: React.ReactNode;
      render: (props: { currentPath?: string; isActive?: boolean }) => React.ReactElement;
    }
  >();
  private extensionSchemes = new Set<string>();
  private eventBus = new EventBus();
  private changeListeners = new Set<() => void>();
  private expectedExtensionId: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, '__xplorer_register__', {
        value: (extension: unknown) => {
          void this.registerExternalExtension(extension);
        },
        writable: true,
        configurable: false,
      });
      this.hardenGlobals();
      this.initDevReloadListener();
    }
  }

  /**
   * Listen for extension-dev-reload events from the Rust dev watcher.
   * When received, hot-reload the extension by unloading and re-loading it.
   */
  private initDevReloadListener(): void {
    listen<{ path: string; id: string }>('extension-dev-reload', async (event) => {
      const { id } = event.payload;
      console.warn(`[ExtensionHost] Dev reload triggered for: ${id}`);
      await this.reloadExtension(id);
      window.dispatchEvent(
        new CustomEvent('xplorer:extension-dev-reloaded', {
          detail: { id },
        }),
      );
    }).catch((err) => {
      console.warn('[ExtensionHost] Failed to set up dev reload listener:', err);
    });
  }

  /**
   * Harden global prototypes to make sandbox escapes harder.
   * This is defense-in-depth only -- see the SECURITY TODO in loadExtensionScript.
   */
  private hardenGlobals() {
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
    const win = window as unknown as Record<string, unknown>;
    win.__safeSetTimeout = (fn: TimerHandler, ms?: number, ...args: unknown[]) => {
      if (typeof fn === 'string') {
        console.warn('[ExtensionHost] Blocked string argument to setTimeout');
        return 0;
      }
      return origSetTimeout(fn, ms, ...args);
    };
    win.__safeSetInterval = (fn: TimerHandler, ms?: number, ...args: unknown[]) => {
      if (typeof fn === 'string') {
        console.warn('[ExtensionHost] Blocked string argument to setInterval');
        return 0;
      }
      return origSetInterval(fn, ms, ...args);
    };
  }

  private hasPermission(manifest: ExtensionManifest, permission: string): boolean {
    return (manifest.permissions || []).includes(permission);
  }

  private createExtensionApi(manifest: ExtensionManifest) {
    return createExtensionApi(manifest, {
      hasPermission: this.hasPermission.bind(this),
      registerCommand: this.registerCommand.bind(this),
      executeCommand: this.executeCommand.bind(this),
      eventBus: this.eventBus,
    });
  }

  private async registerExternalExtension(instance: unknown): Promise<void> {
    const ext = instance as Record<string, unknown> | null | undefined;
    const extManifest = ext?.manifest as Record<string, unknown> | undefined;
    if (!ext || !extManifest?.id) {
      console.error('[ExtensionHost] Ignoring extension registration without a valid manifest');
      return;
    }

    // Validate that the registering extension ID matches what we expect
    if (this.expectedExtensionId && extManifest.id !== this.expectedExtensionId) {
      console.error(
        `[ExtensionHost] Extension ID mismatch: expected "${this.expectedExtensionId}", got "${extManifest.id}"`,
      );
      return;
    }

    const manifest: ExtensionManifest = ext.manifest as ExtensionManifest;
    this.extensions.set(manifest.id, {
      id: manifest.id,
      manifest,
      isActive: false,
      isBuiltin: false,
      instance,
    });

    if (manifest.contributes?.panels) {
      for (const panel of manifest.contributes.panels) {
        this.panelRegistry.set(panel.id, {
          id: panel.id,
          extensionId: manifest.id,
          title: panel.title,
          icon: resolveIcon(panel.icon),
          location: (panel.location as 'sidebar' | 'bottom' | 'right') || 'right',
          isBuiltin: false,
          render: (props: PanelRenderProps) => {
            try {
              if (typeof ext.render === 'function') {
                return (ext.render as (props: PanelRenderProps) => React.ReactElement)(props);
              }
              return React.createElement(
                'div',
                { className: 'p-4 text-sm text-xp-text-muted' },
                `Panel: ${panel.title}`,
              );
            } catch (err) {
              console.error(`[ExtensionHost] Panel render failed for "${panel.id}":`, err);
              return React.createElement(
                'div',
                { className: 'p-4 text-sm text-red-400' },
                `Panel "${panel.title}" failed to render.`,
              );
            }
          },
        });
      }
    }

    // Register editors from contributes.editors + renderEditor function
    if (manifest.contributes?.editors && typeof ext.renderEditor === 'function') {
      for (const editor of manifest.contributes.editors) {
        this.editorRegistry.set(editor.id, {
          id: editor.id,
          extensionId: manifest.id,
          extensions: editor.extensions,
          priority: editor.priority ?? 10,
          render: (props: { filePath: string }) => {
            try {
              return (ext.renderEditor as (props: { filePath: string }) => React.ReactElement)(
                props,
              );
            } catch (err) {
              console.error(`[ExtensionHost] Editor render failed for "${editor.id}":`, err);
              return React.createElement(
                'div',
                { className: 'p-4 text-sm text-red-400' },
                `Editor "${editor.id}" failed to render.`,
              );
            }
          },
        });
      }
    }

    // Register preview providers (category: 'preview' with canPreview + render)
    if (
      manifest.category === 'preview' &&
      typeof ext.canPreview === 'function' &&
      typeof ext.render === 'function'
    ) {
      const priority =
        typeof ext.getPriority === 'function' ? (ext.getPriority as () => number)() : 10;
      this.previewRegistry.set(manifest.id, {
        id: manifest.id,
        extensionId: manifest.id,
        priority,
        canPreview: (file) => {
          try {
            return (ext.canPreview as (file: unknown) => boolean)(file);
          } catch (err) {
            console.error(`[ExtensionHost] Preview canPreview failed for "${manifest.id}":`, err);
            return false;
          }
        },
        render: (props) => {
          try {
            return (ext.render as (props: unknown) => React.ReactElement)(props);
          } catch (err) {
            console.error(`[ExtensionHost] Preview render failed for "${manifest.id}":`, err);
            return React.createElement(
              'div',
              { className: 'p-4 text-sm text-red-400' },
              `Preview "${manifest.id}" failed to render.`,
            );
          }
        },
      });
    }

    // Register sidebar tabs from renderSidebarTab + getSidebarTabConfig
    registerSidebarTab(ext as Record<string, unknown>, manifest.id, this.sidebarTabRegistry);

    // Register bottom tabs from renderBottomTab + getBottomTabConfig
    registerBottomTab(ext as Record<string, unknown>, manifest.id, this.bottomTabRegistry);

    const context = {
      extensionPath: '',
      globalState: {
        get: (key: string) => this.executeCommand(`state:${manifest.id}:get`, key),
        set: (key: string, value: unknown) =>
          this.registerCommand(`state:${manifest.id}:set:${key}`, () => value),
        delete: (_key: string) => {},
      },
      workspaceState: {
        get: (key: string) => this.executeCommand(`workspace:${manifest.id}:get`, key),
        set: (key: string, value: unknown) =>
          this.registerCommand(`workspace:${manifest.id}:set:${key}`, () => value),
        delete: (_key: string) => {},
      },
      subscriptions: [] as Array<{ dispose(): void }>,
      asAbsolutePath: (relativePath: string) => relativePath,
    };

    const api = this.createExtensionApi(manifest);
    if (typeof ext._setContext === 'function') {
      (
        ext._setContext as (
          ctx: typeof context,
          api: ReturnType<typeof this.createExtensionApi>,
        ) => void
      )(context, api);
    }

    await this.activateExtension(manifest.id);
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  async loadExtension(pkg: ExtensionPackage): Promise<void> {
    if (this.extensions.has(pkg.manifest.id)) {
      return; // Already loaded
    }

    // Store the package info for potential hot-reload later
    this.extensionPackages.set(pkg.manifest.id, pkg);

    // Check dependencies
    if (pkg.manifest.dependencies?.length) {
      const missing = pkg.manifest.dependencies.filter(
        (dep) => !this.extensions.has(dep) || !this.extensions.get(dep)?.isActive,
      );
      if (missing.length > 0) {
        console.warn(
          `[ExtensionHost] Extension "${pkg.manifest.id}" has unmet dependencies: ${missing.join(', ')}. Skipping activation.`,
        );
      }
    }

    this.extensions.set(pkg.manifest.id, {
      id: pkg.manifest.id,
      manifest: pkg.manifest,
      isActive: false,
      isBuiltin: false,
    });

    // Register declared panels from manifest
    if (pkg.manifest.contributes?.panels) {
      for (const panel of pkg.manifest.contributes.panels) {
        this.panelRegistry.set(panel.id, {
          id: panel.id,
          extensionId: pkg.manifest.id,
          title: panel.title,
          icon: resolveIcon(panel.icon),
          location: (panel.location as 'sidebar' | 'bottom' | 'right') || 'right',
          isBuiltin: false,
          render: () =>
            React.createElement(
              'div',
              { className: 'p-4 text-sm text-xp-text-muted' },
              `Panel: ${panel.title}`,
            ),
        });
      }
    }

    // Load and execute the extension's JS bundle
    await this.loadExtensionScript(pkg);

    this.notifyChange();
  }

  /**
   * Load and execute an extension's JS bundle from its installation path.
   * The JS is expected to call window.__xplorer_register__ with either:
   * - A factory function: (api) => ({ activate, deactivate })
   * - An object: { activate, deactivate, render, _setContext }
   */
  private async loadExtensionScript(pkg: ExtensionPackage): Promise<void> {
    const mainFile = pkg.manifest.main || 'dist/index.js';

    // Validate mainFile doesn't contain path traversal, absolute paths, UNC paths, null bytes, or env vars
    if (
      mainFile.includes('..') ||
      mainFile.includes('\0') ||
      mainFile.includes('%') ||
      mainFile.startsWith('/') ||
      mainFile.startsWith('\\\\') ||
      /^[a-zA-Z]:/.test(mainFile)
    ) {
      console.error(`[ExtensionHost] Invalid main file path for ${pkg.manifest.id}: ${mainFile}`);
      return;
    }

    // Normalize path separators for the backend
    const fullPath = `${pkg.path}/${mainFile}`.replace(/\\/g, '/');

    let jsContent: string;
    const cached = this.bundleCache.get(pkg.manifest.id);
    if (cached) {
      jsContent = cached;
    } else {
      try {
        jsContent = await TauriAPI.readTextFile(fullPath);
      } catch {
        console.warn(`[ExtensionHost] No JS bundle found for ${pkg.manifest.id} at ${fullPath}`);
        return;
      }
    }

    const MAX_EXTENSION_SIZE = 5 * 1024 * 1024; // 5MB
    if (jsContent.length > MAX_EXTENSION_SIZE) {
      console.error(
        `[ExtensionHost] Extension bundle too large for ${pkg.manifest.id}: ${jsContent.length} bytes (max ${MAX_EXTENSION_SIZE})`,
      );
      return;
    }

    // No preprocessing needed — extensions are built as IIFE bundles.
    // The IIFE uses require() for externals, which we provide in the sandbox.

    // Temporarily override __xplorer_register__ to capture ALL registrations
    // (extensions can call register() multiple times, e.g. BottomTab + Command)
    const capturedAll: unknown[] = [];
    const prevRegister = window.__xplorer_register__;
    this.expectedExtensionId = pkg.manifest.id;
    window.__xplorer_register__ = (ext: unknown) => {
      capturedAll.push(ext);
    };

    try {
      const extId = pkg.manifest.id;
      const env = createSandboxedEnvironment({ extId });

      // Provide a require() shim that maps allowed externals to window globals.
      // Extensions built with esbuild --format=iife --external:react etc. emit
      // require("react") calls which this shim resolves at runtime.
      const ALLOWED_MODULES: Record<string, unknown> = {
        react: (window as unknown as Record<string, unknown>).React,
        'react-dom': (window as unknown as Record<string, unknown>).ReactDOM,
        'react-dom/client': (window as unknown as Record<string, unknown>).ReactDOM,
        '@xplorer/extension-sdk': (window as unknown as Record<string, unknown>).XplorerSDK,
      };
      const sandboxRequire = (moduleId: string): unknown => {
        if (ALLOWED_MODULES[moduleId] !== undefined) return ALLOWED_MODULES[moduleId];
        throw new Error(`Extension "${extId}" tried to require unknown module: "${moduleId}"`);
      };

      const paramNames = [
        'window',
        'self',
        'globalThis',
        'setTimeout',
        'setInterval',
        'document',
        'require',
        'Object',
        'Reflect',
        '__proto__',
        ...BLOCKED_GLOBALS,
      ];
      const paramValues: unknown[] = [
        env.sandboxedWindow,
        env.sandboxedWindow,
        env.sandboxedWindow,
        env.safeSetTimeout,
        env.safeSetInterval,
        env.safeDocument,
        sandboxRequire,
        env.sandboxedObject,
        env.sandboxedReflect,
        null,
        ...BLOCKED_GLOBALS.map(() => undefined),
      ];

      const execFn = new Function(...paramNames, jsContent);

      const execResult = execFn(...paramValues);
      if (
        execResult &&
        typeof execResult === 'object' &&
        typeof (execResult as Promise<void>).then === 'function'
      ) {
        const EXTENSION_EXEC_TIMEOUT = 10_000; // 10 seconds
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () =>
              reject(
                new Error(
                  `Extension "${pkg.manifest.id}" execution timed out after ${EXTENSION_EXEC_TIMEOUT}ms`,
                ),
              ),
            EXTENSION_EXEC_TIMEOUT,
          );
        });
        try {
          await Promise.race([execResult as Promise<void>, timeout]);
        } finally {
          clearTimeout(timeoutId);
        }
      }
    } catch (err) {
      console.error(`[ExtensionHost] Failed to execute JS for ${pkg.manifest.id}:`, err);
    }

    // Restore original handler and clear expected ID
    this.expectedExtensionId = null;
    window.__xplorer_register__ = prevRegister;

    if (capturedAll.length === 0) return;

    const ext = this.extensions.get(pkg.manifest.id);
    if (!ext) return;

    const api = this.createExtensionApi(pkg.manifest);

    // Process all captured registrations (BottomTab, Sidebar, Command, etc.)
    // The first one with activate/deactivate becomes the primary instance
    for (const captured of capturedAll) {
      if (typeof captured === 'function') {
        // Factory pattern: (api) => ({ activate, deactivate })
        try {
          if (!ext.instance) {
            ext.instance = (captured as (api: unknown) => unknown)(api);
          }
        } catch (err) {
          console.error(`[ExtensionHost] Factory call failed for ${pkg.manifest.id}:`, err);
        }
      } else {
        // Object pattern: { activate, deactivate, render, _setContext }
        const obj = captured as Record<string, unknown>;
        if (!ext.instance) {
          ext.instance = obj;
        }

        // Provide the API via _setContext if the extension supports it
        if (typeof obj._setContext === 'function') {
          const context = {
            extensionPath: pkg.path,
            globalState: {
              get: (key: string) =>
                this.executeCommand(`state:${pkg.manifest.id}:get`, key).catch(() => undefined),
              set: (key: string, value: unknown) =>
                this.registerCommand(`state:${pkg.manifest.id}:set:${key}`, () => value),
              delete: (_key: string) => {},
            },
            workspaceState: {
              get: (key: string) =>
                this.executeCommand(`workspace:${pkg.manifest.id}:get`, key).catch(() => undefined),
              set: (key: string, value: unknown) =>
                this.registerCommand(`workspace:${pkg.manifest.id}:set:${key}`, () => value),
              delete: (_key: string) => {},
            },
            subscriptions: [] as Array<{ dispose(): void }>,
            asAbsolutePath: (relativePath: string) => {
              if (relativePath.includes('..')) throw new Error('Path traversal not allowed');
              return `${pkg.path}/${relativePath}`;
            },
          };
          try {
            (obj._setContext as (ctx: unknown, api: unknown) => void)(context, api);
          } catch (err) {
            console.error(`[ExtensionHost] _setContext failed for ${pkg.manifest.id}:`, err);
          }
        }

        // Register panels declared by the captured object (from SDK Sidebar.register())
        // that aren't already in the panelRegistry (i.e. not in the backend manifest)
        const capturedManifest = (obj as Record<string, unknown>).manifest as
          | {
              contributes?: {
                panels?: Array<{ id: string; title: string; icon?: string; location?: string }>;
              };
            }
          | undefined;
        if (capturedManifest?.contributes?.panels) {
          for (const panel of capturedManifest.contributes.panels) {
            if (!this.panelRegistry.has(panel.id)) {
              this.panelRegistry.set(panel.id, {
                id: panel.id,
                extensionId: pkg.manifest.id,
                title: panel.title,
                icon: resolveIcon(panel.icon),
                location: (panel.location as 'sidebar' | 'bottom' | 'right') || 'right',
                isBuiltin: false,
                render: () =>
                  React.createElement(
                    'div',
                    { className: 'p-4 text-sm text-xp-text-muted' },
                    `Panel: ${panel.title}`,
                  ),
              });
            }
          }
        }

        // If the instance has a render() function, update panel registrations to use it
        if (typeof obj.render === 'function') {
          for (const [panelId, panel] of this.panelRegistry) {
            if (panel.extensionId === pkg.manifest.id) {
              panel.render = (props: PanelRenderProps) => {
                try {
                  return (obj.render as (props: PanelRenderProps) => React.ReactElement)(props);
                } catch (err) {
                  console.error(`[ExtensionHost] Panel render failed for "${panelId}":`, err);
                  return React.createElement(
                    'div',
                    { className: 'p-4 text-sm text-red-400' },
                    `Panel "${panel.title}" failed to render.`,
                  );
                }
              };
            }
          }
        }

        // If the instance has a renderEditor() function, register editors from manifest
        if (typeof obj.renderEditor === 'function' && pkg.manifest.contributes?.editors) {
          for (const editor of pkg.manifest.contributes.editors) {
            this.editorRegistry.set(editor.id, {
              id: editor.id,
              extensionId: pkg.manifest.id,
              extensions: editor.extensions,
              priority: editor.priority ?? 10,
              render: (props: { filePath: string }) => {
                try {
                  return (obj.renderEditor as (props: { filePath: string }) => React.ReactElement)(
                    props,
                  );
                } catch (err) {
                  console.error(`[ExtensionHost] Editor render failed for "${editor.id}":`, err);
                  return React.createElement(
                    'div',
                    { className: 'p-4 text-sm text-red-400' },
                    `Editor "${editor.id}" failed to render.`,
                  );
                }
              },
            });
          }
        }

        // Register sidebar tabs from marketplace extensions (renderSidebarTab + getSidebarTabConfig)
        if (
          typeof obj.renderSidebarTab === 'function' &&
          typeof obj.getSidebarTabConfig === 'function'
        ) {
          const stConfig = (
            obj.getSidebarTabConfig as () => { id: string; title: string; icon?: string }
          )();
          this.sidebarTabRegistry.set(stConfig.id, {
            id: stConfig.id,
            extensionId: pkg.manifest.id,
            title: stConfig.title,
            icon: resolveIcon(stConfig.icon),
            render: (props: { currentPath?: string; isActive?: boolean }) => {
              try {
                return (
                  obj.renderSidebarTab as (props: {
                    currentPath?: string;
                    isActive?: boolean;
                  }) => React.ReactElement
                )(props);
              } catch (err) {
                console.error(
                  `[ExtensionHost] Sidebar tab render failed for "${stConfig.id}":`,
                  err,
                );
                return React.createElement(
                  'div',
                  { className: 'p-4 text-sm text-red-400' },
                  `Tab "${stConfig.title}" failed to render.`,
                );
              }
            },
          });
        }

        // Register bottom tabs from marketplace extensions (renderBottomTab + getBottomTabConfig)
        if (
          typeof obj.renderBottomTab === 'function' &&
          typeof obj.getBottomTabConfig === 'function'
        ) {
          const btConfig = (
            obj.getBottomTabConfig as () => { id: string; title: string; icon?: string }
          )();
          console.warn(
            `[ExtensionHost] Registering bottom tab: ${btConfig.id} for ${pkg.manifest.id}`,
          );
          this.bottomTabRegistry.set(btConfig.id, {
            id: btConfig.id,
            extensionId: pkg.manifest.id,
            title: btConfig.title,
            icon: resolveIcon(btConfig.icon),
            render: (props: { currentPath?: string; isActive?: boolean }) => {
              try {
                return (
                  obj.renderBottomTab as (props: {
                    currentPath?: string;
                    isActive?: boolean;
                  }) => React.ReactElement
                )(props);
              } catch (err) {
                console.error(
                  `[ExtensionHost] Bottom tab render failed for "${btConfig.id}":`,
                  err,
                );
                return React.createElement(
                  'div',
                  { className: 'p-4 text-sm text-red-400' },
                  `Tab "${btConfig.title}" failed to render.`,
                );
              }
            },
          });
        }

        // Register preview providers (category: 'preview' with canPreview + render)
        if (
          pkg.manifest.category === 'preview' &&
          typeof obj.canPreview === 'function' &&
          typeof obj.render === 'function'
        ) {
          const priority =
            typeof obj.getPriority === 'function' ? (obj.getPriority as () => number)() : 10;
          this.previewRegistry.set(pkg.manifest.id, {
            id: pkg.manifest.id,
            extensionId: pkg.manifest.id,
            priority,
            canPreview: (file) => {
              try {
                return (obj.canPreview as (file: unknown) => boolean)(file);
              } catch (err) {
                console.error(
                  `[ExtensionHost] Preview canPreview failed for "${pkg.manifest.id}":`,
                  err,
                );
                return false;
              }
            },
            render: (props) => {
              try {
                return (obj.render as (props: unknown) => React.ReactElement)(props);
              } catch (err) {
                console.error(
                  `[ExtensionHost] Preview render failed for "${pkg.manifest.id}":`,
                  err,
                );
                return React.createElement(
                  'div',
                  { className: 'p-4 text-sm text-red-400' },
                  `Preview "${pkg.manifest.id}" failed to render.`,
                );
              }
            },
          });
        }
      }
    }
  }

  /**
   * Load all previously installed extensions from the backend and
   * activate those that were marked active.
   * Call this once during app startup after registerBuiltinExtensions().
   */
  async loadInstalledExtensions(): Promise<void> {
    try {
      const installed = await TauriAPI.getInstalledExtensions();
      for (const pkg of installed) {
        await this.loadExtension(pkg);
        if (pkg.is_active) {
          await this.activateExtension(pkg.manifest.id);
        }
      }
      // Notify UI that extensions have been loaded
      this.notifyChange();

      // Load marketplace-installed extensions from localStorage cache
      await this.loadMarketplaceInstalledExtensions();

      // Check for updates in the background (non-blocking)
      this.checkForUpdatesAndNotify(installed).catch(() => {});
    } catch (err) {
      console.error('[ExtensionHost] Failed to load installed extensions:', err);
    }
  }

  private async loadMarketplaceInstalledExtensions(): Promise<void> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.INSTALLED_EXTENSIONS);
      if (!raw) return;
      const installed = JSON.parse(raw) as Record<
        string,
        { enabled: boolean; manifest: ExtensionManifest; downloadUrl: string; bundleCache?: string }
      >;

      for (const [id, info] of Object.entries(installed)) {
        if (!info.enabled || this.extensions.has(id)) continue;
        try {
          let jsContent = info.bundleCache;
          if (!jsContent) {
            const response = await fetch(info.downloadUrl);
            if (!response.ok) continue;
            jsContent = await response.text();
            installed[id].bundleCache = jsContent;
            localStorage.setItem(STORAGE_KEYS.INSTALLED_EXTENSIONS, JSON.stringify(installed));
          }

          this.bundleCache.set(id, jsContent);
          const pkg: ExtensionPackage = {
            manifest: info.manifest,
            path: `marketplace://${id}`,
            is_active: true,
            is_installed: true,
          };
          await this.loadExtension(pkg);
          await this.activateExtension(id);
        } catch (err) {
          console.warn(`[ExtensionHost] Failed to reload marketplace extension ${id}:`, err);
        }
      }
      this.notifyChange();
    } catch {
      // localStorage parse failure — skip marketplace extensions
    }
  }

  private async checkForUpdatesAndNotify(
    installed: Array<{ manifest: { id: string; version?: string } }>,
  ): Promise<void> {
    await checkForUpdates(installed);
    this.notifyChange();
  }

  async activateExtension(id: string): Promise<void> {
    const ext = this.extensions.get(id);
    if (!ext) return;

    {
      const dangerousPermissions = [
        'file:write',
        'file:delete',
        'file:execute',
        'native:invoke',
        'system:exec',
        'system:commands',
        'system:network',
        'fetch',
        'network',
      ];
      const requestedDangerous =
        ext.manifest.permissions?.filter((p) => dangerousPermissions.includes(p)) || [];
      if (requestedDangerous.length > 0) {
        // Check if user previously granted consent
        const consentKey = `xplorer:ext-consent:${id}`;
        const previouslyConsented =
          typeof window !== 'undefined' && localStorage.getItem(consentKey) === 'granted';

        if (!previouslyConsented) {
          // Dispatch a custom event and wait for the UI layer to resolve consent
          const granted = await new Promise<boolean>((resolve) => {
            const event = new CustomEvent('extension-permission-request', {
              detail: {
                detail: {
                  extensionId: id,
                  extensionName: ext.manifest.name,
                  displayName: ext.manifest.display_name,
                  version: ext.manifest.version,
                  author: ext.manifest.author,
                  permissions: ext.manifest.permissions || [],
                },
                resolve,
              },
            });
            window.dispatchEvent(event);
          });

          if (!granted) {
            console.warn(
              `[Security] User denied permissions for extension "${ext.manifest.name}" (${id}). Activation aborted.`,
            );
            return;
          }

          // Persist consent so the user is not prompted again on next activation
          localStorage.setItem(consentKey, 'granted');
        }
      }
    }

    const inst = ext.instance as Record<string, unknown> | undefined;
    if (inst && typeof inst.activate === 'function') {
      try {
        await (inst.activate as () => Promise<void>)();
      } catch (err) {
        console.error(`[ExtensionHost] Failed to activate extension ${id}:`, err);
        // Clean up any partial registrations from the failed activation
        this.cleanupExtension(id);
        return;
      }
    }

    ext.isActive = true;

    // Persist activation
    try {
      await TauriAPI.activateExtension(id);
    } catch (err) {
      console.error(`[ExtensionHost] Failed to persist activation for ${id}:`, err);
    }

    // Auto-load WASM backend if the extension has one
    if (ext.manifest.backend || ext.manifest.has_wasm_backend) {
      try {
        await TauriAPI.extensionBackendCall(id, '__init__', {});
      } catch {
        // WASM backend may not exist or init may not be implemented — that's OK
      }
    }

    // Register keybindings from manifest
    if (ext.manifest.contributes?.keybindings) {
      for (const kb of ext.manifest.contributes.keybindings) {
        try {
          const parts = kb.key.toLowerCase().split('+');
          const key = parts[parts.length - 1];
          await TauriAPI.registerExtensionShortcut(
            ext.manifest.id,
            `${ext.manifest.id}.${kb.command}`,
            kb.title || kb.command,
            kb.title || null,
            {
              key,
              ctrl: parts.includes('ctrl'),
              alt: parts.includes('alt'),
              shift: parts.includes('shift'),
              meta: parts.includes('meta'),
            },
            kb.command,
            kb.when ? [kb.when] : ['file-explorer'],
          );
        } catch (err) {
          console.error(`[ExtensionHost] Failed to register keybinding for ${id}:`, err);
        }
      }
    }

    this.eventBus.emit('extensionActivated', id);
    this.notifyChange();
  }

  async deactivateExtension(id: string): Promise<void> {
    const ext = this.extensions.get(id);
    if (!ext) return;

    const inst = ext.instance as Record<string, unknown> | undefined;
    if (inst && typeof inst.deactivate === 'function') {
      try {
        await (inst.deactivate as () => Promise<void>)();
      } catch (err) {
        console.error(`[ExtensionHost] Failed to deactivate extension ${id}:`, err);
      }
    }

    // Unregister extension shortcuts
    try {
      await TauriAPI.unregisterExtensionShortcuts(id);
    } catch (err) {
      console.error(`[ExtensionHost] Failed to unregister shortcuts for ${id}:`, err);
    }

    ext.isActive = false;

    // Persist deactivation
    try {
      await TauriAPI.deactivateExtension(id);
    } catch (err) {
      console.error(`[ExtensionHost] Failed to persist deactivation for ${id}:`, err);
    }

    this.eventBus.emit('extensionDeactivated', id);
    this.notifyChange();
  }

  async unloadExtension(id: string): Promise<void> {
    await this.deactivateExtension(id);

    cleanupExtensionRegistrations(id, {
      panelRegistry: this.panelRegistry,
      commandRegistry: this.commandRegistry,
      editorRegistry: this.editorRegistry,
      previewRegistry: this.previewRegistry,
      decoratorRegistry: this.decoratorRegistry,
      contextMenuEntries: this.contextMenuEntries,
      dialogRegistry: this.dialogRegistry,
      openDialogsMap: this.openDialogsMap,
      tabRendererRegistry: this.tabRendererRegistry,
      sidebarTabRegistry: this.sidebarTabRegistry,
      bottomTabRegistry: this.bottomTabRegistry,
    });

    this.extensionSchemes.delete(id);
    this.extensions.delete(id);

    this.notifyChange();
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────

  /**
   * Remove all registrations (commands, panels, decorators, context menus, editors, previews) for an extension.
   * Used to clean up after an extension crash during activation.
   */
  private cleanupExtension(id: string): void {
    cleanupExtensionRegistrations(id, {
      panelRegistry: this.panelRegistry,
      commandRegistry: this.commandRegistry,
      editorRegistry: this.editorRegistry,
      previewRegistry: this.previewRegistry,
      decoratorRegistry: this.decoratorRegistry,
      contextMenuEntries: this.contextMenuEntries,
      dialogRegistry: this.dialogRegistry,
      openDialogsMap: this.openDialogsMap,
      tabRendererRegistry: this.tabRendererRegistry,
      sidebarTabRegistry: this.sidebarTabRegistry,
      bottomTabRegistry: this.bottomTabRegistry,
    });

    TauriAPI.unregisterExtensionShortcuts(id).catch((err) =>
      console.warn(`[ExtensionHost] Failed to unregister shortcuts for ${id}:`, err),
    );

    console.warn(`[ExtensionHost] Cleaned up registrations for crashed extension "${id}"`);
    this.notifyChange();
  }

  // ─── Hot Reload ─────────────────────────────────────────────────────────

  async reloadExtension(id: string): Promise<void> {
    const ext = this.extensions.get(id);
    if (!ext) return;

    // Retrieve the stored package info before unloading
    const pkg = this.extensionPackages.get(id);

    await this.unloadExtension(id);

    if (pkg) {
      // Clear the bundle cache to force re-reading from disk
      this.bundleCache.delete(id);

      // Re-load and re-activate the extension
      await this.loadExtension(pkg);
      await this.activateExtension(id);

      // Mark the reloaded extension as dev mode and track reload count
      const reloaded = this.extensions.get(id);
      if (reloaded) {
        reloaded.isDev = true;
        const count = (this.devReloadCounts.get(id) ?? 0) + 1;
        this.devReloadCounts.set(id, count);
        reloaded.reloadCount = count;
      }
    }

    this.eventBus.emit('extensionReloaded', id);
    this.notifyChange();
  }

  // ─── Registry Queries ───────────────────────────────────────────────────

  /**
   * Find the highest-priority extension preview that can handle the given file.
   * Returns null if no extension preview matches.
   */
  queryPreview(file: {
    name: string;
    path: string;
    is_dir: boolean;
    size?: number;
  }): PreviewRegistration | null {
    return queryPreviewProvider(this.previewRegistry, this.extensions, file);
  }

  /**
   * Find the best extension-provided editor for a given file path.
   * Returns the highest-priority editor whose extensions list matches.
   */
  getEditorForFile(filePath: string): EditorRegistration | undefined {
    return findEditorForFile(this.editorRegistry, this.extensions, filePath);
  }

  getRegisteredPanels(): PanelRegistration[] {
    return getActivePanels(this.panelRegistry, this.extensions);
  }

  getPanel(panelId: string): PanelRegistration | undefined {
    return this.panelRegistry.get(panelId);
  }

  getAllExtensions(): LoadedExtension[] {
    return Array.from(this.extensions.values());
  }

  getExtension(id: string): LoadedExtension | undefined {
    return this.extensions.get(id);
  }

  isExtensionActive(id: string): boolean {
    return this.extensions.get(id)?.isActive ?? false;
  }

  getContextMenuItems(_context: {
    file?: ExtensionFileInfo;
    selectedFiles?: unknown;
  }): ContextMenuEntry[] {
    return getActiveContextMenuItems(this.contextMenuEntries, this.extensions);
  }

  getFileDecorations(file: ExtensionFileInfo): FileDecoration[] {
    return getActiveFileDecorations(this.decoratorRegistry, this.extensions, file);
  }

  // ─── Dialog Registry ────────────────────────────────────────────────────

  registerDialog(dialogId: string, renderer: DialogRenderer): { dispose: () => void } {
    this.dialogRegistry.set(dialogId, renderer);
    this.notifyChange();
    return {
      dispose: () => {
        this.dialogRegistry.delete(dialogId);
        this.openDialogsMap.delete(dialogId);
        this.notifyChange();
      },
    };
  }

  getDialogRenderer(dialogId: string): DialogRenderer | null {
    return this.dialogRegistry.get(dialogId) ?? null;
  }

  hasDialog(dialogId: string): boolean {
    return this.dialogRegistry.has(dialogId);
  }

  openDialog(dialogId: string, data: Record<string, unknown> = {}): void {
    this.openDialogsMap.set(dialogId, data);
    this.notifyChange();
  }

  closeDialog(dialogId: string): void {
    this.openDialogsMap.delete(dialogId);
    this.notifyChange();
  }

  getOpenDialogs(): Map<string, Record<string, unknown>> {
    return new Map(this.openDialogsMap);
  }

  // ─── Tab Registry ─────────────────────────────────────────────────────

  registerTabRenderer(type: string, renderer: TabRenderer): { dispose: () => void } {
    this.tabRendererRegistry.set(type, renderer);
    this.notifyChange();
    return {
      dispose: () => {
        this.tabRendererRegistry.delete(type);
        this.notifyChange();
      },
    };
  }

  getTabRenderer(type: string): TabRenderer | null {
    return this.tabRendererRegistry.get(type) ?? null;
  }

  // ─── Sidebar Tab Registry ──────────────────────────────────────────────

  /** Get all registered sidebar tabs from extensions */
  getSidebarTabs(): Array<{
    id: string;
    extensionId: string;
    title: string;
    icon: React.ReactNode;
    render: (props: { currentPath?: string; isActive?: boolean }) => React.ReactElement;
  }> {
    return getActiveSidebarTabs(this.sidebarTabRegistry, this.extensions);
  }

  /** Get the render function for an extension-registered sidebar tab */
  getSidebarTabRenderer(
    tabId: string,
  ): ((props: { currentPath?: string; isActive?: boolean }) => React.ReactElement) | null {
    const reg = this.sidebarTabRegistry.get(tabId);
    if (!reg) return null;
    const ext = this.extensions.get(reg.extensionId);
    if (!ext?.isActive) return null;
    return reg.render;
  }

  // ─── Bottom Tab Registry ──────────────────────────────────────────────

  /** Get all registered bottom tabs from extensions */
  getBottomTabs(): Array<{
    id: string;
    extensionId: string;
    title: string;
    icon: React.ReactNode;
    render: (props: { currentPath?: string; isActive?: boolean }) => React.ReactElement;
  }> {
    return getActiveBottomTabs(this.bottomTabRegistry, this.extensions);
  }

  /** Get the render function for an extension-registered bottom tab */
  getBottomTabRenderer(
    tabId: string,
  ): ((props: { currentPath?: string; isActive?: boolean }) => React.ReactElement) | null {
    const reg = this.bottomTabRegistry.get(tabId);
    if (!reg) return null;
    const ext = this.extensions.get(reg.extensionId);
    if (!ext?.isActive) return null;
    return reg.render;
  }

  // ─── Extension Schemes ────────────────────────────────────────────────

  registerScheme(scheme: string): { dispose: () => void } {
    this.extensionSchemes.add(scheme);
    return {
      dispose: () => {
        this.extensionSchemes.delete(scheme);
      },
    };
  }

  isExtensionScheme(path: string): boolean {
    for (const scheme of this.extensionSchemes) {
      if (path.startsWith(`${scheme}://`)) return true;
    }
    return false;
  }

  // ─── Extension Uninstall ──────────────────────────────────────────────

  async uninstallExtension(id: string): Promise<void> {
    await this.unloadExtension(id);
    await TauriAPI.uninstallExtensionById(id);
  }

  // ─── Commands ───────────────────────────────────────────────────────────

  registerCommand(
    command: string,
    handler: CommandHandler,
    metadata?: { title?: string; shortcut?: string; category?: string },
  ): { dispose: () => void } {
    this.commandRegistry.set(command, handler);
    if (metadata?.title) {
      this.commandMetadata.set(command, {
        title: metadata.title,
        shortcut: metadata.shortcut,
        category: metadata.category || 'Extensions',
      });
      this.notifyCommandChange();
    }
    return {
      dispose: () => {
        this.commandRegistry.delete(command);
        this.commandMetadata.delete(command);
        this.notifyCommandChange();
      },
    };
  }

  private notifyCommandChange() {
    for (const cb of this.commandChangeListeners) {
      try {
        cb();
      } catch {
        /* ignore */
      }
    }
  }

  /** Subscribe to command registry changes. Returns dispose function. */
  onCommandsChanged(cb: () => void): { dispose: () => void } {
    this.commandChangeListeners.add(cb);
    return {
      dispose: () => {
        this.commandChangeListeners.delete(cb);
      },
    };
  }

  /** Get all extension commands with metadata for the command palette. */
  getCommandPaletteEntries(): Array<{
    id: string;
    title: string;
    shortcut?: string;
    category?: string;
    action: () => void;
  }> {
    return buildCommandPaletteEntries(this.commandMetadata, this.commandRegistry);
  }

  async executeCommand(command: string, ...args: unknown[]): Promise<unknown> {
    const handler = this.commandRegistry.get(command);
    if (!handler) {
      throw new Error(`Command "${command}" not found`);
    }
    try {
      return await handler(...args);
    } catch (err) {
      console.error(`[ExtensionHost] Command action failed for "${command}":`, err);
      throw err;
    }
  }

  // ─── Decorators ─────────────────────────────────────────────────────────

  registerDecorator(decorator: FileDecorator): { dispose: () => void } {
    const MAX_DECORATORS = 1000;
    if (
      this.decoratorRegistry.size >= MAX_DECORATORS &&
      !this.decoratorRegistry.has(decorator.extensionId)
    ) {
      console.warn(
        `[ExtensionHost] Maximum decorator limit reached (${MAX_DECORATORS}), rejecting decorator from "${decorator.extensionId}"`,
      );
      return { dispose: () => {} };
    }

    this.decoratorRegistry.set(decorator.extensionId, decorator);
    this.notifyChange();
    return {
      dispose: () => {
        this.decoratorRegistry.delete(decorator.extensionId);
        this.notifyChange();
      },
    };
  }

  // ─── Context Menus ──────────────────────────────────────────────────────

  registerContextMenuItems(
    extensionId: string,
    items: ContextMenuEntry[],
  ): { dispose: () => void } {
    this.contextMenuEntries.set(extensionId, items);
    return {
      dispose: () => {
        this.contextMenuEntries.delete(extensionId);
      },
    };
  }

  // ─── Events ─────────────────────────────────────────────────────────────

  onEvent(event: string, callback: EventCallback): { dispose: () => void } {
    return this.eventBus.on(event, callback);
  }

  emitEvent(event: string, ...args: unknown[]) {
    this.eventBus.emit(event, ...args);
  }

  // ─── Change Notification ────────────────────────────────────────────────

  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  // useSyncExternalStore-compatible API
  private snapshotVersion = 0;

  subscribe = (onStoreChange: () => void): (() => void) => {
    return this.onChange(onStoreChange);
  };

  getSnapshotVersion = (): number => {
    return this.snapshotVersion;
  };

  private notifyChange() {
    this.snapshotVersion++;
    this.changeListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('[ExtensionHost] Change listener error:', err);
      }
    });
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

export const extensionHost = new ExtensionHost();
