import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

const {
  mockReadTextFile,
  mockGetInstalledExtensions,
  mockActivateExtension,
  mockDeactivateExtension,
} = vi.hoisted(() => ({
  mockReadTextFile: vi.fn(() => Promise.reject(new Error('file not found'))),
  mockGetInstalledExtensions: vi.fn(() => Promise.resolve([])),
  mockActivateExtension: vi.fn(() => Promise.resolve()),
  mockDeactivateExtension: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    readDirectory: vi.fn(() => Promise.resolve([])),
    readTextFile: mockReadTextFile,
    readBinaryFile: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    fileExists: vi.fn(() => Promise.resolve(false)),
    getInstalledExtensions: mockGetInstalledExtensions,
    activateExtension: mockActivateExtension,
    deactivateExtension: mockDeactivateExtension,
    getExtensionStorage: vi.fn(() => Promise.resolve(null)),
    setExtensionStorage: vi.fn(() => Promise.resolve()),
    deleteExtensionStorage: vi.fn(() => Promise.resolve()),
    nativePluginInvoke: vi.fn(() => Promise.resolve(null)),
    registerExtensionShortcut: vi.fn(() => Promise.resolve()),
    unregisterExtensionShortcuts: vi.fn(() => Promise.resolve()),
    agentWriteFileWithPermission: vi.fn(() => Promise.resolve()),
  },
  FileEntry: {},
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock('@/lib/extension-sandbox', () => ({
  hardenGlobals: vi.fn(),
  verifyExtensionIntegrity: vi.fn(() => Promise.resolve({ valid: true, reason: 'no-checksum' })),
  executeSandboxed: vi.fn((code: string) => {
    try {
      new Function(code)();
    } catch {
      /* sandboxed execution may fail */
    }
  }),
  createExtensionApi: vi.fn(() => ({})),
  requestPermissionApproval: vi.fn(() => Promise.resolve(true)),
  logPermissionViolation: vi.fn(),
}));

vi.mock('lucide-react', () => {
  const icon = () => null;
  return {
    Puzzle: icon,
    Palette: icon,
    Code: icon,
    Eye: icon,
    Search: icon,
    Terminal: icon,
    Database: icon,
    FileText: icon,
    Image: icon,
    Music: icon,
    Video: icon,
    Settings: icon,
    Shield: icon,
    Globe: icon,
    Zap: icon,
    Package: icon,
    Layout: icon,
    Cpu: icon,
    Cloud: icon,
    Bookmark: icon,
    Tag: icon,
    Folder: icon,
    GitBranch: icon,
    GitCommit: icon,
  };
});

import { extensionHost, type ExtensionPackage } from '@/lib/extension-host';

const createTestPackage = (
  overrides: Partial<ExtensionPackage['manifest']> & { path?: string; is_active?: boolean } = {},
): ExtensionPackage => {
  const { path: pkgPath, is_active, ...manifestOverrides } = overrides;
  const id =
    manifestOverrides.id || `test-ext-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    manifest: {
      id,
      name: manifestOverrides.name || 'Test Extension',
      version: manifestOverrides.version || '1.0.0',
      author: manifestOverrides.author || 'Test Author',
      category: manifestOverrides.category || 'utility',
      ...manifestOverrides,
    },
    path: pkgPath || '/extensions/test-ext',
    is_active: is_active ?? false,
    is_installed: true,
  };
};

describe('Extension Loading Integration', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    warnSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('Extension Load Lifecycle', () => {
    it('loads an extension and registers it in the extensions map', async () => {
      const bundleCode = `
        window.__xplorer_register__({
          manifest: { id: 'lifecycle-load', name: 'Lifecycle Test', version: '1.0.0', author: 'Test', category: 'utility' },
          activate() {},
          deactivate() {},
        });
      `;
      mockReadTextFile.mockResolvedValueOnce(bundleCode);

      const pkg = createTestPackage({
        id: 'lifecycle-load',
        name: 'Lifecycle Test',
        path: '/extensions/lifecycle-load',
      });
      await extensionHost.loadExtension(pkg);

      const ext = extensionHost.getExtension('lifecycle-load');
      expect(ext).toBeDefined();
      expect(ext!.manifest.id).toBe('lifecycle-load');
      expect(ext!.manifest.name).toBe('Lifecycle Test');
    });

    it('skips re-loading an already loaded extension', async () => {
      const bundleCode = `
        window.__xplorer_register__({
          manifest: { id: 'skip-reload', name: 'Skip Reload', version: '1.0.0', author: 'Test', category: 'utility' },
          activate() {},
          deactivate() {},
        });
      `;
      mockReadTextFile.mockResolvedValue(bundleCode);

      const pkg = createTestPackage({ id: 'skip-reload', path: '/extensions/skip-reload' });
      await extensionHost.loadExtension(pkg);
      mockReadTextFile.mockClear();
      await extensionHost.loadExtension(pkg);

      expect(mockReadTextFile).not.toHaveBeenCalled();
    });

    it('activates an extension and marks it as active', async () => {
      const bundleCode = `
        window.__xplorer_register__({
          manifest: { id: 'act-test', name: 'Activate Test', version: '1.0.0', author: 'Test', category: 'utility' },
          activate() {},
          deactivate() {},
        });
      `;
      mockReadTextFile.mockResolvedValueOnce(bundleCode);

      const pkg = createTestPackage({
        id: 'act-test',
        name: 'Activate Test',
        path: '/extensions/act-test',
      });
      await extensionHost.loadExtension(pkg);

      expect(extensionHost.isExtensionActive('act-test')).toBe(false);
      await extensionHost.activateExtension('act-test');
      expect(extensionHost.isExtensionActive('act-test')).toBe(true);
    });

    it('deactivates an active extension', async () => {
      const bundleCode = `
        window.__xplorer_register__({
          manifest: { id: 'deact-test', name: 'Deactivate Test', version: '1.0.0', author: 'Test', category: 'utility' },
          activate() {},
          deactivate() {},
        });
      `;
      mockReadTextFile.mockResolvedValueOnce(bundleCode);

      const pkg = createTestPackage({ id: 'deact-test', path: '/extensions/deact-test' });
      await extensionHost.loadExtension(pkg);
      await extensionHost.activateExtension('deact-test');
      expect(extensionHost.isExtensionActive('deact-test')).toBe(true);

      await extensionHost.deactivateExtension('deact-test');
      expect(extensionHost.isExtensionActive('deact-test')).toBe(false);
    });

    it('handles extension bundle that fails to read gracefully', async () => {
      mockReadTextFile.mockRejectedValueOnce(new Error('ENOENT'));

      const pkg = createTestPackage({ id: 'missing-bundle', path: '/extensions/missing' });
      await extensionHost.loadExtension(pkg);

      const ext = extensionHost.getExtension('missing-bundle');
      expect(ext).toBeDefined();
      expect(ext!.isActive).toBe(false);
      expect(ext!.instance).toBeUndefined();
    });
  });

  describe('Sidebar Panel Registration', () => {
    it('registers a builtin panel that appears in the panel list', () => {
      const panelId = `test-sidebar-panel-${Date.now()}`;
      extensionHost.registerBuiltinPanel({
        id: panelId,
        name: 'Test Sidebar Panel',
        description: 'A test panel',
        icon: React.createElement('span', null, 'T'),
        location: 'sidebar',
        render: () => React.createElement('div', null, 'Panel Content'),
      });

      const panels = extensionHost.getRegisteredPanels();
      const found = panels.find((p) => p.id === panelId);
      expect(found).toBeDefined();
      expect(found!.title).toBe('Test Sidebar Panel');
      expect(found!.location).toBe('sidebar');
      expect(found!.isBuiltin).toBe(true);
    });

    it('renders a registered builtin panel', () => {
      const panelId = `render-panel-${Date.now()}`;
      extensionHost.registerBuiltinPanel({
        id: panelId,
        name: 'Renderable Panel',
        icon: React.createElement('span', null, 'R'),
        render: (props) =>
          React.createElement(
            'div',
            { 'data-testid': 'rendered-panel' },
            `Path: ${props.currentPath}`,
          ),
      });

      const panel = extensionHost.getPanel(panelId);
      expect(panel).toBeDefined();

      const element = panel!.render({ currentPath: '/test/path' });
      expect(element.props['data-testid']).toBe('rendered-panel');
      expect(element.props.children).toBe('Path: /test/path');
    });

    it('registers a panel with a manifest contributes section', async () => {
      const extId = `panel-contrib-${Date.now()}`;
      const bundleCode = `
        window.__xplorer_register__({
          manifest: {
            id: '${extId}',
            name: 'Panel Contrib',
            version: '1.0.0',
            author: 'Test',
            category: 'panel',
            contributes: {
              panels: [{ id: '${extId}-panel', title: 'Contributed Panel', location: 'right', icon: 'FileText' }]
            }
          },
          activate() {},
          deactivate() {},
        });
      `;
      mockReadTextFile.mockResolvedValueOnce(bundleCode);

      const pkg = createTestPackage({
        id: extId,
        name: 'Panel Contrib',
        category: 'panel',
        path: '/extensions/panel-contrib',
        contributes: {
          panels: [
            {
              id: `${extId}-panel`,
              title: 'Contributed Panel',
              location: 'right',
              icon: 'FileText',
            },
          ],
        },
      });
      await extensionHost.loadExtension(pkg);
      await extensionHost.activateExtension(extId);

      const panel = extensionHost.getPanel(`${extId}-panel`);
      expect(panel).toBeDefined();
      expect(panel!.title).toBe('Contributed Panel');
    });
  });

  describe('Command Registration', () => {
    it('registers and executes a command', async () => {
      const handler = vi.fn().mockReturnValue('command result');
      const cmdId = `test.command.${Date.now()}`;

      const { dispose } = extensionHost.registerCommand(cmdId, handler);

      const result = await extensionHost.executeCommand(cmdId, 'arg1', 'arg2');
      expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe('command result');

      dispose();
    });

    it('disposes a registered command so it no longer executes', async () => {
      const handler = vi.fn();
      const cmdId = `disposable.cmd.${Date.now()}`;

      const { dispose } = extensionHost.registerCommand(cmdId, handler);
      dispose();

      await expect(extensionHost.executeCommand(cmdId)).rejects.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });

    it('handles async command handlers', async () => {
      const cmdId = `async.cmd.${Date.now()}`;
      const handler = vi.fn().mockResolvedValue({ status: 'ok' });

      extensionHost.registerCommand(cmdId, handler);

      const result = await extensionHost.executeCommand(cmdId);
      expect(result).toEqual({ status: 'ok' });
    });
  });

  describe('Preview / Editor Registration', () => {
    it('registers an editor and matches it to file extensions', async () => {
      const extId = `editor-ext-${Date.now()}`;
      const bundleCode = `
        window.__xplorer_register__({
          manifest: {
            id: '${extId}',
            name: 'Editor Extension',
            version: '1.0.0',
            author: 'Test',
            category: 'editor',
            contributes: {
              editors: [{ id: '${extId}-editor', extensions: ['xyz', 'abc'] }]
            }
          },
          activate() {},
          deactivate() {},
          renderEditor(props) {
            return { type: 'div', props: { children: 'Editor for ' + props.filePath } };
          }
        });
      `;
      mockReadTextFile.mockResolvedValueOnce(bundleCode);

      const pkg = createTestPackage({
        id: extId,
        name: 'Editor Extension',
        category: 'editor',
        path: '/extensions/editor-ext',
        contributes: {
          editors: [{ id: `${extId}-editor`, extensions: ['xyz', 'abc'] }],
        },
      });
      await extensionHost.loadExtension(pkg);
      await extensionHost.activateExtension(extId);

      const editor = extensionHost.getEditorForFile('/some/file.xyz');
      expect(editor).toBeDefined();
      expect(editor!.extensions).toContain('xyz');
    });

    it('returns undefined for files with no matching editor', () => {
      const editor = extensionHost.getEditorForFile('/some/file.unknown-extension-xyz');
      expect(editor).toBeUndefined();
    });
  });

  describe('Extension Events', () => {
    it('subscribes to and receives events', () => {
      const callback = vi.fn();
      const eventName = `test.event.${Date.now()}`;

      const { dispose } = extensionHost.onEvent(eventName, callback);
      extensionHost.emitEvent(eventName, 'payload1', 'payload2');

      expect(callback).toHaveBeenCalledWith('payload1', 'payload2');

      dispose();
      extensionHost.emitEvent(eventName, 'should-not-receive');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('notifies change listeners when extensions change', () => {
      const changeListener = vi.fn();
      const unsubscribe = extensionHost.onChange(changeListener);

      const panelId = `change-notify-${Date.now()}`;
      extensionHost.registerBuiltinPanel({
        id: panelId,
        name: 'Change Notify Panel',
        icon: React.createElement('span', null, 'C'),
        render: () => React.createElement('div', null, 'Content'),
      });

      expect(changeListener).toHaveBeenCalled();

      unsubscribe();
      changeListener.mockClear();

      extensionHost.registerBuiltinPanel({
        id: `${panelId}-2`,
        name: 'Another Panel',
        icon: React.createElement('span', null, 'A'),
        render: () => React.createElement('div', null, 'Content'),
      });

      expect(changeListener).not.toHaveBeenCalled();
    });
  });

  describe('Context Menu Registration', () => {
    it('registers context menu items from an extension', () => {
      const extId = `ctx-menu-ext-${Date.now()}`;
      extensionHost.registerBuiltinPanel({
        id: extId,
        name: 'CTX Menu Extension',
        icon: React.createElement('span', null, 'M'),
        render: () => React.createElement('div', null, 'Content'),
      });

      const actionFn = vi.fn();
      const { dispose } = extensionHost.registerContextMenuItems(extId, [
        { id: 'test-action', extensionId: extId, label: 'Test Action', action: actionFn },
      ]);

      const items = extensionHost.getContextMenuItems({});
      const found = items.find((item) => item.id === 'test-action');
      expect(found).toBeDefined();
      expect(found!.label).toBe('Test Action');

      found!.action();
      expect(actionFn).toHaveBeenCalled();

      dispose();
    });
  });

  describe('File Decorators', () => {
    it('registers a decorator and retrieves file decorations', () => {
      const extId = `decorator-ext-${Date.now()}`;
      extensionHost.registerBuiltinPanel({
        id: extId,
        name: 'Decorator Extension',
        icon: React.createElement('span', null, 'D'),
        render: () => React.createElement('div', null, 'Content'),
      });

      extensionHost.registerDecorator({
        extensionId: extId,
        decorate: (file) => {
          if (file.name.endsWith('.ts')) {
            return { badge: 'TS', badgeColor: '#3178c6', tooltip: 'TypeScript file' };
          }
          return null;
        },
      });

      const decorations = extensionHost.getFileDecorations({
        name: 'index.ts',
        path: '/src/index.ts',
        is_dir: false,
      });
      expect(decorations.length).toBeGreaterThanOrEqual(1);
      const tsDecoration = decorations.find((d) => d.badge === 'TS');
      expect(tsDecoration).toBeDefined();
      expect(tsDecoration!.badgeColor).toBe('#3178c6');

      const noDecorations = extensionHost.getFileDecorations({
        name: 'readme.md',
        path: '/readme.md',
        is_dir: false,
      });
      const tsOnly = noDecorations.filter((d) => d.badge === 'TS');
      expect(tsOnly.length).toBe(0);
    });
  });
});
