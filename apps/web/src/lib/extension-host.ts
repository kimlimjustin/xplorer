// Mock extension-host for web landing page demos

import React from 'react';
import {
  Puzzle,
  Palette,
  Code,
  Eye,
  Search,
  Terminal,
  Database,
  FileText,
  Image,
  Music,
  Video,
  Settings,
  Shield,
  Globe,
  Zap,
  Package,
  Layout,
  Cpu,
  Cloud,
  Bookmark,
  Tag,
  Folder,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  palette: Palette,
  code: Code,
  eye: Eye,
  search: Search,
  terminal: Terminal,
  database: Database,
  file: FileText,
  'file-text': FileText,
  image: Image,
  music: Music,
  video: Video,
  settings: Settings,
  shield: Shield,
  globe: Globe,
  zap: Zap,
  package: Package,
  layout: Layout,
  cpu: Cpu,
  cloud: Cloud,
  bookmark: Bookmark,
  tag: Tag,
  folder: Folder,
  puzzle: Puzzle,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveIcon(icon: unknown): any {
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === 'string' && ICON_MAP[icon.toLowerCase()]) {
    return React.createElement(ICON_MAP[icon.toLowerCase()], { size: 18 });
  }
  return React.createElement(Puzzle, { size: 18 });
}

export interface ExtensionFileInfo {
  name: string;
  path: string;
  is_dir: boolean;
}

export interface PanelRenderProps {
  width: number;
  height: number;
}

export interface ExtensionManifest {
  id: string;
  name: string;
  display_name?: string;
  version: string;
  description: string;
  author: string;
  icon?: string;
  permissions: string[];
  entry_point: string;
  extension_type: string;
}

export interface PanelContribution {
  id: string;
  title: string;
  icon?: string;
}

export interface CommandContribution {
  command: string;
  title: string;
  keybinding?: string;
}

export interface ContextMenuContribution {
  command: string;
  title: string;
  when?: string;
}

export interface KeybindingContribution {
  command: string;
  key: string;
  when?: string;
}

export interface ExtensionPackage {
  manifest: ExtensionManifest;
  code: string;
  basePath: string;
}

export interface PanelRegistration {
  id: string;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: (props: PanelRenderProps) => any;
}

export interface FileDecoration {
  badge?: string;
  color?: string;
  tooltip?: string;
}

export interface FileDecorator {
  decorate: (file: ExtensionFileInfo) => FileDecoration | null;
}

export interface ContextMenuEntry {
  label: string;
  command: string;
  icon?: string;
  when?: string;
}

interface LoadedExtension {
  id: string;
  manifest: ExtensionManifest;
  isActive: boolean;
  isBuiltin: boolean;
}

class ExtensionHost {
  private listeners: Array<() => void> = [];

  registerBuiltinPanel(_config: {
    id: string;
    title: string;
    icon: React.ReactNode;
    render: (props: PanelRenderProps) => React.ReactNode;
  }): void {}

  async loadExtension(_pkg: ExtensionPackage): Promise<void> {}
  async loadInstalledExtensions(): Promise<void> {}
  async activateExtension(_id: string): Promise<void> {}
  async deactivateExtension(_id: string): Promise<void> {}
  async unloadExtension(_id: string): Promise<void> {}
  async reloadExtension(_id: string): Promise<void> {}

  getRegisteredPanels(): PanelRegistration[] {
    return [];
  }
  getPanel(_panelId: string): PanelRegistration | undefined {
    return undefined;
  }

  getAllExtensions(): LoadedExtension[] {
    return [
      {
        id: 'xplorer-code-editor',
        manifest: {
          id: 'xplorer-code-editor',
          name: 'Code Editor',
          display_name: 'Code Editor',
          version: '1.0.0',
          description: 'Edit code with syntax highlighting',
          author: 'Xplorer',
          permissions: ['file:read', 'file:write'],
          entry_point: 'index.js',
          extension_type: 'panel',
          icon: 'code',
        },
        isActive: true,
        isBuiltin: true,
      },
      {
        id: 'xplorer-markdown-preview',
        manifest: {
          id: 'xplorer-markdown-preview',
          name: 'Markdown Preview',
          display_name: 'Markdown Preview',
          version: '1.0.0',
          description: 'Render Markdown files',
          author: 'Xplorer',
          permissions: ['file:read'],
          entry_point: 'index.js',
          extension_type: 'preview',
          icon: 'eye',
        },
        isActive: true,
        isBuiltin: true,
      },
      {
        id: 'xplorer-dracula-theme',
        manifest: {
          id: 'xplorer-dracula-theme',
          name: 'Dracula Theme',
          display_name: 'Dracula Theme',
          version: '1.2.0',
          description: 'Dracula color theme for Xplorer',
          author: 'Community',
          permissions: ['xplorer:themes'],
          entry_point: 'index.js',
          extension_type: 'theme',
          icon: 'palette',
        },
        isActive: false,
        isBuiltin: false,
      },
      {
        id: 'xplorer-file-hasher',
        manifest: {
          id: 'xplorer-file-hasher',
          name: 'File Hasher',
          display_name: 'File Hasher',
          version: '0.8.1',
          description: 'MD5, SHA-256 checksums',
          author: 'Community',
          permissions: ['file:read'],
          entry_point: 'index.js',
          extension_type: 'panel',
          icon: 'shield',
        },
        isActive: false,
        isBuiltin: false,
      },
    ];
  }

  getExtension(id: string): LoadedExtension | undefined {
    return this.getAllExtensions().find((e) => e.id === id);
  }

  isExtensionActive(id: string): boolean {
    return this.getExtension(id)?.isActive ?? false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSidebarTabs(): any[] {
    return [];
  }
  getBottomTabs(): Array<{ id: string; title: string; icon?: React.ReactNode }> {
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSidebarTabRenderer(
    _id: string,
  ): ((props: { currentPath: string; isActive?: boolean }) => any) | null {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryPreview(_file: {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
  }): { render: (props: any) => any } | null {
    return null;
  }
  getBottomTabRenderer(_id: string): unknown {
    return null;
  }
  getEditors(): Array<unknown> {
    return [];
  }
  getLoadedExtensions(): Array<unknown> {
    return this.getAllExtensions();
  }
  getContextMenuItems(_context: {
    file?: ExtensionFileInfo;
    selectedFiles?: unknown;
  }): ContextMenuEntry[] {
    return [];
  }
  getFileDecorations(_file: ExtensionFileInfo): FileDecoration[] {
    return [];
  }

  registerCommand(
    _command: string,
    _handler: (...args: unknown[]) => unknown,
  ): { dispose: () => void } {
    return { dispose: () => {} };
  }
  async executeCommand(_command: string, ..._args: unknown[]): Promise<unknown> {
    return null;
  }
  registerDecorator(_decorator: FileDecorator): { dispose: () => void } {
    return { dispose: () => {} };
  }
  registerContextMenuItems(
    _extensionId: string,
    _items: ContextMenuEntry[],
  ): { dispose: () => void } {
    return { dispose: () => {} };
  }

  onEvent(_event: string, _callback: (...args: unknown[]) => void): { dispose: () => void } {
    return { dispose: () => {} };
  }
  emitEvent(_event: string, ..._args: unknown[]): void {}

  onChange(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

export const extensionHost = new ExtensionHost();
