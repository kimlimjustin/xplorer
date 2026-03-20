/**
 * Types for the VS Code-style split/multi-pane editor system.
 *
 * Data model:
 *   SplitLayoutState
 *   ├── rootNode: SplitNode (recursive tree)
 *   ├── groups: Record<id, EditorGroup>
 *   └── activeGroupId: string
 *
 * SplitNode is either a "leaf" (references one EditorGroup) or a "split"
 * (horizontal/vertical container of child SplitNodes with proportional sizes).
 */

// ── Tab ──────────────────────────────────────────────────────────────────────

export interface TabItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder' | 'editor' | 'comparison' | 'gdrive' | 'gdrive-manager';
  isPinned?: boolean;
  /** Per-tab navigation history (saved/restored on tab switch) */
  pathHistory?: string[];
  historyIndex?: number;
  comparisonData?: {
    file1Path: string;
    file2Path: string;
  };
  gdriveData?: {
    accountId: string;
    folderId: string;
    folderName: string;
  };
}

// ── Editor Group (one pane with its own tab bar) ─────────────────────────────

export interface EditorGroup {
  id: string;
  tabs: TabItem[];
  activeTabId: string;
  /** Current directory path for this pane */
  currentPath: string;
  /** Navigation history for this pane */
  pathHistory: string[];
  historyIndex: number;
}

// ── Split Tree ───────────────────────────────────────────────────────────────

export interface LeafNode {
  type: 'leaf';
  groupId: string;
}

export interface SplitNodeBranch {
  type: 'split';
  direction: 'horizontal' | 'vertical';
  children: SplitNode[];
  /** Proportional sizes (0-1 fractions that sum to 1) */
  sizes: number[];
}

export type SplitNode = LeafNode | SplitNodeBranch;

// ── Layout State ─────────────────────────────────────────────────────────────

export interface SplitLayoutState {
  rootNode: SplitNode;
  groups: Record<string, EditorGroup>;
  activeGroupId: string;
  /** When set, only this group is rendered (others hidden). */
  maximizedGroupId: string | null;
  /** Stored sizes before maximize, keyed by the stringified path of the split nodes that were modified. */
  preMaximizeSizes?: Record<string, number[]>;
}

// ── Reducer Actions ──────────────────────────────────────────────────────────

export type SplitLayoutAction =
  | { type: 'SPLIT_GROUP'; groupId: string; direction: 'horizontal' | 'vertical' }
  | { type: 'CLOSE_GROUP'; groupId: string }
  | { type: 'SET_ACTIVE_GROUP'; groupId: string }
  | { type: 'ADD_TAB'; groupId: string; tab: TabItem; activate?: boolean }
  | { type: 'CLOSE_TAB'; groupId: string; tabId: string }
  | { type: 'TOGGLE_PIN_TAB'; groupId: string; tabId: string }
  | { type: 'SWITCH_TAB'; groupId: string; tabId: string }
  | { type: 'NAVIGATE'; groupId: string; path: string; name: string }
  | { type: 'NAVIGATE_BACK'; groupId: string }
  | { type: 'NAVIGATE_FORWARD'; groupId: string }
  | { type: 'RESIZE_SPLIT'; path: number[]; sizes: number[] }
  | { type: 'MOVE_TAB'; fromGroupId: string; tabId: string; toGroupId: string; toIndex?: number }
  | { type: 'REORDER_TAB'; groupId: string; fromIndex: number; toIndex: number }
  | { type: 'CLOSE_OTHER_TABS'; groupId: string; tabId: string }
  | { type: 'CLOSE_TABS_TO_RIGHT'; groupId: string; tabId: string }
  | { type: 'CLOSE_ALL_TABS'; groupId: string }
  | { type: 'DUPLICATE_TAB'; groupId: string; tabId: string }
  | { type: 'MAXIMIZE_PANE'; groupId: string }
  | { type: 'RESTORE_PANE' }
  | { type: 'REPLACE_STATE'; state: SplitLayoutState };

// ── Helpers ──────────────────────────────────────────────────────────────────

let _nextId = 1;
export const generateGroupId = () : string => {
  return `group-${Date.now()}-${_nextId++}`;
}

export const createDefaultGroup = (id?: string) : EditorGroup => {
  const groupId = id ?? generateGroupId();
  const homeTab: TabItem = {
    id: `tab-home-${groupId}`,
    name: 'Home',
    path: 'xplorer://home',
    type: 'folder',
    pathHistory: ['xplorer://home'],
    historyIndex: 0,
  };
  return {
    id: groupId,
    tabs: [homeTab],
    activeTabId: homeTab.id,
    currentPath: 'xplorer://home',
    pathHistory: ['xplorer://home'],
    historyIndex: 0,
  };
}

export const createDefaultLayout = () : SplitLayoutState => {
  const group = createDefaultGroup('default');
  return {
    rootNode: { type: 'leaf', groupId: group.id },
    groups: { [group.id]: group },
    activeGroupId: group.id,
    maximizedGroupId: null,
  };
}
