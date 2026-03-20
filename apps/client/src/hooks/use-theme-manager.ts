import { useState, useEffect, useCallback } from 'react';
import { applyTheme } from '@/lib/utils';
import { useAllThemes, installThemeEventBridge } from '@/lib/theme-registry';

// Install the event bridge once (listens for extension theme register/unregister)
installThemeEventBridge();

// ── Types ────────────────────────────────────────────────────────────────────

const loadUiTheme = () : string => {
  try {
    const raw = localStorage.getItem('xplorer:ui-state');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && 'theme' in parsed)
        return parsed.theme as string;
    }
  } catch {
    /* ignore */
  }
  return 'glass';
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useThemeManager = () => {
  const themes = useAllThemes();
  const [theme, setTheme] = useState(() => loadUiTheme());

  // Apply theme on mount
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleApplyTheme = useCallback((themeKey: string) => {
    setTheme(themeKey);
    applyTheme(themeKey);
  }, []);

  return {
    themes,
    theme,
    setTheme,
    handleApplyTheme,
  };
}
