// Storage sub-module: File Tags & Tag Categories
//
// Performance: in-memory cache with write-through.
// The cache mutex is held across the entire read-modify-write cycle so we
// never clone the full data structure just to modify one entry, and we
// avoid double lock-acquire on write paths.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex, MutexGuard};
use tauri::Manager;

use super::generate_id;

// ─── In-memory caches ────────────────────────────────────────────────────────

static FILE_TAGS_CACHE: LazyLock<Mutex<Option<HashMap<String, Vec<FileTag>>>>> =
    LazyLock::new(|| Mutex::new(None));

static TAG_CATEGORIES_CACHE: LazyLock<Mutex<Option<Vec<TagCategory>>>> =
    LazyLock::new(|| Mutex::new(None));

// ─── File Tags ───────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileTag {
    pub name: String,
    pub color: String, // hex color e.g. "#7aa2f7"
}

/// Return the path to file_tags.json inside the app data directory.
fn file_tags_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(dir.join("file_tags.json"))
}

/// Load the tags map from disk (no cache).
fn load_file_tags_from_disk(
    app_handle: &tauri::AppHandle,
) -> Result<HashMap<String, Vec<FileTag>>, String> {
    let path = file_tags_path(app_handle)?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let data =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file tags: {}", e))?;
    let map: HashMap<String, Vec<FileTag>> =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse file tags: {}", e))?;
    Ok(map)
}

/// Acquire the cache lock and ensure the cache is populated from disk.
/// Returns the held MutexGuard so callers can read/mutate without extra cloning.
fn ensure_file_tags_cache(
    app_handle: &tauri::AppHandle,
) -> Result<MutexGuard<'static, Option<HashMap<String, Vec<FileTag>>>>, String> {
    let mut guard = FILE_TAGS_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        let data = load_file_tags_from_disk(app_handle)?;
        *guard = Some(data);
    }
    Ok(guard)
}

/// Persist the cached tags map to disk.  Caller must pass the live guard
/// so we serialise directly from the cache without an extra clone.
fn flush_file_tags_to_disk(
    app_handle: &tauri::AppHandle,
    guard: &MutexGuard<'static, Option<HashMap<String, Vec<FileTag>>>>,
) -> Result<(), String> {
    let map = guard
        .as_ref()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;
    let path = file_tags_path(app_handle)?;
    let data =
        serde_json::to_string_pretty(map).map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&path, data).map_err(|e| format!("Failed to write file tags: {}", e))?;
    Ok(())
}

/// Return the tags currently assigned to a file path.
#[tauri::command]
pub async fn get_file_tags(path: String, app_handle: tauri::AppHandle) -> Vec<FileTag> {
    let guard = match ensure_file_tags_cache(&app_handle) {
        Ok(g) => g,
        Err(_) => return Vec::new(),
    };
    guard
        .as_ref()
        .and_then(|map| map.get(&path))
        .cloned()
        .unwrap_or_default()
}

/// Overwrite the tags for a file path (pass an empty Vec to clear).
#[tauri::command]
pub async fn set_file_tags(
    path: String,
    tags: Vec<FileTag>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_file_tags_cache(&app_handle)?;
    let map = guard
        .as_mut()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;
    if tags.is_empty() {
        map.remove(&path);
    } else {
        map.insert(path, tags);
    }
    flush_file_tags_to_disk(&app_handle, &guard)?;
    Ok(())
}

/// Return all tags for a batch of file paths in one read (avoids N+1 I/O).
#[tauri::command]
pub async fn get_file_tags_batch(
    paths: Vec<String>,
    app_handle: tauri::AppHandle,
) -> HashMap<String, Vec<FileTag>> {
    let guard = match ensure_file_tags_cache(&app_handle) {
        Ok(g) => g,
        Err(_) => return HashMap::new(),
    };
    let cached_map = match guard.as_ref() {
        Some(m) => m,
        None => return HashMap::new(),
    };
    let mut result = HashMap::new();
    for path in paths {
        if let Some(tags) = cached_map.get(&path) {
            if !tags.is_empty() {
                result.insert(path, tags.clone());
            }
        }
    }
    result
}

/// Return all unique tags ever used across all files (deduped by name+color).
#[tauri::command]
pub async fn get_all_file_tags(app_handle: tauri::AppHandle) -> Vec<FileTag> {
    let guard = match ensure_file_tags_cache(&app_handle) {
        Ok(g) => g,
        Err(_) => return Vec::new(),
    };
    let cached_map = match guard.as_ref() {
        Some(m) => m,
        None => return Vec::new(),
    };
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut result: Vec<FileTag> = Vec::new();
    for tags in cached_map.values() {
        for tag in tags {
            let key = format!("{}:{}", tag.name, tag.color);
            if seen.insert(key) {
                result.push(tag.clone());
            }
        }
    }
    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

/// Remove all tags from a specific file.
#[tauri::command]
pub async fn remove_all_tags_from_file(
    path: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_file_tags_cache(&app_handle)?;
    let map = guard
        .as_mut()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;
    map.remove(&path);
    flush_file_tags_to_disk(&app_handle, &guard)?;
    Ok(())
}

/// Remove a specific tag (by name) from every file that has it.
#[tauri::command]
pub async fn remove_tag_globally(
    tag_name: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_file_tags_cache(&app_handle)?;
    let map = guard
        .as_mut()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;
    for tags in map.values_mut() {
        tags.retain(|t| t.name != tag_name);
    }
    // Remove entries that became empty
    map.retain(|_, v| !v.is_empty());
    flush_file_tags_to_disk(&app_handle, &guard)?;
    Ok(())
}

// ─── Batch Tag Operations ─────────────────────────────────────────────────────

/// Add tags to multiple file paths at once. Existing tags on each file are preserved;
/// only tags not yet present (by name) are appended.
#[tauri::command]
pub async fn batch_add_tags(
    paths: Vec<String>,
    tags: Vec<FileTag>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_file_tags_cache(&app_handle)?;
    let map = guard
        .as_mut()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;
    for path in paths {
        let entry = map.entry(path).or_default();
        for tag in &tags {
            if !entry.iter().any(|t| t.name == tag.name) {
                entry.push(tag.clone());
            }
        }
    }
    flush_file_tags_to_disk(&app_handle, &guard)?;
    Ok(())
}

/// Remove tags (by name) from multiple file paths at once.
#[tauri::command]
pub async fn batch_remove_tags(
    paths: Vec<String>,
    tag_names: Vec<String>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_file_tags_cache(&app_handle)?;
    let map = guard
        .as_mut()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;
    for path in &paths {
        if let Some(tags) = map.get_mut(path) {
            tags.retain(|t| !tag_names.contains(&t.name));
            if tags.is_empty() {
                map.remove(path);
            }
        }
    }
    flush_file_tags_to_disk(&app_handle, &guard)?;
    Ok(())
}

// ─── Tag Categories (Hierarchical Tags) ──────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TagCategory {
    pub id: String,
    pub name: String,
    pub color: String,
    pub parent_id: Option<String>,
}

fn tag_categories_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(dir.join("tag_categories.json"))
}

/// Load tag categories from disk (no cache).
fn load_tag_categories_from_disk(
    app_handle: &tauri::AppHandle,
) -> Result<Vec<TagCategory>, String> {
    let path = tag_categories_path(app_handle)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read tag categories: {}", e))?;
    let categories: Vec<TagCategory> = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse tag categories: {}", e))?;
    Ok(categories)
}

/// Acquire the cache lock and ensure the tag-categories cache is populated.
fn ensure_tag_categories_cache(
    app_handle: &tauri::AppHandle,
) -> Result<MutexGuard<'static, Option<Vec<TagCategory>>>, String> {
    let mut guard = TAG_CATEGORIES_CACHE
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        let data = load_tag_categories_from_disk(app_handle)?;
        *guard = Some(data);
    }
    Ok(guard)
}

/// Persist tag categories to disk from the live cache guard.
fn flush_tag_categories_to_disk(
    app_handle: &tauri::AppHandle,
    guard: &MutexGuard<'static, Option<Vec<TagCategory>>>,
) -> Result<(), String> {
    let categories = guard
        .as_ref()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;
    let path = tag_categories_path(app_handle)?;
    let data = serde_json::to_string_pretty(categories)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&path, data).map_err(|e| format!("Failed to write tag categories: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_tag_categories(app_handle: tauri::AppHandle) -> Vec<TagCategory> {
    let guard = match ensure_tag_categories_cache(&app_handle) {
        Ok(g) => g,
        Err(_) => return Vec::new(),
    };
    guard.as_ref().cloned().unwrap_or_default()
}

#[tauri::command]
pub async fn add_tag_category(
    name: String,
    color: String,
    parent_id: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<TagCategory, String> {
    let category = TagCategory {
        id: generate_id(),
        name,
        color,
        parent_id,
    };
    let mut guard = ensure_tag_categories_cache(&app_handle)?;
    let categories = guard
        .as_mut()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;
    categories.push(category.clone());
    flush_tag_categories_to_disk(&app_handle, &guard)?;
    Ok(category)
}

#[tauri::command]
pub async fn update_tag_category(
    id: String,
    name: Option<String>,
    color: Option<String>,
    parent_id: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_tag_categories_cache(&app_handle)?;
    let categories = guard
        .as_mut()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;
    let cat = categories
        .iter_mut()
        .find(|c| c.id == id)
        .ok_or("Tag category not found")?;
    if let Some(n) = name {
        cat.name = n;
    }
    if let Some(c) = color {
        cat.color = c;
    }
    // Allow setting parent_id (pass Some("id") or None to make it a root)
    cat.parent_id = parent_id;
    flush_tag_categories_to_disk(&app_handle, &guard)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_tag_category(id: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut guard = ensure_tag_categories_cache(&app_handle)?;
    let categories = guard
        .as_mut()
        .ok_or_else(|| "Storage cache not initialized".to_string())?;
    // Also orphan children by setting their parent_id to None
    for cat in categories.iter_mut() {
        if cat.parent_id.as_deref() == Some(&id) {
            cat.parent_id = None;
        }
    }
    categories.retain(|c| c.id != id);
    flush_tag_categories_to_disk(&app_handle, &guard)?;
    Ok(())
}
