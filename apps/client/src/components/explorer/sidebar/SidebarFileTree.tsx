import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { HardDrive, FolderTree, ChevronDown, ChevronRight } from 'lucide-react';
import { FileEntry, TauriAPI } from '@/lib/tauri-api';
import { PATH_SEPARATOR, ROOT_PATH } from '@/lib/constants';
import { getFolderColorHex } from '@/lib/folder-colors';
import { useWindowEvent } from '@/hooks/use-window-event';
import { useTranslation } from 'react-i18next';

type SortBy = 'name' | 'dateModified' | 'size' | 'type';
type SortOrder = 'asc' | 'desc';

interface SidebarFileTreeProps {
  currentPath: string;
  navigateToPath: (path: string) => void;
  handleFileClick: (file: FileEntry) => void;
  handleFileRightClick?: (file: FileEntry, event: React.MouseEvent) => void;
  getFileIcon: (file: FileEntry) => React.ReactNode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const SidebarFileTree = ({
  currentPath,
  navigateToPath,
  handleFileClick,
  handleFileRightClick,
  getFileIcon,
  collapsed,
  onToggleCollapsed,
}: SidebarFileTreeProps) => {
  const { t } = useTranslation();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderContents, setFolderContents] = useState<Map<string, FileEntry[]>>(new Map());
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

  // Re-render when folder colors change
  const [_folderColorVersion, setFolderColorVersion] = useState(0);
  useWindowEvent('folder-colors-changed', () => setFolderColorVersion((v) => v + 1));

  // Sort is currently fixed; declared as the union type to keep the switch exhaustive

  const sortBy: SortBy = 'name' as SortBy;

  const sortOrder: SortOrder = 'asc' as SortOrder;

  const sortFiles = useCallback(
    (files: FileEntry[]): FileEntry[] => {
      return [...files].sort((a, b) => {
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
            const aExt = a.name.split('.').pop()?.toLowerCase() ?? '';
            const bExt = b.name.split('.').pop()?.toLowerCase() ?? '';
            comparison = aExt.localeCompare(bExt);
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

  const loadFolderContents = useCallback(
    async (folderPath: string) => {
      setLoadingFolders((prev) => {
        if (prev.has(folderPath)) return prev;
        return new Set(prev).add(folderPath);
      });

      try {
        const contents = await TauriAPI.readDirectory(folderPath);
        const sortedContents = sortFiles(contents);
        setFolderContents((prev) => new Map(prev.set(folderPath, sortedContents)));
      } catch (error) {
        console.error('Failed to load folder contents:', error);
        setFolderContents((prev) => new Map(prev.set(folderPath, [])));
      } finally {
        setLoadingFolders((prev) => {
          const newSet = new Set(prev);
          newSet.delete(folderPath);
          return newSet;
        });
      }
    },
    [sortFiles],
  );

  const getRootPath = useCallback(() => {
    if (currentPath.startsWith('xplorer://')) return ROOT_PATH;
    if (currentPath.startsWith('/')) return '/';
    const pathParts = currentPath.split(/[\\/]/).filter((p) => p);
    return pathParts.length > 0 ? pathParts[0] + PATH_SEPARATOR : ROOT_PATH;
  }, [currentPath]);

  const rootPath = getRootPath();

  useEffect(() => {
    if (!folderContents.has(rootPath)) {
      loadFolderContents(rootPath);
      setExpandedFolders((prev) => new Set(prev).add(rootPath));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath]);

  const sortedRootContents = useMemo(() => {
    const rootContents = folderContents.get(rootPath);
    if (!rootContents) return undefined;
    return sortFiles(rootContents);
  }, [folderContents, rootPath, sortFiles]);

  const toggleFolder = async (folderPath: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
        if (!folderContents.has(folderPath)) {
          loadFolderContents(folderPath);
        }
      }
      return newSet;
    });
  };

  const handleItemClick = (file: FileEntry) => {
    if (file.is_dir) {
      navigateToPath(file.path);
      handleFileClick(file);
    } else {
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
    const children = folderContents.get(file.path) ?? [];

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

        {file.is_dir && isExpanded && hasChildren && (
          <div role="group" aria-label={`Contents of ${file.name}`}>
            {children.map((childFile) => renderFileItem(childFile, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="flex-1 overflow-y-auto"
      role="region"
      aria-label="File tree"
      tabIndex={0}
      data-sidebar-section="fileTree"
    >
      <button
        className="text-xp-text-muted hover:bg-xp-surface-light/50 bg-xp-surface sticky top-0 z-10 flex w-full items-center px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRight className="mr-1 h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronDown className="mr-1 h-3 w-3 flex-shrink-0" />
        )}
        <FolderTree size={12} className="mr-1 flex-shrink-0" />
        {t('sidebar.fileTree')}
      </button>
      {!collapsed && (
        <div className="space-y-0 px-3 pb-2" role="tree" aria-label="Directory tree">
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
                      expandedFolders.has(rootPath) ? `Collapse ${rootPath}` : `Expand ${rootPath}`
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
                  <HardDrive size={14} className="text-xp-text-secondary mr-1 flex-shrink-0" />
                  <span className="truncate">{rootPath}</span>
                </div>

                {expandedFolders.has(rootPath) && (
                  <div role="group" aria-label={`Contents of ${rootPath}`}>
                    {sortedRootContents.map((file) => renderFileItem(file, 1))}
                  </div>
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default SidebarFileTree;
