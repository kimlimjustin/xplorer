// Storage sub-module: Custom Metadata
//
// Performance: in-memory cache with write-through.
// The cache mutex is held across the entire read-modify-write cycle so we
// never clone the full data structure just to modify one entry, and we
// avoid double lock-acquire on write paths.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex, MutexGuard};
use tauri::Manager;

// ─── In-memory cache ─────────────────────────────────────────────────────────

type MetadataMap = HashMap<String, Vec<CustomMetadataField>>;

static METADATA_CACHE: LazyLock<Mutex<Option<MetadataMap>>> =
    LazyLock::new(|| Mutex::new(None));

// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CustomMetadataField {
    pub key: String,
    pub value: String,
    pub field_type: String, // "text", "number", "date", "url", "boolean"
}

fn file_metadata_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(dir.join("file_metadata.json"))
}

/// Load metadata from disk (no cache).
fn load_file_metadata_from_disk(
    app_handle: &tauri::AppHandle,
) -> Result<MetadataMap, String> {
    let path = file_metadata_path(app_handle)?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let data = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let map: MetadataMap =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse file metadata: {}", e))?;
    Ok(map)
}

/// Acquire the cache lock and ensure it is populated from disk.
fn ensure_metadata_cache(
    app_handle: &tauri::AppHandle,
) -> Result<MutexGuard<'static, Option<MetadataMap>>, String> {
    let mut guard = METADATA_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        let data = load_file_metadata_from_disk(app_handle)?;
        *guard = Some(data);
    }
    Ok(guard)
}

/// Persist metadata to disk directly from the cache guard (no extra clone).
fn flush_metadata_to_disk(
    app_handle: &tauri::AppHandle,
    guard: &MutexGuard<'static, Option<MetadataMap>>,
) -> Result<(), String> {
    let map = guard
        .as_ref()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;
    let path = file_metadata_path(app_handle)?;
    let data =
        serde_json::to_string_pretty(map).map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&path, data).map_err(|e| format!("Failed to write file metadata: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_file_metadata(
    path: String,
    app_handle: tauri::AppHandle,
) -> Vec<CustomMetadataField> {
    let guard = match ensure_metadata_cache(&app_handle) {
        Ok(g) => g,
        Err(_) => return Vec::new(),
    };
    guard
        .as_ref()
        .and_then(|map| map.get(&path))
        .cloned()
        .unwrap_or_default()
}

#[tauri::command]
pub async fn set_file_metadata(
    path: String,
    fields: Vec<CustomMetadataField>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_metadata_cache(&app_handle)?;
    let map = guard
        .as_mut()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;
    if fields.is_empty() {
        map.remove(&path);
    } else {
        map.insert(path, fields);
    }
    flush_metadata_to_disk(&app_handle, &guard)?;
    Ok(())
}

#[tauri::command]
pub async fn get_all_metadata_keys(app_handle: tauri::AppHandle) -> Vec<String> {
    let guard = match ensure_metadata_cache(&app_handle) {
        Ok(g) => g,
        Err(_) => return Vec::new(),
    };
    let cached_map = match guard.as_ref() {
        Some(m) => m,
        None => return Vec::new(),
    };
    let mut keys: std::collections::HashSet<String> = std::collections::HashSet::new();
    for fields in cached_map.values() {
        for field in fields {
            keys.insert(field.key.clone());
        }
    }
    let mut result: Vec<String> = keys.into_iter().collect();
    result.sort();
    result
}
