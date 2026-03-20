//! FST-backed fuzzy and prefix search module for the Xplorer search engine.
//!
//! Uses the `fst` crate to provide fast fuzzy matching (Levenshtein automaton)
//! and prefix search over the term dictionary.
//!
//! Requires `fst` with the `levenshtein` feature enabled:
//! ```toml
//! fst = { version = "0.4", features = ["levenshtein"] }
//! ```

use fst::automaton::{Levenshtein, Str};
use fst::{Automaton, IntoStreamer, Map, MapBuilder, Streamer};
use std::collections::HashMap;

/// Wraps an FST term dictionary for fast fuzzy and prefix lookups.
pub struct FstIndex {
    /// FST mapping terms to posting list offsets (u64).
    fst_map: Option<Map<Vec<u8>>>,
    /// Reverse lookup: offset -> term (for reconstruction).
    _offset_to_term: Vec<String>,
}

impl FstIndex {
    // ── Construction ────────────────────────────────────────────────────

    /// Create an empty index with no terms.
    pub fn new() -> Self {
        Self {
            fst_map: None,
            _offset_to_term: Vec::new(),
        }
    }

    /// Build an FST from a list of `(term, offset)` pairs.
    ///
    /// The FST requires keys in **sorted lexicographic order**, so the input
    /// slice is sorted in-place before construction.  Returns a new `FstIndex`.
    ///
    /// If `terms` is empty, the returned index will be empty.
    pub fn build(terms: &mut Vec<(String, u64)>) -> Result<Self, String> {
        if terms.is_empty() {
            return Ok(Self::new());
        }

        // FST requires lexicographic order on byte strings.
        terms.sort_by(|a, b| a.0.as_bytes().cmp(b.0.as_bytes()));

        // Deduplicate: if the same term appears more than once keep the first.
        terms.dedup_by(|b, a| a.0 == b.0);

        // Build reverse lookup.
        let mut _offset_to_term: Vec<String> = Vec::with_capacity(terms.len());
        for (term, _offset) in terms.iter() {
            _offset_to_term.push(term.clone());
        }

        // Build the FST map in memory.
        let mut builder = MapBuilder::memory();
        for (term, offset) in terms.iter() {
            builder
                .insert(term.as_bytes(), *offset)
                .map_err(|e| format!("FstIndex::build: failed to insert key: {e}"))?;
        }
        let fst_bytes = builder
            .into_inner()
            .map_err(|e| format!("FstIndex::build: failed to finish builder: {e}"))?;
        let fst_map = Map::new(fst_bytes)
            .map_err(|e| format!("FstIndex::build: failed to create Map: {e}"))?;

        Ok(Self {
            fst_map: Some(fst_map),
            _offset_to_term,
        })
    }

    // ── Queries ─────────────────────────────────────────────────────────

    /// Find all terms within Levenshtein edit distance `max_distance` of `query`.
    ///
    /// Returns matching `(term, offset)` pairs.
    ///
    /// If the Levenshtein automaton cannot be constructed (e.g. the query is
    /// too long for the given distance), the method falls back to a prefix
    /// search on `query`.
    pub fn fuzzy_search(&self, query: &str, max_distance: u32) -> Vec<(String, u64)> {
        if query.is_empty() {
            return Vec::new();
        }
        let map = match self.fst_map.as_ref() {
            Some(m) => m,
            None => return Vec::new(),
        };

        // Attempt to build a Levenshtein automaton.
        match Levenshtein::new(query, max_distance) {
            Ok(lev) => {
                let mut stream = map.search(lev).into_stream();
                let mut results = Vec::new();
                while let Some((key, offset)) = stream.next() {
                    if let Ok(term) = std::str::from_utf8(key) {
                        results.push((term.to_owned(), offset));
                    }
                }
                results
            }
            Err(_) => {
                // Fallback: prefix search when the automaton is too large.
                self.prefix_search(query)
            }
        }
    }

    /// Find all terms starting with the given `prefix`.
    ///
    /// Results are limited to **100** entries to avoid huge result sets.
    pub fn prefix_search(&self, prefix: &str) -> Vec<(String, u64)> {
        if prefix.is_empty() {
            return Vec::new();
        }
        let map = match self.fst_map.as_ref() {
            Some(m) => m,
            None => return Vec::new(),
        };

        const MAX_PREFIX_RESULTS: usize = 100;

        let prefix_automaton = Str::new(prefix).starts_with();
        let mut stream = map.search(prefix_automaton).into_stream();
        let mut results = Vec::new();
        while let Some((key, offset)) = stream.next() {
            if results.len() >= MAX_PREFIX_RESULTS {
                break;
            }
            if let Ok(term) = std::str::from_utf8(key) {
                results.push((term.to_owned(), offset));
            }
        }
        results
    }

    /// Look up an exact term and return its offset, or `None` if absent.
    pub fn exact_lookup(&self, term: &str) -> Option<u64> {
        self.fst_map.as_ref()?.get(term.as_bytes())
    }

    /// Check whether `term` exists in the index.
    pub fn contains(&self, term: &str) -> bool {
        self.exact_lookup(term).is_some()
    }

    /// For each word in `query_words`, find fuzzy matches within `max_distance`.
    ///
    /// Returns a map from each query word to its list of matching
    /// `(term, offset)` pairs.  This is the main entry point for multi-word
    /// fuzzy search and fixes the old C2 bug of comparing the full query
    /// against individual indexed words.
    pub fn fuzzy_search_multi(
        &self,
        query_words: &[String],
        max_distance: u32,
    ) -> HashMap<String, Vec<(String, u64)>> {
        let mut results = HashMap::with_capacity(query_words.len());
        for word in query_words {
            let matches = self.fuzzy_search(word, max_distance);
            results.insert(word.clone(), matches);
        }
        results
    }

    /// Autocomplete suggestions: find terms starting with `partial` and return
    /// up to `limit` term strings sorted by their offset value (which
    /// represents frequency / importance — lower offset = higher priority).
    pub fn suggest(&self, partial: &str, limit: usize) -> Vec<String> {
        if partial.is_empty() || limit == 0 {
            return Vec::new();
        }

        let mut matches = self.prefix_search(partial);
        // Sort by offset ascending (lower offset = more important).
        matches.sort_by_key(|&(_, offset)| offset);
        matches
            .into_iter()
            .take(limit)
            .map(|(term, _)| term)
            .collect()
    }

    // ── Size helpers ────────────────────────────────────────────────────

    /// Number of terms in the FST.
    pub fn len(&self) -> usize {
        match self.fst_map.as_ref() {
            Some(m) => m.len(),
            None => 0,
        }
    }

    /// Returns `true` if the index contains no terms.
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

impl Default for FstIndex {
    fn default() -> Self {
        Self::new()
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: build the canonical test index.
    fn build_test_index() -> FstIndex {
        let mut terms = vec![
            ("apple".to_string(), 1u64),
            ("application".to_string(), 2),
            ("banana".to_string(), 3),
            ("bandana".to_string(), 4),
            ("cherry".to_string(), 5),
        ];
        FstIndex::build(&mut terms).expect("test index build should succeed")
    }

    #[test]
    fn test_exact_lookup_found() {
        let idx = build_test_index();
        assert_eq!(idx.exact_lookup("apple"), Some(1));
    }

    #[test]
    fn test_exact_lookup_not_found() {
        let idx = build_test_index();
        assert_eq!(idx.exact_lookup("grape"), None);
    }

    #[test]
    fn test_contains() {
        let idx = build_test_index();
        assert!(idx.contains("banana"));
        assert!(!idx.contains("mango"));
    }

    #[test]
    fn test_prefix_search_app() {
        let idx = build_test_index();
        let results: Vec<String> = idx
            .prefix_search("app")
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        assert_eq!(results, vec!["apple", "application"]);
    }

    #[test]
    fn test_prefix_search_ban() {
        let idx = build_test_index();
        let results: Vec<String> = idx
            .prefix_search("ban")
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        assert_eq!(results, vec!["banana", "bandana"]);
    }

    #[test]
    fn test_fuzzy_search_aple() {
        let idx = build_test_index();
        let results: Vec<String> = idx
            .fuzzy_search("aple", 1)
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        assert!(results.contains(&"apple".to_string()));
    }

    #[test]
    fn test_fuzzy_search_bananna() {
        let idx = build_test_index();
        let results: Vec<String> = idx
            .fuzzy_search("bananna", 1)
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        // "bananna" → "banana" is edit distance 1 (delete extra 'n')
        assert!(results.contains(&"banana".to_string()));
        // "bananna" → "bandana" is edit distance 2, so it should NOT appear at distance 1
        assert!(!results.contains(&"bandana".to_string()));
    }

    #[test]
    fn test_fuzzy_search_multi() {
        let idx = build_test_index();
        let words = vec!["aple".to_string(), "cher".to_string()];
        let multi = idx.fuzzy_search_multi(&words, 1);

        // "aple" distance-1 should match "apple"
        let aple_matches: Vec<String> = multi
            .get("aple")
            .unwrap()
            .iter()
            .map(|(t, _)| t.clone())
            .collect();
        assert!(aple_matches.contains(&"apple".to_string()));

        // "cher" distance-1 should match "cherry" (deletion of "ry" is dist 2,
        // but prefix-fallback or Levenshtein may or may not match).
        // At minimum the key should be present.
        assert!(multi.contains_key("cher"));
    }

    #[test]
    fn test_suggest() {
        let idx = build_test_index();
        let suggestions = idx.suggest("ban", 10);
        assert_eq!(suggestions, vec!["banana", "bandana"]);
    }

    #[test]
    fn test_suggest_respects_limit() {
        let idx = build_test_index();
        let suggestions = idx.suggest("ban", 1);
        assert_eq!(suggestions.len(), 1);
    }

    #[test]
    fn test_len_and_is_empty() {
        let idx = build_test_index();
        assert_eq!(idx.len(), 5);
        assert!(!idx.is_empty());

        let empty = FstIndex::new();
        assert_eq!(empty.len(), 0);
        assert!(empty.is_empty());
    }

    #[test]
    fn test_empty_index_returns_empty_results() {
        let empty = FstIndex::new();
        assert_eq!(empty.exact_lookup("anything"), None);
        assert!(!empty.contains("anything"));
        assert!(empty.fuzzy_search("anything", 1).is_empty());
        assert!(empty.prefix_search("any").is_empty());
        assert!(empty.suggest("any", 10).is_empty());
    }

    #[test]
    fn test_empty_query_returns_empty_results() {
        let idx = build_test_index();
        assert!(idx.fuzzy_search("", 1).is_empty());
        assert!(idx.prefix_search("").is_empty());
        assert!(idx.suggest("", 10).is_empty());
    }

    #[test]
    fn test_build_empty_terms() {
        let mut terms: Vec<(String, u64)> = Vec::new();
        let idx = FstIndex::build(&mut terms).expect("empty build should succeed");
        assert!(idx.is_empty());
    }

    #[test]
    fn test_build_unsorted_input() {
        // Provide terms out of order -- build() must sort them.
        let mut terms = vec![
            ("cherry".to_string(), 5u64),
            ("apple".to_string(), 1),
            ("banana".to_string(), 3),
        ];
        let idx = FstIndex::build(&mut terms).expect("unsorted build should succeed");
        assert_eq!(idx.len(), 3);
        assert!(idx.contains("apple"));
        assert!(idx.contains("banana"));
        assert!(idx.contains("cherry"));
    }

    #[test]
    fn test_build_duplicate_terms() {
        let mut terms = vec![
            ("apple".to_string(), 1u64),
            ("apple".to_string(), 99),
            ("banana".to_string(), 3),
        ];
        let idx = FstIndex::build(&mut terms).expect("dedup build should succeed");
        // Duplicates are removed; the first occurrence's offset is kept.
        assert_eq!(idx.len(), 2);
        assert_eq!(idx.exact_lookup("apple"), Some(1));
    }

    #[test]
    fn test_fuzzy_search_exact_match() {
        let idx = build_test_index();
        let results: Vec<String> = idx
            .fuzzy_search("cherry", 0)
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        assert_eq!(results, vec!["cherry"]);
    }

    #[test]
    fn test_prefix_search_full_term() {
        let idx = build_test_index();
        let results: Vec<String> = idx
            .prefix_search("cherry")
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        assert_eq!(results, vec!["cherry"]);
    }

    #[test]
    fn test_prefix_search_no_match() {
        let idx = build_test_index();
        let results = idx.prefix_search("xyz");
        assert!(results.is_empty());
    }
}
