import { useReducer, useCallback, useEffect, useRef } from 'react';
import {
  generateGroupId,
  createDefaultLayout,
  type SplitLayoutState,
  type SplitLayoutAction,
  type SplitNode,
  type LeafNode,
  type SplitNodeBranch,
  type EditorGroup,
  type TabItem,
} from '@/types/split-view';
import { STORAGE_KEYS } from '@/lib/storage-keys';

// ── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = STORAGE_KEYS.SPLIT_LAYOUT;
const MAX_PATH_HISTORY = 200;

const loadLayout = (): SplitLayoutState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate: must be an object with expected shape
      if (typeof parsed !== 'object' || parsed === null || !parsed.rootNode || !parsed.groups) {
        console.warn('Invalid split layout data in localStorage, using defaults');
        return createDefaultLayout();
      }
      const typedParsed = parsed as SplitLayoutState;
      if (Object.keys(typedParsed.groups).length > 0) {
        const leafIds = collectGroupIds(typedParsed.rootNode);
        const allValid = leafIds.length > 0 && leafIds.every((id) => typedParsed.groups[id]);
        if (allValid) {
          // Migrate: backfill per-tab history for tabs that lack it
          for (const group of Object.values(typedParsed.groups)) {
            for (const tab of group.tabs) {
              if (!tab.pathHistory) {
                tab.pathHistory = [tab.path];
                tab.historyIndex = 0;
              }
            }
          }
          // Migrate: ensure maximizedGroupId field exists
          if (typedParsed.maximizedGroupId === undefined) {
            typedParsed.maximizedGroupId = null;
          }
          return typedParsed;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse stored split layout:', e);
  }
  return createDefaultLayout();
};

const saveLayout = (state: SplitLayoutState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save split layout (quota exceeded?):', e);
  }
};

// ── Tree Helpers ─────────────────────────────────────────────────────────────

/** Find the parent split node and index of a leaf with the given groupId */
const findLeafParent = (
  node: SplitNode,
  groupId: string,
  parent: SplitNodeBranch | null = null,
  index: number = 0,
): { parent: SplitNodeBranch | null; index: number; node: LeafNode } | null => {
  if (node.type === 'leaf') {
    if (node.groupId === groupId) return { parent, index, node };
    return null;
  }
  for (let i = 0; i < node.children.length; i++) {
    const result = findLeafParent(node.children[i], groupId, node, i);
    if (result) return result;
  }
  return null;
};

/** Update sizes at a specific path in the tree */
const updateSizesAtPath = (node: SplitNode, path: number[], sizes: number[]): SplitNode => {
  if (path.length === 0 && node.type === 'split') {
    return { ...node, sizes };
  }
  if (node.type === 'split' && path.length > 0) {
    const [head, ...rest] = path;
    const newChildren = [...node.children];
    newChildren[head] = updateSizesAtPath(newChildren[head], rest, sizes);
    return { ...node, children: newChildren };
  }
  return node;
};

/** Collect all leaf group IDs in tree order */
const collectGroupIds = (node: SplitNode): string[] => {
  if (node.type === 'leaf') return [node.groupId];
  return node.children.flatMap(collectGroupIds);
};

/** Clean up single-child split nodes (collapse unnecessary wrappers) */
const simplifyTree = (node: SplitNode): SplitNode => {
  if (node.type === 'leaf') return node;
  const simplified = node.children.map(simplifyTree);
  if (simplified.length === 1) return simplified[0];
  return { ...node, children: simplified };
};

// ── Reducer ──────────────────────────────────────────────────────────────────

const splitLayoutReducer = (
  state: SplitLayoutState,
  action: SplitLayoutAction,
): SplitLayoutState => {
  switch (action.type) {
    case 'SPLIT_GROUP': {
      const { groupId, direction } = action;
      const found = findLeafParent(state.rootNode, groupId);
      if (!found) return state;

      // Create new group, cloning the current group's path
      const sourceGroup = state.groups[groupId];
      const newGroupId = generateGroupId();
      const newGroup: EditorGroup = {
        id: newGroupId,
        tabs: [
          {
            id: `tab-home-${newGroupId}`,
            name: 'Home',
            path: sourceGroup?.currentPath ?? 'xplorer://home',
            type: 'folder',
          },
        ],
        activeTabId: `tab-home-${newGroupId}`,
        currentPath: sourceGroup?.currentPath ?? 'xplorer://home',
        pathHistory: [sourceGroup?.currentPath ?? 'xplorer://home'],
        historyIndex: 0,
      };

      const newLeaf: LeafNode = { type: 'leaf', groupId: newGroupId };
      const splitBranch: SplitNodeBranch = {
        type: 'split',
        direction,
        children: [found.node, newLeaf],
        sizes: [0.5, 0.5],
      };

      let newRoot: SplitNode;
      if (!found.parent) {
        // Root is the leaf being split
        newRoot = splitBranch;
      } else {
        // Replace the leaf in its parent
        newRoot = replaceChild(state.rootNode, found.parent, found.index, splitBranch);
      }

      return {
        ...state,
        rootNode: newRoot,
        groups: { ...state.groups, [newGroupId]: newGroup },
        activeGroupId: newGroupId,
      };
    }

    case 'CLOSE_GROUP': {
      const { groupId } = action;
      const allIds = collectGroupIds(state.rootNode);
      if (allIds.length <= 1) return state; // Don't close last pane

      const found = findLeafParent(state.rootNode, groupId);
      if (!found) return state;

      const newGroups = { ...state.groups };
      delete newGroups[groupId];

      let newRoot: SplitNode;
      if (!found.parent) {
        // Should not happen (we checked length > 1), but safety
        return state;
      }

      // Remove this leaf from its parent
      const newChildren = found.parent.children.filter((_, i) => i !== found.index);
      const newSizes = found.parent.sizes.filter((_, i) => i !== found.index);
      // Re-normalize sizes
      const total = newSizes.reduce((a, b) => a + b, 0);
      const normalizedSizes = newSizes.map((s) => s / total);

      if (newChildren.length === 1) {
        // Replace parent split node with remaining child
        newRoot = replaceNodeInTree(state.rootNode, found.parent, newChildren[0]);
      } else {
        const updatedParent: SplitNodeBranch = {
          ...found.parent,
          children: newChildren,
          sizes: normalizedSizes,
        };
        newRoot = replaceNodeInTree(state.rootNode, found.parent, updatedParent);
      }
      newRoot = simplifyTree(newRoot);

      // Pick new active group
      const remainingIds = collectGroupIds(newRoot);
      const newActiveId = remainingIds.includes(state.activeGroupId)
        ? state.activeGroupId
        : remainingIds[0];

      return {
        rootNode: newRoot,
        groups: newGroups,
        activeGroupId: newActiveId,
        maximizedGroupId: state.maximizedGroupId === action.groupId ? null : state.maximizedGroupId,
      };
    }

    case 'SET_ACTIVE_GROUP': {
      if (state.activeGroupId === action.groupId) return state;
      return { ...state, activeGroupId: action.groupId };
    }

    case 'ADD_TAB': {
      const { groupId, tab, activate } = action;
      const group = state.groups[groupId];
      if (!group) return state;

      const exists = group.tabs.find((t) => t.id === tab.id);
      if (exists) {
        // Tab already open — switch to it (save/restore history)
        if (activate !== false) {
          return splitLayoutReducer(state, { type: 'SWITCH_TAB', groupId, tabId: tab.id });
        }
        return state;
      }

      // Initialize per-tab history for the new tab
      const newTab = {
        ...tab,
        pathHistory: tab.pathHistory ?? [tab.path],
        historyIndex: tab.historyIndex ?? 0,
      };

      // If activating, save current tab's history first
      let updatedTabs = [...group.tabs];
      let newHistory = group.pathHistory;
      let newHistoryIndex = group.historyIndex;

      if (activate !== false) {
        // Save current tab's history
        updatedTabs = updatedTabs.map((t) =>
          t.id === group.activeTabId
            ? { ...t, pathHistory: group.pathHistory, historyIndex: group.historyIndex }
            : t,
        );
        // Restore new tab's history as group-level
        newHistory = newTab.pathHistory!;
        newHistoryIndex = newTab.historyIndex!;
      }

      const updatedGroup: EditorGroup = {
        ...group,
        tabs: [...updatedTabs, newTab],
        activeTabId: activate !== false ? newTab.id : group.activeTabId,
        currentPath: activate !== false ? newTab.path : group.currentPath,
        pathHistory: newHistory,
        historyIndex: newHistoryIndex,
      };
      return {
        ...state,
        groups: { ...state.groups, [groupId]: updatedGroup },
        activeGroupId: activate !== false ? groupId : state.activeGroupId,
      };
    }

    case 'CLOSE_TAB': {
      const { groupId, tabId } = action;
      const group = state.groups[groupId];
      if (!group) return state;

      // Prevent closing pinned tabs
      const tabToClose = group.tabs.find((t) => t.id === tabId);
      if (tabToClose?.isPinned) return state;

      if (group.tabs.length <= 1) {
        // Last tab — close the entire group if there are other groups
        const allIds = collectGroupIds(state.rootNode);
        if (allIds.length > 1) {
          return splitLayoutReducer(state, { type: 'CLOSE_GROUP', groupId });
        }
        return state; // Don't close the very last pane
      }

      const remaining = group.tabs.filter((t) => t.id !== tabId);
      let newActiveTabId = group.activeTabId;
      const wasActive = group.activeTabId === tabId;
      if (wasActive) {
        // Activate the last remaining tab
        newActiveTabId = remaining[remaining.length - 1].id;
      }

      const newActiveTab = remaining.find((t) => t.id === newActiveTabId);
      const updatedGroup: EditorGroup = {
        ...group,
        tabs: remaining,
        activeTabId: newActiveTabId,
        currentPath: newActiveTab?.path ?? group.currentPath,
        // Restore the new active tab's history if the closed tab was the active one
        pathHistory:
          wasActive && newActiveTab?.pathHistory ? newActiveTab.pathHistory : group.pathHistory,
        historyIndex:
          wasActive && newActiveTab?.historyIndex != null
            ? newActiveTab.historyIndex
            : group.historyIndex,
      };
      return {
        ...state,
        groups: { ...state.groups, [groupId]: updatedGroup },
      };
    }

    case 'TOGGLE_PIN_TAB': {
      const { groupId, tabId } = action;
      const group = state.groups[groupId];
      if (!group) return state;
      const newTabs = group.tabs.map((t) => (t.id === tabId ? { ...t, isPinned: !t.isPinned } : t));
      return {
        ...state,
        groups: { ...state.groups, [groupId]: { ...group, tabs: newTabs } },
      };
    }

    case 'SWITCH_TAB': {
      const { groupId, tabId } = action;
      const group = state.groups[groupId];
      if (!group) return state;
      if (group.activeTabId === tabId) {
        // Already on this tab, just ensure group is active
        if (state.activeGroupId === groupId) return state;
        return { ...state, activeGroupId: groupId };
      }

      const tab = group.tabs.find((t) => t.id === tabId);
      if (!tab) return state;

      // Save current tab's history, restore target tab's history
      const updatedTabs = group.tabs.map((t) => {
        if (t.id === group.activeTabId) {
          // Save outgoing tab's history
          return { ...t, pathHistory: group.pathHistory, historyIndex: group.historyIndex };
        }
        return t;
      });

      const restoredHistory = tab.pathHistory ?? [tab.path];
      const restoredIndex = tab.historyIndex ?? 0;

      return {
        ...state,
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            tabs: updatedTabs,
            activeTabId: tabId,
            currentPath: tab.path,
            pathHistory: restoredHistory,
            historyIndex: restoredIndex,
          },
        },
        activeGroupId: groupId,
      };
    }

    case 'NAVIGATE': {
      const { groupId, path, name } = action;
      const group = state.groups[groupId];
      if (!group || path === group.currentPath) return state;

      // Trim forward history and push (cap to MAX_PATH_HISTORY)
      let newHistory = group.pathHistory.slice(0, group.historyIndex + 1);
      newHistory.push(path);
      let newHistoryIndex = newHistory.length - 1;
      if (newHistory.length > MAX_PATH_HISTORY) {
        const excess = newHistory.length - MAX_PATH_HISTORY;
        newHistory = newHistory.slice(excess);
        newHistoryIndex = newHistory.length - 1;
      }

      // Update the active tab's path + per-tab history
      const updatedTabs = group.tabs.map((t) =>
        t.id === group.activeTabId
          ? {
              ...t,
              path,
              name: name || t.name,
              pathHistory: newHistory,
              historyIndex: newHistoryIndex,
            }
          : t,
      );

      return {
        ...state,
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            tabs: updatedTabs,
            currentPath: path,
            pathHistory: newHistory,
            historyIndex: newHistoryIndex,
          },
        },
        activeGroupId: groupId,
      };
    }

    case 'NAVIGATE_BACK': {
      const { groupId } = action;
      const group = state.groups[groupId];
      if (!group || group.historyIndex <= 0) return state;

      const newIndex = group.historyIndex - 1;
      const newPath = group.pathHistory[newIndex];
      const newName = newPath.split(/[/\\]/).pop() || newPath;

      const updatedTabs = group.tabs.map((t) =>
        t.id === group.activeTabId
          ? {
              ...t,
              path: newPath,
              name: newName,
              pathHistory: group.pathHistory,
              historyIndex: newIndex,
            }
          : t,
      );

      return {
        ...state,
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            tabs: updatedTabs,
            currentPath: newPath,
            historyIndex: newIndex,
          },
        },
      };
    }

    case 'NAVIGATE_FORWARD': {
      const { groupId } = action;
      const group = state.groups[groupId];
      if (!group || group.historyIndex >= group.pathHistory.length - 1) return state;

      const newIndex = group.historyIndex + 1;
      const newPath = group.pathHistory[newIndex];
      const newName = newPath.split(/[/\\]/).pop() || newPath;

      const updatedTabs = group.tabs.map((t) =>
        t.id === group.activeTabId
          ? {
              ...t,
              path: newPath,
              name: newName,
              pathHistory: group.pathHistory,
              historyIndex: newIndex,
            }
          : t,
      );

      return {
        ...state,
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            tabs: updatedTabs,
            currentPath: newPath,
            historyIndex: newIndex,
          },
        },
      };
    }

    case 'RESIZE_SPLIT': {
      return {
        ...state,
        rootNode: updateSizesAtPath(state.rootNode, action.path, action.sizes),
      };
    }

    case 'MOVE_TAB': {
      const { fromGroupId, tabId, toGroupId, toIndex } = action;
      if (fromGroupId === toGroupId) return state;

      const fromGroup = state.groups[fromGroupId];
      const toGroup = state.groups[toGroupId];
      if (!fromGroup || !toGroup) return state;

      const tab = fromGroup.tabs.find((t) => t.id === tabId);
      if (!tab) return state;

      // Remove from source
      const updatedState = splitLayoutReducer(state, {
        type: 'CLOSE_TAB',
        groupId: fromGroupId,
        tabId,
      });

      // Add to target
      const targetGroup = updatedState.groups[toGroupId];
      if (!targetGroup) return updatedState;

      const newTabs = [...targetGroup.tabs];
      if (toIndex != null && toIndex >= 0) {
        newTabs.splice(toIndex, 0, tab);
      } else {
        newTabs.push(tab);
      }

      return {
        ...updatedState,
        groups: {
          ...updatedState.groups,
          [toGroupId]: {
            ...targetGroup,
            tabs: newTabs,
            activeTabId: tab.id,
            currentPath: tab.path,
          },
        },
        activeGroupId: toGroupId,
      };
    }

    case 'REORDER_TAB': {
      const { groupId, fromIndex, toIndex } = action;
      const group = state.groups[groupId];
      if (!group) return state;
      if (fromIndex === toIndex) return state;
      if (fromIndex < 0 || fromIndex >= group.tabs.length) return state;
      if (toIndex < 0 || toIndex >= group.tabs.length) return state;

      const newTabs = [...group.tabs];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);

      return {
        ...state,
        groups: { ...state.groups, [groupId]: { ...group, tabs: newTabs } },
      };
    }

    case 'CLOSE_OTHER_TABS': {
      const { groupId, tabId } = action;
      const group = state.groups[groupId];
      if (!group) return state;

      const keepTabs = group.tabs.filter((t) => t.id === tabId || t.isPinned);
      if (keepTabs.length === group.tabs.length) return state;

      const newActiveTabId = keepTabs.find((t) => t.id === group.activeTabId)
        ? group.activeTabId
        : tabId;
      const newActiveTab = keepTabs.find((t) => t.id === newActiveTabId);

      return {
        ...state,
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            tabs: keepTabs,
            activeTabId: newActiveTabId,
            currentPath: newActiveTab?.path ?? group.currentPath,
            pathHistory: newActiveTab?.pathHistory ?? group.pathHistory,
            historyIndex: newActiveTab?.historyIndex ?? group.historyIndex,
          },
        },
      };
    }

    case 'CLOSE_TABS_TO_RIGHT': {
      const { groupId, tabId } = action;
      const group = state.groups[groupId];
      if (!group) return state;

      const tabIndex = group.tabs.findIndex((t) => t.id === tabId);
      if (tabIndex < 0) return state;

      // Keep tabs at or before the target index, plus any pinned tabs after
      const keepTabs = group.tabs.filter((t, i) => i <= tabIndex || t.isPinned);
      if (keepTabs.length === group.tabs.length) return state;

      const newActiveTabId = keepTabs.find((t) => t.id === group.activeTabId)
        ? group.activeTabId
        : tabId;
      const newActiveTab = keepTabs.find((t) => t.id === newActiveTabId);

      return {
        ...state,
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            tabs: keepTabs,
            activeTabId: newActiveTabId,
            currentPath: newActiveTab?.path ?? group.currentPath,
            pathHistory: newActiveTab?.pathHistory ?? group.pathHistory,
            historyIndex: newActiveTab?.historyIndex ?? group.historyIndex,
          },
        },
      };
    }

    case 'CLOSE_ALL_TABS': {
      const { groupId } = action;
      const group = state.groups[groupId];
      if (!group) return state;

      // Keep only pinned tabs
      const pinnedTabs = group.tabs.filter((t) => t.isPinned);
      if (pinnedTabs.length === group.tabs.length) return state;

      if (pinnedTabs.length === 0) {
        // No pinned tabs — close the group if other groups exist, else reset to home
        const allIds = collectGroupIds(state.rootNode);
        if (allIds.length > 1) {
          return splitLayoutReducer(state, { type: 'CLOSE_GROUP', groupId });
        }
        // Last group: reset to home tab
        const homeTab: TabItem = {
          id: `tab-home-${groupId}-${Date.now()}`,
          name: 'Home',
          path: 'xplorer://home',
          type: 'folder',
          pathHistory: ['xplorer://home'],
          historyIndex: 0,
        };
        return {
          ...state,
          groups: {
            ...state.groups,
            [groupId]: {
              ...group,
              tabs: [homeTab],
              activeTabId: homeTab.id,
              currentPath: 'xplorer://home',
              pathHistory: ['xplorer://home'],
              historyIndex: 0,
            },
          },
        };
      }

      const newActiveTab = pinnedTabs[pinnedTabs.length - 1];
      return {
        ...state,
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            tabs: pinnedTabs,
            activeTabId: newActiveTab.id,
            currentPath: newActiveTab.path,
            pathHistory: newActiveTab.pathHistory ?? [newActiveTab.path],
            historyIndex: newActiveTab.historyIndex ?? 0,
          },
        },
      };
    }

    case 'DUPLICATE_TAB': {
      const { groupId, tabId } = action;
      const group = state.groups[groupId];
      if (!group) return state;

      const tab = group.tabs.find((t) => t.id === tabId);
      if (!tab) return state;

      const newTab: TabItem = {
        ...tab,
        id: `tab-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        isPinned: false,
        pathHistory: [tab.path],
        historyIndex: 0,
      };

      // Save current tab's history, then insert duplicate after source
      const tabIndex = group.tabs.findIndex((t) => t.id === tabId);
      const updatedTabs = group.tabs.map((t) =>
        t.id === group.activeTabId
          ? { ...t, pathHistory: group.pathHistory, historyIndex: group.historyIndex }
          : t,
      );
      const newTabs = [...updatedTabs];
      newTabs.splice(tabIndex + 1, 0, newTab);

      return {
        ...state,
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            tabs: newTabs,
            activeTabId: newTab.id,
            currentPath: newTab.path,
            pathHistory: newTab.pathHistory!,
            historyIndex: newTab.historyIndex!,
          },
        },
        activeGroupId: groupId,
      };
    }

    case 'MAXIMIZE_PANE': {
      const { groupId } = action;
      // Only meaningful when there are multiple groups
      const allIds = collectGroupIds(state.rootNode);
      if (allIds.length <= 1) return state;
      // Already maximized to this pane
      if (state.maximizedGroupId === groupId) return state;
      return {
        ...state,
        maximizedGroupId: groupId,
        activeGroupId: groupId,
      };
    }

    case 'RESTORE_PANE': {
      if (!state.maximizedGroupId) return state;
      return {
        ...state,
        maximizedGroupId: null,
      };
    }

    case 'REPLACE_STATE': {
      return action.state;
    }

    default:
      return state;
  }
};

// ── Tree mutation helpers ────────────────────────────────────────────────────

/** Replace a specific child at index in a parent node, deep in the tree */
const replaceChild = (
  root: SplitNode,
  parent: SplitNodeBranch,
  childIndex: number,
  replacement: SplitNode,
): SplitNode => {
  if (root === parent) {
    const newChildren = [...(root as SplitNodeBranch).children];
    newChildren[childIndex] = replacement;
    return { ...root, children: newChildren } as SplitNodeBranch;
  }
  if (root.type === 'split') {
    return {
      ...root,
      children: root.children.map((c) => replaceChild(c, parent, childIndex, replacement)),
    };
  }
  return root;
};

/** Replace an entire node (by reference identity) with a replacement in the tree */
const replaceNodeInTree = (
  root: SplitNode,
  target: SplitNode,
  replacement: SplitNode,
): SplitNode => {
  if (root === target) return replacement;
  if (root.type === 'split') {
    return {
      ...root,
      children: root.children.map((c) => replaceNodeInTree(c, target, replacement)),
    };
  }
  return root;
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useSplitLayout = () => {
  const [state, dispatch] = useReducer(splitLayoutReducer, undefined, loadLayout);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist on every state change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => saveLayout(state), 300);
    return () => clearTimeout(timer);
  }, [state]);

  // Convenience getters
  const activeGroup = state.groups[state.activeGroupId] ?? Object.values(state.groups)[0];

  const splitGroup = useCallback(
    (groupId: string, direction: 'horizontal' | 'vertical') =>
      dispatch({ type: 'SPLIT_GROUP', groupId, direction }),
    [],
  );

  const closeGroup = useCallback(
    (groupId: string) => dispatch({ type: 'CLOSE_GROUP', groupId }),
    [],
  );

  const setActiveGroup = useCallback(
    (groupId: string) => dispatch({ type: 'SET_ACTIVE_GROUP', groupId }),
    [],
  );

  const addTab = useCallback(
    (groupId: string, tab: TabItem, activate?: boolean) =>
      dispatch({ type: 'ADD_TAB', groupId, tab, activate }),
    [],
  );

  const closeTab = useCallback(
    (groupId: string, tabId: string) => dispatch({ type: 'CLOSE_TAB', groupId, tabId }),
    [],
  );

  const togglePinTab = useCallback(
    (groupId: string, tabId: string) => dispatch({ type: 'TOGGLE_PIN_TAB', groupId, tabId }),
    [],
  );

  const switchTab = useCallback(
    (groupId: string, tabId: string) => dispatch({ type: 'SWITCH_TAB', groupId, tabId }),
    [],
  );

  const navigate = useCallback(
    (groupId: string, path: string, name: string) =>
      dispatch({ type: 'NAVIGATE', groupId, path, name }),
    [],
  );

  const navigateBack = useCallback(
    (groupId: string) => dispatch({ type: 'NAVIGATE_BACK', groupId }),
    [],
  );

  const navigateForward = useCallback(
    (groupId: string) => dispatch({ type: 'NAVIGATE_FORWARD', groupId }),
    [],
  );

  const resizeSplit = useCallback(
    (path: number[], sizes: number[]) => dispatch({ type: 'RESIZE_SPLIT', path, sizes }),
    [],
  );

  const moveTab = useCallback(
    (fromGroupId: string, tabId: string, toGroupId: string, toIndex?: number) =>
      dispatch({ type: 'MOVE_TAB', fromGroupId, tabId, toGroupId, toIndex }),
    [],
  );

  const reorderTab = useCallback(
    (groupId: string, fromIndex: number, toIndex: number) =>
      dispatch({ type: 'REORDER_TAB', groupId, fromIndex, toIndex }),
    [],
  );

  const closeOtherTabs = useCallback(
    (groupId: string, tabId: string) => dispatch({ type: 'CLOSE_OTHER_TABS', groupId, tabId }),
    [],
  );

  const closeTabsToRight = useCallback(
    (groupId: string, tabId: string) => dispatch({ type: 'CLOSE_TABS_TO_RIGHT', groupId, tabId }),
    [],
  );

  const closeAllTabs = useCallback(
    (groupId: string) => dispatch({ type: 'CLOSE_ALL_TABS', groupId }),
    [],
  );

  const duplicateTab = useCallback(
    (groupId: string, tabId: string) => dispatch({ type: 'DUPLICATE_TAB', groupId, tabId }),
    [],
  );

  const maximizePane = useCallback(
    (groupId: string) => dispatch({ type: 'MAXIMIZE_PANE', groupId }),
    [],
  );

  const restorePane = useCallback(() => dispatch({ type: 'RESTORE_PANE' }), []);

  return {
    state,
    dispatch,
    activeGroup,
    splitGroup,
    closeGroup,
    setActiveGroup,
    addTab,
    closeTab,
    togglePinTab,
    switchTab,
    navigate,
    navigateBack,
    navigateForward,
    resizeSplit,
    moveTab,
    reorderTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
    duplicateTab,
    maximizePane,
    restorePane,
  };
};

export type SplitLayoutHook = ReturnType<typeof useSplitLayout>;
