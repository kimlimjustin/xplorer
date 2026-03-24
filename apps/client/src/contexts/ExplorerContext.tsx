import { createContext, useContext } from 'react';
import type { FileEntry } from '@/lib/tauri-api';
import type { FileCollection } from '@/lib/collections';
import type { SharedPaneActions } from '@/components/split-view/EditorGroupPane';
import type { PaneSyncMode } from '@/hooks/use-pane-sync';
import type { SortField } from '@/lib/utils';

// ── Selection ────────────────────────────────────────────────────────────────

export interface SelectionContextValue {
  selectedFiles: Set<string>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedFile: FileEntry | null;
  setSelectedFile: React.Dispatch<React.SetStateAction<FileEntry | null>>;
}

// ── View / Sort ──────────────────────────────────────────────────────────────

export interface ViewSortContextValue {
  viewMode: string;
  setViewMode: React.Dispatch<React.SetStateAction<string>>;
  sortBy: SortField;
  setSortBy: React.Dispatch<React.SetStateAction<SortField>>;
  sortOrder: 'asc' | 'desc';
  setSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
}

// ── Split layout actions ─────────────────────────────────────────────────────

export interface SplitActionsContextValue {
  sharedActions: SharedPaneActions;
  onSwitchTab: (groupId: string, tabId: string) => void;
  onCloseTab: (groupId: string, tabId: string) => void;
  onAddTab: (groupId: string) => void;
  onSplitHorizontal: (groupId: string) => void;
  onSplitVertical: (groupId: string) => void;
  onCloseGroup: (groupId: string) => void;
  onSetActiveGroup: (groupId: string) => void;
  onNavigate: (groupId: string, path: string, name: string) => void;
  onResizeSplit: (path: number[], sizes: number[]) => void;
  maximizedGroupId?: string | null;
  onMaximizePane?: (groupId: string) => void;
  onRestorePane?: () => void;
  onTogglePin?: (groupId: string, tabId: string) => void;
  onDuplicateTab?: (groupId: string, tabId: string) => void;
  onCloseOtherTabs?: (groupId: string, tabId: string) => void;
  onCloseTabsToRight?: (groupId: string, tabId: string) => void;
  onCloseAllTabs?: (groupId: string) => void;
  onReorderTab?: (groupId: string, fromIndex: number, toIndex: number) => void;
}

// ── Pane sync ────────────────────────────────────────────────────────────────

export interface PaneSyncContextValue {
  paneSyncEnabled: boolean;
  paneSyncMode: PaneSyncMode;
  onTogglePaneSync: () => void;
  onSwitchPaneSyncMode: (mode: PaneSyncMode) => void;
}

// ── Clipboard ───────────────────────────────────────────────────────────────

export interface ClipboardContextValue {
  copySelectedFiles: () => void;
  cutSelectedFiles: () => void;
  pasteFiles: () => void;
  hasClipboard: boolean;
}

// ── Combined context ─────────────────────────────────────────────────────────

export interface ExplorerContextValue {
  selection: SelectionContextValue;
  viewSort: ViewSortContextValue;
  splitActions: SplitActionsContextValue;
  paneSync: PaneSyncContextValue;
  clipboard: ClipboardContextValue;
  activeCollectionFilter: FileCollection | null;
}

const ExplorerContext = createContext<ExplorerContextValue | null>(null);

export const ExplorerProvider = ExplorerContext.Provider;

export const useExplorerContext = (): ExplorerContextValue => {
  const ctx = useContext(ExplorerContext);
  if (!ctx) {
    throw new Error('useExplorerContext must be used within an ExplorerProvider');
  }
  return ctx;
};

// Convenience hooks for accessing individual sub-contexts to minimize
// destructuring boilerplate in leaf components.

export const useSelectionContext = (): SelectionContextValue => {
  return useExplorerContext().selection;
};

export const useViewSortContext = (): ViewSortContextValue => {
  return useExplorerContext().viewSort;
};

export const useSplitActionsContext = (): SplitActionsContextValue => {
  return useExplorerContext().splitActions;
};

export const usePaneSyncContext = (): PaneSyncContextValue => {
  return useExplorerContext().paneSync;
};

export const useClipboardContext = (): ClipboardContextValue => {
  return useExplorerContext().clipboard;
};
