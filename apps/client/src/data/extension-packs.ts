/**
 * Extension Packs — curated groups of extensions for one-click install.
 * Shown in the Marketplace and during the onboarding tour.
 */

export interface ExtensionPack {
  id: string;
  name: string;
  description: string;
  /** Inline SVG path data for the pack icon (rendered inside a 20x20 viewBox) */
  iconPath: string;
  /** Extension IDs included in this pack (must match xplorer.id in each extension's package.json) */
  extensions: string[];
  /** Recommended packs are highlighted during onboarding */
  recommended?: boolean;
}

export const EXTENSION_PACKS: ExtensionPack[] = [
  {
    id: 'essentials',
    name: 'Essentials',
    description: 'Themes, code editor, file properties, and tags',
    iconPath:
      'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    extensions: [
      'xplorer-dracula-theme',
      'xplorer-tokyo-night-theme',
      'xplorer-nord-theme',
      'xplorer-cyberpunk-theme',
      'xplorer-ocean-deep-theme',
      'code-editor',
      'file-properties-dialog',
      'file-tags-dialog',
      'open-with-dialog',
      'notes',
    ],
    recommended: true,
  },
  {
    id: 'developer',
    name: 'Developer Tools',
    description: 'Git, code editor, and problems panel',
    iconPath: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
    extensions: ['git', 'code-editor', 'xplorer-problems-panel'],
  },
  {
    id: 'productivity',
    name: 'Productivity',
    description: 'Duplicate finder, storage analytics, organizer, and bulk rename',
    iconPath: 'M13 10V3L4 14h7v7l9-11h-7z',
    extensions: [
      'duplicate-finder',
      'storage-analytics',
      'file-organizer',
      'bulk-rename-dialog',
      'recommendations',
    ],
  },
  {
    id: 'media',
    name: 'Media & Creative',
    description: 'Gallery and audio waveform',
    iconPath:
      'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
    extensions: ['xplorer-image-gallery', 'audio-waveform'],
  },
  {
    id: 'data-tools',
    name: 'Data & Files',
    description: 'JSON formatter, file comparison, hasher, compress, and extract',
    iconPath:
      'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
    extensions: [
      'xplorer-json-formatter',
      'compare-files-dialog',
      'xplorer-file-hasher',
      'compress-dialog',
      'extract-dialog',
    ],
  },
];
