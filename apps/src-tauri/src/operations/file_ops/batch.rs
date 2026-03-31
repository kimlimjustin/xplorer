use crate::operations::validate_file_path;
use chrono::Local;
use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::sync::OnceLock;
use tauri::command;
use walkdir::WalkDir;

use super::{file_info_from_path, generate_rename_destination, ConflictInfo};

// ─── Directory Sizes (Disk Treemap) ──────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DirectorySizeEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub children_count: u64,
}

#[command]
pub async fn get_directory_sizes(dir_path: String) -> Result<Vec<DirectorySizeEntry>, String> {
    let root = Path::new(&dir_path);
    if !root.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path));
    }

    let entries =
        fs::read_dir(root).map_err(|e| format!("Failed to read directory {}: {}", dir_path, e))?;

    let mut results: Vec<DirectorySizeEntry> = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = path.is_dir();

        if is_dir {
            let mut total_size: u64 = 0;
            let mut children_count: u64 = 0;
            for walk_entry in WalkDir::new(&path)
                .min_depth(1)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                if walk_entry.file_type().is_file() {
                    if let Ok(meta) = walk_entry.metadata() {
                        total_size += meta.len();
                    }
                }
                children_count += 1;
            }
            results.push(DirectorySizeEntry {
                name,
                path: path.to_string_lossy().to_string(),
                size: total_size,
                is_dir: true,
                children_count,
            });
        } else {
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            results.push(DirectorySizeEntry {
                name,
                path: path.to_string_lossy().to_string(),
                size,
                is_dir: false,
                children_count: 0,
            });
        }
    }

    results.sort_by(|a, b| b.size.cmp(&a.size));
    Ok(results)
}

// ─── Bulk Rename ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BulkRenameResult {
    pub original_path: String,
    pub new_path: String,
    pub original_name: String,
    pub new_name: String,
    pub success: bool,
    pub error: Option<String>,
}

#[command]
pub async fn bulk_rename(
    files: Vec<String>,
    pattern: String,
    replacement: String,
    preview_only: bool,
) -> Result<Vec<BulkRenameResult>, String> {
    // Validate all file paths before proceeding
    for file_path in &files {
        validate_file_path(file_path)?;
    }
    if pattern.len() > 200 {
        return Err("Regex pattern too long (max 200 characters)".to_string());
    }
    // Reject patterns with nested quantifiers that could cause catastrophic backtracking
    static NESTED_QUANTIFIER_RE: OnceLock<regex::Regex> = OnceLock::new();
    let nested_re = NESTED_QUANTIFIER_RE.get_or_init(|| {
        regex::Regex::new(r"(\([^)]*[+*?][^)]*\)|[+*?]\{)[+*?]")
            .expect("hardcoded nested-quantifier regex is valid")
    });
    if nested_re.is_match(&pattern) {
        return Err(
            "Regex pattern contains nested quantifiers which could cause excessive backtracking"
                .to_string(),
        );
    }
    let regex = RegexBuilder::new(&pattern)
        .size_limit(10_000) // 10KB compiled size limit to prevent ReDoS
        .build()
        .map_err(|e| format!("Invalid regex pattern: {}", e))?;
    let today = Local::now().format("%Y-%m-%d").to_string();

    // First pass: compute all new names and collect results
    let mut results: Vec<BulkRenameResult> = Vec::with_capacity(files.len());

    for (index, file_path_str) in files.iter().enumerate() {
        let file_path = Path::new(file_path_str);

        // Get parent directory and file name
        let parent = match file_path.parent() {
            Some(p) => p,
            None => {
                results.push(BulkRenameResult {
                    original_path: file_path_str.clone(),
                    new_path: file_path_str.clone(),
                    original_name: file_path_str.clone(),
                    new_name: file_path_str.clone(),
                    success: false,
                    error: Some("Cannot determine parent directory".to_string()),
                });
                continue;
            }
        };

        let original_name = match file_path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name.to_string(),
            None => {
                results.push(BulkRenameResult {
                    original_path: file_path_str.clone(),
                    new_path: file_path_str.clone(),
                    original_name: file_path_str.clone(),
                    new_name: file_path_str.clone(),
                    success: false,
                    error: Some("Cannot determine file name".to_string()),
                });
                continue;
            }
        };

        // Apply regex replacement to the filename
        let mut new_name = regex
            .replace_all(&original_name, replacement.as_str())
            .to_string();

        // Process special replacement tokens
        let seq_number = index + 1;
        new_name = new_name.replace("{n}", &seq_number.to_string());
        new_name = new_name.replace("{N}", &format!("{:03}", seq_number));
        new_name = new_name.replace("{date}", &today);

        let new_path = parent.join(&new_name);
        let new_path_str = new_path.to_string_lossy().to_string();

        results.push(BulkRenameResult {
            original_path: file_path_str.clone(),
            new_path: new_path_str,
            original_name,
            new_name,
            success: true, // will be updated below if errors occur
            error: None,
        });
    }

    // If preview only, return the computed results without renaming
    if preview_only {
        return Ok(results);
    }

    // Check for name collisions among new names
    let mut seen_new_paths: HashSet<String> = HashSet::new();
    for result in results.iter_mut() {
        if !result.success {
            continue;
        }
        let normalized = result.new_path.to_lowercase();
        if !seen_new_paths.insert(normalized) {
            result.success = false;
            result.error = Some(format!(
                "Name collision: '{}' would conflict with another renamed file",
                result.new_name
            ));
        }
    }

    // Also check if new name collides with an existing file that is NOT in our rename set
    let original_paths: HashSet<String> = files.iter().cloned().collect();
    for result in results.iter_mut() {
        if !result.success {
            continue;
        }
        // Skip collision check if the new path is the same as the original
        if result.new_path == result.original_path {
            continue;
        }
        let new_path = Path::new(&result.new_path);
        if new_path.exists() && !original_paths.contains(&result.new_path) {
            result.success = false;
            result.error = Some(format!("File already exists: '{}'", result.new_name));
        }
    }

    // Perform the actual renames
    for result in results.iter_mut() {
        if !result.success {
            continue;
        }
        // Skip if name didn't change
        if result.original_path == result.new_path {
            continue;
        }
        match fs::rename(&result.original_path, &result.new_path) {
            Ok(_) => {
                result.success = true;
            }
            Err(e) => {
                result.success = false;
                result.error = Some(format!("Rename failed: {}", e));
            }
        }
    }

    Ok(results)
}

// ─── Conflict Detection ──────────────────────────────────────────────────────

#[command]
pub async fn check_conflicts(
    sources: Vec<String>,
    destination_dir: String,
) -> Result<Vec<ConflictInfo>, String> {
    let dest_dir = Path::new(&destination_dir);
    if !dest_dir.exists() {
        return Err(format!(
            "Destination directory does not exist: {}",
            destination_dir
        ));
    }
    if !dest_dir.is_dir() {
        return Err(format!(
            "Destination is not a directory: {}",
            destination_dir
        ));
    }

    let mut conflicts: Vec<ConflictInfo> = Vec::new();

    for src_str in &sources {
        let src = Path::new(src_str);
        if !src.exists() {
            continue;
        }
        let file_name = match src.file_name() {
            Some(n) => n,
            None => continue,
        };
        let dest_path = dest_dir.join(file_name);
        if dest_path.exists() {
            let source_info = file_info_from_path(src)?;
            let dest_info = file_info_from_path(&dest_path)?;
            conflicts.push(ConflictInfo {
                source: source_info,
                destination: dest_info,
            });
        }
    }

    Ok(conflicts)
}

#[command]
pub async fn get_rename_destination(
    destination_dir: String,
    file_name: String,
) -> Result<String, String> {
    let dir = Path::new(&destination_dir);
    if !dir.exists() {
        return Err(format!("Directory does not exist: {}", destination_dir));
    }
    generate_rename_destination(dir, &file_name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_get_directory_sizes() {
        let temp = tempdir().expect("Failed to create temp dir");

        // Create a subdirectory with files
        let sub = temp.path().join("subdir");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("a.txt"), "hello").unwrap();
        fs::write(sub.join("b.txt"), "world!").unwrap();

        // Create a file at root
        fs::write(temp.path().join("root.txt"), "root content").unwrap();

        let result = get_directory_sizes(temp.path().to_string_lossy().to_string()).await;

        assert!(result.is_ok(), "get_directory_sizes should succeed");
        let entries = result.unwrap();
        assert!(!entries.is_empty(), "should return entries");

        // Verify we have both the subdirectory and the root file
        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"subdir"), "should contain subdir");
        assert!(names.contains(&"root.txt"), "should contain root.txt");

        // Verify the subdir entry is marked as a directory
        let subdir_entry = entries.iter().find(|e| e.name == "subdir").unwrap();
        assert!(subdir_entry.is_dir);
        assert!(subdir_entry.size > 0, "subdir should have non-zero size");
        assert_eq!(
            subdir_entry.children_count, 2,
            "subdir should have 2 children"
        );
    }

    #[tokio::test]
    async fn test_get_directory_sizes_nonexistent_returns_error() {
        let result = get_directory_sizes("/nonexistent/directory/path".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_bulk_rename_preview() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file1 = temp.path().join("img_001.png");
        let file2 = temp.path().join("img_002.png");

        File::create(&file1).unwrap();
        File::create(&file2).unwrap();

        let result = bulk_rename(
            vec![
                file1.to_string_lossy().to_string(),
                file2.to_string_lossy().to_string(),
            ],
            "img_".to_string(),
            "photo_".to_string(),
            true, // preview_only
        )
        .await;

        assert!(result.is_ok(), "bulk_rename preview should succeed");
        let results = result.unwrap();
        assert_eq!(results.len(), 2);

        // In preview mode, original files should still exist
        assert!(file1.exists(), "file1 should still exist in preview mode");
        assert!(file2.exists(), "file2 should still exist in preview mode");

        // New names should be correct
        assert!(results[0].new_name.starts_with("photo_"));
        assert!(results[1].new_name.starts_with("photo_"));
    }

    #[tokio::test]
    async fn test_bulk_rename_actual() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file1 = temp.path().join("old_a.txt");
        let file2 = temp.path().join("old_b.txt");

        File::create(&file1).unwrap();
        File::create(&file2).unwrap();

        let result = bulk_rename(
            vec![
                file1.to_string_lossy().to_string(),
                file2.to_string_lossy().to_string(),
            ],
            "old_".to_string(),
            "new_".to_string(),
            false, // actually rename
        )
        .await;

        assert!(result.is_ok(), "bulk_rename should succeed");
        let results = result.unwrap();
        assert_eq!(results.len(), 2);

        // Original files should be gone
        assert!(!file1.exists(), "old file1 should be renamed");
        assert!(!file2.exists(), "old file2 should be renamed");

        // New files should exist
        assert!(temp.path().join("new_a.txt").exists());
        assert!(temp.path().join("new_b.txt").exists());
    }

    #[tokio::test]
    async fn test_bulk_rename_rejects_long_pattern() {
        let pattern = "a".repeat(201);
        let result = bulk_rename(
            vec!["somefile.txt".to_string()],
            pattern,
            "replacement".to_string(),
            true,
        )
        .await;

        assert!(
            result.is_err(),
            "pattern longer than 200 chars should be rejected"
        );
        assert!(result.unwrap_err().contains("too long"));
    }
}
