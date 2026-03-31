use std::fs::{self, File};
use std::io::{self, Write};
use std::path::Path;

use tauri::{AppHandle, Emitter};
use zip::write::ZipWriter;

use super::{
    ArchiveEntry, ArchiveInfo, CompressionFormat, CompressionOptions, ExtractionOptions,
};
use crate::operations::is_hidden_file;
use crate::operations::types::{FileOperationProgress, OperationStatus};

// ─── Extraction ─────────────────────────────────────────────────────────────

pub(crate) async fn extract_zip(
    archive_path: &Path,
    options: &ExtractionOptions,
) -> Result<String, String> {
    let archive_path = archive_path.to_path_buf();
    let options = options.clone();
    tokio::task::spawn_blocking(move || extract_zip_sync(&archive_path, &options))
        .await
        .map_err(|e| e.to_string())?
}

fn extract_zip_sync(archive_path: &Path, options: &ExtractionOptions) -> Result<String, String> {
    use std::io::BufReader;
    use zip::ZipArchive;

    let file = File::open(archive_path).map_err(|e| format!("Failed to open ZIP file: {}", e))?;

    let reader = BufReader::new(file);
    let mut archive =
        ZipArchive::new(reader).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;

        // Zip Slip protection: reject any entry containing path traversal components
        let raw_name = file.name();

        // Reject entries with any form of parent directory reference
        if raw_name.contains("..") {
            continue; // Skip -- path traversal attempt
        }

        // Strip leading slashes for safety
        let safe_name = raw_name
            .trim_start_matches('/')
            .trim_start_matches('\\')
            .to_string();

        if safe_name.is_empty() {
            continue;
        }

        let outpath = Path::new(&options.output_directory).join(&safe_name);

        // Verify the resolved path is within the output directory (canonical check)
        let canonical_output = std::fs::canonicalize(&options.output_directory)
            .map_err(|e| format!("Failed to canonicalize output directory: {}", e))?;

        // For new files we must check by constructing the canonical target path
        // Create parent dirs first so we can canonicalize
        if let Some(parent) = outpath.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).ok();
            }
        }
        // Check parent directory (which now exists) is within output
        let check_path = outpath.parent().unwrap_or(&outpath);
        if check_path.exists() {
            let canonical_outpath = std::fs::canonicalize(check_path)
                .map_err(|e| format!("Failed to canonicalize path: {}", e))?;
            if !canonical_outpath.starts_with(&canonical_output) {
                continue; // Skip this entry -- path traversal attempt
            }
        }

        if safe_name.ends_with('/') {
            // Directory
            if options.preserve_permissions {
                fs::create_dir_all(&outpath)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            }
        } else {
            // File
            if let Some(parent) = outpath.parent() {
                if !parent.exists() && options.preserve_permissions {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                }
            }

            // Check if file exists and handle overwrite
            if outpath.exists() && !options.overwrite_existing {
                continue;
            }

            let mut outfile = File::create(&outpath)
                .map_err(|e| format!("Failed to create output file: {}", e))?;

            io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }
    }

    Ok(options.output_directory.clone())
}

// ─── Selective extraction ───────────────────────────────────────────────────

pub(crate) async fn extract_zip_selected(
    archive_path: &Path,
    entries: &[String],
    output_dir: &str,
    overwrite: bool,
    app_handle: &AppHandle,
    op_id: &str,
) -> Result<String, String> {
    let archive_path = archive_path.to_path_buf();
    let entries = entries.to_vec();
    let output_dir = output_dir.to_string();
    let app_handle = app_handle.clone();
    let op_id = op_id.to_string();
    tokio::task::spawn_blocking(move || {
        use std::collections::HashSet;
        use std::io::BufReader;
        use zip::ZipArchive;

        let selected: HashSet<&str> = entries.iter().map(|s| s.as_str()).collect();

        let file = File::open(&archive_path)
            .map_err(|e| format!("Failed to open ZIP file: {}", e))?;
        let reader = BufReader::new(file);
        let mut archive =
            ZipArchive::new(reader).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

        let total = entries.len() as u64;
        let mut processed: u64 = 0;

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;

            let raw_name = file.name().to_string();

            if !selected.contains(raw_name.as_str()) {
                continue;
            }

            if raw_name.contains("..") {
                continue;
            }

            let safe_name = raw_name
                .trim_start_matches('/')
                .trim_start_matches('\\')
                .to_string();

            if safe_name.is_empty() {
                continue;
            }

            let outpath = Path::new(&output_dir).join(&safe_name);

            let canonical_output = std::fs::canonicalize(&output_dir)
                .map_err(|e| format!("Failed to canonicalize output directory: {}", e))?;

            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    std::fs::create_dir_all(parent).ok();
                }
            }

            let check_path = outpath.parent().unwrap_or(&outpath);
            if check_path.exists() {
                let canonical_outpath = std::fs::canonicalize(check_path)
                    .map_err(|e| format!("Failed to canonicalize path: {}", e))?;
                if !canonical_outpath.starts_with(&canonical_output) {
                    continue;
                }
            }

            if safe_name.ends_with('/') {
                fs::create_dir_all(&outpath)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            } else {
                if let Some(parent) = outpath.parent() {
                    if !parent.exists() {
                        fs::create_dir_all(parent)
                            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                    }
                }

                if outpath.exists() && !overwrite {
                    continue;
                }

                let mut outfile = File::create(&outpath)
                    .map_err(|e| format!("Failed to create output file: {}", e))?;

                io::copy(&mut file, &mut outfile)
                    .map_err(|e| format!("Failed to extract file: {}", e))?;
            }

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
                    current_file: safe_name,
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

        Ok(output_dir)
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Archive info ───────────────────────────────────────────────────────────

pub(crate) async fn get_zip_info(archive_path: &Path) -> Result<ArchiveInfo, String> {
    use std::io::BufReader;
    use zip::ZipArchive;

    let file = File::open(archive_path).map_err(|e| format!("Failed to open ZIP file: {}", e))?;

    let reader = BufReader::new(file);
    let mut archive =
        ZipArchive::new(reader).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    let mut total_files = 0u64;
    let mut total_directories = 0u64;
    let mut total_size = 0u64;
    let compressed_size = archive_path.metadata().map(|m| m.len()).unwrap_or(0);
    let mut files = Vec::new();
    let mut is_encrypted = false;

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

    for i in 0..archive.len() {
        // Use by_index_raw to avoid decryption failures on encrypted archives
        let file = archive
            .by_index_raw(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;

        let is_directory = file.name().ends_with('/');
        if is_directory {
            total_directories += 1;
        } else {
            total_files += 1;
            total_size += file.size();
        }

        let modified = {
            let dt = file.last_modified();
            chrono::NaiveDate::from_ymd_opt(dt.year() as i32, dt.month() as u32, dt.day() as u32)
                .and_then(|date| {
                    date.and_hms_opt(dt.hour() as u32, dt.minute() as u32, dt.second() as u32)
                })
                .and_then(|ndt| ndt.and_utc().timestamp().try_into().ok())
                .unwrap_or(0u64)
        };

        // Detect encryption from the compression method
        if file.compression() == zip::CompressionMethod::AES {
            is_encrypted = true;
        }

        let entry_name = file
            .name()
            .split('/')
            .rfind(|s| !s.is_empty())
            .unwrap_or("")
            .to_string();
        files.push(ArchiveEntry {
            name: entry_name,
            path: file.name().to_string(),
            size: file.size(),
            compressed_size: file.compressed_size(),
            is_directory,
            modified,
        });
    }

    // Also detect standard ZIP encryption by trying to read entries normally
    if !is_encrypted {
        for i in 0..archive.len() {
            if archive.by_index(i).is_err() {
                is_encrypted = true;
                break;
            }
        }
    }

    Ok(ArchiveInfo {
        format: CompressionFormat::Zip,
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

// ─── Compression ────────────────────────────────────────────────────────────

pub(crate) async fn compress_to_zip(
    file_paths: &[String],
    output_path: &Path,
    options: &CompressionOptions,
) -> Result<String, String> {
    use zip::write::FileOptions;
    use zip::CompressionMethod;

    let file =
        File::create(output_path).map_err(|e| format!("Failed to create ZIP file: {}", e))?;

    let mut zip = ZipWriter::new(file);
    let zip_options = FileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .compression_level(options.compression_level.map(|l| l as i32));

    for file_path in file_paths {
        let path = Path::new(file_path);
        if path.is_file() {
            add_file_to_zip(&mut zip, path, None, &zip_options, options)?;
        } else if path.is_dir() {
            add_directory_to_zip(&mut zip, path, None, &zip_options, options)?;
        }
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalize ZIP file: {}", e))?;

    Ok(output_path.to_string_lossy().to_string())
}

fn add_file_to_zip<W: Write + io::Seek>(
    zip: &mut ZipWriter<W>,
    file_path: &Path,
    base_path: Option<&Path>,
    options: &zip::write::FileOptions,
    compression_options: &CompressionOptions,
) -> Result<(), String> {
    let relative_path = if let Some(base) = base_path {
        file_path.strip_prefix(base).unwrap_or(file_path)
    } else {
        file_path.file_name().map(Path::new).unwrap_or(file_path)
    };

    // Skip hidden files if not requested
    if !compression_options.include_hidden && is_hidden_file(file_path) {
        return Ok(());
    }

    let mut file = File::open(file_path)
        .map_err(|e| format!("Failed to open file {}: {}", file_path.display(), e))?;

    zip.start_file(relative_path.to_string_lossy(), *options)
        .map_err(|e| format!("Failed to start ZIP entry: {}", e))?;

    io::copy(&mut file, zip).map_err(|e| format!("Failed to write file to ZIP: {}", e))?;

    Ok(())
}

fn add_directory_to_zip<W: Write + io::Seek>(
    zip: &mut ZipWriter<W>,
    dir_path: &Path,
    base_path: Option<&Path>,
    options: &zip::write::FileOptions,
    compression_options: &CompressionOptions,
) -> Result<(), String> {
    let base = base_path.unwrap_or(dir_path);

    for entry in fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory {}: {}", dir_path.display(), e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            add_file_to_zip(zip, &path, Some(base), options, compression_options)?;
        } else if path.is_dir() {
            add_directory_to_zip(zip, &path, Some(base), options, compression_options)?;
        }
    }

    Ok(())
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use tempfile::tempdir;

    fn create_test_zip(zip_path: &Path, files: &[(&str, &[u8])]) {
        use zip::write::FileOptions;
        use zip::CompressionMethod;

        let file = File::create(zip_path).expect("Failed to create ZIP file");
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

        for (name, content) in files {
            zip.start_file(*name, options)
                .expect("Failed to start ZIP entry");
            zip.write_all(content).expect("Failed to write ZIP content");
        }
        zip.finish().expect("Failed to finalize ZIP");
    }

    #[tokio::test]
    async fn test_compress_and_extract_zip() {
        let temp = tempdir().expect("Failed to create temp dir");

        let file1_path = temp.path().join("hello.txt");
        let file2_path = temp.path().join("world.txt");
        fs::write(&file1_path, "Hello!").unwrap();
        fs::write(&file2_path, "World!").unwrap();

        let zip_path = temp.path().join("archive.zip");
        let extract_dir = temp.path().join("extracted");
        fs::create_dir(&extract_dir).unwrap();

        let options = CompressionOptions {
            format: CompressionFormat::Zip,
            compression_level: Some(6),
            password: None,
            include_hidden: false,
            follow_symlinks: false,
        };
        let compress_result = compress_to_zip(
            &[
                file1_path.to_string_lossy().to_string(),
                file2_path.to_string_lossy().to_string(),
            ],
            &zip_path,
            &options,
        )
        .await;

        assert!(
            compress_result.is_ok(),
            "compress should succeed: {:?}",
            compress_result.err()
        );
        assert!(zip_path.exists(), "ZIP file should exist");
        assert!(
            zip_path.metadata().unwrap().len() > 0,
            "ZIP should not be empty"
        );

        let extract_options = ExtractionOptions {
            output_directory: extract_dir.to_string_lossy().to_string(),
            password: None,
            overwrite_existing: true,
            preserve_permissions: true,
            include_hidden: false,
        };
        let extract_result = extract_zip(&zip_path, &extract_options).await;

        assert!(
            extract_result.is_ok(),
            "extract should succeed: {:?}",
            extract_result.err()
        );

        assert!(
            extract_dir.join("hello.txt").exists(),
            "hello.txt should be extracted"
        );
        assert!(
            extract_dir.join("world.txt").exists(),
            "world.txt should be extracted"
        );
        assert_eq!(
            fs::read_to_string(extract_dir.join("hello.txt")).unwrap(),
            "Hello!"
        );
        assert_eq!(
            fs::read_to_string(extract_dir.join("world.txt")).unwrap(),
            "World!"
        );
    }

    #[tokio::test]
    async fn test_get_archive_info_zip() {
        let temp = tempdir().expect("Failed to create temp dir");
        let zip_path = temp.path().join("test_info.zip");

        create_test_zip(
            &zip_path,
            &[
                ("file1.txt", b"content1"),
                ("file2.txt", b"content2"),
                ("subdir/file3.txt", b"content3"),
            ],
        );

        let result = get_zip_info(&zip_path).await;

        assert!(
            result.is_ok(),
            "get_zip_info should succeed: {:?}",
            result.err()
        );
        let info = result.unwrap();

        assert_eq!(info.total_files, 3, "should have 3 files");
        assert!(info.total_size > 0, "total size should be > 0");
        assert!(!info.is_encrypted, "should not be encrypted");
        assert_eq!(info.files.len(), 3, "files vec should have 3 entries");
    }

    #[tokio::test]
    async fn test_extract_nonexistent_archive_fails() {
        let temp = tempdir().expect("Failed to create temp dir");
        let extract_dir = temp.path().join("output");
        fs::create_dir(&extract_dir).unwrap();

        let extract_options = ExtractionOptions {
            output_directory: extract_dir.to_string_lossy().to_string(),
            password: None,
            overwrite_existing: true,
            preserve_permissions: true,
            include_hidden: false,
        };

        let result = extract_zip(Path::new("/nonexistent/archive.zip"), &extract_options).await;

        assert!(
            result.is_err(),
            "extracting nonexistent archive should fail"
        );
    }

    #[tokio::test]
    async fn test_zip_slip_protection() {
        let temp = tempdir().expect("Failed to create temp dir");
        let extract_dir = temp.path().join("output");
        fs::create_dir(&extract_dir).unwrap();

        let zip_path = temp.path().join("malicious.zip");
        {
            use zip::write::FileOptions;
            use zip::CompressionMethod;

            let file = File::create(&zip_path).expect("Failed to create ZIP");
            let mut zip = ZipWriter::new(file);
            let options = FileOptions::default().compression_method(CompressionMethod::Stored);

            zip.start_file("../../etc/evil.txt", options)
                .expect("Failed to start entry");
            zip.write_all(b"malicious").expect("Failed to write");
            zip.start_file("safe.txt", options)
                .expect("Failed to start entry");
            zip.write_all(b"safe content").expect("Failed to write");
            zip.finish().expect("Failed to finalize");
        }

        let extract_options = ExtractionOptions {
            output_directory: extract_dir.to_string_lossy().to_string(),
            password: None,
            overwrite_existing: true,
            preserve_permissions: true,
            include_hidden: true,
        };
        let result = extract_zip(&zip_path, &extract_options).await;
        assert!(
            result.is_ok(),
            "extract should succeed but skip malicious entries"
        );

        assert!(
            extract_dir.join("safe.txt").exists(),
            "safe.txt should be extracted"
        );

        assert!(
            !temp.path().join("etc").join("evil.txt").exists(),
            "path traversal entry should not be extracted outside output dir"
        );
    }
}
