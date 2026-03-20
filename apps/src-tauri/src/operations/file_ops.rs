use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::sync::{Arc, OnceLock};
use std::thread;
use chrono::Local;
use regex::RegexBuilder;
use serde::{Serialize, Deserialize};
use tauri::command;
use tracing::warn;
use walkdir::WalkDir;
use crate::operations::progress::{ProgressManager, generate_operation_id};
use crate::operations::undo_redo_ops::{record_operation, FileOperation};
use crate::operations::validate_file_path;
use crate::audit_log::log_operation;

// ─── Conflict Resolution Types ───────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictFileInfo {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictInfo {
    pub source: ConflictFileInfo,
    pub destination: ConflictFileInfo,
}

fn file_info_from_path(p: &Path) -> Result<ConflictFileInfo, String> {
    let meta = fs::metadata(p)
        .map_err(|e| format!("Failed to read metadata for {}: {}", p.display(), e))?;
    let modified = {
        let sys_time = meta.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        sys_time.duration_since(std::time::SystemTime::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0)
    };
    let size = if meta.is_dir() {
        dir_total_size(p)
    } else {
        meta.len()
    };
    Ok(ConflictFileInfo {
        path: p.to_string_lossy().to_string(),
        name: p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
        is_dir: meta.is_dir(),
        size,
        modified,
    })
}

fn dir_total_size(dir: &Path) -> u64 {
    let mut total = 0u64;
    for entry in WalkDir::new(dir).min_depth(1).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Ok(m) = entry.metadata() {
                total += m.len();
            }
        }
    }
    total
}

fn generate_rename_destination(dir: &Path, name: &str) -> String {
    let dot = name.rfind('.');
    let (base, ext) = match dot {
        Some(i) if i > 0 => (&name[..i], &name[i..]),
        _ => (name, ""),
    };
    let mut n = 1u32;
    loop {
        let candidate_name = format!("{} ({}){}", base, n, ext);
        let candidate = dir.join(&candidate_name);
        if !candidate.exists() {
            return candidate.to_string_lossy().to_string();
        }
        n += 1;
        if n > 9999 {
            return candidate.to_string_lossy().to_string();
        }
    }
}

#[command]
pub async fn check_conflicts(
    sources: Vec<String>,
    destination_dir: String,
) -> Result<Vec<ConflictInfo>, String> {
    let dest_dir = Path::new(&destination_dir);
    if !dest_dir.exists() {
        return Err(format!("Destination directory does not exist: {}", destination_dir));
    }
    if !dest_dir.is_dir() {
        return Err(format!("Destination is not a directory: {}", destination_dir));
    }

    let mut conflicts: Vec<ConflictInfo> = Vec::new();

    for src_str in &sources {
        let src = Path::new(src_str);
        if !src.exists() {
            continue;
        }
        let file_name = match src.file_name() {
            Some(n) => n,
            None => continue,
        };
        let dest_path = dest_dir.join(file_name);
        if dest_path.exists() {
            let source_info = file_info_from_path(src)?;
            let dest_info = file_info_from_path(&dest_path)?;
            conflicts.push(ConflictInfo {
                source: source_info,
                destination: dest_info,
            });
        }
    }

    Ok(conflicts)
}

#[command]
pub async fn get_rename_destination(
    destination_dir: String,
    file_name: String,
) -> Result<String, String> {
    let dir = Path::new(&destination_dir);
    if !dir.exists() {
        return Err(format!("Directory does not exist: {}", destination_dir));
    }
    Ok(generate_rename_destination(dir, &file_name))
}

#[command]
pub async fn copy_with_progress(
    source: String,
    destination: String,
    progress_manager: tauri::State<'_, Arc<ProgressManager>>
) -> Result<String, String> {
    validate_file_path(&source)?;
    validate_file_path(&destination)?;
    let operation_id = generate_operation_id();
    if !Path::new(&source).exists() {
        return Err("Source file does not exist".to_string());
    }

    let progress_manager = progress_manager.inner().clone();
    let operation_id_clone = operation_id.clone();
    let source_clone = source.clone();
    let destination_clone = destination.clone();

    // Spawn background task for copy operation
    thread::spawn(move || {
        let src = Path::new(&source_clone);
        let dst = Path::new(&destination_clone);
        
        let result = if src.is_file() {
            copy_file_with_progress(&src, &dst, &progress_manager, &operation_id_clone)
        } else if src.is_dir() {
            copy_directory_with_progress(&src, &dst, &progress_manager, &operation_id_clone)
        } else {
            Err("Invalid source type".to_string())
        };

        match result {
            Ok(_) => {
                let s = src.to_string_lossy().to_string();
                let d = dst.to_string_lossy().to_string();
                record_operation(FileOperation::Copy {
                    src: s.clone(),
                    dest: d.clone(),
                });
                log_operation("copy", vec![s, d], None, true);
                progress_manager.complete_operation(&operation_id_clone);
            }
            Err(e) => {
                log_operation("copy", vec![src.to_string_lossy().to_string(), dst.to_string_lossy().to_string()], Some(e.clone()), false);
                progress_manager.fail_operation(&operation_id_clone, e);
            }
        }
    });

    Ok(operation_id)
}

#[command]
pub async fn move_with_progress(
    source: String,
    destination: String,
    progress_manager: tauri::State<'_, Arc<ProgressManager>>
) -> Result<String, String> {
    validate_file_path(&source)?;
    validate_file_path(&destination)?;
    let operation_id = generate_operation_id();
    if !Path::new(&source).exists() {
        return Err("Source file does not exist".to_string());
    }

    let progress_manager = progress_manager.inner().clone();
    let operation_id_clone = operation_id.clone();
    let source_clone = source.clone();
    let destination_clone = destination.clone();

    // Spawn background task for move operation
    thread::spawn(move || {
        let src = Path::new(&source_clone);
        let dst = Path::new(&destination_clone);
        
        let result = move_with_progress_impl(&src, &dst, &progress_manager, &operation_id_clone);

        match result {
            Ok(_) => {
                let s = src.to_string_lossy().to_string();
                let d = dst.to_string_lossy().to_string();
                record_operation(FileOperation::Move {
                    src: s.clone(),
                    dest: d.clone(),
                });
                log_operation("move", vec![s, d], None, true);
                progress_manager.complete_operation(&operation_id_clone);
            }
            Err(e) => {
                log_operation("move", vec![src.to_string_lossy().to_string(), dst.to_string_lossy().to_string()], Some(e.clone()), false);
                progress_manager.fail_operation(&operation_id_clone, e);
            }
        }
    });

    Ok(operation_id)
}

fn copy_file_with_progress(
    src: &Path,
    dst: &Path,
    progress_manager: &ProgressManager,
    operation_id: &str,
) -> Result<(), String> {
    let metadata = fs::metadata(src).map_err(|e| format!("Failed to get metadata: {}", e))?;
    let file_size = metadata.len();
    
    progress_manager.start_operation(
        operation_id.to_string(),
        "copy_file".to_string(),
        1,
        file_size,
    );

    progress_manager.update_progress(
        operation_id,
        src.to_string_lossy().to_string(),
        0,
        0,
    );

    // Create parent directory if it doesn't exist
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    // Use std::fs::copy for now, but could be enhanced with chunked copying for large files
    fs::copy(src, dst)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    progress_manager.update_progress(
        operation_id,
        src.to_string_lossy().to_string(),
        1,
        file_size,
    );

    Ok(())
}

fn copy_directory_with_progress(
    src: &Path,
    dst: &Path,
    progress_manager: &ProgressManager,
    operation_id: &str,
) -> Result<(), String> {
    // First, count total files and calculate total size
    let (total_count, total_size) = count_directory_contents(src)?;
    
    progress_manager.start_operation(
        operation_id.to_string(),
        "copy_directory".to_string(),
        total_count,
        total_size,
    );

    let mut processed_count = 0;
    let mut processed_bytes = 0;

    copy_directory_recursive(
        src,
        dst,
        progress_manager,
        operation_id,
        &mut processed_count,
        &mut processed_bytes,
    )
}

fn copy_directory_recursive(
    src: &Path,
    dst: &Path,
    progress_manager: &ProgressManager,
    operation_id: &str,
    processed_count: &mut u64,
    processed_bytes: &mut u64,
) -> Result<(), String> {
    if !dst.exists() {
        fs::create_dir_all(dst)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    }

    let entries = fs::read_dir(src)
        .map_err(|e| format!("Failed to read source directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        // Skip symlinks to avoid following them into unexpected locations
        if let Ok(meta) = fs::symlink_metadata(&src_path) {
            if meta.file_type().is_symlink() {
                warn!("[Copy] Skipping symlink: {}", src_path.display());
                continue;
            }
        }

        if src_path.is_file() {
            let metadata = entry.metadata().map_err(|e| format!("Failed to get metadata: {}", e))?;
            let file_size = metadata.len();

            progress_manager.update_progress(
                operation_id,
                src_path.to_string_lossy().to_string(),
                *processed_count,
                *processed_bytes,
            );

            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("Failed to copy file {}: {}", src_path.display(), e))?;

            *processed_count += 1;
            *processed_bytes += file_size;

            progress_manager.update_progress(
                operation_id,
                src_path.to_string_lossy().to_string(),
                *processed_count,
                *processed_bytes,
            );
        } else if src_path.is_dir() {
            copy_directory_recursive(
                &src_path,
                &dst_path,
                progress_manager,
                operation_id,
                processed_count,
                processed_bytes,
            )?;
        }
    }

    Ok(())
}

fn move_with_progress_impl(
    src: &Path,
    dst: &Path,
    progress_manager: &ProgressManager,
    operation_id: &str,
) -> Result<(), String> {
    // Try rename first (most efficient for same filesystem)
    if fs::rename(src, dst).is_ok() {
        let file_size = fs::metadata(dst).map(|m| m.len()).unwrap_or(0);
        
        progress_manager.start_operation(
            operation_id.to_string(),
            "move_file".to_string(),
            1,
            file_size,
        );

        progress_manager.update_progress(
            operation_id,
            dst.to_string_lossy().to_string(),
            1,
            file_size,
        );
        
        return Ok(());
    }

    // If rename fails (different filesystems), fall back to copy + delete
    if src.is_file() {
        copy_file_with_progress(src, dst, progress_manager, operation_id)?;
        fs::remove_file(src)
            .map_err(|e| format!("Failed to remove source file: {}", e))?;
    } else if src.is_dir() {
        copy_directory_with_progress(src, dst, progress_manager, operation_id)?;
        fs::remove_dir_all(src)
            .map_err(|e| format!("Failed to remove source directory: {}", e))?;
    }

    Ok(())
}

fn count_directory_contents(dir: &Path) -> Result<(u64, u64), String> {
    let mut file_count = 0u64;
    let mut total_size = 0u64;

    fn count_recursive(dir: &Path, file_count: &mut u64, total_size: &mut u64) -> Result<(), String> {
        let entries = fs::read_dir(dir)
            .map_err(|e| format!("Failed to read directory: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let path = entry.path();

            if path.is_file() {
                *file_count += 1;
                if let Ok(metadata) = entry.metadata() {
                    *total_size += metadata.len();
                }
            } else if path.is_dir() {
                count_recursive(&path, file_count, total_size)?;
            }
        }

        Ok(())
    }

    count_recursive(dir, &mut file_count, &mut total_size)?;
    Ok((file_count, total_size))
}

// Legacy commands for compatibility
#[command]
pub async fn copy(source: String, destination: String) -> Result<(), String> {
    validate_file_path(&source)?;
    validate_file_path(&destination)?;
    let src = Path::new(&source);
    let dst = Path::new(&destination);

    if !src.exists() {
        return Err("Source file does not exist".to_string());
    }
    
    // Check if source is a symlink — warn and skip to avoid following symlinks
    // into unexpected locations
    let src_meta = fs::symlink_metadata(src)
        .map_err(|e| format!("Failed to get metadata for source: {}", e))?;
    if src_meta.file_type().is_symlink() {
        return Err(format!(
            "Source '{}' is a symbolic link. Copying symlinks is not supported for safety reasons.",
            source
        ));
    }

    if src.is_file() {
        fs::copy(src, dst)
            .map_err(|e| format!("Failed to copy file: {}", e))?;
    } else if src.is_dir() {
        copy_dir_recursive(src, dst)?;
    }

    record_operation(FileOperation::Copy { src: source.clone(), dest: destination.clone() });
    log_operation("copy", vec![source, destination], None, true);

    Ok(())
}

pub(crate) fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if !dst.exists() {
        fs::create_dir_all(dst)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    }

    for entry in fs::read_dir(src).map_err(|e| format!("Failed to read source directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        // Skip symlinks to avoid following them into unexpected locations
        if let Ok(meta) = fs::symlink_metadata(&src_path) {
            if meta.file_type().is_symlink() {
                warn!("[Copy] Skipping symlink: {}", src_path.display());
                continue;
            }
        }

        if src_path.is_file() {
            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("Failed to copy file {}: {}", src_path.display(), e))?;
        } else if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

#[command]
pub async fn move_file(source: String, destination: String) -> Result<(), String> {
    validate_file_path(&source)?;
    validate_file_path(&destination)?;
    let src = Path::new(&source);
    let dst = Path::new(&destination);

    if !src.exists() {
        return Err("Source file does not exist".to_string());
    }
    
    // Try rename first (most efficient for same filesystem)
    if let Err(_) = fs::rename(src, dst) {
        // If rename fails (different filesystems), fall back to copy + delete
        if src.is_file() {
            fs::copy(src, dst)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
            fs::remove_file(src)
                .map_err(|e| format!("Failed to remove source file: {}", e))?;
        } else if src.is_dir() {
            copy_dir_recursive(src, dst)?;
            fs::remove_dir_all(src)
                .map_err(|e| format!("Failed to remove source directory: {}", e))?;
        }
    }

    record_operation(FileOperation::Move { src: source.clone(), dest: destination.clone() });
    log_operation("move", vec![source, destination], None, true);

    Ok(())
}

#[command]
pub async fn remove_file(path: String) -> Result<(), String> {
    validate_file_path(&path)?;
    let p = Path::new(&path);

    if !p.exists() {
        return Err("File does not exist".to_string());
    }

    if p.is_dir() {
        return Err("Path is a directory, use remove_dir instead".to_string());
    }

    fs::remove_file(p)
        .map_err(|e| format!("Failed to remove file: {}", e))?;
    log_operation("delete", vec![path], None, true);

    Ok(())
}

#[command]
pub async fn rename(old_path: String, new_path: String) -> Result<(), String> {
    validate_file_path(&old_path)?;
    validate_file_path(&new_path)?;
    let old = Path::new(&old_path);
    let new = Path::new(&new_path);

    if !old.exists() {
        return Err("Source file does not exist".to_string());
    }
    
    fs::rename(old, new)
        .map_err(|e| format!("Failed to rename: {}", e))?;

    record_operation(FileOperation::Rename { old_path: old_path.clone(), new_path: new_path.clone() });
    log_operation("rename", vec![old_path, new_path], None, true);

    Ok(())
}

#[command]
pub async fn create_file(path: String) -> Result<(), String> {
    validate_file_path(&path)?;
    let path = Path::new(&path);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    fs::File::create(path)
        .map_err(|e| format!("Failed to create file: {}", e))?;

    Ok(())
}

#[command]
pub async fn create_file_with_content(path: String, content: String) -> Result<(), String> {
    validate_file_path(&path)?;
    let file_path = Path::new(&path);

    if file_path.exists() {
        return Err(format!("File already exists: {}", path));
    }

    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    fs::write(file_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    validate_file_path(&path)?;
    match fs::read_to_string(&path) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to read file {}: {}", path, e)),
    }
}

#[command]
pub async fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    validate_file_path(&path)?;
    let metadata = fs::metadata(&path)
        .map_err(|e| format!("Failed to get file metadata {}: {}", path, e))?;
    if metadata.len() > 500 * 1024 * 1024 {
        return Err(format!("File too large ({} bytes, max 500MB)", metadata.len()));
    }
    match fs::read(&path) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to read binary file {}: {}", path, e)),
    }
}

#[command]
pub async fn file_exist(path: String) -> Result<bool, String> {
    let path = Path::new(&path);
    Ok(path.exists())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BulkRenameResult {
    pub original_path: String,
    pub new_path: String,
    pub original_name: String,
    pub new_name: String,
    pub success: bool,
    pub error: Option<String>,
}

#[command]
pub async fn bulk_rename(
    files: Vec<String>,
    pattern: String,
    replacement: String,
    preview_only: bool,
) -> Result<Vec<BulkRenameResult>, String> {
    // Validate all file paths before proceeding
    for file_path in &files {
        validate_file_path(file_path)?;
    }
    if pattern.len() > 200 {
        return Err("Regex pattern too long (max 200 characters)".to_string());
    }
    // Reject patterns with nested quantifiers that could cause catastrophic backtracking
    static NESTED_QUANTIFIER_RE: OnceLock<regex::Regex> = OnceLock::new();
    let nested_re = NESTED_QUANTIFIER_RE.get_or_init(|| {
        regex::Regex::new(r"(\([^)]*[+*?][^)]*\)|[+*?]\{)[+*?]")
            .expect("hardcoded nested-quantifier regex is valid")
    });
    if nested_re.is_match(&pattern) {
        return Err("Regex pattern contains nested quantifiers which could cause excessive backtracking".to_string());
    }
    let regex = RegexBuilder::new(&pattern)
        .size_limit(10_000) // 10KB compiled size limit to prevent ReDoS
        .build()
        .map_err(|e| format!("Invalid regex pattern: {}", e))?;
    let today = Local::now().format("%Y-%m-%d").to_string();

    // First pass: compute all new names and collect results
    let mut results: Vec<BulkRenameResult> = Vec::with_capacity(files.len());

    for (index, file_path_str) in files.iter().enumerate() {
        let file_path = Path::new(file_path_str);

        // Get parent directory and file name
        let parent = match file_path.parent() {
            Some(p) => p,
            None => {
                results.push(BulkRenameResult {
                    original_path: file_path_str.clone(),
                    new_path: file_path_str.clone(),
                    original_name: file_path_str.clone(),
                    new_name: file_path_str.clone(),
                    success: false,
                    error: Some("Cannot determine parent directory".to_string()),
                });
                continue;
            }
        };

        let original_name = match file_path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name.to_string(),
            None => {
                results.push(BulkRenameResult {
                    original_path: file_path_str.clone(),
                    new_path: file_path_str.clone(),
                    original_name: file_path_str.clone(),
                    new_name: file_path_str.clone(),
                    success: false,
                    error: Some("Cannot determine file name".to_string()),
                });
                continue;
            }
        };

        // Apply regex replacement to the filename
        let mut new_name = regex.replace_all(&original_name, replacement.as_str()).to_string();

        // Process special replacement tokens
        let seq_number = index + 1;
        new_name = new_name.replace("{n}", &seq_number.to_string());
        new_name = new_name.replace("{N}", &format!("{:03}", seq_number));
        new_name = new_name.replace("{date}", &today);

        let new_path = parent.join(&new_name);
        let new_path_str = new_path.to_string_lossy().to_string();

        results.push(BulkRenameResult {
            original_path: file_path_str.clone(),
            new_path: new_path_str,
            original_name,
            new_name,
            success: true, // will be updated below if errors occur
            error: None,
        });
    }

    // If preview only, return the computed results without renaming
    if preview_only {
        return Ok(results);
    }

    // Check for name collisions among new names
    let mut seen_new_paths: HashSet<String> = HashSet::new();
    for result in results.iter_mut() {
        if !result.success {
            continue;
        }
        let normalized = result.new_path.to_lowercase();
        if !seen_new_paths.insert(normalized) {
            result.success = false;
            result.error = Some(format!(
                "Name collision: '{}' would conflict with another renamed file",
                result.new_name
            ));
        }
    }

    // Also check if new name collides with an existing file that is NOT in our rename set
    let original_paths: HashSet<String> = files.iter().cloned().collect();
    for result in results.iter_mut() {
        if !result.success {
            continue;
        }
        // Skip collision check if the new path is the same as the original
        if result.new_path == result.original_path {
            continue;
        }
        let new_path = Path::new(&result.new_path);
        if new_path.exists() && !original_paths.contains(&result.new_path) {
            result.success = false;
            result.error = Some(format!(
                "File already exists: '{}'",
                result.new_name
            ));
        }
    }

    // Perform the actual renames
    for result in results.iter_mut() {
        if !result.success {
            continue;
        }
        // Skip if name didn't change
        if result.original_path == result.new_path {
            continue;
        }
        match fs::rename(&result.original_path, &result.new_path) {
            Ok(_) => {
                result.success = true;
            }
            Err(e) => {
                result.success = false;
                result.error = Some(format!("Rename failed: {}", e));
            }
        }
    }

    Ok(results)
}

// ─── Directory Sizes (Disk Treemap) ──────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DirectorySizeEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub children_count: u64,
}

#[command]
pub async fn get_directory_sizes(dir_path: String) -> Result<Vec<DirectorySizeEntry>, String> {
    let root = Path::new(&dir_path);
    if !root.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path));
    }

    let entries = fs::read_dir(root)
        .map_err(|e| format!("Failed to read directory {}: {}", dir_path, e))?;

    let mut results: Vec<DirectorySizeEntry> = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = path.is_dir();

        if is_dir {
            let mut total_size: u64 = 0;
            let mut children_count: u64 = 0;
            for walk_entry in WalkDir::new(&path).min_depth(1).into_iter().filter_map(|e| e.ok()) {
                if walk_entry.file_type().is_file() {
                    if let Ok(meta) = walk_entry.metadata() {
                        total_size += meta.len();
                    }
                }
                children_count += 1;
            }
            results.push(DirectorySizeEntry {
                name,
                path: path.to_string_lossy().to_string(),
                size: total_size,
                is_dir: true,
                children_count,
            });
        } else {
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            results.push(DirectorySizeEntry {
                name,
                path: path.to_string_lossy().to_string(),
                size,
                is_dir: false,
                children_count: 0,
            });
        }
    }

    results.sort_by(|a, b| b.size.cmp(&a.size));
    Ok(results)
}

// ─── File Templates ──────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct FileTemplate {
    pub id: String,
    pub name: String,
    pub default_filename: String,
    pub extension: String,
    pub description: String,
}

#[command]
pub async fn get_file_templates() -> Result<Vec<FileTemplate>, String> {
    Ok(vec![
        FileTemplate { id: "html".into(), name: "HTML Page".into(), default_filename: "index.html".into(), extension: "html".into(), description: "HTML5 boilerplate page".into() },
        FileTemplate { id: "react".into(), name: "React Component".into(), default_filename: "Component.tsx".into(), extension: "tsx".into(), description: "React functional component".into() },
        FileTemplate { id: "python".into(), name: "Python Script".into(), default_filename: "script.py".into(), extension: "py".into(), description: "Python script with main guard".into() },
        FileTemplate { id: "markdown".into(), name: "Markdown Document".into(), default_filename: "document.md".into(), extension: "md".into(), description: "Markdown document with sections".into() },
        FileTemplate { id: "json".into(), name: "JSON File".into(), default_filename: "data.json".into(), extension: "json".into(), description: "Empty JSON object".into() },
        FileTemplate { id: "css".into(), name: "CSS Stylesheet".into(), default_filename: "styles.css".into(), extension: "css".into(), description: "CSS stylesheet with basic reset".into() },
        FileTemplate { id: "typescript".into(), name: "TypeScript Module".into(), default_filename: "module.ts".into(), extension: "ts".into(), description: "TypeScript module with export".into() },
        FileTemplate { id: "shell".into(), name: "Shell Script".into(), default_filename: "script.sh".into(), extension: "sh".into(), description: "Bash shell script".into() },
    ])
}

fn get_template_content(template_id: &str) -> Result<String, String> {
    match template_id {
        "html" => Ok("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Document</title>\n</head>\n<body>\n\n</body>\n</html>\n".to_string()),
        "react" => Ok("import React from 'react';\n\ninterface Props {\n  // Define your props here\n}\n\nexport default function Component({ }: Props) {\n  return (\n    <div>\n      <h1>Component</h1>\n    </div>\n  );\n}\n".to_string()),
        "python" => Ok("#!/usr/bin/env python3\n\"\"\"Module docstring.\"\"\"\n\n\ndef main():\n    \"\"\"Main function.\"\"\"\n    pass\n\n\nif __name__ == \"__main__\":\n    main()\n".to_string()),
        "markdown" => Ok("# Title\n\n## Introduction\n\nWrite your introduction here.\n\n## Content\n\nMain content goes here.\n\n## Conclusion\n\nWrap up your document here.\n".to_string()),
        "json" => Ok("{\n}\n".to_string()),
        "css" => Ok("/* Reset */\n*,\n*::before,\n*::after {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n\nbody {\n  font-family: system-ui, -apple-system, sans-serif;\n  line-height: 1.6;\n}\n".to_string()),
        "typescript" => Ok("export interface Config {\n  // Define your config here\n}\n\nexport function init(config: Config): void {\n  // Initialize module\n}\n".to_string()),
        "shell" => Ok("#!/bin/bash\nset -euo pipefail\n\n# Script description here\n\nmain() {\n    echo \"Hello, World!\"\n}\n\nmain \"$@\"\n".to_string()),
        _ => Err(format!("Unknown template: {}", template_id)),
    }
}

#[command]
pub async fn create_from_template(directory: String, template_id: String, filename: String) -> Result<String, String> {
    let content = get_template_content(&template_id)?;
    let file_path = Path::new(&directory).join(&filename);
    if file_path.exists() {
        return Err(format!("File already exists: {}", file_path.display()));
    }
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&file_path, content).map_err(|e| format!("Failed to create file: {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

// ─── Symbolic Link Creation ──────────────────────────────────────────────────

#[command]
pub async fn create_symlink(target: String, link_path: String) -> Result<(), String> {
    // Validate both paths
    validate_file_path(&target)?;
    validate_file_path(&link_path)?;

    let target_path = Path::new(&target);
    let link = Path::new(&link_path);

    // Ensure target exists
    if !target_path.exists() {
        return Err(format!("Target does not exist: {}", target));
    }

    // Ensure link does not already exist
    if link.exists() || link.symlink_metadata().is_ok() {
        return Err(format!("A file or link already exists at: {}", link_path));
    }

    // Ensure parent directory of the link exists
    if let Some(parent) = link.parent() {
        if !parent.exists() {
            return Err(format!(
                "Parent directory does not exist: {}",
                parent.display()
            ));
        }
    }

    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(target_path, link)
            .map_err(|e| format!("Failed to create symlink: {}", e))?;
    }

    #[cfg(windows)]
    {
        if target_path.is_dir() {
            std::os::windows::fs::symlink_dir(target_path, link).map_err(|e| {
                if e.raw_os_error() == Some(1314) {
                    "Failed to create symlink: administrator privileges are required. \
                     Enable Developer Mode in Windows Settings or run as administrator."
                        .to_string()
                } else {
                    format!("Failed to create symlink: {}", e)
                }
            })?;
        } else {
            std::os::windows::fs::symlink_file(target_path, link).map_err(|e| {
                if e.raw_os_error() == Some(1314) {
                    "Failed to create symlink: administrator privileges are required. \
                     Enable Developer Mode in Windows Settings or run as administrator."
                        .to_string()
                } else {
                    format!("Failed to create symlink: {}", e)
                }
            })?;
        }
    }

    log_operation("create_symlink", vec![link_path, target], None, true);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::fs::{self, File};
    use std::io::Write;

    #[tokio::test]
    async fn test_copy_file_basic() {
        let temp = tempdir().expect("Failed to create temp dir");
        let src_path = temp.path().join("source.txt");
        let dst_path = temp.path().join("dest.txt");

        let mut file = File::create(&src_path).expect("Failed to create source");
        writeln!(file, "Hello, copy test!").unwrap();

        let result = copy(
            src_path.to_string_lossy().to_string(),
            dst_path.to_string_lossy().to_string(),
        ).await;

        assert!(result.is_ok(), "copy should succeed: {:?}", result.err());
        assert!(dst_path.exists(), "destination file should exist");

        let src_content = fs::read_to_string(&src_path).unwrap();
        let dst_content = fs::read_to_string(&dst_path).unwrap();
        assert_eq!(src_content, dst_content, "file contents should match");
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn test_copy_rejects_symlinks() {
        use std::os::unix::fs::symlink;

        let temp = tempdir().expect("Failed to create temp dir");
        let real_file = temp.path().join("real.txt");
        let link_path = temp.path().join("link.txt");
        let dst_path = temp.path().join("dest.txt");

        File::create(&real_file).expect("Failed to create real file");
        symlink(&real_file, &link_path).expect("Failed to create symlink");

        let result = copy(
            link_path.to_string_lossy().to_string(),
            dst_path.to_string_lossy().to_string(),
        ).await;

        assert!(result.is_err(), "copy of symlink should return error");
        let err = result.unwrap_err();
        assert!(
            err.contains("symbolic link"),
            "error should mention symbolic link, got: {}",
            err
        );
    }

    #[tokio::test]
    async fn test_copy_nonexistent_source_returns_error() {
        let temp = tempdir().expect("Failed to create temp dir");
        let src_path = temp.path().join("does_not_exist.txt");
        let dst_path = temp.path().join("dest.txt");

        let result = copy(
            src_path.to_string_lossy().to_string(),
            dst_path.to_string_lossy().to_string(),
        ).await;

        assert!(result.is_err(), "copy of nonexistent source should fail");
    }

    #[tokio::test]
    async fn test_rename_file() {
        let temp = tempdir().expect("Failed to create temp dir");
        let old_path = temp.path().join("old_name.txt");
        let new_path = temp.path().join("new_name.txt");

        File::create(&old_path).expect("Failed to create file");

        let result = rename(
            old_path.to_string_lossy().to_string(),
            new_path.to_string_lossy().to_string(),
        ).await;

        assert!(result.is_ok(), "rename should succeed: {:?}", result.err());
        assert!(!old_path.exists(), "old path should no longer exist");
        assert!(new_path.exists(), "new path should exist");
    }

    #[tokio::test]
    async fn test_rename_nonexistent_returns_error() {
        let temp = tempdir().expect("Failed to create temp dir");
        let old_path = temp.path().join("nonexistent.txt");
        let new_path = temp.path().join("new_name.txt");

        let result = rename(
            old_path.to_string_lossy().to_string(),
            new_path.to_string_lossy().to_string(),
        ).await;

        assert!(result.is_err(), "rename of nonexistent file should fail");
    }

    #[tokio::test]
    async fn test_delete_file() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file_path = temp.path().join("to_delete.txt");

        File::create(&file_path).expect("Failed to create file");
        assert!(file_path.exists(), "file should exist before deletion");

        let result = remove_file(file_path.to_string_lossy().to_string()).await;

        assert!(result.is_ok(), "remove_file should succeed: {:?}", result.err());
        assert!(!file_path.exists(), "file should not exist after deletion");
    }

    #[tokio::test]
    async fn test_delete_file_nonexistent_returns_error() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file_path = temp.path().join("nonexistent.txt");

        let result = remove_file(file_path.to_string_lossy().to_string()).await;

        assert!(result.is_err(), "removing nonexistent file should fail");
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[tokio::test]
    async fn test_delete_directory_returns_error() {
        let temp = tempdir().expect("Failed to create temp dir");
        let dir_path = temp.path().join("a_directory");
        fs::create_dir(&dir_path).expect("Failed to create dir");

        let result = remove_file(dir_path.to_string_lossy().to_string()).await;

        assert!(result.is_err(), "remove_file on a directory should fail");
        assert!(result.unwrap_err().contains("directory"));
    }

    #[tokio::test]
    async fn test_create_file_basic() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file_path = temp.path().join("new_file.txt");

        let result = create_file(file_path.to_string_lossy().to_string()).await;

        assert!(result.is_ok(), "create_file should succeed: {:?}", result.err());
        assert!(file_path.exists(), "file should exist after creation");
    }

    #[tokio::test]
    async fn test_create_file_creates_parent_dirs() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file_path = temp.path().join("nested").join("deep").join("file.txt");

        let result = create_file(file_path.to_string_lossy().to_string()).await;

        assert!(result.is_ok(), "create_file with nested dirs should succeed");
        assert!(file_path.exists(), "file should exist after creation with nested dirs");
    }

    #[tokio::test]
    async fn test_read_text_file_returns_content() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file_path = temp.path().join("readable.txt");
        let content = "line 1\nline 2\nline 3";

        fs::write(&file_path, content).expect("Failed to write");

        let result = read_text_file(file_path.to_string_lossy().to_string()).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), content);
    }

    #[tokio::test]
    async fn test_read_text_file_nonexistent_returns_error() {
        let result = read_text_file("/nonexistent/path/file.txt".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_file_exist_true_and_false() {
        let temp = tempdir().expect("Failed to create temp dir");
        let existing = temp.path().join("exists.txt");
        File::create(&existing).expect("Failed to create file");

        let result_exists = file_exist(existing.to_string_lossy().to_string()).await;
        assert!(result_exists.is_ok());
        assert!(result_exists.unwrap(), "existing file should return true");

        let result_missing = file_exist(temp.path().join("missing.txt").to_string_lossy().to_string()).await;
        assert!(result_missing.is_ok());
        assert!(!result_missing.unwrap(), "missing file should return false");
    }

    #[tokio::test]
    async fn test_get_directory_sizes() {
        let temp = tempdir().expect("Failed to create temp dir");

        // Create a subdirectory with files
        let sub = temp.path().join("subdir");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("a.txt"), "hello").unwrap();
        fs::write(sub.join("b.txt"), "world!").unwrap();

        // Create a file at root
        fs::write(temp.path().join("root.txt"), "root content").unwrap();

        let result = get_directory_sizes(temp.path().to_string_lossy().to_string()).await;

        assert!(result.is_ok(), "get_directory_sizes should succeed");
        let entries = result.unwrap();
        assert!(!entries.is_empty(), "should return entries");

        // Verify we have both the subdirectory and the root file
        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"subdir"), "should contain subdir");
        assert!(names.contains(&"root.txt"), "should contain root.txt");

        // Verify the subdir entry is marked as a directory
        let subdir_entry = entries.iter().find(|e| e.name == "subdir").unwrap();
        assert!(subdir_entry.is_dir);
        assert!(subdir_entry.size > 0, "subdir should have non-zero size");
        assert_eq!(subdir_entry.children_count, 2, "subdir should have 2 children");
    }

    #[tokio::test]
    async fn test_get_directory_sizes_nonexistent_returns_error() {
        let result = get_directory_sizes("/nonexistent/directory/path".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_copy_handles_special_characters() {
        let temp = tempdir().expect("Failed to create temp dir");
        let src_path = temp.path().join("file with spaces & (parens).txt");
        let dst_path = temp.path().join("copied file with spaces & (parens).txt");

        let content = "special characters in filename test";
        fs::write(&src_path, content).expect("Failed to write source");

        let result = copy(
            src_path.to_string_lossy().to_string(),
            dst_path.to_string_lossy().to_string(),
        ).await;

        assert!(result.is_ok(), "copy with special chars should succeed: {:?}", result.err());
        assert!(dst_path.exists(), "dest with special chars should exist");

        let dst_content = fs::read_to_string(&dst_path).unwrap();
        assert_eq!(dst_content, content);
    }

    #[tokio::test]
    async fn test_copy_directory_recursive() {
        let temp = tempdir().expect("Failed to create temp dir");
        let src_dir = temp.path().join("src_dir");
        let dst_dir = temp.path().join("dst_dir");

        // Create source directory structure
        fs::create_dir_all(src_dir.join("nested")).unwrap();
        fs::write(src_dir.join("file1.txt"), "content1").unwrap();
        fs::write(src_dir.join("nested").join("file2.txt"), "content2").unwrap();

        let result = copy(
            src_dir.to_string_lossy().to_string(),
            dst_dir.to_string_lossy().to_string(),
        ).await;

        assert!(result.is_ok(), "recursive copy should succeed");
        assert!(dst_dir.join("file1.txt").exists(), "file1 should be copied");
        assert!(dst_dir.join("nested").join("file2.txt").exists(), "nested file2 should be copied");

        let content = fs::read_to_string(dst_dir.join("nested").join("file2.txt")).unwrap();
        assert_eq!(content, "content2");
    }

    #[tokio::test]
    async fn test_move_file_basic() {
        let temp = tempdir().expect("Failed to create temp dir");
        let src = temp.path().join("source_move.txt");
        let dst = temp.path().join("dest_move.txt");

        let content = "move me!";
        fs::write(&src, content).expect("Failed to write source");

        let result = move_file(
            src.to_string_lossy().to_string(),
            dst.to_string_lossy().to_string(),
        ).await;

        assert!(result.is_ok(), "move_file should succeed: {:?}", result.err());
        assert!(!src.exists(), "source should not exist after move");
        assert!(dst.exists(), "destination should exist after move");
        assert_eq!(fs::read_to_string(&dst).unwrap(), content);
    }

    #[tokio::test]
    async fn test_move_file_nonexistent_returns_error() {
        let temp = tempdir().expect("Failed to create temp dir");
        let src = temp.path().join("nonexistent.txt");
        let dst = temp.path().join("dest.txt");

        let result = move_file(
            src.to_string_lossy().to_string(),
            dst.to_string_lossy().to_string(),
        ).await;

        assert!(result.is_err(), "move of nonexistent file should fail");
    }

    #[tokio::test]
    async fn test_read_binary_file_basic() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file_path = temp.path().join("binary.bin");
        let data: Vec<u8> = vec![0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD];

        fs::write(&file_path, &data).expect("Failed to write binary");

        let result = read_binary_file(file_path.to_string_lossy().to_string()).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), data);
    }

    #[tokio::test]
    async fn test_bulk_rename_preview() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file1 = temp.path().join("img_001.png");
        let file2 = temp.path().join("img_002.png");

        File::create(&file1).unwrap();
        File::create(&file2).unwrap();

        let result = bulk_rename(
            vec![
                file1.to_string_lossy().to_string(),
                file2.to_string_lossy().to_string(),
            ],
            "img_".to_string(),
            "photo_".to_string(),
            true, // preview_only
        ).await;

        assert!(result.is_ok(), "bulk_rename preview should succeed");
        let results = result.unwrap();
        assert_eq!(results.len(), 2);

        // In preview mode, original files should still exist
        assert!(file1.exists(), "file1 should still exist in preview mode");
        assert!(file2.exists(), "file2 should still exist in preview mode");

        // New names should be correct
        assert!(results[0].new_name.starts_with("photo_"));
        assert!(results[1].new_name.starts_with("photo_"));
    }

    #[tokio::test]
    async fn test_bulk_rename_actual() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file1 = temp.path().join("old_a.txt");
        let file2 = temp.path().join("old_b.txt");

        File::create(&file1).unwrap();
        File::create(&file2).unwrap();

        let result = bulk_rename(
            vec![
                file1.to_string_lossy().to_string(),
                file2.to_string_lossy().to_string(),
            ],
            "old_".to_string(),
            "new_".to_string(),
            false, // actually rename
        ).await;

        assert!(result.is_ok(), "bulk_rename should succeed");
        let results = result.unwrap();
        assert_eq!(results.len(), 2);

        // Original files should be gone
        assert!(!file1.exists(), "old file1 should be renamed");
        assert!(!file2.exists(), "old file2 should be renamed");

        // New files should exist
        assert!(temp.path().join("new_a.txt").exists());
        assert!(temp.path().join("new_b.txt").exists());
    }

    #[tokio::test]
    async fn test_bulk_rename_rejects_long_pattern() {
        let pattern = "a".repeat(201);
        let result = bulk_rename(
            vec!["somefile.txt".to_string()],
            pattern,
            "replacement".to_string(),
            true,
        ).await;

        assert!(result.is_err(), "pattern longer than 200 chars should be rejected");
        assert!(result.unwrap_err().contains("too long"));
    }

    #[tokio::test]
    async fn test_get_file_templates_returns_known_templates() {
        let result = get_file_templates().await;
        assert!(result.is_ok());
        let templates = result.unwrap();
        assert!(!templates.is_empty(), "should have templates");

        let ids: Vec<&str> = templates.iter().map(|t| t.id.as_str()).collect();
        assert!(ids.contains(&"html"), "should contain html template");
        assert!(ids.contains(&"python"), "should contain python template");
        assert!(ids.contains(&"json"), "should contain json template");
    }

    #[tokio::test]
    async fn test_create_from_template() {
        let temp = tempdir().expect("Failed to create temp dir");

        let result = create_from_template(
            temp.path().to_string_lossy().to_string(),
            "json".to_string(),
            "data.json".to_string(),
        ).await;

        assert!(result.is_ok(), "create_from_template should succeed: {:?}", result.err());
        let created_path = result.unwrap();
        let content = fs::read_to_string(&created_path).unwrap();
        assert!(content.contains("{"), "JSON template should contain opening brace");
    }

    #[tokio::test]
    async fn test_create_from_template_already_exists_returns_error() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file_path = temp.path().join("data.json");
        File::create(&file_path).unwrap();

        let result = create_from_template(
            temp.path().to_string_lossy().to_string(),
            "json".to_string(),
            "data.json".to_string(),
        ).await;

        assert!(result.is_err(), "should fail when file already exists");
        assert!(result.unwrap_err().contains("already exists"));
    }
}