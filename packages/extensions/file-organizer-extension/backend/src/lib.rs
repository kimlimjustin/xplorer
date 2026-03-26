//! File Organizer WASM Backend
//!
//! Compiled to `wasm32-unknown-unknown` and loaded by the Xplorer wasmi runtime.
//! Analyzes directories, categorizes files by extension/type, suggests folder
//! structures, and can move files into organized directories via host functions.
//!
//! ## Protocol
//!
//! The host runtime calls `handle_call(method_ptr, method_len, args_ptr, args_len)`
//! with a method name and JSON arguments. Returns a length-prefixed JSON result.

use serde::Serialize;
use std::collections::HashMap;

// ─── Host function imports ──────────────────────────────────────────────────

#[allow(dead_code)]
extern "C" {
    fn host_list_dir(path_ptr: i32, path_len: i32) -> i32;
    fn host_read_file(path_ptr: i32, path_len: i32) -> i32;
    fn host_write_file(path_ptr: i32, path_len: i32, data_ptr: i32, data_len: i32) -> i32;
    fn host_file_exists(path_ptr: i32, path_len: i32) -> i32;
    fn host_get_result_len() -> i32;
    fn host_read_result(buf_ptr: i32, buf_len: i32) -> i32;
}

// ─── Memory management exports ──────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn alloc(size: i32) -> i32 {
    let layout = std::alloc::Layout::from_size_align(size as usize, 1).unwrap();
    unsafe { std::alloc::alloc(layout) as i32 }
}

#[no_mangle]
pub extern "C" fn dealloc(ptr: i32, size: i32) {
    let layout = std::alloc::Layout::from_size_align(size as usize, 1).unwrap();
    unsafe { std::alloc::dealloc(ptr as *mut u8, layout) }
}

// ─── Result helpers ─────────────────────────────────────────────────────────

fn write_result(json: &str) -> i32 {
    let bytes = json.as_bytes();
    let total = 4 + bytes.len();
    let ptr = alloc(total as i32);
    let dst = ptr as *mut u8;
    unsafe {
        let len_bytes = (bytes.len() as i32).to_le_bytes();
        core::ptr::copy_nonoverlapping(len_bytes.as_ptr(), dst, 4);
        core::ptr::copy_nonoverlapping(bytes.as_ptr(), dst.add(4), bytes.len());
    }
    ptr
}

fn error_result(msg: &str) -> i32 {
    let escaped = msg.replace('\\', "\\\\").replace('"', "\\\"");
    let json = format!(r#"{{"error":"{}"}}"#, escaped);
    write_result(&json)
}

fn ok_result(value: &str) -> i32 {
    let json = format!(r#"{{"ok":{}}}"#, value);
    write_result(&json)
}

fn read_guest_str(ptr: i32, len: i32) -> &'static str {
    unsafe {
        let slice = core::slice::from_raw_parts(ptr as *const u8, len as usize);
        core::str::from_utf8_unchecked(slice)
    }
}

// ─── Host function wrappers ─────────────────────────────────────────────────

fn call_host_with_string(
    host_fn: unsafe extern "C" fn(i32, i32) -> i32,
    input: &str,
) -> Result<serde_json::Value, String> {
    let input_bytes = input.as_bytes();
    let input_ptr = alloc(input_bytes.len() as i32);
    unsafe {
        core::ptr::copy_nonoverlapping(
            input_bytes.as_ptr(),
            input_ptr as *mut u8,
            input_bytes.len(),
        );
    }

    let status = unsafe { host_fn(input_ptr, input_bytes.len() as i32) };
    dealloc(input_ptr, input_bytes.len() as i32);

    let result_len = unsafe { host_get_result_len() };
    if result_len <= 0 {
        return Err("Host function returned empty result".to_string());
    }

    let buf_ptr = alloc(result_len);
    let copied = unsafe { host_read_result(buf_ptr, result_len) };
    if copied <= 0 {
        dealloc(buf_ptr, result_len);
        return Err("Failed to read host result".to_string());
    }

    let result_str = unsafe {
        let slice = core::slice::from_raw_parts(buf_ptr as *const u8, copied as usize);
        core::str::from_utf8(slice)
            .map_err(|e| format!("Result is not valid UTF-8: {}", e))?
            .to_string()
    };
    dealloc(buf_ptr, result_len);

    if status < 0 {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&result_str) {
            if let Some(err) = parsed.get("error").and_then(|v| v.as_str()) {
                return Err(err.to_string());
            }
        }
        return Err(format!("Host function failed: {}", result_str));
    }

    let parsed: serde_json::Value = serde_json::from_str(&result_str)
        .map_err(|e| format!("Failed to parse host result: {}", e))?;

    parsed
        .get("ok")
        .cloned()
        .ok_or_else(|| "Missing 'ok' field in host result".to_string())
}

#[derive(serde::Deserialize, Clone)]
struct DirEntry {
    name: String,
    is_dir: bool,
    size: u64,
}

fn host_list_directory(dir_path: &str) -> Result<Vec<DirEntry>, String> {
    let val = call_host_with_string(host_list_dir, dir_path)?;
    let entries: Vec<DirEntry> = serde_json::from_value(val)
        .map_err(|e| format!("Failed to parse directory listing: {}", e))?;
    Ok(entries)
}

fn host_check_exists(path: &str) -> bool {
    match call_host_with_string(host_file_exists, path) {
        Ok(val) => val.as_bool().unwrap_or(false),
        Err(_) => false,
    }
}

// ─── File categorization ────────────────────────────────────────────────────

fn categorize_extension(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "svg" | "webp" | "ico" | "tiff" | "tif"
        | "raw" | "heic" | "heif" | "avif" => "Images",
        "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" | "webm" | "m4v" | "mpg" | "mpeg"
        | "3gp" => "Videos",
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" | "m4a" | "opus" | "aiff" => "Audio",
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "odt" | "ods" | "odp"
        | "txt" | "rtf" | "md" | "tex" | "epub" => "Documents",
        "rs" | "js" | "ts" | "tsx" | "jsx" | "py" | "java" | "c" | "cpp" | "h" | "hpp"
        | "cs" | "go" | "rb" | "php" | "swift" | "kt" | "scala" | "r" | "lua" | "sh"
        | "bash" | "zsh" | "fish" | "ps1" | "bat" | "cmd" | "html" | "css" | "scss"
        | "sass" | "less" | "vue" | "svelte" => "Code",
        "zip" | "tar" | "gz" | "bz2" | "xz" | "7z" | "rar" | "iso" | "dmg" => "Archives",
        "json" | "xml" | "yaml" | "yml" | "toml" | "csv" | "tsv" | "sql" | "db" | "sqlite"
        | "parquet" => "Data",
        _ => "Other",
    }
}

fn get_extension(name: &str) -> String {
    if let Some(pos) = name.rfind('.') {
        name[pos + 1..].to_lowercase()
    } else {
        String::new()
    }
}

// ─── Types ──────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct FileCategory {
    name: String,
    file_count: u64,
    total_size: u64,
    extensions: Vec<String>,
    example_files: Vec<String>,
}

#[derive(Serialize)]
struct FolderSuggestion {
    suggested_name: String,
    target_path: String,
    files_to_move: Vec<String>,
    reason: String,
    category: String,
}

#[derive(Serialize)]
struct CategoryDistribution {
    category: String,
    count: u64,
    total_size: u64,
}

#[derive(Serialize)]
struct FileInfo {
    path: String,
    name: String,
    size: u64,
}

#[derive(Serialize)]
struct DirectoryInsights {
    total_files: u64,
    total_size: u64,
    largest_files: Vec<FileInfo>,
    type_distribution: Vec<CategoryDistribution>,
    avg_file_size: u64,
}

#[derive(Serialize)]
struct OrganizationAnalysis {
    categories: Vec<FileCategory>,
    suggestions: Vec<FolderSuggestion>,
    insights: DirectoryInsights,
    is_project: bool,
    project_type: Option<String>,
}

#[derive(Serialize)]
struct PlannedMove {
    from: String,
    to: String,
    reason: String,
}

#[derive(Serialize)]
struct OrganizationPlan {
    moves: Vec<PlannedMove>,
    creates: Vec<String>,
}

// ─── File collection ────────────────────────────────────────────────────────

struct CollectedFile {
    path: String,
    name: String,
    size: u64,
    extension: String,
    category: String,
}

fn collect_files(dir: &str, entries: &[DirEntry]) -> Vec<CollectedFile> {
    let sep = if dir.contains('\\') { "\\" } else { "/" };
    let mut files = Vec::new();

    for entry in entries {
        if entry.is_dir {
            continue;
        }
        let full_path = format!("{}{}{}", dir, sep, entry.name);
        let ext = get_extension(&entry.name);
        let category = categorize_extension(&ext).to_string();

        files.push(CollectedFile {
            path: full_path,
            name: entry.name.clone(),
            size: entry.size,
            extension: ext,
            category,
        });
    }

    files
}

// ─── Project detection ──────────────────────────────────────────────────────

fn detect_project_type(entries: &[DirEntry]) -> Option<String> {
    for entry in entries {
        if entry.is_dir {
            continue;
        }
        match entry.name.as_str() {
            "Cargo.toml" => return Some("Rust".to_string()),
            "package.json" => return Some("Node.js".to_string()),
            "go.mod" => return Some("Go".to_string()),
            "pom.xml" | "build.gradle" => return Some("Java".to_string()),
            "requirements.txt" | "setup.py" | "pyproject.toml" => {
                return Some("Python".to_string())
            }
            "Gemfile" => return Some("Ruby".to_string()),
            "CMakeLists.txt" | "Makefile" => return Some("C/C++".to_string()),
            _ => {}
        }
    }
    None
}

// ─── Main entry point ───────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn handle_call(
    method_ptr: i32,
    method_len: i32,
    args_ptr: i32,
    args_len: i32,
) -> i32 {
    let method = read_guest_str(method_ptr, method_len);
    let args_str = read_guest_str(args_ptr, args_len);

    let args: serde_json::Value = match serde_json::from_str(args_str) {
        Ok(v) => v,
        Err(e) => return error_result(&format!("Invalid JSON args: {}", e)),
    };

    match method {
        "organize_files" => handle_organize_files(&args),
        "analyze_directory" => handle_analyze_directory(&args),
        "preview_organization" => handle_preview_organization(&args),
        "__init__" => ok_result("true"),
        _ => error_result(&format!("Unknown method: {}", method)),
    }
}

// ─── Method handlers ────────────────────────────────────────────────────────

fn handle_analyze_directory(args: &serde_json::Value) -> i32 {
    let directory = match args.get("directory").and_then(|v| v.as_str()) {
        Some(d) => d,
        None => return error_result("Missing 'directory' argument"),
    };

    let entries = match host_list_directory(directory) {
        Ok(e) => e,
        Err(e) => return error_result(&format!("Failed to list directory: {}", e)),
    };

    let files = collect_files(directory, &entries);

    // Build category map
    let mut category_map: HashMap<String, Vec<&CollectedFile>> = HashMap::new();
    for file in &files {
        category_map
            .entry(file.category.clone())
            .or_default()
            .push(file);
    }

    // Build categories
    let mut categories: Vec<FileCategory> = Vec::new();
    for (cat_name, cat_files) in &category_map {
        let mut ext_set: Vec<String> = Vec::new();
        for f in cat_files {
            if !f.extension.is_empty() && !ext_set.contains(&f.extension) {
                ext_set.push(f.extension.clone());
            }
        }

        let example_files: Vec<String> = cat_files.iter().take(3).map(|f| f.name.clone()).collect();
        let total_size: u64 = cat_files.iter().map(|f| f.size).sum();

        categories.push(FileCategory {
            name: cat_name.clone(),
            file_count: cat_files.len() as u64,
            total_size,
            extensions: ext_set,
            example_files,
        });
    }

    categories.sort_by(|a, b| b.total_size.cmp(&a.total_size));

    // Build suggestions
    let sep = if directory.contains('\\') { "\\" } else { "/" };
    let mut suggestions: Vec<FolderSuggestion> = Vec::new();

    for (cat_name, cat_files) in &category_map {
        if cat_files.len() < 3 || cat_name == "Other" {
            continue;
        }

        let folder_name = cat_name.to_lowercase();
        let target_path = format!("{}{}{}", directory, sep, folder_name);

        if host_check_exists(&target_path) {
            continue;
        }

        let files_to_move: Vec<String> = cat_files.iter().map(|f| f.path.clone()).collect();

        suggestions.push(FolderSuggestion {
            suggested_name: folder_name.clone(),
            target_path,
            files_to_move,
            reason: format!(
                "Move {} {} files into a '{}' folder",
                cat_files.len(),
                cat_name,
                folder_name
            ),
            category: cat_name.clone(),
        });
    }

    // Build insights
    let total_files = files.len() as u64;
    let total_size: u64 = files.iter().map(|f| f.size).sum();
    let avg_file_size = if total_files > 0 {
        total_size / total_files
    } else {
        0
    };

    let mut sorted_by_size = files.iter().collect::<Vec<_>>();
    sorted_by_size.sort_by(|a, b| b.size.cmp(&a.size));

    let largest_files: Vec<FileInfo> = sorted_by_size
        .iter()
        .take(5)
        .map(|f| FileInfo {
            path: f.path.clone(),
            name: f.name.clone(),
            size: f.size,
        })
        .collect();

    let type_distribution: Vec<CategoryDistribution> = categories
        .iter()
        .map(|c| CategoryDistribution {
            category: c.name.clone(),
            count: c.file_count,
            total_size: c.total_size,
        })
        .collect();

    let project_type = detect_project_type(&entries);
    let is_project = project_type.is_some();

    let analysis = OrganizationAnalysis {
        categories,
        suggestions,
        insights: DirectoryInsights {
            total_files,
            total_size,
            largest_files,
            type_distribution,
            avg_file_size,
        },
        is_project,
        project_type,
    };

    match serde_json::to_string(&analysis) {
        Ok(json) => ok_result(&json),
        Err(e) => error_result(&format!("Failed to serialize result: {}", e)),
    }
}

fn handle_organize_files(args: &serde_json::Value) -> i32 {
    let directory = match args.get("directory").and_then(|v| v.as_str()) {
        Some(d) => d,
        None => return error_result("Missing 'directory' argument"),
    };

    let rules = args.get("rules");

    let entries = match host_list_directory(directory) {
        Ok(e) => e,
        Err(e) => return error_result(&format!("Failed to list directory: {}", e)),
    };

    let files = collect_files(directory, &entries);
    let sep = if directory.contains('\\') { "\\" } else { "/" };

    // Apply custom rules if provided, otherwise use category-based organization
    let mut moves: Vec<PlannedMove> = Vec::new();
    let mut creates: Vec<String> = Vec::new();

    if let Some(rules_val) = rules {
        if let Some(rules_arr) = rules_val.as_array() {
            for rule in rules_arr {
                let target = rule.get("target").and_then(|v| v.as_str()).unwrap_or("");
                let extensions = rule
                    .get("extensions")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_lowercase()))
                            .collect::<Vec<String>>()
                    })
                    .unwrap_or_default();

                if target.is_empty() || extensions.is_empty() {
                    continue;
                }

                let target_path = format!("{}{}{}", directory, sep, target);
                if !creates.contains(&target_path) {
                    creates.push(target_path.clone());
                }

                for file in &files {
                    if extensions.contains(&file.extension) {
                        let dest = format!("{}{}{}", target_path, sep, file.name);
                        moves.push(PlannedMove {
                            from: file.path.clone(),
                            to: dest,
                            reason: format!("Matched rule: .{} -> {}", file.extension, target),
                        });
                    }
                }
            }
        }
    } else {
        // Default: organize by category
        let mut category_map: HashMap<String, Vec<&CollectedFile>> = HashMap::new();
        for file in &files {
            category_map
                .entry(file.category.clone())
                .or_default()
                .push(file);
        }

        for (cat_name, cat_files) in &category_map {
            if cat_files.len() < 2 || cat_name == "Other" {
                continue;
            }

            let folder_name = cat_name.to_lowercase();
            let target_path = format!("{}{}{}", directory, sep, folder_name);
            creates.push(target_path.clone());

            for file in cat_files {
                let dest = format!("{}{}{}", target_path, sep, file.name);
                moves.push(PlannedMove {
                    from: file.path.clone(),
                    to: dest,
                    reason: format!("Categorized as {}", cat_name),
                });
            }
        }
    }

    let plan = OrganizationPlan { moves, creates };

    match serde_json::to_string(&plan) {
        Ok(json) => ok_result(&json),
        Err(e) => error_result(&format!("Failed to serialize result: {}", e)),
    }
}

fn handle_preview_organization(args: &serde_json::Value) -> i32 {
    // preview_organization is essentially the same as organize_files
    // but returns the plan without executing it
    handle_organize_files(args)
}
