// ── Core file types ──────────────────────────────────────────────────────────

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  file_type: string;
  mime_type?: string;
  /** Whether the file/directory is read-only. */
  is_readonly: boolean;
}

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

export interface FolderSizeInfo {
  total_size: number;
  file_count: number;
  dir_count: number;
  is_cached: boolean;
  cache_timestamp: number;
}

export interface FileProperties {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  created: number;
  modified: number;
  accessed: number;
  readonly: boolean;
  hidden: boolean;
  file_type: string;
  mime_type?: string;
}

export interface DetailedFileProperties {
  path: string;
  name: string;
  file_type: string;
  size: number;
  size_formatted: string;
  created: number;
  modified: number;
  accessed: number;
  created_formatted: string;
  modified_formatted: string;
  accessed_formatted: string;
  permissions: FilePermissions;
  is_directory: boolean;
  is_hidden: boolean;
  is_readonly: boolean;
  extension?: string;
  mime_type?: string;
  attributes: FileAttributes;
}

export interface FilePermissions {
  readable: boolean;
  writable: boolean;
  executable: boolean;
  permissions_string: string;
  mode?: number;
  attributes?: number;
}

export interface FileAttributes {
  item_count?: number;
  total_size?: number;
  symlink_target?: string;
  device_id?: number;
  inode?: number;
  hard_links?: number;
}

export interface Application {
  name: string;
  path: string;
  icon?: string;
  is_default: boolean;
}

export interface FileAssociation {
  extension: string;
  mime_type?: string;
  default_app?: Application;
  available_apps: Application[];
}

// ── Compression / Archive types ──────────────────────────────────────────────

export interface CompressionOptions {
  format: CompressionFormat;
  compression_level?: number;
  password?: string;
  include_hidden: boolean;
  follow_symlinks: boolean;
}

export type CompressionFormat = 'Zip' | 'Tar' | 'TarGz' | 'TarBz2' | 'TarXz' | 'SevenZ' | 'Rar';

export interface CompressionInfo {
  total_files: number;
  total_directories: number;
  total_size: number;
  estimated_compressed_size: number;
}

export interface ExtractionOptions {
  output_directory: string;
  password?: string;
  overwrite_existing: boolean;
  preserve_permissions: boolean;
  include_hidden: boolean;
}

export interface ArchiveInfo {
  format: CompressionFormat;
  total_files: number;
  total_directories: number;
  total_size: number;
  compressed_size: number;
  is_encrypted: boolean;
  created: number;
  modified: number;
  files: ArchiveFileEntry[];
}

export interface ArchiveFileEntry {
  name: string;
  path: string;
  size: number;
  compressed_size: number;
  is_directory: boolean;
  modified: number;
}

export interface CompressionProgress {
  current_file: string;
  processed_files: number;
  total_files: number;
  processed_bytes: number;
  total_bytes: number;
  progress_percentage: number;
  status: string;
}

// ── Directory / Trash types ──────────────────────────────────────────────────

export interface DirectorySize {
  total_size: number;
  file_count: number;
  dir_count: number;
}

export interface TrashItem {
  name: string;
  original_path: string;
  deletion_date: number;
  size: number;
  is_dir: boolean;
}

export interface FileSystemNode {
  path: string;
  name: string;
  is_dir: boolean;
  size: number;
  modified: number;
  content?: string; // Only for files
  children?: FileSystemNode[]; // Only for directories
  error?: string; // If there was an error reading
}

// ── Agent types ──────────────────────────────────────────────────────────────

export interface AgentProgress {
  current_path: string;
  processed_files: number;
  processed_dirs: number;
  total_size: number;
  recursion_depth: number;
  status: string;
}

// Claude Agent types — redacted settings (no plaintext keys)
export interface SafeAgentSettings {
  enabled: boolean;
  has_api_key: boolean;
  has_openai_api_key: boolean;
  model: string;
  max_turns: number;
  auto_approve: boolean;
  thinking_enabled: boolean;
  thinking_budget: number;
}

export interface UpdateAgentSettingsPayload {
  enabled: boolean;
  model: string;
  max_turns: number;
  auto_approve: boolean;
  thinking_enabled: boolean;
  thinking_budget: number;
}

export interface UpdateAgentApiKeysPayload {
  api_key?: string;
  openai_api_key?: string;
}

// ── Bulk rename types ────────────────────────────────────────────────────────

export interface BulkRenameResult {
  original_path: string;
  new_path: string;
  original_name: string;
  new_name: string;
  success: boolean;
  error: string | null;
}

// ── Git types ────────────────────────────────────────────────────────────────

// Git history types (mirrors Rust structs in git_history.rs)
export interface GitCommit {
  hash: string;
  short_hash: string;
  author_name: string;
  author_email: string;
  committer_name: string;
  committer_email: string;
  date: string;
  timestamp: number;
  message: string;
  summary: string;
  body?: string;
  parent_hashes: string[];
  files_changed: string[];
  insertions: number;
  deletions: number;
}

export interface GitFileHistory {
  file_path: string;
  commits: GitCommit[];
  total_commits: number;
  first_commit?: GitCommit;
  last_commit?: GitCommit;
  total_lines_added: number;
  total_lines_deleted: number;
}

export interface GitFileBlame {
  file_path: string;
  lines: GitBlameLine[];
  unique_authors: string[];
  total_lines: number;
}

export interface GitBlameLine {
  line_number: number;
  content: string;
  commit_hash: string;
  short_hash: string;
  author_name: string;
  author_email: string;
  date: string;
  timestamp: number;
  summary: string;
}

export interface GitDiff {
  file_path: string;
  old_path?: string;
  change_type: string;
  hunks: GitDiffHunk[];
  lines_added: number;
  lines_deleted: number;
  binary: boolean;
}

export interface GitDiffHunk {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  header: string;
  lines: GitDiffLine[];
}

export interface GitDiffLine {
  line_type: string;
  content: string;
  old_line_number?: number;
  new_line_number?: number;
}

export interface GitRepositoryInfo {
  root_path: string;
  current_branch: string;
  remote_url?: string;
  total_commits: number;
  total_contributors: number;
  last_commit?: GitCommit;
  uncommitted_changes: boolean;
  untracked_files: string[];
  modified_files: string[];
  staged_files: string[];
}

export interface GitFileStatus {
  path: string;
  status: string;
}

export interface GitRepoInfo {
  is_repo: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  has_changes: boolean;
}

// ── Duplicate finder types ───────────────────────────────────────────────────

// Duplicate finder result type (mirrors Rust struct in duplicate_finder.rs)
export interface DuplicateFinderResult {
  duplicate_groups: Array<{
    hash: string;
    size: number;
    files: Array<{
      path: string;
      name: string;
      size: number;
      hash: string;
      modified: number;
    }>;
    total_wasted_space: number;
  }>;
  total_duplicates: number;
  total_wasted_space: number;
  scan_time_ms: number;
  files_scanned: number;
}

// ── File comparison types ────────────────────────────────────────────────────

// File comparison result (mirrors Rust struct in comparison_ops.rs — uses camelCase serialization)
export interface FileComparisonResult {
  file1: {
    path: string;
    name: string;
    size: number;
    modified: number;
    hash: string | null;
    content: string | null;
    lines: string[] | null;
    error: string | null;
  };
  file2: {
    path: string;
    name: string;
    size: number;
    modified: number;
    hash: string | null;
    content: string | null;
    lines: string[] | null;
    error: string | null;
  };
  differences: Array<{
    diffType: string;
    line1: number | null;
    line2: number | null;
    content1: string | null;
    content2: string | null;
    context: string[] | null;
    severity: string;
  }>;
  identical: boolean;
  similarity: number;
  comparisonType: string;
  metadata: {
    processingTime: number;
    linesAdded: number;
    linesRemoved: number;
    linesModified: number;
    totalLines1: number;
    totalLines2: number;
    bytesDifferent: number;
    algorithm: string;
  };
}

// ── Extension types ──────────────────────────────────────────────────────────

// Extension types (mirrors Rust structs in extensions/types.rs)
export interface ExtensionManifestInfo {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  version: string;
  author: string;
  category: string;
  icon?: string;
  keywords?: string[];
  homepage?: string;
  repository?: string;
  license?: string;
  permissions?: string[];
  activation_events?: string[];
  main?: string;
  contributes?: {
    panels?: Array<{
      id: string;
      title: string;
      location: string;
      icon?: string;
      when?: string;
    }>;
    commands?: Array<{
      command: string;
      title: string;
      category?: string;
      icon?: string;
    }>;
    themes?: string[];
    file_types?: Array<{
      id: string;
      extensions: string[];
      mime_types?: string[];
      icon?: string;
      language_id?: string;
    }>;
    context_menus?: Array<{
      command: string;
      when?: string;
      group?: string;
    }>;
    keybindings?: Array<{
      command: string;
      key: string;
      when?: string;
      title?: string;
    }>;
  };
}

export interface ExtensionPackageInfo {
  manifest: ExtensionManifestInfo;
  path: string;
  is_active: boolean;
  is_installed: boolean;
  verified?: boolean;
}

// ── Chat types ───────────────────────────────────────────────────────────────

export interface ChatFileData {
  version: number;
  model: string;
  thinking_enabled: boolean;
  context: ChatFileContext[];
  messages: ChatFileMessage[];
}

export interface ChatFileMessage {
  role: string;
  content: string;
  timestamp: number;
  model?: string;
  thinking?: string;
}

export interface ChatFileContext {
  path: string;
  name: string;
}

export interface ChatFileSummary {
  message_count: number;
  last_message_preview: string;
  model: string;
  last_updated: number;
}

// Chat history types
export interface ChatHistoryMessage {
  role: string;
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatHistoryMessage[];
  created_at: string;
  updated_at: string;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

// ── Sync types ───────────────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  synced_at: string | null;
  message: string;
}

// ── Docker types ─────────────────────────────────────────────────────────────

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

// ── File versioning types ────────────────────────────────────────────────────

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

// ── Recent file types ────────────────────────────────────────────────────────

export interface RecentFile {
  path: string;
  name: string;
  accessed_at: number;
  file_type: string;
  size: number;
}

// ── Bookmark types ───────────────────────────────────────────────────────────

export interface BookmarkEntry {
  path: string;
  name: string;
  added_at: string; // ISO timestamp
  is_dir: boolean;
}

// ── Tokenizer types ──────────────────────────────────────────────────────────

export interface TokenizerSettings {
  enabled: boolean;
  whitelisted_paths: string[];
  blacklisted_extensions: string[];
  blacklisted_paths: string[];
  max_file_size: number;
  update_interval: number;
  memory_limit_mb: number;
}

export interface FileToken {
  path: string;
  filename: string;
  extension: string;
  content_tokens: string[];
  file_size: number;
  last_modified: number;
  indexed_at: number;
  content_source: string;
}

export interface TokenIndex {
  files: Record<string, FileToken>;
  word_to_files: Record<string, string[]>;
  metadata_files: Record<string, FileMetadata>;
  last_updated: number;
  total_files: number;
  total_tokens: number;
}

export interface FileMetadata {
  path: string;
  filename: string;
  extension: string;
  size: number;
  modified: number;
}

// ── Search types ─────────────────────────────────────────────────────────────

export interface SearchResult {
  path: string;
  filename: string;
  matches: SearchMatch[];
  score: number;
  relevance_type: string; // "exact", "partial", "semantic", "fuzzy"
  snippet?: string;
}

export interface SearchMatch {
  token: string;
  context: string;
  line_number?: number;
}

// Phase 1: Structured query types
export type FileTypeFilter = 'Videos' | 'Images' | 'Documents' | 'Code' | 'Audio' | 'Archives';

export interface SizeFilter {
  min_bytes?: number;
  max_bytes?: number;
}

export interface DateFilter {
  after?: number;
  before?: number;
}

export interface StructuredQuery {
  keywords: string[];
  file_type_filter?: FileTypeFilter;
  size_filter?: SizeFilter;
  date_filter?: DateFilter;
  extension_filter: string[];
  content_source_filter?: string;
  sort_hint?: string;
}

export interface EnhancedSearchResult {
  results: SearchResult[];
  parsed_query: StructuredQuery;
  total_scanned: number;
}

// AI Search re-ranking result
export interface AISearchResult {
  results: SearchResult[];
  provider: string;
  model: string;
}

// ── AI Index types ───────────────────────────────────────────────────────────

// Phase 3: AI Index types
export interface AIIndexStatus {
  enabled: boolean;
  total_indexed: number;
  queue_length: number;
  is_processing: boolean;
  current_file?: string;
  vision_model?: string;
  embedding_model?: string;
}

export interface AIIndexEntry {
  path: string;
  description?: string;
  extracted_text?: string;
  tags: string[];
  model_used: string;
  indexed_at: number;
}

// ── Progress types ───────────────────────────────────────────────────────────

export interface IndexingProgress {
  current_file: string;
  processed_files: number;
  total_files: number;
  current_tokens: number;
  total_tokens: number;
  progress_percentage: number;
  status: string;
}

export interface FileOperationProgress {
  operation_id: string;
  operation_type: string;
  source_path: string;
  destination_path?: string;
  current_file: string;
  bytes_processed: number;
  total_bytes: number;
  files_processed: number;
  total_files: number;
  progress_percentage: number;
  speed_bytes_per_second: number;
  estimated_remaining_seconds?: number;
  status: 'Starting' | 'InProgress' | 'Completed' | 'Failed' | 'Cancelled' | 'Paused';
  error_message?: string;
  copy_strategy?: string;
  hardware_acceleration: boolean;
}

// ── Shortcut types ───────────────────────────────────────────────────────────

export interface ShortcutKey {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export type ShortcutAction =
  // File operations
  | 'Copy'
  | 'Cut'
  | 'Paste'
  | 'Delete'
  | 'Rename'
  | 'NewFile'
  | 'NewFolder'
  | 'Duplicate'
  // Navigation
  | 'NavigateUp'
  | 'NavigateBack'
  | 'NavigateForward'
  | 'GoHome'
  | 'GoToPath'
  // View operations
  | 'Refresh'
  | 'ToggleHiddenFiles'
  | 'TogglePreview'
  | 'ToggleLeftSidebar'
  | 'ToggleRightSidebar'
  | 'ToggleBottomPanel'
  | 'SwitchViewMode'
  | 'ZoomIn'
  | 'ZoomOut'
  // Search and filter
  | 'Search'
  | 'QuickSearch'
  | 'NaturalLanguageSearch'
  | 'FilterFiles'
  | 'ClearFilter'
  // Selection
  | 'SelectAll'
  | 'ClearSelection'
  | 'InvertSelection'
  // Application operations
  | 'OpenSettings'
  | 'ToggleFullscreen'
  | 'Quit'
  | 'NewWindow'
  | 'CloseTab'
  | 'NextTab'
  | 'PreviousTab'
  // Terminal / AI
  | 'OpenTerminal'
  | 'OpenAIAssistant'
  | 'OpenExtensions'
  // Extension operations
  | {
      ExtensionAction: { extension_id: string; action_id: string; params?: Record<string, string> };
    }
  // Legacy
  | 'Save'
  | 'SaveAs'
  | 'Open'
  | 'OpenWith'
  | 'Properties'
  | 'FocusExplorer'
  | 'FocusSearch'
  | 'Minimize'
  | 'Maximize'
  | 'Cancel'
  | 'Undo'
  | 'Redo';

export interface ShortcutBinding {
  id: string;
  keys: string[];
  action: ShortcutAction;
  context: string | null;
  enabled: boolean;
  profile: string;
  description?: string;
  global: boolean;
  key_combination: string;
}

export interface ShortcutProfile {
  id: string;
  name: string;
  description?: string;
  shortcuts: ShortcutBinding[];
}

export interface ShortcutSettings {
  current_profile: string;
  global_shortcuts_enabled: boolean;
  context_aware: boolean;
  profiles: ShortcutProfile[];
}

// ── File Organizer types ─────────────────────────────────────────────────────

export interface FileCategory {
  name: string;
  file_count: number;
  total_size: number;
  extensions: string[];
  example_files: string[];
}

export interface FolderSuggestion {
  suggested_name: string;
  target_path: string;
  files_to_move: string[];
  reason: string;
  category: string;
}

export interface DuplicateCleanupRec {
  groups: DuplicateGroupInfo[];
  total_wasted_space: number;
  recommendations: CleanupAction[];
}

export interface DuplicateGroupInfo {
  hash: string;
  size: number;
  files: DuplicateFileInfo[];
  total_wasted_space: number;
}

export interface DuplicateFileInfo {
  path: string;
  name: string;
  size: number;
  hash: string;
  modified: number;
}

export interface CleanupAction {
  action_type: string;
  files: string[];
  reason: string;
}

export interface OrganizerFileInfo {
  path: string;
  name: string;
  size: number;
  modified: number;
}

export interface CategoryDistribution {
  category: string;
  count: number;
  total_size: number;
}

export interface MonthCount {
  month: string;
  count: number;
}

export interface DirectoryInsights {
  total_files: number;
  total_size: number;
  largest_files: OrganizerFileInfo[];
  oldest_files: OrganizerFileInfo[];
  newest_files: OrganizerFileInfo[];
  type_distribution: CategoryDistribution[];
  avg_file_size: number;
  files_by_month: MonthCount[];
}

export interface OrganizationAnalysis {
  categories: FileCategory[];
  suggestions: FolderSuggestion[];
  duplicate_summary: DuplicateCleanupRec | null;
  insights: DirectoryInsights;
  is_project: boolean;
  project_type: string | null;
}

export interface OrganizationPlan {
  moves: PlannedMove[];
  creates: string[];
}

export interface PlannedMove {
  from: string;
  to: string;
  reason: string;
}

// ── Storage Analytics types ──────────────────────────────────────────────────

export interface TypeDistribution {
  extension: string;
  count: number;
  total_size: number;
}

export interface LargeFile {
  path: string;
  name: string;
  size: number;
}

export interface SizeCategory {
  label: string;
  count: number;
  total_size: number;
}

export interface StorageAnalytics {
  total_size: number;
  used_size: number;
  free_size: number;
  file_count: number;
  dir_count: number;
  file_type_distribution: TypeDistribution[];
  largest_files: LargeFile[];
  size_categories: SizeCategory[];
}

export interface StorageAnalysisProgress {
  files_processed: number;
  dirs_processed: number;
  current_path: string;
  bytes_processed: number;
}

// ── Directory Diagnostics types ──────────────────────────────────────────────

export interface DirectoryProblem {
  path: string;
  name: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  size?: number;
}

export interface DiagnosisResult {
  problems: DirectoryProblem[];
  scanned_files: number;
  scanned_dirs: number;
}

// ── File Tags types ──────────────────────────────────────────────────────────

export interface FileTag {
  name: string;
  color: string; // hex color e.g. "#7aa2f7"
}

// ── File Notes types ─────────────────────────────────────────────────────────

export interface FileNote {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface NoteSearchResult {
  path: string;
  note: FileNote;
}

// ── File Annotations types ───────────────────────────────────────────────────

export interface FileAnnotation {
  id: string;
  text: string;
  author: string;
  created_at: string;
  resolved: boolean;
}

// ── Tag Categories types ─────────────────────────────────────────────────────

export interface TagCategory {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
}

// ── Custom Metadata types ────────────────────────────────────────────────────

export interface CustomMetadataField {
  key: string;
  value: string;
  field_type: string;
}

// ── SQLite database types ────────────────────────────────────────────────────

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

// ── Image processing types ───────────────────────────────────────────────────

export interface ResizeOp {
  width: number;
  height: number;
  maintain_aspect: boolean;
}

export interface ConvertOp {
  format: string;
}

export interface ImageOperations {
  resize: ResizeOp | null;
  convert: ConvertOp | null;
  quality: number | null;
}

export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  file_size: number;
  color_type: string;
}

export interface BatchImageProgress {
  current_file: string;
  processed: number;
  total: number;
  progress_percentage: number;
  status: string;
}

export interface BatchImageResult {
  path: string;
  output_path: string;
  success: boolean;
  error: string | null;
  original_size: number;
  new_size: number;
}

// ── Backup types ─────────────────────────────────────────────────────────────

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

export interface BackupProgress {
  phase: string;
  current: number;
  total: number;
  current_file: string;
  percentage: number;
}

// ── Audit types ──────────────────────────────────────────────────────────────

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
