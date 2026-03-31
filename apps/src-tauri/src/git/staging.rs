use std::path::Path;
use tauri::command;

use super::service::GitService;

#[command]
pub async fn stage_file(repo_path: String, file_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.stage_file(path, &file_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn unstage_file(repo_path: String, file_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.unstage_file(path, &file_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn commit_changes(
    repo_path: String,
    message: String,
    amend: bool,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let service = GitService::new();
        let path = Path::new(&repo_path);
        service.commit_changes(path, &message, amend)
    })
    .await
    .map_err(|e| e.to_string())?
}
