// Xplorer Search Engine — Core Search Index
//
// Central data structure that coordinates the FST term dictionary, compressed
// posting lists, BM25F scoring, bitmap filters, stemming, synonym expansion,
// and document storage.  All search modules converge here.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use dashmap::DashMap;

use regex::Regex;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use super::bitmap_filters::{BitmapFilterIndex, FileMetaEntry};
use super::bm25f::{Bm25fConfig, Bm25fScorer, FieldTermFreqs, SearchField};
use super::fuzzy::FstIndex;
use super::reranker::{path_depth, RankingSignals, Reranker};
use super::{SearchMatch, SearchResult};

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
const INDEX_CACHE_VERSION: u32 = 1;

/// Serializable snapshot of the core index data.
///
/// FST, bitmap filters, and BM25F scorer are rebuilt from this data on load
/// (fast — sub-second for typical indices).
#[derive(Serialize, Deserialize)]
struct IndexCache {
    version: u32,
    documents: HashMap<DocId, DocumentInfo>,
    path_to_id: HashMap<String, DocId>,
    next_id: DocId,
    postings: HashMap<String, Vec<PostingEntry>>,
    positions: HashMap<String, HashMap<DocId, Vec<u32>>>,
    doc_field_lengths: HashMap<DocId, HashMap<SearchField, u32>>,
    doc_content: HashMap<DocId, String>,
    total_tokens: usize,
}

fn index_cache_path() -> PathBuf {
    let base = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("xplorer").join("search_index.bin")
}

// ===== Core Index ===========================================================

/// The core search index holding all data structures.
pub struct SearchIndex {
    // Document store: doc_id -> document info
    documents: HashMap<DocId, DocumentInfo>,
    // Path -> doc_id lookup
    path_to_id: HashMap<String, DocId>,
    // Next doc_id to assign
    next_id: DocId,

    // Inverted index: stemmed_term -> Vec<PostingEntry>
    postings: DashMap<String, Vec<PostingEntry>>,

    // Positional index: stemmed_term -> { doc_id -> [positions] }
    // Used for phrase search — stores the word position (0-based index) of
    // each occurrence of a term within a document's content.
    positions: HashMap<String, HashMap<DocId, Vec<u32>>>,

    // FST for fuzzy/prefix search (rebuilt periodically)
    fst_index: FstIndex,

    // Bitmap filters for metadata
    pub(crate) bitmap_index: BitmapFilterIndex,

    // BM25F scorer
    scorer: Bm25fScorer,

    // Reranker
    reranker: Reranker,

    // Per-document field lengths for BM25F
    doc_field_lengths: HashMap<DocId, HashMap<SearchField, u32>>,

    // Content store for phrase post-filtering (first 10 KB per document)
    doc_content: HashMap<DocId, String>,

    // Corpus stats
    total_tokens: usize,
}

// ===== Private helpers ======================================================

/// Regex for extracting word tokens: Unicode letters, digits, and underscores,
/// minimum length 2.
fn word_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"[\p{L}\p{N}_]{2,}").unwrap())
}

/// Split a word on CamelCase boundaries.
///
/// ```text
/// "HttpResponse"    -> ["Http", "Response"]
/// "XMLParser"       -> ["XML", "Parser"]
/// "getHTTPResponse" -> ["get", "HTTP", "Response"]
/// ```
fn split_camel_case(word: &str) -> Vec<String> {
    let chars: Vec<char> = word.chars().collect();
    if chars.len() < 2 {
        return vec![word.to_string()];
    }

    let mut parts = Vec::new();
    let mut start = 0;

    for i in 1..chars.len() {
        let prev = chars[i - 1];
        let curr = chars[i];

        // Split on: lowercase -> uppercase ("get|HTTP")
        // Split on: uppercase -> uppercase+lowercase ("HTT|P..." -> "XML|Parser")
        let split = (prev.is_lowercase() && curr.is_uppercase())
            || (i + 1 < chars.len()
                && prev.is_uppercase()
                && curr.is_uppercase()
                && chars[i + 1].is_lowercase());

        if split {
            let part: String = chars[start..i].iter().collect();
            if !part.is_empty() {
                parts.push(part);
            }
            start = i;
        }
    }

    let remaining: String = chars[start..].iter().collect();
    if !remaining.is_empty() {
        parts.push(remaining);
    }

    parts
}

/// Tokenize text with CamelCase/snake_case splitting and stemming.
/// Returns a frequency map of stemmed tokens.
fn tokenize_and_stem(text: &str) -> HashMap<String, u32> {
    let stemmer = super::stemmer::default_stemmer();
    let re = word_regex();
    let mut freq: HashMap<String, u32> = HashMap::new();

    for m in re.find_iter(text) {
        let word = m.as_str();
        let lower = word.to_lowercase();

        // Stem and add the full word
        let stemmed = stemmer.stem_word(&lower);
        if stemmed.len() >= 2 {
            *freq.entry(stemmed.clone()).or_insert(0) += 1;
        }

        // Split CamelCase: "HttpResponse" -> "http", "response"
        let camel_parts = split_camel_case(word);
        if camel_parts.len() > 1 {
            for part in &camel_parts {
                let part_lower = part.to_lowercase();
                if part_lower.len() >= 2 {
                    let part_stemmed = stemmer.stem_word(&part_lower);
                    if part_stemmed.len() >= 2 && part_stemmed != stemmed {
                        *freq.entry(part_stemmed).or_insert(0) += 1;
                    }
                }
            }
        }

        // Split snake_case: "file_name" -> "file", "name"
        if word.contains('_') {
            for part in word.split('_') {
                let part_lower = part.to_lowercase();
                if part_lower.len() >= 2 {
                    let part_stemmed = stemmer.stem_word(&part_lower);
                    if part_stemmed.len() >= 2 && part_stemmed != stemmed {
                        *freq.entry(part_stemmed).or_insert(0) += 1;
                    }
                }
            }
        }
    }

    freq
}

/// Tokenize text with stemming, returning both frequency counts and
/// positional information.  Each stemmed token maps to its TF and
/// the list of 0-based word positions where it appeared.
///
/// Position tracking assigns sequential integers to each regex-matched
/// word token (CamelCase and snake_case sub-parts are NOT given their
/// own positions — they share the position of the parent token so that
/// phrase searches work on the natural word order).
fn tokenize_with_positions(text: &str) -> (HashMap<String, u32>, HashMap<String, Vec<u32>>) {
    let stemmer = super::stemmer::default_stemmer();
    let re = word_regex();
    let mut freq: HashMap<String, u32> = HashMap::new();
    let mut positions: HashMap<String, Vec<u32>> = HashMap::new();
    let mut pos: u32 = 0;

    for m in re.find_iter(text) {
        let word = m.as_str();
        let lower = word.to_lowercase();

        // Stem the full word
        let stemmed = stemmer.stem_word(&lower);
        if stemmed.len() >= 2 {
            *freq.entry(stemmed.clone()).or_insert(0) += 1;
            positions.entry(stemmed.clone()).or_default().push(pos);
        }

        // CamelCase sub-parts share the same position
        let camel_parts = split_camel_case(word);
        if camel_parts.len() > 1 {
            for part in &camel_parts {
                let part_lower = part.to_lowercase();
                if part_lower.len() >= 2 {
                    let part_stemmed = stemmer.stem_word(&part_lower);
                    if part_stemmed.len() >= 2 && part_stemmed != stemmed {
                        *freq.entry(part_stemmed.clone()).or_insert(0) += 1;
                        positions.entry(part_stemmed).or_default().push(pos);
                    }
                }
            }
        }

        // snake_case sub-parts share the same position
        if word.contains('_') {
            for part in word.split('_') {
                let part_lower = part.to_lowercase();
                if part_lower.len() >= 2 {
                    let part_stemmed = stemmer.stem_word(&part_lower);
                    if part_stemmed.len() >= 2 && part_stemmed != stemmed {
                        *freq.entry(part_stemmed.clone()).or_insert(0) += 1;
                        positions.entry(part_stemmed).or_default().push(pos);
                    }
                }
            }
        }

        pos += 1;
    }

    (freq, positions)
}

// ===== SearchIndex implementation ===========================================

impl SearchIndex {
    // -- 1. new() ------------------------------------------------------------

    /// Create an empty index with default scorer and reranker.
    pub fn new() -> Self {
        let avg_field_lengths = HashMap::new();
        Self {
            documents: HashMap::new(),
            path_to_id: HashMap::new(),
            next_id: 0,
            postings: DashMap::new(),
            positions: HashMap::new(),
            fst_index: FstIndex::new(),
            bitmap_index: BitmapFilterIndex::new(),
            scorer: Bm25fScorer::new(Bm25fConfig::default(), 0, avg_field_lengths),
            reranker: Reranker::with_defaults(),
            doc_field_lengths: HashMap::new(),
            doc_content: HashMap::new(),
            total_tokens: 0,
        }
    }

    // -- 1b. estimated_memory_bytes() ----------------------------------------

    /// Rough estimate of the memory consumed by this index (in bytes).
    ///
    /// Not exact — ignores HashMap overhead, allocator padding, etc. — but
    /// good enough for a configurable "stop indexing" threshold.
    pub fn estimated_memory_bytes(&self) -> usize {
        // Per-document overhead: DocumentInfo fields + path string + doc_field_lengths entry
        let docs_bytes: usize = self
            .documents
            .values()
            .map(|d| {
                80 + d.path.len() + d.filename.len() + d.extension.len() + d.content_source.len()
            })
            .sum();

        // Inverted index: term strings + posting entries (12 bytes each)
        let postings_bytes: usize = self
            .postings
            .iter()
            .map(|r| r.key().len() + r.value().len() * 12)
            .sum();

        // Positional index: term + doc_id + position list
        let positions_bytes: usize = self
            .positions
            .iter()
            .map(|(term, doc_map)| {
                term.len() + doc_map.values().map(|pos| 4 + pos.len() * 4).sum::<usize>()
            })
            .sum();

        // Content store (first 10 KB per doc)
        let content_bytes: usize = self.doc_content.values().map(|s| s.len()).sum();

        // Field lengths map
        let field_len_bytes = self.doc_field_lengths.len() * 64;

        // path_to_id lookup
        let path_lookup_bytes: usize = self.path_to_id.keys().map(|k| k.len() + 4).sum();

        docs_bytes
            + postings_bytes
            + positions_bytes
            + content_bytes
            + field_len_bytes
            + path_lookup_bytes
    }

    // -- 2. index_document() -------------------------------------------------

    /// Index a single document.
    ///
    /// If the path already exists, the old entries are removed first. Assigns a
    /// new doc_id, tokenizes filename / path / content into the appropriate
    /// BM25F fields, and updates all supporting data structures.
    pub fn index_document(
        &mut self,
        path: &str,
        content: &str,
        content_source: &str,
        file_size: u64,
        modified: u64,
    ) {
        // Remove old entry if the same path was already indexed.
        if self.path_to_id.contains_key(path) {
            self.remove_document(path);
        }

        // Assign doc_id and create DocumentInfo.
        let doc_id = self.next_id;
        self.next_id += 1;

        let p = Path::new(path);
        let filename = p
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();
        let extension = p
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default();

        let doc_info = DocumentInfo {
            doc_id,
            path: path.to_string(),
            filename: filename.clone(),
            extension: extension.clone(),
            content_source: content_source.to_string(),
            file_size,
            modified,
        };

        self.documents.insert(doc_id, doc_info);
        self.path_to_id.insert(path.to_string(), doc_id);

        // Track field lengths for this document.
        let mut field_lengths: HashMap<SearchField, u32> = HashMap::new();

        // -- Filename tokens --------------------------------------------------
        let filename_stem = p
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        // FilenameExact: exact lowercase tokens (unstemmed) for precise matching
        let filename_exact_tokens = tokenize_exact(&filename_stem);
        let filename_exact_len = filename_exact_tokens.values().sum::<u32>();
        field_lengths.insert(SearchField::FilenameExact, filename_exact_len);
        for (token, tf) in &filename_exact_tokens {
            self.add_posting(token, doc_id, *tf, SearchField::FilenameExact);
        }

        // FilenameStem: stemmed filename tokens
        let filename_stemmed = tokenize_and_stem(&filename_stem);
        let filename_stem_len = filename_stemmed.values().sum::<u32>();
        field_lengths.insert(SearchField::FilenameStem, filename_stem_len);
        for (token, tf) in &filename_stemmed {
            self.add_posting(token, doc_id, *tf, SearchField::FilenameStem);
        }

        // -- Path component tokens -------------------------------------------
        let path_components: Vec<String> = p
            .components()
            .filter_map(|c| {
                let s = c.as_os_str().to_string_lossy().to_string();
                // Skip root/prefix components like "C:" or "/"
                if s.len() >= 2 && !s.contains(':') {
                    Some(s)
                } else {
                    None
                }
            })
            .collect();

        let path_text = path_components.join(" ");
        let path_tokens = tokenize_and_stem(&path_text);
        let path_len = path_tokens.values().sum::<u32>();
        field_lengths.insert(SearchField::PathComponent, path_len);
        for (token, tf) in &path_tokens {
            self.add_posting(token, doc_id, *tf, SearchField::PathComponent);
        }

        // -- Content tokens (with positional index) ----------------------------
        // First 1000 chars -> ContentHead, rest -> ContentBody.
        // We tokenize the full content with positions first so phrase
        // search has continuous position numbering across head + body.
        let head_boundary = content.len().min(1000);
        // Ensure we don't split a multi-byte character
        let head_boundary = content
            .char_indices()
            .take_while(|(i, _)| *i < head_boundary)
            .last()
            .map(|(i, c)| i + c.len_utf8())
            .unwrap_or(0);

        let content_head = &content[..head_boundary];
        let content_body = if head_boundary < content.len() {
            &content[head_boundary..]
        } else {
            ""
        };

        // Tokenize with positions over the full content for phrase search.
        let (full_content_freq, full_content_pos) = tokenize_with_positions(content);
        // Store positions in the positional index.
        for (term, term_positions) in &full_content_pos {
            self.positions
                .entry(term.clone())
                .or_default()
                .insert(doc_id, term_positions.clone());
        }

        // For BM25F scoring we still split into head/body fields.
        let head_tokens = tokenize_and_stem(content_head);
        let head_len = head_tokens.values().sum::<u32>();
        field_lengths.insert(SearchField::ContentHead, head_len);
        for (token, tf) in &head_tokens {
            self.add_posting(token, doc_id, *tf, SearchField::ContentHead);
        }

        let body_tokens = tokenize_and_stem(content_body);
        let body_len = body_tokens.values().sum::<u32>();
        field_lengths.insert(SearchField::ContentBody, body_len);
        for (token, tf) in &body_tokens {
            self.add_posting(token, doc_id, *tf, SearchField::ContentBody);
        }
        // drop full_content_freq (we only needed positions from it)
        let _ = full_content_freq;

        // -- Update total tokens ---------------------------------------------
        self.total_tokens +=
            (filename_exact_len + filename_stem_len + path_len + head_len + body_len) as usize;

        // -- Store field lengths for BM25F -----------------------------------
        self.doc_field_lengths.insert(doc_id, field_lengths);

        // -- Store content for phrase matching (first 10 KB) -----------------
        let content_limit = content.len().min(10240);
        let safe_limit = content
            .char_indices()
            .take_while(|(i, _)| *i < content_limit)
            .last()
            .map(|(i, c)| i + c.len_utf8())
            .unwrap_or(0);
        self.doc_content
            .insert(doc_id, content[..safe_limit].to_lowercase());

        // -- Add to bitmap index ---------------------------------------------
        self.bitmap_index.add_file(&FileMetaEntry {
            doc_id,
            extension: extension.to_lowercase(),
            size: file_size,
            modified,
        });
    }

    // -- 3. remove_document() ------------------------------------------------

    /// Remove a document from the index by path.
    pub fn remove_document(&mut self, path: &str) {
        let doc_id = match self.path_to_id.remove(path) {
            Some(id) => id,
            None => return,
        };

        self.documents.remove(&doc_id);
        self.doc_field_lengths.remove(&doc_id);
        self.doc_content.remove(&doc_id);

        // Remove all posting entries for this doc_id.
        let mut empty_terms: Vec<String> = Vec::new();
        for mut r in self.postings.iter_mut() {
            r.value_mut().retain(|e| e.doc_id != doc_id);
            if r.value().is_empty() {
                empty_terms.push(r.key().clone());
            }
        }
        for term in empty_terms {
            self.postings.remove(&term);
        }

        // Remove from positional index.
        let mut empty_pos_terms: Vec<String> = Vec::new();
        for (term, doc_positions) in self.positions.iter_mut() {
            doc_positions.remove(&doc_id);
            if doc_positions.is_empty() {
                empty_pos_terms.push(term.clone());
            }
        }
        for term in empty_pos_terms {
            self.positions.remove(&term);
        }

        // Remove from bitmap index.
        self.bitmap_index.remove_file(doc_id);
    }

    // -- 4. rebuild_fst() ----------------------------------------------------

    /// Rebuild the FST from current postings keys.
    ///
    /// Should be called after batch indexing to enable fuzzy/prefix search.
    pub fn rebuild_fst(&mut self) {
        let mut terms: Vec<(String, u64)> = self
            .postings
            .iter()
            .enumerate()
            .map(|(i, r)| (r.key().clone(), i as u64))
            .collect();
        match FstIndex::build(&mut terms) {
            Ok(index) => self.fst_index = index,
            Err(e) => {
                tracing::warn!("[search::index] failed to rebuild FST index: {e}");
            }
        }
    }

    // -- 5. update_scorer_stats() --------------------------------------------

    /// Recompute BM25F corpus statistics from current doc_field_lengths.
    ///
    /// Call this after batch indexing or significant index changes to ensure
    /// accurate BM25F scoring.
    pub fn update_scorer_stats(&mut self) {
        let num_docs = self.documents.len();
        let mut field_sums: HashMap<SearchField, f64> = HashMap::new();
        let mut field_counts: HashMap<SearchField, usize> = HashMap::new();

        for lengths in self.doc_field_lengths.values() {
            for (field, &len) in lengths {
                *field_sums.entry(*field).or_insert(0.0) += len as f64;
                *field_counts.entry(*field).or_insert(0) += 1;
            }
        }

        let mut avg_field_lengths: HashMap<SearchField, f64> = HashMap::new();
        for field in SearchField::all() {
            let sum = field_sums.get(field).copied().unwrap_or(0.0);
            let count = field_counts.get(field).copied().unwrap_or(0);
            let avg = if count > 0 { sum / count as f64 } else { 1.0 };
            avg_field_lengths.insert(*field, avg);
        }

        self.scorer.update_stats(num_docs, avg_field_lengths);
    }

    // -- 5b. Disk persistence -------------------------------------------------

    /// Save the current index to disk as a bincode file.
    ///
    /// Uses atomic write (tmp + rename) to prevent corruption.
    pub fn save_to_disk(&self) {
        let path = index_cache_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let postings_snapshot: HashMap<String, Vec<PostingEntry>> = self
            .postings
            .iter()
            .map(|r| (r.key().clone(), r.value().clone()))
            .collect();

        let cache = IndexCache {
            version: INDEX_CACHE_VERSION,
            documents: self.documents.clone(),
            path_to_id: self.path_to_id.clone(),
            next_id: self.next_id,
            postings: postings_snapshot,
            positions: self.positions.clone(),
            doc_field_lengths: self.doc_field_lengths.clone(),
            doc_content: self.doc_content.clone(),
            total_tokens: self.total_tokens,
        };

        let tmp_path = path.with_extension("bin.tmp");
        match bincode::serialize(&cache) {
            Ok(bytes) => {
                let size_mb = bytes.len() as f64 / (1024.0 * 1024.0);
                if std::fs::write(&tmp_path, &bytes).is_ok() {
                    if std::fs::rename(&tmp_path, &path).is_ok() {
                        info!(
                            "[SearchIndex] Saved index cache ({:.1} MB, {} docs, {} terms)",
                            size_mb,
                            self.documents.len(),
                            self.postings.len()
                        );
                    } else {
                        let _ = std::fs::remove_file(&tmp_path);
                        warn!("[SearchIndex] Failed to rename cache file");
                    }
                } else {
                    warn!("[SearchIndex] Failed to write cache file");
                }
            }
            Err(e) => {
                warn!("[SearchIndex] Failed to serialize index cache: {e}");
            }
        }
    }

    /// Load the index from disk cache, rebuilding FST/bitmap/scorer.
    ///
    /// Returns `None` if no cache exists, version mismatches, or deserialization fails.
    pub fn load_from_disk() -> Option<Self> {
        let path = index_cache_path();
        let bytes = match std::fs::read(&path) {
            Ok(b) => b,
            Err(_) => return None,
        };

        let cache: IndexCache = match bincode::deserialize(&bytes) {
            Ok(c) => c,
            Err(e) => {
                warn!("[SearchIndex] Failed to deserialize cache: {e}");
                return None;
            }
        };

        if cache.version != INDEX_CACHE_VERSION {
            info!(
                "[SearchIndex] Cache version mismatch (got {}, expected {}), rebuilding",
                cache.version, INDEX_CACHE_VERSION
            );
            return None;
        }

        let doc_count = cache.documents.len();
        let term_count = cache.postings.len();

        let postings: DashMap<String, Vec<PostingEntry>> = cache.postings.into_iter().collect();

        let mut index = Self {
            documents: cache.documents,
            path_to_id: cache.path_to_id,
            next_id: cache.next_id,
            postings,
            positions: cache.positions,
            fst_index: FstIndex::new(),
            bitmap_index: BitmapFilterIndex::new(),
            scorer: Bm25fScorer::new(Bm25fConfig::default(), 0, HashMap::new()),
            reranker: Reranker::with_defaults(),
            doc_field_lengths: cache.doc_field_lengths,
            doc_content: cache.doc_content,
            total_tokens: cache.total_tokens,
        };

        // Rebuild derived structures from loaded data.
        index.rebuild_fst();
        index.update_scorer_stats();

        // Rebuild bitmap filters from document metadata.
        for doc in index.documents.values() {
            index.bitmap_index.add_file(&FileMetaEntry {
                doc_id: doc.doc_id,
                extension: doc.extension.clone(),
                size: doc.file_size,
                modified: doc.modified,
            });
        }

        info!(
            "[SearchIndex] Loaded cached index ({} docs, {} terms)",
            doc_count, term_count
        );

        Some(index)
    }

    /// Get a reference to the documents map (for incremental validation).
    pub fn documents(&self) -> &HashMap<DocId, DocumentInfo> {
        &self.documents
    }

    // -- 6. search() ---------------------------------------------------------

    /// Main search entry point.
    ///
    /// Parses the query, scores documents via BM25F, applies metadata/field
    /// filters, performs fuzzy fallback, reranks, and returns the top results.
    pub fn search(&self, query: &str, limit: usize) -> Vec<SearchResult> {
        if query.trim().is_empty() || limit == 0 {
            return Vec::new();
        }

        // a. Parse query
        let parsed = super::query_parser::parse(query);

        // b. Stem keywords
        let stemmer = super::stemmer::default_stemmer();
        let stemmed = stemmer.stem_tokens(&parsed.keywords);

        // c. Expand with synonyms
        let expanded = super::synonyms::expand_query(&stemmed);

        // d. Score documents via BM25F
        let mut doc_scores: HashMap<DocId, f64> = HashMap::new();
        let mut doc_matched_terms: HashMap<DocId, Vec<String>> = HashMap::new();

        for term in &expanded {
            if let Some(entries) = self.postings.get(term) {
                let df = self.document_frequency(term);

                // Accumulate FieldTermFreqs per document for this term
                let mut doc_ftfs: HashMap<DocId, FieldTermFreqs> = HashMap::new();
                for entry in entries.value() {
                    let ftf = doc_ftfs
                        .entry(entry.doc_id)
                        .or_insert_with(FieldTermFreqs::new);
                    let field_len = self
                        .doc_field_lengths
                        .get(&entry.doc_id)
                        .and_then(|m| m.get(&entry.field))
                        .copied()
                        .unwrap_or(1);
                    ftf.add(entry.field, entry.tf, field_len);
                }

                for (doc_id, ftf) in &doc_ftfs {
                    let score = self.scorer.score_term(df, ftf);
                    *doc_scores.entry(*doc_id).or_insert(0.0) += score;
                    doc_matched_terms
                        .entry(*doc_id)
                        .or_default()
                        .push(term.clone());
                }
            }
        }

        // e. Exclude negation terms
        for neg_term in &parsed.negations {
            let neg_stemmed = stemmer.stem_word(neg_term);
            if let Some(entries) = self.postings.get(&neg_stemmed) {
                for entry in entries.value() {
                    doc_scores.remove(&entry.doc_id);
                    doc_matched_terms.remove(&entry.doc_id);
                }
            }
            // Also check the unstemmed form
            if let Some(entries) = self.postings.get(neg_term) {
                for entry in entries.value() {
                    doc_scores.remove(&entry.doc_id);
                    doc_matched_terms.remove(&entry.doc_id);
                }
            }
        }

        // f. Apply metadata filters via bitmap index
        if parsed.metadata.file_type.is_some()
            || parsed.metadata.size.is_some()
            || parsed.metadata.date.is_some()
            || !parsed.metadata.extensions.is_empty()
        {
            let allowed = self.bitmap_index.apply_filters(
                None,
                parsed.metadata.file_type,
                parsed.metadata.size.as_ref(),
                parsed.metadata.date.as_ref(),
                &parsed.metadata.extensions,
            );

            doc_scores.retain(|doc_id, _| allowed.contains(*doc_id));
        }

        // g. Phrase filtering via positional index
        //
        // When the query contains phrases, we need to handle two cases:
        //   - Phrase + keywords: filter doc_scores to only docs matching the phrase.
        //   - Phrase-only query: seed doc_scores from phrase results, then score
        //     using the phrase's constituent words.
        if !parsed.phrases.is_empty() {
            let is_phrase_only = doc_scores.is_empty() && expanded.is_empty();

            for phrase in &parsed.phrases {
                let phrase_docs = self.phrase_search(phrase);

                if is_phrase_only {
                    // Seed doc_scores with all phrase-matching documents.
                    for &doc_id in &phrase_docs {
                        doc_scores.entry(doc_id).or_insert(0.0);
                    }
                } else {
                    // Intersect: keep only documents that also match the phrase.
                    doc_scores.retain(|doc_id, _| phrase_docs.contains(doc_id));
                }

                // Score phrase constituent words via BM25F so documents get
                // proper ranking (rather than all having score 0.0).
                let stemmer_ref = super::stemmer::default_stemmer();
                let phrase_keywords: Vec<String> = word_regex()
                    .find_iter(phrase)
                    .map(|m| stemmer_ref.stem_word(&m.as_str().to_lowercase()))
                    .filter(|s| s.len() >= 2)
                    .collect();

                for term in &phrase_keywords {
                    if let Some(entries) = self.postings.get(term) {
                        let df = self.document_frequency(term);
                        let mut doc_ftfs: HashMap<DocId, FieldTermFreqs> = HashMap::new();
                        for entry in entries.value() {
                            if !doc_scores.contains_key(&entry.doc_id) {
                                continue;
                            }
                            let ftf = doc_ftfs
                                .entry(entry.doc_id)
                                .or_insert_with(FieldTermFreqs::new);
                            let field_len = self
                                .doc_field_lengths
                                .get(&entry.doc_id)
                                .and_then(|m| m.get(&entry.field))
                                .copied()
                                .unwrap_or(1);
                            ftf.add(entry.field, entry.tf, field_len);
                        }
                        for (doc_id, ftf) in &doc_ftfs {
                            let score = self.scorer.score_term(df, ftf);
                            *doc_scores.entry(*doc_id).or_insert(0.0) += score;
                            doc_matched_terms
                                .entry(*doc_id)
                                .or_default()
                                .push(term.clone());
                        }
                    }
                }
            }
        }

        // h. Apply field filters (name:, ext:, path:, content:, type:)
        for ff in &parsed.field_filters {
            let value_lower = ff.value.to_lowercase();
            match ff.field.as_str() {
                "name" => {
                    doc_scores.retain(|doc_id, _| {
                        self.documents
                            .get(doc_id)
                            .map(|d| d.filename.to_lowercase().contains(&value_lower))
                            .unwrap_or(false)
                    });
                }
                "ext" => {
                    doc_scores.retain(|doc_id, _| {
                        self.documents
                            .get(doc_id)
                            .map(|d| d.extension.to_lowercase() == value_lower)
                            .unwrap_or(false)
                    });
                }
                "path" => {
                    doc_scores.retain(|doc_id, _| {
                        self.documents
                            .get(doc_id)
                            .map(|d| d.path.to_lowercase().contains(&value_lower))
                            .unwrap_or(false)
                    });
                }
                "content" => {
                    let stemmed_val = stemmer.stem_word(&value_lower);
                    doc_scores.retain(|doc_id, _| {
                        self.doc_content
                            .get(doc_id)
                            .map(|c| c.contains(&value_lower) || c.contains(&stemmed_val))
                            .unwrap_or(false)
                    });
                }
                _ => {} // Unknown field filters are ignored.
            }
        }

        // i. Fuzzy search fallback: for terms with no exact hits, use FST
        let no_hit_terms: Vec<String> = expanded
            .iter()
            .filter(|t| !self.postings.contains_key(t.as_str()))
            .cloned()
            .collect();

        if !no_hit_terms.is_empty() {
            let fuzzy_matches = self.fst_index.fuzzy_search_multi(&no_hit_terms, 1);

            for (_query_word, matched_terms) in &fuzzy_matches {
                for (matched_term, _offset) in matched_terms {
                    if let Some(entries) = self.postings.get(matched_term) {
                        let df = self.document_frequency(matched_term);

                        let mut doc_ftfs: HashMap<DocId, FieldTermFreqs> = HashMap::new();
                        for entry in entries.value() {
                            let ftf = doc_ftfs
                                .entry(entry.doc_id)
                                .or_insert_with(FieldTermFreqs::new);
                            let field_len = self
                                .doc_field_lengths
                                .get(&entry.doc_id)
                                .and_then(|m| m.get(&entry.field))
                                .copied()
                                .unwrap_or(1);
                            ftf.add(entry.field, entry.tf, field_len);
                        }

                        for (doc_id, ftf) in &doc_ftfs {
                            // Fuzzy matches get a penalty (0.7x) to rank below exact matches
                            let score = self.scorer.score_term(df, ftf) * 0.7;
                            // j. Merge: take max score per document
                            let current = doc_scores.entry(*doc_id).or_insert(0.0);
                            if score > *current {
                                *current = score;
                            }
                            doc_matched_terms
                                .entry(*doc_id)
                                .or_default()
                                .push(matched_term.clone());
                        }
                    }
                }
            }
        }

        // k. Build RankingSignals and rerank
        let now_secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let query_lower = query.to_lowercase();
        let mut ranked: Vec<(String, f64, RankingSignals)> = doc_scores
            .iter()
            .filter_map(|(doc_id, &bm25f_score)| {
                let doc = self.documents.get(doc_id)?;
                let recency_days = if now_secs > doc.modified {
                    (now_secs - doc.modified) as f64 / 86400.0
                } else {
                    0.0
                };
                let depth = path_depth(&doc.path);
                let filename_match = doc.filename.to_lowercase().contains(&query_lower)
                    || stemmed
                        .iter()
                        .any(|kw| doc.filename.to_lowercase().contains(kw));
                let extension_match = parsed
                    .metadata
                    .file_type
                    .as_ref()
                    .map(|_ft| {
                        // If a file type filter was specified and this doc passed the
                        // bitmap filter, the extension matches.
                        true
                    })
                    .unwrap_or(false);

                let signals = RankingSignals {
                    bm25f_score,
                    recency_days,
                    path_depth: depth,
                    access_count: 0,
                    extension_match,
                    filename_match,
                };
                Some((doc.path.clone(), bm25f_score, signals))
            })
            .collect();

        self.reranker.rerank(&mut ranked);

        // l. Return top `limit` results as SearchResult
        ranked
            .into_iter()
            .take(limit)
            .map(|(path, score, _signals)| {
                let filename = Path::new(&path)
                    .file_name()
                    .map(|f| f.to_string_lossy().to_string())
                    .unwrap_or_default();

                let matches = doc_matched_terms
                    .get(&self.path_to_id.get(&path).copied().unwrap_or(u32::MAX))
                    .map(|terms| {
                        terms
                            .iter()
                            .take(5)
                            .map(|t| SearchMatch {
                                token: t.clone(),
                                context: String::new(),
                                line_number: None,
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                let snippet = self
                    .path_to_id
                    .get(&path)
                    .and_then(|id| self.doc_content.get(id))
                    .map(|c| {
                        let mut preview_len = c.len().min(200);
                        while preview_len > 0 && !c.is_char_boundary(preview_len) {
                            preview_len -= 1;
                        }
                        c[..preview_len].to_string()
                    });

                SearchResult {
                    path,
                    filename,
                    matches,
                    score,
                    relevance_type: "hybrid".to_string(),
                    snippet,
                }
            })
            .collect()
    }

    // -- 7. phrase_search() --------------------------------------------------

    /// Find documents where all words in `phrase` appear at consecutive
    /// positions in the positional index.
    ///
    /// Returns the set of doc_ids that contain the exact phrase.
    /// Falls back to substring matching on `doc_content` if the positional
    /// index has no data for any phrase term (graceful degradation).
    pub fn phrase_search(&self, phrase: &str) -> std::collections::HashSet<DocId> {
        let stemmer = super::stemmer::default_stemmer();
        let re = word_regex();

        // Stem the phrase words in order.
        let phrase_terms: Vec<String> = re
            .find_iter(phrase)
            .map(|m| stemmer.stem_word(&m.as_str().to_lowercase()))
            .filter(|s| s.len() >= 2)
            .collect();

        if phrase_terms.is_empty() {
            return std::collections::HashSet::new();
        }

        // Single-word "phrase" — just return docs containing that term.
        if phrase_terms.len() == 1 {
            return self
                .positions
                .get(&phrase_terms[0])
                .map(|docs| docs.keys().copied().collect())
                .unwrap_or_default();
        }

        // Get position lists for the first term.
        let first_positions = match self.positions.get(&phrase_terms[0]) {
            Some(doc_map) => doc_map,
            None => {
                // Positional data missing — fall back to substring matching.
                return self.phrase_search_fallback(phrase);
            }
        };

        // For each candidate doc from the first term, check if all
        // subsequent terms appear at the expected consecutive offsets.
        let mut result = std::collections::HashSet::new();

        'doc_loop: for (&doc_id, first_pos_list) in first_positions {
            // Check that all other phrase terms have positional data for
            // this document.
            let mut other_pos_lists: Vec<&Vec<u32>> = Vec::with_capacity(phrase_terms.len() - 1);
            for term in &phrase_terms[1..] {
                match self.positions.get(term).and_then(|m| m.get(&doc_id)) {
                    Some(pos_list) => other_pos_lists.push(pos_list),
                    None => continue 'doc_loop, // term missing from this doc
                }
            }

            // For each starting position of the first term, check whether
            // subsequent terms appear at pos+1, pos+2, ...
            for &start_pos in first_pos_list {
                let mut all_match = true;
                for (offset, other_list) in other_pos_lists.iter().enumerate() {
                    let expected = start_pos + (offset as u32) + 1;
                    if other_list.binary_search(&expected).is_err() {
                        all_match = false;
                        break;
                    }
                }
                if all_match {
                    result.insert(doc_id);
                    break; // found at least one occurrence in this doc
                }
            }
        }

        result
    }

    /// Fallback: phrase matching via substring search on stored content.
    /// Used when positional index data is unavailable for a term.
    fn phrase_search_fallback(&self, phrase: &str) -> std::collections::HashSet<DocId> {
        let phrase_lower = phrase.to_lowercase();
        self.doc_content
            .iter()
            .filter(|(_, content)| content.contains(&phrase_lower))
            .map(|(&doc_id, _)| doc_id)
            .collect()
    }

    // -- 8. suggest() ---------------------------------------------------------

    /// Autocomplete suggestions via FST prefix search.
    pub fn suggest(&self, partial: &str, limit: usize) -> Vec<String> {
        if partial.trim().is_empty() || limit == 0 {
            return Vec::new();
        }
        let stemmer = super::stemmer::default_stemmer();
        let stemmed = stemmer.stem_word(partial);
        self.fst_index.suggest(&stemmed, limit)
    }

    // -- 9. inject_ai_tokens() -----------------------------------------------

    /// Add AI-generated description tokens for a file with AiDescription field.
    ///
    /// The file must already be indexed. Tokenizes the description, adds
    /// postings under the AiDescription field, and updates field lengths.
    pub fn inject_ai_tokens(&mut self, path: &str, description: &str) {
        let doc_id = match self.path_to_id.get(path) {
            Some(&id) => id,
            None => return,
        };

        let ai_tokens = tokenize_and_stem(description);
        let ai_len: u32 = ai_tokens.values().sum();

        for (token, tf) in &ai_tokens {
            self.add_posting(token, doc_id, *tf, SearchField::AiDescription);
        }

        // Update field lengths
        if let Some(lengths) = self.doc_field_lengths.get_mut(&doc_id) {
            let existing = lengths.entry(SearchField::AiDescription).or_insert(0);
            *existing += ai_len;
        }

        self.total_tokens += ai_len as usize;
    }

    // -- 10. doc_count() -----------------------------------------------------

    /// Number of documents in the index.
    pub fn doc_count(&self) -> usize {
        self.documents.len()
    }

    // -- 11. term_count() ----------------------------------------------------

    /// Number of unique terms in the postings index.
    pub fn term_count(&self) -> usize {
        self.postings.len()
    }

    /// Alias for doc_count (compat layer uses this name).
    pub fn num_docs(&self) -> usize {
        self.documents.len()
    }

    /// Total tokens across all documents.
    pub fn total_tokens(&self) -> usize {
        self.total_tokens
    }

    /// Average document length across all fields.
    pub fn avg_doc_length(&self) -> f64 {
        if self.documents.is_empty() {
            return 0.0;
        }
        let total: u64 = self
            .doc_field_lengths
            .values()
            .flat_map(|fields| fields.values())
            .map(|&v| v as u64)
            .sum();
        total as f64 / self.documents.len() as f64
    }

    /// Get document info by path.
    pub fn get_document(&self, path: &str) -> Option<&DocumentInfo> {
        self.path_to_id
            .get(path)
            .and_then(|id| self.documents.get(id))
    }

    /// Iterate over all documents as (path, info) pairs.
    pub fn all_documents(&self) -> impl Iterator<Item = (&str, &DocumentInfo)> {
        self.documents.values().map(|doc| (doc.path.as_str(), doc))
    }

    /// Get last_updated timestamp (most recent document's modified time).
    pub fn last_updated(&self) -> u64 {
        self.documents
            .values()
            .map(|d| d.modified)
            .max()
            .unwrap_or(0)
    }

    /// Collect all terms that appear in postings for a given doc_id.
    pub fn terms_for_doc(&self, doc_id: DocId) -> std::collections::HashSet<String> {
        let mut terms = std::collections::HashSet::new();
        for r in self.postings.iter() {
            if r.value().iter().any(|e| e.doc_id == doc_id) {
                terms.insert(r.key().clone());
            }
        }
        terms
    }

    // -- 12. PRF helpers -------------------------------------------------------

    /// Public document frequency: number of unique docs containing `term`.
    pub fn doc_frequency(&self, term: &str) -> usize {
        self.document_frequency(term)
    }

    /// Extract the best expansion terms from the top-K result documents
    /// using a simplified TF-IDF weighting.
    ///
    /// For each term appearing in the given `doc_ids`, compute:
    ///   weight = tf_in_top_docs * log(N / df)
    /// where N = total docs, df = document frequency of the term.
    ///
    /// Returns the top `limit` terms sorted by weight, excluding any terms
    /// already in `exclude`.
    pub fn extract_expansion_terms(
        &self,
        doc_ids: &[DocId],
        exclude: &std::collections::HashSet<String>,
        limit: usize,
    ) -> Vec<(String, f64)> {
        if doc_ids.is_empty() || self.documents.is_empty() {
            return Vec::new();
        }

        let n = self.documents.len() as f64;
        let doc_id_set: std::collections::HashSet<DocId> = doc_ids.iter().copied().collect();

        // Accumulate term frequencies across the top docs.
        let mut term_tf: HashMap<String, u32> = HashMap::new();

        for r in self.postings.iter() {
            let term = r.key();
            let entries = r.value();
            if exclude.contains(term) {
                continue;
            }
            // Skip very short terms (likely noise).
            if term.len() < 3 {
                continue;
            }
            for entry in entries {
                if doc_id_set.contains(&entry.doc_id) {
                    *term_tf.entry(term.clone()).or_insert(0) += entry.tf;
                }
            }
        }

        // Score by TF-IDF: tf_in_top * log(N / df).
        let mut scored: Vec<(String, f64)> = term_tf
            .into_iter()
            .filter_map(|(term, tf)| {
                let df = self.document_frequency(&term);
                if df == 0 {
                    return None;
                }
                // Skip terms that are extremely common (appear in > 80% of docs).
                let doc_ratio = df as f64 / n;
                if doc_ratio > 0.8 {
                    return None;
                }
                let idf = (n / df as f64).ln();
                let weight = tf as f64 * idf;
                Some((term, weight))
            })
            .collect();

        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        scored.truncate(limit);
        scored
    }

    // -- Internal helpers ----------------------------------------------------

    /// Add a posting entry for a term.
    fn add_posting(&mut self, term: &str, doc_id: DocId, tf: u32, field: SearchField) {
        self.postings
            .entry(term.to_string())
            .or_default()
            .push(PostingEntry { doc_id, tf, field });
    }

    /// Compute document frequency for a term (number of unique documents
    /// containing it).
    fn document_frequency(&self, term: &str) -> usize {
        self.postings
            .get(term)
            .map(|entries| {
                let mut seen = std::collections::HashSet::new();
                for e in entries.value() {
                    seen.insert(e.doc_id);
                }
                seen.len()
            })
            .unwrap_or(0)
    }
}

impl Default for SearchIndex {
    fn default() -> Self {
        Self::new()
    }
}

/// Tokenize text into exact (unstemmed, lowercased) tokens with frequencies.
/// Used for FilenameExact field where we want precise matching.
fn tokenize_exact(text: &str) -> HashMap<String, u32> {
    let re = word_regex();
    let mut freq: HashMap<String, u32> = HashMap::new();

    for m in re.find_iter(text) {
        let word = m.as_str();
        let lower = word.to_lowercase();
        if lower.len() >= 2 {
            *freq.entry(lower.clone()).or_insert(0) += 1;
        }

        // CamelCase splitting
        let camel_parts = split_camel_case(word);
        if camel_parts.len() > 1 {
            for part in &camel_parts {
                let part_lower = part.to_lowercase();
                if part_lower.len() >= 2 && part_lower != lower {
                    *freq.entry(part_lower).or_insert(0) += 1;
                }
            }
        }

        // snake_case splitting
        if word.contains('_') {
            for part in word.split('_') {
                let part_lower = part.to_lowercase();
                if part_lower.len() >= 2 && part_lower != lower {
                    *freq.entry(part_lower).or_insert(0) += 1;
                }
            }
        }
    }

    freq
}

// ===== Tests ================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: build a small test index with a few documents.
    fn build_test_index() -> SearchIndex {
        let mut idx = SearchIndex::new();

        idx.index_document(
            "/home/user/projects/config.yaml",
            "database_host: localhost\nport: 5432\nmax_connections: 100",
            "text",
            256,
            1_700_000_000,
        );

        idx.index_document(
            "/home/user/docs/report.pdf",
            "This report covers the annual configuration of the server infrastructure and deployment pipeline.",
            "pdf_extract",
            102_400,
            1_699_900_000,
        );

        idx.index_document(
            "/home/user/code/main.rs",
            "fn main() { println!(\"running quickly\"); let config = load_config(); }",
            "text",
            512,
            1_700_100_000,
        );

        idx.index_document(
            "/home/user/tests/test_runner.py",
            "import unittest\nclass TestRunner(unittest.TestCase):\n    def test_basic(self): pass",
            "text",
            384,
            1_700_050_000,
        );

        idx.rebuild_fst();
        idx.update_scorer_stats();
        idx
    }

    // -- index_document + search finds the document --------------------------

    #[test]
    fn index_and_search_finds_document() {
        let idx = build_test_index();
        let results = idx.search("config", 10);
        assert!(
            !results.is_empty(),
            "search for 'config' should find at least one document"
        );
        // config.yaml should be among the results
        let paths: Vec<&str> = results.iter().map(|r| r.path.as_str()).collect();
        assert!(
            paths.contains(&"/home/user/projects/config.yaml"),
            "config.yaml should be in results, got: {:?}",
            paths
        );
    }

    // -- remove_document makes it unsearchable -------------------------------

    #[test]
    fn remove_document_makes_unsearchable() {
        let mut idx = build_test_index();

        // Verify the file is findable first (search by keyword, not filename
        // with dot — the tokenizer splits on dots)
        let results = idx.search("config yaml", 10);
        let has_config = results
            .iter()
            .any(|r| r.path == "/home/user/projects/config.yaml");
        assert!(has_config, "config.yaml should be found before removal");

        // Remove it
        idx.remove_document("/home/user/projects/config.yaml");
        idx.rebuild_fst();
        idx.update_scorer_stats();

        // Verify it is gone
        let results = idx.search("config yaml", 10);
        let has_config = results
            .iter()
            .any(|r| r.path == "/home/user/projects/config.yaml");
        assert!(!has_config, "config.yaml should NOT be found after removal");
    }

    // -- stemming: "running quickly" found by "run" --------------------------

    #[test]
    fn stemming_finds_related_forms() {
        let idx = build_test_index();
        // main.rs contains "running quickly"
        let results = idx.search("run", 10);
        let has_main = results.iter().any(|r| r.path == "/home/user/code/main.rs");
        assert!(
            has_main,
            "search for 'run' should find main.rs (contains 'running')"
        );
    }

    // -- filename boost: config.yaml ranks above report.pdf ------------------

    #[test]
    fn filename_boost_ranks_higher() {
        let idx = build_test_index();
        // Both config.yaml (filename match) and report.pdf (body match for "configuration")
        // should appear, but config.yaml should rank higher.
        let results = idx.search("config", 10);

        let config_pos = results
            .iter()
            .position(|r| r.path == "/home/user/projects/config.yaml");
        let report_pos = results
            .iter()
            .position(|r| r.path == "/home/user/docs/report.pdf");

        assert!(config_pos.is_some(), "config.yaml should be in results");
        // report.pdf may or may not appear (stemming of "configuration" -> "configur")
        // If both appear, config.yaml should rank first
        if let (Some(cp), Some(rp)) = (config_pos, report_pos) {
            assert!(
                cp < rp,
                "config.yaml (pos {}) should rank above report.pdf (pos {})",
                cp,
                rp
            );
        }
    }

    // -- negation: search "code -test" excludes test documents ---------------

    #[test]
    fn negation_excludes_documents() {
        let idx = build_test_index();
        // test_runner.py contains "test"
        let results = idx.search("code -test", 10);
        let has_test = results
            .iter()
            .any(|r| r.path == "/home/user/tests/test_runner.py");
        assert!(
            !has_test,
            "search 'code -test' should exclude test_runner.py"
        );
    }

    // -- suggest returns prefix matches --------------------------------------

    #[test]
    fn suggest_returns_prefix_matches() {
        let idx = build_test_index();
        let suggestions = idx.suggest("conf", 10);
        assert!(
            !suggestions.is_empty(),
            "suggest('conf') should return at least one result"
        );
        // All suggestions should start with the stemmed form of "conf"
        for s in &suggestions {
            assert!(
                s.starts_with("conf"),
                "suggestion '{}' should start with 'conf'",
                s
            );
        }
    }

    // -- doc_count and term_count accurate -----------------------------------

    #[test]
    fn doc_count_accurate() {
        let idx = build_test_index();
        assert_eq!(idx.doc_count(), 4, "should have 4 indexed documents");
    }

    #[test]
    fn term_count_accurate() {
        let idx = build_test_index();
        assert!(
            idx.term_count() > 0,
            "should have at least some terms indexed"
        );
    }

    // -- inject_ai_tokens makes document findable by description -------------

    #[test]
    fn inject_ai_tokens_makes_findable() {
        let mut idx = build_test_index();

        // Inject AI description for config.yaml
        idx.inject_ai_tokens(
            "/home/user/projects/config.yaml",
            "database connection settings PostgreSQL configuration file",
        );
        idx.rebuild_fst();
        idx.update_scorer_stats();

        let results = idx.search("PostgreSQL", 10);
        let has_config = results
            .iter()
            .any(|r| r.path == "/home/user/projects/config.yaml");
        assert!(
            has_config,
            "config.yaml should be findable by AI description term 'PostgreSQL'"
        );
    }

    // -- empty query returns empty results -----------------------------------

    #[test]
    fn empty_query_returns_empty() {
        let idx = build_test_index();
        let results = idx.search("", 10);
        assert!(results.is_empty(), "empty query should return no results");
    }

    // -- split_camel_case works correctly ------------------------------------

    #[test]
    fn test_split_camel_case() {
        assert_eq!(split_camel_case("HttpResponse"), vec!["Http", "Response"]);
        assert_eq!(split_camel_case("XMLParser"), vec!["XML", "Parser"]);
        assert_eq!(
            split_camel_case("getHTTPResponse"),
            vec!["get", "HTTP", "Response"]
        );
        assert_eq!(split_camel_case("hello"), vec!["hello"]);
        assert_eq!(split_camel_case("a"), vec!["a"]);
    }

    // -- tokenize_and_stem produces expected output --------------------------

    #[test]
    fn test_tokenize_and_stem() {
        let freq = tokenize_and_stem("running quickly documents");
        // "running" stems to "run"
        assert!(
            freq.contains_key("run"),
            "should contain stemmed 'run', got keys: {:?}",
            freq.keys().collect::<Vec<_>>()
        );
        // "documents" stems to "document"
        assert!(
            freq.contains_key("document"),
            "should contain stemmed 'document'"
        );
    }

    // -- re-indexing same path replaces old entry ----------------------------

    #[test]
    fn reindex_same_path_replaces() {
        let mut idx = SearchIndex::new();

        idx.index_document("/test/file.txt", "alpha beta gamma", "text", 100, 1000);
        assert_eq!(idx.doc_count(), 1);

        idx.index_document("/test/file.txt", "delta epsilon", "text", 200, 2000);
        assert_eq!(
            idx.doc_count(),
            1,
            "re-indexing the same path should not increase doc count"
        );

        idx.rebuild_fst();
        idx.update_scorer_stats();

        // Old content should not be searchable
        let results = idx.search("alpha", 10);
        assert!(
            results.is_empty(),
            "old content 'alpha' should not be found after re-index"
        );

        // New content should be searchable
        let results = idx.search("delta", 10);
        assert!(
            !results.is_empty(),
            "new content 'delta' should be found after re-index"
        );
    }

    // -- index preserves document info correctly ----------------------------

    #[test]
    fn document_info_correct() {
        let mut idx = SearchIndex::new();
        idx.index_document(
            "/home/user/photo.jpg",
            "vacation at the beach",
            "text",
            4096,
            1_700_000_000,
        );

        let doc_id = idx.path_to_id.get("/home/user/photo.jpg").unwrap();
        let doc = idx.documents.get(doc_id).unwrap();

        assert_eq!(doc.path, "/home/user/photo.jpg");
        assert_eq!(doc.filename, "photo.jpg");
        assert_eq!(doc.extension, "jpg");
        assert_eq!(doc.file_size, 4096);
        assert_eq!(doc.modified, 1_700_000_000);
        assert_eq!(doc.content_source, "text");
    }

    // ===== Phrase search tests =============================================

    /// Helper: build a test index with documents containing known phrases.
    fn build_phrase_test_index() -> SearchIndex {
        let mut idx = SearchIndex::new();

        idx.index_document(
            "/docs/report.txt",
            "the annual report covers server infrastructure and deployment pipeline",
            "text",
            256,
            1_700_000_000,
        );

        idx.index_document(
            "/docs/meeting.txt",
            "meeting notes about the deployment pipeline review and server maintenance",
            "text",
            256,
            1_700_000_000,
        );

        idx.index_document(
            "/docs/guide.txt",
            "server setup guide for new infrastructure deployment",
            "text",
            256,
            1_700_000_000,
        );

        idx.index_document(
            "/docs/unrelated.txt",
            "cooking recipes and gardening tips for summer vacation",
            "text",
            256,
            1_700_000_000,
        );

        idx.rebuild_fst();
        idx.update_scorer_stats();
        idx
    }

    #[test]
    fn phrase_search_finds_exact_consecutive_words() {
        let idx = build_phrase_test_index();
        // "deployment pipeline" appears consecutively in report.txt and meeting.txt
        let docs = idx.phrase_search("deployment pipeline");
        assert!(
            !docs.is_empty(),
            "phrase 'deployment pipeline' should find at least one document"
        );

        // guide.txt has "infrastructure deployment" not "deployment pipeline"
        let guide_id = idx.path_to_id.get("/docs/guide.txt").copied();
        if let Some(gid) = guide_id {
            assert!(
                !docs.contains(&gid),
                "guide.txt should NOT match 'deployment pipeline' (words are not consecutive)"
            );
        }
    }

    #[test]
    fn phrase_search_excludes_non_consecutive() {
        let idx = build_phrase_test_index();
        // "server pipeline" — these words exist in some docs but never consecutively
        let docs = idx.phrase_search("server pipeline");
        // In report.txt: "server infrastructure and deployment pipeline" — not consecutive
        // In meeting.txt: "deployment pipeline review and server" — not consecutive
        // In guide.txt: "server setup guide for new infrastructure deployment" — not consecutive
        assert!(
            docs.is_empty(),
            "phrase 'server pipeline' should find no documents (words never consecutive), found {} docs",
            docs.len()
        );
    }

    #[test]
    fn phrase_search_single_word_returns_all_containing_docs() {
        let idx = build_phrase_test_index();
        let docs = idx.phrase_search("server");
        // "server" appears in report.txt, meeting.txt, guide.txt
        assert!(
            docs.len() >= 2,
            "single-word phrase 'server' should match multiple docs, found {}",
            docs.len()
        );
    }

    #[test]
    fn phrase_search_empty_phrase_returns_empty() {
        let idx = build_phrase_test_index();
        let docs = idx.phrase_search("");
        assert!(docs.is_empty(), "empty phrase should return no results");
    }

    #[test]
    fn phrase_search_no_match_returns_empty() {
        let idx = build_phrase_test_index();
        let docs = idx.phrase_search("quantum entanglement");
        assert!(
            docs.is_empty(),
            "non-existent phrase should return no results"
        );
    }

    #[test]
    fn phrase_search_integrated_with_search() {
        let idx = build_phrase_test_index();
        // Search using quoted phrase syntax
        let results = idx.search(r#""deployment pipeline""#, 10);
        assert!(
            !results.is_empty(),
            "search with quoted phrase should find results"
        );

        // Verify unrelated.txt is NOT in results
        let has_unrelated = results.iter().any(|r| r.path == "/docs/unrelated.txt");
        assert!(
            !has_unrelated,
            "unrelated.txt should not match phrase 'deployment pipeline'"
        );
    }

    #[test]
    fn phrase_search_combined_with_keywords() {
        let idx = build_phrase_test_index();
        // Search: keyword + phrase
        let results = idx.search(r#"server "deployment pipeline""#, 10);
        // Both report.txt and meeting.txt have "server" and "deployment pipeline"
        assert!(
            !results.is_empty(),
            "combined keyword+phrase search should find results"
        );

        // guide.txt has "server" but NOT "deployment pipeline" consecutively
        let has_guide = results.iter().any(|r| r.path == "/docs/guide.txt");
        assert!(
            !has_guide,
            "guide.txt should not match because it lacks 'deployment pipeline' as a phrase"
        );
    }

    #[test]
    fn phrase_search_positions_cleaned_on_remove() {
        let mut idx = build_phrase_test_index();

        // Verify the phrase matches initially
        let docs_before = idx.phrase_search("deployment pipeline");
        assert!(!docs_before.is_empty(), "should find docs before removal");

        // Remove report.txt
        idx.remove_document("/docs/report.txt");

        // The report.txt doc_id should no longer be in results
        let report_id_gone = !idx.path_to_id.contains_key("/docs/report.txt");
        assert!(
            report_id_gone,
            "report.txt should be removed from path_to_id"
        );

        // Phrase search should still work for remaining docs
        let docs_after = idx.phrase_search("deployment pipeline");
        // meeting.txt still has "deployment pipeline"
        let meeting_id = idx.path_to_id.get("/docs/meeting.txt").copied();
        if let Some(mid) = meeting_id {
            assert!(
                docs_after.contains(&mid),
                "meeting.txt should still match after removing report.txt"
            );
        }
    }

    #[test]
    fn tokenize_with_positions_correct() {
        let (freq, positions) = tokenize_with_positions("alpha beta gamma alpha");
        // "alpha" appears at positions 0 and 3
        assert_eq!(freq.get("alpha"), Some(&2));
        let alpha_pos = positions.get("alpha").unwrap();
        assert_eq!(alpha_pos, &vec![0, 3]);

        // "beta" at position 1
        let beta_pos = positions.get("beta").unwrap();
        assert_eq!(beta_pos, &vec![1]);

        // "gamma" at position 2
        let gamma_pos = positions.get("gamma").unwrap();
        assert_eq!(gamma_pos, &vec![2]);
    }

    #[test]
    fn phrase_search_with_stemming() {
        let mut idx = SearchIndex::new();
        idx.index_document(
            "/docs/running.txt",
            "the dogs are running quickly through the park",
            "text",
            100,
            1_700_000_000,
        );
        idx.index_document(
            "/docs/walking.txt",
            "the dogs are walking quickly through the park",
            "text",
            100,
            1_700_000_000,
        );
        idx.rebuild_fst();
        idx.update_scorer_stats();

        // "running quickly" should only match running.txt
        // Stems: "running" -> "run", "quickly" -> "quick"
        let docs = idx.phrase_search("running quickly");
        let running_id = idx.path_to_id.get("/docs/running.txt").copied().unwrap();
        let walking_id = idx.path_to_id.get("/docs/walking.txt").copied().unwrap();

        assert!(
            docs.contains(&running_id),
            "running.txt should match 'running quickly'"
        );
        assert!(
            !docs.contains(&walking_id),
            "walking.txt should NOT match 'running quickly'"
        );
    }

    // ===== PRF / extract_expansion_terms tests =============================

    #[test]
    fn extract_expansion_terms_returns_terms() {
        let idx = build_test_index();

        // Get doc_ids for the first two documents.
        let doc_ids: Vec<DocId> = idx.path_to_id.values().copied().take(2).collect();

        let exclude = std::collections::HashSet::new();
        let expansion = idx.extract_expansion_terms(&doc_ids, &exclude, 5);

        assert!(
            !expansion.is_empty(),
            "extract_expansion_terms should return at least one term"
        );

        // All weights should be positive.
        for (term, weight) in &expansion {
            assert!(
                *weight > 0.0,
                "expansion term '{}' should have positive weight, got {}",
                term,
                weight
            );
        }
    }

    #[test]
    fn extract_expansion_terms_excludes_given_terms() {
        let idx = build_test_index();

        let doc_ids: Vec<DocId> = idx.path_to_id.values().copied().collect();

        // Exclude "config" (stemmed form: "config")
        let mut exclude = std::collections::HashSet::new();
        exclude.insert("config".to_string());

        let expansion = idx.extract_expansion_terms(&doc_ids, &exclude, 20);

        let has_config = expansion.iter().any(|(t, _)| t == "config");
        assert!(
            !has_config,
            "expansion should not contain excluded term 'config'"
        );
    }

    #[test]
    fn extract_expansion_terms_empty_doc_ids_returns_empty() {
        let idx = build_test_index();
        let exclude = std::collections::HashSet::new();
        let expansion = idx.extract_expansion_terms(&[], &exclude, 5);
        assert!(
            expansion.is_empty(),
            "empty doc_ids should return no expansion terms"
        );
    }

    #[test]
    fn extract_expansion_terms_respects_limit() {
        let idx = build_test_index();
        let doc_ids: Vec<DocId> = idx.path_to_id.values().copied().collect();
        let exclude = std::collections::HashSet::new();

        let expansion = idx.extract_expansion_terms(&doc_ids, &exclude, 3);
        assert!(
            expansion.len() <= 3,
            "expansion should respect limit of 3, got {}",
            expansion.len()
        );
    }

    #[test]
    fn extract_expansion_terms_sorted_by_weight() {
        let idx = build_test_index();
        let doc_ids: Vec<DocId> = idx.path_to_id.values().copied().collect();
        let exclude = std::collections::HashSet::new();

        let expansion = idx.extract_expansion_terms(&doc_ids, &exclude, 10);
        if expansion.len() >= 2 {
            for window in expansion.windows(2) {
                assert!(
                    window[0].1 >= window[1].1,
                    "expansion terms should be sorted descending by weight: {} ({}) >= {} ({})",
                    window[0].0,
                    window[0].1,
                    window[1].0,
                    window[1].1
                );
            }
        }
    }
}
