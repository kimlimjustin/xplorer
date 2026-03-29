/**
 * Tests for the ThemeExtension base class and the Theme.register() API
 * color utility helpers (withOpacity, darken, lighten), color validation,
 * and CSS variable generation.
 */

import { ThemeExtension } from '../core/ThemeExtension';
import { Theme as ThemeAPI } from '../api';
import type { Theme as ThemeType, ExtensionContext, ExtensionManifest, XplorerAPI } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createMockContext = (): ExtensionContext => ({
  extensionPath: '/extensions/test-theme',
  globalState: { get: jest.fn(), set: jest.fn(), delete: jest.fn() },
  workspaceState: { get: jest.fn(), set: jest.fn(), delete: jest.fn() },
  subscriptions: [],
  asAbsolutePath: jest.fn((rel: string) => `/extensions/test-theme/${rel}`),
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

const validColors = {
  bg: '#1a1b26',
  surface: '#16161e',
  surfaceLight: '#1e1e2e',
  border: '#333333',
  text: '#c0caf5',
  textMuted: '#888888',
  blue: '#7aa2f7',
  green: '#9ece6a',
  orange: '#ff9e64',
  pink: '#f7768e',
  red: '#f7768e',
  yellow: '#e0af68',
  cyan: '#7dcfff',
  purple: '#bb9af7',
};

/** Capture the object passed to window.__xplorer_register__. */
const captureRegistration = <T = unknown>(fn: () => void): T => {
  let captured: T | undefined;
  (window as any).__xplorer_register__ = (ext: T) => {
    captured = ext;
  };
  fn();
  delete (window as any).__xplorer_register__;
  return captured as T;
};

// Create a concrete test subclass since ThemeExtension is abstract
class TestThemeExtension extends ThemeExtension {
  private themeConfig: ThemeType;

  constructor(id: string, themeConfig: ThemeType) {
    super({
      id,
      name: themeConfig.name,
      version: '1.0.0',
      author: 'Test',
    });
    this.themeConfig = themeConfig;
  }

  getTheme(): ThemeType {
    return this.themeConfig;
  }

  // Expose protected methods for testing
  public testWithOpacity(color: string, opacity: number): string {
    return this.withOpacity(color, opacity);
  }

  public testDarken(color: string, amount: number): string {
    return this.darken(color, amount);
  }

  public testLighten(color: string, amount: number): string {
    return this.lighten(color, amount);
  }
}

// ---------------------------------------------------------------------------
// ThemeExtension class
// ---------------------------------------------------------------------------
describe('ThemeExtension class', () => {
  const testTheme: ThemeType = {
    name: 'Test Dark',
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

  it('sets category to "theme" automatically', () => {
    const ext = new TestThemeExtension('my-theme', testTheme);
    expect(ext.manifest.category).toBe('theme');
  });

  it('stores the manifest id and name', () => {
    const ext = new TestThemeExtension('tokyo-night', testTheme);
    expect(ext.manifest.id).toBe('tokyo-night');
    expect(ext.manifest.name).toBe('Test Dark');
  });

  it('getTheme returns the theme config', () => {
    const ext = new TestThemeExtension('theme-1', testTheme);
    const theme = ext.getTheme();
    expect(theme.name).toBe('Test Dark');
    expect(theme.type).toBe('dark');
    expect(theme.colors.primary).toBe('#7aa2f7');
  });
});

// ---------------------------------------------------------------------------
// withOpacity
// ---------------------------------------------------------------------------
describe('withOpacity', () => {
  const ext = new TestThemeExtension('opacity-test', {
    name: 'Test',
    type: 'dark',
    colors: {
      primary: '#000',
      secondary: '#000',
      accent: '#000',
      background: '#000',
      surface: '#000',
      overlay: '#000',
      text: '#fff',
      textSecondary: '#ccc',
      textMuted: '#999',
      border: '#333',
      hover: '#444',
      selected: '#555',
      focus: '#000',
      success: '#0f0',
      warning: '#ff0',
      error: '#f00',
      info: '#0ff',
    },
  });

  it('generates correct hex with full opacity (1.0)', () => {
    const result = ext.testWithOpacity('#ff0000', 1.0);
    expect(result).toBe('#ff0000ff');
  });

  it('generates correct hex with half opacity (0.5)', () => {
    const result = ext.testWithOpacity('#ff0000', 0.5);
    // Math.round(0.5 * 255) = 128 => 0x80
    expect(result).toBe('#ff000080');
  });

  it('generates correct hex with zero opacity (0)', () => {
    const result = ext.testWithOpacity('#ff0000', 0);
    // Math.round(0 * 255) = 0 => 0x00
    expect(result).toBe('#ff000000');
  });

  it('generates correct hex with 0.1 opacity', () => {
    const result = ext.testWithOpacity('#ffffff', 0.1);
    // Math.round(0.1 * 255) = 26 => 0x1a
    expect(result).toBe('#ffffff1a');
  });

  it('generates correct hex with 0.9 opacity', () => {
    const result = ext.testWithOpacity('#000000', 0.9);
    // Math.round(0.9 * 255) = 230 => 0xe6
    expect(result).toBe('#000000e6');
  });

  it('works with different hex colors', () => {
    const result = ext.testWithOpacity('#1a1b26', 0.5);
    expect(result).toBe('#1a1b2680');
  });
});

// ---------------------------------------------------------------------------
// darken
// ---------------------------------------------------------------------------
describe('darken', () => {
  const ext = new TestThemeExtension('darken-test', {
    name: 'Test',
    type: 'dark',
    colors: {
      primary: '#000',
      secondary: '#000',
      accent: '#000',
      background: '#000',
      surface: '#000',
      overlay: '#000',
      text: '#fff',
      textSecondary: '#ccc',
      textMuted: '#999',
      border: '#333',
      hover: '#444',
      selected: '#555',
      focus: '#000',
      success: '#0f0',
      warning: '#ff0',
      error: '#f00',
      info: '#0ff',
    },
  });

  it('reduces color component values by the specified amount', () => {
    const result = ext.testDarken('#808080', 16);
    // R: 128 - 16 = 112 = 0x70
    // G: 128 - 16 = 112 = 0x70
    // B: 128 - 16 = 112 = 0x70
    expect(result).toBe('#707070');
  });

  it('clamps values at 0 (does not go negative)', () => {
    const result = ext.testDarken('#050505', 10);
    // R: max(0, 5 - 10) = 0
    // G: max(0, 5 - 10) = 0
    // B: max(0, 5 - 10) = 0
    expect(result).toBe('#000000');
  });

  it('returns original color with amount of 0', () => {
    const result = ext.testDarken('#abcdef', 0);
    expect(result).toBe('#abcdef');
  });

  it('darkens white by small amount correctly', () => {
    const result = ext.testDarken('#ffffff', 15);
    // R: 255 - 15 = 240 = 0xf0
    // G: 255 - 15 = 240 = 0xf0
    // B: 255 - 15 = 240 = 0xf0
    expect(result).toBe('#f0f0f0');
  });

  it('handles large darken amounts (clamps all to zero)', () => {
    const result = ext.testDarken('#303030', 255);
    expect(result).toBe('#000000');
  });

  it('returns non-hex colors unchanged', () => {
    const result = ext.testDarken('rgb(128, 128, 128)', 10);
    expect(result).toBe('rgb(128, 128, 128)');
  });
});

// ---------------------------------------------------------------------------
// lighten
// ---------------------------------------------------------------------------
describe('lighten', () => {
  const ext = new TestThemeExtension('lighten-test', {
    name: 'Test',
    type: 'dark',
    colors: {
      primary: '#000',
      secondary: '#000',
      accent: '#000',
      background: '#000',
      surface: '#000',
      overlay: '#000',
      text: '#fff',
      textSecondary: '#ccc',
      textMuted: '#999',
      border: '#333',
      hover: '#444',
      selected: '#555',
      focus: '#000',
      success: '#0f0',
      warning: '#ff0',
      error: '#f00',
      info: '#0ff',
    },
  });

  it('increases color component values by the specified amount', () => {
    const result = ext.testLighten('#808080', 16);
    // R: 128 + 16 = 144 = 0x90
    // G: 128 + 16 = 144 = 0x90
    // B: 128 + 16 = 144 = 0x90
    expect(result).toBe('#909090');
  });

  it('clamps values at 255 (does not exceed)', () => {
    const result = ext.testLighten('#fafafa', 10);
    // R: min(255, 250 + 10) = 255 = 0xff
    // G: min(255, 250 + 10) = 255 = 0xff
    // B: min(255, 250 + 10) = 255 = 0xff
    expect(result).toBe('#ffffff');
  });

  it('returns original color with amount of 0', () => {
    const result = ext.testLighten('#abcdef', 0);
    expect(result).toBe('#abcdef');
  });

  it('lightens black by small amount correctly', () => {
    const result = ext.testLighten('#000000', 32);
    // R: 0 + 32 = 32 = 0x20
    // G: 0 + 32 = 32 = 0x20
    // B: 0 + 32 = 32 = 0x20
    expect(result).toBe('#202020');
  });

  it('handles large lighten amounts (clamps all to 255)', () => {
    const result = ext.testLighten('#808080', 300);
    expect(result).toBe('#ffffff');
  });

  it('returns non-hex colors unchanged', () => {
    const result = ext.testLighten('hsl(200, 50%, 50%)', 10);
    expect(result).toBe('hsl(200, 50%, 50%)');
  });
});

// ---------------------------------------------------------------------------
// Theme.register() color validation
// ---------------------------------------------------------------------------
describe('Theme.register() color validation', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.documentElement.className = '';
  });

  it('rejects color values with semicolons (injection attempt)', () => {
    expect(() => {
      ThemeAPI.register({
        id: 'inject-test',
        name: 'Inject',
        colors: { ...validColors, bg: '#000; } .evil { display:none' },
      });
    }).toThrow(/Invalid CSS color/);
  });

  it('rejects color values with curly braces', () => {
    expect(() => {
      ThemeAPI.register({
        id: 'brace-test',
        name: 'Brace',
        colors: { ...validColors, text: '#fff } .steal { background: url(evil)' },
      });
    }).toThrow(/Invalid CSS color/);
  });

  it('rejects color values containing url()', () => {
    expect(() => {
      ThemeAPI.register({
        id: 'url-test',
        name: 'URL',
        colors: { ...validColors, surface: 'url(https://evil.com/steal.gif)' },
      });
    }).toThrow(/Invalid CSS color/);
  });

  it('rejects color values containing @import', () => {
    expect(() => {
      ThemeAPI.register({
        id: 'import-test',
        name: 'Import',
        colors: { ...validColors, border: '@import evil' },
      });
    }).toThrow(/Invalid CSS color/);
  });

  it('rejects color values containing expression()', () => {
    expect(() => {
      ThemeAPI.register({
        id: 'expr-test',
        name: 'Expr',
        colors: { ...validColors, green: 'expression(document.cookie)' },
      });
    }).toThrow(/Invalid CSS color/);
  });

  it('accepts valid hex colors (#RGB, #RRGGBB, #RRGGBBAA)', () => {
    expect(() => {
      ThemeAPI.register({
        id: 'hex-test',
        name: 'Hex',
        colors: { ...validColors, bg: '#1a1b26', text: '#c0caf5' },
      });
    }).not.toThrow();
  });

  it('accepts valid named colors', () => {
    expect(() => {
      ThemeAPI.register({
        id: 'named-test',
        name: 'Named',
        colors: { ...validColors, bg: 'black', text: 'white', blue: 'cornflowerblue' },
      });
    }).not.toThrow();
  });

  it('accepts rgb() colors', () => {
    expect(() => {
      ThemeAPI.register({
        id: 'rgb-test',
        name: 'RGB',
        colors: { ...validColors, bg: 'rgb(30, 30, 46)', surface: 'rgb(0, 0, 0)' },
      });
    }).not.toThrow();
  });

  it('accepts rgba() colors', () => {
    expect(() => {
      ThemeAPI.register({
        id: 'rgba-test',
        name: 'RGBA',
        colors: { ...validColors, bg: 'rgba(0, 0, 0, 0.9)' },
      });
    }).not.toThrow();
  });

  it('accepts hsl() colors', () => {
    expect(() => {
      ThemeAPI.register({
        id: 'hsl-test',
        name: 'HSL',
        colors: { ...validColors, bg: 'hsl(230, 15%, 10%)' },
      });
    }).not.toThrow();
  });

  it('accepts transparent color', () => {
    expect(() => {
      ThemeAPI.register({
        id: 'transparent-test',
        name: 'Transparent',
        colors: { ...validColors, bg: 'transparent' },
      });
    }).not.toThrow();
  });

  it('accepts currentColor', () => {
    expect(() => {
      ThemeAPI.register({
        id: 'currentcolor-test',
        name: 'CurrentColor',
        colors: { ...validColors, bg: 'currentColor' },
      });
    }).not.toThrow();
  });

  it('rejects invalid background value', () => {
    expect(() => {
      ThemeAPI.register({
        id: 'bad-bg-test',
        name: 'BadBG',
        colors: validColors,
        background: 'url(https://evil.com/bg.png)',
      });
    }).toThrow(/Invalid CSS background/);
  });

  it('accepts valid simple background color', () => {
    expect(() => {
      ThemeAPI.register({
        id: 'good-bg-test',
        name: 'GoodBG',
        colors: validColors,
        background: '#0a0a1a',
      });
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Theme.register() CSS variable generation
// ---------------------------------------------------------------------------
describe('Theme.register() CSS variable generation', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.documentElement.className = '';
  });

  it('generates --xp-bg CSS variable from colors.bg', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({ id: 'css-gen-1', name: 'CSSGen1', colors: validColors });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-css-gen-1') as HTMLStyleElement;
    expect(style.textContent).toContain(`--xp-bg: ${validColors.bg}`);
  });

  it('generates --xp-surface CSS variable from colors.surface', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({ id: 'css-gen-2', name: 'CSSGen2', colors: validColors });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-css-gen-2') as HTMLStyleElement;
    expect(style.textContent).toContain(`--xp-surface: ${validColors.surface}`);
  });

  it('generates --xp-text CSS variable from colors.text', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({ id: 'css-gen-3', name: 'CSSGen3', colors: validColors });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-css-gen-3') as HTMLStyleElement;
    expect(style.textContent).toContain(`--xp-text: ${validColors.text}`);
  });

  it('generates --xp-blue CSS variable from colors.blue', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({ id: 'css-gen-4', name: 'CSSGen4', colors: validColors });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-css-gen-4') as HTMLStyleElement;
    expect(style.textContent).toContain(`--xp-blue: ${validColors.blue}`);
  });

  it('generates all accent color CSS variables', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({ id: 'css-gen-5', name: 'CSSGen5', colors: validColors });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-css-gen-5') as HTMLStyleElement;
    expect(style.textContent).toContain(`--xp-green: ${validColors.green}`);
    expect(style.textContent).toContain(`--xp-orange: ${validColors.orange}`);
    expect(style.textContent).toContain(`--xp-pink: ${validColors.pink}`);
    expect(style.textContent).toContain(`--xp-red: ${validColors.red}`);
    expect(style.textContent).toContain(`--xp-yellow: ${validColors.yellow}`);
    expect(style.textContent).toContain(`--xp-cyan: ${validColors.cyan}`);
    expect(style.textContent).toContain(`--xp-purple: ${validColors.purple}`);
  });

  it('uses colors.border as fallback for --xp-border-light when borderLight is not set', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({ id: 'css-gen-6', name: 'CSSGen6', colors: validColors });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-css-gen-6') as HTMLStyleElement;
    expect(style.textContent).toContain(`--xp-border-light: ${validColors.border}`);
  });

  it('uses provided borderLight when set', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({
        id: 'css-gen-7',
        name: 'CSSGen7',
        colors: { ...validColors, borderLight: '#444444' },
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-css-gen-7') as HTMLStyleElement;
    expect(style.textContent).toContain('--xp-border-light: #444444');
  });

  it('uses colors.blue as fallback for --xp-blue-dark when blueDark is not set', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({ id: 'css-gen-8', name: 'CSSGen8', colors: validColors });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-css-gen-8') as HTMLStyleElement;
    expect(style.textContent).toContain(`--xp-blue-dark: ${validColors.blue}`);
  });

  it('uses provided blueDark when set', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({
        id: 'css-gen-9',
        name: 'CSSGen9',
        colors: { ...validColors, blueDark: '#5a82d7' },
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-css-gen-9') as HTMLStyleElement;
    expect(style.textContent).toContain('--xp-blue-dark: #5a82d7');
  });

  it('uses colors.textMuted as fallback for --xp-text-secondary when textSecondary is not set', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({ id: 'css-gen-10', name: 'CSSGen10', colors: validColors });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-css-gen-10') as HTMLStyleElement;
    expect(style.textContent).toContain(`--xp-text-secondary: ${validColors.textMuted}`);
  });

  it('generates theme class selector .theme-<id>', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({ id: 'my-custom-theme', name: 'Custom', colors: validColors });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-my-custom-theme') as HTMLStyleElement;
    expect(style.textContent).toContain('.theme-my-custom-theme');
  });

  it('generates html.theme-<id> selector for background', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({ id: 'html-bg-theme', name: 'HTMLBG', colors: validColors });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-html-bg-theme') as HTMLStyleElement;
    expect(style.textContent).toContain('html.theme-html-bg-theme');
  });

  it('generates --popover CSS variable defaulting to bg when popover not set', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({ id: 'css-gen-11', name: 'CSSGen11', colors: validColors });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-css-gen-11') as HTMLStyleElement;
    expect(style.textContent).toContain(`--xp-popover: ${validColors.bg}`);
  });

  it('generates --popover CSS variable using provided popover color', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({
        id: 'css-gen-12',
        name: 'CSSGen12',
        colors: { ...validColors, popover: '#1e1e2e' },
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-css-gen-12') as HTMLStyleElement;
    expect(style.textContent).toContain('--xp-popover: #1e1e2e');
  });

  it('generates shadcn-compatible CSS variables (--background, --foreground, etc.)', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({ id: 'css-gen-13', name: 'CSSGen13', colors: validColors });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-css-gen-13') as HTMLStyleElement;
    expect(style.textContent).toContain(`--background: ${validColors.bg}`);
    expect(style.textContent).toContain(`--foreground: ${validColors.text}`);
    expect(style.textContent).toContain(`--primary: ${validColors.blue}`);
    expect(style.textContent).toContain(`--destructive: ${validColors.red}`);
    expect(style.textContent).toContain(`--muted: ${validColors.surface}`);
    expect(style.textContent).toContain(`--card: ${validColors.surface}`);
    expect(style.textContent).toContain(`--accent: ${validColors.surfaceLight}`);
  });
});

// ---------------------------------------------------------------------------
// Theme.register() CSS sanitization
// ---------------------------------------------------------------------------
describe('Theme.register() CSS sanitization', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.documentElement.className = '';
  });

  it('strips @import directives from custom CSS', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({
        id: 'sanitize-1',
        name: 'Sanitize1',
        colors: validColors,
        css: '@import url("https://evil.com/payload.css"); .safe { color: red; }',
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-sanitize-1') as HTMLStyleElement;
    expect(style.textContent).not.toMatch(/@import\s+url/);
    expect(style.textContent).toContain('/* @import blocked */');
    expect(style.textContent).toContain('.safe');
  });

  it('strips url() calls from custom CSS', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({
        id: 'sanitize-2',
        name: 'Sanitize2',
        colors: validColors,
        css: '.bg { background-image: url("https://evil.com/tracker.gif"); }',
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-sanitize-2') as HTMLStyleElement;
    expect(style.textContent).not.toContain('https://evil.com/tracker.gif');
    expect(style.textContent).toContain('/* url() blocked */');
  });

  it('strips @font-face blocks from custom CSS', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({
        id: 'sanitize-3',
        name: 'Sanitize3',
        colors: validColors,
        css: '@font-face { font-family: evil; src: url("evil.woff"); } .ok { margin: 0; }',
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-sanitize-3') as HTMLStyleElement;
    expect(style.textContent).toContain('/* @font-face blocked */');
    expect(style.textContent).toContain('.ok');
  });

  it('strips expression() from custom CSS', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({
        id: 'sanitize-4',
        name: 'Sanitize4',
        colors: validColors,
        css: '.x { width: expression(document.body.clientWidth / 2); }',
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-sanitize-4') as HTMLStyleElement;
    expect(style.textContent).toContain('/* expression() blocked */');
  });

  it('strips behavior: property from custom CSS', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({
        id: 'sanitize-5',
        name: 'Sanitize5',
        colors: validColors,
        css: '.x { behavior: url(xss.htc); }',
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-sanitize-5') as HTMLStyleElement;
    expect(style.textContent).toContain('/* behavior blocked */');
  });

  it('strips -moz-binding: property from custom CSS', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({
        id: 'sanitize-6',
        name: 'Sanitize6',
        colors: validColors,
        css: '.x { -moz-binding: url(xbl.xml); }',
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-sanitize-6') as HTMLStyleElement;
    expect(style.textContent).toContain('/* -moz-binding blocked */');
  });

  it('preserves safe CSS while stripping dangerous constructs', () => {
    const ext = captureRegistration<Function>(() => {
      ThemeAPI.register({
        id: 'sanitize-7',
        name: 'Sanitize7',
        colors: validColors,
        css: `
          .custom-scrollbar::-webkit-scrollbar { width: 8px; }
          .glow { box-shadow: 0 0 10px #7aa2f7; }
          @import url("evil.css");
          .safe-rule { color: inherit; }
        `,
      });
    });

    ext(createMockApi()).activate();
    const style = document.getElementById('theme-sanitize-7') as HTMLStyleElement;
    expect(style.textContent).toContain('.custom-scrollbar');
    expect(style.textContent).toContain('box-shadow');
    expect(style.textContent).toContain('.safe-rule');
    expect(style.textContent).toContain('/* @import blocked */');
  });
});
