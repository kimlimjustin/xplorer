use crate::extensions::types::*;
use serde::{Deserialize, Serialize};
use tauri::command;

use super::{
    get_extensions_tmp_dir, safe_extract_zip, validate_extension_id, validate_url_security,
    EXTENSION_MANAGER,
};

#[command]
pub async fn install_extension_from_path(
    extension_path: String,
) -> Result<ExtensionPackage, String> {
    let mut manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    if let Some(manager) = manager_guard.as_mut() {
        manager.install_extension(&extension_path)
    } else {
        Err("Extension manager not initialized".to_string())
    }
}

#[command]
pub async fn uninstall_extension_by_id(extension_id: String) -> Result<(), String> {
    validate_extension_id(&extension_id)?;
    let mut manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    if let Some(manager) = manager_guard.as_mut() {
        manager.uninstall_extension(&extension_id)
    } else {
        Err("Extension manager not initialized".to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledExtensionInfo {
    pub id: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub id: String,
    pub current_version: String,
    pub latest_version: String,
    pub download_url: String,
    pub checksum: String,
}

#[command]
pub async fn download_and_install_extension(
    download_url: String,
    extension_id: String,
    expected_checksum: Option<String>,
) -> Result<ExtensionPackage, String> {
    // Validate extension ID to prevent path traversal (HIGH-02)
    validate_extension_id(&extension_id)?;

    // Validate the download URL (must be HTTPS, must not target private IPs)
    validate_url_security(&download_url)?;

    // 1. Download the zip file with size limit to prevent DoS
    const MAX_DOWNLOAD_SIZE: u64 = 50 * 1024 * 1024; // 50 MB max

    let client = reqwest::Client::new();
    let resp = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Download failed with status: {}", resp.status()));
    }

    // SECURITY: Check Content-Length header for early rejection of oversized downloads
    if let Some(content_length) = resp.content_length() {
        if content_length > MAX_DOWNLOAD_SIZE {
            return Err(format!(
                "Extension download too large: {} bytes (max {} bytes)",
                content_length, MAX_DOWNLOAD_SIZE
            ));
        }
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // SECURITY: Verify actual size after download (Content-Length can be spoofed)
    if bytes.len() as u64 > MAX_DOWNLOAD_SIZE {
        return Err(format!(
            "Extension download too large: {} bytes (max {} bytes)",
            bytes.len(),
            MAX_DOWNLOAD_SIZE
        ));
    }

    // 2. Verify checksum if provided
    if let Some(ref expected) = expected_checksum {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let actual = format!("{:x}", hasher.finalize());
        if actual != *expected {
            return Err(format!(
                "Checksum mismatch: expected {}, got {}",
                expected, actual
            ));
        }
    }

    // 3. Lock manager and do filesystem operations
    let mut manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = manager_guard
        .as_mut()
        .ok_or("Extension manager not initialized")?;

    // Create temp dir inside the extensions directory
    // Note: use manager directly instead of get_extensions_tmp_dir() to avoid deadlock
    let temp_dir = manager.extensions_dir.join(".tmp");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    // Canonicalize the temp dir so we can verify containment
    let canonical_temp = std::fs::canonicalize(&temp_dir)
        .map_err(|e| format!("Failed to canonicalize temp dir: {}", e))?;

    let zip_path = canonical_temp.join(format!("{}.zip", extension_id));
    let extract_dir = canonical_temp.join(&extension_id);

    // Verify constructed paths are contained within the temp directory
    // (defense in depth — even after validate_extension_id, verify the result)
    if !zip_path.starts_with(&canonical_temp) {
        return Err("Path traversal detected: zip path escapes temp directory".to_string());
    }
    if !extract_dir.starts_with(&canonical_temp) {
        return Err("Path traversal detected: extract dir escapes temp directory".to_string());
    }

    std::fs::write(&zip_path, &bytes).map_err(|e| e.to_string())?;

    if extract_dir.exists() {
        std::fs::remove_dir_all(&extract_dir).map_err(|e| e.to_string())?;
    }

    // 4. Extract zip safely (Zip Slip protection)
    safe_extract_zip(&zip_path, &extract_dir)?;

    // 5. Install from extracted path
    let result = manager.install_extension(extract_dir.to_str().ok_or("Invalid path")?);

    // 6. Cleanup
    let _ = std::fs::remove_file(&zip_path);
    let _ = std::fs::remove_dir_all(&extract_dir);

    result
}

#[command]
pub async fn check_for_extension_updates(
    marketplace_url: String,
    installed_extensions: Vec<InstalledExtensionInfo>,
) -> Result<Vec<UpdateInfo>, String> {
    // Validate the marketplace URL (must be HTTPS, must not target private IPs)
    validate_url_security(&marketplace_url)?;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/extensions/check-updates", marketplace_url))
        .json(&installed_extensions)
        .send()
        .await
        .map_err(|e| format!("Failed to check updates: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Update check failed with status: {}",
            resp.status()
        ));
    }

    resp.json::<Vec<UpdateInfo>>()
        .await
        .map_err(|e| format!("Failed to parse update response: {}", e))
}

// ─── Marketplace Integration Commands ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionUpdate {
    pub id: String,
    pub latest_version: String,
    pub download_url: String,
    pub changelog: Option<String>,
}

/// Download an extension from a URL, verify its checksum and signature,
/// extract it, and install it. Returns the extension ID on success.
#[command]
pub async fn download_extension(
    url: String,
    expected_checksum: Option<String>,
) -> Result<String, String> {
    // Validate the download URL (must be HTTPS, must not target private IPs)
    validate_url_security(&url)?;

    // 1. Download the .xtension file with size limit
    const MAX_DOWNLOAD_SIZE: u64 = 50 * 1024 * 1024; // 50 MB

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Download failed with status: {}", resp.status()));
    }

    // Early reject if Content-Length exceeds limit
    if let Some(content_length) = resp.content_length() {
        if content_length > MAX_DOWNLOAD_SIZE {
            return Err(format!(
                "Extension download too large: {} bytes (max {} bytes)",
                content_length, MAX_DOWNLOAD_SIZE
            ));
        }
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Verify actual size after download (Content-Length can be spoofed)
    if bytes.len() as u64 > MAX_DOWNLOAD_SIZE {
        return Err(format!(
            "Extension download too large: {} bytes (max {} bytes)",
            bytes.len(),
            MAX_DOWNLOAD_SIZE
        ));
    }

    // 2. Verify SHA-256 checksum if provided
    if let Some(ref expected) = expected_checksum {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let actual = format!("{:x}", hasher.finalize());
        if actual != *expected {
            return Err(format!(
                "Checksum mismatch: expected {}, got {}",
                expected, actual
            ));
        }
    }

    // 3. Extract to a temp directory (it's a zip file)
    let mut manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = manager_guard
        .as_mut()
        .ok_or("Extension manager not initialized")?;

    let temp_dir = manager.extensions_dir.join(".tmp");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let canonical_temp = std::fs::canonicalize(&temp_dir)
        .map_err(|e| format!("Failed to canonicalize temp dir: {}", e))?;

    // Use a timestamp-based unique name to avoid collisions
    let unique_name = format!("download_{}", chrono::Utc::now().timestamp_millis());
    let zip_path = canonical_temp.join(format!("{}.zip", unique_name));
    let extract_dir = canonical_temp.join(&unique_name);

    std::fs::write(&zip_path, &bytes).map_err(|e| e.to_string())?;

    if extract_dir.exists() {
        std::fs::remove_dir_all(&extract_dir).map_err(|e| e.to_string())?;
    }

    safe_extract_zip(&zip_path, &extract_dir)?;

    // 4. Verify the extension manifest (package.json with xplorer field)
    let manifest_path = extract_dir.join("package.json");
    if !manifest_path.exists() {
        let _ = std::fs::remove_file(&zip_path);
        let _ = std::fs::remove_dir_all(&extract_dir);
        return Err("Downloaded extension has no package.json manifest".to_string());
    }

    let manifest_content = std::fs::read_to_string(&manifest_path).map_err(|e| {
        let _ = std::fs::remove_file(&zip_path);
        let _ = std::fs::remove_dir_all(&extract_dir);
        format!("Failed to read manifest: {}", e)
    })?;

    let manifest = crate::extensions::types::parse_manifest_from_package_json(&manifest_content)
        .inspect_err(|_e| {
            let _ = std::fs::remove_file(&zip_path);
            let _ = std::fs::remove_dir_all(&extract_dir);
        })?;

    let extension_id = manifest.id.clone();
    validate_extension_id(&extension_id)?;

    // 5. Verify Ed25519 signature if .sig exists
    let sig_path = extract_dir.join(".sig");
    if sig_path.exists() {
        let verified =
            crate::extensions::signing::verify_extension_integrity(&extract_dir, &extension_id);
        if !verified {
            let _ = std::fs::remove_file(&zip_path);
            let _ = std::fs::remove_dir_all(&extract_dir);
            return Err(format!(
                "Extension '{}' failed signature verification",
                extension_id
            ));
        }
    }

    // 6. Install via the existing flow (copy to extensions_dir)
    let result = manager.install_extension(extract_dir.to_str().ok_or("Invalid path")?);

    // Cleanup temp files
    let _ = std::fs::remove_file(&zip_path);
    let _ = std::fs::remove_dir_all(&extract_dir);

    result.map(|_| extension_id)
}

/// Check for available updates by posting installed extension info to the marketplace.
///
/// Sends a POST request to `{marketplace_url}/api/extensions/check-updates` with a JSON
/// body of `{ extensions: [{id, version}, ...] }` and expects a response of
/// `{ updates: [{id, latest_version, download_url, changelog}, ...] }`.
#[command]
pub async fn check_extension_updates(
    installed: Vec<(String, String)>, // Vec<(extension_id, current_version)>
    marketplace_url: String,
) -> Result<Vec<ExtensionUpdate>, String> {
    // Validate the marketplace URL
    validate_url_security(&marketplace_url)?;

    // Build the request body
    #[derive(Serialize)]
    struct ExtensionEntry {
        id: String,
        version: String,
    }

    #[derive(Serialize)]
    struct CheckUpdatesRequest {
        extensions: Vec<ExtensionEntry>,
    }

    let extensions: Vec<ExtensionEntry> = installed
        .into_iter()
        .map(|(id, version)| ExtensionEntry { id, version })
        .collect();

    let body = CheckUpdatesRequest { extensions };

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/api/extensions/check-updates", marketplace_url))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to check updates: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Update check failed with status: {}",
            resp.status()
        ));
    }

    // Parse the response: { updates: [...] }
    #[derive(Deserialize)]
    struct CheckUpdatesResponse {
        updates: Vec<ExtensionUpdate>,
    }

    let response: CheckUpdatesResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse update response: {}", e))?;

    Ok(response.updates)
}

/// Install an extension from a .xtension file.
/// Extracts the ZIP, parses the manifest, and installs via the extension manager.
#[command]
pub async fn install_xtension_file(xtension_path: String) -> Result<ExtensionPackage, String> {
    use std::path::Path;

    let file_path = Path::new(&xtension_path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", xtension_path));
    }

    // Verify it has the .xtension extension
    match file_path.extension().and_then(|e| e.to_str()) {
        Some("xtension") => {}
        _ => return Err("File must have .xtension extension".to_string()),
    }

    // Create temp extraction directory inside the extensions directory
    let temp_dir = get_extensions_tmp_dir()?;
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    // Generate a unique extraction folder name
    let stem = file_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("extension");
    let extract_dir = temp_dir.join(stem);
    if extract_dir.exists() {
        std::fs::remove_dir_all(&extract_dir).map_err(|e| e.to_string())?;
    }

    // Extract the ZIP safely (Zip Slip protection)
    safe_extract_zip(file_path, &extract_dir)?;

    // Install via the extension manager
    let mut manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = manager_guard
        .as_mut()
        .ok_or("Extension manager not initialized")?;

    let result = manager.install_extension(extract_dir.to_str().ok_or("Invalid path")?);

    // Cleanup temp extraction
    let _ = std::fs::remove_dir_all(&extract_dir);

    result
}
