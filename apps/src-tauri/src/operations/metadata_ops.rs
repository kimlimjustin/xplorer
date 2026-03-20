use std::fs;
use std::path::Path;
use tauri::command;
use crate::operations::types::*;

#[command]
pub async fn get_file_properties(path: String) -> Result<FileProperties, String> {
    let path = Path::new(&path);
    
    if !path.exists() {
        return Err("File does not exist".to_string());
    }
    
    let metadata = fs::metadata(path)
        .map_err(|e| format!("Failed to get metadata: {}", e))?;
    
    let name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    
    let file_type = crate::file_lib::get_file_type(path);
    let mime_type = crate::file_lib::get_mime_type(path);
    
    #[cfg(windows)]
    let (readonly, hidden) = {
        use std::os::windows::fs::MetadataExt;
        let attributes = metadata.file_attributes();
        let readonly = (attributes & 0x1) != 0;
        let hidden = (attributes & 0x2) != 0;
        (readonly, hidden)
    };
    
    #[cfg(not(windows))]
    let (readonly, hidden) = {
        use std::os::unix::fs::PermissionsExt;
        let readonly = metadata.permissions().mode() & 0o200 == 0;
        let hidden = name.starts_with('.');
        (readonly, hidden)
    };
    
    Ok(FileProperties {
        name,
        path: path.to_string_lossy().to_string(),
        size: metadata.len(),
        is_dir: metadata.is_dir(),
        created: system_time_to_timestamp(metadata.created().unwrap_or(std::time::SystemTime::UNIX_EPOCH)),
        modified: system_time_to_timestamp(metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH)),
        accessed: system_time_to_timestamp(metadata.accessed().unwrap_or(std::time::SystemTime::UNIX_EPOCH)),
        readonly,
        hidden,
        file_type,
        mime_type,
    })
}

#[command]
pub async fn get_file_meta_data(path: String) -> Result<FileProperties, String> {
    get_file_properties(path).await
}