import { useRef, useState, useEffect, forwardRef } from 'react';
import { isTauri } from '@/lib/transport';
import {
  Minus,
  Square,
  Copy,
  X,
  Plus,
  Columns,
  Rows,
  ChevronUp,
  RefreshCw,
  FolderClosed,
  File,
  FileCode,
  GitCompareArrows,
  Cloud,
  MessageSquare,
} from 'lucide-react';
import { TauriAPI } from '@/lib/tauri-api';
import { ROOT_PATH } from '@/lib/constants';
import type { TabItem } from '@/types/split-view';
import { type FileCollection, getAllCollections, isQuickFilter } from '@/lib/collections';
import { renderIcon } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export interface TopBarHandle {
  // Retained for API compatibility — search now lives in the sidebar
}
interface TopBarProps {
  leftSidebarCollapsed: boolean;
  setLeftSidebarCollapsed: (collapsed: boolean) => void;
  currentPath: string;
  // Navigation
  navigateUp?: () => void;
  refetch?: () => void;
  navigateBackInHistory?: () => void;
  navigateForwardInHistory?: () => void;
  canNavigateBackInHistory?: () => boolean;
  canNavigateForwardInHistory?: () => boolean;
  // Tabs
  tabs?: TabItem[];
  activeTabId?: string;
  onSwitchTab?: (tabId: string) => void;
  onCloseTab?: (tabId: string) => void;
  // Split/tab actions
  onAddTab?: () => void;
  onSplitRight?: () => void;
  onSplitDown?: () => void;
  'data-tour'?: string;
  // Cross-tab selection
  crossTabTotalCount?: number;
  crossTabTabCount?: number;
  hasMultiTabSelection?: boolean;
  onOpenBatchActions?: () => void;
  onClearCrossTabSelection?: () => void;
  // Collection filters (collections applied as filters on current directory)
  activeCollectionFilter?: FileCollection | null;
  onToggleCollectionFilter?: (collection: FileCollection) => void;
  onClearCollectionFilter?: () => void;
}

const getTabIcon = (tab: TabItem) => {
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
}

const TopBar = forwardRef<TopBarHandle, TopBarProps>(
  (
    {
      leftSidebarCollapsed,
      setLeftSidebarCollapsed,
      currentPath,
      navigateUp,
      refetch,
      navigateBackInHistory,
      navigateForwardInHistory,
      canNavigateBackInHistory,
      canNavigateForwardInHistory,
      tabs,
      activeTabId,
      onSwitchTab,
      onCloseTab,
      onAddTab,
      onSplitRight,
      onSplitDown,
      'data-tour': dataTour,
      crossTabTotalCount = 0,
      crossTabTabCount = 0,
      hasMultiTabSelection = false,
      onOpenBatchActions,
      onClearCrossTabSelection,
      activeCollectionFilter,
      onToggleCollectionFilter,
      onClearCollectionFilter,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [isMaximized, setIsMaximized] = useState(false);
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
    const [quickFilters, setQuickFilters] = useState<FileCollection[]>(() =>
      getAllCollections().filter(isQuickFilter),
    );
    const filterDropdownRef = useRef<HTMLDivElement>(null);

    // Load quick-filter collections and sync
    useEffect(() => {
      const handler = () => setQuickFilters(getAllCollections().filter(isQuickFilter));
      window.addEventListener('collections-changed', handler);
      return () => window.removeEventListener('collections-changed', handler);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
      if (!filterDropdownOpen) return;
      const close = (e: MouseEvent) => {
        if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
          setFilterDropdownOpen(false);
        }
      };
      document.addEventListener('mousedown', close);
      return () => document.removeEventListener('mousedown', close);
    }, [filterDropdownOpen]);
    const appWindowRef = useRef<Awaited<
      ReturnType<typeof import('@tauri-apps/api/window').getCurrentWindow>
    > | null>(null);
    const isMac = navigator.platform.toUpperCase().includes('MAC');

    useEffect(() => {
      if (!isTauri()) return;
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let cancelled = false;
      const cleanupRef = { current: null as (() => void) | null };
      (async () => {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        if (cancelled) return;
        appWindowRef.current = win;
        win.isMaximized().then(setIsMaximized);
        const unlisten = win.onResized(() => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            win.isMaximized().then(setIsMaximized);
          }, 150);
        });
        // Store unlisten for cleanup
        if (!cancelled) {
          cleanupRef.current = async () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            (await unlisten)();
          };
        }
      })();
      return () => {
        cancelled = true;
        if (debounceTimer) clearTimeout(debounceTimer);
        cleanupRef.current?.();
      };
    }, []);

    return (
      <div data-tour={dataTour} className="flex-none bg-xp-surface border-b border-xp-border">
        {/* Row 1: Title bar (draggable) */}
        <div
          className="flex items-center justify-between px-4 py-1"
          onMouseDown={(e) => {
            if (
              !(e.target as HTMLElement).closest(
                'button, input, a, select, textarea, [role="button"]',
              )
            ) {
              e.preventDefault();
              appWindowRef.current?.startDragging();
            }
          }}
          onDoubleClick={(e) => {
            if (
              !(e.target as HTMLElement).closest(
                'button, input, a, select, textarea, [role="button"]',
              )
            ) {
              appWindowRef.current?.toggleMaximize();
            }
          }}
        >
          <div className="flex items-center space-x-3">
            {isMac && (
              <div className="flex items-center gap-2 mr-2" role="toolbar" aria-label="Window controls">
                <button
                  onClick={() => appWindowRef.current?.close()}
                  className="group w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-90 transition-all flex items-center justify-center"
                  aria-label={t('topBar.closeWindow')}
                >
                  <svg className="w-1.5 h-1.5 opacity-0 group-hover:opacity-100 text-[#4a0002]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6" /></svg>
                </button>
                <button
                  onClick={() => appWindowRef.current?.minimize()}
                  className="group w-3 h-3 rounded-full bg-[#febc2e] hover:brightness-90 transition-all flex items-center justify-center"
                  aria-label={t('topBar.minimize')}
                >
                  <svg className="w-1.5 h-1.5 opacity-0 group-hover:opacity-100 text-[#995700]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 6h8" /></svg>
                </button>
                <button
                  onClick={() => appWindowRef.current?.toggleMaximize()}
                  className="group w-3 h-3 rounded-full bg-[#28c840] hover:brightness-90 transition-all flex items-center justify-center"
                  aria-label={isMaximized ? t('topBar.restore') : t('topBar.maximize')}
                >
                  <svg className="w-1.5 h-1.5 opacity-0 group-hover:opacity-100 text-[#006500]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 3.5l4-2 4 2M2 8.5l4 2 4-2M2 3.5v5M10 3.5v5" /></svg>
                </button>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
                className="p-1 hover:bg-xp-surface-light rounded transition-colors"
                aria-label={t('topBar.toggleSidebar')}
                title={t('topBar.toggleSidebarShortcut')}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <h1 className="text-sm font-medium">Xplorer</h1>
            </div>
          </div>
          {/* Spacer — search is in the left sidebar */}
          <div className="flex-1" />
          {!isMac && (
            <div className="flex items-center ml-2" role="toolbar" aria-label="Window controls">
              <button
                onClick={() => appWindowRef.current?.minimize()}
                className="p-2 hover:bg-xp-surface-light rounded transition-colors"
                aria-label={t('topBar.minimize')}
              >
                <Minus size={14} />
              </button>
              <button
                onClick={() => appWindowRef.current?.toggleMaximize()}
                className="p-2 hover:bg-xp-surface-light rounded transition-colors"
                aria-label={isMaximized ? t('topBar.restore') : t('topBar.maximize')}
              >
                {isMaximized ? <Copy size={14} /> : <Square size={14} />}
              </button>
              <button
                onClick={() => appWindowRef.current?.close()}
                className="p-2 xp-close-btn rounded transition-colors"
                aria-label={t('topBar.closeWindow')}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Row 2: Nav buttons + Tabs + Split controls */}
        <div className="flex items-center px-2 gap-0.5">
          {/* Nav buttons */}
          {navigateBackInHistory && (
            <button
              onClick={navigateBackInHistory}
              disabled={!canNavigateBackInHistory?.()}
              className="p-1 hover:bg-xp-surface-light rounded disabled:opacity-30 transition-colors flex-shrink-0"
              title={t('topBar.goBack')}
              aria-label={t('topBar.goBack')}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
          {navigateForwardInHistory && (
            <button
              onClick={navigateForwardInHistory}
              disabled={!canNavigateForwardInHistory?.()}
              className="p-1 hover:bg-xp-surface-light rounded disabled:opacity-30 transition-colors flex-shrink-0"
              title={t('topBar.goForward')}
              aria-label={t('topBar.goForward')}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
          {navigateUp && (
            <button
              onClick={navigateUp}
              disabled={currentPath === ROOT_PATH}
              className="p-1 hover:bg-xp-surface-light rounded disabled:opacity-30 transition-colors flex-shrink-0"
              title={t('topBar.goUp')}
              aria-label={t('topBar.goUp')}
            >
              <ChevronUp size={16} />
            </button>
          )}
          {refetch && (
            <button
              onClick={refetch}
              className="p-1 hover:bg-xp-surface-light rounded transition-colors flex-shrink-0"
              title={t('topBar.refresh')}
              aria-label={t('topBar.refresh')}
            >
              <RefreshCw size={14} />
            </button>
          )}

          {/* New Chat button — available in any folder */}
          {!currentPath.startsWith('xplorer://') && (
            <button
              onClick={async () => {
                try {
                  await TauriAPI.createChatFile(currentPath);
                  refetch?.();
                } catch (err) {
                  console.error('Failed to create chat:', err);
                }
              }}
              className="p-1 hover:bg-xp-surface-light rounded transition-colors flex-shrink-0"
              title={t('topBar.newChatDesc')}
              aria-label={t('topBar.newChat')}
            >
              <MessageSquare size={14} />
            </button>
          )}

          {/* Quick Filter dropdown (built-in + user collections with no basePath) */}
          <div ref={filterDropdownRef} style={{ position: 'relative' }} className="flex-shrink-0">
            <button
              onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
              className={`p-1 rounded transition-colors flex-shrink-0 flex items-center gap-1 ${
                activeCollectionFilter
                  ? 'text-xp-text'
                  : 'hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text'
              }`}
              style={
                activeCollectionFilter
                  ? {
                      backgroundColor: `${activeCollectionFilter.color}20`,
                      border: `1px solid ${activeCollectionFilter.color}40`,
                    }
                  : undefined
              }
              title={t('topBar.quickFilters')}
              aria-label={t('topBar.quickFilters')}
              aria-expanded={filterDropdownOpen}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {activeCollectionFilter && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    maxWidth: '80px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeCollectionFilter.name}
                </span>
              )}
            </button>
            {filterDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  zIndex: 9999,
                  minWidth: '200px',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  borderRadius: '8px',
                  backgroundColor: 'var(--xp-surface)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid var(--xp-border)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  padding: '4px',
                  marginTop: '4px',
                  animation: 'fadeIn 100ms ease-out',
                }}
              >
                {quickFilters.map((col) => {
                  const isActive = activeCollectionFilter?.id === col.id;
                  return (
                    <button
                      key={col.id}
                      className="flex items-center w-full px-3 py-1.5 text-xs rounded transition-colors"
                      style={{
                        color: 'var(--xp-text)',
                        backgroundColor: isActive ? `${col.color}15` : 'transparent',
                        borderLeft: isActive
                          ? `3px solid ${col.color}`
                          : '3px solid transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive)
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            'var(--xp-surface-light)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive)
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }}
                      onClick={() => {
                        onToggleCollectionFilter?.(col);
                        setFilterDropdownOpen(false);
                      }}
                    >
                      <span style={{ marginRight: '8px', fontSize: '14px', display: 'inline-flex', alignItems: 'center' }}>{renderIcon(col.icon, 14)}</span>
                      <span style={{ flex: 1, textAlign: 'left' }}>{col.name}</span>
                      {isActive && (
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: col.color,
                            marginLeft: '8px',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
                {/* Divider + clear */}
                {activeCollectionFilter && (
                  <>
                    <div
                      style={{ height: '1px', backgroundColor: 'var(--xp-border)', margin: '4px 0' }}
                    />
                    <button
                      className="flex items-center w-full px-3 py-1.5 text-xs rounded transition-colors"
                      style={{ color: 'var(--xp-text-muted)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          'var(--xp-surface-light)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }}
                      onClick={() => {
                        onClearCollectionFilter?.();
                        setFilterDropdownOpen(false);
                      }}
                    >
                      <X size={12} style={{ marginRight: '8px' }} />
                      {t('topBar.clearFilter')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-xp-border mx-0.5 flex-shrink-0" />

          {/* Tabs */}
          <div className="flex-1 flex overflow-x-auto min-w-0 scrollbar-none">
            {tabs?.map((tab) => {
              const TabIcon = getTabIcon(tab);
              const isActive = activeTabId === tab.id;
              return (
                <div
                  key={tab.id}
                  className={`flex items-center px-3 py-1 border-r border-xp-border cursor-pointer min-w-0 max-w-[180px] group flex-shrink-0 ${
                    isActive ? 'bg-xp-bg border-b-2 border-b-xp-blue' : 'hover:bg-xp-surface-light'
                  }`}
                  onClick={() => onSwitchTab?.(tab.id)}
                >
                  <TabIcon size={13} className="mr-1.5 flex-shrink-0 text-xp-text-secondary" />
                  <span className="text-xs font-medium truncate">{tab.name}</span>
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab?.(tab.id);
                      }}
                      className="ml-1 p-0.5 hover:bg-xp-surface-light rounded opacity-0 group-hover:opacity-100 flex-shrink-0"
                      aria-label={`Close ${tab.name}`}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Split/tab actions */}
          <div className="flex items-center flex-shrink-0 gap-0.5 ml-0.5">
            {onAddTab && (
              <button
                onClick={onAddTab}
                className="p-1 hover:bg-xp-surface-light rounded text-xp-text-muted hover:text-xp-text"
                title={t('topBar.newTabShortcut')}
                aria-label={t('topBar.newTab')}
              >
                <Plus size={14} />
              </button>
            )}
            {onSplitRight && (
              <button
                onClick={onSplitRight}
                className="p-1 hover:bg-xp-surface-light rounded text-xp-text-muted hover:text-xp-text"
                title={t('topBar.splitRightShortcut')}
                aria-label={t('topBar.splitRight')}
              >
                <Columns size={14} />
              </button>
            )}
            {onSplitDown && (
              <button
                onClick={onSplitDown}
                className="p-1 hover:bg-xp-surface-light rounded text-xp-text-muted hover:text-xp-text"
                title={t('topBar.splitDownShortcut')}
                aria-label={t('topBar.splitDown')}
              >
                <Rows size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Cross-tab selection floating action bar */}
        {hasMultiTabSelection && crossTabTotalCount > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px',
              background: 'color-mix(in srgb, var(--xp-blue) 12%, var(--xp-surface))',
              borderTop: '1px solid color-mix(in srgb, var(--xp-blue) 25%, var(--xp-border))',
              fontSize: 12,
              color: 'var(--xp-text)',
            }}
          >
            {/* Selection badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 10,
                background: 'var(--xp-blue)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              {crossTabTotalCount !== 1 || crossTabTabCount !== 1
                ? t('topBar.crossTabSelectionPlural', { fileCount: crossTabTotalCount, tabCount: crossTabTabCount })
                : t('topBar.crossTabSelection', { fileCount: crossTabTotalCount, tabCount: crossTabTabCount })}
            </span>

            <span style={{ color: 'var(--xp-text-muted)', fontSize: 11 }}>
              {t('topBar.crossTabHint')}
            </span>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Batch Actions button */}
            {onOpenBatchActions && (
              <button
                onClick={onOpenBatchActions}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 500,
                  borderRadius: 5,
                  border: '1px solid var(--xp-blue)',
                  background: 'var(--xp-blue)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '0.85';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '1';
                }}
                title={t('topBar.batchActionsDesc')}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
                {t('topBar.batchActions')}
              </button>
            )}

            {/* Clear Selection button */}
            {onClearCrossTabSelection && (
              <button
                onClick={onClearCrossTabSelection}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 500,
                  borderRadius: 5,
                  border: '1px solid var(--xp-border)',
                  background: 'var(--xp-surface-light)',
                  color: 'var(--xp-text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--xp-text)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface-light)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--xp-text-muted)';
                }}
                title={t('topBar.clearSelectionDesc')}
              >
                <X size={12} />
                {t('topBar.clearSelection')}
              </button>
            )}
          </div>
        )}
      </div>
    );
  },
);
TopBar.displayName = 'TopBar';
export default TopBar;
