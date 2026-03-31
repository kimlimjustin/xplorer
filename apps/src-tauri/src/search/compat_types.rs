// Xplorer Search Engine — Compatibility Types
//
// Frontend-compatible types mirroring the old `tokenizer.rs` serialization
// so that the Tauri command signatures remain identical.

use serde::{Deserialize, Serialize};

use super::SearchResult;

// ===== Configuration constants ==============================================

/// Default maximum file size for indexing (50 MB).
pub(crate) const DEFAULT_MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;

/// Default update interval in seconds (5 minutes).
pub(crate) const DEFAULT_UPDATE_INTERVAL_SECS: u64 = 300;

/// Default result limit for search and enhanced search commands.
pub(crate) const DEFAULT_SEARCH_LIMIT: usize = 50;

/// Default result limit for file recommendation commands.
pub(crate) const DEFAULT_RECOMMENDATION_LIMIT: usize = 10;

/// Default result limit for semantic search commands.
pub(crate) const DEFAULT_SEMANTIC_SEARCH_LIMIT: usize = 20;

/// Minimum cosine similarity threshold for semantic search results.
pub(crate) const SEMANTIC_SIMILARITY_THRESHOLD: f64 = 0.3;

// ===== Frontend-compatible types ============================================

/// Settings exposed to the frontend via `get_tokenizer_settings` /
/// `set_tokenizer_settings`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenizerSettings {
    pub enabled: bool,
    pub whitelisted_paths: Vec<String>,
    pub blacklisted_extensions: Vec<String>,
    #[serde(default)]
    pub blacklisted_paths: Vec<String>,
    pub max_file_size: u64,
    pub update_interval: u64,
    /// Maximum memory (in MB) the search index is allowed to use.
    #[serde(default = "default_memory_limit_mb")]
    pub memory_limit_mb: u64,
}

fn default_memory_limit_mb() -> u64 {
    256
}

/// The return type for `enhanced_search`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedSearchResult {
    pub results: Vec<SearchResult>,
    pub parsed_query: CompatStructuredQuery,
    pub total_scanned: usize,
}

/// A query representation that matches the old `StructuredQuery` shape the
/// frontend expects.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompatStructuredQuery {
    pub keywords: Vec<String>,
    pub file_type_filter: Option<String>,
    pub size_filter: Option<super::SizeFilter>,
    pub date_filter: Option<super::DateFilter>,
    pub extension_filter: Vec<String>,
    pub content_source_filter: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_hint: Option<String>,
}

/// Lightweight stats returned by `get_tokenizer_stats`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenizerStats {
    pub total_files: usize,
    pub total_tokens: usize,
    pub last_updated: u64,
    pub avg_doc_length: f64,
}

/// Per-file token data returned by `get_file_tokens`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileToken {
    pub path: String,
    pub filename: String,
    pub extension: String,
    pub content_tokens: Vec<String>,
    pub file_size: u64,
    pub last_modified: u64,
    pub indexed_at: u64,
    pub content_source: String,
}

/// AI search result type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AISearchResult {
    pub results: Vec<SearchResult>,
    pub provider: String,
    pub model: String,
}

// ===== Defaults =============================================================

impl Default for TokenizerSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            whitelisted_paths: vec![],
            blacklisted_extensions: vec![
                // Binary executables / libraries
                "exe", "dll", "so", "dylib", "bin", "obj", // Archives
                "zip", "tar", "gz", "rar", "7z", "iso", // Images
                "jpg", "jpeg", "png", "gif", "bmp", "tiff", // Video
                "mp4", "avi", "mov", "wmv", "flv", "mkv", // Audio
                "mp3", "wav", "flac", "aac", "ogg", "wma", // Old binary doc formats
                "doc", "ppt", "xls",
            ]
            .into_iter()
            .map(String::from)
            .collect(),
            blacklisted_paths: vec![],
            max_file_size: DEFAULT_MAX_FILE_SIZE,
            update_interval: DEFAULT_UPDATE_INTERVAL_SECS,
            memory_limit_mb: default_memory_limit_mb(),
        }
    }
}

// ===== Conversion helpers ===================================================

/// Convert a `ParsedQuery` from the new query parser into the
/// `CompatStructuredQuery` the frontend expects.
pub(crate) fn parsed_to_compat(parsed: &super::query_parser::ParsedQuery) -> CompatStructuredQuery {
    use super::query_parser::SortHint;
    let sort_hint = match parsed.metadata.sort_hint {
        SortHint::None => None,
        SortHint::SizeDesc => Some("size_desc".to_string()),
        SortHint::SizeAsc => Some("size_asc".to_string()),
        SortHint::DateDesc => Some("date_desc".to_string()),
        SortHint::DateAsc => Some("date_asc".to_string()),
    };
    CompatStructuredQuery {
        keywords: parsed.keywords.clone(),
        file_type_filter: parsed.metadata.file_type.map(|ft| format!("{:?}", ft)),
        size_filter: parsed.metadata.size.clone(),
        date_filter: parsed.metadata.date.clone(),
        extension_filter: parsed.metadata.extensions.clone(),
        content_source_filter: None,
        sort_hint,
    }
}
