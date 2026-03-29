/**
 * High-level extension registration APIs.
 *
 * These provide the simplest possible DX for creating Xplorer extensions.
 * Each `*.register()` call internally creates the appropriate Extension
 * subclass, wires up boilerplate, and calls `registerExtension()`.
 *
 * @example
 * ```ts
 * import { Theme, Sidebar, Command, ContextMenu, Preview } from '@xplorer/extension-sdk';
 *
 * Theme.register({ id: 'my-theme', name: 'My Theme', colors: { bg: '#1a1a2e', surface: '#16213e', ... } });
 * Sidebar.register({ id: 'my-panel', title: 'My Panel', icon: 'chart', render: (props) => ... });
 * Command.register({ id: 'do-thing', title: 'Do Thing', action: async (api) => { ... } });
 * ```
 */

import type { XplorerAPI } from '../types';

// ─── Shared internals ──────────────────────────────────────────────────────

declare global {
  interface Window {
    __xplorer_register__?: (extension: unknown) => void;
  }
}

const register = (extension: unknown): void => {
  if (typeof window !== 'undefined' && window.__xplorer_register__) {
    window.__xplorer_register__(extension);
  } else {
    console.warn('[SDK] Could not register extension: Xplorer host not available.');
  }
};

// ─── Theme API ─────────────────────────────────────────────────────────────

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceLight: string;
  border: string;
  borderLight?: string;
  text: string;
  textMuted: string;
  textSecondary?: string;
  blue: string;
  blueDark?: string;
  green: string;
  orange: string;
  pink: string;
  red: string;
  yellow: string;
  cyan: string;
  purple: string;
  popover?: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  /** Theme color palette — the SDK auto-generates all CSS variables from this */
  colors: ThemeColors;
  /** Optional extra CSS for advanced customizations (scrollbar styles, glow effects, etc.) */
  css?: string;
  /** Optional background style for <html> element (defaults to colors.bg) */
  background?: string;
}

/**
 * HIGH-11: Validate that a string is a safe CSS color value.
 * Blocks injection characters and dangerous CSS constructs.
 */
const isValidCssColor = (value: string): boolean => {
  // Allow hex, rgb, rgba, hsl, hsla, named colors, transparent, currentColor, inherit
  const colorPattern =
    /^(#[0-9a-fA-F]{3,8}|rgba?\s*\([\d\s,./%]+\)|hsla?\s*\([\d\s,./%deg]+\)|transparent|currentColor|inherit|initial|unset|[a-zA-Z]+)$/;
  // Block injection characters and dangerous constructs
  if (/[;{}]|url\s*\(|@import|expression\s*\(/i.test(value)) return false;
  return colorPattern.test(value.trim());
};

/**
 * Validate all color values in a ThemeColors object.
 * Throws an error if any color value contains potentially dangerous content.
 */
const validateThemeColors = (colors: ThemeColors): void => {
  const entries = Object.entries(colors) as [string, string | undefined][];
  for (const [key, value] of entries) {
    if (value !== undefined && !isValidCssColor(value)) {
      throw new Error(
        `[SDK] Invalid CSS color value for "${key}": "${value}". Color values must not contain injection characters.`,
      );
    }
  }
};

/**
 * HIGH-11: Sanitize custom CSS to strip potentially dangerous constructs.
 * Removes @import, @font-face, url(), and expression() which could be used
 * for data exfiltration or loading external resources.
 */
const sanitizeCustomCSS = (css: string): string => {
  return (
    css
      .replace(/@import\s+[^;]+;?/gi, '/* @import blocked */')
      .replace(/@font-face\s*\{[^}]*\}/gi, '/* @font-face blocked */')
      .replace(/url\s*\([^)]*\)/gi, '/* url() blocked */')
      .replace(/expression\s*\([^)]*\)/gi, '/* expression() blocked */')
      // Block @keyframes with very short durations (< 0.01s) that can cause rapid repaints / DoS
      .replace(
        /@keyframes\s+[^{]*\{[^}]*(?:duration|animation)\s*:\s*(?:0\.00\d|0\.000)\s*s[^}]*\}/gi,
        '/* @keyframes with micro-duration blocked */',
      )
      // Block expression() CSS expressions (IE-specific, script injection vector)
      .replace(/expression\s*\(/gi, '/* expression() blocked */(')
      // Block behavior: property (IE HTCs, script execution)
      .replace(/behavior\s*:/gi, '/* behavior blocked */:')
      // Block -moz-binding: property (XBL binding, script execution in Firefox)
      .replace(/-moz-binding\s*:/gi, '/* -moz-binding blocked */:')
  );
};

const generateThemeCSS = (
  id: string,
  c: ThemeColors,
  background?: string,
  extraCss?: string,
): string => {
  return `.theme-${id} {
  --background: ${c.bg};
  --foreground: ${c.text};
  --muted: ${c.surface};
  --muted-foreground: ${c.textMuted};
  --popover: ${c.popover ?? c.bg};
  --popover-foreground: ${c.text};
  --card: ${c.surface};
  --card-foreground: ${c.text};
  --border: ${c.border};
  --input: ${c.border};
  --primary: ${c.blue};
  --primary-foreground: #ffffff;
  --secondary: ${c.surface};
  --secondary-foreground: ${c.text};
  --accent: ${c.surfaceLight};
  --accent-foreground: ${c.text};
  --destructive: ${c.red};
  --destructive-foreground: #ffffff;
  --ring: ${c.blue};
  --xp-bg: ${c.bg};
  --xp-surface: ${c.surface};
  --xp-surface-light: ${c.surfaceLight};
  --xp-border: ${c.border};
  --xp-border-light: ${c.borderLight ?? c.border};
  --xp-text: ${c.text};
  --xp-text-muted: ${c.textMuted};
  --xp-text-secondary: ${c.textSecondary ?? c.textMuted};
  --xp-blue: ${c.blue};
  --xp-blue-dark: ${c.blueDark ?? c.blue};
  --xp-green: ${c.green};
  --xp-orange: ${c.orange};
  --xp-pink: ${c.pink};
  --xp-red: ${c.red};
  --xp-yellow: ${c.yellow};
  --xp-cyan: ${c.cyan};
  --xp-purple: ${c.purple};
  --xp-popover: ${c.popover ?? c.bg};
}
html.theme-${id} {
  background: ${background ?? c.bg};
  min-height: 100vh;
}
${extraCss ?? ''}`;
};

export const Theme = {
  register(config: ThemeConfig): void {
    // HIGH-11: Validate color values before generating CSS
    validateThemeColors(config.colors);
    if (config.background && !isValidCssColor(config.background)) {
      throw new Error(`[SDK] Invalid CSS background value: "${config.background}"`);
    }

    // Sanitize any custom CSS provided by the extension
    const sanitizedExtraCss = config.css ? sanitizeCustomCSS(config.css) : undefined;

    let styleEl: HTMLStyleElement | null = null;
    const css = generateThemeCSS(config.id, config.colors, config.background, sanitizedExtraCss);

    register((_api: unknown) => ({
      activate: () => {
        styleEl = document.createElement('style');
        styleEl.id = `theme-${config.id}`;
        styleEl.textContent = css;
        document.head.appendChild(styleEl);

        window.dispatchEvent(
          new CustomEvent('xplorer-theme-register', {
            detail: {
              id: config.id,
              name: config.name,
              primary: config.colors.blue,
              bg: config.colors.bg,
              surface: config.colors.surface,
              text: config.colors.text,
            },
          }),
        );
      },
      deactivate: () => {
        if (styleEl) {
          styleEl.remove();
          styleEl = null;
        }
        window.dispatchEvent(
          new CustomEvent('xplorer-theme-unregister', {
            detail: { id: config.id },
          }),
        );
      },
    }));
  },
};

// ─── Sidebar (Panel) API ───────────────────────────────────────────────────

export interface SidebarConfig {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  /** Default: 'right' */
  location?: 'right' | 'bottom';
  permissions?: string[];
  /** Render the panel UI. Receives props from the host. */
  render: (props: SidebarRenderProps) => unknown; // React.ReactElement
  /** Called when the extension is activated */
  onActivate?: (api: XplorerAPI) => void | Promise<void>;
  /** Called when the extension is deactivated */
  onDeactivate?: () => void | Promise<void>;
}

export interface SidebarRenderProps {
  currentPath?: string;
  selectedFiles?: Array<{ name: string; path: string; is_dir: boolean }>;
  [key: string]: unknown;
}

export const Sidebar = {
  register(config: SidebarConfig): void {
    let api: XplorerAPI;

    const extension = {
      manifest: {
        id: config.id,
        name: config.title,
        displayName: config.title,
        version: '1.0.0',
        author: 'Extension',
        category: 'panel' as const,
        description: config.description || config.title,
        icon: config.icon,
        permissions: config.permissions || ['ui:panels'],
        contributes: {
          panels: [
            {
              id: config.id,
              title: config.title,
              location: config.location || 'right',
              icon: config.icon,
            },
          ],
        },
      },

      _setContext(_ctx: unknown, injectedApi: XplorerAPI) {
        api = injectedApi;
      },

      render(props: SidebarRenderProps) {
        return config.render(props);
      },

      async activate() {
        if (config.onActivate) await config.onActivate(api);
      },

      async deactivate() {
        if (config.onDeactivate) await config.onDeactivate();
      },
    };

    register(extension);
  },
};

// ─── SidebarTab API ─────────────────────────────────────────────────────────

export interface SidebarTabConfig {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  permissions?: string[];
  /** Render the sidebar tab content. Receives props from the host. */
  render: (props: SidebarTabRenderProps) => unknown; // React.ReactElement
  /** Called when the extension is activated */
  onActivate?: (api: XplorerAPI) => void | Promise<void>;
  /** Called when the extension is deactivated */
  onDeactivate?: () => void | Promise<void>;
}

export interface SidebarTabRenderProps {
  currentPath?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

export const SidebarTab = {
  register(config: SidebarTabConfig): void {
    let api: XplorerAPI;

    const extension = {
      manifest: {
        id: config.id,
        name: config.title,
        displayName: config.title,
        version: '1.0.0',
        author: 'Extension',
        category: 'panel' as const,
        description: config.description || config.title,
        icon: config.icon,
        permissions: config.permissions || ['ui:panels'],
      },

      _setContext(_ctx: unknown, injectedApi: XplorerAPI) {
        api = injectedApi;
      },

      getSidebarTabConfig() {
        return {
          id: config.id,
          title: config.title,
          icon: config.icon,
        };
      },

      renderSidebarTab(props: SidebarTabRenderProps) {
        return config.render(props);
      },

      async activate() {
        if (config.onActivate) await config.onActivate(api);
      },

      async deactivate() {
        if (config.onDeactivate) await config.onDeactivate();
      },
    };

    register(extension);
  },
};

// ─── Command API ───────────────────────────────────────────────────────────

export interface CommandConfig {
  id: string;
  title: string;
  /** Keyboard shortcut, e.g. 'ctrl+shift+w' */
  shortcut?: string;
  permissions?: string[];
  /** The action to execute */
  action: (api: XplorerAPI) => void | Promise<void>;
}

export const Command = {
  register(config: CommandConfig): void {
    let api: XplorerAPI;
    const disposables: Array<{ dispose(): void }> = [];

    const extension = {
      manifest: {
        id: config.id,
        name: config.title,
        displayName: config.title,
        version: '1.0.0',
        author: 'Extension',
        category: 'tool' as const,
        description: config.title,
        permissions: config.permissions || ['ui:notifications'],
      },

      _setContext(_ctx: unknown, injectedApi: XplorerAPI) {
        api = injectedApi;
      },

      async activate() {
        const cmd = api.commands.register(
          config.id,
          async () => {
            try {
              await config.action(api);
            } catch (err) {
              console.error(`[ExtensionHost] Command action failed for "${config.id}":`, err);
            }
          },
          { title: config.title, shortcut: config.shortcut },
        );
        disposables.push(cmd);

        if (config.shortcut) {
          try {
            await api.shortcuts.register(config.id, {
              key: config.shortcut,
              title: config.title,
            });
          } catch {
            // Shortcut registration may not be available
          }
        }
      },

      async deactivate() {
        for (const d of disposables) d.dispose();
        disposables.length = 0;
        try {
          await api.shortcuts.unregisterAll();
        } catch {
          /* ignore */
        }
      },
    };

    register(extension);
  },
};

// ─── ContextMenu API ───────────────────────────────────────────────────────

export interface ContextMenuConfig {
  id: string;
  title: string;
  /** When to show: 'always' | 'singleFileSelected' | 'multipleFilesSelected' | custom function */
  when?:
    | 'always'
    | 'singleFileSelected'
    | 'multipleFilesSelected'
    | ((files: ContextMenuFile[]) => boolean);
  permissions?: string[];
  /** The action to execute when the menu item is clicked */
  action: (files: ContextMenuFile[], api: XplorerAPI) => void | Promise<void>;
}

export interface ContextMenuFile {
  name: string;
  path: string;
  is_dir: boolean;
}

export const ContextMenu = {
  register(config: ContextMenuConfig): void {
    let api: XplorerAPI;
    const disposables: Array<{ dispose(): void }> = [];

    const extension = {
      manifest: {
        id: config.id,
        name: config.title,
        displayName: config.title,
        version: '1.0.0',
        author: 'Extension',
        category: 'action' as const,
        description: config.title,
        permissions: config.permissions || ['file:read', 'ui:notifications'],
      },

      _setContext(_ctx: unknown, injectedApi: XplorerAPI) {
        api = injectedApi;
      },

      async activate() {
        const cmd = api.commands.register(config.id, async () => {
          try {
            const state = (window as unknown as Record<string, unknown>).__xplorer_state__ as
              | { selectedFiles?: ContextMenuFile[] }
              | undefined;
            const files = state?.selectedFiles || [];
            await config.action(files, api);
          } catch (err) {
            console.error(`[ExtensionHost] Context menu action failed for "${config.id}":`, err);
          }
        });
        disposables.push(cmd);
      },

      async deactivate() {
        for (const d of disposables) d.dispose();
        disposables.length = 0;
      },
    };

    register(extension);
  },
};

// ─── Preview API ───────────────────────────────────────────────────────────

export interface PreviewConfig {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  permissions?: string[];
  /** Return true if this extension can preview the given file */
  canPreview: (file: PreviewFile) => boolean;
  /** Priority (higher = preferred). Default: 10 */
  priority?: number;
  /** Render the preview for the selected file */
  render: (props: PreviewRenderProps) => unknown; // React.ReactElement
  onActivate?: (api: XplorerAPI) => void | Promise<void>;
  onDeactivate?: () => void | Promise<void>;
}

export interface PreviewFile {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
}

export interface PreviewRenderProps {
  currentPath?: string;
  selectedFiles?: PreviewFile[];
  [key: string]: unknown;
}

// ─── Editor API ───────────────────────────────────────────────────────────

export interface EditorConfig {
  id: string;
  title: string;
  /** File extensions this editor handles (without dot), e.g. ['ts', 'js', 'py'] */
  extensions: string[];
  /** Higher priority wins when multiple editors match (default: 10) */
  priority?: number;
  permissions?: string[];
  /** Render the editor UI for the given file */
  render: (props: { filePath: string }) => unknown; // React.ReactElement
  /** Called when the extension is activated */
  onActivate?: (api: XplorerAPI) => void | Promise<void>;
  /** Called when the extension is deactivated */
  onDeactivate?: () => void | Promise<void>;
}

export const Editor = {
  register(config: EditorConfig): void {
    let api: XplorerAPI;

    const extension = {
      manifest: {
        id: config.id,
        name: config.title,
        displayName: config.title,
        version: '1.0.0',
        author: 'Extension',
        category: 'editor' as const,
        description: `Editor: ${config.title}`,
        permissions: config.permissions || ['file:read', 'file:write'],
        contributes: {
          editors: [
            {
              id: config.id,
              extensions: config.extensions,
              priority: config.priority ?? 10,
            },
          ],
        },
      },

      _setContext(_ctx: unknown, injectedApi: XplorerAPI) {
        api = injectedApi;
      },

      renderEditor(props: { filePath: string }) {
        return config.render(props);
      },

      async activate() {
        if (config.onActivate) await config.onActivate(api);
      },

      async deactivate() {
        if (config.onDeactivate) await config.onDeactivate();
      },
    };

    register(extension);
  },
};

// ─── BottomTab API ─────────────────────────────────────────────────────────

export interface BottomTabConfig {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  permissions?: string[];
  /** Render the bottom tab content. */
  render: (props: BottomTabRenderProps) => unknown; // React.ReactElement
  /** Called when the extension is activated */
  onActivate?: (api: XplorerAPI) => void | Promise<void>;
  /** Called when the extension is deactivated */
  onDeactivate?: () => void | Promise<void>;
}

export interface BottomTabRenderProps {
  currentPath?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

export const BottomTab = {
  register(config: BottomTabConfig): void {
    let api: XplorerAPI;

    const extension = {
      manifest: {
        id: config.id,
        name: config.title,
        displayName: config.title,
        version: '1.0.0',
        author: 'Extension',
        category: 'tool' as const,
        description: config.description || config.title,
        icon: config.icon,
        permissions: config.permissions || ['ui:panels'],
      },

      _setContext(_ctx: unknown, injectedApi: XplorerAPI) {
        api = injectedApi;
      },

      getBottomTabConfig() {
        return {
          id: config.id,
          title: config.title,
          icon: config.icon,
        };
      },

      renderBottomTab(props: BottomTabRenderProps) {
        return config.render(props);
      },

      async activate() {
        if (config.onActivate) await config.onActivate(api);
      },

      async deactivate() {
        if (config.onDeactivate) await config.onDeactivate();
      },
    };

    register(extension);
  },
};

// ─── Preview API ───────────────────────────────────────────────────────────

export const Preview = {
  register(config: PreviewConfig): void {
    let api: XplorerAPI;

    const extension = {
      manifest: {
        id: config.id,
        name: config.title,
        displayName: config.title,
        version: '1.0.0',
        author: 'Extension',
        category: 'preview' as const,
        description: config.description || config.title,
        icon: config.icon,
        permissions: config.permissions || ['file:read'],
        contributes: {
          panels: [
            {
              id: config.id,
              title: config.title,
              location: 'right',
              icon: config.icon,
            },
          ],
        },
      },

      _setContext(_ctx: unknown, injectedApi: XplorerAPI) {
        api = injectedApi;
      },

      canPreview(file: PreviewFile): boolean {
        return config.canPreview(file);
      },

      getPriority(): number {
        return config.priority ?? 10;
      },

      render(props: PreviewRenderProps) {
        return config.render(props);
      },

      async activate() {
        if (config.onActivate) await config.onActivate(api);
      },

      async deactivate() {
        if (config.onDeactivate) await config.onDeactivate();
      },
    };

    register(extension);
  },
};
