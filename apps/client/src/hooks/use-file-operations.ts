import { useState, useCallback, useMemo, useRef } from 'react';
import { TauriAPI, type FileEntry, type ConflictFileInfo } from '@/lib/tauri-api';
import { PATH_SEPARATOR, detectSep } from '@/lib/constants';
import { showConfirmationToast, showInputToast } from '@/components/ui/Toast';
import type { BatchOperationType } from '@/components/dialogs/BatchConfirmDialog';
import { invertSelection } from '@/extensions/advanced-selection/selection-utils';
import { ContextMenuFactory, type ContextMenuAction } from '@/lib/context-menu-factory';
import type { TabItem } from '@/types/split-view';
import type { ClipboardEntry } from '@/hooks/use-clipboard-history';
import {
  formatError,
  findCopyName,
  setClipboardEntries,
  resolveSelectedFiles,
  findUniqueFilePath,
  type ClipboardState,
} from '@/lib/file-operation-helpers';
import { executePaste, showPasteResultToast } from '@/lib/paste-helpers';
import type { BottomPanelTabId } from '@/hooks/use-layout-state';

// ── Re-exports (preserve public API) ─────────────────────────────────────────

export type { ClipboardState };
export { formatError };

// ── Types ────────────────────────────────────────────────────────────────────

interface UseFileOperationsDeps {
  currentPath: string;
  selectedFiles: Set<string>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  files: FileEntry[];
  refetch: () => void;
  toast: (opts: {
    title?: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }) => void;
  splitLayout: {
    addTab: (groupId: string, tab: TabItem, activate: boolean) => void;
  };
  activeGroupId: string;
  fileComparison: {
    markedFile: FileEntry | null;
    compareFiles: (file1: FileEntry, file2?: FileEntry) => void;
    markFileForComparison: (file: FileEntry) => void;
    clearComparisonMark: () => void;
  };
  /** Dialog openers from useDialogManager */
  dialogs: {
    openPropertiesDialog: (path: string) => void;
    openOpenWithDialog: (path: string) => void;
    openCompressDialog: (files: FileEntry[]) => void;
    openBulkRenameDialog: (files: FileEntry[]) => void;
    openExtractDialog: (path: string) => void;
    openFileTagsDialog: (path: string) => void;
    openFileDetailsDialog: (path: string, tab?: 'notes' | 'annotations' | 'metadata') => void;
    openEncryptionDialog: (filePath: string, mode: 'encrypt' | 'decrypt') => void;
    openSecureDeleteDialog: (files: FileEntry[]) => void;
    openVersionHistoryDialog: (path: string) => void;
    openSymlinkDialog: (targetPath: string) => void;
    openPasteRenameDialog: (files: FileEntry[]) => void;
    openTemplatePicker: () => void;
    openFolderCompare: (leftPath: string, rightPath: string) => void;
    setShowAdvancedSelect: (show: boolean) => void;
    openBatchConfirmDialog: (
      operation: BatchOperationType,
      files: FileEntry[],
      onConfirm: () => void,
      destination?: string,
    ) => void;
    openBatchMetadataDialog: (files: FileEntry[]) => void;
  };
  setBottomPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setBottomPanelTab: React.Dispatch<React.SetStateAction<BottomPanelTabId>>;
  setTerminalCwd: React.Dispatch<React.SetStateAction<string>>;
  setViewMode: React.Dispatch<React.SetStateAction<string>>;
  setSortBy: React.Dispatch<React.SetStateAction<string>>;
  setSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  navigateToPath: (path: string) => void;
  /** Called when paste detects a file name conflict. Returns the user's choice. */
  resolveConflict?: (
    fileName: string,
    isDir: boolean,
    destination: string,
    remaining: number,
    sourceInfo?: ConflictFileInfo | null,
    destInfo?: ConflictFileInfo | null,
  ) => Promise<{
    resolution: import('@/components/dialogs/FileConflictDialog').ConflictResolution;
    applyToAll: boolean;
  }>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useFileOperations = (deps: UseFileOperationsDeps) => {
  const {
    currentPath,
    selectedFiles,
    setSelectedFiles,
    files,
    toast,
    splitLayout,
    activeGroupId,
    fileComparison,
    dialogs,
    setBottomPanelCollapsed,
    setBottomPanelTab,
    setTerminalCwd,
    setViewMode,
    setSortBy,
    setSortOrder,
    navigateToPath,
    resolveConflict,
  } = deps;

  // Use refs so that memoized actions (useMemo with [] deps) always read
  // the latest values without re-creating the action bag.
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const resolveConflictRef = useRef(resolveConflict);
  resolveConflictRef.current = resolveConflict;
  const splitLayoutRef = useRef(splitLayout);
  splitLayoutRef.current = splitLayout;
  const activeGroupIdRef = useRef(activeGroupId);
  activeGroupIdRef.current = activeGroupId;
  const fileComparisonRef = useRef(fileComparison);
  fileComparisonRef.current = fileComparison;
  const dialogsRef = useRef(dialogs);
  dialogsRef.current = dialogs;
  const filesRef = useRef(files);
  filesRef.current = files;
  const selectedFilesRef = useRef(selectedFiles);
  selectedFilesRef.current = selectedFiles;
  const setSelectedFilesRef = useRef(setSelectedFiles);
  setSelectedFilesRef.current = setSelectedFiles;
  const setBottomPanelCollapsedRef = useRef(setBottomPanelCollapsed);
  setBottomPanelCollapsedRef.current = setBottomPanelCollapsed;
  const setBottomPanelTabRef = useRef(setBottomPanelTab);
  setBottomPanelTabRef.current = setBottomPanelTab;
  const setTerminalCwdRef = useRef(setTerminalCwd);
  setTerminalCwdRef.current = setTerminalCwd;
  const setViewModeRef = useRef(setViewMode);
  setViewModeRef.current = setViewMode;
  const setSortByRef = useRef(setSortBy);
  setSortByRef.current = setSortBy;
  const setSortOrderRef = useRef(setSortOrder);
  setSortOrderRef.current = setSortOrder;
  const navigateToPathRef = useRef(navigateToPath);
  navigateToPathRef.current = navigateToPath;

  /** Notify the app that files changed */
  const emitFilesChanged = useCallback(() => {
    window.dispatchEvent(new CustomEvent('files-changed'));
  }, []);

  /** Dispatch an activity feed event for the activity panel */
  const emitFileActivity = useCallback(
    (type: string, path: string, name?: string, oldPath?: string) => {
      window.dispatchEvent(
        new CustomEvent('file-activity', {
          detail: {
            type,
            path,
            name: name || path.replace(/\\/g, '/').split('/').pop() || path,
            oldPath,
          },
        }),
      );
    },
    [],
  );

  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const clipboardRef = useRef<ClipboardState | null>(null);
  const setClipboardBoth = useCallback((val: ClipboardState | null) => {
    clipboardRef.current = val;
    setClipboard(val);
  }, []);

  // ── Shared paste executor ──────────────────────────────────────────────

  /** Run the paste pipeline for the given clipboard against a target directory. */
  const runPaste = useCallback(
    async (cb: ClipboardState, targetPath: string) => {
      const isCut = cb.operation === 'cut';

      const doPaste = async () => {
        const result = await executePaste({
          files: cb.files,
          operation: cb.operation,
          targetPath,
          resolveConflict: resolveConflictRef.current,
          emitFileActivity,
          emitFilesChanged,
        });

        if (isCut && result.succeeded > 0) {
          setClipboardBoth(null);
          contextMenuFactoryRef.current.clearClipboard();
        }

        showPasteResultToast(result, toastRef.current);
      };

      if (isCut && cb.files.length > 1) {
        dialogsRef.current.openBatchConfirmDialog('move', cb.files, doPaste, targetPath);
      } else {
        await doPaste();
      }
    },
    [emitFileActivity, emitFilesChanged, setClipboardBoth],
  );

  // Refs for stable callbacks so the useMemo below never needs to re-create
  const emitFileActivityRef = useRef(emitFileActivity);
  emitFileActivityRef.current = emitFileActivity;
  const emitFilesChangedRef = useRef(emitFilesChanged);
  emitFilesChangedRef.current = emitFilesChanged;
  const setClipboardBothRef = useRef(setClipboardBoth);
  setClipboardBothRef.current = setClipboardBoth;
  const runPasteRef = useRef(runPaste);
  runPasteRef.current = runPaste;

  // ── Context-menu action bag ────────────────────────────────────────────

  const contextMenuActions: ContextMenuAction = useMemo(
    () => ({
      openFile: async (file: FileEntry) => {
        if (file.is_dir) {
          navigateToPathRef.current(file.path);
        } else {
          try {
            await TauriAPI.openFile(file.path);
          } catch (error) {
            toastRef.current({
              title: 'Open failed',
              description: `Failed to open "${file.name}": ${formatError(error)}`,
              variant: 'destructive',
            });
          }
        }
      },
      openInNewTab: (file: FileEntry) => {
        const newTab: TabItem = {
          id: `${file.path}-${Date.now()}`,
          name: file.name,
          path: file.path,
          type: file.is_dir ? 'folder' : 'file',
        };
        splitLayoutRef.current.addTab(activeGroupIdRef.current, newTab, true);
      },
      openInEditor: (file: FileEntry) => {
        const editorTab: TabItem = {
          id: `editor-${file.path}-${Date.now()}`,
          name: file.name,
          path: file.path,
          type: 'editor',
        };
        splitLayoutRef.current.addTab(activeGroupIdRef.current, editorTab, true);
      },

      // ── Clipboard operations ───────────────────────────────────────────
      copy: (filesToCopy: FileEntry[]) => {
        setClipboardEntries(
          filesToCopy,
          'copy',
          setClipboardBothRef.current,
          (f, op) => contextMenuFactoryRef.current.updateClipboard(f, op),
          (opts) =>
            toastRef.current({
              ...opts,
              description: `${filesToCopy.length} item${filesToCopy.length > 1 ? 's' : ''} copied to clipboard`,
            }),
        );
      },
      cut: (filesToCut: FileEntry[]) => {
        setClipboardEntries(
          filesToCut,
          'cut',
          setClipboardBothRef.current,
          (f, op) => contextMenuFactoryRef.current.updateClipboard(f, op),
          (opts) =>
            toastRef.current({
              ...opts,
              description: `${filesToCut.length} item${filesToCut.length > 1 ? 's' : ''} cut to clipboard`,
            }),
        );
      },
      paste: async (targetPath: string) => {
        const currentClipboard = clipboardRef.current;
        if (!currentClipboard) {
          toastRef.current({
            title: 'Nothing to paste',
            description: 'Clipboard is empty',
            variant: 'destructive',
          });
          return;
        }
        await runPasteRef.current(currentClipboard, targetPath);
      },

      // ── Delete / rename / create ───────────────────────────────────────
      delete: async (filesToDelete: FileEntry[]) => {
        const doDelete = async () => {
          try {
            for (const file of filesToDelete) {
              await TauriAPI.moveToTrash(file.path);
              emitFileActivityRef.current('remove', file.path, file.name);
            }
            setSelectedFilesRef.current(new Set());
            emitFilesChangedRef.current();
            toastRef.current({
              title: 'Deleted',
              description: `${filesToDelete.length} item${filesToDelete.length > 1 ? 's' : ''} deleted successfully`,
            });
          } catch (error) {
            console.error('Delete operation failed:', error);
            toastRef.current({
              title: 'Delete failed',
              description: `Failed to delete items: ${formatError(error)}`,
              variant: 'destructive',
            });
          }
        };

        if (filesToDelete.length > 1) {
          dialogsRef.current.openBatchConfirmDialog('delete', filesToDelete, doDelete);
        } else {
          const result = await showConfirmationToast({
            title: 'Delete File',
            description: `Are you sure you want to delete "${filesToDelete[0]?.name}"?`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
          });
          if (result) await doDelete();
        }
      },
      rename: async (file: FileEntry) => {
        const newName = await showInputToast({
          title: 'Rename',
          description: 'Enter new name:',
          placeholder: file.name,
          submitText: 'Rename',
          cancelText: 'Cancel',
        });
        if (newName && newName !== file.name) {
          try {
            const pathParts = file.path.split(/[\\/]/);
            pathParts[pathParts.length - 1] = newName;
            const newPath = pathParts.join(PATH_SEPARATOR);
            await TauriAPI.rename(file.path, newPath);
            emitFileActivityRef.current('file-renamed', newPath, newName, file.path);
            emitFilesChangedRef.current();
            toastRef.current({ title: 'Renamed', description: `Renamed to ${newName}` });
          } catch (error) {
            console.error('Rename operation failed:', error);
            toastRef.current({
              title: 'Rename failed',
              description: `Failed to rename item: ${formatError(error)}`,
              variant: 'destructive',
            });
          }
        }
      },
      createFolder: async (parentPath: string) => {
        const folderName = await showInputToast({
          title: 'New Folder',
          description: 'Enter folder name:',
          placeholder: 'New Folder',
          submitText: 'Create',
          cancelText: 'Cancel',
        });
        if (folderName) {
          try {
            const folderPath = `${parentPath}${parentPath.endsWith(PATH_SEPARATOR) ? '' : PATH_SEPARATOR}${folderName}`;
            await TauriAPI.createDirRecursive(folderPath);
            emitFileActivityRef.current('create', folderPath, folderName);
            emitFilesChangedRef.current();
            toastRef.current({
              title: 'Folder created',
              description: `Created folder "${folderName}"`,
            });
          } catch (error) {
            console.error('Create folder operation failed:', error);
            toastRef.current({
              title: 'Create folder failed',
              description: `Failed to create folder: ${formatError(error)}`,
              variant: 'destructive',
            });
          }
        }
      },
      createFile: async (parentPath: string) => {
        const fileName = await showInputToast({
          title: 'New File',
          description: 'Enter file name:',
          placeholder: 'New File.txt',
          submitText: 'Create',
          cancelText: 'Cancel',
        });
        if (fileName) {
          try {
            const filePath = `${parentPath}${parentPath.endsWith(PATH_SEPARATOR) ? '' : PATH_SEPARATOR}${fileName}`;
            await TauriAPI.createFile(filePath);
            emitFileActivityRef.current('create', filePath, fileName);
            emitFilesChangedRef.current();
            toastRef.current({ title: 'File created', description: `Created file "${fileName}"` });
          } catch (error) {
            console.error('Create file operation failed:', error);
            toastRef.current({
              title: 'Create file failed',
              description: `Failed to create file: ${formatError(error)}`,
              variant: 'destructive',
            });
          }
        }
      },

      // ── Simple dialog / action delegates ───────────────────────────────
      properties: (file: FileEntry) => {
        dialogsRef.current.openPropertiesDialog(file.path);
        setBottomPanelCollapsedRef.current(false);
        setBottomPanelTabRef.current('properties');
      },
      refresh: () => {
        emitFilesChangedRef.current();
        toastRef.current({ title: 'Refreshed', description: 'Directory refreshed' });
      },
      selectAll: () => {
        const allFilePaths = new Set(filesRef.current.map((f) => f.path));
        setSelectedFilesRef.current(allFilePaths);
        toastRef.current({
          title: 'Selected all',
          description: `Selected ${filesRef.current.length} items`,
        });
      },
      invertSelection: () => {
        const inverted = invertSelection(filesRef.current, selectedFilesRef.current);
        setSelectedFilesRef.current(new Set(inverted));
        toastRef.current({
          title: 'Selection Inverted',
          description: `Now selecting ${inverted.length} of ${filesRef.current.length} items`,
        });
      },
      openAdvancedSelection: () => {
        dialogsRef.current.setShowAdvancedSelect(true);
      },
      copyPath: (file: FileEntry) => {
        navigator.clipboard.writeText(file.path);
        toastRef.current({ title: 'Path copied', description: 'File path copied to clipboard' });
      },
      openInTerminal: (path: string) => {
        // Always open the built-in terminal panel immediately
        setBottomPanelCollapsedRef.current(false);
        setBottomPanelTabRef.current('terminal');
        setTerminalCwdRef.current(path);
        toastRef.current({ title: 'Terminal opened', description: `Terminal opened at ${path}` });
      },
      openRecycleBin: async () => {
        try {
          await TauriAPI.openRecycleBin();
          toastRef.current({
            title: 'Recycle Bin Opened',
            description: 'Your OS recycle bin has been opened',
          });
        } catch (error) {
          console.error('Failed to open recycle bin:', error);
          toastRef.current({
            title: 'Failed to open recycle bin',
            description: `Failed to open recycle bin: ${formatError(error)}`,
            variant: 'destructive',
          });
        }
      },
      openWith: (file: FileEntry) => {
        dialogsRef.current.openOpenWithDialog(file.path);
      },
      compressTo: (filesToCompress: FileEntry[]) => {
        dialogsRef.current.openCompressDialog(filesToCompress);
      },
      bulkRename: (filesToRename: FileEntry[]) => {
        dialogsRef.current.openBulkRenameDialog(filesToRename);
      },
      extractHere: (file: FileEntry) => {
        dialogsRef.current.openExtractDialog(file.path);
      },
      compareFiles: (file1: FileEntry, file2?: FileEntry) => {
        if (file2) {
          const comparisonTab: TabItem = {
            id: `comparison-${Date.now()}`,
            name: `${file1.name} \u2194 ${file2.name}`,
            path: `comparison://${file1.path}|${file2.path}`,
            type: 'comparison',
            comparisonData: { file1Path: file1.path, file2Path: file2.path },
          };
          splitLayoutRef.current.addTab(activeGroupIdRef.current, comparisonTab, true);
          fileComparisonRef.current.clearComparisonMark();
        } else {
          fileComparisonRef.current.compareFiles(file1, file2);
        }
      },
      markForComparison: (file: FileEntry) => {
        fileComparisonRef.current.markFileForComparison(file);
      },
      manageTags: (file: FileEntry) => {
        dialogsRef.current.openFileTagsDialog(file.path);
      },
      openFileDetails: (file: FileEntry, tab?: 'notes' | 'annotations' | 'metadata') => {
        dialogsRef.current.openFileDetailsDialog(file.path, tab);
      },
      encryptFile: (file: FileEntry) => {
        dialogsRef.current.openEncryptionDialog(file.path, 'encrypt');
      },
      decryptFile: (file: FileEntry) => {
        dialogsRef.current.openEncryptionDialog(file.path, 'decrypt');
      },
      secureDelete: (filesToDelete: FileEntry[]) => {
        dialogsRef.current.openSecureDeleteDialog(filesToDelete);
      },
      versionHistory: (file: FileEntry) => {
        dialogsRef.current.openVersionHistoryDialog(file.path);
      },
      duplicateFiles: async (filesToDuplicate: FileEntry[]) => {
        let duplicated = 0;
        for (const file of filesToDuplicate) {
          try {
            const sep = detectSep(file.path);
            const lastSepIdx = file.path.lastIndexOf(sep);
            const parentDir = file.path.substring(0, lastSepIdx);
            const dest = await findCopyName(parentDir, file.name, sep);
            await TauriAPI.acceleratedCopyFile(file.path, dest);
            emitFileActivityRef.current('create', dest);
            duplicated++;
          } catch (error) {
            toastRef.current({
              title: 'Duplicate failed',
              description: `Failed to duplicate "${file.name}": ${formatError(error)}`,
              variant: 'destructive',
            });
          }
        }
        if (duplicated > 0) {
          emitFilesChangedRef.current();
          toastRef.current({
            title: 'Duplicated',
            description: `Duplicated ${duplicated} item${duplicated > 1 ? 's' : ''}`,
          });
        }
      },
      copyName: (file: FileEntry) => {
        navigator.clipboard.writeText(file.name);
        toastRef.current({
          title: 'Name copied',
          description: `"${file.name}" copied to clipboard`,
        });
      },
      pinToSidebar: async (file: FileEntry) => {
        try {
          await TauriAPI.addBookmark(file.path, file.name);
          window.dispatchEvent(new CustomEvent('bookmarks-changed'));
          toastRef.current({
            title: 'Pinned to Sidebar',
            description: `"${file.name}" added to sidebar bookmarks`,
          });
        } catch (error) {
          toastRef.current({
            title: 'Pin failed',
            description: `Failed to pin "${file.name}": ${formatError(error)}`,
            variant: 'destructive',
          });
        }
      },
      createNewTextFile: async (parentPath: string) => {
        try {
          const filePath = await findUniqueFilePath(parentPath, 'New Text File', '.txt');
          await TauriAPI.createFile(filePath);
          const name = filePath.split(/[/\\]/).pop() || 'New Text File.txt';
          emitFileActivityRef.current('create', filePath, name);
          emitFilesChangedRef.current();
          toastRef.current({ title: 'File created', description: `Created "${name}"` });
        } catch (error) {
          toastRef.current({
            title: 'Create file failed',
            description: `Failed to create file: ${formatError(error)}`,
            variant: 'destructive',
          });
        }
      },
      createNewFile: async (parentPath: string) => {
        const fileName = await showInputToast({
          title: 'New File',
          description: 'Enter file name:',
          placeholder: 'filename.ext',
          submitText: 'Create',
          cancelText: 'Cancel',
        });
        if (fileName) {
          try {
            const sep = detectSep(parentPath);
            const filePath = `${parentPath}${parentPath.endsWith(sep) ? '' : sep}${fileName}`;
            await TauriAPI.createFile(filePath);
            emitFileActivityRef.current('create', filePath, fileName);
            emitFilesChangedRef.current();
            toastRef.current({ title: 'File created', description: `Created "${fileName}"` });
          } catch (error) {
            toastRef.current({
              title: 'Create file failed',
              description: `Failed to create file: ${formatError(error)}`,
              variant: 'destructive',
            });
          }
        }
      },
      openTemplatePicker: (_parentPath: string) => {
        dialogsRef.current.openTemplatePicker();
      },
      pasteFromHistory: (targetPath: string, entry: ClipboardEntry) => {
        const fileEntries: FileEntry[] = entry.files.map((f) => ({
          path: f.path,
          name: f.name,
          size: 0,
          modified: 0,
          is_dir: f.isDir,
          file_type: f.isDir ? 'folder' : f.name.split('.').pop() || '',
          is_readonly: false,
        }));
        setClipboardBothRef.current({ files: fileEntries, operation: entry.operation });
        contextMenuFactoryRef.current.updateClipboard(fileEntries, entry.operation);
        queueMicrotask(() => {
          contextMenuActions.paste(targetPath);
        });
      },
      createSymlink: (file: FileEntry) => {
        dialogsRef.current.openSymlinkDialog(file.path);
      },
      openPasteRename: (files: FileEntry[]) => {
        dialogsRef.current.openPasteRenameDialog(files);
      },
      openBatchMetadata: (files: FileEntry[]) => {
        dialogsRef.current.openBatchMetadataDialog(files);
      },
      compareFolders: (leftPath: string, rightPath: string) => {
        dialogsRef.current.openFolderCompare(leftPath, rightPath);
      },
      setViewMode: (mode: string) => {
        setViewModeRef.current(mode);
      },
      setSortBy: (field: string) => {
        setSortByRef.current(field);
      },
      setSortOrder: (order: 'asc' | 'desc') => {
        setSortOrderRef.current(order);
      },
      lockFile: async (file: FileEntry) => {
        try {
          // Unix: 444 (read-only for owner/group/others), Windows: 'readonly'
          const permissions = /^[a-zA-Z]:\\/.test(file.path) ? 'readonly' : '444';
          await TauriAPI.setFilePermissions(file.path, permissions);
          emitFilesChangedRef.current();
          toastRef.current({
            title: 'File locked',
            description: `"${file.name}" is now read-only`,
          });
        } catch (error) {
          toastRef.current({
            title: 'Lock failed',
            description: `Failed to lock "${file.name}": ${formatError(error)}`,
            variant: 'destructive',
          });
        }
      },
      unlockFile: async (file: FileEntry) => {
        try {
          // Unix: 644 (owner can write, group/others read), Windows: 'writable'
          const permissions = /^[a-zA-Z]:\\/.test(file.path) ? 'writable' : '644';
          await TauriAPI.setFilePermissions(file.path, permissions);
          emitFilesChangedRef.current();
          toastRef.current({
            title: 'File unlocked',
            description: `"${file.name}" is now writable`,
          });
        } catch (error) {
          toastRef.current({
            title: 'Unlock failed',
            description: `Failed to unlock "${file.name}": ${formatError(error)}`,
            variant: 'destructive',
          });
        }
      },
    }),
    [],
  );

  // ── Context menu factory ───────────────────────────────────────────────

  const contextMenuFactoryRef = useRef<ContextMenuFactory>(null!);
  const contextMenuFactory = useMemo(
    () =>
      new ContextMenuFactory(contextMenuActions, {
        showHidden: false,
        enableCompression: true,
        enableAdvanced: true,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  contextMenuFactoryRef.current = contextMenuFactory;

  // ── Standalone operation handlers (used by OperationBar, shortcuts, etc.) ──

  const handleDelete = useCallback(async () => {
    if (selectedFiles.size === 0) return;

    const doDelete = async () => {
      try {
        for (const filePath of Array.from(selectedFiles)) {
          await TauriAPI.moveToTrash(filePath);
          emitFileActivity('remove', filePath);
        }
        setSelectedFiles(new Set());
        emitFilesChanged();
        toast({
          title: 'Moved to Recycle Bin',
          description: `Successfully moved ${selectedFiles.size} item(s) to recycle bin`,
        });
      } catch (error) {
        console.error('Failed to move files to trash:', error);
        toast({
          variant: 'destructive',
          title: 'Move to Recycle Bin Failed',
          description: `Failed to move some files to recycle bin: ${formatError(error)}`,
        });
      }
    };

    if (selectedFiles.size > 1) {
      const selectedEntries = resolveSelectedFiles(selectedFiles, files);
      dialogs.openBatchConfirmDialog('delete', selectedEntries, doDelete);
    } else {
      const confirmed = await showConfirmationToast({
        title: 'Move to Recycle Bin',
        description: `Are you sure you want to move this item to the recycle bin?`,
        confirmText: 'Move to Recycle Bin',
        cancelText: 'Cancel',
      });
      if (confirmed) await doDelete();
    }
  }, [selectedFiles, setSelectedFiles, files, emitFilesChanged, emitFileActivity, toast, dialogs]);

  const handleCreateFolder = useCallback(async () => {
    const folderName = await showInputToast({
      title: 'Create New Folder',
      description: 'Enter a name for the new folder',
      placeholder: 'Folder name',
      submitText: 'Create',
      cancelText: 'Cancel',
    });
    if (!folderName) return;
    try {
      const newFolderPath =
        currentPath + (currentPath.endsWith(PATH_SEPARATOR) ? '' : PATH_SEPARATOR) + folderName;
      await TauriAPI.createDirRecursive(newFolderPath);
      emitFileActivity('create', newFolderPath, folderName);
      emitFilesChanged();
      toast({
        title: 'Folder Created',
        description: `Successfully created folder "${folderName}"`,
      });
    } catch (error) {
      console.error('Failed to create folder:', error);
      toast({
        variant: 'destructive',
        title: 'Create Folder Failed',
        description: `Failed to create folder: ${formatError(error)}`,
      });
    }
  }, [currentPath, emitFileActivity, emitFilesChanged, toast]);

  // ── Shortcut clipboard handlers ────────────────────────────────────────

  const copySelectedFiles = useCallback(() => {
    const selected = resolveSelectedFiles(selectedFiles, files);
    if (selected.length > 0) {
      setClipboardEntries(
        selected,
        'copy',
        setClipboardBoth,
        (f, op) => contextMenuFactoryRef.current.updateClipboard(f, op),
        toast,
      );
    }
  }, [selectedFiles, files, toast, setClipboardBoth]);

  const cutSelectedFiles = useCallback(() => {
    const selected = resolveSelectedFiles(selectedFiles, files);
    if (selected.length > 0) {
      setClipboardEntries(
        selected,
        'cut',
        setClipboardBoth,
        (f, op) => contextMenuFactoryRef.current.updateClipboard(f, op),
        toast,
      );
    }
  }, [selectedFiles, files, toast, setClipboardBoth]);

  const pasteFiles = useCallback(async () => {
    const cb = clipboardRef.current;
    if (!cb || cb.files.length === 0) return;
    await runPaste(cb, currentPath);
  }, [currentPath, runPaste]);

  const deleteSelectedFiles = useCallback(async () => {
    const selectedFilesArray = Array.from(selectedFiles);
    if (selectedFilesArray.length > 0) {
      try {
        for (const filePath of selectedFilesArray) {
          await TauriAPI.moveToTrash(filePath);
          emitFileActivity('remove', filePath);
        }
        toastRef.current({
          title: 'Deleted',
          description: `${selectedFilesArray.length} item${selectedFilesArray.length > 1 ? 's' : ''} moved to trash`,
        });
        setSelectedFiles(new Set());
        emitFilesChanged();
      } catch (error) {
        toastRef.current({
          title: 'Error',
          description: `Failed to delete: ${formatError(error)}`,
          variant: 'destructive',
        });
      }
    }
  }, [selectedFiles, setSelectedFiles, emitFileActivity, emitFilesChanged]);

  const createFileFromTemplate = useCallback(
    async (filename: string, content: string) => {
      try {
        const sep = detectSep(currentPath);
        const filePath = `${currentPath}${currentPath.endsWith(sep) ? '' : sep}${filename}`;
        await TauriAPI.createFileWithContent(filePath, content);
        emitFileActivity('create', filePath, filename);
        emitFilesChanged();
        toast({ title: 'File created', description: `Created "${filename}" from template` });
      } catch (error) {
        console.error('Failed to create file from template:', error);
        toast({
          title: 'Create file failed',
          description: `Failed to create file: ${formatError(error)}`,
          variant: 'destructive',
        });
      }
    },
    [currentPath, emitFileActivity, emitFilesChanged, toast],
  );

  const renameFileInline = useCallback(
    async (oldPath: string, newName: string): Promise<boolean> => {
      try {
        const sep = detectSep(oldPath);
        const lastSepIdx = oldPath.lastIndexOf(sep);
        const parentDir = oldPath.substring(0, lastSepIdx);
        const newPath = `${parentDir}${sep}${newName}`;
        await TauriAPI.rename(oldPath, newPath);
        const oldName = oldPath.substring(lastSepIdx + 1);
        emitFileActivity('file-renamed', newPath, newName, oldPath);
        emitFilesChanged();
        toast({ title: 'Renamed', description: `"${oldName}" \u2192 "${newName}"` });
        return true;
      } catch (error) {
        console.error('Inline rename failed:', error);
        toast({
          variant: 'destructive',
          title: 'Rename Failed',
          description: `Failed to rename: ${formatError(error)}`,
        });
        return false;
      }
    },
    [emitFilesChanged, emitFileActivity, toast],
  );

  return {
    clipboard,
    setClipboard,
    contextMenuActions,
    contextMenuFactory,
    contextMenuFactoryRef,
    handleDelete,
    handleCreateFolder,
    copySelectedFiles,
    cutSelectedFiles,
    pasteFiles,
    deleteSelectedFiles,
    createFileFromTemplate,
    renameFileInline,
    formatError,
  };
};
