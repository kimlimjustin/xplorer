use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::command;

// ── Types from git_integration (status-bar / lightweight git info) ───────────

#[derive(Debug, Clone, Serialize)]
pub struct GitIntegrationFileStatus {
    pub path: String,
    pub status: String, // "modified", "new", "deleted", "renamed", "untracked", "ignored", "conflict"
}

#[derive(Debug, Clone, Serialize)]
pub struct GitRepoInfo {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub has_changes: bool,
}

/// Map git2::Status bitflags to a simplified human-readable string.
fn status_to_string(status: git2::Status) -> &'static str {
    // Check conflict first (both sides have changes)
    if status.is_conflicted() {
        return "conflict";
    }

    // Index (staged) statuses
    if status.is_index_new() {
        return "new";
    }
    if status.is_index_deleted() {
        return "deleted";
    }
    if status.is_index_renamed() {
        return "renamed";
    }
    if status.is_index_modified() || status.is_index_typechange() {
        return "modified";
    }

    // Worktree (unstaged) statuses
    if status.is_wt_new() {
        return "untracked";
    }
    if status.is_wt_deleted() {
        return "deleted";
    }
    if status.is_wt_renamed() {
        return "renamed";
    }
    if status.is_wt_modified() || status.is_wt_typechange() {
        return "modified";
    }

    // Ignored
    if status.is_ignored() {
        return "ignored";
    }

    "modified"
}

#[command]
pub async fn get_git_status(directory: String) -> Result<Vec<GitIntegrationFileStatus>, String> {
    let repo = git2::Repository::discover(&directory)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    let statuses = repo
        .statuses(None)
        .map_err(|e| format!("Failed to get git statuses: {}", e))?;

    let dir_path = std::path::Path::new(&directory);
    let repo_workdir = repo.workdir().ok_or("Bare repository")?;

    // Compute the relative prefix of `directory` inside the working dir so we
    // can filter results to files that belong to the requested directory.
    let rel_prefix = dir_path
        .strip_prefix(repo_workdir)
        .unwrap_or(std::path::Path::new(""));

    let mut result: Vec<GitIntegrationFileStatus> = Vec::new();

    for entry in statuses.iter() {
        let st = entry.status();
        // Skip clean entries
        if st.is_empty() {
            continue;
        }

        if let Some(path_str) = entry.path() {
            let entry_path = std::path::Path::new(path_str);

            // Only include files that are inside (or equal to) the requested directory
            if !rel_prefix.as_os_str().is_empty() && !entry_path.starts_with(rel_prefix) {
                continue;
            }

            // Build an absolute path for the frontend
            let abs_path = repo_workdir.join(path_str);

            result.push(GitIntegrationFileStatus {
                path: abs_path.to_string_lossy().to_string(),
                status: status_to_string(st).to_string(),
            });
        }
    }

    Ok(result)
}

#[command]
pub async fn get_git_repo_info(directory: String) -> Result<GitRepoInfo, String> {
    let repo = match git2::Repository::discover(&directory) {
        Ok(r) => r,
        Err(_) => {
            return Ok(GitRepoInfo {
                is_repo: false,
                branch: None,
                ahead: 0,
                behind: 0,
                has_changes: false,
            });
        }
    };

    // Get current branch name
    let branch = match repo.head() {
        Ok(head) => head.shorthand().map(|s| s.to_string()),
        Err(_) => None,
    };

    // Check for uncommitted changes (dirty working tree)
    let has_changes = match repo.statuses(None) {
        Ok(statuses) => statuses.iter().any(|entry| {
            let s = entry.status();
            !s.is_empty() && !s.is_ignored()
        }),
        Err(_) => false,
    };

    // Count ahead/behind relative to upstream
    let (ahead, behind) = compute_ahead_behind(&repo);

    Ok(GitRepoInfo {
        is_repo: true,
        branch,
        ahead,
        behind,
        has_changes,
    })
}

/// Compute how many commits the local branch is ahead/behind its upstream.
fn compute_ahead_behind(repo: &git2::Repository) -> (u32, u32) {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return (0, 0),
    };

    let local_oid = match head.target() {
        Some(oid) => oid,
        None => return (0, 0),
    };

    // Resolve the upstream reference
    let branch_name = match head.shorthand() {
        Some(name) => name.to_string(),
        None => return (0, 0),
    };

    let upstream_ref = format!("refs/remotes/origin/{}", branch_name);
    let upstream_oid = match repo.refname_to_id(&upstream_ref) {
        Ok(oid) => oid,
        Err(_) => return (0, 0),
    };

    match repo.graph_ahead_behind(local_oid, upstream_oid) {
        Ok((ahead, behind)) => (ahead as u32, behind as u32),
        Err(_) => (0, 0),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub author_name: String,
    pub author_email: String,
    pub committer_name: String,
    pub committer_email: String,
    pub date: String,
    pub timestamp: i64,
    pub message: String,
    pub summary: String,      // First line of message
    pub body: Option<String>, // Rest of message
    pub parent_hashes: Vec<String>,
    pub files_changed: Vec<String>,
    pub insertions: u32,
    pub deletions: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileHistory {
    pub file_path: String,
    pub commits: Vec<GitCommit>,
    pub total_commits: usize,
    pub first_commit: Option<GitCommit>,
    pub last_commit: Option<GitCommit>,
    pub total_lines_added: u32,
    pub total_lines_deleted: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileBlame {
    pub file_path: String,
    pub lines: Vec<GitBlameLine>,
    pub unique_authors: Vec<String>,
    pub total_lines: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBlameLine {
    pub line_number: usize,
    pub content: String,
    pub commit_hash: String,
    pub short_hash: String,
    pub author_name: String,
    pub author_email: String,
    pub date: String,
    pub timestamp: i64,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDiff {
    pub file_path: String,
    pub old_path: Option<String>,
    pub change_type: String, // "modified", "added", "deleted", "renamed"
    pub hunks: Vec<GitDiffHunk>,
    pub lines_added: u32,
    pub lines_deleted: u32,
    pub binary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub header: String,
    pub lines: Vec<GitDiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDiffLine {
    pub line_type: String, // "context", "addition", "deletion"
    pub content: String,
    pub old_line_number: Option<u32>,
    pub new_line_number: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitRepositoryInfo {
    pub root_path: String,
    pub current_branch: String,
    pub remote_url: Option<String>,
    pub total_commits: usize,
    pub total_contributors: usize,
    pub last_commit: Option<GitCommit>,
    pub uncommitted_changes: bool,
    pub untracked_files: Vec<String>,
    pub modified_files: Vec<String>,
    pub staged_files: Vec<String>,
}

pub struct GitService;

// ── Git argument sanitization helpers (S-9) ─────────────────────────────────

/// Validate a git ref name (branch, tag, commit hash) to prevent flag injection.
/// Rejects values that start with `-` (which git would interpret as flags)
/// and values containing shell metacharacters or suspicious patterns.
fn validate_git_ref(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err(format!("{} cannot be empty", label));
    }
    if value.starts_with('-') {
        return Err(format!(
            "{} '{}' looks like a flag — rejecting to prevent injection",
            label, value
        ));
    }
    // Reject shell metacharacters that should never appear in a git ref
    const FORBIDDEN: &[char] = &[
        ';', '|', '&', '$', '`', '\n', '\r', '\0', '>', '<', '\'', '"',
    ];
    for &ch in FORBIDDEN {
        if value.contains(ch) {
            return Err(format!("{} contains forbidden character '{}'", label, ch));
        }
    }
    // Reject ".." to prevent ref traversal (e.g. "../../etc/passwd")
    if value.contains("..") {
        return Err(format!(
            "{} contains '..' — rejecting to prevent traversal",
            label
        ));
    }
    Ok(())
}

/// Validate a file path argument for git commands.
/// The path itself will be passed after a `--` separator, but we still
/// reject obviously malicious values.
fn validate_git_path(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err(format!("{} cannot be empty", label));
    }
    if value.starts_with('-') {
        return Err(format!(
            "{} '{}' looks like a flag — rejecting to prevent injection",
            label, value
        ));
    }
    // Reject null bytes which could truncate the argument
    if value.contains('\0') {
        return Err(format!("{} contains null byte", label));
    }
    Ok(())
}

impl Default for GitService {
    fn default() -> Self {
        Self::new()
    }
}

impl GitService {
    pub fn new() -> Self {
        Self
    }

    pub fn find_git_repository(&self, path: &Path) -> Option<PathBuf> {
        let mut current_path = path.to_path_buf();

        loop {
            let git_dir = current_path.join(".git");
            if git_dir.exists() {
                return Some(current_path);
            }

            if let Some(parent) = current_path.parent() {
                current_path = parent.to_path_buf();
            } else {
                break;
            }
        }

        None
    }

    pub fn get_repository_info(&self, repo_path: &Path) -> Result<GitRepositoryInfo, String> {
        let current_branch = self.get_current_branch(repo_path)?;
        let remote_url = self.get_remote_url(repo_path).ok();
        let last_commit = self.get_latest_commit(repo_path).ok();

        let status = self.get_git_status(repo_path)?;

        // Count total commits
        let total_commits = self.count_total_commits(repo_path)?;

        // Count contributors
        let total_contributors = self.count_contributors(repo_path)?;

        Ok(GitRepositoryInfo {
            root_path: repo_path.to_string_lossy().to_string(),
            current_branch,
            remote_url,
            total_commits,
            total_contributors,
            last_commit,
            uncommitted_changes: !status.modified_files.is_empty()
                || !status.staged_files.is_empty(),
            untracked_files: status.untracked_files,
            modified_files: status.modified_files,
            staged_files: status.staged_files,
        })
    }

    pub fn get_file_history(
        &self,
        repo_path: &Path,
        file_path: &str,
        limit: Option<usize>,
    ) -> Result<GitFileHistory, String> {
        validate_git_path(file_path, "File path")?;
        let limit_str = limit
            .map(|l| l.to_string())
            .unwrap_or_else(|| "100".to_string());

        let output = Command::new("git")
            .current_dir(repo_path)
            .args([
                "log",
                "--follow",
                "--pretty=format:%H|%h|%an|%ae|%cn|%ce|%ad|%at|%s|%b",
                "--date=iso",
                "--stat=1000",
                &format!("-{}", limit_str),
                "--",
                file_path,
            ])
            .output()
            .map_err(|e| format!("Failed to execute git log: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Git log failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let log_output = String::from_utf8_lossy(&output.stdout);
        let commits = self.parse_git_log(&log_output, file_path)?;

        let total_lines_added = commits.iter().map(|c| c.insertions).sum();
        let total_lines_deleted = commits.iter().map(|c| c.deletions).sum();

        Ok(GitFileHistory {
            file_path: file_path.to_string(),
            total_commits: commits.len(),
            first_commit: commits.last().cloned(),
            last_commit: commits.first().cloned(),
            total_lines_added,
            total_lines_deleted,
            commits,
        })
    }

    pub fn get_file_blame(
        &self,
        repo_path: &Path,
        file_path: &str,
    ) -> Result<GitFileBlame, String> {
        validate_git_path(file_path, "File path")?;
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["blame", "--porcelain", "--line-porcelain", "--", file_path])
            .output()
            .map_err(|e| format!("Failed to execute git blame: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Git blame failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let blame_output = String::from_utf8_lossy(&output.stdout);
        let lines = self.parse_git_blame(&blame_output)?;

        let mut unique_authors = lines
            .iter()
            .map(|line| line.author_name.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        unique_authors.sort();

        Ok(GitFileBlame {
            file_path: file_path.to_string(),
            total_lines: lines.len(),
            unique_authors,
            lines,
        })
    }

    pub fn get_file_diff(
        &self,
        repo_path: &Path,
        file_path: &str,
        commit_hash: Option<&str>,
    ) -> Result<GitDiff, String> {
        validate_git_path(file_path, "File path")?;
        if let Some(hash) = commit_hash {
            validate_git_ref(hash, "Commit hash")?;
        }

        let mut args = vec!["diff"];

        if let Some(hash) = commit_hash {
            args.push(hash);
            args.push("HEAD");
        }

        args.extend_from_slice(&["--no-color", "--no-ext-diff", "-U3", "--", file_path]);

        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to execute git diff: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Git diff failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let diff_output = String::from_utf8_lossy(&output.stdout);
        self.parse_git_diff(&diff_output, file_path)
    }

    pub fn get_commit_diff(
        &self,
        repo_path: &Path,
        commit_hash: &str,
    ) -> Result<Vec<GitDiff>, String> {
        validate_git_ref(commit_hash, "Commit hash")?;
        let output = Command::new("git")
            .current_dir(repo_path)
            .args([
                "show",
                "--no-color",
                "--no-ext-diff",
                "-U3",
                "--format=",
                commit_hash,
            ])
            .output()
            .map_err(|e| format!("Failed to execute git show: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Git show failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let diff_output = String::from_utf8_lossy(&output.stdout);
        self.parse_multiple_git_diffs(&diff_output)
    }

    // Private helper methods
    fn get_current_branch(&self, repo_path: &Path) -> Result<String, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["branch", "--show-current"])
            .output()
            .map_err(|e| format!("Failed to get current branch: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err("Failed to get current branch".to_string())
        }
    }

    fn get_remote_url(&self, repo_path: &Path) -> Result<String, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["remote", "get-url", "origin"])
            .output()
            .map_err(|e| format!("Failed to get remote URL: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err("No remote URL found".to_string())
        }
    }

    fn get_latest_commit(&self, repo_path: &Path) -> Result<GitCommit, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args([
                "log",
                "-1",
                "--pretty=format:%H|%h|%an|%ae|%cn|%ce|%ad|%at|%s|%b",
                "--date=iso",
            ])
            .output()
            .map_err(|e| format!("Failed to get latest commit: {}", e))?;

        if !output.status.success() {
            return Err("Failed to get latest commit".to_string());
        }

        let log_output = String::from_utf8_lossy(&output.stdout);
        let commits = self.parse_git_log(&log_output, "")?;

        commits
            .into_iter()
            .next()
            .ok_or_else(|| "No commits found".to_string())
    }

    fn get_git_status(&self, repo_path: &Path) -> Result<GitStatus, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["status", "--porcelain=v1"])
            .output()
            .map_err(|e| format!("Failed to get git status: {}", e))?;

        if !output.status.success() {
            return Err("Failed to get git status".to_string());
        }

        let status_output = String::from_utf8_lossy(&output.stdout);
        Ok(self.parse_git_status(&status_output))
    }

    fn count_total_commits(&self, repo_path: &Path) -> Result<usize, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["rev-list", "--count", "HEAD"])
            .output()
            .map_err(|e| format!("Failed to count commits: {}", e))?;

        if output.status.success() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            let count_str = output_str.trim();
            count_str
                .parse::<usize>()
                .map_err(|e| format!("Failed to parse commit count: {}", e))
        } else {
            Ok(0)
        }
    }

    fn count_contributors(&self, repo_path: &Path) -> Result<usize, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["shortlog", "-sn", "--all"])
            .output()
            .map_err(|e| format!("Failed to count contributors: {}", e))?;

        if output.status.success() {
            let contributors = String::from_utf8_lossy(&output.stdout)
                .lines()
                .filter(|line| !line.trim().is_empty())
                .count();
            Ok(contributors)
        } else {
            Ok(0)
        }
    }

    fn parse_git_log(&self, log_output: &str, _file_path: &str) -> Result<Vec<GitCommit>, String> {
        let mut commits = Vec::new();
        let mut current_commit_lines = Vec::new();

        for line in log_output.lines() {
            if line.contains('|')
                && line
                    .chars()
                    .nth(0)
                    .map(|c| c.is_alphanumeric())
                    .unwrap_or(false)
            {
                // Process previous commit if exists
                if !current_commit_lines.is_empty() {
                    if let Ok(commit) = self.parse_single_commit(&current_commit_lines) {
                        commits.push(commit);
                    }
                    current_commit_lines.clear();
                }
                current_commit_lines.push(line.to_string());
            } else {
                current_commit_lines.push(line.to_string());
            }
        }

        // Process final commit
        if !current_commit_lines.is_empty() {
            if let Ok(commit) = self.parse_single_commit(&current_commit_lines) {
                commits.push(commit);
            }
        }

        Ok(commits)
    }

    fn parse_single_commit(&self, lines: &[String]) -> Result<GitCommit, String> {
        let first_line = lines.first().ok_or("Empty commit data")?;
        let parts: Vec<&str> = first_line.split('|').collect();

        if parts.len() < 9 {
            return Err("Invalid commit format".to_string());
        }

        let hash = parts[0].to_string();
        let short_hash = parts[1].to_string();
        let author_name = parts[2].to_string();
        let author_email = parts[3].to_string();
        let committer_name = parts[4].to_string();
        let committer_email = parts[5].to_string();
        let date = parts[6].to_string();
        let timestamp = parts[7].parse::<i64>().unwrap_or(0);
        let summary = parts[8].to_string();

        let body = if parts.len() > 9 && !parts[9].trim().is_empty() {
            Some(parts[9].to_string())
        } else {
            None
        };

        // Extract stats from remaining lines
        let mut insertions = 0;
        let mut deletions = 0;
        let mut files_changed = Vec::new();

        for line in lines.iter().skip(1) {
            if line.contains("file changed") || line.contains("files changed") {
                // Parse insertions and deletions from git stat line
                if let Some(ins_pos) = line.find(" insertion") {
                    if let Some(start) = line[..ins_pos].rfind(' ') {
                        if let Ok(count) = line[start + 1..ins_pos].trim().parse::<u32>() {
                            insertions = count;
                        }
                    }
                }
                if let Some(del_pos) = line.find(" deletion") {
                    if let Some(start) = line[..del_pos].rfind(' ') {
                        if let Ok(count) = line[start + 1..del_pos].trim().parse::<u32>() {
                            deletions = count;
                        }
                    }
                }
            } else if line.contains(" | ") {
                // File change line
                if let Some(pipe_pos) = line.find(" | ") {
                    let file_name = line[..pipe_pos].trim();
                    if !file_name.is_empty() {
                        files_changed.push(file_name.to_string());
                    }
                }
            }
        }

        Ok(GitCommit {
            hash,
            short_hash,
            author_name,
            author_email,
            committer_name,
            committer_email,
            date,
            timestamp,
            message: format!("{}\n{}", summary, body.as_deref().unwrap_or("")),
            summary,
            body,
            parent_hashes: Vec::new(), // Could be extracted with additional git commands
            files_changed,
            insertions,
            deletions,
        })
    }

    fn parse_git_blame(&self, blame_output: &str) -> Result<Vec<GitBlameLine>, String> {
        let mut lines = Vec::new();
        let mut current_commit_info: HashMap<String, String> = HashMap::new();
        let mut line_number = 1;

        for line in blame_output.lines() {
            if let Some(stripped) = line.strip_prefix('\t') {
                // This is the actual code line
                let content = stripped.to_string(); // Remove the tab

                let commit_hash = current_commit_info
                    .get("hash")
                    .unwrap_or(&String::new())
                    .clone();
                let short_hash = if commit_hash.len() >= 8 {
                    commit_hash[..8].to_string()
                } else {
                    commit_hash.clone()
                };

                lines.push(GitBlameLine {
                    line_number,
                    content,
                    commit_hash: commit_hash.clone(),
                    short_hash,
                    author_name: current_commit_info
                        .get("author")
                        .unwrap_or(&String::new())
                        .clone(),
                    author_email: current_commit_info
                        .get("author-mail")
                        .unwrap_or(&String::new())
                        .clone(),
                    date: current_commit_info
                        .get("author-time")
                        .unwrap_or(&String::new())
                        .clone(),
                    timestamp: current_commit_info
                        .get("author-time")
                        .unwrap_or(&String::new())
                        .parse::<i64>()
                        .unwrap_or(0),
                    summary: current_commit_info
                        .get("summary")
                        .unwrap_or(&String::new())
                        .clone(),
                });

                line_number += 1;
            } else if let Some(space_pos) = line.find(' ') {
                if line
                    .chars()
                    .all(|c| c.is_alphanumeric() || c.is_whitespace())
                    && space_pos == 40
                {
                    // This is a commit hash line
                    current_commit_info.insert("hash".to_string(), line[..space_pos].to_string());
                } else if let Some(value_pos) = line.find(' ') {
                    // This is a metadata line
                    let key = &line[..value_pos];
                    let value = &line[value_pos + 1..];
                    current_commit_info.insert(key.to_string(), value.to_string());
                }
            }
        }

        Ok(lines)
    }

    fn parse_git_diff(&self, diff_output: &str, file_path: &str) -> Result<GitDiff, String> {
        let mut hunks = Vec::new();
        let mut current_hunk: Option<GitDiffHunk> = None;
        let mut lines_added = 0;
        let mut lines_deleted = 0;
        let mut change_type = "modified".to_string();
        let old_path = None;
        let mut binary = false;

        for line in diff_output.lines() {
            if line.starts_with("@@") {
                // Save previous hunk if exists
                if let Some(hunk) = current_hunk.take() {
                    hunks.push(hunk);
                }

                // Parse hunk header
                if let Some(header_match) = self.parse_hunk_header(line) {
                    current_hunk = Some(GitDiffHunk {
                        old_start: header_match.0,
                        old_lines: header_match.1,
                        new_start: header_match.2,
                        new_lines: header_match.3,
                        header: line.to_string(),
                        lines: Vec::new(),
                    });
                }
            } else if line.starts_with('+') && !line.starts_with("+++") {
                lines_added += 1;
                if let Some(ref mut hunk) = current_hunk {
                    hunk.lines.push(GitDiffLine {
                        line_type: "addition".to_string(),
                        content: line[1..].to_string(),
                        old_line_number: None,
                        new_line_number: Some(hunk.new_start + hunk.lines.len() as u32),
                    });
                }
            } else if line.starts_with('-') && !line.starts_with("---") {
                lines_deleted += 1;
                if let Some(ref mut hunk) = current_hunk {
                    hunk.lines.push(GitDiffLine {
                        line_type: "deletion".to_string(),
                        content: line[1..].to_string(),
                        old_line_number: Some(hunk.old_start + hunk.lines.len() as u32),
                        new_line_number: None,
                    });
                }
            } else if let Some(stripped) = line.strip_prefix(' ') {
                if let Some(ref mut hunk) = current_hunk {
                    hunk.lines.push(GitDiffLine {
                        line_type: "context".to_string(),
                        content: stripped.to_string(),
                        old_line_number: Some(hunk.old_start + hunk.lines.len() as u32),
                        new_line_number: Some(hunk.new_start + hunk.lines.len() as u32),
                    });
                }
            } else if line.starts_with("new file mode") {
                change_type = "added".to_string();
            } else if line.starts_with("deleted file mode") {
                change_type = "deleted".to_string();
            } else if line.contains("Binary files") {
                binary = true;
            }
        }

        // Save final hunk
        if let Some(hunk) = current_hunk {
            hunks.push(hunk);
        }

        Ok(GitDiff {
            file_path: file_path.to_string(),
            old_path,
            change_type,
            hunks,
            lines_added,
            lines_deleted,
            binary,
        })
    }

    fn parse_multiple_git_diffs(&self, diff_output: &str) -> Result<Vec<GitDiff>, String> {
        let mut diffs = Vec::new();
        let mut current_file: Option<String> = None;
        let mut current_diff_lines = Vec::new();

        for line in diff_output.lines() {
            if line.starts_with("diff --git") {
                // Process previous file if exists
                if let Some(file_path) = current_file.take() {
                    let diff_text = current_diff_lines.join("\n");
                    if let Ok(diff) = self.parse_git_diff(&diff_text, &file_path) {
                        diffs.push(diff);
                    }
                    current_diff_lines.clear();
                }

                // Extract file path from diff header
                if let Some(file_path) = self.extract_file_path_from_diff_header(line) {
                    current_file = Some(file_path);
                }
            }

            current_diff_lines.push(line.to_string());
        }

        // Process final file
        if let Some(file_path) = current_file {
            let diff_text = current_diff_lines.join("\n");
            if let Ok(diff) = self.parse_git_diff(&diff_text, &file_path) {
                diffs.push(diff);
            }
        }

        Ok(diffs)
    }

    fn parse_hunk_header(&self, header: &str) -> Option<(u32, u32, u32, u32)> {
        // Parse "@@" -old_start,old_lines +new_start,new_lines "@@"
        let parts: Vec<&str> = header.split_whitespace().collect();
        if parts.len() >= 3 {
            let old_part = parts[1].strip_prefix('-')?;
            let new_part = parts[2].strip_prefix('+')?;

            let old_parts: Vec<&str> = old_part.split(',').collect();
            let new_parts: Vec<&str> = new_part.split(',').collect();

            let old_start = old_parts[0].parse::<u32>().ok()?;
            let old_lines = if old_parts.len() > 1 {
                old_parts[1].parse::<u32>().ok()?
            } else {
                1
            };

            let new_start = new_parts[0].parse::<u32>().ok()?;
            let new_lines = if new_parts.len() > 1 {
                new_parts[1].parse::<u32>().ok()?
            } else {
                1
            };

            Some((old_start, old_lines, new_start, new_lines))
        } else {
            None
        }
    }

    fn extract_file_path_from_diff_header(&self, header: &str) -> Option<String> {
        // Extract file path from "diff --git a/path b/path"
        let parts: Vec<&str> = header.split_whitespace().collect();
        if parts.len() >= 4 {
            let a_path = parts[2].strip_prefix("a/")?;
            Some(a_path.to_string())
        } else {
            None
        }
    }

    pub fn get_detailed_file_status(&self, repo_path: &Path) -> Result<Vec<GitFileStatus>, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["status", "--porcelain=v1", "-z"])
            .output()
            .map_err(|e| format!("Failed to get git status: {}", e))?;

        if !output.status.success() {
            return Err("Failed to get git status".to_string());
        }

        let status_output = String::from_utf8_lossy(&output.stdout);
        Ok(self.parse_detailed_git_status(&status_output))
    }

    pub fn get_branches(&self, repo_path: &Path) -> Result<Vec<GitBranch>, String> {
        // Get local branches using simpler approach
        let local_output = Command::new("git")
            .current_dir(repo_path)
            .args(["branch", "-v"])
            .output()
            .map_err(|e| format!("Failed to get branches: {}", e))?;

        let mut branches = Vec::new();

        if local_output.status.success() {
            let branch_output = String::from_utf8_lossy(&local_output.stdout);
            branches.extend(self.parse_simple_branches(&branch_output, false)?);
        }

        // Get remote branches
        let remote_output = Command::new("git")
            .current_dir(repo_path)
            .args(["branch", "-r", "-v"])
            .output()
            .map_err(|e| format!("Failed to get remote branches: {}", e))?;

        if remote_output.status.success() {
            let remote_branch_output = String::from_utf8_lossy(&remote_output.stdout);
            branches.extend(self.parse_simple_branches(&remote_branch_output, true)?);
        }

        Ok(branches)
    }

    pub fn create_branch(
        &self,
        repo_path: &Path,
        branch_name: &str,
        from_commit: Option<&str>,
    ) -> Result<(), String> {
        validate_git_ref(branch_name, "Branch name")?;
        if let Some(commit) = from_commit {
            validate_git_ref(commit, "Source commit")?;
        }
        let mut args = vec!["checkout", "-b", branch_name];
        if let Some(commit) = from_commit {
            args.push(commit);
        }

        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to create branch: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to create branch: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn switch_branch(&self, repo_path: &Path, branch_name: &str) -> Result<(), String> {
        validate_git_ref(branch_name, "Branch name")?;
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["checkout", branch_name])
            .output()
            .map_err(|e| format!("Failed to switch branch: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to switch branch: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn delete_branch(
        &self,
        repo_path: &Path,
        branch_name: &str,
        force: bool,
    ) -> Result<(), String> {
        validate_git_ref(branch_name, "Branch name")?;
        let flag = if force { "-D" } else { "-d" };
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["branch", flag, branch_name])
            .output()
            .map_err(|e| format!("Failed to delete branch: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to delete branch: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn stage_file(&self, repo_path: &Path, file_path: &str) -> Result<(), String> {
        validate_git_path(file_path, "File path")?;
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["add", "--", file_path])
            .output()
            .map_err(|e| format!("Failed to stage file: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to stage file: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn unstage_file(&self, repo_path: &Path, file_path: &str) -> Result<(), String> {
        validate_git_path(file_path, "File path")?;
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["reset", "HEAD", "--", file_path])
            .output()
            .map_err(|e| format!("Failed to unstage file: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to unstage file: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn commit_changes(
        &self,
        repo_path: &Path,
        message: &str,
        amend: bool,
    ) -> Result<String, String> {
        if message.is_empty() {
            return Err("Commit message cannot be empty".to_string());
        }
        if message.contains('\0') {
            return Err("Commit message contains null byte".to_string());
        }
        let mut args = vec!["commit", "-m", message];
        if amend {
            args.insert(1, "--amend");
        }

        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to commit: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            Err(format!(
                "Failed to commit: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn get_stashes(&self, repo_path: &Path) -> Result<Vec<GitStash>, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["stash", "list", "--pretty=format:%gd|%s|%cr|%at"])
            .output()
            .map_err(|e| format!("Failed to get stashes: {}", e))?;

        if !output.status.success() {
            return Ok(Vec::new()); // No stashes
        }

        let stash_output = String::from_utf8_lossy(&output.stdout);
        self.parse_stashes(&stash_output)
    }

    pub fn create_stash(
        &self,
        repo_path: &Path,
        message: Option<&str>,
        include_untracked: bool,
    ) -> Result<(), String> {
        if let Some(msg) = message {
            if msg.contains('\0') {
                return Err("Stash message contains null byte".to_string());
            }
        }
        let mut args = vec!["stash", "push"];
        if include_untracked {
            args.push("-u");
        }
        if let Some(msg) = message {
            args.extend_from_slice(&["-m", msg]);
        }

        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to create stash: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to create stash: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn apply_stash(&self, repo_path: &Path, stash_index: u32, pop: bool) -> Result<(), String> {
        let command = if pop { "pop" } else { "apply" };
        let stash_ref = format!("stash@{{{}}}", stash_index);

        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["stash", command, &stash_ref])
            .output()
            .map_err(|e| format!("Failed to apply stash: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to apply stash: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn drop_stash(&self, repo_path: &Path, stash_index: u32) -> Result<(), String> {
        let stash_ref = format!("stash@{{{}}}", stash_index);

        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["stash", "drop", &stash_ref])
            .output()
            .map_err(|e| format!("Failed to drop stash: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to drop stash: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    // Private parsing methods
    fn parse_detailed_git_status(&self, status_output: &str) -> Vec<GitFileStatus> {
        let mut file_statuses = Vec::new();

        for entry in status_output.split('\0') {
            if entry.is_empty() || entry.len() < 3 {
                continue;
            }

            let status_chars = &entry[..2];
            let file_path = &entry[3..];

            let (status, old_path) = match status_chars {
                "??" => ("untracked".to_string(), None),
                " M" => ("modified".to_string(), None),
                "M " => ("staged".to_string(), None),
                "MM" => ("staged_and_modified".to_string(), None),
                "A " => ("added".to_string(), None),
                "D " => ("deleted_staged".to_string(), None),
                " D" => ("deleted".to_string(), None),
                "R " => {
                    // Renamed file: "R  old_name -> new_name"
                    if let Some(arrow_pos) = file_path.find(" -> ") {
                        let old_name = file_path[..arrow_pos].to_string();
                        let new_name = file_path[arrow_pos + 4..].to_string();
                        file_statuses.push(GitFileStatus {
                            path: new_name,
                            status: "renamed".to_string(),
                            old_path: Some(old_name),
                        });
                        continue;
                    } else {
                        ("renamed".to_string(), None)
                    }
                }
                "C " => ("copied".to_string(), None),
                "U " | " U" | "UU" => ("conflicted".to_string(), None),
                _ => ("unknown".to_string(), None),
            };

            file_statuses.push(GitFileStatus {
                path: file_path.to_string(),
                status,
                old_path,
            });
        }

        file_statuses
    }

    fn parse_simple_branches(
        &self,
        branch_output: &str,
        is_remote: bool,
    ) -> Result<Vec<GitBranch>, String> {
        let mut branches = Vec::new();

        for line in branch_output.lines() {
            if line.trim().is_empty() {
                continue;
            }

            // Parse format: "* main    abcd123 Latest commit message"
            // or           "  feature abcd123 Feature commit message"
            let line = line.trim();
            let is_current = line.starts_with('*');

            // Remove the current marker and extra spaces
            let clean_line = if is_current { line[1..].trim() } else { line };

            // Split by whitespace and take first part as branch name
            let parts: Vec<&str> = clean_line.split_whitespace().collect();
            if !parts.is_empty() {
                let name = parts[0].to_string();

                branches.push(GitBranch {
                    name,
                    is_current: is_current && !is_remote,
                    is_remote,
                    last_commit: None,
                    upstream: None, // Could be determined with additional git commands
                    ahead: 0,
                    behind: 0,
                });
            }
        }

        Ok(branches)
    }

    fn parse_stashes(&self, stash_output: &str) -> Result<Vec<GitStash>, String> {
        let mut stashes = Vec::new();

        for line in stash_output.lines() {
            if line.trim().is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 4 {
                // Parse stash@{0} format
                let stash_ref = parts[0].trim();
                let index = if let Some(start) = stash_ref.find('{') {
                    if let Some(end) = stash_ref.find('}') {
                        stash_ref[start + 1..end].parse::<u32>().unwrap_or(0)
                    } else {
                        0
                    }
                } else {
                    0
                };

                let message = parts[1].trim().to_string();
                let _relative_time = parts[2].trim(); // "2 hours ago"
                let timestamp = parts[3].trim().parse::<i64>().unwrap_or(0);

                stashes.push(GitStash {
                    index,
                    message,
                    branch: "unknown".to_string(), // Could be parsed from stash message
                    timestamp,
                    files_changed: Vec::new(), // Could be populated with file list
                });
            }
        }

        Ok(stashes)
    }

    fn parse_git_status(&self, status_output: &str) -> GitStatus {
        let mut untracked_files = Vec::new();
        let mut modified_files = Vec::new();
        let mut staged_files = Vec::new();

        for line in status_output.lines() {
            if line.len() >= 3 {
                let status_chars = &line[..2];
                let file_path = &line[3..];

                match status_chars {
                    "??" => untracked_files.push(file_path.to_string()),
                    " M" => modified_files.push(file_path.to_string()),
                    "M " => staged_files.push(file_path.to_string()),
                    "MM" => {
                        staged_files.push(file_path.to_string());
                        modified_files.push(file_path.to_string());
                    }
                    "A " => staged_files.push(file_path.to_string()),
                    "D " => staged_files.push(file_path.to_string()),
                    " D" => modified_files.push(file_path.to_string()),
                    _ => {}
                }
            }
        }

        GitStatus {
            untracked_files,
            modified_files,
            staged_files,
        }
    }

    pub fn get_all_commits(
        &self,
        repo_path: &Path,
        limit: Option<usize>,
        branch: Option<&str>,
    ) -> Result<Vec<GitCommit>, String> {
        if let Some(b) = branch {
            validate_git_ref(b, "Branch")?;
        }
        let limit_str = limit
            .map(|l| l.to_string())
            .unwrap_or_else(|| "100".to_string());
        let branch_or_all = branch.unwrap_or("--all");

        let output = Command::new("git")
            .current_dir(repo_path)
            .args([
                "log",
                branch_or_all,
                "--pretty=format:%H|%h|%an|%ae|%cn|%ce|%ad|%at|%s|%b|%P",
                "--date=iso",
                "--stat=1000",
                &format!("-{}", limit_str),
            ])
            .output()
            .map_err(|e| format!("Failed to execute git log: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Git log failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let log_output = String::from_utf8_lossy(&output.stdout);
        self.parse_git_log(&log_output, "")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String, // "untracked", "modified", "staged", "deleted", "added", "renamed", "conflicted"
    pub old_path: Option<String>, // For renamed files
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBranch {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub last_commit: Option<GitCommit>,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStash {
    pub index: u32,
    pub message: String,
    pub branch: String,
    pub timestamp: i64,
    pub files_changed: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitRemote {
    pub name: String,
    pub url: String,
    pub push_url: Option<String>,
}

#[derive(Debug)]
struct GitStatus {
    untracked_files: Vec<String>,
    modified_files: Vec<String>,
    staged_files: Vec<String>,
}

// Tauri commands
#[command]
pub async fn find_git_repository(path: String) -> Result<Option<String>, String> {
    let service = GitService::new();
    let path_buf = PathBuf::from(path);

    Ok(service
        .find_git_repository(&path_buf)
        .map(|p| p.to_string_lossy().to_string()))
}

#[command]
pub async fn get_repository_info(repo_path: String) -> Result<GitRepositoryInfo, String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.get_repository_info(path)
}

#[command]
pub async fn get_file_history(
    repo_path: String,
    file_path: String,
    limit: Option<usize>,
) -> Result<GitFileHistory, String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.get_file_history(path, &file_path, limit)
}

#[command]
pub async fn get_file_blame(repo_path: String, file_path: String) -> Result<GitFileBlame, String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.get_file_blame(path, &file_path)
}

#[command]
pub async fn get_file_diff(
    repo_path: String,
    file_path: String,
    commit_hash: Option<String>,
) -> Result<GitDiff, String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.get_file_diff(path, &file_path, commit_hash.as_deref())
}

#[command]
pub async fn get_commit_diff(
    repo_path: String,
    commit_hash: String,
) -> Result<Vec<GitDiff>, String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.get_commit_diff(path, &commit_hash)
}

#[command]
pub async fn get_file_status(repo_path: String) -> Result<Vec<GitFileStatus>, String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.get_detailed_file_status(path)
}

#[command]
pub async fn get_branches(repo_path: String) -> Result<Vec<GitBranch>, String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.get_branches(path)
}

#[command]
pub async fn create_branch(
    repo_path: String,
    branch_name: String,
    from_commit: Option<String>,
) -> Result<(), String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.create_branch(path, &branch_name, from_commit.as_deref())
}

#[command]
pub async fn switch_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.switch_branch(path, &branch_name)
}

#[command]
pub async fn delete_branch(
    repo_path: String,
    branch_name: String,
    force: bool,
) -> Result<(), String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.delete_branch(path, &branch_name, force)
}

#[command]
pub async fn stage_file(repo_path: String, file_path: String) -> Result<(), String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.stage_file(path, &file_path)
}

#[command]
pub async fn unstage_file(repo_path: String, file_path: String) -> Result<(), String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.unstage_file(path, &file_path)
}

#[command]
pub async fn commit_changes(
    repo_path: String,
    message: String,
    amend: bool,
) -> Result<String, String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.commit_changes(path, &message, amend)
}

#[command]
pub async fn get_stashes(repo_path: String) -> Result<Vec<GitStash>, String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.get_stashes(path)
}

#[command]
pub async fn create_stash(
    repo_path: String,
    message: Option<String>,
    include_untracked: bool,
) -> Result<(), String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.create_stash(path, message.as_deref(), include_untracked)
}

#[command]
pub async fn apply_stash(repo_path: String, stash_index: u32, pop: bool) -> Result<(), String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.apply_stash(path, stash_index, pop)
}

#[command]
pub async fn drop_stash(repo_path: String, stash_index: u32) -> Result<(), String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.drop_stash(path, stash_index)
}

#[command]
pub async fn get_all_commits(
    repo_path: String,
    limit: Option<usize>,
    branch: Option<String>,
) -> Result<Vec<GitCommit>, String> {
    let service = GitService::new();
    let path = Path::new(&repo_path);
    service.get_all_commits(path, limit, branch.as_deref())
}
