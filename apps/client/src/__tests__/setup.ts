import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Mock react-i18next so components using useTranslation() work in tests
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      // Return last segment of key with interpolation applied
      const base = key.includes('.') ? key.split('.').pop()! : key;
      if (!opts) return base;
      return Object.entries(opts).reduce(
        (str, [k, v]) => str.replace(`{{${k}}}`, String(v)),
        base,
      );
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Mock lucide-react - every icon imported anywhere in client/src/
const mockIcon = (name: string) =>
  React.forwardRef((props: Record<string, unknown>, ref: React.Ref<HTMLElement>) =>
    React.createElement('svg', { ...props, ref, 'data-testid': name })
  );

vi.mock('lucide-react', () => ({
  Accessibility: mockIcon('Accessibility'),
  AlertCircle: mockIcon('AlertCircle'),
  AlertTriangle: mockIcon('AlertTriangle'),
  AppWindow: mockIcon('AppWindow'),
  Archive: mockIcon('Archive'),
  ArrowDown: mockIcon('ArrowDown'),
  ArrowDownAZ: mockIcon('ArrowDownAZ'),
  ArrowLeft: mockIcon('ArrowLeft'),
  ArrowUp: mockIcon('ArrowUp'),
  ArrowUpDown: mockIcon('ArrowUpDown'),
  BarChart3: mockIcon('BarChart3'),
  Bell: mockIcon('Bell'),
  Box: mockIcon('Box'),
  Braces: mockIcon('Braces'),
  Bookmark: mockIcon('Bookmark'),
  BookMarked: mockIcon('BookMarked'),
  BookOpen: mockIcon('BookOpen'),
  Bot: mockIcon('Bot'),
  Calendar: mockIcon('Calendar'),
  Check: mockIcon('Check'),
  CheckCircle: mockIcon('CheckCircle'),
  CheckSquare: mockIcon('CheckSquare'),
  ChevronDown: mockIcon('ChevronDown'),
  ChevronLeft: mockIcon('ChevronLeft'),
  ChevronRight: mockIcon('ChevronRight'),
  ChevronUp: mockIcon('ChevronUp'),
  Circle: mockIcon('Circle'),
  CircleDot: mockIcon('CircleDot'),
  Clipboard: mockIcon('Clipboard'),
  ClipboardCopy: mockIcon('ClipboardCopy'),
  Clock: mockIcon('Clock'),
  Cloud: mockIcon('Cloud'),
  Code: mockIcon('Code'),
  Columns: mockIcon('Columns'),
  Copy: mockIcon('Copy'),
  Cpu: mockIcon('Cpu'),
  Database: mockIcon('Database'),
  Download: mockIcon('Download'),
  ExternalLink: mockIcon('ExternalLink'),
  Eye: mockIcon('Eye'),
  EyeOff: mockIcon('EyeOff'),
  File: mockIcon('File'),
  FileCode: mockIcon('FileCode'),
  FileIcon: mockIcon('FileIcon'),
  FileJson: mockIcon('FileJson'),
  FileSpreadsheet: mockIcon('FileSpreadsheet'),
  FileText: mockIcon('FileText'),
  Film: mockIcon('Film'),
  Fingerprint: mockIcon('Fingerprint'),
  Folder: mockIcon('Folder'),
  FolderClosed: mockIcon('FolderClosed'),
  FolderIcon: mockIcon('FolderIcon'),
  FolderOpen: mockIcon('FolderOpen'),
  FolderPlus: mockIcon('FolderPlus'),
  FolderTree: mockIcon('FolderTree'),
  GalleryHorizontal: mockIcon('GalleryHorizontal'),
  GitBranch: mockIcon('GitBranch'),
  GitCompareArrows: mockIcon('GitCompareArrows'),
  Globe: mockIcon('Globe'),
  History: mockIcon('History'),
  Grid2X2: mockIcon('Grid2X2'),
  Grid3X3: mockIcon('Grid3X3'),
  HardDrive: mockIcon('HardDrive'),
  Hash: mockIcon('Hash'),
  HelpCircle: mockIcon('HelpCircle'),
  Home: mockIcon('Home'),
  Image: mockIcon('Image'),
  Inbox: mockIcon('Inbox'),
  Key: mockIcon('Key'),
  Keyboard: mockIcon('Keyboard'),
  Layout: mockIcon('Layout'),
  LayoutGrid: mockIcon('LayoutGrid'),
  LayoutPanelTop: mockIcon('LayoutPanelTop'),
  Link: mockIcon('Link'),
  List: mockIcon('List'),
  Loader2: mockIcon('Loader2'),
  Lock: mockIcon('Lock'),
  MapPin: mockIcon('MapPin'),
  MessageCircle: mockIcon('MessageCircle'),
  MessageSquare: mockIcon('MessageSquare'),
  Minus: mockIcon('Minus'),
  Monitor: mockIcon('Monitor'),
  Moon: mockIcon('Moon'),
  Music: mockIcon('Music'),
  Navigation: mockIcon('Navigation'),
  Package: mockIcon('Package'),
  Palette: mockIcon('Palette'),
  PanelLeft: mockIcon('PanelLeft'),
  Pencil: mockIcon('Pencil'),
  PencilLine: mockIcon('PencilLine'),
  Plug: mockIcon('Plug'),
  Plus: mockIcon('Plus'),
  Presentation: mockIcon('Presentation'),
  Puzzle: mockIcon('Puzzle'),
  RefreshCw: mockIcon('RefreshCw'),
  RotateCcw: mockIcon('RotateCcw'),
  Rows: mockIcon('Rows'),
  Save: mockIcon('Save'),
  Scale: mockIcon('Scale'),
  Scissors: mockIcon('Scissors'),
  ScrollText: mockIcon('ScrollText'),
  Search: mockIcon('Search'),
  Settings: mockIcon('Settings'),
  Settings2: mockIcon('Settings2'),
  Shield: mockIcon('Shield'),
  ShoppingCart: mockIcon('ShoppingCart'),
  SlidersHorizontal: mockIcon('SlidersHorizontal'),
  Sparkles: mockIcon('Sparkles'),
  Square: mockIcon('Square'),
  Star: mockIcon('Star'),
  StickyNote: mockIcon('StickyNote'),
  Store: mockIcon('Store'),
  Sun: mockIcon('Sun'),
  Table: mockIcon('Table'),
  Tag: mockIcon('Tag'),
  Tags: mockIcon('Tags'),
  Target: mockIcon('Target'),
  Terminal: mockIcon('Terminal'),
  Trash2: mockIcon('Trash2'),
  Type: mockIcon('Type'),
  Upload: mockIcon('Upload'),
  User: mockIcon('User'),
  Video: mockIcon('Video'),
  WrapText: mockIcon('WrapText'),
  Wrench: mockIcon('Wrench'),
  X: mockIcon('X'),
  XCircle: mockIcon('XCircle'),
  Zap: mockIcon('Zap'),
  Brain: mockIcon('Brain'),
  ClipboardList: mockIcon('ClipboardList'),
  MousePointerClick: mockIcon('MousePointerClick'),
  ChevronsDown: mockIcon('ChevronsDown'),
  ChevronsUp: mockIcon('ChevronsUp'),
  FolderInput: mockIcon('FolderInput'),
  Trash: mockIcon('Trash'),
  Unlock: mockIcon('Unlock'),
  Link2: mockIcon('Link2'),
  ArrowRight: mockIcon('ArrowRight'),
  ArchiveX: mockIcon('ArchiveX'),
  BookOpenText: mockIcon('BookOpenText'),
  CalendarDays: mockIcon('CalendarDays'),
  Clapperboard: mockIcon('Clapperboard'),
  Disc: mockIcon('Disc'),
  Headphones: mockIcon('Headphones'),
  Laptop: mockIcon('Laptop'),
  MailOpen: mockIcon('MailOpen'),
  Mic: mockIcon('Mic'),
  MusicIcon: mockIcon('MusicIcon'),
  PenLine: mockIcon('PenLine'),
  Play: mockIcon('Play'),
  SearchCheck: mockIcon('SearchCheck'),
  Volume2: mockIcon('Volume2'),
  Activity: mockIcon('Activity'),
  ArrowUpAZ: mockIcon('ArrowUpAZ'),
  CopyPlus: mockIcon('CopyPlus'),
  FileCode2: mockIcon('FileCode2'),
  FileEdit: mockIcon('FileEdit'),
  FilePlus2: mockIcon('FilePlus2'),
  Filter: mockIcon('Filter'),
  FolderMinus: mockIcon('FolderMinus'),
  FolderSync: mockIcon('FolderSync'),
  GitCommit: mockIcon('GitCommit'),
  GripHorizontal: mockIcon('GripHorizontal'),
  Heart: mockIcon('Heart'),
  Info: mockIcon('Info'),
  Maximize2: mockIcon('Maximize2'),
  Minimize2: mockIcon('Minimize2'),
  MoreHorizontal: mockIcon('MoreHorizontal'),
  Pin: mockIcon('Pin'),
  Replace: mockIcon('Replace'),
  Rows3: mockIcon('Rows3'),
  ShieldAlert: mockIcon('ShieldAlert'),
  ShieldCheck: mockIcon('ShieldCheck'),
  ShieldQuestion: mockIcon('ShieldQuestion'),
  Unlink: mockIcon('Unlink'),
}));

// Prevent any Tauri API access during tests by setting up global environment
(global as unknown).__TAURI__ = undefined;
(window as unknown as Record<string, unknown>).__TAURI__ = undefined;

// Mock Tauri API
const mockInvoke = vi.fn().mockImplementation((command, _args) => {
  // Default return values for common commands
  switch (command) {
    case 'read_directory':
      return Promise.resolve([]);
    default:
      return Promise.resolve(null);
  }
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

// Mock Tauri event API
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

// Mock Tauri dialog API
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

// Mock TauriAPI module
vi.mock('@/lib/tauri-api', () => ({
  TauriAPI: {
    readDirectory: vi.fn(() => Promise.resolve([])),
    getFileIcon: vi.fn(() => '📄'),
    formatFileSize: vi.fn(() => '1 KB'),
    formatDate: vi.fn(() => '2024-01-01'),
    openTrash: vi.fn(() => Promise.resolve()),
    restoreFromTrash: vi.fn(() => Promise.resolve()),
    permanentlyDeleteFromTrash: vi.fn(() => Promise.resolve()),
    getTrashItems: vi.fn(() => Promise.resolve([])),
    calculateFolderSize: vi.fn(() => Promise.resolve({
      total_size: 1024,
      file_count: 1,
      dir_count: 0,
      is_cached: false,
      cache_timestamp: 0
    })),
    getCachedFolderSizes: vi.fn(() => Promise.resolve({})),
    clearFolderSizeCache: vi.fn(() => Promise.resolve()),
    readTextFile: vi.fn(() => Promise.resolve('')),
  },
  FileEntry: {},
  FolderSizeInfo: {},
  TrashItem: {},
}));

// Global mocks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock React Router for testing
// NOTE: Avoid require('react') inside vi.mock factory - it creates a separate CJS
// React instance that conflicts with the ESM React used by components, causing
// "Cannot read properties of null (reading 'useState')" errors.
vi.mock('wouter', async () => {
  const React = await import('react');
  return {
    useLocation: vi.fn(() => ['/test', vi.fn()]),
    Route: ({ children }: { children?: React.ReactNode }) => children,
    Link: ({ children, href }: { children?: React.ReactNode; href?: string }) => React.createElement('a', { href }, children),
  };
});

// Mock the utils functions
vi.mock('@/lib/utils', () => ({
  getFileIcon: vi.fn((file: { is_dir: boolean }) =>
    React.createElement('svg', { 'data-testid': file.is_dir ? 'FolderClosed' : 'File' })
  ),
  renderIcon: vi.fn((name: string, size?: number | string) =>
    React.createElement('svg', { 'data-testid': name, width: size, height: size })
  ),
  isValidIconName: vi.fn(() => true),
  ICON_NAMES: ['Folder', 'FileText', 'Image', 'Music', 'Star'],
  formatFileSize: vi.fn((bytes: number) => `${bytes} B`),
  formatDate: vi.fn((timestamp: number) => new Date(timestamp).toLocaleDateString()),
  sortFiles: vi.fn((files: unknown[]) => files),
  cn: vi.fn((...classes: unknown[]) => classes.filter(Boolean).join(' ')),
  applyFontSize: vi.fn(),
  loadFontSize: vi.fn(),
}));

// jsdom doesn't implement scrollIntoView
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = vi.fn();
}
