import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerTheme,
  unregisterTheme,
  getAllThemes,
  notifyCustomThemesChanged,
  installThemeEventBridge,
  useAllThemes,
} from '@/lib/theme-registry';
import { renderHook, act } from '@testing-library/react';

// Mock the utils module that provides built-in themes and custom theme loading
vi.mock('@/lib/utils', () => ({
  themes: {
    glass: {
      name: 'Xplorer Glass',
      primary: '#6366f1',
      bg: 'transparent',
      surface: 'rgba(255,255,255,0.06)',
      text: 'rgba(255,255,255,0.92)',
    },
    light: {
      name: 'Light',
      primary: '#3b82f6',
      bg: '#ffffff',
      surface: '#f8fafc',
      text: '#1e293b',
    },
  },
  loadCustomThemes: () => ({}),
}));

describe('theme-registry', () => {
  beforeEach(() => {
    // Clean up extension themes between tests
    // Unregister any themes that may have been registered in prior tests
    const all = getAllThemes();
    for (const key of Object.keys(all)) {
      if (key !== 'glass' && key !== 'light') {
        unregisterTheme(key);
      }
    }
  });

  describe('getAllThemes', () => {
    it('includes built-in themes', () => {
      const themes = getAllThemes();
      expect(themes.glass).toBeDefined();
      expect(themes.glass.name).toBe('Xplorer Glass');
      expect(themes.light).toBeDefined();
      expect(themes.light.name).toBe('Light');
    });
  });

  describe('registerTheme', () => {
    it('adds an extension theme', () => {
      registerTheme('dracula', {
        name: 'Dracula',
        primary: '#bd93f9',
        bg: '#282a36',
        surface: '#44475a',
        text: '#f8f8f2',
      });

      const themes = getAllThemes();
      expect(themes.dracula).toBeDefined();
      expect(themes.dracula.name).toBe('Dracula');
    });

    it('overwrites an existing extension theme', () => {
      registerTheme('ext-theme', {
        name: 'v1',
        primary: '#fff',
        bg: '#000',
        surface: '#111',
        text: '#eee',
      });
      registerTheme('ext-theme', {
        name: 'v2',
        primary: '#fff',
        bg: '#000',
        surface: '#111',
        text: '#eee',
      });

      const themes = getAllThemes();
      expect(themes['ext-theme'].name).toBe('v2');
    });
  });

  describe('unregisterTheme', () => {
    it('removes an extension theme', () => {
      registerTheme('temp-theme', {
        name: 'Temp',
        primary: '#fff',
        bg: '#000',
        surface: '#111',
        text: '#eee',
      });
      expect(getAllThemes()['temp-theme']).toBeDefined();

      unregisterTheme('temp-theme');
      expect(getAllThemes()['temp-theme']).toBeUndefined();
    });

    it('is safe to unregister non-existent theme', () => {
      expect(() => unregisterTheme('nonexistent')).not.toThrow();
    });
  });

  describe('notifyCustomThemesChanged', () => {
    it('can be called without error', () => {
      expect(() => notifyCustomThemesChanged()).not.toThrow();
    });
  });

  describe('useAllThemes', () => {
    it('returns the current themes', () => {
      const { result } = renderHook(() => useAllThemes());
      expect(result.current.glass).toBeDefined();
      expect(result.current.light).toBeDefined();
    });

    it('updates when a theme is registered', () => {
      const { result } = renderHook(() => useAllThemes());

      act(() => {
        registerTheme('nord', {
          name: 'Nord',
          primary: '#88c0d0',
          bg: '#2e3440',
          surface: '#3b4252',
          text: '#eceff4',
        });
      });

      expect(result.current.nord).toBeDefined();
      expect(result.current.nord.name).toBe('Nord');
    });

    it('updates when a theme is unregistered', () => {
      act(() => {
        registerTheme('to-remove', {
          name: 'ToRemove',
          primary: '#fff',
          bg: '#000',
          surface: '#111',
          text: '#eee',
        });
      });

      const { result } = renderHook(() => useAllThemes());
      expect(result.current['to-remove']).toBeDefined();

      act(() => {
        unregisterTheme('to-remove');
      });

      expect(result.current['to-remove']).toBeUndefined();
    });
  });

  describe('installThemeEventBridge', () => {
    it('can be called without error', () => {
      expect(() => installThemeEventBridge()).not.toThrow();
    });

    it('registers themes from xplorer-theme-register event', () => {
      // Install the bridge (idempotent)
      installThemeEventBridge();

      act(() => {
        window.dispatchEvent(
          new CustomEvent('xplorer-theme-register', {
            detail: {
              id: 'event-theme',
              name: 'Event Theme',
              primary: '#ff0000',
              bg: '#000',
              surface: '#111',
              text: '#fff',
            },
          }),
        );
      });

      const themes = getAllThemes();
      expect(themes['event-theme']).toBeDefined();
      expect(themes['event-theme'].name).toBe('Event Theme');
    });

    it('unregisters themes from xplorer-theme-unregister event', () => {
      installThemeEventBridge();

      // First register
      act(() => {
        window.dispatchEvent(
          new CustomEvent('xplorer-theme-register', {
            detail: {
              id: 'to-unregister',
              name: 'Temp',
              primary: '#fff',
              bg: '#000',
              surface: '#111',
              text: '#eee',
            },
          }),
        );
      });
      expect(getAllThemes()['to-unregister']).toBeDefined();

      // Then unregister
      act(() => {
        window.dispatchEvent(
          new CustomEvent('xplorer-theme-unregister', {
            detail: { id: 'to-unregister' },
          }),
        );
      });
      expect(getAllThemes()['to-unregister']).toBeUndefined();
    });
  });
});
