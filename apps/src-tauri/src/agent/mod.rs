pub mod memory;
pub mod planner;
pub mod security;
pub mod streaming;
pub mod tool_executor;
pub mod tools;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, LazyLock, Mutex};
use tauri::command;
use tauri::Emitter;
use tokio::sync::oneshot;
use tracing::warn;

// Re-export key types
pub use memory::MemoryEntry;
pub use planner::OperationPlan;

// ─── Helpers ────────────────────────────────────────────────────────────────

pub fn truncate_to_char_boundary(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    let mut idx = max_bytes;
    while !s.is_char_boundary(idx) {
        idx -= 1;
    }
    &s[..idx]
}

// ─── Data Structures ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentToolCall {
    pub id: String,
    pub name: String,
    pub input: Value,
    pub requires_approval: bool,
    pub status: String, // "pending", "running", "completed", "denied", "error"
    pub result: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentEvent {
    pub event_type: String, // "text", "text_delta", "tool_call", "tool_result", "approval_request", "plan_created", "plan_progress", "complete", "error"
    pub session_id: String,
    pub tool_call: Option<AgentToolCall>,
    pub text: Option<String>,
    pub plan: Option<OperationPlan>,
    pub timestamp: u64,
}

fn default_thinking_budget() -> u32 {
    10_000
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSettings {
    pub enabled: bool,
    pub api_key: String,
    #[serde(default)]
    pub openai_api_key: String,
    pub model: String,
    pub max_turns: u32,
    pub auto_approve: bool,
    #[serde(default)]
    pub thinking_enabled: bool,
    #[serde(default = "default_thinking_budget")]
    pub thinking_budget: u32,
}

/// Redacted version of AgentSettings returned to the frontend.
/// API keys are replaced with boolean flags indicating whether they are set.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafeAgentSettings {
    pub enabled: bool,
    pub has_api_key: bool,
    pub has_openai_api_key: bool,
    pub model: String,
    pub max_turns: u32,
    pub auto_approve: bool,
    pub thinking_enabled: bool,
    pub thinking_budget: u32,
}

impl SafeAgentSettings {
    pub fn from_settings(settings: &AgentSettings) -> Self {
        Self {
            enabled: settings.enabled,
            has_api_key: !settings.api_key.is_empty(),
            has_openai_api_key: !settings.openai_api_key.is_empty(),
            model: settings.model.clone(),
            max_turns: settings.max_turns,
            auto_approve: settings.auto_approve,
            thinking_enabled: settings.thinking_enabled,
            thinking_budget: settings.thinking_budget,
        }
    }
}

/// Payload for updating non-secret agent settings.
/// Does NOT include API key fields — use `update_agent_api_keys` for those.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAgentSettingsPayload {
    pub enabled: bool,
    pub model: String,
    pub max_turns: u32,
    pub auto_approve: bool,
    #[serde(default)]
    pub thinking_enabled: bool,
    #[serde(default = "default_thinking_budget")]
    pub thinking_budget: u32,
}

/// Payload for updating API keys only.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAgentApiKeysPayload {
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub openai_api_key: Option<String>,
}

impl Default for AgentSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            api_key: String::new(),
            openai_api_key: String::new(),
            model: "claude-sonnet-4-6".to_string(),
            max_turns: 25,
            auto_approve: false,
            thinking_enabled: false,
            thinking_budget: 10_000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPermissions {
    #[serde(default)]
    pub disabled_tools: Vec<String>,
    #[serde(default)]
    pub auto_approve_tools: Vec<String>,
    #[serde(default)]
    pub allowed_paths: Vec<String>,
    #[serde(default)]
    pub blocked_paths: Vec<String>,
    #[serde(default)]
    pub custom_blocked_commands: Vec<String>,
    #[serde(default = "default_true")]
    pub block_internet: bool,
}

fn default_true() -> bool {
    true
}

impl Default for AgentPermissions {
    fn default() -> Self {
        Self {
            disabled_tools: Vec::new(),
            auto_approve_tools: Vec::new(),
            allowed_paths: Vec::new(),
            blocked_paths: Vec::new(),
            custom_blocked_commands: Vec::new(),
            block_internet: true,
        }
    }
}

struct PendingApproval {
    sender: oneshot::Sender<String>, // "allow_once" | "allow_always" | "deny_once" | "deny_always"
}

static PENDING_APPROVALS: LazyLock<Arc<Mutex<HashMap<String, PendingApproval>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(HashMap::new())));
static CANCELLED_SESSIONS: LazyLock<Arc<Mutex<std::collections::HashSet<String>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(std::collections::HashSet::new())));

// ─── Helpers ────────────────────────────────────────────────────────────────

pub use crate::utils::now_ms;

pub fn emit_event(app: &tauri::AppHandle, event: &AgentEvent) {
    let _ = app.emit("agent-event", event);
}

fn settings_path() -> std::path::PathBuf {
    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("xplorer");
    std::fs::create_dir_all(&dir).ok();
    dir.join("agent_settings.json")
}

fn load_settings() -> AgentSettings {
    let path = settings_path();
    let mut settings: AgentSettings = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    // Retrieve API keys from OS keychain
    if let Ok(Some(key)) = crate::secure_credentials::get_secret("agent-api-key") {
        settings.api_key = key;
    } else if !settings.api_key.is_empty() {
        // Migrate plaintext API key to keychain
        crate::secure_credentials::migrate_to_keychain("agent-api-key", &settings.api_key);
    }

    if let Ok(Some(key)) = crate::secure_credentials::get_secret("agent-openai-api-key") {
        settings.openai_api_key = key;
    } else if !settings.openai_api_key.is_empty() {
        crate::secure_credentials::migrate_to_keychain(
            "agent-openai-api-key",
            &settings.openai_api_key,
        );
    }

    settings
}

fn save_settings(settings: &AgentSettings) -> Result<(), String> {
    // Store API keys in OS keychain, not in JSON
    if !settings.api_key.is_empty() {
        crate::secure_credentials::store_secret("agent-api-key", &settings.api_key)
            .unwrap_or_else(|e| warn!("[Agent] keychain store failed: {}", e));
    }
    if !settings.openai_api_key.is_empty() {
        crate::secure_credentials::store_secret("agent-openai-api-key", &settings.openai_api_key)
            .unwrap_or_else(|e| warn!("[Agent] keychain store for OpenAI failed: {}", e));
    }

    // Write settings JSON without the API keys
    let mut safe_settings = settings.clone();
    safe_settings.api_key = String::new();
    safe_settings.openai_api_key = String::new();

    let path = settings_path();
    let json = serde_json::to_string_pretty(&safe_settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    std::fs::write(&path, &json).map_err(|e| format!("Failed to write settings: {}", e))?;

    // Restrict file permissions so only the current user can read it
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&path, perms).ok();
    }

    Ok(())
}

fn permissions_path() -> std::path::PathBuf {
    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("xplorer");
    std::fs::create_dir_all(&dir).ok();
    dir.join("agent_permissions.json")
}

pub fn load_permissions() -> AgentPermissions {
    let path = permissions_path();
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_permissions(perms: &AgentPermissions) -> Result<(), String> {
    let path = permissions_path();
    let json = serde_json::to_string_pretty(perms)
        .map_err(|e| format!("Failed to serialize permissions: {}", e))?;
    std::fs::write(&path, &json).map_err(|e| format!("Failed to write permissions: {}", e))?;
    Ok(())
}

fn is_session_cancelled(session_id: &str) -> bool {
    CANCELLED_SESSIONS
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .contains(session_id)
}

// ─── Extracted Sub-functions ────────────────────────────────────────────────

/// Build the system prompt incorporating the current path, filesystem context,
/// and memory from previous sessions.
fn build_system_prompt(current_path: &str, filesystem_context: &Option<String>) -> String {
    let fs_context_section = if let Some(ref ctx) = filesystem_context {
        format!(
            "\n\nFilesystem overview (from index — may not be 100% current):\n{}\n\n\
            You have a `search_indexed` tool for instant results from the file index. \
            Use it FIRST for fast answers. When returning index-based results, briefly note \
            they are from the index and offer to do a live scan if the user needs fresh data.",
            ctx
        )
    } else {
        String::new()
    };

    let memory_section = memory::build_memory_context()
        .map(|ctx| format!("\n\nMemories from previous sessions:\n{}", ctx))
        .unwrap_or_default();

    format!(
        "You are Xplorer Agent, an autonomous AI assistant built into the Xplorer file manager. \
        You help users manage files, search, organize, and automate tasks on their computer.\n\n\
        Rules:\n\
        - The user's current working directory is: {}\n\
        - Use absolute paths for all file operations.\n\
        - For read operations (read_file, list_directory, search_files, search_content, get_system_info, search_indexed, recall), \
          execute immediately without asking permission.\n\
        - For write operations (write_file, create_directory, rename, delete, move_file, copy_file, execute_command), \
          the system will ask the user for approval before executing.\n\
        - For complex multi-step tasks (3+ operations), use create_plan to show the user a plan first, \
          then execute_plan after they approve.\n\
        - Use remember/recall to store and retrieve useful information across conversations.\n\
        - Be concise and helpful. Show results clearly.\n\
        - When listing files, format output readably.\n\
        - When you have multiple read-only tools to call, list them all at once so they can be \
          executed in parallel.\n\
        - Always explain what you're doing and why.{}{}\n\n\
        Planning Guidelines:\n\
        - When a user asks to organize, sort, clean up, or restructure files, ALWAYS create a plan first.\n\
        - When a user asks to perform batch operations (rename many files, move many files), create a plan.\n\
        - When a task involves more than 3 write operations, create a plan.\n\
        - Plans help users understand and approve operations before execution.",
        current_path, fs_context_section, memory_section
    )
}

/// Parse content blocks from the API response into accumulated text and
/// a list of tool-use tuples (id, name, input).
fn parse_tool_calls(
    content_blocks: &[Value],
    final_text: &mut String,
) -> Vec<(String, String, Value)> {
    let mut tool_uses: Vec<(String, String, Value)> = Vec::new();

    for block in content_blocks {
        match block["type"].as_str() {
            Some("text") => {
                let text = block["text"].as_str().unwrap_or("");
                if !text.is_empty() {
                    final_text.push_str(text);
                }
            }
            Some("tool_use") => {
                let id = block["id"].as_str().unwrap_or("").to_string();
                let name = block["name"].as_str().unwrap_or("").to_string();
                let input = block["input"].clone();
                tool_uses.push((id, name, input));
            }
            _ => {}
        }
    }

    tool_uses
}

/// Execute read-only tools in parallel using a tokio JoinSet and collect
/// their results as tool_result JSON values.
async fn execute_read_only_tools(
    read_only_tools: Vec<(String, String, Value)>,
    session_id: &str,
    app_handle: &tauri::AppHandle,
) -> Vec<Value> {
    let mut tool_results: Vec<Value> = Vec::new();
    let mut join_set = tokio::task::JoinSet::new();

    for (tool_id, tool_name, tool_input) in read_only_tools {
        let sid = session_id.to_string();
        let ah = app_handle.clone();
        let tid = tool_id.clone();
        let tname = tool_name.clone();
        let tinput = tool_input.clone();

        // Emit tool_call event
        emit_event(
            app_handle,
            &AgentEvent {
                event_type: "tool_call".to_string(),
                session_id: session_id.to_string(),
                tool_call: Some(AgentToolCall {
                    id: tool_id,
                    name: tool_name,
                    input: tool_input,
                    requires_approval: false,
                    status: "running".to_string(),
                    result: None,
                    error: None,
                }),
                text: None,
                plan: None,
                timestamp: now_ms(),
            },
        );

        let tname_ret = tname.clone();
        join_set.spawn(async move {
            let result =
                tokio::task::spawn_blocking(move || tool_executor::execute_tool(&tname, &tinput))
                    .await
                    .unwrap_or_else(|e| Err(format!("Task join error: {}", e)));

            (tid, tname_ret, result, sid, ah)
        });
    }

    // Collect results
    while let Some(result) = join_set.join_next().await {
        if let Ok((tool_id, tool_name, exec_result, sid, ah)) = result {
            let mut tool_call = AgentToolCall {
                id: tool_id.clone(),
                name: tool_name,
                input: json!({}),
                requires_approval: false,
                status: "pending".to_string(),
                result: None,
                error: None,
            };

            match exec_result {
                Ok(res) => {
                    tool_call.status = "completed".to_string();
                    tool_call.result = Some(res.clone());
                    tool_results.push(json!({
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": res,
                    }));
                }
                Err(err) => {
                    tool_call.status = "error".to_string();
                    tool_call.error = Some(err.clone());
                    tool_results.push(json!({
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": format!("Error: {}", err),
                        "is_error": true,
                    }));
                }
            }

            emit_event(
                &ah,
                &AgentEvent {
                    event_type: "tool_result".to_string(),
                    session_id: sid,
                    tool_call: Some(tool_call),
                    text: None,
                    plan: None,
                    timestamp: now_ms(),
                },
            );
        }
    }

    tool_results
}

/// Wait for user approval on a write tool via a oneshot channel. Returns
/// a response string: "allow_once", "allow_always", "deny_once", or "deny_always".
async fn handle_approval(
    tool_id: &str,
    tool_call: &AgentToolCall,
    session_id: &str,
    app_handle: &tauri::AppHandle,
) -> String {
    let (tx, rx) = oneshot::channel::<String>();
    {
        PENDING_APPROVALS
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(tool_id.to_string(), PendingApproval { sender: tx });
    }

    // Emit approval_request event
    emit_event(
        app_handle,
        &AgentEvent {
            event_type: "approval_request".to_string(),
            session_id: session_id.to_string(),
            tool_call: Some(tool_call.clone()),
            text: None,
            plan: None,
            timestamp: now_ms(),
        },
    );

    // Wait for approval (with timeout)
    match tokio::time::timeout(std::time::Duration::from_secs(300), rx).await {
        Ok(Ok(response)) => response,
        Ok(Err(_)) => "deny_once".to_string(), // Channel closed
        Err(_) => "deny_once".to_string(),     // Timeout
    }
}

/// Execute a single write tool, handling plan creation events, and return
/// the tool_result JSON value along with the updated AgentToolCall.
fn execute_write_tool(
    tool_id: &str,
    tool_name: &str,
    tool_input: &Value,
    session_id: &str,
    app_handle: &tauri::AppHandle,
) -> (Value, AgentToolCall) {
    let mut tool_call = AgentToolCall {
        id: tool_id.to_string(),
        name: tool_name.to_string(),
        input: tool_input.clone(),
        requires_approval: false,
        status: "running".to_string(),
        result: None,
        error: None,
    };

    let is_plan_create = tool_name == "create_plan";

    let tool_result = match tool_executor::execute_tool(tool_name, tool_input) {
        Ok(result) => {
            tool_call.status = "completed".to_string();
            tool_call.result = Some(result.clone());

            // Emit plan_created event if applicable
            if is_plan_create {
                if let Ok(plan_data) = serde_json::from_str::<Value>(&result) {
                    if let Some(plan_id) = plan_data["plan_id"].as_str() {
                        if let Some(plan) = planner::get_plan(plan_id) {
                            emit_event(
                                app_handle,
                                &AgentEvent {
                                    event_type: "plan_created".to_string(),
                                    session_id: session_id.to_string(),
                                    tool_call: None,
                                    text: None,
                                    plan: Some(plan),
                                    timestamp: now_ms(),
                                },
                            );
                        }
                    }
                }
            }

            json!({
                "type": "tool_result",
                "tool_use_id": tool_id,
                "content": result,
            })
        }
        Err(err) => {
            tool_call.status = "error".to_string();
            tool_call.error = Some(err.clone());

            json!({
                "type": "tool_result",
                "tool_use_id": tool_id,
                "content": format!("Error: {}", err),
                "is_error": true,
            })
        }
    };

    (tool_result, tool_call)
}

/// Execute write tools sequentially, requesting approval for each and
/// collecting their results.
async fn execute_write_tools(
    write_tools: &[(String, String, Value)],
    session_id: &str,
    app_handle: &tauri::AppHandle,
    auto_approve: bool,
) -> Vec<Value> {
    let mut tool_results: Vec<Value> = Vec::new();

    for (tool_id, tool_name, tool_input) in write_tools {
        if is_session_cancelled(session_id) {
            break;
        }

        let requires_approval = tools::tool_requires_approval(tool_name);

        let pending_tool_call = AgentToolCall {
            id: tool_id.clone(),
            name: tool_name.clone(),
            input: tool_input.clone(),
            requires_approval,
            status: "pending".to_string(),
            result: None,
            error: None,
        };

        // Emit tool_call event
        emit_event(
            app_handle,
            &AgentEvent {
                event_type: "tool_call".to_string(),
                session_id: session_id.to_string(),
                tool_call: Some(pending_tool_call.clone()),
                text: None,
                plan: None,
                timestamp: now_ms(),
            },
        );

        let perms = load_permissions();
        let tool_auto_approved = perms.auto_approve_tools.contains(tool_name);
        let response = if requires_approval && !auto_approve && !tool_auto_approved {
            handle_approval(tool_id, &pending_tool_call, session_id, app_handle).await
        } else {
            "allow_once".to_string()
        };

        let final_tool_call;
        let allowed = response.starts_with("allow");

        // Persist "always" / "never" choices to permissions
        match response.as_str() {
            "allow_always" => {
                let mut perms = load_permissions();
                if !perms.auto_approve_tools.contains(tool_name) {
                    perms.auto_approve_tools.push(tool_name.clone());
                    let _ = save_permissions(&perms);
                }
            }
            "deny_always" => {
                let mut perms = load_permissions();
                if !perms.disabled_tools.contains(tool_name) {
                    perms.disabled_tools.push(tool_name.clone());
                    let _ = save_permissions(&perms);
                }
            }
            _ => {}
        }

        if allowed && !is_session_cancelled(session_id) {
            let (result_json, tc) =
                execute_write_tool(tool_id, tool_name, tool_input, session_id, app_handle);
            tool_results.push(result_json);
            final_tool_call = tc;
        } else {
            final_tool_call = AgentToolCall {
                id: tool_id.clone(),
                name: tool_name.clone(),
                input: tool_input.clone(),
                requires_approval,
                status: "denied".to_string(),
                result: None,
                error: Some("User denied this action.".to_string()),
            };

            tool_results.push(json!({
                "type": "tool_result",
                "tool_use_id": tool_id,
                "content": "User denied permission for this action.",
                "is_error": true,
            }));
        }

        // Emit tool_result event
        emit_event(
            app_handle,
            &AgentEvent {
                event_type: "tool_result".to_string(),
                session_id: session_id.to_string(),
                tool_call: Some(final_tool_call),
                text: None,
                plan: None,
                timestamp: now_ms(),
            },
        );
    }

    tool_results
}

// ─── Core Agentic Loop ─────────────────────────────────────────────────────

#[command]
pub async fn agent_chat(
    session_id: String,
    messages: Vec<Value>,
    current_path: String,
    filesystem_context: Option<String>,
    model: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let settings = load_settings();

    if !settings.enabled {
        return Err("Agent is disabled. Enable it in Settings.".to_string());
    }

    // Use the model passed from frontend, falling back to settings
    let effective_model = model.unwrap_or_else(|| settings.model.clone());
    let is_claude = effective_model.starts_with("claude-");
    let is_openai = effective_model.starts_with("gpt-")
        || effective_model.starts_with("o1")
        || effective_model.starts_with("o3")
        || effective_model.starts_with("o4")
        || effective_model.starts_with("chatgpt-");

    if is_claude && settings.api_key.is_empty() {
        return Err("No API key configured. Set your Claude API key in Settings.".to_string());
    }
    if is_openai && settings.openai_api_key.is_empty() {
        return Err("No OpenAI API key configured. Set it in Settings → AI Agent.".to_string());
    }

    // Clear cancel flag for this session
    {
        CANCELLED_SESSIONS
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&session_id);
    }

    let system_prompt = build_system_prompt(&current_path, &filesystem_context);
    let permissions = load_permissions();
    let agent_tools = tools::build_agent_tools(&permissions.disabled_tools);
    let mut conversation: Vec<Value> = messages;
    let max_turns = settings.max_turns.clamp(1, 50);
    let mut final_text = String::new();

    for _turn in 0..max_turns {
        if is_session_cancelled(&session_id) {
            emit_event(
                &app_handle,
                &AgentEvent {
                    event_type: "error".to_string(),
                    session_id: session_id.clone(),
                    tool_call: None,
                    text: Some("Session cancelled by user.".to_string()),
                    plan: None,
                    timestamp: now_ms(),
                },
            );
            return Ok(final_text);
        }

        // Call the appropriate API based on model provider
        let stream_result = if is_claude {
            streaming::call_claude_api_streaming(
                &settings.api_key,
                &effective_model,
                &system_prompt,
                &conversation,
                &agent_tools,
                settings.thinking_enabled,
                settings.thinking_budget,
                &session_id,
                &app_handle,
            )
            .await?
        } else if is_openai {
            streaming::call_openai_compatible_streaming(
                &settings.openai_api_key,
                &effective_model,
                "https://api.openai.com/v1/chat/completions",
                &system_prompt,
                &conversation,
                &agent_tools,
                settings.thinking_enabled,
                &session_id,
                &app_handle,
            )
            .await?
        } else {
            // Ollama — use OpenAI-compatible endpoint
            streaming::call_openai_compatible_streaming(
                "",
                &effective_model,
                "http://localhost:11434/v1/chat/completions",
                &system_prompt,
                &conversation,
                &agent_tools,
                settings.thinking_enabled,
                &session_id,
                &app_handle,
            )
            .await?
        };

        let stop_reason = stream_result.stop_reason;
        let content_blocks = stream_result.content_blocks;

        // Append assistant message to conversation
        conversation.push(json!({
            "role": "assistant",
            "content": content_blocks.clone(),
        }));

        // Parse content blocks into text and tool calls
        let tool_uses = parse_tool_calls(&content_blocks, &mut final_text);

        // If stop_reason is end_turn and no tool calls, we're done
        if stop_reason == "end_turn" && tool_uses.is_empty() {
            emit_event(
                &app_handle,
                &AgentEvent {
                    event_type: "complete".to_string(),
                    session_id: session_id.clone(),
                    tool_call: None,
                    text: None,
                    plan: None,
                    timestamp: now_ms(),
                },
            );
            return Ok(final_text);
        }

        // Separate read-only and write tools
        let mut read_only_tools: Vec<(String, String, Value)> = Vec::new();
        let mut write_tools: Vec<(String, String, Value)> = Vec::new();

        for (id, name, input) in tool_uses {
            if tools::is_read_only_tool(&name) {
                read_only_tools.push((id, name, input));
            } else {
                write_tools.push((id, name, input));
            }
        }

        // Execute read-only tools in parallel
        let mut tool_results = if !read_only_tools.is_empty() {
            execute_read_only_tools(read_only_tools, &session_id, &app_handle).await
        } else {
            Vec::new()
        };

        // Execute write tools sequentially (need approval)
        let write_results = execute_write_tools(
            &write_tools,
            &session_id,
            &app_handle,
            settings.auto_approve,
        )
        .await;
        tool_results.extend(write_results);

        // Append tool results as user message
        if !tool_results.is_empty() {
            conversation.push(json!({
                "role": "user",
                "content": tool_results,
            }));
        }

        // If stop_reason was end_turn (but had tool_uses that are now done), we're done
        if stop_reason == "end_turn" {
            emit_event(
                &app_handle,
                &AgentEvent {
                    event_type: "complete".to_string(),
                    session_id: session_id.clone(),
                    tool_call: None,
                    text: None,
                    plan: None,
                    timestamp: now_ms(),
                },
            );
            return Ok(final_text);
        }
    }

    // Max turns reached
    emit_event(
        &app_handle,
        &AgentEvent {
            event_type: "complete".to_string(),
            session_id: session_id.clone(),
            tool_call: None,
            text: Some("Reached maximum number of turns.".to_string()),
            plan: None,
            timestamp: now_ms(),
        },
    );
    Ok(final_text)
}

// ─── Supporting Commands ────────────────────────────────────────────────────

#[command]
pub async fn agent_respond_approval(tool_call_id: String, response: String) -> Result<(), String> {
    let sender = {
        PENDING_APPROVALS
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&tool_call_id)
    };
    if let Some(pending) = sender {
        pending
            .sender
            .send(response)
            .map_err(|_| "Approval channel closed".to_string())?;
        Ok(())
    } else {
        Err(format!(
            "No pending approval found for tool call: {}",
            tool_call_id
        ))
    }
}

#[command]
pub async fn agent_cancel_session(session_id: String) -> Result<(), String> {
    // Mark session as cancelled
    {
        CANCELLED_SESSIONS
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(session_id.clone());
    }

    // Deny all pending approvals — collect senders first, then drop the lock before sending
    let senders: Vec<_> = {
        let mut approvals = PENDING_APPROVALS.lock().unwrap_or_else(|e| e.into_inner());
        approvals.drain().map(|(_, p)| p.sender).collect()
    };
    for sender in senders {
        let _ = sender.send("deny_once".to_string());
    }

    Ok(())
}

#[command]
pub async fn get_agent_settings() -> Result<SafeAgentSettings, String> {
    let settings = load_settings();
    Ok(SafeAgentSettings::from_settings(&settings))
}

#[command]
pub async fn update_agent_settings(settings: UpdateAgentSettingsPayload) -> Result<(), String> {
    let mut current = load_settings();
    current.enabled = settings.enabled;
    current.model = settings.model;
    current.max_turns = settings.max_turns;
    current.auto_approve = settings.auto_approve;
    current.thinking_enabled = settings.thinking_enabled;
    current.thinking_budget = settings.thinking_budget;
    save_settings(&current)
}

#[command]
pub async fn update_agent_api_keys(payload: UpdateAgentApiKeysPayload) -> Result<(), String> {
    let mut current = load_settings();
    if let Some(key) = payload.api_key {
        current.api_key = key;
    }
    if let Some(key) = payload.openai_api_key {
        current.openai_api_key = key;
    }
    save_settings(&current)
}

// ─── Plan Commands ──────────────────────────────────────────────────────────

#[command]
pub async fn agent_approve_plan(plan_id: String) -> Result<(), String> {
    planner::approve_plan(&plan_id)
}

#[command]
pub async fn agent_get_plan(plan_id: String) -> Result<OperationPlan, String> {
    planner::get_plan(&plan_id).ok_or(format!("Plan '{}' not found", plan_id))
}

// ─── Memory Commands ────────────────────────────────────────────────────────

#[command]
pub async fn get_agent_memory() -> Result<Vec<MemoryEntry>, String> {
    Ok(memory::get_all_memories())
}

#[command]
pub async fn clear_agent_memory() -> Result<(), String> {
    memory::clear_all_memories()
}

#[command]
pub async fn delete_agent_memory(key: String) -> Result<(), String> {
    memory::delete_memory(&key)
}

// ─── Permission Commands ─────────────────────────────────────────────────

#[command]
pub async fn get_agent_permissions() -> Result<AgentPermissions, String> {
    Ok(load_permissions())
}

#[command]
pub async fn update_agent_permissions(permissions: AgentPermissions) -> Result<(), String> {
    save_permissions(&permissions)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncate_to_char_boundary_ascii() {
        let s = "Hello, World!";
        assert_eq!(truncate_to_char_boundary(s, 5), "Hello");
        assert_eq!(truncate_to_char_boundary(s, 100), s);
    }

    #[test]
    fn test_truncate_to_char_boundary_multibyte() {
        let s = "Hello, \u{1F600} World!"; // contains a 4-byte emoji
        let truncated = truncate_to_char_boundary(s, 10);
        assert!(truncated.is_char_boundary(truncated.len()));
        assert!(std::str::from_utf8(truncated.as_bytes()).is_ok());
    }

    #[test]
    fn test_truncate_to_char_boundary_empty() {
        let s = "";
        assert_eq!(truncate_to_char_boundary(s, 0), "");
        assert_eq!(truncate_to_char_boundary(s, 10), "");
    }

    #[test]
    fn test_parse_tool_calls_extracts_text_and_tools() {
        let blocks = vec![
            json!({"type": "text", "text": "Hello "}),
            json!({"type": "text", "text": "world"}),
            json!({"type": "tool_use", "id": "t1", "name": "read_file", "input": {"path": "/tmp"}}),
        ];
        let mut text = String::new();
        let tool_uses = parse_tool_calls(&blocks, &mut text);
        assert_eq!(text, "Hello world");
        assert_eq!(tool_uses.len(), 1);
        assert_eq!(tool_uses[0].0, "t1");
        assert_eq!(tool_uses[0].1, "read_file");
    }

    #[test]
    fn test_parse_tool_calls_empty_blocks() {
        let blocks: Vec<Value> = vec![];
        let mut text = String::new();
        let tool_uses = parse_tool_calls(&blocks, &mut text);
        assert!(text.is_empty());
        assert!(tool_uses.is_empty());
    }

    #[test]
    fn test_build_system_prompt_contains_path() {
        let prompt = build_system_prompt("/home/user", &None);
        assert!(prompt.contains("/home/user"));
        assert!(prompt.contains("Xplorer Agent"));
    }

    #[test]
    fn test_build_system_prompt_with_fs_context() {
        let ctx = Some("files: a.txt, b.txt".to_string());
        let prompt = build_system_prompt("/tmp", &ctx);
        assert!(prompt.contains("a.txt, b.txt"));
        assert!(prompt.contains("search_indexed"));
    }
}
