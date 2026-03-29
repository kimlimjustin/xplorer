import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock IntersectionObserver (not available in jsdom)
// This provides a simple mock that immediately calls back with isIntersecting: true
class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(_callback: IntersectionObserverCallback) {}

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  value: MockIntersectionObserver,
  writable: true,
  configurable: true,
});

// Mock @/hooks/useInView so components always render as visible
vi.mock('@/hooks/useInView', () => ({
  useInView: () => ({ ref: React.createRef(), inView: true }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, priority, sizes, ...rest } = props;
    return <img {...rest} />;
  },
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', setTheme: vi.fn(), resolvedTheme: 'light' })),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock lucide-react icons - explicitly list all icons used across the web/ codebase
// Using a factory function to generate icon components
function createIconMock(name: string) {
  const IconComponent = (props: Record<string, unknown>) => <span data-icon={name} {...props} />;
  IconComponent.displayName = name;
  return IconComponent;
}

vi.mock('lucide-react', () => ({
  ArrowRight: createIconMock('ArrowRight'),
  Github: createIconMock('Github'),
  Download: createIconMock('Download'),
  FolderOpen: createIconMock('FolderOpen'),
  Eye: createIconMock('Eye'),
  Brain: createIconMock('Brain'),
  Search: createIconMock('Search'),
  GitBranch: createIconMock('GitBranch'),
  Puzzle: createIconMock('Puzzle'),
  Menu: createIconMock('Menu'),
  X: createIconMock('X'),
  Sun: createIconMock('Sun'),
  Moon: createIconMock('Moon'),
  Star: createIconMock('Star'),
  Upload: createIconMock('Upload'),
  Package: createIconMock('Package'),
  AlertCircle: createIconMock('AlertCircle'),
  CheckCircle: createIconMock('CheckCircle'),
  ChevronRight: createIconMock('ChevronRight'),
  ExternalLink: createIconMock('ExternalLink'),
  Bug: createIconMock('Bug'),
  Clock: createIconMock('Clock'),
  SlidersHorizontal: createIconMock('SlidersHorizontal'),
  Check: createIconMock('Check'),
  Heart: createIconMock('Heart'),
  LayoutDashboard: createIconMock('LayoutDashboard'),
  CreditCard: createIconMock('CreditCard'),
  Settings: createIconMock('Settings'),
  Zap: createIconMock('Zap'),
  Shield: createIconMock('Shield'),
  Palette: createIconMock('Palette'),
  Terminal: createIconMock('Terminal'),
  Globe: createIconMock('Globe'),
  Lock: createIconMock('Lock'),
  Trash2: createIconMock('Trash2'),
  Edit: createIconMock('Edit'),
  MoreVertical: createIconMock('MoreVertical'),
  User: createIconMock('User'),
  LogOut: createIconMock('LogOut'),
  BarChart3: createIconMock('BarChart3'),
  DollarSign: createIconMock('DollarSign'),
  Users: createIconMock('Users'),
  TrendingUp: createIconMock('TrendingUp'),
  Activity: createIconMock('Activity'),
  XCircle: createIconMock('XCircle'),
  Info: createIconMock('Info'),
  FileText: createIconMock('FileText'),
  ChevronDown: createIconMock('ChevronDown'),
  Home: createIconMock('Home'),
  Monitor: createIconMock('Monitor'),
  ImageIcon: createIconMock('ImageIcon'),
  Folder: createIconMock('Folder'),
  File: createIconMock('File'),
  FileCode: createIconMock('FileCode'),
  FileImage: createIconMock('FileImage'),
  FileType: createIconMock('FileType'),
  GitCommit: createIconMock('GitCommit'),
  Send: createIconMock('Send'),
  Bot: createIconMock('Bot'),
  Filter: createIconMock('Filter'),
  Wrench: createIconMock('Wrench'),
  Plus: createIconMock('Plus'),
  FolderClosed: createIconMock('FolderClosed'),
  FileJson: createIconMock('FileJson'),
  BookOpen: createIconMock('BookOpen'),
  HardDrive: createIconMock('HardDrive'),
  ArrowLeft: createIconMock('ArrowLeft'),
  ArrowUp: createIconMock('ArrowUp'),
  RefreshCw: createIconMock('RefreshCw'),
  Pencil: createIconMock('Pencil'),
  LayoutGrid: createIconMock('LayoutGrid'),
  List: createIconMock('List'),
  Music: createIconMock('Music'),
  Film: createIconMock('Film'),
  Sparkles: createIconMock('Sparkles'),
  Code: createIconMock('Code'),
  ToggleLeft: createIconMock('ToggleLeft'),
  ToggleRight: createIconMock('ToggleRight'),
  Copy: createIconMock('Copy'),
  Twitter: createIconMock('Twitter'),
  FileStack: createIconMock('FileStack'),
  Cpu: createIconMock('Cpu'),
  Layers: createIconMock('Layers'),
  Blocks: createIconMock('Blocks'),
  ChevronLeft: createIconMock('ChevronLeft'),
  MessageSquarePlus: createIconMock('MessageSquarePlus'),
}));
