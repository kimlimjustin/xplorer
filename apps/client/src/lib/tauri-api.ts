import { transport, listenToEvent as transportListen } from './transport';
import type {
  FileEntry,
  FileProperties,
  DetailedFileProperties,
  FileAssociation,
  Application,
  CompressionOptions,
  CompressionInfo,
  ExtractionOptions,
  ArchiveInfo,
  BulkRenameResult,
  TrashItem,
  FileSystemNode,
  FolderSizeInfo,
  SearchResult,
  EnhancedSearchResult,
  AISearchResult,
  AIIndexStatus,
  AIIndexEntry,
  TokenIndex,
  ChatFileData,
  ChatFileSummary,
  ChatSession,
  ChatSessionSummary,
  BookmarkEntry,
  FileTag,
  FileNote,
  NoteSearchResult,
  FileAnnotation,
  TagCategory,
  CustomMetadataField,
  DuplicateFinderResult,
  FileComparisonResult,
  ExtensionManifestInfo,
  ExtensionPackageInfo,
  ShortcutKey,
  ShortcutAction,
  ShortcutBinding,
  ShortcutSettings,
  FileVersion,
  VersioningConfig,
  RecentFile,
  FileOperationProgress,
  OrganizationAnalysis,
  OrganizationPlan,
  StorageAnalytics,
  DiagnosisResult,
  SqliteTableInfo,
  SqliteColumnInfo,
  SqliteQueryResult,
  ImageOperations,
  ImageInfo,
  BatchImageResult,
  BackupManifest,
  AuditLogQuery,
  DockerContainerInfo,
  DockerImageInfo,
  SyncResult,
  AgentProgress,
  AgentSettings,
  ConflictInfo,
  DirectorySize,
  FileToken,
  StructuredQuery,
  TokenizerSettings,
  GitCommit,
  GitFileHistory,
  GitFileBlame,
  GitDiff,
  GitRepositoryInfo,
  GitFileStatus,
  GitRepoInfo,
} from './tauri-api-types';

// Re-export all types so consumers can import from either location
export * from './tauri-api-types';

export class TauriAPI {
  // File operations
  static async readDirectory(path: string): Promise<FileEntry[]> {
    return await transport('read_directory', { path });
  }

  static async getFileProperties(path: string): Promise<FileProperties> {
    return await transport('get_file_properties', { path });
  }

  static async getFileMetaData(path: string): Promise<FileProperties> {
    return await transport('get_file_meta_data', { path });
  }

  static async getDetailedFileProperties(filePath: string): Promise<DetailedFileProperties> {
    return await transport('get_detailed_file_properties', { filePath });
  }

  static async getDirectorySize(dirPath: string): Promise<number> {
    return await transport('get_directory_size', { dirPath });
  }

  static async getDirectoryItemCount(dirPath: string): Promise<number> {
    return await transport('get_directory_item_count', { dirPath });
  }

  static async setFilePermissions(filePath: string, permissions: string): Promise<void> {
    return await transport('set_file_permissions', { filePath, permissions });
  }

  // File association operations
  static async getFileAssociations(filePath: string): Promise<FileAssociation> {
    return await transport('get_file_associations', { filePath });
  }

  static async openFileWithApplication(filePath: string, appPath: string): Promise<void> {
    return await transport('open_file_with_application', { filePath, appPath });
  }

  static async getSystemApplications(): Promise<Application[]> {
    return await transport('get_system_applications');
  }

  static async setDefaultApplication(fileExtension: string, appPath: string): Promise<void> {
    return await transport('set_default_application', { fileExtension, appPath });
  }

  // Compression operations
  static async compressFiles(
    filePaths: string[],
    outputPath: string,
    options: CompressionOptions,
  ): Promise<string> {
    return await transport('compress_files', { filePaths, outputPath, options });
  }

  static async getCompressionInfo(filePaths: string[]): Promise<CompressionInfo> {
    return await transport('get_compression_info', { filePaths });
  }

  // Extraction operations
  static async extractArchive(archivePath: string, options: ExtractionOptions): Promise<string> {
    return await transport('extract_archive', { archivePath, options });
  }

  static async getArchiveInfo(archivePath: string): Promise<ArchiveInfo> {
    return await transport('get_archive_info', { archivePath });
  }

  static async extractSelectedEntries(
    archivePath: string,
    entries: string[],
    outputDir: string,
    overwrite: boolean,
  ): Promise<string> {
    return await transport('extract_selected_entries', {
      archivePath,
      entries,
      outputDir,
      overwrite,
    });
  }

  static async isArchive(filePath: string): Promise<boolean> {
    return await transport('is_archive', { filePath });
  }

  // Encryption operations
  static async encryptFile(path: string, password: string): Promise<string> {
    return await transport('encrypt_file', { path, password });
  }

  static async decryptFile(path: string, password: string): Promise<string> {
    return await transport('decrypt_file', { path, password });
  }

  static async isEncryptedFile(path: string): Promise<boolean> {
    return await transport('is_encrypted_file', { path });
  }

  static async secureDelete(
    paths: string[],
    passes: number = 3,
  ): Promise<{ files_deleted: number; errors: string[]; passes: number }> {
    return await transport('secure_delete', { paths, passes });
  }

  static async copy(source: string, destination: string): Promise<void> {
    return await transport('copy', { source, destination });
  }

  static async moveFile(source: string, destination: string): Promise<void> {
    return await transport('move_file', { source, destination });
  }

  static async rename(oldPath: string, newPath: string): Promise<void> {
    return await transport('rename', { oldPath, newPath });
  }

  static async bulkRename(
    files: string[],
    pattern: string,
    replacement: string,
    previewOnly: boolean,
  ): Promise<BulkRenameResult[]> {
    return await transport('bulk_rename', { files, pattern, replacement, previewOnly });
  }

  static async removeDir(path: string): Promise<void> {
    return await transport('remove_dir', { path });
  }

  static async removeFile(path: string): Promise<void> {
    return await transport('remove_file', { path });
  }

  // Trash/Recycle Bin operations
  static async moveToTrash(path: string): Promise<void> {
    return await transport('move_to_trash', { path });
  }

  static async openRecycleBin(): Promise<void> {
    return await transport('open_recycle_bin');
  }

  static async getTrashItems(): Promise<TrashItem[]> {
    return await transport('get_trash_items');
  }

  static async restoreFromTrash(itemPath: string): Promise<string> {
    return await transport('restore_trash_item', { itemPath });
  }

  static async emptyTrash(): Promise<number> {
    return await transport('empty_recycle_bin');
  }

  static async permanentlyDeleteFromTrash(itemPath: string): Promise<void> {
    return await transport('permanently_delete_trash_item', { itemPath });
  }

  static async isDir(path: string): Promise<boolean> {
    return await transport('is_dir', { path });
  }

  static async getFilesInDirectory(path: string): Promise<FileEntry[]> {
    return await transport('get_files_in_directory', { path });
  }

  static async openFile(path: string): Promise<void> {
    return await transport('open_file', { path });
  }

  static async fileExists(path: string): Promise<boolean> {
    return await transport('file_exist', { path });
  }

  static async createDirRecursive(path: string): Promise<void> {
    return await transport('create_dir_recursive', { path });
  }

  static async createFile(path: string): Promise<void> {
    return await transport('create_file', { path });
  }

  static async createFileWithContent(path: string, content: string): Promise<void> {
    return await transport('create_file_with_content', { path, content });
  }

  static async createSymlink(target: string, linkPath: string): Promise<void> {
    return await transport('create_symlink', { target, link_path: linkPath });
  }

  static async openInTerminal(path: string): Promise<void> {
    return await transport('open_in_terminal', { path });
  }

  static async getDirSize(path: string): Promise<DirectorySize> {
    return await transport('get_dir_size', { path });
  }

  // Terminal operations
  static async executeCommand(
    command: string,
    workingDir: string,
  ): Promise<{
    stdout: string;
    stderr: string;
    exit_code: number;
  }> {
    return await transport('execute_command', { command, workingDir });
  }

  static async executeCommandStream(command: string, workingDir: string): Promise<void> {
    return await transport('execute_command_stream', { command, workingDir });
  }

  static async getCurrentShell(): Promise<string> {
    return await transport('get_current_shell');
  }

  // Search operations
  static async findFiles(pattern: string, searchPath: string): Promise<string[]> {
    return await transport('find_files', { pattern, searchPath });
  }

  static async searchInFiles(
    pattern: string,
    searchPath: string,
  ): Promise<
    {
      file: string;
      line: number;
      content: string;
    }[]
  > {
    return await transport('search_in_files', { pattern, searchPath });
  }

  // Folder size operations
  static async calculateFolderSize(folderPath: string): Promise<FolderSizeInfo> {
    return await transport('calculate_folder_size', { folderPath });
  }

  static async getCachedFolderSizes(
    folderPaths: string[],
  ): Promise<Record<string, FolderSizeInfo>> {
    return await transport('get_cached_folder_sizes', { folderPaths });
  }

  static async clearFolderSizeCache(): Promise<void> {
    return await transport('clear_folder_size_cache');
  }

  // Event listener operations
  static async listenToTerminalOutput(callback: (message: string) => void): Promise<() => void> {
    return transportListen<string>('terminal-output', callback);
  }

  static async listenToEvent<T>(
    eventName: string,
    callback: (payload: T) => void,
  ): Promise<() => void> {
    return transportListen<T>(eventName, callback);
  }

  // Window operations
  static async getAppVersion(): Promise<string> {
    return await transport('get_app_version');
  }

  static async getSystemInfo(): Promise<{
    os: string;
    arch: string;
    version: string;
    hostname: string;
  }> {
    return await transport('get_system_info');
  }

  // AI-powered rename suggestions
  static async suggestFilename(filePath: string): Promise<string[]> {
    return await transport('suggest_filename', { filePath });
  }

  // AI-powered auto-tagging by content
  static async autoTagFiles(filePaths: string[]): Promise<[string, string[]][]> {
    return await transport('auto_tag_files', { filePaths });
  }

  // Undo/Redo file operations
  static async undoOperation(): Promise<{
    success: boolean;
    message: string;
    operation_type: string;
  }> {
    return await transport('undo_operation');
  }

  static async redoOperation(): Promise<{
    success: boolean;
    message: string;
    operation_type: string;
  }> {
    return await transport('redo_operation');
  }

  static async getUndoHistory(): Promise<{
    entries: {
      index: number;
      operation_type: string;
      description: string;
      undoable: boolean;
      timestamp_ms: number;
      source_path: string | null;
      dest_path: string | null;
    }[];
    undo_count: number;
  }> {
    return await transport('get_undo_history');
  }

  static async clearUndoHistory(): Promise<void> {
    return await transport('clear_undo_history');
  }

  // File templates
  static async getFileTemplates(): Promise<
    { id: string; name: string; default_filename: string; extension: string; description: string }[]
  > {
    return await transport('get_file_templates');
  }

  static async createFromTemplate(
    directory: string,
    templateId: string,
    filename: string,
  ): Promise<string> {
    return await transport('create_from_template', { directory, templateId, filename });
  }

  // Disk usage treemap
  static async getDirectorySizes(
    dirPath: string,
  ): Promise<
    { name: string; path: string; size: number; is_dir: boolean; children_count: number }[]
  > {
    return await transport('get_directory_sizes', { dirPath });
  }

  static async checkConflicts(sources: string[], destinationDir: string): Promise<ConflictInfo[]> {
    return await transport('check_conflicts', { sources, destinationDir });
  }

  static async getRenameDest(destinationDir: string, fileName: string): Promise<string> {
    return await transport('get_rename_destination', { destinationDir, fileName });
  }

  static async showInFolder(path: string): Promise<void> {
    return await transport('show_in_folder', { path });
  }

  static async listDrives(): Promise<
    {
      letter: string;
      label: string;
      path: string;
      total_space: number;
      free_space: number;
    }[]
  > {
    return await transport('list_drives');
  }

  // AI operations
  static async getAiModels(): Promise<
    {
      id: string;
      name: string;
      provider: string;
      available: boolean;
    }[]
  > {
    return await transport('get_ai_models');
  }

  static async checkOllamaStatus(): Promise<boolean> {
    return await transport('check_ollama_status');
  }

  static async chatWithAI(
    model: string,
    messages: { role: string; content: string }[],
    fileContext?: { name: string; path: string; file_type: string; content?: string } | null,
  ): Promise<string> {
    return await transport('chat_with_ai', {
      model,
      messages,
      fileContext: fileContext || null,
    });
  }

  static async analyzeFileWithAI(
    model: string,
    fileContext: { name: string; path: string; file_type: string; content?: string },
  ): Promise<string> {
    return await transport('analyze_file_with_ai', {
      model,
      fileContext,
    });
  }

  static async getFileHelp(model: string, fileName: string, fileType: string): Promise<string> {
    return await transport('get_file_help', {
      model,
      fileName,
      fileType,
    });
  }

  // User directory operations
  static async getUserDirectories(): Promise<{
    home: string;
    documents: string;
    downloads: string;
    desktop: string;
    pictures: string;
    videos: string;
    music: string;
  }> {
    return await transport('get_user_directories');
  }

  static async getRecentFolders(): Promise<string[]> {
    return await transport('get_recent_folders');
  }

  static async addToRecentFolders(path: string): Promise<void> {
    return await transport('add_to_recent_folders', { path });
  }

  static async readTextFile(path: string): Promise<string> {
    return await transport('read_text_file', { path });
  }

  static async readBinaryFile(path: string): Promise<Uint8Array> {
    const data = await transport('read_binary_file', { path });
    return new Uint8Array(data as number[]);
  }

  // AI Agent operations
  static async agentReadFileTree(
    rootPath: string,
    maxRecursion?: number,
    includeContent?: boolean,
  ): Promise<{ tree: FileSystemNode; progress: AgentProgress[] }> {
    const result = await transport('agent_read_file_tree', {
      rootPath,
      maxRecursion: maxRecursion || 10,
      includeContent: includeContent !== false,
    });
    const [tree, progress] = result as [FileSystemNode, AgentProgress[]];
    return { tree, progress };
  }

  static async agentRequestWritePermission(
    filePath: string,
    content: string,
    reason: string,
  ): Promise<string> {
    return await transport('agent_request_write_permission', { filePath, content, reason });
  }

  static async agentWriteFileWithPermission(
    filePath: string,
    content: string,
    permissionGranted: boolean,
  ): Promise<void> {
    return await transport('agent_write_file_with_permission', {
      filePath,
      content,
      permissionGranted,
    });
  }

  // Claude Agent operations
  static async agentRespondApproval(toolCallId: string, approved: boolean): Promise<void> {
    return await transport('agent_respond_approval', { toolCallId, approved });
  }

  static async agentCancelSession(sessionId: string): Promise<void> {
    return await transport('agent_cancel_session', { sessionId });
  }

  static async getAgentSettings(): Promise<AgentSettings> {
    return await transport('get_agent_settings');
  }

  static async updateAgentSettings(settings: AgentSettings): Promise<void> {
    return await transport('update_agent_settings', { settings });
  }

  // ═══════════════════════════════════════════
  // Google Drive Operations
  // ═══════════════════════════════════════════

  static async gdriveAuthenticate(): Promise<{
    id: string;
    email: string;
    display_name: string;
  }> {
    return await transport('gdrive_authenticate');
  }

  static async gdriveDisconnect(accountId: string): Promise<void> {
    return await transport('gdrive_disconnect', { accountId });
  }

  static async gdriveListAccounts(): Promise<
    Array<{
      id: string;
      email: string;
      display_name: string;
    }>
  > {
    return await transport('gdrive_list_accounts');
  }

  static async gdriveListFiles(accountId: string, folderId: string): Promise<FileEntry[]> {
    return await transport('gdrive_list_files', { accountId, folderId });
  }

  static async gdriveDownloadFile(
    accountId: string,
    fileId: string,
    localPath: string,
  ): Promise<void> {
    return await transport('gdrive_download_file', { accountId, fileId, localPath });
  }

  static async gdriveUploadFile(
    accountId: string,
    localPath: string,
    parentFolderId: string,
  ): Promise<FileEntry> {
    return await transport('gdrive_upload_file', { accountId, localPath, parentFolderId });
  }

  static async gdriveDeleteFile(accountId: string, fileId: string): Promise<void> {
    return await transport('gdrive_delete_file', { accountId, fileId });
  }

  static async gdriveRenameFile(accountId: string, fileId: string, newName: string): Promise<void> {
    return await transport('gdrive_rename_file', { accountId, fileId, newName });
  }

  static async gdriveMoveFile(
    accountId: string,
    fileId: string,
    newParentId: string,
    oldParentId: string,
  ): Promise<void> {
    return await transport('gdrive_move_file', { accountId, fileId, newParentId, oldParentId });
  }

  static async gdriveCreateFolder(
    accountId: string,
    name: string,
    parentFolderId: string,
  ): Promise<FileEntry> {
    return await transport('gdrive_create_folder', { accountId, name, parentFolderId });
  }

  static async gdriveGetFileContent(accountId: string, fileId: string): Promise<string> {
    return await transport('gdrive_get_file_content', { accountId, fileId });
  }

  static async getGdriveSettings(): Promise<{ client_id: string; client_secret: string }> {
    return await transport('get_gdrive_settings');
  }

  static async updateGdriveSettings(clientId: string, clientSecret: string): Promise<void> {
    return await transport('update_gdrive_settings', { clientId, clientSecret });
  }

  // Tokenizer operations
  static async setTokenizerSettings(settings: TokenizerSettings): Promise<void> {
    return await transport('set_tokenizer_settings', { settings });
  }

  static async getTokenizerSettings(): Promise<TokenizerSettings> {
    return await transport('get_tokenizer_settings');
  }

  static async rebuildTokenIndex(): Promise<void> {
    return await transport('rebuild_token_index');
  }

  static async searchTokens(query: string, limit?: number): Promise<SearchResult[]> {
    return await transport('search_tokens', { query, limit: limit || null });
  }

  static async naturalLanguageSearch(
    query: string,
    language?: string,
    limit?: number,
  ): Promise<SearchResult[]> {
    return await transport('natural_language_search', { query, language, limit });
  }

  static async getTokenizerStats(): Promise<TokenIndex | null> {
    return await transport('get_tokenizer_stats');
  }

  static async isTokenizerIndexing(): Promise<boolean> {
    return await transport('is_tokenizer_indexing');
  }

  static async getFileTokens(filePath: string): Promise<FileToken | null> {
    return await transport('get_file_tokens', { filePath });
  }

  static async addPathToTokenizer(path: string): Promise<void> {
    return await transport('add_path_to_tokenizer', { path });
  }

  static async getFileRecommendations(filePath: string, limit?: number): Promise<SearchResult[]> {
    return await transport('get_file_recommendations', { filePath, limit });
  }

  // Auto-index a directory (called on navigation)
  static async indexDirectory(path: string, maxDepth?: number): Promise<void> {
    return await transport('index_directory', { path, maxDepth: maxDepth || null });
  }

  // Set search context path for ranking boost
  static async setSearchContext(path: string): Promise<void> {
    return await transport('set_search_context', { path });
  }

  // Add a path to whitelisted directories (for auto-whitelist on navigation)
  static async addWhitelistedPath(path: string): Promise<void> {
    return await transport('add_whitelisted_path', { path });
  }

  // AI-powered search re-ranking
  static async aiSearch(
    query: string,
    provider: string,
    apiKey?: string,
    model?: string,
    limit?: number,
  ): Promise<AISearchResult> {
    return await transport('ai_search', {
      query,
      provider,
      apiKey: apiKey || null,
      model: model || null,
      limit: limit || null,
    });
  }

  // Phase 1: Parse search query into structured form
  static async parseSearchQuery(query: string, language?: string): Promise<StructuredQuery> {
    return await transport('parse_search_query', { query, language: language || null });
  }

  // Phase 1: Enhanced search with structured query info
  static async enhancedSearch(
    query: string,
    language?: string,
    limit?: number,
  ): Promise<EnhancedSearchResult> {
    return await transport('enhanced_search', {
      query,
      language: language || null,
      limit: limit || null,
    });
  }

  // Phase 3: AI Index operations
  static async getAIIndexStatus(): Promise<AIIndexStatus> {
    return await transport('get_ai_index_status');
  }

  static async triggerAIIndexing(
    paths: string[],
    provider?: 'ollama' | 'claude' | 'openai',
    apiKey?: string,
    model?: string,
  ): Promise<void> {
    return await transport('trigger_ai_indexing', {
      paths,
      provider: provider || null,
      apiKey: apiKey || null,
      model: model || null,
    });
  }

  static async getAIIndexEntry(path: string): Promise<AIIndexEntry | null> {
    return await transport('get_ai_index_entry', { path });
  }

  // Phase 4: Semantic search
  static async semanticSearch(query: string, limit?: number): Promise<SearchResult[]> {
    return await transport('semantic_search', { query, limit: limit || null });
  }

  // Phase 4: Find similar files
  static async findSimilarFiles(filePath: string, limit?: number): Promise<SearchResult[]> {
    return await transport('find_similar_files', { filePath, limit: limit || null });
  }

  // Shortcut operations
  static async getShortcuts(): Promise<ShortcutBinding[]> {
    return await transport('get_shortcuts');
  }

  static async getShortcutsByCategory(category: string): Promise<ShortcutBinding[]> {
    return await transport('get_shortcuts_by_category', { category });
  }

  static async addShortcut(binding: ShortcutBinding): Promise<void> {
    return await transport('add_shortcut', { shortcut: binding });
  }

  static async updateShortcut(binding: ShortcutBinding): Promise<void> {
    return await transport('update_shortcut', { binding });
  }

  static async removeShortcut(shortcutId: string): Promise<void> {
    return await transport('remove_shortcut', { shortcutId });
  }

  static async getShortcutProfiles(): Promise<string[]> {
    return await transport('get_shortcut_profiles');
  }

  static async switchShortcutProfile(profileId: string): Promise<void> {
    return await transport('switch_shortcut_profile', { profileId });
  }

  static async getShortcutSettings(): Promise<ShortcutSettings> {
    return await transport('get_shortcut_settings');
  }

  static async updateShortcutSettings(settings: ShortcutSettings): Promise<void> {
    return await transport('update_shortcut_settings', { settings });
  }

  static async executeShortcutAction(
    keyCombination: string,
    context: string,
  ): Promise<ShortcutAction | null> {
    if (!keyCombination) return null;
    return await transport('execute_shortcut_action', { keyCombination, context });
  }

  static async registerExtensionShortcut(
    extensionId: string,
    shortcutId: string,
    name: string,
    description: string | null,
    keyCombination: ShortcutKey,
    action: string,
    context: string[],
  ): Promise<void> {
    return await transport('register_extension_shortcut', {
      extensionId,
      shortcutId,
      name,
      description,
      keyCombination,
      action,
      context,
    });
  }

  static async unregisterExtensionShortcuts(extensionId: string): Promise<void> {
    return await transport('unregister_extension_shortcuts', { extensionId });
  }

  static async registerGlobalShortcuts(): Promise<void> {
    return await transport('register_global_shortcuts');
  }

  static async unregisterGlobalShortcuts(): Promise<void> {
    return await transport('unregister_global_shortcuts');
  }

  static async toggleGlobalShortcuts(enabled: boolean): Promise<void> {
    return await transport('toggle_global_shortcuts', { enabled });
  }

  static async resetShortcuts(profileId?: string): Promise<void> {
    return await transport('reset_shortcuts', { profileId: profileId ?? null });
  }

  static async resetSingleShortcut(shortcutId: string): Promise<ShortcutBinding> {
    return await transport('reset_single_shortcut', { shortcutId });
  }

  // Duplicate finder operations
  static async findDuplicates(
    rootPath: string,
    minFileSize?: number,
    maxFileSize?: number,
    includeHidden?: boolean,
    fileExtensions?: string[],
    excludePaths?: string[],
  ): Promise<DuplicateFinderResult> {
    return await transport('find_duplicates', {
      rootPath,
      minFileSize,
      maxFileSize,
      includeHidden,
      fileExtensions,
      excludePaths,
    });
  }

  static async deleteDuplicateFiles(filePaths: string[]): Promise<string[]> {
    return await transport('delete_duplicate_files', { filePaths });
  }

  static async moveDuplicateFilesToTrash(filePaths: string[]): Promise<string[]> {
    return await transport('move_duplicate_files_to_trash', { filePaths });
  }

  static async cancelDuplicateScan(): Promise<void> {
    return await transport('cancel_duplicate_scan');
  }

  // Git history operations
  static async findGitRepository(path: string): Promise<string | null> {
    return await transport('find_git_repository', { path });
  }

  static async getRepositoryInfo(repoPath: string): Promise<GitRepositoryInfo> {
    return await transport('get_repository_info', { repoPath });
  }

  static async getFileHistory(
    repoPath: string,
    filePath: string,
    limit?: number,
  ): Promise<GitFileHistory> {
    return await transport('get_file_history', { repoPath, filePath, limit });
  }

  static async getFileBlame(repoPath: string, filePath: string): Promise<GitFileBlame> {
    return await transport('get_file_blame', { repoPath, filePath });
  }

  static async getFileDiff(
    repoPath: string,
    filePath: string,
    commitHash?: string,
  ): Promise<GitDiff> {
    return await transport('get_file_diff', { repoPath, filePath, commitHash });
  }

  static async getCommitDiff(repoPath: string, commitHash: string): Promise<GitDiff[]> {
    return await transport('get_commit_diff', { repoPath, commitHash });
  }

  static async getAllCommits(
    repoPath: string,
    limit?: number,
    branch?: string,
  ): Promise<GitCommit[]> {
    return await transport('get_all_commits', { repoPath, limit, branch });
  }

  // Enhanced Git operations
  static async getFileStatus(repoPath: string): Promise<
    Array<{
      path: string;
      status: string;
      old_path?: string;
    }>
  > {
    return await transport('get_file_status', { repoPath });
  }

  static async getBranches(repoPath: string): Promise<
    Array<{
      name: string;
      is_current: boolean;
      is_remote: boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- consumers define incompatible GitBranch types
      last_commit?: any;
      upstream?: string;
      ahead: number;
      behind: number;
    }>
  > {
    return await transport('get_branches', { repoPath });
  }

  static async createBranch(
    repoPath: string,
    branchName: string,
    fromCommit?: string,
  ): Promise<void> {
    return await transport('create_branch', { repoPath, branchName, fromCommit });
  }

  static async switchBranch(repoPath: string, branchName: string): Promise<void> {
    return await transport('switch_branch', { repoPath, branchName });
  }

  static async deleteBranch(
    repoPath: string,
    branchName: string,
    force: boolean = false,
  ): Promise<void> {
    return await transport('delete_branch', { repoPath, branchName, force });
  }

  static async stageFile(repoPath: string, filePath: string): Promise<void> {
    return await transport('stage_file', { repoPath, filePath });
  }

  static async unstageFile(repoPath: string, filePath: string): Promise<void> {
    return await transport('unstage_file', { repoPath, filePath });
  }

  static async commitChanges(
    repoPath: string,
    message: string,
    amend: boolean = false,
  ): Promise<string> {
    return await transport('commit_changes', { repoPath, message, amend });
  }

  static async getStashes(repoPath: string): Promise<
    Array<{
      index: number;
      message: string;
      branch: string;
      timestamp: number;
      files_changed: string[];
    }>
  > {
    return await transport('get_stashes', { repoPath });
  }

  static async createStash(
    repoPath: string,
    message?: string,
    includeUntracked: boolean = false,
  ): Promise<void> {
    return await transport('create_stash', { repoPath, message, includeUntracked });
  }

  static async applyStash(
    repoPath: string,
    stashIndex: number,
    pop: boolean = false,
  ): Promise<void> {
    return await transport('apply_stash', { repoPath, stashIndex, pop });
  }

  static async dropStash(repoPath: string, stashIndex: number): Promise<void> {
    return await transport('drop_stash', { repoPath, stashIndex });
  }

  // Progress-aware File Operations
  static async copyWithProgress(source: string, destination: string): Promise<string> {
    return await transport('copy_with_progress', { source, destination });
  }

  static async moveWithProgress(source: string, destination: string): Promise<string> {
    return await transport('move_with_progress', { source, destination });
  }

  // Hardware-Accelerated File Operations
  static async acceleratedCopyFile(source: string, destination: string): Promise<string> {
    return await transport('accelerated_copy_file', { source, destination });
  }

  static async acceleratedCopyDirectory(source: string, destination: string): Promise<string> {
    return await transport('accelerated_copy_directory', { source, destination });
  }

  // Progress monitoring for operations
  static async listenToFileOperationProgress(
    callback: (progress: FileOperationProgress) => void,
  ): Promise<() => void> {
    return transportListen<FileOperationProgress>('file-operation-progress', callback);
  }

  // File comparison methods (Rust uses camelCase serialization for these structs)
  // See comparison_ops.rs: #[serde(rename_all = "camelCase")]
  static async computeFileHash(path: string, algorithm: string = 'sha256'): Promise<string> {
    return await transport('compute_file_hash', { path, algorithm });
  }

  static async compareFiles(
    file1Path: string,
    file2Path: string,
    options?: { ignoreWhitespace?: boolean; contextLines?: number },
  ): Promise<FileComparisonResult> {
    return await transport('compare_files', {
      file1Path,
      file2Path,
      options: options || null,
    });
  }

  // File Organizer operations
  static async analyzeDirectory(path: string): Promise<OrganizationAnalysis> {
    return await transport('analyze_directory', { path });
  }

  static async previewOrganization(
    path: string,
    suggestionIndices: number[],
  ): Promise<OrganizationPlan> {
    return await transport('preview_organization', { path, suggestionIndices });
  }

  static async executeOrganization(plan: OrganizationPlan): Promise<number> {
    return await transport('execute_organization', { plan });
  }

  // Recent files operations
  static async addRecentFile(path: string): Promise<void> {
    return await transport('add_recent_file', { path });
  }

  static async getRecentFiles(limit?: number): Promise<RecentFile[]> {
    return await transport('get_recent_files', { limit: limit ?? null });
  }

  static async clearRecentFiles(): Promise<void> {
    return await transport('clear_recent_files');
  }

  static async removeRecentFile(path: string): Promise<void> {
    return await transport('remove_recent_file', { path });
  }

  // Bookmark operations
  static async getBookmarks(): Promise<BookmarkEntry[]> {
    return await transport('get_bookmarks');
  }

  static async addBookmark(path: string, name: string): Promise<BookmarkEntry> {
    return await transport('add_bookmark', { path, name });
  }

  static async removeBookmark(path: string): Promise<void> {
    return await transport('remove_bookmark', { path });
  }

  static async updateBookmarkName(path: string, name: string): Promise<void> {
    return await transport('update_bookmark_name', { path, name });
  }

  // Storage Analytics
  static async analyzeStorage(path: string): Promise<StorageAnalytics> {
    return await transport('analyze_storage', { path });
  }

  // Directory Diagnostics
  static async diagnoseDirectory(
    path: string,
    skipHidden = true,
    skipGitignored = true,
  ): Promise<DiagnosisResult> {
    return await transport('diagnose_directory', { path, skipHidden, skipGitignored });
  }

  // File Tags operations
  static async getFileTags(path: string): Promise<FileTag[]> {
    return await transport('get_file_tags', { path });
  }

  static async setFileTags(path: string, tags: FileTag[]): Promise<void> {
    return await transport('set_file_tags', { path, tags });
  }

  static async getAllFileTags(): Promise<FileTag[]> {
    return await transport('get_all_file_tags');
  }

  static async getFileTagsBatch(paths: string[]): Promise<Record<string, FileTag[]>> {
    return await transport('get_file_tags_batch', { paths });
  }

  static async removeAllTagsFromFile(path: string): Promise<void> {
    return await transport('remove_all_tags_from_file', { path });
  }

  static async removeTagGlobally(tagName: string): Promise<void> {
    return await transport('remove_tag_globally', { tagName });
  }

  // Batch tag operations
  static async batchAddTags(paths: string[], tags: FileTag[]): Promise<void> {
    return await transport('batch_add_tags', { paths, tags });
  }

  static async batchRemoveTags(paths: string[], tagNames: string[]): Promise<void> {
    return await transport('batch_remove_tags', { paths, tagNames });
  }

  // File Notes operations
  static async getFileNotes(path: string): Promise<FileNote[]> {
    return await transport('get_file_notes', { path });
  }

  static async addFileNote(path: string, title: string, content: string): Promise<FileNote> {
    return await transport('add_file_note', { path, title, content });
  }

  static async updateFileNote(
    path: string,
    noteId: string,
    title: string,
    content: string,
  ): Promise<void> {
    return await transport('update_file_note', { path, noteId, title, content });
  }

  static async deleteFileNote(path: string, noteId: string): Promise<void> {
    return await transport('delete_file_note', { path, noteId });
  }

  static async getAllNotes(): Promise<Record<string, FileNote[]>> {
    return await transport('get_all_notes');
  }

  static async searchNotes(query: string): Promise<NoteSearchResult[]> {
    return await transport('search_notes', { query });
  }

  // Batch notes operations
  static async batchSetNotes(
    paths: string[],
    title: string,
    content: string,
    mode: 'replace' | 'append',
  ): Promise<void> {
    return await transport('batch_set_notes', { paths, title, content, mode });
  }

  // File Annotations operations
  static async getFileAnnotations(path: string): Promise<FileAnnotation[]> {
    return await transport('get_file_annotations', { path });
  }

  static async addFileAnnotation(path: string, text: string): Promise<FileAnnotation> {
    return await transport('add_file_annotation', { path, text });
  }

  static async toggleAnnotationResolved(path: string, annotationId: string): Promise<void> {
    return await transport('toggle_annotation_resolved', { path, annotationId });
  }

  static async deleteFileAnnotation(path: string, annotationId: string): Promise<void> {
    return await transport('delete_file_annotation', { path, annotationId });
  }

  static async getAllAnnotations(): Promise<Record<string, FileAnnotation[]>> {
    return await transport('get_all_annotations');
  }

  // Tag Categories operations
  static async getTagCategories(): Promise<TagCategory[]> {
    return await transport('get_tag_categories');
  }

  static async addTagCategory(
    name: string,
    color: string,
    parentId?: string,
  ): Promise<TagCategory> {
    return await transport('add_tag_category', { name, color, parentId: parentId ?? null });
  }

  static async updateTagCategory(
    id: string,
    name?: string,
    color?: string,
    parentId?: string,
  ): Promise<void> {
    return await transport('update_tag_category', {
      id,
      name: name ?? null,
      color: color ?? null,
      parentId: parentId ?? null,
    });
  }

  static async deleteTagCategory(id: string): Promise<void> {
    return await transport('delete_tag_category', { id });
  }

  // Custom Metadata operations
  static async getFileMetadata(path: string): Promise<CustomMetadataField[]> {
    return await transport('get_file_metadata', { path });
  }

  static async setFileMetadata(path: string, fields: CustomMetadataField[]): Promise<void> {
    return await transport('set_file_metadata', { path, fields });
  }

  static async getAllMetadataKeys(): Promise<string[]> {
    return await transport('get_all_metadata_keys');
  }

  // Extension-scoped storage
  static async getExtensionStorage(extensionId: string, key: string): Promise<unknown> {
    return await transport('get_extension_storage', { extensionId, key });
  }

  static async setExtensionStorage(
    extensionId: string,
    key: string,
    value: unknown,
  ): Promise<void> {
    return await transport('set_extension_storage', { extensionId, key, value });
  }

  static async deleteExtensionStorage(extensionId: string, key: string): Promise<void> {
    return await transport('delete_extension_storage', { extensionId, key });
  }

  // Extension management
  static async getInstalledExtensions(): Promise<ExtensionPackageInfo[]> {
    return await transport('get_installed_extensions');
  }

  static async installExtensionFromPath(extensionPath: string): Promise<ExtensionPackageInfo> {
    return await transport('install_extension_from_path', { extensionPath });
  }

  static async uninstallExtensionById(extensionId: string): Promise<void> {
    return await transport('uninstall_extension_by_id', { extensionId });
  }

  static async activateExtension(extensionId: string): Promise<void> {
    return await transport('activate_extension', { extensionId });
  }

  static async deactivateExtension(extensionId: string): Promise<void> {
    return await transport('deactivate_extension', { extensionId });
  }

  static async getActiveExtensionIds(): Promise<string[]> {
    return await transport('get_active_extension_ids');
  }

  static async getExtensionPermissions(extensionId: string): Promise<string[]> {
    return await transport('get_extension_permissions', { extensionId });
  }

  static async validateExtensionPath(extensionPath: string): Promise<ExtensionManifestInfo> {
    return await transport('validate_extension_path', { extensionPath });
  }

  static async downloadAndInstallExtension(
    downloadUrl: string,
    extensionId: string,
    expectedChecksum?: string,
  ): Promise<ExtensionPackageInfo> {
    return await transport('download_and_install_extension', {
      downloadUrl,
      extensionId,
      expectedChecksum: expectedChecksum || null,
    });
  }

  // .xtension file operations
  static async packExtension(extensionDir: string, outputPath?: string): Promise<string> {
    return await transport('pack_extension', { extensionDir, outputPath: outputPath || null });
  }

  static async installXtensionFile(xtensionPath: string): Promise<ExtensionPackageInfo> {
    return await transport('install_xtension_file', { xtensionPath });
  }

  static async inspectXtensionFile(xtensionPath: string): Promise<ExtensionManifestInfo> {
    return await transport('inspect_xtension_file', { xtensionPath });
  }

  static async nativePluginInvoke(
    pluginId: string,
    command: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    return await transport('native_plugin_invoke', { pluginId, command, args });
  }

  static async extensionBackendCall(
    extensionId: string,
    method: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    return await transport('extension_backend_call', {
      extensionId,
      method,
      args: JSON.stringify(args),
    });
  }

  static async extensionBackendStatus(extensionId: string): Promise<{ loaded: boolean }> {
    return await transport('extension_backend_status', { extensionId });
  }

  static async checkForExtensionUpdates(
    marketplaceUrl: string,
    installedExtensions: Array<{ id: string; version: string }>,
  ): Promise<
    Array<{
      id: string;
      current_version: string;
      latest_version: string;
      download_url: string;
      checksum: string;
      changelog?: string;
    }>
  > {
    return await transport('check_for_extension_updates', {
      marketplaceUrl,
      installedExtensions,
    });
  }

  static async downloadExtensionUpdate(
    extensionId: string,
    downloadUrl: string,
    checksum?: string,
  ): Promise<string> {
    return await transport('download_extension_update', {
      extensionId,
      downloadUrl,
      checksum,
    });
  }

  // File watcher operations
  static async startWatching(path: string): Promise<void> {
    return await transport('start_watching', { path });
  }

  static async stopWatching(): Promise<void> {
    return await transport('stop_watching');
  }

  static async watchDirectory(path: string, recursive: boolean = false): Promise<string> {
    return await transport('watch_directory', { path, recursive });
  }

  static async unwatchDirectory(watcherId: string): Promise<void> {
    return await transport('unwatch_directory', { watcherId });
  }

  static async getActiveWatchers(): Promise<
    Array<{ id: string; path: string; recursive: boolean }>
  > {
    return await transport('get_active_watchers');
  }

  // Git integration
  static async getGitStatus(directory: string): Promise<GitFileStatus[]> {
    return await transport('get_git_status', { directory });
  }

  static async getGitRepoInfo(directory: string): Promise<GitRepoInfo> {
    return await transport('get_git_repo_info', { directory });
  }

  static async showOpenDialog(options: {
    multiple?: boolean;
    directory?: boolean;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string[] | null> {
    try {
      // Use Tauri dialog plugin
      const { open } = await import('@tauri-apps/plugin-dialog');

      const result = await open({
        multiple: options.multiple || false,
        directory: options.directory || false,
        filters: options.filters || [],
      });

      if (result === null) return null;

      return Array.isArray(result) ? result : [result];
    } catch (error) {
      console.error('Error opening dialog:', error);
      return null;
    }
  }

  // Chat history operations
  static async getChatSessions(): Promise<ChatSessionSummary[]> {
    return await transport('get_chat_sessions');
  }

  static async getChatSession(sessionId: string): Promise<ChatSession | null> {
    return await transport('get_chat_session', { sessionId });
  }

  static async saveChatSession(session: ChatSession): Promise<void> {
    return await transport('save_chat_session', { session });
  }

  static async deleteChatSession(sessionId: string): Promise<void> {
    return await transport('delete_chat_session', { sessionId });
  }

  static async clearChatHistory(): Promise<void> {
    return await transport('clear_chat_history');
  }

  // Chat-as-Files operations
  static async getChatsDirectory(): Promise<string> {
    return await transport('get_chats_directory');
  }

  static async createChatFile(directory: string, title?: string): Promise<string> {
    return await transport('create_chat_file', { directory, title: title || null });
  }

  static async readChatFile(path: string): Promise<ChatFileData> {
    return await transport('read_chat_file', { path });
  }

  static async saveChatFile(path: string, data: ChatFileData): Promise<void> {
    return await transport('save_chat_file', { path, data });
  }

  static async getChatFileSummary(path: string): Promise<ChatFileSummary> {
    return await transport('get_chat_file_summary', { path });
  }

  // SQLite database operations
  static async listSqliteTables(path: string): Promise<SqliteTableInfo[]> {
    return await transport('list_sqlite_tables', { path });
  }

  static async getSqliteTableColumns(path: string, table: string): Promise<SqliteColumnInfo[]> {
    return await transport('get_sqlite_table_columns', { path, table });
  }

  static async querySqliteTable(
    path: string,
    table: string,
    limit: number,
    offset: number,
  ): Promise<SqliteQueryResult> {
    return await transport('query_sqlite_table', { path, table, limit, offset });
  }

  static async executeSqliteQuery(path: string, query: string): Promise<SqliteQueryResult> {
    return await transport('execute_sqlite_query', { path, query });
  }

  // Image processing operations
  static async resizeImage(
    path: string,
    width: number,
    height: number,
    maintainAspect: boolean,
    outputPath: string,
  ): Promise<string> {
    return await transport('resize_image', { path, width, height, maintainAspect, outputPath });
  }

  static async convertImage(
    path: string,
    outputFormat: string,
    quality: number,
    outputPath: string,
  ): Promise<string> {
    return await transport('convert_image', { path, outputFormat, quality, outputPath });
  }

  static async getImageInfo(path: string): Promise<ImageInfo> {
    return await transport('get_image_info', { path });
  }

  static async batchProcessImages(
    paths: string[],
    operations: ImageOperations,
    outputDir: string,
  ): Promise<BatchImageResult[]> {
    return await transport('batch_process_images', { paths, operations, outputDir });
  }

  static async rotateImage(path: string, degrees: number, outputPath: string): Promise<string> {
    return await transport('rotate_image', { path, degrees, outputPath });
  }

  static async flipImage(path: string, direction: string, outputPath: string): Promise<string> {
    return await transport('flip_image', { path, direction, outputPath });
  }

  static async cropImage(
    path: string,
    x: number,
    y: number,
    width: number,
    height: number,
    outputPath: string,
  ): Promise<string> {
    return await transport('crop_image', { path, x, y, width, height, outputPath });
  }

  static async adjustBrightness(path: string, value: number, outputPath: string): Promise<string> {
    return await transport('adjust_brightness', { path, value, outputPath });
  }

  static async adjustContrast(path: string, value: number, outputPath: string): Promise<string> {
    return await transport('adjust_contrast', { path, value, outputPath });
  }

  static async grayscaleImage(path: string, outputPath: string): Promise<string> {
    return await transport('grayscale_image', { path, outputPath });
  }

  // Backup operations
  static async createBackup(
    sourceDir: string,
    backupDir: string,
    name: string,
  ): Promise<BackupManifest> {
    return await transport('create_backup', { sourceDir, backupDir, name });
  }

  static async listBackups(backupDir: string, name: string): Promise<BackupManifest[]> {
    return await transport('list_backups', { backupDir, name });
  }

  static async restoreBackup(
    backupId: string,
    backupDir: string,
    name: string,
    restoreTo: string,
  ): Promise<void> {
    return await transport('restore_backup', { backupId, backupDir, name, restoreTo });
  }

  static async deleteBackup(backupId: string, backupDir: string, name: string): Promise<void> {
    return await transport('delete_backup', { backupId, backupDir, name });
  }

  // Audit log operations
  static async getAuditLog(
    limit?: number,
    offset?: number,
    operationFilter?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<AuditLogQuery> {
    return await transport('get_audit_log', { limit, offset, operationFilter, dateFrom, dateTo });
  }

  static async clearAuditLog(): Promise<void> {
    return await transport('clear_audit_log');
  }

  static async exportAuditLog(outputPath: string): Promise<void> {
    return await transport('export_audit_log', { outputPath });
  }

  // Docker operations
  static async dockerIsAvailable(): Promise<boolean> {
    return await transport('docker_is_available');
  }

  static async dockerListContainers(all: boolean): Promise<DockerContainerInfo[]> {
    return await transport('docker_list_containers', { all });
  }

  static async dockerListImages(): Promise<DockerImageInfo[]> {
    return await transport('docker_list_images');
  }

  static async dockerStartContainer(id: string): Promise<void> {
    return await transport('docker_start_container', { id });
  }

  static async dockerStopContainer(id: string): Promise<void> {
    return await transport('docker_stop_container', { id });
  }

  static async dockerRemoveContainer(id: string, force: boolean): Promise<void> {
    return await transport('docker_remove_container', { id, force });
  }

  static async dockerRemoveImage(id: string, force: boolean): Promise<void> {
    return await transport('docker_remove_image', { id, force });
  }

  static async dockerContainerLogs(id: string, lines: number): Promise<string> {
    return await transport('docker_container_logs', { id, lines });
  }

  // File versioning operations
  static async enableVersioning(directory: string): Promise<void> {
    return await transport('enable_versioning', { directory });
  }

  static async disableVersioning(directory: string): Promise<void> {
    return await transport('disable_versioning', { directory });
  }

  static async createVersion(filePath: string): Promise<FileVersion> {
    return await transport('create_version', { filePath });
  }

  static async listVersions(filePath: string): Promise<FileVersion[]> {
    return await transport('list_versions', { filePath });
  }

  static async restoreVersion(filePath: string, versionNumber: number): Promise<void> {
    return await transport('restore_version', { filePath, versionNumber });
  }

  static async deleteVersion(filePath: string, versionNumber: number): Promise<void> {
    return await transport('delete_version', { filePath, versionNumber });
  }

  static async getVersioningConfig(): Promise<VersioningConfig> {
    return await transport('get_versioning_config');
  }

  static async updateVersioningConfig(config: VersioningConfig): Promise<void> {
    return await transport('update_versioning_config', { config });
  }

  static async isVersioningEnabled(filePath: string): Promise<boolean> {
    return await transport('is_versioning_enabled', { filePath });
  }

  static async getVersionCount(filePath: string): Promise<number> {
    return await transport('get_version_count', { filePath });
  }

  static async deleteAllVersions(filePath: string): Promise<number> {
    return await transport('delete_all_versions', { filePath });
  }

  static async readVersionContent(filePath: string, versionNumber: number): Promise<string> {
    return await transport('read_version_content', { filePath, versionNumber });
  }

  // Cloud Sync operations
  static async syncBookmarksToCloud(
    bookmarks: BookmarkEntry[],
    apiUrl: string,
    token: string,
  ): Promise<SyncResult> {
    return await transport('sync_bookmarks_to_cloud', { bookmarks, apiUrl, token });
  }

  static async fetchCloudBookmarks(apiUrl: string, token: string): Promise<BookmarkEntry[]> {
    return await transport('fetch_cloud_bookmarks', { apiUrl, token });
  }

  static async setLastSyncTime(timestamp: string): Promise<void> {
    return await transport('set_last_sync_time', { timestamp });
  }

  static async getLastSyncTime(): Promise<string | null> {
    return await transport('get_last_sync_time');
  }

  static async syncAll(apiUrl: string, token: string): Promise<SyncResult> {
    return await transport('sync_all', { apiUrl, token });
  }

  static async startAutoSync(
    apiUrl: string,
    token: string,
    intervalSecs?: number,
  ): Promise<SyncResult> {
    return await transport('start_auto_sync', { apiUrl, token, intervalSecs });
  }

  static async stopAutoSync(): Promise<SyncResult> {
    return await transport('stop_auto_sync');
  }

  static async getAutoSyncStatus(): Promise<boolean> {
    return await transport('get_auto_sync_status');
  }

  // ── Shell integration (Windows) ──────────────────────────────────
  static async setDefaultFolderHandler(enable: boolean): Promise<void> {
    return await transport('set_default_folder_handler', { enable });
  }

  static async addContextMenuEntry(): Promise<void> {
    return await transport('add_context_menu_entry', {});
  }

  static async removeContextMenuEntry(): Promise<void> {
    return await transport('remove_context_menu_entry', {});
  }

  static async getShellIntegrationStatus(): Promise<{
    is_default_handler: boolean;
    context_menu_installed: boolean;
  }> {
    return await transport('get_shell_integration_status', {});
  }
}
