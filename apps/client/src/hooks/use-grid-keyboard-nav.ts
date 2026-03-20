import { useCallback } from 'react';
import type { FileEntry } from '@/lib/tauri-api';

interface UseGridKeyboardNavOptions {
  files: FileEntry[];
  selectedFiles: Set<string>;
  columns: number;
  viewMode: string;
  getColumnsCount: () => number;
  handleFileClick: (file: FileEntry, event: React.MouseEvent) => void;
  handleFileDoubleClick: (file: FileEntry) => void;
  needsVirtualization: boolean;
  virtualizer: { scrollToIndex: (index: number, options?: Record<string, unknown>) => void };
  /** Called when Space is pressed on a focused file to show Quick Look. */
  onQuickLook?: (file: FileEntry) => void;
}

/**
 * Keyboard navigation for the file grid.
 *
 * Arrow keys move focus and update selection.
 * Shift+Arrow extends the selection range.
 * Home/End jump to first/last item.
 * Enter opens the focused item.
 * Space opens Quick Look preview for the focused item.
 */
export const useGridKeyboardNav = ({
  files,
  selectedFiles,
  columns,
  viewMode,
  getColumnsCount,
  handleFileClick,
  handleFileDoubleClick,
  needsVirtualization,
  virtualizer,
  onQuickLook,
}: UseGridKeyboardNavOptions) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Don't intercept when an input or textarea is focused
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const navKeys = [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
        'Enter',
        ' ',
      ];
      if (!navKeys.includes(e.key)) return;

      if (files.length === 0) return;
      e.preventDefault();

      const container = e.currentTarget;
      const items = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'));
      if (items.length === 0) return;

      // Find currently focused item index
      const focusedEl = (active as HTMLElement)?.closest?.('[role="option"]') as HTMLElement | null;
      let currentIndex = focusedEl ? items.indexOf(focusedEl) : -1;

      // If nothing is focused, start from the first selected item or 0
      if (currentIndex === -1) {
        if (selectedFiles.size > 0) {
          const firstSelected = files.findIndex((f) => selectedFiles.has(f.path));
          currentIndex = firstSelected >= 0 ? firstSelected : 0;
        } else {
          currentIndex = 0;
        }
      }

      // Handle Enter — open focused file
      if (e.key === 'Enter') {
        const file = files[currentIndex];
        if (file) handleFileDoubleClick(file);
        return;
      }

      // Handle Space — Quick Look preview of focused file
      if (e.key === ' ') {
        const file = files[currentIndex];
        if (file && onQuickLook) {
          onQuickLook(file);
        }
        return;
      }

      // Arrow / Home / End navigation
      const cols = viewMode === 'list' ? 1 : getColumnsCount();
      let nextIndex = currentIndex;

      switch (e.key) {
        case 'ArrowRight':
          nextIndex = Math.min(currentIndex + 1, items.length - 1);
          break;
        case 'ArrowLeft':
          nextIndex = Math.max(currentIndex - 1, 0);
          break;
        case 'ArrowDown':
          nextIndex = Math.min(currentIndex + cols, items.length - 1);
          break;
        case 'ArrowUp':
          nextIndex = Math.max(currentIndex - cols, 0);
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = items.length - 1;
          break;
      }

      if (nextIndex === currentIndex && e.key !== 'Home' && e.key !== 'End') return;

      const targetFile = files[nextIndex];
      if (!targetFile) return;

      if (e.shiftKey) {
        // Shift+Arrow: extend selection range from anchor to nextIndex
        handleFileClick(targetFile, {
          shiftKey: true,
          ctrlKey: false,
          metaKey: false,
        } as unknown as React.MouseEvent);
      } else {
        // Plain arrow: select single item (handleFileClick tracks anchor internally)
        handleFileClick(targetFile, {
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
        } as unknown as React.MouseEvent);
      }

      // Scroll virtualized row into view if needed
      if (needsVirtualization) {
        const rowIndex = Math.floor(nextIndex / columns);
        virtualizer.scrollToIndex(rowIndex, { align: 'center' });
      }

      // Focus the DOM element and scroll it into view
      requestAnimationFrame(() => {
        const targetEl =
          items[nextIndex] ||
          container.querySelector<HTMLElement>(`[data-file-path="${CSS.escape(targetFile.path)}"]`);
        if (targetEl) {
          targetEl.focus({ preventScroll: false });
          targetEl.scrollIntoView({ block: 'nearest' });
        }
      });
    },
    [
      files,
      selectedFiles,
      columns,
      viewMode,
      getColumnsCount,
      handleFileClick,
      handleFileDoubleClick,
      needsVirtualization,
      virtualizer,
      onQuickLook,
    ],
  );

  return { handleKeyDown };
}
