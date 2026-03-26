use chrono::Local;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex, MutexGuard};
use tauri::Manager;

static VERSIONING_CONFIG_CACHE: LazyLock<Mutex<Option<VersioningConfig>>> =
    LazyLock::new(|| Mutex::new(None));

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersion {
    pub version_number: u32,
    pub timestamp: String,
    pub size: u64,
    pub path: String,
    pub original_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersioningConfig {
    pub enabled_dirs: Vec<String>,
    pub max_versions_per_file: u32,
    pub auto_version_on_save: bool,
}

impl Default for VersioningConfig {
    fn default() -> Self {
        Self {
            enabled_dirs: Vec::new(),
            max_versions_per_file: 10,
            auto_version_on_save: false,
        }
    }
}

fn config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(dir.join("versioning_config.json"))
}

fn versions_base_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let versions_dir = dir.join("versions");
    fs::create_dir_all(&versions_dir)
        .map_err(|e| format!("Failed to create versions dir: {}", e))?;
    Ok(versions_dir)
}

fn hash_path(path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)[..16].to_string()
}

fn get_version_dir_for_file(
    app_handle: &tauri::AppHandle,
    file_path: &str,
) -> Result<PathBuf, String> {
    let file = Path::new(file_path);
    let parent = file
        .parent()
        .ok_or_else(|| "Cannot determine parent directory".to_string())?;
    let parent_str = parent.to_string_lossy().to_string();
    let hashed = hash_path(&parent_str);
    let base = versions_base_dir(app_handle)?;
    let dir = base.join(hashed);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create version dir: {}", e))?;
    Ok(dir)
}

fn load_config_from_disk(app_handle: &tauri::AppHandle) -> Result<VersioningConfig, String> {
    let path = config_path(app_handle)?;
    if !path.exists() {
        return Ok(VersioningConfig::default());
    }
    let data = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read versioning config: {}", e))?;
    serde_json::from_str(&data).map_err(|e| format!("Failed to parse versioning config: {}", e))
}

fn ensure_config_cache(
    app_handle: &tauri::AppHandle,
) -> Result<MutexGuard<'static, Option<VersioningConfig>>, String> {
    let mut guard = VERSIONING_CONFIG_CACHE
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        let config = load_config_from_disk(app_handle)?;
        *guard = Some(config);
    }
    Ok(guard)
}

fn flush_config_to_disk(
    app_handle: &tauri::AppHandle,
    guard: &MutexGuard<'static, Option<VersioningConfig>>,
) -> Result<(), String> {
    let config = guard
        .as_ref()
        .ok_or_else(|| "Config cache not initialized".to_string())?;
    let path = config_path(app_handle)?;
    let data = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&path, data).map_err(|e| format!("Failed to write versioning config: {}", e))?;
    Ok(())
}

fn is_directory_versioned(app_handle: &tauri::AppHandle, directory: &str) -> Result<bool, String> {
    let guard = ensure_config_cache(app_handle)?;
    let config = guard
        .as_ref()
        .ok_or_else(|| "Config cache not initialized".to_string())?;
    let normalized = directory.replace('\\', "/");
    Ok(config.enabled_dirs.iter().any(|d| {
        let d_norm = d.replace('\\', "/");
        normalized.starts_with(&d_norm) || d_norm == normalized
    }))
}

fn get_next_version_number(version_dir: &Path, original_name: &str) -> u32 {
    let prefix = format!("{}.v", original_name);
    let mut max_version: u32 = 0;

    if let Ok(entries) = fs::read_dir(version_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(&prefix) {
                if let Some(rest) = name.strip_prefix(&prefix) {
                    if let Some(dot_pos) = rest.find('.') {
                        if let Ok(num) = rest[..dot_pos].parse::<u32>() {
                            if num > max_version {
                                max_version = num;
                            }
                        }
                    }
                }
            }
        }
    }

    max_version + 1
}

fn enforce_max_versions(
    version_dir: &Path,
    original_name: &str,
    max_versions: u32,
) -> Result<(), String> {
    let mut versions = collect_versions(version_dir, original_name)?;
    versions.sort_by_key(|v| v.version_number);

    while versions.len() as u32 > max_versions {
        if let Some(oldest) = versions.first() {
            fs::remove_file(&oldest.path)
                .map_err(|e| format!("Failed to remove old version: {}", e))?;
            versions.remove(0);
        } else {
            break;
        }
    }

    Ok(())
}

fn collect_versions(version_dir: &Path, original_name: &str) -> Result<Vec<FileVersion>, String> {
    let prefix = format!("{}.v", original_name);
    let mut versions = Vec::new();

    if !version_dir.exists() {
        return Ok(versions);
    }

    let entries =
        fs::read_dir(version_dir).map_err(|e| format!("Failed to read version dir: {}", e))?;

    for entry in entries.filter_map(|e| e.ok()) {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with(&prefix) {
            continue;
        }

        let rest = match name.strip_prefix(&prefix) {
            Some(r) => r,
            None => continue,
        };

        let dot_pos = match rest.find('.') {
            Some(p) => p,
            None => continue,
        };

        let version_number = match rest[..dot_pos].parse::<u32>() {
            Ok(n) => n,
            Err(_) => continue,
        };

        let timestamp = rest[dot_pos + 1..].to_string();

        let metadata = fs::metadata(entry.path())
            .map_err(|e| format!("Failed to read version metadata: {}", e))?;

        versions.push(FileVersion {
            version_number,
            timestamp,
            size: metadata.len(),
            path: entry.path().to_string_lossy().to_string(),
            original_name: original_name.to_string(),
        });
    }

    versions.sort_by(|a, b| b.version_number.cmp(&a.version_number));
    Ok(versions)
}

#[tauri::command]
pub async fn enable_versioning(
    directory: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let dir_path = Path::new(&directory);
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("Directory does not exist: {}", directory));
    }

    let mut guard = ensure_config_cache(&app_handle)?;
    let config = guard
        .as_mut()
        .ok_or_else(|| "Config cache not initialized".to_string())?;

    let normalized = directory.replace('\\', "/");
    if !config
        .enabled_dirs
        .iter()
        .any(|d| d.replace('\\', "/") == normalized)
    {
        config.enabled_dirs.push(directory);
    }
    flush_config_to_disk(&app_handle, &guard)?;
    Ok(())
}

#[tauri::command]
pub async fn disable_versioning(
    directory: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = ensure_config_cache(&app_handle)?;
    let config = guard
        .as_mut()
        .ok_or_else(|| "Config cache not initialized".to_string())?;

    let normalized = directory.replace('\\', "/");
    config
        .enabled_dirs
        .retain(|d| d.replace('\\', "/") != normalized);
    flush_config_to_disk(&app_handle, &guard)?;
    Ok(())
}

#[tauri::command]
pub async fn create_version(
    file_path: String,
    app_handle: tauri::AppHandle,
) -> Result<FileVersion, String> {
    let src = Path::new(&file_path);
    if !src.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }
    if src.is_dir() {
        return Err("Cannot version a directory".to_string());
    }

    let original_name = src
        .file_name()
        .ok_or_else(|| "Cannot determine file name".to_string())?
        .to_string_lossy()
        .to_string();

    let version_dir = get_version_dir_for_file(&app_handle, &file_path)?;
    let version_number = get_next_version_number(&version_dir, &original_name);
    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();

    let version_filename = format!("{}.v{}.{}", original_name, version_number, timestamp);
    let version_path = version_dir.join(&version_filename);

    fs::copy(src, &version_path).map_err(|e| format!("Failed to create version: {}", e))?;

    let metadata = fs::metadata(&version_path)
        .map_err(|e| format!("Failed to read version metadata: {}", e))?;

    let guard = ensure_config_cache(&app_handle)?;
    let max_versions = guard
        .as_ref()
        .map(|c| c.max_versions_per_file)
        .unwrap_or(10);
    drop(guard);

    enforce_max_versions(&version_dir, &original_name, max_versions)?;

    Ok(FileVersion {
        version_number,
        timestamp,
        size: metadata.len(),
        path: version_path.to_string_lossy().to_string(),
        original_name,
    })
}

#[tauri::command]
pub async fn list_versions(
    file_path: String,
    app_handle: tauri::AppHandle,
) -> Result<Vec<FileVersion>, String> {
    let src = Path::new(&file_path);
    let original_name = src
        .file_name()
        .ok_or_else(|| "Cannot determine file name".to_string())?
        .to_string_lossy()
        .to_string();

    let version_dir = get_version_dir_for_file(&app_handle, &file_path)?;
    collect_versions(&version_dir, &original_name)
}

#[tauri::command]
pub async fn restore_version(
    file_path: String,
    version_number: u32,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let src = Path::new(&file_path);
    let original_name = src
        .file_name()
        .ok_or_else(|| "Cannot determine file name".to_string())?
        .to_string_lossy()
        .to_string();

    let version_dir = get_version_dir_for_file(&app_handle, &file_path)?;
    let versions = collect_versions(&version_dir, &original_name)?;

    let version = versions
        .iter()
        .find(|v| v.version_number == version_number)
        .ok_or_else(|| format!("Version {} not found", version_number))?;

    let version_src = Path::new(&version.path);
    if !version_src.exists() {
        return Err(format!("Version file missing: {}", version.path));
    }

    if src.exists() {
        create_version(file_path.clone(), app_handle.clone()).await?;
    }

    let dest_dir = src.parent();
    if let Some(parent) = dest_dir {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    }

    fs::copy(version_src, src).map_err(|e| format!("Failed to restore version: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_version(
    file_path: String,
    version_number: u32,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let src = Path::new(&file_path);
    let original_name = src
        .file_name()
        .ok_or_else(|| "Cannot determine file name".to_string())?
        .to_string_lossy()
        .to_string();

    let version_dir = get_version_dir_for_file(&app_handle, &file_path)?;
    let versions = collect_versions(&version_dir, &original_name)?;

    let version = versions
        .iter()
        .find(|v| v.version_number == version_number)
        .ok_or_else(|| format!("Version {} not found", version_number))?;

    fs::remove_file(&version.path).map_err(|e| format!("Failed to delete version: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_versioning_config(
    app_handle: tauri::AppHandle,
) -> Result<VersioningConfig, String> {
    let guard = ensure_config_cache(&app_handle)?;
    let config = guard
        .as_ref()
        .ok_or_else(|| "Config cache not initialized".to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub async fn update_versioning_config(
    config: VersioningConfig,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = VERSIONING_CONFIG_CACHE
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    *guard = Some(config);
    flush_config_to_disk(&app_handle, &guard)?;
    Ok(())
}

#[tauri::command]
pub async fn is_versioning_enabled(
    file_path: String,
    app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    let src = Path::new(&file_path);
    let parent = src
        .parent()
        .ok_or_else(|| "Cannot determine parent directory".to_string())?;
    is_directory_versioned(&app_handle, &parent.to_string_lossy())
}

#[tauri::command]
pub async fn get_version_count(
    file_path: String,
    app_handle: tauri::AppHandle,
) -> Result<u32, String> {
    let src = Path::new(&file_path);
    let original_name = src
        .file_name()
        .ok_or_else(|| "Cannot determine file name".to_string())?
        .to_string_lossy()
        .to_string();

    let version_dir = get_version_dir_for_file(&app_handle, &file_path)?;
    let versions = collect_versions(&version_dir, &original_name)?;
    Ok(versions.len() as u32)
}

#[tauri::command]
pub async fn delete_all_versions(
    file_path: String,
    app_handle: tauri::AppHandle,
) -> Result<u32, String> {
    let src = Path::new(&file_path);
    let original_name = src
        .file_name()
        .ok_or_else(|| "Cannot determine file name".to_string())?
        .to_string_lossy()
        .to_string();

    let version_dir = get_version_dir_for_file(&app_handle, &file_path)?;
    let versions = collect_versions(&version_dir, &original_name)?;
    let count = versions.len() as u32;

    for version in &versions {
        fs::remove_file(&version.path)
            .map_err(|e| format!("Failed to delete version {}: {}", version.version_number, e))?;
    }

    Ok(count)
}

#[tauri::command]
pub async fn read_version_content(
    file_path: String,
    version_number: u32,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let src = Path::new(&file_path);
    let original_name = src
        .file_name()
        .ok_or_else(|| "Cannot determine file name".to_string())?
        .to_string_lossy()
        .to_string();

    let version_dir = get_version_dir_for_file(&app_handle, &file_path)?;
    let versions = collect_versions(&version_dir, &original_name)?;

    let version = versions
        .iter()
        .find(|v| v.version_number == version_number)
        .ok_or_else(|| format!("Version {} not found", version_number))?;

    fs::read_to_string(&version.path).map_err(|e| format!("Failed to read version content: {}", e))
}
