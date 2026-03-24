// API commands module - handles all API routes from the old server
use tauri::command;
use crate::storage::{FileRecord, Extension, StoredChatMessage, UserSettings, STORAGE};

// File API commands
#[command]
pub async fn get_files(parent_id: Option<i32>) -> Result<Vec<FileRecord>, String> {
    let storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    let files = storage.get_files(parent_id);
    Ok(files.into_iter().cloned().collect())
}

#[command]
pub async fn get_file_tree() -> Result<Vec<FileRecord>, String> {
    let storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    let files = storage.get_files(None); // Get all root files for now
    Ok(files.into_iter().cloned().collect())
}

#[command]
pub async fn get_file_by_id(id: i32) -> Result<Option<FileRecord>, String> {
    let storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    Ok(storage.get_file(id).cloned())
}

#[command]
pub async fn get_file_content(id: i32) -> Result<Option<String>, String> {
    let storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    Ok(storage.get_file(id).and_then(|f| f.content.clone()))
}

#[command]
pub async fn create_file_record(name: String, path: String, file_type: String, parent_id: Option<i32>) -> Result<FileRecord, String> {
    let mut storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    Ok(storage.create_file(name, path, file_type, parent_id))
}

#[command]
pub async fn delete_file_record(id: i32) -> Result<bool, String> {
    let mut storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    Ok(storage.delete_file(id))
}

// Tag API commands
#[command]
pub async fn get_all_tags() -> Result<Vec<String>, String> {
    let storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    Ok(storage.get_all_tags())
}

#[command]
pub async fn get_files_by_tag(tag: String) -> Result<Vec<FileRecord>, String> {
    let storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    let files = storage.get_files_by_tag(&tag);
    Ok(files.into_iter().cloned().collect())
}

#[command]
pub async fn update_file_tags(id: i32, tags: Vec<String>) -> Result<Option<FileRecord>, String> {
    let mut storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    Ok(storage.update_file_tags(id, tags).cloned())
}

#[command]
pub async fn update_file_color(id: i32, color: String) -> Result<Option<FileRecord>, String> {
    let mut storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    Ok(storage.update_file_color(id, color).cloned())
}

// Extension API commands
#[command]
pub async fn get_extensions() -> Result<Vec<Extension>, String> {
    let storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    let extensions = storage.get_extensions();
    Ok(extensions.into_iter().cloned().collect())
}

#[command]
pub async fn get_active_extensions() -> Result<Vec<Extension>, String> {
    let storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    let extensions = storage.get_active_extensions();
    Ok(extensions.into_iter().cloned().collect())
}

#[command]
pub async fn create_extension(name: String, description: String, version: String, author: String) -> Result<Extension, String> {
    let mut storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    Ok(storage.create_extension(name, description, version, author))
}

#[command]
pub async fn install_extension(id: i32) -> Result<Option<Extension>, String> {
    let mut storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    Ok(storage.update_extension(id, true).cloned())
}

#[command]
pub async fn uninstall_extension(id: i32) -> Result<Option<Extension>, String> {
    let mut storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    Ok(storage.update_extension(id, false).cloned())
}

#[command]
pub async fn delete_extension(id: i32) -> Result<bool, String> {
    let mut storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    Ok(storage.delete_extension(id))
}

// Chat API commands
#[command]
pub async fn get_chat_messages(session_id: String) -> Result<Vec<StoredChatMessage>, String> {
    let storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    let messages = storage.get_chat_messages(&session_id);
    Ok(messages.into_iter().cloned().collect())
}

#[command]
pub async fn create_chat_message(session_id: String, role: String, content: String) -> Result<StoredChatMessage, String> {
    let mut storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    Ok(storage.create_chat_message(session_id, role, content))
}

// User settings API commands
#[command]
pub async fn get_user_settings() -> Result<Option<UserSettings>, String> {
    let storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    Ok(storage.get_user_settings(1).cloned()) // Default user ID is 1
}

#[command]
pub async fn update_user_settings(
    theme: Option<String>, 
    view_mode: Option<String>, 
    show_hidden_files: Option<bool>
) -> Result<Option<UserSettings>, String> {
    let mut storage = STORAGE.lock().unwrap_or_else(|e| e.into_inner());
    Ok(storage.update_user_settings(1, theme, view_mode, show_hidden_files).cloned())
}
