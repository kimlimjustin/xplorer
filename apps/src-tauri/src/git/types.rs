use serde::{Deserialize, Serialize};

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
pub(crate) struct GitStatus {
    pub untracked_files: Vec<String>,
    pub modified_files: Vec<String>,
    pub staged_files: Vec<String>,
}
