import React, { useState, useEffect } from 'react';
import { FolderClosed, File, ChevronDown, ChevronRight, GripHorizontal } from 'lucide-react';
import { TauriAPI, BookmarkEntry, FileEntry } from '@/lib/tauri-api';
import { getFolderColorHex } from '@/lib/folder-colors';
import { useWindowEvent } from '@/hooks/use-window-event';
import { useTranslation } from 'react-i18next';

interface SidebarBookmarksProps {
  currentPath: string;
  navigateToPath: (path: string) => void;
  handleFileRightClick?: (file: FileEntry, event: React.MouseEvent) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  sectionHeight: number | undefined;
  onResizeStart: (sectionId: string, e: React.MouseEvent) => void;
}

const SidebarBookmarks = ({
  navigateToPath,
  handleFileRightClick,
  collapsed,
  onToggleCollapsed,
  sectionHeight,
  onResizeStart,
}: SidebarBookmarksProps) => {
  const { t } = useTranslation();
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);

  const loadBookmarks = () => {
    TauriAPI.getBookmarks()
      .then((items) => setBookmarks(items))
      .catch((error) => console.error('Failed to load bookmarks:', error));
  };

  useEffect(() => {
    loadBookmarks();
  }, []);

  useWindowEvent('bookmarks-changed', loadBookmarks);

  // Re-render when folder colors change
  const [_folderColorVersion, setFolderColorVersion] = useState(0);
  useWindowEvent('folder-colors-changed', () => setFolderColorVersion((v) => v + 1));

  const handleRemoveBookmark = async (path: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await TauriAPI.removeBookmark(path);
      setBookmarks((prev) => prev.filter((b) => b.path !== path));
    } catch (error) {
      console.error('Failed to remove bookmark:', error);
    }
  };

  return (
    <div
      className="border-xp-border border-b"
      role="region"
      aria-label="Favorites"
      data-sidebar-section="favorites"
      style={
        !collapsed && sectionHeight ? { height: sectionHeight, overflow: 'hidden' } : undefined
      }
    >
      <button
        className="text-xp-text-muted hover:bg-xp-surface-light/50 flex w-full items-center px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRight className="mr-1 h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronDown className="mr-1 h-3 w-3 flex-shrink-0" />
        )}
        {t('sidebar.favorites')}
      </button>
      {!collapsed && (
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
                      const syntheticFile: FileEntry = {
                        name: bookmark.name,
                        path: bookmark.path,
                        size: 0,
                        modified: 0,
                        is_dir: bookmark.is_dir,
                        file_type: bookmark.is_dir
                          ? 'folder'
                          : bookmark.name.split('.').pop() || '',
                        is_readonly: false,
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
      {!collapsed && (
        <div
          className="hover:bg-xp-blue/30 group flex h-1 cursor-row-resize items-center justify-center transition-colors"
          onMouseDown={(e) => onResizeStart('favorites', e)}
        >
          <GripHorizontal className="text-xp-text-muted/0 group-hover:text-xp-text-muted/60 h-3 w-4 transition-colors" />
        </div>
      )}
    </div>
  );
};

export default SidebarBookmarks;
