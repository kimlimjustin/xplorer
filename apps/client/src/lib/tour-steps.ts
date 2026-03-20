import i18n from '@/i18n';

export interface TourStep {
  /** data-tour attribute value of the target element, or null for a centered step */
  target: string | null;
  title: string;
  description: string;
  /** Preferred tooltip placement; auto-flips if not enough space */
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Lucide icon name */
  icon: string;
}

export const getTourSteps = (): TourStep[] => {
  return [
    {
      target: null,
      title: i18n.t('tour.welcome.title'),
      description: i18n.t('tour.welcome.description'),
      placement: 'center',
      icon: 'Sparkles',
    },
    {
      target: 'sidebar',
      title: i18n.t('tour.sidebar.title'),
      description: i18n.t('tour.sidebar.description'),
      placement: 'right',
      icon: 'PanelLeft',
    },
    {
      target: 'file-grid',
      title: i18n.t('tour.fileBrowser.title'),
      description: i18n.t('tour.fileBrowser.description'),
      placement: 'bottom',
      icon: 'FolderOpen',
    },
    {
      target: 'top-bar',
      title: i18n.t('tour.topBar.title'),
      description: i18n.t('tour.topBar.description'),
      placement: 'bottom',
      icon: 'Search',
    },
    {
      target: 'extensions-bar',
      title: i18n.t('tour.extensions.title'),
      description: i18n.t('tour.extensions.description'),
      placement: 'left',
      icon: 'Puzzle',
    },
    {
      target: 'bottom-panel-toggle',
      title: i18n.t('tour.terminal.title'),
      description: i18n.t('tour.terminal.description'),
      placement: 'top',
      icon: 'Terminal',
    },
    {
      target: null,
      title: i18n.t('tour.shortcuts.title'),
      description: i18n.t('tour.shortcuts.description'),
      placement: 'center',
      icon: 'Keyboard',
    },
    {
      target: 'extensions-bar',
      title: i18n.t('tour.extensionPacks.title'),
      description: i18n.t('tour.extensionPacks.description'),
      placement: 'left',
      icon: 'Package',
    },
    {
      target: null,
      title: i18n.t('tour.allSet.title'),
      description: i18n.t('tour.allSet.description'),
      placement: 'center',
      icon: 'CheckCircle',
    },
  ];
};
