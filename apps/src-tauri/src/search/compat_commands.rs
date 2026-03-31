// Xplorer Search Engine — Tauri Command Wrappers
//
// Drop-in replacements for the old tokenizer.rs Tauri commands.
// They delegate to the global SearchEngine singleton.
// Signatures match the old commands (async fn, Result<T, String>).

use std::path::Path;

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
    let ai_response =
        crate::ai::search_rerank_with_ai(&prompt, &provider, api_key.as_deref(), model.as_deref())
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
