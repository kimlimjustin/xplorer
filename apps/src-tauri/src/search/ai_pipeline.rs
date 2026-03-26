use std::collections::{HashMap, VecDeque};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, RwLock,
};

use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tracing::warn;

use super::cosine_similarity;
use super::hybrid::EmbeddingEntry;

// ---------------------------------------------------------------------------
// Vision provider configuration
// ---------------------------------------------------------------------------

/// Which AI provider to use for vision / image description.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VisionProvider {
    Ollama,
    Claude,
    Openai,
}

/// Configuration passed to `start_processing` so it knows which API to call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionProviderConfig {
    pub provider: VisionProvider,
    /// API key (required for Claude / OpenAI, ignored for Ollama).
    pub api_key: Option<String>,
    /// Optional model override (e.g. "claude-sonnet-4-6-20250514", "gpt-4o").
    pub model: Option<String>,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

pub const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp"];

/// Maximum image file size we will attempt to process (20 MB).
pub const MAX_IMAGE_SIZE: u64 = 20 * 1024 * 1024;

/// How many bytes of the file we read when computing a content hash (1 MB).
pub const HASH_READ_LIMIT: usize = 1024 * 1024;

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

/// A single entry in the persistent AI index.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIIndexEntry {
    pub path: String,
    pub description: Option<String>,
    pub extracted_text: Option<String>,
    pub tags: Vec<String>,
    pub model_used: String,
    pub indexed_at: u64,
    /// SHA-256 of (up to) the first 1 MB of file content (Tier 3c).
    pub content_hash: Option<String>,
}

/// Snapshot of the pipeline's current status, returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIIndexStatus {
    pub enabled: bool,
    pub total_indexed: usize,
    pub queue_length: usize,
    pub is_processing: bool,
    pub current_file: Option<String>,
    pub vision_model: Option<String>,
    pub embedding_model: Option<String>,
}

/// Result of LLM-based query expansion (Tier 4a).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExpandedQuery {
    pub keywords: Vec<String>,
    pub file_type: Option<String>,
    pub date_hint: Option<String>,
    pub size_hint: Option<String>,
}

// ---------------------------------------------------------------------------
// AIPipeline
// ---------------------------------------------------------------------------

/// Unified AI indexing pipeline.
///
/// Replaces the scattered logic that previously lived in `ai_indexer.rs` and
/// `vector_store.rs`.  All mutable state is behind `Arc` wrappers so the
/// pipeline can be shared across threads safely.
pub struct AIPipeline {
    entries: Arc<RwLock<HashMap<String, AIIndexEntry>>>,
    queue: Arc<Mutex<VecDeque<String>>>,
    is_processing: Arc<AtomicBool>,
    vision_model: Arc<Mutex<Option<String>>>,
    embedding_model: Arc<Mutex<Option<String>>>,
    auto_index_enabled: Arc<AtomicBool>,
}

impl AIPipeline {
    // -- Construction -------------------------------------------------------

    /// Create a new pipeline, loading any previously-persisted AI index from
    /// disk.
    pub fn new() -> Self {
        let entries = load_ai_index();
        Self {
            entries: Arc::new(RwLock::new(entries)),
            queue: Arc::new(Mutex::new(VecDeque::new())),
            is_processing: Arc::new(AtomicBool::new(false)),
            vision_model: Arc::new(Mutex::new(None)),
            embedding_model: Arc::new(Mutex::new(None)),
            auto_index_enabled: Arc::new(AtomicBool::new(false)),
        }
    }

    // -- Status / accessors -------------------------------------------------

    /// Return a snapshot of the pipeline's current status.
    pub fn get_status(&self) -> AIIndexStatus {
        let total_indexed = self.entries.read().unwrap_or_else(|e| e.into_inner()).len();
        let queue_length = self.queue.lock().unwrap_or_else(|e| e.into_inner()).len();
        let vision_model = self
            .vision_model
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        let embedding_model = self
            .embedding_model
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();

        let current_file = if self.is_processing.load(Ordering::SeqCst) {
            self.queue
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .front()
                .cloned()
        } else {
            None
        };

        AIIndexStatus {
            enabled: self.auto_index_enabled.load(Ordering::SeqCst),
            total_indexed,
            queue_length,
            is_processing: self.is_processing.load(Ordering::SeqCst),
            current_file,
            vision_model,
            embedding_model,
        }
    }

    /// Get the AI index entry for a specific file path, if one exists.
    pub fn get_entry(&self, path: &str) -> Option<AIIndexEntry> {
        self.entries
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .get(path)
            .cloned()
    }

    // -- Queue management ---------------------------------------------------

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
                    let client = super::ollama_client::get_client();
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

    // -- Persistence --------------------------------------------------------

    /// Flush the current AI index to disk.
    pub fn persist(&self) {
        let entries = self.entries.read().unwrap_or_else(|e| e.into_inner());
        save_ai_index(&entries);
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
fn save_ai_index(entries: &HashMap<String, AIIndexEntry>) {
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
fn load_ai_index() -> HashMap<String, AIIndexEntry> {
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
// Sentence-aware chunking (Tier 3b)
// ---------------------------------------------------------------------------

/// Split `text` into overlapping chunks that respect sentence boundaries.
///
/// * `target_size`  — approximate number of **words** per chunk (default 300).
/// * `min_overlap`  — number of **words** carried over from the end of the
///   previous chunk into the start of the next (default 40).
///
/// Sentence boundaries recognised: `. `, `! `, `? `, `\n\n`.
pub fn chunk_text_sentences(text: &str, target_size: usize, min_overlap: usize) -> Vec<String> {
    if text.trim().is_empty() {
        return Vec::new();
    }

    let sentences = split_sentences(text);
    if sentences.is_empty() {
        return Vec::new();
    }

    let mut chunks: Vec<String> = Vec::new();
    let mut current_words: Vec<&str> = Vec::new();

    for sentence in &sentences {
        let words: Vec<&str> = sentence.split_whitespace().collect();
        if words.is_empty() {
            continue;
        }

        current_words.extend_from_slice(&words);

        if current_words.len() >= target_size {
            chunks.push(current_words.join(" "));

            // Overlap: keep the last `min_overlap` words for the next chunk.
            let overlap_start = if current_words.len() > min_overlap {
                current_words.len() - min_overlap
            } else {
                0
            };
            let overlap: Vec<&str> = current_words[overlap_start..].to_vec();
            current_words = overlap;
        }
    }

    // Flush remaining words.
    if !current_words.is_empty() {
        let remaining = current_words.join(" ");
        // If this leftover is very short and we already have chunks, append it
        // to the last chunk instead of creating a tiny trailing chunk.
        if chunks.is_empty() || current_words.len() > min_overlap {
            chunks.push(remaining);
        } else if let Some(last) = chunks.last_mut() {
            last.push(' ');
            last.push_str(&remaining);
        }
    }

    chunks
}

/// Naive sentence splitter.  Splits on `. `, `! `, `? `, and `\n\n`.
fn split_sentences(text: &str) -> Vec<String> {
    let mut sentences: Vec<String> = Vec::new();
    let mut current = String::new();

    let chars: Vec<char> = text.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        let ch = chars[i];
        current.push(ch);

        // Check for double newline.
        if ch == '\n' && i + 1 < len && chars[i + 1] == '\n' {
            current.push('\n');
            i += 2;
            let trimmed = current.trim().to_string();
            if !trimmed.is_empty() {
                sentences.push(trimmed);
            }
            current = String::new();
            continue;
        }

        // Check for sentence-ending punctuation followed by a space.
        if (ch == '.' || ch == '!' || ch == '?') && i + 1 < len && chars[i + 1] == ' ' {
            let trimmed = current.trim().to_string();
            if !trimmed.is_empty() {
                sentences.push(trimmed);
            }
            current = String::new();
            i += 1; // skip the trailing space
                    // Advance past any additional whitespace.
            while i < len && chars[i] == ' ' {
                i += 1;
            }
            continue;
        }

        i += 1;
    }

    // Flush.
    let trimmed = current.trim().to_string();
    if !trimmed.is_empty() {
        sentences.push(trimmed);
    }

    sentences
}

// ---------------------------------------------------------------------------
// Tag extraction
// ---------------------------------------------------------------------------

/// Heuristic tag extraction from a description string.
///
/// The same candidate set used by the original `ai_indexer.rs`.
#[cfg(test)]
fn extract_tags_from_description(description: &str) -> Vec<String> {
    let candidates = [
        "person",
        "people",
        "face",
        "landscape",
        "nature",
        "animal",
        "dog",
        "cat",
        "bird",
        "building",
        "architecture",
        "car",
        "vehicle",
        "food",
        "text",
        "document",
        "screenshot",
        "chart",
        "graph",
        "diagram",
        "map",
        "sky",
        "water",
        "ocean",
        "mountain",
        "tree",
        "flower",
        "sunset",
        "night",
        "indoor",
        "outdoor",
        "street",
        "city",
        "abstract",
        "art",
        "logo",
        "icon",
        "photo",
        "illustration",
        "drawing",
        "painting",
    ];

    let lower = description.to_lowercase();
    candidates
        .iter()
        .filter(|tag| lower.contains(**tag))
        .map(|s| s.to_string())
        .collect()
}

// ---------------------------------------------------------------------------
// Query expansion (Tier 4a)
// ---------------------------------------------------------------------------

/// Build the prompt that will be sent to an Ollama LLM to expand a
/// natural-language search query into structured search parameters.
pub fn expand_query_prompt(query: &str) -> String {
    format!(
        r#"You are a search query analyzer. Given the following natural language search query, extract structured search parameters and return them as JSON.

Query: "{query}"

Return a JSON object with these fields:
- "keywords": array of relevant search keywords (strings)
- "file_type": optional file type filter (e.g. "image", "document", "pdf", "video", or null)
- "date_hint": optional date hint (e.g. "last week", "2024-01", "recent", or null)
- "size_hint": optional size hint (e.g. "large", "small", ">10MB", or null)

Respond ONLY with the JSON object, no extra text."#
    )
}

/// Parse the JSON response from the LLM query expansion prompt into an
/// `ExpandedQuery`.  Falls back to treating the entire original query as a
/// single keyword when the response is not valid JSON.
pub fn parse_expansion_response(response: &str) -> ExpandedQuery {
    // Try to extract JSON from the response (the LLM may wrap it in markdown
    // fences).
    let trimmed = response.trim();
    let json_str = if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            &trimmed[start..=end]
        } else {
            trimmed
        }
    } else {
        trimmed
    };

    serde_json::from_str::<ExpandedQuery>(json_str).unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Image similarity (Tier 4c)
// ---------------------------------------------------------------------------

/// Find the most similar images to a reference embedding by cosine similarity.
///
/// Only entries whose path ends with a recognised image extension are
/// considered.  Returns up to `limit` results as `(path, similarity)` pairs,
/// sorted descending by similarity.
pub fn find_similar_images(
    reference_embedding: &[f32],
    entries: &[EmbeddingEntry],
    limit: usize,
) -> Vec<(String, f64)> {
    if reference_embedding.is_empty() || entries.is_empty() {
        return Vec::new();
    }

    let mut scored: Vec<(String, f64)> = entries
        .iter()
        .filter(|e| is_image_path(&e.path))
        .filter(|e| !e.embedding.is_empty())
        .map(|e| {
            let sim = cosine_similarity(reference_embedding, &e.embedding);
            (e.path.clone(), sim)
        })
        .collect();

    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit);
    scored
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Base64-encode raw bytes using the standard engine.
fn base64_encode(data: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(data)
}

/// Guess MIME type from file extension.
fn guess_media_type(path: &str) -> String {
    let lower = path.to_lowercase();
    if lower.ends_with(".png") {
        "image/png".to_string()
    } else if lower.ends_with(".gif") {
        "image/gif".to_string()
    } else if lower.ends_with(".webp") {
        "image/webp".to_string()
    } else if lower.ends_with(".bmp") {
        "image/bmp".to_string()
    } else if lower.ends_with(".tiff") || lower.ends_with(".tif") {
        "image/tiff".to_string()
    } else {
        "image/jpeg".to_string()
    }
}

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
            let client = super::ollama_client::get_client();
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

/// Heuristic tag extraction from a description string.
fn extract_tags(description: &str) -> Vec<String> {
    let candidates = [
        "person",
        "people",
        "face",
        "landscape",
        "nature",
        "animal",
        "dog",
        "cat",
        "bird",
        "building",
        "architecture",
        "car",
        "vehicle",
        "food",
        "text",
        "document",
        "screenshot",
        "chart",
        "graph",
        "diagram",
        "map",
        "sky",
        "water",
        "ocean",
        "mountain",
        "tree",
        "flower",
        "sunset",
        "night",
        "indoor",
        "outdoor",
        "street",
        "city",
        "abstract",
        "art",
        "logo",
        "icon",
        "photo",
        "illustration",
        "drawing",
        "painting",
    ];

    let lower = description.to_lowercase();
    candidates
        .iter()
        .filter(|tag| lower.contains(**tag))
        .map(|s| s.to_string())
        .collect()
}

/// Return `true` if the file at `path` is an image or PDF (the only formats
/// the AI pipeline currently processes).
fn is_indexable_file(path: &str) -> bool {
    is_image_path(path) || path_has_extension(path, "pdf")
}

/// Return `true` if `path` ends with a known image extension (case-insensitive).
fn is_image_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    IMAGE_EXTENSIONS
        .iter()
        .any(|ext| lower.ends_with(&format!(".{ext}")))
}

/// Check if a path has a specific extension (case-insensitive).
fn path_has_extension(path: &str, ext: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case(ext))
        .unwrap_or(false)
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -- chunk_text_sentences -----------------------------------------------

    #[test]
    fn test_chunk_text_sentences_basic() {
        let text = "The quick brown fox jumped over the lazy dog. \
                     The rain in Spain falls mainly on the plain. \
                     Pack my box with five dozen liquor jugs. \
                     How vexingly quick daft zebras jump.";

        let chunks = chunk_text_sentences(text, 10, 3);
        assert!(!chunks.is_empty(), "should produce at least one chunk");
        // Every chunk should be non-empty.
        for chunk in &chunks {
            assert!(!chunk.trim().is_empty());
        }
    }

    #[test]
    fn test_chunk_text_sentences_short() {
        let text = "Hello world. Goodbye world.";
        let chunks = chunk_text_sentences(text, 300, 40);
        assert_eq!(chunks.len(), 1, "short text should produce a single chunk");
        assert!(chunks[0].contains("Hello"));
        assert!(chunks[0].contains("Goodbye"));
    }

    #[test]
    fn test_chunk_text_sentences_single_sentence() {
        let text = "This is a single sentence with no period at the end";
        let chunks = chunk_text_sentences(text, 300, 40);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], text);
    }

    #[test]
    fn test_chunk_text_sentences_empty() {
        let chunks = chunk_text_sentences("", 300, 40);
        assert!(chunks.is_empty());
    }

    // -- extract_tags -------------------------------------------------------

    #[test]
    fn test_extract_tags() {
        let description = "A person standing outdoors near a large building with a dog";
        let tags = extract_tags_from_description(description);
        assert!(tags.contains(&"person".to_string()));
        assert!(tags.contains(&"outdoor".to_string()));
        assert!(tags.contains(&"building".to_string()));
        assert!(tags.contains(&"dog".to_string()));
        // Should NOT contain tags that are absent.
        assert!(!tags.contains(&"cat".to_string()));
    }

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

    // -- AIPipeline ---------------------------------------------------------

    #[test]
    fn test_ai_pipeline_new() {
        let pipeline = AIPipeline::new();
        let status = pipeline.get_status();
        assert!(!status.is_processing);
        assert!(!status.enabled);
        assert_eq!(status.queue_length, 0);
    }

    #[test]
    fn test_ai_pipeline_persist_and_load() {
        // Insert an entry, persist, then create a fresh pipeline and verify
        // the entry survives the round-trip.
        let pipeline = AIPipeline::new();
        {
            let mut entries = pipeline.entries.write().unwrap_or_else(|e| e.into_inner());
            entries.insert(
                "test_persist_key.png".to_string(),
                AIIndexEntry {
                    path: "test_persist_key.png".to_string(),
                    description: Some("a test image".to_string()),
                    extracted_text: None,
                    tags: vec!["photo".to_string()],
                    model_used: "test-model".to_string(),
                    indexed_at: 1234567890,
                    content_hash: Some("abc123".to_string()),
                },
            );
        }
        pipeline.persist();

        // Load in a new pipeline.
        let pipeline2 = AIPipeline::new();
        let entry = pipeline2.get_entry("test_persist_key.png");
        assert!(entry.is_some(), "entry should survive persist + load");
        let entry = entry.unwrap();
        assert_eq!(entry.description.as_deref(), Some("a test image"));
        assert_eq!(entry.content_hash.as_deref(), Some("abc123"));

        // Cleanup: remove the test key so we don't pollute future runs.
        {
            let mut entries = pipeline2.entries.write().unwrap_or_else(|e| e.into_inner());
            entries.remove("test_persist_key.png");
        }
        pipeline2.persist();
    }

    // -- query expansion ----------------------------------------------------

    #[test]
    fn test_expand_query_prompt_format() {
        let prompt = expand_query_prompt("photos from last week larger than 5MB");
        assert!(prompt.contains("photos from last week larger than 5MB"));
        assert!(prompt.contains("keywords"));
        assert!(prompt.contains("file_type"));
        assert!(prompt.contains("date_hint"));
        assert!(prompt.contains("size_hint"));
        assert!(prompt.contains("JSON"));
    }

    #[test]
    fn test_parse_expansion_response() {
        let json = r#"{"keywords":["sunset","beach"],"file_type":"image","date_hint":"last week","size_hint":">5MB"}"#;
        let eq = parse_expansion_response(json);
        assert_eq!(eq.keywords, vec!["sunset", "beach"]);
        assert_eq!(eq.file_type.as_deref(), Some("image"));
        assert_eq!(eq.date_hint.as_deref(), Some("last week"));
        assert_eq!(eq.size_hint.as_deref(), Some(">5MB"));
    }

    #[test]
    fn test_parse_expansion_response_wrapped_in_fences() {
        let response = "```json\n{\"keywords\":[\"report\"],\"file_type\":\"pdf\",\"date_hint\":null,\"size_hint\":null}\n```";
        let eq = parse_expansion_response(response);
        assert_eq!(eq.keywords, vec!["report"]);
        assert_eq!(eq.file_type.as_deref(), Some("pdf"));
    }

    #[test]
    fn test_parse_expansion_response_invalid() {
        let eq = parse_expansion_response("not json at all");
        assert!(eq.keywords.is_empty());
        assert!(eq.file_type.is_none());
    }

    // -- find_similar_images ------------------------------------------------

    #[test]
    fn test_find_similar_images_empty() {
        let result = find_similar_images(&[1.0, 0.0], &[], 5);
        assert!(result.is_empty());
    }

    #[test]
    fn test_find_similar_images_filters_non_images() {
        let entries = vec![
            EmbeddingEntry {
                path: "doc.pdf".to_string(),
                chunk_id: 0,
                chunk_text: "a document".to_string(),
                embedding: vec![1.0, 0.0],
                model: "test".to_string(),
            },
            EmbeddingEntry {
                path: "photo.jpg".to_string(),
                chunk_id: 0,
                chunk_text: "a photo".to_string(),
                embedding: vec![1.0, 0.0],
                model: "test".to_string(),
            },
        ];
        let result = find_similar_images(&[1.0, 0.0], &entries, 5);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].0, "photo.jpg");
    }

    #[test]
    fn test_find_similar_images_ordering() {
        let entries = vec![
            EmbeddingEntry {
                path: "a.png".to_string(),
                chunk_id: 0,
                chunk_text: String::new(),
                embedding: vec![1.0, 0.0],
                model: "test".to_string(),
            },
            EmbeddingEntry {
                path: "b.jpg".to_string(),
                chunk_id: 0,
                chunk_text: String::new(),
                embedding: vec![0.0, 1.0],
                model: "test".to_string(),
            },
        ];
        let result = find_similar_images(&[1.0, 0.0], &entries, 5);
        // a.png should be most similar (identical direction).
        assert_eq!(result[0].0, "a.png");
        assert!(result[0].1 > result[1].1);
    }

    // -- auto-index / on_file_changed ---------------------------------------

    #[test]
    fn test_on_file_changed_auto_index_disabled() {
        let pipeline = AIPipeline::new();
        pipeline.set_auto_index(false);
        pipeline.on_file_changed("photo.jpg");
        let status = pipeline.get_status();
        assert_eq!(
            status.queue_length, 0,
            "should not queue when auto-index is off"
        );
    }

    #[test]
    fn test_on_file_changed_auto_index_enabled() {
        let pipeline = AIPipeline::new();
        pipeline.set_auto_index(true);
        pipeline.on_file_changed("photo.jpg");
        let status = pipeline.get_status();
        assert_eq!(status.queue_length, 1);

        // Queuing the same file again should not duplicate.
        pipeline.on_file_changed("photo.jpg");
        let status = pipeline.get_status();
        assert_eq!(status.queue_length, 1);
    }

    #[test]
    fn test_on_file_changed_non_indexable() {
        let pipeline = AIPipeline::new();
        pipeline.set_auto_index(true);
        pipeline.on_file_changed("readme.txt");
        let status = pipeline.get_status();
        assert_eq!(
            status.queue_length, 0,
            "non-image/pdf files should be ignored"
        );
    }

    // -- helpers ------------------------------------------------------------

    #[test]
    fn test_is_image_path() {
        assert!(is_image_path("photo.jpg"));
        assert!(is_image_path("PHOTO.JPG"));
        assert!(is_image_path("pic.png"));
        assert!(is_image_path("pic.webp"));
        assert!(!is_image_path("document.pdf"));
        assert!(!is_image_path("readme.txt"));
    }

    #[test]
    fn test_is_indexable_file() {
        assert!(is_indexable_file("pic.png"));
        assert!(is_indexable_file("report.pdf"));
        assert!(is_indexable_file("REPORT.PDF"));
        assert!(!is_indexable_file("data.csv"));
    }
}
