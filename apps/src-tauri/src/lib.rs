pub mod error;
pub mod utils;

pub mod agent;
pub mod ai;
pub mod audit_log;
pub mod backup;
pub mod document_extractor;
pub mod duplicate_finder;
pub mod extensions;
pub mod file_lib;
pub mod file_organizer;
pub mod file_versions;
pub mod file_watcher;
pub mod git;
pub mod google_drive;
pub mod operations;
pub mod pty;
pub mod search;
pub mod secure_credentials;
pub mod shortcuts;
pub mod storage;
pub mod sync;

#[cfg(windows)]
pub mod windows_recycle_bin;

#[cfg(test)]
mod tests {
    use crate::operations::{FileEntry, validate_file_path};
    use crate::error::{AppError, AppResult};
    use crate::agent::memory::MemoryStore;

    #[test]
    fn file_entry_can_be_constructed() {
        let entry = FileEntry {
            name: "test.txt".to_string(),
            path: "/tmp/test.txt".to_string(),
            is_dir: false,
            size: 42,
            modified: 0,
            file_type: "file".to_string(),
            mime_type: None,
            is_readonly: false,
        };
        assert_eq!(entry.name, "test.txt");
        assert!(!entry.is_dir);
    }

    #[test]
    fn validate_file_path_rejects_null_bytes() {
        let result = validate_file_path("/tmp/evil\0file");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("null bytes"));
    }

    #[test]
    fn validate_file_path_accepts_safe_path() {
        let result = validate_file_path("/tmp/safe_file.txt");
        assert!(result.is_ok());
    }

    #[test]
    fn app_error_converts_to_string() {
        let err = AppError::NotFound("missing.txt".to_string());
        let msg: String = err.into();
        assert!(msg.contains("missing.txt"));
    }

    #[test]
    fn app_result_works_with_question_mark() {
        let ok_result: AppResult<i32> = Ok(42);
        assert_eq!(ok_result.unwrap(), 42);

        let err_result: AppResult<i32> = Err(AppError::Other("test error".to_string()));
        assert!(err_result.is_err());
    }

    #[test]
    fn memory_store_defaults_to_empty() {
        let store = MemoryStore::default();
        assert!(store.entries.is_empty());
    }
}
