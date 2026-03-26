use serde_json::{json, Value};
use tracing::warn;

use super::{emit_event, now_ms, AgentEvent};

/// Result of a streaming API call: assembled content blocks + stop reason
pub struct StreamResult {
    pub content_blocks: Vec<Value>,
    pub stop_reason: String,
}

/// Calls Claude API with streaming enabled. Emits text deltas in real-time
/// via Tauri events, and returns the fully assembled content blocks when done.
pub async fn call_claude_api_streaming(
    api_key: &str,
    model: &str,
    system: &str,
    messages: &[Value],
    tools: &[Value],
    thinking_enabled: bool,
    thinking_budget: u32,
    session_id: &str,
    app_handle: &tauri::AppHandle,
) -> Result<StreamResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(if thinking_enabled {
            300
        } else {
            120
        }))
        .connect_timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut body = json!({
        "model": model,
        "max_tokens": if thinking_enabled { thinking_budget + 8192 } else { 8192 },
        "system": system,
        "messages": messages,
        "tools": tools,
        "stream": true,
    });

    if thinking_enabled {
        body["thinking"] = json!({
            "type": "enabled",
            "budget_tokens": thinking_budget,
        });
        // Claude rejects temperature when thinking is enabled
        body.as_object_mut().unwrap().remove("temperature");
    }

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Claude API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Claude API error ({}): {}", status, error_text));
    }

    // Parse SSE stream
    use futures_util::StreamExt;

    let mut byte_stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut content_blocks: Vec<Value> = Vec::new();
    let mut stop_reason = "end_turn".to_string();

    // Track current content block being built
    let mut current_text_parts: std::collections::HashMap<usize, String> =
        std::collections::HashMap::new();
    let mut current_tool_inputs: std::collections::HashMap<usize, String> =
        std::collections::HashMap::new();
    let mut block_metadata: std::collections::HashMap<usize, Value> =
        std::collections::HashMap::new();

    while let Some(chunk_result) = byte_stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream read error: {}", e))?;
        let chunk_str = String::from_utf8_lossy(&chunk);
        buffer.push_str(&chunk_str);

        // Process complete SSE lines
        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    continue;
                }

                let event: Value = match serde_json::from_str(data) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                let event_type = event["type"].as_str().unwrap_or("");

                match event_type {
                    "content_block_start" => {
                        let index = event["index"].as_u64().unwrap_or(0) as usize;
                        let block = &event["content_block"];
                        let block_type = block["type"].as_str().unwrap_or("");

                        if block_type == "thinking" {
                            current_text_parts.insert(index, String::new());
                            block_metadata.insert(index, json!({"type": "thinking"}));
                        } else if block_type == "text" {
                            current_text_parts.insert(index, String::new());
                            block_metadata.insert(index, json!({"type": "text", "text": ""}));
                        } else if block_type == "tool_use" {
                            current_tool_inputs.insert(index, String::new());
                            block_metadata.insert(
                                index,
                                json!({
                                    "type": "tool_use",
                                    "id": block["id"].as_str().unwrap_or(""),
                                    "name": block["name"].as_str().unwrap_or(""),
                                    "input": {}
                                }),
                            );
                        }
                    }

                    "content_block_delta" => {
                        let index = event["index"].as_u64().unwrap_or(0) as usize;
                        let delta = &event["delta"];
                        let delta_type = delta["type"].as_str().unwrap_or("");

                        if delta_type == "thinking_delta" {
                            let text = delta["thinking"].as_str().unwrap_or("");
                            if !text.is_empty() {
                                if let Some(parts) = current_text_parts.get_mut(&index) {
                                    parts.push_str(text);
                                }
                                emit_event(
                                    app_handle,
                                    &AgentEvent {
                                        event_type: "thinking_delta".to_string(),
                                        session_id: session_id.to_string(),
                                        tool_call: None,
                                        text: Some(text.to_string()),
                                        plan: None,
                                        timestamp: now_ms(),
                                    },
                                );
                            }
                        } else if delta_type == "text_delta" {
                            let text = delta["text"].as_str().unwrap_or("");
                            if !text.is_empty() {
                                if let Some(parts) = current_text_parts.get_mut(&index) {
                                    parts.push_str(text);
                                }
                                // Emit text chunk in real-time
                                emit_event(
                                    app_handle,
                                    &AgentEvent {
                                        event_type: "text_delta".to_string(),
                                        session_id: session_id.to_string(),
                                        tool_call: None,
                                        text: Some(text.to_string()),
                                        plan: None,
                                        timestamp: now_ms(),
                                    },
                                );
                            }
                        } else if delta_type == "input_json_delta" {
                            let partial = delta["partial_json"].as_str().unwrap_or("");
                            if let Some(input_buf) = current_tool_inputs.get_mut(&index) {
                                input_buf.push_str(partial);
                            }
                        }
                    }

                    "content_block_stop" => {
                        let index = event["index"].as_u64().unwrap_or(0) as usize;

                        // Check if this is a thinking block
                        let is_thinking = block_metadata
                            .get(&index)
                            .and_then(|m| m["type"].as_str())
                            .map(|t| t == "thinking")
                            .unwrap_or(false);

                        if is_thinking {
                            if let Some(thinking_text) = current_text_parts.remove(&index) {
                                content_blocks.push(json!({
                                    "type": "thinking",
                                    "thinking": thinking_text,
                                }));
                            }
                        } else if let Some(text) = current_text_parts.remove(&index) {
                            content_blocks.push(json!({
                                "type": "text",
                                "text": text,
                            }));
                        }

                        if let Some(input_json_str) = current_tool_inputs.remove(&index) {
                            let input_val: Value = serde_json::from_str(&input_json_str)
                                .unwrap_or_else(|e| {
                                    warn!("[Agent] failed to parse tool input JSON for block {}: {}. Input was: '{}'",
                                        index, e, super::truncate_to_char_boundary(&input_json_str, 200));
                                    json!({})
                                });
                            if let Some(meta) = block_metadata.get(&index) {
                                content_blocks.push(json!({
                                    "type": "tool_use",
                                    "id": meta["id"],
                                    "name": meta["name"],
                                    "input": input_val,
                                }));
                            }
                        }

                        block_metadata.remove(&index);
                    }

                    "message_delta" => {
                        if let Some(sr) = event["delta"]["stop_reason"].as_str() {
                            stop_reason = sr.to_string();
                        }
                    }

                    "message_stop" | "error" => {
                        if event_type == "error" {
                            let err_msg = event["error"]["message"]
                                .as_str()
                                .unwrap_or("Unknown streaming error");
                            return Err(format!("Claude streaming error: {}", err_msg));
                        }
                    }

                    _ => {}
                }
            }
        }
    }

    Ok(StreamResult {
        content_blocks,
        stop_reason,
    })
}

// ─── OpenAI-Compatible Streaming (works with OpenAI API and Ollama /v1/) ────

/// Convert Claude-format tool definitions to OpenAI function-calling format.
fn claude_tools_to_openai(tools: &[Value]) -> Vec<Value> {
    tools
        .iter()
        .map(|t| {
            json!({
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": t["input_schema"],
                }
            })
        })
        .collect()
}

/// Convert Claude-format conversation messages to OpenAI chat format.
/// Claude uses content arrays with typed blocks; OpenAI uses flat messages.
fn claude_messages_to_openai(system: &str, messages: &[Value]) -> Vec<Value> {
    let mut out: Vec<Value> = vec![json!({ "role": "system", "content": system })];

    for msg in messages {
        let role = msg["role"].as_str().unwrap_or("user");
        let content = &msg["content"];

        if let Some(text) = content.as_str() {
            // Simple text message
            out.push(json!({ "role": role, "content": text }));
            continue;
        }

        if let Some(blocks) = content.as_array() {
            if role == "assistant" {
                // Collect text and tool_calls from content blocks
                let mut text_parts = String::new();
                let mut tool_calls: Vec<Value> = Vec::new();

                for block in blocks {
                    match block["type"].as_str() {
                        Some("text") => {
                            let t = block["text"].as_str().unwrap_or("");
                            if !t.is_empty() {
                                text_parts.push_str(t);
                            }
                        }
                        Some("tool_use") => {
                            let input_str = serde_json::to_string(&block["input"])
                                .unwrap_or_else(|_| "{}".to_string());
                            tool_calls.push(json!({
                                "id": block["id"],
                                "type": "function",
                                "function": {
                                    "name": block["name"],
                                    "arguments": input_str,
                                }
                            }));
                        }
                        _ => {}
                    }
                }

                let mut assistant_msg = json!({ "role": "assistant" });
                if !text_parts.is_empty() {
                    assistant_msg["content"] = json!(text_parts);
                } else {
                    assistant_msg["content"] = Value::Null;
                }
                if !tool_calls.is_empty() {
                    assistant_msg["tool_calls"] = json!(tool_calls);
                }
                out.push(assistant_msg);
            } else {
                // User message — may contain tool_result blocks
                let mut has_tool_results = false;
                for block in blocks {
                    if block["type"].as_str() == Some("tool_result") {
                        has_tool_results = true;
                        out.push(json!({
                            "role": "tool",
                            "tool_call_id": block["tool_use_id"],
                            "content": block["content"].as_str().unwrap_or(""),
                        }));
                    }
                }
                if !has_tool_results {
                    // Regular user message with text blocks
                    let text: String = blocks
                        .iter()
                        .filter_map(|b| b["text"].as_str())
                        .collect::<Vec<_>>()
                        .join("\n");
                    if !text.is_empty() {
                        out.push(json!({ "role": "user", "content": text }));
                    }
                }
            }
        }
    }

    out
}

/// Calls an OpenAI-compatible API (OpenAI or Ollama /v1/) with streaming.
/// Converts between Claude and OpenAI message formats transparently.
/// Returns StreamResult in Claude content-block format for the agent loop.
pub async fn call_openai_compatible_streaming(
    api_key: &str,
    model: &str,
    endpoint: &str,
    system: &str,
    messages: &[Value],
    tools: &[Value],
    thinking_enabled: bool,
    session_id: &str,
    app_handle: &tauri::AppHandle,
) -> Result<StreamResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .connect_timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let openai_messages = claude_messages_to_openai(system, messages);
    let openai_tools = claude_tools_to_openai(tools);

    let send_request = |include_tools: bool| {
        let mut body = json!({
            "model": model,
            "messages": &openai_messages,
            "stream": true,
        });

        // Only include tools if requested and available
        if include_tools && !openai_tools.is_empty() {
            body["tools"] = json!(&openai_tools);
        }

        // For o-series models, enable reasoning when thinking is enabled
        if thinking_enabled
            && (model.starts_with("o1") || model.starts_with("o3") || model.starts_with("o4"))
        {
            body["reasoning_effort"] = json!("high");
        }

        let mut req = client
            .post(endpoint)
            .header("content-type", "application/json");

        if !api_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", api_key));
        }

        req.json(&body).send()
    };

    // Try with tools first, fall back to no-tools if model doesn't support them
    let response = {
        let resp = send_request(true)
            .await
            .map_err(|e| format!("API request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let error_text = resp
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());

            // Retry without tools if the model doesn't support them
            if error_text.contains("does not support tools")
                || error_text.contains("does not support functions")
            {
                warn!(
                    "[Agent] Model {} doesn't support tools, retrying without",
                    model
                );
                let retry = send_request(false)
                    .await
                    .map_err(|e| format!("API request failed (retry): {}", e))?;
                if !retry.status().is_success() {
                    let s2 = retry.status();
                    let e2 = retry
                        .text()
                        .await
                        .unwrap_or_else(|_| "Unknown error".to_string());
                    return Err(format!("API error ({}): {}", s2, e2));
                }
                retry
            } else {
                return Err(format!("API error ({}): {}", status, error_text));
            }
        } else {
            resp
        }
    };

    use futures_util::StreamExt;

    let mut byte_stream = response.bytes_stream();
    let mut buffer = String::new();

    // Accumulated state
    let mut text_content = String::new();
    let mut stop_reason = "end_turn".to_string();

    // Tool calls: indexed by position in the tool_calls array
    let mut tool_call_ids: std::collections::HashMap<usize, String> =
        std::collections::HashMap::new();
    let mut tool_call_names: std::collections::HashMap<usize, String> =
        std::collections::HashMap::new();
    let mut tool_call_args: std::collections::HashMap<usize, String> =
        std::collections::HashMap::new();

    while let Some(chunk_result) = byte_stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream read error: {}", e))?;
        let chunk_str = String::from_utf8_lossy(&chunk);
        buffer.push_str(&chunk_str);

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            let data = match line.strip_prefix("data: ") {
                Some(d) => d,
                None => continue,
            };

            if data == "[DONE]" {
                continue;
            }

            let event: Value = match serde_json::from_str(data) {
                Ok(v) => v,
                Err(_) => continue,
            };

            // Check for errors
            if let Some(err) = event["error"]["message"].as_str() {
                return Err(format!("API streaming error: {}", err));
            }

            let choice = &event["choices"][0];
            let delta = &choice["delta"];
            let finish = choice["finish_reason"].as_str();

            // Text content delta
            if let Some(text) = delta["content"].as_str() {
                if !text.is_empty() {
                    text_content.push_str(text);
                    emit_event(
                        app_handle,
                        &AgentEvent {
                            event_type: "text_delta".to_string(),
                            session_id: session_id.to_string(),
                            tool_call: None,
                            text: Some(text.to_string()),
                            plan: None,
                            timestamp: now_ms(),
                        },
                    );
                }
            }

            // Tool call deltas
            if let Some(tc_deltas) = delta["tool_calls"].as_array() {
                for tc in tc_deltas {
                    let idx = tc["index"].as_u64().unwrap_or(0) as usize;

                    if let Some(id) = tc["id"].as_str() {
                        tool_call_ids.insert(idx, id.to_string());
                    }
                    if let Some(name) = tc["function"]["name"].as_str() {
                        tool_call_names.insert(idx, name.to_string());
                    }
                    if let Some(args_chunk) = tc["function"]["arguments"].as_str() {
                        tool_call_args
                            .entry(idx)
                            .or_insert_with(String::new)
                            .push_str(args_chunk);
                    }
                }
            }

            // Finish reason
            if let Some(reason) = finish {
                stop_reason = match reason {
                    "stop" => "end_turn".to_string(),
                    "tool_calls" => "tool_use".to_string(),
                    other => other.to_string(),
                };
            }
        }
    }

    // Build Claude-format content blocks from accumulated state
    let mut content_blocks: Vec<Value> = Vec::new();

    if !text_content.is_empty() {
        content_blocks.push(json!({
            "type": "text",
            "text": text_content,
        }));
    }

    // Convert tool calls to Claude tool_use blocks
    let max_idx = tool_call_ids
        .keys()
        .chain(tool_call_names.keys())
        .chain(tool_call_args.keys())
        .copied()
        .max();

    if let Some(max) = max_idx {
        for idx in 0..=max {
            let id = tool_call_ids
                .get(&idx)
                .cloned()
                .unwrap_or_else(|| format!("call_{}", idx));
            let name = tool_call_names.get(&idx).cloned().unwrap_or_default();
            let args_str = tool_call_args.get(&idx).cloned().unwrap_or_default();

            let input: Value = serde_json::from_str(&args_str).unwrap_or_else(|e| {
                warn!(
                    "[Agent] failed to parse OpenAI tool args for {}: {}. Args: '{}'",
                    name,
                    e,
                    super::truncate_to_char_boundary(&args_str, 200)
                );
                json!({})
            });

            content_blocks.push(json!({
                "type": "tool_use",
                "id": id,
                "name": name,
                "input": input,
            }));
        }
    }

    Ok(StreamResult {
        content_blocks,
        stop_reason,
    })
}
