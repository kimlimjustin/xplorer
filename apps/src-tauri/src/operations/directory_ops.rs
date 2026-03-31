use crate::operations::types::*;
use crate::operations::validate_file_path;
use rayon::prelude::*;
use std::fs;
use std::path::Path;
use std::sync::LazyLock;
use tauri::command;
use tokio::sync::Semaphore;

static FILE_IO_SEMAPHORE: LazyLock<Semaphore> =
    LazyLock::new(|| Semaphore::new(num_cpus::get().max(4) * 2));

#[command]
pub async fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let _permit = FILE_IO_SEMAPHORE
        .acquire()
        .await
        .map_err(|e| e.to_string())?;
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&path);

        if !path.exists() {
            return Err("Directory does not exist".to_string());
        }

        if !path.is_dir() {
            return Err("Path is not a directory".to_string());
        }

        let raw_entries: Vec<_> = fs::read_dir(path)
            .map_err(|e| format!("Failed to read directory: {}", e))?
            .filter_map(|e| e.ok())
            .collect();

        let mut files: Vec<FileEntry> = raw_entries
            .par_iter()
            .filter_map(|entry| {
                let path = entry.path();
                let metadata = entry.metadata().ok()?;
                let name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Unknown")
                    .to_string();
                let is_dir = metadata.is_dir();
                let file_type = crate::file_lib::get_file_type(&path, is_dir);
                let mime_type = crate::file_lib::get_mime_type(&path);
                let is_readonly = metadata.permissions().readonly();
                Some(FileEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_dir,
                    size: metadata.len(),
                    modified: system_time_to_timestamp(
                        metadata
                            .modified()
                            .unwrap_or(std::time::SystemTime::UNIX_EPOCH),
                    ),
                    file_type,
                    mime_type,
                    is_readonly,
                })
            })
            .collect();

        // Sort: directories first, then files
        files.sort_by_cached_key(|f| (!f.is_dir, f.name.to_lowercase()));

        Ok(files)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn is_dir(path: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&path);
        Ok(path.is_dir())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_files_in_directory(path: String) -> Result<Vec<FileEntry>, String> {
    read_directory(path).await
}

#[command]
pub async fn remove_dir(path: String) -> Result<(), String> {
    validate_file_path(&path)?;
    let path = Path::new(&path);

    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }

    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    fs::remove_dir_all(path).map_err(|e| format!("Failed to remove directory: {}", e))?;

    Ok(())
}

#[command]
pub async fn create_dir_recursive(path: String) -> Result<(), String> {
    validate_file_path(&path)?;
    let path = Path::new(&path);

    fs::create_dir_all(path).map_err(|e| format!("Failed to create directory: {}", e))?;

    Ok(())
}

#[command]
pub async fn get_dir_size(path: String) -> Result<DirectorySize, String> {
    let _permit = FILE_IO_SEMAPHORE
        .acquire()
        .await
        .map_err(|e| e.to_string())?;
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&path);

        if !path.exists() {
            return Err("Directory does not exist".to_string());
        }

        if !path.is_dir() {
            return Err("Path is not a directory".to_string());
        }

        // Use jwalk for parallel directory walking
        let mut total_size: u64 = 0;
        let mut file_count: usize = 0;
        let mut dir_count: usize = 0;

        for entry in jwalk::WalkDir::new(path)
            .skip_hidden(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() {
                file_count += 1;
                if let Ok(meta) = entry.metadata() {
                    total_size += meta.len();
                }
            } else if entry.file_type().is_dir() {
                // Don't count the root directory itself
                if entry.depth() > 0 {
                    dir_count += 1;
                }
            }
        }

        Ok(DirectorySize {
            total_size,
            file_count,
            dir_count,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
