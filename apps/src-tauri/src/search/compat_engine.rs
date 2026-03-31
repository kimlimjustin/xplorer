// Xplorer Search Engine — Core Engine Implementation
//
// Contains the `SearchEngine` struct and its methods: indexing,
// searching, recommendations, PRF, context boost, watcher management.
// Type definitions live in `compat_types`, persistence in `compat_persistence`.

use rustc_hash::FxHashSet;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock, RwLock};
use std::thread;
use std::time::UNIX_EPOCH;

use jwalk::WalkDir;
use tracing::info;

use super::ai_pipeline::AIPipeline;
use super::index::SearchIndex;
use super::watcher::FileWatcher;
use super::SearchResult;

use super::compat_persistence::{file_meta, load_settings, save_settings};
use super::compat_types::{
    parsed_to_compat, CompatStructuredQuery, EnhancedSearchResult, FileToken, TokenizerSettings,
    TokenizerStats,
};

/// Timestamp helper.
use crate::utils::now_secs;

// ===== SearchEngine =========================================================

/// The main search engine wrapping `SearchIndex` + `FileWatcher`.
///
/// Provides the same public API the old `FileTokenizer` / `tokenizer.rs`
/// exposed so that all Tauri commands can delegate here.
///
/// NOTE: The `settings`, `watcher`, `indexed_dirs`, and `context_path` fields
/// use `std::sync::Mutex`. Switching to `parking_lot::Mutex` would eliminate
/// poisoning overhead and provide ~2x faster lock/unlock on uncontended paths.
/// However, `parking_lot` is not currently a dependency — add it to Cargo.toml
/// if this becomes a bottleneck.
pub struct SearchEngine {
    index: Arc<RwLock<SearchIndex>>,
    settings: Arc<Mutex<TokenizerSettings>>,
    watcher: Arc<Mutex<FileWatcher>>,
    is_indexing: Arc<AtomicBool>,
    /// Directories already indexed via `index_directory` (auto-index on navigation).
    indexed_dirs: Arc<Mutex<HashSet<String>>>,
    /// The user's current directory for context-aware ranking boost.
    context_path: Arc<Mutex<Option<String>>>,
}

impl SearchEngine {
    // -- 1. Construction -----------------------------------------------------

    /// Create a new `SearchEngine`, loading settings from disk.
    pub fn new() -> Self {
        let settings = load_settings();
        Self {
            index: Arc::new(RwLock::new(SearchIndex::new())),
            settings: Arc::new(Mutex::new(settings)),
            watcher: Arc::new(Mutex::new(FileWatcher::new())),
            is_indexing: Arc::new(AtomicBool::new(false)),
            indexed_dirs: Arc::new(Mutex::new(HashSet::new())),
            context_path: Arc::new(Mutex::new(None)),
        }
    }

    // -- 2. start() ----------------------------------------------------------

    /// Kick off background indexing and the filesystem watcher.
    ///
    /// Tries to load a cached index first. If available, performs incremental
    /// updates (only re-indexing new/modified files). Falls back to full rebuild
    /// if no cache exists or the cache is invalid.
    pub fn start(&self) {
        let settings = self.get_settings();
        if !settings.enabled || settings.whitelisted_paths.is_empty() {
            return;
        }

        // Only one indexing run at a time.
        if self
            .is_indexing
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return;
        }

        let index = Arc::clone(&self.index);
        let settings_arc = Arc::clone(&self.settings);
        let watcher = Arc::clone(&self.watcher);
        let is_indexing = Arc::clone(&self.is_indexing);

        thread::Builder::new()
            .name("search-engine-init".into())
            .spawn(move || {
                // Try loading cached index first.
                let loaded_cache = SearchIndex::load_from_disk();
                if let Some(cached_index) = loaded_cache {
                    {
                        let mut idx = match index.write() {
                            Ok(g) => g,
                            Err(e) => e.into_inner(),
                        };
                        *idx = cached_index;
                    }
                    // Do incremental update (add new files, remove stale ones).
                    Self::incremental_update_inner(&index, &settings_arc);
                } else {
                    // No cache or invalid — full rebuild.
                    Self::rebuild_full_index_inner(&index, &settings_arc);
                }

                // Save the index to disk after indexing.
                {
                    let idx = match index.read() {
                        Ok(g) => g,
                        Err(e) => e.into_inner(),
                    };
                    idx.save_to_disk();
                }

                is_indexing.store(false, Ordering::SeqCst);
                info!("[SearchEngine] Initial indexing complete");

                // --- Start file watcher ---
                Self::start_watcher_inner(&index, &settings_arc, &watcher);
            })
            .ok();
    }

    // -- 3. rebuild_full_index() ---------------------------------------------

    /// Trigger a full re-index from the current settings.
    pub fn rebuild_full_index(&self) {
        if self
            .is_indexing
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return;
        }

        let index = Arc::clone(&self.index);
        let settings_arc = Arc::clone(&self.settings);
        let is_indexing = Arc::clone(&self.is_indexing);

        thread::Builder::new()
            .name("search-engine-rebuild".into())
            .spawn(move || {
                Self::rebuild_full_index_inner(&index, &settings_arc);
                // Save to disk after a full rebuild.
                {
                    let idx = match index.read() {
                        Ok(g) => g,
                        Err(e) => e.into_inner(),
                    };
                    idx.save_to_disk();
                }
                is_indexing.store(false, Ordering::SeqCst);
                info!("[SearchEngine] Rebuild complete");
            })
            .ok();
    }

    // rebuild_full_index_inner, incremental_update_inner -> compat_watcher.rs

    // -- 4. search() ---------------------------------------------------------

    /// Run a keyword/fuzzy search and return results with context boost.
    pub fn search(&self, query: &str, limit: usize) -> Vec<SearchResult> {
        let idx = match self.index.read() {
            Ok(g) => g,
            Err(e) => e.into_inner(),
        };
        let mut results = idx.search(query, limit);
        drop(idx);
        self.apply_context_boost(&mut results);
        results
    }

    // -- 5. natural_language_search() ----------------------------------------

    /// Natural-language search with optional language hint and synonym
    /// expansion.
    pub fn natural_language_search(
        &self,
        query: &str,
        _language: Option<&str>,
        limit: usize,
    ) -> Vec<SearchResult> {
        let parsed = super::query_parser::parse(query);

        // Expand keywords with synonyms (FxHashSet for O(1) dedup).
        let mut seen: FxHashSet<String> = parsed.keywords.iter().cloned().collect();
        let mut expanded: Vec<String> = parsed.keywords.clone();
        for kw in &parsed.keywords {
            let related = super::synonyms::get_all_related(kw);
            for syn in related {
                let s = syn.to_string();
                if seen.insert(s.clone()) {
                    expanded.push(s);
                }
            }
        }

        // Build the expanded query string for the index search.
        let expanded_query = if expanded.is_empty() {
            query.to_string()
        } else {
            expanded.join(" ")
        };

        self.search(&expanded_query, limit)
    }

    // -- 6. enhanced_search() ------------------------------------------------

    /// Enhanced search: parse query, apply metadata filters, return results
    /// alongside the parsed query structure.
    pub fn enhanced_search(
        &self,
        query: &str,
        _language: Option<&str>,
        limit: usize,
    ) -> EnhancedSearchResult {
        let parsed = super::query_parser::parse(query);
        let compat = parsed_to_compat(&parsed);

        // Run text search using all keywords (original + synonym expansion).
        let mut seen: FxHashSet<String> = parsed.keywords.iter().cloned().collect();
        let mut all_keywords: Vec<String> = parsed.keywords.clone();
        for kw in &parsed.keywords {
            let related = super::synonyms::get_all_related(kw);
            for syn in related {
                let s = syn.to_string();
                if seen.insert(s.clone()) {
                    all_keywords.push(s);
                }
            }
        }

        let has_metadata = parsed.metadata.file_type.is_some()
            || parsed.metadata.size.is_some()
            || parsed.metadata.date.is_some()
            || !parsed.metadata.extensions.is_empty();

        let idx = match self.index.read() {
            Ok(g) => g,
            Err(e) => e.into_inner(),
        };

        let total_scanned = idx.num_docs();

        // -- Metadata-only path --
        let mut results = if all_keywords.is_empty() && has_metadata {
            self.metadata_only_search(&idx, &parsed, limit)
        } else {
            // -- Text search path --
            let search_str = if all_keywords.is_empty() {
                query.to_string()
            } else {
                all_keywords.join(" ")
            };

            let mut text_results = self.search(&search_str, limit * 2);

            // Post-filter results using metadata filters.
            if has_metadata {
                Self::apply_metadata_post_filter(&mut text_results, &parsed);
            }

            text_results
        };

        drop(idx);
        self.apply_context_boost(&mut results);
        results.truncate(limit);

        EnhancedSearchResult {
            results,
            parsed_query: compat,
            total_scanned,
        }
    }

    /// Metadata-only search path (all query words consumed by filters).
    fn metadata_only_search(
        &self,
        idx: &SearchIndex,
        parsed: &super::query_parser::ParsedQuery,
        limit: usize,
    ) -> Vec<SearchResult> {
        let bitmap = idx.bitmap_index.apply_filters(
            None,
            parsed.metadata.file_type,
            parsed.metadata.size.as_ref(),
            parsed.metadata.date.as_ref(),
            &parsed.metadata.extensions,
        );

        let sort_hint = parsed.metadata.sort_hint;
        let mut meta_results: Vec<(super::SearchResult, u64, u64)> = Vec::new();

        for (_path, doc) in idx.all_documents() {
            if bitmap.contains(doc.doc_id) {
                let filename = doc.filename.clone();
                meta_results.push((
                    super::SearchResult {
                        path: doc.path.clone(),
                        filename,
                        matches: vec![super::SearchMatch {
                            token: "metadata".to_string(),
                            context: "Metadata filter match".to_string(),
                            line_number: None,
                        }],
                        score: 1.0,
                        relevance_type: "metadata".to_string(),
                        snippet: None,
                    },
                    doc.file_size,
                    doc.modified,
                ));
            }
        }

        // If bitmap returned nothing, fall back to filesystem walk of context dir.
        if meta_results.is_empty() {
            if let Some(ctx_path) = self.get_context_path() {
                self.metadata_fs_fallback(&ctx_path, parsed, limit, &mut meta_results);
            }
        }

        // Sort by the detected dimension.
        use super::query_parser::SortHint;
        match sort_hint {
            SortHint::SizeDesc => meta_results.sort_by(|a, b| b.1.cmp(&a.1)),
            SortHint::SizeAsc => meta_results.sort_by(|a, b| a.1.cmp(&b.1)),
            SortHint::DateDesc => meta_results.sort_by(|a, b| b.2.cmp(&a.2)),
            SortHint::DateAsc => meta_results.sort_by(|a, b| a.2.cmp(&b.2)),
            SortHint::None => meta_results.sort_by(|a, b| b.1.cmp(&a.1)),
        }

        // Assign normalized scores (1.0 for first, decreasing).
        let len = meta_results.len().max(1) as f64;
        meta_results
            .into_iter()
            .enumerate()
            .map(|(i, (mut r, _size, _mod))| {
                r.score = 1.0 - (i as f64 / len);
                r
            })
            .collect::<Vec<_>>()
    }

    /// Filesystem fallback for metadata-only search when bitmap index is empty.
    fn metadata_fs_fallback(
        &self,
        ctx_path: &str,
        parsed: &super::query_parser::ParsedQuery,
        limit: usize,
        meta_results: &mut Vec<(super::SearchResult, u64, u64)>,
    ) {
        let root = Path::new(ctx_path);
        if !root.exists() || !root.is_dir() {
            return;
        }

        for entry in WalkDir::new(root)
            .sort(false)
            .max_depth(10)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let p = entry.path();
            if !p.is_file() {
                continue;
            }
            // File type filter
            if let Some(cat) = parsed.metadata.file_type {
                let matches_type = p
                    .extension()
                    .and_then(|e| e.to_str())
                    .and_then(super::classify_extension)
                    .map(|c| c == cat)
                    .unwrap_or(false);
                if !matches_type {
                    continue;
                }
            }
            // Extension filter
            if !parsed.metadata.extensions.is_empty() {
                let matches_ext = p
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| {
                        parsed
                            .metadata
                            .extensions
                            .iter()
                            .any(|x| x.eq_ignore_ascii_case(e))
                    })
                    .unwrap_or(false);
                if !matches_ext {
                    continue;
                }
            }
            let meta = match fs::metadata(&p) {
                Ok(m) => m,
                Err(_) => continue,
            };
            let file_size = meta.len();
            let modified = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            // Size filter
            if let Some(ref sf) = parsed.metadata.size {
                if let Some(min) = sf.min_bytes {
                    if file_size < min {
                        continue;
                    }
                }
                if let Some(max) = sf.max_bytes {
                    if file_size > max {
                        continue;
                    }
                }
            }
            // Date filter
            if let Some(ref df) = parsed.metadata.date {
                if let Some(after) = df.after {
                    if modified < after {
                        continue;
                    }
                }
                if let Some(before) = df.before {
                    if modified > before {
                        continue;
                    }
                }
            }
            let filename = p
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            meta_results.push((
                super::SearchResult {
                    path: p.to_string_lossy().to_string(),
                    filename,
                    matches: vec![super::SearchMatch {
                        token: "metadata".to_string(),
                        context: "Metadata filter match".to_string(),
                        line_number: None,
                    }],
                    score: 1.0,
                    relevance_type: "metadata".to_string(),
                    snippet: None,
                },
                file_size,
                modified,
            ));
            if meta_results.len() >= limit * 2 {
                break;
            }
        }
    }

    /// Apply metadata post-filters to text search results.
    fn apply_metadata_post_filter(
        results: &mut Vec<SearchResult>,
        parsed: &super::query_parser::ParsedQuery,
    ) {
        results.retain(|r| {
            let path = Path::new(&r.path);

            // File type filter.
            if let Some(cat) = parsed.metadata.file_type {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if let Some(actual_cat) = super::classify_extension(ext) {
                        if actual_cat != cat {
                            return false;
                        }
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            // Extension filter.
            if !parsed.metadata.extensions.is_empty() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if !parsed.metadata.extensions.contains(&ext.to_lowercase()) {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            // Size filter.
            if let Some(ref sf) = parsed.metadata.size {
                if let Ok(meta) = path.metadata() {
                    let size = meta.len();
                    if let Some(min) = sf.min_bytes {
                        if size < min {
                            return false;
                        }
                    }
                    if let Some(max) = sf.max_bytes {
                        if size > max {
                            return false;
                        }
                    }
                }
            }

            // Date filter.
            if let Some(ref df) = parsed.metadata.date {
                if let Ok(meta) = path.metadata() {
                    let modified = meta
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);
                    if let Some(after) = df.after {
                        if modified < after {
                            return false;
                        }
                    }
                    if let Some(before) = df.before {
                        if modified > before {
                            return false;
                        }
                    }
                }
            }

            true
        });
    }

    // -- 7. search_with_prf() ------------------------------------------------

    /// Search with Pseudo-Relevance Feedback (PRF / Rocchio-style).
    pub fn search_with_prf(
        &self,
        query: &str,
        limit: usize,
        prf_top_k: Option<usize>,
        prf_expansion_terms: Option<usize>,
    ) -> Vec<SearchResult> {
        let top_k = prf_top_k.unwrap_or(3);
        let num_expansion = prf_expansion_terms.unwrap_or(5);

        // Step 1: initial retrieval.
        let initial_results = self.search(query, limit);

        if initial_results.len() < 2 {
            return initial_results;
        }

        // Step 2: collect doc_ids of the top-K results.
        let idx = match self.index.read() {
            Ok(g) => g,
            Err(e) => e.into_inner(),
        };

        let top_doc_ids: Vec<super::DocId> = initial_results
            .iter()
            .take(top_k)
            .filter_map(|r| idx.get_document(&r.path).map(|d| d.doc_id))
            .collect();

        if top_doc_ids.is_empty() {
            return initial_results;
        }

        // Step 3: build the set of original query terms to exclude.
        let parsed = super::query_parser::parse(query);
        let stemmer = super::stemmer::default_stemmer();
        let original_terms: HashSet<String> = parsed
            .keywords
            .iter()
            .map(|kw| stemmer.stem_word(kw))
            .collect();

        // Step 4: extract expansion terms from the top results.
        let expansion = idx.extract_expansion_terms(&top_doc_ids, &original_terms, num_expansion);

        if expansion.is_empty() {
            return initial_results;
        }

        // Step 5: build expanded query string.
        let expansion_terms: Vec<String> = expansion.into_iter().map(|(term, _)| term).collect();
        let expanded_query = format!("{} {}", query, expansion_terms.join(" "));

        drop(idx);

        // Step 6: re-run search with expanded query.
        let expanded_results = self.search(&expanded_query, limit);

        // Step 7: merge — prefer expanded results but de-duplicate.
        let mut seen = HashSet::new();
        let mut merged: Vec<SearchResult> = Vec::with_capacity(limit);

        for result in expanded_results {
            if seen.insert(result.path.clone()) {
                merged.push(result);
            }
        }

        for result in initial_results {
            if seen.insert(result.path.clone()) {
                merged.push(result);
            }
        }

        merged.truncate(limit);
        merged
    }

    // -- 8. get_stats() ------------------------------------------------------

    /// Return lightweight index stats.
    pub fn get_stats(&self) -> Option<TokenizerStats> {
        let idx = match self.index.read() {
            Ok(g) => g,
            Err(e) => e.into_inner(),
        };

        Some(TokenizerStats {
            total_files: idx.num_docs(),
            total_tokens: idx.total_tokens(),
            last_updated: now_secs(),
            avg_doc_length: idx.avg_doc_length(),
        })
    }

    // -- 9. is_indexing() ----------------------------------------------------

    pub fn is_indexing(&self) -> bool {
        self.is_indexing.load(Ordering::SeqCst)
    }

    // -- 10. add_path() ------------------------------------------------------

    /// Add a path to the whitelist and trigger a background re-index.
    pub fn add_path(&self, path: String) {
        {
            let mut settings = self.settings.lock().unwrap_or_else(|e| e.into_inner());
            if !settings.whitelisted_paths.contains(&path) {
                settings.whitelisted_paths.push(path);
                save_settings(&settings);
            }
        }
        self.rebuild_full_index();
    }

    // -- 11. set_settings() / get_settings() ---------------------------------

    /// Replace settings, persist, and restart the watcher if paths changed.
    pub fn set_settings(&self, new_settings: TokenizerSettings) {
        let old_paths: Vec<String>;
        {
            let mut guard = self.settings.lock().unwrap_or_else(|e| e.into_inner());
            old_paths = guard.whitelisted_paths.clone();
            *guard = new_settings.clone();
        }
        save_settings(&new_settings);

        if old_paths != new_settings.whitelisted_paths {
            self.rebuild_full_index();
        }
    }

    pub fn get_settings(&self) -> TokenizerSettings {
        self.settings
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    // -- 12. get_file_tokens() -----------------------------------------------

    /// Return per-file token data for a specific file.
    pub fn get_file_tokens(&self, file_path: &str) -> Option<FileToken> {
        let idx = match self.index.read() {
            Ok(g) => g,
            Err(e) => e.into_inner(),
        };

        let doc_info = idx.get_document(file_path)?;
        let path = Path::new(file_path);

        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_string();

        Some(FileToken {
            path: file_path.to_string(),
            filename,
            extension,
            content_tokens: vec![],
            file_size: doc_info.file_size,
            last_modified: doc_info.modified,
            indexed_at: now_secs(),
            content_source: doc_info.content_source.clone(),
        })
    }

    // -- 13. get_file_recommendations() --------------------------------------

    /// Find files similar to the given file by keyword overlap.
    pub fn get_file_recommendations(&self, file_path: &str, limit: usize) -> Vec<SearchResult> {
        let idx = match self.index.read() {
            Ok(g) => g,
            Err(e) => e.into_inner(),
        };

        let current_doc = match idx.get_document(file_path) {
            Some(d) => d,
            None => return Vec::new(),
        };

        let current_doc_id = current_doc.doc_id;
        let current_tokens: HashSet<String> = idx.terms_for_doc(current_doc_id);
        if current_tokens.is_empty() {
            return Vec::new();
        }

        let mut scored: Vec<(String, f64)> = Vec::new();

        for (path, doc) in idx.all_documents() {
            if path == file_path {
                continue;
            }
            let other_tokens: HashSet<String> = idx.terms_for_doc(doc.doc_id);
            let intersection = current_tokens.intersection(&other_tokens).count();
            let union_size = current_tokens.len() + other_tokens.len() - intersection;
            let similarity = if union_size > 0 {
                intersection as f64 / union_size as f64
            } else {
                0.0
            };
            if similarity > 0.0 {
                scored.push((path.to_string(), similarity));
            }
        }

        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        scored.truncate(limit);

        scored
            .into_iter()
            .map(|(path, score)| {
                let filename = Path::new(&path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                SearchResult {
                    path,
                    filename,
                    matches: Vec::new(),
                    score,
                    relevance_type: "recommendation".to_string(),
                    snippet: None,
                }
            })
            .collect()
    }

    // -- 14. parse_search_query() --------------------------------------------

    /// Parse a query string into a `CompatStructuredQuery`.
    pub fn parse_search_query(
        &self,
        query: &str,
        _language: Option<&str>,
    ) -> CompatStructuredQuery {
        let parsed = super::query_parser::parse(query);
        parsed_to_compat(&parsed)
    }

    // -- 15. inject_ai_tokens() ----------------------------------------------

    /// Inject AI-generated descriptions and extracted text for a file.
    pub fn inject_ai_tokens(&self, path: &str, description: &str, extracted_text: &str) {
        let combined = format!("{} {}", description, extracted_text);
        let (size, modified) = file_meta(Path::new(path));

        let mut idx = match self.index.write() {
            Ok(g) => g,
            Err(e) => e.into_inner(),
        };
        idx.index_document(path, &combined, "ai_description", size, modified);
    }

    // -- 16. index_directory() -----------------------------------------------

    /// Index a single directory incrementally (no full rebuild).
    /// Skips directories already indexed. Used for auto-indexing on navigation.
    pub fn index_directory(&self, path: &str, max_depth: Option<u32>) {
        let path_str = path.to_string();

        // Check if already indexed.
        {
            let dirs = self.indexed_dirs.lock().unwrap_or_else(|e| e.into_inner());
            if dirs.contains(&path_str) {
                return;
            }
        }

        // Mark as indexed.
        {
            let mut dirs = self.indexed_dirs.lock().unwrap_or_else(|e| e.into_inner());
            dirs.insert(path_str.clone());
        }

        let index = Arc::clone(&self.index);
        let settings_arc = Arc::clone(&self.settings);
        let depth = max_depth.unwrap_or(1);

        thread::Builder::new()
            .name("search-index-dir".into())
            .spawn(move || {
                Self::index_directory_inner(&index, &settings_arc, &path_str, depth);
            })
            .ok();
    }

    // index_directory_inner -> compat_watcher.rs

    // -- 17. set_context_path() / get_context_path() -------------------------

    /// Set the user's current directory for context-aware ranking.
    pub fn set_context_path(&self, path: &str) {
        let mut ctx = self.context_path.lock().unwrap_or_else(|e| e.into_inner());
        *ctx = Some(path.to_string());
    }

    /// Get the current context path.
    pub fn get_context_path(&self) -> Option<String> {
        self.context_path
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    // -- 18. apply_context_boost() -------------------------------------------

    /// Apply context-path proximity boost to search results.
    fn apply_context_boost(&self, results: &mut [SearchResult]) {
        let ctx = self.get_context_path();
        let ctx_path = match ctx {
            Some(ref p) if !p.is_empty() => p,
            _ => return,
        };

        let ctx_normalized = ctx_path.replace('\\', "/").to_lowercase();

        for result in results.iter_mut() {
            let result_normalized = result.path.replace('\\', "/").to_lowercase();

            let result_parent = result_normalized
                .rsplit_once('/')
                .map(|x| x.0)
                .unwrap_or("");
            let ctx_trimmed = ctx_normalized.trim_end_matches('/');

            if result_parent == ctx_trimmed {
                result.score *= 1.3;
            } else if result_normalized.starts_with(&format!("{}/", ctx_trimmed)) {
                result.score *= 1.15;
            } else if ctx_trimmed.starts_with(&format!("{}/", result_parent)) {
                result.score *= 1.05;
            }
        }

        results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
    }

    // start_watcher_inner -> compat_watcher.rs
}

impl Default for SearchEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ===== Global singleton =====================================================

static GLOBAL_ENGINE: OnceLock<Arc<SearchEngine>> = OnceLock::new();

/// Return the global `SearchEngine` instance, lazily initialised.
pub fn get_search_engine() -> Arc<SearchEngine> {
    GLOBAL_ENGINE
        .get_or_init(|| {
            let engine = Arc::new(SearchEngine::new());
            engine.start();
            engine
        })
        .clone()
}

// ===== AI Pipeline singleton =================================================

static GLOBAL_AI_PIPELINE: OnceLock<Arc<AIPipeline>> = OnceLock::new();

pub(crate) fn get_ai_pipeline() -> Arc<AIPipeline> {
    GLOBAL_AI_PIPELINE
        .get_or_init(|| Arc::new(AIPipeline::new()))
        .clone()
}

// ===== Tests ================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a SearchEngine with a pre-populated index for testing.
    fn build_prf_test_engine() -> SearchEngine {
        let engine = SearchEngine::new();

        {
            let mut idx = engine.index.write().unwrap();

            idx.index_document(
                "/code/main.rs",
                "fn main() { let config = load_config(); println!(\"server started\"); }",
                "text",
                256,
                1_700_000_000,
            );

            idx.index_document(
                "/docs/server_config.md",
                "server configuration guide for deployment. Set the database host and port. Configure the logging level and server timeout.",
                "text",
                512,
                1_700_000_000,
            );

            idx.index_document(
                "/docs/database_setup.md",
                "database setup instructions. Install PostgreSQL server and configure the connection pool. Set max connections and timeout.",
                "text",
                512,
                1_700_000_000,
            );

            idx.index_document(
                "/docs/deploy.md",
                "deployment guide for production server. Configure load balancer, set up monitoring, and establish database connection.",
                "text",
                512,
                1_700_000_000,
            );

            idx.index_document(
                "/docs/recipes.txt",
                "chocolate cake recipe with butter flour sugar eggs vanilla extract baking powder",
                "text",
                256,
                1_700_000_000,
            );

            idx.rebuild_fst();
            idx.update_scorer_stats();
        }

        engine
    }

    #[test]
    fn search_with_prf_returns_results() {
        let engine = build_prf_test_engine();
        let results = engine.search_with_prf("server", 10, None, None);
        assert!(
            !results.is_empty(),
            "PRF search for 'server' should return results"
        );
    }

    #[test]
    fn search_with_prf_no_duplicates() {
        let engine = build_prf_test_engine();
        let results = engine.search_with_prf("server", 10, None, None);

        let mut seen_paths = HashSet::new();
        for r in &results {
            assert!(
                seen_paths.insert(r.path.clone()),
                "PRF search should not return duplicate paths, found duplicate: {}",
                r.path
            );
        }
    }

    #[test]
    fn search_with_prf_respects_limit() {
        let engine = build_prf_test_engine();
        let results = engine.search_with_prf("server", 2, None, None);
        assert!(
            results.len() <= 2,
            "PRF search should respect limit of 2, got {}",
            results.len()
        );
    }

    #[test]
    fn search_with_prf_excludes_unrelated() {
        let engine = build_prf_test_engine();
        let results = engine.search_with_prf("server", 10, None, None);

        let has_recipes = results.iter().any(|r| r.path == "/docs/recipes.txt");
        assert!(
            !has_recipes,
            "PRF search for 'server' should not surface the recipes document"
        );
    }

    #[test]
    fn search_with_prf_short_results_returns_asis() {
        let engine = build_prf_test_engine();
        let results = engine.search_with_prf("chocolate", 10, None, None);
        assert!(
            results.len() <= 10,
            "PRF should handle single-result gracefully"
        );
    }

    #[test]
    fn search_with_prf_custom_parameters() {
        let engine = build_prf_test_engine();
        let results = engine.search_with_prf("server", 10, Some(2), Some(3));
        assert!(
            !results.is_empty(),
            "PRF with custom parameters should return results"
        );
    }

    #[test]
    fn search_with_prf_empty_query_returns_empty() {
        let engine = build_prf_test_engine();
        let results = engine.search_with_prf("", 10, None, None);
        assert!(
            results.is_empty(),
            "PRF search with empty query should return no results"
        );
    }

    #[test]
    fn search_with_prf_can_find_related_through_expansion() {
        let engine = build_prf_test_engine();
        let prf_results = engine.search_with_prf("database", 10, None, None);
        let plain_results = engine.search("database", 10);

        assert!(
            prf_results.len() >= plain_results.len(),
            "PRF should return at least as many results as plain search: prf={} vs plain={}",
            prf_results.len(),
            plain_results.len()
        );
    }
}
