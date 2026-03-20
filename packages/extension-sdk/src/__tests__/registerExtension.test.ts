/**
 * Tests for the registerExtension utility function and the Extension base class.
 *
 * registerExtension() delegates to `window.__xplorer_register__` if present,
 * otherwise logs a warning. These tests also exercise the Extension base class
 * helper methods (getContext, getAPI, registerCommand, etc.).
 */

import { Extension } from '../core/Extension';
import { registerExtension } from '../utils/registerExtension';
import type { ExtensionManifest, ExtensionContext, XplorerAPI } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const createManifest = (overrides: Partial<ExtensionManifest> = {}): ExtensionManifest => ({
  id: 'test-ext',
  name: 'Test Extension',
  version: '1.0.0',
  author: 'Test',
  category: 'tool',
  ...overrides,
});

const createMockContext = (): ExtensionContext => ({
  extensionPath: '/extensions/test-ext',
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
  asAbsolutePath: jest.fn((rel: string) => `/extensions/test-ext/${rel}`),
});

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

/** Concrete subclass of Extension for testing (since Extension is abstract). */
class TestExtension extends Extension {
  public activateCalled = false;
  public deactivateCalled = false;

  constructor(manifest?: ExtensionManifest) {
    super(manifest || createManifest());
  }

  activate(): void {
    this.activateCalled = true;
  }

  deactivate(): void {
    this.deactivateCalled = true;
  }

  // Expose protected methods for testing
  public testGetContext() {
    return this.getContext();
  }
  public testGetAPI() {
    return this.getAPI();
  }
  public testGetConfig<T>(key: string, def?: T) {
    return this.getConfig(key, def);
  }
  public async testSetConfig<T>(key: string, val: T) {
    return this.setConfig(key, val);
  }
  public testShowMessage(msg: string, type?: 'info' | 'warning' | 'error') {
    return this.showMessage(msg, type);
  }
  public testLog(msg: string) {
    return this.log(msg);
  }
  public testLogError(err: Error | string) {
    return this.logError(err);
  }
  public testRegisterCommand(cmd: string, cb: (...args: any[]) => any) {
    return this.registerCommand(cmd, cb);
  }
  public testExecuteCommand(cmd: string, ...args: any[]) {
    return this.executeCommand(cmd, ...args);
  }
  public testGetAbsolutePath(rel: string) {
    return this.getAbsolutePath(rel);
  }
  public testSetGlobalState<T>(key: string, val: T) {
    return this.setGlobalState(key, val);
  }
  public testGetGlobalState<T>(key: string) {
    return this.getGlobalState<T>(key);
  }
  public testSetWorkspaceState<T>(key: string, val: T) {
    return this.setWorkspaceState(key, val);
  }
  public testGetWorkspaceState<T>(key: string) {
    return this.getWorkspaceState<T>(key);
  }
}

// ─── registerExtension ──────────────────────────────────────────────────────

describe('registerExtension', () => {
  afterEach(() => {
    delete (window as any).__xplorer_register__;
  });

  it('calls __xplorer_register__ when available', () => {
    const registerFn = jest.fn();
    (window as any).__xplorer_register__ = registerFn;

    const ext = new TestExtension();
    registerExtension(ext);

    expect(registerFn).toHaveBeenCalledWith(ext);
  });

  it('logs a warning when __xplorer_register__ is not available', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    delete (window as any).__xplorer_register__;

    const ext = new TestExtension(createManifest({ name: 'My Ext' }));
    registerExtension(ext);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('My Ext'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not register extension'));

    warnSpy.mockRestore();
  });

  it('passes the exact extension instance to the register callback', () => {
    let captured: any;
    (window as any).__xplorer_register__ = (ext: any) => {
      captured = ext;
    };

    const ext = new TestExtension();
    registerExtension(ext);

    expect(captured).toBe(ext);
    expect(captured.manifest.id).toBe('test-ext');
  });
});

// ─── Extension base class ───────────────────────────────────────────────────

describe('Extension base class', () => {
  it('stores the manifest', () => {
    const manifest = createManifest({ id: 'abc', name: 'ABC' });
    const ext = new TestExtension(manifest);
    expect(ext.manifest.id).toBe('abc');
    expect(ext.manifest.name).toBe('ABC');
  });

  it('throws when getContext is called before setContext', () => {
    const ext = new TestExtension();
    expect(() => ext.testGetContext()).toThrow(/Extension context not available/);
  });

  it('throws when getAPI is called before setContext', () => {
    const ext = new TestExtension();
    expect(() => ext.testGetAPI()).toThrow(/API not available/);
  });

  it('returns context and api after _setContext', () => {
    const ext = new TestExtension();
    const ctx = createMockContext();
    const api = createMockApi();

    ext._setContext(ctx, api);

    expect(ext.testGetContext()).toBe(ctx);
    expect(ext.testGetAPI()).toBe(api);
  });

  it('getConfig calls api.settings.get with prefixed key', () => {
    const ext = new TestExtension(createManifest({ id: 'my-ext' }));
    const api = createMockApi();
    (api.settings.get as jest.Mock).mockReturnValue('value');
    ext._setContext(createMockContext(), api);

    const result = ext.testGetConfig('theme', 'default');
    expect(api.settings.get).toHaveBeenCalledWith('my-ext.theme', 'default');
    expect(result).toBe('value');
  });

  it('setConfig calls api.settings.set with prefixed key', async () => {
    const ext = new TestExtension(createManifest({ id: 'my-ext' }));
    const api = createMockApi();
    ext._setContext(createMockContext(), api);

    await ext.testSetConfig('color', 'blue');
    expect(api.settings.set).toHaveBeenCalledWith('my-ext.color', 'blue');
  });

  it('showMessage calls api.ui.showMessage', () => {
    const ext = new TestExtension();
    const api = createMockApi();
    ext._setContext(createMockContext(), api);

    ext.testShowMessage('Hello', 'warning');
    expect(api.ui.showMessage).toHaveBeenCalledWith('Hello', 'warning');
  });

  it('showMessage defaults to info type', () => {
    const ext = new TestExtension();
    const api = createMockApi();
    ext._setContext(createMockContext(), api);

    ext.testShowMessage('Info msg');
    expect(api.ui.showMessage).toHaveBeenCalledWith('Info msg', 'info');
  });

  it('log uses console.log with extension name prefix', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const ext = new TestExtension(createManifest({ name: 'LogExt' }));

    ext.testLog('hello world');

    expect(logSpy).toHaveBeenCalledWith('[LogExt] hello world');

    logSpy.mockRestore();
  });

  it('logError uses console.error with extension name prefix', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const ext = new TestExtension(createManifest({ name: 'ErrExt' }));

    ext.testLogError(new Error('something broke'));

    expect(errorSpy).toHaveBeenCalledWith('[ErrExt] something broke');

    errorSpy.mockRestore();
  });

  it('logError handles string errors', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const ext = new TestExtension(createManifest({ name: 'StrErr' }));

    ext.testLogError('a string error');

    expect(errorSpy).toHaveBeenCalledWith('[StrErr] a string error');

    errorSpy.mockRestore();
  });

  it('registerCommand registers with prefixed id and pushes to subscriptions', () => {
    const ext = new TestExtension(createManifest({ id: 'cmd-ext' }));
    const ctx = createMockContext();
    const api = createMockApi();
    const disposable = { dispose: jest.fn() };
    (api.commands.register as jest.Mock).mockReturnValue(disposable);

    ext._setContext(ctx, api);

    const cb = jest.fn();
    const result = ext.testRegisterCommand('doStuff', cb);

    expect(api.commands.register).toHaveBeenCalledWith('cmd-ext.doStuff', cb);
    expect(result).toBe(disposable);
    expect(ctx.subscriptions).toContain(disposable);
  });

  it('executeCommand delegates to api.commands.execute', async () => {
    const ext = new TestExtension();
    const api = createMockApi();
    (api.commands.execute as jest.Mock).mockResolvedValue('result');
    ext._setContext(createMockContext(), api);

    const result = await ext.testExecuteCommand('some.cmd', 'arg1', 'arg2');
    expect(api.commands.execute).toHaveBeenCalledWith('some.cmd', 'arg1', 'arg2');
    expect(result).toBe('result');
  });

  it('getAbsolutePath delegates to context.asAbsolutePath', () => {
    const ext = new TestExtension();
    const ctx = createMockContext();
    ext._setContext(ctx, createMockApi());

    const result = ext.testGetAbsolutePath('icons/logo.png');
    expect(ctx.asAbsolutePath).toHaveBeenCalledWith('icons/logo.png');
    expect(result).toBe('/extensions/test-ext/icons/logo.png');
  });

  it('global state get/set delegates to context.globalState', () => {
    const ext = new TestExtension();
    const ctx = createMockContext();
    ext._setContext(ctx, createMockApi());

    ext.testSetGlobalState('key1', 'val1');
    expect(ctx.globalState.set).toHaveBeenCalledWith('key1', 'val1');

    ext.testGetGlobalState('key1');
    expect(ctx.globalState.get).toHaveBeenCalledWith('key1');
  });

  it('workspace state get/set delegates to context.workspaceState', () => {
    const ext = new TestExtension();
    const ctx = createMockContext();
    ext._setContext(ctx, createMockApi());

    ext.testSetWorkspaceState('wsKey', { data: true });
    expect(ctx.workspaceState.set).toHaveBeenCalledWith('wsKey', { data: true });

    ext.testGetWorkspaceState('wsKey');
    expect(ctx.workspaceState.get).toHaveBeenCalledWith('wsKey');
  });

  it('activate and deactivate are callable', () => {
    const ext = new TestExtension();

    ext.activate();
    expect(ext.activateCalled).toBe(true);

    ext.deactivate();
    expect(ext.deactivateCalled).toBe(true);
  });
});
