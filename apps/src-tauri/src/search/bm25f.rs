// BM25F field-weighted scoring engine for Xplorer search.
//
// BM25F extends BM25 by treating documents as having multiple fields
// (filename, path, content head, content body, AI description) with
// different boost weights. Term frequencies from different fields are
// boosted and combined before computing a single BM25 score per term.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// SearchField
// ---------------------------------------------------------------------------

/// Represents which field a term was found in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SearchField {
    /// Exact filename match (highest boost).
    FilenameExact,
    /// Filename after stemming / splitting.
    FilenameStem,
    /// Directory names in the file path.
    PathComponent,
    /// First ~1 KB of content (titles, headers).
    ContentHead,
    /// Rest of file content.
    ContentBody,
    /// AI-generated description / tags.
    AiDescription,
}

impl SearchField {
    /// Returns all field variants in a deterministic order.
    pub fn all() -> &'static [SearchField] {
        &[
            SearchField::FilenameExact,
            SearchField::FilenameStem,
            SearchField::PathComponent,
            SearchField::ContentHead,
            SearchField::ContentBody,
            SearchField::AiDescription,
        ]
    }
}

// ---------------------------------------------------------------------------
// Bm25fConfig
// ---------------------------------------------------------------------------

/// Configuration for BM25F scoring.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bm25fConfig {
    /// Term saturation parameter (default 1.2).
    pub k1: f64,
    /// Global length normalization factor (default 0.75).
    pub b: f64,
    /// Per-field boost weights.
    pub field_boosts: HashMap<SearchField, f64>,
    /// Per-field length normalization overrides.
    pub field_b: HashMap<SearchField, f64>,
}

impl Default for Bm25fConfig {
    fn default() -> Self {
        let mut field_boosts = HashMap::new();
        field_boosts.insert(SearchField::FilenameExact, 15.0);
        field_boosts.insert(SearchField::FilenameStem, 10.0);
        field_boosts.insert(SearchField::PathComponent, 3.0);
        field_boosts.insert(SearchField::ContentHead, 2.0);
        field_boosts.insert(SearchField::ContentBody, 1.0);
        field_boosts.insert(SearchField::AiDescription, 2.0);

        let mut field_b = HashMap::new();
        field_b.insert(SearchField::FilenameExact, 0.0);
        field_b.insert(SearchField::FilenameStem, 0.1);
        field_b.insert(SearchField::PathComponent, 0.2);
        field_b.insert(SearchField::ContentHead, 0.5);
        field_b.insert(SearchField::ContentBody, 0.75);
        field_b.insert(SearchField::AiDescription, 0.5);

        Self {
            k1: 1.2,
            b: 0.75,
            field_boosts,
            field_b,
        }
    }
}

// ---------------------------------------------------------------------------
// FieldTermFreqs
// ---------------------------------------------------------------------------

/// Accumulates field-weighted term frequencies for a single document.
pub struct FieldTermFreqs {
    /// Raw term frequency per field.
    field_tfs: HashMap<SearchField, u32>,
    /// Document length (in tokens) per field.
    field_lengths: HashMap<SearchField, u32>,
}

impl FieldTermFreqs {
    /// Create an empty accumulator.
    pub fn new() -> Self {
        Self {
            field_tfs: HashMap::new(),
            field_lengths: HashMap::new(),
        }
    }

    /// Record term frequency `tf` in the given `field`, which has
    /// `field_length` total tokens.
    pub fn add(&mut self, field: SearchField, tf: u32, field_length: u32) {
        self.field_tfs.insert(field, tf);
        self.field_lengths.insert(field, field_length);
    }

    /// Compute the combined boosted term-frequency across all fields:
    ///
    /// ```text
    /// tf_BM25F = Σ_f  (boost_f × tf_f) / (1 + b_f × (dl_f / avgdl_f − 1))
    /// ```
    ///
    /// Fields that were not added contribute zero.
    pub fn boosted_tf(
        &self,
        config: &Bm25fConfig,
        avg_field_lengths: &HashMap<SearchField, f64>,
    ) -> f64 {
        let mut combined = 0.0_f64;

        for field in SearchField::all() {
            let tf = match self.field_tfs.get(field) {
                Some(&t) => t as f64,
                None => continue,
            };

            let boost = config.field_boosts.get(field).copied().unwrap_or(1.0);
            let b_f = config.field_b.get(field).copied().unwrap_or(config.b);
            let dl = self.field_lengths.get(field).copied().unwrap_or(0) as f64;
            let avgdl = avg_field_lengths
                .get(field)
                .copied()
                .unwrap_or(1.0)
                .max(1.0);

            let numerator = boost * tf;
            let denominator = 1.0 + b_f * (dl / avgdl - 1.0);

            // Guard against non-positive denominators (shouldn't happen with
            // valid config, but be defensive).
            if denominator > 0.0 {
                combined += numerator / denominator;
            } else {
                combined += numerator;
            }
        }

        combined
    }

    /// Returns `true` if no field frequencies have been recorded.
    pub fn is_empty(&self) -> bool {
        self.field_tfs.is_empty()
    }
}

impl Default for FieldTermFreqs {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Bm25fScorer
// ---------------------------------------------------------------------------

/// Main BM25F scorer.  Holds corpus-level statistics and config.
pub struct Bm25fScorer {
    config: Bm25fConfig,
    num_docs: usize,
    avg_field_lengths: HashMap<SearchField, f64>,
}

impl Bm25fScorer {
    /// Construct a scorer with the given config and corpus statistics.
    ///
    /// * `config` — BM25F parameters and per-field boosts.
    /// * `num_docs` — total number of documents in the corpus.
    /// * `avg_field_lengths` — average token count per field across the corpus.
    pub fn new(
        config: Bm25fConfig,
        num_docs: usize,
        avg_field_lengths: HashMap<SearchField, f64>,
    ) -> Self {
        Self {
            config,
            num_docs,
            avg_field_lengths,
        }
    }

    /// Compute the BM25F score for a single query term.
    ///
    /// * `df` — document frequency (number of documents containing the term).
    /// * `field_tfs` — per-field term frequencies for the candidate document.
    ///
    /// ```text
    /// IDF = ln((N − df + 0.5) / (df + 0.5) + 1)
    /// score = IDF × tf_BM25F / (k1 + tf_BM25F)
    /// ```
    pub fn score_term(&self, df: usize, field_tfs: &FieldTermFreqs) -> f64 {
        if field_tfs.is_empty() {
            return 0.0;
        }

        let n = self.num_docs as f64;
        let df_f = df as f64;

        // IDF using the Robertson–Spärck Jones formula with +1 floor.
        let idf = ((n - df_f + 0.5) / (df_f + 0.5) + 1.0).ln();

        let tf_bm25f = field_tfs.boosted_tf(&self.config, &self.avg_field_lengths);

        idf * tf_bm25f / (self.config.k1 + tf_bm25f)
    }

    /// Compute the total BM25F score for a document across all query terms.
    ///
    /// * `query_terms` — slice of `(term, df)` pairs.
    /// * `doc_field_tfs` — map from term → per-field frequencies for this document.
    pub fn score_document(
        &self,
        query_terms: &[(String, usize)],
        doc_field_tfs: &HashMap<String, FieldTermFreqs>,
    ) -> f64 {
        let mut total = 0.0_f64;

        for (term, df) in query_terms {
            if let Some(ftf) = doc_field_tfs.get(term) {
                total += self.score_term(*df, ftf);
            }
        }

        total
    }

    /// Update corpus statistics after an index change (e.g. new files indexed).
    pub fn update_stats(&mut self, num_docs: usize, avg_field_lengths: HashMap<SearchField, f64>) {
        self.num_docs = num_docs;
        self.avg_field_lengths = avg_field_lengths;
    }

    /// Read-only access to the current config.
    pub fn config(&self) -> &Bm25fConfig {
        &self.config
    }

    /// Number of documents in the corpus.
    pub fn num_docs(&self) -> usize {
        self.num_docs
    }

    /// Average field lengths across the corpus.
    pub fn avg_field_lengths(&self) -> &HashMap<SearchField, f64> {
        &self.avg_field_lengths
    }
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: build a scorer with 10 000 docs and reasonable avg field lengths.
    fn make_scorer() -> Bm25fScorer {
        let config = Bm25fConfig::default();
        let mut avg = HashMap::new();
        avg.insert(SearchField::FilenameExact, 2.0);
        avg.insert(SearchField::FilenameStem, 3.0);
        avg.insert(SearchField::PathComponent, 4.0);
        avg.insert(SearchField::ContentHead, 50.0);
        avg.insert(SearchField::ContentBody, 500.0);
        avg.insert(SearchField::AiDescription, 20.0);
        Bm25fScorer::new(config, 10_000, avg)
    }

    // ----- Config defaults ---------------------------------------------------

    #[test]
    fn default_config_has_correct_boost_values() {
        let cfg = Bm25fConfig::default();
        assert!((cfg.k1 - 1.2).abs() < f64::EPSILON);
        assert!((cfg.b - 0.75).abs() < f64::EPSILON);

        assert_eq!(
            *cfg.field_boosts.get(&SearchField::FilenameExact).unwrap(),
            15.0
        );
        assert_eq!(
            *cfg.field_boosts.get(&SearchField::FilenameStem).unwrap(),
            10.0
        );
        assert_eq!(
            *cfg.field_boosts.get(&SearchField::PathComponent).unwrap(),
            3.0
        );
        assert_eq!(
            *cfg.field_boosts.get(&SearchField::ContentHead).unwrap(),
            2.0
        );
        assert_eq!(
            *cfg.field_boosts.get(&SearchField::ContentBody).unwrap(),
            1.0
        );
        assert_eq!(
            *cfg.field_boosts.get(&SearchField::AiDescription).unwrap(),
            2.0
        );

        assert_eq!(*cfg.field_b.get(&SearchField::FilenameExact).unwrap(), 0.0);
        assert_eq!(*cfg.field_b.get(&SearchField::FilenameStem).unwrap(), 0.1);
        assert_eq!(*cfg.field_b.get(&SearchField::PathComponent).unwrap(), 0.2);
        assert_eq!(*cfg.field_b.get(&SearchField::ContentHead).unwrap(), 0.5);
        assert_eq!(*cfg.field_b.get(&SearchField::ContentBody).unwrap(), 0.75);
        assert_eq!(*cfg.field_b.get(&SearchField::AiDescription).unwrap(), 0.5);
    }

    // ----- Filename match > content-only match --------------------------------

    #[test]
    fn filename_match_scores_higher_than_content_only() {
        let scorer = make_scorer();

        // Document A: term found in FilenameExact only.
        let mut ftf_filename = FieldTermFreqs::new();
        ftf_filename.add(SearchField::FilenameExact, 1, 2);

        // Document B: term found in ContentBody only.
        let mut ftf_content = FieldTermFreqs::new();
        ftf_content.add(SearchField::ContentBody, 1, 500);

        let df = 100; // moderately common term
        let score_filename = scorer.score_term(df, &ftf_filename);
        let score_content = scorer.score_term(df, &ftf_content);

        assert!(
            score_filename > score_content,
            "filename score ({score_filename}) should exceed content score ({score_content})"
        );
    }

    // ----- IDF higher for rare terms -----------------------------------------

    #[test]
    fn idf_higher_for_rare_terms() {
        let scorer = make_scorer();

        let mut ftf = FieldTermFreqs::new();
        ftf.add(SearchField::ContentBody, 1, 500);

        let score_rare = scorer.score_term(5, &ftf); // df = 5 (rare)
        let score_common = scorer.score_term(5_000, &ftf); // df = 5000 (common)

        assert!(
            score_rare > score_common,
            "rare term score ({score_rare}) should exceed common term score ({score_common})"
        );
    }

    // ----- BM25+ property: document with term always scores > 0 ---------------

    #[test]
    fn document_with_term_always_scores_positive() {
        let scorer = make_scorer();

        for &field in SearchField::all() {
            let mut ftf = FieldTermFreqs::new();
            ftf.add(field, 1, 100);

            let score = scorer.score_term(1, &ftf);
            assert!(
                score > 0.0,
                "score for field {field:?} should be positive, got {score}"
            );
        }
    }

    // ----- Score saturates with increasing TF ---------------------------------

    #[test]
    fn score_increases_but_saturates() {
        let scorer = make_scorer();
        let df = 100;

        let mut prev_score = 0.0_f64;
        let mut prev_delta = f64::MAX;

        // Use uniform step sizes so absolute deltas are comparable.
        for tf in [1u32, 2, 3, 4, 5, 6] {
            let mut ftf = FieldTermFreqs::new();
            ftf.add(SearchField::ContentBody, tf, 500);
            let score = scorer.score_term(df, &ftf);

            // Score should increase with TF.
            assert!(
                score > prev_score,
                "score should increase: tf={tf}, score={score}, prev={prev_score}"
            );

            // Marginal gain should decrease (diminishing returns).
            let delta = score - prev_score;
            if tf > 1 {
                assert!(
                    delta < prev_delta,
                    "marginal gain should decrease: tf={tf}, delta={delta}, prev_delta={prev_delta}"
                );
            }
            prev_delta = delta;
            prev_score = score;
        }
    }

    // ----- Multi-field document scores higher than single-field ---------------

    #[test]
    fn multi_field_scores_higher_than_single_field() {
        let scorer = make_scorer();
        let df = 100;

        // Single field: ContentBody only.
        let mut ftf_single = FieldTermFreqs::new();
        ftf_single.add(SearchField::ContentBody, 3, 500);

        // Multi field: ContentBody + ContentHead + FilenameStem.
        let mut ftf_multi = FieldTermFreqs::new();
        ftf_multi.add(SearchField::ContentBody, 3, 500);
        ftf_multi.add(SearchField::ContentHead, 1, 50);
        ftf_multi.add(SearchField::FilenameStem, 1, 3);

        let score_single = scorer.score_term(df, &ftf_single);
        let score_multi = scorer.score_term(df, &ftf_multi);

        assert!(
            score_multi > score_single,
            "multi-field ({score_multi}) should exceed single-field ({score_single})"
        );
    }

    // ----- Zero df edge case (no division by zero) ----------------------------

    #[test]
    fn zero_df_no_division_by_zero() {
        let scorer = make_scorer();

        let mut ftf = FieldTermFreqs::new();
        ftf.add(SearchField::ContentBody, 1, 500);

        // df = 0: term appears in no documents (edge case).
        let score = scorer.score_term(0, &ftf);
        assert!(score.is_finite(), "score should be finite, got {score}");
        assert!(score > 0.0, "score should be positive, got {score}");
    }

    // ----- Empty document scores 0 -------------------------------------------

    #[test]
    fn empty_document_scores_zero() {
        let scorer = make_scorer();

        let ftf = FieldTermFreqs::new(); // no fields added
        let score = scorer.score_term(100, &ftf);
        assert!(
            score.abs() < f64::EPSILON,
            "empty document should score 0, got {score}"
        );
    }

    // ----- score_document aggregates across query terms -----------------------

    #[test]
    fn score_document_aggregates_terms() {
        let scorer = make_scorer();

        let mut doc_tfs: HashMap<String, FieldTermFreqs> = HashMap::new();

        let mut ftf_hello = FieldTermFreqs::new();
        ftf_hello.add(SearchField::FilenameExact, 1, 2);
        doc_tfs.insert("hello".into(), ftf_hello);

        let mut ftf_world = FieldTermFreqs::new();
        ftf_world.add(SearchField::ContentBody, 3, 500);
        doc_tfs.insert("world".into(), ftf_world);

        let query_terms = vec![("hello".into(), 50_usize), ("world".into(), 200_usize)];

        let total = scorer.score_document(&query_terms, &doc_tfs);

        // Should be the sum of individual term scores.
        let expected = scorer.score_term(50, doc_tfs.get("hello").unwrap())
            + scorer.score_term(200, doc_tfs.get("world").unwrap());

        assert!(
            (total - expected).abs() < 1e-12,
            "score_document ({total}) should equal sum of term scores ({expected})"
        );
    }

    // ----- update_stats changes scorer behavior ------------------------------

    #[test]
    fn update_stats_changes_scores() {
        let mut scorer = make_scorer();

        let mut ftf = FieldTermFreqs::new();
        ftf.add(SearchField::ContentBody, 5, 500);

        let score_before = scorer.score_term(100, &ftf);

        // Double corpus size → IDF changes.
        let mut new_avg = scorer.avg_field_lengths().clone();
        new_avg.insert(SearchField::ContentBody, 1000.0);
        scorer.update_stats(20_000, new_avg);

        let score_after = scorer.score_term(100, &ftf);

        assert!(
            (score_before - score_after).abs() > 1e-6,
            "score should change after updating stats"
        );
    }
}
