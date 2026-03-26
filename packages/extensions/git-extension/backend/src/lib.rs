//! Git Extension WASM Backend
//!
//! Compiled to `wasm32-unknown-unknown` and loaded by the Xplorer wasmi runtime.
//! Provides git operations by calling the `host_git_exec` host function which
//! runs sanitized `git` CLI commands.
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

use serde::{Deserialize, Serialize};

// ─── Host function imports ──────────────────────────────────────────────────

extern "C" {
    /// Execute a git command. Takes a JSON request `{repo_path, args}` in guest
    /// memory at `(req_ptr, req_len)`. Returns 0 on success, -1 on error.
    /// The JSON result is stored in the host's result_buffer.
    fn host_git_exec(req_ptr: i32, req_len: i32) -> i32;

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
        // Write 4-byte little-endian length prefix
        let len_bytes = (bytes.len() as i32).to_le_bytes();
        core::ptr::copy_nonoverlapping(len_bytes.as_ptr(), dst, 4);
        // Write the JSON payload
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

/// Call `host_git_exec` with the given repo_path and args, returning the parsed
/// JSON result or an error string.
fn git_exec(repo_path: &str, args: &[&str]) -> Result<GitExecResult, String> {
    let req = serde_json::json!({
        "repo_path": repo_path,
        "args": args,
    });
    let req_str = req.to_string();
    let req_bytes = req_str.as_bytes();

    // Write request into guest memory
    let req_ptr = alloc(req_bytes.len() as i32);
    unsafe {
        core::ptr::copy_nonoverlapping(req_bytes.as_ptr(), req_ptr as *mut u8, req_bytes.len());
    }

    // Call the host function
    let status = unsafe { host_git_exec(req_ptr, req_bytes.len() as i32) };

    // Free the request buffer
    dealloc(req_ptr, req_bytes.len() as i32);

    // Read the result from the host's result_buffer
    let result_len = unsafe { host_get_result_len() };
    if result_len <= 0 {
        return Err("host_git_exec returned empty result".to_string());
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
        // Host returned an error — parse the error message
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&result_str) {
            if let Some(err) = parsed.get("error").and_then(|v| v.as_str()) {
                return Err(err.to_string());
            }
        }
        return Err(format!("host_git_exec failed: {}", result_str));
    }

    // Parse the success result: {"ok": {"exit_code": N, "stdout": "...", "stderr": "..."}}
    let parsed: serde_json::Value = serde_json::from_str(&result_str)
        .map_err(|e| format!("Failed to parse git result: {}", e))?;

    let ok_val = parsed
        .get("ok")
        .ok_or_else(|| "Missing 'ok' field in git result".to_string())?;

    let result: GitExecResult = serde_json::from_value(ok_val.clone())
        .map_err(|e| format!("Failed to deserialize git result: {}", e))?;

    Ok(result)
}

// ─── Types ──────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct GitExecResult {
    exit_code: i32,
    stdout: String,
    stderr: String,
}

#[derive(Serialize)]
struct GitCommit {
    hash: String,
    short_hash: String,
    author_name: String,
    author_email: String,
    committer_name: String,
    committer_email: String,
    date: String,
    timestamp: i64,
    message: String,
    summary: String,
    body: String,
    parent_hashes: Vec<String>,
    files_changed: Vec<String>,
    insertions: u32,
    deletions: u32,
}

#[derive(Serialize)]
struct GitBranchInfo {
    name: String,
    is_current: bool,
    is_remote: bool,
    last_commit: Option<BranchLastCommit>,
    upstream: Option<String>,
    ahead: u32,
    behind: u32,
}

#[derive(Serialize)]
struct BranchLastCommit {
    hash: String,
    message: String,
    author: String,
    date: String,
}

#[derive(Serialize)]
struct GitRepositoryInfo {
    root_path: String,
    current_branch: String,
    remote_url: Option<String>,
    total_commits: u32,
    total_contributors: u32,
    last_commit: Option<GitCommit>,
    uncommitted_changes: bool,
    untracked_files: Vec<String>,
    modified_files: Vec<String>,
    staged_files: Vec<String>,
}

#[derive(Serialize)]
struct GitFileHistory {
    file_path: String,
    commits: Vec<GitCommit>,
    total_commits: u32,
    first_commit: Option<GitCommit>,
    last_commit: Option<GitCommit>,
    total_lines_added: u32,
    total_lines_deleted: u32,
}

#[derive(Serialize)]
struct GitBlameLine {
    line_number: u32,
    content: String,
    commit_hash: String,
    short_hash: String,
    author_name: String,
    author_email: String,
    date: String,
    timestamp: i64,
    summary: String,
}

#[derive(Serialize)]
struct GitFileBlame {
    file_path: String,
    lines: Vec<GitBlameLine>,
    unique_authors: Vec<String>,
    total_lines: u32,
}

// ─── Main entry point ───────────────────────────────────────────────────────

/// Entry point called by the wasmi runtime.
///
/// `method_ptr`/`method_len` point to the method name (UTF-8).
/// `args_ptr`/`args_len` point to the JSON arguments (UTF-8).
///
/// Returns a pointer to a length-prefixed JSON result.
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
        "find_repository" => handle_find_repository(&args),
        "get_all_commits" => handle_get_all_commits(&args),
        "get_branches" => handle_get_branches(&args),
        "get_repository_info" => handle_get_repository_info(&args),
        "get_file_history" => handle_get_file_history(&args),
        "get_file_blame" => handle_get_file_blame(&args),
        "get_file_status" => handle_get_file_status(&args),
        "switch_branch" => handle_switch_branch(&args),
        "create_branch" => handle_create_branch(&args),
        "delete_branch" => handle_delete_branch(&args),
        "__init__" => ok_result("true"),
        _ => error_result(&format!("Unknown method: {}", method)),
    }
}

// ─── Method handlers ────────────────────────────────────────────────────────

fn handle_find_repository(args: &serde_json::Value) -> i32 {
    let path = match args.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'path' argument"),
    };

    match git_exec(path, &["rev-parse", "--show-toplevel"]) {
        Ok(result) => {
            if result.exit_code != 0 {
                return error_result(&format!("Not a git repository: {}", result.stderr.trim()));
            }
            let root = result.stdout.trim();
            let json = serde_json::to_string(root).unwrap_or_else(|_| "null".to_string());
            ok_result(&json)
        }
        Err(e) => error_result(&e),
    }
}

fn handle_get_all_commits(args: &serde_json::Value) -> i32 {
    let repo_path = match args.get("repo_path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'repo_path' argument"),
    };
    let limit = args
        .get("limit")
        .and_then(|v| v.as_u64())
        .unwrap_or(100);
    let branch = args.get("branch").and_then(|v| v.as_str());

    // Format: hash|short_hash|author_name|author_email|committer_name|committer_email|date|timestamp|subject|body|parents
    let format_str =
        "%H|%h|%an|%ae|%cn|%ce|%aI|%at|%s|%b|%P";

    let max_count_arg = format!("--max-count={}", limit);
    let format_arg = format!("--format={}", format_str);

    let mut git_args = vec![
        "log",
        max_count_arg.as_str(),
        format_arg.as_str(),
        "--numstat",
    ];

    if let Some(b) = branch {
        git_args.push(b);
    }

    match git_exec(repo_path, &git_args) {
        Ok(result) => {
            if result.exit_code != 0 {
                return error_result(&result.stderr.trim());
            }
            let commits = parse_log_output(&result.stdout);
            match serde_json::to_string(&commits) {
                Ok(json) => ok_result(&json),
                Err(e) => error_result(&format!("Serialize error: {}", e)),
            }
        }
        Err(e) => error_result(&e),
    }
}

/// Parse `git log --format=... --numstat` output into structured commits.
fn parse_log_output(output: &str) -> Vec<GitCommit> {
    let mut commits = Vec::new();
    let mut lines = output.lines().peekable();

    while let Some(line) = lines.next() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.splitn(11, '|').collect();
        if parts.len() < 11 {
            continue;
        }

        let parent_hashes: Vec<String> = if parts[10].is_empty() {
            Vec::new()
        } else {
            parts[10].split(' ').map(|s| s.to_string()).collect()
        };

        let timestamp = parts[7].parse::<i64>().unwrap_or(0);

        // Collect --numstat lines (file changes) until we hit the next commit or EOF
        let mut files_changed = Vec::new();
        let mut insertions: u32 = 0;
        let mut deletions: u32 = 0;

        while let Some(next) = lines.peek() {
            let next = next.trim();
            if next.is_empty() {
                lines.next();
                continue;
            }
            // numstat lines look like: "10\t5\tpath/to/file"
            // If the line contains a '|' it's likely the next commit header
            if next.contains('|')
                && next.split('|').count() >= 11
            {
                break;
            }
            let stat_parts: Vec<&str> = next.split('\t').collect();
            if stat_parts.len() >= 3 {
                if let Ok(ins) = stat_parts[0].parse::<u32>() {
                    insertions += ins;
                }
                if let Ok(del) = stat_parts[1].parse::<u32>() {
                    deletions += del;
                }
                files_changed.push(stat_parts[2].to_string());
            }
            lines.next();
        }

        commits.push(GitCommit {
            hash: parts[0].to_string(),
            short_hash: parts[1].to_string(),
            author_name: parts[2].to_string(),
            author_email: parts[3].to_string(),
            committer_name: parts[4].to_string(),
            committer_email: parts[5].to_string(),
            date: parts[6].to_string(),
            timestamp,
            message: parts[8].to_string(),
            summary: parts[8].to_string(),
            body: parts[9].to_string(),
            parent_hashes,
            files_changed,
            insertions,
            deletions,
        });
    }

    commits
}

fn handle_get_branches(args: &serde_json::Value) -> i32 {
    let repo_path = match args.get("repo_path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'repo_path' argument"),
    };

    // Get branches with format: refname|HEAD|objectname|subject|authorname|authordate|upstream|upstream:track
    let format_str = "%(refname:short)|%(HEAD)|%(objectname:short)|%(subject)|%(authorname)|%(authordate:iso)|%(upstream:short)|%(upstream:track)";
    let format_arg = format!("--format={}", format_str);

    match git_exec(
        repo_path,
        &["branch", "-a", format_arg.as_str()],
    ) {
        Ok(result) => {
            if result.exit_code != 0 {
                return error_result(&result.stderr.trim());
            }

            let mut branches = Vec::new();
            for line in result.stdout.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }

                let parts: Vec<&str> = line.splitn(8, '|').collect();
                if parts.len() < 6 {
                    continue;
                }

                let name = parts[0].to_string();
                let is_current = parts[1].trim() == "*";
                let is_remote = name.starts_with("remotes/") || name.contains('/');

                let last_commit = Some(BranchLastCommit {
                    hash: parts[2].to_string(),
                    message: parts[3].to_string(),
                    author: parts[4].to_string(),
                    date: parts[5].to_string(),
                });

                let upstream = if parts.len() > 6 && !parts[6].is_empty() {
                    Some(parts[6].to_string())
                } else {
                    None
                };

                // Parse ahead/behind from track info like "[ahead 2, behind 1]"
                let (ahead, behind) = if parts.len() > 7 {
                    parse_track_info(parts[7])
                } else {
                    (0, 0)
                };

                branches.push(GitBranchInfo {
                    name,
                    is_current,
                    is_remote,
                    last_commit,
                    upstream,
                    ahead,
                    behind,
                });
            }

            match serde_json::to_string(&branches) {
                Ok(json) => ok_result(&json),
                Err(e) => error_result(&format!("Serialize error: {}", e)),
            }
        }
        Err(e) => error_result(&e),
    }
}

/// Parse git upstream track info like "[ahead 2, behind 1]" or "[ahead 3]"
fn parse_track_info(track: &str) -> (u32, u32) {
    let mut ahead = 0u32;
    let mut behind = 0u32;

    let track = track.trim().trim_matches(|c| c == '[' || c == ']');
    for part in track.split(',') {
        let part = part.trim();
        if part.starts_with("ahead ") {
            ahead = part[6..].trim().parse().unwrap_or(0);
        } else if part.starts_with("behind ") {
            behind = part[7..].trim().parse().unwrap_or(0);
        }
    }

    (ahead, behind)
}

fn handle_get_repository_info(args: &serde_json::Value) -> i32 {
    let repo_path = match args.get("repo_path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'repo_path' argument"),
    };

    // Get current branch
    let current_branch = match git_exec(repo_path, &["rev-parse", "--abbrev-ref", "HEAD"]) {
        Ok(r) if r.exit_code == 0 => r.stdout.trim().to_string(),
        _ => "unknown".to_string(),
    };

    // Get remote URL
    let remote_url = match git_exec(repo_path, &["remote", "get-url", "origin"]) {
        Ok(r) if r.exit_code == 0 => {
            let url = r.stdout.trim().to_string();
            if url.is_empty() { None } else { Some(url) }
        }
        _ => None,
    };

    // Get total commit count
    let total_commits = match git_exec(repo_path, &["rev-list", "--count", "HEAD"]) {
        Ok(r) if r.exit_code == 0 => r.stdout.trim().parse::<u32>().unwrap_or(0),
        _ => 0,
    };

    // Get contributor count
    let total_contributors = match git_exec(repo_path, &["shortlog", "-sn", "HEAD"]) {
        Ok(r) if r.exit_code == 0 => r.stdout.lines().count() as u32,
        _ => 0,
    };

    // Get last commit
    let last_commit = match git_exec(
        repo_path,
        &[
            "log",
            "-1",
            "--format=%H|%h|%an|%ae|%cn|%ce|%aI|%at|%s|%b|%P",
        ],
    ) {
        Ok(r) if r.exit_code == 0 => parse_single_commit(r.stdout.trim()),
        _ => None,
    };

    // Get file status (porcelain v1)
    let (uncommitted_changes, untracked_files, modified_files, staged_files) =
        match git_exec(repo_path, &["status", "--porcelain=v1"]) {
            Ok(r) if r.exit_code == 0 => parse_status_output(&r.stdout),
            _ => (false, Vec::new(), Vec::new(), Vec::new()),
        };

    let info = GitRepositoryInfo {
        root_path: repo_path.to_string(),
        current_branch,
        remote_url,
        total_commits,
        total_contributors,
        last_commit,
        uncommitted_changes,
        untracked_files,
        modified_files,
        staged_files,
    };

    match serde_json::to_string(&info) {
        Ok(json) => ok_result(&json),
        Err(e) => error_result(&format!("Serialize error: {}", e)),
    }
}

/// Parse a single commit line from `git log -1 --format=...`
fn parse_single_commit(line: &str) -> Option<GitCommit> {
    let parts: Vec<&str> = line.splitn(11, '|').collect();
    if parts.len() < 11 {
        return None;
    }

    let parent_hashes: Vec<String> = if parts[10].is_empty() {
        Vec::new()
    } else {
        parts[10].split(' ').map(|s| s.to_string()).collect()
    };

    Some(GitCommit {
        hash: parts[0].to_string(),
        short_hash: parts[1].to_string(),
        author_name: parts[2].to_string(),
        author_email: parts[3].to_string(),
        committer_name: parts[4].to_string(),
        committer_email: parts[5].to_string(),
        date: parts[6].to_string(),
        timestamp: parts[7].parse::<i64>().unwrap_or(0),
        message: parts[8].to_string(),
        summary: parts[8].to_string(),
        body: parts[9].to_string(),
        parent_hashes,
        files_changed: Vec::new(),
        insertions: 0,
        deletions: 0,
    })
}

/// Parse `git status --porcelain=v1` output.
fn parse_status_output(output: &str) -> (bool, Vec<String>, Vec<String>, Vec<String>) {
    let mut untracked = Vec::new();
    let mut modified = Vec::new();
    let mut staged = Vec::new();
    let mut has_changes = false;

    for line in output.lines() {
        if line.len() < 3 {
            continue;
        }
        has_changes = true;
        let index_status = line.as_bytes()[0];
        let worktree_status = line.as_bytes()[1];
        let file_path = line[3..].to_string();

        if index_status == b'?' && worktree_status == b'?' {
            untracked.push(file_path);
        } else {
            if index_status != b' ' && index_status != b'?' {
                staged.push(file_path.clone());
            }
            if worktree_status == b'M' || worktree_status == b'D' {
                modified.push(file_path);
            }
        }
    }

    (has_changes, untracked, modified, staged)
}

fn handle_get_file_history(args: &serde_json::Value) -> i32 {
    let repo_path = match args.get("repo_path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'repo_path' argument"),
    };
    let file_path = match args.get("file_path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'file_path' argument"),
    };
    let limit = args
        .get("limit")
        .and_then(|v| v.as_u64())
        .unwrap_or(50);

    let format_str = "%H|%h|%an|%ae|%cn|%ce|%aI|%at|%s|%b|%P";
    let max_count_arg = format!("--max-count={}", limit);
    let format_arg = format!("--format={}", format_str);

    match git_exec(
        repo_path,
        &[
            "log",
            "--follow",
            max_count_arg.as_str(),
            format_arg.as_str(),
            "--numstat",
            "--",
            file_path,
        ],
    ) {
        Ok(result) => {
            if result.exit_code != 0 {
                return error_result(&result.stderr.trim());
            }

            let commits = parse_log_output(&result.stdout);
            let total_commits = commits.len() as u32;
            let total_lines_added: u32 = commits.iter().map(|c| c.insertions).sum();
            let total_lines_deleted: u32 = commits.iter().map(|c| c.deletions).sum();
            let first_commit = commits.last().cloned();
            let last_commit_entry = commits.first().cloned();

            let history = GitFileHistory {
                file_path: file_path.to_string(),
                commits,
                total_commits,
                first_commit,
                last_commit: last_commit_entry,
                total_lines_added,
                total_lines_deleted,
            };

            match serde_json::to_string(&history) {
                Ok(json) => ok_result(&json),
                Err(e) => error_result(&format!("Serialize error: {}", e)),
            }
        }
        Err(e) => error_result(&e),
    }
}

// Implement Clone for GitCommit so we can clone first/last
impl Clone for GitCommit {
    fn clone(&self) -> Self {
        GitCommit {
            hash: self.hash.clone(),
            short_hash: self.short_hash.clone(),
            author_name: self.author_name.clone(),
            author_email: self.author_email.clone(),
            committer_name: self.committer_name.clone(),
            committer_email: self.committer_email.clone(),
            date: self.date.clone(),
            timestamp: self.timestamp,
            message: self.message.clone(),
            summary: self.summary.clone(),
            body: self.body.clone(),
            parent_hashes: self.parent_hashes.clone(),
            files_changed: self.files_changed.clone(),
            insertions: self.insertions,
            deletions: self.deletions,
        }
    }
}

fn handle_get_file_blame(args: &serde_json::Value) -> i32 {
    let repo_path = match args.get("repo_path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'repo_path' argument"),
    };
    let file_path = match args.get("file_path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'file_path' argument"),
    };

    match git_exec(repo_path, &["blame", "--porcelain", file_path]) {
        Ok(result) => {
            if result.exit_code != 0 {
                return error_result(&result.stderr.trim());
            }

            let blame = parse_blame_output(&result.stdout, file_path);
            match serde_json::to_string(&blame) {
                Ok(json) => ok_result(&json),
                Err(e) => error_result(&format!("Serialize error: {}", e)),
            }
        }
        Err(e) => error_result(&e),
    }
}

/// Parse `git blame --porcelain` output into structured blame data.
fn parse_blame_output(output: &str, file_path: &str) -> GitFileBlame {
    let mut lines_out = Vec::new();
    let mut authors_set = Vec::new();
    let mut current_hash = String::new();
    let mut current_author = String::new();
    let mut current_email = String::new();
    let mut current_timestamp: i64 = 0;
    let mut current_summary = String::new();
    let mut current_line_no: u32 = 0;

    for line in output.lines() {
        if line.starts_with('\t') {
            // Content line — the actual source code line
            let content = &line[1..];
            let short_hash = if current_hash.len() >= 8 {
                current_hash[..8].to_string()
            } else {
                current_hash.clone()
            };

            // Compute a date from the timestamp
            let date = format_timestamp(current_timestamp);

            if !current_author.is_empty() && !authors_set.contains(&current_author) {
                authors_set.push(current_author.clone());
            }

            lines_out.push(GitBlameLine {
                line_number: current_line_no,
                content: content.to_string(),
                commit_hash: current_hash.clone(),
                short_hash,
                author_name: current_author.clone(),
                author_email: current_email.clone(),
                date,
                timestamp: current_timestamp,
                summary: current_summary.clone(),
            });
        } else if line.len() >= 40 && line.as_bytes()[0].is_ascii_hexdigit() {
            // Commit header line: "<hash> <orig_line> <final_line> [<num_lines>]"
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                current_hash = parts[0].to_string();
                current_line_no = parts[2].parse::<u32>().unwrap_or(0);
            }
        } else if let Some(rest) = line.strip_prefix("author ") {
            current_author = rest.to_string();
        } else if let Some(rest) = line.strip_prefix("author-mail ") {
            current_email = rest.trim_matches(|c| c == '<' || c == '>').to_string();
        } else if let Some(rest) = line.strip_prefix("author-time ") {
            current_timestamp = rest.parse::<i64>().unwrap_or(0);
        } else if let Some(rest) = line.strip_prefix("summary ") {
            current_summary = rest.to_string();
        }
    }

    let total_lines = lines_out.len() as u32;

    GitFileBlame {
        file_path: file_path.to_string(),
        lines: lines_out,
        unique_authors: authors_set,
        total_lines,
    }
}

/// Simple timestamp to ISO-like date string.
fn format_timestamp(ts: i64) -> String {
    if ts == 0 {
        return "unknown".to_string();
    }
    // Simple formatting: just return the Unix timestamp as a string.
    // The frontend already formats timestamps with formatRelativeTime/formatDate.
    ts.to_string()
}

fn handle_get_file_status(args: &serde_json::Value) -> i32 {
    let repo_path = match args.get("repo_path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'repo_path' argument"),
    };

    match git_exec(repo_path, &["status", "--porcelain=v1"]) {
        Ok(result) => {
            if result.exit_code != 0 {
                return error_result(&result.stderr.trim());
            }

            let (uncommitted, untracked, modified, staged) =
                parse_status_output(&result.stdout);

            let status = serde_json::json!({
                "uncommitted_changes": uncommitted,
                "untracked_files": untracked,
                "modified_files": modified,
                "staged_files": staged,
            });

            match serde_json::to_string(&status) {
                Ok(json) => ok_result(&json),
                Err(e) => error_result(&format!("Serialize error: {}", e)),
            }
        }
        Err(e) => error_result(&e),
    }
}

fn handle_switch_branch(args: &serde_json::Value) -> i32 {
    let repo_path = match args.get("repo_path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'repo_path' argument"),
    };
    let branch = match args.get("branch").and_then(|v| v.as_str()) {
        Some(b) => b,
        None => return error_result("Missing 'branch' argument"),
    };

    match git_exec(repo_path, &["checkout", branch]) {
        Ok(result) => {
            if result.exit_code != 0 {
                return error_result(&result.stderr.trim());
            }
            ok_result("true")
        }
        Err(e) => error_result(&e),
    }
}

fn handle_create_branch(args: &serde_json::Value) -> i32 {
    let repo_path = match args.get("repo_path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'repo_path' argument"),
    };
    let branch_name = match args.get("branch_name").and_then(|v| v.as_str()) {
        Some(b) => b,
        None => return error_result("Missing 'branch_name' argument"),
    };
    let from_commit = args.get("from_commit").and_then(|v| v.as_str());

    let result = if let Some(commit) = from_commit {
        git_exec(repo_path, &["branch", branch_name, commit])
    } else {
        git_exec(repo_path, &["branch", branch_name])
    };

    match result {
        Ok(r) => {
            if r.exit_code != 0 {
                return error_result(&r.stderr.trim());
            }
            ok_result("true")
        }
        Err(e) => error_result(&e),
    }
}

fn handle_delete_branch(args: &serde_json::Value) -> i32 {
    let repo_path = match args.get("repo_path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_result("Missing 'repo_path' argument"),
    };
    let branch_name = match args.get("branch_name").and_then(|v| v.as_str()) {
        Some(b) => b,
        None => return error_result("Missing 'branch_name' argument"),
    };
    let force = args
        .get("force")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let flag = if force { "-D" } else { "-d" };

    match git_exec(repo_path, &["branch", flag, branch_name]) {
        Ok(r) => {
            if r.exit_code != 0 {
                return error_result(&r.stderr.trim());
            }
            ok_result("true")
        }
        Err(e) => error_result(&e),
    }
}
