mod indexing;
mod search;

pub use indexing::*;
pub use search::*;

use std::collections::{HashMap, VecDeque};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, RwLock,
};

use base64::Engine;
use serde::{Deserialize, Serialize};

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
    pub(crate) entries: Arc<RwLock<HashMap<String, AIIndexEntry>>>,
    pub(crate) queue: Arc<Mutex<VecDeque<String>>>,
    pub(crate) is_processing: Arc<AtomicBool>,
    pub(crate) vision_model: Arc<Mutex<Option<String>>>,
    pub(crate) embedding_model: Arc<Mutex<Option<String>>>,
    pub(crate) auto_index_enabled: Arc<AtomicBool>,
}

impl Default for AIPipeline {
    fn default() -> Self {
        Self::new()
    }
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

    // -- Persistence --------------------------------------------------------

    /// Flush the current AI index to disk.
    pub fn persist(&self) {
        let entries = self.entries.read().unwrap_or_else(|e| e.into_inner());
        save_ai_index(&entries);
    }
}

// ---------------------------------------------------------------------------
// Helpers shared across submodules
// ---------------------------------------------------------------------------

/// Return `true` if the file at `path` is an image or PDF (the only formats
/// the AI pipeline currently processes).
pub(crate) fn is_indexable_file(path: &str) -> bool {
    is_image_path(path) || path_has_extension(path, "pdf")
}

/// Return `true` if `path` ends with a known image extension (case-insensitive).
pub(crate) fn is_image_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    IMAGE_EXTENSIONS
        .iter()
        .any(|ext| lower.ends_with(&format!(".{ext}")))
}

/// Check if a path has a specific extension (case-insensitive).
fn path_has_extension(path: &str, ext: &str) -> bool {
    std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case(ext))
        .unwrap_or(false)
}

/// Heuristic tag extraction from a description string.
pub(crate) fn extract_tags(description: &str) -> Vec<String> {
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

/// Base64-encode raw bytes using the standard engine.
pub(crate) fn base64_encode(data: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(data)
}

/// Guess MIME type from file extension.
pub(crate) fn guess_media_type(path: &str) -> String {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -- extract_tags -------------------------------------------------------

    #[test]
    fn test_extract_tags() {
        let description = "A person standing outdoors near a large building with a dog";
        let tags = extract_tags(description);
        assert!(tags.contains(&"person".to_string()));
        assert!(tags.contains(&"outdoor".to_string()));
        assert!(tags.contains(&"building".to_string()));
        assert!(tags.contains(&"dog".to_string()));
        // Should NOT contain tags that are absent.
        assert!(!tags.contains(&"cat".to_string()));
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
