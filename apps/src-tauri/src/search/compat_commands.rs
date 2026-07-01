// Xplorer Search Engine — Tauri Command Wrappers
//
// Drop-in replacements for the old tokenizer.rs Tauri commands.
// They delegate to the global SearchEngine singleton.
// Signatures match the old commands (async fn, Result<T, String>).

use std::collections::HashSet;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use serde::{Deserialize, Serialize};

use super::context_ranker::ContextualRanker;
use super::hybrid::{HybridSearchConfig, HybridSearcher};
use super::SearchResult;

use super::compat_engine::{get_ai_pipeline, get_search_engine};
use super::compat_types::{
    AISearchResult, CompatStructuredQuery, EnhancedSearchResult, FileToken, TokenizerSettings,
    TokenizerStats, DEFAULT_RECOMMENDATION_LIMIT, DEFAULT_SEARCH_LIMIT,
    DEFAULT_SEMANTIC_SEARCH_LIMIT, SEMANTIC_SIMILARITY_THRESHOLD,
};

use super::ai_pipeline::{AIIndexEntry, AIIndexStatus};

// ===== Smart Search types ====================================================

static SMART_SEARCH_GENERATION: AtomicU64 = AtomicU64::new(0);

#[derive(Serialize, Deserialize, Clone)]
pub struct SmartSearchResult {
    pub results: Vec<SearchResult>,
    pub matched_items: Vec<String>,
    pub explanation: Option<String>,
    pub provider: String,
    pub search_terms_used: Vec<String>,
}

#[derive(Deserialize, Default)]
struct LlmSearchResponse {
    #[serde(default)]
    matched_items: Vec<String>,
    #[serde(default)]
    search_terms: Vec<String>,
    #[serde(default)]
    explanation: String,
    #[serde(default)]
    sort: Option<String>,
    #[serde(default)]
    file_type: Option<String>,
}

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
pub async fn search_tokens(
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    tokio::task::spawn_blocking(move || {
        Ok(get_search_engine().search(&query, limit.unwrap_or(DEFAULT_SEARCH_LIMIT)))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn natural_language_search(
    query: String,
    language: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    tokio::task::spawn_blocking(move || {
        Ok(get_search_engine().natural_language_search(
            &query,
            language.as_deref(),
            limit.unwrap_or(DEFAULT_SEARCH_LIMIT),
        ))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_tokenizer_stats() -> Result<Option<TokenizerStats>, String> {
    tokio::task::spawn_blocking(move || Ok(get_search_engine().get_stats()))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn is_tokenizer_indexing() -> Result<bool, String> {
    tokio::task::spawn_blocking(move || Ok(get_search_engine().is_indexing()))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_file_tokens(file_path: String) -> Result<Option<FileToken>, String> {
    tokio::task::spawn_blocking(move || Ok(get_search_engine().get_file_tokens(&file_path)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn add_path_to_tokenizer(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        get_search_engine().add_path(path);
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_file_recommendations(
    file_path: String,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    tokio::task::spawn_blocking(move || {
        Ok(get_search_engine()
            .get_file_recommendations(&file_path, limit.unwrap_or(DEFAULT_RECOMMENDATION_LIMIT)))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn parse_search_query(
    query: String,
    _language: Option<String>,
) -> Result<CompatStructuredQuery, String> {
    tokio::task::spawn_blocking(move || {
        Ok(get_search_engine().parse_search_query(&query, _language.as_deref()))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn enhanced_search(
    query: String,
    language: Option<String>,
    limit: Option<usize>,
) -> Result<EnhancedSearchResult, String> {
    tokio::task::spawn_blocking(move || {
        Ok(get_search_engine().enhanced_search(
            &query,
            language.as_deref(),
            limit.unwrap_or(DEFAULT_SEARCH_LIMIT),
        ))
    })
    .await
    .map_err(|e| e.to_string())?
}

// ===== Auto-index and context commands =======================================

#[tauri::command]
pub async fn index_directory(path: String, max_depth: Option<u32>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        get_search_engine().index_directory(&path, max_depth);
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_search_context(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        get_search_engine().set_context_path(&path);
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn add_whitelisted_path(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let engine = get_search_engine();
        let mut settings = engine.get_settings();

        // Check blacklisted paths -- don't add if blacklisted.
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
    })
    .await
    .map_err(|e| e.to_string())?
}

// ===== AI-powered search re-ranking ==========================================

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
        None,
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

// ===== AI Tauri commands =====================================================

#[tauri::command]
pub async fn get_ai_index_status() -> Result<AIIndexStatus, String> {
    tokio::task::spawn_blocking(move || Ok(get_ai_pipeline().get_status()))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn trigger_ai_indexing(
    paths: Vec<String>,
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_ai_index_entry(path: String) -> Result<Option<AIIndexEntry>, String> {
    tokio::task::spawn_blocking(move || Ok(get_ai_pipeline().get_entry(&path)))
        .await
        .map_err(|e| e.to_string())?
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
    tokio::task::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| e.to_string())?
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
    let semantic_results = semantic_search(query.clone(), Some(lim * 2))
        .await
        .unwrap_or_default();

    // Hybrid fusion
    let searcher = HybridSearcher::new();
    let config = HybridSearchConfig::default();
    let mut fused = searcher.fuse_results(&text_results, &semantic_results, &config, &intent, lim);

    // Apply contextual re-ranking if context is available
    if current_directory.is_some() || recent_files.is_some() {
        let recents = recent_files.unwrap_or_default();
        let ctx =
            ContextualRanker::build_context_from_recents(&recents, current_directory.as_deref());
        let ranker = ContextualRanker::new();
        ranker.apply_context_ranking(&mut fused, &ctx);
    }

    fused.truncate(lim);
    Ok(fused)
}

// ===== LLM-powered smart search =============================================

const SMART_SEARCH_SYSTEM_PROMPT: &str = "\
You are a file search assistant for a desktop file manager. \
Interpret the user's search query and return a search strategy as JSON. \
Return ONLY a valid JSON object with no additional text.";

const SMART_SEARCH_MAX_DIR_ITEMS: usize = 200;
const SMART_SEARCH_MAX_TERMS: usize = 6;
const SMART_SEARCH_MAX_TERM_LEN: usize = 100;
const SMART_SEARCH_WALKDIR_DEPTH: usize = 3;

/// Parse LLM response text into an LlmSearchResponse, handling markdown fences
/// and malformed JSON gracefully.
fn parse_llm_json(raw: &str) -> LlmSearchResponse {
    // Strip markdown fences
    let stripped = raw
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    // Find outermost { ... }
    let json_str = if let Some(start) = stripped.find('{') {
        if let Some(end) = stripped.rfind('}') {
            &stripped[start..=end]
        } else {
            stripped
        }
    } else {
        stripped
    };

    serde_json::from_str::<LlmSearchResponse>(json_str).unwrap_or_default()
}

/// Sanitize a search term: reject path traversal characters, cap length.
fn sanitize_search_term(term: &str) -> Option<String> {
    let trimmed = term.trim();
    if trimmed.is_empty() || trimmed.len() > SMART_SEARCH_MAX_TERM_LEN {
        return None;
    }
    if trimmed.contains("..") || trimmed.contains('/') || trimmed.contains('\\') {
        return None;
    }
    Some(trimmed.to_string())
}

/// Map file_type string from LLM to a set of extensions for filtering.
fn file_type_extensions(file_type: &str) -> Option<HashSet<&'static str>> {
    let exts: &[&str] = match file_type {
        "image" => &[
            "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "tiff", "heic", "ico",
        ],
        "video" => &["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm"],
        "document" => &[
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "rtf", "csv", "odt",
        ],
        "audio" => &["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma"],
        "code" => &[
            "rs", "ts", "tsx", "js", "jsx", "py", "go", "java", "c", "cpp", "h", "css", "html",
            "json", "toml", "yaml", "yml",
        ],
        "archive" => &["zip", "tar", "gz", "bz2", "xz", "7z", "rar"],
        _ => return None,
    };
    Some(exts.iter().copied().collect())
}

#[tauri::command]
pub async fn smart_search(
    query: String,
    current_directory: String,
    limit: Option<usize>,
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
) -> Result<SmartSearchResult, String> {
    let generation = SMART_SEARCH_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let lim = limit.unwrap_or(DEFAULT_SEARCH_LIMIT);
    let trimmed_query = query.trim().to_string();

    if trimmed_query.is_empty() {
        return Ok(SmartSearchResult {
            results: Vec::new(),
            matched_items: Vec::new(),
            explanation: None,
            provider: "none".into(),
            search_terms_used: Vec::new(),
        });
    }

    // Step 1: Read directory listing, sorted by mtime desc, capped at 200
    let dir_path = current_directory.clone();
    let dir_items = tokio::task::spawn_blocking(move || {
        let mut entries: Vec<(String, u64)> = Vec::new();
        if let Ok(read_dir) = std::fs::read_dir(&dir_path) {
            for entry in read_dir.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let mtime = entry
                    .metadata()
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                entries.push((name, mtime));
            }
        }
        entries.sort_by(|a, b| b.1.cmp(&a.1));
        entries.truncate(SMART_SEARCH_MAX_DIR_ITEMS);
        entries
    })
    .await
    .map_err(|e| format!("Failed to read directory: {}", e))?;

    // Check if stale
    if SMART_SEARCH_GENERATION.load(Ordering::SeqCst) != generation {
        return Ok(SmartSearchResult {
            results: Vec::new(),
            matched_items: Vec::new(),
            explanation: None,
            provider: "cancelled".into(),
            search_terms_used: Vec::new(),
        });
    }

    // Step 2: Detect LLM provider (use explicit settings if provided, else auto-detect)
    let provider_info = if let Some(ref p) = provider {
        if p == "auto" || p.is_empty() {
            crate::ai::detect_best_provider().await
        } else {
            Some((
                p.clone(),
                api_key.clone(),
                model.clone().unwrap_or_else(|| match p.as_str() {
                    "claude" => "claude-haiku-4-5-20251001".to_string(),
                    "openai" => "gpt-4o-mini".to_string(),
                    "ollama" => "llama3".to_string(),
                    "openrouter" => "anthropic/claude-sonnet-4".to_string(),
                    "requesty" => "anthropic/claude-sonnet-4-5".to_string(),
                    _ => "llama3".to_string(),
                }),
            ))
        }
    } else {
        crate::ai::detect_best_provider().await
    };

    if provider_info.is_none() {
        // Fallback to enhanced_search
        let query_clone = trimmed_query.clone();
        let fallback = tokio::task::spawn_blocking(move || {
            get_search_engine().enhanced_search(&query_clone, None, lim)
        })
        .await
        .map_err(|e| e.to_string())?;

        return Ok(SmartSearchResult {
            results: fallback.results,
            matched_items: Vec::new(),
            explanation: None,
            provider: "fallback".into(),
            search_terms_used: vec![trimmed_query],
        });
    }

    let (prov, prov_api_key, prov_model) = provider_info.unwrap();

    // Step 3: Build prompt
    let item_list: String = dir_items
        .iter()
        .enumerate()
        .map(|(i, (name, _))| format!("{}. \"{}\"", i + 1, name))
        .collect::<Vec<_>>()
        .join("\n");

    let truncation_note = if dir_items.len() >= SMART_SEARCH_MAX_DIR_ITEMS {
        format!(
            "\n(Showing {} most recent items; directory may contain more)",
            SMART_SEARCH_MAX_DIR_ITEMS
        )
    } else {
        String::new()
    };

    let prompt = format!(
        "Current directory: {current_directory}\n\
         Items in this directory (most recent first):\n\
         {item_list}{truncation_note}\n\n\
         User's search query: \"{trimmed_query}\"\n\n\
         Return ONLY a valid JSON object with no additional text:\n\
         {{\n\
           \"matched_items\": [],\n\
           \"search_terms\": [],\n\
           \"explanation\": \"\",\n\
           \"sort\": null,\n\
           \"file_type\": null\n\
         }}\n\n\
         Field rules:\n\
         - matched_items: exact names from the \"Items\" list above that match the user's intent. Empty if none match.\n\
         - search_terms: keywords for deeper filesystem search. Include translations if items use other languages. Max 6 terms.\n\
         - explanation: 1-sentence interpretation of the query (max 100 chars).\n\
         - sort: \"newest\" | \"oldest\" | \"largest\" | \"smallest\" | null (null = relevance order).\n\
         - file_type: \"image\" | \"video\" | \"document\" | \"audio\" | \"code\" | \"archive\" | null (null = any type)."
    );

    // Step 4: Call AI
    let ai_response = crate::ai::search_rerank_with_ai(
        &prompt,
        &prov,
        prov_api_key.as_deref(),
        Some(&prov_model),
        Some(SMART_SEARCH_SYSTEM_PROMPT),
    )
    .await;

    // Check if stale after LLM call
    if SMART_SEARCH_GENERATION.load(Ordering::SeqCst) != generation {
        return Ok(SmartSearchResult {
            results: Vec::new(),
            matched_items: Vec::new(),
            explanation: None,
            provider: "cancelled".into(),
            search_terms_used: Vec::new(),
        });
    }

    // Step 5: Parse response
    let llm_response = match ai_response {
        Ok(text) => parse_llm_json(&text),
        Err(_) => LlmSearchResponse::default(),
    };

    // Step 6: Validate matched_items against actual directory listing
    let actual_names: HashSet<String> = dir_items.iter().map(|(n, _)| n.clone()).collect();
    let validated_matches: Vec<String> = llm_response
        .matched_items
        .into_iter()
        .filter(|name| actual_names.contains(name))
        .collect();

    // Step 7: Sanitize search_terms
    let sanitized_terms: Vec<String> = llm_response
        .search_terms
        .into_iter()
        .filter_map(|t| sanitize_search_term(&t))
        .take(SMART_SEARCH_MAX_TERMS)
        .collect();

    let explanation = if llm_response.explanation.is_empty() {
        None
    } else {
        Some(llm_response.explanation.chars().take(200).collect())
    };

    // Step 8: Build matched_items results
    let mut all_results: Vec<SearchResult> = Vec::new();
    let mut seen_paths: HashSet<String> = HashSet::new();

    for matched_name in &validated_matches {
        let full_path = Path::new(&current_directory)
            .join(matched_name)
            .to_string_lossy()
            .to_string();
        if seen_paths.insert(full_path.clone()) {
            all_results.push(SearchResult {
                path: full_path,
                filename: matched_name.clone(),
                matches: vec![],
                score: 100.0,
                relevance_type: "ai_matched".to_string(),
                snippet: None,
            });
        }
    }

    // Step 9: Keyword search via BM25F index + walkdir fallback
    if !sanitized_terms.is_empty() {
        // BM25F index search for each term
        let terms_for_search = sanitized_terms.clone();
        let search_limit = lim * 3;
        let mut index_results: Vec<SearchResult> = tokio::task::spawn_blocking(move || {
            let engine = get_search_engine();
            let mut combined: Vec<SearchResult> = Vec::new();
            for term in &terms_for_search {
                let results = engine.search(term, search_limit);
                combined.extend(results);
            }
            combined
        })
        .await
        .map_err(|e| e.to_string())?;

        // If index returned nothing, do single-pass walkdir fallback
        if index_results.is_empty() {
            let walk_dir = current_directory.clone();
            let walk_terms = sanitized_terms.clone();
            index_results = tokio::task::spawn_blocking(move || {
                let mut results: Vec<SearchResult> = Vec::new();
                let walker = walkdir::WalkDir::new(&walk_dir)
                    .max_depth(SMART_SEARCH_WALKDIR_DEPTH)
                    .follow_links(false);

                for entry in walker.into_iter().filter_map(|e| e.ok()) {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    let matches_any = walk_terms.iter().any(|t| name.contains(&t.to_lowercase()));
                    if matches_any {
                        let path = entry.path().to_string_lossy().to_string();
                        let filename = entry.file_name().to_string_lossy().to_string();
                        results.push(SearchResult {
                            path,
                            filename,
                            matches: vec![],
                            score: 50.0,
                            relevance_type: "ai_walkdir".to_string(),
                            snippet: None,
                        });
                    }
                    if results.len() >= 500 {
                        break;
                    }
                }
                results
            })
            .await
            .map_err(|e| e.to_string())?;
        }

        for result in index_results {
            if seen_paths.insert(result.path.clone()) {
                all_results.push(result);
            }
        }
    }

    // Step 10: Apply sort
    match llm_response.sort.as_deref() {
        Some("newest") => {
            all_results.sort_by(|a, b| {
                let ma = std::fs::metadata(&a.path)
                    .and_then(|m| m.modified())
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                let mb = std::fs::metadata(&b.path)
                    .and_then(|m| m.modified())
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                mb.cmp(&ma)
            });
        }
        Some("oldest") => {
            all_results.sort_by(|a, b| {
                let ma = std::fs::metadata(&a.path)
                    .and_then(|m| m.modified())
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                let mb = std::fs::metadata(&b.path)
                    .and_then(|m| m.modified())
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                ma.cmp(&mb)
            });
        }
        Some("largest") => {
            all_results.sort_by(|a, b| {
                let sa = std::fs::metadata(&a.path).map(|m| m.len()).unwrap_or(0);
                let sb = std::fs::metadata(&b.path).map(|m| m.len()).unwrap_or(0);
                sb.cmp(&sa)
            });
        }
        Some("smallest") => {
            all_results.sort_by(|a, b| {
                let sa = std::fs::metadata(&a.path).map(|m| m.len()).unwrap_or(0);
                let sb = std::fs::metadata(&b.path).map(|m| m.len()).unwrap_or(0);
                sa.cmp(&sb)
            });
        }
        _ => {}
    }

    // Step 11: Apply file_type filter
    if let Some(ref ft) = llm_response.file_type {
        if let Some(exts) = file_type_extensions(ft) {
            all_results.retain(|r| {
                let ext = Path::new(&r.path)
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_lowercase())
                    .unwrap_or_default();
                exts.contains(ext.as_str()) || r.relevance_type == "ai_matched"
            });
        }
    }

    // Step 12: Truncate
    all_results.truncate(lim);

    Ok(SmartSearchResult {
        results: all_results,
        matched_items: validated_matches,
        explanation,
        provider: prov,
        search_terms_used: sanitized_terms,
    })
}
