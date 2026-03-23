import React, { useState, useEffect } from 'react';
import { FolderClosed, File, Clock, ChevronDown, ChevronRight, GripHorizontal } from 'lucide-react';
import { TauriAPI, RecentFile } from '@/lib/tauri-api';
import { useWindowEvent } from '@/hooks/use-window-event';

interface SidebarRecentProps {
  navigateToPath: (path: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  sectionHeight: number | undefined;
  onResizeStart: (sectionId: string, e: React.MouseEvent) => void;
}

const SidebarRecent = ({
  navigateToPath,
  collapsed,
  onToggleCollapsed,
  sectionHeight,
  onResizeStart,
}: SidebarRecentProps) => {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  const loadRecent = () => {
    TauriAPI.getRecentFiles(10)
      .then((files) => setRecentFiles(files))
      .catch((error) => console.error('Failed to load recent files:', error));
  };

  useEffect(() => {
    loadRecent();
  }, []);

  useWindowEvent('recent-files-changed', loadRecent);

  return (
    <div
      className="border-xp-border border-b"
      role="region"
      aria-label="Recent files"
      data-sidebar-section="recent"
      style={
        !collapsed && sectionHeight ? { height: sectionHeight, overflow: 'hidden' } : undefined
      }
    >
      <button
        className="text-xp-text-muted hover:bg-xp-surface-light/50 flex w-full items-center px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-label="Toggle recent files"
      >
        {collapsed ? (
          <ChevronRight className="mr-1 h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronDown className="mr-1 h-3 w-3 flex-shrink-0" />
        )}
        <Clock size={12} className="mr-1 flex-shrink-0" />
        RECENT
      </button>
      {!collapsed && (
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
      {!collapsed && (
        <div
          className="hover:bg-xp-blue/30 group flex h-1 cursor-row-resize items-center justify-center transition-colors"
          onMouseDown={(e) => onResizeStart('recent', e)}
        >
          <GripHorizontal className="text-xp-text-muted/0 group-hover:text-xp-text-muted/60 h-3 w-4 transition-colors" />
        </div>
      )}
    </div>
  );
};

export default SidebarRecent;
