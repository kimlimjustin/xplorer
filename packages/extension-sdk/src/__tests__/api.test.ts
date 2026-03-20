/**
 * Tests for the high-level extension registration APIs:
 *   Theme, Sidebar, Command, ContextMenu, Preview
 *
 * These APIs call `window.__xplorer_register__()` internally, so we mock that
 * global to capture the extension objects they produce. Then we invoke the
 * lifecycle methods (activate / deactivate) to verify DOM side-effects.
 */

import { Theme, Sidebar, Command, ContextMenu, Preview } from '../api';
import type { XplorerAPI } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Capture the object passed to `window.__xplorer_register__`. */
const captureRegistration = <T = unknown>(fn: () => void): T => {
  let captured: T | undefined;
  (window as any).__xplorer_register__ = (ext: T) => {
    captured = ext;
  };
  fn();
  delete (window as any).__xplorer_register__;
  return captured as T;
};

/** Minimal mock of XplorerAPI with spies for the parts the SDK uses. */
const createMockApi = (): XplorerAPI => ({
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
      getCurrentPath: jest.fn(() => '/home'),
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

// ─── Theme API ──────────────────────────────────────────────────────────────

describe('Theme API', () => {
  const validColors = {
    bg: '#1a1b26',
    surface: '#16161e',
    surfaceLight: '#1e1e2e',
    border: '#333',
    text: '#c0caf5',
    textMuted: '#888',
    blue: '#7aa2f7',
    green: '#9ece6a',
    orange: '#ff9e64',
    pink: '#f7768e',
    red: '#f7768e',
    yellow: '#e0af68',
    cyan: '#7dcfff',
    purple: '#bb9af7',
  };

  beforeEach(() => {
    // Clean up any style elements added by previous tests
    document.head.innerHTML = '';
    document.documentElement.className = '';
  });

  it('registers a theme and injects a <style> element on activate', () => {
    const ext = captureRegistration<Function>(() => {
      Theme.register({ id: 'test-theme', name: 'Test Theme', colors: validColors });
    });

    // The register callback receives an api and returns { activate, deactivate }
    const instance = ext(createMockApi());
    instance.activate();

    const style = document.getElementById('theme-test-theme') as HTMLStyleElement;
    expect(style).not.toBeNull();
    expect(style.textContent).toContain('--xp-bg: #1a1b26');
    expect(style.textContent).toContain('--xp-blue: #7aa2f7');
    expect(style.textContent).toContain('.theme-test-theme');
  });

  it('removes the <style> element on deactivate', () => {
    const ext = captureRegistration<Function>(() => {
      Theme.register({ id: 'removable-theme', name: 'Removable', colors: validColors });
    });

    const instance = ext(createMockApi());
    instance.activate();
    expect(document.getElementById('theme-removable-theme')).not.toBeNull();

    instance.deactivate();
    expect(document.getElementById('theme-removable-theme')).toBeNull();
  });

  it('dispatches xplorer-theme-register event on activate', () => {
    const handler = jest.fn();
    window.addEventListener('xplorer-theme-register', handler);

    const ext = captureRegistration<Function>(() => {
      Theme.register({ id: 'event-theme', name: 'Event Theme', colors: validColors });
    });

    ext(createMockApi()).activate();

    expect(handler).toHaveBeenCalledTimes(1);
    const detail = handler.mock.calls[0][0].detail;
    expect(detail.id).toBe('event-theme');
    expect(detail.name).toBe('Event Theme');
    expect(detail.primary).toBe('#7aa2f7');

    window.removeEventListener('xplorer-theme-register', handler);
  });

  it('dispatches xplorer-theme-unregister event on deactivate', () => {
    const handler = jest.fn();
    window.addEventListener('xplorer-theme-unregister', handler);

    const ext = captureRegistration<Function>(() => {
      Theme.register({ id: 'unreg-theme', name: 'Unreg', colors: validColors });
    });

    const instance = ext(createMockApi());
    instance.activate();
    instance.deactivate();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.id).toBe('unreg-theme');

    window.removeEventListener('xplorer-theme-unregister', handler);
  });

  it('applies optional background override in generated CSS', () => {
    // Note: The SDK's isValidCssColor only allows simple color values,
    // not complex values like linear-gradient(). Use a valid simple color.
    const ext = captureRegistration<Function>(() => {
      Theme.register({
        id: 'bg-theme',
        name: 'BG',
        colors: validColors,
        background: '#0a0a1a',
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-bg-theme') as HTMLStyleElement;
    // The background override should appear in the html.theme-* rule
    expect(style.textContent).toContain('background: #0a0a1a');
    // The default --xp-bg is also #1a1b26 (from colors.bg), so verify the
    // html background specifically uses the override value
    expect(style.textContent).toMatch(/html\.theme-bg-theme\s*\{[^}]*background:\s*#0a0a1a/);
  });

  // ── CSS Sanitization ────────────────────────────────────────────────────

  it('sanitizes custom CSS - strips @import', () => {
    const ext = captureRegistration<Function>(() => {
      Theme.register({
        id: 'sanitize-import',
        name: 'Sanitize',
        colors: validColors,
        css: '@import url("https://evil.com/payload.css"); .foo { color: red; }',
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-sanitize-import') as HTMLStyleElement;
    // The raw @import directive should be replaced — only the blocked comment should remain
    expect(style.textContent).not.toMatch(/@import\s+url/);
    expect(style.textContent).toContain('/* @import blocked */');
    expect(style.textContent).toContain('.foo');
  });

  it('sanitizes custom CSS - strips url() calls', () => {
    const ext = captureRegistration<Function>(() => {
      Theme.register({
        id: 'sanitize-url',
        name: 'Sanitize URL',
        colors: validColors,
        css: '.bar { background: url("https://evil.com/tracker.gif"); }',
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-sanitize-url') as HTMLStyleElement;
    // The original url("...") call should be gone; only the sanitized comment remains
    expect(style.textContent).not.toContain('https://evil.com/tracker.gif');
    expect(style.textContent).toContain('/* url() blocked */');
  });

  it('sanitizes custom CSS - strips expression() calls', () => {
    const ext = captureRegistration<Function>(() => {
      Theme.register({
        id: 'sanitize-expr',
        name: 'Sanitize Expr',
        colors: validColors,
        css: '.baz { width: expression(document.body.clientWidth); }',
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-sanitize-expr') as HTMLStyleElement;
    expect(style.textContent).toContain('/* expression() blocked */');
  });

  it('sanitizes custom CSS - strips @font-face', () => {
    const ext = captureRegistration<Function>(() => {
      Theme.register({
        id: 'sanitize-font',
        name: 'Sanitize Font',
        colors: validColors,
        css: '@font-face { font-family: evil; src: url("evil.woff"); } .ok { color: blue; }',
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-sanitize-font') as HTMLStyleElement;
    expect(style.textContent).toContain('/* @font-face blocked */');
    expect(style.textContent).toContain('.ok');
  });

  it('sanitizes custom CSS - strips behavior: and -moz-binding:', () => {
    const ext = captureRegistration<Function>(() => {
      Theme.register({
        id: 'sanitize-behavior',
        name: 'Sanitize Behavior',
        colors: validColors,
        css: '.x { behavior: url(xss.htc); -moz-binding: url(xbl.xml); }',
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-sanitize-behavior') as HTMLStyleElement;
    expect(style.textContent).toContain('/* behavior blocked */');
    expect(style.textContent).toContain('/* -moz-binding blocked */');
  });

  // ── Color validation ──────────────────────────────────────────────────

  it('rejects invalid CSS color values with injection characters', () => {
    expect(() => {
      Theme.register({
        id: 'bad-color',
        name: 'Bad',
        colors: { ...validColors, bg: '#000; } body { display:none; } .x {' },
      });
    }).toThrow(/Invalid CSS color/);
  });

  it('rejects color values containing url()', () => {
    expect(() => {
      Theme.register({
        id: 'url-color',
        name: 'URL',
        colors: { ...validColors, text: 'url(https://evil.com)' },
      });
    }).toThrow(/Invalid CSS color/);
  });

  it('rejects invalid background value', () => {
    expect(() => {
      Theme.register({
        id: 'bad-bg',
        name: 'BadBG',
        colors: validColors,
        background: 'url(https://evil.com/bg.png)',
      });
    }).toThrow(/Invalid CSS background/);
  });

  it('accepts valid named colors', () => {
    expect(() => {
      Theme.register({
        id: 'named-colors',
        name: 'Named',
        colors: {
          ...validColors,
          bg: 'black',
          text: 'white',
          blue: 'dodgerblue',
        },
      });
    }).not.toThrow();
  });

  it('accepts rgba() color values', () => {
    expect(() => {
      Theme.register({
        id: 'rgba-theme',
        name: 'RGBA',
        colors: {
          ...validColors,
          bg: 'rgba(0, 0, 0, 0.9)',
          surface: 'rgb(30, 30, 46)',
        },
      });
    }).not.toThrow();
  });

  it('uses fallbacks for optional color fields', () => {
    const ext = captureRegistration<Function>(() => {
      Theme.register({ id: 'fallback-theme', name: 'Fallback', colors: validColors });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-fallback-theme') as HTMLStyleElement;
    // borderLight defaults to border, blueDark defaults to blue, etc.
    expect(style.textContent).toContain(`--xp-border-light: ${validColors.border}`);
    expect(style.textContent).toContain(`--xp-blue-dark: ${validColors.blue}`);
    expect(style.textContent).toContain(`--xp-text-secondary: ${validColors.textMuted}`);
  });
});

// ─── Command API ────────────────────────────────────────────────────────────

describe('Command API', () => {
  it('registers a command via the host register function', () => {
    const ext = captureRegistration<any>(() => {
      Command.register({
        id: 'test-cmd',
        title: 'Test Command',
        action: jest.fn(),
      });
    });

    expect(ext).toBeDefined();
    expect(ext.manifest.id).toBe('test-cmd');
    expect(ext.manifest.name).toBe('Test Command');
    expect(ext.manifest.category).toBe('tool');
  });

  it('calls api.commands.register on activate', async () => {
    const api = createMockApi();
    const action = jest.fn();

    const ext = captureRegistration<any>(() => {
      Command.register({ id: 'cmd-activate', title: 'Cmd', action });
    });

    ext._setContext({}, api);
    await ext.activate();

    expect(api.commands.register).toHaveBeenCalledWith('cmd-activate', expect.any(Function));
  });

  it('wraps action errors in try-catch (no uncaught error)', async () => {
    const api = createMockApi();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const throwingAction = jest.fn(() => {
      throw new Error('boom');
    });

    const ext = captureRegistration<any>(() => {
      Command.register({ id: 'cmd-err', title: 'Err', action: throwingAction });
    });

    ext._setContext({}, api);
    await ext.activate();

    // Get the wrapped callback that was registered
    const wrappedCallback = (api.commands.register as jest.Mock).mock.calls[0][1];

    // This should not throw even though the action throws
    await expect(wrappedCallback()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Command action failed'),
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  it('registers keyboard shortcut if provided', async () => {
    const api = createMockApi();

    const ext = captureRegistration<any>(() => {
      Command.register({
        id: 'cmd-shortcut',
        title: 'Shortcut Cmd',
        shortcut: 'ctrl+shift+w',
        action: jest.fn(),
      });
    });

    ext._setContext({}, api);
    await ext.activate();

    expect(api.shortcuts.register).toHaveBeenCalledWith('cmd-shortcut', {
      key: 'ctrl+shift+w',
      title: 'Shortcut Cmd',
    });
  });

  it('disposes all commands on deactivate', async () => {
    const disposeFn = jest.fn();
    const api = createMockApi();
    (api.commands.register as jest.Mock).mockReturnValue({ dispose: disposeFn });

    const ext = captureRegistration<any>(() => {
      Command.register({ id: 'cmd-dispose', title: 'Dispose', action: jest.fn() });
    });

    ext._setContext({}, api);
    await ext.activate();
    await ext.deactivate();

    expect(disposeFn).toHaveBeenCalledTimes(1);
  });

  it('handles missing shortcut registration gracefully', async () => {
    const api = createMockApi();
    (api.shortcuts.register as jest.Mock).mockRejectedValue(new Error('not available'));

    const ext = captureRegistration<any>(() => {
      Command.register({
        id: 'cmd-no-shortcut',
        title: 'No Shortcut',
        shortcut: 'ctrl+q',
        action: jest.fn(),
      });
    });

    ext._setContext({}, api);

    // Should not throw even though shortcuts.register rejects
    await expect(ext.activate()).resolves.toBeUndefined();
  });
});

// ─── Sidebar API ────────────────────────────────────────────────────────────

describe('Sidebar API', () => {
  it('registers a sidebar panel with correct manifest', () => {
    const renderFn = jest.fn(() => null);

    const ext = captureRegistration<any>(() => {
      Sidebar.register({
        id: 'test-panel',
        title: 'Test Panel',
        description: 'A test panel',
        icon: 'chart',
        render: renderFn,
      });
    });

    expect(ext).toBeDefined();
    expect(ext.manifest.id).toBe('test-panel');
    expect(ext.manifest.name).toBe('Test Panel');
    expect(ext.manifest.category).toBe('panel');
    expect(ext.manifest.description).toBe('A test panel');
    expect(ext.manifest.contributes.panels).toEqual([
      { id: 'test-panel', title: 'Test Panel', location: 'right', icon: 'chart' },
    ]);
  });

  it('calls render function with props', () => {
    const renderFn = jest.fn(() => 'rendered');

    const ext = captureRegistration<any>(() => {
      Sidebar.register({ id: 'render-panel', title: 'Render', render: renderFn });
    });

    const props = { currentPath: '/home', selectedFiles: [] };
    const result = ext.render(props);

    expect(renderFn).toHaveBeenCalledWith(props);
    expect(result).toBe('rendered');
  });

  it('calls onActivate callback with api', async () => {
    const api = createMockApi();
    const onActivate = jest.fn();

    const ext = captureRegistration<any>(() => {
      Sidebar.register({
        id: 'activate-panel',
        title: 'Activate',
        render: jest.fn(),
        onActivate,
      });
    });

    ext._setContext({}, api);
    await ext.activate();

    expect(onActivate).toHaveBeenCalledWith(api);
  });

  it('calls onDeactivate callback', async () => {
    const onDeactivate = jest.fn();

    const ext = captureRegistration<any>(() => {
      Sidebar.register({
        id: 'deactivate-panel',
        title: 'Deactivate',
        render: jest.fn(),
        onDeactivate,
      });
    });

    ext._setContext({}, createMockApi());
    await ext.deactivate();

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it('defaults location to right', () => {
    const ext = captureRegistration<any>(() => {
      Sidebar.register({ id: 'loc-panel', title: 'Loc', render: jest.fn() });
    });

    expect(ext.manifest.contributes.panels[0].location).toBe('right');
  });

  it('respects custom location', () => {
    const ext = captureRegistration<any>(() => {
      Sidebar.register({
        id: 'bottom-panel',
        title: 'Bottom',
        location: 'bottom',
        render: jest.fn(),
      });
    });

    expect(ext.manifest.contributes.panels[0].location).toBe('bottom');
  });

  it('defaults permissions to ui:panels', () => {
    const ext = captureRegistration<any>(() => {
      Sidebar.register({ id: 'perm-panel', title: 'Perm', render: jest.fn() });
    });

    expect(ext.manifest.permissions).toEqual(['ui:panels']);
  });
});

// ─── ContextMenu API ────────────────────────────────────────────────────────

describe('ContextMenu API', () => {
  it('registers a context menu item with correct manifest', () => {
    const ext = captureRegistration<any>(() => {
      ContextMenu.register({
        id: 'ctx-test',
        title: 'Test Menu',
        action: jest.fn(),
      });
    });

    expect(ext.manifest.id).toBe('ctx-test');
    expect(ext.manifest.category).toBe('action');
    expect(ext.manifest.permissions).toEqual(['file:read', 'ui:notifications']);
  });

  it('reads selected files from __xplorer_state__ when invoked', async () => {
    const api = createMockApi();
    const action = jest.fn();

    const ext = captureRegistration<any>(() => {
      ContextMenu.register({ id: 'ctx-files', title: 'Files', action });
    });

    // Set up the global state
    (window as any).__xplorer_state__ = {
      selectedFiles: [{ name: 'test.txt', path: '/test.txt', is_dir: false }],
    };

    ext._setContext({}, api);
    await ext.activate();

    const wrappedCallback = (api.commands.register as jest.Mock).mock.calls[0][1];
    await wrappedCallback();

    expect(action).toHaveBeenCalledWith(
      [{ name: 'test.txt', path: '/test.txt', is_dir: false }],
      api,
    );

    delete (window as any).__xplorer_state__;
  });

  it('passes empty array when no files are selected', async () => {
    const api = createMockApi();
    const action = jest.fn();

    const ext = captureRegistration<any>(() => {
      ContextMenu.register({ id: 'ctx-empty', title: 'Empty', action });
    });

    // No __xplorer_state__ set
    ext._setContext({}, api);
    await ext.activate();

    const wrappedCallback = (api.commands.register as jest.Mock).mock.calls[0][1];
    await wrappedCallback();

    expect(action).toHaveBeenCalledWith([], api);
  });

  it('catches action errors without throwing', async () => {
    const api = createMockApi();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const ext = captureRegistration<any>(() => {
      ContextMenu.register({
        id: 'ctx-err',
        title: 'Err',
        action: () => {
          throw new Error('ctx boom');
        },
      });
    });

    ext._setContext({}, api);
    await ext.activate();

    const wrappedCallback = (api.commands.register as jest.Mock).mock.calls[0][1];
    await expect(wrappedCallback()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Context menu action failed'),
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  it('disposes commands on deactivate', async () => {
    const disposeFn = jest.fn();
    const api = createMockApi();
    (api.commands.register as jest.Mock).mockReturnValue({ dispose: disposeFn });

    const ext = captureRegistration<any>(() => {
      ContextMenu.register({ id: 'ctx-dispose', title: 'Dispose', action: jest.fn() });
    });

    ext._setContext({}, api);
    await ext.activate();
    await ext.deactivate();

    expect(disposeFn).toHaveBeenCalledTimes(1);
  });
});

// ─── Preview API ────────────────────────────────────────────────────────────

describe('Preview API', () => {
  it('registers a preview extension with correct manifest', () => {
    const ext = captureRegistration<any>(() => {
      Preview.register({
        id: 'prev-test',
        title: 'Test Preview',
        description: 'A preview',
        canPreview: () => true,
        render: jest.fn(),
      });
    });

    expect(ext.manifest.id).toBe('prev-test');
    expect(ext.manifest.category).toBe('preview');
    expect(ext.manifest.description).toBe('A preview');
    expect(ext.manifest.permissions).toEqual(['file:read']);
  });

  it('delegates canPreview to the config function', () => {
    const canPreview = jest.fn((file: any) => file.name.endsWith('.md'));

    const ext = captureRegistration<any>(() => {
      Preview.register({ id: 'prev-can', title: 'Can', canPreview, render: jest.fn() });
    });

    expect(ext.canPreview({ name: 'readme.md', path: '/readme.md', is_dir: false })).toBe(true);
    expect(ext.canPreview({ name: 'image.png', path: '/image.png', is_dir: false })).toBe(false);
  });

  it('returns default priority of 10', () => {
    const ext = captureRegistration<any>(() => {
      Preview.register({
        id: 'prev-priority',
        title: 'Priority',
        canPreview: () => true,
        render: jest.fn(),
      });
    });

    expect(ext.getPriority()).toBe(10);
  });

  it('respects custom priority', () => {
    const ext = captureRegistration<any>(() => {
      Preview.register({
        id: 'prev-custom-priority',
        title: 'Custom Priority',
        canPreview: () => true,
        render: jest.fn(),
        priority: 50,
      });
    });

    expect(ext.getPriority()).toBe(50);
  });

  it('calls render function with props', () => {
    const renderFn = jest.fn(() => 'preview rendered');

    const ext = captureRegistration<any>(() => {
      Preview.register({
        id: 'prev-render',
        title: 'Render',
        canPreview: () => true,
        render: renderFn,
      });
    });

    const props = {
      currentPath: '/docs',
      selectedFiles: [{ name: 'f.txt', path: '/f.txt', is_dir: false }],
    };
    const result = ext.render(props);

    expect(renderFn).toHaveBeenCalledWith(props);
    expect(result).toBe('preview rendered');
  });

  it('calls onActivate with api', async () => {
    const api = createMockApi();
    const onActivate = jest.fn();

    const ext = captureRegistration<any>(() => {
      Preview.register({
        id: 'prev-activate',
        title: 'Activate',
        canPreview: () => true,
        render: jest.fn(),
        onActivate,
      });
    });

    ext._setContext({}, api);
    await ext.activate();

    expect(onActivate).toHaveBeenCalledWith(api);
  });

  it('calls onDeactivate', async () => {
    const onDeactivate = jest.fn();

    const ext = captureRegistration<any>(() => {
      Preview.register({
        id: 'prev-deactivate',
        title: 'Deactivate',
        canPreview: () => true,
        render: jest.fn(),
        onDeactivate,
      });
    });

    ext._setContext({}, createMockApi());
    await ext.deactivate();

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it('generates panel contributes metadata', () => {
    const ext = captureRegistration<any>(() => {
      Preview.register({
        id: 'prev-contributes',
        title: 'Contributes',
        icon: 'eye',
        canPreview: () => true,
        render: jest.fn(),
      });
    });

    expect(ext.manifest.contributes.panels).toEqual([
      { id: 'prev-contributes', title: 'Contributes', location: 'right', icon: 'eye' },
    ]);
  });
});

// ─── register() fallback ────────────────────────────────────────────────────

describe('register() fallback when host not available', () => {
  it('logs a warning if __xplorer_register__ is not set', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Make sure __xplorer_register__ is not set
    delete (window as any).__xplorer_register__;

    Theme.register({
      id: 'orphan',
      name: 'Orphan',
      colors: {
        bg: '#000',
        surface: '#111',
        surfaceLight: '#222',
        border: '#333',
        text: '#fff',
        textMuted: '#888',
        blue: '#00f',
        green: '#0f0',
        orange: '#f90',
        pink: '#f0f',
        red: '#f00',
        yellow: '#ff0',
        cyan: '#0ff',
        purple: '#90f',
      },
    });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not register extension'));

    warnSpy.mockRestore();
  });
});
