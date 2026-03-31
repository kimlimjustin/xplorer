use std::fs;
use std::path::Path;

use tauri::{AppHandle, Emitter};

use super::{ArchiveEntry, ArchiveInfo, CompressionFormat, ExtractionOptions};
use crate::operations::types::{FileOperationProgress, OperationStatus};

// ─── Extraction ─────────────────────────────────────────────────────────────

pub(crate) async fn extract_rar(
    archive_path: &Path,
    options: &ExtractionOptions,
) -> Result<String, String> {
    let src = archive_path.to_path_buf();
    let dest = Path::new(&options.output_directory).to_path_buf();

    if !dest.exists() {
        fs::create_dir_all(&dest)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    let password = options.password.clone();
    let overwrite = options.overwrite_existing;

    tokio::task::spawn_blocking(move || {
        let opened = if let Some(ref pw) = password {
            if !pw.is_empty() {
                unrar::Archive::with_password(&src, pw.as_bytes())
                    .open_for_processing()
                    .map_err(|e| format!("Failed to open RAR archive: {}", e))?
            } else {
                unrar::Archive::new(&src)
                    .open_for_processing()
                    .map_err(|e| format!("Failed to open RAR archive: {}", e))?
            }
        } else {
            unrar::Archive::new(&src)
                .open_for_processing()
                .map_err(|e| format!("Failed to open RAR archive: {}", e))?
        };

        let mut cursor = Some(opened);
        while let Some(archive) = cursor.take() {
            match archive.read_header() {
                Ok(Some(header)) => {
                    let entry = header.entry();
                    let entry_path = entry.filename.to_string_lossy().to_string();

                    if entry_path.contains("..") {
                        cursor = Some(
                            header
                                .skip()
                                .map_err(|e| format!("Failed to skip RAR entry: {}", e))?,
                        );
                        continue;
                    }

                    let out_path = dest.join(&entry_path);

                    if out_path.exists() && !overwrite {
                        cursor = Some(
                            header
                                .skip()
                                .map_err(|e| format!("Failed to skip RAR entry: {}", e))?,
                        );
                        continue;
                    }

                    cursor = Some(header.extract_to(&dest).map_err(|e| {
                        format!("Failed to extract RAR entry '{}': {}", entry_path, e)
                    })?);
                }
                Ok(None) => break,
                Err(e) => return Err(format!("Failed to read RAR header: {}", e)),
            }
        }

        Ok::<_, String>(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(options.output_directory.clone())
}

// ─── Archive info ───────────────────────────────────────────────────────────

pub(crate) async fn get_rar_info(archive_path: &Path) -> Result<ArchiveInfo, String> {
    let src = archive_path.to_path_buf();
    let compressed_size = archive_path.metadata().map(|m| m.len()).unwrap_or(0);

    let archive_modified = archive_path
        .metadata()
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let archive_created = archive_path
        .metadata()
        .and_then(|m| m.created())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let (files, total_files, total_directories, total_size, is_encrypted) =
        tokio::task::spawn_blocking(move || {
            let archive = unrar::Archive::new(&src)
                .open_for_listing()
                .map_err(|e| format!("Failed to open RAR archive for listing: {}", e))?;

            let mut total_files = 0u64;
            let mut total_directories = 0u64;
            let mut total_size = 0u64;
            let mut files = Vec::new();
            let mut is_encrypted = false;

            for entry_result in archive {
                let entry =
                    entry_result.map_err(|e| format!("Failed to read RAR entry: {}", e))?;

                let is_dir = entry.is_directory();
                let size = entry.unpacked_size;
                let entry_compressed_size = 0u64;
                let full_path = entry.filename.to_string_lossy().to_string();

                if entry.is_encrypted() {
                    is_encrypted = true;
                }

                if is_dir {
                    total_directories += 1;
                } else {
                    total_files += 1;
                    total_size += size;
                }

                let modified = msdos_time_to_unix(entry.file_time);

                let entry_name = full_path
                    .split('/')
                    .chain(full_path.split('\\'))
                    .rfind(|s| !s.is_empty())
                    .unwrap_or("")
                    .to_string();

                files.push(ArchiveEntry {
                    name: entry_name,
                    path: full_path,
                    size,
                    compressed_size: entry_compressed_size,
                    is_directory: is_dir,
                    modified,
                });
            }

            Ok::<_, String>((
                files,
                total_files,
                total_directories,
                total_size,
                is_encrypted,
            ))
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??;

    Ok(ArchiveInfo {
        format: CompressionFormat::Rar,
        total_files,
        total_directories,
        total_size,
        compressed_size,
        is_encrypted,
        created: archive_created,
        modified: archive_modified,
        files,
    })
}

// ─── Selective extraction ───────────────────────────────────────────────────

pub(crate) async fn extract_rar_selected(
    archive_path: &Path,
    entries: &[String],
    output_dir: &str,
    overwrite: bool,
    app_handle: &AppHandle,
    op_id: &str,
) -> Result<String, String> {
    use std::collections::HashSet;

    let selected: HashSet<String> = entries.iter().cloned().collect();
    let total = entries.len() as u64;
    let src = archive_path.to_path_buf();
    let dest = Path::new(output_dir).to_path_buf();
    let app = app_handle.clone();
    let oid = op_id.to_string();
    let arc_str = archive_path.to_string_lossy().to_string();
    let out_str = output_dir.to_string();

    if !dest.exists() {
        fs::create_dir_all(&dest)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    tokio::task::spawn_blocking(move || {
        let opened = unrar::Archive::new(&src)
            .open_for_processing()
            .map_err(|e| format!("Failed to open RAR archive: {}", e))?;

        let mut processed: u64 = 0;
        let mut cursor = Some(opened);

        while let Some(archive) = cursor.take() {
            match archive.read_header() {
                Ok(Some(header)) => {
                    let entry = header.entry();
                    let entry_path = entry.filename.to_string_lossy().to_string();

                    if !selected.contains(&entry_path) || entry_path.contains("..") {
                        cursor = Some(
                            header
                                .skip()
                                .map_err(|e| format!("Failed to skip RAR entry: {}", e))?,
                        );
                        continue;
                    }

                    let out_path = dest.join(&entry_path);

                    if out_path.exists() && !overwrite {
                        cursor = Some(
                            header
                                .skip()
                                .map_err(|e| format!("Failed to skip RAR entry: {}", e))?,
                        );
                        continue;
                    }

                    cursor = Some(header.extract_to(&dest).map_err(|e| {
                        format!("Failed to extract RAR entry '{}': {}", entry_path, e)
                    })?);

                    processed += 1;
                    let pct = if total > 0 {
                        (processed as f64 / total as f64) * 100.0
                    } else {
                        100.0
                    };
                    let _ = app.emit(
                        "file-operation-progress",
                        FileOperationProgress {
                            operation_id: oid.clone(),
                            operation_type: "extract".to_string(),
                            source_path: arc_str.clone(),
                            destination_path: Some(out_str.clone()),
                            current_file: entry_path,
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
                Ok(None) => break,
                Err(e) => return Err(format!("Failed to read RAR header: {}", e)),
            }
        }

        Ok::<_, String>(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(output_dir.to_string())
}

// ─── Helpers ────────────────────────────────────────────────────────────────

fn msdos_time_to_unix(dos_time: u32) -> u64 {
    let time_part = (dos_time & 0xFFFF) as u16;
    let date_part = ((dos_time >> 16) & 0xFFFF) as u16;

    let seconds = ((time_part & 0x1F) * 2) as u32;
    let minutes = ((time_part >> 5) & 0x3F) as u32;
    let hours = ((time_part >> 11) & 0x1F) as u32;

    let day = (date_part & 0x1F) as u32;
    let month = ((date_part >> 5) & 0x0F) as u32;
    let year = (((date_part >> 9) & 0x7F) + 1980) as i32;

    chrono::NaiveDate::from_ymd_opt(year, month, day)
        .and_then(|d| d.and_hms_opt(hours, minutes, seconds))
        .map(|dt| dt.and_utc().timestamp() as u64)
        .unwrap_or(0)
}
