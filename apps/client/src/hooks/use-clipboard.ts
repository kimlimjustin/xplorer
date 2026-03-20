import { useState, useCallback } from 'react';
import { FileEntry } from '@/lib/tauri-api';

interface ClipboardState {
  files: FileEntry[];
  operation: 'copy' | 'cut';
}

export const useClipboard = () => {
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);

  const copyFiles = useCallback((files: FileEntry[]) => {
    setClipboard({ files, operation: 'copy' });
  }, []);

  const cutFiles = useCallback((files: FileEntry[]) => {
    setClipboard({ files, operation: 'cut' });
  }, []);

  const clearClipboard = useCallback(() => {
    setClipboard(null);
  }, []);

  return {
    clipboard,
    setClipboard,
    copyFiles,
    cutFiles,
    clearClipboard,
    hasClipboard: clipboard !== null,
  };
}
