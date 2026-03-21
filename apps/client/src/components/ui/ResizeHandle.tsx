import React, { useCallback, useRef } from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
}

const ResizeHandle = ({ direction, onResize, onResizeEnd }: ResizeHandleProps) => {
  const isDragging = useRef(false);
  const lastPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return;
        const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
        const delta = currentPos - lastPos.current;
        lastPos.current = currentPos;
        if (delta !== 0) onResize(delta);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onResizeEnd?.();
      };

      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [direction, onResize, onResizeEnd],
  );

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`group flex-shrink-0 ${
        isHorizontal
          ? 'hover:bg-xp-blue/40 active:bg-xp-blue/60 w-1 cursor-col-resize'
          : 'hover:bg-xp-blue/40 active:bg-xp-blue/60 h-1 cursor-row-resize'
      } transition-colors`}
    />
  );
};

export default ResizeHandle;
