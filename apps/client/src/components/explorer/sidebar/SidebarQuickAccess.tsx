import React, { useState, useEffect } from 'react';
import {
  Home,
  FileText,
  Download,
  Monitor,
  Image,
  Cloud,
  ChevronDown,
  ChevronRight,
  GripHorizontal,
} from 'lucide-react';
import { TauriAPI } from '@/lib/tauri-api';
import { PATH_SEPARATOR, isWindows, isMac } from '@/lib/constants';
import { useTranslation } from 'react-i18next';

interface UserDirectories {
  home: string;
  documents: string;
  downloads: string;
  desktop: string;
  pictures: string;
  videos: string;
  music: string;
}

interface SidebarQuickAccessProps {
  currentPath: string;
  navigateToPath: (path: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  sectionHeight: number | undefined;
  onResizeStart: (sectionId: string, e: React.MouseEvent) => void;
}

const SidebarQuickAccess = ({
  currentPath,
  navigateToPath,
  collapsed,
  onToggleCollapsed,
  sectionHeight,
  onResizeStart,
}: SidebarQuickAccessProps) => {
  const { t } = useTranslation();
  const [userDirectories, setUserDirectories] = useState<UserDirectories | null>(null);
  const [iCloudPath, setICloudPath] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const userDirs = await TauriAPI.getUserDirectories();
        setUserDirectories(userDirs);
        if (isMac) {
          const cloudDocsPath = `${userDirs.home}/Library/Mobile Documents/com~apple~CloudDocs`;
          const exists = await TauriAPI.fileExists(cloudDocsPath);
          setICloudPath(exists ? cloudDocsPath : null);
        }
      } catch (error) {
        console.error('Failed to load user directories:', error);
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
    load();
  }, []);

  return (
    <div
      className="border-xp-border border-b"
      role="region"
      aria-label="Quick access"
      data-sidebar-section="quickAccess"
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
        {t('sidebar.quickAccess')}
      </button>
      {!collapsed && (
        <div
          className="space-y-0.5 overflow-y-auto px-3 pb-2"
          style={sectionHeight ? { maxHeight: sectionHeight } : undefined}
        >
          {userDirectories &&
            (
              [
                {
                  path: 'xplorer://home',
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
          {iCloudPath &&
            (() => {
              const isActive = currentPath === iCloudPath;
              const label = t('sidebar.icloudDrive');
              return (
                <button
                  key="icloud"
                  onClick={() => navigateToPath(iCloudPath)}
                  className={`flex w-full items-center rounded px-2 py-1.5 text-xs transition-colors ${
                    isActive
                      ? 'bg-xp-blue/15 text-xp-blue'
                      : 'hover:bg-xp-surface-light text-xp-text'
                  }`}
                  aria-label={t('sidebar.navigateTo', { label })}
                >
                  <Cloud
                    size={15}
                    className={`mr-2.5 flex-shrink-0 ${isActive ? 'text-xp-blue' : 'text-xp-cyan'}`}
                    aria-hidden="true"
                  />
                  {label}
                </button>
              );
            })()}
        </div>
      )}
      {/* Resize handle */}
      <div
        className="hover:bg-xp-blue/30 group flex h-2 cursor-row-resize items-center justify-center transition-colors"
        onMouseDown={(e) => onResizeStart('quickAccess', e)}
      >
        <GripHorizontal className="text-xp-text-muted/20 group-hover:text-xp-text-muted/60 h-3 w-4 transition-colors" />
      </div>
    </div>
  );
};

export default SidebarQuickAccess;
