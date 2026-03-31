use crate::audit_log::log_operation;
use crate::operations::validate_file_path;
use std::fs;
use std::path::Path;
use tauri::command;

#[command]
pub async fn remove_file(path: String) -> Result<(), String> {
    validate_file_path(&path)?;

    tokio::task::spawn_blocking(move || {
        let p = Path::new(&path);

        if !p.exists() {
            return Err("File does not exist".to_string());
        }

        if p.is_dir() {
            return Err("Path is a directory, use remove_dir instead".to_string());
        }

        fs::remove_file(p).map_err(|e| format!("Failed to remove file: {}", e))?;
        log_operation("delete", vec![path], None, true);

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_delete_file() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file_path = temp.path().join("to_delete.txt");

        File::create(&file_path).expect("Failed to create file");
        assert!(file_path.exists(), "file should exist before deletion");

        let result = remove_file(file_path.to_string_lossy().to_string()).await;

        assert!(
            result.is_ok(),
            "remove_file should succeed: {:?}",
            result.err()
        );
        assert!(!file_path.exists(), "file should not exist after deletion");
    }

    #[tokio::test]
    async fn test_delete_file_nonexistent_returns_error() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file_path = temp.path().join("nonexistent.txt");

        let result = remove_file(file_path.to_string_lossy().to_string()).await;

        assert!(result.is_err(), "removing nonexistent file should fail");
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[tokio::test]
    async fn test_delete_directory_returns_error() {
        let temp = tempdir().expect("Failed to create temp dir");
        let dir_path = temp.path().join("a_directory");
        fs::create_dir(&dir_path).expect("Failed to create dir");

        let result = remove_file(dir_path.to_string_lossy().to_string()).await;

        assert!(result.is_err(), "remove_file on a directory should fail");
        assert!(result.unwrap_err().contains("directory"));
    }
}
