// Split view types (mirrors client/src/types/split-view.ts)

export interface TabItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder' | 'comparison' | 'gdrive' | 'gdrive-manager';
  isPinned?: boolean;
  pathHistory?: string[];
  historyIndex?: number;
  comparisonData?: {
    file1Path: string;
    file2Path: string;
  };
}
