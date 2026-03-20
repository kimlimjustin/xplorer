import { useState, useCallback, useEffect } from 'react';
import type { FileEntry } from '@/lib/tauri-api';
import type { ContextMenuItem } from '@/components/ui/ContextMenu';
import { ContextMenuFactory, contextMenuRegistry } from '@/lib/context-menu-factory';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClipboardState {
  files: FileEntry[];
  operation: 'copy' | 'cut';
}

interface UseContextMenuDeps {
  contextMenuFactoryRef: React.MutableRefObject<ContextMenuFactory>;
  selectedFiles: Set<string>;
  clipboard: ClipboardState | null;
  currentPath: string;
  markedFile: FileEntry | null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useContextMenu = (deps: UseContextMenuDeps) => {
  const { contextMenuFactoryRef, selectedFiles, clipboard, currentPath, markedFile } = deps;

  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuItems, setContextMenuItems] = useState<ContextMenuItem[]>([]);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [contextMenuFile, setContextMenuFile] = useState<FileEntry | null>(null);

  // Sync the comparison mark into the factory
  useEffect(() => {
    if (markedFile) {
      contextMenuFactoryRef.current.markFileForComparison(markedFile);
    } else {
      contextMenuFactoryRef.current.clearComparisonMark();
    }
  }, [markedFile, contextMenuFactoryRef]);

  // File right-click
  const handleFileRightClick = useCallback(
    (file: FileEntry, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenuFile(file);

      const baseMenuItems = contextMenuFactoryRef.current.getFileContextMenu(
        file,
        selectedFiles,
        clipboard,
      );
      const extensionItems = contextMenuRegistry.getFileActions(file, selectedFiles);
      const allMenuItems = [...baseMenuItems];
      if (extensionItems.length > 0) {
        allMenuItems.push({ id: 'sep-extensions', label: '', separator: true });
        allMenuItems.push(...extensionItems);
      }

      setContextMenuItems(allMenuItems);
      setContextMenuPosition({ x: event.clientX, y: event.clientY });
      setContextMenuVisible(true);
    },
    [contextMenuFactoryRef, selectedFiles, clipboard],
  );

  // Background right-click (empty space)
  const handleBackgroundRightClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenuFile(null);

      const baseMenuItems = contextMenuFactoryRef.current.getEmptySpaceContextMenu(
        currentPath,
        clipboard,
      );
      const extensionItems = contextMenuRegistry.getEmptySpaceActions(currentPath);
      const allMenuItems = [...baseMenuItems];
      if (extensionItems.length > 0) {
        allMenuItems.push({ id: 'sep-extensions', label: '', separator: true });
        allMenuItems.push(...extensionItems);
      }

      setContextMenuItems(allMenuItems);
      setContextMenuPosition({ x: event.clientX, y: event.clientY });
      setContextMenuVisible(true);
    },
    [contextMenuFactoryRef, currentPath, clipboard],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenuVisible(false);
  }, []);

  return {
    contextMenuVisible,
    contextMenuItems,
    contextMenuPosition,
    contextMenuFile,
    handleFileRightClick,
    handleBackgroundRightClick,
    closeContextMenu,
    // Expose setters for shared pane actions that need to build menus directly
    setContextMenuFile,
    setContextMenuItems,
    setContextMenuPosition,
    setContextMenuVisible,
  };
}
