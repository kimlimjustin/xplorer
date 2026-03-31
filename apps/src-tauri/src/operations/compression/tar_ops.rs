use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

use tauri::AppHandle;

use super::{
    ArchiveEntry, ArchiveInfo, CompressionFormat, CompressionOptions, ExtractionOptions,
};
use super::safety::{extract_tar_safely, extract_tar_selected_safely};

// ─── Tar format variants ────────────────────────────────────────────────────

/// The four tar container formats, used to select the correct
/// encoder/decoder without duplicating logic.
#[derive(Debug, Clone, Copy)]
pub(crate) enum TarFormat {
    Plain,
    Gz,
    Bz2,
    Xz,
}

impl TarFormat {
    /// Return the matching `CompressionFormat` enum variant.
    pub(crate) fn compression_format(self) -> CompressionFormat {
        match self {
            TarFormat::Plain => CompressionFormat::Tar,
            TarFormat::Gz => CompressionFormat::TarGz,
            TarFormat::Bz2 => CompressionFormat::TarBz2,
            TarFormat::Xz => CompressionFormat::TarXz,
        }
    }

    fn label(self) -> &'static str {
        match self {
            TarFormat::Plain => "TAR",
            TarFormat::Gz => "TAR.GZ",
            TarFormat::Bz2 => "TAR.BZ2",
            TarFormat::Xz => "TAR.XZ",
        }
    }
}

// ─── Generic reader / writer constructors ───────────────────────────────────

fn open_tar_reader(path: &Path, format: TarFormat) -> Result<tar::Archive<Box<dyn Read>>, String> {
    let label = format.label();
    let file = File::open(path).map_err(|e| format!("Failed to open {} file: {}", label, e))?;

    let reader: Box<dyn Read> = match format {
        TarFormat::Plain => Box::new(file),
        TarFormat::Gz => {
            use flate2::read::GzDecoder;
            Box::new(GzDecoder::new(file))
        }
        TarFormat::Bz2 => {
            use bzip2::read::BzDecoder;
            Box::new(BzDecoder::new(file))
        }
        TarFormat::Xz => {
            use xz2::read::XzDecoder;
            Box::new(XzDecoder::new(file))
        }
    };

    Ok(tar::Archive::new(reader))
}

/// Create a tar builder wrapping the appropriate compressor.
///
/// Returns `(builder, finisher)` where `finisher` is a closure that must be
/// called after the builder is consumed via `into_inner()` to flush the
/// underlying compressor. For `Plain` the finisher is a no-op.
fn create_tar_writer(
    path: &Path,
    format: TarFormat,
    options: &CompressionOptions,
) -> Result<tar::Builder<Box<dyn Write>>, String> {
    let label = format.label();
    let file = File::create(path).map_err(|e| format!("Failed to create {} file: {}", label, e))?;

    let writer: Box<dyn Write> = match format {
        TarFormat::Plain => Box::new(file),
        TarFormat::Gz => {
            use flate2::write::GzEncoder;
            use flate2::Compression;
            let level = options
                .compression_level
                .map(|l| Compression::new(l.clamp(0, 9)))
                .unwrap_or_default();
            Box::new(GzEncoder::new(file, level))
        }
        TarFormat::Bz2 => {
            use bzip2::write::BzEncoder;
            use bzip2::Compression;
            let level = options
                .compression_level
                .map(|l| Compression::new(l.clamp(1, 9)))
                .unwrap_or_default();
            Box::new(BzEncoder::new(file, level))
        }
        TarFormat::Xz => {
            use xz2::write::XzEncoder;
            let level = options.compression_level.unwrap_or(6);
            Box::new(XzEncoder::new(file, level))
        }
    };

    Ok(tar::Builder::new(writer))
}

// ─── Generic extraction ─────────────────────────────────────────────────────

pub(crate) async fn extract_tar_generic(
    archive_path: &Path,
    options: &ExtractionOptions,
    format: TarFormat,
) -> Result<String, String> {
    let archive_path = archive_path.to_path_buf();
    let options = options.clone();
    tokio::task::spawn_blocking(move || {
        let mut archive = open_tar_reader(&archive_path, format)?;
        extract_tar_safely(&mut archive, &options.output_directory)?;
        Ok(options.output_directory.clone())
    })
    .await
    .map_err(|e| e.to_string())?
}

pub(crate) async fn extract_tar_selected_generic(
    archive_path: &Path,
    entries: &[String],
    output_dir: &str,
    overwrite: bool,
    app_handle: &AppHandle,
    op_id: &str,
    format: TarFormat,
) -> Result<String, String> {
    let archive_path = archive_path.to_path_buf();
    let entries = entries.to_vec();
    let output_dir = output_dir.to_string();
    let app_handle = app_handle.clone();
    let op_id = op_id.to_string();
    tokio::task::spawn_blocking(move || {
        let mut archive = open_tar_reader(&archive_path, format)?;
        extract_tar_selected_safely(
            &mut archive,
            &entries,
            &output_dir,
            overwrite,
            &app_handle,
            &op_id,
            &archive_path,
        )?;
        Ok(output_dir)
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Generic compression ────────────────────────────────────────────────────

pub(crate) async fn compress_to_tar_generic(
    file_paths: &[String],
    output_path: &Path,
    options: &CompressionOptions,
    format: TarFormat,
) -> Result<String, String> {
    let file_paths = file_paths.to_vec();
    let output_path = output_path.to_path_buf();
    let options = options.clone();
    tokio::task::spawn_blocking(move || {
        let label = format.label();
        let mut builder = create_tar_writer(&output_path, format, &options)?;

        for file_path in &file_paths {
            let path = Path::new(file_path);
            if path.is_file() {
                let name = path
                    .file_name()
                    .unwrap_or_else(|| std::ffi::OsStr::new("unknown"));
                builder
                    .append_path_with_name(path, name)
                    .map_err(|e| format!("Failed to add file to {}: {}", label, e))?;
            } else if path.is_dir() {
                builder
                    .append_dir_all(".", path)
                    .map_err(|e| format!("Failed to add directory to {}: {}", label, e))?;
            }
        }

        // Finish the tar layer, then flush the compression layer.
        let mut writer = builder
            .into_inner()
            .map_err(|e| format!("Failed to finalize {} archive: {}", label, e))?;

        // The underlying writer may be a GzEncoder/BzEncoder/XzEncoder wrapped
        // in Box<dyn Write>. We cannot call finish() through the trait object,
        // but flush() will push buffered data to the underlying stream. The
        // encoder's Drop impl then calls finish() on an already-flushed stream,
        // reducing the chance of silent data loss.
        writer
            .flush()
            .map_err(|e| format!("Failed to flush {} archive: {}", label, e))?;

        Ok(output_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Generic archive info ───────────────────────────────────────────────────

pub(crate) async fn get_tar_info_generic(
    archive_path: &Path,
    format: TarFormat,
) -> Result<ArchiveInfo, String> {
    let archive_path = archive_path.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let mut archive = open_tar_reader(&archive_path, format)?;
        get_tar_info_from_archive(&mut archive, format.compression_format(), &archive_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn get_tar_info_from_archive<R: Read>(
    archive: &mut tar::Archive<R>,
    format: CompressionFormat,
    archive_path: &Path,
) -> Result<ArchiveInfo, String> {
    let mut total_files = 0u64;
    let mut total_directories = 0u64;
    let mut total_size = 0u64;
    let compressed_size = archive_path.metadata().map(|m| m.len()).unwrap_or(0);
    let mut files = Vec::new();

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

    for entry_result in archive
        .entries()
        .map_err(|e| format!("Failed to read TAR entries: {}", e))?
    {
        let entry = entry_result.map_err(|e| format!("Failed to read TAR entry: {}", e))?;

        let header = entry.header();
        let path = entry
            .path()
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

        let entry_name = path
            .split('/')
            .rfind(|s| !s.is_empty())
            .unwrap_or("")
            .to_string();
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

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

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
        let compress_result = compress_to_tar_generic(
            &[file_path.to_string_lossy().to_string()],
            &tar_gz_path,
            &options,
            TarFormat::Gz,
        )
        .await;

        assert!(
            compress_result.is_ok(),
            "tar.gz compress should succeed: {:?}",
            compress_result.err()
        );
        assert!(tar_gz_path.exists(), "tar.gz file should exist");

        let extract_options = ExtractionOptions {
            output_directory: extract_dir.to_string_lossy().to_string(),
            password: None,
            overwrite_existing: true,
            preserve_permissions: true,
            include_hidden: false,
        };
        let extract_result =
            extract_tar_generic(&tar_gz_path, &extract_options, TarFormat::Gz).await;
        assert!(
            extract_result.is_ok(),
            "tar.gz extract should succeed: {:?}",
            extract_result.err()
        );

        assert!(
            extract_dir.join("data.txt").exists(),
            "data.txt should be extracted"
        );
        assert_eq!(
            fs::read_to_string(extract_dir.join("data.txt")).unwrap(),
            "tar gz test data"
        );
    }
}
