import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Command } from '@/components/CommandPalette';
import type { FileEntry } from '@/lib/tauri-api';

export interface UseCommandPaletteCommandsOptions {
  currentPath: string;
  pathHistory: string[];
  historyIndex: number;
  files: FileEntry[];
  navigateWithHistory: (path: string) => void;
  refetch: () => void;
  setViewMode: (mode: string) => void;
  setRightSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setBottomPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setBottomPanelTab: React.Dispatch<React.SetStateAction<string>>;
  bottomPanelTab: string;
  bottomPanelCollapsed: boolean;
  setLeftSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  setShortcutsDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleCreateFolder: () => void;
  handleDelete: () => void;
}

export const useCommandPaletteCommands = ({
  currentPath,
  pathHistory,
  historyIndex,
  files,
  navigateWithHistory,
  refetch,
  setViewMode,
  setRightSidebarCollapsed,
  setBottomPanelCollapsed,
  setBottomPanelTab,
  bottomPanelTab,
  bottomPanelCollapsed,
  setLeftSidebarCollapsed,
  setSelectedFiles,
  setShortcutsDialogOpen,
  handleCreateFolder,
  handleDelete,
}: UseCommandPaletteCommandsOptions): Command[] => {
  const { t } = useTranslation();
  return useMemo(
    () => [
      {
        id: 'home',
        title: t('commands.goHome'),
        shortcut: 'Alt+H',
        category: t('commands.categories.navigation'),
        action: () => navigateWithHistory('xplorer://home'),
      },
      {
        id: 'up',
        title: t('commands.goUp'),
        shortcut: 'Alt+Up',
        category: t('commands.categories.navigation'),
        action: () => {
          const parent = currentPath.replace(/[\\/][^\\/]+$/, '');
          if (parent && parent !== currentPath) navigateWithHistory(parent);
        },
      },
      {
        id: 'back',
        title: t('commands.goBack'),
        shortcut: 'Alt+Left',
        category: t('commands.categories.navigation'),
        action: () => {
          if (historyIndex > 0) navigateWithHistory(pathHistory[historyIndex - 1]);
        },
      },
      {
        id: 'forward',
        title: t('commands.goForward'),
        shortcut: 'Alt+Right',
        category: t('commands.categories.navigation'),
        action: () => {
          if (historyIndex < pathHistory.length - 1) {
            navigateWithHistory(pathHistory[historyIndex + 1]);
          }
        },
      },
      {
        id: 'refresh',
        title: t('commands.refresh'),
        shortcut: 'F5',
        category: t('commands.categories.navigation'),
        action: () => refetch(),
      },
      {
        id: 'view-large',
        title: t('commands.largeIcons'),
        category: t('commands.categories.view'),
        action: () => setViewMode('large'),
      },
      {
        id: 'view-medium',
        title: t('commands.mediumIcons'),
        category: t('commands.categories.view'),
        action: () => setViewMode('medium'),
      },
      {
        id: 'view-list',
        title: t('commands.listView'),
        category: t('commands.categories.view'),
        action: () => setViewMode('list'),
      },
      {
        id: 'view-details',
        title: t('commands.detailsView'),
        category: t('commands.categories.view'),
        action: () => setViewMode('details'),
      },
      {
        id: 'view-gallery',
        title: t('commands.galleryView'),
        category: t('commands.categories.view'),
        action: () => setViewMode('gallery'),
      },
      {
        id: 'view-tree',
        title: t('commands.treeView'),
        category: t('commands.categories.view'),
        action: () => setViewMode('tree'),
      },
      {
        id: 'toggle-preview',
        title: t('commands.togglePreview'),
        category: t('commands.categories.panels'),
        action: () => setRightSidebarCollapsed((prev) => !prev),
      },
      {
        id: 'toggle-terminal',
        title: t('commands.toggleTerminal'),
        shortcut: 'Ctrl+`',
        category: t('commands.categories.panels'),
        action: () => {
          // If panel is open and already showing terminal, collapse it
          if (!bottomPanelCollapsed && bottomPanelTab === 'terminal') {
            setBottomPanelCollapsed(true);
          } else {
            // Otherwise open and switch to terminal
            setBottomPanelCollapsed(false);
            setBottomPanelTab('terminal');
          }
        },
      },
      {
        id: 'toggle-left-sidebar',
        title: t('commands.toggleSidebar'),
        shortcut: 'Ctrl+B',
        category: t('commands.categories.panels'),
        action: () => setLeftSidebarCollapsed((prev) => !prev),
      },
      {
        id: 'new-folder',
        title: t('commands.newFolder'),
        shortcut: 'Ctrl+Shift+N',
        category: t('commands.categories.file'),
        action: () => handleCreateFolder(),
      },
      {
        id: 'select-all',
        title: t('commands.selectAll'),
        shortcut: 'Ctrl+A',
        category: t('commands.categories.selection'),
        action: () => {
          const all = new Set(files?.map((f) => f.path) || []);
          setSelectedFiles(all);
        },
      },
      {
        id: 'delete',
        title: t('commands.deleteSelected'),
        shortcut: 'Delete',
        category: t('commands.categories.file'),
        action: () => handleDelete(),
      },
      {
        id: 'settings',
        title: t('commands.openSettings'),
        shortcut: 'Ctrl+,',
        category: t('commands.categories.other'),
        action: () => navigateWithHistory('xplorer://settings'),
      },
      {
        id: 'trash',
        title: t('commands.openTrash'),
        category: t('commands.categories.other'),
        action: () => navigateWithHistory('xplorer://trash'),
      },
      {
        id: 'keyboard-shortcuts',
        title: t('commands.keyboardShortcuts'),
        shortcut: 'Ctrl+/',
        category: t('commands.categories.other'),
        action: () => setShortcutsDialogOpen(true),
      },
    ],
    [
      t,
      currentPath,
      navigateWithHistory,
      historyIndex,
      pathHistory,
      refetch,
      files,
      handleDelete,
      handleCreateFolder,
      setViewMode,
      setRightSidebarCollapsed,
      setBottomPanelCollapsed,
      setBottomPanelTab,
      bottomPanelTab,
      bottomPanelCollapsed,
      setLeftSidebarCollapsed,
      setSelectedFiles,
      setShortcutsDialogOpen,
    ],
  );
};
