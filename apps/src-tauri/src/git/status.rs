use std::path::Path;
use tauri::command;

use super::service::GitService;
use super::types::{
    GitFileStatus, GitIntegrationFileStatus, GitRepoInfo, GitRepositoryInfo,
};

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

#[command]
pub async fn get_git_status(directory: String) -> Result<Vec<GitIntegrationFileStatus>, String> {
    tokio::task::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_git_repo_info(directory: String) -> Result<GitRepoInfo, String> {
    tokio::task::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn find_git_repository(path: String) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path_buf = std::path::PathBuf::from(path);

        Ok(service
            .find_git_repository(&path_buf)
            .map(|p| p.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_repository_info(repo_path: String) -> Result<GitRepositoryInfo, String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.get_repository_info(path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_file_status(repo_path: String) -> Result<Vec<GitFileStatus>, String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.get_detailed_file_status(path)
    })
    .await
    .map_err(|e| e.to_string())?
}
