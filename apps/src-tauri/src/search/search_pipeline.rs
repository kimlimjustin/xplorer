// Xplorer Search Engine — Search Pipeline Stages
//
// Extracted from `index.rs`'s monolithic `search()` function to improve
// testability and maintainability. Each stage operates on shared state
// (doc_scores, doc_matched_terms) and the SearchIndex.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use super::bm25f::{FieldTermFreqs, SearchField};
use super::index::DocId;
use super::query_parser::ParsedQuery;
use super::reranker::{path_depth, RankingSignals, Reranker};
use super::{SearchMatch, SearchResult};

use dashmap::DashMap;
use super::index::PostingEntry;

/// Intermediate search state threaded through the pipeline stages.
pub(crate) struct SearchState {
    /// BM25F scores per document.
    pub doc_scores: HashMap<DocId, f64>,
    /// Terms that matched each document (for building SearchMatch).
    pub doc_matched_terms: HashMap<DocId, Vec<String>>,
}

impl SearchState {
    pub fn new() -> Self {
        Self {
            doc_scores: HashMap::new(),
            doc_matched_terms: HashMap::new(),
        }
    }
}

/// Parse the raw query string and expand keywords with stemming + synonyms.
///
/// Returns the parsed query and the final list of expanded (stemmed + synonym)
/// terms to search for.
pub(crate) fn parse_and_expand_query(query: &str) -> (ParsedQuery, Vec<String>) {
    let parsed = super::query_parser::parse(query);
    let stemmer = super::stemmer::default_stemmer();
    let stemmed = stemmer.stem_tokens(&parsed.keywords);
    let expanded = super::synonyms::expand_query(&stemmed);
    (parsed, expanded)
}

/// Score documents via BM25F using the expanded terms.
///
/// For each term, looks up the postings, computes per-document BM25F scores,
/// and accumulates them into `state.doc_scores`.
pub(crate) fn score_documents(
    state: &mut SearchState,
    expanded: &[String],
    postings: &DashMap<String, Vec<PostingEntry>>,
    doc_field_lengths: &HashMap<DocId, HashMap<SearchField, u32>>,
    scorer: &super::bm25f::Bm25fScorer,
    doc_frequency_fn: &dyn Fn(&str) -> usize,
) {
    for term in expanded {
        if let Some(entries) = postings.get(term) {
            let df = doc_frequency_fn(term);

            // Accumulate FieldTermFreqs per document for this term
            let mut doc_ftfs: HashMap<DocId, FieldTermFreqs> = HashMap::new();
            for entry in entries.value() {
                let ftf = doc_ftfs.entry(entry.doc_id).or_default();
                let field_len = doc_field_lengths
                    .get(&entry.doc_id)
                    .and_then(|m| m.get(&entry.field))
                    .copied()
                    .unwrap_or(1);
                ftf.add(entry.field, entry.tf, field_len);
            }

            for (doc_id, ftf) in &doc_ftfs {
                let score = scorer.score_term(df, ftf);
                *state.doc_scores.entry(*doc_id).or_insert(0.0) += score;
                state
                    .doc_matched_terms
                    .entry(*doc_id)
                    .or_default()
                    .push(term.clone());
            }
        }
    }
}

/// Remove documents matching negation terms from the result set.
pub(crate) fn apply_negations(
    state: &mut SearchState,
    negations: &[String],
    postings: &DashMap<String, Vec<PostingEntry>>,
    stemmer: &super::stemmer::SearchStemmer,
) {
    for neg_term in negations {
        let neg_stemmed = stemmer.stem_word(neg_term);
        if let Some(entries) = postings.get(&neg_stemmed) {
            for entry in entries.value() {
                state.doc_scores.remove(&entry.doc_id);
                state.doc_matched_terms.remove(&entry.doc_id);
            }
        }
        // Also check the unstemmed form
        if let Some(entries) = postings.get(neg_term) {
            for entry in entries.value() {
                state.doc_scores.remove(&entry.doc_id);
                state.doc_matched_terms.remove(&entry.doc_id);
            }
        }
    }
}

/// Filter documents by metadata (file type, size, date, extensions) using
/// the bitmap index.
pub(crate) fn apply_metadata_filters(
    state: &mut SearchState,
    parsed: &ParsedQuery,
    bitmap_index: &super::bitmap_filters::BitmapFilterIndex,
) {
    if parsed.metadata.file_type.is_some()
        || parsed.metadata.size.is_some()
        || parsed.metadata.date.is_some()
        || !parsed.metadata.extensions.is_empty()
    {
        let allowed = bitmap_index.apply_filters(
            None,
            parsed.metadata.file_type,
            parsed.metadata.size.as_ref(),
            parsed.metadata.date.as_ref(),
            &parsed.metadata.extensions,
        );

        state
            .doc_scores
            .retain(|doc_id, _| allowed.contains(*doc_id));
    }
}

/// Apply phrase filtering using the positional index. Handles two cases:
/// - Phrase + keywords: intersect doc_scores with phrase matches.
/// - Phrase-only query: seed doc_scores from phrase results.
///
/// Scores phrase constituent words via BM25F so results get proper ranking.
pub(crate) fn apply_phrase_filters(
    state: &mut SearchState,
    phrases: &[String],
    expanded: &[String],
    phrase_search_fn: &dyn Fn(&str) -> HashSet<DocId>,
    postings: &DashMap<String, Vec<PostingEntry>>,
    doc_field_lengths: &HashMap<DocId, HashMap<SearchField, u32>>,
    scorer: &super::bm25f::Bm25fScorer,
    doc_frequency_fn: &dyn Fn(&str) -> usize,
    word_regex: &regex::Regex,
) {
    if phrases.is_empty() {
        return;
    }

    let is_phrase_only = state.doc_scores.is_empty() && expanded.is_empty();

    for phrase in phrases {
        let phrase_docs = phrase_search_fn(phrase);

        if is_phrase_only {
            // Seed doc_scores with all phrase-matching documents.
            for &doc_id in &phrase_docs {
                state.doc_scores.entry(doc_id).or_insert(0.0);
            }
        } else {
            // Intersect: keep only documents that also match the phrase.
            state
                .doc_scores
                .retain(|doc_id, _| phrase_docs.contains(doc_id));
        }

        // Score phrase constituent words via BM25F so documents get
        // proper ranking (rather than all having score 0.0).
        let stemmer_ref = super::stemmer::default_stemmer();
        let phrase_keywords: Vec<String> = word_regex
            .find_iter(phrase)
            .map(|m| stemmer_ref.stem_word(&m.as_str().to_lowercase()))
            .filter(|s| s.len() >= 2)
            .collect();

        for term in &phrase_keywords {
            if let Some(entries) = postings.get(term) {
                let df = doc_frequency_fn(term);
                let mut doc_ftfs: HashMap<DocId, FieldTermFreqs> = HashMap::new();
                for entry in entries.value() {
                    if !state.doc_scores.contains_key(&entry.doc_id) {
                        continue;
                    }
                    let ftf = doc_ftfs.entry(entry.doc_id).or_default();
                    let field_len = doc_field_lengths
                        .get(&entry.doc_id)
                        .and_then(|m| m.get(&entry.field))
                        .copied()
                        .unwrap_or(1);
                    ftf.add(entry.field, entry.tf, field_len);
                }
                for (doc_id, ftf) in &doc_ftfs {
                    let score = scorer.score_term(df, ftf);
                    *state.doc_scores.entry(*doc_id).or_insert(0.0) += score;
                    state
                        .doc_matched_terms
                        .entry(*doc_id)
                        .or_default()
                        .push(term.clone());
                }
            }
        }
    }
}

/// Apply field filters (name:, ext:, path:, content:).
pub(crate) fn apply_field_filters(
    state: &mut SearchState,
    field_filters: &[super::query_parser::FieldFilter],
    documents: &HashMap<DocId, super::index::DocumentInfo>,
    doc_content: &HashMap<DocId, String>,
    stemmer: &super::stemmer::SearchStemmer,
) {
    for ff in field_filters {
        let value_lower = ff.value.to_lowercase();
        match ff.field.as_str() {
            "name" => {
                state.doc_scores.retain(|doc_id, _| {
                    documents
                        .get(doc_id)
                        .map(|d| d.filename.to_lowercase().contains(&value_lower))
                        .unwrap_or(false)
                });
            }
            "ext" => {
                state.doc_scores.retain(|doc_id, _| {
                    documents
                        .get(doc_id)
                        .map(|d| d.extension.to_lowercase() == value_lower)
                        .unwrap_or(false)
                });
            }
            "path" => {
                state.doc_scores.retain(|doc_id, _| {
                    documents
                        .get(doc_id)
                        .map(|d| d.path.to_lowercase().contains(&value_lower))
                        .unwrap_or(false)
                });
            }
            "content" => {
                let stemmed_val = stemmer.stem_word(&value_lower);
                state.doc_scores.retain(|doc_id, _| {
                    doc_content
                        .get(doc_id)
                        .map(|c| c.contains(&value_lower) || c.contains(&stemmed_val))
                        .unwrap_or(false)
                });
            }
            _ => {} // Unknown field filters are ignored.
        }
    }
}

/// Fuzzy search fallback: for expanded terms with no exact posting hits, use
/// the FST index to find close matches and merge their scores.
pub(crate) fn apply_fuzzy_fallback(
    state: &mut SearchState,
    expanded: &[String],
    postings: &DashMap<String, Vec<PostingEntry>>,
    doc_field_lengths: &HashMap<DocId, HashMap<SearchField, u32>>,
    scorer: &super::bm25f::Bm25fScorer,
    doc_frequency_fn: &dyn Fn(&str) -> usize,
    fst_index: &super::fuzzy::FstIndex,
) {
    let no_hit_terms: Vec<String> = expanded
        .iter()
        .filter(|t| !postings.contains_key(t.as_str()))
        .cloned()
        .collect();

    if no_hit_terms.is_empty() {
        return;
    }

    let fuzzy_matches = fst_index.fuzzy_search_multi(&no_hit_terms, 1);

    for matched_terms in fuzzy_matches.values() {
        for (matched_term, _offset) in matched_terms {
            if let Some(entries) = postings.get(matched_term) {
                let df = doc_frequency_fn(matched_term);

                let mut doc_ftfs: HashMap<DocId, FieldTermFreqs> = HashMap::new();
                for entry in entries.value() {
                    let ftf = doc_ftfs.entry(entry.doc_id).or_default();
                    let field_len = doc_field_lengths
                        .get(&entry.doc_id)
                        .and_then(|m| m.get(&entry.field))
                        .copied()
                        .unwrap_or(1);
                    ftf.add(entry.field, entry.tf, field_len);
                }

                for (doc_id, ftf) in &doc_ftfs {
                    // Fuzzy matches get a penalty (0.7x) to rank below exact matches
                    let score = scorer.score_term(df, ftf) * 0.7;
                    // Merge: take max score per document
                    let current = state.doc_scores.entry(*doc_id).or_insert(0.0);
                    if score > *current {
                        *current = score;
                    }
                    state
                        .doc_matched_terms
                        .entry(*doc_id)
                        .or_default()
                        .push(matched_term.clone());
                }
            }
        }
    }
}

/// Build ranking signals for each scored document and apply multi-signal
/// reranking. Returns a sorted vector of (path, score, signals).
pub(crate) fn rank_and_rerank(
    state: &SearchState,
    query: &str,
    stemmed: &[String],
    parsed: &ParsedQuery,
    documents: &HashMap<DocId, super::index::DocumentInfo>,
    reranker: &Reranker,
) -> Vec<(String, f64, RankingSignals)> {
    let now_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let query_lower = query.to_lowercase();
    let mut ranked: Vec<(String, f64, RankingSignals)> = state
        .doc_scores
        .iter()
        .filter_map(|(doc_id, &bm25f_score)| {
            let doc = documents.get(doc_id)?;
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

    reranker.rerank(&mut ranked);
    ranked
}

/// Assemble the final `SearchResult` vector from the ranked document list.
pub(crate) fn assemble_results(
    ranked: Vec<(String, f64, RankingSignals)>,
    limit: usize,
    doc_matched_terms: &HashMap<DocId, Vec<String>>,
    path_to_id: &HashMap<String, DocId>,
    doc_content: &HashMap<DocId, String>,
) -> Vec<SearchResult> {
    ranked
        .into_iter()
        .take(limit)
        .map(|(path, score, _signals)| {
            let filename = Path::new(&path)
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_default();

            let matches = doc_matched_terms
                .get(&path_to_id.get(&path).copied().unwrap_or(u32::MAX))
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

            let snippet = path_to_id
                .get(&path)
                .and_then(|id| doc_content.get(id))
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
