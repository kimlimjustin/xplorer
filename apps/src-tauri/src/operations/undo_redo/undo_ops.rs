use std::fs;
use std::path::Path;

use super::copy_dir_recursive_simple;
use super::remove_path;
use super::FileOperation;

/// Execute the inverse of an operation (undo).
pub(crate) fn execute_undo(op: &FileOperation) -> Result<(), String> {
    match op {
        FileOperation::Copy { dest, .. } => {
            // Undo copy = delete the copied file
            let dest_path = Path::new(dest);
            if dest_path.exists() {
                remove_path(dest_path)
            } else {
                // Already gone, nothing to undo
                Ok(())
            }
        }
        FileOperation::Move { src, dest } => {
            // Undo move = move it back from dest to src
            let dest_path = Path::new(dest);
            let src_path = Path::new(src);
            if !dest_path.exists() {
                return Err(format!("Cannot undo move: {} no longer exists", dest));
            }
            // Ensure parent of src exists
            if let Some(parent) = src_path.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent dir: {}", e))?;
                }
            }
            fs::rename(dest_path, src_path).or_else(|_| {
                // Cross-device fallback
                if dest_path.is_dir() {
                    copy_dir_recursive_simple(dest_path, src_path)?;
                    fs::remove_dir_all(dest_path)
                        .map_err(|e| format!("Failed to remove after cross-device move: {}", e))
                } else {
                    fs::copy(dest_path, src_path)
                        .map_err(|e| format!("Failed to copy for cross-device move: {}", e))?;
                    fs::remove_file(dest_path)
                        .map_err(|e| format!("Failed to remove after cross-device move: {}", e))
                }
            })
        }
        FileOperation::Delete {
            original_path,
            staging_path,
            ..
        } => {
            // Undo delete = restore from staging area
            let staging = Path::new(staging_path);
            let original = Path::new(original_path);
            if !staging.exists() {
                return Err(format!(
                    "Cannot undo delete: staging file {} no longer exists",
                    staging_path
                ));
            }
            // Ensure parent directory exists
            if let Some(parent) = original.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent dir: {}", e))?;
                }
            }
            fs::rename(staging, original).or_else(|_| {
                if staging.is_dir() {
                    copy_dir_recursive_simple(staging, original)?;
                    fs::remove_dir_all(staging)
                        .map_err(|e| format!("Failed to clean up staging: {}", e))
                } else {
                    fs::copy(staging, original)
                        .map_err(|e| format!("Failed to restore from staging: {}", e))?;
                    fs::remove_file(staging)
                        .map_err(|e| format!("Failed to clean up staging: {}", e))
                }
            })
        }
        FileOperation::Rename { old_path, new_path } => {
            // Undo rename = rename back
            let new = Path::new(new_path);
            let old = Path::new(old_path);
            if !new.exists() {
                return Err(format!("Cannot undo rename: {} no longer exists", new_path));
            }
            fs::rename(new, old).map_err(|e| format!("Failed to undo rename: {}", e))
        }
    }
}
