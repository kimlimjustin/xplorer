// Mock DragDropContext for web context
'use client';

import React, { createContext, useContext } from 'react';

interface DragDropContextValue {
  startInternalDrag: (paths: string[]) => void;
  isDragging: boolean;
  dragPaths: string[];
}

const ctx = createContext<DragDropContextValue>({
  startInternalDrag: () => {},
  isDragging: false,
  dragPaths: [],
});

export function useDragDropContext() {
  return useContext(ctx);
}

export function DragDropProvider({ children }: { children: React.ReactNode }) {
  return (
    <ctx.Provider value={{ startInternalDrag: () => {}, isDragging: false, dragPaths: [] }}>
      {children}
    </ctx.Provider>
  );
}
