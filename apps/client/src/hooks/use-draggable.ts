import { useCallback, useRef } from 'react';
import { startDrag } from '@crabnebula/tauri-plugin-drag';
import { resolveResource } from '@tauri-apps/api/path';
import type { FileEntry } from '@/lib/tauri-api';
import { useDragDropContext } from '@/contexts/DragDropContext';

interface UseDraggableOptions {
  file: FileEntry;
  selectedFiles: Set<string>;
  allFiles: FileEntry[];
}

const DRAG_THRESHOLD = 5; // pixels before drag starts

let _dragIconPath: string | null = null;
const getDragIconPath = async (): Promise<string> => {
  if (_dragIconPath) return _dragIconPath;
  try {
    _dragIconPath = await resolveResource('icons/icon.png');
  } catch {
    _dragIconPath = '';
  }
  return _dragIconPath;
};

/**
 * Native drag hook using tauri-plugin-drag.
 * Uses mousedown/mousemove to detect drag intent, then calls startDrag()
 * which creates an OS-level drag operation (works for internal drops AND
 * dragging to desktop/other apps).
 */
export const useDraggable = ({ file, selectedFiles, allFiles }: UseDraggableOptions) => {
  const mouseDownRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const { startInternalDrag } = useDragDropContext();

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left button
    mouseDownRef.current = { x: e.clientX, y: e.clientY };
    draggingRef.current = false;
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!mouseDownRef.current || draggingRef.current) return;

      const dx = e.clientX - mouseDownRef.current.x;
      const dy = e.clientY - mouseDownRef.current.y;
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;

      draggingRef.current = true;
      mouseDownRef.current = null;

      // Determine which files to drag
      let pathsToDrag: string[];
      if (selectedFiles.has(file.path) && selectedFiles.size > 1) {
        pathsToDrag = allFiles.filter((f) => selectedFiles.has(f.path)).map((f) => f.path);
      } else {
        pathsToDrag = [file.path];
      }

      // Notify context this is an internal drag (default: move operation)
      startInternalDrag(pathsToDrag);

      // Start native Tauri drag — OS handles visuals + drop
      // When dropped back in our window, onDragDropEvent fires
      // When dropped on desktop/another app, OS handles it
      getDragIconPath().then((icon) => {
        startDrag({ item: pathsToDrag, icon }).catch((err) => {
          console.error('startDrag failed:', err);
        });
      });
    },
    [file.path, selectedFiles, allFiles, startInternalDrag],
  );

  const onMouseUp = useCallback(() => {
    mouseDownRef.current = null;
    draggingRef.current = false;
  }, []);

  const onMouseLeave = useCallback(() => {
    // If mouse leaves the element before threshold, cancel tracking
    if (!draggingRef.current) {
      mouseDownRef.current = null;
    }
  }, []);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
  };
};
