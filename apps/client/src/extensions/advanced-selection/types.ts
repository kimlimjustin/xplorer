import { FileEntry } from '@/lib/tauri-api';

export interface SelectionCriteria {
  type: 'extension' | 'dateRange' | 'sizeRange' | 'similar' | 'invert' | 'pattern';
  extensions?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  minSize?: number;
  maxSize?: number;
  similarTo?: FileEntry;
  pattern?: string;
}

export interface SelectionResult {
  matched: string[];
  total: number;
}

export interface DateRangePreset {
  label: string;
  getRange: () => { from: Date; to: Date };
}

export interface SizeRangePreset {
  label: string;
  min: number;
  max: number;
}

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  {
    label: 'Today',
    getRange: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return { from: today, to: tomorrow };
    },
  },
  {
    label: 'Yesterday',
    getRange: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { from: yesterday, to: today };
    },
  },
  {
    label: 'Last 7 days',
    getRange: () => {
      const now = new Date();
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { from: weekAgo, to: now };
    },
  },
  {
    label: 'Last 30 days',
    getRange: () => {
      const now = new Date();
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      return { from: monthAgo, to: now };
    },
  },
  {
    label: 'This month',
    getRange: () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfMonth, to: now };
    },
  },
  {
    label: 'Last month',
    getRange: () => {
      const now = new Date();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfLastMonth, to: endOfLastMonth };
    },
  },
  {
    label: 'This year',
    getRange: () => {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return { from: startOfYear, to: now };
    },
  },
];

export const SIZE_RANGE_PRESETS: SizeRangePreset[] = [
  { label: 'Tiny (< 10 KB)', min: 0, max: 10 * 1024 },
  { label: 'Small (10 KB - 100 KB)', min: 10 * 1024, max: 100 * 1024 },
  { label: 'Medium (100 KB - 1 MB)', min: 100 * 1024, max: 1024 * 1024 },
  { label: 'Large (1 MB - 10 MB)', min: 1024 * 1024, max: 10 * 1024 * 1024 },
  { label: 'Very Large (10 MB - 100 MB)', min: 10 * 1024 * 1024, max: 100 * 1024 * 1024 },
  { label: 'Huge (> 100 MB)', min: 100 * 1024 * 1024, max: Infinity },
];

export const COMMON_FILE_TYPES: { label: string; extensions: string[] }[] = [
  { label: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'] },
  {
    label: 'Documents',
    extensions: ['doc', 'docx', 'pdf', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'],
  },
  { label: 'Videos', extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'] },
  { label: 'Audio', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'] },
  { label: 'Archives', extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'] },
  {
    label: 'Code',
    extensions: [
      'js',
      'ts',
      'jsx',
      'tsx',
      'py',
      'java',
      'c',
      'cpp',
      'h',
      'cs',
      'go',
      'rs',
      'rb',
      'php',
    ],
  },
  {
    label: 'Web',
    extensions: ['html', 'css', 'scss', 'sass', 'less', 'json', 'xml', 'yaml', 'yml'],
  },
  { label: 'Executables', extensions: ['exe', 'msi', 'bat', 'cmd', 'sh', 'app', 'dmg'] },
];
