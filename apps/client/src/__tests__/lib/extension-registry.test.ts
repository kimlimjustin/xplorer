import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { ExtensionRegistry } from '@/lib/extension-registry';
import type { LoadedExtension, ExtensionManifest } from '@/lib/extension-host-types';

// Mock TauriAPI
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    unregisterExtensionShortcuts: vi.fn(() => Promise.resolve()),
  },
}));

// Mock extension-host-icon
vi.mock('@/lib/extension-host-icon', () => ({
  resolveIcon: (icon?: string) => icon ? React.createElement('span', null, icon) : null,
}));

const makeExtensionsMap = (entries: Array<{ id: string; isActive: boolean }>): Map<string, LoadedExtension> => {
  const map = new Map<string, LoadedExtension>();
  for (const e of entries) {
    map.set(e.id, {
      id: e.id,
      manifest: { id: e.id, name: e.id, version: '1.0.0', author: 'test', category: 'tool' },
      isActive: e.isActive,
      isBuiltin: false,
    });
  }
  return map;
};

const makeManifest = (overrides: Partial<ExtensionManifest> = {}): ExtensionManifest => {
  return {
    id: 'test-ext',
    name: 'Test Extension',
    version: '1.0.0',
    author: 'test',
    category: 'tool',
    ...overrides,
  };
};

describe('ExtensionRegistry', () => {
  let registry: ExtensionRegistry;

  beforeEach(() => {
    registry = new ExtensionRegistry();
    registry.extensions = makeExtensionsMap([{ id: 'test-ext', isActive: true }]);
    registry.notifyChange = vi.fn();
  });

  describe('Panel Registration', () => {
    it('registers a builtin panel', () => {
      const renderFn = () => React.createElement('div', null, 'panel');
      registry.registerBuiltinPanel('test-ext', makeManifest(), {
        name: 'Test Panel',
        icon: React.createElement('span', null, 'icon'),
        render: renderFn,
      });

      expect(registry.panelRegistry.size).toBe(1);
      const panel = registry.panelRegistry.get('test-ext')!;
      expect(panel.title).toBe('Test Panel');
      expect(panel.isBuiltin).toBe(true);
    });

    it('registers panels from manifest', () => {
      const manifest = makeManifest({
        contributes: {
          panels: [
            { id: 'panel-1', title: 'Panel 1', location: 'right', icon: 'FileText' },
            { id: 'panel-2', title: 'Panel 2', location: 'bottom' },
          ],
        },
      });
      registry.registerPanelsFromManifest('test-ext', manifest);

      expect(registry.panelRegistry.size).toBe(2);
      expect(registry.panelRegistry.get('panel-1')!.title).toBe('Panel 1');
      expect(registry.panelRegistry.get('panel-2')!.title).toBe('Panel 2');
    });

    it('does nothing when manifest has no panels', () => {
      registry.registerPanelsFromManifest('test-ext', makeManifest());
      expect(registry.panelRegistry.size).toBe(0);
    });

    it('getRegisteredPanels returns only active extension panels', () => {
      registry.extensions = makeExtensionsMap([
        { id: 'active-ext', isActive: true },
        { id: 'inactive-ext', isActive: false },
      ]);

      const renderFn = () => React.createElement('div');
      registry.registerBuiltinPanel('active-ext', makeManifest({ id: 'active-ext' }), {
        name: 'Active',
        icon: null,
        render: renderFn,
      });
      registry.registerBuiltinPanel('inactive-ext', makeManifest({ id: 'inactive-ext' }), {
        name: 'Inactive',
        icon: null,
        render: renderFn,
      });

      const panels = registry.getRegisteredPanels();
      expect(panels).toHaveLength(1);
      expect(panels[0].title).toBe('Active');
    });

    it('getPanel returns a specific panel', () => {
      registry.registerBuiltinPanel('test-ext', makeManifest(), {
        name: 'My Panel',
        icon: null,
        render: () => React.createElement('div'),
      });

      expect(registry.getPanel('test-ext')?.title).toBe('My Panel');
      expect(registry.getPanel('nonexistent')).toBeUndefined();
    });

    it('updatePanelRenderers updates the render function', () => {
      registry.registerBuiltinPanel('test-ext', makeManifest(), {
        name: 'Panel',
        icon: null,
        render: () => React.createElement('div', null, 'old'),
      });

      const newRender = () => React.createElement('div', null, 'new');
      registry.updatePanelRenderers('test-ext', newRender);

      const panel = registry.panelRegistry.get('test-ext')!;
      const rendered = panel.render({});
      expect(rendered.props.children).toBe('new');
    });
  });

  describe('Editor Registration', () => {
    it('registers editors from instance', () => {
      const manifest = makeManifest({
        contributes: {
          editors: [{ id: 'code-editor', extensions: ['js', 'ts'], priority: 20 }],
        },
      });
      const ext = {
        renderEditor: () => React.createElement('div', null, 'editor'),
      };

      registry.registerFromInstance('test-ext', manifest, ext as unknown);
      expect(registry.editorRegistry.size).toBe(1);
      expect(registry.editorRegistry.get('code-editor')!.extensions).toEqual(['js', 'ts']);
    });

    it('getEditorForFile matches by extension', () => {
      const manifest = makeManifest({
        contributes: {
          editors: [{ id: 'code-editor', extensions: ['js', 'ts'], priority: 20 }],
        },
      });
      registry.registerFromInstance('test-ext', manifest, {
        renderEditor: () => React.createElement('div'),
      } as Record<string, unknown>);

      const editor = registry.getEditorForFile('/home/app.ts');
      expect(editor).toBeDefined();
      expect(editor!.id).toBe('code-editor');
    });

    it('getEditorForFile returns undefined for unmatched extension', () => {
      const manifest = makeManifest({
        contributes: {
          editors: [{ id: 'code-editor', extensions: ['js'], priority: 20 }],
        },
      });
      registry.registerFromInstance('test-ext', manifest, {
        renderEditor: () => React.createElement('div'),
      } as Record<string, unknown>);

      expect(registry.getEditorForFile('/home/file.py')).toBeUndefined();
    });

    it('getEditorForFile picks highest priority editor', () => {
      registry.extensions = makeExtensionsMap([
        { id: 'ext-low', isActive: true },
        { id: 'ext-high', isActive: true },
      ]);

      registry.editorRegistry.set('low-editor', {
        id: 'low-editor',
        extensionId: 'ext-low',
        extensions: ['js'],
        priority: 5,
        render: () => React.createElement('div'),
      });
      registry.editorRegistry.set('high-editor', {
        id: 'high-editor',
        extensionId: 'ext-high',
        extensions: ['js'],
        priority: 20,
        render: () => React.createElement('div'),
      });

      const editor = registry.getEditorForFile('/app.js');
      expect(editor!.id).toBe('high-editor');
    });
  });

  describe('Tab Registration', () => {
    it('registers tabs from instance with getTabConfig + renderTab', () => {
      const ext = {
        getTabConfig: () => ({ id: 'my-tab', title: 'My Tab', urlScheme: 'mytab://' }),
        renderTab: () => React.createElement('div', null, 'tab content'),
      };

      registry.registerFromInstance('test-ext', makeManifest(), ext as unknown);
      expect(registry.tabRegistry.size).toBe(1);
      expect(registry.tabRegistry.get('my-tab')!.title).toBe('My Tab');
    });

    it('getTabRenderer returns render function for active extension', () => {
      registry.tabRegistry.set('custom-tab', {
        id: 'custom-tab',
        extensionId: 'test-ext',
        title: 'Custom',
        icon: null,
        render: () => React.createElement('div', null, 'content'),
      });

      const renderer = registry.getTabRenderer('custom-tab');
      expect(renderer).toBeDefined();
    });

    it('getTabRenderer returns null for inactive extension', () => {
      registry.extensions = makeExtensionsMap([{ id: 'test-ext', isActive: false }]);
      registry.tabRegistry.set('custom-tab', {
        id: 'custom-tab',
        extensionId: 'test-ext',
        title: 'Custom',
        icon: null,
        render: () => React.createElement('div'),
      });

      expect(registry.getTabRenderer('custom-tab')).toBeNull();
    });

    it('getTabRenderer returns null for unknown tab type', () => {
      expect(registry.getTabRenderer('nonexistent')).toBeNull();
    });

    it('getTabIcon returns icon', () => {
      const icon = React.createElement('span', null, 'icon');
      registry.tabRegistry.set('tab-with-icon', {
        id: 'tab-with-icon',
        extensionId: 'test-ext',
        title: 'Tab',
        icon,
        render: () => React.createElement('div'),
      });

      expect(registry.getTabIcon('tab-with-icon')).toBe(icon);
    });

    it('isExtensionScheme checks registered URL schemes', () => {
      registry.tabRegistry.set('gdrive-tab', {
        id: 'gdrive-tab',
        extensionId: 'test-ext',
        title: 'GDrive',
        icon: null,
        urlScheme: 'gdrive://',
        render: () => React.createElement('div'),
      });

      expect(registry.isExtensionScheme('gdrive://root')).toBe(true);
      expect(registry.isExtensionScheme('file:///home')).toBe(false);
    });
  });

  describe('Navigation Registration', () => {
    it('registers navigation entries', () => {
      const ext = {
        getNavigationConfig: () => ({ id: 'nav-1', section: 'Favorites', icon: 'Star' }),
        getEntries: () => Promise.resolve([]),
      };

      registry.registerFromInstance('test-ext', makeManifest(), ext as unknown);
      expect(registry.navigationRegistry.size).toBe(1);
    });

    it('getNavigationEntries returns only active entries', () => {
      registry.navigationRegistry.set('nav-1', {
        id: 'nav-1',
        extensionId: 'test-ext',
        section: 'Favorites',
        icon: null,
        getEntries: () => Promise.resolve([]),
      });

      const entries = registry.getNavigationEntries();
      expect(entries).toHaveLength(1);
    });
  });

  describe('Bottom Tab Registration', () => {
    it('registers bottom tabs from instance', () => {
      const ext = {
        getBottomTabConfig: () => ({ id: 'output', title: 'Output' }),
        renderBottomTab: () => React.createElement('div', null, 'output content'),
      };

      registry.registerFromInstance('test-ext', makeManifest(), ext as unknown);
      expect(registry.bottomTabRegistry.size).toBe(1);
    });

    it('getBottomTabs returns active bottom tabs', () => {
      registry.bottomTabRegistry.set('bt-1', {
        id: 'bt-1',
        extensionId: 'test-ext',
        title: 'Bottom Tab',
        icon: null,
        render: () => React.createElement('div'),
      });

      const tabs = registry.getBottomTabs();
      expect(tabs).toHaveLength(1);
    });

    it('getBottomTabRenderer returns null for unknown tab', () => {
      expect(registry.getBottomTabRenderer('unknown')).toBeNull();
    });
  });

  describe('Command Registration', () => {
    it('registers and executes a command', async () => {
      const handler = vi.fn(() => 'result');
      registry.registerCommand('test.greet', handler);

      const result = await registry.executeCommand('test.greet', 'world');
      expect(handler).toHaveBeenCalledWith('world');
      expect(result).toBe('result');
    });

    it('dispose removes the command', async () => {
      const { dispose } = registry.registerCommand('test.temp', vi.fn());
      dispose();

      await expect(registry.executeCommand('test.temp')).rejects.toThrow('Command "test.temp" not found');
    });

    it('throws for unknown command', async () => {
      await expect(registry.executeCommand('nonexistent')).rejects.toThrow('Command "nonexistent" not found');
    });

    it('propagates handler errors', async () => {
      registry.registerCommand('test.fail', () => {
        throw new Error('handler error');
      });

      await expect(registry.executeCommand('test.fail')).rejects.toThrow('handler error');
    });
  });

  describe('Decorator Registration', () => {
    it('registers and queries decorators', () => {
      registry.registerDecorator({
        extensionId: 'test-ext',
        decorate: (file) => file.name.endsWith('.ts') ? { badge: 'TS', badgeColor: '#3178c6' } : null,
      });

      const decorations = registry.getFileDecorations({ name: 'app.ts', path: '/app.ts', is_dir: false });
      expect(decorations).toHaveLength(1);
      expect(decorations[0].badge).toBe('TS');
    });

    it('returns empty array for non-matching files', () => {
      registry.registerDecorator({
        extensionId: 'test-ext',
        decorate: (file) => file.name.endsWith('.ts') ? { badge: 'TS' } : null,
      });

      const decorations = registry.getFileDecorations({ name: 'file.txt', path: '/file.txt', is_dir: false });
      expect(decorations).toHaveLength(0);
    });

    it('dispose removes the decorator', () => {
      const { dispose } = registry.registerDecorator({
        extensionId: 'test-ext',
        decorate: () => ({ badge: 'X' }),
      });

      dispose();

      const decorations = registry.getFileDecorations({ name: 'file.txt', path: '/file.txt', is_dir: false });
      expect(decorations).toHaveLength(0);
    });

    it('enforces maximum decorator limit', () => {
      // Register up to the maximum (1000)
      for (let i = 0; i < 1000; i++) {
        registry.extensions.set(`ext-${i}`, {
          id: `ext-${i}`,
          manifest: makeManifest({ id: `ext-${i}` }),
          isActive: true,
          isBuiltin: false,
        });
        registry.decoratorRegistry.set(`ext-${i}`, {
          extensionId: `ext-${i}`,
          decorate: () => null,
        });
      }

      // 1001st should be rejected
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      registry.registerDecorator({
        extensionId: 'ext-overflow',
        decorate: () => ({ badge: 'X' }),
      });

      expect(registry.decoratorRegistry.has('ext-overflow')).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('Context Menu Registration', () => {
    it('registers and retrieves context menu items', () => {
      const items = [
        { id: 'item-1', extensionId: 'test-ext', label: 'Do Something', action: vi.fn() },
      ];
      registry.registerContextMenuItems('test-ext', items);

      const result = registry.getContextMenuItems({});
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Do Something');
    });

    it('dispose removes context menu items', () => {
      const { dispose } = registry.registerContextMenuItems('test-ext', [
        { id: 'item-1', extensionId: 'test-ext', label: 'Action', action: vi.fn() },
      ]);
      dispose();

      expect(registry.getContextMenuItems({})).toHaveLength(0);
    });
  });

  describe('Dialog Registration', () => {
    it('hasDialog returns true for registered dialog from active extension', () => {
      registry.dialogRegistry.set('my-dialog', {
        id: 'my-dialog',
        extensionId: 'test-ext',
        title: 'My Dialog',
        icon: null,
        render: () => React.createElement('div'),
      });

      expect(registry.hasDialog('my-dialog')).toBe(true);
      expect(registry.hasDialog('nonexistent')).toBe(false);
    });

    it('openDialog / closeDialog / getOpenDialogs', () => {
      registry.openDialog('dlg-1', { key: 'value' });
      expect(registry.getOpenDialogs().size).toBe(1);
      expect(registry.getOpenDialogs().get('dlg-1')).toEqual({ key: 'value' });

      registry.closeDialog('dlg-1');
      expect(registry.getOpenDialogs().size).toBe(0);
    });

    it('getRegisteredDialogIds returns all registered dialog IDs', () => {
      registry.dialogRegistry.set('dlg-a', {
        id: 'dlg-a', extensionId: 'test-ext', title: 'A', icon: null,
        render: () => React.createElement('div'),
      });
      registry.dialogRegistry.set('dlg-b', {
        id: 'dlg-b', extensionId: 'test-ext', title: 'B', icon: null,
        render: () => React.createElement('div'),
      });

      const ids = registry.getRegisteredDialogIds();
      expect(ids).toContain('dlg-a');
      expect(ids).toContain('dlg-b');
    });
  });

  describe('Preview Registration', () => {
    it('registers preview from instance with category=preview', () => {
      const manifest = makeManifest({ id: 'img-preview', category: 'preview' });
      const ext = {
        canPreview: (file: { name: string }) => file.name.endsWith('.png'),
        render: () => React.createElement('div', null, 'preview'),
        getPriority: () => 50,
      };

      registry.extensions.set('img-preview', {
        id: 'img-preview',
        manifest,
        isActive: true,
        isBuiltin: false,
      });
      registry.registerFromInstance('img-preview', manifest, ext as unknown);

      expect(registry.previewRegistry.size).toBe(1);
    });

    it('queryPreview returns matching preview', () => {
      registry.extensions.set('img-preview', {
        id: 'img-preview',
        manifest: makeManifest({ id: 'img-preview', category: 'preview' }),
        isActive: true,
        isBuiltin: false,
      });
      registry.previewRegistry.set('img-preview', {
        id: 'img-preview',
        extensionId: 'img-preview',
        priority: 10,
        canPreview: (file) => file.name.endsWith('.png'),
        render: () => React.createElement('div'),
      });

      const result = registry.queryPreview({ name: 'photo.png', path: '/photo.png', is_dir: false });
      expect(result).toBeDefined();
      expect(result!.id).toBe('img-preview');
    });

    it('queryPreview returns null when no match', () => {
      registry.extensions.set('img-preview', {
        id: 'img-preview',
        manifest: makeManifest({ id: 'img-preview' }),
        isActive: true,
        isBuiltin: false,
      });
      registry.previewRegistry.set('img-preview', {
        id: 'img-preview',
        extensionId: 'img-preview',
        priority: 10,
        canPreview: (file) => file.name.endsWith('.png'),
        render: () => React.createElement('div'),
      });

      expect(registry.queryPreview({ name: 'file.txt', path: '/file.txt', is_dir: false })).toBeNull();
    });
  });

  describe('cleanupExtension', () => {
    it('removes all registrations for an extension', () => {
      const manifest = makeManifest({
        contributes: {
          panels: [{ id: 'panel-1', title: 'Panel', location: 'right' }],
        },
      });
      registry.registerPanelsFromManifest('test-ext', manifest);
      registry.registerCommand('test-ext.cmd', vi.fn());
      registry.registerContextMenuItems('test-ext', [
        { id: 'cm-1', extensionId: 'test-ext', label: 'Menu', action: vi.fn() },
      ]);
      registry.registerDecorator({
        extensionId: 'test-ext',
        decorate: () => null,
      });

      expect(registry.panelRegistry.size).toBe(1);
      expect(registry.commandRegistry.size).toBe(1);

      registry.cleanupExtension('test-ext');

      expect(registry.panelRegistry.size).toBe(0);
      expect(registry.commandRegistry.size).toBe(0);
      expect(registry.contextMenuEntries.size).toBe(0);
      expect(registry.decoratorRegistry.size).toBe(0);
    });

    it('preserves builtin panels when keepBuiltin=true', () => {
      registry.registerBuiltinPanel('test-ext', makeManifest(), {
        name: 'Builtin',
        icon: null,
        render: () => React.createElement('div'),
      });

      registry.cleanupExtension('test-ext', true);
      expect(registry.panelRegistry.size).toBe(1);
    });

    it('removes builtin panels when keepBuiltin=false', () => {
      registry.registerBuiltinPanel('test-ext', makeManifest(), {
        name: 'Builtin',
        icon: null,
        render: () => React.createElement('div'),
      });

      registry.cleanupExtension('test-ext', false);
      expect(registry.panelRegistry.size).toBe(0);
    });

    it('cleans up namespaced commands', () => {
      registry.registerCommand('test-ext.action1', vi.fn());
      registry.registerCommand('state:test-ext:key1', vi.fn());
      registry.registerCommand('workspace:test-ext:key2', vi.fn());
      registry.registerCommand('other-ext.action', vi.fn());

      registry.cleanupExtension('test-ext');

      expect(registry.commandRegistry.has('test-ext.action1')).toBe(false);
      expect(registry.commandRegistry.has('state:test-ext:key1')).toBe(false);
      expect(registry.commandRegistry.has('workspace:test-ext:key2')).toBe(false);
      expect(registry.commandRegistry.has('other-ext.action')).toBe(true);
    });
  });
});
