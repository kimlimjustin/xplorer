//! Compress Extension WASM Backend
//!
//! Compiled to `wasm32-unknown-unknown` and loaded by the Xplorer wasmi runtime.
//! Creates zip archives by reading files through `host_read_file` and writing
//! the archive via `host_write_file`.
//!
//! ## Protocol
//!
//! The host runtime calls `handle_call(method_ptr, method_len, args_ptr, args_len)`
//! with a method name and JSON arguments. Returns a length-prefixed JSON result.

use std::io::{Cursor, Write};
use zip::write::FileOptions;
use zip::CompressionMethod;
use zip::ZipWriter;

// ─── Host function imports ──────────────────────────────────────────────────

extern "C" {
    fn host_read_file(path_ptr: i32, path_len: i32) -> i32;
    fn host_write_file(path_ptr: i32, path_len: i32, data_ptr: i32, data_len: i32) -> i32;
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

fn call_host_read(path: &str) -> Result<String, String> {
    let path_bytes = path.as_bytes();
    let path_ptr = alloc(path_bytes.len() as i32);
    unsafe {
        core::ptr::copy_nonoverlapping(
            path_bytes.as_ptr(),
            path_ptr as *mut u8,
            path_bytes.len(),
        );
    }

    let status = unsafe { host_read_file(path_ptr, path_bytes.len() as i32) };
    dealloc(path_ptr, path_bytes.len() as i32);

    let result_len = unsafe { host_get_result_len() };
    if result_len <= 0 {
        return Err("host_read_file returned empty result".to_string());
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
        return Err(format!("host_read_file failed: {}", result_str));
    }

    let parsed: serde_json::Value = serde_json::from_str(&result_str)
        .map_err(|e| format!("Failed to parse result: {}", e))?;

    let ok_val = parsed
        .get("ok")
        .ok_or_else(|| "Missing 'ok' field".to_string())?;

    // The content is a JSON string, unquote it
    match ok_val.as_str() {
        Some(s) => Ok(s.to_string()),
        None => Ok(ok_val.to_string()),
    }
}

fn call_host_write(path: &str, data: &str) -> Result<(), String> {
    let path_bytes = path.as_bytes();
    let data_bytes = data.as_bytes();

    let path_ptr = alloc(path_bytes.len() as i32);
    let data_ptr = alloc(data_bytes.len() as i32);
    unsafe {
        core::ptr::copy_nonoverlapping(
            path_bytes.as_ptr(),
            path_ptr as *mut u8,
            path_bytes.len(),
        );
        core::ptr::copy_nonoverlapping(
            data_bytes.as_ptr(),
            data_ptr as *mut u8,
            data_bytes.len(),
        );
    }

    let status = unsafe {
        host_write_file(
            path_ptr,
            path_bytes.len() as i32,
            data_ptr,
            data_bytes.len() as i32,
        )
    };

    dealloc(path_ptr, path_bytes.len() as i32);
    dealloc(data_ptr, data_bytes.len() as i32);

    if status < 0 {
        let result_len = unsafe { host_get_result_len() };
        if result_len > 0 {
            let buf_ptr = alloc(result_len);
            let copied = unsafe { host_read_result(buf_ptr, result_len) };
            if copied > 0 {
                let err_str = unsafe {
                    let slice = core::slice::from_raw_parts(buf_ptr as *const u8, copied as usize);
                    core::str::from_utf8(slice).unwrap_or("Unknown error").to_string()
                };
                dealloc(buf_ptr, result_len);
                return Err(format!("host_write_file failed: {}", err_str));
            }
            dealloc(buf_ptr, result_len);
        }
        return Err("host_write_file failed".to_string());
    }

    Ok(())
}

#[derive(serde::Deserialize)]
struct DirEntry {
    name: String,
    is_dir: bool,
    #[allow(dead_code)]
    size: u64,
}

fn call_host_list_dir(dir_path: &str) -> Result<Vec<DirEntry>, String> {
    let path_bytes = dir_path.as_bytes();
    let path_ptr = alloc(path_bytes.len() as i32);
    unsafe {
        core::ptr::copy_nonoverlapping(
            path_bytes.as_ptr(),
            path_ptr as *mut u8,
            path_bytes.len(),
        );
    }

    let status = unsafe { host_list_dir(path_ptr, path_bytes.len() as i32) };
    dealloc(path_ptr, path_bytes.len() as i32);

    let result_len = unsafe { host_get_result_len() };
    if result_len <= 0 {
        return Err("host_list_dir returned empty result".to_string());
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
        return Err(format!("host_list_dir failed: {}", result_str));
    }

    let parsed: serde_json::Value = serde_json::from_str(&result_str)
        .map_err(|e| format!("Failed to parse result: {}", e))?;

    let ok_val = parsed
        .get("ok")
        .ok_or_else(|| "Missing 'ok' field".to_string())?;

    let entries: Vec<DirEntry> = serde_json::from_value(ok_val.clone())
        .map_err(|e| format!("Failed to parse directory listing: {}", e))?;

    Ok(entries)
}

// ─── File collection ────────────────────────────────────────────────────────

struct CollectedFile {
    full_path: String,
    relative_path: String,
}

fn collect_files_recursive(
    base_dir: &str,
    current_dir: &str,
    relative_prefix: &str,
    files: &mut Vec<CollectedFile>,
) {
    let entries = match call_host_list_dir(current_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let sep = if current_dir.contains('\\') {
        "\\"
    } else {
        "/"
    };

    for entry in entries {
        let full_path = format!("{}{}{}", current_dir, sep, entry.name);
        let rel_path = if relative_prefix.is_empty() {
            entry.name.clone()
        } else {
            format!("{}/{}", relative_prefix, entry.name)
        };

        if entry.is_dir {
            collect_files_recursive(base_dir, &full_path, &rel_path, files);
        } else {
            files.push(CollectedFile {
                full_path,
                relative_path: rel_path,
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
        "compress_files" => handle_compress_files(&args),
        "__init__" => ok_result("true"),
        _ => error_result(&format!("Unknown method: {}", method)),
    }
}

// ─── Method handlers ────────────────────────────────────────────────────────

fn handle_compress_files(args: &serde_json::Value) -> i32 {
    let paths = match args.get("paths").and_then(|v| v.as_array()) {
        Some(arr) => arr
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect::<Vec<String>>(),
        None => return error_result("Missing 'paths' argument"),
    };

    let output_path = match args.get("output_path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'output_path' argument"),
    };

    let format = args
        .get("format")
        .and_then(|v| v.as_str())
        .unwrap_or("zip");

    if format != "zip" && format != "Zip" {
        return error_result(&format!(
            "WASM backend only supports 'zip' format, got '{}'",
            format
        ));
    }

    // Collect all files to compress
    let mut all_files: Vec<CollectedFile> = Vec::new();

    for path in &paths {
        // Check if it's a directory by trying to list it
        match call_host_list_dir(path) {
            Ok(_entries) => {
                // It's a directory — collect files recursively
                let dir_name = path.split('/').last().unwrap_or(
                    path.split('\\').last().unwrap_or("dir"),
                );
                collect_files_recursive(path, path, dir_name, &mut all_files);
            }
            Err(_) => {
                // It's a file
                let name = path.split('/').last().unwrap_or(
                    path.split('\\').last().unwrap_or("file"),
                );
                all_files.push(CollectedFile {
                    full_path: path.clone(),
                    relative_path: name.to_string(),
                });
            }
        }
    }

    // Create the zip archive in memory
    let buf = Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(buf);
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

    let mut files_added: u64 = 0;
    let mut total_size: u64 = 0;

    for file in &all_files {
        let content = match call_host_read(&file.full_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        if zip.start_file(&file.relative_path, options).is_err() {
            continue;
        }
        let content_bytes = content.as_bytes();
        if zip.write_all(content_bytes).is_err() {
            continue;
        }

        files_added += 1;
        total_size += content_bytes.len() as u64;
    }

    let cursor = match zip.finish() {
        Ok(c) => c,
        Err(e) => return error_result(&format!("Failed to finalize zip archive: {}", e)),
    };

    let zip_data = cursor.into_inner();
    let compressed_size = zip_data.len() as u64;

    // Write the archive via host_write_file
    // We need to convert binary data to a string for the host function
    // Use base64-like encoding by writing raw bytes as latin1/ISO-8859-1 string
    let zip_str = zip_data.iter().map(|&b| b as char).collect::<String>();

    if let Err(e) = call_host_write(output_path, &zip_str) {
        return error_result(&format!("Failed to write archive: {}", e));
    }

    let result = serde_json::json!({
        "output_path": output_path,
        "files_added": files_added,
        "total_size": total_size,
        "compressed_size": compressed_size,
    });

    match serde_json::to_string(&result) {
        Ok(json) => ok_result(&json),
        Err(e) => error_result(&format!("Failed to serialize result: {}", e)),
    }
}
