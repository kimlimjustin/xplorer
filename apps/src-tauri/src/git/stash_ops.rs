use std::path::Path;
use tauri::command;

use super::service::GitService;
use super::types::GitStash;

#[command]
pub async fn get_stashes(repo_path: String) -> Result<Vec<GitStash>, String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.get_stashes(path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn create_stash(
    repo_path: String,
    message: Option<String>,
    include_untracked: bool,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.create_stash(path, message.as_deref(), include_untracked)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn apply_stash(repo_path: String, stash_index: u32, pop: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.apply_stash(path, stash_index, pop)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn drop_stash(repo_path: String, stash_index: u32) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.drop_stash(path, stash_index)
    })
    .await
    .map_err(|e| e.to_string())?
}
