import { Home, FileText, Download, Monitor, Image } from 'lucide-react';
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

interface PlacesSectionProps {
  userDirectories: UserDirectories | null;
  currentPath: string;
  navigateToPath: (path: string) => void;
}

const PlacesSection = ({
  userDirectories,
  currentPath,
  navigateToPath,
}: PlacesSectionProps) => {
  const { t } = useTranslation();
  return (
    <div className="px-3 py-2 border-b border-xp-border" role="region" aria-label={t('sidebar.quickAccess')}>
      <h4 className="text-[10px] font-semibold text-xp-text-muted uppercase tracking-widest mb-1.5">
        {t('sidebar.quickAccess')}
      </h4>
      <div className="space-y-0.5">
        {userDirectories &&
          (
            [
              { path: userDirectories.home, Icon: Home, color: 'text-xp-blue', labelKey: 'sidebar.home' },
              {
                path: userDirectories.documents,
                Icon: FileText,
                color: 'text-xp-orange',
                labelKey: 'sidebar.documents',
              },
              {
                path: userDirectories.downloads,
                Icon: Download,
                color: 'text-xp-green',
                labelKey: 'sidebar.downloads',
              },
              {
                path: userDirectories.desktop,
                Icon: Monitor,
                color: 'text-xp-purple',
                labelKey: 'sidebar.desktop',
              },
              {
                path: userDirectories.pictures,
                Icon: Image,
                color: 'text-xp-pink',
                labelKey: 'sidebar.pictures',
              },
            ] as const
          ).map(({ path, Icon, color, labelKey }) => {
            const label = t(labelKey);
            const isActive = currentPath === path;
            return (
              <button
                key={labelKey}
                onClick={() => navigateToPath(path)}
                className={`flex items-center w-full px-2 py-1.5 text-xs rounded transition-colors ${
                  isActive ? 'bg-xp-blue/15 text-xp-blue' : 'hover:bg-xp-surface-light text-xp-text'
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
    </div>
  );
}

export type { UserDirectories };

export default PlacesSection;
