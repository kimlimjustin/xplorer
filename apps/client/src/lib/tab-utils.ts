import { FolderClosed, File, FileCode, GitCompareArrows, Cloud } from 'lucide-react';
import type { TabItem } from '@/types/split-view';

/** Return the appropriate lucide icon component for a given tab type. */
export const getTabIcon = (tab: TabItem) => {
  switch (tab.type) {
    case 'editor':
      return FileCode;
    case 'comparison':
      return GitCompareArrows;
    case 'gdrive':
    case 'gdrive-manager':
      return Cloud;
    case 'folder':
      return FolderClosed;
    default:
      return File;
  }
};
