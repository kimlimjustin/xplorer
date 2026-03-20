use std::process::Command;
use std::path::Path;
use tauri::command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Application {
    pub name: String,
    pub path: String,
    pub icon: Option<String>,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileAssociation {
    pub extension: String,
    pub mime_type: Option<String>,
    pub default_app: Option<Application>,
    pub available_apps: Vec<Application>,
}

#[command]
pub async fn get_file_associations(file_path: String) -> Result<FileAssociation, String> {
    let path = Path::new(&file_path);
    
    let extension = path.extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    
    // Get MIME type
    let mime_type = get_mime_type_for_file(&file_path);
    
    // Get available applications for this file type
    let available_apps = get_available_applications(&extension, &file_path)?;
    
    // Determine default application
    let default_app = get_default_application(&extension, &file_path)?;
    
    Ok(FileAssociation {
        extension,
        mime_type,
        default_app,
        available_apps,
    })
}

#[command]
pub async fn open_file_with_application(file_path: String, app_path: String) -> Result<(), String> {
    let file_path = Path::new(&file_path);
    let app_path = Path::new(&app_path);
    
    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }
    
    if !app_path.exists() {
        return Err("Application does not exist".to_string());
    }
    
    #[cfg(windows)]
    {
        let output = Command::new(&app_path)
            .arg(&file_path)
            .spawn();
            
        match output {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to open file with application: {}", e))
        }
    }
    
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let output = Command::new(&app_path)
            .arg(&file_path)
            .spawn();

        match output {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to open file with application: {}", e))
        }
    }

    #[cfg(target_os = "macos")]
    {
        let output = Command::new("open")
            .arg("-a")
            .arg(&app_path)
            .arg(&file_path)
            .spawn();
            
        match output {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to open file with application: {}", e))
        }
    }
}

#[command]
pub async fn get_system_applications() -> Result<Vec<Application>, String> {
    #[cfg(windows)]
    {
        get_windows_applications()
    }
    
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        get_unix_applications()
    }

    #[cfg(target_os = "macos")]
    {
        get_macos_applications()
    }
}

#[command]
pub async fn set_default_application(file_extension: String, app_path: String) -> Result<(), String> {
    // This is a complex operation that varies significantly by OS
    // For now, we'll provide a basic implementation
    
    #[cfg(windows)]
    {
        set_windows_default_application(&file_extension, &app_path)
    }
    
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        set_unix_default_application(&file_extension, &app_path)
    }

    #[cfg(target_os = "macos")]
    {
        set_macos_default_application(&file_extension, &app_path)
    }
}

// Helper functions

fn get_mime_type_for_file(file_path: &str) -> Option<String> {
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
            "docx" => Some("application/vnd.openxmlformats-officedocument.wordprocessingml.document".to_string()),
            "txt" => Some("text/plain".to_string()),
            "md" => Some("text/markdown".to_string()),
            "html" | "htm" => Some("text/html".to_string()),
            
            // Audio
            "mp3" => Some("audio/mpeg".to_string()),
            "wav" => Some("audio/wav".to_string()),
            "ogg" => Some("audio/ogg".to_string()),
            
            // Video
            "mp4" => Some("video/mp4".to_string()),
            "avi" => Some("video/x-msvideo".to_string()),
            "mov" => Some("video/quicktime".to_string()),
            
            // Archives
            "zip" => Some("application/zip".to_string()),
            "rar" => Some("application/vnd.rar".to_string()),
            "7z" => Some("application/x-7z-compressed".to_string()),
            
            _ => None,
        }
    } else {
        None
    }
}

#[cfg(windows)]
fn get_windows_applications() -> Result<Vec<Application>, String> {
    let mut applications = Vec::new();
    
    // Common Windows applications
    let common_apps = vec![
        ("Notepad", "C:\\Windows\\System32\\notepad.exe"),
        ("Paint", "C:\\Windows\\System32\\mspaint.exe"),
        ("WordPad", "C:\\Program Files\\Windows NT\\Accessories\\wordpad.exe"),
        ("Calculator", "C:\\Windows\\System32\\calc.exe"),
    ];
    
    for (name, path) in common_apps {
        if Path::new(path).exists() {
            applications.push(Application {
                name: name.to_string(),
                path: path.to_string(),
                icon: None,
                is_default: false,
            });
        }
    }
    
    // Try to find more applications by scanning common directories
    let program_dirs = vec![
        "C:\\Program Files",
        "C:\\Program Files (x86)",
    ];
    
    for dir in program_dirs {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                    let app_name = entry.file_name().to_string_lossy().to_string();
                    let app_dir = entry.path();
                    
                    // Look for executable files in the application directory
                    if let Ok(app_entries) = std::fs::read_dir(&app_dir) {
                        for app_entry in app_entries.flatten() {
                            let app_path = app_entry.path();
                            if app_path.extension().map(|ext| ext == "exe").unwrap_or(false) {
                                applications.push(Application {
                                    name: app_name.clone(),
                                    path: app_path.to_string_lossy().to_string(),
                                    icon: None,
                                    is_default: false,
                                });
                                break; // Only take the first exe found in each directory
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(applications)
}

#[cfg(unix)]
fn get_unix_applications() -> Result<Vec<Application>, String> {
    let mut applications = Vec::new();
    
    // Parse .desktop files from common locations
    let desktop_dirs = vec![
        "/usr/share/applications",
        "/usr/local/share/applications",
        "~/.local/share/applications",
    ];
    
    for dir in desktop_dirs {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                if entry.path().extension().map(|ext| ext == "desktop").unwrap_or(false) {
                    if let Ok(app) = parse_desktop_file(&entry.path()) {
                        applications.push(app);
                    }
                }
            }
        }
    }
    
    Ok(applications)
}

#[cfg(target_os = "macos")]
fn get_macos_applications() -> Result<Vec<Application>, String> {
    let mut applications = Vec::new();
    
    // Scan /Applications directory
    if let Ok(entries) = std::fs::read_dir("/Applications") {
        for entry in entries.flatten() {
            if entry.path().extension().map(|ext| ext == "app").unwrap_or(false) {
                let app_name = entry.file_name().to_string_lossy().to_string();
                let app_name = app_name.trim_end_matches(".app").to_string();
                
                applications.push(Application {
                    name: app_name,
                    path: entry.path().to_string_lossy().to_string(),
                    icon: None,
                    is_default: false,
                });
            }
        }
    }
    
    Ok(applications)
}

#[cfg(unix)]
fn parse_desktop_file(path: &Path) -> Result<Application, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read desktop file: {}", e))?;
    
    let mut name = String::new();
    let mut exec = String::new();
    let mut icon = None;
    
    for line in content.lines() {
        if line.starts_with("Name=") {
            name = line.strip_prefix("Name=").unwrap_or("").to_string();
        } else if line.starts_with("Exec=") {
            exec = line.strip_prefix("Exec=").unwrap_or("").to_string();
            // Remove %f, %u, etc. from exec line
            exec = exec.split_whitespace().next().unwrap_or("").to_string();
        } else if line.starts_with("Icon=") {
            icon = Some(line.strip_prefix("Icon=").unwrap_or("").to_string());
        }
    }
    
    if name.is_empty() || exec.is_empty() {
        return Err("Invalid desktop file".to_string());
    }
    
    Ok(Application {
        name,
        path: exec,
        icon,
        is_default: false,
    })
}

fn get_available_applications(extension: &str, _file_path: &str) -> Result<Vec<Application>, String> {
    let mut apps = get_system_applications_sync()?;
    
    // Filter applications based on file type (this is a basic implementation)
    // In a real implementation, you would check OS-specific file associations
    match extension {
        "txt" | "md" | "log" => {
            apps.retain(|app| {
                app.name.to_lowercase().contains("notepad") ||
                app.name.to_lowercase().contains("editor") ||
                app.name.to_lowercase().contains("code") ||
                app.name.to_lowercase().contains("text")
            });
        },
        "jpg" | "jpeg" | "png" | "gif" | "bmp" => {
            apps.retain(|app| {
                app.name.to_lowercase().contains("paint") ||
                app.name.to_lowercase().contains("photo") ||
                app.name.to_lowercase().contains("image") ||
                app.name.to_lowercase().contains("viewer")
            });
        },
        _ => {
            // For unknown types, return common applications
        }
    }
    
    Ok(apps)
}

fn get_system_applications_sync() -> Result<Vec<Application>, String> {
    #[cfg(windows)]
    {
        get_windows_applications()
    }
    
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        get_unix_applications()
    }

    #[cfg(target_os = "macos")]
    {
        get_macos_applications()
    }
}

fn get_default_application(_extension: &str, _file_path: &str) -> Result<Option<Application>, String> {
    // This would typically query the OS for the default application
    // For now, return None (no default found)
    Ok(None)
}

#[cfg(windows)]
fn set_windows_default_application(_extension: &str, _app_path: &str) -> Result<(), String> {
    // This would require registry manipulation on Windows
    // For security reasons, we'll return an error for now
    Err("Setting default applications is not supported in this version".to_string())
}

#[cfg(unix)]
fn set_unix_default_application(extension: &str, app_path: &str) -> Result<(), String> {
    // This would require updating .desktop associations
    // For security reasons, we'll return an error for now
    Err("Setting default applications is not supported in this version".to_string())
}

#[cfg(target_os = "macos")]
fn set_macos_default_application(extension: &str, app_path: &str) -> Result<(), String> {
    // This would require using Launch Services on macOS
    // For security reasons, we'll return an error for now
    Err("Setting default applications is not supported in this version".to_string())
}