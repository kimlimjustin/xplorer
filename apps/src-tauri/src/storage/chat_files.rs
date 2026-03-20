// Storage sub-module: Chat-as-Files
//
// Manages `.chat` files on disk — creating, reading, saving, and summarising
// chat conversations that are stored as regular JSON files with the `.chat`
// extension.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

// ─── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatFileData {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub thinking_enabled: bool,
    #[serde(default)]
    pub context: Vec<ChatFileContext>,
    #[serde(default)]
    pub messages: Vec<ChatFileMessage>,
}

fn default_version() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatFileMessage {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub timestamp: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatFileContext {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatFileSummary {
    pub message_count: usize,
    pub last_message_preview: String,
    pub model: String,
    pub last_updated: u64,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/// Sanitise a title string for use as a filename component.
/// Non-alphanumeric characters (except hyphens) are replaced with hyphens,
/// consecutive hyphens are collapsed, and leading/trailing hyphens are trimmed.
fn sanitize_title(title: &str) -> String {
    let sanitized: String = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '-' })
        .collect();

    // Collapse consecutive hyphens
    let mut result = String::new();
    let mut prev_hyphen = false;
    for c in sanitized.chars() {
        if c == '-' {
            if !prev_hyphen {
                result.push(c);
            }
            prev_hyphen = true;
        } else {
            result.push(c);
            prev_hyphen = false;
        }
    }

    result.trim_matches('-').to_string()
}

/// Build a unique file path inside `directory`, adding numeric suffixes if needed.
fn unique_file_path(directory: &Path, stem: &str) -> PathBuf {
    let candidate = directory.join(format!("{}.chat", stem));
    if !candidate.exists() {
        return candidate;
    }

    let mut counter = 1u32;
    loop {
        let candidate = directory.join(format!("{}_{}.chat", stem, counter));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

// ─── Commands ───────────────────────────────────────────────────────────────

/// Returns the default chats directory (`~/Documents/Xplorer Chats/`),
/// creating it if it does not already exist.
#[tauri::command]
pub async fn get_chats_directory() -> Result<String, String> {
    let docs_dir = dirs::document_dir()
        .ok_or_else(|| "Could not determine Documents directory".to_string())?;
    let chats_dir = docs_dir.join("Xplorer Chats");

    std::fs::create_dir_all(&chats_dir)
        .map_err(|e| format!("Failed to create chats directory: {}", e))?;

    Ok(chats_dir
        .to_str()
        .ok_or_else(|| "Chats directory path contains invalid UTF-8".to_string())?
        .to_string())
}

/// Creates a new `.chat` file with an empty message list.
///
/// The file is named `YYYY-MM-DD_<sanitized-title>.chat`. If no title is
/// provided, `"New Chat"` is used. If a file with the same name already
/// exists, a numeric suffix is appended.
///
/// Returns the full file path of the created file.
#[tauri::command]
pub async fn create_chat_file(
    directory: String,
    title: Option<String>,
) -> Result<String, String> {
    let dir = Path::new(&directory);
    if !dir.exists() {
        std::fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let raw_title = title.unwrap_or_else(|| "New Chat".to_string());
    let sanitized = sanitize_title(&raw_title);
    let title_part = if sanitized.is_empty() {
        "New-Chat".to_string()
    } else {
        sanitized
    };

    let date_prefix = chrono::Local::now().format("%Y-%m-%d").to_string();
    let stem = format!("{}_{}", date_prefix, title_part);

    let file_path = unique_file_path(dir, &stem);

    let data = ChatFileData {
        version: 1,
        model: String::new(),
        thinking_enabled: false,
        context: Vec::new(),
        messages: Vec::new(),
    };

    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize chat data: {}", e))?;
    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write chat file: {}", e))?;

    file_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "File path contains invalid UTF-8".to_string())
}

/// Reads and parses a `.chat` JSON file from disk.
#[tauri::command]
pub async fn read_chat_file(path: String) -> Result<ChatFileData, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(format!("Chat file does not exist: {}", path));
    }

    let data =
        std::fs::read_to_string(file_path).map_err(|e| format!("Failed to read chat file: {}", e))?;
    serde_json::from_str(&data).map_err(|e| format!("Failed to parse chat file: {}", e))
}

/// Writes `ChatFileData` as pretty-printed JSON to disk.
#[tauri::command]
pub async fn save_chat_file(path: String, data: ChatFileData) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize chat data: {}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write chat file: {}", e))?;
    Ok(())
}

/// Reads a `.chat` file and returns a lightweight summary.
#[tauri::command]
pub async fn get_chat_file_summary(path: String) -> Result<ChatFileSummary, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(format!("Chat file does not exist: {}", path));
    }

    let raw =
        std::fs::read_to_string(file_path).map_err(|e| format!("Failed to read chat file: {}", e))?;
    let data: ChatFileData =
        serde_json::from_str(&raw).map_err(|e| format!("Failed to parse chat file: {}", e))?;

    let message_count = data.messages.len();

    let last_message_preview = data
        .messages
        .last()
        .map(|m| {
            if m.content.len() > 100 {
                let mut truncated = m.content.chars().take(100).collect::<String>();
                truncated.push_str("...");
                truncated
            } else {
                m.content.clone()
            }
        })
        .unwrap_or_default();

    let last_updated = data
        .messages
        .last()
        .map(|m| m.timestamp)
        .filter(|&t| t > 0)
        .unwrap_or_else(|| {
            // Fall back to file modification time
            std::fs::metadata(file_path)
                .and_then(|meta| meta.modified())
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0)
        });

    Ok(ChatFileSummary {
        message_count,
        last_message_preview,
        model: data.model,
        last_updated,
    })
}
