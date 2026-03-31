use crate::operations::validate_file_path;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileComparisonResult {
    pub file1: FileComparisonFile,
    pub file2: FileComparisonFile,
    pub differences: Vec<FileDifference>,
    pub identical: bool,
    pub similarity: f64,
    pub comparison_type: String,
    pub metadata: ComparisonMetadata,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileComparisonFile {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: u64,
    pub hash: Option<String>,
    pub content: Option<String>,
    pub lines: Option<Vec<String>>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileDifference {
    pub diff_type: String,
    pub line1: Option<usize>,
    pub line2: Option<usize>,
    pub content1: Option<String>,
    pub content2: Option<String>,
    pub context: Option<Vec<String>>,
    pub severity: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonMetadata {
    pub processing_time: u64,
    pub lines_added: usize,
    pub lines_removed: usize,
    pub lines_modified: usize,
    pub total_lines1: usize,
    pub total_lines2: usize,
    pub bytes_different: u64,
    pub algorithm: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonOptions {
    pub ignore_whitespace: Option<bool>,
    pub ignore_case: Option<bool>,
    pub ignore_line_endings: Option<bool>,
    pub context_lines: Option<usize>,
    pub algorithm: Option<String>,
    pub max_file_size: Option<u64>,
    pub binary_threshold: Option<f64>,
}

fn compute_file_hash_sync(path: &str, algorithm: Option<&str>) -> Result<String, String> {
    let file_path = Path::new(path);
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let content = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;

    let algorithm = algorithm.unwrap_or("sha256");

    match algorithm.to_lowercase().as_str() {
        "sha256" => {
            let mut hasher = Sha256::new();
            hasher.update(&content);
            Ok(format!("{:x}", hasher.finalize()))
        }
        "md5" => {
            // MD5 is deprecated; use SHA-256 as a secure replacement
            let mut hasher = Sha256::new();
            hasher.update(&content);
            Ok(format!("{:x}", hasher.finalize()))
        }
        _ => Err(format!("Unsupported hash algorithm: {}", algorithm)),
    }
}

#[command]
pub async fn compute_file_hash(path: String, algorithm: Option<String>) -> Result<String, String> {
    validate_file_path(&path)?;

    tokio::task::spawn_blocking(move || {
        compute_file_hash_sync(&path, algorithm.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn compare_files(
    file1_path: String,
    file2_path: String,
    options: Option<ComparisonOptions>,
) -> Result<FileComparisonResult, String> {
    validate_file_path(&file1_path)?;
    validate_file_path(&file2_path)?;

    tokio::task::spawn_blocking(move || {
        let start_time = std::time::Instant::now();

        let path1 = Path::new(&file1_path);
        let path2 = Path::new(&file2_path);

        if !path1.exists() {
            return Err(format!("File does not exist: {}", file1_path));
        }
        if !path2.exists() {
            return Err(format!("File does not exist: {}", file2_path));
        }

        let opts = options.unwrap_or_else(|| ComparisonOptions {
            ignore_whitespace: Some(false),
            ignore_case: Some(false),
            ignore_line_endings: Some(false),
            context_lines: Some(3),
            algorithm: Some("myers".to_string()),
            max_file_size: Some(50 * 1024 * 1024), // 50MB
            binary_threshold: Some(0.3),
        });

        // Get file metadata
        let metadata1 = fs::metadata(path1)
            .map_err(|e| format!("Failed to get metadata for {}: {}", file1_path, e))?;
        let metadata2 = fs::metadata(path2)
            .map_err(|e| format!("Failed to get metadata for {}: {}", file2_path, e))?;

        let mut file1 = FileComparisonFile {
            path: file1_path.clone(),
            name: path1
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            size: metadata1.len(),
            modified: metadata1
                .modified()
                .map_err(|e| format!("Failed to get modified time: {}", e))?
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| format!("Failed to convert time: {}", e))?
                .as_secs(),
            hash: None,
            content: None,
            lines: None,
            error: None,
        };

        let mut file2 = FileComparisonFile {
            path: file2_path.clone(),
            name: path2
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            size: metadata2.len(),
            modified: metadata2
                .modified()
                .map_err(|e| format!("Failed to get modified time: {}", e))?
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| format!("Failed to convert time: {}", e))?
                .as_secs(),
            hash: None,
            content: None,
            lines: None,
            error: None,
        };

        // Check file size limits
        let max_size = opts.max_file_size.unwrap_or(50 * 1024 * 1024);
        if file1.size > max_size || file2.size > max_size {
            return Err(format!(
                "File too large for comparison (max: {} bytes)",
                max_size
            ));
        }

        // Quick hash comparison for identical files
        if file1.size == file2.size && file1.modified == file2.modified {
            let hash1_result = compute_file_hash_sync(&file1_path, Some("sha256"));
            let hash2_result = compute_file_hash_sync(&file2_path, Some("sha256"));

            if let (Ok(hash1), Ok(hash2)) = (hash1_result, hash2_result) {
                file1.hash = Some(hash1.clone());
                file2.hash = Some(hash2.clone());

                if hash1 == hash2 {
                    return Ok(FileComparisonResult {
                        file1,
                        file2,
                        differences: vec![],
                        identical: true,
                        similarity: 1.0,
                        comparison_type: "hash".to_string(),
                        metadata: ComparisonMetadata {
                            processing_time: start_time.elapsed().as_millis() as u64,
                            lines_added: 0,
                            lines_removed: 0,
                            lines_modified: 0,
                            total_lines1: 0,
                            total_lines2: 0,
                            bytes_different: 0,
                            algorithm: "hash".to_string(),
                        },
                    });
                }
            }
        }

        // Determine comparison type
        let comparison_type = determine_comparison_type(&file1_path, &file2_path, &opts)?;

        match comparison_type.as_str() {
            "text" => compare_text_files_sync(file1, file2, &opts, start_time),
            "binary" => compare_binary_files_sync(file1, file2, start_time),
            _ => compare_text_files_sync(file1, file2, &opts, start_time),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

fn determine_comparison_type(
    file1_path: &str,
    file2_path: &str,
    _options: &ComparisonOptions,
) -> Result<String, String> {
    let ext1 = Path::new(file1_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let ext2 = Path::new(file2_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // Binary file extensions
    let binary_exts = [
        "exe", "dll", "so", "dylib", "bin", "pdf", "doc", "docx", "jpg", "jpeg", "png", "gif",
        "bmp", "webp",
    ];

    if binary_exts.contains(&ext1.as_str()) || binary_exts.contains(&ext2.as_str()) {
        return Ok("binary".to_string());
    }

    // Default to text comparison
    Ok("text".to_string())
}

fn compare_text_files_sync(
    mut file1: FileComparisonFile,
    mut file2: FileComparisonFile,
    options: &ComparisonOptions,
    start_time: std::time::Instant,
) -> Result<FileComparisonResult, String> {
    // Read file contents
    let content1 = fs::read_to_string(&file1.path)
        .map_err(|e| format!("Failed to read file {}: {}", file1.path, e))?;
    let content2 = fs::read_to_string(&file2.path)
        .map_err(|e| format!("Failed to read file {}: {}", file2.path, e))?;

    file1.content = Some(content1.clone());
    file2.content = Some(content2.clone());

    // Split into lines and normalize
    let mut lines1: Vec<String> = content1.lines().map(|s| s.to_string()).collect();
    let mut lines2: Vec<String> = content2.lines().map(|s| s.to_string()).collect();

    if options.ignore_line_endings.unwrap_or(false) {
        lines1 = lines1
            .iter()
            .map(|line| line.trim_end_matches('\r').to_string())
            .collect();
        lines2 = lines2
            .iter()
            .map(|line| line.trim_end_matches('\r').to_string())
            .collect();
    }

    if options.ignore_whitespace.unwrap_or(false) {
        lines1 = lines1.iter().map(|line| line.trim().to_string()).collect();
        lines2 = lines2.iter().map(|line| line.trim().to_string()).collect();
    }

    if options.ignore_case.unwrap_or(false) {
        lines1 = lines1.iter().map(|line| line.to_lowercase()).collect();
        lines2 = lines2.iter().map(|line| line.to_lowercase()).collect();
    }

    file1.lines = Some(lines1.clone());
    file2.lines = Some(lines2.clone());

    // Calculate differences
    let differences =
        calculate_text_differences(&lines1, &lines2, options.context_lines.unwrap_or(3));

    // Calculate similarity
    let max_lines = lines1.len().max(lines2.len());
    let unchanged_lines = max_lines.saturating_sub(differences.len());
    let similarity = if max_lines == 0 {
        1.0
    } else {
        unchanged_lines as f64 / max_lines as f64
    };

    // Calculate metadata
    let lines_added = differences
        .iter()
        .filter(|d| d.diff_type == "added")
        .count();
    let lines_removed = differences
        .iter()
        .filter(|d| d.diff_type == "removed")
        .count();
    let lines_modified = differences
        .iter()
        .filter(|d| d.diff_type == "modified")
        .count();
    let identical = differences.is_empty();

    Ok(FileComparisonResult {
        file1,
        file2,
        differences,
        identical,
        similarity,
        comparison_type: "text".to_string(),
        metadata: ComparisonMetadata {
            processing_time: start_time.elapsed().as_millis() as u64,
            lines_added,
            lines_removed,
            lines_modified,
            total_lines1: lines1.len(),
            total_lines2: lines2.len(),
            bytes_different: (content1.len() as i64 - content2.len() as i64).unsigned_abs(),
            algorithm: options.algorithm.clone().unwrap_or("myers".to_string()),
        },
    })
}

fn compare_binary_files_sync(
    file1: FileComparisonFile,
    file2: FileComparisonFile,
    start_time: std::time::Instant,
) -> Result<FileComparisonResult, String> {
    let content1 =
        fs::read(&file1.path).map_err(|e| format!("Failed to read file {}: {}", file1.path, e))?;
    let content2 =
        fs::read(&file2.path).map_err(|e| format!("Failed to read file {}: {}", file2.path, e))?;

    let mut differences = vec![];
    let mut bytes_different = 0u64;

    // Quick size check
    if content1.len() != content2.len() {
        differences.push(FileDifference {
            diff_type: "metadata".to_string(),
            line1: None,
            line2: None,
            content1: Some(format!("Size: {} bytes", content1.len())),
            content2: Some(format!("Size: {} bytes", content2.len())),
            context: None,
            severity: "high".to_string(),
        });
        bytes_different = (content1.len() as i64 - content2.len() as i64).unsigned_abs();
    }

    // Byte-by-byte comparison (limited to first differences)
    let max_length = content1.len().min(content2.len());
    let mut first_difference_found = false;

    for i in 0..max_length.min(100) {
        // Limit to first 100 differences
        if content1[i] != content2[i] {
            if !first_difference_found {
                differences.push(FileDifference {
                    diff_type: "modified".to_string(),
                    line1: None,
                    line2: None,
                    content1: Some(format!("Byte {}: 0x{:02x}", i, content1[i])),
                    content2: Some(format!("Byte {}: 0x{:02x}", i, content2[i])),
                    context: None,
                    severity: "medium".to_string(),
                });
                first_difference_found = true;
            }
            bytes_different += 1;
        }
    }

    let identical = content1.len() == content2.len() && bytes_different == 0;
    let similarity = if max_length == 0 {
        1.0
    } else {
        (max_length as u64 - bytes_different) as f64 / max_length as f64
    };
    let lines_modified = differences
        .iter()
        .filter(|d| d.diff_type == "modified")
        .count();

    Ok(FileComparisonResult {
        file1,
        file2,
        differences,
        identical,
        similarity,
        comparison_type: "binary".to_string(),
        metadata: ComparisonMetadata {
            processing_time: start_time.elapsed().as_millis() as u64,
            lines_added: 0,
            lines_removed: 0,
            lines_modified,
            total_lines1: 0,
            total_lines2: 0,
            bytes_different,
            algorithm: "byte-comparison".to_string(),
        },
    })
}

fn calculate_text_differences(
    lines1: &[String],
    lines2: &[String],
    context_lines: usize,
) -> Vec<FileDifference> {
    let mut differences = vec![];

    // Simple line-by-line comparison (can be enhanced with proper diff algorithm)
    let max_lines = lines1.len().max(lines2.len());

    for i in 0..max_lines {
        let line1 = lines1.get(i);
        let line2 = lines2.get(i);

        match (line1, line2) {
            (None, Some(line2)) => {
                // Line added in file2
                differences.push(FileDifference {
                    diff_type: "added".to_string(),
                    line1: None,
                    line2: Some(i + 1),
                    content1: None,
                    content2: Some(line2.clone()),
                    context: Some(get_context(lines2, i, context_lines)),
                    severity: "medium".to_string(),
                });
            }
            (Some(line1), None) => {
                // Line removed from file1
                differences.push(FileDifference {
                    diff_type: "removed".to_string(),
                    line1: Some(i + 1),
                    line2: None,
                    content1: Some(line1.clone()),
                    content2: None,
                    context: Some(get_context(lines1, i, context_lines)),
                    severity: "medium".to_string(),
                });
            }
            (Some(line1), Some(line2)) if line1 != line2 => {
                // Line modified
                differences.push(FileDifference {
                    diff_type: "modified".to_string(),
                    line1: Some(i + 1),
                    line2: Some(i + 1),
                    content1: Some(line1.clone()),
                    content2: Some(line2.clone()),
                    context: Some(get_context(lines1, i, context_lines)),
                    severity: "medium".to_string(),
                });
            }
            _ => {} // Lines are identical
        }
    }

    differences
}

fn get_context(lines: &[String], line_index: usize, context_lines: usize) -> Vec<String> {
    let start = line_index.saturating_sub(context_lines);
    let end = (line_index + context_lines + 1).min(lines.len());
    lines[start..end].to_vec()
}
