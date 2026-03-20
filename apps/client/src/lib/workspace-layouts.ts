/**
 * Workspace Layout Save/Restore
 *
 * Stores up to 10 named workspace layouts in localStorage.
 * Each layout captures the full split-pane tree + key UI state.
 */

import type { SplitLayoutState } from '@/types/split-view';
import { createDefaultLayout } from '@/types/split-view';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WorkspaceLayoutUiState {
  viewMode: string;
  theme: string;
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  bottomPanelCollapsed: boolean;
}

export interface WorkspaceLayout {
  id: string;
  name: string;
  created: number;
  layout: SplitLayoutState;
  uiState: WorkspaceLayoutUiState;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'xplorer:workspace-layouts';
const MAX_LAYOUTS = 10;

// ── Helpers ──────────────────────────────────────────────────────────────────

const generateId = () : string => {
  return `wl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const readStore = () : WorkspaceLayout[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as WorkspaceLayout[];
  } catch {
    return [];
  }
}

const writeStore = (layouts: WorkspaceLayout[]) : void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  } catch (e) {
    console.warn('Failed to save workspace layouts:', e);
  }
}

/** Count total tabs across all editor groups in a layout */
export const countTabs = (layout: SplitLayoutState) : number => {
  return Object.values(layout.groups).reduce((sum, g) => sum + g.tabs.length, 0);
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get all saved layouts, newest first */
export const getLayouts = () : WorkspaceLayout[] => {
  return readStore().sort((a, b) => b.created - a.created);
}

/** Save a new layout. Returns the created layout. Enforces MAX_LAYOUTS. */
export const saveLayout = (
  name: string,
  layoutState: SplitLayoutState,
  uiState: WorkspaceLayoutUiState,
) : WorkspaceLayout => {
  const layouts = readStore();

  const entry: WorkspaceLayout = {
    id: generateId(),
    name: name.trim() || 'Untitled Layout',
    created: Date.now(),
    layout: structuredClone(layoutState),
    uiState: { ...uiState },
  };

  layouts.unshift(entry);

  // Enforce max count: drop oldest
  if (layouts.length > MAX_LAYOUTS) {
    layouts.sort((a, b) => b.created - a.created);
    layouts.length = MAX_LAYOUTS;
  }

  writeStore(layouts);
  return entry;
}

/** Load a layout by id. Returns null if not found. */
export const loadLayout = (id: string) : WorkspaceLayout | null => {
  const layouts = readStore();
  return layouts.find((l) => l.id === id) ?? null;
}

/** Delete a layout by id. Returns true if found and deleted. */
export const deleteLayout = (id: string) : boolean => {
  const layouts = readStore();
  const idx = layouts.findIndex((l) => l.id === id);
  if (idx === -1) return false;
  layouts.splice(idx, 1);
  writeStore(layouts);
  return true;
}

/** Rename a layout. Returns true if found and renamed. */
export const renameLayout = (id: string, newName: string) : boolean => {
  const layouts = readStore();
  const layout = layouts.find((l) => l.id === id);
  if (!layout) return false;
  layout.name = newName.trim() || layout.name;
  writeStore(layouts);
  return true;
}

/** Create a default single-pane-home layout state (for "Reset to Default") */
export const getDefaultLayout = () : SplitLayoutState => {
  return createDefaultLayout();
}
