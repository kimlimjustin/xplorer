// Storage sub-module: File Notes & File Annotations
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

static FILE_NOTES_CACHE: LazyLock<Mutex<Option<HashMap<String, Vec<FileNote>>>>> =
    LazyLock::new(|| Mutex::new(None));

static FILE_ANNOTATIONS_CACHE: LazyLock<Mutex<Option<HashMap<String, Vec<FileAnnotation>>>>> =
    LazyLock::new(|| Mutex::new(None));

// ─── File Notes ──────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileNote {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NoteSearchResult {
    pub path: String,
    pub note: FileNote,
}

fn file_notes_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(dir.join("file_notes.json"))
}

/// Load notes from disk (no cache).
fn load_file_notes_from_disk(
    app_handle: &tauri::AppHandle,
) -> Result<HashMap<String, Vec<FileNote>>, String> {
    let path = file_notes_path(app_handle)?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let data = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file notes: {}", e))?;
    let map: HashMap<String, Vec<FileNote>> =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse file notes: {}", e))?;
    Ok(map)
}

/// Acquire the cache lock and ensure it is populated from disk.
fn ensure_file_notes_cache(
    app_handle: &tauri::AppHandle,
) -> Result<MutexGuard<'static, Option<HashMap<String, Vec<FileNote>>>>, String> {
    let mut guard = FILE_NOTES_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        let data = load_file_notes_from_disk(app_handle)?;
        *guard = Some(data);
    }
    Ok(guard)
}

/// Persist notes to disk directly from the cache guard (no extra clone).
fn flush_file_notes_to_disk(
    app_handle: &tauri::AppHandle,
    guard: &MutexGuard<'static, Option<HashMap<String, Vec<FileNote>>>>,
) -> Result<(), String> {
    let map = guard.as_ref().ok_or_else(|| "Storage cache not initialized".to_string())?;
    let path = file_notes_path(app_handle)?;
    let data =
        serde_json::to_string_pretty(map).map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&path, data).map_err(|e| format!("Failed to write file notes: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_file_notes(path: String, app_handle: tauri::AppHandle) -> Vec<FileNote> {
    let guard = match ensure_file_notes_cache(&app_handle) {
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
pub async fn add_file_note(
    path: String,
    title: String,
    content: String,
    app_handle: tauri::AppHandle,
) -> Result<FileNote, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let note = FileNote {
        id: generate_id(),
        title,
        content,
        created_at: now.clone(),
        updated_at: now,
    };
    let mut guard = ensure_file_notes_cache(&app_handle)?;
    let map = guard.as_mut().ok_or_else(|| "Storage cache not initialized".to_string())?;
    map.entry(path).or_default().push(note.clone());
    flush_file_notes_to_disk(&app_handle, &guard)?;
    Ok(note)
}

#[tauri::command]
pub async fn update_file_note(
    path: String,
    note_id: String,
    title: String,
    content: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_file_notes_cache(&app_handle)?;
    let map = guard.as_mut().ok_or_else(|| "Storage cache not initialized".to_string())?;
    let notes = map.get_mut(&path).ok_or("No notes found for this path")?;
    let note = notes
        .iter_mut()
        .find(|n| n.id == note_id)
        .ok_or("Note not found")?;
    note.title = title;
    note.content = content;
    note.updated_at = chrono::Utc::now().to_rfc3339();
    flush_file_notes_to_disk(&app_handle, &guard)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_file_note(
    path: String,
    note_id: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_file_notes_cache(&app_handle)?;
    let map = guard.as_mut().ok_or_else(|| "Storage cache not initialized".to_string())?;
    if let Some(notes) = map.get_mut(&path) {
        notes.retain(|n| n.id != note_id);
        if notes.is_empty() {
            map.remove(&path);
        }
    }
    flush_file_notes_to_disk(&app_handle, &guard)?;
    Ok(())
}

#[tauri::command]
pub async fn get_all_notes(
    app_handle: tauri::AppHandle,
) -> HashMap<String, Vec<FileNote>> {
    let guard = match ensure_file_notes_cache(&app_handle) {
        Ok(g) => g,
        Err(_) => return HashMap::new(),
    };
    guard.as_ref().cloned().unwrap_or_default()
}

#[tauri::command]
pub async fn search_notes(
    query: String,
    app_handle: tauri::AppHandle,
) -> Vec<NoteSearchResult> {
    let guard = match ensure_file_notes_cache(&app_handle) {
        Ok(g) => g,
        Err(_) => return Vec::new(),
    };
    let cached_map = match guard.as_ref() {
        Some(m) => m,
        None => return Vec::new(),
    };
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();
    for (path, notes) in cached_map {
        for note in notes {
            if note.title.to_lowercase().contains(&query_lower)
                || note.content.to_lowercase().contains(&query_lower)
            {
                results.push(NoteSearchResult {
                    path: path.clone(),
                    note: note.clone(),
                });
            }
        }
    }
    results
}

// ─── Batch Notes Operations ───────────────────────────────────────────────────

/// Set or append a note to multiple files at once.
///
/// `mode` must be `"replace"` or `"append"`.
///   - **replace**: each file gets a single note with the given title/content,
///     replacing all existing notes.
///   - **append**: a new note is appended to each file's existing notes.
#[tauri::command]
pub async fn batch_set_notes(
    paths: Vec<String>,
    title: String,
    content: String,
    mode: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    let base_id = chrono::Utc::now().timestamp_millis();
    let mut guard = ensure_file_notes_cache(&app_handle)?;
    let map = guard.as_mut().ok_or_else(|| "Storage cache not initialized".to_string())?;

    for (idx, path) in paths.into_iter().enumerate() {
        let note_id = format!("{}-{}", base_id, idx);
        match mode.as_str() {
            "replace" => {
                let note = FileNote {
                    id: note_id,
                    title: title.clone(),
                    content: content.clone(),
                    created_at: now.clone(),
                    updated_at: now.clone(),
                };
                map.insert(path, vec![note]);
            }
            "append" => {
                let note = FileNote {
                    id: note_id,
                    title: title.clone(),
                    content: content.clone(),
                    created_at: now.clone(),
                    updated_at: now.clone(),
                };
                map.entry(path).or_default().push(note);
            }
            _ => return Err(format!("Invalid mode '{}'. Must be 'replace' or 'append'.", mode)),
        }
    }

    flush_file_notes_to_disk(&app_handle, &guard)?;
    Ok(())
}

// ─── File Annotations ────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileAnnotation {
    pub id: String,
    pub text: String,
    pub author: String,
    pub created_at: String,
    pub resolved: bool,
}

fn file_annotations_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(dir.join("file_annotations.json"))
}

/// Load annotations from disk (no cache).
fn load_file_annotations_from_disk(
    app_handle: &tauri::AppHandle,
) -> Result<HashMap<String, Vec<FileAnnotation>>, String> {
    let path = file_annotations_path(app_handle)?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let data = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file annotations: {}", e))?;
    let map: HashMap<String, Vec<FileAnnotation>> = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse file annotations: {}", e))?;
    Ok(map)
}

/// Acquire the annotations cache lock and ensure it is populated from disk.
fn ensure_file_annotations_cache(
    app_handle: &tauri::AppHandle,
) -> Result<MutexGuard<'static, Option<HashMap<String, Vec<FileAnnotation>>>>, String> {
    let mut guard = FILE_ANNOTATIONS_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        let data = load_file_annotations_from_disk(app_handle)?;
        *guard = Some(data);
    }
    Ok(guard)
}

/// Persist annotations to disk directly from the cache guard.
fn flush_file_annotations_to_disk(
    app_handle: &tauri::AppHandle,
    guard: &MutexGuard<'static, Option<HashMap<String, Vec<FileAnnotation>>>>,
) -> Result<(), String> {
    let map = guard.as_ref().ok_or_else(|| "Storage cache not initialized".to_string())?;
    let path = file_annotations_path(app_handle)?;
    let data =
        serde_json::to_string_pretty(map).map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&path, data)
        .map_err(|e| format!("Failed to write file annotations: {}", e))?;
    Ok(())
}

fn get_system_username() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("USERNAME").unwrap_or_else(|_| "User".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("USER").unwrap_or_else(|_| "User".to_string())
    }
}

#[tauri::command]
pub async fn get_file_annotations(
    path: String,
    app_handle: tauri::AppHandle,
) -> Vec<FileAnnotation> {
    let guard = match ensure_file_annotations_cache(&app_handle) {
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
pub async fn add_file_annotation(
    path: String,
    text: String,
    app_handle: tauri::AppHandle,
) -> Result<FileAnnotation, String> {
    let annotation = FileAnnotation {
        id: generate_id(),
        text,
        author: get_system_username(),
        created_at: chrono::Utc::now().to_rfc3339(),
        resolved: false,
    };
    let mut guard = ensure_file_annotations_cache(&app_handle)?;
    let map = guard.as_mut().ok_or_else(|| "Storage cache not initialized".to_string())?;
    map.entry(path).or_default().push(annotation.clone());
    flush_file_annotations_to_disk(&app_handle, &guard)?;
    Ok(annotation)
}

#[tauri::command]
pub async fn toggle_annotation_resolved(
    path: String,
    annotation_id: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_file_annotations_cache(&app_handle)?;
    let map = guard.as_mut().ok_or_else(|| "Storage cache not initialized".to_string())?;
    let annotations = map
        .get_mut(&path)
        .ok_or("No annotations found for this path")?;
    let annotation = annotations
        .iter_mut()
        .find(|a| a.id == annotation_id)
        .ok_or("Annotation not found")?;
    annotation.resolved = !annotation.resolved;
    flush_file_annotations_to_disk(&app_handle, &guard)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_file_annotation(
    path: String,
    annotation_id: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_file_annotations_cache(&app_handle)?;
    let map = guard.as_mut().ok_or_else(|| "Storage cache not initialized".to_string())?;
    if let Some(annotations) = map.get_mut(&path) {
        annotations.retain(|a| a.id != annotation_id);
        if annotations.is_empty() {
            map.remove(&path);
        }
    }
    flush_file_annotations_to_disk(&app_handle, &guard)?;
    Ok(())
}

#[tauri::command]
pub async fn get_all_annotations(
    app_handle: tauri::AppHandle,
) -> HashMap<String, Vec<FileAnnotation>> {
    let guard = match ensure_file_annotations_cache(&app_handle) {
        Ok(g) => g,
        Err(_) => return HashMap::new(),
    };
    guard.as_ref().cloned().unwrap_or_default()
}
