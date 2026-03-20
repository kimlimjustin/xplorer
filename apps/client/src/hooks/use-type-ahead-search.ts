import { useRef, useEffect, useCallback } from 'react';
import type { FileEntry } from '@/lib/tauri-api';

interface UseTypeAheadSearchOptions {
  files: FileEntry[];
  viewMode: string;
  needsVirtualization: boolean;
  columns: number;
  virtualizer: { scrollToIndex: (index: number, options?: Record<string, unknown>) => void };
  getColumnsCount: () => number;
}

export const useTypeAheadSearch = ({
  files,
  viewMode: _viewMode,
  needsVirtualization,
  columns,
  virtualizer,
  getColumnsCount: _getColumnsCount,
}: UseTypeAheadSearchOptions) => {
  const searchBufferRef = useRef('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastMatchIndexRef = useRef(-1);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Arrow / Home / End / Enter / Space are handled by useGridKeyboardNav.
      // This handler only deals with type-ahead character search.
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();

        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }

        const char = e.key.toLowerCase();
        const container = e.currentTarget;

        const findAndActivate = (fileIndex: number) => {
          const file = files[fileIndex];
          if (!file) return;

          if (needsVirtualization) {
            const rowIndex = Math.floor(fileIndex / columns);
            virtualizer.scrollToIndex(rowIndex, { align: 'center' });
            requestAnimationFrame(() => {
              const el = container.querySelector<HTMLElement>(
                `[data-file-path="${CSS.escape(file.path)}"]`,
              );
              if (el) {
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                el.click();
                el.focus();
              }
            });
          } else {
            const el = container.querySelector<HTMLElement>(
              `[data-file-path="${CSS.escape(file.path)}"]`,
            );
            if (el) {
              el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              el.click();
              el.focus();
            }
          }
        };

        if (searchBufferRef.current === char) {
          const startIndex = lastMatchIndexRef.current + 1;
          let matchIndex = -1;
          for (let i = startIndex; i < files.length; i++) {
            if (files[i].name.toLowerCase().startsWith(char)) {
              matchIndex = i;
              break;
            }
          }
          if (matchIndex === -1) {
            for (let i = 0; i < files.length; i++) {
              if (files[i].name.toLowerCase().startsWith(char)) {
                matchIndex = i;
                break;
              }
            }
          }
          if (matchIndex !== -1) {
            lastMatchIndexRef.current = matchIndex;
            findAndActivate(matchIndex);
          }
        } else {
          searchBufferRef.current += char;
          const buffer = searchBufferRef.current;

          const matchIndex = files.findIndex((f) => f.name.toLowerCase().startsWith(buffer));
          if (matchIndex !== -1) {
            lastMatchIndexRef.current = matchIndex;
            findAndActivate(matchIndex);
          }
        }

        searchTimeoutRef.current = setTimeout(() => {
          searchBufferRef.current = '';
          lastMatchIndexRef.current = -1;
        }, 800);
      }
    },
    [files, needsVirtualization, virtualizer, columns],
  );

  return { handleGridKeyDown };
}
