// Storage sub-module: Bookmarks
//
// Performance: in-memory cache with write-through.
// The cache mutex is held across the entire read-modify-write cycle so we
// never clone the full data structure just to modify one entry, and we
// avoid double lock-acquire on write paths.

use serde::{Deserialize, Serialize};
use std::sync::{LazyLock, Mutex, MutexGuard};
use tauri::Manager;

// ─── In-memory cache ─────────────────────────────────────────────────────────

static BOOKMARKS_CACHE: LazyLock<Mutex<Option<Vec<BookmarkEntry>>>> =
    LazyLock::new(|| Mutex::new(None));

// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BookmarkEntry {
    pub path: String,
    pub name: String,
    pub added_at: String, // ISO timestamp
    pub is_dir: bool,
}

/// Return the path to bookmarks.json inside the app data directory.
fn bookmarks_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(dir.join("bookmarks.json"))
}

/// Load bookmarks from disk (no cache).
fn load_bookmarks_from_disk(app_handle: &tauri::AppHandle) -> Result<Vec<BookmarkEntry>, String> {
    let path = bookmarks_path(app_handle)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read bookmarks: {}", e))?;
    let bookmarks: Vec<BookmarkEntry> =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse bookmarks: {}", e))?;
    Ok(bookmarks)
}

/// Acquire the cache lock and ensure it is populated from disk.
fn ensure_bookmarks_cache(
    app_handle: &tauri::AppHandle,
) -> Result<MutexGuard<'static, Option<Vec<BookmarkEntry>>>, String> {
    let mut guard = BOOKMARKS_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        let data = load_bookmarks_from_disk(app_handle)?;
        *guard = Some(data);
    }
    Ok(guard)
}

/// Persist bookmarks to disk directly from the cache guard (no extra clone).
fn flush_bookmarks_to_disk(
    app_handle: &tauri::AppHandle,
    guard: &MutexGuard<'static, Option<Vec<BookmarkEntry>>>,
) -> Result<(), String> {
    let bookmarks = guard.as_ref().ok_or_else(|| "Storage cache not initialized".to_string())?;
    let path = bookmarks_path(app_handle)?;
    let data =
        serde_json::to_string_pretty(bookmarks).map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&path, data).map_err(|e| format!("Failed to write bookmarks: {}", e))?;
    Ok(())
}

/// Return all bookmarks.
#[tauri::command]
pub async fn get_bookmarks(app_handle: tauri::AppHandle) -> Vec<BookmarkEntry> {
    let guard = match ensure_bookmarks_cache(&app_handle) {
        Ok(g) => g,
        Err(_) => return Vec::new(),
    };
    guard.as_ref().cloned().unwrap_or_default()
}

/// Add a path to bookmarks. Deduplicates by path.
#[tauri::command]
pub async fn add_bookmark(
    path: String,
    name: String,
    app_handle: tauri::AppHandle,
) -> Result<BookmarkEntry, String> {
    let is_dir = std::fs::metadata(&path)
        .map(|m| m.is_dir())
        .unwrap_or(false);

    let entry = BookmarkEntry {
        path: path.clone(),
        name,
        added_at: chrono::Utc::now().to_rfc3339(),
        is_dir,
    };

    let mut guard = ensure_bookmarks_cache(&app_handle)?;
    let bookmarks = guard.as_mut().ok_or_else(|| "Storage cache not initialized".to_string())?;
    // Deduplicate by path -- remove any existing entry with the same path
    bookmarks.retain(|b| b.path != path);
    bookmarks.push(entry.clone());
    flush_bookmarks_to_disk(&app_handle, &guard)?;
    Ok(entry)
}

/// Remove a bookmark by path.
#[tauri::command]
pub async fn remove_bookmark(path: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut guard = ensure_bookmarks_cache(&app_handle)?;
    let bookmarks = guard.as_mut().ok_or_else(|| "Storage cache not initialized".to_string())?;
    bookmarks.retain(|b| b.path != path);
    flush_bookmarks_to_disk(&app_handle, &guard)?;
    Ok(())
}

/// Update the display name of a bookmark.
#[tauri::command]
pub async fn update_bookmark_name(
    path: String,
    name: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_bookmarks_cache(&app_handle)?;
    let bookmarks = guard.as_mut().ok_or_else(|| "Storage cache not initialized".to_string())?;
    let found = bookmarks.iter_mut().find(|b| b.path == path);
    if let Some(bookmark) = found {
        bookmark.name = name;
    } else {
        return Err(format!("Bookmark not found: {}", path));
    }
    flush_bookmarks_to_disk(&app_handle, &guard)?;
    Ok(())
}
