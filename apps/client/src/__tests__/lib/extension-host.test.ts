import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock lucide-react to avoid import issues in non-React test
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

// Use vi.hoisted() so the mock variable is available inside vi.mock factory
// (vi.mock is hoisted above normal variable declarations, but vi.hoisted runs first)
const { mockReadTextFile } = vi.hoisted(() => ({
  mockReadTextFile: vi.fn(() => Promise.reject(new Error('file not found'))),
}));

vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    readDirectory: vi.fn(() => Promise.resolve([])),
    readTextFile: mockReadTextFile,
    readBinaryFile: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    fileExists: vi.fn(() => Promise.resolve(false)),
    getInstalledExtensions: vi.fn(() => Promise.resolve([])),
    activateExtension: vi.fn(() => Promise.resolve()),
    deactivateExtension: vi.fn(() => Promise.resolve()),
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

import { extensionHost, type ExtensionPackage } from '@/lib/extension-host';

describe('ExtensionHost Security', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('Path Validation', () => {
    // The loadExtensionScript method validates the mainFile field.
    // If validation fails, it returns early without reading the file.
    // We test by calling loadExtension and checking that readTextFile was NOT called
    // for invalid paths, meaning it was rejected before attempting file read.

    const createPackage = (mainFile: string): ExtensionPackage => ({
      manifest: {
        id: `test-ext-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: 'Test Extension',
        version: '1.0.0',
        author: 'Test',
        category: 'test',
        main: mainFile,
      },
      path: '/extensions/test-ext',
      is_active: false,
      is_installed: true,
    });

    it('rejects mainFile containing ".."', async () => {
      const pkg = createPackage('../../../etc/passwd');

      await extensionHost.loadExtension(pkg);

      expect(mockReadTextFile).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid main file path'));
    });

    it('rejects mainFile with absolute path starting with "/"', async () => {
      const pkg = createPackage('/etc/passwd');

      await extensionHost.loadExtension(pkg);

      expect(mockReadTextFile).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid main file path'));
    });

    it('rejects mainFile with Windows absolute path "C:\\"', async () => {
      const pkg = createPackage('C:\\Windows\\System32\\cmd.exe');

      await extensionHost.loadExtension(pkg);

      expect(mockReadTextFile).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid main file path'));
    });

    it('rejects mainFile with UNC path "\\\\server"', async () => {
      const pkg = createPackage('\\\\server\\share\\file.js');

      await extensionHost.loadExtension(pkg);

      expect(mockReadTextFile).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid main file path'));
    });

    it('rejects mainFile containing null bytes', async () => {
      const pkg = createPackage('dist/index.js\0.txt');

      await extensionHost.loadExtension(pkg);

      expect(mockReadTextFile).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid main file path'));
    });

    it('rejects mainFile containing percent signs', async () => {
      const pkg = createPackage('dist/%2e%2e/etc/passwd');

      await extensionHost.loadExtension(pkg);

      expect(mockReadTextFile).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid main file path'));
    });

    it('allows valid mainFile path', async () => {
      mockReadTextFile.mockResolvedValueOnce('// empty extension');

      const pkg = createPackage('dist/index.js');

      await extensionHost.loadExtension(pkg);

      expect(mockReadTextFile).toHaveBeenCalledWith('/extensions/test-ext/dist/index.js');
    });
  });

  describe('Bundle Size Limit', () => {
    it('rejects bundles larger than 5MB', async () => {
      // Create a string > 5MB
      const largeContent = 'x'.repeat(5 * 1024 * 1024 + 1);
      mockReadTextFile.mockResolvedValueOnce(largeContent);

      const pkg: ExtensionPackage = {
        manifest: {
          id: `size-test-${Date.now()}`,
          name: 'Size Test',
          version: '1.0.0',
          author: 'Test',
          category: 'test',
          main: 'dist/index.js',
        },
        path: '/extensions/size-test',
        is_active: false,
        is_installed: true,
      };

      await extensionHost.loadExtension(pkg);

      // Should have logged an error about bundle size
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Extension bundle too large'),
      );
    });

    it('allows bundles under 5MB', async () => {
      const smallContent = '// small extension\nconsole.log("ok");';
      mockReadTextFile.mockResolvedValueOnce(smallContent);

      const pkg: ExtensionPackage = {
        manifest: {
          id: `small-test-${Date.now()}`,
          name: 'Small Test',
          version: '1.0.0',
          author: 'Test',
          category: 'test',
          main: 'dist/index.js',
        },
        path: '/extensions/small-test',
        is_active: false,
        is_installed: true,
      };

      await extensionHost.loadExtension(pkg);

      // Should NOT have logged a bundle size error
      const sizeCalls = consoleSpy.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('bundle too large'),
      );
      expect(sizeCalls.length).toBe(0);
    });
  });

  describe('Decorator Registry Limit', () => {
    it('enforces max 1000 decorators', () => {
      // Register 1000 decorators
      for (let i = 0; i < 1000; i++) {
        extensionHost.registerDecorator({
          extensionId: `decorator-ext-${i}`,
          decorate: () => null,
        });
      }

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // The 1001st should be rejected (with a new extension ID not already in the map)
      const result = extensionHost.registerDecorator({
        extensionId: 'decorator-ext-overflow',
        decorate: () => ({ badge: 'X' }),
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Maximum decorator limit reached'),
      );

      // The returned dispose should be a no-op
      result.dispose();

      warnSpy.mockRestore();
    });
  });
});
