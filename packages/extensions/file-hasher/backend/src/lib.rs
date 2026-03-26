//! File Hasher WASM Backend
//!
//! Compiled to `wasm32-unknown-unknown` and loaded by the Xplorer wasmi runtime.
//! Provides file hashing operations (SHA-256, SHA-1, MD5) by reading files
//! through the `host_read_file` host function and computing hashes in pure Rust.
//!
//! ## Protocol
//!
//! The host runtime calls `handle_call(method_ptr, method_len, args_ptr, args_len)`
//! with a method name and JSON arguments. This module dispatches to the appropriate
//! handler, calls host functions as needed, and returns a pointer to a
//! length-prefixed JSON result: `[len: i32 LE][json bytes...]`.
//!
//! Host functions store their results in an opaque `result_buffer`. The guest
//! retrieves results via `host_get_result_len()` -> len, then
//! `host_read_result(buf_ptr, buf_len)` -> bytes copied.

use md5::Md5;
use sha1::Sha1;
use sha2::{Digest, Sha256};

// ─── Host function imports ──────────────────────────────────────────────────

extern "C" {
    /// Read a file at the given path. Takes `(path_ptr, path_len)`.
    /// Returns 0 on success, -1 on error. Result in host result_buffer.
    fn host_read_file(path_ptr: i32, path_len: i32) -> i32;

    /// Returns the byte length of the current host result_buffer.
    fn host_get_result_len() -> i32;

    /// Copies up to `buf_len` bytes from the host result_buffer into guest
    /// memory at `buf_ptr`. Returns the number of bytes actually copied.
    fn host_read_result(buf_ptr: i32, buf_len: i32) -> i32;
}

// ─── Memory management exports ──────────────────────────────────────────────

/// Allocate `size` bytes in guest memory. Returns a pointer.
#[no_mangle]
pub extern "C" fn alloc(size: i32) -> i32 {
    let layout = std::alloc::Layout::from_size_align(size as usize, 1).unwrap();
    unsafe { std::alloc::alloc(layout) as i32 }
}

/// Free `size` bytes at `ptr` in guest memory.
#[no_mangle]
pub extern "C" fn dealloc(ptr: i32, size: i32) {
    let layout = std::alloc::Layout::from_size_align(size as usize, 1).unwrap();
    unsafe { std::alloc::dealloc(ptr as *mut u8, layout) }
}

// ─── Result helpers ─────────────────────────────────────────────────────────

/// Write a JSON string into a newly allocated length-prefixed buffer.
/// Returns a pointer to: `[len: i32 LE][json bytes...]`
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

/// Build a JSON error result.
fn error_result(msg: &str) -> i32 {
    let escaped = msg.replace('\\', "\\\\").replace('"', "\\\"");
    let json = format!(r#"{{"error":"{}"}}"#, escaped);
    write_result(&json)
}

/// Build a JSON success result wrapping an already-serialized value.
fn ok_result(value: &str) -> i32 {
    let json = format!(r#"{{"ok":{}}}"#, value);
    write_result(&json)
}

/// Read a UTF-8 string from guest memory at `(ptr, len)`.
fn read_guest_str(ptr: i32, len: i32) -> &'static str {
    unsafe {
        let slice = core::slice::from_raw_parts(ptr as *const u8, len as usize);
        core::str::from_utf8_unchecked(slice)
    }
}

// ─── Host function wrappers ─────────────────────────────────────────────────

/// Read a file through the host, returning the file content as a String.
/// The host returns `{"ok": "<escaped content>"}` on success.
fn host_read_file_content(file_path: &str) -> Result<String, String> {
    let path_bytes = file_path.as_bytes();
    let path_ptr = alloc(path_bytes.len() as i32);
    unsafe {
        core::ptr::copy_nonoverlapping(path_bytes.as_ptr(), path_ptr as *mut u8, path_bytes.len());
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

    // Parse: {"ok": "file content here"}
    let parsed: serde_json::Value = serde_json::from_str(&result_str)
        .map_err(|e| format!("Failed to parse read_file result: {}", e))?;

    let ok_val = parsed
        .get("ok")
        .ok_or_else(|| "Missing 'ok' field in read_file result".to_string())?;

    match ok_val.as_str() {
        Some(s) => Ok(s.to_string()),
        None => Ok(ok_val.to_string()),
    }
}

// ─── Hash computation ───────────────────────────────────────────────────────

fn compute_sha256(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    hex_encode(&result)
}

fn compute_sha1(data: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(data);
    let result = hasher.finalize();
    hex_encode(&result)
}

fn compute_md5(data: &[u8]) -> String {
    let mut hasher = Md5::new();
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
        "compute_hash" => handle_compute_hash(&args),
        "__init__" => ok_result("true"),
        _ => error_result(&format!("Unknown method: {}", method)),
    }
}

// ─── Method handlers ────────────────────────────────────────────────────────

fn handle_compute_hash(args: &serde_json::Value) -> i32 {
    let file_path = match args.get("file_path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'file_path' argument"),
    };

    let algorithm = match args.get("algorithm").and_then(|v| v.as_str()) {
        Some(a) => a,
        None => return error_result("Missing 'algorithm' argument"),
    };

    // Read the file content via host function
    let content = match host_read_file_content(file_path) {
        Ok(c) => c,
        Err(e) => return error_result(&format!("Failed to read file: {}", e)),
    };

    let data = content.as_bytes();

    let hash = match algorithm {
        "SHA-256" | "sha256" | "sha-256" => compute_sha256(data),
        "SHA-1" | "sha1" | "sha-1" => compute_sha1(data),
        "MD5" | "md5" => compute_md5(data),
        _ => return error_result(&format!("Unsupported algorithm: {}", algorithm)),
    };

    let result = serde_json::json!({
        "hash": hash,
        "algorithm": algorithm,
        "file_path": file_path,
        "size": data.len(),
    });

    match serde_json::to_string(&result) {
        Ok(json) => ok_result(&json),
        Err(e) => error_result(&format!("Failed to serialize result: {}", e)),
    }
}
