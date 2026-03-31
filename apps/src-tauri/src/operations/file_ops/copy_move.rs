use crate::audit_log::log_operation;
use crate::operations::progress::{generate_operation_id, ProgressManager};
use crate::operations::undo_redo::{record_operation, FileOperation};
use crate::operations::validate_file_path;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::thread;
use tauri::command;
use tracing::warn;

#[command]
pub async fn copy_with_progress(
    source: String,
    destination: String,
    progress_manager: tauri::State<'_, Arc<ProgressManager>>,
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
            copy_file_with_progress(src, dst, &progress_manager, &operation_id_clone)
        } else if src.is_dir() {
            copy_directory_with_progress(src, dst, &progress_manager, &operation_id_clone)
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
                log_operation(
                    "copy",
                    vec![
                        src.to_string_lossy().to_string(),
                        dst.to_string_lossy().to_string(),
                    ],
                    Some(e.clone()),
                    false,
                );
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
    progress_manager: tauri::State<'_, Arc<ProgressManager>>,
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

        let result = move_with_progress_impl(src, dst, &progress_manager, &operation_id_clone);

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
                log_operation(
                    "move",
                    vec![
                        src.to_string_lossy().to_string(),
                        dst.to_string_lossy().to_string(),
                    ],
                    Some(e.clone()),
                    false,
                );
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

    progress_manager.update_progress(operation_id, src.to_string_lossy().to_string(), 0, 0);

    // Create parent directory if it doesn't exist
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    // Use std::fs::copy for now, but could be enhanced with chunked copying for large files
    fs::copy(src, dst).map_err(|e| format!("Failed to copy file: {}", e))?;

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

    let entries =
        fs::read_dir(src).map_err(|e| format!("Failed to read source directory: {}", e))?;

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
            let metadata = entry
                .metadata()
                .map_err(|e| format!("Failed to get metadata: {}", e))?;
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
        fs::remove_file(src).map_err(|e| format!("Failed to remove source file: {}", e))?;
    } else if src.is_dir() {
        copy_directory_with_progress(src, dst, progress_manager, operation_id)?;
        fs::remove_dir_all(src).map_err(|e| format!("Failed to remove source directory: {}", e))?;
    }

    Ok(())
}

fn count_directory_contents(dir: &Path) -> Result<(u64, u64), String> {
    let mut file_count = 0u64;
    let mut total_size = 0u64;

    fn count_recursive(
        dir: &Path,
        file_count: &mut u64,
        total_size: &mut u64,
    ) -> Result<(), String> {
        let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

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

    tokio::task::spawn_blocking(move || {
        let src = Path::new(&source);
        let dst = Path::new(&destination);

        if !src.exists() {
            return Err("Source file does not exist".to_string());
        }

        // Check if source is a symlink -- warn and skip to avoid following symlinks
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
            fs::copy(src, dst).map_err(|e| format!("Failed to copy file: {}", e))?;
        } else if src.is_dir() {
            copy_dir_recursive(src, dst)?;
        }

        record_operation(FileOperation::Copy {
            src: source.clone(),
            dest: destination.clone(),
        });
        log_operation("copy", vec![source, destination], None, true);

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

pub(crate) fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    use rayon::prelude::*;

    if !dst.exists() {
        fs::create_dir_all(dst)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    }

    let entries: Vec<_> = fs::read_dir(src)
        .map_err(|e| format!("Failed to read source directory: {}", e))?
        .filter_map(|e| e.ok())
        .collect();

    // Separate directories from files so we can create dirs first (sequential)
    let mut dirs = Vec::new();
    let mut files = Vec::new();
    for entry in &entries {
        let src_path = entry.path();
        // Skip symlinks to avoid following them into unexpected locations
        if let Ok(meta) = fs::symlink_metadata(&src_path) {
            if meta.file_type().is_symlink() {
                warn!("[Copy] Skipping symlink: {}", src_path.display());
                continue;
            }
        }
        if src_path.is_dir() {
            dirs.push(entry);
        } else if src_path.is_file() {
            files.push(entry);
        }
    }

    // Copy files in parallel
    let file_errors: Vec<String> = files
        .par_iter()
        .filter_map(|entry| {
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            fs::copy(&src_path, &dst_path)
                .err()
                .map(|e| format!("Failed to copy file {}: {}", src_path.display(), e))
        })
        .collect();

    if let Some(err) = file_errors.into_iter().next() {
        return Err(err);
    }

    // Recurse into subdirectories (sequential for dir creation, but files within are parallel)
    for entry in dirs {
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        copy_dir_recursive(&src_path, &dst_path)?;
    }

    Ok(())
}

#[command]
pub async fn move_file(source: String, destination: String) -> Result<(), String> {
    validate_file_path(&source)?;
    validate_file_path(&destination)?;

    tokio::task::spawn_blocking(move || {
        let src = Path::new(&source);
        let dst = Path::new(&destination);

        if !src.exists() {
            return Err("Source file does not exist".to_string());
        }

        // Try rename first (most efficient for same filesystem)
        if fs::rename(src, dst).is_err() {
            // If rename fails (different filesystems), fall back to copy + delete
            if src.is_file() {
                fs::copy(src, dst).map_err(|e| format!("Failed to copy file: {}", e))?;
                fs::remove_file(src)
                    .map_err(|e| format!("Failed to remove source file: {}", e))?;
            } else if src.is_dir() {
                copy_dir_recursive(src, dst)?;
                fs::remove_dir_all(src)
                    .map_err(|e| format!("Failed to remove source directory: {}", e))?;
            }
        }

        record_operation(FileOperation::Move {
            src: source.clone(),
            dest: destination.clone(),
        });
        log_operation("move", vec![source, destination], None, true);

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn rename(old_path: String, new_path: String) -> Result<(), String> {
    validate_file_path(&old_path)?;
    validate_file_path(&new_path)?;

    tokio::task::spawn_blocking(move || {
        let old = Path::new(&old_path);
        let new = Path::new(&new_path);

        if !old.exists() {
            return Err("Source file does not exist".to_string());
        }

        fs::rename(old, new).map_err(|e| format!("Failed to rename: {}", e))?;

        record_operation(FileOperation::Rename {
            old_path: old_path.clone(),
            new_path: new_path.clone(),
        });
        log_operation("rename", vec![old_path, new_path], None, true);

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::tempdir;

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
        )
        .await;

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
        )
        .await;

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
        )
        .await;

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
        )
        .await;

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
        )
        .await;

        assert!(result.is_err(), "rename of nonexistent file should fail");
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
        )
        .await;

        assert!(
            result.is_ok(),
            "copy with special chars should succeed: {:?}",
            result.err()
        );
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
        )
        .await;

        assert!(result.is_ok(), "recursive copy should succeed");
        assert!(dst_dir.join("file1.txt").exists(), "file1 should be copied");
        assert!(
            dst_dir.join("nested").join("file2.txt").exists(),
            "nested file2 should be copied"
        );

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
        )
        .await;

        assert!(
            result.is_ok(),
            "move_file should succeed: {:?}",
            result.err()
        );
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
        )
        .await;

        assert!(result.is_err(), "move of nonexistent file should fail");
    }
}
