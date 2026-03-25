// Mock useDraggable for web context (no-op — native drag requires Tauri)

import type { FileEntry } from '@/lib/tauri-api';

interface UseDraggableOptions {
  file: FileEntry;
  selectedFiles: Set<string>;
  allFiles: FileEntry[];
}

export function useDraggable(_options: UseDraggableOptions) {
  return {
    onMouseDown: () => {},
    onMouseMove: () => {},
    onMouseUp: () => {},
    onMouseLeave: () => {},
  };
}
