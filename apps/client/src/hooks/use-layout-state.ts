import { useState, useCallback } from 'react';

// ── Helpers for persisting UI state to localStorage ──────────────────────────
const UI_STATE_KEY = 'xplorer:ui-state';

const loadUiState = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && key in parsed) return parsed[key] as T;
    }
  } catch (e) {
    console.warn('Failed to parse stored UI state:', e);
  }
  return fallback;
};

// ── Types ────────────────────────────────────────────────────────────────────

export type BottomPanelTabId =
  | 'terminal'
  | 'activity-log'
  | 'notifications'
  | 'clipboard'
  | 'changes'
  | 'properties'
  | (string & Record<never, never>); // Allow extension-registered tab IDs

export interface LayoutState {
  // Panel collapse states
  leftSidebarCollapsed: boolean;
  setLeftSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  rightSidebarCollapsed: boolean;
  setRightSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  bottomPanelCollapsed: boolean;
  setBottomPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;

  // Panel sizes
  leftSidebarWidth: number;
  setLeftSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  rightSidebarWidth: number;
  setRightSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  bottomPanelHeight: number;
  setBottomPanelHeight: React.Dispatch<React.SetStateAction<number>>;

  // Resize handlers
  handleLeftResize: (delta: number) => void;
  handleRightResize: (delta: number) => void;
  handleBottomResize: (delta: number) => void;

  // Panel tabs
  rightPanelTab: string;
  setRightPanelTab: React.Dispatch<React.SetStateAction<string>>;
  bottomPanelTab: BottomPanelTabId;
  setBottomPanelTab: React.Dispatch<React.SetStateAction<BottomPanelTabId>>;

  // Search panel
  searchPanelOpen: boolean;
  setSearchPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // View mode
  viewMode: string;
  setViewMode: React.Dispatch<React.SetStateAction<string>>;

  // Sorting
  sortBy: string;
  setSortBy: React.Dispatch<React.SetStateAction<string>>;
  sortOrder: 'asc' | 'desc';
  setSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useLayoutState = (): LayoutState => {
  // Panel collapse states
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(() =>
    loadUiState('leftSidebarCollapsed', false),
  );
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(() =>
    loadUiState('rightSidebarCollapsed', false),
  );
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(() =>
    loadUiState('bottomPanelCollapsed', true),
  );

  // Panel tabs
  const [rightPanelTab, setRightPanelTab] = useState<string>(() =>
    loadUiState('rightPanelTab', 'preview'),
  );
  const [bottomPanelTab, _setBottomPanelTabRaw] = useState<BottomPanelTabId>(() => {
    const stored = loadUiState<string>('bottomPanelTab', 'terminal');
    // Migrate old tab IDs that were merged into 'activity-log'
    if (stored === 'output' || stored === 'activity' || stored === 'history') return 'activity-log';
    return stored as BottomPanelTabId;
  });

  // Wrapped setter: switching the bottom panel tab automatically expands the panel
  // so that context menu actions (Properties, Open in Terminal, etc.) reveal the panel.
  const setBottomPanelTab: React.Dispatch<React.SetStateAction<BottomPanelTabId>> = useCallback(
    (action: React.SetStateAction<BottomPanelTabId>) => {
      _setBottomPanelTabRaw(action);
      setBottomPanelCollapsed(false);
    },
    // setBottomPanelCollapsed is a stable useState setter

    [],
  );

  // Search panel
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);

  // Panel sizes
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() =>
    loadUiState('leftSidebarWidth', 256),
  );
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() =>
    loadUiState('rightSidebarWidth', 320),
  );
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() =>
    loadUiState('bottomPanelHeight', 192),
  );

  // Resize handlers
  const handleLeftResize = useCallback((delta: number) => {
    setLeftSidebarWidth((w) => Math.min(480, Math.max(180, w + delta)));
  }, []);
  const handleRightResize = useCallback((delta: number) => {
    setRightSidebarWidth((w) => Math.min(560, Math.max(240, w - delta)));
  }, []);
  const handleBottomResize = useCallback((delta: number) => {
    setBottomPanelHeight((h) => Math.min(500, Math.max(120, h - delta)));
  }, []);

  // View mode
  const [viewMode, setViewMode] = useState<string>(() => loadUiState('viewMode', 'medium'));

  // Sorting
  const [sortBy, setSortBy] = useState<string>(() => loadUiState('sortBy', 'name'));
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => loadUiState('sortOrder', 'asc'));

  return {
    leftSidebarCollapsed,
    setLeftSidebarCollapsed,
    rightSidebarCollapsed,
    setRightSidebarCollapsed,
    bottomPanelCollapsed,
    setBottomPanelCollapsed,
    leftSidebarWidth,
    setLeftSidebarWidth,
    rightSidebarWidth,
    setRightSidebarWidth,
    bottomPanelHeight,
    setBottomPanelHeight,
    handleLeftResize,
    handleRightResize,
    handleBottomResize,
    rightPanelTab,
    setRightPanelTab,
    bottomPanelTab,
    setBottomPanelTab,
    searchPanelOpen,
    setSearchPanelOpen,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
  };
};
