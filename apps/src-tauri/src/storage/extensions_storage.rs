// Storage sub-module: Extension-scoped Storage
//
// Performance: in-memory cache with write-through.
// The cache mutex is held across the entire read-modify-write cycle so we
// never clone the full data structure just to modify one entry, and we
// avoid double lock-acquire on write paths.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex, MutexGuard};
use tauri::Manager;

// ─── In-memory cache ─────────────────────────────────────────────────────────

static EXTENSION_STORAGE_CACHE: LazyLock<Mutex<Option<HashMap<String, HashMap<String, serde_json::Value>>>>> =
    LazyLock::new(|| Mutex::new(None));

// ─────────────────────────────────────────────────────────────────────────────

fn extension_storage_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(dir.join("extension_storage.json"))
}

/// Load extension storage from disk (no cache).
fn load_extension_storage_from_disk(
    app_handle: &tauri::AppHandle,
) -> Result<HashMap<String, HashMap<String, serde_json::Value>>, String> {
    let path = extension_storage_path(app_handle)?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let data = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read extension storage: {}", e))?;
    let map: HashMap<String, HashMap<String, serde_json::Value>> = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse extension storage: {}", e))?;
    Ok(map)
}

/// Acquire the cache lock and ensure it is populated from disk.
fn ensure_extension_storage_cache(
    app_handle: &tauri::AppHandle,
) -> Result<MutexGuard<'static, Option<HashMap<String, HashMap<String, serde_json::Value>>>>, String> {
    let mut guard = EXTENSION_STORAGE_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        let data = load_extension_storage_from_disk(app_handle)?;
        *guard = Some(data);
    }
    Ok(guard)
}

/// Persist extension storage to disk directly from the cache guard (no extra clone).
fn flush_extension_storage_to_disk(
    app_handle: &tauri::AppHandle,
    guard: &MutexGuard<'static, Option<HashMap<String, HashMap<String, serde_json::Value>>>>,
) -> Result<(), String> {
    let map = guard.as_ref().ok_or_else(|| "Storage cache not initialized".to_string())?;
    let path = extension_storage_path(app_handle)?;
    let data =
        serde_json::to_string_pretty(map).map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&path, data)
        .map_err(|e| format!("Failed to write extension storage: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_extension_storage(
    extension_id: String,
    key: String,
    app_handle: tauri::AppHandle,
) -> Result<Option<serde_json::Value>, String> {
    let guard = ensure_extension_storage_cache(&app_handle)?;
    Ok(guard
        .as_ref()
        .ok_or_else(|| "Storage cache not initialized".to_string())?
        .get(&extension_id)
        .and_then(|ext_map| ext_map.get(&key))
        .cloned())
}

#[tauri::command]
pub async fn set_extension_storage(
    extension_id: String,
    key: String,
    value: serde_json::Value,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_extension_storage_cache(&app_handle)?;
    let map = guard.as_mut().ok_or_else(|| "Storage cache not initialized".to_string())?;
    let ext_map = map.entry(extension_id).or_insert_with(HashMap::new);
    ext_map.insert(key, value);
    flush_extension_storage_to_disk(&app_handle, &guard)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_extension_storage(
    extension_id: String,
    key: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_extension_storage_cache(&app_handle)?;
    let map = guard.as_mut().ok_or_else(|| "Storage cache not initialized".to_string())?;
    if let Some(ext_map) = map.get_mut(&extension_id) {
        ext_map.remove(&key);
        if ext_map.is_empty() {
            map.remove(&extension_id);
        }
    }
    flush_extension_storage_to_disk(&app_handle, &guard)?;
    Ok(())
}
