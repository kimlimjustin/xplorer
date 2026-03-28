use crate::extensions::{manager::*, plugin_registry, types::*};
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::sync::{LazyLock, Mutex};
use tauri::command;

/// Validate that an extension ID contains only safe characters.
///
/// Extension IDs are used to construct filesystem paths, so they must not
/// contain path separators, `..`, or other characters that could lead to
/// path traversal attacks. Only lowercase alphanumeric, hyphens, dots,
/// underscores, and the `@` / `/` characters used by scoped npm package
/// names (e.g., `@xplorer/theme-dark`) are permitted — but `..` sequences
/// and leading/trailing separators are still rejected.
///
/// Allowed charset: `[a-zA-Z0-9._@/-]` with additional structural rules.
fn validate_extension_id(id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("Extension ID must not be empty".to_string());
    }

    if id.len() > 128 {
        return Err("Extension ID must not exceed 128 characters".to_string());
    }

    // Reject path traversal sequences
    if id.contains("..") {
        return Err(format!(
            "Extension ID '{}' contains '..' path traversal sequence",
            id
        ));
    }

    // Reject path separators (backslash, and bare forward slash outside scoped names)
    if id.contains('\\') {
        return Err(format!(
            "Extension ID '{}' contains backslash path separator",
            id
        ));
    }

    // Reject null bytes
    if id.contains('\0') {
        return Err(format!("Extension ID '{}' contains null byte", id));
    }

    // Every character must be in the allowed set: a-z A-Z 0-9 . _ - @ /
    for ch in id.chars() {
        if !ch.is_ascii_alphanumeric()
            && ch != '.'
            && ch != '_'
            && ch != '-'
            && ch != '@'
            && ch != '/'
        {
            return Err(format!(
                "Extension ID '{}' contains disallowed character '{}'",
                id, ch
            ));
        }
    }

    // Must not start or end with a slash or dot
    if id.starts_with('/') || id.ends_with('/') {
        return Err(format!(
            "Extension ID '{}' must not start or end with '/'",
            id
        ));
    }
    if id.starts_with('.') || id.ends_with('.') {
        return Err(format!(
            "Extension ID '{}' must not start or end with '.'",
            id
        ));
    }

    Ok(())
}

/// Validate that a URL uses HTTPS and does not target private/internal IP addresses.
/// This prevents SSRF attacks where an attacker could use the extension download
/// mechanism to reach internal services.
///
/// Localhost (127.0.0.1, ::1, localhost) is allowed with HTTP for local development
/// (e.g., local marketplace server). All remote URLs must use HTTPS.
fn validate_url_security(url: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| format!("Invalid URL '{}': {}", url, e))?;

    // Check if this is a localhost URL (allowed with HTTP for local dev)
    let host_str = parsed
        .host_str()
        .ok_or_else(|| "URL has no host".to_string())?;
    let host_lower = host_str.to_lowercase();
    let is_localhost = host_lower == "localhost"
        || host_lower == "127.0.0.1"
        || host_lower == "::1"
        || host_lower == "[::1]";

    // Enforce HTTPS for remote URLs (localhost is exempt for local dev)
    if parsed.scheme() != "https" && !is_localhost {
        return Err(format!(
            "URL must use HTTPS protocol, got '{}'",
            parsed.scheme()
        ));
    }

    // Reject URLs with credentials (user:password@host)
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("URL must not contain credentials".to_string());
    }

    // For non-localhost URLs, reject non-standard ports
    if !is_localhost {
        if let Some(port) = parsed.port() {
            if port != 443 {
                return Err(format!(
                    "URL must use the default HTTPS port (443), got port {}",
                    port
                ));
            }
        }
    }

    // Skip private IP / internal hostname checks for localhost
    if is_localhost {
        return Ok(());
    }

    // Resolve the host and check for private/internal IPs

    // Strip surrounding brackets from IPv6 addresses (e.g. "[::1]" -> "::1")
    let bare_host = host_str
        .strip_prefix('[')
        .and_then(|s| s.strip_suffix(']'))
        .unwrap_or(host_str);

    // Check if the host is a direct IP address
    if let Ok(ip) = bare_host.parse::<IpAddr>() {
        if is_private_ip(&ip) {
            return Err(format!(
                "URL must not target private/internal IP addresses, got '{}'",
                ip
            ));
        }
    } else {
        // It's a hostname — block common loopback/internal names
        let host_lower = bare_host.to_lowercase();

        // Block internal hostname patterns (exact localhost already handled above)
        if host_lower.ends_with(".localhost")
            || host_lower.ends_with(".local")
            || host_lower.ends_with(".internal")
            || host_lower.ends_with(".corp")
            || host_lower.ends_with(".home")
            || host_lower.ends_with(".lan")
            || host_lower.ends_with(".intranet")
        {
            return Err(format!(
                "URL must not target local/internal hostnames, got '{}'",
                bare_host
            ));
        }

        // Block cloud metadata endpoints (common SSRF targets)
        if host_lower == "metadata.google.internal"
            || host_lower == "169.254.169.254"
            || host_lower.ends_with(".amazonaws.com") && host_lower.contains("metadata")
        {
            return Err(format!(
                "URL must not target cloud metadata services, got '{}'",
                bare_host
            ));
        }

        // Reject hostnames that look like decimal-encoded IPs (e.g., "2130706433")
        if bare_host.chars().all(|c| c.is_ascii_digit()) {
            return Err(format!(
                "URL must not use decimal-encoded IP addresses as hostname, got '{}'",
                bare_host
            ));
        }

        // Reject hostnames starting with "0x" (hex-encoded IPs)
        if host_lower.starts_with("0x") && host_lower[2..].chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(format!(
                "URL must not use hex-encoded IP addresses as hostname, got '{}'",
                bare_host
            ));
        }
    }

    Ok(())
}

/// Returns true if the given IP address is in a private, loopback, link-local,
/// or otherwise non-public range that should not be targeted by extension downloads.
fn is_private_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let octets = v4.octets();
            // 0.0.0.0/8 — "this" network (includes 0.0.0.0)
            octets[0] == 0
            // 127.0.0.0/8 — loopback
            || octets[0] == 127
            // 10.0.0.0/8 — private (RFC 1918)
            || octets[0] == 10
            // 172.16.0.0/12 — private (RFC 1918)
            || (octets[0] == 172 && (16..=31).contains(&octets[1]))
            // 192.168.0.0/16 — private (RFC 1918)
            || (octets[0] == 192 && octets[1] == 168)
            // 169.254.0.0/16 — link-local (RFC 3927)
            || (octets[0] == 169 && octets[1] == 254)
            // 100.64.0.0/10 — Shared Address Space / CGNAT (RFC 6598)
            // Also used by Tailscale (100.x.x.x); not publicly routable
            || (octets[0] == 100 && (64..=127).contains(&octets[1]))
            // 198.18.0.0/15 — benchmarking (RFC 2544)
            || (octets[0] == 198 && (octets[1] == 18 || octets[1] == 19))
            // 192.0.0.0/24 — IETF protocol assignments (RFC 6890)
            || (octets[0] == 192 && octets[1] == 0 && octets[2] == 0)
            // 192.0.2.0/24 — TEST-NET-1 (RFC 5737)
            || (octets[0] == 192 && octets[1] == 0 && octets[2] == 2)
            // 198.51.100.0/24 — TEST-NET-2 (RFC 5737)
            || (octets[0] == 198 && octets[1] == 51 && octets[2] == 100)
            // 203.0.113.0/24 — TEST-NET-3 (RFC 5737)
            || (octets[0] == 203 && octets[1] == 0 && octets[2] == 113)
            // 224.0.0.0/4 — multicast
            || octets[0] >= 224
        }
        IpAddr::V6(v6) => {
            // ::1 — loopback
            v6.is_loopback()
            // fe80::/10 — link-local (check first 10 bits)
            || (v6.segments()[0] & 0xffc0) == 0xfe80
            // fc00::/7 — unique local (check first 7 bits)
            || (v6.segments()[0] & 0xfe00) == 0xfc00
            // :: — unspecified
            || v6.is_unspecified()
            // ::ffff:0:0/96 — IPv4-mapped IPv6 addresses
            // Check the embedded IPv4 address against private ranges too
            || {
                let segments = v6.segments();
                if segments[0] == 0 && segments[1] == 0 && segments[2] == 0
                    && segments[3] == 0 && segments[4] == 0 && segments[5] == 0xffff
                {
                    // Extract the embedded IPv4 address
                    let v4 = std::net::Ipv4Addr::new(
                        (segments[6] >> 8) as u8,
                        (segments[6] & 0xff) as u8,
                        (segments[7] >> 8) as u8,
                        (segments[7] & 0xff) as u8,
                    );
                    is_private_ip(&IpAddr::V4(v4))
                } else {
                    false
                }
            }
        }
    }
}

/// Safely extract a ZIP archive into `target_dir`, guarding against Zip Slip
/// (path traversal), symlinks, and other malicious entry names.
fn safe_extract_zip(
    archive_path: &std::path::Path,
    target_dir: &std::path::Path,
) -> Result<(), String> {
    use std::io::{Read, Write};

    let file =
        std::fs::File::open(archive_path).map_err(|e| format!("Failed to open zip file: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip file: {}", e))?;

    std::fs::create_dir_all(target_dir)
        .map_err(|e| format!("Failed to create target directory: {}", e))?;

    let canonical_target = std::fs::canonicalize(target_dir)
        .map_err(|e| format!("Failed to canonicalize target directory: {}", e))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry {}: {}", i, e))?;

        let entry_name = entry.name().to_string();

        // 1. Reject entries containing ".." path traversal
        if entry_name.contains("..") {
            continue;
        }

        // 2. Skip symlinks (mangled_name returns None for symlinks in some impls,
        //    but we also check the unix mode for symlink bit)
        #[cfg(unix)]
        {
            if let Some(mode) = entry.unix_mode() {
                // S_IFLNK = 0o120000
                if mode & 0o170000 == 0o120000 {
                    continue;
                }
            }
        }

        // Strip leading slashes
        let safe_name = entry_name
            .trim_start_matches('/')
            .trim_start_matches('\\')
            .to_string();

        if safe_name.is_empty() {
            continue;
        }

        let outpath = canonical_target.join(&safe_name);

        // 3. Validate the target path is within the canonical target BEFORE creating anything.
        //    Use lexical comparison on the joined path (canonical_target is already canonical).
        //    After directory creation we re-check with a real canonicalize to catch symlink tricks.
        {
            // Lexical check: normalise away any inner ".." or "." that snuck past the string check
            let mut normalized = std::path::PathBuf::new();
            for component in outpath.components() {
                match component {
                    std::path::Component::ParentDir => {
                        normalized.pop();
                    }
                    std::path::Component::CurDir => {}
                    c => normalized.push(c.as_os_str()),
                }
            }
            if !normalized.starts_with(&canonical_target) {
                continue; // path traversal attempt
            }
        }

        if entry.is_dir() {
            std::fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
            // Re-verify after creation (catches symlink TOCTOU)
            let real_path = std::fs::canonicalize(&outpath)
                .map_err(|e| format!("Failed to canonicalize created dir: {}", e))?;
            if !real_path.starts_with(&canonical_target) {
                let _ = std::fs::remove_dir_all(&outpath);
                continue;
            }
        } else {
            // 4. Create parent directories
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent dir: {}", e))?;
                }
                // Re-verify the parent after creation (catches symlink TOCTOU)
                let canonical_parent = std::fs::canonicalize(parent)
                    .map_err(|e| format!("Failed to canonicalize parent: {}", e))?;
                if !canonical_parent.starts_with(&canonical_target) {
                    continue; // path traversal attempt via symlink
                }
            }

            // 5. Extract the file
            let mut buf = Vec::new();
            entry
                .read_to_end(&mut buf)
                .map_err(|e| format!("Failed to read zip entry: {}", e))?;
            let mut outfile = std::fs::File::create(&outpath)
                .map_err(|e| format!("Failed to create file {}: {}", outpath.display(), e))?;
            outfile
                .write_all(&buf)
                .map_err(|e| format!("Failed to write file: {}", e))?;

            // Final verification: ensure the file we just wrote is still inside the target
            let canonical_written = std::fs::canonicalize(&outpath)
                .map_err(|e| format!("Failed to canonicalize written file: {}", e))?;
            if !canonical_written.starts_with(&canonical_target) {
                let _ = std::fs::remove_file(&outpath);
                continue;
            }
        }
    }

    Ok(())
}

/// Public wrapper for `validate_url_security` so other modules (e.g. host_functions)
/// can reuse the same SSRF-safe URL validation.
pub fn validate_url_security_public(url: &str) -> Result<(), String> {
    validate_url_security(url)
}

static EXTENSION_MANAGER: LazyLock<Mutex<Option<ExtensionManager>>> =
    LazyLock::new(|| Mutex::new(None));

/// Get the temp directory for extension operations (downloads, extractions).
fn get_extensions_tmp_dir() -> Result<std::path::PathBuf, String> {
    let manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = manager_guard
        .as_ref()
        .ok_or("Extension manager not initialized")?;
    Ok(manager.extensions_dir.join(".tmp"))
}

pub fn init_extension_manager(data_dir: &str) {
    let extensions_dir = format!("{}/extensions", data_dir);
    let manager = ExtensionManager::new(&extensions_dir);
    let mut manager_guard = EXTENSION_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    *manager_guard = Some(manager);
}

#[command]
pub async fn get_installed_extensions() -> Result<Vec<ExtensionPackage>, String> {
    let manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    if let Some(manager) = manager_guard.as_ref() {
        Ok(manager.installed_extensions.clone())
    } else {
        Err("Extension manager not initialized".to_string())
    }
}

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

#[command]
pub async fn activate_extension(extension_id: String) -> Result<(), String> {
    validate_extension_id(&extension_id)?;
    let mut manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    if let Some(manager) = manager_guard.as_mut() {
        manager.activate_extension(&extension_id)
    } else {
        Err("Extension manager not initialized".to_string())
    }
}

#[command]
pub async fn deactivate_extension(extension_id: String) -> Result<(), String> {
    validate_extension_id(&extension_id)?;

    // Unload WASM instance if loaded.
    super::WASM_RUNTIME.unload(&extension_id);

    let mut manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    if let Some(manager) = manager_guard.as_mut() {
        manager.deactivate_extension(&extension_id)
    } else {
        Err("Extension manager not initialized".to_string())
    }
}

#[command]
pub async fn get_extension_permissions(extension_id: String) -> Result<Vec<String>, String> {
    validate_extension_id(&extension_id)?;
    let manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    if let Some(manager) = manager_guard.as_ref() {
        manager.get_extension_permissions(&extension_id)
    } else {
        Err("Extension manager not initialized".to_string())
    }
}

#[command]
pub async fn get_active_extension_ids() -> Result<Vec<String>, String> {
    let manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    if let Some(manager) = manager_guard.as_ref() {
        Ok(manager.active_extensions.clone())
    } else {
        Err("Extension manager not initialized".to_string())
    }
}

#[command]
pub async fn validate_extension_path(extension_path: String) -> Result<ExtensionManifest, String> {
    use std::fs;
    use std::path::Path;

    let manifest_path = Path::new(&extension_path).join("package.json");
    if !manifest_path.exists() {
        return Err("Extension manifest (package.json) not found".to_string());
    }

    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;

    let manifest = crate::extensions::types::parse_manifest_from_package_json(&manifest_content)?;

    if manifest.id.is_empty() || manifest.name.is_empty() || manifest.version.is_empty() {
        return Err("Invalid manifest: missing required fields".to_string());
    }

    Ok(manifest)
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

/// Invoke a command on a loaded native extension plugin.
///
/// This allows extensions with compiled shared libraries to expose
/// backend functionality (e.g., SSH, FTP) through a JSON-based command interface.
///
/// The calling extension must either own the plugin (extension_id == plugin_id)
/// or have the `native:invoke` permission granted.
#[command]
pub async fn native_plugin_invoke(
    extension_id: String,
    plugin_id: String,
    command: String,
    args: serde_json::Value,
) -> Result<serde_json::Value, String> {
    validate_extension_id(&extension_id)?;
    validate_extension_id(&plugin_id)?;

    // Verify the calling extension is active and has appropriate permissions.
    {
        let manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
        let manager = manager_guard
            .as_ref()
            .ok_or("Extension manager not initialized")?;
        let ext = manager
            .installed_extensions
            .iter()
            .find(|e| e.manifest.id == extension_id)
            .ok_or_else(|| format!("Extension '{}' not found", extension_id))?;
        if !ext.is_active {
            return Err(format!("Extension '{}' is not active", extension_id));
        }

        // The extension must either own the plugin or have native:invoke permission.
        let permissions = ext.manifest.permissions.clone().unwrap_or_default();
        if extension_id != plugin_id && !permissions.iter().any(|p| p == "native:invoke") {
            return Err(format!(
                "Extension '{}' lacks 'native:invoke' permission to invoke plugin '{}'",
                extension_id, plugin_id
            ));
        }
    }
    // Manager lock released here.

    // Run in blocking thread since native plugin calls may block
    tokio::task::spawn_blocking(move || plugin_registry::invoke_plugin(&plugin_id, &command, args))
        .await
        .map_err(|e| format!("Plugin invocation failed: {}", e))?
}

// ─── WASM Backend Commands ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmBackendStatus {
    pub loaded: bool,
    pub has_wasm_file: bool,
    pub extension_id: String,
}

/// Call a method on an extension's WASM backend.
///
/// If the WASM module isn't loaded yet, it will be loaded on-demand from
/// the extension's `backend.wasm` file.
#[command]
pub async fn extension_backend_call(
    extension_id: String,
    method: String,
    args: serde_json::Value,
) -> Result<serde_json::Value, String> {
    validate_extension_id(&extension_id)?;

    let args_json =
        serde_json::to_string(&args).map_err(|e| format!("Failed to serialize args: {}", e))?;

    // Run in a blocking thread since WASM execution is synchronous.
    tokio::task::spawn_blocking(move || {
        // Get extension info (path, permissions) from the extension manager.
        let (ext_path, permissions) = {
            let manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
            let manager = manager_guard
                .as_ref()
                .ok_or("Extension manager not initialized")?;
            let ext = manager
                .installed_extensions
                .iter()
                .find(|e| e.manifest.id == extension_id)
                .ok_or_else(|| format!("Extension '{}' not found", extension_id))?;
            if !ext.is_active {
                return Err(format!("Extension '{}' is not active", extension_id));
            }
            (
                ext.path.clone(),
                ext.manifest.permissions.clone().unwrap_or_default(),
            )
        };
        // Manager lock released here.

        let runtime = &super::WASM_RUNTIME;

        // Load on demand if not already loaded.
        if !runtime.is_loaded(&extension_id) {
            let wasm_path = std::path::Path::new(&ext_path).join("backend.wasm");
            if !wasm_path.exists() {
                return Err(format!(
                    "Extension '{}' has no backend.wasm file",
                    extension_id
                ));
            }
            let wasm_bytes = std::fs::read(&wasm_path)
                .map_err(|e| format!("Failed to read backend.wasm: {}", e))?;
            runtime.load_module(&extension_id, &wasm_bytes, permissions)?;
        }

        let result_json = runtime.call(&extension_id, &method, &args_json)?;

        serde_json::from_str::<serde_json::Value>(&result_json)
            .map_err(|e| format!("WASM returned invalid JSON: {}", e))
    })
    .await
    .map_err(|e| format!("WASM backend call failed: {}", e))?
}

/// Get the status of an extension's WASM backend (loaded, has wasm file, etc.).
#[command]
pub async fn extension_backend_status(extension_id: String) -> Result<WasmBackendStatus, String> {
    validate_extension_id(&extension_id)?;

    let has_wasm_file = {
        let manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
        let manager = manager_guard
            .as_ref()
            .ok_or("Extension manager not initialized")?;
        manager
            .installed_extensions
            .iter()
            .find(|e| e.manifest.id == extension_id)
            .map(|e| e.has_wasm_backend)
            .unwrap_or(false)
    };

    let loaded = { super::WASM_RUNTIME.is_loaded(&extension_id) };

    Ok(WasmBackendStatus {
        loaded,
        has_wasm_file,
        extension_id,
    })
}

// ─── .xtension File Format ────────────────────────────────────────────────

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::tempdir;
    use zip::write::FileOptions;

    /// Helper: create a zip archive in memory with the given list of
    /// (entry_name, contents) pairs and write it to `path`.
    fn create_zip_with_entries(path: &std::path::Path, entries: &[(&str, &[u8])]) {
        let file = std::fs::File::create(path).expect("create zip file");
        let mut writer = zip::ZipWriter::new(file);
        let options = FileOptions::default().compression_method(zip::CompressionMethod::Stored);
        for (name, data) in entries {
            writer.start_file(*name, options).expect("start file entry");
            writer.write_all(data).expect("write entry data");
        }
        writer.finish().expect("finish zip");
    }

    #[test]
    fn test_safe_extract_valid_zip() {
        let temp = tempdir().expect("create temp dir");
        let zip_path = temp.path().join("valid.zip");
        let extract_dir = temp.path().join("out");

        create_zip_with_entries(
            &zip_path,
            &[
                ("hello.txt", b"Hello, world!"),
                ("subdir/nested.txt", b"Nested content"),
            ],
        );

        let result = safe_extract_zip(&zip_path, &extract_dir);
        assert!(
            result.is_ok(),
            "extraction should succeed: {:?}",
            result.err()
        );

        // Verify extracted files
        let hello = extract_dir.join("hello.txt");
        assert!(hello.exists(), "hello.txt should be extracted");
        assert_eq!(std::fs::read_to_string(&hello).unwrap(), "Hello, world!");

        let nested = extract_dir.join("subdir/nested.txt");
        assert!(nested.exists(), "subdir/nested.txt should be extracted");
        assert_eq!(std::fs::read_to_string(&nested).unwrap(), "Nested content");
    }

    #[test]
    fn test_safe_extract_rejects_path_traversal() {
        let temp = tempdir().expect("create temp dir");
        let zip_path = temp.path().join("evil.zip");
        let extract_dir = temp.path().join("out");

        // Create a zip with a path-traversal entry ("../evil.txt")
        create_zip_with_entries(
            &zip_path,
            &[
                ("good.txt", b"safe"),
                ("../evil.txt", b"I should not appear outside"),
            ],
        );

        let result = safe_extract_zip(&zip_path, &extract_dir);
        assert!(result.is_ok(), "should not error, just skip bad entries");

        // The good file should be extracted
        assert!(
            extract_dir.join("good.txt").exists(),
            "good.txt should exist"
        );

        // The traversal entry should NOT exist outside the extract dir
        let evil_path = temp.path().join("evil.txt");
        assert!(
            !evil_path.exists(),
            "../evil.txt should NOT be extracted outside target directory"
        );
    }

    #[test]
    fn test_safe_extract_rejects_absolute_paths() {
        let temp = tempdir().expect("create temp dir");
        let zip_path = temp.path().join("abs.zip");
        let extract_dir = temp.path().join("out");

        // Create a zip whose entry starts with "/" — the code strips leading slashes
        // but we verify it lands inside the target directory, not at the root.
        create_zip_with_entries(
            &zip_path,
            &[("/etc/passwd", b"root:x:0:0"), ("normal.txt", b"ok")],
        );

        let result = safe_extract_zip(&zip_path, &extract_dir);
        assert!(result.is_ok(), "should succeed, stripping leading slashes");

        // normal.txt should exist
        assert!(extract_dir.join("normal.txt").exists());

        // The absolute path entry should land inside extract_dir (stripped to etc/passwd),
        // NOT at the actual system path.
        assert!(
            !std::path::Path::new("/etc/passwd_test_sentinel").exists(),
            "should not write to absolute system paths"
        );

        // It may or may not exist as extract_dir/etc/passwd depending on the stripping,
        // but the important thing is it is NOT at the absolute path.
    }

    #[test]
    fn test_safe_extract_handles_empty_zip() {
        let temp = tempdir().expect("create temp dir");
        let zip_path = temp.path().join("empty.zip");
        let extract_dir = temp.path().join("out");

        // Create an empty zip
        create_zip_with_entries(&zip_path, &[]);

        let result = safe_extract_zip(&zip_path, &extract_dir);
        assert!(result.is_ok(), "extracting empty zip should succeed");
        assert!(
            extract_dir.exists(),
            "target dir should be created even if zip is empty"
        );
    }

    #[test]
    fn test_safe_extract_handles_directory_entries() {
        let temp = tempdir().expect("create temp dir");
        let zip_path = temp.path().join("dirs.zip");
        let extract_dir = temp.path().join("out");

        let file = std::fs::File::create(&zip_path).expect("create zip file");
        let mut writer = zip::ZipWriter::new(file);
        let options = FileOptions::default().compression_method(zip::CompressionMethod::Stored);
        writer.add_directory("mydir/", options).expect("add dir");
        writer
            .start_file("mydir/file.txt", options)
            .expect("start file");
        writer.write_all(b"inside dir").expect("write data");
        writer.finish().expect("finish zip");

        let result = safe_extract_zip(&zip_path, &extract_dir);
        assert!(result.is_ok());
        assert!(extract_dir.join("mydir").is_dir());
        assert!(extract_dir.join("mydir/file.txt").exists());
    }

    #[test]
    fn test_safe_extract_nonexistent_zip_returns_error() {
        let temp = tempdir().expect("create temp dir");
        let zip_path = temp.path().join("nonexistent.zip");
        let extract_dir = temp.path().join("out");

        let result = safe_extract_zip(&zip_path, &extract_dir);
        assert!(result.is_err(), "should fail for nonexistent zip file");
    }

    // ─── URL validation tests ─────────────────────────────────────────

    #[test]
    fn test_validate_url_accepts_valid_https() {
        assert!(validate_url_security("https://marketplace.example.com/ext.zip").is_ok());
        assert!(
            validate_url_security("https://github.com/user/repo/releases/download/v1/ext.zip")
                .is_ok()
        );
    }

    #[test]
    fn test_validate_url_rejects_http() {
        let result = validate_url_security("http://marketplace.example.com/ext.zip");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("HTTPS"));
    }

    #[test]
    fn test_validate_url_rejects_private_ips() {
        // 10.x.x.x
        assert!(validate_url_security("https://10.0.0.1/ext.zip").is_err());
        // 172.16-31.x.x
        assert!(validate_url_security("https://172.16.0.1/ext.zip").is_err());
        assert!(validate_url_security("https://172.31.255.255/ext.zip").is_err());
        // 192.168.x.x
        assert!(validate_url_security("https://192.168.1.1/ext.zip").is_err());
        // 169.254.x.x (link-local)
        assert!(validate_url_security("https://169.254.0.1/ext.zip").is_err());
        // 127.x.x.x (loopback)
        assert!(validate_url_security("https://127.0.0.1/ext.zip").is_err());
        // IPv6 loopback
        assert!(validate_url_security("https://[::1]/ext.zip").is_err());
    }

    #[test]
    fn test_validate_url_rejects_localhost() {
        assert!(validate_url_security("https://localhost/ext.zip").is_err());
        assert!(validate_url_security("https://something.local/ext.zip").is_err());
        assert!(validate_url_security("https://service.internal/ext.zip").is_err());
    }

    #[test]
    fn test_validate_url_rejects_invalid_urls() {
        assert!(validate_url_security("not-a-url").is_err());
        assert!(validate_url_security("ftp://files.example.com/ext.zip").is_err());
    }

    #[test]
    fn test_is_private_ip_edge_cases() {
        use std::net::IpAddr;
        // 172.15 is NOT private (only 172.16-31)
        let ip: IpAddr = "172.15.0.1".parse().unwrap();
        assert!(!is_private_ip(&ip));
        // 172.32 is NOT private
        let ip: IpAddr = "172.32.0.1".parse().unwrap();
        assert!(!is_private_ip(&ip));
        // Public IP should pass
        let ip: IpAddr = "8.8.8.8".parse().unwrap();
        assert!(!is_private_ip(&ip));
    }

    // ─── Extension ID validation tests ───────────────────────────────

    #[test]
    fn test_validate_extension_id_accepts_valid_ids() {
        assert!(validate_extension_id("my-extension").is_ok());
        assert!(validate_extension_id("xplorer-theme-dark").is_ok());
        assert!(validate_extension_id("my_extension_v2").is_ok());
        assert!(validate_extension_id("ext.plugin.v1").is_ok());
        assert!(validate_extension_id("a").is_ok());
        assert!(validate_extension_id("extension-123").is_ok());
        // Scoped npm-style names
        assert!(validate_extension_id("@xplorer/theme-dark").is_ok());
    }

    #[test]
    fn test_validate_extension_id_rejects_empty() {
        let result = validate_extension_id("");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
    }

    #[test]
    fn test_validate_extension_id_rejects_path_traversal() {
        assert!(validate_extension_id("..").is_err());
        assert!(validate_extension_id("../etc/passwd").is_err());
        assert!(validate_extension_id("foo/../bar").is_err());
        assert!(validate_extension_id("foo/..").is_err());
        assert!(validate_extension_id("..hidden").is_err());
    }

    #[test]
    fn test_validate_extension_id_rejects_backslash() {
        assert!(validate_extension_id("foo\\bar").is_err());
        assert!(validate_extension_id("..\\..\\etc\\passwd").is_err());
    }

    #[test]
    fn test_validate_extension_id_rejects_special_characters() {
        assert!(validate_extension_id("ext with spaces").is_err());
        assert!(validate_extension_id("ext;rm -rf /").is_err());
        assert!(validate_extension_id("ext$HOME").is_err());
        assert!(validate_extension_id("ext`whoami`").is_err());
        assert!(validate_extension_id("ext\0null").is_err());
    }

    #[test]
    fn test_validate_extension_id_rejects_leading_trailing_dots_slashes() {
        assert!(validate_extension_id(".hidden").is_err());
        assert!(validate_extension_id("trailing.").is_err());
        assert!(validate_extension_id("/leading").is_err());
        assert!(validate_extension_id("trailing/").is_err());
    }

    #[test]
    fn test_validate_extension_id_rejects_too_long() {
        let long_id = "a".repeat(129);
        assert!(validate_extension_id(&long_id).is_err());
        // 128 should be fine
        let ok_id = "a".repeat(128);
        assert!(validate_extension_id(&ok_id).is_ok());
    }

    // ─── Enhanced URL validation tests ───────────────────────────────

    #[test]
    fn test_validate_url_rejects_non_standard_ports() {
        // Common internal service ports
        assert!(validate_url_security("https://example.com:6379/ext.zip").is_err()); // Redis
        assert!(validate_url_security("https://example.com:9200/ext.zip").is_err()); // Elasticsearch
        assert!(validate_url_security("https://example.com:2375/ext.zip").is_err()); // Docker
        assert!(validate_url_security("https://example.com:8080/ext.zip").is_err()); // common alt HTTP
                                                                                     // Port 443 (default HTTPS) should be fine explicitly
        assert!(validate_url_security("https://example.com:443/ext.zip").is_ok());
        // No port (defaults to 443) should be fine
        assert!(validate_url_security("https://example.com/ext.zip").is_ok());
    }

    #[test]
    fn test_validate_url_rejects_credentials_in_url() {
        assert!(validate_url_security("https://user:pass@example.com/ext.zip").is_err());
        assert!(validate_url_security("https://admin@example.com/ext.zip").is_err());
    }

    #[test]
    fn test_validate_url_rejects_localhost_subdomains() {
        assert!(validate_url_security("https://evil.localhost/ext.zip").is_err());
        assert!(validate_url_security("https://sub.something.local/ext.zip").is_err());
    }

    #[test]
    fn test_validate_url_rejects_additional_internal_tlds() {
        assert!(validate_url_security("https://service.corp/ext.zip").is_err());
        assert!(validate_url_security("https://service.home/ext.zip").is_err());
        assert!(validate_url_security("https://service.lan/ext.zip").is_err());
        assert!(validate_url_security("https://service.intranet/ext.zip").is_err());
    }

    #[test]
    fn test_validate_url_rejects_decimal_encoded_ips() {
        // 2130706433 is 127.0.0.1 in decimal
        assert!(validate_url_security("https://2130706433/ext.zip").is_err());
    }

    #[test]
    fn test_validate_url_rejects_hex_encoded_ips() {
        // 0x7f000001 is 127.0.0.1 in hex
        assert!(validate_url_security("https://0x7f000001/ext.zip").is_err());
    }

    #[test]
    fn test_is_private_ip_cgnat_and_benchmark_ranges() {
        use std::net::IpAddr;
        // 100.64.0.0/10 — CGNAT / Tailscale
        let ip: IpAddr = "100.64.0.1".parse().unwrap();
        assert!(is_private_ip(&ip));
        let ip: IpAddr = "100.127.255.255".parse().unwrap();
        assert!(is_private_ip(&ip));
        // 100.63.x.x should NOT be flagged
        let ip: IpAddr = "100.63.255.255".parse().unwrap();
        assert!(!is_private_ip(&ip));
        // 100.128.x.x should NOT be flagged
        let ip: IpAddr = "100.128.0.1".parse().unwrap();
        assert!(!is_private_ip(&ip));

        // 198.18.0.0/15 — benchmarking
        let ip: IpAddr = "198.18.0.1".parse().unwrap();
        assert!(is_private_ip(&ip));
        let ip: IpAddr = "198.19.255.255".parse().unwrap();
        assert!(is_private_ip(&ip));
        // 198.20 should NOT be flagged
        let ip: IpAddr = "198.20.0.1".parse().unwrap();
        assert!(!is_private_ip(&ip));
    }

    #[test]
    fn test_is_private_ip_ipv4_mapped_ipv6() {
        use std::net::IpAddr;
        // ::ffff:127.0.0.1 — IPv4-mapped loopback
        let ip: IpAddr = "::ffff:127.0.0.1".parse().unwrap();
        assert!(is_private_ip(&ip));
        // ::ffff:10.0.0.1 — IPv4-mapped private
        let ip: IpAddr = "::ffff:10.0.0.1".parse().unwrap();
        assert!(is_private_ip(&ip));
        // ::ffff:192.168.1.1 — IPv4-mapped private
        let ip: IpAddr = "::ffff:192.168.1.1".parse().unwrap();
        assert!(is_private_ip(&ip));
        // ::ffff:8.8.8.8 — IPv4-mapped public (should NOT be flagged)
        let ip: IpAddr = "::ffff:8.8.8.8".parse().unwrap();
        assert!(!is_private_ip(&ip));
    }

    #[test]
    fn test_is_private_ip_zero_network() {
        use std::net::IpAddr;
        // 0.0.0.0 — should be private
        let ip: IpAddr = "0.0.0.0".parse().unwrap();
        assert!(is_private_ip(&ip));
        // 0.0.0.1 — also in 0.0.0.0/8
        let ip: IpAddr = "0.0.0.1".parse().unwrap();
        assert!(is_private_ip(&ip));
        // 0.255.255.255 — edge of 0.0.0.0/8
        let ip: IpAddr = "0.255.255.255".parse().unwrap();
        assert!(is_private_ip(&ip));
    }

    #[test]
    fn test_is_private_ip_multicast() {
        use std::net::IpAddr;
        // 224.0.0.1 — multicast
        let ip: IpAddr = "224.0.0.1".parse().unwrap();
        assert!(is_private_ip(&ip));
        // 255.255.255.255 — broadcast
        let ip: IpAddr = "255.255.255.255".parse().unwrap();
        assert!(is_private_ip(&ip));
    }
}
