import React, { useCallback } from 'react';
import type { SplitNode, SplitNodeBranch, EditorGroup } from '@/types/split-view';
import EditorGroupPane, { type SharedPaneActions } from './EditorGroupPane';
import ResizeHandle from '@/components/ui/ResizeHandle';
import type { FileCollection } from '@/lib/collections';
import type { PaneSyncMode } from '@/hooks/use-pane-sync';

interface SplitContainerProps {
  node: SplitNode;
  groups: Record<string, EditorGroup>;
  activeGroupId: string;
  /** Path of indices from root to this node (for resize dispatch) */
  path: number[];
  sharedActions: SharedPaneActions;
  /** Shared selection state from the parent (xplorer.tsx). */
  selectedFiles: Set<string>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** Shared single-file selection from parent (for preview). */
  selectedFile: import('@/lib/tauri-api').FileEntry | null;
  setSelectedFile: React.Dispatch<React.SetStateAction<import('@/lib/tauri-api').FileEntry | null>>;
  /** Controlled view/sort state from parent. */
  viewMode: string;
  setViewMode: React.Dispatch<React.SetStateAction<string>>;
  sortBy: string;
  setSortBy: React.Dispatch<React.SetStateAction<string>>;
  sortOrder: 'asc' | 'desc';
  setSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  // Layout actions
  onSwitchTab: (groupId: string, tabId: string) => void;
  onCloseTab: (groupId: string, tabId: string) => void;
  onAddTab: (groupId: string) => void;
  onSplitHorizontal: (groupId: string) => void;
  onSplitVertical: (groupId: string) => void;
  onCloseGroup: (groupId: string) => void;
  onSetActiveGroup: (groupId: string) => void;
  onNavigate: (groupId: string, path: string, name: string) => void;
  onResizeSplit: (path: number[], sizes: number[]) => void;
  /** When set, only this group is rendered at 100% (siblings hidden). */
  maximizedGroupId?: string | null;
  onMaximizePane?: (groupId: string) => void;
  onRestorePane?: () => void;
  // Tab management actions
  onTogglePin?: (groupId: string, tabId: string) => void;
  onDuplicateTab?: (groupId: string, tabId: string) => void;
  onCloseOtherTabs?: (groupId: string, tabId: string) => void;
  onCloseTabsToRight?: (groupId: string, tabId: string) => void;
  onCloseAllTabs?: (groupId: string) => void;
  onReorderTab?: (groupId: string, fromIndex: number, toIndex: number) => void;
  // Filter presets
  activeCollectionFilter?: FileCollection | null;
  // Pane sync navigation
  paneSyncEnabled?: boolean;
  paneSyncMode?: PaneSyncMode;
  onTogglePaneSync?: () => void;
  onSwitchPaneSyncMode?: (mode: PaneSyncMode) => void;
}

/** Collect all group IDs from a node */
const collectIds = (node: SplitNode) : string[] => {
  if (node.type === 'leaf') return [node.groupId];
  return node.children.flatMap(collectIds);
}

/** Check if a node (or its descendants) contains a specific groupId */
const nodeContainsGroup = (node: SplitNode, groupId: string) : boolean => {
  if (node.type === 'leaf') return node.groupId === groupId;
  return node.children.some((child) => nodeContainsGroup(child, groupId));
}

const SplitContainer = ({
  node,
  groups,
  activeGroupId,
  path,
  sharedActions,
  selectedFiles,
  setSelectedFiles,
  selectedFile,
  setSelectedFile,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  onSwitchTab,
  onCloseTab,
  onAddTab,
  onSplitHorizontal,
  onSplitVertical,
  onCloseGroup,
  onSetActiveGroup,
  onNavigate,
  onResizeSplit,
  maximizedGroupId,
  onMaximizePane,
  onRestorePane,
  onTogglePin,
  onDuplicateTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseAllTabs,
  onReorderTab,
  activeCollectionFilter,
  paneSyncEnabled,
  paneSyncMode,
  onTogglePaneSync,
  onSwitchPaneSyncMode,
}: SplitContainerProps) => {
  const totalGroups = Object.keys(groups).length;

  if (node.type === 'leaf') {
    const group = groups[node.groupId];
    if (!group) return null;

    return (
      <EditorGroupPane
        group={group}
        isActive={activeGroupId === group.id}
        canClose={totalGroups > 1}
        totalGroups={totalGroups}
        sharedActions={sharedActions}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        viewMode={viewMode}
        setViewMode={setViewMode}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        onSwitchTab={onSwitchTab}
        onCloseTab={onCloseTab}
        onAddTab={onAddTab}
        onSplitHorizontal={onSplitHorizontal}
        onSplitVertical={onSplitVertical}
        onCloseGroup={onCloseGroup}
        onSetActiveGroup={onSetActiveGroup}
        onNavigate={onNavigate}
        isMaximized={maximizedGroupId === group.id}
        onMaximizePane={onMaximizePane}
        onRestorePane={onRestorePane}
        onTogglePin={onTogglePin}
        onDuplicateTab={onDuplicateTab}
        onCloseOtherTabs={onCloseOtherTabs}
        onCloseTabsToRight={onCloseTabsToRight}
        onCloseAllTabs={onCloseAllTabs}
        onReorderTab={onReorderTab}
        activeCollectionFilter={activeCollectionFilter}
        paneSyncEnabled={paneSyncEnabled}
        paneSyncMode={paneSyncMode}
        onTogglePaneSync={onTogglePaneSync}
        onSwitchPaneSyncMode={onSwitchPaneSyncMode}
      />
    );
  }

  // Split node — render children with resize handles between them
  const splitNode = node as SplitNodeBranch;
  const isHorizontal = splitNode.direction === 'horizontal';

  // When a pane is maximized, find the child subtree that contains it and render only that child
  if (maximizedGroupId) {
    const maxChildIndex = splitNode.children.findIndex((child) =>
      nodeContainsGroup(child, maximizedGroupId),
    );
    if (maxChildIndex >= 0) {
      const maxChild = splitNode.children[maxChildIndex];
      return (
        <div
          className="flex h-full w-full overflow-hidden"
          style={{ flexDirection: isHorizontal ? 'row' : 'column' }}
        >
          <div
            style={{ width: '100%', height: '100%', overflow: 'hidden' }}
            className="flex flex-col"
          >
            <SplitContainer
              node={maxChild}
              groups={groups}
              activeGroupId={activeGroupId}
              path={[...path, maxChildIndex]}
              sharedActions={sharedActions}
              selectedFiles={selectedFiles}
              setSelectedFiles={setSelectedFiles}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              viewMode={viewMode}
              setViewMode={setViewMode}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              onSwitchTab={onSwitchTab}
              onCloseTab={onCloseTab}
              onAddTab={onAddTab}
              onSplitHorizontal={onSplitHorizontal}
              onSplitVertical={onSplitVertical}
              onCloseGroup={onCloseGroup}
              onSetActiveGroup={onSetActiveGroup}
              onNavigate={onNavigate}
              onResizeSplit={onResizeSplit}
              maximizedGroupId={maximizedGroupId}
              onMaximizePane={onMaximizePane}
              onRestorePane={onRestorePane}
              onTogglePin={onTogglePin}
              onDuplicateTab={onDuplicateTab}
              onCloseOtherTabs={onCloseOtherTabs}
              onCloseTabsToRight={onCloseTabsToRight}
              onCloseAllTabs={onCloseAllTabs}
              onReorderTab={onReorderTab}
              activeCollectionFilter={activeCollectionFilter}
              paneSyncEnabled={paneSyncEnabled}
              paneSyncMode={paneSyncMode}
              onTogglePaneSync={onTogglePaneSync}
              onSwitchPaneSyncMode={onSwitchPaneSyncMode}
            />
          </div>
        </div>
      );
    }
  }

  return (
    <div
      className="flex h-full w-full overflow-hidden"
      style={{ flexDirection: isHorizontal ? 'row' : 'column' }}
    >
      {splitNode.children.map((child, i) => {
        const sizePct = (splitNode.sizes[i] ?? 1 / splitNode.children.length) * 100;
        const childKey = child.type === 'leaf' ? child.groupId : collectIds(child).join('-');

        return (
          <React.Fragment key={childKey}>
            <div
              style={{
                [isHorizontal ? 'width' : 'height']: `${sizePct}%`,
                [isHorizontal ? 'minWidth' : 'minHeight']: 120,
                overflow: 'hidden',
              }}
              className="flex flex-col"
            >
              <SplitContainer
                node={child}
                groups={groups}
                activeGroupId={activeGroupId}
                path={[...path, i]}
                sharedActions={sharedActions}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                viewMode={viewMode}
                setViewMode={setViewMode}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                onSwitchTab={onSwitchTab}
                onCloseTab={onCloseTab}
                onAddTab={onAddTab}
                onSplitHorizontal={onSplitHorizontal}
                onSplitVertical={onSplitVertical}
                onCloseGroup={onCloseGroup}
                onSetActiveGroup={onSetActiveGroup}
                onNavigate={onNavigate}
                onResizeSplit={onResizeSplit}
                maximizedGroupId={maximizedGroupId}
                onMaximizePane={onMaximizePane}
                onRestorePane={onRestorePane}
                onTogglePin={onTogglePin}
                onDuplicateTab={onDuplicateTab}
                onCloseOtherTabs={onCloseOtherTabs}
                onCloseTabsToRight={onCloseTabsToRight}
                onCloseAllTabs={onCloseAllTabs}
                onReorderTab={onReorderTab}
                activeCollectionFilter={activeCollectionFilter}
                paneSyncEnabled={paneSyncEnabled}
                paneSyncMode={paneSyncMode}
                onTogglePaneSync={onTogglePaneSync}
                onSwitchPaneSyncMode={onSwitchPaneSyncMode}
              />
            </div>
            {i < splitNode.children.length - 1 && (
              <SplitResizeHandle
                direction={isHorizontal ? 'horizontal' : 'vertical'}
                splitNode={splitNode}
                index={i}
                parentPath={path}
                onResizeSplit={onResizeSplit}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Resize Handle Adapter ────────────────────────────────────────────────────

interface SplitResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  splitNode: SplitNodeBranch;
  index: number;
  parentPath: number[];
  onResizeSplit: (path: number[], sizes: number[]) => void;
}

const SplitResizeHandle = ({
  direction,
  splitNode,
  index,
  parentPath,
  onResizeSplit,
}: SplitResizeHandleProps) => {
  const handleResize = useCallback(
    (delta: number) => {
      const _totalSizes = splitNode.sizes.reduce((a, b) => a + b, 0);
      const newSizes = [...splitNode.sizes];

      // Convert pixel delta to proportional delta
      // Approximate: assume the container is the viewport minus sidebars (~800px)
      const containerSize =
        direction === 'horizontal' ? window.innerWidth * 0.6 : window.innerHeight * 0.6;
      const proportionalDelta = delta / containerSize;

      newSizes[index] = Math.max(0.1, newSizes[index] + proportionalDelta);
      newSizes[index + 1] = Math.max(0.1, newSizes[index + 1] - proportionalDelta);

      // Re-normalize
      const newTotal = newSizes.reduce((a, b) => a + b, 0);
      const normalized = newSizes.map((s) => s / newTotal);

      onResizeSplit(parentPath, normalized);
    },
    [splitNode.sizes, index, parentPath, onResizeSplit, direction],
  );

  return <ResizeHandle direction={direction} onResize={handleResize} />;
}

export default SplitContainer;
