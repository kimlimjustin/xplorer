//! Hybrid search module — combines BM25F text search, semantic/embedding search,
//! and fuzzy search using Reciprocal Rank Fusion (RRF).
//!
//! This is the core "Tier 2a" unified search that replaces calling 3 separate
//! search commands with a single fused pipeline.

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

use super::cosine_similarity;

// ---------------------------------------------------------------------------
// EmbeddingEntry — re-declared here to avoid cross-module dependency on
// vector_store.  Layout matches `~/.local/share/xplorer/vector_embeddings.json`.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingEntry {
    pub path: String,
    pub chunk_id: usize,
    pub chunk_text: String,
    pub embedding: Vec<f32>,
    pub model: String,
}

// ---------------------------------------------------------------------------
// SearchIntent
// ---------------------------------------------------------------------------

/// Intent classification derived from the parsed query.  Each variant adjusts
/// the relative weight given to text vs. semantic results during fusion.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SearchIntent {
    /// Balanced weights — no particular bias.
    General,
    /// Boost semantic results 1.5×  (user wants visually/conceptually similar files).
    FindSimilar,
    /// Boost text/metadata results 1.5×  (user specified file_type / size / date filters).
    FindByMetadata,
    /// Boost AI-generated descriptions 1.3× (user asked for "photos of …" etc.).
    FindByContent,
}

// ---------------------------------------------------------------------------
// HybridSearchConfig
// ---------------------------------------------------------------------------

/// Knobs that control which retrieval legs are enabled and their relative
/// contribution to the fused ranking.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridSearchConfig {
    pub enable_semantic: bool,
    pub enable_text: bool,
    pub text_weight: f64,
    pub semantic_weight: f64,
    /// Minimum cosine similarity to include a semantic result.
    pub semantic_threshold: f64,
}

impl Default for HybridSearchConfig {
    fn default() -> Self {
        Self {
            enable_semantic: true,
            enable_text: true,
            text_weight: 1.0,
            semantic_weight: 0.8,
            semantic_threshold: 0.3,
        }
    }
}

// ---------------------------------------------------------------------------
// HybridSearcher
// ---------------------------------------------------------------------------

pub struct HybridSearcher {
    pub reranker: super::reranker::Reranker,
}

impl HybridSearcher {
    pub fn new() -> Self {
        Self {
            reranker: super::reranker::Reranker::with_defaults(),
        }
    }

    // -- Intent classification ------------------------------------------------

    /// Inspect a `ParsedQuery` and decide what kind of search the user wants.
    pub fn classify_intent(parsed: &super::query_parser::ParsedQuery) -> SearchIntent {
        let raw = parsed.intent.as_deref().unwrap_or("").to_lowercase();
        let keywords_lower: Vec<String> = parsed.keywords.iter().map(|k| k.to_lowercase()).collect();
        let joined = keywords_lower.join(" ");

        // "similar", "like", "resembl" anywhere in intent or keywords → FindSimilar
        let similar_hints = ["similar", "like", "resembl"];
        for hint in &similar_hints {
            if raw.contains(hint) || joined.contains(hint) {
                return SearchIntent::FindSimilar;
            }
        }

        // Has metadata filters → FindByMetadata
        let meta = &parsed.metadata;
        if meta.file_type.is_some()
            || meta.size.is_some()
            || meta.date.is_some()
            || !meta.extensions.is_empty()
        {
            return SearchIntent::FindByMetadata;
        }

        // "photos of", "images of", "pictures of" → FindByContent
        let content_hints = ["photos of", "images of", "pictures of"];
        for hint in &content_hints {
            if raw.contains(hint) || joined.contains(hint) {
                return SearchIntent::FindByContent;
            }
        }

        SearchIntent::General
    }

    // -- Fusion ---------------------------------------------------------------

    /// Fuse text (BM25F) and semantic (embedding) search results using RRF,
    /// applying intent-based weight adjustments.
    ///
    /// Returns at most `limit` results with `relevance_type` set to `"hybrid"`.
    pub fn fuse_results(
        &self,
        text_results: &[super::SearchResult],
        semantic_results: &[super::SearchResult],
        config: &HybridSearchConfig,
        intent: &SearchIntent,
        limit: usize,
    ) -> Vec<super::SearchResult> {
        // Apply intent-based multipliers.
        let (tw, sw) = Self::intent_weights(config, intent);

        // Build scored lists: Vec<(path, weighted_score)>.
        let mut scored_lists: Vec<Vec<(String, f64)>> = Vec::new();

        if config.enable_text && !text_results.is_empty() {
            let list: Vec<(String, f64)> = text_results
                .iter()
                .map(|r| (r.path.clone(), r.score * tw))
                .collect();
            scored_lists.push(list);
        }

        if config.enable_semantic && !semantic_results.is_empty() {
            let list: Vec<(String, f64)> = semantic_results
                .iter()
                .map(|r| (r.path.clone(), r.score * sw))
                .collect();
            scored_lists.push(list);
        }

        if scored_lists.is_empty() {
            return Vec::new();
        }

        // RRF fusion via the reranker.
        let fused = self.reranker.rrf_fuse_with_scores(&scored_lists);

        // Build lookup maps for merging matches from both sources.
        let text_map: HashMap<&str, &super::SearchResult> =
            text_results.iter().map(|r| (r.path.as_str(), r)).collect();
        let sem_map: HashMap<&str, &super::SearchResult> =
            semantic_results.iter().map(|r| (r.path.as_str(), r)).collect();

        let mut out: Vec<super::SearchResult> = Vec::with_capacity(limit.min(fused.len()));

        for (path, fused_score) in fused.into_iter().take(limit) {
            let text_hit = text_map.get(path.as_str());
            let sem_hit = sem_map.get(path.as_str());

            // Merge matches from both sources.
            let mut matches: Vec<super::SearchMatch> = Vec::new();
            if let Some(t) = text_hit {
                matches.extend(t.matches.iter().cloned());
            }
            if let Some(s) = sem_hit {
                for m in &s.matches {
                    // Avoid duplicating identical matches.
                    if !matches.iter().any(|existing| {
                        existing.token == m.token && existing.line_number == m.line_number
                    }) {
                        matches.push(m.clone());
                    }
                }
            }

            // Prefer snippet from text hit, fall back to semantic.
            let snippet = text_hit
                .and_then(|t| t.snippet.clone())
                .or_else(|| sem_hit.and_then(|s| s.snippet.clone()));

            // Extract filename from path.
            let filename = Path::new(&path)
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_default();

            out.push(super::SearchResult {
                path,
                filename,
                matches,
                score: fused_score,
                relevance_type: "hybrid".to_string(),
                snippet,
            });
        }

        out
    }

    /// Compute effective (text_weight, semantic_weight) after intent multipliers.
    fn intent_weights(config: &HybridSearchConfig, intent: &SearchIntent) -> (f64, f64) {
        match intent {
            SearchIntent::General => (config.text_weight, config.semantic_weight),
            SearchIntent::FindSimilar => (config.text_weight, config.semantic_weight * 1.5),
            SearchIntent::FindByMetadata => (config.text_weight * 1.5, config.semantic_weight),
            SearchIntent::FindByContent => (config.text_weight, config.semantic_weight * 1.3),
        }
    }
}

// ---------------------------------------------------------------------------
// Embedding search (no HTTP — operates on pre-loaded embeddings)
// ---------------------------------------------------------------------------

/// Search pre-loaded embedding entries by cosine similarity to `query_embedding`.
///
/// Results are deduplicated by file path (best chunk per file), filtered by
/// `threshold`, and limited to `limit` items.  Each result has
/// `relevance_type` set to `"semantic"`.
pub fn search_embeddings(
    query_embedding: &[f32],
    entries: &[EmbeddingEntry],
    limit: usize,
    threshold: f64,
) -> Vec<super::SearchResult> {
    if entries.is_empty() || query_embedding.is_empty() {
        return Vec::new();
    }

    // Parallel cosine similarity computation.
    let scored: Vec<(&EmbeddingEntry, f64)> = entries
        .par_iter()
        .map(|e| {
            let sim = cosine_similarity(query_embedding, &e.embedding);
            (e, sim)
        })
        .filter(|(_, sim)| *sim >= threshold)
        .collect();

    // Deduplicate by path — keep the chunk with the highest similarity.
    let mut best_per_path: HashMap<&str, (&EmbeddingEntry, f64)> = HashMap::new();
    for (entry, sim) in &scored {
        let key = entry.path.as_str();
        match best_per_path.get(key) {
            Some((_, existing_sim)) if *existing_sim >= *sim => {}
            _ => {
                best_per_path.insert(key, (entry, *sim));
            }
        }
    }

    // Sort descending by similarity.
    let mut ranked: Vec<(&EmbeddingEntry, f64)> = best_per_path.into_values().collect();
    ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    ranked.truncate(limit);

    ranked
        .into_iter()
        .map(|(entry, sim)| {
            let filename = Path::new(&entry.path)
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_default();

            super::SearchResult {
                path: entry.path.clone(),
                filename,
                matches: vec![super::SearchMatch {
                    token: entry.chunk_text.clone(),
                    context: format!("Semantic match (similarity: {:.3})", sim),
                    line_number: None,
                }],
                score: sim,
                relevance_type: "semantic".to_string(),
                snippet: Some(entry.chunk_text.clone()),
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Disk loading
// ---------------------------------------------------------------------------

/// Load persisted embeddings from `~/.local/share/xplorer/vector_embeddings.json`.
///
/// Returns an empty vec on any I/O or parse error (graceful degradation).
pub fn load_embeddings_from_disk() -> Vec<EmbeddingEntry> {
    let path = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("xplorer")
        .join("vector_embeddings.json");

    match std::fs::read_to_string(&path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

// ---------------------------------------------------------------------------
// Late-interaction reranking (Tier 2c)
// ---------------------------------------------------------------------------

/// Rescore results using token-level overlap between query tokens and document
/// content.  For each result whose path appears in `doc_content`, compute:
///
///   overlap_score = (# query tokens found in document) / query_tokens.len()
///
/// Then add `0.2 * overlap_score` to the result's score and re-sort descending.
pub fn late_interaction_rescore(
    results: &mut Vec<super::SearchResult>,
    query_tokens: &[String],
    doc_content: &HashMap<String, String>,
) {
    if query_tokens.is_empty() {
        return;
    }

    let token_count = query_tokens.len() as f64;

    for result in results.iter_mut() {
        if let Some(content) = doc_content.get(&result.path) {
            let content_lower = content.to_lowercase();
            let hits = query_tokens
                .iter()
                .filter(|t| content_lower.contains(&t.to_lowercase()))
                .count() as f64;
            let overlap_score = hits / token_count;
            result.score += 0.2 * overlap_score;
        }
    }

    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // Helpers ----------------------------------------------------------------

    fn make_parsed(intent: &str, keywords: &[&str], has_metadata: bool) -> super::super::query_parser::ParsedQuery {
        use super::super::query_parser::{ParsedQuery, MetadataFilters};
        let metadata = if has_metadata {
            MetadataFilters {
                file_type: Some(super::super::FileTypeCategory::Documents),
                size: None,
                date: None,
                extensions: vec![],
                sort_hint: super::super::query_parser::SortHint::None,
            }
        } else {
            MetadataFilters::default()
        };
        ParsedQuery {
            raw_query: keywords.join(" "),
            keywords: keywords.iter().map(|s| s.to_string()).collect(),
            stemmed_keywords: vec![],
            phrases: vec![],
            negations: vec![],
            field_filters: vec![],
            metadata,
            intent: if intent.is_empty() { None } else { Some(intent.to_string()) },
        }
    }

    fn make_search_result(path: &str, score: f64) -> super::super::SearchResult {
        let filename = Path::new(path)
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();
        super::super::SearchResult {
            path: path.to_string(),
            filename,
            matches: vec![],
            score,
            relevance_type: "text".to_string(),
            snippet: None,
        }
    }

    fn make_embedding(path: &str, chunk_id: usize, text: &str, embedding: Vec<f32>) -> EmbeddingEntry {
        EmbeddingEntry {
            path: path.to_string(),
            chunk_id,
            chunk_text: text.to_string(),
            embedding,
            model: "test".to_string(),
        }
    }

    // Intent classification --------------------------------------------------

    #[test]
    fn test_classify_intent_general() {
        let parsed = make_parsed("search", &["hello", "world"], false);
        assert_eq!(HybridSearcher::classify_intent(&parsed), SearchIntent::General);
    }

    #[test]
    fn test_classify_intent_similar() {
        let parsed = make_parsed("find similar", &["sunset", "photo"], false);
        assert_eq!(HybridSearcher::classify_intent(&parsed), SearchIntent::FindSimilar);

        // Also via keywords.
        let parsed2 = make_parsed("search", &["files", "like", "this"], false);
        assert_eq!(HybridSearcher::classify_intent(&parsed2), SearchIntent::FindSimilar);

        // "resembl" prefix.
        let parsed3 = make_parsed("search", &["resembling", "a", "cat"], false);
        assert_eq!(HybridSearcher::classify_intent(&parsed3), SearchIntent::FindSimilar);
    }

    #[test]
    fn test_classify_intent_metadata() {
        let parsed = make_parsed("search", &["large", "pdf"], true);
        assert_eq!(HybridSearcher::classify_intent(&parsed), SearchIntent::FindByMetadata);
    }

    #[test]
    fn test_classify_intent_content() {
        let parsed = make_parsed("search", &["photos", "of", "dogs"], false);
        assert_eq!(HybridSearcher::classify_intent(&parsed), SearchIntent::FindByContent);

        let parsed2 = make_parsed("find images of cats", &["cats"], false);
        assert_eq!(HybridSearcher::classify_intent(&parsed2), SearchIntent::FindByContent);

        let parsed3 = make_parsed("search", &["pictures", "of", "mountains"], false);
        assert_eq!(HybridSearcher::classify_intent(&parsed3), SearchIntent::FindByContent);
    }

    // Cosine similarity ------------------------------------------------------

    #[test]
    fn test_cosine_similarity_identical() {
        let v = vec![1.0_f32, 2.0, 3.0];
        let sim = cosine_similarity(&v, &v);
        assert!((sim - 1.0).abs() < 1e-6, "identical vectors should have similarity ~1.0, got {sim}");
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0_f32, 0.0, 0.0];
        let b = vec![0.0_f32, 1.0, 0.0];
        let sim = cosine_similarity(&a, &b);
        assert!(sim.abs() < 1e-6, "orthogonal vectors should have similarity ~0.0, got {sim}");
    }

    // Fusion -----------------------------------------------------------------

    #[test]
    fn test_fuse_results_basic() {
        let searcher = HybridSearcher::new();
        let config = HybridSearchConfig::default();
        let intent = SearchIntent::General;

        let text = vec![
            make_search_result("/a/foo.txt", 0.9),
            make_search_result("/a/bar.txt", 0.7),
        ];
        let semantic = vec![
            make_search_result("/a/bar.txt", 0.95),
            make_search_result("/a/baz.txt", 0.6),
        ];

        let fused = searcher.fuse_results(&text, &semantic, &config, &intent, 10);

        // All three unique paths should appear.
        assert_eq!(fused.len(), 3);

        // Every result should be marked "hybrid".
        for r in &fused {
            assert_eq!(r.relevance_type, "hybrid");
        }

        // bar.txt appears in both sources — it should be ranked high.
        let bar_pos = fused.iter().position(|r| r.path == "/a/bar.txt");
        assert!(bar_pos.is_some(), "bar.txt should appear in fused results");
    }

    // Embedding search -------------------------------------------------------

    #[test]
    fn test_search_embeddings_threshold_filtering() {
        let query = vec![1.0_f32, 0.0, 0.0];

        let entries = vec![
            make_embedding("/high.txt", 0, "high match", vec![0.95, 0.05, 0.0]),
            make_embedding("/low.txt", 0, "low match", vec![0.0, 0.0, 1.0]), // orthogonal
            make_embedding("/mid.txt", 0, "mid match", vec![0.7, 0.7, 0.0]),
        ];

        let results = search_embeddings(&query, &entries, 10, 0.5);

        // /low.txt should be filtered out (similarity ~0).
        assert!(
            !results.iter().any(|r| r.path == "/low.txt"),
            "low similarity entry should be excluded"
        );

        // /high.txt should appear.
        assert!(
            results.iter().any(|r| r.path == "/high.txt"),
            "high similarity entry should be included"
        );

        // All included results should have relevance_type "semantic".
        for r in &results {
            assert_eq!(r.relevance_type, "semantic");
        }
    }

    // Late-interaction rescore -----------------------------------------------

    #[test]
    fn test_late_interaction_rescore() {
        let mut results = vec![
            make_search_result("/a.txt", 1.0),
            make_search_result("/b.txt", 0.9),
        ];

        let query_tokens = vec!["hello".to_string(), "world".to_string()];

        let mut doc_content = HashMap::new();
        // /b.txt contains both tokens; /a.txt contains neither.
        doc_content.insert("/a.txt".to_string(), "nothing relevant here".to_string());
        doc_content.insert("/b.txt".to_string(), "hello world is a greeting".to_string());

        late_interaction_rescore(&mut results, &query_tokens, &doc_content);

        // /b.txt should now be ranked first because it got the full overlap bonus.
        assert_eq!(results[0].path, "/b.txt");

        // /b.txt's score should have increased by 0.2 * (2/2) = 0.2 → 1.1.
        assert!((results[0].score - 1.1).abs() < 1e-6, "expected 1.1, got {}", results[0].score);

        // /a.txt should remain at 1.0 (0 overlap → +0.0).
        assert!((results[1].score - 1.0).abs() < 1e-6, "expected 1.0, got {}", results[1].score);
    }
}
