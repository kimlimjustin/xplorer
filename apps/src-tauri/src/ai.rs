use ollama_rs::{generation::completion::request::GenerationRequest, Ollama};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::path::Path;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;
use tauri::Emitter;
use tracing::{info, warn};

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIModel {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub available: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileContext {
    pub name: String,
    pub path: String,
    pub file_type: String,
    pub content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FolderSizeInfo {
    pub total_size: u64,
    pub file_count: u64,
    pub dir_count: u64,
    pub is_cached: bool,
    pub cache_timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserDirectories {
    pub home: String,
    pub documents: String,
    pub downloads: String,
    pub desktop: String,
    pub pictures: String,
    pub videos: String,
    pub music: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub version: String,
    pub hostname: String,
}

// Cache for folder sizes with timestamps
static FOLDER_SIZE_CACHE: LazyLock<Arc<Mutex<HashMap<String, FolderSizeInfo>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(HashMap::new())));
static RECENT_FOLDERS: LazyLock<Arc<Mutex<Vec<String>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(Vec::new())));

// Cache expiration time in seconds (5 minutes)
const CACHE_EXPIRATION_SECONDS: u64 = 300;

// Helper function to send output to Xplorer's terminal
fn send_terminal_output(app_handle: &tauri::AppHandle, message: &str) {
    // Emit event to frontend terminal output
    if let Err(e) = app_handle.emit("terminal-output", message) {
        warn!("Failed to emit terminal output: {}", e);
    }
}

#[command]
pub async fn get_ai_models() -> Result<Vec<AIModel>, String> {
    info!("Fetching AI models...");

    let mut all_models = Vec::new();

    // Add Claude models if API key is available (from keychain or env var for dev)
    let claude_api_key = crate::secure_credentials::get_secret("agent-api-key")
        .ok()
        .flatten()
        .or_else(|| env::var("CLAUDE_API_KEY").ok());
    if claude_api_key.is_some() {
        all_models.extend(vec![
            AIModel {
                id: "claude-3-5-sonnet-20241022".to_string(),
                name: "Claude 3.5 Sonnet".to_string(),
                provider: "anthropic".to_string(),
                available: true,
            },
            AIModel {
                id: "claude-3-5-haiku-20241022".to_string(),
                name: "Claude 3.5 Haiku".to_string(),
                provider: "anthropic".to_string(),
                available: true,
            },
            AIModel {
                id: "claude-3-opus-20240229".to_string(),
                name: "Claude 3 Opus".to_string(),
                provider: "anthropic".to_string(),
                available: true,
            },
        ]);
        info!("Added Claude models to available models");
    }

    // Try to get Ollama models
    let ollama = Ollama::default();
    match ollama.list_local_models().await {
        Ok(models) => {
            for model in models {
                all_models.push(AIModel {
                    id: model.name.clone(),
                    name: model.name,
                    provider: "ollama".to_string(),
                    available: true,
                });
            }
            info!(
                "Added {} Ollama models",
                all_models.iter().filter(|m| m.provider == "ollama").count()
            );
        }
        Err(e) => {
            warn!("Failed to connect to Ollama: {}", e);
            // Add default Ollama models even if Ollama is not available
            all_models.extend(vec![
                AIModel {
                    id: "deepseek-r1:1.5b".to_string(),
                    name: "DeepSeek R1 1.5B".to_string(),
                    provider: "ollama".to_string(),
                    available: false, // Mark as unavailable since Ollama is not running
                },
                AIModel {
                    id: "deepseek-r1:8b".to_string(),
                    name: "DeepSeek R1 8B".to_string(),
                    provider: "ollama".to_string(),
                    available: false,
                },
            ]);
            info!("Added default Ollama models (marked as unavailable)");
        }
    }

    info!("Total available models: {}", all_models.len());
    Ok(all_models)
}

#[command]
pub async fn check_ollama_status() -> Result<bool, String> {
    info!("Checking Ollama status...");

    let ollama = Ollama::default();

    match ollama.list_local_models().await {
        Ok(_) => {
            info!("Ollama is running and accessible");
            Ok(true)
        }
        Err(e) => {
            warn!("Failed to connect to Ollama: {}", e);
            Ok(false)
        }
    }
}

#[command]
pub async fn chat_with_ai(
    model: String,
    messages: Vec<ChatMessage>,
    file_context: Option<FileContext>,
) -> Result<String, String> {
    info!("Starting chat with AI using model: {}", model);

    // Route to appropriate AI service
    route_ai_request(model, messages, file_context).await
}

#[command]
pub async fn analyze_file_with_ai(
    model: String,
    file_context: FileContext,
) -> Result<String, String> {
    info!("Analyzing file with AI using model: {}", model);

    // Create a message for analysis
    let analysis_message = ChatMessage {
        role: "user".to_string(),
        content: format!(
            "Please analyze this file and provide helpful insights:\n\n\
            Please provide:\n\
            1. What this file is for\n\
            2. Key features or functionality (if code)\n\
            3. Any suggestions for improvement\n\
            4. Related files that might be needed\n\n\
            Be concise and practical."
        ),
    };

    // Route to appropriate AI service
    route_ai_request(model, vec![analysis_message], Some(file_context)).await
}

#[command]
pub async fn get_file_help(
    model: String,
    file_name: String,
    file_type: String,
) -> Result<String, String> {
    info!("Getting file help with AI using model: {}", model);

    // Create a message for file help
    let help_message = ChatMessage {
        role: "user".to_string(),
        content: format!(
            "Provide helpful information about this file type and common use cases.\n\n\
            File: {}\n\
            Type: {}\n\n\
            Please explain:\n\
            1. What this file type is used for\n\
            2. Common tools or applications that work with it\n\
            3. Best practices for working with this file type\n\
            4. Any important considerations\n\n\
            Be helpful and educational.",
            file_name, file_type
        ),
    };

    // Route to appropriate AI service
    route_ai_request(model, vec![help_message], None).await
}

#[command]
pub async fn calculate_folder_size(
    folder_path: String,
    app_handle: tauri::AppHandle,
) -> Result<FolderSizeInfo, String> {
    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("Path does not exist or is not a directory".to_string());
    }

    send_terminal_output(
        &app_handle,
        &format!("Starting folder size calculation for: {}", folder_path),
    );

    // Check cache first
    {
        let cache = FOLDER_SIZE_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(cached_info) = cache.get(&folder_path) {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();

            // Return cached result if it's not expired
            if now - cached_info.cache_timestamp < CACHE_EXPIRATION_SECONDS {
                send_terminal_output(
                    &app_handle,
                    &format!("Returning cached folder size for: {}", folder_path),
                );
                return Ok(cached_info.clone());
            }
        }
    }

    // Calculate folder size
    let size_info = calculate_directory_size_recursive(path, &app_handle).await?;

    let folder_size_info = FolderSizeInfo {
        total_size: size_info.total_size,
        file_count: size_info.file_count,
        dir_count: size_info.dir_count,
        is_cached: false,
        cache_timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    };

    // Update cache
    {
        let mut cache = FOLDER_SIZE_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        cache.insert(folder_path.clone(), folder_size_info.clone());
    }

    send_terminal_output(
        &app_handle,
        &format!(
            "Calculated and cached folder size for: {} - {} bytes",
            folder_path, folder_size_info.total_size
        ),
    );
    Ok(folder_size_info)
}

#[command]
pub async fn get_cached_folder_sizes(
    folder_paths: Vec<String>,
) -> Result<HashMap<String, FolderSizeInfo>, String> {
    let cache = FOLDER_SIZE_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let mut result = HashMap::new();
    for path in folder_paths {
        if let Some(cached_info) = cache.get(&path) {
            // Only return if cache is still valid
            if now - cached_info.cache_timestamp < CACHE_EXPIRATION_SECONDS {
                result.insert(path, cached_info.clone());
            }
        }
    }

    Ok(result)
}

#[command]
pub async fn clear_folder_size_cache(app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut cache = FOLDER_SIZE_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    cache.clear();
    send_terminal_output(&app_handle, "Folder size cache cleared");
    Ok(())
}

#[derive(Debug)]
struct DirectorySizeResult {
    total_size: u64,
    file_count: u64,
    dir_count: u64,
}

async fn calculate_directory_size_recursive(
    dir_path: &Path,
    app_handle: &tauri::AppHandle,
) -> Result<DirectorySizeResult, String> {
    use std::fs;

    let mut total_size = 0u64;
    let mut file_count = 0u64;
    let mut dir_count = 0u64;

    let entries = fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory {}: {}", dir_path.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;

        let path = entry.path();
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to get metadata for {}: {}", path.display(), e))?;

        if metadata.is_file() {
            total_size += metadata.len();
            file_count += 1;
        } else if metadata.is_dir() {
            dir_count += 1;

            // Recursively calculate subdirectory size using Box::pin to avoid infinite size
            let recursive_future = Box::pin(calculate_directory_size_recursive(&path, app_handle));
            match recursive_future.await {
                Ok(subdir_result) => {
                    total_size += subdir_result.total_size;
                    file_count += subdir_result.file_count;
                    dir_count += subdir_result.dir_count;
                }
                Err(e) => {
                    // Log error but continue with other directories
                    send_terminal_output(
                        &app_handle,
                        &format!(
                            "Warning: Failed to calculate size for subdirectory {}: {}",
                            path.display(),
                            e
                        ),
                    );
                }
            }
        }
    }

    Ok(DirectorySizeResult {
        total_size,
        file_count,
        dir_count,
    })
}

// User directory operations
#[command]
pub async fn get_user_directories() -> Result<UserDirectories, String> {
    let home_path =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
    let home = home_path.to_string_lossy().to_string();

    Ok(UserDirectories {
        home: home.clone(),
        documents: home_path.join("Documents").to_string_lossy().to_string(),
        downloads: home_path.join("Downloads").to_string_lossy().to_string(),
        desktop: home_path.join("Desktop").to_string_lossy().to_string(),
        pictures: home_path.join("Pictures").to_string_lossy().to_string(),
        videos: home_path.join("Videos").to_string_lossy().to_string(),
        music: home_path.join("Music").to_string_lossy().to_string(),
    })
}

#[command]
pub async fn get_recent_folders() -> Result<Vec<String>, String> {
    let recent_folders = RECENT_FOLDERS.lock().map_err(|e| e.to_string())?;
    Ok(recent_folders.clone())
}

#[command]
pub async fn add_to_recent_folders(path: String) -> Result<(), String> {
    let mut recent_folders = RECENT_FOLDERS.lock().map_err(|e| e.to_string())?;

    // Remove if already exists
    recent_folders.retain(|p| p != &path);

    // Add to front
    recent_folders.insert(0, path);

    // Keep only last 10
    if recent_folders.len() > 10 {
        recent_folders.truncate(10);
    }

    Ok(())
}

#[command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    let os = env::consts::OS.to_string();
    let arch = env::consts::ARCH.to_string();
    let version = env::var("OS").unwrap_or_else(|_| "Unknown".to_string());
    let hostname = env::var("COMPUTERNAME")
        .or_else(|_| env::var("HOSTNAME"))
        .unwrap_or_else(|_| "Unknown".to_string());

    Ok(SystemInfo {
        os,
        arch,
        version,
        hostname,
    })
}

// Claude API structures
#[derive(Debug, Serialize, Deserialize)]
struct ClaudeMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<ClaudeMessage>,
    system: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ClaudeContent {
    #[serde(rename = "type")]
    content_type: String,
    text: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
    #[serde(rename = "type")]
    response_type: String,
}

// Claude API client
async fn chat_with_claude(
    model: String,
    messages: Vec<ChatMessage>,
    file_context: Option<FileContext>,
) -> Result<String, String> {
    let api_key = crate::secure_credentials::get_secret("agent-api-key")
        .ok()
        .flatten()
        .or_else(|| env::var("CLAUDE_API_KEY").ok())
        .ok_or_else(|| {
            "Claude API key not configured. Set it in Settings → AI Agent.".to_string()
        })?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .connect_timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Build system message
    let mut system_message = "You are Copilot, an AI assistant integrated into the Xplorer file explorer. You help users with file management, code analysis, and development tasks. Be helpful, thorough, and practical. Provide detailed, comprehensive responses with specific examples and step-by-step guidance when appropriate. Include code examples, best practices, and additional context that would be valuable to the user.".to_string();

    // Add file context to system message if provided
    if let Some(context) = &file_context {
        system_message.push_str(&format!(
            "\n\nYou are currently working with:\nFile: {}\nPath: {}\nType: {}",
            context.name, context.path, context.file_type
        ));

        if let Some(content) = &context.content {
            system_message.push_str(&format!("\nContent:\n{}", content));
        }
    }

    // Convert messages to Claude format
    let claude_messages: Vec<ClaudeMessage> = messages
        .into_iter()
        .map(|msg| ClaudeMessage {
            role: if msg.role == "user" {
                "user".to_string()
            } else {
                "assistant".to_string()
            },
            content: msg.content,
        })
        .collect();

    let request_body = ClaudeRequest {
        model,
        max_tokens: 4096,
        messages: claude_messages,
        system: Some(system_message),
    };

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to send request to Claude API: {}", e))?;

    if !response.status().is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Claude API error: {}", error_text));
    }

    let claude_response: ClaudeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Claude response: {}", e))?;

    // Extract text from the first content item
    claude_response
        .content
        .first()
        .map(|content| content.text.clone())
        .ok_or_else(|| "No content in Claude response".to_string())
}

// Update the main chat function to route to appropriate AI service
async fn route_ai_request(
    model: String,
    messages: Vec<ChatMessage>,
    file_context: Option<FileContext>,
) -> Result<String, String> {
    // Check if it's a Claude model
    if model.starts_with("claude-") {
        chat_with_claude(model, messages, file_context).await
    } else {
        // Use existing Ollama chat function
        chat_with_ollama(model, messages, file_context).await
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Search Re-ranking
// ─────────────────────────────────────────────────────────────────────────────

/// Re-rank search results using an AI provider (Claude, OpenAI, or Ollama).
/// `prompt` contains the formatted query + file list.
/// Returns the raw AI response text (expected to be JSON).
pub async fn search_rerank_with_ai(
    prompt: &str,
    provider: &str,
    api_key: Option<&str>,
    model: Option<&str>,
) -> Result<String, String> {
    match provider {
        "claude" => {
            let key = api_key
                .map(|k| k.to_string())
                .or_else(|| {
                    crate::secure_credentials::get_secret("agent-api-key")
                        .ok()
                        .flatten()
                })
                .or_else(|| env::var("CLAUDE_API_KEY").ok())
                .ok_or_else(|| {
                    "Claude API key not configured. Set it in Settings → AI Agent.".to_string()
                })?;

            let model_id = model.unwrap_or("claude-sonnet-4-6-20250514");

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .map_err(|e| format!("HTTP client error: {}", e))?;

            let body = serde_json::json!({
                "model": model_id,
                "max_tokens": 2048,
                "messages": [{"role": "user", "content": prompt}],
                "system": "You are a file search relevance ranker. Return ONLY valid JSON arrays. No explanation."
            });

            let response = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Claude API request failed: {}", e))?;

            if !response.status().is_success() {
                let err = response.text().await.unwrap_or_default();
                return Err(format!("Claude API error: {}", err));
            }

            let resp: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse Claude response: {}", e))?;

            // Extract text from content array.
            resp.get("content")
                .and_then(|c| c.as_array())
                .and_then(|arr| arr.first())
                .and_then(|item| item.get("text"))
                .and_then(|t| t.as_str())
                .map(|s| {
                    // Extract JSON array from response (may be wrapped in markdown).
                    if let Some(start) = s.find('[') {
                        if let Some(end) = s.rfind(']') {
                            return s[start..=end].to_string();
                        }
                    }
                    s.to_string()
                })
                .ok_or_else(|| "No content in Claude response".to_string())
        }

        "openai" => {
            let key = api_key
                .map(|k| k.to_string())
                .or_else(|| {
                    crate::secure_credentials::get_secret("agent-openai-api-key")
                        .ok()
                        .flatten()
                })
                .or_else(|| env::var("OPENAI_API_KEY").ok())
                .ok_or_else(|| {
                    "OpenAI API key not configured. Set it in Settings → AI Agent.".to_string()
                })?;

            let model_id = model.unwrap_or("gpt-4o-mini");

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .map_err(|e| format!("HTTP client error: {}", e))?;

            let body = serde_json::json!({
                "model": model_id,
                "max_tokens": 2048,
                "messages": [
                    {"role": "system", "content": "You are a file search relevance ranker. Return ONLY valid JSON arrays. No explanation."},
                    {"role": "user", "content": prompt}
                ]
            });

            let response = client
                .post("https://api.openai.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {}", key))
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("OpenAI API request failed: {}", e))?;

            if !response.status().is_success() {
                let err = response.text().await.unwrap_or_default();
                return Err(format!("OpenAI API error: {}", err));
            }

            let resp: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

            resp.get("choices")
                .and_then(|c| c.as_array())
                .and_then(|arr| arr.first())
                .and_then(|choice| choice.get("message"))
                .and_then(|msg| msg.get("content"))
                .and_then(|t| t.as_str())
                .map(|s| {
                    if let Some(start) = s.find('[') {
                        if let Some(end) = s.rfind(']') {
                            return s[start..=end].to_string();
                        }
                    }
                    s.to_string()
                })
                .ok_or_else(|| "No content in OpenAI response".to_string())
        }

        "ollama" => {
            let model_id = model.unwrap_or("llama3");

            let ollama = Ollama::default();
            let request = GenerationRequest::new(model_id.to_string(), prompt.to_string());

            match ollama.generate(request).await {
                Ok(response) => {
                    let text = response.response;
                    if let Some(start) = text.find('[') {
                        if let Some(end) = text.rfind(']') {
                            return Ok(text[start..=end].to_string());
                        }
                    }
                    Ok(text)
                }
                Err(e) => Err(format!("Ollama error: {}. Is Ollama running?", e)),
            }
        }

        _ => Err(format!("Unknown AI provider: {}", provider)),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Rename Suggestions
// ─────────────────────────────────────────────────────────────────────────────

const IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp", "svg", "ico",
];
const DOCUMENT_EXTENSIONS: &[&str] = &[
    "pdf", "docx", "xlsx", "pptx", "doc", "xls", "ppt", "txt", "md", "rtf", "csv",
];

/// Ask Ollama to suggest 3 descriptive filenames for a given file.
/// Uses vision for images, text extraction for documents, and metadata for other files.
#[command]
pub async fn suggest_filename(file_path: String) -> Result<Vec<String>, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let original_name = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    let prompt: String;

    if IMAGE_EXTENSIONS.contains(&ext.as_str()) {
        // For images: use vision model to describe, then suggest filenames
        let vision_model = detect_ollama_vision_model().await;
        if let Some(model) = vision_model {
            let image_bytes =
                std::fs::read(&file_path).map_err(|e| format!("Failed to read image: {}", e))?;
            let base64_image =
                base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &image_bytes);

            let description = call_ollama_vision_async(
                &model,
                "Describe this image briefly in 1-2 sentences. What is the main subject?",
                &[base64_image],
            )
            .await?;

            prompt = format!(
                "Based on this image description: \"{}\"\n\n\
                 The original filename is \"{}\" with extension \".{}\".\n\n\
                 Suggest exactly 3 short, descriptive filenames (without the extension) that describe the image content.\n\
                 Rules:\n\
                 - Use lowercase with hyphens between words\n\
                 - Keep names under 40 characters\n\
                 - Make names descriptive but concise\n\
                 - Do NOT include the file extension\n\n\
                 Return ONLY the 3 filenames, one per line, nothing else.",
                description, original_name, ext
            );
        } else {
            // No vision model, fall back to metadata-based suggestion
            let meta = std::fs::metadata(&file_path)
                .map_err(|e| format!("Failed to read metadata: {}", e))?;
            prompt = format!(
                "Suggest exactly 3 short, descriptive filenames for an image file.\n\
                 Original name: \"{}\"\n\
                 Extension: .{}\n\
                 Size: {} bytes\n\n\
                 Rules:\n\
                 - Use lowercase with hyphens between words\n\
                 - Keep names under 40 characters\n\
                 - Do NOT include the file extension\n\n\
                 Return ONLY the 3 filenames, one per line, nothing else.",
                original_name,
                ext,
                meta.len()
            );
        }
    } else if DOCUMENT_EXTENSIONS.contains(&ext.as_str()) {
        // For documents: extract first ~500 chars of content
        let content_snippet = match crate::document_extractor::extract_text(&file_path) {
            Ok(text) => {
                let trimmed: String = text.chars().take(500).collect();
                trimmed
            }
            Err(_) => {
                // Fallback: try reading as plain text
                match std::fs::read_to_string(&file_path) {
                    Ok(text) => text.chars().take(500).collect(),
                    Err(_) => String::new(),
                }
            }
        };

        prompt = format!(
            "Based on this document content snippet:\n\"{}\"\n\n\
             The original filename is \"{}\" with extension \".{}\".\n\n\
             Suggest exactly 3 short, descriptive filenames (without the extension) based on the content.\n\
             Rules:\n\
             - Use lowercase with hyphens between words\n\
             - Keep names under 40 characters\n\
             - Make names reflect the document's topic or purpose\n\
             - Do NOT include the file extension\n\n\
             Return ONLY the 3 filenames, one per line, nothing else.",
            content_snippet, original_name, ext
        );
    } else {
        // For other files: use metadata
        let meta =
            std::fs::metadata(&file_path).map_err(|e| format!("Failed to read metadata: {}", e))?;

        let modified = meta
            .modified()
            .unwrap_or(std::time::UNIX_EPOCH)
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        prompt = format!(
            "Suggest exactly 3 short, descriptive filenames for a file.\n\
             Original name: \"{}\"\n\
             Extension: .{}\n\
             Size: {} bytes\n\
             Last modified timestamp: {}\n\n\
             Rules:\n\
             - Use lowercase with hyphens between words\n\
             - Keep names under 40 characters\n\
             - Make names descriptive based on the file type and original name\n\
             - Do NOT include the file extension\n\n\
             Return ONLY the 3 filenames, one per line, nothing else.",
            original_name,
            ext,
            meta.len(),
            modified
        );
    }

    // Send prompt to Ollama (use a lightweight model)
    let model = get_default_ollama_model().await;
    let ollama = Ollama::default();
    let request = GenerationRequest::new(model.clone(), prompt);

    let response = ollama.generate(request).await.map_err(|e| {
        format!(
            "Failed to get AI response: {}. Make sure Ollama is running.",
            e
        )
    })?;

    // Parse the response into individual filenames
    let suggestions: Vec<String> = response
        .response
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        // Strip leading numbering like "1." or "1)" or "- "
        .map(|line| {
            let cleaned = line
                .trim_start_matches(|c: char| {
                    c.is_ascii_digit() || c == '.' || c == ')' || c == '-' || c == '*'
                })
                .trim();
            // Remove quotes if present
            let cleaned = cleaned.trim_matches('"').trim_matches('\'');
            // Sanitize: only allow alphanumeric, hyphens, underscores
            let sanitized: String = cleaned
                .chars()
                .map(|c| {
                    if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                        c
                    } else {
                        '-'
                    }
                })
                .collect();
            let sanitized = sanitized.trim_matches('-').to_string();
            // Replace spaces with hyphens
            sanitized.replace(' ', "-").to_lowercase()
        })
        .filter(|name| !name.is_empty() && name.len() <= 60)
        .take(3)
        .collect();

    if suggestions.is_empty() {
        return Err("AI did not return any valid filename suggestions.".to_string());
    }

    // Append the original extension
    let with_ext: Vec<String> = suggestions
        .into_iter()
        .map(|name| {
            if ext.is_empty() {
                name
            } else {
                format!("{}.{}", name, ext)
            }
        })
        .collect();

    Ok(with_ext)
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Tag by Content
// ─────────────────────────────────────────────────────────────────────────────

/// Classify files using AI and suggest content-based tags.
/// Returns Vec<(path, Vec<tag>)>.
#[command]
pub async fn auto_tag_files(file_paths: Vec<String>) -> Result<Vec<(String, Vec<String>)>, String> {
    if file_paths.is_empty() {
        return Ok(Vec::new());
    }

    let model = get_default_ollama_model().await;
    let vision_model = detect_ollama_vision_model().await;
    let ollama = Ollama::default();
    let mut results: Vec<(String, Vec<String>)> = Vec::new();

    for file_path in &file_paths {
        let path = Path::new(file_path);
        if !path.exists() {
            results.push((file_path.clone(), vec![]));
            continue;
        }

        let ext = path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        let prompt: String;

        if IMAGE_EXTENSIONS.contains(&ext.as_str()) {
            // For images: try vision model
            if let Some(ref vm) = vision_model {
                let image_bytes = match std::fs::read(file_path) {
                    Ok(b) => b,
                    Err(_) => {
                        results.push((file_path.clone(), vec![]));
                        continue;
                    }
                };
                let base64_image = base64::Engine::encode(
                    &base64::engine::general_purpose::STANDARD,
                    &image_bytes,
                );

                let description = match call_ollama_vision_async(
                    vm,
                    "Describe this image briefly. What type of image is it?",
                    &[base64_image],
                )
                .await
                {
                    Ok(d) => d,
                    Err(_) => {
                        results.push((file_path.clone(), classify_by_extension(&ext)));
                        continue;
                    }
                };

                prompt = format!(
                    "Based on this image description: \"{}\"\n\n\
                     Classify this image into one or more of these categories: \
                     receipt, screenshot, photo, document, code, presentation, diagram, chart, meme, artwork, icon.\n\n\
                     Return ONLY the matching category names separated by commas, nothing else.\n\
                     Example: photo, screenshot",
                    description
                );
            } else {
                results.push((file_path.clone(), classify_by_extension(&ext)));
                continue;
            }
        } else if DOCUMENT_EXTENSIONS.contains(&ext.as_str()) {
            // For documents: extract content snippet
            let content_snippet = match crate::document_extractor::extract_text(file_path) {
                Ok(text) => text.chars().take(300).collect::<String>(),
                Err(_) => match std::fs::read_to_string(file_path) {
                    Ok(text) => text.chars().take(300).collect(),
                    Err(_) => String::new(),
                },
            };

            if content_snippet.is_empty() {
                results.push((file_path.clone(), classify_by_extension(&ext)));
                continue;
            }

            prompt = format!(
                "Based on this document content:\n\"{}\"\n\n\
                 File extension: .{}\n\n\
                 Classify this file into one or more of these categories: \
                 receipt, screenshot, photo, document, code, presentation, spreadsheet, report, letter, invoice, resume, notes.\n\n\
                 Return ONLY the matching category names separated by commas, nothing else.\n\
                 Example: document, report",
                content_snippet, ext
            );
        } else {
            // For other files: classify by extension and metadata
            results.push((file_path.clone(), classify_by_extension(&ext)));
            continue;
        }

        // Send classification prompt to Ollama
        let request = GenerationRequest::new(model.clone(), prompt);
        match ollama.generate(request).await {
            Ok(response) => {
                let tags: Vec<String> = response
                    .response
                    .split(',')
                    .map(|t| t.trim().to_lowercase())
                    .filter(|t| !t.is_empty() && t.len() < 30)
                    // Only keep recognized categories
                    .filter(|t| {
                        let valid_tags = [
                            "receipt",
                            "screenshot",
                            "photo",
                            "document",
                            "code",
                            "presentation",
                            "spreadsheet",
                            "music",
                            "video",
                            "report",
                            "letter",
                            "invoice",
                            "resume",
                            "notes",
                            "diagram",
                            "chart",
                            "meme",
                            "artwork",
                            "icon",
                        ];
                        valid_tags.contains(&t.as_str())
                    })
                    .collect();

                if tags.is_empty() {
                    results.push((file_path.clone(), classify_by_extension(&ext)));
                } else {
                    results.push((file_path.clone(), tags));
                }
            }
            Err(_) => {
                results.push((file_path.clone(), classify_by_extension(&ext)));
            }
        }
    }

    Ok(results)
}

/// Fallback classification purely from file extension
fn classify_by_extension(ext: &str) -> Vec<String> {
    match ext {
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "tiff" | "webp" | "svg" | "ico" => {
            vec!["photo".to_string()]
        }
        "pdf" | "docx" | "doc" | "rtf" | "txt" | "md" => vec!["document".to_string()],
        "xlsx" | "xls" | "csv" => vec!["spreadsheet".to_string()],
        "pptx" | "ppt" => vec!["presentation".to_string()],
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" | "m4a" => vec!["music".to_string()],
        "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" | "webm" => vec!["video".to_string()],
        "rs" | "js" | "ts" | "tsx" | "jsx" | "py" | "go" | "java" | "c" | "cpp" | "h" | "cs"
        | "rb" | "php" | "swift" | "kt" => vec!["code".to_string()],
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" => vec!["archive".to_string()],
        "exe" | "msi" | "dmg" | "deb" | "rpm" | "appimage" => vec!["executable".to_string()],
        _ => vec![],
    }
}

/// Detect an available Ollama vision model (async version)
async fn detect_ollama_vision_model() -> Option<String> {
    let vision_models = [
        "llava",
        "bakllava",
        "moondream",
        "llava-llama3",
        "llava:13b",
        "llava:7b",
    ];

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(_) => return None,
    };

    let response = match client.get("http://localhost:11434/api/tags").send().await {
        Ok(r) => r,
        Err(_) => return None,
    };

    #[derive(Deserialize)]
    struct OllamaModel {
        name: String,
    }
    #[derive(Deserialize)]
    struct OllamaModelList {
        models: Vec<OllamaModel>,
    }

    let model_list: OllamaModelList = match response.json().await {
        Ok(m) => m,
        Err(_) => return None,
    };

    for model in &model_list.models {
        let name_lower = model.name.to_lowercase();
        for vision in &vision_models {
            if name_lower.contains(vision) {
                return Some(model.name.clone());
            }
        }
    }

    None
}

/// Get a default Ollama model for text generation
async fn get_default_ollama_model() -> String {
    let ollama = Ollama::default();
    match ollama.list_local_models().await {
        Ok(models) => {
            // Prefer smaller / faster models for short tasks
            let preferred = [
                "llama3.2:1b",
                "llama3.2:3b",
                "llama3:8b",
                "mistral",
                "deepseek-r1:1.5b",
                "deepseek-r1:8b",
                "gemma",
            ];
            for pref in &preferred {
                if let Some(m) = models.iter().find(|m| m.name.to_lowercase().contains(pref)) {
                    return m.name.clone();
                }
            }
            // Fall back to the first available model
            models
                .first()
                .map(|m| m.name.clone())
                .unwrap_or_else(|| "llama3.2:1b".to_string())
        }
        Err(_) => "llama3.2:1b".to_string(),
    }
}

/// Call Ollama vision API (async version for use in async commands)
async fn call_ollama_vision_async(
    model: &str,
    prompt: &str,
    images: &[String],
) -> Result<String, String> {
    #[derive(Serialize)]
    struct OllamaGenReq {
        model: String,
        prompt: String,
        images: Option<Vec<String>>,
        stream: bool,
    }
    #[derive(Deserialize)]
    struct OllamaGenResp {
        response: String,
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let request = OllamaGenReq {
        model: model.to_string(),
        prompt: prompt.to_string(),
        images: Some(images.to_vec()),
        stream: false,
    };

    let response = client
        .post("http://localhost:11434/api/generate")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Ollama API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Ollama API error ({}): {}", status, body));
    }

    let result: OllamaGenResp = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    Ok(result.response)
}

// Rename the existing chat function and create a new router
async fn chat_with_ollama(
    model: String,
    messages: Vec<ChatMessage>,
    file_context: Option<FileContext>,
) -> Result<String, String> {
    info!("Starting chat with Ollama using model: {}", model);

    let ollama = Ollama::default();

    // Build the prompt from messages
    let mut prompt = String::new();

    // Add system context
    prompt.push_str("You are Copilot, an AI assistant integrated into the Xplorer file explorer. You help users with file management, code analysis, and development tasks. Be helpful, thorough, and practical. Provide detailed, comprehensive responses with specific examples and step-by-step guidance when appropriate. Include code examples, best practices, and additional context that would be valuable to the user.\n\n");

    // Add file context if provided
    if let Some(context) = &file_context {
        prompt.push_str(&format!(
            "You are currently working with:\nFile: {}\nPath: {}\nType: {}\n",
            context.name, context.path, context.file_type
        ));

        if let Some(content) = &context.content {
            prompt.push_str(&format!("Content:\n{}\n\n", content));
        }
    }

    // Add conversation history
    for message in &messages {
        match message.role.as_str() {
            "user" => prompt.push_str(&format!("User: {}\n", message.content)),
            "assistant" => prompt.push_str(&format!("Assistant: {}\n", message.content)),
            "system" => prompt.push_str(&format!("System: {}\n", message.content)),
            _ => prompt.push_str(&format!("{}: {}\n", message.role, message.content)),
        }
    }

    prompt.push_str("\nAssistant: ");

    info!(
        "Sending prompt to Ollama: {}",
        &prompt[..prompt.len().min(200)]
    );

    let request = GenerationRequest::new(model.clone(), prompt);

    match ollama.generate(request).await {
        Ok(response) => {
            info!("AI response completed successfully");
            let mut result = response.response;

            // Clean up the response - remove any meta-commentary or thinking tags
            let original_response = result.clone();

            // Remove common thinking patterns (compiled once via lazy_static-style approach)
            use std::sync::OnceLock;
            static CLEANUP_REGEXES: OnceLock<Vec<regex::Regex>> = OnceLock::new();
            let regexes = CLEANUP_REGEXES.get_or_init(|| {
                [
                    r"<thinking>.*?</thinking>",
                    r"Let me think about this.*?\n",
                    r"I need to.*?\n",
                    r"First, I'll.*?\n",
                    r"Looking at this.*?\n",
                ]
                .iter()
                .filter_map(|p| regex::Regex::new(p).ok())
                .collect()
            });

            for re in regexes {
                result = re.replace_all(&result, "").to_string();
            }

            // If the result is empty after cleaning, return the original
            if result.trim().is_empty() {
                result = original_response;
            }

            Ok(result)
        }
        Err(e) => {
            warn!("Failed to get AI response: {}", e);
            Err(format!("Failed to get AI response from Ollama: {}. Make sure Ollama is running and the model '{}' is available.", e, model))
        }
    }
}
