use std::path::Path;
use tauri::command;

use super::service::GitService;
use super::types::GitBranch;

#[command]
pub async fn get_branches(repo_path: String) -> Result<Vec<GitBranch>, String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.get_branches(path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn create_branch(
    repo_path: String,
    branch_name: String,
    from_commit: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.create_branch(path, &branch_name, from_commit.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn switch_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.switch_branch(path, &branch_name)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn delete_branch(
    repo_path: String,
    branch_name: String,
    force: bool,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.delete_branch(path, &branch_name, force)
    })
    .await
    .map_err(|e| e.to_string())?
}
