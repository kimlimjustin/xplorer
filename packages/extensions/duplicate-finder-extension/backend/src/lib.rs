//! Duplicate Finder WASM Backend
//!
//! Compiled to `wasm32-unknown-unknown` and loaded by the Xplorer wasmi runtime.
//! Finds duplicate files by listing directories and computing SHA-256 hashes
//! through host functions, grouping files with identical hashes.
//!
//! ## Protocol
//!
//! The host runtime calls `handle_call(method_ptr, method_len, args_ptr, args_len)`
//! with a method name and JSON arguments. This module dispatches to the appropriate
//! handler, calls host functions as needed, and returns a pointer to a
//! length-prefixed JSON result: `[len: i32 LE][json bytes...]`.

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::HashMap;

// ─── Host function imports ──────────────────────────────────────────────────

extern "C" {
    fn host_read_file(path_ptr: i32, path_len: i32) -> i32;
    fn host_list_dir(path_ptr: i32, path_len: i32) -> i32;
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
) -> Result<String, String> {
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

    let ok_val = parsed
        .get("ok")
        .ok_or_else(|| "Missing 'ok' field in host result".to_string())?;

    Ok(ok_val.to_string())
}

fn host_read_file_content(file_path: &str) -> Result<String, String> {
    let raw = call_host_with_string(host_read_file, file_path)?;
    // raw is a JSON-encoded string like "\"content here\""
    let unquoted: String = serde_json::from_str(&raw)
        .unwrap_or_else(|_| raw.clone());
    Ok(unquoted)
}

#[derive(serde::Deserialize)]
struct DirEntry {
    name: String,
    is_dir: bool,
    size: u64,
}

fn host_list_directory(dir_path: &str) -> Result<Vec<DirEntry>, String> {
    let raw = call_host_with_string(host_list_dir, dir_path)?;
    let entries: Vec<DirEntry> = serde_json::from_str(&raw)
        .map_err(|e| format!("Failed to parse directory listing: {}", e))?;
    Ok(entries)
}

// ─── Hash helpers ───────────────────────────────────────────────────────────

fn compute_sha256(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    hex_encode(&result)
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

// ─── Types ──────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct DuplicateFile {
    path: String,
    name: String,
    size: u64,
    hash: String,
}

#[derive(Serialize)]
struct DuplicateGroup {
    hash: String,
    size: u64,
    files: Vec<DuplicateFile>,
    total_wasted_space: u64,
}

#[derive(Serialize)]
struct DuplicateFinderResult {
    duplicate_groups: Vec<DuplicateGroup>,
    total_duplicates: u64,
    total_wasted_space: u64,
    files_scanned: u64,
}

// ─── File collection ────────────────────────────────────────────────────────

struct FileInfo {
    path: String,
    name: String,
    size: u64,
}

fn collect_files(dir: &str, recursive: bool, files: &mut Vec<FileInfo>) {
    let entries = match host_list_directory(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let sep = if dir.contains('\\') { "\\" } else { "/" };

    for entry in entries {
        let full_path = format!("{}{}{}", dir, sep, entry.name);
        if entry.is_dir {
            if recursive {
                collect_files(&full_path, true, files);
            }
        } else if entry.size > 0 {
            files.push(FileInfo {
                path: full_path,
                name: entry.name,
                size: entry.size,
            });
        }
    }
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
        "find_duplicates" => handle_find_duplicates(&args),
        "__init__" => ok_result("true"),
        _ => error_result(&format!("Unknown method: {}", method)),
    }
}

// ─── Method handlers ────────────────────────────────────────────────────────

fn handle_find_duplicates(args: &serde_json::Value) -> i32 {
    let directory = match args.get("directory").and_then(|v| v.as_str()) {
        Some(d) => d,
        None => return error_result("Missing 'directory' argument"),
    };

    let recursive = args
        .get("recursive")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    // Phase 1: Collect all files
    let mut files: Vec<FileInfo> = Vec::new();
    collect_files(directory, recursive, &mut files);

    let files_scanned = files.len() as u64;

    // Phase 2: Group by size (files with unique sizes cannot be duplicates)
    let mut size_groups: HashMap<u64, Vec<FileInfo>> = HashMap::new();
    for file in files {
        size_groups.entry(file.size).or_default().push(file);
    }

    // Phase 3: For size groups with >1 file, compute hashes
    let mut hash_groups: HashMap<String, Vec<DuplicateFile>> = HashMap::new();

    for (_size, group) in &size_groups {
        if group.len() < 2 {
            continue;
        }

        for file in group {
            let content = match host_read_file_content(&file.path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let hash = compute_sha256(content.as_bytes());

            hash_groups
                .entry(hash.clone())
                .or_default()
                .push(DuplicateFile {
                    path: file.path.clone(),
                    name: file.name.clone(),
                    size: file.size,
                    hash: hash.clone(),
                });
        }
    }

    // Phase 4: Build result — only groups with 2+ files are duplicates
    let mut duplicate_groups: Vec<DuplicateGroup> = Vec::new();
    let mut total_duplicates: u64 = 0;
    let mut total_wasted_space: u64 = 0;

    for (hash, files) in hash_groups {
        if files.len() < 2 {
            continue;
        }

        let size = files[0].size;
        let wasted = size * (files.len() as u64 - 1);
        total_duplicates += files.len() as u64 - 1;
        total_wasted_space += wasted;

        duplicate_groups.push(DuplicateGroup {
            hash,
            size,
            files,
            total_wasted_space: wasted,
        });
    }

    // Sort by wasted space descending
    duplicate_groups.sort_by(|a, b| b.total_wasted_space.cmp(&a.total_wasted_space));

    let result = DuplicateFinderResult {
        duplicate_groups,
        total_duplicates,
        total_wasted_space,
        files_scanned,
    };

    match serde_json::to_string(&result) {
        Ok(json) => ok_result(&json),
        Err(e) => error_result(&format!("Failed to serialize result: {}", e)),
    }
}
