use std::fs;
use std::path::Path;

use super::copy_dir_recursive_simple;
use super::FileOperation;

/// Re-execute an operation (redo).
pub(crate) fn execute_redo(op: &FileOperation) -> Result<(), String> {
    match op {
        FileOperation::Copy { src, dest } => {
            let src_path = Path::new(src);
            let dest_path = Path::new(dest);
            if !src_path.exists() {
                return Err(format!("Cannot redo copy: source {} no longer exists", src));
            }
            if let Some(parent) = dest_path.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent dir: {}", e))?;
                }
            }
            if src_path.is_dir() {
                copy_dir_recursive_simple(src_path, dest_path)
            } else {
                fs::copy(src_path, dest_path)
                    .map(|_| ())
                    .map_err(|e| format!("Failed to redo copy: {}", e))
            }
        }
        FileOperation::Move { src, dest } => {
            let src_path = Path::new(src);
            let dest_path = Path::new(dest);
            if !src_path.exists() {
                return Err(format!("Cannot redo move: source {} no longer exists", src));
            }
            if let Some(parent) = dest_path.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent dir: {}", e))?;
                }
            }
            fs::rename(src_path, dest_path).or_else(|_| {
                if src_path.is_dir() {
                    copy_dir_recursive_simple(src_path, dest_path)?;
                    fs::remove_dir_all(src_path)
                        .map_err(|e| format!("Failed to remove after cross-device move: {}", e))
                } else {
                    fs::copy(src_path, dest_path)
                        .map_err(|e| format!("Failed to copy for redo move: {}", e))?;
                    fs::remove_file(src_path)
                        .map_err(|e| format!("Failed to remove after cross-device move: {}", e))
                }
            })
        }
        FileOperation::Delete {
            original_path,
            staging_path,
            was_dir,
        } => {
            // Redo delete = move it back to staging
            let original = Path::new(original_path);
            let staging = Path::new(staging_path);
            if !original.exists() {
                return Err(format!(
                    "Cannot redo delete: {} no longer exists",
                    original_path
                ));
            }
            fs::rename(original, staging).or_else(|_| {
                if *was_dir {
                    copy_dir_recursive_simple(original, staging)?;
                    fs::remove_dir_all(original)
                        .map_err(|e| format!("Failed to remove after cross-device move: {}", e))
                } else {
                    fs::copy(original, staging)
                        .map_err(|e| format!("Failed to copy for redo delete: {}", e))?;
                    fs::remove_file(original)
                        .map_err(|e| format!("Failed to remove after cross-device move: {}", e))
                }
            })
        }
        FileOperation::Rename { old_path, new_path } => {
            let old = Path::new(old_path);
            let new = Path::new(new_path);
            if !old.exists() {
                return Err(format!("Cannot redo rename: {} no longer exists", old_path));
            }
            fs::rename(old, new).map_err(|e| format!("Failed to redo rename: {}", e))
        }
    }
}
