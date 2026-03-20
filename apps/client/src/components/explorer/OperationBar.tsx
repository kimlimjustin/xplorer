import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ChevronDown,
  CheckSquare,
  Square,
  RotateCcw,
  Sparkles,
  Rows3,
  BarChart3,
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
  onSelectAll,
  onSelectNone,
  onInvertSelection,
  onAdvancedSelection,
  showSizeBadges,
  onToggleSizeBadges,
}: OperationBarProps) => {
  const { t } = useTranslation();
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isSelectionDropdownOpen, setIsSelectionDropdownOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isViewDropdownOpen && !isSortDropdownOpen && !isSelectionDropdownOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setIsViewDropdownOpen(false);
        setIsSortDropdownOpen(false);
        setIsSelectionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isViewDropdownOpen, isSortDropdownOpen, isSelectionDropdownOpen]);

  return (
    <div ref={barRef} className="bg-xp-surface border-b border-xp-border px-3 py-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1">
          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-xp-text-muted hover:text-xp-text rounded hover:bg-xp-surface-light transition-colors"
              aria-label={t('operationBar.sortBy', { name: sortOptions?.[sortBy]?.name || 'Name', order: sortOrder === 'asc' ? 'ascending' : 'descending' })}
            >
              <span className="whitespace-nowrap">{sortOptions?.[sortBy]?.name || 'Name'}</span>
              <ChevronDown size={12} className="opacity-60" />
            </button>

            {isSortDropdownOpen && sortOptions && (
              <div className="absolute left-0 top-full mt-1 bg-xp-popover border border-xp-border rounded-lg shadow-xl backdrop-blur-xl z-50 min-w-[170px] py-1">
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
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-xp-surface-light transition-colors ${
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
                    <div className="border-t border-xp-border my-1" />
                    <button
                      onClick={() => {
                        setGroupByDate(!groupByDate);
                        setIsSortDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-xp-surface-light transition-colors ${
                        groupByDate ? 'text-xp-blue' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Rows3 size={13} className="inline-block" />
                        <span className="text-xs">{t('operationBar.groupByDate')}</span>
                      </div>
                      {groupByDate && (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
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
          <div className="w-px h-4 bg-xp-border" />

          {/* Size Map toggle */}
          {onToggleSizeBadges && (
            <button
              onClick={onToggleSizeBadges}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                showSizeBadges
                  ? 'text-xp-blue bg-xp-blue/10'
                  : 'text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light'
              }`}
              title={showSizeBadges ? t('operationBar.hideSizeHeatmap') : t('operationBar.showSizeHeatmap')}
              aria-label={showSizeBadges ? t('operationBar.hideSizeHeatmap') : t('operationBar.showSizeHeatmap')}
              aria-pressed={showSizeBadges}
            >
              <BarChart3 size={14} />
              <span className="whitespace-nowrap">{t('operationBar.sizeMap')}</span>
            </button>
          )}

          {/* Separator */}
          <div className="w-px h-4 bg-xp-border" />

          {/* View Mode Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-xp-text-muted hover:text-xp-text rounded hover:bg-xp-surface-light transition-colors"
              aria-label={t('operationBar.viewMode', { name: viewModes[viewMode]?.name || 'Medium Icons' })}
            >
              <span className="text-sm">{viewModes[viewMode]?.icon}</span>
              <span className="whitespace-nowrap">{viewModes[viewMode]?.name || 'Grid'}</span>
              <ChevronDown size={12} className="opacity-60" />
            </button>

            {isViewDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 bg-xp-popover border border-xp-border rounded-lg shadow-xl backdrop-blur-xl z-50 min-w-[170px] py-1">
                {Object.values(viewModes).map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setViewMode(mode.id);
                      setIsViewDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-xp-surface-light transition-colors ${
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
          {/* Selection Dropdown */}
          {(onSelectAll || onSelectNone || onInvertSelection || onAdvancedSelection) && (
            <div className="relative">
              <button
                onClick={() => setIsSelectionDropdownOpen(!isSelectionDropdownOpen)}
                className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-xp-surface-light transition-colors text-xp-text-muted hover:text-xp-text"
                title={t('operationBar.selectionOptions')}
                aria-label={t('operationBar.selectionOptions')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                <span className="text-sm">{t('operationBar.select')}</span>
              </button>

              {isSelectionDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 bg-xp-popover border border-xp-border rounded shadow-xl backdrop-blur-xl z-50 min-w-[200px]">
                  {onSelectAll && (
                    <button
                      onClick={() => {
                        onSelectAll();
                        setIsSelectionDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-xp-surface-light transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <CheckSquare size={14} />
                        <span className="text-sm">{t('operationBar.selectAll')}</span>
                      </div>
                      <span className="text-xs text-xp-text-muted">Ctrl+A</span>
                    </button>
                  )}
                  {onSelectNone && (
                    <button
                      onClick={() => {
                        onSelectNone();
                        setIsSelectionDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-xp-surface-light transition-colors"
                    >
                      <Square size={14} />
                      <span className="text-sm">{t('operationBar.selectNone')}</span>
                    </button>
                  )}
                  {onInvertSelection && (
                    <button
                      onClick={() => {
                        onInvertSelection();
                        setIsSelectionDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-xp-surface-light transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <RotateCcw size={14} />
                        <span className="text-sm">{t('operationBar.invertSelection')}</span>
                      </div>
                      <span className="text-xs text-xp-text-muted">Ctrl+Shift+A</span>
                    </button>
                  )}
                  {onAdvancedSelection && (
                    <>
                      <div className="border-t border-xp-border my-1" />
                      <button
                        onClick={() => {
                          onAdvancedSelection();
                          setIsSelectionDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-xp-surface-light transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <Sparkles size={14} />
                          <span className="text-sm">{t('operationBar.advancedSelection')}</span>
                        </div>
                        <span className="text-xs text-xp-text-muted">Ctrl+Shift+S</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <button
            onClick={handleCreateFolder}
            className="p-1.5 hover:bg-xp-surface-light rounded transition-colors"
            title={t('operationBar.createFolder')}
            aria-label={t('operationBar.createFolder')}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
              className="p-1.5 hover:bg-xp-red/20 rounded text-xp-red transition-colors"
              title={t('operationBar.deleteItems', { count: selectedFiles.size })}
              aria-label={t('operationBar.deleteItemsAria', { count: selectedFiles.size })}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
            className="p-1.5 hover:bg-xp-surface-light rounded transition-colors"
            title={t('operationBar.openTerminal')}
            aria-label={t('operationBar.openTerminal')}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}

export default OperationBar;
