// Base extension manifest
export interface ExtensionManifest {
  id: string;
  name: string;
  // Preferred SDK field
  displayName?: string;
  // Compatibility with app/runtime manifest style
  display_name?: string;
  description?: string;
  version: string;
  author: string;
  category: 'theme' | 'preview' | 'action' | 'panel' | 'tool';
  icon?: string;
  keywords?: string[];
  homepage?: string;
  repository?: string;
  license?: string;
  dependencies?: Record<string, string>;
  permissions?: string[];
  // Preferred SDK field
  activationEvents?: string[];
  // Compatibility with app/runtime manifest style
  activation_events?: string[];
  main?: string;
  contributes?: {
    panels?: Array<{ id: string; title: string; location?: string; icon?: string; when?: string }>;
    commands?: Array<{ command: string; title: string; category?: string; icon?: string }>;
    themes?: string[];
    context_menus?: Array<{ command: string; when?: string; group?: string }>;
    keybindings?: Array<{ command: string; key: string; when?: string; title?: string }>;
  };
}

// Extension context provided to extensions
export interface ExtensionContext {
  extensionPath: string;
  globalState: {
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T): void;
    delete(key: string): void;
  };
  workspaceState: {
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T): void;
    delete(key: string): void;
  };
  subscriptions: Array<{ dispose(): void }>;
  asAbsolutePath(relativePath: string): string;
}

// File entry type
export interface FileEntry {
  path: string;
  name: string;
  size: number;
  // Runtime API uses unix timestamp (seconds). Keep Date for SDK compatibility.
  modified: number | Date;
  // Runtime API field
  is_dir?: boolean;
  // SDK-friendly alias
  isDirectory?: boolean;
  isHidden?: boolean;
  extension?: string;
  mimeType?: string;
  // Runtime API field
  mime_type?: string;
  // Runtime API field
  file_type?: string;
  permissions?: string;
}

// Theme definition
export interface Theme {
  name: string;
  displayName?: string;
  type: 'light' | 'dark';
  colors: {
    // Core colors
    primary: string;
    secondary: string;
    accent: string;

    // Background colors
    background: string;
    surface: string;
    overlay: string;

    // Text colors
    text: string;
    textSecondary: string;
    textMuted: string;

    // UI colors
    border: string;
    hover: string;
    selected: string;
    focus: string;

    // Status colors
    success: string;
    warning: string;
    error: string;
    info: string;

    // File type colors (optional)
    fileColors?: {
      folder: string;
      document: string;
      image: string;
      video: string;
      audio: string;
      archive: string;
      code: string;
      executable: string;
    };
  };
  fonts?: {
    main: string;
    mono: string;
    ui: string;
  };
  spacing?: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius?: {
    sm: string;
    md: string;
    lg: string;
  };
  shadows?: {
    sm: string;
    md: string;
    lg: string;
  };
  animations?: {
    duration: {
      fast: string;
      normal: string;
      slow: string;
    };
    easing: string;
  };
}

// Action menu item
export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  group?: string;
  when?: (files: FileEntry[]) => boolean;
  action: (files: FileEntry[], context: ExtensionContext) => Promise<void> | void;
}

// Preview component props
export interface PreviewProps {
  file: FileEntry;
  content?: string | ArrayBuffer;
  width: number;
  height: number;
  theme: Theme;
}

// Panel component props
export interface PanelProps {
  width?: number;
  height?: number;
  isActive: boolean;
  theme: Theme;
  context: ExtensionContext;
}

// Extension lifecycle events
export interface ExtensionLifecycle {
  activate(context: ExtensionContext): Promise<void> | void;
  deactivate(): Promise<void> | void;
}

// Backup types
export interface BackupFileEntry {
  path: string;
  size: number;
  modified: number;
  hash: string;
  is_new: boolean;
  is_modified: boolean;
}

export interface BackupManifest {
  backup_id: string;
  timestamp: string;
  source_dir: string;
  files: BackupFileEntry[];
  total_size: number;
  backup_type: 'full' | 'incremental';
}

// API interfaces for interacting with Xplorer
export interface XplorerAPI {
  // File operations
  files: {
    read(path: string): Promise<ArrayBuffer>;
    readText(path: string): Promise<string>;
    write(path: string, content: ArrayBuffer | string): Promise<void>;
    exists(path: string): Promise<boolean>;
    list(path: string): Promise<FileEntry[]>;
    watch(path: string, callback: (event: string, path: string) => void): { dispose(): void };
  };

  // UI operations
  ui: {
    showMessage(message: string, type?: 'info' | 'warning' | 'error'): void;
    showProgress(
      title: string,
      task: (progress: (value: number, message?: string) => void) => Promise<void>,
    ): Promise<void>;
    showInputBox(options: {
      prompt?: string;
      placeholder?: string;
      value?: string;
    }): Promise<string | undefined>;
    showQuickPick<T>(items: T[], options?: { placeHolder?: string }): Promise<T | undefined>;
  };

  // Navigation
  navigation: {
    getCurrentPath(): string;
    navigateTo(path: string): void;
    openFile(path: string): void;
    openInNewTab(path: string): void;
    /** Open a file in the editor (creates an editor tab in the main pane) */
    openInEditor(path: string): void;
  };

  // Settings
  settings: {
    get<T>(key: string, defaultValue?: T): T;
    set<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
  };

  // Commands
  commands: {
    register(
      command: string,
      callback: (...args: unknown[]) => unknown,
      metadata?: { title?: string; shortcut?: string; category?: string },
    ): { dispose(): void };
    execute(command: string, ...args: unknown[]): Promise<unknown>;
  };

  // Keyboard shortcuts
  shortcuts: {
    register(
      shortcutId: string,
      options: { key: string; title?: string; when?: string },
    ): Promise<void>;
    unregisterAll(): Promise<void>;
  };

  // Database operations (SQLite)
  database: {
    listTables(
      path: string,
    ): Promise<Array<{ name: string; row_count: number; column_count: number }>>;
    getTableColumns(
      path: string,
      table: string,
    ): Promise<
      Array<{
        name: string;
        data_type: string;
        is_nullable: boolean;
        is_primary_key: boolean;
        default_value: string | null;
      }>
    >;
    queryTable(
      path: string,
      table: string,
      limit: number,
      offset: number,
    ): Promise<{ columns: string[]; rows: string[][]; total_rows: number }>;
    executeQuery(
      path: string,
      query: string,
    ): Promise<{ columns: string[]; rows: string[][]; total_rows: number }>;
  };

  // Image processing operations
  images: {
    resize(
      path: string,
      width: number,
      height: number,
      maintainAspect: boolean,
      outputPath: string,
    ): Promise<string>;
    convert(
      path: string,
      outputFormat: string,
      quality: number,
      outputPath: string,
    ): Promise<string>;
    getInfo(path: string): Promise<ImageInfo>;
    batchProcess(
      paths: string[],
      operations: ImageOperations,
      outputDir: string,
    ): Promise<BatchImageResult[]>;
    rotate(path: string, degrees: number, outputPath: string): Promise<string>;
    flip(path: string, direction: string, outputPath: string): Promise<string>;
    crop(
      path: string,
      x: number,
      y: number,
      width: number,
      height: number,
      outputPath: string,
    ): Promise<string>;
    adjustBrightness(path: string, value: number, outputPath: string): Promise<string>;
    adjustContrast(path: string, value: number, outputPath: string): Promise<string>;
    grayscale(path: string, outputPath: string): Promise<string>;
  };

  // Backup operations
  backup: {
    create(sourceDir: string, backupDir: string, name: string): Promise<BackupManifest>;
    list(backupDir: string, name: string): Promise<BackupManifest[]>;
    restore(backupId: string, backupDir: string, name: string, restoreTo: string): Promise<void>;
    delete(backupId: string, backupDir: string, name: string): Promise<void>;
    onProgress(
      callback: (progress: {
        phase: string;
        current: number;
        total: number;
        current_file: string;
        percentage: number;
      }) => void,
    ): { dispose(): void };
  };

  // Docker operations
  docker: {
    isAvailable(): Promise<boolean>;
    listContainers(all: boolean): Promise<DockerContainerInfo[]>;
    listImages(): Promise<DockerImageInfo[]>;
    startContainer(id: string): Promise<void>;
    stopContainer(id: string): Promise<void>;
    removeContainer(id: string, force: boolean): Promise<void>;
    removeImage(id: string, force: boolean): Promise<void>;
    containerLogs(id: string, lines: number): Promise<string>;
  };
}

// Docker types
export interface DockerContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  created: string;
}

export interface DockerImageInfo {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

// Image processing types
export interface ImageOperations {
  resize: { width: number; height: number; maintain_aspect: boolean } | null;
  convert: { format: string; quality: number } | null;
  quality: number | null;
}

export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  file_size: number;
  color_type: string;
}

export interface BatchImageResult {
  path: string;
  output_path: string;
  success: boolean;
  error: string | null;
  original_size: number;
  new_size: number;
}

// SQLite database types
export interface SqliteTableInfo {
  name: string;
  row_count: number;
  column_count: number;
}

export interface SqliteColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  default_value: string | null;
}

export interface SqliteQueryResult {
  columns: string[];
  rows: string[][];
  total_rows: number;
}

// File versioning types
export interface FileVersion {
  version_number: number;
  timestamp: string;
  size: number;
  path: string;
  original_name: string;
}

export interface VersioningConfig {
  enabled_dirs: string[];
  max_versions_per_file: number;
  auto_version_on_save: boolean;
}

// Audit log types
export interface AuditEntry {
  id: number;
  timestamp: string;
  operation: string;
  paths: string[];
  user: string;
  details: string | null;
  success: boolean;
}

export interface AuditLogQuery {
  entries: AuditEntry[];
  total: number;
}

// Secure delete types
export interface SecureDeleteResult {
  path: string;
  success: boolean;
  passes: number;
  error: string | null;
}

// Conflict resolution types
export interface ConflictFileInfo {
  path: string;
  name: string;
  is_dir: boolean;
  size: number;
  modified: number;
}

export interface ConflictInfo {
  source: ConflictFileInfo;
  destination: ConflictFileInfo;
}
