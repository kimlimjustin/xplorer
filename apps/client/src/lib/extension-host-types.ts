import React from 'react';

// ─── Global Augmentation ──────────────────────────────────────────────────────

declare global {
  interface Window {
    __xplorer_register__?: (extension: unknown) => void;
    __xplorer_state__?: {
      currentPath: string;
      selectedFiles: Array<{ name: string; path: string; is_dir: boolean }>;
      navigateTo?: (path: string) => void;
    };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal file info used by extension decorators and context menus */
export interface ExtensionFileInfo {
  name: string;
  path: string;
  is_dir: boolean;
}

/** Props passed to panel render functions */
export interface PanelRenderProps {
  currentPath?: string;
  selectedFiles?: unknown[];
  [key: string]: unknown;
}

export interface ExtensionManifest {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  version: string;
  author: string;
  category: string;
  icon?: string;
  permissions?: string[];
  activation_events?: string[];
  main?: string;
  /** SHA-256 hash of the extension bundle for integrity verification */
  checksum?: string;
  /** Ed25519 signature of the checksum, signed by the author's private key */
  signature?: string;
  /** Author's Ed25519 public key (hex-encoded) */
  publicKey?: string;
  /** Whether this extension is verified by the Xplorer team */
  verified?: boolean;
  /** Path or identifier of a WASM backend module for this extension */
  backend?: string;
  /** Whether this extension has a WASM backend */
  has_wasm_backend?: boolean;
  /** Extension IDs this extension depends on */
  dependencies?: string[];
  contributes?: {
    panels?: PanelContribution[];
    commands?: CommandContribution[];
    themes?: string[];
    context_menus?: ContextMenuContribution[];
    keybindings?: KeybindingContribution[];
    editors?: EditorContribution[];
  };
}

export interface EditorContribution {
  id: string;
  extensions: string[];
  priority?: number;
}

export interface PanelContribution {
  id: string;
  title: string;
  location: string;
  icon?: string;
  when?: string;
}

export interface CommandContribution {
  command: string;
  title: string;
  category?: string;
  icon?: string;
}

export interface ContextMenuContribution {
  command: string;
  when?: string;
  group?: string;
}

export interface KeybindingContribution {
  command: string;
  key: string;
  when?: string;
  title?: string;
}

export interface ExtensionPackage {
  manifest: ExtensionManifest;
  path: string;
  is_active: boolean;
  is_installed: boolean;
}

export interface PanelRegistration {
  id: string;
  extensionId: string;
  title: string;
  icon: React.ReactNode;
  location: 'sidebar' | 'bottom' | 'right';
  render: (props: PanelRenderProps) => React.ReactElement;
  isBuiltin: boolean;
}

export interface FileDecoration {
  badge?: string;
  badgeColor?: string;
  tooltip?: string;
  color?: string;
}

export interface FileDecorator {
  extensionId: string;
  decorate(file: ExtensionFileInfo): FileDecoration | null;
}

export interface ContextMenuEntry {
  id: string;
  extensionId: string;
  label: string;
  icon?: string;
  group?: string;
  action: (...args: unknown[]) => void;
}

export interface EditorRegistration {
  id: string;
  extensionId: string;
  extensions: string[]; // file extensions (without dot) this editor handles
  priority: number;
  render: (props: { filePath: string }) => React.ReactElement;
}

export interface TabRegistration {
  id: string;
  extensionId: string;
  title: string;
  icon: React.ReactNode;
  urlScheme?: string;
  render: (props: TabRenderProps) => React.ReactElement;
}

export interface TabRenderProps {
  tabData?: Record<string, unknown>;
  path?: string;
  onNavigate?: (path: string, name: string) => void;
  onFileSelect?: (path: string) => void;
  [key: string]: unknown;
}

export interface NavigationRegistration {
  id: string;
  extensionId: string;
  section: string;
  icon: React.ReactNode;
  updateEvent?: string;
  getEntries: () => Promise<
    Array<{ id: string; label: string; icon?: string; action: () => void }>
  >;
  onManage?: () => Promise<void>;
}

export interface BottomTabRegistration {
  id: string;
  extensionId: string;
  title: string;
  icon: React.ReactNode;
  render: (props: { currentPath?: string; isActive?: boolean }) => React.ReactElement;
}

export interface SidebarTabRegistration {
  id: string;
  extensionId: string;
  title: string;
  icon: React.ReactNode;
  render: (props: { currentPath?: string; isActive?: boolean }) => React.ReactElement;
}

export interface DialogRegistration {
  id: string;
  extensionId: string;
  title: string;
  icon: React.ReactNode;
  render: (props: {
    isOpen: boolean;
    onClose: () => void;
    data: Record<string, unknown>;
  }) => React.ReactElement;
}

export interface PreviewRegistration {
  id: string;
  extensionId: string;
  priority: number;
  canPreview: (file: { name: string; path: string; is_dir: boolean; size?: number }) => boolean;
  render: (props: PreviewRenderProps) => React.ReactElement;
}

export interface PreviewRenderProps {
  filePath: string;
  fileContent: string | null;
  currentPath?: string;
  selectedFiles?: Array<{ name: string; path: string; is_dir: boolean; size?: number }>;
}

/** Result of an extension update check for a single extension */
export interface ExtensionUpdateResult {
  id: string;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  checksum: string;
  changelog: string | null;
}

/** Configuration for extension auto-update behavior */
export interface ExtensionAutoUpdateConfig {
  /** Whether auto-update checking is enabled (default: true) */
  enabled?: boolean;
  /** Marketplace base URL (default: https://localhost:3000) */
  marketplaceUrl?: string;
  /** Interval in ms between update checks (default: 4 hours) */
  checkIntervalMs?: number;
  /** Whether to automatically download updates (default: false) */
  autoDownload?: boolean;
}

export type CommandHandler = (...args: unknown[]) => unknown;
export type EventCallback = (...args: unknown[]) => void;

export interface LoadedExtension {
  id: string;
  manifest: ExtensionManifest;
  isActive: boolean;
  isBuiltin: boolean;
  instance?: unknown;
  /** Source path of the extension bundle (for hot-reload) */
  sourcePath?: string;
  /** Timestamp when the extension was loaded (ms since epoch) */
  loadedAt?: number;
}

// ─── Event Bus ────────────────────────────────────────────────────────────────

export class EventBus {
  private listeners = new Map<string, Set<EventCallback>>();

  on(event: string, callback: EventCallback): { dispose: () => void } {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return {
      dispose: () => {
        this.listeners.get(event)?.delete(callback);
      },
    };
  }

  emit(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(...args);
      } catch (err) {
        console.error(`[ExtensionHost] Event handler error for "${event}":`, err);
      }
    });
  }
}

// ─── Path Validation ────────────────────────────────────────────────────────────

export const isPathAllowed = (path: string, _extensionPath: string): boolean => {
  const normalized = path.replace(/\\/g, '/').toLowerCase();
  const blockedPrefixes = [
    '/etc/',
    '/usr/',
    '/bin/',
    '/sbin/',
    '/boot/',
    '/proc/',
    '/sys/',
    'c:/windows/',
    'c:/program files/',
    'c:/programdata/',
    '/.ssh/',
    '/.gnupg/',
    '/.aws/',
    '/.config/chromium/',
    '/.config/google-chrome/',
    '/appdata/local/google/',
    '/appdata/local/microsoft/',
    '/appdata/roaming/mozilla/',
  ];
  // Also block paths containing '..'
  if (normalized.includes('..')) return false;
  for (const prefix of blockedPrefixes) {
    if (normalized.startsWith(prefix)) return false;
  }
  return true;
};
