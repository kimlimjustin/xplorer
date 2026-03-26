pub mod error;
pub mod utils;

pub mod agent;
pub mod ai;
pub mod api;
pub mod audit_log;
pub mod backup;
pub mod document_extractor;
pub mod duplicate_finder;
pub mod extensions;
pub mod file_lib;
pub mod file_organizer;
pub mod file_versions;
pub mod file_watcher;
pub mod git_history;
pub mod git_integration;
pub mod google_drive;
pub mod operations;
pub mod search;
pub mod secure_credentials;
pub mod shortcuts;
pub mod storage;
pub mod sync;
pub mod watcher;
#[cfg(windows)]
pub mod windows_recycle_bin;

#[cfg(test)]
mod tests {
    #[test]
    fn basic_functionality_test() {
        assert_eq!(2 + 2, 4);
    }

    #[test]
    fn string_operations_test() {
        let test_string = "hello world";
        assert_eq!(test_string.len(), 11);
        assert!(test_string.contains("world"));
    }
}
