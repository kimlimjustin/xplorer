import { useCallback } from 'react';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';
import { formatError } from '@/lib/file-operation-helpers';
import { showConfirmationToast } from '@/components/ui/Toast';
import type { TabItem, EditorGroup } from '@/types/split-view';
import type { SplitLayoutHook } from '@/hooks/use-split-layout';
import type { Toast } from '@/hooks/use-toast';
import type { CrossTabSelectionState } from '@/hooks/use-cross-tab-selection';

export interface FileActionsDeps {
  splitLayoutRef: React.MutableRefObject<SplitLayoutHook>;
  activeGroupRef: React.MutableRefObject<EditorGroup>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedFile: React.Dispatch<React.SetStateAction<FileEntry | null>>;
  toast: (opts: Toast) => void;
  navigateWithHistory: (path: string) => void;
  crossTabSelection: CrossTabSelectionState;
  refetch: () => void;
}

export const useFileActions = (deps: FileActionsDeps) => {
  const {
    splitLayoutRef,
    activeGroupRef,
    setSelectedFiles,
    setSelectedFile,
    toast,
    navigateWithHistory,
    crossTabSelection,
    refetch,
  } = deps;

  const addTab = useCallback(
    (file: FileEntry) => {
      const newTab: TabItem = {
        id: file.path,
        name: file.name,
        path: file.path,
        type: file.is_dir ? 'folder' : 'file',
      };
      splitLayoutRef.current.addTab(activeGroupRef.current.id, newTab, true);
    },
    [splitLayoutRef, activeGroupRef],
  );

  const toggleFileSelection = useCallback(
    (filePath: string) => {
      setSelectedFiles((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(filePath)) {
          newSet.delete(filePath);
        } else {
          newSet.add(filePath);
        }
        return newSet;
      });
    },
    [setSelectedFiles],
  );

  const handleFileClick = useCallback(
    (file: FileEntry, event?: React.MouseEvent) => {
      setSelectedFile(file);
      if (event && (event.ctrlKey || event.metaKey)) {
        toggleFileSelection(file.path);
        return;
      }
      setSelectedFiles(new Set([file.path]));
    },
    [setSelectedFile, setSelectedFiles, toggleFileSelection],
  );

  const handleFileDoubleClick = useCallback(
    async (file: FileEntry) => {
      TauriAPI.addRecentFile(file.path).catch((err) =>
        console.error('Failed to add recent file:', err),
      );
      if (!file.is_dir) {
        try {
          await TauriAPI.openFile(file.path);
        } catch (error) {
          console.error('Failed to open file:', error);
          toast({
            variant: 'destructive',
            title: 'Open File Failed',
            description: `Failed to open "${file.name}": ${formatError(error)}`,
          });
        }
      } else {
        navigateWithHistory(file.path);
      }
    },
    [toast, navigateWithHistory],
  );

  // ── Google Drive ───────────────────────────────────────────────────────────

  const openGDriveTab = useCallback(
    (accountId: string, accountName: string) => {
      const ag = activeGroupRef.current;
      const sl = splitLayoutRef.current;
      const existingTab = ag.tabs.find(
        (tab: TabItem) => tab.type === 'gdrive' && tab.gdriveData?.accountId === accountId,
      );
      if (existingTab) {
        sl.switchTab(ag.id, existingTab.id);
        return;
      }
      const gdriveTab: TabItem = {
        id: `gdrive-${accountId}-${Date.now()}`,
        name: `\u2601 ${accountName}`,
        path: `gdrive://${accountId}/root`,
        type: 'gdrive',
        gdriveData: { accountId, folderId: 'root', folderName: 'My Drive' },
      };
      sl.addTab(ag.id, gdriveTab, true);
    },
    [splitLayoutRef, activeGroupRef],
  );

  const openGDriveManager = useCallback(() => {
    const managerTab: TabItem = {
      id: 'gdrive-manager',
      name: 'Google Drive',
      path: 'xplorer://gdrive-manager',
      type: 'gdrive-manager',
    };
    splitLayoutRef.current.addTab(activeGroupRef.current.id, managerTab, true);
  }, [splitLayoutRef, activeGroupRef]);

  // ── Cross-tab batch operation handlers ────────────────────────────────────

  const handleCrossTabPickFolder = useCallback(async (): Promise<string | null> => {
    const result = await TauriAPI.showOpenDialog({ directory: true });
    return result && result.length > 0 ? result[0] : null;
  }, []);

  const handleCrossTabMoveAll = useCallback(
    async (destination: string) => {
      const allFiles = crossTabSelection.getAllSelectedFiles();
      let moved = 0;
      for (const { file } of allFiles) {
        try {
          const sep = destination.includes('/') ? '/' : '\\';
          const destPath = `${destination}${sep}${file.name}`;
          await TauriAPI.moveFile(file.path, destPath);
          moved++;
        } catch (err) {
          toast({
            variant: 'destructive',
            title: 'Move Failed',
            description: `Failed to move "${file.name}": ${formatError(err)}`,
          });
        }
      }
      if (moved > 0) {
        toast({
          title: 'Moved',
          description: `Moved ${moved} file${moved !== 1 ? 's' : ''} to ${destination}`,
        });
        crossTabSelection.clearAll();
        refetch();
      }
    },
    [crossTabSelection, toast, refetch],
  );

  const handleCrossTabCopyAll = useCallback(
    async (destination: string) => {
      const allFiles = crossTabSelection.getAllSelectedFiles();
      let copied = 0;
      for (const { file } of allFiles) {
        try {
          const sep = destination.includes('/') ? '/' : '\\';
          const destPath = `${destination}${sep}${file.name}`;
          if (file.is_dir) {
            await TauriAPI.acceleratedCopyDirectory(file.path, destPath);
          } else {
            await TauriAPI.acceleratedCopyFile(file.path, destPath);
          }
          copied++;
        } catch (err) {
          toast({
            variant: 'destructive',
            title: 'Copy Failed',
            description: `Failed to copy "${file.name}": ${formatError(err)}`,
          });
        }
      }
      if (copied > 0) {
        toast({
          title: 'Copied',
          description: `Copied ${copied} file${copied !== 1 ? 's' : ''} to ${destination}`,
        });
        crossTabSelection.clearAll();
        refetch();
      }
    },
    [crossTabSelection, toast, refetch],
  );

  const handleCrossTabCompressAll = useCallback(
    async (destination: string) => {
      const allFiles = crossTabSelection.getAllSelectedFiles();
      const filePaths = allFiles.map(({ file }: { file: FileEntry }) => file.path);
      if (filePaths.length === 0) return;
      try {
        const sep = destination.includes('/') ? '/' : '\\';
        const archiveName = `batch-${Date.now()}.zip`;
        const outputPath = `${destination}${sep}${archiveName}`;
        await TauriAPI.compressFiles(filePaths, outputPath, {
          format: 'Zip',
          compression_level: 6,
          include_hidden: false,
          follow_symlinks: false,
        });
        toast({
          title: 'Compressed',
          description: `Created ${archiveName} with ${filePaths.length} file${filePaths.length !== 1 ? 's' : ''}`,
        });
        crossTabSelection.clearAll();
        refetch();
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Compression Failed',
          description: formatError(err),
        });
      }
    },
    [crossTabSelection, toast, refetch],
  );

  const handleCrossTabDeleteAll = useCallback(async () => {
    const allFiles = crossTabSelection.getAllSelectedFiles();
    const confirmed = await showConfirmationToast({
      title: 'Delete All Cross-Tab Files',
      description: `Are you sure you want to move ${allFiles.length} file(s) from ${crossTabSelection.selectedTabCount} tab(s) to the recycle bin?`,
      confirmText: 'Move to Recycle Bin',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;
    let deleted = 0;
    for (const { file } of allFiles) {
      try {
        await TauriAPI.moveToTrash(file.path);
        deleted++;
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Delete Failed',
          description: `Failed to delete "${file.name}": ${formatError(err)}`,
        });
      }
    }
    if (deleted > 0) {
      toast({
        title: 'Deleted',
        description: `Moved ${deleted} file${deleted !== 1 ? 's' : ''} to recycle bin`,
      });
      crossTabSelection.clearAll();
      refetch();
    }
  }, [crossTabSelection, toast, refetch]);

  return {
    addTab,
    toggleFileSelection,
    handleFileClick,
    handleFileDoubleClick,
    openGDriveTab,
    openGDriveManager,
    handleCrossTabPickFolder,
    handleCrossTabMoveAll,
    handleCrossTabCopyAll,
    handleCrossTabCompressAll,
    handleCrossTabDeleteAll,
  };
};
