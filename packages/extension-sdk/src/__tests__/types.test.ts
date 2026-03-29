/**
 * Tests for the extension SDK type system.
 *
 * These tests verify that type interfaces are structured correctly at runtime
 * by creating conforming objects and verifying their shape.
 */

import type {
  ExtensionManifest,
  ExtensionContext,
  FileEntry,
  Theme,
  ActionMenuItem,
  PreviewProps,
  PanelProps,
  ExtensionLifecycle,
  XplorerAPI,
} from '../types';

// ---------------------------------------------------------------------------
// ExtensionManifest
// ---------------------------------------------------------------------------
describe('ExtensionManifest', () => {
  it('has required fields: id, name, version, author, category', () => {
    const manifest: ExtensionManifest = {
      id: 'test-ext',
      name: 'Test Extension',
      version: '1.0.0',
      author: 'Test',
      category: 'tool',
    };

    expect(manifest.id).toBe('test-ext');
    expect(manifest.name).toBe('Test Extension');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.author).toBe('Test');
    expect(manifest.category).toBe('tool');
  });

  it('accepts theme category', () => {
    const manifest: ExtensionManifest = {
      id: 'my-theme',
      name: 'My Theme',
      version: '1.0.0',
      author: 'Author',
      category: 'theme',
    };
    expect(manifest.category).toBe('theme');
  });

  it('accepts preview category', () => {
    const manifest: ExtensionManifest = {
      id: 'my-preview',
      name: 'My Preview',
      version: '1.0.0',
      author: 'Author',
      category: 'preview',
    };
    expect(manifest.category).toBe('preview');
  });

  it('accepts action category', () => {
    const manifest: ExtensionManifest = {
      id: 'my-action',
      name: 'My Action',
      version: '1.0.0',
      author: 'Author',
      category: 'action',
    };
    expect(manifest.category).toBe('action');
  });

  it('accepts panel category', () => {
    const manifest: ExtensionManifest = {
      id: 'my-panel',
      name: 'My Panel',
      version: '1.0.0',
      author: 'Author',
      category: 'panel',
    };
    expect(manifest.category).toBe('panel');
  });

  it('allows optional displayName (camelCase)', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'tool',
      displayName: 'My Nice Extension',
    };
    expect(manifest.displayName).toBe('My Nice Extension');
  });

  it('allows optional display_name (snake_case)', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'tool',
      display_name: 'My Nice Extension',
    };
    expect(manifest.display_name).toBe('My Nice Extension');
  });

  it('allows both camelCase and snake_case fields simultaneously', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'tool',
      displayName: 'CamelCase Name',
      display_name: 'snake_case_name',
      activationEvents: ['onStartup'],
      activation_events: ['onFileOpen'],
    };
    expect(manifest.displayName).toBe('CamelCase Name');
    expect(manifest.display_name).toBe('snake_case_name');
    expect(manifest.activationEvents).toEqual(['onStartup']);
    expect(manifest.activation_events).toEqual(['onFileOpen']);
  });

  it('allows optional description', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'tool',
      description: 'A test extension',
    };
    expect(manifest.description).toBe('A test extension');
  });

  it('allows optional icon', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'tool',
      icon: 'icon.png',
    };
    expect(manifest.icon).toBe('icon.png');
  });

  it('allows optional keywords array', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'tool',
      keywords: ['file', 'manager', 'utility'],
    };
    expect(manifest.keywords).toEqual(['file', 'manager', 'utility']);
  });

  it('allows optional homepage and repository URLs', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'tool',
      homepage: 'https://example.com',
      repository: 'https://github.com/test/test',
    };
    expect(manifest.homepage).toBe('https://example.com');
    expect(manifest.repository).toBe('https://github.com/test/test');
  });

  it('allows optional license field', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'tool',
      license: 'MIT',
    };
    expect(manifest.license).toBe('MIT');
  });

  it('allows optional dependencies', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'tool',
      dependencies: { lodash: '^4.0.0', react: '^18.0.0' },
    };
    expect(manifest.dependencies).toEqual({ lodash: '^4.0.0', react: '^18.0.0' });
  });

  it('allows permissions as array of strings', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'tool',
      permissions: ['file:read', 'file:write', 'ui:panels', 'ui:notifications'],
    };
    expect(manifest.permissions).toContain('file:read');
    expect(manifest.permissions).toContain('file:write');
    expect(manifest.permissions).toContain('ui:panels');
    expect(manifest.permissions).toContain('ui:notifications');
  });

  it('allows optional main entry point', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'tool',
      main: 'dist/index.js',
    };
    expect(manifest.main).toBe('dist/index.js');
  });

  it('allows optional contributes with panels', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'panel',
      contributes: {
        panels: [
          { id: 'panel-1', title: 'Panel 1', location: 'right', icon: 'chart' },
          { id: 'panel-2', title: 'Panel 2', location: 'bottom' },
        ],
      },
    };
    expect(manifest.contributes!.panels).toHaveLength(2);
    expect(manifest.contributes!.panels![0].location).toBe('right');
  });

  it('allows optional contributes with commands', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'tool',
      contributes: {
        commands: [{ command: 'test.hello', title: 'Hello', category: 'test', icon: 'terminal' }],
      },
    };
    expect(manifest.contributes!.commands![0].command).toBe('test.hello');
  });

  it('allows optional contributes with keybindings', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'tool',
      contributes: {
        keybindings: [
          { command: 'test.hello', key: 'ctrl+shift+h', when: 'editorFocus', title: 'Say Hello' },
        ],
      },
    };
    expect(manifest.contributes!.keybindings![0].key).toBe('ctrl+shift+h');
  });

  it('allows optional contributes with context_menus', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'action',
      contributes: {
        context_menus: [{ command: 'test.ctx', when: 'fileSelected', group: 'tools' }],
      },
    };
    expect(manifest.contributes!.context_menus![0].command).toBe('test.ctx');
  });

  it('allows optional contributes with themes', () => {
    const manifest: ExtensionManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      category: 'theme',
      contributes: {
        themes: ['dark-theme', 'light-theme'],
      },
    };
    expect(manifest.contributes!.themes).toEqual(['dark-theme', 'light-theme']);
  });
});

// ---------------------------------------------------------------------------
// FileEntry
// ---------------------------------------------------------------------------
describe('FileEntry', () => {
  it('has required fields: path, name, size, modified', () => {
    const entry: FileEntry = {
      path: '/home/user/test.txt',
      name: 'test.txt',
      size: 1024,
      modified: Date.now() / 1000,
    };
    expect(entry.path).toBe('/home/user/test.txt');
    expect(entry.name).toBe('test.txt');
    expect(entry.size).toBe(1024);
    expect(typeof entry.modified).toBe('number');
  });

  it('supports is_dir (runtime API) field', () => {
    const dir: FileEntry = {
      path: '/home/user/docs',
      name: 'docs',
      size: 0,
      modified: Date.now() / 1000,
      is_dir: true,
    };
    expect(dir.is_dir).toBe(true);
  });

  it('supports isDirectory (SDK alias) field', () => {
    const dir: FileEntry = {
      path: '/home/user/docs',
      name: 'docs',
      size: 0,
      modified: Date.now() / 1000,
      isDirectory: true,
    };
    expect(dir.isDirectory).toBe(true);
  });

  it('supports modified as Date (SDK compatibility)', () => {
    const d = new Date('2026-01-01');
    const entry: FileEntry = {
      path: '/test.txt',
      name: 'test.txt',
      size: 100,
      modified: d,
    };
    expect(entry.modified).toBe(d);
  });

  it('supports optional extension field', () => {
    const entry: FileEntry = {
      path: '/file.ts',
      name: 'file.ts',
      size: 500,
      modified: 0,
      extension: '.ts',
    };
    expect(entry.extension).toBe('.ts');
  });

  it('supports optional mimeType and mime_type fields', () => {
    const entry: FileEntry = {
      path: '/image.png',
      name: 'image.png',
      size: 50000,
      modified: 0,
      mimeType: 'image/png',
      mime_type: 'image/png',
    };
    expect(entry.mimeType).toBe('image/png');
    expect(entry.mime_type).toBe('image/png');
  });

  it('supports optional file_type field', () => {
    const entry: FileEntry = {
      path: '/script.py',
      name: 'script.py',
      size: 200,
      modified: 0,
      file_type: 'python',
    };
    expect(entry.file_type).toBe('python');
  });

  it('supports optional isHidden field', () => {
    const entry: FileEntry = {
      path: '/home/.bashrc',
      name: '.bashrc',
      size: 300,
      modified: 0,
      isHidden: true,
    };
    expect(entry.isHidden).toBe(true);
  });

  it('supports optional permissions field', () => {
    const entry: FileEntry = {
      path: '/bin/script',
      name: 'script',
      size: 4096,
      modified: 0,
      permissions: 'rwxr-xr-x',
    };
    expect(entry.permissions).toBe('rwxr-xr-x');
  });
});

// ---------------------------------------------------------------------------
// ExtensionContext
// ---------------------------------------------------------------------------
describe('ExtensionContext', () => {
  it('has extensionPath, globalState, workspaceState, subscriptions, asAbsolutePath', () => {
    const ctx: ExtensionContext = {
      extensionPath: '/extensions/my-ext',
      globalState: {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
      },
      workspaceState: {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
      },
      subscriptions: [],
      asAbsolutePath: jest.fn((rel: string) => `/extensions/my-ext/${rel}`),
    };

    expect(ctx.extensionPath).toBe('/extensions/my-ext');
    expect(ctx.subscriptions).toEqual([]);
    expect(ctx.asAbsolutePath('icon.png')).toBe('/extensions/my-ext/icon.png');
  });

  it('subscriptions array accepts disposable objects', () => {
    const ctx: ExtensionContext = {
      extensionPath: '/ext',
      globalState: { get: jest.fn(), set: jest.fn(), delete: jest.fn() },
      workspaceState: { get: jest.fn(), set: jest.fn(), delete: jest.fn() },
      subscriptions: [],
      asAbsolutePath: jest.fn(),
    };

    const disposable = { dispose: jest.fn() };
    ctx.subscriptions.push(disposable);
    expect(ctx.subscriptions).toHaveLength(1);
    expect(ctx.subscriptions[0].dispose).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// XplorerAPI
// ---------------------------------------------------------------------------
describe('XplorerAPI', () => {
  const createApi = (): XplorerAPI => ({
    files: {
      read: jest.fn(),
      readText: jest.fn(),
      write: jest.fn(),
      exists: jest.fn(),
      list: jest.fn(),
      watch: jest.fn(() => ({ dispose: jest.fn() })),
    },
    ui: {
      showMessage: jest.fn(),
      showProgress: jest.fn(),
      showInputBox: jest.fn(),
      showQuickPick: jest.fn(),
    },
    navigation: {
      getCurrentPath: jest.fn(),
      navigateTo: jest.fn(),
      openFile: jest.fn(),
      openInNewTab: jest.fn(),
      openInEditor: jest.fn(),
    },
    settings: {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    },
    commands: {
      register: jest.fn(() => ({ dispose: jest.fn() })),
      execute: jest.fn(),
    },
    shortcuts: {
      register: jest.fn(),
      unregisterAll: jest.fn(),
    },
  });

  it('has files sub-API with read, readText, write, exists, list, watch', () => {
    const api = createApi();
    expect(api.files.read).toBeDefined();
    expect(api.files.readText).toBeDefined();
    expect(api.files.write).toBeDefined();
    expect(api.files.exists).toBeDefined();
    expect(api.files.list).toBeDefined();
    expect(api.files.watch).toBeDefined();
  });

  it('has ui sub-API with showMessage, showProgress, showInputBox, showQuickPick', () => {
    const api = createApi();
    expect(api.ui.showMessage).toBeDefined();
    expect(api.ui.showProgress).toBeDefined();
    expect(api.ui.showInputBox).toBeDefined();
    expect(api.ui.showQuickPick).toBeDefined();
  });

  it('has navigation sub-API with getCurrentPath, navigateTo, openFile, openInNewTab', () => {
    const api = createApi();
    expect(api.navigation.getCurrentPath).toBeDefined();
    expect(api.navigation.navigateTo).toBeDefined();
    expect(api.navigation.openFile).toBeDefined();
    expect(api.navigation.openInNewTab).toBeDefined();
  });

  it('has settings sub-API with get, set, delete', () => {
    const api = createApi();
    expect(api.settings.get).toBeDefined();
    expect(api.settings.set).toBeDefined();
    expect(api.settings.delete).toBeDefined();
  });

  it('has commands sub-API with register and execute', () => {
    const api = createApi();
    expect(api.commands.register).toBeDefined();
    expect(api.commands.execute).toBeDefined();
  });

  it('has shortcuts sub-API with register and unregisterAll', () => {
    const api = createApi();
    expect(api.shortcuts.register).toBeDefined();
    expect(api.shortcuts.unregisterAll).toBeDefined();
  });

  it('watch returns a disposable', () => {
    const api = createApi();
    const watcher = api.files.watch('/test', jest.fn());
    expect(watcher).toHaveProperty('dispose');
    expect(typeof watcher.dispose).toBe('function');
  });

  it('commands.register returns a disposable', () => {
    const api = createApi();
    const disposable = api.commands.register('test.cmd', jest.fn());
    expect(disposable).toHaveProperty('dispose');
    expect(typeof disposable.dispose).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Theme type
// ---------------------------------------------------------------------------
describe('Theme type', () => {
  it('has required fields: name, type, colors', () => {
    const theme: Theme = {
      name: 'My Theme',
      type: 'dark',
      colors: {
        primary: '#7aa2f7',
        secondary: '#9ece6a',
        accent: '#bb9af7',
        background: '#1a1b26',
        surface: '#16161e',
        overlay: '#1e1e2e',
        text: '#c0caf5',
        textSecondary: '#9aa5ce',
        textMuted: '#565f89',
        border: '#333',
        hover: '#1e1e2e',
        selected: '#283457',
        focus: '#7aa2f7',
        success: '#9ece6a',
        warning: '#ff9e64',
        error: '#f7768e',
        info: '#7dcfff',
      },
    };
    expect(theme.name).toBe('My Theme');
    expect(theme.type).toBe('dark');
    expect(theme.colors.primary).toBe('#7aa2f7');
  });

  it('accepts light theme type', () => {
    const theme: Theme = {
      name: 'Light Theme',
      type: 'light',
      colors: {
        primary: '#0060a8',
        secondary: '#1a8c36',
        accent: '#8b5cf6',
        background: '#ffffff',
        surface: '#f5f5f5',
        overlay: '#eeeeee',
        text: '#1a1a1a',
        textSecondary: '#555555',
        textMuted: '#999999',
        border: '#cccccc',
        hover: '#e8e8e8',
        selected: '#d0e0f0',
        focus: '#0060a8',
        success: '#1a8c36',
        warning: '#cc7700',
        error: '#cc0000',
        info: '#0099cc',
      },
    };
    expect(theme.type).toBe('light');
  });

  it('allows optional fileColors in colors', () => {
    const theme: Theme = {
      name: 'Test',
      type: 'dark',
      colors: {
        primary: '#000',
        secondary: '#111',
        accent: '#222',
        background: '#333',
        surface: '#444',
        overlay: '#555',
        text: '#fff',
        textSecondary: '#ccc',
        textMuted: '#999',
        border: '#666',
        hover: '#777',
        selected: '#888',
        focus: '#000',
        success: '#0f0',
        warning: '#ff0',
        error: '#f00',
        info: '#0ff',
        fileColors: {
          folder: '#7aa2f7',
          document: '#c0caf5',
          image: '#9ece6a',
          video: '#ff9e64',
          audio: '#bb9af7',
          archive: '#f7768e',
          code: '#7dcfff',
          executable: '#e0af68',
        },
      },
    };
    expect(theme.colors.fileColors!.folder).toBe('#7aa2f7');
  });

  it('allows optional fonts, spacing, borderRadius, shadows, animations', () => {
    const theme: Theme = {
      name: 'Full',
      type: 'dark',
      colors: {
        primary: '#000',
        secondary: '#111',
        accent: '#222',
        background: '#333',
        surface: '#444',
        overlay: '#555',
        text: '#fff',
        textSecondary: '#ccc',
        textMuted: '#999',
        border: '#666',
        hover: '#777',
        selected: '#888',
        focus: '#000',
        success: '#0f0',
        warning: '#ff0',
        error: '#f00',
        info: '#0ff',
      },
      fonts: { main: 'Inter', mono: 'JetBrains Mono', ui: 'Inter' },
      spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
      borderRadius: { sm: '4px', md: '8px', lg: '12px' },
      shadows: {
        sm: '0 1px 2px rgba(0,0,0,0.1)',
        md: '0 2px 4px rgba(0,0,0,0.2)',
        lg: '0 4px 8px rgba(0,0,0,0.3)',
      },
      animations: {
        duration: { fast: '150ms', normal: '300ms', slow: '500ms' },
        easing: 'ease-in-out',
      },
    };
    expect(theme.fonts!.main).toBe('Inter');
    expect(theme.spacing!.md).toBe('16px');
    expect(theme.borderRadius!.md).toBe('8px');
    expect(theme.shadows!.md).toBe('0 2px 4px rgba(0,0,0,0.2)');
    expect(theme.animations!.easing).toBe('ease-in-out');
  });
});

// ---------------------------------------------------------------------------
// ActionMenuItem
// ---------------------------------------------------------------------------
describe('ActionMenuItem', () => {
  it('has required fields: id, label, action', () => {
    const item: ActionMenuItem = {
      id: 'action-1',
      label: 'Delete Files',
      action: jest.fn(),
    };
    expect(item.id).toBe('action-1');
    expect(item.label).toBe('Delete Files');
    expect(typeof item.action).toBe('function');
  });

  it('allows optional icon, shortcut, group, when', () => {
    const whenFn = jest.fn((files: any[]) => files.length > 0);
    const item: ActionMenuItem = {
      id: 'action-2',
      label: 'Compress',
      icon: 'archive',
      shortcut: 'ctrl+shift+c',
      group: 'tools',
      when: whenFn,
      action: jest.fn(),
    };
    expect(item.icon).toBe('archive');
    expect(item.shortcut).toBe('ctrl+shift+c');
    expect(item.group).toBe('tools');
    expect(item.when).toBe(whenFn);
  });

  it('when function receives file entries', () => {
    const whenFn = jest.fn((files: any[]) => files.some((f: any) => f.name.endsWith('.zip')));
    const item: ActionMenuItem = {
      id: 'extract',
      label: 'Extract',
      when: whenFn,
      action: jest.fn(),
    };

    const files = [
      { path: '/archive.zip', name: 'archive.zip', size: 1024, modified: 0, is_dir: false },
    ];
    expect(item.when!(files as any)).toBe(true);
    expect(whenFn).toHaveBeenCalledWith(files);
  });
});

// ---------------------------------------------------------------------------
// ExtensionLifecycle
// ---------------------------------------------------------------------------
describe('ExtensionLifecycle', () => {
  it('defines activate and deactivate methods', () => {
    const lifecycle: ExtensionLifecycle = {
      activate: jest.fn(),
      deactivate: jest.fn(),
    };
    expect(typeof lifecycle.activate).toBe('function');
    expect(typeof lifecycle.deactivate).toBe('function');
  });

  it('activate can return void', () => {
    const lifecycle: ExtensionLifecycle = {
      activate: () => {},
      deactivate: () => {},
    };
    const result = lifecycle.activate({} as ExtensionContext);
    expect(result).toBeUndefined();
  });

  it('activate can return a Promise', async () => {
    const lifecycle: ExtensionLifecycle = {
      activate: async () => {
        /* async work */
      },
      deactivate: async () => {
        /* async cleanup */
      },
    };
    const result = lifecycle.activate({} as ExtensionContext);
    expect(result).toBeInstanceOf(Promise);
    await result;
  });
});
