use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use super::bm25f::SearchField;

// ===== Types ================================================================

pub type DocId = u32;

/// Stored information about an indexed document.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentInfo {
    pub doc_id: DocId,
    pub path: String,
    pub filename: String,
    pub extension: String,
    pub file_size: u64,
    pub modified: u64,          // unix timestamp
    pub content_source: String, // "text", "pdf_extract", etc.
}

/// Posting list entry: (doc_id, term_frequency, field).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostingEntry {
    pub doc_id: DocId,
    pub tf: u32,
    pub field: SearchField,
}

// ===== Disk Cache ============================================================

/// Current cache format version. Bump to invalidate old caches on schema changes.
pub(crate) const INDEX_CACHE_VERSION: u32 = 1;

/// Serializable snapshot of the core index data.
///
/// FST, bitmap filters, and BM25F scorer are rebuilt from this data on load
/// (fast — sub-second for typical indices).
#[derive(Serialize, Deserialize)]
pub(crate) struct IndexCache {
    pub version: u32,
    pub documents: HashMap<DocId, DocumentInfo>,
    pub path_to_id: HashMap<String, DocId>,
    pub next_id: DocId,
    pub postings: HashMap<String, Vec<PostingEntry>>,
    pub positions: HashMap<String, HashMap<DocId, Vec<u32>>>,
    pub doc_field_lengths: HashMap<DocId, HashMap<SearchField, u32>>,
    pub doc_content: HashMap<DocId, String>,
    pub total_tokens: usize,
    #[serde(default)]
    pub doc_terms: HashMap<DocId, HashSet<String>>,
}
