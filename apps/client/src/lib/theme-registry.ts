import { themes as builtinThemes, type ThemeDef, loadCustomThemes } from './utils';
import { useSyncExternalStore } from 'react';

// ── Extension theme registry ──────────────────────────────────────
const extensionThemes: Record<string, ThemeDef> = {};
const listeners: Set<() => void> = new Set();

const notify = () => {
  listeners.forEach((fn) => fn());
};

export const registerTheme = (id: string, theme: ThemeDef) => {
  extensionThemes[id] = theme;
  notify();
};

export const unregisterTheme = (id: string) => {
  delete extensionThemes[id];
  notify();
};

const getCustomThemeDefs = (): Record<string, ThemeDef> => {
  const custom = loadCustomThemes();
  const defs: Record<string, ThemeDef> = {};
  for (const [slug, ct] of Object.entries(custom)) {
    defs[`custom:${slug}`] = {
      name: ct.name,
      primary: ct.accent,
      bg: ct.background,
      surface: ct.surface,
      text: ct.text,
    };
  }
  return defs;
};

export const getAllThemes = (): Record<string, ThemeDef> => {
  return { ...builtinThemes, ...extensionThemes, ...getCustomThemeDefs() };
};

export const notifyCustomThemesChanged = (): void => {
  notify();
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

// ── React hook ────────────────────────────────────────────────────
let snapshot = getAllThemes();

export const useAllThemes = (): Record<string, ThemeDef> => {
  return useSyncExternalStore(subscribe, () => {
    const next = getAllThemes();
    // Only create new reference when contents changed
    if (JSON.stringify(next) !== JSON.stringify(snapshot)) {
      snapshot = next;
    }
    return snapshot;
  });
};

// ── Event bridge (call once in app root) ──────────────────────────
let bridgeInstalled = false;

export const installThemeEventBridge = () => {
  if (bridgeInstalled) return;
  bridgeInstalled = true;

  window.addEventListener('xplorer-theme-register', ((e: CustomEvent) => {
    const { id, name, primary, bg, surface, text } = e.detail;
    if (id && name) registerTheme(id, { name, primary, bg, surface, text });
  }) as EventListener);

  window.addEventListener('xplorer-theme-unregister', ((e: CustomEvent) => {
    if (e.detail?.id) unregisterTheme(e.detail.id);
  }) as EventListener);
};
