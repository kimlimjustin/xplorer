import React from 'react';
import { TauriAPI } from './tauri-api';
import { resolveIcon } from './extension-host-icon';
import {
  verifyExtensionIntegrity,
  executeSandboxed,
  createExtensionApi,
  requestPermissionApproval,
  logPermissionViolation,
} from './extension-sandbox';
import type { ExtensionRegistry } from './extension-registry';
import type {
  ExtensionManifest,
  ExtensionPackage,
  LoadedExtension,
  PanelRenderProps,
  TabRenderProps,
  EventBus,
} from './extension-host-types';

// ─── Dependency Resolution ───────────────────────────────────────────────────

interface DependencyGraph {
  order: string[];
  circular: string[][];
}

const buildDependencyGraph = (packages: ExtensionPackage[]): DependencyGraph => {
  const idSet = new Set(packages.map((p) => p.manifest.id));
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const pkg of packages) {
    const id = pkg.manifest.id;
    if (!adjacency.has(id)) adjacency.set(id, []);
    if (!inDegree.has(id)) inDegree.set(id, 0);

    for (const dep of pkg.manifest.dependencies ?? []) {
      if (!idSet.has(dep)) continue;
      if (!adjacency.has(dep)) adjacency.set(dep, []);
      adjacency.get(dep)!.push(id);
      inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDeg = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  const circular: string[][] = [];
  if (order.length < idSet.size) {
    const remaining = packages.map((p) => p.manifest.id).filter((id) => !order.includes(id));
    circular.push(remaining);
  }

  return { order, circular };
};

const sortPackagesByDependencyOrder = (packages: ExtensionPackage[]): ExtensionPackage[] => {
  if (packages.length <= 1) return packages;

  const { order, circular } = buildDependencyGraph(packages);

  if (circular.length > 0) {
    for (const cycle of circular) {
      console.warn(
        `[ExtensionHost] Circular dependency detected among: ${cycle.join(', ')}. These extensions will be loaded in original order.`,
      );
    }
  }

  const pkgMap = new Map(packages.map((p) => [p.manifest.id, p]));
  const sorted: ExtensionPackage[] = [];

  for (const id of order) {
    const pkg = pkgMap.get(id);
    if (pkg) sorted.push(pkg);
  }

  for (const cycle of circular) {
    for (const id of cycle) {
      const pkg = pkgMap.get(id);
      if (pkg) sorted.push(pkg);
    }
  }

  return sorted;
};

// ─── Extension Lifecycle ─────────────────────────────────────────────────────
// Handles loading, activating, deactivating, unloading, reloading extensions,
// marketplace install/uninstall, and hot-reload.

export class ExtensionLifecycle {
  /** Reference to the extensions map — set by the host */
  extensions!: Map<string, LoadedExtension>;

  /** Reference to the registry — set by the host */
  registry!: ExtensionRegistry;

  /** Reference to the event bus — set by the host */
  eventBus!: EventBus;

  /** Expected extension ID during registration */
  expectedExtensionId: string | null = null;

  /** Stored package info for each non-builtin extension */
  readonly extensionPackages = new Map<string, ExtensionPackage>();

  /** Map from normalized extension directory path to extension ID */
  readonly extensionPathToId = new Map<string, string>();

  /** Tracked timers/intervals per extension for cleanup on unload */
  readonly extensionTimers = new Map<string, { timeouts: number[]; intervals: number[] }>();

  /** Cache for URL-fetched extension bundles */
  readonly urlBundleCache = new Map<string, string>();

  /** Whether the hot-reload watcher is active */
  private hotReloadActive = false;

  /** Tauri event unlisten function for hot-reload */
  private hotReloadUnlisten: (() => void) | null = null;

  /** Keyboard event handler for manual reload */
  private hotReloadKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  /** Change notification callback — set by the host */
  notifyChange: () => void = () => {};

  // ─── Registration ─────────────────────────────────────────────────────

  registerBuiltinPanel(config: {
    id: string;
    name: string;
    description?: string;
    icon: React.ReactNode;
    location?: 'sidebar' | 'bottom' | 'right';
    render: (props: PanelRenderProps) => React.ReactElement;
    version?: string;
  }): void {
    const extensionId = config.id;
    const manifest: ExtensionManifest = {
      id: extensionId,
      name: config.name,
      description: config.description,
      version: config.version || '1.0.0',
      author: 'Xplorer',
      category: 'panel',
    };

    // Register extension
    this.extensions.set(extensionId, {
      id: extensionId,
      manifest,
      isActive: true,
      isBuiltin: true,
    });

    // Register panel
    this.registry.registerBuiltinPanel(extensionId, manifest, {
      name: config.name,
      icon: config.icon,
      location: config.location,
      render: config.render,
    });

    this.notifyChange();
  }

  async registerExternalExtension(instance: unknown): Promise<void> {
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

    // Register all contributions from the instance
    this.registry.registerFromInstance(manifest.id, manifest, ext);

    const context = {
      extensionPath: '',
      globalState: {
        get: (key: string) => this.registry.executeCommand(`state:${manifest.id}:get`, key),
        set: (key: string, value: unknown) =>
          this.registry.registerCommand(`state:${manifest.id}:set:${key}`, () => value),
        delete: (_key: string) => {},
      },
      workspaceState: {
        get: (key: string) => this.registry.executeCommand(`workspace:${manifest.id}:get`, key),
        set: (key: string, value: unknown) =>
          this.registry.registerCommand(`workspace:${manifest.id}:set:${key}`, () => value),
        delete: (_key: string) => {},
      },
      subscriptions: [] as Array<{ dispose(): void }>,
      asAbsolutePath: (relativePath: string) => relativePath,
    };

    const api = this._createApi(manifest);
    if (typeof ext._setContext === 'function') {
      (
        ext._setContext as (ctx: typeof context, api: ReturnType<typeof createExtensionApi>) => void
      )(context, api);
    }

    await this.activateExtension(manifest.id);
  }

  // ─── Loading ──────────────────────────────────────────────────────────

  async loadExtension(pkg: ExtensionPackage): Promise<void> {
    if (this.extensions.has(pkg.manifest.id)) {
      return; // Already loaded
    }

    // Store the package info for hot-reload
    this.extensionPackages.set(pkg.manifest.id, pkg);
    // Track the path-to-id mapping for the file watcher
    const normalizedPath = pkg.path.replace(/\\/g, '/').toLowerCase();
    this.extensionPathToId.set(normalizedPath, pkg.manifest.id);

    if (pkg.manifest.dependencies?.length) {
      const notLoaded = pkg.manifest.dependencies.filter((dep) => !this.extensions.has(dep));
      if (notLoaded.length > 0) {
        console.warn(
          `[ExtensionHost] Extension "${pkg.manifest.id}" depends on: ${pkg.manifest.dependencies.join(', ')} (not yet loaded: ${notLoaded.join(', ')})`,
        );
      }
    }

    this.extensions.set(pkg.manifest.id, {
      id: pkg.manifest.id,
      manifest: pkg.manifest,
      isActive: false,
      isBuiltin: false,
      sourcePath: pkg.path,
      loadedAt: Date.now(),
    });

    // Register declared panels from manifest
    this.registry.registerPanelsFromManifest(pkg.manifest.id, pkg.manifest);

    // Load and execute the extension's JS bundle
    await this.loadExtensionScript(pkg);

    this.notifyChange();
  }

  /**
   * Load and execute an extension's JS bundle from its installation path.
   */
  private async loadExtensionScript(pkg: ExtensionPackage): Promise<void> {
    let jsContent: string | undefined;

    // Check if we have a cached URL-fetched bundle for this extension
    const cachedBundle = this.urlBundleCache.get(pkg.manifest.id);
    if (cachedBundle) {
      jsContent = cachedBundle;
      this.urlBundleCache.delete(pkg.manifest.id);
    } else {
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

      try {
        jsContent = await TauriAPI.readTextFile(fullPath);
      } catch {
        console.warn(`[ExtensionHost] No JS bundle found for ${pkg.manifest.id} at ${fullPath}`);
        return;
      }
    }

    // MED-E06: Enforce maximum extension bundle size (5MB)
    const MAX_EXTENSION_SIZE = 5 * 1024 * 1024; // 5MB
    if (jsContent.length > MAX_EXTENSION_SIZE) {
      console.error(
        `[ExtensionHost] Extension bundle too large for ${pkg.manifest.id}: ${jsContent.length} bytes (max ${MAX_EXTENSION_SIZE})`,
      );
      return;
    }

    // Verify extension bundle integrity before loading
    const integrity = await verifyExtensionIntegrity(pkg.manifest, jsContent);
    if (!integrity.valid) {
      console.error(
        `[ExtensionHost] Extension ${pkg.manifest.id} failed integrity check: ${integrity.reason}`,
      );
      return; // Don't load tampered extension
    }
    if (integrity.reason === 'no-checksum') {
      console.warn(
        `[ExtensionHost] Extension ${pkg.manifest.id} has no checksum — loading as unverified`,
      );
    }

    // No preprocessing needed — extensions are built as IIFE bundles.
    // The IIFE uses require() for externals, which we provide in the sandbox.

    // Temporarily override __xplorer_register__ to capture this extension's registration
    let captured: unknown = null;
    const prevRegister = window.__xplorer_register__;
    this.expectedExtensionId = pkg.manifest.id;
    window.__xplorer_register__ = (ext: unknown) => {
      captured = ext;
    };

    try {
      const extId = pkg.manifest.id;
      if (!this.extensionTimers.has(extId)) {
        this.extensionTimers.set(extId, { timeouts: [], intervals: [] });
      }
      const trackedTimers = this.extensionTimers.get(extId)!;

      // MED-E04: The initial execution is synchronous (new Function call) so it cannot be
      // wrapped in Promise.race for timeout. However, if the execution returns a Promise
      // (e.g., top-level async IIFE), we apply a 10-second timeout.
      const execResult = executeSandboxed(jsContent, extId, trackedTimers);
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

    if (!captured) return;

    const ext = this.extensions.get(pkg.manifest.id);
    if (!ext) return;

    const api = this._createApi(pkg.manifest);

    if (typeof captured === 'function') {
      // Factory pattern: (api) => ({ activate, deactivate })
      try {
        ext.instance = (captured as (api: unknown) => unknown)(api);
      } catch (err) {
        console.error(`[ExtensionHost] Factory call failed for ${pkg.manifest.id}:`, err);
      }
    } else {
      // Object pattern: { activate, deactivate, render, _setContext }
      const obj = captured as Record<string, unknown>;
      ext.instance = obj;

      // Provide the API via _setContext if the extension supports it
      if (typeof obj._setContext === 'function') {
        const context = {
          extensionPath: pkg.path,
          globalState: {
            get: (key: string) =>
              this.registry
                .executeCommand(`state:${pkg.manifest.id}:get`, key)
                .catch(() => undefined),
            set: (key: string, value: unknown) =>
              this.registry.registerCommand(`state:${pkg.manifest.id}:set:${key}`, () => value),
            delete: (_key: string) => {},
          },
          workspaceState: {
            get: (key: string) =>
              this.registry
                .executeCommand(`workspace:${pkg.manifest.id}:get`, key)
                .catch(() => undefined),
            set: (key: string, value: unknown) =>
              this.registry.registerCommand(`workspace:${pkg.manifest.id}:set:${key}`, () => value),
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

      // If the instance has a render() function, update panel registrations to use it
      if (typeof obj.render === 'function') {
        this.registry.updatePanelRenderers(
          pkg.manifest.id,
          obj.render as (props: PanelRenderProps) => React.ReactElement,
        );
      }

      // If the instance has a renderEditor() function, register editors from manifest
      if (typeof obj.renderEditor === 'function' && pkg.manifest.contributes?.editors) {
        for (const editor of pkg.manifest.contributes.editors) {
          this.registry.editorRegistry.set(editor.id, {
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

      // Register custom tab type from renderTab + getTabConfig
      if (typeof obj.renderTab === 'function' && typeof obj.getTabConfig === 'function') {
        const tabConfig = (
          obj.getTabConfig as () => { id: string; title: string; icon?: string; urlScheme?: string }
        )();
        this.registry.tabRegistry.set(tabConfig.id, {
          id: tabConfig.id,
          extensionId: pkg.manifest.id,
          title: tabConfig.title,
          icon: resolveIcon(tabConfig.icon),
          urlScheme: tabConfig.urlScheme,
          render: (props: TabRenderProps) => {
            try {
              return (obj.renderTab as (props: TabRenderProps) => React.ReactElement)(props);
            } catch (err) {
              console.error(`[ExtensionHost] Tab render failed for "${tabConfig.id}":`, err);
              return React.createElement(
                'div',
                { style: { padding: 16, color: '#f87171' } },
                `Tab "${tabConfig.title}" failed to render.`,
              );
            }
          },
        });
      }

      // Register navigation entries from getNavigationConfig + getEntries
      if (typeof obj.getNavigationConfig === 'function' && typeof obj.getEntries === 'function') {
        const navConfig = (
          obj.getNavigationConfig as () => {
            id: string;
            section: string;
            icon?: string;
            updateEvent?: string;
          }
        )();
        this.registry.navigationRegistry.set(navConfig.id, {
          id: navConfig.id,
          extensionId: pkg.manifest.id,
          section: navConfig.section,
          icon: resolveIcon(navConfig.icon),
          updateEvent: navConfig.updateEvent,
          getEntries: obj.getEntries as () => Promise<
            Array<{ id: string; label: string; icon?: string; action: () => void }>
          >,
          onManage:
            typeof obj.onManage === 'function' ? (obj.onManage as () => Promise<void>) : undefined,
        });
      }

      // Register bottom tab from renderBottomTab + getBottomTabConfig
      if (
        typeof obj.renderBottomTab === 'function' &&
        typeof obj.getBottomTabConfig === 'function'
      ) {
        const btConfig = (
          obj.getBottomTabConfig as () => { id: string; title: string; icon?: string }
        )();
        this.registry.bottomTabRegistry.set(btConfig.id, {
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
              console.error(`[ExtensionHost] Bottom tab render failed for "${btConfig.id}":`, err);
              return React.createElement(
                'div',
                { style: { padding: 16, color: '#f87171' } },
                `Bottom tab "${btConfig.title}" failed to render.`,
              );
            }
          },
        });
      }

      // Register sidebar tab from renderSidebarTab + getSidebarTabConfig
      if (
        typeof obj.renderSidebarTab === 'function' &&
        typeof obj.getSidebarTabConfig === 'function'
      ) {
        const stConfig = (
          obj.getSidebarTabConfig as () => { id: string; title: string; icon?: string }
        )();
        this.registry.sidebarTabRegistry.set(stConfig.id, {
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
              console.error(`[ExtensionHost] Sidebar tab render failed for "${stConfig.id}":`, err);
              return React.createElement(
                'div',
                { style: { padding: 16, color: '#f87171' } },
                `Sidebar tab "${stConfig.title}" failed to render.`,
              );
            }
          },
        });
      }
    }
  }

  /**
   * Load all previously installed extensions from the backend and
   * activate those that were marked active.
   */
  async loadInstalledExtensions(): Promise<void> {
    try {
      const installed = await TauriAPI.getInstalledExtensions();
      const sorted = sortPackagesByDependencyOrder(installed);

      for (const pkg of sorted) {
        await this.loadExtension(pkg);
      }

      for (const pkg of sorted) {
        if (pkg.is_active) {
          await this.activateExtension(pkg.manifest.id);
        }
      }
    } catch (err) {
      console.error('[ExtensionHost] Failed to load installed extensions:', err);
    }
  }

  // ─── Activation / Deactivation ────────────────────────────────────────

  async activateExtension(id: string): Promise<void> {
    const ext = this.extensions.get(id);
    if (!ext) return;

    if (!ext.isBuiltin && ext.manifest.dependencies?.length) {
      const missing: string[] = [];
      const inactive: string[] = [];
      for (const dep of ext.manifest.dependencies) {
        const depExt = this.extensions.get(dep);
        if (!depExt) {
          missing.push(dep);
        } else if (!depExt.isActive) {
          inactive.push(dep);
        }
      }
      if (missing.length > 0) {
        console.warn(
          `[ExtensionHost] Cannot activate "${id}": missing dependencies: ${missing.join(', ')}`,
        );
        return;
      }
      if (inactive.length > 0) {
        console.warn(
          `[ExtensionHost] Cannot activate "${id}": inactive dependencies: ${inactive.join(', ')}. Attempting to activate them first.`,
        );
        for (const dep of inactive) {
          await this.activateExtension(dep);
          if (!this.extensions.get(dep)?.isActive) {
            console.warn(
              `[ExtensionHost] Dependency "${dep}" failed to activate. Skipping activation of "${id}".`,
            );
            return;
          }
        }
      }
    }

    // HIGH-13: Request user approval for dangerous permissions on non-builtin extensions
    if (!ext.isBuiltin) {
      const dangerousPermissions = [
        'file:write',
        'native:invoke',
        'system:commands',
        'system:network',
      ];
      const requestedDangerous =
        ext.manifest.permissions?.filter((p) => dangerousPermissions.includes(p)) || [];
      if (requestedDangerous.length > 0) {
        console.warn(
          `[Security] Extension "${ext.manifest.name}" (${id}) requests dangerous permissions: ${requestedDangerous.join(', ')}`,
        );
        const approved = await requestPermissionApproval(
          id,
          ext.manifest.display_name || ext.manifest.name,
          requestedDangerous,
        );
        if (!approved) {
          console.warn(
            `[Security] User denied permissions for extension "${ext.manifest.name}" (${id}). Activation aborted.`,
          );
          logPermissionViolation(id, requestedDangerous.join(', '), 'activation denied by user');
          return;
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
        this.registry.cleanupExtension(id, true);
        this.notifyChange();
        console.warn(`[ExtensionHost] Cleaned up registrations for crashed extension "${id}"`);
        return;
      }
    }

    ext.isActive = true;

    // Persist activation for non-builtin extensions
    if (!ext.isBuiltin) {
      try {
        await TauriAPI.activateExtension(id);
      } catch (err) {
        console.error(`[ExtensionHost] Failed to persist activation for ${id}:`, err);
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

    // Persist deactivation for non-builtin extensions
    if (!ext.isBuiltin) {
      try {
        await TauriAPI.deactivateExtension(id);
      } catch (err) {
        console.error(`[ExtensionHost] Failed to persist deactivation for ${id}:`, err);
      }
    }

    this.eventBus.emit('extensionDeactivated', id);
    this.notifyChange();
  }

  async unloadExtension(id: string): Promise<void> {
    await this.deactivateExtension(id);

    // Clear all tracked timers/intervals created by this extension
    const timers = this.extensionTimers.get(id);
    if (timers) {
      for (const t of timers.timeouts) clearTimeout(t);
      for (const i of timers.intervals) clearInterval(i);
      this.extensionTimers.delete(id);
    }

    // Remove any <style> elements injected by this extension
    const styleElements = document.querySelectorAll(
      `style[id*="${id}"], style[data-extension="${id}"]`,
    );
    styleElements.forEach((el) => el.remove());

    // Remove all registry entries for this extension
    this.registry.cleanupExtension(id);

    this.extensions.delete(id);

    this.notifyChange();
  }

  // ─── Hot Reload ───────────────────────────────────────────────────────

  /**
   * Hot-reload a specific extension by ID.
   */
  async reloadExtension(id: string): Promise<void> {
    const ext = this.extensions.get(id);
    if (!ext || ext.isBuiltin) return;

    const pkg = this.extensionPackages.get(id);
    if (!pkg) {
      console.warn(`[ExtensionHost] Cannot hot-reload "${id}": no stored package info`);
      return;
    }

    console.warn(`[ExtensionHost] Hot-reloading extension: ${id}`);
    const wasActive = ext.isActive;

    // Unload the extension (deactivate + remove all registrations)
    await this.unloadExtension(id);

    // Re-load the extension from its original path
    try {
      // Clear the "already loaded" guard so loadExtension proceeds
      this.extensions.delete(id);

      await this.loadExtension(pkg);

      if (wasActive) {
        await this.activateExtension(id);
      }

      const displayName =
        this.extensions.get(id)?.manifest?.display_name ||
        this.extensions.get(id)?.manifest?.name ||
        id;
      console.warn(`[ExtensionHost] Successfully hot-reloaded: ${id}`);
      this.eventBus.emit('extensionReloaded', id);
      window.dispatchEvent(
        new CustomEvent('extension-hot-reloaded', {
          detail: { extensionId: id, name: displayName },
        }),
      );
    } catch (err) {
      console.error(`[ExtensionHost] Failed to hot-reload "${id}":`, err);
    }
  }

  /**
   * Reload all non-builtin extensions.
   */
  async reloadAllExtensions(): Promise<void> {
    const ids = Array.from(this.extensionPackages.keys());
    console.warn(`[ExtensionHost] Reloading all ${ids.length} extensions...`);
    for (const id of ids) {
      await this.reloadExtension(id);
    }
  }

  /**
   * Find the extension ID that corresponds to a given file path.
   */
  findExtensionByPath(changedPath: string): string | undefined {
    const normalized = changedPath.replace(/\\/g, '/').toLowerCase();
    for (const [extPath, extId] of this.extensionPathToId) {
      if (normalized.startsWith(extPath)) {
        return extId;
      }
    }
    return undefined;
  }

  /**
   * Start the hot-reload watcher (dev mode only).
   */
  async startHotReload(): Promise<void> {
    if (this.hotReloadActive) return;
    if (!import.meta.env.DEV) return;

    console.warn('[ExtensionHost] Starting extension hot-reload watcher (dev mode)');

    try {
      for (const extPath of this.extensionPathToId.keys()) {
        await TauriAPI.startWatching(extPath);
      }

      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<{
        extension_path: string;
        extension_id: string;
        file_path: string;
        kind: string;
      }>('extension-file-changed', async (event) => {
        const { extension_path, extension_id, file_path, kind } = event.payload;
        console.warn(`[ExtensionHost] File change detected: ${file_path} (${kind})`);

        const extId = extension_id || this.findExtensionByPath(extension_path);
        if (extId) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          await this.reloadExtension(extId);
        } else {
          console.warn(
            `[ExtensionHost] Changed file does not match any loaded extension: ${extension_path}`,
          );
        }
      });

      this.hotReloadUnlisten = unlisten;

      this.hotReloadKeyHandler = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
          e.preventDefault();
          e.stopPropagation();
          console.warn('[ExtensionHost] Manual reload triggered (Ctrl+Shift+R)');
          void this.reloadAllExtensions();
        }
      };
      document.addEventListener('keydown', this.hotReloadKeyHandler);

      this.hotReloadActive = true;
      console.warn('[ExtensionHost] Extension hot-reload watcher started');
    } catch (err) {
      console.error('[ExtensionHost] Failed to start hot-reload watcher:', err);
    }
  }

  /**
   * Stop the hot-reload watcher and clean up event listeners.
   */
  async stopHotReload(): Promise<void> {
    if (!this.hotReloadActive) return;

    try {
      await TauriAPI.stopWatching();
    } catch (err) {
      console.warn('[ExtensionHost] Error stopping extension watcher:', err);
    }

    if (this.hotReloadUnlisten) {
      this.hotReloadUnlisten();
      this.hotReloadUnlisten = null;
    }
    if (this.hotReloadKeyHandler) {
      document.removeEventListener('keydown', this.hotReloadKeyHandler);
      this.hotReloadKeyHandler = null;
    }

    this.hotReloadActive = false;
    console.warn('[ExtensionHost] Extension hot-reload watcher stopped');
  }

  isHotReloadActive(): boolean {
    return this.hotReloadActive;
  }

  getReloadableExtensionIds(): string[] {
    return Array.from(this.extensionPackages.keys());
  }

  // ─── Marketplace Extension Management ─────────────────────────────────

  /**
   * Install an extension from the marketplace.
   */
  async installFromMarketplace(
    extensionId: string,
    downloadUrl: string,
    manifest: ExtensionManifest,
  ): Promise<void> {
    try {
      // Download the JS bundle
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
      }
      const jsContent = await response.text();

      // Enforce maximum extension bundle size (5MB)
      const MAX_EXTENSION_SIZE = 5 * 1024 * 1024;
      if (jsContent.length > MAX_EXTENSION_SIZE) {
        throw new Error(
          `Extension bundle too large: ${jsContent.length} bytes (max ${MAX_EXTENSION_SIZE})`,
        );
      }

      // Save to localStorage for persistence across sessions
      const installedExtensions = JSON.parse(
        localStorage.getItem('xplorer-installed-extensions') || '{}',
      );
      installedExtensions[extensionId] = {
        manifest,
        downloadUrl,
        installedAt: Date.now(),
        enabled: true,
        bundleCache: jsContent,
      };
      localStorage.setItem('xplorer-installed-extensions', JSON.stringify(installedExtensions));

      // Cache the JS content so loadExtensionScript picks it up
      this.urlBundleCache.set(extensionId, jsContent);

      // Create a synthetic ExtensionPackage and load through the standard flow
      const syntheticPkg: ExtensionPackage = {
        manifest,
        path: `marketplace://${extensionId}`,
        is_active: true,
        is_installed: true,
      };

      await this.loadExtension(syntheticPkg);
      await this.activateExtension(extensionId);

      // Emit event for UI updates
      window.dispatchEvent(
        new CustomEvent('extension-installed', { detail: { extensionId, manifest } }),
      );
    } catch (error) {
      console.error(
        `[ExtensionHost] Failed to install marketplace extension ${extensionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Uninstall a marketplace-installed extension.
   */
  async uninstallMarketplaceExtension(extensionId: string): Promise<void> {
    // Unload (deactivate + remove registrations)
    await this.unloadExtension(extensionId);

    // Remove from localStorage persistence
    const installedExtensions = JSON.parse(
      localStorage.getItem('xplorer-installed-extensions') || '{}',
    );
    delete installedExtensions[extensionId];
    localStorage.setItem('xplorer-installed-extensions', JSON.stringify(installedExtensions));

    // Also try to uninstall from backend (if it was also installed there)
    try {
      await TauriAPI.uninstallExtensionById(extensionId);
    } catch {
      // Not installed via backend -- that's fine
    }

    // Emit event for UI updates
    window.dispatchEvent(new CustomEvent('extension-uninstalled', { detail: { extensionId } }));
  }

  /**
   * Check if an extension is installed from the marketplace (via localStorage).
   */
  isMarketplaceInstalled(extensionId: string): boolean {
    try {
      const installed = JSON.parse(localStorage.getItem('xplorer-installed-extensions') || '{}');
      return !!installed[extensionId];
    } catch {
      return false;
    }
  }

  /**
   * Get all marketplace-installed extensions from localStorage.
   */
  getMarketplaceInstalledExtensions(): Record<
    string,
    {
      manifest: ExtensionManifest;
      downloadUrl: string;
      installedAt: number;
      enabled: boolean;
      bundleCache?: string;
    }
  > {
    try {
      return JSON.parse(localStorage.getItem('xplorer-installed-extensions') || '{}');
    } catch {
      return {};
    }
  }

  /**
   * On startup, reload all previously marketplace-installed extensions
   * from their cached bundles in localStorage.
   */
  async loadMarketplaceInstalledExtensions(): Promise<void> {
    const installed = this.getMarketplaceInstalledExtensions();
    const entries = Object.entries(installed).filter(
      ([id, info]) => info.enabled && !this.extensions.has(id),
    );

    const syntheticPackages: ExtensionPackage[] = [];

    for (const [id, info] of entries) {
      try {
        let jsContent = info.bundleCache;
        if (!jsContent) {
          console.warn(`[ExtensionHost] Re-downloading marketplace extension: ${id}`);
          const response = await fetch(info.downloadUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          jsContent = await response.text();

          const allInstalled = JSON.parse(
            localStorage.getItem('xplorer-installed-extensions') || '{}',
          );
          if (allInstalled[id]) {
            allInstalled[id].bundleCache = jsContent;
            localStorage.setItem('xplorer-installed-extensions', JSON.stringify(allInstalled));
          }
        }

        this.urlBundleCache.set(id, jsContent);
        syntheticPackages.push({
          manifest: info.manifest,
          path: `marketplace://${id}`,
          is_active: true,
          is_installed: true,
        });
      } catch (err) {
        console.warn(`[ExtensionHost] Failed to reload marketplace extension ${id}:`, err);
      }
    }

    const sorted = sortPackagesByDependencyOrder(syntheticPackages);

    for (const pkg of sorted) {
      await this.loadExtension(pkg);
    }

    for (const pkg of sorted) {
      await this.activateExtension(pkg.manifest.id);
    }
  }

  // ─── Dependency Queries ──────────────────────────────────────────────

  getMissingDependencies(manifest: ExtensionManifest): string[] {
    if (!manifest.dependencies?.length) return [];
    return manifest.dependencies.filter((dep) => !this.extensions.has(dep));
  }

  getInactiveDependencies(manifest: ExtensionManifest): string[] {
    if (!manifest.dependencies?.length) return [];
    return manifest.dependencies.filter((dep) => {
      const ext = this.extensions.get(dep);
      return ext && !ext.isActive;
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  /** Create the extension API — delegates to createExtensionApi with bound callbacks */
  _createApi(manifest: ExtensionManifest) {
    return createExtensionApi(
      manifest,
      (command, handler) => this.registry.registerCommand(command, handler),
      (command, ...args) => this.registry.executeCommand(command, ...args),
      this.eventBus,
      (dialogId, data) => this.registry.openDialog(dialogId, data),
      (dialogId) => this.registry.closeDialog(dialogId),
      (id) => this.reloadExtension(id),
      () => this.getReloadableExtensionIds(),
      this.hotReloadActive,
    );
  }
}
