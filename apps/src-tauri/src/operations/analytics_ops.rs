use crate::operations::validate_file_path;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tauri::{command, AppHandle, Emitter};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeDistribution {
    pub extension: String,
    pub count: u64,
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LargeFile {
    pub path: String,
    pub name: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SizeCategory {
    pub label: String,
    pub count: u64,
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageAnalytics {
    pub total_size: u64,
    pub used_size: u64,
    pub free_size: u64,
    pub file_count: u64,
    pub dir_count: u64,
    pub file_type_distribution: Vec<TypeDistribution>,
    pub largest_files: Vec<LargeFile>,
    pub size_categories: Vec<SizeCategory>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageAnalysisProgress {
    pub files_processed: u64,
    pub dirs_processed: u64,
    pub current_path: String,
    pub bytes_processed: u64,
}

/// Determine which size category a file belongs to
fn size_category_index(size: u64) -> usize {
    if size < 1024 {
        0 // Tiny <1KB
    } else if size < 100 * 1024 {
        1 // Small 1-100KB
    } else if size < 10 * 1024 * 1024 {
        2 // Medium 100KB-10MB
    } else if size < 100 * 1024 * 1024 {
        3 // Large 10-100MB
    } else {
        4 // Huge >100MB
    }
}

const SIZE_CATEGORY_LABELS: &[&str] = &[
    "Tiny (<1 KB)",
    "Small (1-100 KB)",
    "Medium (100 KB - 10 MB)",
    "Large (10-100 MB)",
    "Huge (>100 MB)",
];

/// Try to get disk-level total/free space for the volume containing `path`.
/// Returns (total_bytes, free_bytes) or None if unavailable.
#[cfg(windows)]
pub(crate) fn get_disk_space(path: &Path) -> Option<(u64, u64)> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    extern "system" {
        fn GetDiskFreeSpaceExW(
            lpDirectoryName: *const u16,
            lpFreeBytesAvailableToCaller: *mut u64,
            lpTotalNumberOfBytes: *mut u64,
            lpTotalNumberOfFreeBytes: *mut u64,
        ) -> i32;
    }

    // We need the root of the volume, e.g. "C:\"
    let path_str = path.to_string_lossy();
    let root: String = if path_str.len() >= 3 && path_str.as_bytes()[1] == b':' {
        format!("{}\\", &path_str[..2])
    } else {
        return None;
    };

    let wide: Vec<u16> = OsStr::new(&root)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut free_bytes_available: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut total_free_bytes: u64 = 0;

    let ok = unsafe {
        GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut free_bytes_available,
            &mut total_bytes,
            &mut total_free_bytes,
        )
    };

    if ok != 0 {
        Some((total_bytes, total_free_bytes))
    } else {
        None
    }
}

#[cfg(not(windows))]
pub(crate) fn get_disk_space(_path: &Path) -> Option<(u64, u64)> {
    // On Unix-like systems we could use statvfs, but for simplicity
    // we return None and fall back to directory-only metrics.
    None
}

#[command]
pub async fn analyze_storage(
    app_handle: AppHandle,
    path: String,
) -> Result<StorageAnalytics, String> {
    validate_file_path(&path)?;
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    // Run the heavy work on a blocking thread so we don't block the async runtime.
    let analytics = tokio::task::spawn_blocking(move || {
        let mut file_count: u64 = 0;
        let mut dir_count: u64 = 0;
        let mut total_file_size: u64 = 0;

        // extension -> (count, total_size)
        let mut ext_map: HashMap<String, (u64, u64)> = HashMap::new();

        // Size categories: [Tiny, Small, Medium, Large, Huge] -> (count, total_size)
        let mut size_cats: [(u64, u64); 5] = [(0, 0); 5];

        // Min-heap-style: keep track of the 20 largest files.
        // We'll collect all and sort at the end (simpler, still fast).
        let mut large_files: Vec<LargeFile> = Vec::new();
        let large_files_limit: usize = 20;

        let mut files_processed: u64 = 0;
        let mut last_emit: std::time::Instant = std::time::Instant::now();

        let walker = WalkDir::new(&path).follow_links(false).into_iter();

        for entry_result in walker {
            let entry = match entry_result {
                Ok(e) => e,
                Err(_) => continue, // skip permission-denied etc.
            };

            let ft = entry.file_type();

            if ft.is_symlink() {
                continue;
            }

            if ft.is_dir() {
                dir_count += 1;
                continue;
            }

            // It's a file
            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };

            let size = metadata.len();
            file_count += 1;
            total_file_size += size;
            files_processed += 1;

            // Extension distribution
            let ext = entry
                .path()
                .extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_else(|| "(no ext)".to_string());

            let entry_ext = ext_map.entry(ext).or_insert((0, 0));
            entry_ext.0 += 1;
            entry_ext.1 += size;

            // Size category
            let cat_idx = size_category_index(size);
            size_cats[cat_idx].0 += 1;
            size_cats[cat_idx].1 += size;

            // Large files tracking
            let file_path_str = entry.path().to_string_lossy().to_string();
            let file_name = entry.file_name().to_string_lossy().to_string();

            if large_files.len() < large_files_limit {
                large_files.push(LargeFile {
                    path: file_path_str,
                    name: file_name,
                    size,
                });
                if large_files.len() == large_files_limit {
                    large_files.sort_by(|a, b| b.size.cmp(&a.size));
                }
            } else if let Some(last_file) = large_files.last() {
                if size > last_file.size {
                    if let Some(last) = large_files.last_mut() {
                        last.path = file_path_str;
                        last.name = file_name;
                        last.size = size;
                    }
                    large_files.sort_by(|a, b| b.size.cmp(&a.size));
                }
            }

            // Emit progress every 200ms
            if last_emit.elapsed() >= std::time::Duration::from_millis(200) {
                let _ = app_handle.emit(
                    "storage-analysis-progress",
                    StorageAnalysisProgress {
                        files_processed,
                        dirs_processed: dir_count,
                        current_path: entry.path().to_string_lossy().to_string(),
                        bytes_processed: total_file_size,
                    },
                );
                last_emit = std::time::Instant::now();
            }
        }

        // Sort large files descending by size
        large_files.sort_by(|a, b| b.size.cmp(&a.size));

        // Build file type distribution sorted by total_size descending
        let mut file_type_distribution: Vec<TypeDistribution> = ext_map
            .into_iter()
            .map(|(extension, (count, total_size))| TypeDistribution {
                extension,
                count,
                total_size,
            })
            .collect();
        file_type_distribution.sort_by(|a, b| b.total_size.cmp(&a.total_size));

        // Build size categories
        let size_categories: Vec<SizeCategory> = SIZE_CATEGORY_LABELS
            .iter()
            .enumerate()
            .map(|(i, label)| SizeCategory {
                label: label.to_string(),
                count: size_cats[i].0,
                total_size: size_cats[i].1,
            })
            .collect();

        // Get disk-level space info
        let root_path = Path::new(&path);
        let (disk_total, disk_free) = get_disk_space(root_path).unwrap_or((0, 0));
        let disk_used = disk_total.saturating_sub(disk_free);

        StorageAnalytics {
            total_size: if disk_total > 0 {
                disk_total
            } else {
                total_file_size
            },
            used_size: if disk_total > 0 {
                disk_used
            } else {
                total_file_size
            },
            free_size: disk_free,
            file_count,
            dir_count,
            file_type_distribution,
            largest_files: large_files,
            size_categories,
        }
    })
    .await
    .map_err(|e| format!("Analysis task failed: {}", e))?;

    Ok(analytics)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ─── size_category_index tests ───────────────────────────────────────

    #[test]
    fn test_size_category_tiny() {
        // 0 bytes is Tiny
        assert_eq!(size_category_index(0), 0);
        // 1 byte is Tiny
        assert_eq!(size_category_index(1), 0);
        // 500 bytes is Tiny
        assert_eq!(size_category_index(500), 0);
        // 1023 bytes is still Tiny (boundary)
        assert_eq!(size_category_index(1023), 0);
    }

    #[test]
    fn test_size_category_small() {
        // 1024 bytes (1KB) is Small
        assert_eq!(size_category_index(1024), 1);
        // 50KB is Small
        assert_eq!(size_category_index(50 * 1024), 1);
        // Just under 100KB is still Small
        assert_eq!(size_category_index(100 * 1024 - 1), 1);
    }

    #[test]
    fn test_size_category_medium() {
        // Exactly 100KB is Medium
        assert_eq!(size_category_index(100 * 1024), 2);
        // 1MB is Medium
        assert_eq!(size_category_index(1024 * 1024), 2);
        // 5MB is Medium
        assert_eq!(size_category_index(5 * 1024 * 1024), 2);
        // Just under 10MB is still Medium
        assert_eq!(size_category_index(10 * 1024 * 1024 - 1), 2);
    }

    #[test]
    fn test_size_category_large() {
        // Exactly 10MB is Large
        assert_eq!(size_category_index(10 * 1024 * 1024), 3);
        // 50MB is Large
        assert_eq!(size_category_index(50 * 1024 * 1024), 3);
        // Just under 100MB is still Large
        assert_eq!(size_category_index(100 * 1024 * 1024 - 1), 3);
    }

    #[test]
    fn test_size_category_huge() {
        // Exactly 100MB is Huge
        assert_eq!(size_category_index(100 * 1024 * 1024), 4);
        // 1GB is Huge
        assert_eq!(size_category_index(1024 * 1024 * 1024), 4);
        // 10GB is Huge
        assert_eq!(size_category_index(10 * 1024 * 1024 * 1024), 4);
        // u64::MAX is Huge
        assert_eq!(size_category_index(u64::MAX), 4);
    }

    #[test]
    fn test_size_category_boundaries() {
        // Test exact boundary transitions
        assert_eq!(size_category_index(1023), 0); // Tiny
        assert_eq!(size_category_index(1024), 1); // Small (exactly 1KB)

        assert_eq!(size_category_index(100 * 1024 - 1), 1); // Small
        assert_eq!(size_category_index(100 * 1024), 2); // Medium (exactly 100KB)

        assert_eq!(size_category_index(10 * 1024 * 1024 - 1), 2); // Medium
        assert_eq!(size_category_index(10 * 1024 * 1024), 3); // Large (exactly 10MB)

        assert_eq!(size_category_index(100 * 1024 * 1024 - 1), 3); // Large
        assert_eq!(size_category_index(100 * 1024 * 1024), 4); // Huge (exactly 100MB)
    }

    #[test]
    fn test_size_category_index_returns_valid_index() {
        // Ensure the returned index is always valid for the SIZE_CATEGORY_LABELS array
        let test_sizes: Vec<u64> = vec![
            0,
            1,
            100,
            1023,
            1024,
            10_000,
            102_399,
            102_400,
            1_000_000,
            10_485_759,
            10_485_760,
            50_000_000,
            104_857_599,
            104_857_600,
            1_000_000_000,
            u64::MAX,
        ];
        for size in test_sizes {
            let idx = size_category_index(size);
            assert!(
                idx < SIZE_CATEGORY_LABELS.len(),
                "size_category_index({}) returned {} which is out of bounds for SIZE_CATEGORY_LABELS (len {})",
                size, idx, SIZE_CATEGORY_LABELS.len()
            );
        }
    }

    // ─── SIZE_CATEGORY_LABELS tests ──────────────────────────────────────

    #[test]
    fn test_size_category_labels_count() {
        assert_eq!(
            SIZE_CATEGORY_LABELS.len(),
            5,
            "should have exactly 5 size categories"
        );
    }

    #[test]
    fn test_size_category_labels_not_empty() {
        for (i, label) in SIZE_CATEGORY_LABELS.iter().enumerate() {
            assert!(
                !label.is_empty(),
                "label at index {} should not be empty",
                i
            );
        }
    }

    // ─── Struct serialization/deserialization tests ──────────────────────

    #[test]
    fn test_type_distribution_serialization() {
        let td = TypeDistribution {
            extension: "rs".to_string(),
            count: 42,
            total_size: 123456,
        };
        let json = serde_json::to_string(&td).unwrap();
        let deserialized: TypeDistribution = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.extension, "rs");
        assert_eq!(deserialized.count, 42);
        assert_eq!(deserialized.total_size, 123456);
    }

    #[test]
    fn test_large_file_serialization() {
        let lf = LargeFile {
            path: "/home/user/big.bin".to_string(),
            name: "big.bin".to_string(),
            size: 1_073_741_824, // 1GB
        };
        let json = serde_json::to_string(&lf).unwrap();
        let deserialized: LargeFile = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.path, "/home/user/big.bin");
        assert_eq!(deserialized.name, "big.bin");
        assert_eq!(deserialized.size, 1_073_741_824);
    }

    #[test]
    fn test_size_category_serialization() {
        let sc = SizeCategory {
            label: "Tiny (<1 KB)".to_string(),
            count: 100,
            total_size: 50_000,
        };
        let json = serde_json::to_string(&sc).unwrap();
        let deserialized: SizeCategory = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.label, "Tiny (<1 KB)");
        assert_eq!(deserialized.count, 100);
        assert_eq!(deserialized.total_size, 50_000);
    }

    #[test]
    fn test_storage_analytics_serialization() {
        let analytics = StorageAnalytics {
            total_size: 1_000_000_000,
            used_size: 750_000_000,
            free_size: 250_000_000,
            file_count: 5000,
            dir_count: 300,
            file_type_distribution: vec![TypeDistribution {
                extension: "txt".to_string(),
                count: 100,
                total_size: 500_000,
            }],
            largest_files: vec![LargeFile {
                path: "/big.bin".to_string(),
                name: "big.bin".to_string(),
                size: 100_000_000,
            }],
            size_categories: vec![SizeCategory {
                label: "Tiny (<1 KB)".to_string(),
                count: 50,
                total_size: 25_000,
            }],
        };
        let json = serde_json::to_string(&analytics).unwrap();
        let deserialized: StorageAnalytics = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.total_size, 1_000_000_000);
        assert_eq!(deserialized.used_size, 750_000_000);
        assert_eq!(deserialized.free_size, 250_000_000);
        assert_eq!(deserialized.file_count, 5000);
        assert_eq!(deserialized.dir_count, 300);
        assert_eq!(deserialized.file_type_distribution.len(), 1);
        assert_eq!(deserialized.largest_files.len(), 1);
        assert_eq!(deserialized.size_categories.len(), 1);
    }

    #[test]
    fn test_storage_analysis_progress_serialization() {
        let progress = StorageAnalysisProgress {
            files_processed: 1234,
            dirs_processed: 56,
            current_path: "/home/user/documents/file.txt".to_string(),
            bytes_processed: 987_654_321,
        };
        let json = serde_json::to_string(&progress).unwrap();
        let deserialized: StorageAnalysisProgress = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.files_processed, 1234);
        assert_eq!(deserialized.dirs_processed, 56);
        assert_eq!(deserialized.current_path, "/home/user/documents/file.txt");
        assert_eq!(deserialized.bytes_processed, 987_654_321);
    }

    #[test]
    fn test_storage_analytics_empty_collections() {
        let analytics = StorageAnalytics {
            total_size: 0,
            used_size: 0,
            free_size: 0,
            file_count: 0,
            dir_count: 0,
            file_type_distribution: vec![],
            largest_files: vec![],
            size_categories: vec![],
        };
        let json = serde_json::to_string(&analytics).unwrap();
        let deserialized: StorageAnalytics = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.file_count, 0);
        assert!(deserialized.file_type_distribution.is_empty());
        assert!(deserialized.largest_files.is_empty());
        assert!(deserialized.size_categories.is_empty());
    }

    // ─── Clone trait tests ───────────────────────────────────────────────

    #[test]
    fn test_type_distribution_clone() {
        let original = TypeDistribution {
            extension: "py".to_string(),
            count: 10,
            total_size: 5000,
        };
        let cloned = original.clone();
        assert_eq!(cloned.extension, "py");
        assert_eq!(cloned.count, 10);
        assert_eq!(cloned.total_size, 5000);
    }

    #[test]
    fn test_large_file_clone() {
        let original = LargeFile {
            path: "/path/to/file".to_string(),
            name: "file".to_string(),
            size: 999,
        };
        let cloned = original.clone();
        assert_eq!(cloned.path, original.path);
        assert_eq!(cloned.name, original.name);
        assert_eq!(cloned.size, original.size);
    }

    // ─── get_disk_space tests ────────────────────────────────────────────

    #[cfg(windows)]
    #[test]
    fn test_get_disk_space_for_c_drive() {
        let result = get_disk_space(Path::new("C:\\"));
        // On Windows, C:\ should always return Some
        assert!(result.is_some(), "C:\\ should return disk space info");
        let (total, free) = result.unwrap();
        assert!(total > 0, "total disk space should be positive");
        assert!(free <= total, "free space should not exceed total");
    }

    #[cfg(windows)]
    #[test]
    fn test_get_disk_space_for_invalid_path() {
        // A UNC path or path without drive letter should return None
        let result = get_disk_space(Path::new("/no/drive/letter"));
        assert!(
            result.is_none(),
            "path without drive letter should return None"
        );
    }
}
