// ── High-level APIs (recommended for extension authors) ────────────────────
export {
  Sidebar,
  SidebarTab,
  Theme,
  Command,
  ContextMenu,
  Preview,
  Editor,
  BottomTab,
} from './api';
export type {
  ThemeConfig,
  ThemeColors,
  SidebarConfig,
  SidebarRenderProps,
  SidebarTabConfig,
  SidebarTabRenderProps,
  CommandConfig,
  ContextMenuConfig,
  ContextMenuFile,
  PreviewConfig,
  PreviewFile,
  PreviewRenderProps,
  EditorConfig,
  BottomTabConfig,
  BottomTabRenderProps,
} from './api';

// ── Hooks ──────────────────────────────────────────────────────────────────
export { useCurrentPath, useSelectedFiles, navigateTo } from './hooks';

// ── UI Components ──────────────────────────────────────────────────────────
export { Button, Input, Select, Toggle, Spinner, Panel, Card } from './components';
export type {
  ButtonProps,
  InputProps,
  SelectProps,
  ToggleProps,
  SpinnerProps,
  PanelComponentProps,
  CardProps,
} from './components';

// ── Base classes (advanced usage) ──────────────────────────────────────────
export { Extension } from './core/Extension';

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  ExtensionManifest,
  ExtensionContext,
  Theme as ThemeDefinition,
  FileEntry,
  ActionMenuItem,
  PreviewProps,
  PanelProps,
  XplorerAPI,
  DockerContainerInfo,
  DockerImageInfo,
  ImageInfo,
  ImageOperations,
  BatchImageResult,
  BackupManifest,
  BackupFileEntry,
  SqliteTableInfo,
  SqliteColumnInfo,
  SqliteQueryResult,
  FileVersion,
  VersioningConfig,
  AuditEntry,
  AuditLogQuery,
  SecureDeleteResult,
  ConflictInfo,
  ConflictFileInfo,
} from './types';
