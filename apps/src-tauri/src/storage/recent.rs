// Storage sub-module: Recently Accessed Files
//
// Performance: in-memory cache with write-through.
// The cache mutex is held across the entire read-modify-write cycle so we
// never clone the full data structure just to modify one entry, and we
// avoid double lock-acquire on write paths.

use serde::{Deserialize, Serialize};
use std::sync::{LazyLock, Mutex, MutexGuard};
use tauri::Manager;

// ─── In-memory cache ─────────────────────────────────────────────────────────

static RECENT_FILES_CACHE: LazyLock<Mutex<Option<Vec<RecentFile>>>> =
    LazyLock::new(|| Mutex::new(None));

// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub accessed_at: u64,
    pub file_type: String,
    pub size: u64,
}

/// Return the path to recent_files.json inside the app data directory.
fn recent_files_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(dir.join("recent_files.json"))
}

/// Load recent files from disk (no cache).
fn load_recent_files_from_disk(app_handle: &tauri::AppHandle) -> Result<Vec<RecentFile>, String> {
    let path = recent_files_path(app_handle)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read recent files: {}", e))?;
    let files: Vec<RecentFile> =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse recent files: {}", e))?;
    Ok(files)
}

/// Acquire the cache lock and ensure it is populated from disk.
fn ensure_recent_files_cache(
    app_handle: &tauri::AppHandle,
) -> Result<MutexGuard<'static, Option<Vec<RecentFile>>>, String> {
    let mut guard = RECENT_FILES_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        let data = load_recent_files_from_disk(app_handle)?;
        *guard = Some(data);
    }
    Ok(guard)
}

/// Persist recent files to disk directly from the cache guard (no extra clone).
fn flush_recent_files_to_disk(
    app_handle: &tauri::AppHandle,
    guard: &MutexGuard<'static, Option<Vec<RecentFile>>>,
) -> Result<(), String> {
    let files = guard
        .as_ref()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;
    let path = recent_files_path(app_handle)?;
    let data =
        serde_json::to_string_pretty(files).map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&path, data).map_err(|e| format!("Failed to write recent files: {}", e))?;
    Ok(())
}

const MAX_RECENT_FILES: usize = 100;

/// Add a file to the recent-files list.  Reads metadata from the filesystem,
/// deduplicates by path (updating timestamp if it already exists), and caps the
/// list at MAX_RECENT_FILES entries.
#[tauri::command]
pub async fn add_recent_file(path: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;

    // Derive name, file_type, and size from the filesystem
    let fs_path = std::path::Path::new(&path);
    let name = fs_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let (file_type, size) = match std::fs::metadata(&path) {
        Ok(meta) => {
            if meta.is_dir() {
                ("folder".to_string(), 0u64)
            } else {
                let ext = fs_path
                    .extension()
                    .map(|e| e.to_string_lossy().to_string())
                    .unwrap_or_default();
                (ext, meta.len())
            }
        }
        Err(_) => {
            let ext = fs_path
                .extension()
                .map(|e| e.to_string_lossy().to_string())
                .unwrap_or_default();
            (ext, 0u64)
        }
    };

    let mut guard = ensure_recent_files_cache(&app_handle)?;
    let files = guard
        .as_mut()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;

    // Deduplicate: remove existing entry with the same path
    files.retain(|f| f.path != path);

    // Insert at the front (most recent first)
    files.insert(
        0,
        RecentFile {
            path,
            name,
            accessed_at: now,
            file_type,
            size,
        },
    );

    // Cap at MAX_RECENT_FILES
    if files.len() > MAX_RECENT_FILES {
        files.truncate(MAX_RECENT_FILES);
    }

    flush_recent_files_to_disk(&app_handle, &guard)?;
    Ok(())
}

/// Return the most recent N files, sorted by accessed_at DESC.
#[tauri::command]
pub async fn get_recent_files(
    limit: Option<u32>,
    app_handle: tauri::AppHandle,
) -> Result<Vec<RecentFile>, String> {
    let guard = ensure_recent_files_cache(&app_handle)?;
    // Clone for sorting without holding the lock during sort
    let mut files = guard.as_ref().cloned().unwrap_or_default();
    drop(guard);
    // Sort by accessed_at descending (most recent first)
    files.sort_by(|a, b| b.accessed_at.cmp(&a.accessed_at));
    if let Some(n) = limit {
        files.truncate(n as usize);
    }
    Ok(files)
}

/// Clear all recent files.
#[tauri::command]
pub async fn clear_recent_files(app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut guard = ensure_recent_files_cache(&app_handle)?;
    *guard = Some(Vec::new());
    flush_recent_files_to_disk(&app_handle, &guard)?;
    Ok(())
}

/// Remove a single entry by path.
#[tauri::command]
pub async fn remove_recent_file(path: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut guard = ensure_recent_files_cache(&app_handle)?;
    let files = guard
        .as_mut()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;
    files.retain(|f| f.path != path);
    flush_recent_files_to_disk(&app_handle, &guard)?;
    Ok(())
}
