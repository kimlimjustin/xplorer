use crate::extensions::types::*;
use tauri::command;

/// Pack an extension directory into a .xtension file (ZIP archive).
/// Returns the output file path.
#[command]
pub async fn pack_extension(
    extension_dir: String,
    output_path: Option<String>,
) -> Result<String, String> {
    use std::io::Write;
    use std::path::Path;

    let ext_path = Path::new(&extension_dir);
    if !ext_path.is_dir() {
        return Err("Extension directory does not exist".to_string());
    }

    let manifest_path = ext_path.join("package.json");
    if !manifest_path.exists() {
        return Err("No package.json found in extension directory".to_string());
    }

    // Parse manifest to get the extension ID for the filename
    let manifest_content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;
    let manifest = crate::extensions::types::parse_manifest_from_package_json(&manifest_content)?;

    let out = match output_path {
        Some(p) => std::path::PathBuf::from(p),
        None => {
            let parent = ext_path.parent().unwrap_or(Path::new("."));
            parent.join(format!("{}-{}.xtension", manifest.id, manifest.version))
        }
    };

    let file =
        std::fs::File::create(&out).map_err(|e| format!("Failed to create output file: {}", e))?;
    let mut zip_writer = zip::ZipWriter::new(file);
    let options =
        zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    // Recursively add files from the extension directory
    fn add_dir_to_zip(
        zip_writer: &mut zip::ZipWriter<std::fs::File>,
        base: &Path,
        current: &Path,
        options: zip::write::FileOptions,
    ) -> Result<(), String> {
        for entry in std::fs::read_dir(current).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let relative = path.strip_prefix(base).map_err(|e| e.to_string())?;
            let name = relative.to_string_lossy().replace('\\', "/");

            // Skip node_modules, src (only need dist), .git
            if let Some(first) = relative.components().next() {
                let first_str = first.as_os_str().to_string_lossy();
                if first_str == "node_modules" || first_str == "src" || first_str == ".git" {
                    continue;
                }
            }

            if path.is_dir() {
                zip_writer
                    .add_directory(&name, options)
                    .map_err(|e| format!("Failed to add directory: {}", e))?;
                add_dir_to_zip(zip_writer, base, &path, options)?;
            } else {
                zip_writer
                    .start_file(&name, options)
                    .map_err(|e| format!("Failed to start file: {}", e))?;
                let content = std::fs::read(&path)
                    .map_err(|e| format!("Failed to read file {}: {}", path.display(), e))?;
                zip_writer
                    .write_all(&content)
                    .map_err(|e| format!("Failed to write to zip: {}", e))?;
            }
        }
        Ok(())
    }

    add_dir_to_zip(&mut zip_writer, ext_path, ext_path, options)?;
    zip_writer
        .finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(out.to_string_lossy().to_string())
}

/// Get info about a .xtension file without installing it.
/// Returns the manifest so the frontend can show a confirmation dialog.
#[command]
pub async fn inspect_xtension_file(xtension_path: String) -> Result<ExtensionManifest, String> {
    use std::io::Read;

    let file =
        std::fs::File::open(&xtension_path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Invalid .xtension file: {}", e))?;

    // Find and read package.json from the archive
    let mut manifest_content = String::new();
    {
        let mut manifest_file = archive
            .by_name("package.json")
            .map_err(|_| "No package.json found in .xtension file".to_string())?;
        manifest_file
            .read_to_string(&mut manifest_content)
            .map_err(|e| format!("Failed to read manifest: {}", e))?;
    }

    crate::extensions::types::parse_manifest_from_package_json(&manifest_content)
}
