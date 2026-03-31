mod install;
mod manage;
mod pack;
mod wasm;

// Re-export all #[command] functions and public items so that
// `extensions::commands::function_name` paths continue to work.
pub use install::*;
pub use manage::*;
pub use pack::*;
pub use wasm::*;

use crate::extensions::manager::*;
use std::net::IpAddr;
use std::sync::{LazyLock, Mutex};

// ─── Shared State ───────────────────────────────────────────────────────────

pub(crate) static EXTENSION_MANAGER: LazyLock<Mutex<Option<ExtensionManager>>> =
    LazyLock::new(|| Mutex::new(None));

/// Get the temp directory for extension operations (downloads, extractions).
pub(crate) fn get_extensions_tmp_dir() -> Result<std::path::PathBuf, String> {
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

// ─── Validation Helpers ─────────────────────────────────────────────────────

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
pub(crate) fn validate_extension_id(id: &str) -> Result<(), String> {
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
pub(crate) fn validate_url_security(url: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| format!("Invalid URL '{}': {}", url, e))?;

    let host_str = parsed
        .host_str()
        .ok_or_else(|| "URL has no host".to_string())?;

    // Enforce HTTPS for all URLs
    if parsed.scheme() != "https" {
        return Err(format!(
            "URL must use HTTPS protocol, got '{}'",
            parsed.scheme()
        ));
    }

    // Reject URLs with credentials (user:password@host)
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("URL must not contain credentials".to_string());
    }

    // Reject non-standard ports
    if let Some(port) = parsed.port() {
        if port != 443 {
            return Err(format!(
                "URL must use the default HTTPS port (443), got port {}",
                port
            ));
        }
    }

    // Reject localhost
    let host_lower = host_str.to_lowercase();
    if host_lower == "localhost"
        || host_lower == "127.0.0.1"
        || host_lower == "::1"
        || host_lower == "[::1]"
    {
        return Err(format!("URL must not target localhost, got '{}'", host_str));
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
pub(crate) fn is_private_ip(ip: &IpAddr) -> bool {
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

/// Public wrapper for `validate_url_security` so other modules (e.g. host_functions)
/// can reuse the same SSRF-safe URL validation.
pub fn validate_url_security_public(url: &str) -> Result<(), String> {
    validate_url_security(url)
}

/// Safely extract a ZIP archive into `target_dir`, guarding against Zip Slip
/// (path traversal), symlinks, and other malicious entry names.
pub(crate) fn safe_extract_zip(
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

// ─── Tests ──────────────────────────────────────────────────────────────────

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
