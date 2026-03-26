// Storage sub-module: Chat History
//
// Persistent chat sessions and messages.
// Follows the same LazyLock<Mutex<>> cache pattern as bookmarks/tags.

use serde::{Deserialize, Serialize};
use std::sync::{LazyLock, Mutex, MutexGuard};
use tauri::Manager;

// ─── In-memory cache ─────────────────────────────────────────────────────────

static CHAT_CACHE: LazyLock<Mutex<Option<ChatHistory>>> = LazyLock::new(|| Mutex::new(None));

// ─── Types ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatHistoryMessage {
    pub role: String,
    pub content: String,
    pub timestamp: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatSession {
    pub id: String,
    pub title: String,
    pub messages: Vec<ChatHistoryMessage>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ChatHistory {
    pub sessions: Vec<ChatSession>,
}

// ─── Disk helpers ───────────────────────────────────────────────────────────

fn chat_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(dir.join("chat_history.json"))
}

fn load_from_disk(app_handle: &tauri::AppHandle) -> Result<ChatHistory, String> {
    let path = chat_path(app_handle)?;
    if !path.exists() {
        return Ok(ChatHistory::default());
    }
    let data = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read chat history: {}", e))?;
    serde_json::from_str(&data).map_err(|e| format!("Failed to parse chat history: {}", e))
}

fn ensure_cache(
    app_handle: &tauri::AppHandle,
) -> Result<MutexGuard<'static, Option<ChatHistory>>, String> {
    let mut guard = CHAT_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        let data = load_from_disk(app_handle)?;
        *guard = Some(data);
    }
    Ok(guard)
}

fn flush_to_disk(
    app_handle: &tauri::AppHandle,
    guard: &MutexGuard<'static, Option<ChatHistory>>,
) -> Result<(), String> {
    let history = guard
        .as_ref()
        .ok_or_else(|| "Chat cache not initialized".to_string())?;
    let path = chat_path(app_handle)?;
    let data =
        serde_json::to_string_pretty(history).map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&path, data).map_err(|e| format!("Failed to write chat history: {}", e))?;
    Ok(())
}

// ─── Commands ───────────────────────────────────────────────────────────────

/// List all chat sessions (without full message bodies for performance).
#[tauri::command]
pub async fn get_chat_sessions(
    app_handle: tauri::AppHandle,
) -> Result<Vec<ChatSessionSummary>, String> {
    let guard = ensure_cache(&app_handle)?;
    let history = guard.as_ref().unwrap();
    Ok(history
        .sessions
        .iter()
        .map(|s| ChatSessionSummary {
            id: s.id.clone(),
            title: s.title.clone(),
            message_count: s.messages.len(),
            created_at: s.created_at.clone(),
            updated_at: s.updated_at.clone(),
        })
        .collect())
}

/// Load a single session with all messages.
#[tauri::command]
pub async fn get_chat_session(
    app_handle: tauri::AppHandle,
    session_id: String,
) -> Result<Option<ChatSession>, String> {
    let guard = ensure_cache(&app_handle)?;
    let history = guard.as_ref().unwrap();
    Ok(history
        .sessions
        .iter()
        .find(|s| s.id == session_id)
        .cloned())
}

/// Save (create or update) a chat session.
#[tauri::command]
pub async fn save_chat_session(
    app_handle: tauri::AppHandle,
    session: ChatSession,
) -> Result<(), String> {
    let mut guard = ensure_cache(&app_handle)?;
    let history = guard.as_mut().unwrap();

    if let Some(existing) = history.sessions.iter_mut().find(|s| s.id == session.id) {
        existing.title = session.title;
        existing.messages = session.messages;
        existing.updated_at = chrono::Utc::now().to_rfc3339();
    } else {
        let mut new_session = session;
        let now = chrono::Utc::now().to_rfc3339();
        if new_session.created_at.is_empty() {
            new_session.created_at = now.clone();
        }
        new_session.updated_at = now;
        history.sessions.push(new_session);
    }

    flush_to_disk(&app_handle, &guard)?;
    Ok(())
}

/// Delete a chat session.
#[tauri::command]
pub async fn delete_chat_session(
    app_handle: tauri::AppHandle,
    session_id: String,
) -> Result<(), String> {
    let mut guard = ensure_cache(&app_handle)?;
    let history = guard.as_mut().unwrap();
    history.sessions.retain(|s| s.id != session_id);
    flush_to_disk(&app_handle, &guard)?;
    Ok(())
}

/// Clear all chat sessions.
#[tauri::command]
pub async fn clear_chat_history(app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut guard = ensure_cache(&app_handle)?;
    let history = guard.as_mut().unwrap();
    history.sessions.clear();
    flush_to_disk(&app_handle, &guard)?;
    Ok(())
}

// ─── Summary type (lightweight, no messages) ────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatSessionSummary {
    pub id: String,
    pub title: String,
    pub message_count: usize,
    pub created_at: String,
    pub updated_at: String,
}
