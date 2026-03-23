import React, { useCallback } from 'react';
import type { SplitNode, SplitNodeBranch, EditorGroup } from '@/types/split-view';
import EditorGroupPane from './EditorGroupPane';
import ResizeHandle from '@/components/ui/ResizeHandle';
import { useExplorerContext } from '@/contexts/ExplorerContext';

interface SplitContainerProps {
  node: SplitNode;
  groups: Record<string, EditorGroup>;
  activeGroupId: string;
  /** Path of indices from root to this node (for resize dispatch) */
  path: number[];
}

/** Collect all group IDs from a node */
const collectIds = (node: SplitNode): string[] => {
  if (node.type === 'leaf') return [node.groupId];
  return node.children.flatMap(collectIds);
};

/** Check if a node (or its descendants) contains a specific groupId */
const nodeContainsGroup = (node: SplitNode, groupId: string): boolean => {
  if (node.type === 'leaf') return node.groupId === groupId;
  return node.children.some((child) => nodeContainsGroup(child, groupId));
};

const SplitContainer = ({ node, groups, activeGroupId, path }: SplitContainerProps) => {
  const { selection, viewSort, splitActions, paneSync, activeCollectionFilter } =
    useExplorerContext();

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
        sharedActions={splitActions.sharedActions}
        selectedFiles={selection.selectedFiles}
        setSelectedFiles={selection.setSelectedFiles}
        selectedFile={selection.selectedFile}
        setSelectedFile={selection.setSelectedFile}
        viewMode={viewSort.viewMode}
        setViewMode={viewSort.setViewMode}
        sortBy={viewSort.sortBy}
        setSortBy={viewSort.setSortBy}
        sortOrder={viewSort.sortOrder}
        setSortOrder={viewSort.setSortOrder}
        onSwitchTab={splitActions.onSwitchTab}
        onCloseTab={splitActions.onCloseTab}
        onAddTab={splitActions.onAddTab}
        onSplitHorizontal={splitActions.onSplitHorizontal}
        onSplitVertical={splitActions.onSplitVertical}
        onCloseGroup={splitActions.onCloseGroup}
        onSetActiveGroup={splitActions.onSetActiveGroup}
        onNavigate={splitActions.onNavigate}
        isMaximized={splitActions.maximizedGroupId === group.id}
        onMaximizePane={splitActions.onMaximizePane}
        onRestorePane={splitActions.onRestorePane}
        onTogglePin={splitActions.onTogglePin}
        onDuplicateTab={splitActions.onDuplicateTab}
        onCloseOtherTabs={splitActions.onCloseOtherTabs}
        onCloseTabsToRight={splitActions.onCloseTabsToRight}
        onCloseAllTabs={splitActions.onCloseAllTabs}
        onReorderTab={splitActions.onReorderTab}
        activeCollectionFilter={activeCollectionFilter}
        paneSyncEnabled={paneSync.paneSyncEnabled}
        paneSyncMode={paneSync.paneSyncMode}
        onTogglePaneSync={paneSync.onTogglePaneSync}
        onSwitchPaneSyncMode={paneSync.onSwitchPaneSyncMode}
      />
    );
  }

  // Split node — render children with resize handles between them
  const splitNode = node as SplitNodeBranch;
  const isHorizontal = splitNode.direction === 'horizontal';

  // When a pane is maximized, find the child subtree that contains it and render only that child
  if (splitActions.maximizedGroupId) {
    const maxChildIndex = splitNode.children.findIndex((child) =>
      nodeContainsGroup(child, splitActions.maximizedGroupId!),
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
              />
            </div>
            {i < splitNode.children.length - 1 && (
              <SplitResizeHandle
                direction={isHorizontal ? 'horizontal' : 'vertical'}
                splitNode={splitNode}
                index={i}
                parentPath={path}
                onResizeSplit={splitActions.onResizeSplit}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

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
};

export default SplitContainer;
