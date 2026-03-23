import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Rows3,
  BarChart3,
  Settings,
  FolderPlus,
  FilePlus,
  Package,
  PackageOpen,
  Info,
  Terminal,
  Copy,
  Scissors,
  Clipboard,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ViewMode {
  id: string;
  name: string;
  icon: React.ReactNode;
}

interface SortOption {
  id: string;
  name: string;
  icon: React.ReactNode;
}

interface OperationBarProps {
  viewMode: string;
  setViewMode: (mode: string) => void;
  viewModes: Record<string, ViewMode>;
  sortBy: string;
  setSortBy: (sortBy: string) => void;
  sortOrder: 'asc' | 'desc';
  toggleSortOrder: () => void;
  sortOptions: Record<string, SortOption>;
  groupByDate?: boolean;
  setGroupByDate?: (enabled: boolean) => void;
  handleCreateFolder: () => void;
  handleDelete: () => void;
  selectedFiles: Set<string>;
  setBottomPanelCollapsed: (collapsed: boolean) => void;
  setBottomPanelTab: (tab: 'terminal' | 'output' | 'git' | string) => void;
  onSelectAll?: () => void;
  onSelectNone?: () => void;
  onInvertSelection?: () => void;
  onAdvancedSelection?: () => void;
  /** Whether size heatmap badges are shown */
  showSizeBadges?: boolean;
  /** Toggle size heatmap badges */
  onToggleSizeBadges?: () => void;
  /** Whether the current view mode was auto-detected */
  isAutoDetected?: boolean;
  /** Callback to clear the auto-detected view and re-trigger detection */
  onClearAutoDetect?: () => void;
  /** Optional action callbacks for the gear menu */
  onCreateFile?: () => void;
  onCompress?: () => void;
  onExtract?: () => void;
  onProperties?: () => void;
  onCopyPath?: () => void;
  /** Current directory path (used for Open in Terminal fallback) */
  currentPath?: string;
  /** Clipboard actions */
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  hasClipboard?: boolean;
}

const OperationBar = ({
  viewMode,
  setViewMode,
  viewModes,
  sortBy,
  setSortBy,
  sortOrder,
  toggleSortOrder,
  sortOptions,
  groupByDate,
  setGroupByDate,
  handleCreateFolder,
  handleDelete,
  selectedFiles,
  setBottomPanelCollapsed,
  setBottomPanelTab,
  onSelectAll: _onSelectAll,
  onSelectNone: _onSelectNone,
  onInvertSelection: _onInvertSelection,
  onAdvancedSelection: _onAdvancedSelection,
  showSizeBadges,
  onToggleSizeBadges,
  isAutoDetected: _isAutoDetected,
  onClearAutoDetect: _onClearAutoDetect,
  onCreateFile,
  onCompress,
  onExtract,
  onProperties,
  onCopyPath,
  currentPath: _currentPath,
  onCopy,
  onCut,
  onPaste,
  hasClipboard,
}: OperationBarProps) => {
  const { t } = useTranslation();
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anyOpen = isViewDropdownOpen || isSortDropdownOpen || isActionsDropdownOpen;
    if (!anyOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setIsViewDropdownOpen(false);
        setIsSortDropdownOpen(false);
        setIsActionsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isViewDropdownOpen, isSortDropdownOpen, isActionsDropdownOpen]);

  const handleOpenTerminal = () => {
    setBottomPanelCollapsed(false);
    setBottomPanelTab('terminal');
    setIsActionsDropdownOpen(false);
  };

  return (
    <div ref={barRef} className="bg-xp-surface border-xp-border border-b px-3 py-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1">
          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className="text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
              aria-label={t('operationBar.sortBy', {
                name: sortOptions?.[sortBy]?.name || 'Name',
                order: sortOrder === 'asc' ? 'ascending' : 'descending',
              })}
            >
              <span className="whitespace-nowrap">{sortOptions?.[sortBy]?.name || 'Name'}</span>
              <ChevronDown size={12} className="opacity-60" />
            </button>

            {isSortDropdownOpen && sortOptions && (
              <div className="bg-xp-popover border-xp-border absolute left-0 top-full z-50 mt-1 min-w-[170px] rounded-lg border py-1 shadow-xl backdrop-blur-xl">
                {Object.values(sortOptions).map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      if (sortBy === option.id) {
                        toggleSortOrder();
                      } else {
                        setSortBy(option.id);
                      }
                      setIsSortDropdownOpen(false);
                    }}
                    className={`hover:bg-xp-surface-light flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors ${
                      sortBy === option.id ? 'text-xp-blue' : ''
                    }`}
                  >
                    <span className="text-xs">{option.name}</span>
                    {sortBy === option.id &&
                      (sortOrder === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </button>
                ))}

                {/* Group by Date toggle inside sort dropdown */}
                {setGroupByDate && (
                  <>
                    <div className="border-xp-border my-1 border-t" />
                    <button
                      onClick={() => {
                        setGroupByDate(!groupByDate);
                        setIsSortDropdownOpen(false);
                      }}
                      className={`hover:bg-xp-surface-light flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors ${
                        groupByDate ? 'text-xp-blue' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Rows3 size={13} className="inline-block" />
                        <span className="text-xs">{t('operationBar.groupByDate')}</span>
                      </div>
                      {groupByDate && (
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="bg-xp-border h-4 w-px" />

          {/* Copy / Cut / Paste / Delete — icon-only, Finder-style */}
          {onCopy && (
            <button
              onClick={onCopy}
              disabled={selectedFiles.size === 0}
              className="text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light rounded p-1 transition-colors disabled:pointer-events-none disabled:opacity-30"
              title={t('contextMenu.copy')}
            >
              <Copy size={15} />
            </button>
          )}
          {onCut && (
            <button
              onClick={onCut}
              disabled={selectedFiles.size === 0}
              className="text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light rounded p-1 transition-colors disabled:pointer-events-none disabled:opacity-30"
              title={t('contextMenu.cut')}
            >
              <Scissors size={15} />
            </button>
          )}
          {onPaste && (
            <button
              onClick={onPaste}
              disabled={!hasClipboard}
              className="text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light rounded p-1 transition-colors disabled:pointer-events-none disabled:opacity-30"
              title={t('contextMenu.paste')}
            >
              <Clipboard size={15} />
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={selectedFiles.size === 0}
            className="text-xp-text-muted hover:text-xp-red hover:bg-xp-red/10 rounded p-1 transition-colors disabled:pointer-events-none disabled:opacity-30"
            title={t('contextMenu.delete')}
          >
            <Trash2 size={15} />
          </button>

          {/* Separator */}
          <div className="bg-xp-border h-4 w-px" />

          {/* Size Map toggle */}
          {onToggleSizeBadges && (
            <button
              onClick={onToggleSizeBadges}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                showSizeBadges
                  ? 'text-xp-blue bg-xp-blue/10'
                  : 'text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light'
              }`}
              title={
                showSizeBadges
                  ? t('operationBar.hideSizeHeatmap')
                  : t('operationBar.showSizeHeatmap')
              }
              aria-label={
                showSizeBadges
                  ? t('operationBar.hideSizeHeatmap')
                  : t('operationBar.showSizeHeatmap')
              }
              aria-pressed={showSizeBadges}
            >
              <BarChart3 size={14} />
              <span className="whitespace-nowrap">{t('operationBar.sizeMap')}</span>
            </button>
          )}

          {/* Separator */}
          <div className="bg-xp-border h-4 w-px" />

          {/* View Mode Dropdown */}
          <div className="relative flex items-center gap-1">
            <button
              onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
              className="text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
              aria-label={t('operationBar.viewMode', {
                name: viewModes[viewMode]?.name || 'Medium Icons',
              })}
            >
              <span className="text-sm">{viewModes[viewMode]?.icon}</span>
              <span className="whitespace-nowrap">{viewModes[viewMode]?.name || 'Grid'}</span>
              <ChevronDown size={12} className="opacity-60" />
            </button>

            {isViewDropdownOpen && (
              <div className="bg-xp-popover border-xp-border absolute left-0 top-full z-50 mt-1 min-w-[170px] rounded-lg border py-1 shadow-xl backdrop-blur-xl">
                {Object.values(viewModes).map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setViewMode(mode.id);
                      setIsViewDropdownOpen(false);
                    }}
                    className={`hover:bg-xp-surface-light flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                      viewMode === mode.id ? 'text-xp-blue' : ''
                    }`}
                  >
                    <span className="text-sm">{mode.icon}</span>
                    <span className="text-xs">{mode.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {/* Action Buttons */}
          <button
            onClick={handleCreateFolder}
            className="hover:bg-xp-surface-light rounded p-1.5 transition-colors"
            title={t('operationBar.createFolder')}
            aria-label={t('operationBar.createFolder')}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              <path
                fillRule="evenodd"
                d="M10 9a1 1 0 00-1 1v1H8a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {selectedFiles.size > 0 && (
            <button
              onClick={handleDelete}
              className="hover:bg-xp-red/20 text-xp-red rounded p-1.5 transition-colors"
              title={t('operationBar.deleteItems', { count: selectedFiles.size })}
              aria-label={t('operationBar.deleteItemsAria', { count: selectedFiles.size })}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}

          <button
            onClick={() => {
              setBottomPanelCollapsed(false);
              setBottomPanelTab('terminal');
            }}
            className="hover:bg-xp-surface-light rounded p-1.5 transition-colors"
            title={t('operationBar.openTerminal')}
            aria-label={t('operationBar.openTerminal')}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Gear / Actions dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
              className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text rounded p-1.5 transition-colors"
              title={t('operationBar.actionsMenu')}
              aria-label={t('operationBar.actionsMenu')}
              aria-haspopup="menu"
              aria-expanded={isActionsDropdownOpen}
            >
              <Settings size={16} />
            </button>

            {isActionsDropdownOpen && (
              <div className="bg-xp-popover border-xp-border absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border py-1 shadow-xl backdrop-blur-xl">
                {/* New Folder */}
                <button
                  onClick={() => {
                    handleCreateFolder();
                    setIsActionsDropdownOpen(false);
                  }}
                  className="hover:bg-xp-surface-light flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors"
                >
                  <FolderPlus size={14} className="text-xp-text-muted shrink-0" />
                  <span>{t('operationBar.newFolder')}</span>
                </button>

                {/* New File */}
                {onCreateFile && (
                  <button
                    onClick={() => {
                      onCreateFile();
                      setIsActionsDropdownOpen(false);
                    }}
                    className="hover:bg-xp-surface-light flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors"
                  >
                    <FilePlus size={14} className="text-xp-text-muted shrink-0" />
                    <span>{t('operationBar.newFile')}</span>
                  </button>
                )}

                <div className="border-xp-border my-1 border-t" />

                {/* Compress */}
                {onCompress && (
                  <button
                    onClick={() => {
                      onCompress();
                      setIsActionsDropdownOpen(false);
                    }}
                    className="hover:bg-xp-surface-light flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors"
                  >
                    <Package size={14} className="text-xp-text-muted shrink-0" />
                    <span>{t('operationBar.compress')}</span>
                  </button>
                )}

                {/* Extract */}
                {onExtract && (
                  <button
                    onClick={() => {
                      onExtract();
                      setIsActionsDropdownOpen(false);
                    }}
                    className="hover:bg-xp-surface-light flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors"
                  >
                    <PackageOpen size={14} className="text-xp-text-muted shrink-0" />
                    <span>{t('operationBar.extract')}</span>
                  </button>
                )}

                <div className="border-xp-border my-1 border-t" />

                {/* Open in Terminal */}
                <button
                  onClick={handleOpenTerminal}
                  className="hover:bg-xp-surface-light flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors"
                >
                  <Terminal size={14} className="text-xp-text-muted shrink-0" />
                  <span>{t('operationBar.openInTerminal')}</span>
                </button>

                {/* Copy Path */}
                {onCopyPath && (
                  <button
                    onClick={() => {
                      onCopyPath();
                      setIsActionsDropdownOpen(false);
                    }}
                    className="hover:bg-xp-surface-light flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors"
                  >
                    <Copy size={14} className="text-xp-text-muted shrink-0" />
                    <span>{t('operationBar.copyPath')}</span>
                  </button>
                )}

                <div className="border-xp-border my-1 border-t" />

                {/* Properties */}
                {onProperties && (
                  <button
                    onClick={() => {
                      onProperties();
                      setIsActionsDropdownOpen(false);
                    }}
                    className="hover:bg-xp-surface-light flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors"
                  >
                    <Info size={14} className="text-xp-text-muted shrink-0" />
                    <span>{t('operationBar.properties')}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationBar;
