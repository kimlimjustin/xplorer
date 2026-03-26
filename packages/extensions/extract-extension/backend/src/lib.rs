//! Extract Extension WASM Backend
//!
//! Compiled to `wasm32-unknown-unknown` and loaded by the Xplorer wasmi runtime.
//! Extracts zip archives by reading archives through `host_read_file` and writing
//! extracted files via `host_write_file`.
//!
//! ## Protocol
//!
//! The host runtime calls `handle_call(method_ptr, method_len, args_ptr, args_len)`
//! with a method name and JSON arguments. Returns a length-prefixed JSON result.

use std::io::Cursor;
use zip::ZipArchive;

// ─── Host function imports ──────────────────────────────────────────────────

extern "C" {
    fn host_read_file(path_ptr: i32, path_len: i32) -> i32;
    fn host_write_file(path_ptr: i32, path_len: i32, data_ptr: i32, data_len: i32) -> i32;
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
        "extract_archive" => handle_extract_archive(&args),
        "__init__" => ok_result("true"),
        _ => error_result(&format!("Unknown method: {}", method)),
    }
}

// ─── Method handlers ────────────────────────────────────────────────────────

fn handle_extract_archive(args: &serde_json::Value) -> i32 {
    let archive_path = match args.get("archive_path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'archive_path' argument"),
    };

    let output_dir = match args.get("output_dir").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'output_dir' argument"),
    };

    // Read the archive file
    let archive_content = match call_host_read(archive_path) {
        Ok(c) => c,
        Err(e) => return error_result(&format!("Failed to read archive: {}", e)),
    };

    // Parse the zip archive from memory
    let archive_bytes = archive_content.as_bytes();
    let cursor = Cursor::new(archive_bytes);
    let mut archive = match ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(e) => return error_result(&format!("Failed to open zip archive: {}", e)),
    };

    let mut files_extracted: u64 = 0;
    let mut total_size: u64 = 0;
    let mut extracted_files: Vec<String> = Vec::new();

    let sep = if output_dir.contains('\\') { "\\" } else { "/" };

    for i in 0..archive.len() {
        let mut file = match archive.by_index(i) {
            Ok(f) => f,
            Err(_) => continue,
        };

        let name = file.name().to_string();

        // Skip directories (they'll be created implicitly by host_write_file)
        if name.ends_with('/') {
            continue;
        }

        // Security: prevent path traversal
        if name.contains("..") {
            continue;
        }

        let output_path = format!("{}{}{}", output_dir, sep, name.replace('/', sep));

        // Read file contents
        let mut contents = Vec::new();
        if std::io::Read::read_to_end(&mut file, &mut contents).is_err() {
            continue;
        }

        // Convert to string for host_write_file
        let content_str = contents.iter().map(|&b| b as char).collect::<String>();

        if call_host_write(&output_path, &content_str).is_ok() {
            total_size += contents.len() as u64;
            files_extracted += 1;
            extracted_files.push(name);
        }
    }

    let result = serde_json::json!({
        "output_dir": output_dir,
        "files_extracted": files_extracted,
        "total_size": total_size,
        "extracted_files": extracted_files,
    });

    match serde_json::to_string(&result) {
        Ok(json) => ok_result(&json),
        Err(e) => error_result(&format!("Failed to serialize result: {}", e)),
    }
}
