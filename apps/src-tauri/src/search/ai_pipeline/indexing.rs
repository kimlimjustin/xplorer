use std::collections::HashMap;
use std::io::Read;
use std::path::PathBuf;
use std::sync::{
    atomic::Ordering,
    Arc,
};
use std::time::{SystemTime, UNIX_EPOCH};

use sha2::{Digest, Sha256};
use tracing::warn;

use crate::search::hybrid::EmbeddingEntry;

use super::{
    base64_encode, extract_tags, guess_media_type, is_indexable_file, AIIndexEntry, AIPipeline,
    VisionProvider, VisionProviderConfig, HASH_READ_LIMIT, MAX_IMAGE_SIZE,
};

// ---------------------------------------------------------------------------
// Queue management
// ---------------------------------------------------------------------------

impl AIPipeline {
    /// Add files or directories to the processing queue.
    ///
    /// If a path is a directory, it is walked recursively and all indexable
    /// files (images, PDFs) found within are queued.  Individual file paths
    /// are also accepted.  Files whose content hash has not changed since the
    /// last indexing run are silently skipped (Tier 3c).
    pub fn queue_files(&self, paths: Vec<String>) {
        let entries = self.entries.read().unwrap_or_else(|e| e.into_inner());
        let mut queue = self.queue.lock().unwrap_or_else(|e| e.into_inner());

        // Collect all actual file paths (expanding directories)
        let mut file_paths: Vec<String> = Vec::new();
        for path in &paths {
            let p = std::path::Path::new(path);
            if p.is_dir() {
                // Walk directory recursively for indexable files
                for entry in walkdir::WalkDir::new(p)
                    .max_depth(10)
                    .follow_links(false)
                    .into_iter()
                    .filter_map(|e| e.ok())
                {
                    if entry.file_type().is_file() {
                        let file_path = entry.path().to_string_lossy().to_string();
                        if is_indexable_file(&file_path) {
                            file_paths.push(file_path);
                        }
                    }
                }
            } else if is_indexable_file(path) {
                file_paths.push(path.clone());
            }
        }

        for file_path in file_paths {
            // Content-hash check — skip unchanged files.
            if let Some(existing) = entries.get(&file_path) {
                if let Some(ref existing_hash) = existing.content_hash {
                    if let Some(current_hash) = compute_file_hash(&file_path) {
                        if *existing_hash == current_hash {
                            continue; // file unchanged
                        }
                    }
                }
            }

            if !queue.contains(&file_path) {
                queue.push_back(file_path);
            }
        }
    }

    // -- Auto-indexing ------------------------------------------------------

    /// Enable or disable automatic background indexing triggered by
    /// file-watcher events.
    pub fn set_auto_index(&self, enabled: bool) {
        self.auto_index_enabled.store(enabled, Ordering::SeqCst);
    }

    /// Check whether automatic background indexing is currently enabled.
    pub fn is_auto_index_enabled(&self) -> bool {
        self.auto_index_enabled.load(Ordering::SeqCst)
    }

    /// Called by the file-watcher callback when a file is created or modified.
    /// If auto-indexing is enabled and the file is indexable (image / PDF), it
    /// is added to the processing queue.
    pub fn on_file_changed(&self, path: &str) {
        if !self.auto_index_enabled.load(Ordering::SeqCst) {
            return;
        }
        if !is_indexable_file(path) {
            return;
        }
        let mut queue = self.queue.lock().unwrap_or_else(|e| e.into_inner());
        let owned = path.to_string();
        if !queue.contains(&owned) {
            queue.push_back(owned);
        }
    }

    // -- Processing ---------------------------------------------------------

    /// Start a background task that drains the queue and processes each file
    /// using the specified vision provider.  Does nothing if a processing loop
    /// is already running.
    ///
    /// If `config` is `None`, defaults to Ollama (local).
    pub fn start_processing(self: &Arc<Self>, config: Option<VisionProviderConfig>) {
        if self.is_processing.swap(true, Ordering::SeqCst) {
            return; // already running
        }

        let cfg = config.unwrap_or(VisionProviderConfig {
            provider: VisionProvider::Ollama,
            api_key: None,
            model: None,
        });

        let pipeline = Arc::clone(self);
        tokio::spawn(async move {
            // For Ollama we still need to detect the model up front.
            let model_name: String = match &cfg.provider {
                VisionProvider::Ollama => {
                    let client = crate::search::ollama_client::get_client();
                    match client.detect_vision_model().await {
                        Some(m) => {
                            *pipeline
                                .vision_model
                                .lock()
                                .unwrap_or_else(|e| e.into_inner()) = Some(m.clone());
                            m
                        }
                        None => {
                            tracing::warn!("[ai_pipeline] No vision model found in Ollama. Install llava, bakllava, or moondream.");
                            pipeline.is_processing.store(false, Ordering::SeqCst);
                            return;
                        }
                    }
                }
                VisionProvider::Claude => {
                    let m = cfg
                        .model
                        .clone()
                        .unwrap_or_else(|| "claude-sonnet-4-6-20250514".to_string());
                    *pipeline
                        .vision_model
                        .lock()
                        .unwrap_or_else(|e| e.into_inner()) = Some(m.clone());
                    m
                }
                VisionProvider::Openai => {
                    let m = cfg.model.clone().unwrap_or_else(|| "gpt-4o".to_string());
                    *pipeline
                        .vision_model
                        .lock()
                        .unwrap_or_else(|e| e.into_inner()) = Some(m.clone());
                    m
                }
            };

            loop {
                // Pop next file from queue
                let next = {
                    let mut queue = pipeline.queue.lock().unwrap_or_else(|e| e.into_inner());
                    queue.pop_front()
                };

                let file_path = match next {
                    Some(p) => p,
                    None => break, // queue empty
                };

                // Skip files that no longer exist
                if !std::path::Path::new(&file_path).exists() {
                    continue;
                }

                // Skip files that are too large
                if let Ok(meta) = std::fs::metadata(&file_path) {
                    if meta.len() > MAX_IMAGE_SIZE {
                        continue;
                    }
                }

                // Read and base64-encode the image
                let image_data = match std::fs::read(&file_path) {
                    Ok(data) => data,
                    Err(_) => continue,
                };
                let b64 = base64_encode(&image_data);
                let content_hash = compute_file_hash(&file_path);

                let prompt = "Describe this image in detail. Include objects, colors, text, people, and any notable features.";
                let media_type = guess_media_type(&file_path);

                let result =
                    describe_image_with_provider(&cfg, &model_name, prompt, &b64, &media_type)
                        .await;

                match result {
                    Ok(description) => {
                        let tags = extract_tags(&description);
                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs();

                        let entry = AIIndexEntry {
                            path: file_path.clone(),
                            description: Some(description),
                            extracted_text: None,
                            tags,
                            model_used: model_name.clone(),
                            indexed_at: now,
                            content_hash,
                        };

                        // Store entry
                        {
                            let mut entries =
                                pipeline.entries.write().unwrap_or_else(|e| e.into_inner());
                            entries.insert(file_path, entry);
                        }

                        // Persist periodically
                        pipeline.persist();
                    }
                    Err(e) => {
                        tracing::warn!("[ai_pipeline] Vision API failed for {}: {}", file_path, e);
                    }
                }
            }

            pipeline.is_processing.store(false, Ordering::SeqCst);
            // Final persist
            pipeline.persist();
            tracing::info!(
                "[ai_pipeline] Processing complete. Total indexed: {}",
                pipeline
                    .entries
                    .read()
                    .unwrap_or_else(|e| e.into_inner())
                    .len()
            );
        });
    }
}

// ---------------------------------------------------------------------------
// Disk persistence — AI index (Tier 1b)
// ---------------------------------------------------------------------------

/// Path to the on-disk AI index file.
fn ai_index_path() -> PathBuf {
    let base = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("xplorer").join("ai_index.json")
}

/// Atomically write the AI index to disk (write to temp, then rename).
pub(super) fn save_ai_index(entries: &HashMap<String, AIIndexEntry>) {
    let path = ai_index_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let tmp_path = path.with_extension("json.tmp");
    match serde_json::to_string_pretty(entries) {
        Ok(json) => {
            if std::fs::write(&tmp_path, &json).is_ok() {
                let _ = std::fs::rename(&tmp_path, &path);
            }
        }
        Err(e) => {
            warn!("[ai_pipeline] failed to serialize AI index: {e}");
        }
    }
}

/// Load a previously-persisted AI index from disk.  Returns an empty map if
/// the file does not exist or is invalid.
pub(super) fn load_ai_index() -> HashMap<String, AIIndexEntry> {
    let path = ai_index_path();
    match std::fs::read_to_string(&path) {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

// ---------------------------------------------------------------------------
// Disk persistence — embeddings
// ---------------------------------------------------------------------------

/// Path to the on-disk embeddings file.
fn embeddings_path() -> PathBuf {
    let base = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("xplorer").join("vector_embeddings.json")
}

/// Atomically write embeddings to disk.
pub fn save_embeddings(entries: &[EmbeddingEntry]) {
    let path = embeddings_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let tmp_path = path.with_extension("json.tmp");
    match serde_json::to_string(entries) {
        Ok(json) => {
            if std::fs::write(&tmp_path, &json).is_ok() {
                let _ = std::fs::rename(&tmp_path, &path);
            }
        }
        Err(e) => {
            warn!("[ai_pipeline] failed to serialize embeddings: {e}");
        }
    }
}

/// Load previously-persisted embeddings from disk.  Returns an empty vec if
/// the file does not exist or cannot be parsed.
pub fn load_embeddings() -> Vec<EmbeddingEntry> {
    let path = embeddings_path();
    match std::fs::read_to_string(&path) {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

// ---------------------------------------------------------------------------
// Content hash (Tier 3c)
// ---------------------------------------------------------------------------

/// Compute the SHA-256 hash of (up to) the first `HASH_READ_LIMIT` bytes of
/// a file.  Returns `None` if the file cannot be read.
pub fn compute_file_hash(path: &str) -> Option<String> {
    let mut file = std::fs::File::open(path).ok()?;
    let mut buffer = vec![0u8; HASH_READ_LIMIT];
    let bytes_read = file.read(&mut buffer).ok()?;
    buffer.truncate(bytes_read);

    let mut hasher = Sha256::new();
    hasher.update(&buffer);
    let result = hasher.finalize();
    Some(format!("{:x}", result))
}

// ---------------------------------------------------------------------------
// Vision provider dispatch
// ---------------------------------------------------------------------------

/// Send a base64-encoded image to the configured vision provider and return
/// the description text.
async fn describe_image_with_provider(
    config: &VisionProviderConfig,
    model: &str,
    prompt: &str,
    base64_image: &str,
    media_type: &str,
) -> Result<String, String> {
    match config.provider {
        VisionProvider::Ollama => {
            let client = crate::search::ollama_client::get_client();
            client
                .generate_vision(model, prompt, &[base64_image.to_string()])
                .await
        }

        VisionProvider::Claude => {
            let key = config
                .api_key
                .clone()
                .or_else(|| {
                    crate::secure_credentials::get_secret("agent-api-key")
                        .ok()
                        .flatten()
                })
                .or_else(|| std::env::var("CLAUDE_API_KEY").ok())
                .ok_or_else(|| {
                    "Claude API key not configured. Set it in Settings → AI Agent.".to_string()
                })?;

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .map_err(|e| format!("HTTP client error: {}", e))?;

            let body = serde_json::json!({
                "model": model,
                "max_tokens": 1024,
                "messages": [{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": base64_image
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }]
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

            resp.get("content")
                .and_then(|c| c.as_array())
                .and_then(|arr| arr.first())
                .and_then(|item| item.get("text"))
                .and_then(|t| t.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| "No content in Claude response".to_string())
        }

        VisionProvider::Openai => {
            let key = config
                .api_key
                .clone()
                .or_else(|| {
                    crate::secure_credentials::get_secret("agent-openai-api-key")
                        .ok()
                        .flatten()
                })
                .or_else(|| std::env::var("OPENAI_API_KEY").ok())
                .ok_or_else(|| {
                    "OpenAI API key not configured. Set it in Settings → AI Agent.".to_string()
                })?;

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .map_err(|e| format!("HTTP client error: {}", e))?;

            let data_url = format!("data:{};base64,{}", media_type, base64_image);

            let body = serde_json::json!({
                "model": model,
                "max_tokens": 1024,
                "messages": [{
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": data_url
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }]
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
                .map(|s| s.to_string())
                .ok_or_else(|| "No content in OpenAI response".to_string())
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -- content hash -------------------------------------------------------

    #[test]
    fn test_content_hash() {
        // Write a temp file, hash it, and verify determinism.
        let dir = std::env::temp_dir().join("xplorer_test_hash");
        let _ = std::fs::create_dir_all(&dir);
        let file_path = dir.join("hashtest.txt");
        std::fs::write(&file_path, b"hello world").unwrap();

        let h1 = compute_file_hash(file_path.to_str().unwrap());
        let h2 = compute_file_hash(file_path.to_str().unwrap());
        assert!(h1.is_some());
        assert_eq!(h1, h2, "same content should yield the same hash");

        // Modify the file — hash should change.
        std::fs::write(&file_path, b"goodbye world").unwrap();
        let h3 = compute_file_hash(file_path.to_str().unwrap());
        assert_ne!(h1, h3, "different content should yield a different hash");

        // Cleanup.
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_content_hash_nonexistent() {
        let h = compute_file_hash("/no/such/file/at/all.bin");
        assert!(h.is_none());
    }
}
