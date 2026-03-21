import { useCallback } from 'react';
import { TauriAPI } from '@/lib/tauri-api';
import { extensionHost } from '@/lib/extension-host';
import { PATH_SEPARATOR } from '@/lib/constants';
import type { TabItem } from '@/types/split-view';

interface UseNavigationDeps {
  currentPath: string;
  splitLayout: {
    navigate: (groupId: string, path: string, name: string) => void;
    navigateBack: (groupId: string) => void;
    navigateForward: (groupId: string) => void;
    addTab: (groupId: string, tab: TabItem, activate: boolean) => void;
    switchTab: (groupId: string, tabId: string) => void;
  };
  activeGroup: {
    id: string;
    tabs: TabItem[];
    activeTabId: string | null;
    pathHistory: string[];
    historyIndex: number;
  };
}

export const useNavigation = ({ currentPath, splitLayout, activeGroup }: UseNavigationDeps) => {
  const navigateWithHistory = useCallback(
    (newPath: string, _addToHistory: boolean = true) => {
      if (newPath === currentPath) return;

      const activeTabObj = activeGroup.tabs.find((t) => t.id === activeGroup.activeTabId);
      const isExtensionTab = activeTabObj?.type
        ? extensionHost.getTabRenderer(activeTabObj.type) !== null
        : false;
      const isLocalPath =
        !extensionHost.isExtensionScheme(newPath) && !newPath.startsWith('xplorer://');

      if (isExtensionTab && isLocalPath) {
        const folderTab = activeGroup.tabs.find((t) => t.type === 'folder' || t.type === undefined);
        if (folderTab) {
          splitLayout.switchTab(activeGroup.id, folderTab.id);
          setTimeout(
            () =>
              splitLayout.navigate(
                activeGroup.id,
                newPath,
                newPath.split(/[/\\]/).pop() || newPath,
              ),
            0,
          );
        } else {
          const newTab: TabItem = {
            id: `tab-folder-${Date.now()}`,
            name: newPath.split(/[/\\]/).pop() || newPath,
            path: newPath,
            type: 'folder',
          };
          splitLayout.addTab(activeGroup.id, newTab, true);
        }
      } else {
        splitLayout.navigate(activeGroup.id, newPath, newPath.split(/[/\\]/).pop() || newPath);
      }

      if (
        !newPath.startsWith('xplorer://') &&
        !newPath.startsWith('comparison://') &&
        !extensionHost.isExtensionScheme(newPath)
      ) {
        TauriAPI.indexDirectory(newPath).catch((err) =>
          console.error('Failed to index directory:', err),
        );
        TauriAPI.setSearchContext(newPath).catch((err) =>
          console.error('Failed to set search context:', err),
        );
        // Watch the directory for FS changes so the search index auto-rebuilds.
        TauriAPI.startWatching(newPath).catch((err: unknown) =>
          console.warn('Failed to start search watcher:', err),
        );
        if (localStorage.getItem('xplorer:auto-whitelist-visited') !== 'false') {
          TauriAPI.addWhitelistedPath(newPath).catch((err) =>
            console.error('Failed to whitelist path:', err),
          );
        }
      }
    },
    [currentPath, splitLayout, activeGroup],
  );

  const navigateUp = useCallback(() => {
    if (currentPath === 'xplorer://home') return;
    if (extensionHost.isExtensionScheme(currentPath)) return;
    if (currentPath.startsWith('/')) {
      const parts = currentPath.split('/').filter(Boolean);
      if (parts.length <= 1) return;
      const parentPath = `/${parts.slice(0, -1).join('/')}`;
      navigateWithHistory(parentPath);
      return;
    }
    const pathParts = currentPath.split(/[\\/]/).filter((p) => p);
    if (pathParts.length <= 1) return;
    const parentPath = pathParts.slice(0, -1).join(PATH_SEPARATOR) + PATH_SEPARATOR;
    navigateWithHistory(parentPath);
  }, [currentPath, navigateWithHistory]);

  const navigateToPath = useCallback(
    (path: string) => {
      navigateWithHistory(path);
    },
    [navigateWithHistory],
  );

  const navigateToHome = useCallback(() => {
    navigateWithHistory('xplorer://home');
  }, [navigateWithHistory]);

  const navigateFromHome = useCallback(
    (path: string) => {
      const tabId = path;
      const tabName = path.split(/[\\/]/).pop() || path;
      const newTab: TabItem = { id: tabId, name: tabName, path, type: 'folder' };
      splitLayout.addTab(activeGroup.id, newTab, true);
    },
    [splitLayout, activeGroup.id],
  );

  const navigateBackInHistory = useCallback(() => {
    splitLayout.navigateBack(activeGroup.id);
  }, [splitLayout, activeGroup.id]);

  const navigateForwardInHistory = useCallback(() => {
    splitLayout.navigateForward(activeGroup.id);
  }, [splitLayout, activeGroup.id]);

  const canNavigateBackInHistory = () => activeGroup.historyIndex > 0;
  const canNavigateForwardInHistory = () =>
    activeGroup.historyIndex < activeGroup.pathHistory.length - 1;

  return {
    navigateWithHistory,
    navigateUp,
    navigateToPath,
    navigateToHome,
    navigateFromHome,
    navigateBackInHistory,
    navigateForwardInHistory,
    canNavigateBackInHistory,
    canNavigateForwardInHistory,
  };
};
