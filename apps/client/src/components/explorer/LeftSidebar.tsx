import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { FileEntry } from '@/lib/tauri-api';
import SearchResultsPanel, {
  type SearchResultsPanelHandle,
} from '@/components/explorer/SearchResultsPanel';
import { extensionHost } from '@/lib/extension-host';
import { type FileCollection } from '@/lib/collections';
import { useSidebarResize } from '@/hooks/use-sidebar-resize';
import SidebarTabBar from '@/components/explorer/sidebar/SidebarTabBar';
import SidebarQuickAccess from '@/components/explorer/sidebar/SidebarQuickAccess';
import SidebarRecent from '@/components/explorer/sidebar/SidebarRecent';
import SidebarBookmarks from '@/components/explorer/sidebar/SidebarBookmarks';
import SidebarCollections from '@/components/explorer/sidebar/SidebarCollections';
import SidebarDrives from '@/components/explorer/sidebar/SidebarDrives';
import SidebarFileTree from '@/components/explorer/sidebar/SidebarFileTree';

export interface LeftSidebarHandle {
  focusSearch: () => void;
}

interface LeftSidebarProps {
  currentPath: string;
  navigateToPath: (path: string) => void;
  handleFileClick: (file: FileEntry) => void;
  handleFileRightClick?: (file: FileEntry, event: React.MouseEvent) => void;
  handleFileOpen?: (file: FileEntry) => void;
  getFileIcon: (file: FileEntry) => React.ReactNode;
  width?: number;
  searchPanelOpen?: boolean;
  onToggleSearchPanel?: () => void;
  onCreateCollection?: () => void;
  onEditCollection?: (collection: FileCollection) => void;
  // Active collection filter (collection applied as filter on current directory)
  activeCollectionFilter?: FileCollection | null;
  onToggleCollectionFilter?: (collection: FileCollection) => void;
  'data-tour'?: string;
}

const LeftSidebar = forwardRef<LeftSidebarHandle, LeftSidebarProps>(function LeftSidebar(
  {
    currentPath,
    navigateToPath,
    handleFileClick,
    handleFileRightClick,
    handleFileOpen,
    getFileIcon,
    width,
    searchPanelOpen = false,
    onToggleSearchPanel,
    onCreateCollection,
    onEditCollection,
    activeCollectionFilter,
    onToggleCollectionFilter,
    'data-tour': dataTour,
  },
  ref,
) {
  const searchPanelRef = useRef<SearchResultsPanelHandle>(null);

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      if (!searchPanelOpen && onToggleSearchPanel) {
        onToggleSearchPanel();
        setTimeout(() => searchPanelRef.current?.focus(), 100);
      } else {
        searchPanelRef.current?.focus();
      }
    },
  }));

  // ─── Extension sidebar tabs ────────────────────────────────────────────
  const [activeExtensionTab, setActiveExtensionTab] = useState<string | null>(null);

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const unsub = extensionHost.onChange(() => forceUpdate((n) => n + 1));
    return unsub;
  }, []);

  const extensionSidebarTabs = extensionHost.getSidebarTabs();

  let activeTabId: string;
  if (activeExtensionTab) {
    activeTabId = activeExtensionTab;
  } else if (searchPanelOpen) {
    activeTabId = '__search__';
  } else {
    activeTabId = '__explorer__';
  }

  const handleTabClick = (tabId: string) => {
    if (tabId === '__explorer__') {
      setActiveExtensionTab(null);
      if (searchPanelOpen && onToggleSearchPanel) onToggleSearchPanel();
    } else if (tabId === '__search__') {
      setActiveExtensionTab(null);
      if (!searchPanelOpen && onToggleSearchPanel) onToggleSearchPanel();
    } else {
      if (searchPanelOpen && onToggleSearchPanel) onToggleSearchPanel();
      setActiveExtensionTab(tabId);
    }
  };

  // ─── Section collapsed state + resize ─────────────────────────────────
  const { sectionCollapsed, sectionHeights, toggleSection, onResizeStart } = useSidebarResize();

  return (
    <nav
      data-tour={dataTour}
      role="navigation"
      aria-label="File explorer sidebar"
      className="bg-xp-surface border-xp-border flex flex-shrink-0 flex-col border-r"
      style={{ width: width ?? 256, minHeight: 0, overflow: 'hidden' }}
    >
      {/* Sidebar tab bar */}
      {onToggleSearchPanel && (
        <SidebarTabBar
          activeTabId={activeTabId}
          onTabClick={handleTabClick}
          extensionTabs={extensionSidebarTabs}
        />
      )}

      {/* Search panel */}
      {activeTabId === '__search__' && (
        <SearchResultsPanel
          ref={searchPanelRef}
          basePath={currentPath}
          navigateToPath={navigateToPath}
          onFileSelect={handleFileClick}
          onFileOpen={handleFileOpen}
        />
      )}

      {/* Extension sidebar tab content */}
      {activeExtensionTab &&
        (() => {
          const renderer = extensionHost.getSidebarTabRenderer(activeExtensionTab);
          if (!renderer) {
            return (
              <div className="text-xp-text-muted flex flex-1 items-center justify-center p-4 text-xs">
                Extension tab not available
              </div>
            );
          }
          return renderer({ currentPath, isActive: true });
        })()}

      {/* Explorer content (default) */}
      {activeTabId === '__explorer__' && (
        <>
          <SidebarQuickAccess
            currentPath={currentPath}
            navigateToPath={navigateToPath}
            collapsed={sectionCollapsed.quickAccess}
            onToggleCollapsed={() => toggleSection('quickAccess')}
            sectionHeight={sectionHeights.quickAccess}
            onResizeStart={onResizeStart}
          />

          <SidebarRecent
            navigateToPath={navigateToPath}
            collapsed={sectionCollapsed.recent}
            onToggleCollapsed={() => toggleSection('recent')}
            sectionHeight={sectionHeights.recent}
            onResizeStart={onResizeStart}
          />

          <SidebarBookmarks
            currentPath={currentPath}
            navigateToPath={navigateToPath}
            handleFileRightClick={handleFileRightClick}
            collapsed={sectionCollapsed.favorites}
            onToggleCollapsed={() => toggleSection('favorites')}
            sectionHeight={sectionHeights.favorites}
            onResizeStart={onResizeStart}
          />

          <SidebarCollections
            currentPath={currentPath}
            navigateToPath={navigateToPath}
            activeCollectionFilter={activeCollectionFilter}
            onToggleCollectionFilter={onToggleCollectionFilter}
            onCreateCollection={onCreateCollection}
            onEditCollection={onEditCollection}
            collapsed={sectionCollapsed.collections}
            onToggleCollapsed={() => toggleSection('collections')}
            sectionHeight={sectionHeights.collections}
            onResizeStart={onResizeStart}
          />

          <SidebarDrives
            navigateToPath={navigateToPath}
            collapsed={sectionCollapsed.drives}
            onToggleCollapsed={() => toggleSection('drives')}
            sectionHeight={sectionHeights.drives}
            onResizeStart={onResizeStart}
          />

          <SidebarFileTree
            currentPath={currentPath}
            navigateToPath={navigateToPath}
            handleFileClick={handleFileClick}
            handleFileRightClick={handleFileRightClick}
            getFileIcon={getFileIcon}
            collapsed={sectionCollapsed.fileTree}
            onToggleCollapsed={() => toggleSection('fileTree')}
          />
        </>
      )}
    </nav>
  );
});

export default LeftSidebar;
