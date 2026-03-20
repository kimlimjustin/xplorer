use xplorer::operations::*;
use std::fs::{self, File};
use std::io::Write;
use tempfile::tempdir;

#[tokio::test]
async fn test_read_directory() {
    let temp_dir = tempdir().expect("Failed to create temp directory");
    let temp_path = temp_dir.path();

    // Create test files and directories
    let test_file = temp_path.join("test.txt");
    let test_dir = temp_path.join("subdir");

    File::create(&test_file).expect("Failed to create test file");
    fs::create_dir(&test_dir).expect("Failed to create test directory");

    // Test reading directory
    let result = read_directory(temp_path.to_string_lossy().to_string()).await;

    assert!(result.is_ok());
    let entries = result.unwrap();
    assert!(!entries.is_empty());

    // Verify we have our test entries
    let file_names: Vec<_> = entries.iter().map(|e| &e.name).collect();
    assert!(file_names.contains(&&"test.txt".to_string()));
    assert!(file_names.contains(&&"subdir".to_string()));
}

#[tokio::test]
async fn test_read_directory_nonexistent() {
    let result = read_directory("/nonexistent/path".to_string()).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_get_file_properties() {
    let temp_dir = tempdir().expect("Failed to create temp directory");
    let test_file = temp_dir.path().join("test.txt");

    // Create a test file with content
    let mut file = File::create(&test_file).expect("Failed to create test file");
    writeln!(file, "Hello, world!").expect("Failed to write to test file");

    let result = get_file_properties(test_file.to_string_lossy().to_string()).await;

    assert!(result.is_ok());
    let properties = result.unwrap();
    assert_eq!(properties.name, "test.txt");
    assert!(!properties.is_dir);
    assert!(properties.size > 0);
}

#[tokio::test]
async fn test_get_file_properties_directory() {
    let temp_dir = tempdir().expect("Failed to create temp directory");
    let temp_path = temp_dir.path();

    let result = get_file_properties(temp_path.to_string_lossy().to_string()).await;

    assert!(result.is_ok());
    let properties = result.unwrap();
    assert!(properties.is_dir);
}

#[tokio::test]
async fn test_create_and_remove_file() {
    let temp_dir = tempdir().expect("Failed to create temp directory");
    let test_file = temp_dir.path().join("new_file.txt");
    let file_path = test_file.to_string_lossy().to_string();

    // Create file
    let create_result = create_file(file_path.clone()).await;
    assert!(create_result.is_ok());
    assert!(test_file.exists());

    // Remove file
    let remove_result = remove_file(file_path).await;
    assert!(remove_result.is_ok());
    assert!(!test_file.exists());
}

#[tokio::test]
async fn test_create_and_remove_directory() {
    let temp_dir = tempdir().expect("Failed to create temp directory");
    let test_dir = temp_dir.path().join("new_dir");
    let dir_path = test_dir.to_string_lossy().to_string();

    // Create directory
    let create_result = create_dir_recursive(dir_path.clone()).await;
    assert!(create_result.is_ok());
    assert!(test_dir.exists() && test_dir.is_dir());

    // Remove directory
    let remove_result = remove_dir(dir_path).await;
    assert!(remove_result.is_ok());
    assert!(!test_dir.exists());
}

#[tokio::test]
async fn test_copy_file() {
    let temp_dir = tempdir().expect("Failed to create temp directory");
    let source_file = temp_dir.path().join("source.txt");
    let dest_file = temp_dir.path().join("dest.txt");

    // Create source file
    let mut file = File::create(&source_file).expect("Failed to create source file");
    writeln!(file, "Test content").expect("Failed to write to source file");

    let copy_result = copy(
        source_file.to_string_lossy().to_string(),
        dest_file.to_string_lossy().to_string(),
    ).await;

    assert!(copy_result.is_ok());
    assert!(dest_file.exists());

    // Verify content
    let dest_content = fs::read_to_string(&dest_file).expect("Failed to read dest file");
    assert!(dest_content.contains("Test content"));
}

#[tokio::test]
async fn test_move_file() {
    let temp_dir = tempdir().expect("Failed to create temp directory");
    let source_file = temp_dir.path().join("source.txt");
    let dest_file = temp_dir.path().join("moved.txt");

    // Create source file
    let mut file = File::create(&source_file).expect("Failed to create source file");
    writeln!(file, "Test content").expect("Failed to write to source file");

    let move_result = move_file(
        source_file.to_string_lossy().to_string(),
        dest_file.to_string_lossy().to_string(),
    ).await;

    assert!(move_result.is_ok());
    assert!(!source_file.exists());
    assert!(dest_file.exists());
}

#[tokio::test]
async fn test_rename() {
    let temp_dir = tempdir().expect("Failed to create temp directory");
    let old_file = temp_dir.path().join("old_name.txt");
    let new_file = temp_dir.path().join("new_name.txt");

    // Create file with old name
    File::create(&old_file).expect("Failed to create file");

    let rename_result = rename(
        old_file.to_string_lossy().to_string(),
        new_file.to_string_lossy().to_string(),
    ).await;

    assert!(rename_result.is_ok());
    assert!(!old_file.exists());
    assert!(new_file.exists());
}

#[tokio::test]
async fn test_is_dir() {
    let temp_dir = tempdir().expect("Failed to create temp directory");
    let temp_path = temp_dir.path();
    let test_file = temp_path.join("test.txt");

    // Create a test file
    File::create(&test_file).expect("Failed to create test file");

    // Test directory
    let dir_result = is_dir(temp_path.to_string_lossy().to_string()).await;
    assert!(dir_result.is_ok());
    assert!(dir_result.unwrap());

    // Test file
    let file_result = is_dir(test_file.to_string_lossy().to_string()).await;
    assert!(file_result.is_ok());
    assert!(!file_result.unwrap());
}

#[tokio::test]
async fn test_file_exist() {
    let temp_dir = tempdir().expect("Failed to create temp directory");
    let existing_file = temp_dir.path().join("exists.txt");
    let nonexistent_file = temp_dir.path().join("doesnt_exist.txt");

    // Create existing file
    File::create(&existing_file).expect("Failed to create file");

    // Test existing file
    let exists_result = file_exist(existing_file.to_string_lossy().to_string()).await;
    assert!(exists_result.is_ok());
    assert!(exists_result.unwrap());

    // Test nonexistent file
    let not_exists_result = file_exist(nonexistent_file.to_string_lossy().to_string()).await;
    assert!(not_exists_result.is_ok());
    assert!(!not_exists_result.unwrap());
}

#[tokio::test]
async fn test_read_text_file() {
    let temp_dir = tempdir().expect("Failed to create temp directory");
    let test_file = temp_dir.path().join("test.txt");

    let test_content = "Hello, world!\nThis is a test file.";
    fs::write(&test_file, test_content).expect("Failed to write test file");

    let result = read_text_file(test_file.to_string_lossy().to_string()).await;

    assert!(result.is_ok());
    let content = result.unwrap();
    assert_eq!(content, test_content);
}

#[tokio::test]
async fn test_read_binary_file() {
    let temp_dir = tempdir().expect("Failed to create temp directory");
    let test_file = temp_dir.path().join("test.bin");

    let test_data = vec![0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE];
    fs::write(&test_file, &test_data).expect("Failed to write test file");

    let result = read_binary_file(test_file.to_string_lossy().to_string()).await;

    assert!(result.is_ok());
    let data = result.unwrap();
    assert_eq!(data, test_data);
}
