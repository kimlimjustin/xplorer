#[cfg(windows)]
mod inner {
    use crate::operations::TrashItem;
    use std::collections::HashMap;
    use std::path::Path;
    use std::time::SystemTime;

    pub fn get_recycle_bin_items() -> Result<Vec<TrashItem>, String> {
        let mut items = Vec::new();
        let mut processed_files = HashMap::new();

        // Get current user's SID for the recycle bin path
        if let Ok(_user_profile) = std::env::var("USERPROFILE") {
            // Try to find the recycle bin in multiple possible locations
            let possible_recycle_paths = vec![
                // Standard Windows 10/11 location
                "C:\\$Recycle.Bin".to_string(),
                // Alternative locations for different drives
                "D:\\$Recycle.Bin".to_string(),
                "E:\\$Recycle.Bin".to_string(),
                // Legacy RECYCLER (older Windows versions)
                "C:\\RECYCLER".to_string(),
            ];

            for recycle_path in possible_recycle_paths {
                if let Err(_) = scan_recycle_directory(&recycle_path, &mut items, &mut processed_files) {
                    // Continue to next path if this one fails
                    continue;
                }
            }
        }

        // If we couldn't access the recycle bin directly, try alternative approach
        if items.is_empty() {
            // Try to use a more permissive approach
            if let Ok(alternative_items) = get_recycle_bin_alternative() {
                items.extend(alternative_items);
            }
            
            // If still empty, provide a helpful message
            if items.is_empty() {
                return Ok(vec![TrashItem {
                    name: "🗑️ Recycle Bin".to_string(),
                    original_path: "Note: Direct recycle bin access may require administrator privileges. Files moved to trash using Xplorer will still be properly deleted.".to_string(),
                    deletion_date: SystemTime::now()
                        .duration_since(SystemTime::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs(),
                    size: 0,
                    is_dir: false,
                }]);
            }
        }

        Ok(items)
    }

    fn scan_recycle_directory(
        recycle_path: &str, 
        items: &mut Vec<TrashItem>, 
        processed_files: &mut HashMap<String, bool>
    ) -> Result<(), String> {
        let recycle_path_obj = Path::new(recycle_path);
        
        if !recycle_path_obj.exists() {
            return Err(format!("Path does not exist: {}", recycle_path));
        }

        // Try to read the recycle bin directory
        let entries = std::fs::read_dir(recycle_path)
            .map_err(|e| format!("Cannot read directory {}: {}", recycle_path, e))?;

        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    // Each user has their own folder in $Recycle.Bin
                    // Look for files in these subfolders
                    if let Ok(user_entries) = std::fs::read_dir(entry.path()) {
                        for user_entry in user_entries.flatten() {
                            process_recycle_entry(&user_entry, items, processed_files)?;
                        }
                    }
                } else {
                    // Direct files in recycle bin (legacy)
                    process_recycle_entry(&entry, items, processed_files)?;
                }
            }
        }

        Ok(())
    }

    fn process_recycle_entry(
        entry: &std::fs::DirEntry, 
        items: &mut Vec<TrashItem>, 
        processed_files: &mut HashMap<String, bool>
    ) -> Result<(), String> {
        if let Ok(user_metadata) = entry.metadata() {
            let name = entry.file_name().to_string_lossy().to_string();
            
            // Skip if already processed
            if processed_files.contains_key(&name) {
                return Ok(());
            }
            
            // Process $R files (actual files) and skip $I files (metadata)
            if name.starts_with("$R") {
                processed_files.insert(name.clone(), true);
                
                let modified = user_metadata.modified()
                    .unwrap_or(SystemTime::UNIX_EPOCH)
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                // Try to get original name from corresponding $I file
                let i_file_name = name.replace("$R", "$I");
                let i_file_path = entry.path().parent()
                    .unwrap_or_else(|| Path::new(""))
                    .join(&i_file_name);
                
                let (original_name, original_path) = get_original_info_from_info_file(&i_file_path)
                    .unwrap_or_else(|| {
                        // Enhanced fallback: try to extract meaningful name
                        let fallback_name = name.strip_prefix("$R").unwrap_or(&name);
                        let clean_name = if fallback_name.is_empty() { 
                            "Deleted File".to_string() 
                        } else if fallback_name.len() < 10 {
                            format!("Deleted File ({})", fallback_name)
                        } else {
                            // Try to decode if it looks like a hex string
                            decode_recycle_filename(fallback_name)
                        };
                        (clean_name, entry.path().to_string_lossy().to_string())
                    });

                items.push(TrashItem {
                    name: original_name,
                    original_path,
                    deletion_date: modified,
                    size: if user_metadata.is_dir() { 0 } else { user_metadata.len() },
                    is_dir: user_metadata.is_dir(),
                });
            }
        }
        Ok(())
    }

    fn decode_recycle_filename(filename: &str) -> String {
        // Try to decode common recycle bin filename patterns
        if filename.len() > 8 && filename.chars().all(|c| c.is_ascii_hexdigit() || c == '.') {
            // Looks like a hex-encoded filename, return a user-friendly version
            format!("Deleted File ({})", &filename[..8])
        } else {
            format!("Deleted File ({})", filename)
        }
    }

    fn get_recycle_bin_alternative() -> Result<Vec<TrashItem>, String> {
        let mut items = Vec::new();
        
        // Try to access user-specific recycle bin locations
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            // Try different approaches to find recycle bin content
            let temp_locations = vec![
                format!("{}\\..\\Default\\Desktop\\$Recycle.Bin", user_profile),
                format!("{}\\Desktop\\$Recycle.Bin", user_profile),
                "C:\\Users\\Public\\Desktop\\$Recycle.Bin".to_string(),
            ];
            
            for location in temp_locations {
                if Path::new(&location).exists() {
                    if let Ok(entries) = std::fs::read_dir(&location) {
                        for entry in entries.flatten() {
                            if let Ok(metadata) = entry.metadata() {
                                let name = entry.file_name().to_string_lossy().to_string();
                                
                                if !name.starts_with('.') && !name.starts_with("$I") {
                                    let modified = metadata.modified()
                                        .unwrap_or(SystemTime::UNIX_EPOCH)
                                        .duration_since(SystemTime::UNIX_EPOCH)
                                        .unwrap_or_default()
                                        .as_secs();
                                        
                                    items.push(TrashItem {
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
                    break; // Found a working location
                }
            }
        }
        
        Ok(items)
    }

    fn get_original_info_from_info_file(info_file_path: &std::path::Path) -> Option<(String, String)> {
        // $I files contain metadata about the deleted file
        // The format is: 8 bytes header + 8 bytes original size + 8 bytes deletion time + null-terminated wide string path
        if let Ok(data) = std::fs::read(info_file_path) {
            if data.len() > 24 {
                // Skip the first 24 bytes (header + size + time)
                let path_data = &data[24..];
                
                // Parse as UTF-16 little endian (Windows wide string format)
                let mut chars = Vec::new();
                let mut i = 0;
                while i + 1 < path_data.len() {
                    let low = path_data[i] as u16;
                    let high = path_data[i + 1] as u16;
                    let wide_char = low | (high << 8);
                    
                    if wide_char == 0 {
                        break; // Null terminator
                    }
                    
                    chars.push(wide_char);
                    i += 2;
                }
                
                if !chars.is_empty() {
                    let full_path = String::from_utf16_lossy(&chars);
                    
                    // Extract just the filename
                    let filename = std::path::Path::new(&full_path)
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| {
                            // If we can't get the filename, use the last part after backslash
                            full_path.split('\\').last().unwrap_or(&full_path).to_string()
                        });
                    
                    return Some((filename, full_path));
                }
            }
        }
        None
    }

    pub fn restore_from_recycle_bin(item_path: &str) -> Result<String, String> {
        // Try to restore a file from the recycle bin
        let recycle_path = Path::new(item_path);
        
        if !recycle_path.exists() {
            return Err("File no longer exists in recycle bin".to_string());
        }
        
        // If this is a $R file, try to find the corresponding $I file to get original path
        let filename = recycle_path.file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid filename")?;
            
        if filename.starts_with("$R") {
            let i_file_name = filename.replace("$R", "$I");
            let i_file_path = recycle_path.parent()
                .ok_or("Cannot determine parent directory")?
                .join(&i_file_name);
                
            if let Some((_original_name, original_path)) = get_original_info_from_info_file(&i_file_path) {
                // Try to restore to original location
                let destination = Path::new(&original_path);
                
                if let Some(parent) = destination.parent() {
                    if !parent.exists() {
                        std::fs::create_dir_all(parent)
                            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
                    }
                }
                
                std::fs::rename(recycle_path, destination)
                    .map_err(|e| format!("Failed to restore file: {}", e))?;
                
                // Remove the corresponding $I file
                let _ = std::fs::remove_file(&i_file_path);
                
                return Ok(original_path);
            }
        }
        
        // Fallback: restore to desktop with a generic name
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let desktop_path = Path::new(&user_profile).join("Desktop");
            let restored_name = format!("Restored_{}", filename);
            let destination = desktop_path.join(&restored_name);
            
            std::fs::rename(recycle_path, &destination)
                .map_err(|e| format!("Failed to restore file to desktop: {}", e))?;
                
            return Ok(destination.to_string_lossy().to_string());
        }
        
        Err("Could not determine restore location".to_string())
    }

    pub fn empty_recycle_bin() -> Result<usize, String> {
        let mut deleted_count = 0;
        let possible_recycle_paths = vec![
            "C:\\$Recycle.Bin".to_string(),
            "D:\\$Recycle.Bin".to_string(),
            "E:\\$Recycle.Bin".to_string(),
            "C:\\RECYCLER".to_string(),
        ];

        for recycle_path in possible_recycle_paths {
            if let Ok(count) = empty_recycle_directory(&recycle_path) {
                deleted_count += count;
            }
        }

        Ok(deleted_count)
    }

    fn empty_recycle_directory(recycle_path: &str) -> Result<usize, String> {
        let mut deleted_count = 0;
        let recycle_path_obj = Path::new(recycle_path);
        
        if !recycle_path_obj.exists() {
            return Ok(0);
        }

        let entries = std::fs::read_dir(recycle_path)
            .map_err(|e| format!("Cannot read directory {}: {}", recycle_path, e))?;

        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    // Each user has their own folder in $Recycle.Bin
                    if let Ok(user_entries) = std::fs::read_dir(entry.path()) {
                        for user_entry in user_entries.flatten() {
                            if std::fs::remove_file(user_entry.path()).is_ok() {
                                deleted_count += 1;
                            }
                        }
                    }
                } else {
                    if std::fs::remove_file(entry.path()).is_ok() {
                        deleted_count += 1;
                    }
                }
            }
        }

        Ok(deleted_count)
    }
}

#[cfg(windows)]
pub use inner::*;

#[cfg(not(windows))]
pub fn get_recycle_bin_items() -> Result<Vec<crate::operations::TrashItem>, String> {
    Err("Windows recycle bin access is only available on Windows".to_string())
}

#[cfg(not(windows))]
pub fn restore_from_recycle_bin(_item_path: &str) -> Result<String, String> {
    Err("Windows recycle bin access is only available on Windows".to_string())
}

#[cfg(not(windows))]
pub fn empty_recycle_bin() -> Result<usize, String> {
    Err("Windows recycle bin access is only available on Windows".to_string())
}
