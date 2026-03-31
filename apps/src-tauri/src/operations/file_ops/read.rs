use crate::operations::validate_file_path;
use std::fs;
use std::path::Path;
use tauri::command;

#[command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    validate_file_path(&path)?;

    tokio::task::spawn_blocking(move || {
        fs::read_to_string(&path).map_err(|e| format!("Failed to read file {}: {}", path, e))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    validate_file_path(&path)?;

    tokio::task::spawn_blocking(move || {
        let metadata = fs::metadata(&path)
            .map_err(|e| format!("Failed to get file metadata {}: {}", path, e))?;
        if metadata.len() > 500 * 1024 * 1024 {
            return Err(format!(
                "File too large ({} bytes, max 500MB)",
                metadata.len()
            ));
        }
        fs::read(&path).map_err(|e| format!("Failed to read binary file {}: {}", path, e))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn file_exist(path: String) -> Result<bool, String> {
    let path = Path::new(&path);
    Ok(path.exists())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_read_text_file_returns_content() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file_path = temp.path().join("readable.txt");
        let content = "line 1\nline 2\nline 3";

        fs::write(&file_path, content).expect("Failed to write");

        let result = read_text_file(file_path.to_string_lossy().to_string()).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), content);
    }

    #[tokio::test]
    async fn test_read_text_file_nonexistent_returns_error() {
        let result = read_text_file("/nonexistent/path/file.txt".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_file_exist_true_and_false() {
        let temp = tempdir().expect("Failed to create temp dir");
        let existing = temp.path().join("exists.txt");
        File::create(&existing).expect("Failed to create file");

        let result_exists = file_exist(existing.to_string_lossy().to_string()).await;
        assert!(result_exists.is_ok());
        assert!(result_exists.unwrap(), "existing file should return true");

        let result_missing = file_exist(
            temp.path()
                .join("missing.txt")
                .to_string_lossy()
                .to_string(),
        )
        .await;
        assert!(result_missing.is_ok());
        assert!(!result_missing.unwrap(), "missing file should return false");
    }

    #[tokio::test]
    async fn test_read_binary_file_basic() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file_path = temp.path().join("binary.bin");
        let data: Vec<u8> = vec![0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD];

        fs::write(&file_path, &data).expect("Failed to write binary");

        let result = read_binary_file(file_path.to_string_lossy().to_string()).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), data);
    }
}
