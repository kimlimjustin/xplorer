import { useRef, useEffect } from 'react';

/**
 * Hook that marks an element as a drop target by setting the
 * `data-drop-target` attribute. The actual drop detection is done
 * by DragDropContext using `document.elementFromPoint()` on
 * Tauri's onDragDropEvent position.
 */
export const useDroppable = (targetPath: string, disabled?: boolean) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (disabled) {
      el.removeAttribute('data-drop-target');
    } else {
      el.setAttribute('data-drop-target', targetPath);
    }
    return () => {
      el.removeAttribute('data-drop-target');
      el.removeAttribute('data-drop-hover');
      el.removeAttribute('data-drop-invalid');
    };
  }, [targetPath, disabled]);

  return ref;
};
