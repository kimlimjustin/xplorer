use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;
use tauri::Emitter;
use tracing::warn;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FolderSizeInfo {
    pub total_size: u64,
    pub file_count: u64,
    pub dir_count: u64,
    pub is_cached: bool,
    pub cache_timestamp: u64,
}

// Cache for folder sizes with timestamps
static FOLDER_SIZE_CACHE: LazyLock<Arc<Mutex<HashMap<String, FolderSizeInfo>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(HashMap::new())));

// Cache expiration time in seconds (5 minutes)
const CACHE_EXPIRATION_SECONDS: u64 = 300;

// Maximum number of entries in the cache before eviction
const CACHE_MAX_ENTRIES: usize = 1000;

/// Helper function to send output to Xplorer's terminal
fn send_terminal_output(app_handle: &tauri::AppHandle, message: &str) {
    if let Err(e) = app_handle.emit("terminal-output", message) {
        warn!("Failed to emit terminal output: {}", e);
    }
}

/// Evict expired entries from the cache. If the cache still exceeds
/// `CACHE_MAX_ENTRIES` after removing expired entries, remove the oldest
/// entries until it fits within the limit.
fn evict_cache(cache: &mut HashMap<String, FolderSizeInfo>) {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Remove expired entries
    cache.retain(|_, info| now - info.cache_timestamp < CACHE_EXPIRATION_SECONDS);

    // If still over capacity, remove oldest entries
    if cache.len() > CACHE_MAX_ENTRIES {
        let mut entries: Vec<(String, u64)> = cache
            .iter()
            .map(|(k, v)| (k.clone(), v.cache_timestamp))
            .collect();
        entries.sort_by_key(|(_, ts)| *ts);

        let to_remove = cache.len() - CACHE_MAX_ENTRIES;
        for (key, _) in entries.into_iter().take(to_remove) {
            cache.remove(&key);
        }
    }
}

#[command]
pub async fn calculate_folder_size(
    folder_path: String,
    app_handle: tauri::AppHandle,
) -> Result<FolderSizeInfo, String> {
    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("Path does not exist or is not a directory".to_string());
    }

    send_terminal_output(
        &app_handle,
        &format!("Starting folder size calculation for: {}", folder_path),
    );

    // Check cache first
    {
        let cache = FOLDER_SIZE_CACHE
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if let Some(cached_info) = cache.get(&folder_path) {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();

            // Return cached result if it's not expired
            if now - cached_info.cache_timestamp < CACHE_EXPIRATION_SECONDS {
                send_terminal_output(
                    &app_handle,
                    &format!("Returning cached folder size for: {}", folder_path),
                );
                return Ok(cached_info.clone());
            }
        }
    }

    // Calculate folder size
    let size_info = calculate_directory_size_recursive(path, &app_handle).await?;

    let folder_size_info = FolderSizeInfo {
        total_size: size_info.total_size,
        file_count: size_info.file_count,
        dir_count: size_info.dir_count,
        is_cached: false,
        cache_timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    };

    // Update cache with eviction
    {
        let mut cache = FOLDER_SIZE_CACHE
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        evict_cache(&mut cache);
        cache.insert(folder_path.clone(), folder_size_info.clone());
    }

    send_terminal_output(
        &app_handle,
        &format!(
            "Calculated and cached folder size for: {} - {} bytes",
            folder_path, folder_size_info.total_size
        ),
    );
    Ok(folder_size_info)
}

#[command]
pub async fn get_cached_folder_sizes(
    folder_paths: Vec<String>,
) -> Result<HashMap<String, FolderSizeInfo>, String> {
    let cache = FOLDER_SIZE_CACHE
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let mut result = HashMap::new();
    for path in folder_paths {
        if let Some(cached_info) = cache.get(&path) {
            // Only return if cache is still valid
            if now - cached_info.cache_timestamp < CACHE_EXPIRATION_SECONDS {
                result.insert(path, cached_info.clone());
            }
        }
    }

    Ok(result)
}

#[command]
pub async fn clear_folder_size_cache(app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut cache = FOLDER_SIZE_CACHE
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    cache.clear();
    send_terminal_output(&app_handle, "Folder size cache cleared");
    Ok(())
}

#[derive(Debug)]
struct DirectorySizeResult {
    total_size: u64,
    file_count: u64,
    dir_count: u64,
}

async fn calculate_directory_size_recursive(
    dir_path: &Path,
    app_handle: &tauri::AppHandle,
) -> Result<DirectorySizeResult, String> {
    use std::fs;

    let mut total_size = 0u64;
    let mut file_count = 0u64;
    let mut dir_count = 0u64;

    let entries = fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory {}: {}", dir_path.display(), e))?;

    for entry in entries {
        let entry =
            entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;

        let path = entry.path();
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to get metadata for {}: {}", path.display(), e))?;

        if metadata.is_file() {
            total_size += metadata.len();
            file_count += 1;
        } else if metadata.is_dir() {
            dir_count += 1;

            // Recursively calculate subdirectory size using Box::pin to avoid infinite size
            let recursive_future =
                Box::pin(calculate_directory_size_recursive(&path, app_handle));
            match recursive_future.await {
                Ok(subdir_result) => {
                    total_size += subdir_result.total_size;
                    file_count += subdir_result.file_count;
                    dir_count += subdir_result.dir_count;
                }
                Err(e) => {
                    // Log error but continue with other directories
                    send_terminal_output(
                        app_handle,
                        &format!(
                            "Warning: Failed to calculate size for subdirectory {}: {}",
                            path.display(),
                            e
                        ),
                    );
                }
            }
        }
    }

    Ok(DirectorySizeResult {
        total_size,
        file_count,
        dir_count,
    })
}
