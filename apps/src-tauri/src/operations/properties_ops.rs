use crate::operations::validate_file_path;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::SystemTime;
use tauri::command;

#[cfg(windows)]
use std::os::windows::fs::MetadataExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetailedFileProperties {
    pub path: String,
    pub name: String,
    pub file_type: String,
    pub size: u64,
    pub size_formatted: String,
    pub created: u64,
    pub modified: u64,
    pub accessed: u64,
    pub created_formatted: String,
    pub modified_formatted: String,
    pub accessed_formatted: String,
    pub permissions: FilePermissions,
    pub is_directory: bool,
    pub is_hidden: bool,
    pub is_readonly: bool,
    pub extension: Option<String>,
    pub mime_type: Option<String>,
    pub attributes: FileAttributes,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilePermissions {
    pub readable: bool,
    pub writable: bool,
    pub executable: bool,
    pub permissions_string: String,
    #[cfg(unix)]
    pub mode: u32,
    #[cfg(windows)]
    pub attributes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileAttributes {
    pub item_count: Option<u64>, // For directories
    pub total_size: Option<u64>, // For directories (recursive)
    pub symlink_target: Option<String>,
    pub device_id: Option<u64>,
    pub inode: Option<u64>,
    pub hard_links: Option<u64>,
}

#[command]
pub async fn get_detailed_file_properties(
    file_path: String,
) -> Result<DetailedFileProperties, String> {
    validate_file_path(&file_path)?;

    tokio::task::spawn_blocking(move || {
        let path = Path::new(&file_path);

        if !path.exists() {
            return Err("File or directory does not exist".to_string());
        }

        let metadata = fs::metadata(path).map_err(|e| format!("Failed to read metadata: {}", e))?;

        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let file_type = if metadata.is_dir() {
            "Directory".to_string()
        } else if metadata.is_file() {
            if let Some(ext) = path.extension() {
                format!("{} File", ext.to_string_lossy().to_uppercase())
            } else {
                "File".to_string()
            }
        } else if metadata.file_type().is_symlink() {
            "Symbolic Link".to_string()
        } else {
            "Unknown".to_string()
        };

        let extension = path.extension().map(|e| e.to_string_lossy().to_string());

        // Get timestamps
        let created = metadata
            .created()
            .unwrap_or(SystemTime::UNIX_EPOCH)
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let modified = metadata
            .modified()
            .unwrap_or(SystemTime::UNIX_EPOCH)
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let accessed = metadata
            .accessed()
            .unwrap_or(SystemTime::UNIX_EPOCH)
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Format timestamps
        let created_formatted = format_timestamp(created);
        let modified_formatted = format_timestamp(modified);
        let accessed_formatted = format_timestamp(accessed);

        // Get permissions
        let permissions = get_permissions(&metadata);

        // Check if hidden
        let is_hidden = is_hidden_file(path);

        // Get attributes
        let attributes = get_file_attributes(path, &metadata)?;

        // Get MIME type
        let mime_type = get_mime_type(&file_path);

        Ok(DetailedFileProperties {
            path: file_path,
            name,
            file_type,
            size: metadata.len(),
            size_formatted: format_file_size(metadata.len()),
            created,
            modified,
            accessed,
            created_formatted,
            modified_formatted,
            accessed_formatted,
            permissions: permissions.clone(),
            is_directory: metadata.is_dir(),
            is_hidden,
            is_readonly: !permissions.writable,
            extension,
            mime_type,
            attributes,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_directory_size(dir_path: String) -> Result<u64, String> {
    validate_file_path(&dir_path)?;

    tokio::task::spawn_blocking(move || {
        let path = Path::new(&dir_path);

        if !path.is_dir() {
            return Err("Path is not a directory".to_string());
        }

        calculate_directory_size(path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_directory_item_count(dir_path: String) -> Result<u64, String> {
    validate_file_path(&dir_path)?;

    tokio::task::spawn_blocking(move || {
        let path = Path::new(&dir_path);

        if !path.is_dir() {
            return Err("Path is not a directory".to_string());
        }

        count_directory_items(path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn set_file_permissions(file_path: String, permissions: String) -> Result<(), String> {
    validate_file_path(&file_path)?;

    tokio::task::spawn_blocking(move || {
        let path = Path::new(&file_path);

        if !path.exists() {
            return Err("File or directory does not exist".to_string());
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            // Parse octal permissions string (e.g., "755")
            let mode = u32::from_str_radix(&permissions, 8).map_err(|_| {
                "Invalid permissions format. Use octal format (e.g., '755')".to_string()
            })?;

            let mut perms = fs::metadata(path)
                .map_err(|e| format!("Failed to read current permissions: {}", e))?
                .permissions();

            perms.set_mode(mode);

            fs::set_permissions(path, perms)
                .map_err(|e| format!("Failed to set permissions: {}", e))?;
        }

        #[cfg(windows)]
        {
            // On Windows, we can only toggle read-only
            let mut perms = fs::metadata(path)
                .map_err(|e| format!("Failed to read current permissions: {}", e))?
                .permissions();

            match permissions.as_str() {
                "readonly" => perms.set_readonly(true),
                "writable" => perms.set_readonly(false),
                _ => {
                    return Err(
                        "On Windows, only 'readonly' and 'writable' are supported".to_string()
                    )
                }
            }

            fs::set_permissions(path, perms)
                .map_err(|e| format!("Failed to set permissions: {}", e))?;
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn get_permissions(metadata: &fs::Metadata) -> FilePermissions {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let mode = metadata.permissions().mode();
        let readable = mode & 0o400 != 0;
        let writable = mode & 0o200 != 0;
        let executable = mode & 0o100 != 0;

        let permissions_string = format!("{:o}", mode & 0o777);

        FilePermissions {
            readable,
            writable,
            executable,
            permissions_string,
            mode,
        }
    }

    #[cfg(windows)]
    {
        let readonly = metadata.permissions().readonly();
        let writable = !readonly;
        let readable = true; // Assume readable on Windows
        let executable = false; // Would need more complex detection

        let permissions_string = if readonly { "Read-only" } else { "Read/Write" }.to_string();
        let attributes = metadata.file_attributes();

        FilePermissions {
            readable,
            writable,
            executable,
            permissions_string,
            attributes,
        }
    }

    #[cfg(not(any(unix, windows)))]
    {
        FilePermissions {
            readable: true,
            writable: !metadata.permissions().readonly(),
            executable: false,
            permissions_string: "Unknown".to_string(),
        }
    }
}

fn get_file_attributes(path: &Path, metadata: &fs::Metadata) -> Result<FileAttributes, String> {
    let mut attributes = FileAttributes {
        item_count: None,
        total_size: None,
        symlink_target: None,
        device_id: None,
        inode: None,
        hard_links: None,
    };

    // If it's a directory, get item count and total size
    if metadata.is_dir() {
        if let Ok(count) = count_directory_items(path) {
            attributes.item_count = Some(count);
        }

        if let Ok(size) = calculate_directory_size(path) {
            attributes.total_size = Some(size);
        }
    }

    // If it's a symlink, get target
    if metadata.file_type().is_symlink() {
        if let Ok(target) = fs::read_link(path) {
            attributes.symlink_target = Some(target.to_string_lossy().to_string());
        }
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        attributes.device_id = Some(metadata.dev());
        attributes.inode = Some(metadata.ino());
        attributes.hard_links = Some(metadata.nlink());
    }

    Ok(attributes)
}

fn calculate_directory_size(dir: &Path) -> Result<u64, String> {
    let mut total_size = 0u64;

    fn calculate_recursive(dir: &Path, total: &mut u64) -> Result<(), String> {
        let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let path = entry.path();
            let metadata = entry
                .metadata()
                .map_err(|e| format!("Failed to read metadata: {}", e))?;

            if metadata.is_file() {
                *total += metadata.len();
            } else if metadata.is_dir() {
                calculate_recursive(&path, total)?;
            }
        }
        Ok(())
    }

    calculate_recursive(dir, &mut total_size)?;
    Ok(total_size)
}

fn count_directory_items(dir: &Path) -> Result<u64, String> {
    let mut count = 0u64;

    fn count_recursive(dir: &Path, count: &mut u64) -> Result<(), String> {
        let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let path = entry.path();

            *count += 1;

            if path.is_dir() {
                count_recursive(&path, count)?;
            }
        }
        Ok(())
    }

    count_recursive(dir, &mut count)?;
    Ok(count)
}

use super::is_hidden_file;

fn get_mime_type(file_path: &str) -> Option<String> {
    let path = Path::new(file_path);

    if let Some(extension) = path.extension() {
        let ext = extension.to_string_lossy().to_lowercase();

        match ext.as_str() {
            // Images
            "jpg" | "jpeg" => Some("image/jpeg".to_string()),
            "png" => Some("image/png".to_string()),
            "gif" => Some("image/gif".to_string()),
            "bmp" => Some("image/bmp".to_string()),
            "webp" => Some("image/webp".to_string()),
            "svg" => Some("image/svg+xml".to_string()),

            // Documents
            "pdf" => Some("application/pdf".to_string()),
            "doc" => Some("application/msword".to_string()),
            "docx" => Some(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    .to_string(),
            ),
            "xls" => Some("application/vnd.ms-excel".to_string()),
            "xlsx" => Some(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".to_string(),
            ),
            "ppt" => Some("application/vnd.ms-powerpoint".to_string()),
            "pptx" => Some(
                "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    .to_string(),
            ),

            // Text
            "txt" => Some("text/plain".to_string()),
            "md" => Some("text/markdown".to_string()),
            "html" | "htm" => Some("text/html".to_string()),
            "css" => Some("text/css".to_string()),
            "js" => Some("application/javascript".to_string()),
            "json" => Some("application/json".to_string()),
            "xml" => Some("application/xml".to_string()),

            // Code
            "rs" => Some("text/x-rust".to_string()),
            "py" => Some("text/x-python".to_string()),
            "java" => Some("text/x-java".to_string()),
            "cpp" | "cc" | "cxx" => Some("text/x-c++".to_string()),
            "c" => Some("text/x-c".to_string()),
            "h" => Some("text/x-c-header".to_string()),

            // Audio
            "mp3" => Some("audio/mpeg".to_string()),
            "wav" => Some("audio/wav".to_string()),
            "ogg" => Some("audio/ogg".to_string()),
            "flac" => Some("audio/flac".to_string()),

            // Video
            "mp4" => Some("video/mp4".to_string()),
            "avi" => Some("video/x-msvideo".to_string()),
            "mov" => Some("video/quicktime".to_string()),
            "webm" => Some("video/webm".to_string()),

            // Archives
            "zip" => Some("application/zip".to_string()),
            "tar" => Some("application/x-tar".to_string()),
            "gz" => Some("application/gzip".to_string()),
            "7z" => Some("application/x-7z-compressed".to_string()),
            "rar" => Some("application/vnd.rar".to_string()),

            _ => None,
        }
    } else {
        None
    }
}

fn format_file_size(size: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = size as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} {}", size as u64, UNITS[unit_index])
    } else {
        format!("{:.1} {}", size, UNITS[unit_index])
    }
}

fn format_timestamp(timestamp: u64) -> String {
    use std::time::{Duration, SystemTime};

    if timestamp == 0 {
        return "Unknown".to_string();
    }

    let datetime = SystemTime::UNIX_EPOCH + Duration::from_secs(timestamp);
    let now = SystemTime::now();
    let elapsed = now.duration_since(datetime).unwrap_or_default();

    let secs = elapsed.as_secs();
    let days = secs / 86400;
    let hours = (secs % 86400) / 3600;
    let minutes = (secs % 3600) / 60;

    if days > 0 {
        format!("{} days ago", days)
    } else if hours > 0 {
        format!("{} hours ago", hours)
    } else if minutes > 0 {
        format!("{} minutes ago", minutes)
    } else {
        "Just now".to_string()
    }
}
