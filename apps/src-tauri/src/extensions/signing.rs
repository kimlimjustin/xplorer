//! Extension Signature Verification
//!
//! Provides SHA-256 based integrity verification for extensions.
//! When an extension is signed, a `.sig` file is created alongside its `package.json`
//! containing a JSON payload with the content hash, signer identity, and timestamp.
//!
//! On load, the extension manager checks for a `.sig` file and verifies that the
//! stored hash matches the current on-disk contents. Unsigned extensions are allowed
//! to load but produce a warning.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use tracing::warn;

/// Metadata stored in the `.sig` file alongside an extension's `package.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureInfo {
    /// Hex-encoded SHA-256 hash of all extension files (deterministic order).
    pub hash: String,
    /// Identity of the signer (e.g. a developer name or key fingerprint).
    pub signer: String,
    /// ISO-8601 timestamp of when the signature was created.
    pub timestamp: String,
    /// Whether the signature was successfully verified against the on-disk contents.
    #[serde(default)]
    pub verified: bool,
}

// ─── Hashing ────────────────────────────────────────────────────────────────

/// Compute a deterministic SHA-256 hash of every file in `extension_dir`.
///
/// Files are sorted by their relative path (using forward-slash normalised form)
/// so that the hash is stable across platforms and directory-traversal orderings.
/// The `.sig` file itself is excluded from the hash so that signing does not
/// create a circular dependency.
pub fn hash_extension_contents(extension_dir: &Path) -> Result<String, String> {
    let mut file_entries: Vec<(String, Vec<u8>)> = Vec::new();
    collect_files(extension_dir, extension_dir, &mut file_entries)?;

    // Sort by relative path for determinism
    file_entries.sort_by(|a, b| a.0.cmp(&b.0));

    let mut hasher = Sha256::new();
    for (relative_path, contents) in &file_entries {
        // Hash the path and the contents so that renames are detected
        hasher.update(relative_path.as_bytes());
        hasher.update(contents);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Recursively collect `(relative_path, file_bytes)` tuples for every file
/// under `dir`, skipping directories that are not part of a distribution and
/// skipping the `.sig` file itself.
fn collect_files(
    base: &Path,
    dir: &Path,
    out: &mut Vec<(String, Vec<u8>)>,
) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory '{}': {}", dir.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read dir entry: {}", e))?;
        let path = entry.path();

        // Skip non-distribution directories
        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                match name {
                    "node_modules" | ".git" | "src" | ".github" | "target" => continue,
                    _ => {}
                }
            }
            collect_files(base, &path, out)?;
            continue;
        }

        // Skip the signature file itself
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name == ".sig" {
                continue;
            }
        }

        let relative = path
            .strip_prefix(base)
            .map_err(|e| format!("Failed to compute relative path: {}", e))?;
        // Normalise to forward slashes for cross-platform determinism
        let relative_str = relative.to_string_lossy().replace('\\', "/");

        let contents = fs::read(&path)
            .map_err(|e| format!("Failed to read file '{}': {}", path.display(), e))?;

        out.push((relative_str, contents));
    }

    Ok(())
}

// ─── Signing ────────────────────────────────────────────────────────────────

/// Sign an extension by computing its content hash and writing a `.sig` file
/// into the extension directory.
///
/// `signer` is an arbitrary identity string (e.g. a developer name).
pub fn sign_extension(extension_dir: &Path, signer: &str) -> Result<SignatureInfo, String> {
    let hash = hash_extension_contents(extension_dir)?;
    let timestamp = chrono::Utc::now().to_rfc3339();

    let info = SignatureInfo {
        hash,
        signer: signer.to_string(),
        timestamp,
        verified: true,
    };

    let sig_path = sig_file_path(extension_dir);
    let json = serde_json::to_string_pretty(&info)
        .map_err(|e| format!("Failed to serialize signature: {}", e))?;
    fs::write(&sig_path, json)
        .map_err(|e| format!("Failed to write .sig file: {}", e))?;

    Ok(info)
}

// ─── Verification ───────────────────────────────────────────────────────────

/// Verify an extension's `.sig` file against the current on-disk contents.
///
/// Returns `Ok(Some(info))` with `verified = true/false` if a `.sig` file exists,
/// or `Ok(None)` if the extension is unsigned.
pub fn verify_extension(extension_dir: &Path) -> Result<Option<SignatureInfo>, String> {
    let sig_path = sig_file_path(extension_dir);

    if !sig_path.exists() {
        return Ok(None);
    }

    let sig_content = fs::read_to_string(&sig_path)
        .map_err(|e| format!("Failed to read .sig file: {}", e))?;

    let mut info: SignatureInfo = serde_json::from_str(&sig_content)
        .map_err(|e| format!("Invalid .sig file JSON: {}", e))?;

    let current_hash = hash_extension_contents(extension_dir)?;
    info.verified = info.hash == current_hash;

    Ok(Some(info))
}

/// Verify an extension's integrity on load.
///
/// - If signed and valid, returns `true`.
/// - If signed but tampered, logs a warning and returns `false`.
/// - If unsigned, logs a warning and returns `false`.
pub fn verify_extension_integrity(extension_dir: &Path, extension_id: &str) -> bool {
    match verify_extension(extension_dir) {
        Ok(Some(info)) => {
            if info.verified {
                true
            } else {
                warn!(
                    "[ExtensionSigning] Extension '{}' has an INVALID signature — \
                     contents may have been tampered with (expected hash {}, got different)",
                    extension_id, info.hash
                );
                false
            }
        }
        Ok(None) => {
            warn!(
                "[ExtensionSigning] Extension '{}' is UNSIGNED — no .sig file found",
                extension_id
            );
            false
        }
        Err(e) => {
            warn!(
                "[ExtensionSigning] Failed to verify extension '{}': {}",
                extension_id, e
            );
            false
        }
    }
}

/// Return the path to the `.sig` file for an extension directory.
fn sig_file_path(extension_dir: &Path) -> PathBuf {
    extension_dir.join(".sig")
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    /// Helper: create a minimal extension directory with a package.json and a JS file.
    fn create_test_extension(dir: &Path) {
        fs::write(
            dir.join("package.json"),
            r#"{"id":"test-ext","name":"Test","version":"1.0.0","main":"dist/index.js"}"#,
        )
        .unwrap();
        let dist = dir.join("dist");
        fs::create_dir_all(&dist).unwrap();
        fs::write(dist.join("index.js"), "console.log('hello');").unwrap();
    }

    #[test]
    fn test_hash_is_deterministic() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());

        let hash1 = hash_extension_contents(tmp.path()).unwrap();
        let hash2 = hash_extension_contents(tmp.path()).unwrap();

        assert_eq!(hash1, hash2, "Hashing the same directory twice should yield the same result");
        assert!(!hash1.is_empty());
        assert_eq!(hash1.len(), 64, "SHA-256 hex digest should be 64 chars");
    }

    #[test]
    fn test_hash_changes_when_file_modified() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());

        let hash_before = hash_extension_contents(tmp.path()).unwrap();

        // Modify a file
        fs::write(tmp.path().join("dist/index.js"), "console.log('modified');").unwrap();

        let hash_after = hash_extension_contents(tmp.path()).unwrap();

        assert_ne!(hash_before, hash_after, "Hash should change when file contents change");
    }

    #[test]
    fn test_hash_changes_when_file_added() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());

        let hash_before = hash_extension_contents(tmp.path()).unwrap();

        // Add a new file
        fs::write(tmp.path().join("extra.txt"), "extra content").unwrap();

        let hash_after = hash_extension_contents(tmp.path()).unwrap();

        assert_ne!(hash_before, hash_after, "Hash should change when a file is added");
    }

    #[test]
    fn test_hash_excludes_sig_file() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());

        let hash_before = hash_extension_contents(tmp.path()).unwrap();

        // Write a .sig file — should not affect the hash
        fs::write(tmp.path().join(".sig"), r#"{"hash":"abc","signer":"x","timestamp":"t","verified":true}"#).unwrap();

        let hash_after = hash_extension_contents(tmp.path()).unwrap();

        assert_eq!(hash_before, hash_after, ".sig file should be excluded from hash computation");
    }

    #[test]
    fn test_hash_excludes_node_modules() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());

        let hash_before = hash_extension_contents(tmp.path()).unwrap();

        // Add a node_modules directory — should not affect the hash
        let nm = tmp.path().join("node_modules");
        fs::create_dir_all(&nm).unwrap();
        fs::write(nm.join("something.js"), "module.exports = {};").unwrap();

        let hash_after = hash_extension_contents(tmp.path()).unwrap();

        assert_eq!(hash_before, hash_after, "node_modules should be excluded from hash");
    }

    #[test]
    fn test_sign_creates_sig_file() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());

        let info = sign_extension(tmp.path(), "test-developer").unwrap();

        assert!(tmp.path().join(".sig").exists(), ".sig file should be created");
        assert_eq!(info.signer, "test-developer");
        assert!(info.verified);
        assert!(!info.hash.is_empty());
        assert!(!info.timestamp.is_empty());
    }

    #[test]
    fn test_verify_valid_signature() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());

        sign_extension(tmp.path(), "dev").unwrap();

        let result = verify_extension(tmp.path()).unwrap();
        assert!(result.is_some());
        let info = result.unwrap();
        assert!(info.verified, "Signature should be valid for unmodified extension");
    }

    #[test]
    fn test_verify_detects_tampering() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());

        sign_extension(tmp.path(), "dev").unwrap();

        // Tamper with a file after signing
        fs::write(tmp.path().join("dist/index.js"), "alert('hacked');").unwrap();

        let result = verify_extension(tmp.path()).unwrap();
        assert!(result.is_some());
        let info = result.unwrap();
        assert!(!info.verified, "Signature should be invalid after tampering");
    }

    #[test]
    fn test_verify_unsigned_extension() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());

        let result = verify_extension(tmp.path()).unwrap();
        assert!(result.is_none(), "Unsigned extension should return None");
    }

    #[test]
    fn test_verify_extension_integrity_signed_valid() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());
        sign_extension(tmp.path(), "dev").unwrap();

        let ok = verify_extension_integrity(tmp.path(), "test-ext");
        assert!(ok, "Valid signed extension should pass integrity check");
    }

    #[test]
    fn test_verify_extension_integrity_signed_tampered() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());
        sign_extension(tmp.path(), "dev").unwrap();

        fs::write(tmp.path().join("dist/index.js"), "alert('bad');").unwrap();

        let ok = verify_extension_integrity(tmp.path(), "test-ext");
        assert!(!ok, "Tampered extension should fail integrity check");
    }

    #[test]
    fn test_verify_extension_integrity_unsigned() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());

        let ok = verify_extension_integrity(tmp.path(), "test-ext");
        assert!(!ok, "Unsigned extension should fail integrity check");
    }

    #[test]
    fn test_sign_then_resign_updates_sig() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());

        let info1 = sign_extension(tmp.path(), "signer-a").unwrap();

        // Modify, then re-sign with a different signer
        fs::write(tmp.path().join("dist/index.js"), "console.log('v2');").unwrap();
        let info2 = sign_extension(tmp.path(), "signer-b").unwrap();

        assert_ne!(info1.hash, info2.hash, "Hash should change after modification");
        assert_eq!(info2.signer, "signer-b");

        // The new signature should verify
        let result = verify_extension(tmp.path()).unwrap().unwrap();
        assert!(result.verified);
    }

    #[test]
    fn test_hash_empty_directory() {
        let tmp = tempdir().unwrap();
        // Empty directory should produce a valid (though degenerate) hash
        let hash = hash_extension_contents(tmp.path()).unwrap();
        assert_eq!(hash.len(), 64, "Should still produce a valid SHA-256 hex digest");
    }

    #[test]
    fn test_sig_file_is_valid_json() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());
        sign_extension(tmp.path(), "dev").unwrap();

        let content = fs::read_to_string(tmp.path().join(".sig")).unwrap();
        let parsed: SignatureInfo = serde_json::from_str(&content).unwrap();
        assert_eq!(parsed.signer, "dev");
    }

    #[test]
    fn sign_bundled_extensions() {
        let extensions_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("data/extensions");
        if !extensions_dir.exists() {
            return; // Skip if not in the repo
        }
        for entry in fs::read_dir(&extensions_dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if path.is_dir() && path.join("package.json").exists() {
                let ext_name = path.file_name().unwrap().to_string_lossy().to_string();
                sign_extension(&path, "Xplorer Team").unwrap();
                let info = verify_extension(&path).unwrap().unwrap();
                assert!(info.verified, "Bundled extension '{}' should verify after signing", ext_name);
            }
        }
    }

    #[test]
    fn test_verify_with_corrupt_sig_file() {
        let tmp = tempdir().unwrap();
        create_test_extension(tmp.path());

        // Write garbage as .sig
        fs::write(tmp.path().join(".sig"), "not valid json!!!").unwrap();

        let result = verify_extension(tmp.path());
        assert!(result.is_err(), "Corrupt .sig file should return an error");
    }
}
