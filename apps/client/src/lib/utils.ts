import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FileEntry, FolderSizeInfo } from '@/lib/tauri-api';
import React from 'react';
import {
  FolderClosed,
  FolderOpen,
  FileText,
  FileCode,
  Globe,
  FileJson,
  Image as ImageIcon,
  Film,
  Music,
  BookOpen,
  Package,
  Settings,
  File as FileIcon,
  Zap,
  FileSpreadsheet,
  Presentation,
  ArrowDownAZ,
  Calendar,
  HardDrive,
  Tag,
  LayoutGrid,
  Grid3X3,
  Grid2X2,
  LayoutPanelTop,
  List,
  Table,
  FolderTree,
  GalleryHorizontal,
  Columns,
  MessageSquare,
  Star,
  Wrench,
  Clapperboard,
  BarChart3,
  PenLine,
  Laptop,
  Clock,
  Disc,
  SlidersHorizontal,
  Headphones,
  Volume2,
  Mic,
  MusicIcon,
  BookOpenText,
  Search,
  SearchCheck,
  Monitor,
  Pencil,
  Trash2,
  ArrowRight,
  ClipboardList,
  Play,
  Save,
  MessageCircle,
  Link,
  Lock,
  MailOpen,
  ArchiveX,
  CalendarDays,
  Tags,
  ClipboardCopy,
  // Additional icons for extension marketplace
  AlertTriangle,
  Archive,
  Box,
  Braces,
  Cloud,
  Code,
  Database,
  Fingerprint,
  GitBranch,
  Hash,
  Layout,
  Palette,
  Target,
  Terminal,
  Shield,
  Eye,
  Cpu,
  Plug,
  type LucideIcon,
} from 'lucide-react';

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

// Helper to create a file icon element
const icon = (Icon: LucideIcon, color: string): React.ReactNode =>
  React.createElement(Icon, { size: '1em', className: `inline-block ${color}` });

// File icon mapping utility
export const getFileIcon = (fileEntry: FileEntry): React.ReactNode => {
  if (fileEntry.is_dir) return icon(FolderClosed, 'text-xp-blue');

  const ext = fileEntry.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'txt':
    case 'md':
    case 'log':
      return icon(FileText, 'text-xp-text-muted');
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return icon(FileCode, 'text-xp-yellow');
    case 'py':
    case 'rb':
    case 'go':
    case 'rs':
    case 'java':
    case 'c':
    case 'cpp':
    case 'cs':
      return icon(FileCode, 'text-xp-green');
    case 'html':
    case 'css':
    case 'scss':
    case 'sass':
      return icon(Globe, 'text-xp-orange');
    case 'json':
    case 'xml':
    case 'yaml':
    case 'yml':
    case 'toml':
      return icon(FileJson, 'text-xp-green');
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'ico':
      return icon(ImageIcon, 'text-xp-purple');
    case 'mp4':
    case 'avi':
    case 'mkv':
    case 'mov':
    case 'webm':
      return icon(Film, 'text-xp-red');
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'ogg':
    case 'aac':
      return icon(Music, 'text-xp-cyan');
    case 'pdf':
      return icon(BookOpen, 'text-xp-red');
    case 'doc':
    case 'docx':
      return icon(FileText, 'text-xp-blue');
    case 'xls':
    case 'xlsx':
    case 'csv':
      return icon(FileSpreadsheet, 'text-xp-green');
    case 'ppt':
    case 'pptx':
      return icon(Presentation, 'text-xp-orange');
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
    case 'bz2':
      return icon(Package, 'text-xp-orange');
    case 'exe':
    case 'msi':
    case 'dmg':
    case 'app':
      return icon(Settings, 'text-xp-text-muted');
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'bat':
    case 'cmd':
      return icon(Zap, 'text-xp-yellow');
    case 'chat':
      return icon(MessageSquare, 'text-xp-purple');
    default:
      return icon(FileIcon, 'text-xp-text-muted');
  }
};

// ── Icon Name Registry ────────────────────────────────────────────────────────
// Maps string icon names to lucide-react components. Used by collections,
// filter presets, tool call icons, and anywhere an icon is stored as a string.

const ICON_REGISTRY: Record<string, LucideIcon> = {
  // File types
  Folder: FolderClosed,
  FolderOpen: FolderOpen,
  File: FileIcon,
  FileText: FileText,
  FileCode: FileCode,
  FileJson: FileJson,
  FileSpreadsheet: FileSpreadsheet,
  Image: ImageIcon,
  Film: Film,
  Music: Music,
  Headphones: Headphones,
  Volume2: Volume2,
  Mic: Mic,
  BookOpen: BookOpen,
  Presentation: Presentation,
  Package: Package,
  Disc: Disc,
  Globe: Globe,
  Archive: Archive,
  Code: Code,

  // Actions / tools
  Search: Search,
  SearchCheck: SearchCheck,
  Pencil: Pencil,
  PenLine: PenLine,
  Trash2: Trash2,
  ArrowRight: ArrowRight,
  ClipboardList: ClipboardList,
  ClipboardCopy: ClipboardCopy,
  Play: Play,
  Save: Save,
  MessageCircle: MessageCircle,
  MessageSquare: MessageSquare,
  Monitor: Monitor,
  Laptop: Laptop,
  Zap: Zap,
  Settings: Settings,
  Terminal: Terminal,
  Eye: Eye,
  Cpu: Cpu,
  Plug: Plug,

  // Categories / metadata
  Star: Star,
  Tag: Tag,
  Tags: Tags,
  Lock: Lock,
  Link: Link,
  Calendar: Calendar,
  CalendarDays: CalendarDays,
  Clock: Clock,
  BarChart3: BarChart3,
  Clapperboard: Clapperboard,
  Wrench: Wrench,
  SlidersHorizontal: SlidersHorizontal,
  MailOpen: MailOpen,
  ArchiveX: ArchiveX,
  AlertTriangle: AlertTriangle,
  Shield: Shield,
  Fingerprint: Fingerprint,
  Hash: Hash,
  Target: Target,
  Database: Database,
  Box: Box,
  Braces: Braces,
  Cloud: Cloud,
  Palette: Palette,
  GitBranch: GitBranch,

  // Layout
  LayoutGrid: LayoutGrid,
  Layout: Layout,
  Grid3X3: Grid3X3,
  Grid2X2: Grid2X2,
  LayoutPanelTop: LayoutPanelTop,
  List: List,
  Table: Table,
  FolderTree: FolderTree,
  GalleryHorizontal: GalleryHorizontal,
  Columns: Columns,
  HardDrive: HardDrive,
  ArrowDownAZ: ArrowDownAZ,
  BookOpenText: BookOpenText,
};

/**
 * Render a lucide-react icon by its string name.
 * Falls back to FileIcon when the name is not found in the registry.
 *
 * @param name  The icon name string (e.g. "Folder", "Music", "Star")
 * @param size  Icon size in pixels or CSS units (default: "1em")
 * @param className  Additional CSS classes
 */
/**
 * Convert a kebab-case icon name to PascalCase for registry lookup.
 * e.g. "file-text" → "FileText", "git-branch" → "GitBranch", "alert-triangle" → "AlertTriangle"
 */
const normalizeIconName = (name: string): string => {
  if (name.includes('-')) {
    return name.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  }
  return name;
};

export const renderIcon = (
  name: string,
  size: number | string = '1em',
  className?: string,
): React.ReactNode => {
  // Try exact match first, then kebab-case → PascalCase conversion
  const Icon = ICON_REGISTRY[name] ?? ICON_REGISTRY[normalizeIconName(name)] ?? FileIcon;
  return React.createElement(Icon, { size, className: className ?? 'inline-block' });
};

/**
 * Check whether a string is a valid icon name in the registry.
 */
export const isValidIconName = (name: string): boolean => {
  return name in ICON_REGISTRY || normalizeIconName(name) in ICON_REGISTRY;
};

/**
 * All available icon names for use in icon-picker UIs.
 */
export const ICON_NAMES = Object.keys(ICON_REGISTRY);

// Video file extension check
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'm4v', 'ogv'];
export const isVideoFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return VIDEO_EXTENSIONS.includes(ext);
};

// Audio file extension check
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus', 'aiff'];
export const isAudioFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return AUDIO_EXTENSIONS.includes(ext);
};

// File size formatting utility
export const formatFileSize = (bytes: number, isCalculating?: boolean): string => {
  if (isCalculating) return 'Calculating...';
  if (!bytes || bytes <= 0 || !isFinite(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Format folder size with additional info
export const formatFolderSize = (
  folderSizeInfo: FolderSizeInfo | null,
  isCalculating?: boolean,
): string => {
  if (isCalculating) return 'Calculating...';
  if (!folderSizeInfo) return '—';

  const sizeStr = formatFileSize(folderSizeInfo.total_size);
  const itemCount = folderSizeInfo.file_count + folderSizeInfo.dir_count;

  if (itemCount === 0) return 'Empty';
  return `${sizeStr} (${itemCount} items)`;
};

// Date formatting utility
export const formatDate = (timestamp: number): string => {
  if (!timestamp || !isFinite(timestamp)) return '—';
  const date = new Date(timestamp * 1000);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

// Natural-sort collator: "file2" before "file10", case-insensitive
const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// File sorting utility
export const sortFiles = (
  files: FileEntry[],
  sortBy: string,
  sortOrder: 'asc' | 'desc',
): FileEntry[] => {
  return [...files].sort((a, b) => {
    // Always put directories first regardless of sort criteria
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;

    let comparison: number;

    switch (sortBy) {
      case 'name':
        comparison = naturalCollator.compare(a.name, b.name);
        break;

      case 'dateModified':
        comparison = a.modified - b.modified;
        break;

      case 'size': {
        const aExt = a as FileEntry & { folder_size?: { total_size: number } };
        const bExt = b as FileEntry & { folder_size?: { total_size: number } };
        const aSize =
          a.is_dir && aExt.folder_size ? aExt.folder_size.total_size : a.size;
        const bSize =
          b.is_dir && bExt.folder_size ? bExt.folder_size.total_size : b.size;
        comparison = aSize - bSize;
        break;
      }

      case 'dateCreated': {
        const aCreated = (a as FileEntry & { created?: number }).created ?? a.modified;
        const bCreated = (b as FileEntry & { created?: number }).created ?? b.modified;
        comparison = aCreated - bCreated || a.modified - b.modified;
        break;
      }

      case 'type': {
        const aType = a.file_type || '';
        const bType = b.file_type || '';
        comparison = naturalCollator.compare(aType, bType);
        if (comparison === 0) {
          comparison = naturalCollator.compare(a.name, b.name);
        }
        break;
      }

      case 'extension': {
        const aExt = a.name.includes('.') ? a.name.split('.').pop()?.toLowerCase() || '' : '';
        const bExt = b.name.includes('.') ? b.name.split('.').pop()?.toLowerCase() || '' : '';
        comparison = naturalCollator.compare(aExt, bExt);
        if (comparison === 0) {
          comparison = naturalCollator.compare(a.name, b.name);
        }
        break;
      }

      default:
        comparison = naturalCollator.compare(a.name, b.name);
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });
};

// ── Date-based file grouping (Windows Explorer–style) ───────────────────────

export type DateGroup =
  | 'Today'
  | 'Yesterday'
  | 'Earlier This Week'
  | 'Last Week'
  | 'Earlier This Month'
  | 'Last Month'
  | 'Older';

const DATE_GROUP_ORDER: DateGroup[] = [
  'Today',
  'Yesterday',
  'Earlier This Week',
  'Last Week',
  'Earlier This Month',
  'Last Month',
  'Older',
];

export const getDateGroup = (modifiedTimestamp: number): DateGroup => {
  const now = new Date();
  const modified = new Date(modifiedTimestamp * 1000);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;

  const modifiedMs = modified.getTime();

  if (modifiedMs >= todayStart) return 'Today';
  if (modifiedMs >= yesterdayStart) return 'Yesterday';

  // Start of the week (Monday-based for consistency)
  const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const weekStart = todayStart - dayOfWeek * 86_400_000;
  if (modifiedMs >= weekStart) return 'Earlier This Week';

  const lastWeekStart = weekStart - 7 * 86_400_000;
  if (modifiedMs >= lastWeekStart) return 'Last Week';

  // Same month but before last week
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (modifiedMs >= monthStart) return 'Earlier This Month';

  // Previous month
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  if (modifiedMs >= lastMonthStart) return 'Last Month';

  return 'Older';
};

export interface FileGroup {
  group: DateGroup;
  files: FileEntry[];
}

export const groupFilesByDate = (files: FileEntry[]): FileGroup[] => {
  const groups: Record<DateGroup, FileEntry[]> = {
    Today: [],
    Yesterday: [],
    'Earlier This Week': [],
    'Last Week': [],
    'Earlier This Month': [],
    'Last Month': [],
    Older: [],
  };

  for (const file of files) {
    const group = getDateGroup(file.modified);
    groups[group].push(file);
  }

  return DATE_GROUP_ORDER.filter((g) => groups[g].length > 0).map((g) => ({
    group: g,
    files: groups[g],
  }));
};

// Built-in theme configurations (glass + light only, others via extensions)
export interface ThemeDef {
  name: string;
  primary: string;
  bg: string;
  surface: string;
  text: string;
}

export const themes: Record<string, ThemeDef> = {
  glass: {
    name: 'Xplorer Glass',
    primary: '#6366f1',
    bg: 'transparent',
    surface: 'rgba(255,255,255,0.06)',
    text: 'rgba(255,255,255,0.92)',
  },
  light: {
    name: 'Light',
    primary: '#3b82f6',
    bg: '#ffffff',
    surface: '#f8fafc',
    text: '#1e293b',
  },
};

// Helper to create a config icon
const cfgIcon = (Icon: LucideIcon): React.ReactNode =>
  React.createElement(Icon, { size: '1em', className: 'inline-block' });

// Sort options configuration
export const sortOptions = {
  name: { id: 'name', name: 'Name', icon: cfgIcon(ArrowDownAZ) },
  dateModified: { id: 'dateModified', name: 'Date Modified', icon: cfgIcon(Calendar) },
  dateCreated: { id: 'dateCreated', name: 'Date Created', icon: cfgIcon(Calendar) },
  size: { id: 'size', name: 'Size', icon: cfgIcon(HardDrive) },
  type: { id: 'type', name: 'Type', icon: cfgIcon(Tag) },
  extension: { id: 'extension', name: 'Extension', icon: cfgIcon(FileText) },
};

// View modes configuration
export const viewModes = {
  large: { id: 'large', name: 'Large Icons', icon: cfgIcon(LayoutGrid) },
  medium: { id: 'medium', name: 'Medium Icons', icon: cfgIcon(Grid3X3) },
  small: { id: 'small', name: 'Small Icons', icon: cfgIcon(Grid2X2) },
  tiles: { id: 'tiles', name: 'Tiles', icon: cfgIcon(LayoutPanelTop) },
  content: { id: 'content', name: 'Content View', icon: cfgIcon(FileText) },
  list: { id: 'list', name: 'List View', icon: cfgIcon(List) },
  details: { id: 'details', name: 'Details View', icon: cfgIcon(Table) },
  tree: { id: 'tree', name: 'Tree View', icon: cfgIcon(FolderTree) },
  gallery: { id: 'gallery', name: 'Gallery', icon: cfgIcon(GalleryHorizontal) },
  column: { id: 'column', name: 'Column View', icon: cfgIcon(Columns) },
};

// Font size utility functions
export const applyFontSize = (size: 'small' | 'medium' | 'large' | 'xl') => {
  const root = document.documentElement;
  root.classList.remove('font-small', 'font-medium', 'font-large', 'font-xl');
  root.classList.add(`font-${size}`);
  localStorage.setItem('xplorer:font-size', size);
};

export const loadFontSize = () => {
  const saved = localStorage.getItem('xplorer:font-size') as
    | 'small'
    | 'medium'
    | 'large'
    | 'xl'
    | null;
  applyFontSize(saved || 'medium');
};

// ── Custom Theme support ─────────────────────────────────────────────────────

export interface CustomThemeColors {
  name: string;
  background: string;
  backgroundSecondary: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentHover: string;
  border: string;
  surface: string;
  surfaceHover: string;
  sidebarBg: string;
  success: string;
  warning: string;
  error: string;
}

const CUSTOM_THEMES_KEY = 'xplorer:custom-themes';

export const loadCustomThemes = (): Record<string, CustomThemeColors> => {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CustomThemeColors>;
  } catch {
    return {};
  }
};

export const saveCustomThemes = (themes: Record<string, CustomThemeColors>): void => {
  try {
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
  } catch {
    // storage full or unavailable
  }
};

export const slugifyThemeName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

export const applyCustomThemeVars = (theme: CustomThemeColors): void => {
  const root = document.documentElement;
  root.style.setProperty('--xp-bg', theme.background);
  root.style.setProperty('--xp-bg-secondary', theme.backgroundSecondary);
  root.style.setProperty('--xp-text', theme.text);
  root.style.setProperty('--xp-text-secondary', theme.textSecondary);
  root.style.setProperty('--xp-blue', theme.accent);
  root.style.setProperty('--xp-accent', theme.accent);
  root.style.setProperty('--xp-accent-hover', theme.accentHover);
  root.style.setProperty('--xp-border', theme.border);
  root.style.setProperty('--xp-surface', theme.surface);
  root.style.setProperty('--xp-surface-light', theme.surfaceHover);
  root.style.setProperty('--xp-sidebar-bg', theme.sidebarBg);
  root.style.setProperty('--xp-green', theme.success);
  root.style.setProperty('--xp-yellow', theme.warning);
  root.style.setProperty('--xp-red', theme.error);
};

// Theme utility function — works for both built-in and extension-provided themes
export const applyTheme = (themeKey: string) => {
  // Remove all theme-* classes from root element
  const root = document.documentElement;
  root.classList.forEach((cls) => {
    if (cls.startsWith('theme-')) root.classList.remove(cls);
  });
  // Add the active theme class (extension themes inject their own .theme-{id} CSS)
  root.classList.add(`theme-${themeKey}`);

  // Set inline style properties for built-in themes (backward compat)
  const themeData = themes[themeKey];
  if (themeData) {
    root.style.setProperty('--xp-bg', themeData.bg);
    root.style.setProperty('--xp-surface', themeData.surface);
    root.style.setProperty('--xp-text', themeData.text);
    root.style.setProperty('--xp-blue', themeData.primary);
  }
};
