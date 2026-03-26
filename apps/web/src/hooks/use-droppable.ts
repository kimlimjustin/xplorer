// Mock useDroppable for web context

import { useRef } from 'react';

export function useDroppable(_targetPath: string, _disabled?: boolean) {
  return useRef<HTMLDivElement>(null);
}
