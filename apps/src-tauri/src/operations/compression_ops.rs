use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::Path;
use tauri::{command, AppHandle, Emitter};
use serde::{Deserialize, Serialize};

use crate::operations::types::{FileOperationProgress, OperationStatus};
use crate::operations::progress::generate_operation_id;
use crate::audit_log::log_operation;

// Import ZIP writer
use zip::write::ZipWriter;

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

#[command]
pub async fn compress_files(
    app_handle: AppHandle,
    file_paths: Vec<String>,
    output_path: String,
    options: CompressionOptions,
) -> Result<String, String> {
    let output = Path::new(&output_path);
    let op_id = generate_operation_id();
    let out_name = output.file_name().unwrap_or_default().to_string_lossy().to_string();

    // Validate input paths and calculate total size
    let mut total_size: u64 = 0;
    for path in &file_paths {
        let p = Path::new(path);
        if !p.exists() {
            return Err(format!("File or directory does not exist: {}", path));
        }
        if p.is_file() {
            total_size += p.metadata().map(|m| m.len()).unwrap_or(0);
        } else if p.is_dir() {
            // Approximate directory size using walkdir
            for entry in walkdir::WalkDir::new(p).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    total_size += entry.metadata().map(|m| m.len()).unwrap_or(0);
                }
            }
        }
    }

    // Warn if total size exceeds 4GB
    const MAX_SAFE_SIZE: u64 = 4 * 1024 * 1024 * 1024; // 4 GB
    if total_size > MAX_SAFE_SIZE {
        return Err(format!(
            "Total size ({:.2} GB) exceeds the safe compression limit of 4 GB. Consider splitting into smaller archives.",
            total_size as f64 / (1024.0 * 1024.0 * 1024.0)
        ));
    }

    // Create output directory if it doesn't exist
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    // Emit starting progress
    let _ = app_handle.emit("file-operation-progress", FileOperationProgress {
        operation_id: op_id.clone(),
        operation_type: "compress".to_string(),
        source_path: file_paths.first().cloned().unwrap_or_default(),
        destination_path: Some(output_path.clone()),
        current_file: out_name.clone(),
        bytes_processed: 0,
        total_bytes: 0,
        files_processed: 0,
        total_files: file_paths.len() as u64,
        progress_percentage: 0.0,
        speed_bytes_per_second: 0.0,
        estimated_remaining_seconds: None,
        status: OperationStatus::InProgress,
        error_message: None,
        copy_strategy: None,
        hardware_acceleration: false,
    });

    let result = match options.format {
        CompressionFormat::Zip => compress_to_zip(&file_paths, output, &options).await,
        CompressionFormat::Tar => compress_to_tar(&file_paths, output, &options).await,
        CompressionFormat::TarGz => compress_to_tar_gz(&file_paths, output, &options).await,
        CompressionFormat::TarBz2 => compress_to_tar_bz2(&file_paths, output, &options).await,
        CompressionFormat::TarXz => compress_to_tar_xz(&file_paths, output, &options).await,
        CompressionFormat::SevenZ => compress_to_7z(&file_paths, output, &options).await,
        CompressionFormat::Rar => Err("RAR creation is not supported (proprietary format)".to_string()),
    };

    // Emit completion/failure
    let status = if result.is_ok() { OperationStatus::Completed } else { OperationStatus::Failed };
    let _ = app_handle.emit("file-operation-progress", FileOperationProgress {
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
    });

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
            total_size += path.metadata()
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
    let arc_path = Path::new(&archive_path);
    let op_id = generate_operation_id();
    let arc_name = arc_path.file_name().unwrap_or_default().to_string_lossy().to_string();

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
    let _ = app_handle.emit("file-operation-progress", FileOperationProgress {
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
    });

    let result = match format {
        CompressionFormat::Zip => extract_zip(arc_path, &options).await,
        CompressionFormat::Tar => extract_tar(arc_path, &options).await,
        CompressionFormat::TarGz => extract_tar_gz(arc_path, &options).await,
        CompressionFormat::TarBz2 => extract_tar_bz2(arc_path, &options).await,
        CompressionFormat::TarXz => extract_tar_xz(arc_path, &options).await,
        CompressionFormat::SevenZ => extract_7z(arc_path, &options).await,
        CompressionFormat::Rar => extract_rar(arc_path, &options).await,
    };

    let status = if result.is_ok() { OperationStatus::Completed } else { OperationStatus::Failed };
    let _ = app_handle.emit("file-operation-progress", FileOperationProgress {
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
    });

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
    
    let format = detect_archive_format(&archive_path)?;
    
    match format {
        CompressionFormat::Zip => get_zip_info(archive_path).await,
        CompressionFormat::Tar => get_tar_info(archive_path).await,
        CompressionFormat::TarGz => get_tar_gz_info(archive_path).await,
        CompressionFormat::TarBz2 => get_tar_bz2_info(archive_path).await,
        CompressionFormat::TarXz => get_tar_xz_info(archive_path).await,
        CompressionFormat::SevenZ => get_7z_info(archive_path).await,
        CompressionFormat::Rar => get_rar_info(archive_path).await,
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
    let arc_path = Path::new(&archive_path);
    let op_id = generate_operation_id();
    let arc_name = arc_path.file_name().unwrap_or_default().to_string_lossy().to_string();

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

    let _ = app_handle.emit("file-operation-progress", FileOperationProgress {
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
    });

    let result = match format {
        CompressionFormat::Zip => extract_zip_selected(arc_path, &entries, &output_dir, overwrite, &app_handle, &op_id).await,
        CompressionFormat::Tar => extract_tar_selected(arc_path, &entries, &output_dir, overwrite, &app_handle, &op_id).await,
        CompressionFormat::TarGz => extract_tar_gz_selected(arc_path, &entries, &output_dir, overwrite, &app_handle, &op_id).await,
        CompressionFormat::TarBz2 => extract_tar_bz2_selected(arc_path, &entries, &output_dir, overwrite, &app_handle, &op_id).await,
        CompressionFormat::TarXz => extract_tar_xz_selected(arc_path, &entries, &output_dir, overwrite, &app_handle, &op_id).await,
        CompressionFormat::SevenZ => extract_7z_selected(arc_path, &entries, &output_dir, overwrite, &app_handle, &op_id).await,
        CompressionFormat::Rar => extract_rar_selected(arc_path, &entries, &output_dir, overwrite, &app_handle, &op_id).await,
    };

    let status = if result.is_ok() { OperationStatus::Completed } else { OperationStatus::Failed };
    let _ = app_handle.emit("file-operation-progress", FileOperationProgress {
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
    });

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

// Archive format detection
fn detect_archive_format(path: &Path) -> Result<CompressionFormat, String> {
    let extension = path.extension()
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

// ZIP extraction implementation
async fn extract_zip(archive_path: &Path, options: &ExtractionOptions) -> Result<String, String> {
    use zip::ZipArchive;
    use std::io::BufReader;
    
    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open ZIP file: {}", e))?;
    
    let reader = BufReader::new(file);
    let mut archive = ZipArchive::new(reader)
        .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;
        
        // Zip Slip protection: reject any entry containing path traversal components
        let raw_name = file.name();

        // Reject entries with any form of parent directory reference
        if raw_name.contains("..") {
            continue; // Skip — path traversal attempt
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
                continue; // Skip this entry — path traversal attempt
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

// TAR extraction implementations
async fn extract_tar(archive_path: &Path, options: &ExtractionOptions) -> Result<String, String> {
    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open TAR file: {}", e))?;

    let mut archive = tar::Archive::new(file);

    extract_tar_safely(&mut archive, options)?;

    Ok(options.output_directory.clone())
}

async fn extract_tar_gz(archive_path: &Path, options: &ExtractionOptions) -> Result<String, String> {
    use flate2::read::GzDecoder;

    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open TAR.GZ file: {}", e))?;

    let gz_decoder = GzDecoder::new(file);
    let mut archive = tar::Archive::new(gz_decoder);

    extract_tar_safely(&mut archive, options)?;

    Ok(options.output_directory.clone())
}

async fn extract_tar_bz2(archive_path: &Path, options: &ExtractionOptions) -> Result<String, String> {
    use bzip2::read::BzDecoder;

    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open TAR.BZ2 file: {}", e))?;

    let bz_decoder = BzDecoder::new(file);
    let mut archive = tar::Archive::new(bz_decoder);

    extract_tar_safely(&mut archive, options)?;

    Ok(options.output_directory.clone())
}

async fn extract_tar_xz(archive_path: &Path, options: &ExtractionOptions) -> Result<String, String> {
    use xz2::read::XzDecoder;

    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open TAR.XZ file: {}", e))?;

    let xz_decoder = XzDecoder::new(file);
    let mut archive = tar::Archive::new(xz_decoder);

    extract_tar_safely(&mut archive, options)?;

    Ok(options.output_directory.clone())
}

/// Safely extract TAR entries, skipping path traversal attempts and symlinks/hardlinks.
fn extract_tar_safely<R: Read>(archive: &mut tar::Archive<R>, options: &ExtractionOptions) -> Result<(), String> {
    for entry in archive.entries().map_err(|e| format!("Failed to read TAR entries: {}", e))? {
        let mut entry = entry.map_err(|e| format!("Failed to read TAR entry: {}", e))?;
        let path = entry.path().map_err(|e| format!("Failed to get entry path: {}", e))?;

        // Skip absolute paths and path traversal
        if path.is_absolute() || path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
            continue;
        }

        // Skip symlinks and hardlinks
        let entry_type = entry.header().entry_type();
        if entry_type.is_symlink() || entry_type.is_hard_link() {
            continue;
        }

        entry.unpack_in(&options.output_directory)
            .map_err(|e| format!("Failed to extract entry: {}", e))?;
    }
    Ok(())
}

// Selective extraction implementations

async fn extract_zip_selected(
    archive_path: &Path,
    entries: &[String],
    output_dir: &str,
    overwrite: bool,
    app_handle: &AppHandle,
    op_id: &str,
) -> Result<String, String> {
    use zip::ZipArchive;
    use std::io::BufReader;
    use std::collections::HashSet;

    let selected: HashSet<&str> = entries.iter().map(|s| s.as_str()).collect();

    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open ZIP file: {}", e))?;
    let reader = BufReader::new(file);
    let mut archive = ZipArchive::new(reader)
        .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    let total = entries.len() as u64;
    let mut processed: u64 = 0;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
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

        let outpath = Path::new(output_dir).join(&safe_name);

        let canonical_output = std::fs::canonicalize(output_dir)
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
        let pct = if total > 0 { (processed as f64 / total as f64) * 100.0 } else { 100.0 };
        let _ = app_handle.emit("file-operation-progress", FileOperationProgress {
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
        });
    }

    Ok(output_dir.to_string())
}

async fn extract_tar_selected(
    archive_path: &Path,
    entries: &[String],
    output_dir: &str,
    overwrite: bool,
    app_handle: &AppHandle,
    op_id: &str,
) -> Result<String, String> {
    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open TAR file: {}", e))?;
    let mut archive = tar::Archive::new(file);
    extract_tar_selected_safely(&mut archive, entries, output_dir, overwrite, app_handle, op_id, archive_path)?;
    Ok(output_dir.to_string())
}

async fn extract_tar_gz_selected(
    archive_path: &Path,
    entries: &[String],
    output_dir: &str,
    overwrite: bool,
    app_handle: &AppHandle,
    op_id: &str,
) -> Result<String, String> {
    use flate2::read::GzDecoder;
    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open TAR.GZ file: {}", e))?;
    let gz_decoder = GzDecoder::new(file);
    let mut archive = tar::Archive::new(gz_decoder);
    extract_tar_selected_safely(&mut archive, entries, output_dir, overwrite, app_handle, op_id, archive_path)?;
    Ok(output_dir.to_string())
}

async fn extract_tar_bz2_selected(
    archive_path: &Path,
    entries: &[String],
    output_dir: &str,
    overwrite: bool,
    app_handle: &AppHandle,
    op_id: &str,
) -> Result<String, String> {
    use bzip2::read::BzDecoder;
    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open TAR.BZ2 file: {}", e))?;
    let bz_decoder = BzDecoder::new(file);
    let mut archive = tar::Archive::new(bz_decoder);
    extract_tar_selected_safely(&mut archive, entries, output_dir, overwrite, app_handle, op_id, archive_path)?;
    Ok(output_dir.to_string())
}

async fn extract_tar_xz_selected(
    archive_path: &Path,
    entries: &[String],
    output_dir: &str,
    overwrite: bool,
    app_handle: &AppHandle,
    op_id: &str,
) -> Result<String, String> {
    use xz2::read::XzDecoder;
    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open TAR.XZ file: {}", e))?;
    let xz_decoder = XzDecoder::new(file);
    let mut archive = tar::Archive::new(xz_decoder);
    extract_tar_selected_safely(&mut archive, entries, output_dir, overwrite, app_handle, op_id, archive_path)?;
    Ok(output_dir.to_string())
}

fn extract_tar_selected_safely<R: Read>(
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

    for entry_result in archive.entries().map_err(|e| format!("Failed to read TAR entries: {}", e))? {
        let mut entry = entry_result.map_err(|e| format!("Failed to read TAR entry: {}", e))?;
        let path = entry.path().map_err(|e| format!("Failed to get entry path: {}", e))?;
        let path_str = path.to_string_lossy().to_string();

        if !selected.contains(path_str.as_str()) {
            continue;
        }

        if path.is_absolute() || path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
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

        entry.unpack_in(output_dir)
            .map_err(|e| format!("Failed to extract entry: {}", e))?;

        processed += 1;
        let pct = if total > 0 { (processed as f64 / total as f64) * 100.0 } else { 100.0 };
        let _ = app_handle.emit("file-operation-progress", FileOperationProgress {
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
        });
    }

    Ok(())
}

// Archive info implementations
async fn get_zip_info(archive_path: &Path) -> Result<ArchiveInfo, String> {
    use zip::ZipArchive;
    use std::io::BufReader;
    
    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open ZIP file: {}", e))?;
    
    let reader = BufReader::new(file);
    let mut archive = ZipArchive::new(reader)
        .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;
    
    let mut total_files = 0u64;
    let mut total_directories = 0u64;
    let mut total_size = 0u64;
    let compressed_size = archive_path.metadata()
        .map(|m| m.len())
        .unwrap_or(0);
    let mut files = Vec::new();
    let mut is_encrypted = false;

    let archive_modified = archive_path.metadata()
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let archive_created = archive_path.metadata()
        .and_then(|m| m.created())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    for i in 0..archive.len() {
        // Use by_index_raw to avoid decryption failures on encrypted archives
        let file = archive.by_index_raw(i)
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
                .and_then(|date| date.and_hms_opt(dt.hour() as u32, dt.minute() as u32, dt.second() as u32))
                .and_then(|ndt| ndt.and_utc().timestamp().try_into().ok())
                .unwrap_or(0u64)
        };

        // Detect encryption from the compression method (encrypted entries use AES or standard encryption)
        if file.compression() == zip::CompressionMethod::AES {
            is_encrypted = true;
        }

        let entry_name = file.name().split('/').filter(|s| !s.is_empty()).last().unwrap_or("").to_string();
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

async fn get_tar_info(archive_path: &Path) -> Result<ArchiveInfo, String> {
    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open TAR file: {}", e))?;
    
    get_tar_info_from_reader(file, CompressionFormat::Tar, archive_path)
}

async fn get_tar_gz_info(archive_path: &Path) -> Result<ArchiveInfo, String> {
    use flate2::read::GzDecoder;
    
    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open TAR.GZ file: {}", e))?;
    
    let gz_decoder = GzDecoder::new(file);
    get_tar_info_from_reader(gz_decoder, CompressionFormat::TarGz, archive_path)
}

async fn get_tar_bz2_info(archive_path: &Path) -> Result<ArchiveInfo, String> {
    use bzip2::read::BzDecoder;
    
    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open TAR.BZ2 file: {}", e))?;
    
    let bz_decoder = BzDecoder::new(file);
    get_tar_info_from_reader(bz_decoder, CompressionFormat::TarBz2, archive_path)
}

async fn get_tar_xz_info(archive_path: &Path) -> Result<ArchiveInfo, String> {
    use xz2::read::XzDecoder;
    
    let file = File::open(archive_path)
        .map_err(|e| format!("Failed to open TAR.XZ file: {}", e))?;
    
    let xz_decoder = XzDecoder::new(file);
    get_tar_info_from_reader(xz_decoder, CompressionFormat::TarXz, archive_path)
}

fn get_tar_info_from_reader<R: Read>(
    reader: R, 
    format: CompressionFormat, 
    archive_path: &Path
) -> Result<ArchiveInfo, String> {
    let mut archive = tar::Archive::new(reader);

    let mut total_files = 0u64;
    let mut total_directories = 0u64;
    let mut total_size = 0u64;
    let compressed_size = archive_path.metadata()
        .map(|m| m.len())
        .unwrap_or(0);
    let mut files = Vec::new();

    let archive_modified = archive_path.metadata()
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let archive_created = archive_path.metadata()
        .and_then(|m| m.created())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    for entry_result in archive.entries()
        .map_err(|e| format!("Failed to read TAR entries: {}", e))?
    {
        let entry = entry_result
            .map_err(|e| format!("Failed to read TAR entry: {}", e))?;

        let header = entry.header();
        let path = entry.path()
            .map_err(|e| format!("Failed to get entry path: {}", e))?
            .to_string_lossy()
            .to_string();

        let is_directory = header.entry_type().is_dir();
        let size = header.size().unwrap_or(0);

        if is_directory {
            total_directories += 1;
        } else {
            total_files += 1;
            total_size += size;
        }

        let entry_name = path.split('/').filter(|s| !s.is_empty()).last().unwrap_or("").to_string();
        files.push(ArchiveEntry {
            name: entry_name,
            path,
            size,
            compressed_size: size, // TAR doesn't compress individual entries
            is_directory,
            modified: header.mtime().unwrap_or(0),
        });
    }

    Ok(ArchiveInfo {
        format,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionInfo {
    pub total_files: u64,
    pub total_directories: u64,
    pub total_size: u64,
    pub estimated_compressed_size: u64,
}

// ZIP compression implementation
async fn compress_to_zip(
    file_paths: &[String],
    output_path: &Path,
    options: &CompressionOptions,
) -> Result<String, String> {
    use zip::write::{FileOptions, ZipWriter};
    use zip::CompressionMethod;
    
    let file = File::create(output_path)
        .map_err(|e| format!("Failed to create ZIP file: {}", e))?;
    
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
        file_path.strip_prefix(base)
            .unwrap_or(file_path)
    } else {
        file_path.file_name()
            .map(|name| Path::new(name))
            .unwrap_or(file_path)
    };
    
    // Skip hidden files if not requested
    if !compression_options.include_hidden && is_hidden_file(file_path) {
        return Ok(());
    }
    
    let mut file = File::open(file_path)
        .map_err(|e| format!("Failed to open file {}: {}", file_path.display(), e))?;
    
    zip.start_file(relative_path.to_string_lossy(), *options)
        .map_err(|e| format!("Failed to start ZIP entry: {}", e))?;
    
    io::copy(&mut file, zip)
        .map_err(|e| format!("Failed to write file to ZIP: {}", e))?;
    
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
        let entry = entry
            .map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.is_file() {
            add_file_to_zip(zip, &path, Some(base), options, compression_options)?;
        } else if path.is_dir() {
            add_directory_to_zip(zip, &path, Some(base), options, compression_options)?;
        }
    }
    
    Ok(())
}

// TAR compression implementations
async fn compress_to_tar(
    file_paths: &[String],
    output_path: &Path,
    _options: &CompressionOptions,
) -> Result<String, String> {
    let file = File::create(output_path)
        .map_err(|e| format!("Failed to create TAR file: {}", e))?;
    
    let mut builder = tar::Builder::new(file);
    
    for file_path in file_paths {
        let path = Path::new(file_path);
        if path.is_file() {
            let name = path.file_name()
                .unwrap_or_else(|| std::ffi::OsStr::new("unknown"));
            builder.append_path_with_name(path, name)
                .map_err(|e| format!("Failed to add file to TAR: {}", e))?;
        } else if path.is_dir() {
            builder.append_dir_all(".", path)
                .map_err(|e| format!("Failed to add directory to TAR: {}", e))?;
        }
    }
    
    builder.finish()
        .map_err(|e| format!("Failed to finalize TAR file: {}", e))?;
    
    Ok(output_path.to_string_lossy().to_string())
}

async fn compress_to_tar_gz(
    file_paths: &[String],
    output_path: &Path,
    options: &CompressionOptions,
) -> Result<String, String> {
    use flate2::write::GzEncoder;
    use flate2::Compression;
    
    let file = File::create(output_path)
        .map_err(|e| format!("Failed to create TAR.GZ file: {}", e))?;
    
    let compression_level = options.compression_level
        .map(|l| Compression::new(l.clamp(0, 9)))
        .unwrap_or(Compression::default());
    
    let gz_encoder = GzEncoder::new(file, compression_level);
    let mut builder = tar::Builder::new(gz_encoder);
    
    for file_path in file_paths {
        let path = Path::new(file_path);
        if path.is_file() {
            let name = path.file_name()
                .unwrap_or_else(|| std::ffi::OsStr::new("unknown"));
            builder.append_path_with_name(path, name)
                .map_err(|e| format!("Failed to add file to TAR.GZ: {}", e))?;
        } else if path.is_dir() {
            builder.append_dir_all(".", path)
                .map_err(|e| format!("Failed to add directory to TAR.GZ: {}", e))?;
        }
    }
    
    let gz_encoder = builder.into_inner()
        .map_err(|e| format!("Failed to get GZ encoder: {}", e))?;
    
    gz_encoder.finish()
        .map_err(|e| format!("Failed to finalize TAR.GZ file: {}", e))?;
    
    Ok(output_path.to_string_lossy().to_string())
}

async fn compress_to_tar_bz2(
    file_paths: &[String],
    output_path: &Path,
    options: &CompressionOptions,
) -> Result<String, String> {
    use bzip2::write::BzEncoder;
    use bzip2::Compression;
    
    let file = File::create(output_path)
        .map_err(|e| format!("Failed to create TAR.BZ2 file: {}", e))?;
    
    let compression_level = options.compression_level
        .map(|l| Compression::new(l.clamp(1, 9)))
        .unwrap_or(Compression::default());
    
    let bz_encoder = BzEncoder::new(file, compression_level);
    let mut builder = tar::Builder::new(bz_encoder);
    
    for file_path in file_paths {
        let path = Path::new(file_path);
        if path.is_file() {
            let name = path.file_name()
                .unwrap_or_else(|| std::ffi::OsStr::new("unknown"));
            builder.append_path_with_name(path, name)
                .map_err(|e| format!("Failed to add file to TAR.BZ2: {}", e))?;
        } else if path.is_dir() {
            builder.append_dir_all(".", path)
                .map_err(|e| format!("Failed to add directory to TAR.BZ2: {}", e))?;
        }
    }
    
    let bz_encoder = builder.into_inner()
        .map_err(|e| format!("Failed to get BZ2 encoder: {}", e))?;
    
    bz_encoder.finish()
        .map_err(|e| format!("Failed to finalize TAR.BZ2 file: {}", e))?;
    
    Ok(output_path.to_string_lossy().to_string())
}

async fn compress_to_tar_xz(
    file_paths: &[String],
    output_path: &Path,
    options: &CompressionOptions,
) -> Result<String, String> {
    use xz2::write::XzEncoder;
    
    let file = File::create(output_path)
        .map_err(|e| format!("Failed to create TAR.XZ file: {}", e))?;
    
    let compression_level = options.compression_level.unwrap_or(6);
    let xz_encoder = XzEncoder::new(file, compression_level);
    let mut builder = tar::Builder::new(xz_encoder);
    
    for file_path in file_paths {
        let path = Path::new(file_path);
        if path.is_file() {
            let name = path.file_name()
                .unwrap_or_else(|| std::ffi::OsStr::new("unknown"));
            builder.append_path_with_name(path, name)
                .map_err(|e| format!("Failed to add file to TAR.XZ: {}", e))?;
        } else if path.is_dir() {
            builder.append_dir_all(".", path)
                .map_err(|e| format!("Failed to add directory to TAR.XZ: {}", e))?;
        }
    }
    
    let xz_encoder = builder.into_inner()
        .map_err(|e| format!("Failed to get XZ encoder: {}", e))?;
    
    xz_encoder.finish()
        .map_err(|e| format!("Failed to finalize TAR.XZ file: {}", e))?;
    
    Ok(output_path.to_string_lossy().to_string())
}

// 7z extraction implementation
async fn extract_7z(archive_path: &Path, options: &ExtractionOptions) -> Result<String, String> {
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

// 7z compression implementation
async fn compress_to_7z(
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

// 7z archive info implementation
async fn get_7z_info(archive_path: &Path) -> Result<ArchiveInfo, String> {
    let src = archive_path.to_path_buf();
    let compressed_size = archive_path.metadata()
        .map(|m| m.len())
        .unwrap_or(0);

    let archive_modified = archive_path.metadata()
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let archive_created = archive_path.metadata()
        .and_then(|m| m.created())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let (files, total_files, total_directories, total_size) = tokio::task::spawn_blocking(move || {
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
                sys_time.duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0)
            };

            let entry_name = name_str.split('/')
                .filter(|s| !s.is_empty())
                .last()
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

// 7z selective extraction implementation
async fn extract_7z_selected(
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
        let file = File::open(&src)
            .map_err(|e| format!("Failed to open 7z file: {}", e))?;

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
            let pct = if total > 0 { (processed as f64 / total as f64) * 100.0 } else { 100.0 };
            let _ = app.emit("file-operation-progress", FileOperationProgress {
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
            });

            Ok(true)
        }).map_err(|e| format!("Failed to extract 7z entries: {}", e))?;

        Ok::<_, String>(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(output_dir.to_string())
}

// RAR extraction implementation (read-only, no creation)
async fn extract_rar(archive_path: &Path, options: &ExtractionOptions) -> Result<String, String> {
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
                        cursor = Some(header.skip().map_err(|e| format!("Failed to skip RAR entry: {}", e))?);
                        continue;
                    }

                    let out_path = dest.join(&entry_path);

                    if out_path.exists() && !overwrite {
                        cursor = Some(header.skip().map_err(|e| format!("Failed to skip RAR entry: {}", e))?);
                        continue;
                    }

                    cursor = Some(header.extract_to(&dest)
                        .map_err(|e| format!("Failed to extract RAR entry '{}': {}", entry_path, e))?);
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

// RAR archive info implementation
async fn get_rar_info(archive_path: &Path) -> Result<ArchiveInfo, String> {
    let src = archive_path.to_path_buf();
    let compressed_size = archive_path.metadata()
        .map(|m| m.len())
        .unwrap_or(0);

    let archive_modified = archive_path.metadata()
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let archive_created = archive_path.metadata()
        .and_then(|m| m.created())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let (files, total_files, total_directories, total_size, is_encrypted) = tokio::task::spawn_blocking(move || {
        let archive = unrar::Archive::new(&src)
            .open_for_listing()
            .map_err(|e| format!("Failed to open RAR archive for listing: {}", e))?;

        let mut total_files = 0u64;
        let mut total_directories = 0u64;
        let mut total_size = 0u64;
        let mut files = Vec::new();
        let mut is_encrypted = false;

        for entry_result in archive {
            let entry = entry_result.map_err(|e| format!("Failed to read RAR entry: {}", e))?;

            let is_dir = entry.is_directory();
            let size = entry.unpacked_size as u64;
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

            let entry_name = full_path.split('/')
                .chain(full_path.split('\\'))
                .filter(|s| !s.is_empty())
                .last()
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

        Ok::<_, String>((files, total_files, total_directories, total_size, is_encrypted))
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

// RAR selective extraction implementation
async fn extract_rar_selected(
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
                        cursor = Some(header.skip().map_err(|e| format!("Failed to skip RAR entry: {}", e))?);
                        continue;
                    }

                    let out_path = dest.join(&entry_path);

                    if out_path.exists() && !overwrite {
                        cursor = Some(header.skip().map_err(|e| format!("Failed to skip RAR entry: {}", e))?);
                        continue;
                    }

                    cursor = Some(header.extract_to(&dest)
                        .map_err(|e| format!("Failed to extract RAR entry '{}': {}", entry_path, e))?);

                    processed += 1;
                    let pct = if total > 0 { (processed as f64 / total as f64) * 100.0 } else { 100.0 };
                    let _ = app.emit("file-operation-progress", FileOperationProgress {
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
                    });
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

// Helper functions
fn count_directory_contents(dir: &Path) -> Result<(u64, u64, u64), String> {
    let mut files = 0u64;
    let mut dirs = 0u64;
    let mut total_size = 0u64;
    
    fn count_recursive(dir: &Path, files: &mut u64, dirs: &mut u64, size: &mut u64) -> Result<(), String> {
        for entry in fs::read_dir(dir)
            .map_err(|e| format!("Failed to read directory: {}", e))? 
        {
            let entry = entry
                .map_err(|e| format!("Failed to read entry: {}", e))?;
            let path = entry.path();
            
            if path.is_file() {
                *files += 1;
                *size += entry.metadata()
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

fn estimate_compressed_size(original_size: u64) -> u64 {
    // Very rough estimation - typically 30-70% compression ratio
    // This varies greatly by file type and content
    (original_size as f64 * 0.5) as u64
}

use super::is_hidden_file;

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::fs::{self, File};
    use std::io::Write;

    // Helper to create a ZIP archive from a set of files for testing
    fn create_test_zip(zip_path: &Path, files: &[(&str, &[u8])]) {
        use zip::write::{FileOptions, ZipWriter};
        use zip::CompressionMethod;

        let file = File::create(zip_path).expect("Failed to create ZIP file");
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::default()
            .compression_method(CompressionMethod::Deflated);

        for (name, content) in files {
            zip.start_file(*name, options).expect("Failed to start ZIP entry");
            zip.write_all(content).expect("Failed to write ZIP content");
        }
        zip.finish().expect("Failed to finalize ZIP");
    }

    #[tokio::test]
    async fn test_compress_and_extract_zip() {
        let temp = tempdir().expect("Failed to create temp dir");

        // Create source files
        let file1_path = temp.path().join("hello.txt");
        let file2_path = temp.path().join("world.txt");
        fs::write(&file1_path, "Hello!").unwrap();
        fs::write(&file2_path, "World!").unwrap();

        let zip_path = temp.path().join("archive.zip");
        let extract_dir = temp.path().join("extracted");
        fs::create_dir(&extract_dir).unwrap();

        // Compress
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
        ).await;

        assert!(compress_result.is_ok(), "compress should succeed: {:?}", compress_result.err());
        assert!(zip_path.exists(), "ZIP file should exist");
        assert!(zip_path.metadata().unwrap().len() > 0, "ZIP should not be empty");

        // Extract
        let extract_options = ExtractionOptions {
            output_directory: extract_dir.to_string_lossy().to_string(),
            password: None,
            overwrite_existing: true,
            preserve_permissions: true,
            include_hidden: false,
        };
        let extract_result = extract_zip(&zip_path, &extract_options).await;

        assert!(extract_result.is_ok(), "extract should succeed: {:?}", extract_result.err());

        // Verify extracted files
        assert!(extract_dir.join("hello.txt").exists(), "hello.txt should be extracted");
        assert!(extract_dir.join("world.txt").exists(), "world.txt should be extracted");
        assert_eq!(fs::read_to_string(extract_dir.join("hello.txt")).unwrap(), "Hello!");
        assert_eq!(fs::read_to_string(extract_dir.join("world.txt")).unwrap(), "World!");
    }

    #[tokio::test]
    async fn test_get_archive_info_zip() {
        let temp = tempdir().expect("Failed to create temp dir");
        let zip_path = temp.path().join("test_info.zip");

        // Create a test ZIP with known content
        create_test_zip(&zip_path, &[
            ("file1.txt", b"content1"),
            ("file2.txt", b"content2"),
            ("subdir/file3.txt", b"content3"),
        ]);

        let result = get_archive_info(zip_path.to_string_lossy().to_string()).await;

        assert!(result.is_ok(), "get_archive_info should succeed: {:?}", result.err());
        let info = result.unwrap();

        assert_eq!(info.total_files, 3, "should have 3 files");
        assert!(info.total_size > 0, "total size should be > 0");
        assert!(!info.is_encrypted, "should not be encrypted");
        assert_eq!(info.files.len(), 3, "files vec should have 3 entries");
    }

    #[tokio::test]
    async fn test_get_archive_info_nonexistent_fails() {
        let result = get_archive_info("/nonexistent/path/to/archive.zip".to_string()).await;
        assert!(result.is_err(), "should fail for nonexistent archive");
        assert!(result.unwrap_err().contains("does not exist"));
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

        let result = extract_zip(
            Path::new("/nonexistent/archive.zip"),
            &extract_options,
        ).await;

        assert!(result.is_err(), "extracting nonexistent archive should fail");
    }

    #[test]
    fn test_detect_archive_format_zip() {
        let result = detect_archive_format(Path::new("test.zip"));
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), CompressionFormat::Zip));
    }

    #[test]
    fn test_detect_archive_format_tar_gz() {
        let result = detect_archive_format(Path::new("test.tar.gz"));
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), CompressionFormat::TarGz));
    }

    #[test]
    fn test_detect_archive_format_tar_bz2() {
        let result = detect_archive_format(Path::new("test.tar.bz2"));
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), CompressionFormat::TarBz2));
    }

    #[test]
    fn test_detect_archive_format_tar_xz() {
        let result = detect_archive_format(Path::new("test.tar.xz"));
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), CompressionFormat::TarXz));
    }

    #[test]
    fn test_detect_archive_format_tar() {
        let result = detect_archive_format(Path::new("test.tar"));
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), CompressionFormat::Tar));
    }

    #[test]
    fn test_detect_archive_format_7z() {
        let result = detect_archive_format(Path::new("test.7z"));
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), CompressionFormat::SevenZ));
    }

    #[test]
    fn test_detect_archive_format_rar() {
        let result = detect_archive_format(Path::new("test.rar"));
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), CompressionFormat::Rar));
    }

    #[test]
    fn test_detect_archive_format_unknown_fails() {
        let result = detect_archive_format(Path::new("test.xyz"));
        assert!(result.is_err(), "unknown format should fail");
    }

    #[test]
    fn test_detect_archive_format_tgz_alias() {
        let result = detect_archive_format(Path::new("test.tgz"));
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), CompressionFormat::TarGz));
    }

    #[test]
    fn test_estimate_compressed_size() {
        let original = 1_000_000;
        let estimated = estimate_compressed_size(original);
        // The function uses 50% ratio
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
        assert!(!result.unwrap(), "txt file should not be recognized as archive");
    }

    #[tokio::test]
    async fn test_is_archive_nonexistent() {
        let result = is_archive("/nonexistent/file.zip".to_string()).await;
        assert!(result.is_ok());
        assert!(!result.unwrap(), "nonexistent file should return false");
    }

    #[tokio::test]
    async fn test_compress_and_extract_tar_gz() {
        let temp = tempdir().expect("Failed to create temp dir");

        let file_path = temp.path().join("data.txt");
        fs::write(&file_path, "tar gz test data").unwrap();

        let tar_gz_path = temp.path().join("archive.tar.gz");
        let extract_dir = temp.path().join("extracted");
        fs::create_dir(&extract_dir).unwrap();

        let options = CompressionOptions {
            format: CompressionFormat::TarGz,
            compression_level: Some(6),
            password: None,
            include_hidden: false,
            follow_symlinks: false,
        };
        let compress_result = compress_to_tar_gz(
            &[file_path.to_string_lossy().to_string()],
            &tar_gz_path,
            &options,
        ).await;

        assert!(compress_result.is_ok(), "tar.gz compress should succeed: {:?}", compress_result.err());
        assert!(tar_gz_path.exists(), "tar.gz file should exist");

        // Extract
        let extract_options = ExtractionOptions {
            output_directory: extract_dir.to_string_lossy().to_string(),
            password: None,
            overwrite_existing: true,
            preserve_permissions: true,
            include_hidden: false,
        };
        let extract_result = extract_tar_gz(&tar_gz_path, &extract_options).await;
        assert!(extract_result.is_ok(), "tar.gz extract should succeed: {:?}", extract_result.err());

        assert!(extract_dir.join("data.txt").exists(), "data.txt should be extracted");
        assert_eq!(fs::read_to_string(extract_dir.join("data.txt")).unwrap(), "tar gz test data");
    }

    #[tokio::test]
    async fn test_get_compression_info() {
        let temp = tempdir().expect("Failed to create temp dir");
        fs::write(temp.path().join("a.txt"), "hello").unwrap();
        fs::write(temp.path().join("b.txt"), "world").unwrap();

        let result = get_compression_info(vec![
            temp.path().join("a.txt").to_string_lossy().to_string(),
            temp.path().join("b.txt").to_string_lossy().to_string(),
        ]).await;

        assert!(result.is_ok(), "get_compression_info should succeed");
        let info = result.unwrap();
        assert_eq!(info.total_files, 2);
        assert!(info.total_size > 0);
        assert!(info.estimated_compressed_size > 0);
        assert!(info.estimated_compressed_size <= info.total_size);
    }

    #[tokio::test]
    async fn test_zip_slip_protection() {
        let temp = tempdir().expect("Failed to create temp dir");
        let extract_dir = temp.path().join("output");
        fs::create_dir(&extract_dir).unwrap();

        // Create a malicious ZIP with path traversal entry
        let zip_path = temp.path().join("malicious.zip");
        {
            use zip::write::{FileOptions, ZipWriter};
            use zip::CompressionMethod;

            let file = File::create(&zip_path).expect("Failed to create ZIP");
            let mut zip = ZipWriter::new(file);
            let options = FileOptions::default().compression_method(CompressionMethod::Stored);

            // Entry with ".." path traversal
            zip.start_file("../../etc/evil.txt", options).expect("Failed to start entry");
            zip.write_all(b"malicious").expect("Failed to write");
            // Normal entry
            zip.start_file("safe.txt", options).expect("Failed to start entry");
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
        assert!(result.is_ok(), "extract should succeed but skip malicious entries");

        // The safe file should be extracted
        assert!(extract_dir.join("safe.txt").exists(), "safe.txt should be extracted");

        // The malicious entry should NOT create a file outside the output directory
        assert!(!temp.path().join("etc").join("evil.txt").exists(),
            "path traversal entry should not be extracted outside output dir");
    }
}
