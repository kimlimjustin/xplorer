import React from 'react';
import { useUndoHistory } from '../../hooks/use-undo-history';
import UndoHistoryList from './undo-history/UndoHistoryList';
import {
  DetailsPopover,
  ContextMenu,
  ReplayConfirmDialog,
  Toolbar,
} from './undo-history/UndoHistoryControls';

// ── Main Component ──────────────────────────────────────────────────────────

const UndoHistoryPanel = () => {
  const {
    loading,
    actionInProgress,
    contextMenu,
    detailsPopover,
    listRef,
    markerRef,
    entries,
    undoCount,
    canUndo,
    canRedo,
    displayItems,
    replayDialogData,
    refresh,
    handleUndo,
    handleRedo,
    handleClear,
    toggleGroup,
    handleUndoThis,
    handleUndoThisAndAfter,
    handleShowDetails,
    handleReplayOnSelection,
    executeReplay,
    handleClearAbove,
    handleContextMenu,
    setContextMenu,
    setDetailsPopover,
    setReplayDialog,
  } = useUndoHistory();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <Toolbar
        canUndo={canUndo}
        canRedo={canRedo}
        actionInProgress={actionInProgress}
        loading={loading}
        undoCount={undoCount}
        totalEntries={entries.length}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onRefresh={refresh}
      />

      {/* Entry list */}
      <UndoHistoryList
        displayItems={displayItems}
        undoCount={undoCount}
        entries={entries}
        listRef={listRef}
        markerRef={markerRef}
        onContextMenu={handleContextMenu}
        onToggleGroup={toggleGroup}
      />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onUndoThis={handleUndoThis}
          onUndoThisAndAfter={handleUndoThisAndAfter}
          onShowDetails={handleShowDetails}
          onReplayOnSelection={handleReplayOnSelection}
          onClearAbove={handleClearAbove}
        />
      )}

      {/* Details Popover */}
      {detailsPopover && (
        <DetailsPopover state={detailsPopover} onClose={() => setDetailsPopover(null)} />
      )}

      {/* Replay Confirmation Dialog */}
      {replayDialogData && (
        <ReplayConfirmDialog
          operationType={replayDialogData.operationType}
          operationDescription={replayDialogData.operationDescription}
          destPath={replayDialogData.destPath}
          onConfirm={executeReplay}
          onCancel={() => setReplayDialog(null)}
        />
      )}
    </div>
  );
};

export default UndoHistoryPanel;
