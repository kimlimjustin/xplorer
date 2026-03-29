// Mock useDroppable for web context

import { useRef } from 'react';

export function useDroppable(_targetPath: string, _disabled?: boolean, _isFolder?: boolean) {
  return useRef<HTMLDivElement>(null);
}
