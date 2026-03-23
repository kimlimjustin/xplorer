use std::fs;
use std::path::Path;
use tauri::command;
use crate::operations::types::*;
use crate::operations::validate_file_path;

#[command]
pub async fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(&path);
    
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    
    let entries = fs::read_dir(path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    let mut files = Vec::new();
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|e| format!("Failed to get metadata: {}", e))?;
        
        let name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();
        
        let file_type = crate::file_lib::get_file_type(&path);
        let mime_type = crate::file_lib::get_mime_type(&path);
        
        let is_readonly = metadata.permissions().readonly();

        let file_entry = FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified: system_time_to_timestamp(metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH)),
            file_type,
            mime_type,
            is_readonly,
        };
        
        files.push(file_entry);
    }
    
    // Sort: directories first, then files
    files.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(files)
}

#[command]
pub async fn is_dir(path: String) -> Result<bool, String> {
    let path = Path::new(&path);
    Ok(path.is_dir())
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
    
    fs::remove_dir_all(path)
        .map_err(|e| format!("Failed to remove directory: {}", e))?;
    
    Ok(())
}

#[command]
pub async fn create_dir_recursive(path: String) -> Result<(), String> {
    validate_file_path(&path)?;
    let path = Path::new(&path);
    
    fs::create_dir_all(path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    Ok(())
}

#[command]
pub async fn get_dir_size(path: String) -> Result<DirectorySize, String> {
    let path = Path::new(&path);
    
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    
    let mut total_size = 0u64;
    let mut file_count = 0usize;
    let mut dir_count = 0usize;
    
    fn calculate_size(dir: &Path, total_size: &mut u64, file_count: &mut usize, dir_count: &mut usize) -> Result<(), String> {
        for entry in fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))? {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let path = entry.path();
            
            if path.is_dir() {
                *dir_count += 1;
                calculate_size(&path, total_size, file_count, dir_count)?;
            } else {
                *file_count += 1;
                if let Ok(metadata) = entry.metadata() {
                    *total_size += metadata.len();
                }
            }
        }
        Ok(())
    }
    
    calculate_size(path, &mut total_size, &mut file_count, &mut dir_count)?;
    
    Ok(DirectorySize {
        total_size,
        file_count,
        dir_count,
    })
}