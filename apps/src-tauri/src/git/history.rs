use std::path::Path;
use tauri::command;

use super::service::GitService;
use super::types::{GitCommit, GitDiff, GitFileBlame, GitFileHistory};

#[command]
pub async fn get_file_history(
    repo_path: String,
    file_path: String,
    limit: Option<usize>,
) -> Result<GitFileHistory, String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.get_file_history(path, &file_path, limit)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_file_blame(repo_path: String, file_path: String) -> Result<GitFileBlame, String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.get_file_blame(path, &file_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_file_diff(
    repo_path: String,
    file_path: String,
    commit_hash: Option<String>,
) -> Result<GitDiff, String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.get_file_diff(path, &file_path, commit_hash.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_commit_diff(
    repo_path: String,
    commit_hash: String,
) -> Result<Vec<GitDiff>, String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.get_commit_diff(path, &commit_hash)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_all_commits(
    repo_path: String,
    limit: Option<usize>,
    branch: Option<String>,
) -> Result<Vec<GitCommit>, String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.get_all_commits(path, limit, branch.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
}
