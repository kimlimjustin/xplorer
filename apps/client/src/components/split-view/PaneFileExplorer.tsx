import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { FileEntry } from '@/lib/tauri-api';
import {
  getFileIcon,
  formatFileSize,
  formatFolderSize,
  formatDate,
  viewModes,
  sortOptions,
  type FileGroup,
} from '@/lib/utils';
import OperationBar from '@/components/explorer/OperationBar';
import FileGrid from '@/components/explorer/FileGrid';
import TokenizerStatusIndicator from '@/components/ui/TokenizerStatusIndicator';
import { SizeDistributionChart } from '@/components/explorer/SizeDistributionChart';
import FolderColorLegend from '@/components/explorer/FolderColorLegend';
import { getAllFolderColors } from '@/lib/folder-colors';

interface PaneFileExplorerProps {
  viewMode: string;
  setViewMode: React.Dispatch<React.SetStateAction<string>>;
  sortBy: string;
  setSortBy: React.Dispatch<React.SetStateAction<string>>;
  sortOrder: 'asc' | 'desc';
  toggleSortOrder: () => void;
  groupByDate: boolean;
  setGroupByDate: React.Dispatch<React.SetStateAction<boolean>>;
  sortedFiles: FileEntry[];
  fileGroups: FileGroup[] | null;
  isLoading: boolean;
  selectedFiles: Set<string>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  currentPath: string;
  groupId: string;
  handleCreateFolder: () => void;
  handleDelete: () => void;
  handleFileClick: (file: FileEntry, event: React.MouseEvent) => void;
  handleFileDoubleClick: (file: FileEntry) => void;
  onFileRightClick: (file: FileEntry, event: React.MouseEvent) => void;
  onBgRightClick: (event: React.MouseEvent) => void;
  getFolderSize: (path: string) => import('@/lib/tauri-api').FolderSizeInfo | null;
  isCalculatingSize: (path: string) => boolean;
  calculateFolderSize: (path: string) => void;
  setBottomPanelCollapsed: (collapsed: boolean) => void;
  setBottomPanelTab: (tab: string) => void;
  onAdvancedSelection: () => void;
  onQuickLook?: (file: import('@/lib/tauri-api').FileEntry) => void;
  /** Inline rename handler: called with (oldPath, newName), returns true on success */
  onRenameFile?: (oldPath: string, newName: string) => Promise<boolean>;
}

const PaneFileExplorer = React.memo(function PaneFileExplorer({
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  sortOrder,
  toggleSortOrder,
  groupByDate,
  setGroupByDate,
  sortedFiles,
  fileGroups,
  isLoading,
  selectedFiles,
  setSelectedFiles,
  currentPath,
  groupId,
  handleCreateFolder,
  handleDelete,
  handleFileClick,
  handleFileDoubleClick,
  onFileRightClick,
  onBgRightClick,
  getFolderSize,
  isCalculatingSize,
  calculateFolderSize,
  setBottomPanelCollapsed,
  setBottomPanelTab,
  onAdvancedSelection,
  onQuickLook,
  onRenameFile,
}: PaneFileExplorerProps) {
  const [showSizeBadges, setShowSizeBadges] = useState(false);
  const toggleSizeBadges = useCallback(() => setShowSizeBadges((prev) => !prev), []);

  // Folder color filter
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const handleColorFilter = useCallback((colorId: string | null) => setColorFilter(colorId), []);

  // Re-read folder colors on change so the filter stays in sync
  const [folderColorVersion, setFolderColorVersion] = useState(0);
  useEffect(() => {
    const handler = () => setFolderColorVersion((v) => v + 1);
    window.addEventListener('folder-colors-changed', handler);
    return () => window.removeEventListener('folder-colors-changed', handler);
  }, []);

  // When a color filter is active, only show folders with that color (plus all non-folder items)
  const displayFiles = useMemo(() => {
    // folderColorVersion triggers re-computation when folder colors change
    void folderColorVersion;
    if (!colorFilter) return sortedFiles;
    const allColors = getAllFolderColors();
    const matchingPaths = new Set(
      allColors.filter((c) => c.colorId === colorFilter).map((c) => c.path),
    );
    return sortedFiles.filter((f) => !f.is_dir || matchingPaths.has(f.path));
  }, [sortedFiles, colorFilter, folderColorVersion]);

  // Clear color filter when navigating to a different directory
  useEffect(() => {
    setColorFilter(null);
  }, [currentPath]);

  return (
    <>
      <OperationBar
        viewMode={viewMode}
        setViewMode={setViewMode}
        viewModes={viewModes}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        toggleSortOrder={toggleSortOrder}
        sortOptions={sortOptions}
        groupByDate={groupByDate}
        setGroupByDate={setGroupByDate}
        handleCreateFolder={handleCreateFolder}
        handleDelete={handleDelete}
        selectedFiles={selectedFiles}
        setBottomPanelCollapsed={setBottomPanelCollapsed}
        setBottomPanelTab={setBottomPanelTab}
        onSelectAll={() => {
          const newSet = new Set(sortedFiles.map((f) => f.path));
          setSelectedFiles(newSet);
        }}
        onSelectNone={() => {
          setSelectedFiles(new Set());
        }}
        onInvertSelection={() => {
          const allPaths = sortedFiles.map((f) => f.path);
          setSelectedFiles((prev) => {
            const next = new Set<string>();
            for (const p of allPaths) {
              if (!prev.has(p)) next.add(p);
            }
            return next;
          });
        }}
        onAdvancedSelection={onAdvancedSelection}
        showSizeBadges={showSizeBadges}
        onToggleSizeBadges={toggleSizeBadges}
      />

      <div className="flex-1 p-4 overflow-auto">
        <FileGrid
          files={displayFiles}
          fileGroups={colorFilter ? null : fileGroups}
          isLoading={isLoading}
          viewMode={viewMode}
          selectedFiles={selectedFiles}
          currentPath={currentPath}
          groupId={groupId}
          getFileIcon={getFileIcon}
          formatFileSize={formatFileSize}
          formatFolderSize={formatFolderSize}
          formatDate={formatDate}
          handleFileClick={handleFileClick}
          handleFileDoubleClick={handleFileDoubleClick}
          handleFileRightClick={onFileRightClick}
          handleBackgroundRightClick={onBgRightClick}
          getFolderSize={getFolderSize}
          isCalculatingSize={isCalculatingSize}
          calculateFolderSize={calculateFolderSize}
          onQuickLook={onQuickLook}
          showSizeBadges={showSizeBadges}
          onRenameFile={onRenameFile}
        />
      </div>

      <div className="bg-xp-surface border-t border-xp-border px-4 py-2 text-xs text-xp-text-muted flex-shrink-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span>
              {displayFiles.length} items{colorFilter ? ` (filtered)` : ''}
            </span>
            <span>{selectedFiles.size} selected</span>
            {showSizeBadges && <SizeDistributionChart files={displayFiles} />}
            <FolderColorLegend
              files={sortedFiles}
              onFilterByColor={handleColorFilter}
              activeColorFilter={colorFilter}
            />
          </div>
          <TokenizerStatusIndicator />
        </div>
      </div>
    </>
  );
});

export default PaneFileExplorer;
