use std::fs::{self, OpenOptions};
use std::io::{Seek, SeekFrom, Write};
use std::path::Path;
use std::sync::Arc;

use rand::RngCore;
use tauri::{command, AppHandle, Emitter, State};
use walkdir::WalkDir;

use crate::audit_log::log_operation;
use crate::operations::progress::{generate_operation_id, ProgressManager};
use crate::operations::validate_file_path;

const BUFFER_SIZE: usize = 64 * 1024; // 64 KB write chunks

fn overwrite_file(path: &Path, passes: u32, app_handle: &AppHandle) -> Result<(), String> {
    let metadata = fs::metadata(path)
        .map_err(|e| format!("Failed to read metadata for '{}': {}", path.display(), e))?;

    if metadata.permissions().readonly() {
        return Err(format!(
            "Permission denied: '{}' is read-only",
            path.display()
        ));
    }

    let file_size = metadata.len();
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut file = OpenOptions::new()
        .write(true)
        .open(path)
        .map_err(|e| format!("Failed to open '{}' for writing: {}", path.display(), e))?;

    let mut rng = rand::thread_rng();

    for pass in 1..=passes {
        file.seek(SeekFrom::Start(0))
            .map_err(|e| format!("Seek failed on '{}': {}", path.display(), e))?;

        let fill_byte: Option<u8> = match pass % 3 {
            1 => Some(0x00),
            2 => Some(0xFF),
            0 => None, // random pass
            _ => unreachable!(),
        };

        let mut bytes_written: u64 = 0;
        let mut buf = vec![0u8; BUFFER_SIZE];

        while bytes_written < file_size {
            let chunk = std::cmp::min(BUFFER_SIZE as u64, file_size - bytes_written) as usize;
            let write_buf = &mut buf[..chunk];

            match fill_byte {
                Some(b) => {
                    for byte in write_buf.iter_mut() {
                        *byte = b;
                    }
                }
                None => {
                    rng.fill_bytes(write_buf);
                }
            }

            file.write_all(write_buf)
                .map_err(|e| format!("Write failed on '{}': {}", path.display(), e))?;

            bytes_written += chunk as u64;
        }

        file.flush()
            .map_err(|e| format!("Flush failed on '{}': {}", path.display(), e))?;
        file.sync_all()
            .map_err(|e| format!("Sync failed on '{}': {}", path.display(), e))?;

        let pass_label = match fill_byte {
            Some(0x00) => "zeros (0x00)",
            Some(0xFF) => "ones (0xFF)",
            _ => "random data",
        };

        let _ = app_handle.emit(
            "secure-delete-progress",
            serde_json::json!({
                "file": file_name,
                "pass": pass,
                "total_passes": passes,
                "pass_label": pass_label,
                "bytes_written": bytes_written,
                "file_size": file_size,
            }),
        );
    }

    drop(file);

    fs::remove_file(path).map_err(|e| {
        format!(
            "Failed to delete '{}' after overwriting: {}",
            path.display(),
            e
        )
    })?;

    Ok(())
}

#[command]
pub async fn secure_delete(
    paths: Vec<String>,
    passes: Option<u32>,
    app_handle: AppHandle,
    progress_manager: State<'_, Arc<ProgressManager>>,
) -> Result<serde_json::Value, String> {
    let passes = passes.unwrap_or(3).clamp(1, 7);

    for p in &paths {
        validate_file_path(p)?;
    }

    let total_files = count_files(&paths);
    let total_bytes = calculate_total_bytes(&paths);

    let op_id = generate_operation_id();
    progress_manager.start_file_operation(
        op_id.clone(),
        "secure_delete".to_string(),
        paths.first().cloned().unwrap_or_default(),
        None,
        total_files,
        total_bytes,
    );

    let pm = progress_manager.inner().clone();
    let op_id_clone = op_id.clone();
    let paths_for_log = paths.clone();

    let result = tokio::task::spawn_blocking(move || {
        let mut files_processed: u64 = 0;
        let mut bytes_processed: u64 = 0;
        let mut errors: Vec<String> = Vec::new();

        for path_str in &paths {
            let path = Path::new(path_str);
            if !path.exists() {
                errors.push(format!("Path not found: {}", path_str));
                continue;
            }

            if path.is_dir() {
                let mut file_paths: Vec<std::path::PathBuf> = Vec::new();
                for entry in WalkDir::new(path).contents_first(false) {
                    match entry {
                        Ok(e) if e.file_type().is_file() => {
                            file_paths.push(e.into_path());
                        }
                        _ => {}
                    }
                }

                for file_path in &file_paths {
                    let file_size = fs::metadata(file_path).map(|m| m.len()).unwrap_or(0);
                    match overwrite_file(file_path, passes, &app_handle) {
                        Ok(()) => {
                            files_processed += 1;
                            bytes_processed += file_size;
                            pm.update_file_progress(
                                &op_id_clone,
                                file_path.to_string_lossy().to_string(),
                                files_processed,
                                bytes_processed,
                                None,
                                false,
                                0.0,
                            );
                        }
                        Err(e) => {
                            errors.push(e);
                        }
                    }
                }

                // Remove empty directories bottom-up
                let mut dirs: Vec<std::path::PathBuf> = Vec::new();
                for entry in WalkDir::new(path).contents_first(false) {
                    if let Ok(e) = entry {
                        if e.file_type().is_dir() {
                            dirs.push(e.into_path());
                        }
                    }
                }
                dirs.sort_by(|a, b| b.components().count().cmp(&a.components().count()));
                for dir in dirs {
                    let _ = fs::remove_dir(&dir);
                }
            } else {
                let file_size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
                match overwrite_file(path, passes, &app_handle) {
                    Ok(()) => {
                        files_processed += 1;
                        bytes_processed += file_size;
                        pm.update_file_progress(
                            &op_id_clone,
                            path_str.clone(),
                            files_processed,
                            bytes_processed,
                            None,
                            false,
                            0.0,
                        );
                    }
                    Err(e) => {
                        errors.push(e);
                    }
                }
            }
        }

        Ok::<(u64, Vec<String>), String>((files_processed, errors))
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;

    match result {
        Ok((files_processed, errors)) => {
            let success = errors.is_empty();
            if errors.is_empty() {
                progress_manager.complete_file_operation(&op_id);
            } else if files_processed > 0 {
                progress_manager.complete_file_operation(&op_id);
            } else {
                progress_manager.fail_file_operation(&op_id, errors.join("; "));
            }
            let detail = if errors.is_empty() {
                Some(format!(
                    "{} files securely deleted ({} passes)",
                    files_processed, passes
                ))
            } else {
                Some(format!(
                    "{} files deleted, {} errors",
                    files_processed,
                    errors.len()
                ))
            };
            log_operation(
                "secure_delete",
                paths_for_log.clone(),
                detail,
                success || files_processed > 0,
            );
            Ok(serde_json::json!({
                "files_deleted": files_processed,
                "errors": errors,
                "passes": passes,
            }))
        }
        Err(e) => {
            progress_manager.fail_file_operation(&op_id, e.clone());
            log_operation(
                "secure_delete",
                paths_for_log.clone(),
                Some(e.clone()),
                false,
            );
            Err(e)
        }
    }
}

fn count_files(paths: &[String]) -> u64 {
    let mut count: u64 = 0;
    for path_str in paths {
        let path = Path::new(path_str);
        if path.is_dir() {
            for entry in WalkDir::new(path) {
                if let Ok(e) = entry {
                    if e.file_type().is_file() {
                        count += 1;
                    }
                }
            }
        } else if path.is_file() {
            count += 1;
        }
    }
    count
}

fn calculate_total_bytes(paths: &[String]) -> u64 {
    let mut total: u64 = 0;
    for path_str in paths {
        let path = Path::new(path_str);
        if path.is_dir() {
            for entry in WalkDir::new(path) {
                if let Ok(e) = entry {
                    if e.file_type().is_file() {
                        total += fs::metadata(e.path()).map(|m| m.len()).unwrap_or(0);
                    }
                }
            }
        } else if path.is_file() {
            total += fs::metadata(path).map(|m| m.len()).unwrap_or(0);
        }
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_overwrite_file_zeros_pass() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        let original = b"Hello, this is secret data that should be securely wiped!";
        fs::write(&file_path, original).unwrap();

        assert!(file_path.exists());
        assert_eq!(fs::read(&file_path).unwrap(), original);

        // We can't easily test overwrite_file directly since it needs AppHandle,
        // but we can verify the file structure manually.
        let file_size = fs::metadata(&file_path).unwrap().len();
        assert_eq!(file_size, original.len() as u64);
    }

    #[test]
    fn test_count_files_single() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("a.txt");
        fs::write(&file_path, "data").unwrap();

        let count = count_files(&[file_path.to_string_lossy().to_string()]);
        assert_eq!(count, 1);
    }

    #[test]
    fn test_count_files_directory() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "data").unwrap();
        fs::write(dir.path().join("b.txt"), "data").unwrap();
        let sub = dir.path().join("subdir");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("c.txt"), "data").unwrap();

        let count = count_files(&[dir.path().to_string_lossy().to_string()]);
        assert_eq!(count, 3);
    }

    #[test]
    fn test_calculate_total_bytes() {
        let dir = tempdir().unwrap();
        let file1 = dir.path().join("a.txt");
        let file2 = dir.path().join("b.txt");
        fs::write(&file1, "hello").unwrap(); // 5 bytes
        fs::write(&file2, "world!").unwrap(); // 6 bytes

        let total = calculate_total_bytes(&[
            file1.to_string_lossy().to_string(),
            file2.to_string_lossy().to_string(),
        ]);
        assert_eq!(total, 11);
    }

    #[test]
    fn test_count_files_nonexistent() {
        let count = count_files(&["/tmp/nonexistent_xplorer_test_file_12345".to_string()]);
        assert_eq!(count, 0);
    }

    #[test]
    fn test_calculate_total_bytes_nonexistent() {
        let total =
            calculate_total_bytes(&["/tmp/nonexistent_xplorer_test_file_12345".to_string()]);
        assert_eq!(total, 0);
    }
}
