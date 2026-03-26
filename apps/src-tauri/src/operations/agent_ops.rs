use crate::operations::types::*;
use crate::operations::validate_file_path;
use std::fs;
use std::path::Path;
use std::time::SystemTime;
use tauri::command;

#[command]
pub async fn agent_read_file_tree(
    root_path: String,
    max_recursion: Option<u32>,
    include_content: Option<bool>,
) -> Result<(FileSystemNode, Vec<AgentProgress>), String> {
    let max_depth = max_recursion.unwrap_or(10).min(10); // Cap at 10 levels
    let read_content = include_content.unwrap_or(true);
    let mut progress_log = Vec::new();

    let result = build_file_tree(&root_path, 0, max_depth, read_content, &mut progress_log)?;
    Ok((result, progress_log))
}

fn build_file_tree(
    path: &str,
    current_depth: u32,
    max_depth: u32,
    read_content: bool,
    progress_log: &mut Vec<AgentProgress>,
) -> Result<FileSystemNode, String> {
    // Add progress entry
    progress_log.push(AgentProgress {
        current_path: path.to_string(),
        processed_files: 0,
        processed_dirs: 0,
        total_size: 0,
        recursion_depth: current_depth,
        status: format!("Reading: {}", path),
    });

    let path_obj = Path::new(path);

    // Check if path exists
    if !path_obj.exists() {
        return Ok(FileSystemNode {
            path: path.to_string(),
            name: path_obj
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            is_dir: false,
            size: 0,
            modified: 0,
            content: None,
            children: None,
            error: Some("Path does not exist".to_string()),
        });
    }

    let metadata = fs::metadata(path).map_err(|e| format!("Failed to get metadata: {}", e))?;

    let modified = metadata
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    if metadata.is_file() {
        // Handle file
        let content = if read_content {
            match read_file_content_safe(path) {
                Ok(content) => Some(content),
                Err(_) => None, // Don't fail on content errors, just skip content
            }
        } else {
            None
        };

        Ok(FileSystemNode {
            path: path.to_string(),
            name: path_obj
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            is_dir: false,
            size: metadata.len(),
            modified,
            content,
            children: None,
            error: None,
        })
    } else if metadata.is_dir() {
        // Handle directory
        if current_depth >= max_depth {
            return Ok(FileSystemNode {
                path: path.to_string(),
                name: path_obj
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                is_dir: true,
                size: 0,
                modified,
                content: None,
                children: Some(vec![]), // Empty to indicate max depth reached
                error: Some("Max recursion depth reached".to_string()),
            });
        }

        let children = match fs::read_dir(path) {
            Ok(entries) => {
                let mut children_nodes = Vec::new();
                for entry in entries {
                    if let Ok(entry) = entry {
                        let child_path = entry.path().to_string_lossy().to_string();
                        match build_file_tree(
                            &child_path,
                            current_depth + 1,
                            max_depth,
                            read_content,
                            progress_log,
                        ) {
                            Ok(child_node) => children_nodes.push(child_node),
                            Err(_) => {
                                // Skip files that cause errors instead of failing the whole operation
                                continue;
                            }
                        }
                    }
                }
                Some(children_nodes)
            }
            Err(e) => {
                return Ok(FileSystemNode {
                    path: path.to_string(),
                    name: path_obj
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string(),
                    is_dir: true,
                    size: 0,
                    modified,
                    content: None,
                    children: None,
                    error: Some(format!("Failed to read directory: {}", e)),
                });
            }
        };

        Ok(FileSystemNode {
            path: path.to_string(),
            name: path_obj
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            is_dir: true,
            size: 0,
            modified,
            content: None,
            children,
            error: None,
        })
    } else {
        Ok(FileSystemNode {
            path: path.to_string(),
            name: path_obj
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            is_dir: false,
            size: 0,
            modified,
            content: None,
            children: None,
            error: Some("Unknown file type".to_string()),
        })
    }
}

fn read_file_content_safe(path: &str) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;

    // Skip very large files (> 10MB) to prevent memory issues
    if metadata.len() > 10 * 1024 * 1024 {
        return Err("File too large (>10MB)".to_string());
    }

    // Try to read as text first
    match fs::read_to_string(path) {
        Ok(content) => {
            // Check if content is mostly valid text (not binary)
            let printable_chars = content
                .chars()
                .filter(|c| c.is_ascii_graphic() || c.is_ascii_whitespace())
                .count();
            let total_chars = content.chars().count();

            if total_chars > 0 && (printable_chars as f64 / total_chars as f64) > 0.7 {
                Ok(content)
            } else {
                Err("File appears to be binary".to_string())
            }
        }
        Err(_) => {
            // If text reading fails, try to get basic info about the file
            let extension = Path::new(path)
                .extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("unknown");
            Err(format!("Binary file (.{})", extension))
        }
    }
}

#[command]
pub async fn agent_request_write_permission(
    _file_path: String,
    _content: String,
    _reason: String,
) -> Result<String, String> {
    // This command will be intercepted by the frontend to show a permission dialog
    // For now, we just return a request ID that the frontend can use
    let request_id = format!(
        "write_req_{}",
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    Ok(request_id)
}

#[command]
pub async fn agent_write_file_with_permission(
    file_path: String,
    content: String,
    permission_granted: bool,
) -> Result<(), String> {
    if !permission_granted {
        return Err("Permission denied by user".to_string());
    }

    validate_file_path(&file_path)?;

    // Ensure the directory exists
    if let Some(parent) = Path::new(&file_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Write the file
    fs::write(&file_path, content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}
