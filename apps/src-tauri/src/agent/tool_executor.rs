use serde_json::{json, Value};
use std::path::Path;
use std::sync::OnceLock;

use super::memory;
use super::planner;
use super::security::{
    is_blocked_command, is_custom_blocked_command, is_network_command,
    validate_agent_path_with_permissions,
};

// ===== Configuration constants ==============================================

/// Maximum file size that `read_file` will accept (10 MB).
const READ_FILE_MAX_SIZE: u64 = 10 * 1024 * 1024;

/// Content truncation threshold for `read_file` output (bytes).
const READ_FILE_CONTENT_TRUNCATE: usize = 100_000;

/// Maximum number of results returned by `search_files` (glob).
const GLOB_RESULT_LIMIT: usize = 200;

/// Maximum allowed length for a regex pattern in `search_content`.
const REGEX_PATTERN_MAX_LEN: usize = 200;

/// Maximum compiled regex size (bytes) to prevent ReDoS.
const REGEX_COMPILED_SIZE_LIMIT: usize = 10_000;

/// Maximum number of matching lines returned by `search_content`.
const SEARCH_CONTENT_RESULT_LIMIT: usize = 100;

/// Maximum file size (bytes) that `search_content` will attempt to read.
const SEARCH_CONTENT_MAX_FILE_SIZE: u64 = 1_000_000;

/// Maximum directory depth for recursive walks in `search_content`.
const SEARCH_CONTENT_MAX_DEPTH: u32 = 5;

/// Maximum command output size (bytes) before truncation.
const COMMAND_OUTPUT_TRUNCATE: usize = 50_000;

/// Default result limit for `search_indexed`.
const SEARCH_INDEXED_DEFAULT_LIMIT: usize = 20;

/// Maximum number of results displayed by `search_indexed`.
const SEARCH_INDEXED_DISPLAY_CAP: usize = 30;

// ============================================================================

use super::truncate_to_char_boundary;

/// Validate a path using both system defaults and user-configured permissions.
fn validate_path_with_perms(path: &str) -> Result<(), String> {
    let perms = super::load_permissions();
    validate_agent_path_with_permissions(path, &perms.allowed_paths, &perms.blocked_paths)
}

pub fn execute_read_file(input: &Value) -> Result<String, String> {
    let path = input["path"].as_str().ok_or("Missing 'path' parameter")?;
    validate_path_with_perms(path)?;
    let file_size = std::fs::metadata(path)
        .map_err(|e| format!("Failed to get metadata for '{}': {}", path, e))?
        .len();
    if file_size > READ_FILE_MAX_SIZE {
        return Err(format!(
            "File '{}' is too large ({} bytes, max {} bytes)",
            path, file_size, READ_FILE_MAX_SIZE
        ));
    }
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
    // Truncate very large files
    if content.len() > READ_FILE_CONTENT_TRUNCATE {
        Ok(format!(
            "{}...\n\n[Truncated: file is {} bytes total]",
            truncate_to_char_boundary(&content, READ_FILE_CONTENT_TRUNCATE),
            content.len()
        ))
    } else {
        Ok(content)
    }
}

pub fn execute_list_directory(input: &Value) -> Result<String, String> {
    let path = input["path"].as_str().ok_or("Missing 'path' parameter")?;
    validate_path_with_perms(path)?;
    let entries = std::fs::read_dir(path)
        .map_err(|e| format!("Failed to read directory '{}': {}", path, e))?;

    let mut items: Vec<Value> = Vec::new();
    for entry in entries.flatten() {
        let meta = entry.metadata().ok();
        items.push(json!({
            "name": entry.file_name().to_string_lossy(),
            "is_dir": meta.as_ref().map(|m| m.is_dir()).unwrap_or(false),
            "size": meta.as_ref().map(|m| m.len()).unwrap_or(0),
        }));
    }
    serde_json::to_string_pretty(&items).map_err(|e| e.to_string())
}

pub fn execute_search_files(input: &Value) -> Result<String, String> {
    let pattern = input["pattern"]
        .as_str()
        .ok_or("Missing 'pattern' parameter")?;
    let base_path = input["path"].as_str().ok_or("Missing 'path' parameter")?;

    let full_pattern = format!(
        "{}{}{}",
        base_path.replace('\\', "/"),
        if base_path.ends_with('/') || base_path.ends_with('\\') {
            ""
        } else {
            "/"
        },
        pattern
    );

    let mut results: Vec<String> = Vec::new();
    for entry in glob::glob(&full_pattern).map_err(|e| format!("Invalid glob: {}", e))? {
        if let Ok(path) = entry {
            results.push(path.display().to_string());
            if results.len() >= GLOB_RESULT_LIMIT {
                results.push(format!("[...truncated at {} results]", GLOB_RESULT_LIMIT));
                break;
            }
        }
    }
    Ok(results.join("\n"))
}

/// Maximum directory depth for recursive walks (prevents runaway recursion).
const WALK_MAX_DEPTH: u32 = 20;
/// Maximum number of file entries collected per walk (prevents unbounded memory use).
const WALK_MAX_FILES: usize = 10_000;

fn walk_recursive(dir: &Path, depth: u32, max_depth: u32, entries: &mut Vec<std::path::PathBuf>) {
    if depth > max_depth || depth > WALK_MAX_DEPTH {
        return;
    }
    if entries.len() >= WALK_MAX_FILES {
        return;
    }
    if let Ok(read_dir) = std::fs::read_dir(dir) {
        for entry in read_dir.flatten() {
            if entries.len() >= WALK_MAX_FILES {
                return;
            }
            let path = entry.path();
            entries.push(path.clone());
            if path.is_dir() {
                walk_recursive(&path, depth + 1, max_depth, entries);
            }
        }
    }
}

pub fn execute_search_content(input: &Value) -> Result<String, String> {
    let pattern_str = input["pattern"]
        .as_str()
        .ok_or("Missing 'pattern' parameter")?;
    let dir_path = input["path"].as_str().ok_or("Missing 'path' parameter")?;

    if pattern_str.len() > REGEX_PATTERN_MAX_LEN {
        return Err(format!(
            "Regex pattern too long (max {} characters)",
            REGEX_PATTERN_MAX_LEN
        ));
    }
    // Reject patterns with nested quantifiers that could cause catastrophic backtracking
    static NESTED_QUANTIFIER_RE: OnceLock<regex::Regex> = OnceLock::new();
    let nested_re = NESTED_QUANTIFIER_RE.get_or_init(|| {
        regex::Regex::new(r"(\([^)]*[+*?][^)]*\)|[+*?]\{)[+*?]")
            .expect("hardcoded nested-quantifier regex is valid")
    });
    if nested_re.is_match(pattern_str) {
        return Err(
            "Regex pattern contains nested quantifiers which could cause excessive backtracking"
                .to_string(),
        );
    }
    let re = regex::RegexBuilder::new(pattern_str)
        .size_limit(REGEX_COMPILED_SIZE_LIMIT)
        .build()
        .map_err(|e| format!("Invalid regex '{}': {}", pattern_str, e))?;

    let mut results: Vec<Value> = Vec::new();
    let mut entries = Vec::new();
    walk_recursive(
        Path::new(dir_path),
        0,
        SEARCH_CONTENT_MAX_DEPTH,
        &mut entries,
    );

    for path in &entries {
        if results.len() >= SEARCH_CONTENT_RESULT_LIMIT {
            break;
        }
        if !path.is_file() {
            continue;
        }
        if let Ok(meta) = path.metadata() {
            if meta.len() > SEARCH_CONTENT_MAX_FILE_SIZE {
                continue;
            }
        }
        if let Ok(content) = std::fs::read_to_string(path) {
            for (line_num, line) in content.lines().enumerate() {
                if re.is_match(line) {
                    results.push(json!({
                        "file": path.display().to_string(),
                        "line": line_num + 1,
                        "content": line.trim(),
                    }));
                    if results.len() >= SEARCH_CONTENT_RESULT_LIMIT {
                        break;
                    }
                }
            }
        }
    }
    serde_json::to_string_pretty(&results).map_err(|e| e.to_string())
}

pub fn execute_get_system_info() -> Result<String, String> {
    let info = json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY,
        "hostname": hostname::get().map(|h| h.to_string_lossy().to_string()).unwrap_or_default(),
        "current_dir": std::env::current_dir().map(|p| p.display().to_string()).unwrap_or_default(),
        "time": chrono::Local::now().to_rfc3339(),
    });
    serde_json::to_string_pretty(&info).map_err(|e| e.to_string())
}

pub fn execute_write_file(input: &Value) -> Result<String, String> {
    let path = input["path"].as_str().ok_or("Missing 'path' parameter")?;
    validate_path_with_perms(path)?;
    let content = input["content"]
        .as_str()
        .ok_or("Missing 'content' parameter")?;

    // Ensure parent directory exists
    if let Some(parent) = Path::new(path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }
    std::fs::write(path, content).map_err(|e| format!("Failed to write file '{}': {}", path, e))?;
    Ok(format!(
        "Successfully wrote {} bytes to {}",
        content.len(),
        path
    ))
}

pub fn execute_create_directory(input: &Value) -> Result<String, String> {
    let path = input["path"].as_str().ok_or("Missing 'path' parameter")?;
    validate_path_with_perms(path)?;
    std::fs::create_dir_all(path)
        .map_err(|e| format!("Failed to create directory '{}': {}", path, e))?;
    Ok(format!("Successfully created directory: {}", path))
}

pub fn execute_rename(input: &Value) -> Result<String, String> {
    let old_path = input["old_path"]
        .as_str()
        .ok_or("Missing 'old_path' parameter")?;
    let new_path = input["new_path"]
        .as_str()
        .ok_or("Missing 'new_path' parameter")?;
    validate_path_with_perms(old_path)?;
    validate_path_with_perms(new_path)?;
    std::fs::rename(old_path, new_path)
        .map_err(|e| format!("Failed to rename '{}' to '{}': {}", old_path, new_path, e))?;
    Ok(format!("Successfully renamed {} to {}", old_path, new_path))
}

pub fn execute_delete(input: &Value) -> Result<String, String> {
    let path = input["path"].as_str().ok_or("Missing 'path' parameter")?;
    validate_path_with_perms(path)?;
    trash::delete(path).map_err(|e| format!("Failed to move '{}' to trash: {}", path, e))?;
    Ok(format!("Successfully moved {} to trash", path))
}

pub fn execute_move_file(input: &Value) -> Result<String, String> {
    let source = input["source"]
        .as_str()
        .ok_or("Missing 'source' parameter")?;
    let dest = input["destination"]
        .as_str()
        .ok_or("Missing 'destination' parameter")?;
    validate_path_with_perms(source)?;
    validate_path_with_perms(dest)?;
    std::fs::rename(source, dest)
        .map_err(|e| format!("Failed to move '{}' to '{}': {}", source, dest, e))?;
    Ok(format!("Successfully moved {} to {}", source, dest))
}

pub fn execute_copy_file(input: &Value) -> Result<String, String> {
    let source = input["source"]
        .as_str()
        .ok_or("Missing 'source' parameter")?;
    let dest = input["destination"]
        .as_str()
        .ok_or("Missing 'destination' parameter")?;
    validate_path_with_perms(source)?;
    validate_path_with_perms(dest)?;

    let src_path = Path::new(source);
    if src_path.is_dir() {
        copy_dir_recursive(src_path, Path::new(dest))?;
    } else {
        if let Some(parent) = Path::new(dest).parent() {
            std::fs::create_dir_all(parent).ok();
        }
        std::fs::copy(source, dest)
            .map_err(|e| format!("Failed to copy '{}' to '{}': {}", source, dest, e))?;
    }
    Ok(format!("Successfully copied {} to {}", source, dest))
}

use crate::operations::file_ops::copy_dir_recursive;

pub fn execute_command(input: &Value) -> Result<String, String> {
    let cmd = input["command"]
        .as_str()
        .ok_or("Missing 'command' parameter")?;
    let working_dir = input["working_dir"].as_str();

    // Validate command against blocklist
    if let Some(reason) = is_blocked_command(cmd) {
        return Err(format!(
            "Command blocked for safety: '{}'. Reason: {}. Use the dedicated file operation tools instead.",
            cmd, reason
        ));
    }

    // Check custom blocked commands from user permissions
    let perms = super::load_permissions();
    if let Some(reason) = is_custom_blocked_command(cmd, &perms.custom_blocked_commands) {
        return Err(format!(
            "Command blocked by user permissions: '{}'. Reason: {}",
            cmd, reason
        ));
    }

    // Internet sandbox — block network-capable commands
    if perms.block_internet {
        if let Some(reason) = is_network_command(cmd) {
            return Err(format!(
                "Command blocked by internet sandbox: '{}'. Reason: {}. Disable 'Block Internet' in Permissions to allow.",
                cmd, reason
            ));
        }
    }

    let mut command = if cfg!(target_os = "windows") {
        let mut c = std::process::Command::new("cmd");
        c.args(["/C", cmd]);
        c
    } else {
        let mut c = std::process::Command::new("sh");
        c.args(["-c", cmd]);
        c
    };

    if let Some(dir) = working_dir {
        validate_path_with_perms(dir)?;
        command.current_dir(dir);
    }

    let output = command
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    // Truncate long output
    let stdout_display = if stdout.len() > COMMAND_OUTPUT_TRUNCATE {
        format!(
            "{}...\n[truncated]",
            truncate_to_char_boundary(&stdout, COMMAND_OUTPUT_TRUNCATE)
        )
    } else {
        stdout
    };

    let result = json!({
        "exit_code": output.status.code().unwrap_or(-1),
        "stdout": stdout_display,
        "stderr": stderr,
    });
    serde_json::to_string_pretty(&result).map_err(|e| e.to_string())
}

/// Extract text from document files (PDF, DOCX, XLSX, PPTX).
pub fn execute_extract_document_text(input: &Value) -> Result<String, String> {
    let path_str = input["path"].as_str().ok_or("Missing 'path' parameter")?;

    validate_path_with_perms(path_str)?;

    let path = Path::new(path_str);
    if !path.exists() {
        return Err(format!("File not found: {}", path_str));
    }
    if path.is_dir() {
        return Err("Path is a directory, not a file".to_string());
    }

    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    if !matches!(
        ext.as_str(),
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "rtf"
    ) {
        return Err(format!(
            "Unsupported document format: .{}. Supported: .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .rtf",
            ext
        ));
    }

    let text = crate::document_extractor::extract_text(path_str)?;

    // Truncate very large documents
    let truncated = if text.len() > READ_FILE_CONTENT_TRUNCATE {
        let cut: String = text.chars().take(READ_FILE_CONTENT_TRUNCATE).collect();
        format!(
            "{}\n\n[... truncated — document has {} total characters]",
            cut,
            text.len()
        )
    } else {
        text
    };

    let output = json!({
        "path": path_str,
        "format": ext,
        "content": truncated,
    });
    serde_json::to_string_pretty(&output).map_err(|e| e.to_string())
}

pub fn execute_search_indexed(input: &Value) -> Result<String, String> {
    let query = input["query"]
        .as_str()
        .ok_or("Missing 'query' parameter")?
        .to_string();
    let limit = input["limit"].as_u64().map(|n| n as usize);

    let results = crate::search::compat::get_search_engine().natural_language_search(
        &query,
        None,
        limit.unwrap_or(SEARCH_INDEXED_DEFAULT_LIMIT),
    );

    let output = json!({
        "result_count": results.len(),
        "note": "Results from pre-built file index. May not include very recent files.",
        "results": results.iter().take(SEARCH_INDEXED_DISPLAY_CAP).map(|r| {
            json!({
                "path": r.path,
                "filename": r.filename,
                "score": r.score,
                "relevance": r.relevance_type,
            })
        }).collect::<Vec<_>>(),
    });
    serde_json::to_string_pretty(&output).map_err(|e| e.to_string())
}

/// Route a tool call to its executor function.
pub fn execute_tool(name: &str, input: &Value) -> Result<String, String> {
    match name {
        "read_file" => execute_read_file(input),
        "list_directory" => execute_list_directory(input),
        "search_files" => execute_search_files(input),
        "search_content" => execute_search_content(input),
        "get_system_info" => execute_get_system_info(),
        "write_file" => execute_write_file(input),
        "create_directory" => execute_create_directory(input),
        "rename" => execute_rename(input),
        "delete" => execute_delete(input),
        "move_file" => execute_move_file(input),
        "copy_file" => execute_copy_file(input),
        "execute_command" => execute_command(input),
        "search_indexed" => execute_search_indexed(input),
        "extract_document_text" => execute_extract_document_text(input),
        "create_plan" => planner::execute_create_plan(input),
        "execute_plan" => planner::execute_execute_plan(input),
        "remember" => memory::execute_remember(input),
        "recall" => memory::execute_recall(input),
        _ => Err(format!("Unknown tool: {}", name)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ─── truncate_to_char_boundary ──────────────────────────────────────

    #[test]
    fn truncate_ascii_within_limit() {
        assert_eq!(truncate_to_char_boundary("hello", 10), "hello");
    }

    #[test]
    fn truncate_ascii_at_boundary() {
        assert_eq!(truncate_to_char_boundary("hello world", 5), "hello");
    }

    #[test]
    fn truncate_empty_string() {
        assert_eq!(truncate_to_char_boundary("", 0), "");
        assert_eq!(truncate_to_char_boundary("", 100), "");
    }

    #[test]
    fn truncate_multibyte_avoids_mid_char_split() {
        // e-acute (\u{00E9}) is 2 bytes in UTF-8: "caf\u{00E9}" = 5 bytes
        let s = "caf\u{00E9}!";
        // Truncate at byte 4 lands inside the 2-byte e-acute; should back up to byte 3 ("caf")
        let result = truncate_to_char_boundary(s, 4);
        assert!(result.is_char_boundary(result.len()));
        assert_eq!(result, "caf");
        // Truncate at byte 5 should include the full e-acute
        let result2 = truncate_to_char_boundary(s, 5);
        assert_eq!(result2, "caf\u{00E9}");
    }

    #[test]
    fn truncate_emoji() {
        // Emoji is 4 bytes
        let s = "A\u{1F600}B";
        // Byte 1 is 'A', bytes 2-5 are the emoji, byte 6 is 'B'
        // Truncate at 3 should back up to after 'A' (byte 1)
        let result = truncate_to_char_boundary(s, 3);
        assert!(std::str::from_utf8(result.as_bytes()).is_ok());
    }

    // ─── execute_tool routing ───────────────────────────────────────────

    #[test]
    fn execute_tool_unknown_returns_error() {
        let input = json!({});
        let result = execute_tool("nonexistent_tool", &input);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Unknown tool: nonexistent_tool"));
    }

    #[test]
    fn execute_tool_routes_read_file() {
        // Missing path should produce a specific error from execute_read_file
        let input = json!({});
        let result = execute_tool("read_file", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'path' parameter");
    }

    #[test]
    fn execute_tool_routes_list_directory() {
        let input = json!({});
        let result = execute_tool("list_directory", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'path' parameter");
    }

    #[test]
    fn execute_tool_routes_search_files() {
        let input = json!({});
        let result = execute_tool("search_files", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'pattern' parameter");
    }

    #[test]
    fn execute_tool_routes_search_content() {
        let input = json!({});
        let result = execute_tool("search_content", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'pattern' parameter");
    }

    #[test]
    fn execute_tool_routes_write_file() {
        let input = json!({});
        let result = execute_tool("write_file", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'path' parameter");
    }

    #[test]
    fn execute_tool_routes_create_directory() {
        let input = json!({});
        let result = execute_tool("create_directory", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'path' parameter");
    }

    #[test]
    fn execute_tool_routes_rename() {
        let input = json!({});
        let result = execute_tool("rename", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'old_path' parameter");
    }

    #[test]
    fn execute_tool_routes_delete() {
        let input = json!({});
        let result = execute_tool("delete", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'path' parameter");
    }

    #[test]
    fn execute_tool_routes_move_file() {
        let input = json!({});
        let result = execute_tool("move_file", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'source' parameter");
    }

    #[test]
    fn execute_tool_routes_copy_file() {
        let input = json!({});
        let result = execute_tool("copy_file", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'source' parameter");
    }

    #[test]
    fn execute_tool_routes_execute_command() {
        let input = json!({});
        let result = execute_tool("execute_command", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'command' parameter");
    }

    #[test]
    fn execute_tool_routes_create_plan() {
        let input = json!({});
        let result = execute_tool("create_plan", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'title' parameter");
    }

    #[test]
    fn execute_tool_routes_execute_plan() {
        let input = json!({});
        let result = execute_tool("execute_plan", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'plan_id' parameter");
    }

    // ─── execute_read_file ──────────────────────────────────────────────

    #[test]
    fn read_file_missing_path() {
        let input = json!({});
        let result = execute_read_file(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'path' parameter");
    }

    #[test]
    fn read_file_path_is_null_value() {
        let input = json!({"path": null});
        let result = execute_read_file(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'path' parameter");
    }

    #[test]
    fn read_file_nonexistent_path() {
        let input = json!({"path": "/tmp/__nonexistent_test_file_12345__.txt"});
        let result = execute_read_file(&input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to get metadata"));
    }

    #[test]
    fn read_file_reads_small_file() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        std::fs::write(&file_path, "hello world").unwrap();

        let input = json!({"path": file_path.to_str().unwrap()});
        let result = execute_read_file(&input);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "hello world");
    }

    #[test]
    fn read_file_rejects_file_exceeding_max_size() {
        // Create a file that reports as too large.
        // We only need the metadata check to fail, so create a real file
        // slightly over the limit.  To avoid writing 10 MB in a test we
        // instead test the error message pattern by creating a sparse file.
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("bigfile.bin");

        // Create a file that is exactly READ_FILE_MAX_SIZE + 1 bytes
        let f = std::fs::File::create(&file_path).unwrap();
        f.set_len(READ_FILE_MAX_SIZE + 1).unwrap();

        let input = json!({"path": file_path.to_str().unwrap()});
        let result = execute_read_file(&input);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("too large"),
            "Expected 'too large' in error: {}",
            err
        );
        assert!(err.contains(&(READ_FILE_MAX_SIZE + 1).to_string()));
    }

    #[test]
    fn read_file_truncates_large_content() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("large.txt");
        // Create a file with content larger than READ_FILE_CONTENT_TRUNCATE
        // but smaller than READ_FILE_MAX_SIZE
        let content = "A".repeat(READ_FILE_CONTENT_TRUNCATE + 500);
        std::fs::write(&file_path, &content).unwrap();

        let input = json!({"path": file_path.to_str().unwrap()});
        let result = execute_read_file(&input).unwrap();
        assert!(result.contains("[Truncated:"));
        assert!(result.len() < content.len() + 100); // truncated output < original
    }

    // ─── execute_search_files ───────────────────────────────────────────

    #[test]
    fn search_files_missing_pattern() {
        let input = json!({"path": "/tmp"});
        let result = execute_search_files(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'pattern' parameter");
    }

    #[test]
    fn search_files_missing_path() {
        let input = json!({"pattern": "*.txt"});
        let result = execute_search_files(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'path' parameter");
    }

    #[test]
    fn search_files_caps_at_glob_result_limit() {
        // Create more files than GLOB_RESULT_LIMIT
        let dir = tempfile::tempdir().unwrap();
        for i in 0..(GLOB_RESULT_LIMIT + 10) {
            std::fs::write(dir.path().join(format!("file_{}.txt", i)), "x").unwrap();
        }

        let input = json!({
            "pattern": "*.txt",
            "path": dir.path().to_str().unwrap()
        });
        let result = execute_search_files(&input).unwrap();
        let lines: Vec<&str> = result.lines().collect();
        // Should be GLOB_RESULT_LIMIT results + 1 truncation message
        assert!(
            lines.len() <= GLOB_RESULT_LIMIT + 1,
            "Expected at most {} lines, got {}",
            GLOB_RESULT_LIMIT + 1,
            lines.len()
        );
        assert!(
            result.contains("[...truncated at"),
            "Should contain truncation message"
        );
    }

    #[test]
    fn search_files_returns_matches() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.txt"), "hello").unwrap();
        std::fs::write(dir.path().join("b.rs"), "world").unwrap();

        let input = json!({
            "pattern": "*.txt",
            "path": dir.path().to_str().unwrap()
        });
        let result = execute_search_files(&input).unwrap();
        assert!(result.contains("a.txt"), "Should find a.txt");
        assert!(!result.contains("b.rs"), "Should not find b.rs");
    }

    // ─── execute_search_content ─────────────────────────────────────────

    #[test]
    fn search_content_rejects_long_regex() {
        let long_pattern = "a".repeat(REGEX_PATTERN_MAX_LEN + 1);
        let dir = tempfile::tempdir().unwrap();
        let input = json!({
            "pattern": long_pattern,
            "path": dir.path().to_str().unwrap()
        });
        let result = execute_search_content(&input);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("too long"),
            "Expected 'too long' in error: {}",
            err
        );
    }

    #[test]
    fn search_content_rejects_pattern_at_boundary() {
        // Exactly at the limit should be OK
        let ok_pattern = "a".repeat(REGEX_PATTERN_MAX_LEN);
        let dir = tempfile::tempdir().unwrap();
        let input = json!({
            "pattern": ok_pattern,
            "path": dir.path().to_str().unwrap()
        });
        let result = execute_search_content(&input);
        // Should not error about length (may error about something else or succeed)
        if let Err(e) = &result {
            assert!(
                !e.contains("too long"),
                "Pattern at exact max length should not be rejected for length"
            );
        }
    }

    #[test]
    fn search_content_rejects_nested_quantifiers() {
        let dir = tempfile::tempdir().unwrap();
        let input = json!({
            "pattern": "(a+)+",
            "path": dir.path().to_str().unwrap()
        });
        let result = execute_search_content(&input);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("nested quantifiers"),
            "Expected 'nested quantifiers' in error: {}",
            err
        );
    }

    #[test]
    fn search_content_rejects_invalid_regex() {
        let dir = tempfile::tempdir().unwrap();
        let input = json!({
            "pattern": "[invalid",
            "path": dir.path().to_str().unwrap()
        });
        let result = execute_search_content(&input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid regex"));
    }

    #[test]
    fn search_content_missing_pattern() {
        let input = json!({"path": "/tmp"});
        let result = execute_search_content(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'pattern' parameter");
    }

    #[test]
    fn search_content_missing_path() {
        let input = json!({"pattern": "hello"});
        let result = execute_search_content(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'path' parameter");
    }

    #[test]
    fn search_content_finds_matching_lines() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("test.txt"),
            "line one\nfoo bar\nline three\n",
        )
        .unwrap();

        let input = json!({
            "pattern": "foo",
            "path": dir.path().to_str().unwrap()
        });
        let result = execute_search_content(&input).unwrap();
        let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0]["content"], "foo bar");
        assert_eq!(parsed[0]["line"], 2);
    }

    #[test]
    fn search_content_returns_empty_for_no_matches() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("test.txt"), "hello world\n").unwrap();

        let input = json!({
            "pattern": "zzz_no_match",
            "path": dir.path().to_str().unwrap()
        });
        let result = execute_search_content(&input).unwrap();
        let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();
        assert!(parsed.is_empty());
    }

    // ─── execute_list_directory ──────────────────────────────────────────

    #[test]
    fn list_directory_missing_path() {
        let input = json!({});
        let result = execute_list_directory(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'path' parameter");
    }

    #[test]
    fn list_directory_lists_entries() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.txt"), "").unwrap();
        std::fs::create_dir(dir.path().join("subdir")).unwrap();

        let input = json!({"path": dir.path().to_str().unwrap()});
        let result = execute_list_directory(&input).unwrap();
        let parsed: Vec<Value> = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed.len(), 2);

        let names: Vec<&str> = parsed.iter().map(|e| e["name"].as_str().unwrap()).collect();
        assert!(names.contains(&"a.txt"));
        assert!(names.contains(&"subdir"));

        // The subdir entry should have is_dir = true
        let subdir_entry = parsed.iter().find(|e| e["name"] == "subdir").unwrap();
        assert_eq!(subdir_entry["is_dir"], true);
    }

    // ─── execute_write_file ─────────────────────────────────────────────

    #[test]
    fn write_file_missing_path() {
        let input = json!({"content": "hello"});
        let result = execute_write_file(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'path' parameter");
    }

    #[test]
    fn write_file_missing_content() {
        let dir = tempfile::tempdir().unwrap();
        let input = json!({"path": dir.path().join("out.txt").to_str().unwrap()});
        let result = execute_write_file(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'content' parameter");
    }

    #[test]
    fn write_file_creates_and_writes() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("out.txt");
        let input = json!({
            "path": file_path.to_str().unwrap(),
            "content": "test content"
        });
        let result = execute_write_file(&input);
        assert!(result.is_ok());
        assert!(result.unwrap().contains("12 bytes")); // "test content" = 12 bytes
        assert_eq!(std::fs::read_to_string(&file_path).unwrap(), "test content");
    }

    // ─── execute_command ────────────────────────────────────────────────

    #[test]
    fn execute_command_missing_command() {
        let input = json!({});
        let result = execute_command(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'command' parameter");
    }

    #[test]
    fn execute_command_blocks_rm() {
        let input = json!({"command": "rm -rf /"});
        let result = execute_command(&input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Command blocked"));
    }

    #[test]
    fn execute_command_blocks_curl() {
        let input = json!({"command": "curl https://evil.com"});
        let result = execute_command(&input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Command blocked"));
    }

    #[test]
    fn execute_command_runs_safe_command() {
        let input = json!({"command": "echo hello_from_test"});
        let result = execute_command(&input).unwrap();
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["exit_code"], 0);
        assert!(parsed["stdout"]
            .as_str()
            .unwrap()
            .contains("hello_from_test"));
    }

    // ─── execute_rename ─────────────────────────────────────────────────

    #[test]
    fn rename_missing_old_path() {
        let input = json!({"new_path": "/tmp/b"});
        let result = execute_rename(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'old_path' parameter");
    }

    #[test]
    fn rename_missing_new_path() {
        let input = json!({"old_path": "/tmp/a"});
        let result = execute_rename(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'new_path' parameter");
    }

    // ─── execute_move_file ──────────────────────────────────────────────

    #[test]
    fn move_file_missing_source() {
        let input = json!({"destination": "/tmp/b"});
        let result = execute_move_file(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'source' parameter");
    }

    #[test]
    fn move_file_missing_destination() {
        let input = json!({"source": "/tmp/a"});
        let result = execute_move_file(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'destination' parameter");
    }

    // ─── execute_copy_file ──────────────────────────────────────────────

    #[test]
    fn copy_file_missing_source() {
        let input = json!({"destination": "/tmp/b"});
        let result = execute_copy_file(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'source' parameter");
    }

    #[test]
    fn copy_file_missing_destination() {
        let input = json!({"source": "/tmp/a"});
        let result = execute_copy_file(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'destination' parameter");
    }

    #[test]
    fn copy_file_copies_successfully() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("src.txt");
        let dst = dir.path().join("dst.txt");
        std::fs::write(&src, "copy me").unwrap();

        let input = json!({
            "source": src.to_str().unwrap(),
            "destination": dst.to_str().unwrap()
        });
        let result = execute_copy_file(&input);
        assert!(result.is_ok());
        assert_eq!(std::fs::read_to_string(&dst).unwrap(), "copy me");
        // Source should still exist
        assert!(src.exists());
    }

    // ─── execute_create_directory ───────────────────────────────────────

    #[test]
    fn create_directory_creates_nested() {
        let dir = tempfile::tempdir().unwrap();
        let nested = dir.path().join("a").join("b").join("c");

        let input = json!({"path": nested.to_str().unwrap()});
        let result = execute_create_directory(&input);
        assert!(result.is_ok());
        assert!(nested.is_dir());
    }

    // ─── execute_get_system_info ────────────────────────────────────────

    #[test]
    fn get_system_info_returns_valid_json() {
        let result = execute_get_system_info().unwrap();
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert!(parsed["os"].is_string());
        assert!(parsed["arch"].is_string());
        assert!(parsed["family"].is_string());
        assert!(parsed["time"].is_string());
    }

    // ─── walk_recursive ─────────────────────────────────────────────────

    #[test]
    fn walk_recursive_respects_max_depth() {
        let dir = tempfile::tempdir().unwrap();
        // Create a structure: base/d1/d2/d3/file.txt
        let d3 = dir.path().join("d1").join("d2").join("d3");
        std::fs::create_dir_all(&d3).unwrap();
        std::fs::write(d3.join("file.txt"), "deep").unwrap();

        let mut entries = Vec::new();
        walk_recursive(dir.path(), 0, 1, &mut entries);
        // With max_depth=1, we should see d1 and d1/d2 but NOT d1/d2/d3 or d1/d2/d3/file.txt
        let has_d3_file = entries.iter().any(|p| p.ends_with("file.txt"));
        assert!(
            !has_d3_file,
            "walk_recursive with max_depth=1 should not reach depth-3 file"
        );
    }
}
