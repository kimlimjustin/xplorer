use serde::{Deserialize, Serialize};
use std::time::{Instant, SystemTime};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    pub file_type: String,
    pub mime_type: Option<String>,
    /// Whether the file/directory is read-only (permissions).
    pub is_readonly: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FileProperties {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub created: u64,
    pub modified: u64,
    pub accessed: u64,
    pub readonly: bool,
    pub hidden: bool,
    pub file_type: String,
    pub mime_type: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DirectorySize {
    pub total_size: u64,
    pub file_count: usize,
    pub dir_count: usize,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TrashItem {
    pub name: String,
    pub original_path: String,
    pub deletion_date: u64,
    pub size: u64,
    pub is_dir: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FileSystemNode {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    pub content: Option<String>,
    pub children: Option<Vec<FileSystemNode>>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AgentProgress {
    pub current_path: String,
    pub processed_files: u32,
    pub processed_dirs: u32,
    pub total_size: u64,
    pub recursion_depth: u32,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OperationProgress {
    pub operation_id: String,
    pub operation_type: String,
    pub current_file: String,
    pub processed_count: u64,
    pub total_count: u64,
    pub bytes_processed: u64,
    pub total_bytes: u64,
    pub status: OperationStatus,
    pub error_message: Option<String>,
    pub progress_percentage: f64,
    pub estimated_remaining: Option<u64>, // seconds
    #[serde(skip)]
    pub start_time: Option<Instant>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum OperationStatus {
    Starting,
    InProgress,
    Completed,
    Failed,
    Cancelled,
    Paused,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileOperationProgress {
    pub operation_id: String,
    pub operation_type: String,
    pub source_path: String,
    pub destination_path: Option<String>,
    pub current_file: String,
    pub bytes_processed: u64,
    pub total_bytes: u64,
    pub files_processed: u64,
    pub total_files: u64,
    pub progress_percentage: f64,
    pub speed_bytes_per_second: f64,
    pub estimated_remaining_seconds: Option<u64>,
    pub status: OperationStatus,
    pub error_message: Option<String>,
    pub copy_strategy: Option<String>,
    pub hardware_acceleration: bool,
}

pub fn system_time_to_timestamp(time: SystemTime) -> u64 {
    time.duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    // ─── system_time_to_timestamp tests ──────────────────────────────────

    #[test]
    fn test_unix_epoch_returns_zero() {
        let timestamp = system_time_to_timestamp(SystemTime::UNIX_EPOCH);
        assert_eq!(timestamp, 0);
    }

    #[test]
    fn test_known_timestamp() {
        // 1 hour after epoch = 3600 seconds
        let time = SystemTime::UNIX_EPOCH + Duration::from_secs(3600);
        let timestamp = system_time_to_timestamp(time);
        assert_eq!(timestamp, 3600);
    }

    #[test]
    fn test_large_timestamp() {
        // 2024-01-01 00:00:00 UTC = 1704067200 seconds since epoch
        let secs: u64 = 1_704_067_200;
        let time = SystemTime::UNIX_EPOCH + Duration::from_secs(secs);
        let timestamp = system_time_to_timestamp(time);
        assert_eq!(timestamp, secs);
    }

    #[test]
    fn test_current_time_is_reasonable() {
        let now = SystemTime::now();
        let timestamp = system_time_to_timestamp(now);
        // Should be after 2020-01-01 (1577836800) and before 2040-01-01 (2208988800)
        assert!(
            timestamp > 1_577_836_800,
            "current timestamp {} should be after 2020",
            timestamp
        );
        assert!(
            timestamp < 2_208_988_800,
            "current timestamp {} should be before 2040",
            timestamp
        );
    }

    #[test]
    fn test_sub_second_precision_is_truncated() {
        // 100 seconds + 999 milliseconds should still be 100
        let time = SystemTime::UNIX_EPOCH + Duration::from_millis(100_999);
        let timestamp = system_time_to_timestamp(time);
        assert_eq!(timestamp, 100, "sub-second fractions should be truncated");
    }

    // ─── FileEntry serialization tests ───────────────────────────────────

    #[test]
    fn test_file_entry_serialization() {
        let entry = FileEntry {
            name: "test.txt".to_string(),
            path: "/home/user/test.txt".to_string(),
            is_dir: false,
            size: 1024,
            modified: 1_700_000_000,
            file_type: "file".to_string(),
            mime_type: Some("text/plain".to_string()),
            is_readonly: false,
        };
        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: FileEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "test.txt");
        assert_eq!(deserialized.path, "/home/user/test.txt");
        assert!(!deserialized.is_dir);
        assert_eq!(deserialized.size, 1024);
        assert_eq!(deserialized.modified, 1_700_000_000);
        assert_eq!(deserialized.file_type, "file");
        assert_eq!(deserialized.mime_type, Some("text/plain".to_string()));
    }

    #[test]
    fn test_file_entry_with_none_mime_type() {
        let entry = FileEntry {
            name: "binary".to_string(),
            path: "/binary".to_string(),
            is_dir: false,
            size: 0,
            modified: 0,
            file_type: "file".to_string(),
            mime_type: None,
            is_readonly: false,
        };
        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: FileEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.mime_type, None);
    }

    #[test]
    fn test_file_entry_directory() {
        let entry = FileEntry {
            name: "documents".to_string(),
            path: "/home/user/documents".to_string(),
            is_dir: true,
            size: 0,
            modified: 1_700_000_000,
            file_type: "directory".to_string(),
            mime_type: None,
            is_readonly: false,
        };
        assert!(entry.is_dir);
        assert_eq!(entry.file_type, "directory");
    }

    // ─── FileProperties serialization tests ──────────────────────────────

    #[test]
    fn test_file_properties_serialization() {
        let props = FileProperties {
            name: "report.pdf".to_string(),
            path: "/docs/report.pdf".to_string(),
            size: 2_048_000,
            is_dir: false,
            created: 1_690_000_000,
            modified: 1_700_000_000,
            accessed: 1_700_001_000,
            readonly: true,
            hidden: false,
            file_type: "file".to_string(),
            mime_type: Some("application/pdf".to_string()),
        };
        let json = serde_json::to_string(&props).unwrap();
        let deserialized: FileProperties = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "report.pdf");
        assert_eq!(deserialized.size, 2_048_000);
        assert!(deserialized.readonly);
        assert!(!deserialized.hidden);
        assert_eq!(deserialized.created, 1_690_000_000);
        assert_eq!(deserialized.modified, 1_700_000_000);
        assert_eq!(deserialized.accessed, 1_700_001_000);
    }

    // ─── DirectorySize tests ─────────────────────────────────────────────

    #[test]
    fn test_directory_size_serialization() {
        let ds = DirectorySize {
            total_size: 1_000_000,
            file_count: 42,
            dir_count: 5,
        };
        let json = serde_json::to_string(&ds).unwrap();
        let deserialized: DirectorySize = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.total_size, 1_000_000);
        assert_eq!(deserialized.file_count, 42);
        assert_eq!(deserialized.dir_count, 5);
    }

    // ─── OperationStatus tests ───────────────────────────────────────────

    #[test]
    fn test_operation_status_serialization_all_variants() {
        let variants = vec![
            OperationStatus::Starting,
            OperationStatus::InProgress,
            OperationStatus::Completed,
            OperationStatus::Failed,
            OperationStatus::Cancelled,
            OperationStatus::Paused,
        ];
        for status in variants {
            let json = serde_json::to_string(&status).unwrap();
            let deserialized: OperationStatus = serde_json::from_str(&json).unwrap();
            // Verify round-trip by re-serializing
            let json2 = serde_json::to_string(&deserialized).unwrap();
            assert_eq!(json, json2, "round-trip serialization should be stable");
        }
    }

    // ─── TrashItem tests ─────────────────────────────────────────────────

    #[test]
    fn test_trash_item_serialization() {
        let item = TrashItem {
            name: "deleted.txt".to_string(),
            original_path: "/home/user/deleted.txt".to_string(),
            deletion_date: 1_700_000_000,
            size: 512,
            is_dir: false,
        };
        let json = serde_json::to_string(&item).unwrap();
        let deserialized: TrashItem = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "deleted.txt");
        assert_eq!(deserialized.original_path, "/home/user/deleted.txt");
        assert_eq!(deserialized.deletion_date, 1_700_000_000);
        assert_eq!(deserialized.size, 512);
        assert!(!deserialized.is_dir);
    }

    // ─── FileSystemNode tests ────────────────────────────────────────────

    #[test]
    fn test_filesystem_node_leaf() {
        let node = FileSystemNode {
            path: "/file.txt".to_string(),
            name: "file.txt".to_string(),
            is_dir: false,
            size: 100,
            modified: 1_700_000_000,
            content: Some("hello".to_string()),
            children: None,
            error: None,
        };
        let json = serde_json::to_string(&node).unwrap();
        let deserialized: FileSystemNode = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.content, Some("hello".to_string()));
        assert!(deserialized.children.is_none());
        assert!(deserialized.error.is_none());
    }

    #[test]
    fn test_filesystem_node_with_children() {
        let child = FileSystemNode {
            path: "/dir/child.txt".to_string(),
            name: "child.txt".to_string(),
            is_dir: false,
            size: 50,
            modified: 0,
            content: None,
            children: None,
            error: None,
        };
        let parent = FileSystemNode {
            path: "/dir".to_string(),
            name: "dir".to_string(),
            is_dir: true,
            size: 0,
            modified: 0,
            content: None,
            children: Some(vec![child]),
            error: None,
        };
        let json = serde_json::to_string(&parent).unwrap();
        let deserialized: FileSystemNode = serde_json::from_str(&json).unwrap();
        assert!(deserialized.is_dir);
        let children = deserialized.children.unwrap();
        assert_eq!(children.len(), 1);
        assert_eq!(children[0].name, "child.txt");
    }

    #[test]
    fn test_filesystem_node_with_error() {
        let node = FileSystemNode {
            path: "/inaccessible".to_string(),
            name: "inaccessible".to_string(),
            is_dir: true,
            size: 0,
            modified: 0,
            content: None,
            children: None,
            error: Some("Permission denied".to_string()),
        };
        assert_eq!(node.error, Some("Permission denied".to_string()));
    }

    // ─── OperationProgress tests ─────────────────────────────────────────

    #[test]
    fn test_operation_progress_percentage_calculation() {
        let progress = OperationProgress {
            operation_id: "op-123".to_string(),
            operation_type: "copy".to_string(),
            current_file: "file.txt".to_string(),
            processed_count: 50,
            total_count: 100,
            bytes_processed: 500_000,
            total_bytes: 1_000_000,
            status: OperationStatus::InProgress,
            error_message: None,
            progress_percentage: 50.0,
            estimated_remaining: Some(30),
            start_time: None,
        };
        assert_eq!(progress.progress_percentage, 50.0);
        assert_eq!(progress.estimated_remaining, Some(30));
    }

    #[test]
    fn test_operation_progress_start_time_skipped_in_serialization() {
        let progress = OperationProgress {
            operation_id: "op-456".to_string(),
            operation_type: "move".to_string(),
            current_file: "".to_string(),
            processed_count: 0,
            total_count: 0,
            bytes_processed: 0,
            total_bytes: 0,
            status: OperationStatus::Starting,
            error_message: None,
            progress_percentage: 0.0,
            estimated_remaining: None,
            start_time: Some(Instant::now()),
        };
        let json = serde_json::to_string(&progress).unwrap();
        // start_time has #[serde(skip)] so it should NOT appear in JSON
        assert!(
            !json.contains("start_time"),
            "start_time should be skipped in serialization"
        );
        // Deserialize back -- start_time should be None (default)
        let deserialized: OperationProgress = serde_json::from_str(&json).unwrap();
        assert!(deserialized.start_time.is_none());
    }
}
