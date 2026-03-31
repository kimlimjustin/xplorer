use std::fs::{self, File};
use std::path::Path;

use tauri::{AppHandle, Emitter};

use super::{ArchiveEntry, ArchiveInfo, CompressionFormat, CompressionOptions, ExtractionOptions};
use crate::operations::types::{FileOperationProgress, OperationStatus};

// ─── Extraction ─────────────────────────────────────────────────────────────

pub(crate) async fn extract_7z(
    archive_path: &Path,
    options: &ExtractionOptions,
) -> Result<String, String> {
    let src = archive_path.to_path_buf();
    let dest = Path::new(&options.output_directory).to_path_buf();

    if !dest.exists() {
        fs::create_dir_all(&dest)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    if let Some(ref pw) = options.password {
        if !pw.is_empty() {
            let pw = pw.clone();
            tokio::task::spawn_blocking(move || {
                sevenz_rust2::decompress_file_with_password(&src, &dest, pw.as_str().into())
                    .map_err(|e| format!("Failed to extract 7z archive: {}", e))
            })
            .await
            .map_err(|e| format!("Task join error: {}", e))??;
            return Ok(options.output_directory.clone());
        }
    }

    tokio::task::spawn_blocking(move || {
        sevenz_rust2::decompress_file(&src, &dest)
            .map_err(|e| format!("Failed to extract 7z archive: {}", e))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(options.output_directory.clone())
}

// ─── Compression ────────────────────────────────────────────────────────────

pub(crate) async fn compress_to_7z(
    file_paths: &[String],
    output_path: &Path,
    _options: &CompressionOptions,
) -> Result<String, String> {
    let output = output_path.to_path_buf();

    if file_paths.len() == 1 {
        let src = Path::new(&file_paths[0]).to_path_buf();
        let out = output.clone();
        tokio::task::spawn_blocking(move || {
            sevenz_rust2::compress_to_path(&src, &out)
                .map_err(|e| format!("Failed to create 7z archive: {}", e))
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??;
    } else {
        let temp_base = std::env::temp_dir().join(format!("xplorer_7z_{}", std::process::id()));
        fs::create_dir_all(&temp_base)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;

        for file_path in file_paths {
            let src = Path::new(file_path);
            let name = src.file_name().unwrap_or_default();
            let dest = temp_base.join(name);

            if src.is_file() {
                fs::copy(src, &dest)
                    .map_err(|e| format!("Failed to copy file to temp dir: {}", e))?;
            } else if src.is_dir() {
                copy_dir_recursive(src, &dest)?;
            }
        }

        let temp_path = temp_base.clone();
        let out = output.clone();
        tokio::task::spawn_blocking(move || {
            let result = sevenz_rust2::compress_to_path(&temp_path, &out)
                .map_err(|e| format!("Failed to create 7z archive: {}", e));
            let _ = fs::remove_dir_all(&temp_path);
            result
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??;
    }

    Ok(output.to_string_lossy().to_string())
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest)
        .map_err(|e| format!("Failed to create directory {}: {}", dest.display(), e))?;

    for entry in fs::read_dir(src)
        .map_err(|e| format!("Failed to read directory {}: {}", src.display(), e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path)
                .map_err(|e| format!("Failed to copy {}: {}", src_path.display(), e))?;
        }
    }

    Ok(())
}

// ─── Archive info ───────────────────────────────────────────────────────────

pub(crate) async fn get_7z_info(archive_path: &Path) -> Result<ArchiveInfo, String> {
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

    let (files, total_files, total_directories, total_size) =
        tokio::task::spawn_blocking(move || {
            let archive = sevenz_rust2::Archive::open(&src)
                .map_err(|e| format!("Failed to open 7z archive: {}", e))?;

            let mut total_files = 0u64;
            let mut total_directories = 0u64;
            let mut total_size = 0u64;
            let mut files = Vec::new();

            for entry in &archive.files {
                let is_dir = entry.is_directory();
                let size = entry.size();
                let name_str = entry.name().to_string();

                if is_dir {
                    total_directories += 1;
                } else {
                    total_files += 1;
                    total_size += size;
                }

                let modified = {
                    let nt = entry.last_modified_date();
                    let sys_time: std::time::SystemTime = nt.into();
                    sys_time
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs())
                        .unwrap_or(0)
                };

                let entry_name = name_str
                    .split('/')
                    .rfind(|s| !s.is_empty())
                    .unwrap_or("")
                    .to_string();

                files.push(ArchiveEntry {
                    name: entry_name,
                    path: name_str,
                    size,
                    compressed_size: 0,
                    is_directory: is_dir,
                    modified,
                });
            }

            Ok::<_, String>((files, total_files, total_directories, total_size))
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??;

    Ok(ArchiveInfo {
        format: CompressionFormat::SevenZ,
        total_files,
        total_directories,
        total_size,
        compressed_size,
        is_encrypted: false,
        created: archive_created,
        modified: archive_modified,
        files,
    })
}

// ─── Selective extraction ───────────────────────────────────────────────────

pub(crate) async fn extract_7z_selected(
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
    let overwrite_flag = overwrite;
    let app = app_handle.clone();
    let oid = op_id.to_string();
    let arc_str = archive_path.to_string_lossy().to_string();
    let out_str = output_dir.to_string();

    if !dest.exists() {
        fs::create_dir_all(&dest)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    tokio::task::spawn_blocking(move || {
        let file = File::open(&src).map_err(|e| format!("Failed to open 7z file: {}", e))?;

        let reader = std::io::BufReader::new(file);
        let mut processed: u64 = 0;

        sevenz_rust2::decompress_with_extract_fn(reader, &dest, |entry, reader, out_path| {
            let entry_name = entry.name().to_string();

            if !selected.contains(&entry_name) {
                return Ok(true);
            }

            if entry_name.contains("..") {
                return Ok(true);
            }

            if entry.is_directory() {
                if !out_path.exists() {
                    std::fs::create_dir_all(out_path).ok();
                }
            } else {
                if out_path.exists() && !overwrite_flag {
                    return Ok(true);
                }

                if let Some(parent) = out_path.parent() {
                    if !parent.exists() {
                        std::fs::create_dir_all(parent).ok();
                    }
                }

                let mut outfile = File::create(out_path)
                    .map_err(|e| sevenz_rust2::Error::Io(e, "Failed to create file".into()))?;
                std::io::copy(reader, &mut outfile)
                    .map_err(|e| sevenz_rust2::Error::Io(e, "Failed to write file".into()))?;
            }

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
                    current_file: entry_name,
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

            Ok(true)
        })
        .map_err(|e| format!("Failed to extract 7z entries: {}", e))?;

        Ok::<_, String>(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(output_dir.to_string())
}
