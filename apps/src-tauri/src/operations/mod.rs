pub mod accelerated_ops;
pub mod agent_ops;
pub mod analytics_ops;
pub mod comparison_ops;
pub mod compression;
pub mod database_ops;
pub mod directory_ops;
pub mod docker_ops;
pub mod encryption_ops;
pub mod file_associations_ops;
pub mod file_ops;
pub mod folder_ops;
pub mod image_ops;
pub mod metadata_ops;
pub mod progress;
pub mod properties_ops;
pub mod secure_delete_ops;
pub mod shell_integration_ops;
pub mod system_ops;
pub mod trash_ops;
pub mod types;
pub mod undo_redo;

pub use accelerated_ops::*;
pub use agent_ops::*;
pub use analytics_ops::*;
pub use comparison_ops::*;
pub use compression::*;
pub use directory_ops::*;
pub use encryption_ops::*;
pub use file_associations_ops::*;
pub use file_ops::*;
pub use folder_ops::FolderSizeInfo;
pub use image_ops::*;
pub use metadata_ops::*;
pub use progress::*;
pub use properties_ops::*;
pub use secure_delete_ops::*;
pub use shell_integration_ops::*;
pub use system_ops::*;
pub use trash_ops::*;
pub use types::*;
// Note: undo_redo items are accessed directly via operations::undo_redo::*
// in main.rs, so no glob re-export is needed here.

// ─── Shared helpers ─────────────────────────────────────────────────────────

use std::path::{Component, Path};

/// Check whether a file is hidden (dot-prefix or Windows hidden attribute).
pub(crate) fn is_hidden_file(path: &Path) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;

        if let Some(name) = path.file_name() {
            if name.to_string_lossy().starts_with('.') {
                return true;
            }
        }

        // Check Windows hidden attribute
        if let Ok(metadata) = std::fs::metadata(path) {
            const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
            return metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0;
        }

        false
    }

    #[cfg(not(windows))]
    {
        path.file_name()
            .map(|name| name.to_string_lossy().starts_with('.'))
            .unwrap_or(false)
    }
}

// ─── File path validation ───────────────────────────────────────────────────

/// Normalize a path by resolving `.` and `..` components without requiring the
/// path to exist on disk.
fn normalize_path_for_validation(path: &str) -> std::path::PathBuf {
    let p = Path::new(path);
    let mut components: Vec<Component> = Vec::new();
    for component in p.components() {
        match component {
            Component::ParentDir => {
                components.pop();
            }
            Component::CurDir => {}
            c => components.push(c),
        }
    }
    components.iter().collect()
}

/// Validate that a file path does not target critical system directories.
///
/// This is a lighter-weight check than the agent path validation -- it blocks
/// obvious system directories and null-byte injection but does NOT block
/// normal user directories such as Desktop, Documents, or Downloads.
pub fn validate_file_path(path: &str) -> Result<(), String> {
    // Reject null bytes
    if path.contains('\0') {
        return Err("Access denied: path contains null bytes".to_string());
    }

    // Fast path: skip expensive canonicalize when path has no traversal components.
    // Only call canonicalize when the path contains `..`, `./`, or similar.
    let needs_canonicalize = path.contains("..")
        || path.contains("./")
        || path.contains(".\\");
    let canonical = if needs_canonicalize {
        std::fs::canonicalize(path).unwrap_or_else(|_| normalize_path_for_validation(path))
    } else {
        normalize_path_for_validation(path)
    };
    let path_lower = canonical.to_string_lossy().to_lowercase();
    // Also normalize separators to forward slashes for uniform matching
    let mut path_normalized = path_lower.replace('\\', "/");
    // Strip Windows extended-length path prefix (\\?\) that canonicalize adds
    if path_normalized.starts_with("//?/") {
        path_normalized = path_normalized[4..].to_string();
    }

    // --- Windows-specific blocked directories ---
    #[cfg(target_os = "windows")]
    {
        let blocked_prefixes = ["c:/windows", "c:/program files", "c:/program files (x86)"];
        for prefix in &blocked_prefixes {
            if path_normalized.starts_with(prefix) {
                return Err(format!(
                    "Access denied: path '{}' is in a protected system directory",
                    path
                ));
            }
        }
    }

    // --- Unix-specific blocked directories ---
    #[cfg(not(target_os = "windows"))]
    {
        let blocked_prefixes = ["/etc", "/usr", "/bin", "/sbin", "/boot", "/private/etc"];
        for prefix in &blocked_prefixes {
            if path_normalized == *prefix || path_normalized.starts_with(&format!("{}/", prefix)) {
                return Err(format!(
                    "Access denied: path '{}' is in a protected system directory",
                    path
                ));
            }
        }
        // Also check the original (non-canonicalized) path for symlinks like /etc -> /private/etc
        let orig_lower = path.to_lowercase().replace('\\', "/");
        let orig_blocked = ["/etc", "/usr", "/bin", "/sbin", "/boot"];
        for prefix in &orig_blocked {
            if orig_lower == *prefix || orig_lower.starts_with(&format!("{}/", prefix)) {
                return Err(format!(
                    "Access denied: path '{}' is in a protected system directory",
                    path
                ));
            }
        }
    }

    // --- Cross-platform: block sensitive user directories ---
    if let Some(home) = dirs::home_dir() {
        let mut home_str = home.to_string_lossy().to_lowercase().replace('\\', "/");
        if home_str.starts_with("//?/") {
            home_str = home_str[4..].to_string();
        }
        let sensitive_dirs = [".ssh", ".gnupg"];
        for dir in &sensitive_dirs {
            let blocked = format!("{}/{}", home_str, dir);
            if path_normalized.starts_with(&blocked) {
                return Err(format!(
                    "Access denied: path '{}' contains sensitive user data",
                    path
                ));
            }
        }
    }

    Ok(())
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_file_path_rejects_null_bytes() {
        let result = validate_file_path("file\0hidden");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("null bytes"));
    }

    #[test]
    fn test_validate_file_path_allows_temp_path() {
        let temp = tempfile::tempdir().unwrap();
        let result = validate_file_path(temp.path().to_str().unwrap());
        assert!(
            result.is_ok(),
            "temp path should be allowed: {:?}",
            result.err()
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_file_path_rejects_windows_dir() {
        let result = validate_file_path("C:\\Windows\\System32\\cmd.exe");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("protected system directory"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_file_path_rejects_program_files() {
        let result = validate_file_path("C:\\Program Files\\SomeApp\\app.exe");
        assert!(result.is_err());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_file_path_rejects_program_files_x86() {
        let result = validate_file_path("C:\\Program Files (x86)\\SomeApp\\app.exe");
        assert!(result.is_err());
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_validate_file_path_rejects_etc() {
        let result = validate_file_path("/etc/passwd");
        assert!(result.is_err());
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_validate_file_path_rejects_usr() {
        let result = validate_file_path("/usr/bin/ls");
        assert!(result.is_err());
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_validate_file_path_rejects_bin() {
        let result = validate_file_path("/bin/bash");
        assert!(result.is_err());
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_validate_file_path_rejects_sbin() {
        let result = validate_file_path("/sbin/init");
        assert!(result.is_err());
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_validate_file_path_rejects_boot() {
        let result = validate_file_path("/boot/vmlinuz");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_file_path_rejects_ssh_dir() {
        if let Some(home) = dirs::home_dir() {
            let ssh_path = home.join(".ssh").join("__nonexistent_test_key__");
            let result = validate_file_path(ssh_path.to_str().unwrap());
            assert!(result.is_err(), ".ssh should be rejected");
            assert!(result.unwrap_err().contains("sensitive user data"));
        }
    }

    #[test]
    fn test_validate_file_path_rejects_gnupg_dir() {
        if let Some(home) = dirs::home_dir() {
            let gnupg_path = home.join(".gnupg").join("__nonexistent_test_key__");
            let result = validate_file_path(gnupg_path.to_str().unwrap());
            assert!(result.is_err(), ".gnupg should be rejected");
        }
    }

    #[test]
    fn test_validate_file_path_allows_normal_user_dirs() {
        if let Some(home) = dirs::home_dir() {
            // These should NOT be blocked
            for subdir in &["Desktop", "Documents", "Downloads"] {
                let path = home.join(subdir);
                let result = validate_file_path(path.to_str().unwrap());
                // This should be Ok (allowed) -- the dir may not exist but validation
                // should not block it
                assert!(
                    result.is_ok(),
                    "{} should be allowed, got: {:?}",
                    subdir,
                    result.err()
                );
            }
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_file_path_traversal_to_windows() {
        // A path that tries to escape via ../ to reach C:\Windows
        let result = validate_file_path("C:\\Users\\someone\\..\\..\\Windows\\System32\\cmd.exe");
        assert!(
            result.is_err(),
            "traversal to Windows dir should be blocked"
        );
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_validate_file_path_traversal_to_etc() {
        let result = validate_file_path("/home/user/../../etc/passwd");
        assert!(result.is_err(), "traversal to /etc should be blocked");
    }
}
