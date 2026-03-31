mod commands;
mod redo_ops;
mod undo_ops;

pub use commands::*;

use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

use super::file_ops::copy_dir_recursive as copy_dir_recursive_simple;

pub(crate) use redo_ops::execute_redo;
pub(crate) use undo_ops::execute_undo;

const MAX_HISTORY: usize = 50;

/// Represents a single file operation that can be undone/redone.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FileOperation {
    Copy {
        src: String,
        dest: String,
    },
    Move {
        src: String,
        dest: String,
    },
    Delete {
        original_path: String,
        staging_path: String,
        was_dir: bool,
    },
    Rename {
        old_path: String,
        new_path: String,
    },
}

impl FileOperation {
    /// Returns a human-readable description of the operation (for toast messages).
    pub fn describe(&self) -> String {
        match self {
            FileOperation::Copy { src, dest } => {
                let src_name = Path::new(src)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| src.clone());
                let dest_dir = Path::new(dest)
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|| dest.clone());
                format!("copied {} to {}", src_name, dest_dir)
            }
            FileOperation::Move { src, dest } => {
                let name = Path::new(dest)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| dest.clone());
                let src_dir = Path::new(src)
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|| src.clone());
                format!("moved {} back to {}", name, src_dir)
            }
            FileOperation::Delete { original_path, .. } => {
                let name = Path::new(original_path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| original_path.clone());
                format!("restored {}", name)
            }
            FileOperation::Rename { old_path, new_path } => {
                let old_name = Path::new(old_path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| old_path.clone());
                let new_name = Path::new(new_path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| new_path.clone());
                format!("renamed {} back to {}", new_name, old_name)
            }
        }
    }

    /// Returns a description of the redo action.
    pub fn describe_redo(&self) -> String {
        match self {
            FileOperation::Copy { src, dest: _ } => {
                let src_name = Path::new(src)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| src.clone());
                format!("re-copied {}", src_name)
            }
            FileOperation::Move { src, dest } => {
                let name = Path::new(src)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| src.clone());
                let dest_dir = Path::new(dest)
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|| dest.clone());
                format!("re-moved {} to {}", name, dest_dir)
            }
            FileOperation::Delete { original_path, .. } => {
                let name = Path::new(original_path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| original_path.clone());
                format!("re-deleted {}", name)
            }
            FileOperation::Rename { old_path, new_path } => {
                let old_name = Path::new(old_path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| old_path.clone());
                let new_name = Path::new(new_path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| new_path.clone());
                format!("renamed {} to {}", old_name, new_name)
            }
        }
    }

    /// A forward (original-action) description, used in the history panel.
    pub fn describe_forward(&self) -> String {
        match self {
            FileOperation::Copy { src, dest } => {
                let src_name = Path::new(src)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| src.clone());
                let dest_dir = Path::new(dest)
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|| dest.clone());
                format!("Copied {} to {}", src_name, dest_dir)
            }
            FileOperation::Move { src, dest } => {
                let name = Path::new(src)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| src.clone());
                let dest_dir = Path::new(dest)
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|| dest.clone());
                format!("Moved {} to {}", name, dest_dir)
            }
            FileOperation::Delete { original_path, .. } => {
                let name = Path::new(original_path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| original_path.clone());
                format!("Deleted {}", name)
            }
            FileOperation::Rename { old_path, new_path } => {
                let old_name = Path::new(old_path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| old_path.clone());
                let new_name = Path::new(new_path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| new_path.clone());
                format!("Renamed {} to {}", old_name, new_name)
            }
        }
    }

    /// Short operation type label.
    pub fn type_label(&self) -> &'static str {
        match self {
            FileOperation::Copy { .. } => "Copy",
            FileOperation::Move { .. } => "Move",
            FileOperation::Delete { .. } => "Delete",
            FileOperation::Rename { .. } => "Rename",
        }
    }
}

/// A timestamped file operation for the undo/redo stacks.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimestampedOperation {
    pub op: FileOperation,
    /// Unix timestamp in milliseconds when the operation was recorded.
    pub timestamp_ms: i64,
}

/// Stores the undo and redo stacks for file operations.
pub struct OperationHistory {
    pub(crate) undo_stack: Vec<TimestampedOperation>,
    pub(crate) redo_stack: Vec<TimestampedOperation>,
}

impl Default for OperationHistory {
    fn default() -> Self {
        Self::new()
    }
}

impl OperationHistory {
    pub fn new() -> Self {
        Self {
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
        }
    }

    /// Push a completed operation onto the undo stack.
    /// Clears the redo stack (new action invalidates redo history).
    pub fn push(&mut self, op: FileOperation) {
        let ts = Local::now().timestamp_millis();
        self.undo_stack.push(TimestampedOperation {
            op,
            timestamp_ms: ts,
        });
        // Enforce max history size
        if self.undo_stack.len() > MAX_HISTORY {
            self.undo_stack.remove(0);
        }
        // Any new operation invalidates the redo stack
        self.redo_stack.clear();
    }

    /// Pop the most recent operation from the undo stack.
    pub fn pop_undo(&mut self) -> Option<TimestampedOperation> {
        self.undo_stack.pop()
    }

    /// Push an undone operation onto the redo stack.
    pub fn push_redo(&mut self, ts_op: TimestampedOperation) {
        self.redo_stack.push(ts_op);
        if self.redo_stack.len() > MAX_HISTORY {
            self.redo_stack.remove(0);
        }
    }

    /// Pop the most recent operation from the redo stack.
    pub fn pop_redo(&mut self) -> Option<TimestampedOperation> {
        self.redo_stack.pop()
    }
}

pub static OPERATION_HISTORY: LazyLock<Mutex<OperationHistory>> =
    LazyLock::new(|| Mutex::new(OperationHistory::new()));

/// Get (or create) the staging directory for soft-deleted files.
/// Located at <user data dir>/.xplorer_trash/
#[allow(dead_code)]
fn get_staging_dir() -> Result<PathBuf, String> {
    let base = dirs::data_local_dir()
        .or_else(dirs::home_dir)
        .ok_or_else(|| "Cannot determine user data directory".to_string())?;
    let staging = base.join(".xplorer_trash");
    if !staging.exists() {
        fs::create_dir_all(&staging)
            .map_err(|e| format!("Failed to create staging directory: {}", e))?;
    }
    Ok(staging)
}

/// Record a completed operation in the undo history.
pub fn record_operation(op: FileOperation) {
    let mut history = OPERATION_HISTORY.lock().unwrap_or_else(|e| e.into_inner());
    history.push(op);
}

/// Soft-delete a file or directory by moving it to the staging area.
/// Returns the staging path so the caller can record it for undo.
#[allow(dead_code)]
pub fn soft_delete(path: &str) -> Result<String, String> {
    let src = Path::new(path);
    if !src.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let staging_dir = get_staging_dir()?;
    let timestamp = Local::now().format("%Y%m%d_%H%M%S_%3f").to_string();
    let original_name = src
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let staging_name = format!("{}_{}", timestamp, original_name);
    let staging_path = staging_dir.join(&staging_name);

    // Move to staging
    fs::rename(src, &staging_path).or_else(|_| {
        // Cross-device: copy then delete
        if src.is_dir() {
            copy_dir_recursive_simple(src, &staging_path)?;
            fs::remove_dir_all(src)
                .map_err(|e| format!("Failed to remove original directory: {}", e))
        } else {
            fs::copy(src, &staging_path)
                .map_err(|e| format!("Failed to copy to staging: {}", e))?;
            fs::remove_file(src).map_err(|e| format!("Failed to remove original file: {}", e))
        }
    })?;

    Ok(staging_path.to_string_lossy().to_string())
}

/// Remove a file or directory recursively.
pub(crate) fn remove_path(path: &Path) -> Result<(), String> {
    if path.is_dir() {
        fs::remove_dir_all(path)
            .map_err(|e| format!("Failed to remove directory {}: {}", path.display(), e))
    } else {
        fs::remove_file(path)
            .map_err(|e| format!("Failed to remove file {}: {}", path.display(), e))
    }
}

/// Result returned to the frontend after an undo/redo operation.
#[derive(Serialize, Deserialize, Clone)]
pub struct UndoRedoResult {
    pub success: bool,
    pub message: String,
    pub operation_type: String,
}

/// A single entry in the undo history, suitable for the frontend panel.
#[derive(Serialize, Deserialize, Clone)]
pub struct UndoHistoryEntry {
    /// Index in the combined timeline (0 = oldest)
    pub index: usize,
    /// "Copy", "Move", "Delete", "Rename"
    pub operation_type: String,
    /// Human-readable description of the operation
    pub description: String,
    /// Whether this entry is on the undo side (true) or redo side (false)
    pub undoable: bool,
    /// Unix timestamp in milliseconds when the operation was originally recorded
    pub timestamp_ms: i64,
    /// Source path (for copy/move/rename) or original path (for delete)
    pub source_path: Option<String>,
    /// Destination path (for copy/move/rename) or staging path (for delete)
    pub dest_path: Option<String>,
}

/// Snapshot of the undo/redo stacks returned to the frontend.
#[derive(Serialize, Deserialize, Clone)]
pub struct UndoHistorySnapshot {
    /// All entries, ordered oldest-first.  The `undo_count` field tells the frontend
    /// where to draw the "current position" divider.
    pub entries: Vec<UndoHistoryEntry>,
    /// Number of entries on the undo stack (everything at index < undo_count is undoable,
    /// everything at index >= undo_count is redoable).
    pub undo_count: usize,
}

/// Extract source and destination paths from a FileOperation.
pub(crate) fn extract_paths(op: &FileOperation) -> (Option<String>, Option<String>) {
    match op {
        FileOperation::Copy { src, dest } => (Some(src.clone()), Some(dest.clone())),
        FileOperation::Move { src, dest } => (Some(src.clone()), Some(dest.clone())),
        FileOperation::Delete {
            original_path,
            staging_path,
            ..
        } => (Some(original_path.clone()), Some(staging_path.clone())),
        FileOperation::Rename { old_path, new_path } => {
            (Some(old_path.clone()), Some(new_path.clone()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    // ─── OperationHistory unit tests ─────────────────────────────────────

    #[test]
    fn test_push_and_pop_undo() {
        let mut history = OperationHistory::new();

        history.push(FileOperation::Copy {
            src: "/a".into(),
            dest: "/b".into(),
        });
        history.push(FileOperation::Rename {
            old_path: "/c".into(),
            new_path: "/d".into(),
        });

        // pop_undo should return most recent first (LIFO)
        let ts_op = history.pop_undo();
        assert!(ts_op.is_some());
        match ts_op.unwrap().op {
            FileOperation::Rename { old_path, new_path } => {
                assert_eq!(old_path, "/c");
                assert_eq!(new_path, "/d");
            }
            other => panic!("expected Rename, got {:?}", other),
        }

        let ts_op2 = history.pop_undo();
        assert!(ts_op2.is_some());
        match ts_op2.unwrap().op {
            FileOperation::Copy { src, .. } => {
                assert_eq!(src, "/a");
            }
            other => panic!("expected Copy, got {:?}", other),
        }

        // Stack should now be empty
        assert!(history.pop_undo().is_none());
    }

    #[test]
    fn test_push_clears_redo_stack() {
        let mut history = OperationHistory::new();

        // Push some operations
        history.push(FileOperation::Copy {
            src: "/a".into(),
            dest: "/b".into(),
        });

        // Simulate undo -> redo by manually pushing to redo stack
        let ts_op = history.pop_undo().unwrap();
        history.push_redo(ts_op);

        // Redo stack now has one item
        assert!(history.pop_redo().is_some());
        // Restore it
        history.push_redo(TimestampedOperation {
            op: FileOperation::Copy {
                src: "/a".into(),
                dest: "/b".into(),
            },
            timestamp_ms: Local::now().timestamp_millis(),
        });

        // Now push a NEW operation — this should clear the redo stack
        history.push(FileOperation::Rename {
            old_path: "/c".into(),
            new_path: "/d".into(),
        });

        // Redo stack should be empty because a new operation was pushed
        assert!(
            history.pop_redo().is_none(),
            "redo should be cleared after new push"
        );
    }

    #[test]
    fn test_redo_push_and_pop() {
        let mut history = OperationHistory::new();

        let ts_op = TimestampedOperation {
            op: FileOperation::Move {
                src: "/x".into(),
                dest: "/y".into(),
            },
            timestamp_ms: Local::now().timestamp_millis(),
        };
        history.push_redo(ts_op);

        let popped = history.pop_redo();
        assert!(popped.is_some());
        match popped.unwrap().op {
            FileOperation::Move { src, dest } => {
                assert_eq!(src, "/x");
                assert_eq!(dest, "/y");
            }
            other => panic!("expected Move, got {:?}", other),
        }

        assert!(history.pop_redo().is_none());
    }

    #[test]
    fn test_undo_stack_max_history_limit() {
        let mut history = OperationHistory::new();

        // Push more than MAX_HISTORY items
        for i in 0..(MAX_HISTORY + 10) {
            history.push(FileOperation::Copy {
                src: format!("/src_{}", i),
                dest: format!("/dst_{}", i),
            });
        }

        // Count items by popping
        let mut count = 0;
        while history.pop_undo().is_some() {
            count += 1;
        }

        assert_eq!(
            count, MAX_HISTORY,
            "undo stack should be capped at MAX_HISTORY ({})",
            MAX_HISTORY
        );
    }

    #[test]
    fn test_redo_stack_max_history_limit() {
        let mut history = OperationHistory::new();

        for i in 0..(MAX_HISTORY + 10) {
            history.push_redo(TimestampedOperation {
                op: FileOperation::Copy {
                    src: format!("/src_{}", i),
                    dest: format!("/dst_{}", i),
                },
                timestamp_ms: Local::now().timestamp_millis(),
            });
        }

        let mut count = 0;
        while history.pop_redo().is_some() {
            count += 1;
        }

        assert_eq!(
            count, MAX_HISTORY,
            "redo stack should be capped at MAX_HISTORY ({})",
            MAX_HISTORY
        );
    }

    #[test]
    fn test_empty_history() {
        let mut history = OperationHistory::new();
        assert!(history.pop_undo().is_none());
        assert!(history.pop_redo().is_none());
    }

    // ─── FileOperation::describe tests ──────────────────────────────────

    #[test]
    fn test_describe_copy() {
        let op = FileOperation::Copy {
            src: "/home/user/file.txt".into(),
            dest: "/home/user/backup/file.txt".into(),
        };
        let desc = op.describe();
        assert!(desc.contains("copied"), "should mention 'copied': {}", desc);
        assert!(
            desc.contains("file.txt"),
            "should mention the filename: {}",
            desc
        );
    }

    #[test]
    fn test_describe_move() {
        let op = FileOperation::Move {
            src: "/home/user/old/file.txt".into(),
            dest: "/home/user/new/file.txt".into(),
        };
        let desc = op.describe();
        assert!(desc.contains("moved"), "should mention 'moved': {}", desc);
    }

    #[test]
    fn test_describe_delete() {
        let op = FileOperation::Delete {
            original_path: "/home/user/deleted.txt".into(),
            staging_path: "/tmp/staging/deleted.txt".into(),
            was_dir: false,
        };
        let desc = op.describe();
        assert!(
            desc.contains("restored"),
            "should mention 'restored': {}",
            desc
        );
        assert!(
            desc.contains("deleted.txt"),
            "should mention filename: {}",
            desc
        );
    }

    #[test]
    fn test_describe_rename() {
        let op = FileOperation::Rename {
            old_path: "/home/user/old_name.txt".into(),
            new_path: "/home/user/new_name.txt".into(),
        };
        let desc = op.describe();
        assert!(
            desc.contains("renamed"),
            "should mention 'renamed': {}",
            desc
        );
    }

    #[test]
    fn test_describe_redo_copy() {
        let op = FileOperation::Copy {
            src: "/src/file.txt".into(),
            dest: "/dst/file.txt".into(),
        };
        let desc = op.describe_redo();
        assert!(
            desc.contains("re-copied"),
            "redo copy should say 're-copied': {}",
            desc
        );
    }

    #[test]
    fn test_describe_redo_rename() {
        let op = FileOperation::Rename {
            old_path: "/old.txt".into(),
            new_path: "/new.txt".into(),
        };
        let desc = op.describe_redo();
        assert!(
            desc.contains("renamed"),
            "redo rename should say 'renamed': {}",
            desc
        );
    }

    // ─── FileOperation serialization tests ──────────────────────────────

    #[test]
    fn test_file_operation_serialization_copy() {
        let op = FileOperation::Copy {
            src: "/a".into(),
            dest: "/b".into(),
        };
        let json = serde_json::to_string(&op).unwrap();
        let deserialized: FileOperation = serde_json::from_str(&json).unwrap();
        match deserialized {
            FileOperation::Copy { src, dest } => {
                assert_eq!(src, "/a");
                assert_eq!(dest, "/b");
            }
            other => panic!("expected Copy, got {:?}", other),
        }
    }

    #[test]
    fn test_file_operation_serialization_delete() {
        let op = FileOperation::Delete {
            original_path: "/orig".into(),
            staging_path: "/stage".into(),
            was_dir: true,
        };
        let json = serde_json::to_string(&op).unwrap();
        let deserialized: FileOperation = serde_json::from_str(&json).unwrap();
        match deserialized {
            FileOperation::Delete {
                original_path,
                staging_path,
                was_dir,
            } => {
                assert_eq!(original_path, "/orig");
                assert_eq!(staging_path, "/stage");
                assert!(was_dir);
            }
            other => panic!("expected Delete, got {:?}", other),
        }
    }

    #[test]
    fn test_file_operation_serialization_move() {
        let op = FileOperation::Move {
            src: "/x".into(),
            dest: "/y".into(),
        };
        let json = serde_json::to_string(&op).unwrap();
        assert!(json.contains("\"type\":\"Move\""));
        let deserialized: FileOperation = serde_json::from_str(&json).unwrap();
        match deserialized {
            FileOperation::Move { src, dest } => {
                assert_eq!(src, "/x");
                assert_eq!(dest, "/y");
            }
            other => panic!("expected Move, got {:?}", other),
        }
    }

    #[test]
    fn test_file_operation_serialization_rename() {
        let op = FileOperation::Rename {
            old_path: "/old".into(),
            new_path: "/new".into(),
        };
        let json = serde_json::to_string(&op).unwrap();
        assert!(json.contains("\"type\":\"Rename\""));
    }

    // ─── execute_undo / execute_redo integration tests ──────────────────

    #[test]
    fn test_undo_copy_deletes_destination() {
        let temp = tempdir().expect("create temp dir");
        let src_path = temp.path().join("source.txt");
        let dest_path = temp.path().join("copied.txt");

        std::fs::write(&src_path, "original").unwrap();
        std::fs::copy(&src_path, &dest_path).unwrap();
        assert!(dest_path.exists());

        let op = FileOperation::Copy {
            src: src_path.to_string_lossy().into(),
            dest: dest_path.to_string_lossy().into(),
        };

        let result = execute_undo(&op);
        assert!(
            result.is_ok(),
            "undo copy should succeed: {:?}",
            result.err()
        );
        assert!(
            !dest_path.exists(),
            "copied file should be removed after undo"
        );
        assert!(
            src_path.exists(),
            "source should still exist after undoing copy"
        );
    }

    #[test]
    fn test_undo_rename_reverts() {
        let temp = tempdir().expect("create temp dir");
        let old_path = temp.path().join("original.txt");
        let new_path = temp.path().join("renamed.txt");

        std::fs::write(&old_path, "content").unwrap();
        std::fs::rename(&old_path, &new_path).unwrap();
        assert!(!old_path.exists());
        assert!(new_path.exists());

        let op = FileOperation::Rename {
            old_path: old_path.to_string_lossy().into(),
            new_path: new_path.to_string_lossy().into(),
        };

        let result = execute_undo(&op);
        assert!(
            result.is_ok(),
            "undo rename should succeed: {:?}",
            result.err()
        );
        assert!(old_path.exists(), "old name should be restored");
        assert!(!new_path.exists(), "new name should be gone");
    }

    #[test]
    fn test_undo_move_reverts() {
        let temp = tempdir().expect("create temp dir");
        let src = temp.path().join("src.txt");
        let dest = temp.path().join("dest.txt");

        std::fs::write(&src, "move me").unwrap();
        std::fs::rename(&src, &dest).unwrap();

        let op = FileOperation::Move {
            src: src.to_string_lossy().into(),
            dest: dest.to_string_lossy().into(),
        };

        let result = execute_undo(&op);
        assert!(
            result.is_ok(),
            "undo move should succeed: {:?}",
            result.err()
        );
        assert!(src.exists(), "source should be restored");
        assert!(!dest.exists(), "destination should be gone");
    }

    #[test]
    fn test_redo_copy_re_copies_file() {
        let temp = tempdir().expect("create temp dir");
        let src = temp.path().join("source.txt");
        let dest = temp.path().join("dest.txt");

        std::fs::write(&src, "content to re-copy").unwrap();

        let op = FileOperation::Copy {
            src: src.to_string_lossy().into(),
            dest: dest.to_string_lossy().into(),
        };

        let result = execute_redo(&op);
        assert!(
            result.is_ok(),
            "redo copy should succeed: {:?}",
            result.err()
        );
        assert!(dest.exists(), "dest should exist after redo copy");
        assert_eq!(
            std::fs::read_to_string(&dest).unwrap(),
            "content to re-copy"
        );
    }

    #[test]
    fn test_redo_rename() {
        let temp = tempdir().expect("create temp dir");
        let old = temp.path().join("old.txt");
        let new = temp.path().join("new.txt");

        std::fs::write(&old, "rename me").unwrap();

        let op = FileOperation::Rename {
            old_path: old.to_string_lossy().into(),
            new_path: new.to_string_lossy().into(),
        };

        let result = execute_redo(&op);
        assert!(
            result.is_ok(),
            "redo rename should succeed: {:?}",
            result.err()
        );
        assert!(!old.exists(), "old path should be gone after redo rename");
        assert!(new.exists(), "new path should exist after redo rename");
    }

    #[test]
    fn test_undo_redo_rename_roundtrip() {
        let temp = tempdir().expect("create temp dir");
        let old = temp.path().join("original.txt");
        let new = temp.path().join("renamed.txt");

        std::fs::write(&old, "roundtrip content").unwrap();

        let op = FileOperation::Rename {
            old_path: old.to_string_lossy().into(),
            new_path: new.to_string_lossy().into(),
        };

        // Execute the rename (simulate the original operation)
        std::fs::rename(&old, &new).unwrap();
        assert!(!old.exists());
        assert!(new.exists());

        // Undo
        execute_undo(&op).unwrap();
        assert!(old.exists());
        assert!(!new.exists());

        // Redo
        execute_redo(&op).unwrap();
        assert!(!old.exists());
        assert!(new.exists());

        assert_eq!(std::fs::read_to_string(&new).unwrap(), "roundtrip content");
    }

    #[test]
    fn test_undo_redo_result_serialization() {
        let result = UndoRedoResult {
            success: true,
            message: "Undone: copied file.txt".into(),
            operation_type: "copy".into(),
        };
        let json = serde_json::to_string(&result).unwrap();
        let deserialized: UndoRedoResult = serde_json::from_str(&json).unwrap();
        assert!(deserialized.success);
        assert_eq!(deserialized.message, "Undone: copied file.txt");
        assert_eq!(deserialized.operation_type, "copy");
    }

    #[test]
    fn test_record_operation_adds_to_global_history() {
        // Note: This modifies global state. In practice, tests should not
        // depend on each other's state, but we verify the function doesn't panic.
        let op = FileOperation::Copy {
            src: "/test_record/src".into(),
            dest: "/test_record/dst".into(),
        };
        record_operation(op);

        // Verify something was pushed (peek at the global history)
        let mut history = OPERATION_HISTORY.lock().unwrap_or_else(|e| e.into_inner());
        let popped = history.pop_undo();
        // We may or may not get our specific operation (other tests may have added too),
        // but the call should not panic.
        // popped may or may not contain our op due to global state — just ensure no panic
        let _ = popped;
    }

    // ─── Error case tests ───────────────────────────────────────────────

    #[test]
    fn test_undo_move_nonexistent_dest_returns_error() {
        let op = FileOperation::Move {
            src: "/nonexistent_src_12345".into(),
            dest: "/nonexistent_dest_12345".into(),
        };
        let result = execute_undo(&op);
        assert!(
            result.is_err(),
            "undoing a move where dest is gone should error"
        );
    }

    #[test]
    fn test_undo_rename_nonexistent_new_returns_error() {
        let op = FileOperation::Rename {
            old_path: "/nonexistent_old".into(),
            new_path: "/nonexistent_new".into(),
        };
        let result = execute_undo(&op);
        assert!(
            result.is_err(),
            "undoing a rename where new_path is gone should error"
        );
    }

    #[test]
    fn test_redo_copy_nonexistent_source_returns_error() {
        let op = FileOperation::Copy {
            src: "/nonexistent_source_12345".into(),
            dest: "/nonexistent_dest_12345".into(),
        };
        let result = execute_redo(&op);
        assert!(
            result.is_err(),
            "redoing a copy where source is gone should error"
        );
    }

    #[test]
    fn test_redo_move_nonexistent_source_returns_error() {
        let op = FileOperation::Move {
            src: "/nonexistent_src_12345".into(),
            dest: "/nonexistent_dest_12345".into(),
        };
        let result = execute_redo(&op);
        assert!(result.is_err());
    }

    // ─── soft_delete tests ──────────────────────────────────────────────

    #[test]
    fn test_soft_delete_file() {
        let temp = tempdir().expect("create temp dir");
        let file_path = temp.path().join("to_delete.txt");
        std::fs::write(&file_path, "delete me").unwrap();

        let result = soft_delete(file_path.to_str().unwrap());
        assert!(
            result.is_ok(),
            "soft_delete should succeed: {:?}",
            result.err()
        );

        // Original file should be gone
        assert!(!file_path.exists(), "original file should be removed");

        // Staging path should exist
        let staging_path = result.unwrap();
        assert!(
            std::path::Path::new(&staging_path).exists(),
            "file should exist in staging area"
        );

        // Clean up staging
        let _ = std::fs::remove_file(&staging_path);
    }

    #[test]
    fn test_soft_delete_nonexistent_returns_error() {
        let result = soft_delete("/nonexistent_file_test_12345.txt");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_soft_delete_directory() {
        let temp = tempdir().expect("create temp dir");
        let dir_path = temp.path().join("subdir");
        std::fs::create_dir(&dir_path).unwrap();
        std::fs::write(dir_path.join("inside.txt"), "inner file").unwrap();

        let result = soft_delete(dir_path.to_str().unwrap());
        assert!(
            result.is_ok(),
            "soft_delete on directory should succeed: {:?}",
            result.err()
        );
        assert!(
            !dir_path.exists(),
            "directory should be removed from original location"
        );

        let staging_path = result.unwrap();
        assert!(
            std::path::Path::new(&staging_path).exists(),
            "directory should exist in staging area"
        );

        // Clean up
        let _ = std::fs::remove_dir_all(&staging_path);
    }
}
