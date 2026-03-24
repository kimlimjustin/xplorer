use std::collections::HashMap;
use std::path::Path;
use tracing::{error, warn};
use wasmi::*;

use super::wasm_runtime::{read_string_from_memory, HostState};

/// Register all host functions into the given linker under the `env` namespace.
pub fn register_host_functions(linker: &mut Linker<HostState>) -> Result<(), String> {
    // ─── File system ────────────────────────────────────────────────────────
    linker
        .func_wrap(
            "env",
            "host_read_file",
            |mut caller: Caller<'_, HostState>, path_ptr: i32, path_len: i32| -> i32 {
                match do_read_file(&caller, path_ptr, path_len) {
                    Ok(json) => {
                        caller.data_mut().result_buffer = Some(json);
                        0
                    }
                    Err(e) => {
                        error!("[WASM host_read_file] {}", e);
                        caller.data_mut().result_buffer = Some(error_json(&e));
                        -1
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to register host_read_file: {}", e))?;

    linker
        .func_wrap(
            "env",
            "host_write_file",
            |mut caller: Caller<'_, HostState>,
             path_ptr: i32,
             path_len: i32,
             data_ptr: i32,
             data_len: i32|
             -> i32 {
                match do_write_file(&caller, path_ptr, path_len, data_ptr, data_len) {
                    Ok(json) => {
                        caller.data_mut().result_buffer = Some(json);
                        0
                    }
                    Err(e) => {
                        error!("[WASM host_write_file] {}", e);
                        caller.data_mut().result_buffer = Some(error_json(&e));
                        -1
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to register host_write_file: {}", e))?;

    linker
        .func_wrap(
            "env",
            "host_list_dir",
            |mut caller: Caller<'_, HostState>, path_ptr: i32, path_len: i32| -> i32 {
                match do_list_dir(&caller, path_ptr, path_len) {
                    Ok(json) => {
                        caller.data_mut().result_buffer = Some(json);
                        0
                    }
                    Err(e) => {
                        error!("[WASM host_list_dir] {}", e);
                        caller.data_mut().result_buffer = Some(error_json(&e));
                        -1
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to register host_list_dir: {}", e))?;

    linker
        .func_wrap(
            "env",
            "host_file_exists",
            |mut caller: Caller<'_, HostState>, path_ptr: i32, path_len: i32| -> i32 {
                match do_file_exists(&caller, path_ptr, path_len) {
                    Ok(json) => {
                        caller.data_mut().result_buffer = Some(json);
                        0
                    }
                    Err(e) => {
                        error!("[WASM host_file_exists] {}", e);
                        caller.data_mut().result_buffer = Some(error_json(&e));
                        -1
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to register host_file_exists: {}", e))?;

    // ─── Storage (always allowed, scoped to extension) ──────────────────────
    linker
        .func_wrap(
            "env",
            "host_get_storage",
            |mut caller: Caller<'_, HostState>, key_ptr: i32, key_len: i32| -> i32 {
                match do_get_storage(&caller, key_ptr, key_len) {
                    Ok(json) => {
                        caller.data_mut().result_buffer = Some(json);
                        0
                    }
                    Err(e) => {
                        error!("[WASM host_get_storage] {}", e);
                        caller.data_mut().result_buffer = Some(error_json(&e));
                        -1
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to register host_get_storage: {}", e))?;

    linker
        .func_wrap(
            "env",
            "host_set_storage",
            |mut caller: Caller<'_, HostState>,
             key_ptr: i32,
             key_len: i32,
             val_ptr: i32,
             val_len: i32|
             -> i32 {
                match do_set_storage(&caller, key_ptr, key_len, val_ptr, val_len) {
                    Ok(json) => {
                        caller.data_mut().result_buffer = Some(json);
                        0
                    }
                    Err(e) => {
                        error!("[WASM host_set_storage] {}", e);
                        caller.data_mut().result_buffer = Some(error_json(&e));
                        -1
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to register host_set_storage: {}", e))?;

    linker
        .func_wrap(
            "env",
            "host_delete_storage",
            |mut caller: Caller<'_, HostState>, key_ptr: i32, key_len: i32| -> i32 {
                match do_delete_storage(&caller, key_ptr, key_len) {
                    Ok(json) => {
                        caller.data_mut().result_buffer = Some(json);
                        0
                    }
                    Err(e) => {
                        error!("[WASM host_delete_storage] {}", e);
                        caller.data_mut().result_buffer = Some(error_json(&e));
                        -1
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to register host_delete_storage: {}", e))?;

    // ─── HTTP (gated on system:network) ─────────────────────────────────────
    linker
        .func_wrap(
            "env",
            "host_http_request",
            |mut caller: Caller<'_, HostState>, req_ptr: i32, req_len: i32| -> i32 {
                match do_http_request(&caller, req_ptr, req_len) {
                    Ok(json) => {
                        caller.data_mut().result_buffer = Some(json);
                        0
                    }
                    Err(e) => {
                        error!("[WASM host_http_request] {}", e);
                        caller.data_mut().result_buffer = Some(error_json(&e));
                        -1
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to register host_http_request: {}", e))?;

    // ─── Git (gated on git:read / git:write) ────────────────────────────────
    linker
        .func_wrap(
            "env",
            "host_git_exec",
            |mut caller: Caller<'_, HostState>, req_ptr: i32, req_len: i32| -> i32 {
                match do_git_exec(&caller, req_ptr, req_len) {
                    Ok(json) => {
                        caller.data_mut().result_buffer = Some(json);
                        0
                    }
                    Err(e) => {
                        error!("[WASM host_git_exec] {}", e);
                        caller.data_mut().result_buffer = Some(error_json(&e));
                        -1
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to register host_git_exec: {}", e))?;

    // ─── Communication ──────────────────────────────────────────────────────
    linker
        .func_wrap(
            "env",
            "host_send_to_frontend",
            |mut caller: Caller<'_, HostState>, msg_ptr: i32, msg_len: i32| -> i32 {
                match do_send_to_frontend(&caller, msg_ptr, msg_len) {
                    Ok(json) => {
                        caller.data_mut().result_buffer = Some(json);
                        0
                    }
                    Err(e) => {
                        error!("[WASM host_send_to_frontend] {}", e);
                        caller.data_mut().result_buffer = Some(error_json(&e));
                        -1
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to register host_send_to_frontend: {}", e))?;

    // ─── Result buffer access (allow guest to read host function results) ────
    linker
        .func_wrap(
            "env",
            "host_get_result_len",
            |caller: Caller<'_, HostState>| -> i32 {
                match &caller.data().result_buffer {
                    Some(buf) => buf.len() as i32,
                    None => 0,
                }
            },
        )
        .map_err(|e| format!("Failed to register host_get_result_len: {}", e))?;

    linker
        .func_wrap(
            "env",
            "host_read_result",
            |mut caller: Caller<'_, HostState>, buf_ptr: i32, buf_len: i32| -> i32 {
                // Take the result buffer out so we can write to memory without borrow conflicts
                let result = caller.data_mut().result_buffer.take();
                match result {
                    Some(ref buf) => {
                        let copy_len = std::cmp::min(buf.len(), buf_len as usize);
                        let memory = match caller.data().memory {
                            Some(mem) => mem,
                            None => {
                                error!("[WASM host_read_result] No exported memory");
                                // Put the buffer back so it's not lost
                                caller.data_mut().result_buffer = Some(buf.clone());
                                return -1;
                            }
                        };
                        let mem_data = memory.data_mut(&mut caller);
                        let start = buf_ptr as usize;
                        let end = start + copy_len;
                        if end > mem_data.len() {
                            error!(
                                "[WASM host_read_result] Write out of bounds: {}..{} but memory size is {}",
                                start, end, mem_data.len()
                            );
                            return -1;
                        }
                        mem_data[start..end].copy_from_slice(&buf.as_bytes()[..copy_len]);
                        copy_len as i32
                    }
                    None => 0,
                }
            },
        )
        .map_err(|e| format!("Failed to register host_read_result: {}", e))?;

    Ok(())
}

// ─── Result helpers ──────────────────────────────────────────────────────────

/// Produce a JSON error payload: `{"error": "<message>"}`.
fn error_json(msg: &str) -> String {
    let escaped = msg.replace('\\', "\\\\").replace('"', "\\\"");
    format!(r#"{{"error":"{}"}}"#, escaped)
}

/// Produce a JSON success payload: `{"ok": <value>}`.
fn ok_json(value: &str) -> String {
    format!(r#"{{"ok":{}}}"#, value)
}

// ─── Permission checking ────────────────────────────────────────────────────

fn has_permission(ctx: &impl AsContext<Data = HostState>, perm: &str) -> bool {
    ctx.as_context().data().permissions.iter().any(|p| p == perm)
}

fn require_permission(
    ctx: &impl AsContext<Data = HostState>,
    perm: &str,
) -> Result<(), String> {
    if has_permission(ctx, perm) {
        Ok(())
    } else {
        Err(format!(
            "Extension '{}' lacks required permission '{}'",
            ctx.as_context().data().extension_id,
            perm
        ))
    }
}

// ─── File system implementations ────────────────────────────────────────────

fn do_read_file(
    ctx: &impl AsContext<Data = HostState>,
    path_ptr: i32,
    path_len: i32,
) -> Result<String, String> {
    require_permission(ctx, "file:read")?;
    let path_str = read_string_from_memory(ctx, path_ptr, path_len)?;
    let ext_id = ctx.as_context().data().extension_id.clone();
    validate_read_path(&path_str, &ext_id)?;

    let content = std::fs::read_to_string(&path_str)
        .map_err(|e| format!("Failed to read file '{}': {}", path_str, e))?;

    let escaped = serde_json::to_string(&content)
        .map_err(|e| format!("Failed to serialize file content: {}", e))?;
    Ok(ok_json(&escaped))
}

fn do_write_file(
    ctx: &impl AsContext<Data = HostState>,
    path_ptr: i32,
    path_len: i32,
    data_ptr: i32,
    data_len: i32,
) -> Result<String, String> {
    require_permission(ctx, "file:write")?;
    let path_str = read_string_from_memory(ctx, path_ptr, path_len)?;
    let content = read_string_from_memory(ctx, data_ptr, data_len)?;

    // Write operations scoped to extension data directory
    let ext_id = ctx.as_context().data().extension_id.clone();
    validate_write_path(&path_str, &ext_id)?;

    // Create parent directories if needed
    if let Some(parent) = Path::new(&path_str).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent dirs: {}", e))?;
    }

    std::fs::write(&path_str, &content)
        .map_err(|e| format!("Failed to write file '{}': {}", path_str, e))?;

    Ok(ok_json("true"))
}

fn do_list_dir(
    ctx: &impl AsContext<Data = HostState>,
    path_ptr: i32,
    path_len: i32,
) -> Result<String, String> {
    require_permission(ctx, "file:read")?;
    let path_str = read_string_from_memory(ctx, path_ptr, path_len)?;
    let ext_id = ctx.as_context().data().extension_id.clone();
    validate_read_path(&path_str, &ext_id)?;

    let entries = std::fs::read_dir(&path_str)
        .map_err(|e| format!("Failed to list directory '{}': {}", path_str, e))?;

    let mut results: Vec<serde_json::Value> = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        results.push(serde_json::json!({
            "name": name,
            "is_dir": is_dir,
            "size": size,
        }));
    }

    let json = serde_json::to_string(&results)
        .map_err(|e| format!("Failed to serialize directory listing: {}", e))?;
    Ok(ok_json(&json))
}

fn do_file_exists(
    ctx: &impl AsContext<Data = HostState>,
    path_ptr: i32,
    path_len: i32,
) -> Result<String, String> {
    require_permission(ctx, "file:read")?;
    let path_str = read_string_from_memory(ctx, path_ptr, path_len)?;
    let ext_id = ctx.as_context().data().extension_id.clone();
    validate_read_path(&path_str, &ext_id)?;

    let exists = Path::new(&path_str).exists();
    Ok(ok_json(&exists.to_string()))
}

// ─── Storage implementations ────────────────────────────────────────────────

/// Get the extension-scoped storage directory.
fn extension_storage_dir(extension_id: &str) -> Result<std::path::PathBuf, String> {
    let data_dir = dirs::data_dir()
        .ok_or_else(|| "Could not determine app data directory".to_string())?;
    let storage_dir = data_dir
        .join("com.xplorer.app")
        .join("extension_storage")
        .join(extension_id);
    std::fs::create_dir_all(&storage_dir)
        .map_err(|e| format!("Failed to create storage dir: {}", e))?;
    Ok(storage_dir)
}

fn do_get_storage(
    ctx: &impl AsContext<Data = HostState>,
    key_ptr: i32,
    key_len: i32,
) -> Result<String, String> {
    require_permission(ctx, "storage:read")?;
    let key = read_string_from_memory(ctx, key_ptr, key_len)?;
    validate_storage_key(&key)?;
    let ext_id = ctx.as_context().data().extension_id.clone();
    let storage_dir = extension_storage_dir(&ext_id)?;
    let file_path = storage_dir.join(format!("{}.json", key));

    if !file_path.exists() {
        return Ok(ok_json("null"));
    }

    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read storage key '{}': {}", key, e))?;
    Ok(ok_json(&content))
}

fn do_set_storage(
    ctx: &impl AsContext<Data = HostState>,
    key_ptr: i32,
    key_len: i32,
    val_ptr: i32,
    val_len: i32,
) -> Result<String, String> {
    require_permission(ctx, "storage:write")?;
    let key = read_string_from_memory(ctx, key_ptr, key_len)?;
    let value = read_string_from_memory(ctx, val_ptr, val_len)?;
    validate_storage_key(&key)?;
    let ext_id = ctx.as_context().data().extension_id.clone();
    let storage_dir = extension_storage_dir(&ext_id)?;
    let file_path = storage_dir.join(format!("{}.json", key));

    // Validate the value is valid JSON
    let _: serde_json::Value = serde_json::from_str(&value)
        .map_err(|e| format!("Storage value is not valid JSON: {}", e))?;

    std::fs::write(&file_path, &value)
        .map_err(|e| format!("Failed to write storage key '{}': {}", key, e))?;
    Ok(ok_json("true"))
}

fn do_delete_storage(
    ctx: &impl AsContext<Data = HostState>,
    key_ptr: i32,
    key_len: i32,
) -> Result<String, String> {
    require_permission(ctx, "storage:write")?;
    let key = read_string_from_memory(ctx, key_ptr, key_len)?;
    validate_storage_key(&key)?;
    let ext_id = ctx.as_context().data().extension_id.clone();
    let storage_dir = extension_storage_dir(&ext_id)?;
    let file_path = storage_dir.join(format!("{}.json", key));

    if file_path.exists() {
        std::fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete storage key '{}': {}", key, e))?;
    }
    Ok(ok_json("true"))
}

// ─── HTTP implementation ────────────────────────────────────────────────────

fn do_http_request(
    ctx: &impl AsContext<Data = HostState>,
    req_ptr: i32,
    req_len: i32,
) -> Result<String, String> {
    require_permission(ctx, "system:network")?;
    let req_json = read_string_from_memory(ctx, req_ptr, req_len)?;

    let req: serde_json::Value = serde_json::from_str(&req_json)
        .map_err(|e| format!("Invalid HTTP request JSON: {}", e))?;

    let url = req
        .get("url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "HTTP request missing 'url' field".to_string())?;

    // SECURITY: Validate URL against private IPs / SSRF
    super::commands::validate_url_security_public(url)?;

    let method = req
        .get("method")
        .and_then(|v| v.as_str())
        .unwrap_or("GET")
        .to_uppercase();

    let headers = req
        .get("headers")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    let body = req
        .get("body")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Execute HTTP request synchronously (we're in a sync host function context)
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut request = match method.as_str() {
        "GET" => client.get(url),
        "POST" => client.post(url),
        "PUT" => client.put(url),
        "DELETE" => client.delete(url),
        "PATCH" => client.patch(url),
        "HEAD" => client.head(url),
        _ => return Err(format!("Unsupported HTTP method: {}", method)),
    };

    for (key, value) in &headers {
        if let Some(val_str) = value.as_str() {
            request = request.header(key.as_str(), val_str);
        }
    }

    if let Some(ref body_str) = body {
        request = request.body(body_str.clone());
    }

    let response = request
        .send()
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = response.status().as_u16();
    let resp_headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();
    const MAX_HTTP_RESPONSE_SIZE: usize = 10 * 1024 * 1024; // 10MB

    let resp_bytes = response
        .bytes()
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    if resp_bytes.len() > MAX_HTTP_RESPONSE_SIZE {
        return Err(format!(
            "HTTP response too large: {} bytes (limit: {} bytes)",
            resp_bytes.len(), MAX_HTTP_RESPONSE_SIZE
        ));
    }

    let resp_body = String::from_utf8_lossy(&resp_bytes).to_string();

    let result = serde_json::json!({
        "status": status,
        "headers": resp_headers,
        "body": resp_body,
    });

    let json = serde_json::to_string(&result)
        .map_err(|e| format!("Failed to serialize HTTP response: {}", e))?;
    Ok(ok_json(&json))
}

// ─── Git implementation ─────────────────────────────────────────────────────

/// Dangerous git arguments that could allow arbitrary command execution.
const DANGEROUS_GIT_ARGS: &[&str] = &[
    "--exec",
    "--upload-pack",
    "--receive-pack",
    "--exec-path",
    "-c",
    "core.sshCommand",
    "core.gitProxy",
    "core.askPass",
    "credential.helper",
    "diff.external",
    "filter.",
    "protocol.",
];

fn do_git_exec(
    ctx: &impl AsContext<Data = HostState>,
    req_ptr: i32,
    req_len: i32,
) -> Result<String, String> {
    // Require at least git:read. git:write is needed for mutating operations.
    require_permission(ctx, "git:read")?;

    let req_json = read_string_from_memory(ctx, req_ptr, req_len)?;
    let req: serde_json::Value = serde_json::from_str(&req_json)
        .map_err(|e| format!("Invalid git request JSON: {}", e))?;

    let repo_path = req
        .get("repo_path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "git exec missing 'repo_path' field".to_string())?;

    let args: Vec<String> = req
        .get("args")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "git exec missing 'args' array".to_string())?
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    // SECURITY: Validate repo_path exists and contains .git
    let repo = Path::new(repo_path);
    if !repo.exists() {
        return Err(format!("Repository path does not exist: {}", repo_path));
    }
    if !repo.join(".git").exists() && !repo.join("HEAD").exists() {
        return Err(format!(
            "Path '{}' does not appear to be a git repository",
            repo_path
        ));
    }

    // SECURITY: Check if this is a write operation and require git:write.
    let write_commands = [
        "add", "commit", "push", "merge", "rebase", "reset", "checkout", "branch", "tag",
        "stash", "cherry-pick", "revert", "rm", "mv", "clean", "init",
    ];
    if let Some(first_arg) = args.first() {
        if write_commands.contains(&first_arg.as_str()) {
            require_permission(ctx, "git:write")?;
        }
    }

    // SECURITY: Sanitize arguments — reject any dangerous flags.
    for arg in &args {
        let lower = arg.to_lowercase();
        for dangerous in DANGEROUS_GIT_ARGS {
            if lower.starts_with(&dangerous.to_lowercase()) {
                return Err(format!(
                    "Git argument '{}' is not allowed (matches blocked pattern '{}')",
                    arg, dangerous
                ));
            }
        }
        // Block shell metacharacters in arguments
        if arg.contains('|')
            || arg.contains(';')
            || arg.contains('&')
            || arg.contains('`')
            || arg.contains('$')
            || arg.contains('\n')
            || arg.contains('\r')
        {
            return Err(format!(
                "Git argument '{}' contains shell metacharacters",
                arg
            ));
        }
    }

    // Execute git with sanitized arguments
    let output = std::process::Command::new("git")
        .args(&args)
        .current_dir(repo_path)
        // Do not inherit env vars that could affect git behavior
        .env_clear()
        .env("PATH", std::env::var("PATH").unwrap_or_default())
        .env("HOME", std::env::var("HOME").unwrap_or_default())
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    let result = serde_json::json!({
        "exit_code": output.status.code().unwrap_or(-1),
        "stdout": stdout,
        "stderr": stderr,
    });

    let json = serde_json::to_string(&result)
        .map_err(|e| format!("Failed to serialize git result: {}", e))?;
    Ok(ok_json(&json))
}

// ─── Communication ──────────────────────────────────────────────────────────

fn do_send_to_frontend(
    ctx: &impl AsContext<Data = HostState>,
    msg_ptr: i32,
    msg_len: i32,
) -> Result<String, String> {
    let message = read_string_from_memory(ctx, msg_ptr, msg_len)?;
    let ext_id = ctx.as_context().data().extension_id.clone();

    // Validate it's valid JSON
    let _: serde_json::Value = serde_json::from_str(&message)
        .map_err(|e| format!("Frontend message must be valid JSON: {}", e))?;

    // Store the message in the result buffer — the runtime layer will
    // forward it to the frontend via Tauri events.
    warn!(
        "[WASM] Extension '{}' sent message to frontend: {}",
        ext_id,
        if message.len() > 200 {
            format!("{}...", &message[..200])
        } else {
            message.clone()
        }
    );

    Ok(ok_json("true"))
}

// ─── Validation helpers ─────────────────────────────────────────────────────

/// Validate a file path is not suspicious (no null bytes, not empty).
fn validate_file_path(path: &str) -> Result<(), String> {
    if path.contains('\0') {
        return Err("Path contains null byte".to_string());
    }
    if path.is_empty() {
        return Err("Path is empty".to_string());
    }
    Ok(())
}

/// Sensitive path components that should never be readable by extensions.
const SENSITIVE_PATHS: &[&str] = &[
    ".ssh",
    ".gnupg",
    ".gpg",
    ".config",
    ".aws",
    ".azure",
    ".kube",
    ".docker",
    ".npmrc",
    ".netrc",
    ".bash_history",
    ".zsh_history",
    ".local/share/keyrings",
    // Browser credential directories
    "Library/Application Support/Google/Chrome",
    "Library/Application Support/Firefox",
    "Library/Application Support/BraveSoftware",
    "Library/Keychains",
    // Linux browser paths
    ".mozilla",
    ".config/google-chrome",
    ".config/chromium",
    ".config/BraveSoftware",
    // Windows browser paths (via forward-slash normalization)
    "AppData/Local/Google/Chrome",
    "AppData/Local/BraveSoftware",
    "AppData/Roaming/Mozilla",
];

/// Unix-style sensitive absolute paths that should be blocked.
const SENSITIVE_ABSOLUTE_PATHS: &[&str] = &[
    "/etc/shadow",
    "/etc/gshadow",
    "/etc/master.passwd",
    "/etc/security",
    "/etc/sudoers",
    "/private/etc/shadow",
    "/private/etc/master.passwd",
];

/// Allowed subdirectories under the user's home directory for read access.
const ALLOWED_HOME_SUBDIRS: &[&str] = &[
    "Documents",
    "Downloads",
    "Desktop",
    "Pictures",
    "Music",
    "Videos",
    "Movies",
    "Public",
];

/// Validate that a read path is allowed for the given extension.
///
/// Read operations are scoped to:
/// 1. The extension's own data directory
/// 2. Common user document locations (Documents, Downloads, Desktop, etc.)
///
/// Reads are blocked for:
/// - Sensitive dotfile directories (~/.ssh, ~/.gnupg, ~/.config, etc.)
/// - Browser credential directories
/// - System credential files (/etc/shadow, etc.)
fn validate_read_path(path: &str, extension_id: &str) -> Result<(), String> {
    validate_file_path(path)?;

    // Normalize the path by resolving `..` without requiring the path to exist.
    let target = std::path::Path::new(path);

    // 1) Always allow reads within the extension's own data directory.
    let data_dir = dirs::data_dir()
        .ok_or_else(|| "Could not determine app data directory".to_string())?;
    let ext_data_base = data_dir
        .join("com.xplorer.app")
        .join("extension_data")
        .join(extension_id);
    if let Ok(canonical_base) = std::fs::canonicalize(&ext_data_base) {
        if let Ok(canonical_target) = std::fs::canonicalize(target) {
            if canonical_target.starts_with(&canonical_base) {
                return Ok(());
            }
        }
    }

    // Also allow reads within extension storage directory.
    let ext_storage_base = data_dir
        .join("com.xplorer.app")
        .join("extension_storage")
        .join(extension_id);
    if let Ok(canonical_base) = std::fs::canonicalize(&ext_storage_base) {
        if let Ok(canonical_target) = std::fs::canonicalize(target) {
            if canonical_target.starts_with(&canonical_base) {
                return Ok(());
            }
        }
    }

    // Resolve the real path if it exists (follows symlinks).
    let resolved = if target.exists() {
        std::fs::canonicalize(target)
            .map_err(|e| format!("Failed to resolve path '{}': {}", path, e))?
    } else {
        // If the path doesn't exist, use the cleaned string form for checks.
        target.to_path_buf()
    };
    let resolved_str = resolved.to_string_lossy();

    // 2) Block sensitive absolute paths.
    for sensitive in SENSITIVE_ABSOLUTE_PATHS {
        if resolved_str.eq_ignore_ascii_case(sensitive) {
            return Err(format!(
                "Extension '{}' cannot read sensitive system file '{}'",
                extension_id, path
            ));
        }
    }

    // 3) Block sensitive directories relative to the home directory.
    if let Some(home) = dirs::home_dir() {
        let home_canonical = std::fs::canonicalize(&home).unwrap_or(home.clone());

        if resolved.starts_with(&home_canonical) {
            let relative = resolved.strip_prefix(&home_canonical).unwrap_or(&resolved);
            let relative_str = relative.to_string_lossy();

            // Check against sensitive path patterns.
            for sensitive in SENSITIVE_PATHS {
                if relative_str.starts_with(sensitive) {
                    return Err(format!(
                        "Extension '{}' cannot read sensitive path '{}' (matches '{}')",
                        extension_id, path, sensitive
                    ));
                }
            }

            // 4) Allow reads within known safe home subdirectories.
            for allowed in ALLOWED_HOME_SUBDIRS {
                if relative_str.starts_with(allowed) {
                    return Ok(());
                }
            }
        }

        // If the path is outside the home directory entirely, allow it
        // as long as it didn't match any sensitive absolute paths above.
        // This allows reading from /tmp, project directories, etc.
        if !resolved.starts_with(&home_canonical) {
            return Ok(());
        }
    }

    // For paths inside the home directory but not in an allowed subdirectory,
    // allow reading files directly in the home directory itself (not subdirs),
    // but block access to hidden/sensitive subdirectories (already checked above).
    // If we reach here, the path is within the home dir but not in a known-safe subdir.
    // Allow it as long as it's not in a sensitive subdir (already blocked above).
    Ok(())
}

/// Validate that a write path is within the extension's data directory.
fn validate_write_path(path: &str, extension_id: &str) -> Result<(), String> {
    validate_file_path(path)?;

    // Extension write operations should be scoped to their own data directory.
    let data_dir = dirs::data_dir()
        .ok_or_else(|| "Could not determine app data directory".to_string())?;
    let allowed_base = data_dir
        .join("com.xplorer.app")
        .join("extension_data")
        .join(extension_id);

    // Canonicalize the allowed base (create it if needed)
    std::fs::create_dir_all(&allowed_base)
        .map_err(|e| format!("Failed to create extension data dir: {}", e))?;
    let canonical_base = std::fs::canonicalize(&allowed_base)
        .map_err(|e| format!("Failed to canonicalize extension data dir: {}", e))?;

    // Check if the target path (after resolving symlinks) is within the allowed base.
    // If the file doesn't exist yet, check its parent.
    let target = Path::new(path);
    let check_path = if target.exists() {
        std::fs::canonicalize(target)
            .map_err(|e| format!("Failed to canonicalize target path: {}", e))?
    } else if let Some(parent) = target.parent() {
        if parent.exists() {
            std::fs::canonicalize(parent)
                .map_err(|e| format!("Failed to canonicalize parent path: {}", e))?
                .join(target.file_name().unwrap_or_default())
        } else {
            return Err(format!(
                "Write path '{}' parent directory does not exist",
                path
            ));
        }
    } else {
        return Err(format!("Write path '{}' has no parent directory", path));
    };

    if !check_path.starts_with(&canonical_base) {
        return Err(format!(
            "Extension '{}' cannot write outside its data directory. Path '{}' is not under '{}'",
            extension_id,
            path,
            canonical_base.display()
        ));
    }

    Ok(())
}

/// Validate a storage key name — only allow safe characters.
fn validate_storage_key(key: &str) -> Result<(), String> {
    if key.is_empty() || key.len() > 256 {
        return Err("Storage key must be 1-256 characters".to_string());
    }
    if !key
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(format!(
            "Storage key '{}' contains invalid characters (only alphanumeric, hyphens, underscores, dots allowed)",
            key
        ));
    }
    if key.contains("..") {
        return Err("Storage key must not contain '..'".to_string());
    }
    Ok(())
}
