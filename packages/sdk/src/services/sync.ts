import { transport } from '../transport';
import type { BookmarkEntry, FileTag, SyncResult } from '../types';

// ─── Cloud Sync operations ──────────────────────────────────────────────────

/**
 * Push all local bookmarks to the cloud (full-replace sync).
 */
export const syncBookmarksToCloud = async (
  bookmarks: BookmarkEntry[],
  apiUrl: string,
  token: string,
): Promise<SyncResult> => {
  return await transport('sync_bookmarks_to_cloud', { bookmarks, apiUrl, token });
};

/**
 * Push all local tags to the cloud (full-replace sync).
 * Tags are sent as a map of filePath -> FileTag[].
 */
export const syncTagsToCloud = async (
  tags: Record<string, FileTag[]>,
  apiUrl: string,
  token: string,
): Promise<SyncResult> => {
  return await transport('sync_tags_to_cloud', { tags, apiUrl, token });
};

/**
 * Fetch all bookmarks from the cloud.
 */
export const fetchCloudBookmarks = async (
  apiUrl: string,
  token: string,
): Promise<BookmarkEntry[]> => {
  return await transport('fetch_cloud_bookmarks', { apiUrl, token });
};

/**
 * Fetch all tags from the cloud.
 * Returns a map of filePath -> FileTag[].
 */
export const fetchCloudTags = async (
  apiUrl: string,
  token: string,
): Promise<Record<string, FileTag[]>> => {
  return await transport('fetch_cloud_tags', { apiUrl, token });
};

/**
 * Store the last sync timestamp.
 */
export const setLastSyncTime = async (timestamp: string): Promise<void> => {
  return await transport('set_last_sync_time', { timestamp });
};

/**
 * Get the last sync timestamp.
 */
export const getLastSyncTime = async (): Promise<string | null> => {
  return await transport('get_last_sync_time');
};

/**
 * Full bidirectional sync: pulls cloud data, merges with local using
 * last-write-wins, then pushes the merged result back to the cloud.
 */
export const syncAll = async (
  apiUrl: string,
  token: string,
): Promise<SyncResult> => {
  return await transport('sync_all', { apiUrl, token });
};

/**
 * Run a one-time startup sync (pulls + merges + pushes).
 * Returns a success result even if the network is offline.
 */
export const autoSyncOnStartup = async (
  apiUrl: string,
  token: string,
): Promise<SyncResult> => {
  return await transport('auto_sync_on_startup', { apiUrl, token });
};

/**
 * Start background auto-sync. Runs an initial sync immediately, then
 * repeats every `intervalSecs` seconds (default 300 = 5 minutes).
 * Emits `cloud-sync-completed` events to the frontend on each cycle.
 */
export const startAutoSync = async (
  apiUrl: string,
  token: string,
  intervalSecs?: number,
): Promise<SyncResult> => {
  return await transport('start_auto_sync', { apiUrl, token, intervalSecs });
};

/**
 * Stop the background auto-sync timer.
 */
export const stopAutoSync = async (): Promise<SyncResult> => {
  return await transport('stop_auto_sync');
};

/**
 * Check whether background auto-sync is currently running.
 */
export const getAutoSyncStatus = async (): Promise<boolean> => {
  return await transport('get_auto_sync_status');
};
