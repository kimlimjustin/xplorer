import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { FileEntry, TauriAPI, BookmarkEntry, RecentFile } from '@/lib/tauri-api';
import { PATH_SEPARATOR, isWindows, ROOT_PATH } from '@/lib/constants';
import {
  getAllCollections,
  deleteCollection,
  isSmartFolder,
  type FileCollection,
} from '@/lib/collections';
import { getFolderColorHex } from '@/lib/folder-colors';
import {
  Home,
  FileText,
  Download,
  Monitor,
  Image,
  FolderClosed,
  File,
  HardDrive,
  User,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
  FolderTree,
  Plus,
  GripHorizontal,
} from 'lucide-react';
import SearchResultsPanel, {
  type SearchResultsPanelHandle,
} from '@/components/explorer/SearchResultsPanel';
import { getPathBookmarks, type PathBookmark } from '@/lib/path-bookmarks';
import { renderIcon } from '@/lib/utils';
import { extensionHost } from '@/lib/extension-host';
import { useTranslation } from 'react-i18next';

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

interface UserDirectories {
  home: string;
  documents: string;
  downloads: string;
  desktop: string;
  pictures: string;
  videos: string;
  music: string;
}

type SortBy = 'name' | 'dateModified' | 'size' | 'type';
type SortOrder = 'asc' | 'desc';

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
  const { t } = useTranslation();
  const searchPanelRef = useRef<SearchResultsPanelHandle>(null);

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      // If search panel is not open, open it first
      if (!searchPanelOpen && onToggleSearchPanel) {
        onToggleSearchPanel();
        // Focus after panel opens
        setTimeout(() => searchPanelRef.current?.focus(), 100);
      } else {
        searchPanelRef.current?.focus();
      }
    },
  }));

  // ─── Extension sidebar tabs ────────────────────────────────────────────
  // Track which extension tab is active (null = none, use explorer/search from props)
  const [activeExtensionTab, setActiveExtensionTab] = useState<string | null>(null);

  // Subscribe to extension host changes to pick up newly registered sidebar tabs
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const unsub = extensionHost.onChange(() => forceUpdate((n) => n + 1));
    return unsub;
  }, []);

  const extensionSidebarTabs = extensionHost.getSidebarTabs();

  // Derive the effective active tab ID for the tab bar
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
      // Extension tab — ensure search panel is closed
      if (searchPanelOpen && onToggleSearchPanel) onToggleSearchPanel();
      setActiveExtensionTab(tabId);
    }
  };

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderContents, setFolderContents] = useState<Map<string, FileEntry[]>>(new Map());
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [sortBy, _setSortBy] = useState<SortBy>('name');
  const [sortOrder, _setSortOrder] = useState<SortOrder>('asc');
  // showSortOptions state removed — sort UI not yet wired up
  const [userDirectories, setUserDirectories] = useState<UserDirectories | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [drives, setDrives] = useState<
    { letter: string; label: string; path: string; total_space: number; free_space: number }[]
  >([]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [collections, setCollections] = useState<FileCollection[]>([]);

  // Unified section collapsed state (persisted to localStorage)
  type SectionId = 'quickAccess' | 'recent' | 'favorites' | 'collections' | 'drives' | 'fileTree';
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<SectionId, boolean>>(() => {
    try {
      const saved = localStorage.getItem('xplorer-sidebar-sections');
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      quickAccess: false,
      recent: true,
      favorites: false,
      collections: false,
      drives: false,
      fileTree: false,
    };
  });
  const [sectionHeights, setSectionHeights] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('xplorer-sidebar-heights');
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {};
  });

  const toggleSection = useCallback((id: SectionId) => {
    setSectionCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('xplorer-sidebar-sections', JSON.stringify(next));
      return next;
    });
  }, []);

  // Resize handle for sections
  const resizingRef = useRef<{ sectionId: string; startY: number; startHeight: number } | null>(
    null,
  );

  const onResizeStart = useCallback((sectionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const sectionEl = document.querySelector(
      `[data-sidebar-section="${sectionId}"]`,
    ) as HTMLElement | null;
    if (!sectionEl) return;
    const startHeight = sectionEl.getBoundingClientRect().height;
    resizingRef.current = { sectionId, startY: e.clientY, startHeight };

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientY - resizingRef.current.startY;
      const newHeight = Math.max(32, resizingRef.current.startHeight + delta);
      setSectionHeights((prev) => {
        const next = { ...prev, [sectionId]: newHeight };
        localStorage.setItem('xplorer-sidebar-heights', JSON.stringify(next));
        return next;
      });
    };
    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);
  const [collectionContextMenu, setCollectionContextMenu] = useState<{
    x: number;
    y: number;
    collection: FileCollection;
  } | null>(null);

  // Path bookmarks state
  const [_pathBookmarks, setPathBookmarks] = useState<PathBookmark[]>(() => getPathBookmarks());
  const [_pathBookmarksExpanded, _setPathBookmarksExpanded] = useState(true);
  const [pathBookmarkContextMenu, setPathBookmarkContextMenu] = useState<{
    x: number;
    y: number;
    bookmark: PathBookmark;
  } | null>(null);

  // Load path bookmarks and keep in sync
  useEffect(() => {
    const handler = () => setPathBookmarks(getPathBookmarks());
    window.addEventListener('path-bookmarks-changed', handler);
    return () => window.removeEventListener('path-bookmarks-changed', handler);
  }, []);

  // Close path bookmark context menu on click anywhere
  useEffect(() => {
    if (!pathBookmarkContextMenu) return;
    const close = () => setPathBookmarkContextMenu(null);
    document.addEventListener('click', close, { once: true });
    return () => document.removeEventListener('click', close);
  }, [pathBookmarkContextMenu]);

  // Folder color version counter — incremented when folder colors change so
  // components that read getFolderColorHex() will re-render.
  const [_folderColorVersion, setFolderColorVersion] = useState(0);
  useEffect(() => {
    const handler = () => setFolderColorVersion((v) => v + 1);
    window.addEventListener('folder-colors-changed', handler);
    return () => window.removeEventListener('folder-colors-changed', handler);
  }, []);

  // Load all collections (built-in + user) on mount and keep in sync
  useEffect(() => {
    setCollections(getAllCollections());
    const handler = () => setCollections(getAllCollections());
    window.addEventListener('collections-changed', handler);
    return () => window.removeEventListener('collections-changed', handler);
  }, []);

  // Close collection context menu on click anywhere
  useEffect(() => {
    if (!collectionContextMenu) return;
    const close = () => setCollectionContextMenu(null);
    document.addEventListener('click', close, { once: true });
    return () => document.removeEventListener('click', close);
  }, [collectionContextMenu]);

  // Load user directories on mount
  useEffect(() => {
    const loadUserDirectories = async () => {
      try {
        const userDirs = await TauriAPI.getUserDirectories();
        setUserDirectories(userDirs);
      } catch (error) {
        console.error('Failed to load user directories:', error);
        // Fallback to default directories based on platform
        const home = isWindows ? 'C:\\Users\\Public' : '/home/user';
        setUserDirectories({
          home,
          documents: `${home + PATH_SEPARATOR}Documents`,
          downloads: `${home + PATH_SEPARATOR}Downloads`,
          desktop: `${home + PATH_SEPARATOR}Desktop`,
          pictures: `${home + PATH_SEPARATOR}Pictures`,
          videos: `${home + PATH_SEPARATOR}Videos`,
          music: `${home + PATH_SEPARATOR}Music`,
        });
      }
    };

    const loadDrives = async () => {
      try {
        const driveList = await TauriAPI.listDrives();
        setDrives(driveList);
      } catch (error) {
        console.error('Failed to load drives:', error);
        // Fallback
        setDrives([
          {
            letter: isWindows ? 'C' : '',
            label: isWindows ? 'Local Disk' : 'Macintosh HD',
            path: ROOT_PATH,
            total_space: 0,
            free_space: 0,
          },
        ]);
      }
    };

    loadUserDirectories();
    loadDrives();
  }, []);

  // Load bookmarks on mount and keep them in sync with bookmark changes
  useEffect(() => {
    const loadBookmarks = async () => {
      try {
        const items = await TauriAPI.getBookmarks();
        setBookmarks(items);
      } catch (error) {
        console.error('Failed to load bookmarks:', error);
      }
    };

    loadBookmarks();

    const handleBookmarksChanged = () => loadBookmarks();
    window.addEventListener('bookmarks-changed', handleBookmarksChanged);
    return () => {
      window.removeEventListener('bookmarks-changed', handleBookmarksChanged);
    };
  }, []);

  // Load recent files on mount and refresh when files are opened
  useEffect(() => {
    const loadRecent = async () => {
      try {
        const files = await TauriAPI.getRecentFiles(10);
        setRecentFiles(files);
      } catch (error) {
        console.error('Failed to load recent files:', error);
      }
    };

    loadRecent();

    // Refresh on custom event (fired after a file is opened)
    const handleRecentChanged = () => loadRecent();
    window.addEventListener('recent-files-changed', handleRecentChanged);
    return () => {
      window.removeEventListener('recent-files-changed', handleRecentChanged);
    };
  }, []);

  const handleRemoveBookmark = async (path: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await TauriAPI.removeBookmark(path);
      setBookmarks((prev) => prev.filter((b) => b.path !== path));
    } catch (error) {
      console.error('Failed to remove bookmark:', error);
    }
  };

  // Enhanced sort files function with multiple criteria (memoized on sort config)
  const sortFiles = useCallback(
    (files: FileEntry[]): FileEntry[] => {
      return [...files].sort((a, b) => {
        // Always put directories first regardless of sort criteria
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;

        let comparison: number;

        switch (sortBy) {
          case 'name':
            comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            break;

          case 'dateModified':
            comparison = a.modified - b.modified;
            break;

          case 'size':
            comparison = a.size - b.size;
            break;

          case 'type': {
            const aExt = a.name.split('.').pop()?.toLowerCase() || '';
            const bExt = b.name.split('.').pop()?.toLowerCase() || '';
            comparison = aExt.localeCompare(bExt);
            // If extensions are the same, fall back to name
            if (comparison === 0) {
              comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            }
            break;
          }

          default:
            comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        }

        return sortOrder === 'desc' ? -comparison : comparison;
      });
    },
    [sortBy, sortOrder],
  );

  const toggleFolder = async (folderPath: string, event: React.MouseEvent) => {
    event.stopPropagation();

    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
        // Load folder contents if not already loaded
        if (!folderContents.has(folderPath)) {
          loadFolderContents(folderPath);
        }
      }
      return newSet;
    });
  };

  const loadFolderContents = async (folderPath: string) => {
    if (loadingFolders.has(folderPath)) return;

    setLoadingFolders((prev) => new Set(prev).add(folderPath));

    try {
      const contents = await TauriAPI.readDirectory(folderPath);
      // Show both directories and files in the tree sidebar
      const sortedContents = sortFiles(contents);

      setFolderContents((prev) => new Map(prev.set(folderPath, sortedContents)));
    } catch (error) {
      console.error('Failed to load folder contents:', error);
      // If error, set empty array so we don't keep trying
      setFolderContents((prev) => new Map(prev.set(folderPath, [])));
    } finally {
      setLoadingFolders((prev) => {
        const newSet = new Set(prev);
        newSet.delete(folderPath);
        return newSet;
      });
    }
  };

  const handleItemClick = (file: FileEntry) => {
    if (file.is_dir) {
      // Single click on folder navigates to it in current tab
      navigateToPath(file.path);
      handleFileClick(file);
    } else {
      // Single click on file selects it but doesn't open it
      handleFileClick(file);
    }
  };

  const handleItemRightClick = (file: FileEntry, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (handleFileRightClick) {
      handleFileRightClick(file, event);
    }
  };

  const renderFileItem = (file: FileEntry, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(file.path);
    const isLoading = loadingFolders.has(file.path);
    const hasChildren = folderContents.has(file.path);
    const children = folderContents.get(file.path) || [];

    return (
      <div key={file.path}>
        <div
          role="treeitem"
          aria-selected={currentPath === file.path}
          aria-expanded={file.is_dir ? isExpanded : undefined}
          aria-label={`${file.name}${file.is_dir ? ', folder' : ', file'}`}
          className={`hover:bg-xp-surface-light flex cursor-pointer items-center rounded px-1 py-1 text-xs transition-colors ${currentPath === file.path ? 'bg-xp-blue text-xp-blue border-xp-blue border-l-2 bg-opacity-25' : 'text-xp-text'} `}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleItemClick(file)}
          onContextMenu={(e) => handleItemRightClick(file, e)}
        >
          <div className="flex min-w-0 flex-1 items-center space-x-1">
            {/* Expand/Collapse Button - only for directories */}
            {file.is_dir ? (
              <button
                className="hover:bg-xp-surface-light flex h-5 w-5 flex-shrink-0 items-center justify-center rounded p-0.5 transition-colors"
                onClick={(e) => toggleFolder(file.path, e)}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? `Collapse ${file.name}` : `Expand ${file.name}`}
              >
                {(() => {
                  if (isLoading) {
                    return (
                      <svg className="h-3 w-3 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                          clipRule="evenodd"
                        />
                      </svg>
                    );
                  }
                  if (hasChildren && children.length > 0) {
                    return (
                      <svg
                        className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    );
                  }
                  return <div className="h-3 w-3" />;
                })()}
              </button>
            ) : (
              <div className="h-5 w-5" />
            )}

            <span className="mr-1 flex-shrink-0">{getFileIcon(file)}</span>
            {/* Folder color dot in tree */}
            {file.is_dir &&
              (() => {
                const treeColor = getFolderColorHex(file.path);
                return treeColor ? (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: treeColor,
                      flexShrink: 0,
                      marginRight: 2,
                    }}
                    aria-hidden="true"
                  />
                ) : null;
              })()}
            <span className="flex-1 truncate">{file.name}</span>
          </div>
        </div>

        {/* Show nested items if this is an expanded directory */}
        {file.is_dir && isExpanded && hasChildren && (
          <div role="group" aria-label={`Contents of ${file.name}`}>
            {children.map((childFile) => renderFileItem(childFile, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Get root directories for the current drive/volume
  const getRootPath = () => {
    // Protocol URLs (xplorer://home, xplorer://trash, etc.) are virtual paths
    if (currentPath.startsWith('xplorer://')) {
      return ROOT_PATH;
    }
    // Unix-style paths (macOS/Linux)
    if (currentPath.startsWith('/')) {
      return '/';
    }
    // Windows-style paths
    const pathParts = currentPath.split(/[\\/]/).filter((p) => p);
    return pathParts.length > 0 ? pathParts[0] + PATH_SEPARATOR : ROOT_PATH;
  };

  const rootPath = getRootPath();

  // Memoize the sorted root folder contents so they are only recomputed when
  // the underlying data or sort criteria change.
  const sortedRootContents = useMemo(() => {
    const rootContents = folderContents.get(rootPath);
    if (!rootContents) return undefined;
    return sortFiles(rootContents);
  }, [folderContents, rootPath, sortFiles]);

  // Load root directories when component mounts or root changes
  useEffect(() => {
    if (!folderContents.has(rootPath)) {
      loadFolderContents(rootPath);
      setExpandedFolders((prev) => new Set(prev).add(rootPath));
    }
    // Only load on rootPath change; folderContents check is a guard, not a trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath]);

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
        <div
          className="border-xp-border border-b"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            gap: '2px',
            flexShrink: 0,
          }}
          role="tablist"
          aria-label="Sidebar tabs"
        >
          {/* Explorer tab */}
          <button
            role="tab"
            onClick={() => handleTabClick('__explorer__')}
            className={`flex items-center justify-center rounded transition-colors ${
              activeTabId === '__explorer__'
                ? 'bg-xp-blue/15 text-xp-blue'
                : 'text-xp-text-muted hover:bg-xp-surface-light hover:text-xp-text'
            }`}
            style={{ width: 28, height: 28, padding: 0 }}
            aria-label="File explorer"
            aria-selected={activeTabId === '__explorer__'}
            title="File Explorer"
          >
            <FolderTree size={15} />
          </button>
          {/* Search tab */}
          <button
            role="tab"
            onClick={() => handleTabClick('__search__')}
            className={`flex items-center justify-center rounded transition-colors ${
              activeTabId === '__search__'
                ? 'bg-xp-blue/15 text-xp-blue'
                : 'text-xp-text-muted hover:bg-xp-surface-light hover:text-xp-text'
            }`}
            style={{ width: 28, height: 28, padding: 0 }}
            aria-label="Search files (Ctrl+Shift+F)"
            aria-selected={activeTabId === '__search__'}
            title="Search (Ctrl+Shift+F)"
          >
            <Search size={15} />
          </button>
          {/* Extension-registered sidebar tabs */}
          {extensionSidebarTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              onClick={() => handleTabClick(tab.id)}
              className={`flex items-center justify-center rounded transition-colors ${
                activeTabId === tab.id
                  ? 'bg-xp-blue/15 text-xp-blue'
                  : 'text-xp-text-muted hover:bg-xp-surface-light hover:text-xp-text'
              }`}
              style={{ width: 28, height: 28, padding: 0 }}
              aria-label={tab.title}
              aria-selected={activeTabId === tab.id}
              title={tab.title}
            >
              {tab.icon}
            </button>
          ))}
        </div>
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
          {/* Quick Access */}
          <div
            className="border-xp-border border-b"
            role="region"
            aria-label="Quick access"
            data-sidebar-section="quickAccess"
            style={
              !sectionCollapsed.quickAccess && sectionHeights.quickAccess
                ? { height: sectionHeights.quickAccess, overflow: 'hidden' }
                : undefined
            }
          >
            <button
              className="text-xp-text-muted hover:bg-xp-surface-light/50 flex w-full items-center px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors"
              onClick={() => toggleSection('quickAccess')}
              aria-expanded={!sectionCollapsed.quickAccess}
            >
              {sectionCollapsed.quickAccess ? (
                <ChevronRight className="mr-1 h-3 w-3 flex-shrink-0" />
              ) : (
                <ChevronDown className="mr-1 h-3 w-3 flex-shrink-0" />
              )}
              {t('sidebar.quickAccess')}
            </button>
            {!sectionCollapsed.quickAccess && (
              <div className="space-y-0.5 px-3 pb-2">
                {userDirectories &&
                  (
                    [
                      {
                        path: userDirectories.home,
                        Icon: Home,
                        color: 'text-xp-blue',
                        labelKey: 'sidebar.home' as const,
                      },
                      {
                        path: userDirectories.documents,
                        Icon: FileText,
                        color: 'text-xp-orange',
                        labelKey: 'sidebar.documents' as const,
                      },
                      {
                        path: userDirectories.downloads,
                        Icon: Download,
                        color: 'text-xp-green',
                        labelKey: 'sidebar.downloads' as const,
                      },
                      {
                        path: userDirectories.desktop,
                        Icon: Monitor,
                        color: 'text-xp-purple',
                        labelKey: 'sidebar.desktop' as const,
                      },
                      {
                        path: userDirectories.pictures,
                        Icon: Image,
                        color: 'text-xp-pink',
                        labelKey: 'sidebar.pictures' as const,
                      },
                    ] as const
                  ).map(({ path, Icon, color, labelKey }) => {
                    const label = t(labelKey);
                    const isActive = currentPath === path;
                    return (
                      <button
                        key={labelKey}
                        onClick={() => navigateToPath(path)}
                        className={`flex w-full items-center rounded px-2 py-1.5 text-xs transition-colors ${
                          isActive
                            ? 'bg-xp-blue/15 text-xp-blue'
                            : 'hover:bg-xp-surface-light text-xp-text'
                        }`}
                        aria-label={t('sidebar.navigateTo', { label })}
                      >
                        <Icon
                          size={15}
                          className={`mr-2.5 flex-shrink-0 ${isActive ? 'text-xp-blue' : color}`}
                          aria-hidden="true"
                        />
                        {label}
                      </button>
                    );
                  })}
              </div>
            )}
            {/* Resize handle */}
            <div
              className="hover:bg-xp-blue/30 group flex h-1 cursor-row-resize items-center justify-center transition-colors"
              onMouseDown={(e) => onResizeStart('quickAccess', e)}
            >
              <GripHorizontal className="text-xp-text-muted/0 group-hover:text-xp-text-muted/60 h-3 w-4 transition-colors" />
            </div>
          </div>

          {/* Recent Files */}
          <div
            className="border-xp-border border-b"
            role="region"
            aria-label="Recent files"
            data-sidebar-section="recent"
            style={
              !sectionCollapsed.recent && sectionHeights.recent
                ? { height: sectionHeights.recent, overflow: 'hidden' }
                : undefined
            }
          >
            <button
              className="text-xp-text-muted hover:bg-xp-surface-light/50 flex w-full items-center px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors"
              onClick={() => toggleSection('recent')}
              aria-expanded={!sectionCollapsed.recent}
              aria-label="Toggle recent files"
            >
              {sectionCollapsed.recent ? (
                <ChevronRight className="mr-1 h-3 w-3 flex-shrink-0" />
              ) : (
                <ChevronDown className="mr-1 h-3 w-3 flex-shrink-0" />
              )}
              <Clock size={12} className="mr-1 flex-shrink-0" />
              RECENT
            </button>
            {!sectionCollapsed.recent && (
              <div className="space-y-0.5 px-3 pb-2">
                {recentFiles.length === 0 ? (
                  <p className="text-xp-text-secondary py-1 text-xs">No recent files</p>
                ) : (
                  recentFiles.map((rf) => (
                    <div
                      key={rf.path}
                      className="hover:bg-xp-surface-light flex w-full cursor-pointer items-center rounded px-2 py-1 text-xs transition-colors"
                      onClick={() => {
                        if (rf.file_type === 'folder') {
                          navigateToPath(rf.path);
                        } else {
                          const sep = rf.path.includes('/') ? '/' : '\\';
                          const parts = rf.path.split(sep);
                          parts.pop();
                          const parentDir = parts.join(sep);
                          if (parentDir) navigateToPath(parentDir);
                        }
                      }}
                      title={rf.path}
                    >
                      {rf.file_type === 'folder' ? (
                        <FolderClosed size={14} className="text-xp-blue mr-2 flex-shrink-0" />
                      ) : (
                        <File size={14} className="text-xp-text-secondary mr-2 flex-shrink-0" />
                      )}
                      <span className="flex-1 truncate">{rf.name}</span>
                    </div>
                  ))
                )}
              </div>
            )}
            {/* Resize handle */}
            {!sectionCollapsed.recent && (
              <div
                className="hover:bg-xp-blue/30 group flex h-1 cursor-row-resize items-center justify-center transition-colors"
                onMouseDown={(e) => onResizeStart('recent', e)}
              >
                <GripHorizontal className="text-xp-text-muted/0 group-hover:text-xp-text-muted/60 h-3 w-4 transition-colors" />
              </div>
            )}
          </div>

          {/* Favorites */}
          <div
            className="border-xp-border border-b"
            role="region"
            aria-label="Favorites"
            data-sidebar-section="favorites"
            style={
              !sectionCollapsed.favorites && sectionHeights.favorites
                ? { height: sectionHeights.favorites, overflow: 'hidden' }
                : undefined
            }
          >
            <button
              className="text-xp-text-muted hover:bg-xp-surface-light/50 flex w-full items-center px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors"
              onClick={() => toggleSection('favorites')}
              aria-expanded={!sectionCollapsed.favorites}
            >
              {sectionCollapsed.favorites ? (
                <ChevronRight className="mr-1 h-3 w-3 flex-shrink-0" />
              ) : (
                <ChevronDown className="mr-1 h-3 w-3 flex-shrink-0" />
              )}
              {t('sidebar.favorites')}
            </button>
            {!sectionCollapsed.favorites && (
              <div className="space-y-0.5 px-3 pb-2">
                {bookmarks.length === 0 ? (
                  <p className="text-xp-text-secondary py-1 text-xs">{t('sidebar.noBookmarks')}</p>
                ) : (
                  bookmarks.map((bookmark) => {
                    const bookmarkColor = bookmark.is_dir ? getFolderColorHex(bookmark.path) : null;
                    return (
                      <div
                        key={bookmark.path}
                        className="hover:bg-xp-surface-light group flex w-full cursor-pointer items-center rounded px-2 py-1 text-xs transition-colors"
                        onClick={() => navigateToPath(bookmark.path)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (handleFileRightClick) {
                            // Create a synthetic FileEntry from the bookmark
                            const syntheticFile: FileEntry = {
                              name: bookmark.name,
                              path: bookmark.path,
                              size: 0,
                              modified: 0,
                              is_dir: bookmark.is_dir,
                              file_type: bookmark.is_dir
                                ? 'folder'
                                : bookmark.name.split('.').pop() || '',
                            };
                            handleFileRightClick(syntheticFile, e);
                          }
                        }}
                        title={bookmark.path}
                      >
                        {bookmarkColor && (
                          <span
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: bookmarkColor,
                              flexShrink: 0,
                              marginRight: 4,
                            }}
                            aria-hidden="true"
                          />
                        )}
                        {bookmark.is_dir ? (
                          <FolderClosed
                            size={14}
                            className="text-xp-blue mr-2 flex-shrink-0"
                            style={bookmarkColor ? { color: bookmarkColor } : undefined}
                          />
                        ) : (
                          <File size={14} className="text-xp-text-secondary mr-2 flex-shrink-0" />
                        )}
                        <span className="flex-1 truncate">{bookmark.name}</span>
                        <button
                          onClick={(e) => handleRemoveBookmark(bookmark.path, e)}
                          className="text-xp-text-muted hover:text-xp-red ml-2 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          title="Remove bookmark"
                          aria-label={`Remove bookmark for ${bookmark.name}`}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            {/* Resize handle */}
            {!sectionCollapsed.favorites && (
              <div
                className="hover:bg-xp-blue/30 group flex h-1 cursor-row-resize items-center justify-center transition-colors"
                onMouseDown={(e) => onResizeStart('favorites', e)}
              >
                <GripHorizontal className="text-xp-text-muted/0 group-hover:text-xp-text-muted/60 h-3 w-4 transition-colors" />
              </div>
            )}
          </div>

          {/* Collections */}
          <div
            className="border-xp-border border-b"
            role="region"
            aria-label="Collections"
            data-sidebar-section="collections"
            style={
              !sectionCollapsed.collections && sectionHeights.collections
                ? { height: sectionHeights.collections, overflow: 'hidden' }
                : undefined
            }
          >
            <div className="flex items-center justify-between">
              <button
                className="text-xp-text-muted hover:bg-xp-surface-light/50 flex flex-1 items-center px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors"
                onClick={() => toggleSection('collections')}
                aria-expanded={!sectionCollapsed.collections}
                aria-label="Toggle collections"
              >
                {sectionCollapsed.collections ? (
                  <ChevronRight className="mr-1 h-3 w-3 flex-shrink-0" />
                ) : (
                  <ChevronDown className="mr-1 h-3 w-3 flex-shrink-0" />
                )}
                {t('sidebar.collections')}
              </button>
              {onCreateCollection && !sectionCollapsed.collections && (
                <button
                  onClick={onCreateCollection}
                  className="text-xp-text-muted hover:text-xp-blue mr-2 transition-colors"
                  title="Create new collection"
                  aria-label="Create new collection"
                  style={{ padding: '2px' }}
                >
                  <Plus size={13} />
                </button>
              )}
            </div>
            {!sectionCollapsed.collections && (
              <div className="space-y-0.5 px-3 pb-2">
                {collections.length === 0 ? (
                  <p className="text-xp-text-secondary py-1 text-xs">
                    {t('sidebar.noCollections')}
                  </p>
                ) : (
                  collections.map((col) => {
                    // Smart folders navigate to collection://; quick filters toggle active filter
                    const smartFolder = isSmartFolder(col);
                    const isActive = smartFolder
                      ? currentPath === `collection://${col.id}`
                      : activeCollectionFilter?.id === col.id;
                    return (
                      <div
                        key={col.id}
                        className={`group flex w-full cursor-pointer items-center rounded px-2 py-1 text-xs transition-colors ${
                          isActive ? 'text-xp-text' : 'hover:bg-xp-surface-light text-xp-text'
                        }`}
                        style={{
                          borderLeft: (() => {
                            if (isActive && !smartFolder) return `3px solid ${col.color}`;
                            if (isActive && smartFolder) return '3px solid var(--xp-blue)';
                            return '3px solid transparent';
                          })(),
                          backgroundColor: (() => {
                            if (!isActive) return undefined;
                            return smartFolder ? 'rgba(122,162,247,0.15)' : `${col.color}15`;
                          })(),
                        }}
                        onClick={() => {
                          if (smartFolder) {
                            navigateToPath(`collection://${col.id}`);
                          } else {
                            onToggleCollectionFilter?.(col);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!col.builtin) {
                            setCollectionContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              collection: col,
                            });
                          }
                        }}
                        title={`${col.name} - ${col.filters.length} filter${col.filters.length !== 1 ? 's' : ''}${smartFolder ? ' (smart folder)' : ' (quick filter)'}`}
                      >
                        <span className="mr-2 flex-shrink-0 text-sm" aria-hidden="true">
                          {renderIcon(col.icon, 14)}
                        </span>
                        <span className="flex-1 truncate">{col.name}</span>
                        {isActive && !smartFolder && (
                          <span
                            className="ml-auto flex-shrink-0"
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: col.color,
                            }}
                          />
                        )}
                        {smartFolder && (
                          <span
                            className="text-xp-text-muted bg-xp-surface ml-auto flex-shrink-0 rounded-full px-1.5 py-0 text-[10px]"
                            style={{ minWidth: '18px', textAlign: 'center' }}
                          >
                            {col.filters.length}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
            {/* Resize handle */}
            {!sectionCollapsed.collections && (
              <div
                className="hover:bg-xp-blue/30 group flex h-1 cursor-row-resize items-center justify-center transition-colors"
                onMouseDown={(e) => onResizeStart('collections', e)}
              >
                <GripHorizontal className="text-xp-text-muted/0 group-hover:text-xp-text-muted/60 h-3 w-4 transition-colors" />
              </div>
            )}
          </div>

          {/* Collection context menu (inline) */}
          {collectionContextMenu && (
            <div
              style={{
                position: 'fixed',
                left: collectionContextMenu.x,
                top: collectionContextMenu.y,
                zIndex: 9999,
                minWidth: '120px',
                borderRadius: '8px',
                backgroundColor: 'var(--xp-surface)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--xp-border)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                padding: '4px',
                animation: 'fadeIn 100ms ease-out',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="text-xp-text hover:bg-xp-surface-light flex w-full items-center rounded px-3 py-1.5 text-xs transition-colors"
                onClick={() => {
                  if (onEditCollection) onEditCollection(collectionContextMenu.collection);
                  setCollectionContextMenu(null);
                }}
              >
                Edit
              </button>
              <button
                className="text-xp-red hover:bg-xp-surface-light flex w-full items-center rounded px-3 py-1.5 text-xs transition-colors"
                onClick={() => {
                  deleteCollection(collectionContextMenu.collection.id);
                  setCollectionContextMenu(null);
                }}
              >
                Delete
              </button>
            </div>
          )}

          {/* Drives / Volumes */}
          <div
            className="border-xp-border border-b"
            role="region"
            aria-label={isWindows ? 'Drives' : 'Volumes'}
            data-sidebar-section="drives"
            style={
              !sectionCollapsed.drives && sectionHeights.drives
                ? { height: sectionHeights.drives, overflow: 'hidden' }
                : undefined
            }
          >
            <button
              className="text-xp-text-muted hover:bg-xp-surface-light/50 flex w-full items-center px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors"
              onClick={() => toggleSection('drives')}
              aria-expanded={!sectionCollapsed.drives}
            >
              {sectionCollapsed.drives ? (
                <ChevronRight className="mr-1 h-3 w-3 flex-shrink-0" />
              ) : (
                <ChevronDown className="mr-1 h-3 w-3 flex-shrink-0" />
              )}
              {t(isWindows ? 'sidebar.drives' : 'sidebar.volumes')}
            </button>
            {!sectionCollapsed.drives && (
              <div className="space-y-1 px-3 pb-2">
                {drives.map((drive) => {
                  const totalGB =
                    drive.total_space > 0
                      ? Math.round(drive.total_space / (1024 * 1024 * 1024))
                      : 0;
                  const freeGB =
                    drive.free_space > 0 ? Math.round(drive.free_space / (1024 * 1024 * 1024)) : 0;
                  const usedPct =
                    drive.total_space > 0
                      ? Math.round(
                          ((drive.total_space - drive.free_space) / drive.total_space) * 100,
                        )
                      : 0;
                  return (
                    <button
                      key={drive.path}
                      onClick={() => navigateToPath(drive.path)}
                      className="hover:bg-xp-surface-light w-full rounded px-2 py-1.5 text-left text-xs transition-colors"
                      aria-label={t('navigation.navigateTo', {
                        name: drive.letter ? `${drive.letter}:` : drive.label,
                      })}
                    >
                      <div className="flex items-center">
                        <HardDrive
                          size={15}
                          className="text-xp-text-muted mr-2.5 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-xp-text flex-1 truncate">
                          {drive.letter ? `${drive.letter}:` : drive.label}
                        </span>
                        {totalGB > 0 && (
                          <span className="text-xp-text-muted ml-2 flex-shrink-0">
                            {freeGB} GB free
                          </span>
                        )}
                      </div>
                      {totalGB > 0 && (
                        <div className="bg-xp-border ml-[25px] mt-1 h-1 overflow-hidden rounded-full">
                          <div
                            className={`h-full rounded-full transition-all ${usedPct > 90 ? 'bg-xp-red' : 'bg-xp-blue'}`}
                            style={{ width: `${usedPct}%` }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
                {!isWindows && userDirectories && (
                  <button
                    onClick={() => navigateToPath(userDirectories.home)}
                    className="hover:bg-xp-surface-light flex w-full items-center rounded px-2 py-1.5 text-xs transition-colors"
                  >
                    <User size={15} className="text-xp-cyan mr-2.5 flex-shrink-0" />{' '}
                    {userDirectories.home.split('/').pop()}
                  </button>
                )}
              </div>
            )}
            {/* Resize handle */}
            {!sectionCollapsed.drives && (
              <div
                className="hover:bg-xp-blue/30 group flex h-1 cursor-row-resize items-center justify-center transition-colors"
                onMouseDown={(e) => onResizeStart('drives', e)}
              >
                <GripHorizontal className="text-xp-text-muted/0 group-hover:text-xp-text-muted/60 h-3 w-4 transition-colors" />
              </div>
            )}
          </div>

          {/* File Tree */}
          <div
            className="flex-1 overflow-y-auto"
            role="region"
            aria-label="File tree"
            tabIndex={0}
            data-sidebar-section="fileTree"
          >
            <button
              className="text-xp-text-muted hover:bg-xp-surface-light/50 bg-xp-surface sticky top-0 z-10 flex w-full items-center px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors"
              onClick={() => toggleSection('fileTree')}
              aria-expanded={!sectionCollapsed.fileTree}
            >
              {sectionCollapsed.fileTree ? (
                <ChevronRight className="mr-1 h-3 w-3 flex-shrink-0" />
              ) : (
                <ChevronDown className="mr-1 h-3 w-3 flex-shrink-0" />
              )}
              <FolderTree size={12} className="mr-1 flex-shrink-0" />
              {t('sidebar.fileTree')}
            </button>
            {!sectionCollapsed.fileTree && (
              <div className="space-y-0 px-3 pb-2" role="tree" aria-label="Directory tree">
                {/* Render current drive tree */}
                {!currentPath.startsWith('xplorer') &&
                  !currentPath.startsWith('collection://') &&
                  sortedRootContents && (
                    <div>
                      <div
                        role="treeitem"
                        aria-selected={currentPath === rootPath}
                        aria-expanded={expandedFolders.has(rootPath)}
                        aria-label={`Root drive ${rootPath}`}
                        className={`hover:bg-xp-surface-light flex cursor-pointer items-center rounded px-1 py-1 text-xs font-medium transition-colors ${currentPath === rootPath ? 'bg-xp-blue text-xp-blue border-xp-blue border-l-2 bg-opacity-25' : 'text-xp-text'} `}
                        onClick={() => navigateToPath(rootPath)}
                      >
                        <button
                          className="hover:bg-xp-surface-light flex h-5 w-5 flex-shrink-0 items-center justify-center rounded p-0.5 transition-colors"
                          onClick={(e) => toggleFolder(rootPath, e)}
                          aria-expanded={expandedFolders.has(rootPath)}
                          aria-label={
                            expandedFolders.has(rootPath)
                              ? `Collapse ${rootPath}`
                              : `Expand ${rootPath}`
                          }
                        >
                          <svg
                            className={`h-3 w-3 transition-transform ${expandedFolders.has(rootPath) ? 'rotate-90' : ''}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                        <HardDrive
                          size={14}
                          className="text-xp-text-secondary mr-1 flex-shrink-0"
                        />
                        <span className="truncate">{rootPath}</span>
                      </div>

                      {expandedFolders.has(rootPath) && (
                        <div role="group" aria-label={`Contents of ${rootPath}`}>
                          {sortedRootContents?.map((file) => renderFileItem(file, 1))}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            )}
          </div>
        </>
      )}
    </nav>
  );
});

export default LeftSidebar;
