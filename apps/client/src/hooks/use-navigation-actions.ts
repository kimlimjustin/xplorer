import { useCallback, useRef } from 'react';
import { TauriAPI } from '@/lib/tauri-api';
import { STORAGE_KEYS } from '@/lib/storage-keys';
import { PATH_SEPARATOR } from '@/lib/constants';
import type { TabItem, EditorGroup } from '@/types/split-view';
import type { SplitLayoutHook } from '@/hooks/use-split-layout';

export interface NavigationActionsDeps {
  currentPath: string;
  splitLayoutRef: React.MutableRefObject<SplitLayoutHook>;
  activeGroupRef: React.MutableRefObject<EditorGroup>;
}

export const useNavigationActions = (deps: NavigationActionsDeps) => {
  const { currentPath, splitLayoutRef, activeGroupRef } = deps;
  const navigateToPathRef = useRef<(path: string) => void>(() => {});

  const setCurrentPath = useCallback(
    (path: string) => {
      splitLayoutRef.current.navigate(
        activeGroupRef.current.id,
        path,
        path.split(/[/\\]/).pop() || path,
      );
    },
    [splitLayoutRef, activeGroupRef],
  );

  const navigateWithHistory = useCallback(
    (newPath: string, _addToHistory: boolean = true) => {
      if (newPath === currentPath) return;

      const ag = activeGroupRef.current;
      const sl = splitLayoutRef.current;

      const activeTabObj = ag.tabs.find((t: TabItem) => t.id === ag.activeTabId);
      const isGDriveTab =
        activeTabObj?.type === 'gdrive' || activeTabObj?.type === 'gdrive-manager';
      const isLocalPath =
        !newPath.startsWith('gdrive://') && !newPath.startsWith('xplorer://gdrive-manager');

      if (isGDriveTab && isLocalPath) {
        const folderTab = ag.tabs.find((t: TabItem) => t.type === 'folder' || t.type === undefined);
        if (folderTab) {
          sl.switchTab(ag.id, folderTab.id);
          setTimeout(() => sl.navigate(ag.id, newPath, newPath.split(/[/\\]/).pop() || newPath), 0);
        } else {
          const newTab: TabItem = {
            id: `tab-folder-${Date.now()}`,
            name: newPath.split(/[/\\]/).pop() || newPath,
            path: newPath,
            type: 'folder',
          };
          sl.addTab(ag.id, newTab, true);
        }
      } else {
        sl.navigate(ag.id, newPath, newPath.split(/[/\\]/).pop() || newPath);
      }

      if (
        !newPath.startsWith('xplorer://') &&
        !newPath.startsWith('gdrive://') &&
        !newPath.startsWith('comparison://') &&
        !newPath.startsWith('collection://')
      ) {
        TauriAPI.setSearchContext(newPath).catch((err) =>
          console.error('Failed to set search context:', err),
        );
        // Defer indexing so the folder renders first — prevents UI freezes
        setTimeout(() => {
          TauriAPI.indexDirectory(newPath).catch((err) =>
            console.error('Failed to index directory:', err),
          );
        }, 1000);
        if (localStorage.getItem(STORAGE_KEYS.AUTO_WHITELIST_VISITED) !== 'false') {
          TauriAPI.addWhitelistedPath(newPath).catch((err) =>
            console.error('Failed to whitelist path:', err),
          );
        }
      }
    },
    [currentPath, splitLayoutRef, activeGroupRef],
  );

  const navigateUp = useCallback(() => {
    if (currentPath === 'xplorer://home') return;
    if (currentPath === 'xplorer://gdrive-manager') return;
    if (currentPath.startsWith('gdrive://')) return;
    if (currentPath.startsWith('collection://')) return;
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
  navigateToPathRef.current = navigateToPath;

  const navigateToHome = useCallback(() => {
    navigateWithHistory('xplorer://home');
  }, [navigateWithHistory]);

  const navigateFromHome = useCallback(
    (path: string) => {
      const tabId = path;
      const tabName = path.split(/[\\/]/).pop() || path;
      const newTab: TabItem = { id: tabId, name: tabName, path, type: 'folder' };
      splitLayoutRef.current.addTab(activeGroupRef.current.id, newTab, true);
    },
    [splitLayoutRef, activeGroupRef],
  );

  const navigateBackInHistory = useCallback(() => {
    splitLayoutRef.current.navigateBack(activeGroupRef.current.id);
  }, [splitLayoutRef, activeGroupRef]);

  const navigateForwardInHistory = useCallback(() => {
    splitLayoutRef.current.navigateForward(activeGroupRef.current.id);
  }, [splitLayoutRef, activeGroupRef]);

  const canNavigateBackInHistory = useCallback(
    () => activeGroupRef.current.historyIndex > 0,
    [activeGroupRef],
  );

  const canNavigateForwardInHistory = useCallback(
    () => activeGroupRef.current.historyIndex < activeGroupRef.current.pathHistory.length - 1,
    [activeGroupRef],
  );

  return {
    setCurrentPath,
    navigateWithHistory,
    navigateUp,
    navigateToPath,
    navigateToHome,
    navigateFromHome,
    navigateBackInHistory,
    navigateForwardInHistory,
    canNavigateBackInHistory,
    canNavigateForwardInHistory,
    navigateToPathRef,
  };
};
