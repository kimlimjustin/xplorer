import React from 'react';
import { TauriAPI } from './tauri-api';
import { resolveIcon } from './extension-host-icon';
import type {
  ExtensionManifest,
  ExtensionFileInfo,
  PanelRenderProps,
  PanelRegistration,
  EditorRegistration,
  TabRegistration,
  TabRenderProps,
  NavigationRegistration,
  BottomTabRegistration,
  SidebarTabRegistration,
  DialogRegistration,
  PreviewRegistration,
  PreviewRenderProps,
  FileDecoration,
  FileDecorator,
  ContextMenuEntry,
  CommandHandler,
  LoadedExtension,
} from './extension-host-types';

// ─── Extension Registry ──────────────────────────────────────────────────────
// Manages all registration maps (panels, editors, tabs, navigation, bottom tabs,
// dialogs, commands, decorators, context menus) and their query methods.

export class ExtensionRegistry {
  readonly panelRegistry = new Map<string, PanelRegistration>();
  readonly editorRegistry = new Map<string, EditorRegistration>();
  readonly tabRegistry = new Map<string, TabRegistration>();
  readonly navigationRegistry = new Map<string, NavigationRegistration>();
  readonly bottomTabRegistry = new Map<string, BottomTabRegistration>();
  readonly sidebarTabRegistry = new Map<string, SidebarTabRegistration>();
  readonly dialogRegistry = new Map<string, DialogRegistration>();
  readonly previewRegistry = new Map<string, PreviewRegistration>();
  readonly openDialogs = new Map<string, Record<string, unknown>>();
  readonly commandRegistry = new Map<string, CommandHandler>();
  readonly decoratorRegistry = new Map<string, FileDecorator>();
  readonly contextMenuEntries = new Map<string, ContextMenuEntry[]>();

  /** Reference to the extensions map — set by the host after construction */
  extensions!: Map<string, LoadedExtension>;

  /** Change notification callback — set by the host */
  notifyChange: () => void = () => {};

  // ─── Panel Registration ──────────────────────────────────────────────

  registerBuiltinPanel(
    extensionId: string,
    manifest: ExtensionManifest,
    config: {
      name: string;
      icon: React.ReactNode;
      location?: 'sidebar' | 'bottom' | 'right';
      render: (props: PanelRenderProps) => React.ReactElement;
    },
  ): void {
    this.panelRegistry.set(extensionId, {
      id: extensionId,
      extensionId,
      title: config.name,
      icon: config.icon,
      location: config.location || 'right',
      render: config.render,
      isBuiltin: true,
    });
  }

  registerPanelsFromManifest(extensionId: string, manifest: ExtensionManifest): void {
    if (!manifest.contributes?.panels) return;
    for (const panel of manifest.contributes.panels) {
      this.panelRegistry.set(panel.id, {
        id: panel.id,
        extensionId,
        title: panel.title,
        icon: resolveIcon(panel.icon),
        location: (panel.location as 'sidebar' | 'bottom' | 'right') || 'right',
        render: () =>
          React.createElement(
            'div',
            { className: 'p-4 text-sm text-xp-text-muted' },
            `Panel: ${panel.title}`,
          ),
        isBuiltin: false,
      });
    }
  }

  /** Update panel renderers when an extension provides a render() function */
  updatePanelRenderers(
    extensionId: string,
    renderFn: (props: PanelRenderProps) => React.ReactElement,
  ): void {
    for (const [panelId, panel] of this.panelRegistry) {
      if (panel.extensionId === extensionId) {
        panel.render = (props: PanelRenderProps) => {
          try {
            return renderFn(props);
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

  // ─── Registration from Extension Instance ─────────────────────────────

  /**
   * Register all contributions from an extension instance (panels, editors, tabs,
   * navigation, dialogs, bottom tabs). Called during registerExternalExtension
   * and loadExtensionScript.
   */
  registerFromInstance(
    extensionId: string,
    manifest: ExtensionManifest,
    ext: Record<string, unknown>,
  ): void {
    // Register panels from manifest contributes
    if (manifest.contributes?.panels) {
      for (const panel of manifest.contributes.panels) {
        this.panelRegistry.set(panel.id, {
          id: panel.id,
          extensionId,
          title: panel.title,
          icon: resolveIcon(panel.icon),
          location: (panel.location as 'sidebar' | 'bottom' | 'right') || 'right',
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
          isBuiltin: false,
        });
      }
    }

    // Register editors from contributes.editors + renderEditor function
    if (manifest.contributes?.editors && typeof ext.renderEditor === 'function') {
      for (const editor of manifest.contributes.editors) {
        this.editorRegistry.set(editor.id, {
          id: editor.id,
          extensionId,
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

    // Register custom tab types from renderTab + getTabConfig
    if (typeof ext.renderTab === 'function' && typeof ext.getTabConfig === 'function') {
      const tabConfig = (
        ext.getTabConfig as () => { id: string; title: string; icon?: string; urlScheme?: string }
      )();
      this.tabRegistry.set(tabConfig.id, {
        id: tabConfig.id,
        extensionId,
        title: tabConfig.title,
        icon: resolveIcon(tabConfig.icon),
        urlScheme: tabConfig.urlScheme,
        render: (props: TabRenderProps) => {
          try {
            return (ext.renderTab as (props: TabRenderProps) => React.ReactElement)(props);
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
    if (typeof ext.getNavigationConfig === 'function' && typeof ext.getEntries === 'function') {
      const navConfig = (
        ext.getNavigationConfig as () => {
          id: string;
          section: string;
          icon?: string;
          updateEvent?: string;
        }
      )();
      this.navigationRegistry.set(navConfig.id, {
        id: navConfig.id,
        extensionId,
        section: navConfig.section,
        icon: resolveIcon(navConfig.icon),
        updateEvent: navConfig.updateEvent,
        getEntries: ext.getEntries as () => Promise<
          Array<{ id: string; label: string; icon?: string; action: () => void }>
        >,
        onManage:
          typeof ext.onManage === 'function' ? (ext.onManage as () => Promise<void>) : undefined,
      });
    }

    // Register dialogs from renderDialog + getDialogConfig
    if (typeof ext.renderDialog === 'function' && typeof ext.getDialogConfig === 'function') {
      const dlgConfig = (
        ext.getDialogConfig as () => { id: string; title: string; icon?: string }
      )();
      this.dialogRegistry.set(dlgConfig.id, {
        id: dlgConfig.id,
        extensionId,
        title: dlgConfig.title,
        icon: resolveIcon(dlgConfig.icon),
        render: (props: {
          isOpen: boolean;
          onClose: () => void;
          data: Record<string, unknown>;
        }) => {
          try {
            return (
              ext.renderDialog as (props: {
                isOpen: boolean;
                onClose: () => void;
                data: Record<string, unknown>;
              }) => React.ReactElement
            )(props);
          } catch (err) {
            console.error(`[ExtensionHost] Dialog render failed for "${dlgConfig.id}":`, err);
            return React.createElement(
              'div',
              { style: { padding: 16, color: '#f87171' } },
              `Dialog "${dlgConfig.title}" failed to render.`,
            );
          }
        },
      });
    }

    // Register bottom tabs from renderBottomTab + getBottomTabConfig
    if (typeof ext.renderBottomTab === 'function' && typeof ext.getBottomTabConfig === 'function') {
      const btConfig = (
        ext.getBottomTabConfig as () => { id: string; title: string; icon?: string }
      )();
      this.bottomTabRegistry.set(btConfig.id, {
        id: btConfig.id,
        extensionId,
        title: btConfig.title,
        icon: resolveIcon(btConfig.icon),
        render: (props: { currentPath?: string; isActive?: boolean }) => {
          try {
            return (
              ext.renderBottomTab as (props: {
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

    // Register sidebar tabs from renderSidebarTab + getSidebarTabConfig
    if (
      typeof ext.renderSidebarTab === 'function' &&
      typeof ext.getSidebarTabConfig === 'function'
    ) {
      const stConfig = (
        ext.getSidebarTabConfig as () => { id: string; title: string; icon?: string }
      )();
      this.sidebarTabRegistry.set(stConfig.id, {
        id: stConfig.id,
        extensionId,
        title: stConfig.title,
        icon: resolveIcon(stConfig.icon),
        render: (props: { currentPath?: string; isActive?: boolean }) => {
          try {
            return (
              ext.renderSidebarTab as (props: {
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

    // Register preview providers from canPreview + getPriority + render (category: 'preview')
    if (
      manifest.category === 'preview' &&
      typeof ext.canPreview === 'function' &&
      typeof ext.render === 'function'
    ) {
      const priority =
        typeof ext.getPriority === 'function' ? (ext.getPriority as () => number)() : 10;
      this.previewRegistry.set(manifest.id, {
        id: manifest.id,
        extensionId,
        priority,
        canPreview: (file: { name: string; path: string; is_dir: boolean; size?: number }) => {
          try {
            return (ext.canPreview as (file: unknown) => boolean)(file);
          } catch (err) {
            console.error(`[ExtensionHost] Preview canPreview failed for "${manifest.id}":`, err);
            return false;
          }
        },
        render: (props: PreviewRenderProps) => {
          try {
            return (ext.render as (props: PreviewRenderProps) => React.ReactElement)(props);
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
  }

  // ─── Registry Queries ──────────────────────────────────────────────────

  /**
   * Find the best extension-provided editor for a given file path.
   * Returns the highest-priority editor whose extensions list matches.
   */
  getEditorForFile(filePath: string): EditorRegistration | undefined {
    const fileName = filePath.split(/[/\\]/).pop() || '';
    const lower = fileName.toLowerCase();
    // Get extension: handle dotfiles (.gitignore -> gitignore)
    let ext: string;
    if (lower.startsWith('.') && !lower.includes('.', 1)) {
      ext = lower.slice(1);
    } else {
      const parts = lower.split('.');
      ext = parts.length > 1 ? parts[parts.length - 1] : '';
    }
    // Also check bare filename for Makefile, Dockerfile etc.
    const bareName = lower;

    let best: EditorRegistration | undefined;
    for (const [, editor] of this.editorRegistry) {
      const parentExt = this.extensions.get(editor.extensionId);
      if (!parentExt?.isActive) continue;
      if (editor.extensions.includes(ext) || editor.extensions.includes(bareName)) {
        if (!best || editor.priority > best.priority) {
          best = editor;
        }
      }
    }
    return best;
  }

  getRegisteredPanels(): PanelRegistration[] {
    const panels: PanelRegistration[] = [];
    for (const [, panel] of this.panelRegistry) {
      const ext = this.extensions.get(panel.extensionId);
      if (ext && ext.isActive) {
        panels.push(panel);
      }
    }
    return panels;
  }

  getPanel(panelId: string): PanelRegistration | undefined {
    return this.panelRegistry.get(panelId);
  }

  getContextMenuItems(_context: {
    file?: ExtensionFileInfo;
    selectedFiles?: unknown;
  }): ContextMenuEntry[] {
    const items: ContextMenuEntry[] = [];
    for (const [extId, entries] of this.contextMenuEntries) {
      const ext = this.extensions.get(extId);
      if (ext?.isActive) {
        items.push(...entries);
      }
    }
    return items;
  }

  getFileDecorations(file: ExtensionFileInfo): FileDecoration[] {
    const decorations: FileDecoration[] = [];
    for (const [, decorator] of this.decoratorRegistry) {
      const ext = this.extensions.get(decorator.extensionId);
      if (ext?.isActive) {
        const decoration = decorator.decorate(file);
        if (decoration) {
          decorations.push(decoration);
        }
      }
    }
    return decorations;
  }

  // ─── Preview Registry Queries ────────────────────────────────────────

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
    let best: PreviewRegistration | null = null;
    for (const [, preview] of this.previewRegistry) {
      const ext = this.extensions.get(preview.extensionId);
      if (!ext?.isActive) continue;
      if (preview.canPreview(file)) {
        if (!best || preview.priority > best.priority) {
          best = preview;
        }
      }
    }
    return best;
  }

  // ─── Tab Registry Queries ─────────────────────────────────────────────

  /** Get the render function for an extension-registered tab type */
  getTabRenderer(tabType: string): ((props: TabRenderProps) => React.ReactElement) | null {
    const reg = this.tabRegistry.get(tabType);
    if (!reg) return null;
    const ext = this.extensions.get(reg.extensionId);
    if (!ext?.isActive) return null;
    return reg.render;
  }

  /** Get the icon for an extension-registered tab type */
  getTabIcon(tabType: string): React.ReactNode | null {
    const reg = this.tabRegistry.get(tabType);
    if (!reg) return null;
    return reg.icon;
  }

  /** Check if a path matches any registered extension URL scheme */
  isExtensionScheme(path: string): boolean {
    for (const [, reg] of this.tabRegistry) {
      if (reg.urlScheme && path.startsWith(reg.urlScheme)) return true;
    }
    return false;
  }

  /** Get all registered navigation entries from extensions */
  getNavigationEntries(): NavigationRegistration[] {
    const entries: NavigationRegistration[] = [];
    for (const [, nav] of this.navigationRegistry) {
      const ext = this.extensions.get(nav.extensionId);
      if (ext?.isActive) entries.push(nav);
    }
    return entries;
  }

  /** Get all registered bottom tabs from extensions */
  getBottomTabs(): BottomTabRegistration[] {
    const tabs: BottomTabRegistration[] = [];
    for (const [, bt] of this.bottomTabRegistry) {
      const ext = this.extensions.get(bt.extensionId);
      if (ext?.isActive) tabs.push(bt);
    }
    return tabs;
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

  // ─── Sidebar Tab Registry Queries ──────────────────────────────────────

  /** Get all registered sidebar tabs from extensions */
  getSidebarTabs(): SidebarTabRegistration[] {
    const tabs: SidebarTabRegistration[] = [];
    for (const [, st] of this.sidebarTabRegistry) {
      const ext = this.extensions.get(st.extensionId);
      if (ext?.isActive) tabs.push(st);
    }
    return tabs;
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

  // ─── Dialogs ───────────────────────────────────────────────────────────

  /** Check if a dialog type has been registered by an extension */
  hasDialog(dialogId: string): boolean {
    const reg = this.dialogRegistry.get(dialogId);
    if (!reg) return false;
    const ext = this.extensions.get(reg.extensionId);
    return !!ext?.isActive;
  }

  /** Get the render function for an extension-registered dialog */
  getDialogRenderer(dialogId: string): DialogRegistration['render'] | null {
    const reg = this.dialogRegistry.get(dialogId);
    if (!reg) return null;
    const ext = this.extensions.get(reg.extensionId);
    if (!ext?.isActive) return null;
    return reg.render;
  }

  /** Open an extension dialog with data */
  openDialog(dialogId: string, data: Record<string, unknown>): void {
    this.openDialogs.set(dialogId, data);
    this.notifyChange();
  }

  /** Close an extension dialog */
  closeDialog(dialogId: string): void {
    this.openDialogs.delete(dialogId);
    this.notifyChange();
  }

  /** Get all currently open extension dialogs */
  getOpenDialogs(): Map<string, Record<string, unknown>> {
    return this.openDialogs;
  }

  /** Get all registered dialog IDs */
  getRegisteredDialogIds(): string[] {
    return Array.from(this.dialogRegistry.keys());
  }

  // ─── Commands ─────────────────────────────────────────────────────────

  registerCommand(command: string, handler: CommandHandler): { dispose: () => void } {
    this.commandRegistry.set(command, handler);
    return {
      dispose: () => {
        this.commandRegistry.delete(command);
      },
    };
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

  // ─── Decorators ───────────────────────────────────────────────────────

  registerDecorator(decorator: FileDecorator): { dispose: () => void } {
    // MED-E07: Limit decorator registry size to prevent unbounded growth
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

  // ─── Context Menus ────────────────────────────────────────────────────

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

  // ─── Cleanup ──────────────────────────────────────────────────────────

  /**
   * Remove all registrations for an extension.
   * Used during unload and crash cleanup.
   */
  cleanupExtension(id: string, keepBuiltin = false): void {
    // Remove panels registered by this extension
    for (const [panelId, panel] of this.panelRegistry) {
      if (panel.extensionId === id && (!keepBuiltin || !panel.isBuiltin)) {
        this.panelRegistry.delete(panelId);
      }
    }

    // Remove commands namespaced to this extension
    for (const [cmd] of this.commandRegistry) {
      if (
        cmd.startsWith(`${id}.`) ||
        cmd.startsWith(`state:${id}:`) ||
        cmd.startsWith(`workspace:${id}:`)
      ) {
        this.commandRegistry.delete(cmd);
      }
    }

    // Remove editors registered by this extension
    for (const [editorId, editor] of this.editorRegistry) {
      if (editor.extensionId === id) {
        this.editorRegistry.delete(editorId);
      }
    }

    // Remove tabs, navigation, bottom tabs, previews
    for (const [tabId, tab] of this.tabRegistry) {
      if (tab.extensionId === id) this.tabRegistry.delete(tabId);
    }
    for (const [navId, nav] of this.navigationRegistry) {
      if (nav.extensionId === id) this.navigationRegistry.delete(navId);
    }
    for (const [btId, bt] of this.bottomTabRegistry) {
      if (bt.extensionId === id) this.bottomTabRegistry.delete(btId);
    }
    for (const [stId, st] of this.sidebarTabRegistry) {
      if (st.extensionId === id) this.sidebarTabRegistry.delete(stId);
    }
    for (const [previewId, preview] of this.previewRegistry) {
      if (preview.extensionId === id) this.previewRegistry.delete(previewId);
    }

    // Remove decorators and context menu entries
    this.decoratorRegistry.delete(id);
    this.contextMenuEntries.delete(id);

    // Unregister extension shortcuts
    TauriAPI.unregisterExtensionShortcuts(id).catch((err) =>
      console.warn(`[ExtensionHost] Failed to unregister shortcuts for ${id}:`, err),
    );
  }
}
