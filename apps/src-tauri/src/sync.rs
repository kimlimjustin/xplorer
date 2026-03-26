// Cloud sync module — syncs local bookmarks and tags to the marketplace backend.
//
// Uses full-replace strategy: client sends all local data, server replaces.
// The Tauri commands handle HTTP communication so the frontend never needs
// to make raw fetch() calls to the marketplace API.
//
// Auto-sync: background timer runs every 5 minutes; start/stop via Tauri commands.
// Conflict resolution: last-write-wins based on timestamps.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tracing::{info, warn};

use crate::storage::{BookmarkEntry, FileTag};

static AUTO_SYNC_RUNNING: AtomicBool = AtomicBool::new(false);
static AUTO_SYNC_CANCEL: AtomicBool = AtomicBool::new(false);

static SYNC_CONFIG: Mutex<Option<SyncConfig>> = Mutex::new(None);

#[derive(Clone, Debug)]
struct SyncConfig {
    api_url: String,
    token: String,
}

// ─── Cloud response types ───────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
struct CloudBookmark {
    pub path: String,
    pub name: String,
    pub icon: Option<String>,
    pub pinned: bool,
    #[serde(rename = "sortOrder")]
    pub sort_order: i32,
}

#[derive(Deserialize, Debug)]
struct SyncBookmarksResponse {
    pub bookmarks: Vec<CloudBookmark>,
    #[serde(rename = "syncedAt")]
    pub synced_at: Option<String>,
}

#[derive(Deserialize, Debug)]
struct FetchBookmarksResponse {
    pub bookmarks: Vec<CloudBookmark>,
}

#[derive(Deserialize, Debug)]
struct SyncTagsResponse {
    pub tags: HashMap<String, Vec<CloudTag>>,
    #[serde(rename = "syncedAt")]
    pub synced_at: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
struct CloudTag {
    pub name: String,
    pub color: String,
}

#[derive(Deserialize, Debug)]
struct FetchTagsResponse {
    pub tags: HashMap<String, Vec<CloudTag>>,
}

#[derive(Deserialize, Debug)]
struct ApiErrorResponse {
    pub error: Option<String>,
}

// ─── Sync result type returned to the frontend ──────────────────────────────

#[derive(Serialize, Debug)]
pub struct SyncResult {
    pub success: bool,
    pub synced_at: Option<String>,
    pub message: String,
}

// ─── Helper: build HTTP client with auth header ─────────────────────────────

fn build_client(token: &str) -> Result<(reqwest::Client, reqwest::header::HeaderMap), String> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::AUTHORIZATION,
        reqwest::header::HeaderValue::from_str(&format!("Bearer {}", token))
            .map_err(|e| format!("Invalid token: {}", e))?,
    );
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        reqwest::header::HeaderValue::from_static("application/json"),
    );
    // Include cookie-based auth header (NextAuth session token)
    headers.insert(
        reqwest::header::COOKIE,
        reqwest::header::HeaderValue::from_str(&format!("next-auth.session-token={}", token))
            .map_err(|e| format!("Invalid token for cookie: {}", e))?,
    );

    let client = reqwest::Client::builder()
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    Ok((client, reqwest::header::HeaderMap::new()))
}

// ─── Tauri commands ─────────────────────────────────────────────────────────

/// Push all local bookmarks to the cloud (full-replace sync).
#[tauri::command]
pub async fn sync_bookmarks_to_cloud(
    bookmarks: Vec<BookmarkEntry>,
    api_url: String,
    token: String,
) -> Result<SyncResult, String> {
    let (client, _) = build_client(&token)?;

    // Convert BookmarkEntry to the format the API expects
    #[derive(Serialize)]
    struct BookmarkPayload {
        path: String,
        name: String,
    }

    let payload = serde_json::json!({
        "bookmarks": bookmarks.iter().map(|b| BookmarkPayload {
            path: b.path.clone(),
            name: b.name.clone(),
        }).collect::<Vec<_>>()
    });

    let url = format!("{}/api/sync/bookmarks", api_url.trim_end_matches('/'));
    let response = client
        .put(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let api_err: Result<ApiErrorResponse, _> = serde_json::from_str(&body);
        let msg = api_err
            .ok()
            .and_then(|e| e.error)
            .unwrap_or_else(|| format!("HTTP {}", status));
        return Err(msg);
    }

    let result: SyncBookmarksResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(SyncResult {
        success: true,
        synced_at: result.synced_at,
        message: format!("Synced {} bookmarks", result.bookmarks.len()),
    })
}

/// Push all local tags to the cloud (full-replace sync).
#[tauri::command]
pub async fn sync_tags_to_cloud(
    tags: HashMap<String, Vec<FileTag>>,
    api_url: String,
    token: String,
) -> Result<SyncResult, String> {
    let (client, _) = build_client(&token)?;

    let payload = serde_json::json!({ "tags": tags });

    let url = format!("{}/api/sync/tags", api_url.trim_end_matches('/'));
    let response = client
        .put(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let api_err: Result<ApiErrorResponse, _> = serde_json::from_str(&body);
        let msg = api_err
            .ok()
            .and_then(|e| e.error)
            .unwrap_or_else(|| format!("HTTP {}", status));
        return Err(msg);
    }

    let result: SyncTagsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let tag_count: usize = result.tags.values().map(|v| v.len()).sum();
    Ok(SyncResult {
        success: true,
        synced_at: result.synced_at,
        message: format!(
            "Synced {} tags across {} files",
            tag_count,
            result.tags.len()
        ),
    })
}

/// Fetch all bookmarks from the cloud and return them as BookmarkEntry items.
#[tauri::command]
pub async fn fetch_cloud_bookmarks(
    api_url: String,
    token: String,
) -> Result<Vec<BookmarkEntry>, String> {
    let (client, _) = build_client(&token)?;

    let url = format!("{}/api/sync/bookmarks", api_url.trim_end_matches('/'));
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let api_err: Result<ApiErrorResponse, _> = serde_json::from_str(&body);
        let msg = api_err
            .ok()
            .and_then(|e| e.error)
            .unwrap_or_else(|| format!("HTTP {}", status));
        return Err(msg);
    }

    let result: FetchBookmarksResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Convert cloud bookmarks to local BookmarkEntry format
    let entries: Vec<BookmarkEntry> = result
        .bookmarks
        .into_iter()
        .map(|cb| BookmarkEntry {
            path: cb.path.clone(),
            name: cb.name,
            added_at: chrono::Utc::now().to_rfc3339(),
            is_dir: std::fs::metadata(&cb.path)
                .map(|m| m.is_dir())
                .unwrap_or(true), // default to dir if can't check
        })
        .collect();

    Ok(entries)
}

/// Fetch all tags from the cloud and return them in the local format.
#[tauri::command]
pub async fn fetch_cloud_tags(
    api_url: String,
    token: String,
) -> Result<HashMap<String, Vec<FileTag>>, String> {
    let (client, _) = build_client(&token)?;

    let url = format!("{}/api/sync/tags", api_url.trim_end_matches('/'));
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let api_err: Result<ApiErrorResponse, _> = serde_json::from_str(&body);
        let msg = api_err
            .ok()
            .and_then(|e| e.error)
            .unwrap_or_else(|| format!("HTTP {}", status));
        return Err(msg);
    }

    let result: FetchTagsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Convert cloud tags to local FileTag format
    let mut local_tags: HashMap<String, Vec<FileTag>> = HashMap::new();
    for (file_path, cloud_tags) in result.tags {
        let tags: Vec<FileTag> = cloud_tags
            .into_iter()
            .map(|ct| FileTag {
                name: ct.name,
                color: ct.color,
            })
            .collect();
        if !tags.is_empty() {
            local_tags.insert(file_path, tags);
        }
    }

    Ok(local_tags)
}

/// Store the last sync timestamp in the app data directory.
#[tauri::command]
pub async fn set_last_sync_time(
    timestamp: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    use tauri::Manager;
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    let path = dir.join("last_sync.json");
    let data = serde_json::json!({ "lastSyncTime": timestamp });
    let json =
        serde_json::to_string_pretty(&data).map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write sync time: {}", e))?;
    Ok(())
}

/// Read the last sync timestamp from the app data directory.
#[tauri::command]
pub async fn get_last_sync_time(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri::Manager;
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let path = dir.join("last_sync.json");
    if !path.exists() {
        return Ok(None);
    }
    let data =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read sync time: {}", e))?;
    let parsed: serde_json::Value =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse sync time: {}", e))?;
    Ok(parsed
        .get("lastSyncTime")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string()))
}

// ─── Auto-sync helpers (internal, not Tauri commands) ────────────────────────

fn merge_bookmarks_last_write_wins(
    local: &[BookmarkEntry],
    cloud: Vec<BookmarkEntry>,
    last_sync: Option<&str>,
) -> Vec<BookmarkEntry> {
    let mut merged: HashMap<String, BookmarkEntry> = HashMap::new();

    for b in cloud {
        merged.insert(b.path.clone(), b);
    }

    for b in local {
        let local_ts = chrono::DateTime::parse_from_rfc3339(&b.added_at).ok();
        let sync_ts = last_sync.and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok());

        let local_is_newer = match (local_ts, sync_ts) {
            (Some(lt), Some(st)) => lt > st,
            _ => true,
        };

        if local_is_newer || !merged.contains_key(&b.path) {
            merged.insert(b.path.clone(), b.clone());
        }
    }

    merged.into_values().collect()
}

fn merge_tags_last_write_wins(
    local: &HashMap<String, Vec<FileTag>>,
    cloud: HashMap<String, Vec<FileTag>>,
) -> HashMap<String, Vec<FileTag>> {
    let mut merged = cloud;
    for (path, tags) in local {
        merged.insert(path.clone(), tags.clone());
    }
    merged
}

async fn run_sync_cycle(
    api_url: &str,
    token: &str,
    app_handle: &tauri::AppHandle,
) -> Result<SyncResult, String> {
    let last_sync = get_last_sync_time(app_handle.clone()).await.unwrap_or(None);

    let local_bookmarks = crate::storage::get_bookmarks(app_handle.clone()).await;

    let cloud_bookmarks = fetch_cloud_bookmarks(api_url.to_string(), token.to_string())
        .await
        .unwrap_or_default();

    let merged_bookmarks =
        merge_bookmarks_last_write_wins(&local_bookmarks, cloud_bookmarks, last_sync.as_deref());

    let bm_result =
        sync_bookmarks_to_cloud(merged_bookmarks, api_url.to_string(), token.to_string()).await?;

    let local_tags_map = get_all_tags_as_map(app_handle).await;

    let cloud_tags = fetch_cloud_tags(api_url.to_string(), token.to_string())
        .await
        .unwrap_or_default();

    let merged_tags = merge_tags_last_write_wins(&local_tags_map, cloud_tags);

    if !merged_tags.is_empty() {
        let _ = sync_tags_to_cloud(merged_tags, api_url.to_string(), token.to_string()).await;
    }

    let now = chrono::Utc::now().to_rfc3339();
    let _ = set_last_sync_time(now.clone(), app_handle.clone()).await;

    Ok(SyncResult {
        success: true,
        synced_at: Some(now),
        message: bm_result.message,
    })
}

async fn get_all_tags_as_map(app_handle: &tauri::AppHandle) -> HashMap<String, Vec<FileTag>> {
    use tauri::Manager;
    let dir = app_handle.path().app_data_dir().ok();
    let Some(dir) = dir else {
        return HashMap::new();
    };
    let path = dir.join("file_tags.json");
    if !path.exists() {
        return HashMap::new();
    }
    let data = match std::fs::read_to_string(&path) {
        Ok(d) => d,
        Err(_) => return HashMap::new(),
    };
    serde_json::from_str::<HashMap<String, Vec<FileTag>>>(&data).unwrap_or_default()
}

// ─── Auto-sync Tauri commands ────────────────────────────────────────────────

#[tauri::command]
pub async fn sync_all(
    api_url: String,
    token: String,
    app_handle: tauri::AppHandle,
) -> Result<SyncResult, String> {
    run_sync_cycle(&api_url, &token, &app_handle).await
}

#[tauri::command]
pub async fn auto_sync_on_startup(
    api_url: String,
    token: String,
    app_handle: tauri::AppHandle,
) -> Result<SyncResult, String> {
    info!("[sync] Running startup sync");
    match run_sync_cycle(&api_url, &token, &app_handle).await {
        Ok(result) => {
            info!("[sync] Startup sync completed: {}", result.message);
            Ok(result)
        }
        Err(e) => {
            warn!(
                "[sync] Startup sync failed (will retry on next cycle): {}",
                e
            );
            Ok(SyncResult {
                success: false,
                synced_at: None,
                message: format!("Startup sync failed: {}", e),
            })
        }
    }
}

#[tauri::command]
pub async fn start_auto_sync(
    api_url: String,
    token: String,
    interval_secs: Option<u64>,
    app_handle: tauri::AppHandle,
) -> Result<SyncResult, String> {
    use tauri::Emitter;

    if AUTO_SYNC_RUNNING.load(Ordering::SeqCst) {
        return Ok(SyncResult {
            success: true,
            synced_at: None,
            message: "Auto-sync is already running".to_string(),
        });
    }

    {
        let mut config = SYNC_CONFIG.lock().unwrap_or_else(|e| e.into_inner());
        *config = Some(SyncConfig {
            api_url: api_url.clone(),
            token: token.clone(),
        });
    }

    AUTO_SYNC_RUNNING.store(true, Ordering::SeqCst);
    AUTO_SYNC_CANCEL.store(false, Ordering::SeqCst);

    let startup_result = match run_sync_cycle(&api_url, &token, &app_handle).await {
        Ok(r) => {
            info!("[sync] Initial sync completed: {}", r.message);
            r
        }
        Err(e) => {
            warn!("[sync] Initial sync failed: {}", e);
            SyncResult {
                success: false,
                synced_at: None,
                message: format!("Initial sync failed: {}", e),
            }
        }
    };

    let interval = std::time::Duration::from_secs(interval_secs.unwrap_or(300));
    let handle = app_handle.clone();

    tokio::spawn(async move {
        info!(
            "[sync] Background sync started (interval: {}s)",
            interval.as_secs()
        );
        loop {
            tokio::time::sleep(interval).await;

            if AUTO_SYNC_CANCEL.load(Ordering::SeqCst) {
                info!("[sync] Background sync cancelled");
                break;
            }

            let config = {
                let guard = SYNC_CONFIG.lock().unwrap_or_else(|e| e.into_inner());
                guard.clone()
            };

            let Some(cfg) = config else {
                warn!("[sync] No sync config found, stopping background sync");
                break;
            };

            match run_sync_cycle(&cfg.api_url, &cfg.token, &handle).await {
                Ok(result) => {
                    info!("[sync] Background sync completed: {}", result.message);
                    let _ = handle.emit(
                        "cloud-sync-completed",
                        serde_json::json!({
                            "success": true,
                            "message": result.message,
                            "syncedAt": result.synced_at,
                        }),
                    );
                }
                Err(e) => {
                    warn!("[sync] Background sync failed: {}", e);
                    let _ = handle.emit(
                        "cloud-sync-completed",
                        serde_json::json!({
                            "success": false,
                            "message": format!("Sync failed: {}", e),
                        }),
                    );
                }
            }
        }
        AUTO_SYNC_RUNNING.store(false, Ordering::SeqCst);
    });

    Ok(startup_result)
}

#[tauri::command]
pub async fn stop_auto_sync() -> Result<SyncResult, String> {
    if !AUTO_SYNC_RUNNING.load(Ordering::SeqCst) {
        return Ok(SyncResult {
            success: true,
            synced_at: None,
            message: "Auto-sync was not running".to_string(),
        });
    }

    AUTO_SYNC_CANCEL.store(true, Ordering::SeqCst);
    {
        let mut config = SYNC_CONFIG.lock().unwrap_or_else(|e| e.into_inner());
        *config = None;
    }

    info!("[sync] Auto-sync stop requested");
    Ok(SyncResult {
        success: true,
        synced_at: None,
        message: "Auto-sync stopped".to_string(),
    })
}

#[tauri::command]
pub async fn get_auto_sync_status() -> Result<bool, String> {
    Ok(AUTO_SYNC_RUNNING.load(Ordering::SeqCst))
}

pub fn stop_auto_sync_blocking() {
    AUTO_SYNC_CANCEL.store(true, Ordering::SeqCst);
    AUTO_SYNC_RUNNING.store(false, Ordering::SeqCst);
    let mut config = SYNC_CONFIG.lock().unwrap_or_else(|e| e.into_inner());
    *config = None;
}
