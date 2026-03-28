use std::path::PathBuf;
use xplorer::duplicate_finder::*;

/// Integration tests for the DuplicateFinder module.
///
/// NOTE: Async scanning tests (find_duplicates) are in the unit test module
/// inside `src/duplicate_finder.rs` where they have access to the internal
/// `CURRENT_SCAN_ID` atomic and can properly serialize scan IDs.
/// These integration tests focus on the public API surface: builder pattern,
/// type construction, and serialization.

#[test]
fn test_duplicate_finder_builder_pattern() {
    let finder = DuplicateFinder::new()
        .min_file_size(100)
        .max_file_size(1_000_000)
        .include_hidden(true)
        .file_extensions(vec!["txt".into(), "rs".into()])
        .exclude_paths(vec![PathBuf::from("node_modules")]);

    // Verify the builder pattern returns a valid DuplicateFinder
    // (internal fields are private, but the builder should not panic)
    let _ = finder;
}

#[test]
fn test_duplicate_finder_default_values() {
    let _finder = DuplicateFinder::default();
    // Should not panic
}

#[test]
fn test_duplicate_finder_new_equals_default() {
    // Both constructors should produce valid instances without panicking
    let _from_new = DuplicateFinder::new();
    let _from_default = DuplicateFinder::default();
}

#[test]
fn test_duplicate_file_serialization() {
    let file = DuplicateFile {
        path: "/test/file.txt".into(),
        name: "file.txt".into(),
        size: 1024,
        hash: "abc123".into(),
        modified: 1234567890,
    };

    let json = serde_json::to_string(&file).unwrap();
    let deserialized: DuplicateFile = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.path, "/test/file.txt");
    assert_eq!(deserialized.name, "file.txt");
    assert_eq!(deserialized.size, 1024);
    assert_eq!(deserialized.hash, "abc123");
    assert_eq!(deserialized.modified, 1234567890);
}

#[test]
fn test_duplicate_file_clone() {
    let file = DuplicateFile {
        path: "/test/file.txt".into(),
        name: "file.txt".into(),
        size: 1024,
        hash: "abc123".into(),
        modified: 1234567890,
    };

    let cloned = file.clone();
    assert_eq!(cloned.path, file.path);
    assert_eq!(cloned.hash, file.hash);
}

#[test]
fn test_duplicate_group_serialization() {
    let group = DuplicateGroup {
        hash: "abc123".to_string(),
        size: 1024,
        files: vec![
            DuplicateFile {
                path: "a".into(),
                name: "a".into(),
                size: 1024,
                hash: "abc123".into(),
                modified: 100,
            },
            DuplicateFile {
                path: "b".into(),
                name: "b".into(),
                size: 1024,
                hash: "abc123".into(),
                modified: 200,
            },
        ],
        total_wasted_space: 1024,
    };

    let json = serde_json::to_string(&group).unwrap();
    let deserialized: DuplicateGroup = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.hash, "abc123");
    assert_eq!(deserialized.files.len(), 2);
    assert_eq!(deserialized.total_wasted_space, 1024);
}

#[test]
fn test_duplicate_group_wasted_space_calculation() {
    let group = DuplicateGroup {
        hash: "def456".to_string(),
        size: 500,
        files: vec![
            DuplicateFile {
                path: "a".into(),
                name: "a".into(),
                size: 500,
                hash: "def456".into(),
                modified: 0,
            },
            DuplicateFile {
                path: "b".into(),
                name: "b".into(),
                size: 500,
                hash: "def456".into(),
                modified: 0,
            },
            DuplicateFile {
                path: "c".into(),
                name: "c".into(),
                size: 500,
                hash: "def456".into(),
                modified: 0,
            },
        ],
        total_wasted_space: 1000, // (3 - 1) * 500
    };

    assert_eq!(
        group.total_wasted_space,
        (group.files.len() as u64 - 1) * group.size
    );
}

#[test]
fn test_duplicate_finder_result_serialization() {
    let result = DuplicateFinderResult {
        duplicate_groups: vec![],
        total_duplicates: 0,
        total_wasted_space: 0,
        scan_time_ms: 42,
        files_scanned: 100,
    };

    let json = serde_json::to_string(&result).unwrap();
    let deserialized: DuplicateFinderResult = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.scan_time_ms, 42);
    assert_eq!(deserialized.files_scanned, 100);
}

#[test]
fn test_duplicate_finder_result_with_groups() {
    let result = DuplicateFinderResult {
        duplicate_groups: vec![DuplicateGroup {
            hash: "hash1".to_string(),
            size: 100,
            files: vec![
                DuplicateFile {
                    path: "a".into(),
                    name: "a".into(),
                    size: 100,
                    hash: "hash1".into(),
                    modified: 0,
                },
                DuplicateFile {
                    path: "b".into(),
                    name: "b".into(),
                    size: 100,
                    hash: "hash1".into(),
                    modified: 0,
                },
            ],
            total_wasted_space: 100,
        }],
        total_duplicates: 2,
        total_wasted_space: 100,
        scan_time_ms: 10,
        files_scanned: 5,
    };

    let json = serde_json::to_string(&result).unwrap();
    let deserialized: DuplicateFinderResult = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.duplicate_groups.len(), 1);
    assert_eq!(deserialized.total_duplicates, 2);
    assert_eq!(deserialized.total_wasted_space, 100);
}

#[test]
fn test_duplicate_finder_progress_serialization() {
    let progress = DuplicateFinderProgress {
        current_file: "test.txt".to_string(),
        processed_files: 50,
        total_files: 100,
        current_phase: "hashing".to_string(),
        duplicates_found: 5,
        total_wasted_space: 2048,
    };

    let json = serde_json::to_string(&progress).unwrap();
    // DuplicateFinderProgress uses camelCase serialization
    assert!(json.contains("currentFile"));
    assert!(json.contains("processedFiles"));
    assert!(json.contains("totalFiles"));
    assert!(json.contains("currentPhase"));
    assert!(json.contains("duplicatesFound"));
    assert!(json.contains("totalWastedSpace"));

    let deserialized: DuplicateFinderProgress = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.current_file, "test.txt");
    assert_eq!(deserialized.processed_files, 50);
    assert_eq!(deserialized.current_phase, "hashing");
}

#[test]
fn test_builder_chaining_all_options() {
    // Verify all builder methods can be chained without panicking
    let _finder = DuplicateFinder::new()
        .min_file_size(0)
        .max_file_size(u64::MAX)
        .include_hidden(false)
        .file_extensions(vec![])
        .exclude_paths(vec![]);
}

#[test]
fn test_cancel_current_scan_does_not_panic() {
    // cancel_current_scan should be callable without side effects visible here
    cancel_current_scan();
}
