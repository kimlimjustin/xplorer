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
      return Object.entries(opts).reduce((str, [k, v]) => str.replace(`{{${k}}}`, String(v)), base);
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Mock lucide-react with a Proxy that auto-generates mock icons for any name
vi.mock('lucide-react', () => {
  const createMockIcon = (name: string) => {
    const MockIcon = (props: Record<string, unknown>) =>
      React.createElement('svg', { 'data-testid': `icon-${name}`, ...props });
    MockIcon.displayName = name;
    return MockIcon;
  };

  return new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => {
      if (prop === '__esModule') return true;
      if (prop === 'default') return {};
      if (prop === 'createLucideIcon') {
        return (name: string) => createMockIcon(name);
      }
      return createMockIcon(prop);
    },
  });
});

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
    calculateFolderSize: vi.fn(() =>
      Promise.resolve({
        total_size: 1024,
        file_count: 1,
        dir_count: 0,
        is_cached: false,
        cache_timestamp: 0,
      }),
    ),
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
  value: vi.fn().mockImplementation((query) => ({
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
    Link: ({ children, href }: { children?: React.ReactNode; href?: string }) =>
      React.createElement('a', { href }, children),
  };
});

// Mock the utils functions
vi.mock('@/lib/utils', () => ({
  getFileIcon: vi.fn((file: { is_dir: boolean }) =>
    React.createElement('svg', { 'data-testid': file.is_dir ? 'FolderClosed' : 'File' }),
  ),
  renderIcon: vi.fn((name: string, size?: number | string) =>
    React.createElement('svg', { 'data-testid': name, width: size, height: size }),
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
