use std::io::Read;
use std::path::Path;

use tauri::{AppHandle, Emitter};

use crate::operations::types::{FileOperationProgress, OperationStatus};

/// Safely extract TAR entries, skipping path traversal attempts and symlinks/hardlinks.
pub(crate) fn extract_tar_safely<R: Read>(
    archive: &mut tar::Archive<R>,
    output_directory: &str,
) -> Result<(), String> {
    for entry in archive
        .entries()
        .map_err(|e| format!("Failed to read TAR entries: {}", e))?
    {
        let mut entry = entry.map_err(|e| format!("Failed to read TAR entry: {}", e))?;
        let path = entry
            .path()
            .map_err(|e| format!("Failed to get entry path: {}", e))?;

        // Skip absolute paths and path traversal
        if path.is_absolute()
            || path
                .components()
                .any(|c| matches!(c, std::path::Component::ParentDir))
        {
            continue;
        }

        // Skip symlinks and hardlinks
        let entry_type = entry.header().entry_type();
        if entry_type.is_symlink() || entry_type.is_hard_link() {
            continue;
        }

        entry
            .unpack_in(output_directory)
            .map_err(|e| format!("Failed to extract entry: {}", e))?;
    }
    Ok(())
}

/// Safely extract selected TAR entries with progress reporting.
pub(crate) fn extract_tar_selected_safely<R: Read>(
    archive: &mut tar::Archive<R>,
    entries: &[String],
    output_dir: &str,
    overwrite: bool,
    app_handle: &AppHandle,
    op_id: &str,
    archive_path: &Path,
) -> Result<(), String> {
    use std::collections::HashSet;

    let selected: HashSet<&str> = entries.iter().map(|s| s.as_str()).collect();
    let total = entries.len() as u64;
    let mut processed: u64 = 0;

    for entry_result in archive
        .entries()
        .map_err(|e| format!("Failed to read TAR entries: {}", e))?
    {
        let mut entry = entry_result.map_err(|e| format!("Failed to read TAR entry: {}", e))?;
        let path = entry
            .path()
            .map_err(|e| format!("Failed to get entry path: {}", e))?;
        let path_str = path.to_string_lossy().to_string();

        if !selected.contains(path_str.as_str()) {
            continue;
        }

        if path.is_absolute()
            || path
                .components()
                .any(|c| matches!(c, std::path::Component::ParentDir))
        {
            continue;
        }

        let entry_type = entry.header().entry_type();
        if entry_type.is_symlink() || entry_type.is_hard_link() {
            continue;
        }

        let outpath = Path::new(output_dir).join(&*path);

        if !overwrite && outpath.exists() {
            continue;
        }

        entry
            .unpack_in(output_dir)
            .map_err(|e| format!("Failed to extract entry: {}", e))?;

        processed += 1;
        let pct = if total > 0 {
            (processed as f64 / total as f64) * 100.0
        } else {
            100.0
        };
        let _ = app_handle.emit(
            "file-operation-progress",
            FileOperationProgress {
                operation_id: op_id.to_string(),
                operation_type: "extract".to_string(),
                source_path: archive_path.to_string_lossy().to_string(),
                destination_path: Some(output_dir.to_string()),
                current_file: path_str,
                bytes_processed: 0,
                total_bytes: 0,
                files_processed: processed,
                total_files: total,
                progress_percentage: pct,
                speed_bytes_per_second: 0.0,
                estimated_remaining_seconds: None,
                status: OperationStatus::InProgress,
                error_message: None,
                copy_strategy: None,
                hardware_acceleration: false,
            },
        );
    }

    Ok(())
}
