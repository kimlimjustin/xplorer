// Xplorer Search Engine v2
// Modular search pipeline: stemming, BM25F, FST fuzzy, bitmap filters,
// incremental indexing, hybrid retrieval, multi-signal reranking.

pub mod stemmer;
pub mod synonyms;
pub mod query_parser;
pub mod bm25f;
pub mod fuzzy;
pub mod bitmap_filters;
pub mod watcher;
pub mod reranker;
pub mod index;
pub mod compat;
pub mod ollama_client;
pub mod hybrid;
pub mod ai_pipeline;
pub mod context_ranker;
pub mod fst_index;

// Re-export main public types
pub use index::{SearchIndex, DocId, DocumentInfo};
pub use query_parser::{ParsedQuery, FieldFilter, MetadataFilters, SortHint};
pub use bm25f::Bm25fScorer;
pub use reranker::{Reranker, RankingSignals};
pub use compat::SearchEngine;

use serde::{Deserialize, Serialize};

// ===== Shared types used across all search modules =====

pub type DocId32 = u32;

/// A single search result returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub filename: String,
    pub matches: Vec<SearchMatch>,
    pub score: f64,
    pub relevance_type: String, // "exact", "fuzzy", "semantic", "metadata", "hybrid"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snippet: Option<String>,
}

/// A single token match within a search result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub token: String,
    pub context: String,
    pub line_number: Option<usize>,
}

/// File type categories for metadata filtering.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FileTypeCategory {
    Images,
    Videos,
    Audio,
    Documents,
    Code,
    Archives,
}

/// Size filter range.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SizeFilter {
    pub min_bytes: Option<u64>,
    pub max_bytes: Option<u64>,
}

/// Date filter range (unix timestamps).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateFilter {
    pub after: Option<u64>,
    pub before: Option<u64>,
}

// ===== File extension groups =====

pub const VIDEO_EXTENSIONS: &[&str] = &["mp4", "avi", "mov", "wmv", "flv", "mkv", "webm", "m4v"];
pub const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "bmp", "tiff", "svg", "webp", "ico", "raw", "cr2", "nef"];
pub const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a", "opus"];
pub const ARCHIVE_EXTENSIONS: &[&str] = &["zip", "tar", "gz", "rar", "7z", "iso", "bz2", "xz", "zst"];
pub const CODE_EXTENSIONS: &[&str] = &[
    "js", "ts", "jsx", "tsx", "py", "rs", "go", "java", "c", "cpp", "h", "hpp",
    "cs", "rb", "php", "swift", "kt", "scala", "lua", "sh", "bash", "ps1",
    "html", "css", "scss", "sass", "less", "vue", "svelte", "zig", "hs", "ex",
];
pub const DOCUMENT_EXTENSIONS: &[&str] = &[
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp",
    "txt", "md", "rtf", "csv", "epub", "mobi",
];

// ===== Shared math utilities =====

/// Compute cosine similarity between two `f32` vectors.  Returns 0.0 when
/// either vector has zero magnitude or the lengths differ.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let mut dot: f32 = 0.0;
    let mut mag_a: f32 = 0.0;
    let mut mag_b: f32 = 0.0;

    for i in 0..a.len() {
        let x = a[i];
        let y = b[i];
        dot += x * y;
        mag_a += x * x;
        mag_b += y * y;
    }

    let denom = (mag_a.sqrt() * mag_b.sqrt()) as f64;
    if denom == 0.0 { 0.0 } else { (dot as f64) / denom }
}

pub fn classify_extension(ext: &str) -> Option<FileTypeCategory> {
    let ext_lower = ext.to_lowercase();
    let ext = ext_lower.as_str();
    if IMAGE_EXTENSIONS.contains(&ext) { return Some(FileTypeCategory::Images); }
    if VIDEO_EXTENSIONS.contains(&ext) { return Some(FileTypeCategory::Videos); }
    if AUDIO_EXTENSIONS.contains(&ext) { return Some(FileTypeCategory::Audio); }
    if DOCUMENT_EXTENSIONS.contains(&ext) { return Some(FileTypeCategory::Documents); }
    if CODE_EXTENSIONS.contains(&ext) { return Some(FileTypeCategory::Code); }
    if ARCHIVE_EXTENSIONS.contains(&ext) { return Some(FileTypeCategory::Archives); }
    None
}
