import { useRef, useEffect } from 'react';

/**
 * Hook that marks an element as a drop target by setting the
 * `data-drop-target` attribute. The actual drop detection is done
 * by DragDropContext using `document.elementFromPoint()` on
 * Tauri's onDragDropEvent position.
 *
 * When `isFolder` is true the element also gets `data-is-folder="true"`,
 * which lets DragDropContext start the spring-loaded folder timer (navigate
 * into a folder after 500ms of hovering while dragging).
 */
export const useDroppable = (targetPath: string, disabled?: boolean, isFolder?: boolean) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (disabled) {
      el.removeAttribute('data-drop-target');
      el.removeAttribute('data-is-folder');
    } else {
      el.setAttribute('data-drop-target', targetPath);
      if (isFolder) {
        el.setAttribute('data-is-folder', 'true');
      } else {
        el.removeAttribute('data-is-folder');
      }
    }
    return () => {
      el.removeAttribute('data-drop-target');
      el.removeAttribute('data-drop-hover');
      el.removeAttribute('data-drop-invalid');
      el.removeAttribute('data-is-folder');
    };
  }, [targetPath, disabled, isFolder]);

  return ref;
};
