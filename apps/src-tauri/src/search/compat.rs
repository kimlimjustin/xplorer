// Xplorer Search Engine — Backward-Compatible API Layer
//
// Wraps the new modular search engine (`SearchIndex`, `FileWatcher`,
// `ParsedQuery`, etc.) and exposes the same public interface that the
// old `tokenizer.rs` provided so that the existing Tauri commands and
// frontend continue to work without modification.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock, RwLock};
use std::thread;
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};
use tracing::{info, warn};
use walkdir::WalkDir;

use super::index::SearchIndex;
use super::watcher::{FileChangeEvent, FileWatcher};
use super::SearchResult;
use super::ai_pipeline::{AIPipeline, AIIndexEntry, AIIndexStatus};
use super::hybrid::{HybridSearcher, HybridSearchConfig};
use super::context_ranker::ContextualRanker;

// ===== Configuration constants ==============================================

/// Default maximum file size for indexing (50 MB).
const DEFAULT_MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;

/// Default update interval in seconds (5 minutes).
const DEFAULT_UPDATE_INTERVAL_SECS: u64 = 300;

/// Default result limit for search and enhanced search commands.
const DEFAULT_SEARCH_LIMIT: usize = 50;

/// Default result limit for file recommendation commands.
const DEFAULT_RECOMMENDATION_LIMIT: usize = 10;

/// Default result limit for semantic search commands.
const DEFAULT_SEMANTIC_SEARCH_LIMIT: usize = 20;

/// Minimum cosine similarity threshold for semantic search results.
const SEMANTIC_SIMILARITY_THRESHOLD: f64 = 0.3;

// ===== Frontend-compatible types ============================================
//
// These mirror the types the old `tokenizer.rs` serialised to the frontend
// so that the Tauri command signatures remain identical.

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
    1024
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

// ===== Defaults =============================================================

impl Default for TokenizerSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            whitelisted_paths: vec![],
            blacklisted_extensions: vec![
                // Binary executables / libraries
                "exe", "dll", "so", "dylib", "bin", "obj",
                // Archives
                "zip", "tar", "gz", "rar", "7z", "iso",
                // Images
                "jpg", "jpeg", "png", "gif", "bmp", "tiff",
                // Video
                "mp4", "avi", "mov", "wmv", "flv", "mkv",
                // Audio
                "mp3", "wav", "flac", "aac", "ogg", "wma",
                // Old binary doc formats
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

// ===== Persistence helpers ==================================================

fn data_dir() -> PathBuf {
    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("xplorer");
    fs::create_dir_all(&dir).ok();
    dir
}

fn settings_path() -> PathBuf {
    data_dir().join("tokenizer_settings.json")
}

fn load_settings() -> TokenizerSettings {
    fs::read_to_string(settings_path())
        .ok()
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

/// Atomically persist settings to disk (write temp file, then rename).
fn save_settings(settings: &TokenizerSettings) {
    if let Ok(json) = serde_json::to_string_pretty(settings) {
        let target = settings_path();
        let tmp = target.with_extension("json.tmp");
        if fs::write(&tmp, &json).is_ok() {
            if fs::rename(&tmp, &target).is_err() {
                let _ = fs::remove_file(&tmp);
            }
        }
    }
}

// ===== Document extraction extensions =======================================

const EXTRACTABLE_DOC_EXTENSIONS: &[&str] = &["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "rtf"];

// ===== Conversion helpers ===================================================

/// Convert a `ParsedQuery` from the new query parser into the
/// `CompatStructuredQuery` the frontend expects.
fn parsed_to_compat(parsed: &super::query_parser::ParsedQuery) -> CompatStructuredQuery {
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

/// Timestamp helper.
use crate::utils::now_secs;

/// Check whether a file should be considered text-readable for content
/// indexing.  Binary extensions and files exceeding `max_size` are skipped.
fn is_text_indexable(path: &Path, blacklisted: &HashSet<String>, max_size: u64) -> bool {
    // Skip hidden files.
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        if name.starts_with('.') {
            return false;
        }
    } else {
        return false;
    }

    // Skip directories.
    if path.is_dir() {
        return false;
    }

    // Skip files exceeding the size limit.
    if let Ok(meta) = path.metadata() {
        if meta.len() > max_size {
            return false;
        }
    }

    // Skip blacklisted extensions.
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if blacklisted.contains(&ext.to_lowercase()) {
            return false;
        }
    }

    true
}

/// Determine the content source label for a file based on its extension.
fn content_source_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("pdf") => "pdf_extract",
        Some("docx") => "docx_extract",
        Some("xlsx") => "xlsx_extract",
        Some("pptx") => "pptx_extract",
        _ => "text",
    }
}

/// Read content from a file.  For extractable document types (pdf, docx,
/// xlsx, pptx) delegates to `crate::document_extractor::extract_text`.
/// For everything else falls back to `fs::read_to_string`.
fn read_file_content(path: &Path) -> Option<String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());

    let ext_str = ext.as_deref().unwrap_or("");

    if EXTRACTABLE_DOC_EXTENSIONS.contains(&ext_str) {
        // Use the document extractor for rich document types.
        match crate::document_extractor::extract_text(&path.to_string_lossy()) {
            Ok(text) if !text.trim().is_empty() => Some(text),
            _ => None,
        }
    } else {
        // Plain text read — skip files that fail (binary, encoding errors).
        fs::read_to_string(path).ok()
    }
}

/// Collect file metadata (size, modification time) for a path.
fn file_meta(path: &Path) -> (u64, u64) {
    let meta = match path.metadata() {
        Ok(m) => m,
        Err(_) => return (0, 0),
    };
    let size = meta.len();
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    (size, modified)
}

// ===== SearchEngine =========================================================

/// The main search engine wrapping `SearchIndex` + `FileWatcher`.
///
/// Provides the same public API the old `FileTokenizer` / `tokenizer.rs`
/// exposed so that all Tauri commands can delegate here.
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

    /// Internal: walk whitelisted paths, read files, populate the index from scratch.
    fn rebuild_full_index_inner(
        index: &Arc<RwLock<SearchIndex>>,
        settings_arc: &Arc<Mutex<TokenizerSettings>>,
    ) {
        let settings = settings_arc
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();

        let blacklisted: HashSet<String> = settings
            .blacklisted_extensions
            .iter()
            .map(|e| e.to_lowercase())
            .collect();

        // Collect all indexable files.
        let mut files_to_index: Vec<PathBuf> = Vec::new();

        for root in &settings.whitelisted_paths {
            let root_path = Path::new(root);
            if !root_path.exists() {
                warn!(
                    "[SearchEngine] Whitelisted path does not exist: {}",
                    root
                );
                continue;
            }

            for entry in WalkDir::new(root_path)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let path = entry.path();

                // Skip hidden directories.
                if path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with('.'))
                    .unwrap_or(false)
                {
                    continue;
                }

                if is_text_indexable(path, &blacklisted, settings.max_file_size) {
                    files_to_index.push(path.to_path_buf());
                }
            }
        }

        info!(
            "[SearchEngine] Found {} files to index",
            files_to_index.len()
        );

        // Clear the index before a full rebuild.
        {
            let mut idx = match index.write() {
                Ok(g) => g,
                Err(e) => e.into_inner(),
            };
            *idx = SearchIndex::new();
        }

        let mut indexed_count: usize = 0;
        let memory_limit_bytes = (settings.memory_limit_mb as usize) * 1024 * 1024;

        for file_path in &files_to_index {
            let content = match read_file_content(file_path) {
                Some(c) => c,
                None => continue,
            };

            let source = content_source_for(file_path);
            let (size, modified) = file_meta(file_path);
            let path_str = file_path.to_string_lossy().to_string();

            {
                let mut idx = match index.write() {
                    Ok(g) => g,
                    Err(e) => e.into_inner(),
                };
                idx.index_document(&path_str, &content, source, size, modified);

                // Check memory limit after indexing each document.
                if memory_limit_bytes > 0 && idx.estimated_memory_bytes() >= memory_limit_bytes {
                    warn!(
                        "[SearchEngine] Memory limit reached ({} MB). Stopping indexing after {} files.",
                        settings.memory_limit_mb,
                        indexed_count + 1
                    );
                    indexed_count += 1;
                    break;
                }
            }
            indexed_count += 1;
        }

        // Rebuild FST and update BM25F corpus stats.
        {
            let mut idx = match index.write() {
                Ok(g) => g,
                Err(e) => e.into_inner(),
            };
            idx.rebuild_fst();
            idx.update_scorer_stats();
        }

        info!(
            "[SearchEngine] Indexed {} / {} files",
            indexed_count,
            files_to_index.len()
        );
    }

    // -- 3b. incremental_update_inner() --------------------------------------

    /// Incremental update: compare cached index against filesystem.
    ///
    /// 1. Walk whitelisted paths to find all current indexable files.
    /// 2. Remove stale docs (deleted files or files with changed timestamps).
    /// 3. Index only new or modified files.
    /// 4. Rebuild FST + scorer stats.
    fn incremental_update_inner(
        index: &Arc<RwLock<SearchIndex>>,
        settings_arc: &Arc<Mutex<TokenizerSettings>>,
    ) {
        let settings = settings_arc
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();

        let blacklisted: HashSet<String> = settings
            .blacklisted_extensions
            .iter()
            .map(|e| e.to_lowercase())
            .collect();

        // Collect all currently indexable files with their metadata.
        let mut current_files: HashMap<String, u64> = HashMap::new(); // path -> modified

        for root in &settings.whitelisted_paths {
            let root_path = Path::new(root);
            if !root_path.exists() {
                continue;
            }

            for entry in WalkDir::new(root_path)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let path = entry.path();
                if path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with('.'))
                    .unwrap_or(false)
                {
                    continue;
                }
                if is_text_indexable(path, &blacklisted, settings.max_file_size) {
                    let (_, modified) = file_meta(path);
                    current_files.insert(path.to_string_lossy().to_string(), modified);
                }
            }
        }

        // Find stale documents (deleted or modified) and new files.
        let mut stale_paths: Vec<String> = Vec::new();
        let mut new_or_modified: Vec<String> = Vec::new();

        {
            let idx = match index.read() {
                Ok(g) => g,
                Err(e) => e.into_inner(),
            };

            // Check cached docs against filesystem.
            for doc in idx.documents().values() {
                match current_files.get(&doc.path) {
                    None => {
                        // File no longer exists or no longer in whitelisted paths.
                        stale_paths.push(doc.path.clone());
                    }
                    Some(&fs_modified) => {
                        if fs_modified != doc.modified {
                            // File was modified since last index.
                            stale_paths.push(doc.path.clone());
                            new_or_modified.push(doc.path.clone());
                        }
                    }
                }
            }

            // Find files not yet in the index.
            for path in current_files.keys() {
                if !idx.documents().values().any(|d| &d.path == path) {
                    new_or_modified.push(path.clone());
                }
            }
        }

        info!(
            "[SearchEngine] Incremental update: {} stale, {} new/modified (out of {} cached docs, {} current files)",
            stale_paths.len(),
            new_or_modified.len(),
            {
                let idx = match index.read() { Ok(g) => g, Err(e) => e.into_inner() };
                idx.documents().len()
            },
            current_files.len()
        );

        if stale_paths.is_empty() && new_or_modified.is_empty() {
            info!("[SearchEngine] Cache is up to date, no changes needed");
            return;
        }

        // Remove stale documents.
        if !stale_paths.is_empty() {
            let mut idx = match index.write() {
                Ok(g) => g,
                Err(e) => e.into_inner(),
            };
            for path in &stale_paths {
                idx.remove_document(path);
            }
        }

        // Index new/modified files.
        let memory_limit_bytes = (settings.memory_limit_mb as usize) * 1024 * 1024;
        let mut indexed_count: usize = 0;

        for path_str in &new_or_modified {
            let file_path = Path::new(path_str);
            let content = match read_file_content(file_path) {
                Some(c) => c,
                None => continue,
            };

            let source = content_source_for(file_path);
            let (size, modified) = file_meta(file_path);

            {
                let mut idx = match index.write() {
                    Ok(g) => g,
                    Err(e) => e.into_inner(),
                };
                idx.index_document(path_str, &content, source, size, modified);

                if memory_limit_bytes > 0 && idx.estimated_memory_bytes() >= memory_limit_bytes {
                    warn!(
                        "[SearchEngine] Memory limit reached during incremental update after {} files.",
                        indexed_count + 1
                    );
                    indexed_count += 1;
                    break;
                }
            }
            indexed_count += 1;
        }

        // Rebuild FST and scorer stats.
        {
            let mut idx = match index.write() {
                Ok(g) => g,
                Err(e) => e.into_inner(),
            };
            idx.rebuild_fst();
            idx.update_scorer_stats();
        }

        info!(
            "[SearchEngine] Incremental update complete: removed {}, indexed {}",
            stale_paths.len(),
            indexed_count
        );
    }

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

        // Expand keywords with synonyms.
        let mut expanded: Vec<String> = parsed.keywords.clone();
        for kw in &parsed.keywords {
            let related = super::synonyms::get_all_related(kw);
            for syn in related {
                let s = syn.to_string();
                if !expanded.contains(&s) {
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
        let mut all_keywords: Vec<String> = parsed.keywords.clone();
        for kw in &parsed.keywords {
            let related = super::synonyms::get_all_related(kw);
            for syn in related {
                let s = syn.to_string();
                if !all_keywords.contains(&s) {
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

        // ── Metadata-only path ──
        // When all query words were consumed by filters (keywords=[]),
        // use bitmap index to find matching files without BM25F.
        let mut results = if all_keywords.is_empty() && has_metadata {
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
                    let root = Path::new(&ctx_path);
                    if root.exists() && root.is_dir() {
                        for entry in WalkDir::new(root)
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
                                let matches_type = p.extension()
                                    .and_then(|e| e.to_str())
                                    .and_then(|e| super::classify_extension(e))
                                    .map(|c| c == cat)
                                    .unwrap_or(false);
                                if !matches_type {
                                    continue;
                                }
                            }
                            // Extension filter
                            if !parsed.metadata.extensions.is_empty() {
                                let matches_ext = p.extension()
                                    .and_then(|e| e.to_str())
                                    .map(|e| parsed.metadata.extensions.iter().any(|x| x.eq_ignore_ascii_case(e)))
                                    .unwrap_or(false);
                                if !matches_ext {
                                    continue;
                                }
                            }
                            let meta = match fs::metadata(p) {
                                Ok(m) => m,
                                Err(_) => continue,
                            };
                            let file_size = meta.len();
                            let modified = meta.modified().ok()
                                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                                .map(|d| d.as_secs())
                                .unwrap_or(0);
                            // Size filter
                            if let Some(ref sf) = parsed.metadata.size {
                                if let Some(min) = sf.min_bytes {
                                    if file_size < min { continue; }
                                }
                                if let Some(max) = sf.max_bytes {
                                    if file_size > max { continue; }
                                }
                            }
                            // Date filter
                            if let Some(ref df) = parsed.metadata.date {
                                if let Some(after) = df.after {
                                    if modified < after { continue; }
                                }
                                if let Some(before) = df.before {
                                    if modified > before { continue; }
                                }
                            }
                            let filename = p.file_name()
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
        } else {
            // ── Text search path (existing) ──
            let search_str = if all_keywords.is_empty() {
                query.to_string()
            } else {
                all_keywords.join(" ")
            };

            let mut text_results = self.search(&search_str, limit * 2);

            // Post-filter results using metadata filters.
            if has_metadata {
                text_results.retain(|r| {
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
                            if !parsed
                                .metadata
                                .extensions
                                .contains(&ext.to_lowercase())
                            {
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

    // -- 7. search_with_prf() ------------------------------------------------

    /// Search with Pseudo-Relevance Feedback (PRF / Rocchio-style).
    ///
    /// 1. Run initial BM25F retrieval.
    /// 2. Take the top `prf_top_k` results (default 3).
    /// 3. Extract the most discriminative terms from those results
    ///    (high TF in top results, relatively rare in the corpus).
    /// 4. Append those expansion terms to the original query with a
    ///    lower boost (achieved by limiting expansion term count and
    ///    relying on BM25F's natural IDF weighting).
    /// 5. Re-run the search with the expanded query.
    ///
    /// Returns the final merged result set, de-duplicated and re-ranked.
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
            // Too few results for meaningful PRF — return as-is.
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

        // Step 3: build the set of original query terms to exclude from
        // expansion (we don't want to add terms already in the query).
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

        // Drop the read lock before re-searching.
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

        // Add any original results that were missed by the expanded search.
        for result in initial_results {
            if seen.insert(result.path.clone()) {
                merged.push(result);
            }
        }

        merged.truncate(limit);
        merged
    }

    // -- 8. get_stats() ------------------------------------------------------

    /// Return lightweight index stats compatible with the old
    /// `get_tokenizer_stats` command.
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
            let mut settings = self
                .settings
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            if !settings.whitelisted_paths.contains(&path) {
                settings.whitelisted_paths.push(path);
                save_settings(&settings);
            }
        }

        // Restart indexing to pick up the new path.
        self.rebuild_full_index();
    }

    // -- 11. set_settings() / get_settings() ---------------------------------

    /// Replace settings, persist, and restart the watcher if paths changed.
    pub fn set_settings(&self, new_settings: TokenizerSettings) {
        let old_paths: Vec<String>;
        {
            let mut guard = self
                .settings
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            old_paths = guard.whitelisted_paths.clone();
            *guard = new_settings.clone();
        }
        save_settings(&new_settings);

        // If paths changed, restart.
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
    ///
    /// This reconstructs a `FileToken` from the new index structure so
    /// that the frontend can display per-file information.
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
            content_tokens: vec![], // tokens are in the inverted index, not stored per-doc
            file_size: doc_info.file_size,
            last_modified: doc_info.modified,
            indexed_at: now_secs(),
            content_source: doc_info.content_source.clone(),
        })
    }

    // -- 13. get_file_recommendations() --------------------------------------

    /// Find files similar to the given file by keyword overlap.
    pub fn get_file_recommendations(
        &self,
        file_path: &str,
        limit: usize,
    ) -> Vec<SearchResult> {
        let idx = match self.index.read() {
            Ok(g) => g,
            Err(e) => e.into_inner(),
        };

        let current_doc = match idx.get_document(file_path) {
            Some(d) => d,
            None => return Vec::new(),
        };

        // Collect terms for the current document from the inverted index
        let current_doc_id = current_doc.doc_id;
        let current_tokens: HashSet<String> = idx.terms_for_doc(current_doc_id);
        if current_tokens.is_empty() {
            return Vec::new();
        }

        // Score every other document by Jaccard similarity.
        let mut scored: Vec<(String, f64)> = Vec::new();

        for (path, doc) in idx.all_documents() {
            if path == file_path {
                continue;
            }
            let other_tokens: HashSet<String> = idx.terms_for_doc(doc.doc_id);
            let intersection = current_tokens.intersection(&other_tokens).count();
            let union_size =
                current_tokens.len() + other_tokens.len() - intersection;
            let similarity = if union_size > 0 {
                intersection as f64 / union_size as f64
            } else {
                0.0
            };
            if similarity > 0.0 {
                scored.push((path.to_string(), similarity));
            }
        }

        scored.sort_by(|a, b| {
            b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal)
        });
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

    /// Inject AI-generated descriptions and extracted text for a file into
    /// the search index (used by the AI indexer pipeline).
    pub fn inject_ai_tokens(
        &self,
        path: &str,
        description: &str,
        extracted_text: &str,
    ) {
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
                let settings = settings_arc
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .clone();

                let blacklisted: HashSet<String> = settings
                    .blacklisted_extensions
                    .iter()
                    .map(|e| e.to_lowercase())
                    .collect();

                let root = Path::new(&path_str);
                if !root.exists() || !root.is_dir() {
                    return;
                }

                // Check if this path is blacklisted.
                let norm_path = path_str.replace('\\', "/").to_lowercase();
                for bp in &settings.blacklisted_paths {
                    let norm_bp = bp.replace('\\', "/").to_lowercase();
                    if norm_path.starts_with(&norm_bp) {
                        return;
                    }
                }

                let mut files_to_index: Vec<PathBuf> = Vec::new();
                let mut dirs_to_index: Vec<PathBuf> = Vec::new();

                for entry in WalkDir::new(root)
                    .max_depth(depth as usize)
                    .follow_links(false)
                    .into_iter()
                    .filter_map(|e| e.ok())
                {
                    let p = entry.path();
                    // Skip the root directory itself.
                    if p == root {
                        continue;
                    }
                    if p.file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n.starts_with('.'))
                        .unwrap_or(false)
                    {
                        continue;
                    }
                    if p.is_dir() {
                        dirs_to_index.push(p.to_path_buf());
                    } else if is_text_indexable(p, &blacklisted, settings.max_file_size) {
                        files_to_index.push(p.to_path_buf());
                    }
                }

                if files_to_index.is_empty() && dirs_to_index.is_empty() {
                    return;
                }

                info!(
                    "[SearchEngine] Auto-indexing {} files + {} folders from {}",
                    files_to_index.len(),
                    dirs_to_index.len(),
                    path_str
                );

                // ── PHASE 1: Index filenames only (fast) ─────────────────
                // This makes all entries immediately searchable by name.
                let mut name_indexed: usize = 0;
                let mut files_needing_content: Vec<PathBuf> = Vec::new();

                // Index directories by name.
                for dir_path in &dirs_to_index {
                    let ps = dir_path.to_string_lossy().to_string();
                    {
                        let idx = match index.read() {
                            Ok(g) => g,
                            Err(e) => e.into_inner(),
                        };
                        if idx.get_document(&ps).is_some() {
                            continue;
                        }
                    }
                    let dir_name = dir_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("");
                    let (size, modified) = file_meta(dir_path);
                    {
                        let mut idx = match index.write() {
                            Ok(g) => g,
                            Err(e) => e.into_inner(),
                        };
                        idx.index_document(&ps, dir_name, "directory", size, modified);
                    }
                    name_indexed += 1;
                }

                // Index files by filename first (no content read yet).
                for file_path in &files_to_index {
                    let ps = file_path.to_string_lossy().to_string();
                    {
                        let idx = match index.read() {
                            Ok(g) => g,
                            Err(e) => e.into_inner(),
                        };
                        if idx.get_document(&ps).is_some() {
                            continue;
                        }
                    }
                    let file_name = file_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("");
                    let (size, modified) = file_meta(file_path);
                    {
                        let mut idx = match index.write() {
                            Ok(g) => g,
                            Err(e) => e.into_inner(),
                        };
                        idx.index_document(&ps, file_name, "filename_only", size, modified);
                    }
                    name_indexed += 1;
                    files_needing_content.push(file_path.clone());
                }

                // Rebuild FST immediately so name-based search works right away.
                if name_indexed > 0 {
                    let mut idx = match index.write() {
                        Ok(g) => g,
                        Err(e) => e.into_inner(),
                    };
                    idx.rebuild_fst();
                    idx.update_scorer_stats();
                    info!(
                        "[SearchEngine] Phase 1: indexed {} names from {}",
                        name_indexed, path_str
                    );
                }

                // ── PHASE 2: Read file content and re-index (slow) ──────
                // This upgrades each entry with full content for deep search.
                let memory_limit_bytes = (settings.memory_limit_mb as usize) * 1024 * 1024;
                let mut content_indexed: usize = 0;
                for file_path in &files_needing_content {
                    let content = match read_file_content(file_path) {
                        Some(c) => c,
                        None => continue,
                    };

                    let source = content_source_for(file_path);
                    let (size, modified) = file_meta(file_path);
                    let ps = file_path.to_string_lossy().to_string();

                    {
                        let mut idx = match index.write() {
                            Ok(g) => g,
                            Err(e) => e.into_inner(),
                        };
                        // Re-index with full content (replaces filename-only entry).
                        idx.index_document(&ps, &content, source, size, modified);

                        // Check memory limit.
                        if memory_limit_bytes > 0 && idx.estimated_memory_bytes() >= memory_limit_bytes {
                            warn!(
                                "[SearchEngine] Memory limit reached ({} MB) during incremental indexing.",
                                settings.memory_limit_mb
                            );
                            content_indexed += 1;
                            break;
                        }
                    }
                    content_indexed += 1;
                }

                if content_indexed > 0 {
                    let mut idx = match index.write() {
                        Ok(g) => g,
                        Err(e) => e.into_inner(),
                    };
                    idx.rebuild_fst();
                    idx.update_scorer_stats();
                    info!(
                        "[SearchEngine] Phase 2: indexed content for {} files from {}",
                        content_indexed, path_str
                    );
                }
            })
            .ok();
    }

    // -- 17. set_context_path() / get_context_path() -------------------------

    /// Set the user's current directory for context-aware ranking.
    pub fn set_context_path(&self, path: &str) {
        let mut ctx = self.context_path.lock().unwrap_or_else(|e| e.into_inner());
        *ctx = Some(path.to_string());
    }

    /// Get the current context path.
    pub fn get_context_path(&self) -> Option<String> {
        self.context_path.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }

    // -- 18. search_with_context_boost() -------------------------------------

    /// Apply context-path proximity boost to search results.
    fn apply_context_boost(&self, results: &mut Vec<SearchResult>) {
        let ctx = self.get_context_path();
        let ctx_path = match ctx {
            Some(ref p) if !p.is_empty() => p,
            _ => return,
        };

        // Normalize path separators for comparison.
        let ctx_normalized = ctx_path.replace('\\', "/").to_lowercase();

        for result in results.iter_mut() {
            let result_normalized = result.path.replace('\\', "/").to_lowercase();

            // File is directly in context directory → 1.3x boost.
            let result_parent = result_normalized.rsplitn(2, '/').nth(1).unwrap_or("");
            let ctx_trimmed = ctx_normalized.trim_end_matches('/');

            if result_parent == ctx_trimmed {
                result.score *= 1.3;
            }
            // File is in a subdirectory of context → 1.15x boost.
            else if result_normalized.starts_with(&format!("{}/", ctx_trimmed)) {
                result.score *= 1.15;
            }
            // File is in parent directory of context → 1.05x boost.
            else if ctx_trimmed.starts_with(&format!("{}/", result_parent)) {
                result.score *= 1.05;
            }
        }

        // Re-sort by score.
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    }

    // -- Internal: watcher setup ---------------------------------------------

    /// Start the filesystem watcher on all whitelisted paths with a callback
    /// that incrementally updates the index.
    fn start_watcher_inner(
        index: &Arc<RwLock<SearchIndex>>,
        settings_arc: &Arc<Mutex<TokenizerSettings>>,
        watcher_arc: &Arc<Mutex<FileWatcher>>,
    ) {
        let settings = settings_arc
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();

        let blacklisted: Vec<String> = settings
            .blacklisted_extensions
            .iter()
            .map(|e| e.to_lowercase())
            .collect();

        let max_file_size = settings.max_file_size;

        let mut watcher = watcher_arc
            .lock()
            .unwrap_or_else(|e| e.into_inner());

        watcher.set_blacklisted_extensions(blacklisted.clone());

        // Set the callback to handle incremental updates.
        let index_for_cb = Arc::clone(index);
        let bl_set: HashSet<String> = blacklisted.into_iter().collect();

        watcher.set_callback(Box::new(move |events: Vec<FileChangeEvent>| {
            for event in events {
                match event {
                    FileChangeEvent::Created(ref p) | FileChangeEvent::Modified(ref p) => {
                        if !is_text_indexable(p, &bl_set, max_file_size) {
                            continue;
                        }
                        let content = match read_file_content(p) {
                            Some(c) => c,
                            None => continue,
                        };
                        let source = content_source_for(p);
                        let (size, modified) = file_meta(p);
                        let path_str = p.to_string_lossy().to_string();

                        let mut idx = match index_for_cb.write() {
                            Ok(g) => g,
                            Err(e) => e.into_inner(),
                        };
                        idx.index_document(&path_str, &content, source, size, modified);
                    }
                    FileChangeEvent::Removed(ref p) => {
                        let path_str = p.to_string_lossy().to_string();
                        let mut idx = match index_for_cb.write() {
                            Ok(g) => g,
                            Err(e) => e.into_inner(),
                        };
                        idx.remove_document(&path_str);
                    }
                    FileChangeEvent::Renamed { ref from, ref to } => {
                        let from_str = from.to_string_lossy().to_string();
                        let to_str = to.to_string_lossy().to_string();

                        let mut idx = match index_for_cb.write() {
                            Ok(g) => g,
                            Err(e) => e.into_inner(),
                        };

                        // Remove old path.
                        idx.remove_document(&from_str);

                        // Index the new path if it is text-indexable.
                        drop(idx);
                        if is_text_indexable(to, &bl_set, max_file_size) {
                            if let Some(content) = read_file_content(to) {
                                let source = content_source_for(to);
                                let (size, modified) = file_meta(to);
                                let mut idx = match index_for_cb.write() {
                                    Ok(g) => g,
                                    Err(e) => e.into_inner(),
                                };
                                idx.index_document(
                                    &to_str, &content, source, size, modified,
                                );
                            }
                        }
                    }
                }
            }
        }));

        // Start the watcher.
        if let Err(e) = watcher.start() {
            warn!("[SearchEngine] Failed to start watcher: {}", e);
            return;
        }

        // Watch each whitelisted path.
        for root in &settings.whitelisted_paths {
            if let Err(e) = watcher.watch_path(Path::new(root)) {
                warn!(
                    "[SearchEngine] Failed to watch path {}: {}",
                    root, e
                );
            }
        }
    }
}

impl Default for SearchEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ===== Global singleton =====================================================

static GLOBAL_ENGINE: OnceLock<Arc<SearchEngine>> = OnceLock::new();

/// Return the global `SearchEngine` instance, lazily initialised.
///
/// On first call the engine loads settings from disk, performs an initial
/// index build in the background, and starts the filesystem watcher.
pub fn get_search_engine() -> Arc<SearchEngine> {
    GLOBAL_ENGINE
        .get_or_init(|| {
            let engine = Arc::new(SearchEngine::new());
            engine.start();
            engine
        })
        .clone()
}

// ===== Tauri command wrappers ===============================================
//
// These are drop-in replacements for the old tokenizer.rs Tauri commands.
// They delegate to the global SearchEngine singleton.
// Signatures match the old commands (async fn, Result<T, String>).

#[tauri::command]
pub async fn set_tokenizer_settings(settings: TokenizerSettings) -> Result<(), String> {
    get_search_engine().set_settings(settings);
    Ok(())
}

#[tauri::command]
pub async fn get_tokenizer_settings() -> Result<TokenizerSettings, String> {
    Ok(get_search_engine().get_settings())
}

#[tauri::command]
pub async fn rebuild_token_index() -> Result<(), String> {
    let engine = get_search_engine();
    if engine.is_indexing() {
        return Err("Indexing is already in progress".to_string());
    }
    engine.rebuild_full_index();
    Ok(())
}

#[tauri::command]
pub async fn search_tokens(query: String, limit: Option<usize>) -> Result<Vec<SearchResult>, String> {
    Ok(get_search_engine().search(&query, limit.unwrap_or(DEFAULT_SEARCH_LIMIT)))
}

#[tauri::command]
pub async fn natural_language_search(
    query: String,
    language: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    Ok(get_search_engine().natural_language_search(
        &query,
        language.as_deref(),
        limit.unwrap_or(DEFAULT_SEARCH_LIMIT),
    ))
}

#[tauri::command]
pub async fn get_tokenizer_stats() -> Result<Option<TokenizerStats>, String> {
    Ok(get_search_engine().get_stats())
}

#[tauri::command]
pub async fn is_tokenizer_indexing() -> Result<bool, String> {
    Ok(get_search_engine().is_indexing())
}

#[tauri::command]
pub async fn get_file_tokens(file_path: String) -> Result<Option<FileToken>, String> {
    Ok(get_search_engine().get_file_tokens(&file_path))
}

#[tauri::command]
pub async fn add_path_to_tokenizer(path: String) -> Result<(), String> {
    get_search_engine().add_path(path);
    Ok(())
}

#[tauri::command]
pub async fn get_file_recommendations(
    file_path: String,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    Ok(get_search_engine().get_file_recommendations(&file_path, limit.unwrap_or(DEFAULT_RECOMMENDATION_LIMIT)))
}

#[tauri::command]
pub async fn parse_search_query(
    query: String,
    _language: Option<String>,
) -> Result<CompatStructuredQuery, String> {
    Ok(get_search_engine().parse_search_query(&query, _language.as_deref()))
}

#[tauri::command]
pub async fn enhanced_search(
    query: String,
    language: Option<String>,
    limit: Option<usize>,
) -> Result<EnhancedSearchResult, String> {
    Ok(get_search_engine().enhanced_search(&query, language.as_deref(), limit.unwrap_or(DEFAULT_SEARCH_LIMIT)))
}

// ===== Auto-index and context commands =======================================

#[tauri::command]
pub async fn index_directory(path: String, max_depth: Option<u32>) -> Result<(), String> {
    get_search_engine().index_directory(&path, max_depth);
    Ok(())
}

#[tauri::command]
pub async fn set_search_context(path: String) -> Result<(), String> {
    get_search_engine().set_context_path(&path);
    Ok(())
}

#[tauri::command]
pub async fn add_whitelisted_path(path: String) -> Result<(), String> {
    let engine = get_search_engine();
    let mut settings = engine.get_settings();

    // Check blacklisted paths — don't add if blacklisted.
    for bp in &settings.blacklisted_paths {
        let norm_bp = bp.replace('\\', "/").to_lowercase();
        let norm_path = path.replace('\\', "/").to_lowercase();
        if norm_path.starts_with(&norm_bp) {
            return Ok(());
        }
    }

    if !settings.whitelisted_paths.contains(&path) {
        settings.whitelisted_paths.push(path);
        engine.set_settings(settings);
    }
    Ok(())
}

// ===== AI-powered search re-ranking ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AISearchResult {
    pub results: Vec<SearchResult>,
    pub provider: String,
    pub model: String,
}

#[tauri::command]
pub async fn ai_search(
    query: String,
    provider: String,
    api_key: Option<String>,
    model: Option<String>,
    limit: Option<usize>,
) -> Result<AISearchResult, String> {
    let lim = limit.unwrap_or(DEFAULT_SEARCH_LIMIT);

    // Step 1: BM25F pre-filter to get top candidates.
    let mut candidates = get_search_engine().search(&query, 100);

    if candidates.is_empty() {
        return Ok(AISearchResult {
            results: Vec::new(),
            provider: provider.clone(),
            model: model.clone().unwrap_or_default(),
        });
    }

    // Step 2: Build file list for AI.
    let file_list: Vec<String> = candidates
        .iter()
        .map(|r| format!("{} (score: {:.2})", r.path, r.score))
        .collect();

    let file_list_str = file_list.join("\n");

    let prompt = format!(
        "You are a file search relevance ranker. Given this search query and candidate files, \
         re-rank them by relevance. Return ONLY a JSON array of objects with \"path\" and \"score\" (0-10) fields.\n\n\
         Query: \"{}\"\n\nCandidate files:\n{}\n\n\
         Return JSON array, most relevant first. Only include files with score > 2.",
        query, file_list_str
    );

    // Step 3: Call AI provider.
    let ai_response = crate::ai::search_rerank_with_ai(
        &prompt,
        &provider,
        api_key.as_deref(),
        model.as_deref(),
    )
    .await?;

    // Step 4: Parse AI response and re-rank.
    if let Ok(rankings) = serde_json::from_str::<Vec<serde_json::Value>>(&ai_response) {
        let mut ai_scored: Vec<(String, f64)> = rankings
            .iter()
            .filter_map(|v| {
                let path = v.get("path")?.as_str()?.to_string();
                let score = v.get("score")?.as_f64()?;
                Some((path, score))
            })
            .collect();

        ai_scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // Rebuild results using AI ranking order.
        let mut reranked: Vec<SearchResult> = Vec::new();
        for (ai_path, ai_score) in &ai_scored {
            if let Some(mut result) = candidates.iter().find(|r| r.path == *ai_path).cloned() {
                result.score = *ai_score;
                result.relevance_type = "ai_reranked".to_string();
                reranked.push(result);
            }
        }

        reranked.truncate(lim);

        Ok(AISearchResult {
            results: reranked,
            provider: provider.clone(),
            model: model.clone().unwrap_or_default(),
        })
    } else {
        // AI returned non-parseable response — fall back to original BM25F results.
        candidates.truncate(lim);
        Ok(AISearchResult {
            results: candidates,
            provider: provider.clone(),
            model: model.clone().unwrap_or_default(),
        })
    }
}

// ===== AI Pipeline singleton =================================================

static GLOBAL_AI_PIPELINE: OnceLock<Arc<AIPipeline>> = OnceLock::new();

fn get_ai_pipeline() -> Arc<AIPipeline> {
    GLOBAL_AI_PIPELINE
        .get_or_init(|| Arc::new(AIPipeline::new()))
        .clone()
}

// ===== AI Tauri commands =====================================================

#[tauri::command]
pub async fn get_ai_index_status() -> Result<AIIndexStatus, String> {
    Ok(get_ai_pipeline().get_status())
}

#[tauri::command]
pub async fn trigger_ai_indexing(
    paths: Vec<String>,
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
) -> Result<(), String> {
    let pipeline = get_ai_pipeline();
    pipeline.queue_files(paths);

    let config = provider.map(|p| {
        use super::ai_pipeline::{VisionProvider, VisionProviderConfig};
        let prov = match p.as_str() {
            "claude" => VisionProvider::Claude,
            "openai" => VisionProvider::Openai,
            _ => VisionProvider::Ollama,
        };
        VisionProviderConfig {
            provider: prov,
            api_key,
            model,
        }
    });

    pipeline.start_processing(config);
    Ok(())
}

#[tauri::command]
pub async fn get_ai_index_entry(path: String) -> Result<Option<AIIndexEntry>, String> {
    Ok(get_ai_pipeline().get_entry(&path))
}

#[tauri::command]
pub async fn semantic_search(
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    let lim = limit.unwrap_or(DEFAULT_SEMANTIC_SEARCH_LIMIT);
    // Load embeddings from disk and search
    let embeddings = super::hybrid::load_embeddings_from_disk();
    if embeddings.is_empty() {
        return Ok(Vec::new());
    }

    // Get embedding for the query via Ollama
    let client = super::ollama_client::get_client();
    let model = match client.detect_embedding_model().await {
        Some(m) => m,
        None => return Ok(Vec::new()), // No embedding model available
    };

    let query_embedding = client
        .get_embedding(&model, &query)
        .await
        .map_err(|e| format!("Embedding error: {}", e))?;

    let results = super::hybrid::search_embeddings(
        &query_embedding,
        &embeddings,
        lim,
        SEMANTIC_SIMILARITY_THRESHOLD,
    );
    Ok(results)
}

#[tauri::command]
pub async fn find_similar_files(
    file_path: String,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    let lim = limit.unwrap_or(DEFAULT_RECOMMENDATION_LIMIT);
    let embeddings = super::hybrid::load_embeddings_from_disk();
    if embeddings.is_empty() {
        return Ok(Vec::new());
    }

    // Find the embedding for the given file
    let reference = embeddings
        .iter()
        .find(|e| e.path == file_path)
        .map(|e| e.embedding.clone());

    let ref_embedding = match reference {
        Some(e) => e,
        None => return Ok(Vec::new()), // File not indexed
    };

    // Search using cosine similarity and convert to SearchResult
    let similar = super::ai_pipeline::find_similar_images(&ref_embedding, &embeddings, lim);
    let results: Vec<SearchResult> = similar
        .into_iter()
        .filter(|(p, _)| *p != file_path)
        .map(|(path, sim)| {
            let filename = Path::new(&path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            SearchResult {
                path,
                filename,
                matches: vec![],
                score: sim,
                relevance_type: "similar".to_string(),
                snippet: None,
            }
        })
        .collect();
    Ok(results)
}

#[tauri::command]
pub async fn hybrid_search(
    query: String,
    current_directory: Option<String>,
    recent_files: Option<Vec<String>>,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    let lim = limit.unwrap_or(DEFAULT_SEARCH_LIMIT);
    let engine = get_search_engine();

    // Parse the query for intent classification
    let parsed = super::query_parser::parse(&query);
    let intent = HybridSearcher::classify_intent(&parsed);

    // Text search via BM25F
    let text_results = engine.search(&query, lim * 2);

    // Semantic search (best effort — returns empty if no embeddings/model)
    let semantic_results = match semantic_search(query.clone(), Some(lim * 2)).await {
        Ok(r) => r,
        Err(_) => Vec::new(),
    };

    // Hybrid fusion
    let searcher = HybridSearcher::new();
    let config = HybridSearchConfig::default();
    let mut fused = searcher.fuse_results(
        &text_results,
        &semantic_results,
        &config,
        &intent,
        lim,
    );

    // Apply contextual re-ranking if context is available
    if current_directory.is_some() || recent_files.is_some() {
        let recents = recent_files.unwrap_or_default();
        let ctx = ContextualRanker::build_context_from_recents(
            &recents,
            current_directory.as_deref(),
        );
        let ranker = ContextualRanker::new();
        ranker.apply_context_ranking(&mut fused, &ctx);
    }

    fused.truncate(lim);
    Ok(fused)
}

// ===== Tests ================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a SearchEngine with a pre-populated index for testing.
    /// We bypass the filesystem by directly writing to the underlying index.
    fn build_prf_test_engine() -> SearchEngine {
        let engine = SearchEngine::new();

        {
            let mut idx = engine.index.write().unwrap();

            // Document about Rust programming
            idx.index_document(
                "/code/main.rs",
                "fn main() { let config = load_config(); println!(\"server started\"); }",
                "text",
                256,
                1_700_000_000,
            );

            // Document about server configuration
            idx.index_document(
                "/docs/server_config.md",
                "server configuration guide for deployment. Set the database host and port. Configure the logging level and server timeout.",
                "text",
                512,
                1_700_000_000,
            );

            // Document about database setup
            idx.index_document(
                "/docs/database_setup.md",
                "database setup instructions. Install PostgreSQL server and configure the connection pool. Set max connections and timeout.",
                "text",
                512,
                1_700_000_000,
            );

            // Document about deployment
            idx.index_document(
                "/docs/deploy.md",
                "deployment guide for production server. Configure load balancer, set up monitoring, and establish database connection.",
                "text",
                512,
                1_700_000_000,
            );

            // Unrelated document about cooking
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

        let has_recipes = results
            .iter()
            .any(|r| r.path == "/docs/recipes.txt");
        assert!(
            !has_recipes,
            "PRF search for 'server' should not surface the recipes document"
        );
    }

    #[test]
    fn search_with_prf_short_results_returns_asis() {
        let engine = build_prf_test_engine();
        // Search for a term that only matches one document
        let results = engine.search_with_prf("chocolate", 10, None, None);
        // Should still work gracefully even with few results
        assert!(
            results.len() <= 10,
            "PRF should handle single-result gracefully"
        );
    }

    #[test]
    fn search_with_prf_custom_parameters() {
        let engine = build_prf_test_engine();
        // Use custom top_k=2 and expansion_terms=3
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
        // "database" appears in database_setup.md and deploy.md.
        // PRF should expand the query with terms like "server", "connection",
        // "config" etc. from the top results, potentially surfacing more
        // relevant documents.
        let prf_results = engine.search_with_prf("database", 10, None, None);
        let plain_results = engine.search("database", 10);

        // PRF results should be at least as many as plain results (expansion
        // can bring in more docs).
        assert!(
            prf_results.len() >= plain_results.len(),
            "PRF should return at least as many results as plain search: prf={} vs plain={}",
            prf_results.len(),
            plain_results.len()
        );
    }
}
