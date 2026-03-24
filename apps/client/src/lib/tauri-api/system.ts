import { transport, listenToEvent as transportListen } from '../transport';
import type {
  FileEntry,
  ShortcutKey,
  ShortcutAction,
  ShortcutBinding,
  ShortcutSettings,
  FileVersion,
  VersioningConfig,
  BackupManifest,
  AuditLogQuery,
  DockerContainerInfo,
  DockerImageInfo,
  BookmarkEntry,
  SyncResult,
} from '../tauri-api-types';

// ── Terminal operations ─────────────────────────────────────────────────────

export const executeCommand = async (
  command: string,
  workingDir: string,
): Promise<{
  stdout: string;
  stderr: string;
  exit_code: number;
}> => await transport('execute_command', { command, workingDir });

export const executeCommandStream = async (command: string, workingDir: string): Promise<void> =>
  await transport('execute_command_stream', { command, workingDir });

export const getCurrentShell = async (): Promise<string> => await transport('get_current_shell');

export const openInTerminal = async (path: string): Promise<void> =>
  await transport('open_in_terminal', { path });

// ── Event listener operations ───────────────────────────────────────────────

export const listenToTerminalOutput = async (
  callback: (message: string) => void,
): Promise<() => void> => transportListen<string>('terminal-output', callback);

export const listenToEvent = async <T>(
  eventName: string,
  callback: (payload: T) => void,
): Promise<() => void> => transportListen<T>(eventName, callback);

// ── Window / App operations ─────────────────────────────────────────────────

export const getAppVersion = async (): Promise<string> => await transport('get_app_version');

export const getSystemInfo = async (): Promise<{
  os: string;
  arch: string;
  version: string;
  hostname: string;
}> => await transport('get_system_info');

// ── User directory operations ───────────────────────────────────────────────

export const getUserDirectories = async (): Promise<{
  home: string;
  documents: string;
  downloads: string;
  desktop: string;
  pictures: string;
  videos: string;
  music: string;
}> => await transport('get_user_directories');

export const getRecentFolders = async (): Promise<string[]> =>
  await transport('get_recent_folders');

export const addToRecentFolders = async (path: string): Promise<void> =>
  await transport('add_to_recent_folders', { path });

// ── Drives ──────────────────────────────────────────────────────────────────

export const listDrives = async (): Promise<
  {
    letter: string;
    label: string;
    path: string;
    total_space: number;
    free_space: number;
  }[]
> => await transport('list_drives');

export const ejectVolume = async (path: string): Promise<void> =>
  await transport('eject_volume', { path });

// ── Shortcut operations ─────────────────────────────────────────────────────

export const getShortcuts = async (): Promise<ShortcutBinding[]> =>
  await transport('get_shortcuts');

export const getShortcutsByCategory = async (category: string): Promise<ShortcutBinding[]> =>
  await transport('get_shortcuts_by_category', { category });

export const addShortcut = async (binding: ShortcutBinding): Promise<void> =>
  await transport('add_shortcut', { shortcut: binding });

export const updateShortcut = async (binding: ShortcutBinding): Promise<void> =>
  await transport('update_shortcut', { binding });

export const removeShortcut = async (shortcutId: string): Promise<void> =>
  await transport('remove_shortcut', { shortcutId });

export const getShortcutProfiles = async (): Promise<string[]> =>
  await transport('get_shortcut_profiles');

export const switchShortcutProfile = async (profileId: string): Promise<void> =>
  await transport('switch_shortcut_profile', { profileId });

export const getShortcutSettings = async (): Promise<ShortcutSettings> =>
  await transport('get_shortcut_settings');

export const updateShortcutSettings = async (settings: ShortcutSettings): Promise<void> =>
  await transport('update_shortcut_settings', { settings });

export const executeShortcutAction = async (
  keyCombination: string,
  context: string,
): Promise<ShortcutAction | null> => {
  if (!keyCombination) return null;
  return await transport('execute_shortcut_action', { keyCombination, context });
};

export const registerExtensionShortcut = async (
  extensionId: string,
  shortcutId: string,
  name: string,
  description: string | null,
  keyCombination: ShortcutKey,
  action: string,
  context: string[],
): Promise<void> =>
  await transport('register_extension_shortcut', {
    extensionId,
    shortcutId,
    name,
    description,
    keyCombination,
    action,
    context,
  });

export const unregisterExtensionShortcuts = async (extensionId: string): Promise<void> =>
  await transport('unregister_extension_shortcuts', { extensionId });

export const registerGlobalShortcuts = async (): Promise<void> =>
  await transport('register_global_shortcuts');

export const unregisterGlobalShortcuts = async (): Promise<void> =>
  await transport('unregister_global_shortcuts');

export const toggleGlobalShortcuts = async (enabled: boolean): Promise<void> =>
  await transport('toggle_global_shortcuts', { enabled });

export const resetShortcuts = async (profileId?: string): Promise<void> =>
  await transport('reset_shortcuts', { profileId: profileId ?? null });

export const resetSingleShortcut = async (shortcutId: string): Promise<ShortcutBinding> =>
  await transport('reset_single_shortcut', { shortcutId });

// ── Backup operations ───────────────────────────────────────────────────────

export const createBackup = async (
  sourceDir: string,
  backupDir: string,
  name: string,
): Promise<BackupManifest> => await transport('create_backup', { sourceDir, backupDir, name });

export const listBackups = async (backupDir: string, name: string): Promise<BackupManifest[]> =>
  await transport('list_backups', { backupDir, name });

export const restoreBackup = async (
  backupId: string,
  backupDir: string,
  name: string,
  restoreTo: string,
): Promise<void> => await transport('restore_backup', { backupId, backupDir, name, restoreTo });

export const deleteBackup = async (
  backupId: string,
  backupDir: string,
  name: string,
): Promise<void> => await transport('delete_backup', { backupId, backupDir, name });

// ── Audit log operations ────────────────────────────────────────────────────

export const getAuditLog = async (
  limit?: number,
  offset?: number,
  operationFilter?: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<AuditLogQuery> =>
  await transport('get_audit_log', { limit, offset, operationFilter, dateFrom, dateTo });

export const clearAuditLog = async (): Promise<void> => await transport('clear_audit_log');

export const exportAuditLog = async (outputPath: string): Promise<void> =>
  await transport('export_audit_log', { outputPath });

// ── Docker operations ───────────────────────────────────────────────────────

export const dockerIsAvailable = async (): Promise<boolean> =>
  await transport('docker_is_available');

export const dockerListContainers = async (all: boolean): Promise<DockerContainerInfo[]> =>
  await transport('docker_list_containers', { all });

export const dockerListImages = async (): Promise<DockerImageInfo[]> =>
  await transport('docker_list_images');

export const dockerStartContainer = async (id: string): Promise<void> =>
  await transport('docker_start_container', { id });

export const dockerStopContainer = async (id: string): Promise<void> =>
  await transport('docker_stop_container', { id });

export const dockerRemoveContainer = async (id: string, force: boolean): Promise<void> =>
  await transport('docker_remove_container', { id, force });

export const dockerRemoveImage = async (id: string, force: boolean): Promise<void> =>
  await transport('docker_remove_image', { id, force });

export const dockerContainerLogs = async (id: string, lines: number): Promise<string> =>
  await transport('docker_container_logs', { id, lines });

// ── File versioning operations ──────────────────────────────────────────────

export const enableVersioning = async (directory: string): Promise<void> =>
  await transport('enable_versioning', { directory });

export const disableVersioning = async (directory: string): Promise<void> =>
  await transport('disable_versioning', { directory });

export const createVersion = async (filePath: string): Promise<FileVersion> =>
  await transport('create_version', { filePath });

export const listVersions = async (filePath: string): Promise<FileVersion[]> =>
  await transport('list_versions', { filePath });

export const restoreVersion = async (filePath: string, versionNumber: number): Promise<void> =>
  await transport('restore_version', { filePath, versionNumber });

export const deleteVersion = async (filePath: string, versionNumber: number): Promise<void> =>
  await transport('delete_version', { filePath, versionNumber });

export const getVersioningConfig = async (): Promise<VersioningConfig> =>
  await transport('get_versioning_config');

export const updateVersioningConfig = async (config: VersioningConfig): Promise<void> =>
  await transport('update_versioning_config', { config });

export const isVersioningEnabled = async (filePath: string): Promise<boolean> =>
  await transport('is_versioning_enabled', { filePath });

export const getVersionCount = async (filePath: string): Promise<number> =>
  await transport('get_version_count', { filePath });

export const deleteAllVersions = async (filePath: string): Promise<number> =>
  await transport('delete_all_versions', { filePath });

export const readVersionContent = async (
  filePath: string,
  versionNumber: number,
): Promise<string> => await transport('read_version_content', { filePath, versionNumber });

// ── Cloud Sync operations ───────────────────────────────────────────────────

export const syncBookmarksToCloud = async (
  bookmarks: BookmarkEntry[],
  apiUrl: string,
  token: string,
): Promise<SyncResult> => await transport('sync_bookmarks_to_cloud', { bookmarks, apiUrl, token });

export const fetchCloudBookmarks = async (
  apiUrl: string,
  token: string,
): Promise<BookmarkEntry[]> => await transport('fetch_cloud_bookmarks', { apiUrl, token });

export const setLastSyncTime = async (timestamp: string): Promise<void> =>
  await transport('set_last_sync_time', { timestamp });

export const getLastSyncTime = async (): Promise<string | null> =>
  await transport('get_last_sync_time');

export const syncAll = async (apiUrl: string, token: string): Promise<SyncResult> =>
  await transport('sync_all', { apiUrl, token });

export const startAutoSync = async (
  apiUrl: string,
  token: string,
  intervalSecs?: number,
): Promise<SyncResult> => await transport('start_auto_sync', { apiUrl, token, intervalSecs });

export const stopAutoSync = async (): Promise<SyncResult> => await transport('stop_auto_sync');

export const getAutoSyncStatus = async (): Promise<boolean> =>
  await transport('get_auto_sync_status');

// ── Shell integration (Windows) ─────────────────────────────────────────────

export const setDefaultFolderHandler = async (enable: boolean): Promise<void> =>
  await transport('set_default_folder_handler', { enable });

export const addContextMenuEntry = async (): Promise<void> =>
  await transport('add_context_menu_entry', {});

export const removeContextMenuEntry = async (): Promise<void> =>
  await transport('remove_context_menu_entry', {});

export const getShellIntegrationStatus = async (): Promise<{
  is_default_handler: boolean;
  context_menu_installed: boolean;
}> => await transport('get_shell_integration_status', {});

// ── Google Drive Operations ─────────────────────────────────────────────────

export const gdriveAuthenticate = async (): Promise<{
  id: string;
  email: string;
  display_name: string;
}> => await transport('gdrive_authenticate');

export const gdriveDisconnect = async (accountId: string): Promise<void> =>
  await transport('gdrive_disconnect', { accountId });

export const gdriveListAccounts = async (): Promise<
  Array<{
    id: string;
    email: string;
    display_name: string;
  }>
> => await transport('gdrive_list_accounts');

export const gdriveListFiles = async (accountId: string, folderId: string): Promise<FileEntry[]> =>
  await transport('gdrive_list_files', { accountId, folderId });

export const gdriveDownloadFile = async (
  accountId: string,
  fileId: string,
  localPath: string,
): Promise<void> => await transport('gdrive_download_file', { accountId, fileId, localPath });

export const gdriveUploadFile = async (
  accountId: string,
  localPath: string,
  parentFolderId: string,
): Promise<FileEntry> =>
  await transport('gdrive_upload_file', { accountId, localPath, parentFolderId });

export const gdriveDeleteFile = async (accountId: string, fileId: string): Promise<void> =>
  await transport('gdrive_delete_file', { accountId, fileId });

export const gdriveRenameFile = async (
  accountId: string,
  fileId: string,
  newName: string,
): Promise<void> => await transport('gdrive_rename_file', { accountId, fileId, newName });

export const gdriveMoveFile = async (
  accountId: string,
  fileId: string,
  newParentId: string,
  oldParentId: string,
): Promise<void> =>
  await transport('gdrive_move_file', { accountId, fileId, newParentId, oldParentId });

export const gdriveCreateFolder = async (
  accountId: string,
  name: string,
  parentFolderId: string,
): Promise<FileEntry> =>
  await transport('gdrive_create_folder', { accountId, name, parentFolderId });

export const gdriveGetFileContent = async (accountId: string, fileId: string): Promise<string> =>
  await transport('gdrive_get_file_content', { accountId, fileId });

export const getGdriveSettings = async (): Promise<{
  client_id: string;
  client_secret: string;
}> => await transport('get_gdrive_settings');

export const updateGdriveSettings = async (clientId: string, clientSecret: string): Promise<void> =>
  await transport('update_gdrive_settings', { clientId, clientSecret });
