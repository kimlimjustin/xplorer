use std::path::Path;

use tauri::command;
use trash;
use crate::operations::types::*;

#[command]
pub async fn move_to_trash(path: String) -> Result<(), String> {
    let path_obj = Path::new(&path);
    
    if !path_obj.exists() {
        return Err("File or directory does not exist".to_string());
    }
    
    trash::delete(path_obj)
        .map_err(|e| format!("Failed to move to trash: {}", e))?;
    
    Ok(())
}

#[command]
pub async fn get_trash_items() -> Result<Vec<TrashItem>, String> {
    #[cfg(windows)]
    {
        // Use the Windows-specific recycle bin implementation
        crate::windows_recycle_bin::get_recycle_bin_items()
    }
    
    #[cfg(target_os = "macos")]
    {
        // On macOS, trash items are in ~/.Trash
        use std::fs;
        let mut trash_items = Vec::new();
        
        if let Some(home_dir) = dirs::home_dir() {
            let trash_path = home_dir.join(".Trash");
            if let Ok(entries) = fs::read_dir(trash_path) {
                for entry in entries.flatten() {
                    if let Ok(metadata) = entry.metadata() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        let modified = metadata.modified()
                            .unwrap_or(SystemTime::UNIX_EPOCH)
                            .duration_since(SystemTime::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs();
                            
                        trash_items.push(TrashItem {
                            name: name.clone(),
                            original_path: entry.path().to_string_lossy().to_string(),
                            deletion_date: modified,
                            size: if metadata.is_dir() { 0 } else { metadata.len() },
                            is_dir: metadata.is_dir(),
                        });
                    }
                }
            }
        }
        Ok(trash_items)
    }
    
    #[cfg(target_os = "linux")]
    {
        // On Linux, trash items are typically in ~/.local/share/Trash
        use std::fs;
        let mut trash_items = Vec::new();
        
        if let Some(home_dir) = dirs::home_dir() {
            let trash_files_path = home_dir.join(".local/share/Trash/files");
            if let Ok(entries) = fs::read_dir(trash_files_path) {
                for entry in entries.flatten() {
                    if let Ok(metadata) = entry.metadata() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        let modified = metadata.modified()
                            .unwrap_or(SystemTime::UNIX_EPOCH)
                            .duration_since(SystemTime::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs();
                            
                        trash_items.push(TrashItem {
                            name: name.clone(),
                            original_path: entry.path().to_string_lossy().to_string(),
                            deletion_date: modified,
                            size: if metadata.is_dir() { 0 } else { metadata.len() },
                            is_dir: metadata.is_dir(),
                        });
                    }
                }
            }
        }
        Ok(trash_items)
    }
    
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        Err("Trash listing not supported on this platform".to_string())
    }
}

#[command]
pub async fn restore_trash_item(item_path: String) -> Result<String, String> {
    #[cfg(windows)]
    {
        crate::windows_recycle_bin::restore_from_recycle_bin(&item_path)
    }
    
    #[cfg(not(windows))]
    {
        Err("Restore from trash is currently only supported on Windows".to_string())
    }
}

#[command]
pub async fn empty_recycle_bin() -> Result<usize, String> {
    #[cfg(windows)]
    {
        crate::windows_recycle_bin::empty_recycle_bin()
    }
    
    #[cfg(not(windows))]
    {
        Err("Empty trash is currently only supported on Windows".to_string())
    }
}

#[command]
pub async fn permanently_delete_trash_item(item_path: String) -> Result<(), String> {
    // Permanently delete a file from the recycle bin
    let path = std::path::Path::new(&item_path);
    
    if !path.exists() {
        return Err("File no longer exists".to_string());
    }
    
    std::fs::remove_file(path)
        .or_else(|_| std::fs::remove_dir_all(path))
        .map_err(|e| format!("Failed to permanently delete item: {}", e))?;
        
    // Also try to remove corresponding $I file if this is a $R file
    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
        if filename.starts_with("$R") {
            let i_file_name = filename.replace("$R", "$I");
            if let Some(parent) = path.parent() {
                let i_file_path = parent.join(i_file_name);
                let _ = std::fs::remove_file(i_file_path); // Ignore errors
            }
        }
    }
    
    Ok(())
}


#[command]
pub async fn open_recycle_bin() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("shell:RecycleBinFolder")
            .spawn()
            .map_err(|e| format!("Failed to open Recycle Bin: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("~/.Trash")
            .spawn()
            .map_err(|e| format!("Failed to open Trash: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        // Try to open with the default file manager
        let trash_dir = std::env::var("HOME").unwrap_or_default() + "/.local/share/Trash/files";
        std::process::Command::new("xdg-open")
            .arg(trash_dir)
            .spawn()
            .map_err(|e| format!("Failed to open Trash: {}", e))?;
    }
    
    Ok(())
}