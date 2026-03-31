mod rar_ops;
mod safety;
mod sevenz_ops;
mod tar_ops;
mod zip_ops;

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Emitter};

use crate::audit_log::log_operation;
use crate::operations::progress::generate_operation_id;
use crate::operations::types::{FileOperationProgress, OperationStatus};
use crate::operations::validate_file_path;

use tar_ops::TarFormat;

// ─── Shared types ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionOptions {
    pub format: CompressionFormat,
    pub compression_level: Option<u32>, // 1-9 for most formats
    pub password: Option<String>,
    pub include_hidden: bool,
    pub follow_symlinks: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CompressionFormat {
    Zip,
    Tar,
    TarGz,
    TarBz2,
    TarXz,
    SevenZ,
    Rar,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionProgress {
    pub current_file: String,
    pub processed_files: u64,
    pub total_files: u64,
    pub processed_bytes: u64,
    pub total_bytes: u64,
    pub progress_percentage: f64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionOptions {
    pub output_directory: String,
    pub password: Option<String>,
    pub overwrite_existing: bool,
    pub preserve_permissions: bool,
    pub include_hidden: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveInfo {
    pub format: CompressionFormat,
    pub total_files: u64,
    pub total_directories: u64,
    pub total_size: u64,
    pub compressed_size: u64,
    pub is_encrypted: bool,
    pub created: u64,
    pub modified: u64,
    pub files: Vec<ArchiveEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub compressed_size: u64,
    pub is_directory: bool,
    pub modified: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionInfo {
    pub total_files: u64,
    pub total_directories: u64,
    pub total_size: u64,
    pub estimated_compressed_size: u64,
}

// ─── Tauri command functions ────────────────────────────────────────────────

#[command]
pub async fn compress_files(
    app_handle: AppHandle,
    file_paths: Vec<String>,
    output_path: String,
    options: CompressionOptions,
) -> Result<String, String> {
    for path in &file_paths {
        validate_file_path(path)?;
    }
    validate_file_path(&output_path)?;
    let output = Path::new(&output_path);
    let op_id = generate_operation_id();
    let out_name = output
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // Validate input paths exist and estimate total file count for progress.
    let mut total_file_count: u64 = 0;
    for path in &file_paths {
        let p = Path::new(path);
        if !p.exists() {
            return Err(format!("File or directory does not exist: {}", path));
        }
        if p.is_file() {
            total_file_count += 1;
        } else if p.is_dir() {
            total_file_count += jwalk::WalkDir::new(p)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .count() as u64;
        }
    }

    // Create output directory if it doesn't exist
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    // Emit starting progress
    let _ = app_handle.emit(
        "file-operation-progress",
        FileOperationProgress {
            operation_id: op_id.clone(),
            operation_type: "compress".to_string(),
            source_path: file_paths.first().cloned().unwrap_or_default(),
            destination_path: Some(output_path.clone()),
            current_file: out_name.clone(),
            bytes_processed: 0,
            total_bytes: 0,
            files_processed: 0,
            total_files: total_file_count,
            progress_percentage: 0.0,
            speed_bytes_per_second: 0.0,
            estimated_remaining_seconds: None,
            status: OperationStatus::InProgress,
            error_message: None,
            copy_strategy: None,
            hardware_acceleration: false,
        },
    );

    let result = match options.format {
        CompressionFormat::Zip => zip_ops::compress_to_zip(&file_paths, output, &options).await,
        CompressionFormat::Tar => {
            tar_ops::compress_to_tar_generic(&file_paths, output, &options, TarFormat::Plain).await
        }
        CompressionFormat::TarGz => {
            tar_ops::compress_to_tar_generic(&file_paths, output, &options, TarFormat::Gz).await
        }
        CompressionFormat::TarBz2 => {
            tar_ops::compress_to_tar_generic(&file_paths, output, &options, TarFormat::Bz2).await
        }
        CompressionFormat::TarXz => {
            tar_ops::compress_to_tar_generic(&file_paths, output, &options, TarFormat::Xz).await
        }
        CompressionFormat::SevenZ => {
            sevenz_ops::compress_to_7z(&file_paths, output, &options).await
        }
        CompressionFormat::Rar => {
            Err("RAR creation is not supported (proprietary format)".to_string())
        }
    };

    // Emit completion/failure
    let status = if result.is_ok() {
        OperationStatus::Completed
    } else {
        OperationStatus::Failed
    };
    let _ = app_handle.emit(
        "file-operation-progress",
        FileOperationProgress {
            operation_id: op_id,
            operation_type: "compress".to_string(),
            source_path: file_paths.first().cloned().unwrap_or_default(),
            destination_path: Some(output_path.clone()),
            current_file: out_name,
            bytes_processed: 0,
            total_bytes: 0,
            files_processed: file_paths.len() as u64,
            total_files: file_paths.len() as u64,
            progress_percentage: if result.is_ok() { 100.0 } else { 0.0 },
            speed_bytes_per_second: 0.0,
            estimated_remaining_seconds: None,
            status,
            error_message: result.as_ref().err().cloned(),
            copy_strategy: None,
            hardware_acceleration: false,
        },
    );

    let mut audit_paths = file_paths.clone();
    audit_paths.push(output_path);
    log_operation(
        "compress",
        audit_paths,
        result.as_ref().err().cloned(),
        result.is_ok(),
    );

    result
}

#[command]
pub async fn get_compression_info(file_paths: Vec<String>) -> Result<CompressionInfo, String> {
    let mut total_size = 0u64;
    let mut total_files = 0u64;
    let mut total_dirs = 0u64;

    for path in file_paths {
        let path = Path::new(&path);
        if path.is_file() {
            total_files += 1;
            total_size += path
                .metadata()
                .map_err(|e| format!("Failed to get metadata for {}: {}", path.display(), e))?
                .len();
        } else if path.is_dir() {
            let (files, dirs, size) = count_directory_contents(path)?;
            total_files += files;
            total_dirs += dirs;
            total_size += size;
        }
    }

    Ok(CompressionInfo {
        total_files,
        total_directories: total_dirs,
        total_size,
        estimated_compressed_size: estimate_compressed_size(total_size),
    })
}

#[command]
pub async fn extract_archive(
    app_handle: AppHandle,
    archive_path: String,
    options: ExtractionOptions,
) -> Result<String, String> {
    validate_file_path(&archive_path)?;
    validate_file_path(&options.output_directory)?;
    let arc_path = Path::new(&archive_path);
    let op_id = generate_operation_id();
    let arc_name = arc_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    if !arc_path.exists() {
        return Err("Archive file does not exist".to_string());
    }

    let format = detect_archive_format(arc_path)?;

    let output_dir = Path::new(&options.output_directory);
    if !output_dir.exists() {
        fs::create_dir_all(output_dir)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    // Emit starting progress
    let _ = app_handle.emit(
        "file-operation-progress",
        FileOperationProgress {
            operation_id: op_id.clone(),
            operation_type: "extract".to_string(),
            source_path: archive_path.clone(),
            destination_path: Some(options.output_directory.clone()),
            current_file: arc_name.clone(),
            bytes_processed: 0,
            total_bytes: 0,
            files_processed: 0,
            total_files: 0,
            progress_percentage: 0.0,
            speed_bytes_per_second: 0.0,
            estimated_remaining_seconds: None,
            status: OperationStatus::InProgress,
            error_message: None,
            copy_strategy: None,
            hardware_acceleration: false,
        },
    );

    let result = match format {
        CompressionFormat::Zip => zip_ops::extract_zip(arc_path, &options).await,
        CompressionFormat::Tar => {
            tar_ops::extract_tar_generic(arc_path, &options, TarFormat::Plain).await
        }
        CompressionFormat::TarGz => {
            tar_ops::extract_tar_generic(arc_path, &options, TarFormat::Gz).await
        }
        CompressionFormat::TarBz2 => {
            tar_ops::extract_tar_generic(arc_path, &options, TarFormat::Bz2).await
        }
        CompressionFormat::TarXz => {
            tar_ops::extract_tar_generic(arc_path, &options, TarFormat::Xz).await
        }
        CompressionFormat::SevenZ => sevenz_ops::extract_7z(arc_path, &options).await,
        CompressionFormat::Rar => rar_ops::extract_rar(arc_path, &options).await,
    };

    let status = if result.is_ok() {
        OperationStatus::Completed
    } else {
        OperationStatus::Failed
    };
    let _ = app_handle.emit(
        "file-operation-progress",
        FileOperationProgress {
            operation_id: op_id,
            operation_type: "extract".to_string(),
            source_path: archive_path.clone(),
            destination_path: Some(options.output_directory.clone()),
            current_file: arc_name,
            bytes_processed: 0,
            total_bytes: 0,
            files_processed: 0,
            total_files: 0,
            progress_percentage: if result.is_ok() { 100.0 } else { 0.0 },
            speed_bytes_per_second: 0.0,
            estimated_remaining_seconds: None,
            status,
            error_message: result.as_ref().err().cloned(),
            copy_strategy: None,
            hardware_acceleration: false,
        },
    );

    log_operation(
        "extract",
        vec![archive_path, options.output_directory],
        result.as_ref().err().cloned(),
        result.is_ok(),
    );

    result
}

#[command]
pub async fn get_archive_info(archive_path: String) -> Result<ArchiveInfo, String> {
    let archive_path = Path::new(&archive_path);

    if !archive_path.exists() {
        return Err("Archive file does not exist".to_string());
    }

    let format = detect_archive_format(archive_path)?;

    match format {
        CompressionFormat::Zip => zip_ops::get_zip_info(archive_path).await,
        CompressionFormat::Tar => {
            tar_ops::get_tar_info_generic(archive_path, TarFormat::Plain).await
        }
        CompressionFormat::TarGz => {
            tar_ops::get_tar_info_generic(archive_path, TarFormat::Gz).await
        }
        CompressionFormat::TarBz2 => {
            tar_ops::get_tar_info_generic(archive_path, TarFormat::Bz2).await
        }
        CompressionFormat::TarXz => {
            tar_ops::get_tar_info_generic(archive_path, TarFormat::Xz).await
        }
        CompressionFormat::SevenZ => sevenz_ops::get_7z_info(archive_path).await,
        CompressionFormat::Rar => rar_ops::get_rar_info(archive_path).await,
    }
}

#[command]
pub async fn extract_selected_entries(
    app_handle: AppHandle,
    archive_path: String,
    entries: Vec<String>,
    output_dir: String,
    overwrite: bool,
) -> Result<String, String> {
    validate_file_path(&archive_path)?;
    validate_file_path(&output_dir)?;
    let arc_path = Path::new(&archive_path);
    let op_id = generate_operation_id();
    let arc_name = arc_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    if !arc_path.exists() {
        return Err("Archive file does not exist".to_string());
    }

    if entries.is_empty() {
        return Err("No entries selected for extraction".to_string());
    }

    let format = detect_archive_format(arc_path)?;

    let output_path = Path::new(&output_dir);
    if !output_path.exists() {
        fs::create_dir_all(output_path)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    let total_entries = entries.len() as u64;

    let _ = app_handle.emit(
        "file-operation-progress",
        FileOperationProgress {
            operation_id: op_id.clone(),
            operation_type: "extract".to_string(),
            source_path: archive_path.clone(),
            destination_path: Some(output_dir.clone()),
            current_file: arc_name.clone(),
            bytes_processed: 0,
            total_bytes: 0,
            files_processed: 0,
            total_files: total_entries,
            progress_percentage: 0.0,
            speed_bytes_per_second: 0.0,
            estimated_remaining_seconds: None,
            status: OperationStatus::InProgress,
            error_message: None,
            copy_strategy: None,
            hardware_acceleration: false,
        },
    );

    let result = match format {
        CompressionFormat::Zip => {
            zip_ops::extract_zip_selected(
                arc_path,
                &entries,
                &output_dir,
                overwrite,
                &app_handle,
                &op_id,
            )
            .await
        }
        CompressionFormat::Tar => {
            tar_ops::extract_tar_selected_generic(
                arc_path,
                &entries,
                &output_dir,
                overwrite,
                &app_handle,
                &op_id,
                TarFormat::Plain,
            )
            .await
        }
        CompressionFormat::TarGz => {
            tar_ops::extract_tar_selected_generic(
                arc_path,
                &entries,
                &output_dir,
                overwrite,
                &app_handle,
                &op_id,
                TarFormat::Gz,
            )
            .await
        }
        CompressionFormat::TarBz2 => {
            tar_ops::extract_tar_selected_generic(
                arc_path,
                &entries,
                &output_dir,
                overwrite,
                &app_handle,
                &op_id,
                TarFormat::Bz2,
            )
            .await
        }
        CompressionFormat::TarXz => {
            tar_ops::extract_tar_selected_generic(
                arc_path,
                &entries,
                &output_dir,
                overwrite,
                &app_handle,
                &op_id,
                TarFormat::Xz,
            )
            .await
        }
        CompressionFormat::SevenZ => {
            sevenz_ops::extract_7z_selected(
                arc_path,
                &entries,
                &output_dir,
                overwrite,
                &app_handle,
                &op_id,
            )
            .await
        }
        CompressionFormat::Rar => {
            rar_ops::extract_rar_selected(
                arc_path,
                &entries,
                &output_dir,
                overwrite,
                &app_handle,
                &op_id,
            )
            .await
        }
    };

    let status = if result.is_ok() {
        OperationStatus::Completed
    } else {
        OperationStatus::Failed
    };
    let _ = app_handle.emit(
        "file-operation-progress",
        FileOperationProgress {
            operation_id: op_id,
            operation_type: "extract".to_string(),
            source_path: archive_path,
            destination_path: Some(output_dir.clone()),
            current_file: arc_name,
            bytes_processed: 0,
            total_bytes: 0,
            files_processed: if result.is_ok() { total_entries } else { 0 },
            total_files: total_entries,
            progress_percentage: if result.is_ok() { 100.0 } else { 0.0 },
            speed_bytes_per_second: 0.0,
            estimated_remaining_seconds: None,
            status,
            error_message: result.as_ref().err().cloned(),
            copy_strategy: None,
            hardware_acceleration: false,
        },
    );

    result
}

#[command]
pub async fn is_archive(file_path: String) -> Result<bool, String> {
    let path = Path::new(&file_path);

    if !path.exists() || !path.is_file() {
        return Ok(false);
    }

    match detect_archive_format(path) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

fn detect_archive_format(path: &Path) -> Result<CompressionFormat, String> {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .ok_or("Unable to determine file extension")?
        .to_lowercase();

    // Handle compound extensions like .tar.gz
    let path_str = path.to_string_lossy().to_lowercase();

    if path_str.ends_with(".tar.gz") || path_str.ends_with(".tgz") {
        Ok(CompressionFormat::TarGz)
    } else if path_str.ends_with(".tar.bz2") || path_str.ends_with(".tbz2") {
        Ok(CompressionFormat::TarBz2)
    } else if path_str.ends_with(".tar.xz") || path_str.ends_with(".txz") {
        Ok(CompressionFormat::TarXz)
    } else {
        match extension.as_str() {
            "zip" => Ok(CompressionFormat::Zip),
            "tar" => Ok(CompressionFormat::Tar),
            "7z" => Ok(CompressionFormat::SevenZ),
            "rar" => Ok(CompressionFormat::Rar),
            _ => Err(format!("Unsupported archive format: {}", extension)),
        }
    }
}

fn count_directory_contents(dir: &Path) -> Result<(u64, u64, u64), String> {
    let mut files = 0u64;
    let mut dirs = 0u64;
    let mut total_size = 0u64;

    fn count_recursive(
        dir: &Path,
        files: &mut u64,
        dirs: &mut u64,
        size: &mut u64,
    ) -> Result<(), String> {
        for entry in
            fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let path = entry.path();

            if path.is_file() {
                *files += 1;
                *size += entry
                    .metadata()
                    .map_err(|e| format!("Failed to get metadata: {}", e))?
                    .len();
            } else if path.is_dir() {
                *dirs += 1;
                count_recursive(&path, files, dirs, size)?;
            }
        }

        Ok(())
    }

    count_recursive(dir, &mut files, &mut dirs, &mut total_size)?;
    Ok((files, dirs, total_size))
}

fn estimate_compressed_size(original_size: u64) -> u64 {
    // Very rough estimation - typically 30-70% compression ratio
    (original_size as f64 * 0.5) as u64
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use tempfile::tempdir;

    fn create_test_zip(zip_path: &Path, files: &[(&str, &[u8])]) {
        use zip::write::{FileOptions, ZipWriter};
        use zip::CompressionMethod;

        let file = std::fs::File::create(zip_path).expect("Failed to create ZIP file");
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
    async fn test_get_archive_info_nonexistent_fails() {
        let result = get_archive_info("/nonexistent/path/to/archive.zip".to_string()).await;
        assert!(result.is_err(), "should fail for nonexistent archive");
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_detect_archive_formats() {
        // (filename, expected_ok, format_name)
        let cases: Vec<(&str, bool, &str)> = vec![
            ("test.zip", true, "Zip"),
            ("test.tar", true, "Tar"),
            ("test.tar.gz", true, "TarGz"),
            ("test.tgz", true, "TarGz"),
            ("test.tar.bz2", true, "TarBz2"),
            ("test.tar.xz", true, "TarXz"),
            ("test.7z", true, "SevenZ"),
            ("test.rar", true, "Rar"),
            ("test.xyz", false, ""),
        ];
        for (filename, should_ok, expected_name) in cases {
            let result = detect_archive_format(Path::new(filename));
            if should_ok {
                let fmt = result.unwrap_or_else(|e| panic!("{} should succeed: {}", filename, e));
                let name = format!("{:?}", fmt);
                assert_eq!(name, expected_name, "format mismatch for {}", filename);
            } else {
                assert!(result.is_err(), "{} should fail", filename);
            }
        }
    }

    #[test]
    fn test_estimate_compressed_size() {
        let original = 1_000_000;
        let estimated = estimate_compressed_size(original);
        assert_eq!(estimated, 500_000);
    }

    #[test]
    fn test_count_directory_contents_fn() {
        let temp = tempdir().expect("Failed to create temp dir");
        let sub = temp.path().join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(temp.path().join("file1.txt"), "hello").unwrap();
        fs::write(sub.join("file2.txt"), "world").unwrap();

        let result = count_directory_contents(temp.path());
        assert!(result.is_ok());
        let (files, dirs, total_size) = result.unwrap();
        assert_eq!(files, 2, "should count 2 files");
        assert_eq!(dirs, 1, "should count 1 subdirectory");
        assert!(total_size > 0, "total size should be > 0");
    }

    #[tokio::test]
    async fn test_is_archive_for_zip() {
        let temp = tempdir().expect("Failed to create temp dir");
        let zip_path = temp.path().join("test.zip");
        create_test_zip(&zip_path, &[("file.txt", b"data")]);

        let result = is_archive(zip_path.to_string_lossy().to_string()).await;
        assert!(result.is_ok());
        assert!(result.unwrap(), "zip file should be recognized as archive");
    }

    #[tokio::test]
    async fn test_is_archive_for_non_archive() {
        let temp = tempdir().expect("Failed to create temp dir");
        let txt_path = temp.path().join("test.txt");
        fs::write(&txt_path, "not an archive").unwrap();

        let result = is_archive(txt_path.to_string_lossy().to_string()).await;
        assert!(result.is_ok());
        assert!(
            !result.unwrap(),
            "txt file should not be recognized as archive"
        );
    }

    #[tokio::test]
    async fn test_is_archive_nonexistent() {
        let result = is_archive("/nonexistent/file.zip".to_string()).await;
        assert!(result.is_ok());
        assert!(!result.unwrap(), "nonexistent file should return false");
    }

    #[tokio::test]
    async fn test_get_compression_info() {
        let temp = tempdir().expect("Failed to create temp dir");
        fs::write(temp.path().join("a.txt"), "hello").unwrap();
        fs::write(temp.path().join("b.txt"), "world").unwrap();

        let result = get_compression_info(vec![
            temp.path().join("a.txt").to_string_lossy().to_string(),
            temp.path().join("b.txt").to_string_lossy().to_string(),
        ])
        .await;

        assert!(result.is_ok(), "get_compression_info should succeed");
        let info = result.unwrap();
        assert_eq!(info.total_files, 2);
        assert!(info.total_size > 0);
        assert!(info.estimated_compressed_size > 0);
        assert!(info.estimated_compressed_size <= info.total_size);
    }
}
