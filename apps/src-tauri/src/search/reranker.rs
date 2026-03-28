use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Signals used for reranking a search result.
#[derive(Debug, Clone, Default)]
pub struct RankingSignals {
    /// Base text relevance (e.g. BM25F score).
    pub bm25f_score: f64,
    /// Days since the file was last modified.
    pub recency_days: f64,
    /// Number of path components (directory depth).
    pub path_depth: usize,
    /// How many times the file has been opened / accessed.
    pub access_count: u64,
    /// Whether the query implies a file type and the result matches.
    pub extension_match: bool,
    /// Whether a query term was found in the filename itself.
    pub filename_match: bool,
}

/// Tunable weights that control how each signal contributes to the final
/// reranked score.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RerankerConfig {
    /// Weight for the raw BM25F text-relevance score.
    pub bm25f_weight: f64,
    /// Weight for recency (exponential decay based on `recency_days`).
    pub recency_weight: f64,
    /// Weight for path depth (shallower paths score higher).
    pub depth_weight: f64,
    /// Weight for access frequency (log-scaled).
    pub access_weight: f64,
    /// Weight for extension/type match bonus.
    pub ext_match_weight: f64,
    /// Weight for filename match bonus.
    pub filename_match_weight: f64,
    /// RRF smoothing constant (higher = less emphasis on top ranks).
    pub rrf_k: f64,
}

impl Default for RerankerConfig {
    fn default() -> Self {
        Self {
            bm25f_weight: 1.0,
            recency_weight: 0.15,
            depth_weight: 0.05,
            access_weight: 0.10,
            ext_match_weight: 0.10,
            filename_match_weight: 0.20,
            rrf_k: 60.0,
        }
    }
}

/// A ranked item produced by a single retriever (used as input to RRF).
pub struct RankedItem {
    /// File path or document identifier.
    pub id: String,
    /// Original score assigned by the retriever.
    pub score: f64,
    /// 1-based rank within the retriever's result list.
    pub rank: usize,
}

/// Multi-signal reranker with Reciprocal Rank Fusion (RRF) support.
///
/// Combines scores from heterogeneous retrievers (BM25F, vector, fuzzy, etc.)
/// and augments them with file-level metadata signals such as recency, path
/// depth, and access frequency.
pub struct Reranker {
    config: RerankerConfig,
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

impl Reranker {
    /// Create a new `Reranker` with the given configuration.
    pub fn new(config: RerankerConfig) -> Self {
        Self { config }
    }

    /// Create a new `Reranker` with sensible default weights.
    pub fn with_defaults() -> Self {
        Self::new(RerankerConfig::default())
    }

    /// Compute a reranked score from the supplied signals.
    ///
    /// The score is a weighted linear combination:
    ///
    /// ```text
    /// final = bm25f_weight   * bm25f_score
    ///       + recency_weight  * exp(-0.01 * recency_days)
    ///       + depth_weight    * 1/(1 + path_depth)
    ///       + access_weight   * ln(1 + access_count)
    ///       + ext_match_weight    * (1 if extension_match else 0)
    ///       + filename_match_weight * (1 if filename_match else 0)
    /// ```
    pub fn compute_rerank_score(&self, signals: &RankingSignals) -> f64 {
        let recency_score = (-0.01 * signals.recency_days).exp();
        let depth_score = 1.0 / (1.0 + signals.path_depth as f64);
        let access_score = (1.0 + signals.access_count as f64).ln();
        let ext_score = if signals.extension_match { 1.0 } else { 0.0 };
        let fname_score = if signals.filename_match { 1.0 } else { 0.0 };

        self.config.bm25f_weight * signals.bm25f_score
            + self.config.recency_weight * recency_score
            + self.config.depth_weight * depth_score
            + self.config.access_weight * access_score
            + self.config.ext_match_weight * ext_score
            + self.config.filename_match_weight * fname_score
    }

    /// Reciprocal Rank Fusion across multiple retriever result lists.
    ///
    /// For every unique document that appears in at least one list the fused
    /// score is:
    ///
    /// ```text
    /// RRF_score(doc) = sum over lists of  1 / (k + rank_in_list)
    /// ```
    ///
    /// Documents that do not appear in a given list are treated as having
    /// infinite rank (contributing 0 to the sum).
    ///
    /// Returns `(id, rrf_score)` pairs sorted by score descending.
    pub fn rrf_fuse(&self, ranked_lists: &[Vec<RankedItem>]) -> Vec<(String, f64)> {
        let mut scores: HashMap<String, f64> = HashMap::new();

        for list in ranked_lists {
            for item in list {
                let contribution = 1.0 / (self.config.rrf_k + item.rank as f64);
                *scores.entry(item.id.clone()).or_insert(0.0) += contribution;
            }
        }

        let mut results: Vec<(String, f64)> = scores.into_iter().collect();
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        results
    }

    /// Variant of [`rrf_fuse`](Self::rrf_fuse) that accepts pre-scored lists.
    ///
    /// Each inner `Vec` contains `(id, score)` pairs. Ranks are assigned by
    /// sorting each list by score in descending order (1-based). The standard
    /// RRF formula is then applied.
    pub fn rrf_fuse_with_scores(&self, scored_lists: &[Vec<(String, f64)>]) -> Vec<(String, f64)> {
        let ranked: Vec<Vec<RankedItem>> = scored_lists
            .iter()
            .map(|list| {
                // Sort a copy by descending score to assign ranks.
                let mut sorted: Vec<(String, f64)> = list.clone();
                sorted.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

                sorted
                    .into_iter()
                    .enumerate()
                    .map(|(i, (id, score))| RankedItem {
                        id,
                        score,
                        rank: i + 1, // 1-based
                    })
                    .collect()
            })
            .collect();

        self.rrf_fuse(&ranked)
    }

    /// Convex combination fusion across multiple scored result lists.
    ///
    /// Each entry in `scored_lists` is a `(results, weight)` pair where
    /// `results` contains `(id, score)` tuples and `weight` controls the
    /// relative contribution of that retriever.  Scores within each list
    /// are min-max normalised to [0, 1] before weighting.
    ///
    /// Returns `(id, fused_score)` pairs sorted by score descending.
    pub fn convex_combination_fuse(
        &self,
        scored_lists: &[(Vec<(String, f64)>, f64)],
    ) -> Vec<(String, f64)> {
        let mut combined: HashMap<String, f64> = HashMap::new();

        for (results, weight) in scored_lists {
            if results.is_empty() {
                continue;
            }

            // Min-max normalize scores
            let min_score = results
                .iter()
                .map(|(_, s)| *s)
                .fold(f64::INFINITY, f64::min);
            let max_score = results
                .iter()
                .map(|(_, s)| *s)
                .fold(f64::NEG_INFINITY, f64::max);
            let range = max_score - min_score;

            for (path, score) in results {
                let normalized = if range > 0.0 {
                    (score - min_score) / range
                } else {
                    1.0
                };
                *combined.entry(path.clone()).or_insert(0.0) += weight * normalized;
            }
        }

        let mut result: Vec<_> = combined.into_iter().collect();
        result.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        result
    }

    /// In-place reranking: computes a new score for every result using
    /// [`compute_rerank_score`](Self::compute_rerank_score) and re-sorts the
    /// list by the updated score in descending order.
    ///
    /// The tuple layout is `(id, score, signals)`. After this call the `score`
    /// field of each entry is replaced with the reranked score.
    pub fn rerank(&self, results: &mut [(String, f64, RankingSignals)]) {
        for entry in results.iter_mut() {
            entry.1 = self.compute_rerank_score(&entry.2);
        }
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Count the number of path components in `path`.
///
/// Handles both Windows (`\`) and Unix (`/`) separators. Leading separators
/// and drive letters (e.g. `C:`) are counted as components.
///
/// ```text
/// C:\Users\foo\bar.txt  => 4   (C:, Users, foo, bar.txt)
/// /home/user/file.txt   => 3   (home, user, file.txt)
/// ```
pub fn path_depth(path: &str) -> usize {
    // Normalise separators to forward slash.
    let normalised = path.replace('\\', "/");

    normalised.split('/').filter(|seg| !seg.is_empty()).count()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -- RRF tests ----------------------------------------------------------

    #[test]
    fn rrf_same_doc_in_two_lists() {
        let reranker = Reranker::with_defaults();
        let k = reranker.config.rrf_k; // 60.0

        let lists = vec![
            vec![RankedItem {
                id: "doc_a".into(),
                score: 10.0,
                rank: 1,
            }],
            vec![RankedItem {
                id: "doc_a".into(),
                score: 5.0,
                rank: 2,
            }],
        ];

        let fused = reranker.rrf_fuse(&lists);
        assert_eq!(fused.len(), 1);

        let expected = 1.0 / (k + 1.0) + 1.0 / (k + 2.0);
        assert!(
            (fused[0].1 - expected).abs() < 1e-12,
            "expected {expected}, got {}",
            fused[0].1
        );
    }

    #[test]
    fn rrf_doc_in_both_lists_beats_single_list() {
        let reranker = Reranker::with_defaults();

        let lists = vec![
            vec![
                RankedItem {
                    id: "both".into(),
                    score: 8.0,
                    rank: 1,
                },
                RankedItem {
                    id: "only_a".into(),
                    score: 6.0,
                    rank: 2,
                },
            ],
            vec![RankedItem {
                id: "both".into(),
                score: 7.0,
                rank: 1,
            }],
        ];

        let fused = reranker.rrf_fuse(&lists);
        let score_both = fused.iter().find(|(id, _)| id == "both").unwrap().1;
        let score_only = fused.iter().find(|(id, _)| id == "only_a").unwrap().1;

        assert!(
            score_both > score_only,
            "doc in both lists ({score_both}) should beat doc in one list ({score_only})"
        );
    }

    #[test]
    fn rrf_empty_lists_returns_empty() {
        let reranker = Reranker::with_defaults();
        let fused = reranker.rrf_fuse(&[]);
        assert!(fused.is_empty());

        let fused2 = reranker.rrf_fuse(&[vec![]]);
        assert!(fused2.is_empty());
    }

    #[test]
    fn rrf_single_list_preserves_order() {
        let reranker = Reranker::with_defaults();

        let lists = vec![vec![
            RankedItem {
                id: "first".into(),
                score: 10.0,
                rank: 1,
            },
            RankedItem {
                id: "second".into(),
                score: 8.0,
                rank: 2,
            },
            RankedItem {
                id: "third".into(),
                score: 5.0,
                rank: 3,
            },
        ]];

        let fused = reranker.rrf_fuse(&lists);
        assert_eq!(fused.len(), 3);
        assert_eq!(fused[0].0, "first");
        assert_eq!(fused[1].0, "second");
        assert_eq!(fused[2].0, "third");
    }

    #[test]
    fn rrf_multiple_retrievers_overlapping() {
        let reranker = Reranker::with_defaults();
        let k = reranker.config.rrf_k;

        // Three retrievers with overlapping documents.
        let lists = vec![
            vec![
                RankedItem {
                    id: "a".into(),
                    score: 10.0,
                    rank: 1,
                },
                RankedItem {
                    id: "b".into(),
                    score: 8.0,
                    rank: 2,
                },
                RankedItem {
                    id: "c".into(),
                    score: 5.0,
                    rank: 3,
                },
            ],
            vec![
                RankedItem {
                    id: "b".into(),
                    score: 9.0,
                    rank: 1,
                },
                RankedItem {
                    id: "a".into(),
                    score: 7.0,
                    rank: 2,
                },
            ],
            vec![
                RankedItem {
                    id: "a".into(),
                    score: 6.0,
                    rank: 1,
                },
                RankedItem {
                    id: "d".into(),
                    score: 4.0,
                    rank: 2,
                },
            ],
        ];

        let fused = reranker.rrf_fuse(&lists);

        // "a" appears in all three lists at ranks 1, 2, 1.
        let expected_a = 1.0 / (k + 1.0) + 1.0 / (k + 2.0) + 1.0 / (k + 1.0);
        let score_a = fused.iter().find(|(id, _)| id == "a").unwrap().1;
        assert!(
            (score_a - expected_a).abs() < 1e-12,
            "expected {expected_a}, got {score_a}"
        );

        // "b" appears in two lists at ranks 2, 1.
        let expected_b = 1.0 / (k + 2.0) + 1.0 / (k + 1.0);
        let score_b = fused.iter().find(|(id, _)| id == "b").unwrap().1;
        assert!(
            (score_b - expected_b).abs() < 1e-12,
            "expected {expected_b}, got {score_b}"
        );

        // "a" should outscore "b" since it appears in more lists.
        assert!(score_a > score_b);

        // "d" appears in only one list.
        let score_d = fused.iter().find(|(id, _)| id == "d").unwrap().1;
        assert!(score_a > score_d);
        assert!(score_b > score_d);
    }

    // -- Rerank score tests -------------------------------------------------

    #[test]
    fn recent_file_scores_higher_than_old() {
        let reranker = Reranker::with_defaults();

        let recent = RankingSignals {
            bm25f_score: 1.0,
            recency_days: 0.0,
            ..Default::default()
        };
        let old = RankingSignals {
            bm25f_score: 1.0,
            recency_days: 365.0,
            ..Default::default()
        };

        let score_recent = reranker.compute_rerank_score(&recent);
        let score_old = reranker.compute_rerank_score(&old);

        assert!(
            score_recent > score_old,
            "recent ({score_recent}) should beat old ({score_old})"
        );
    }

    #[test]
    fn shallow_path_scores_higher_than_deep() {
        let reranker = Reranker::with_defaults();

        let shallow = RankingSignals {
            bm25f_score: 1.0,
            path_depth: 1,
            ..Default::default()
        };
        let deep = RankingSignals {
            bm25f_score: 1.0,
            path_depth: 10,
            ..Default::default()
        };

        let score_shallow = reranker.compute_rerank_score(&shallow);
        let score_deep = reranker.compute_rerank_score(&deep);

        assert!(
            score_shallow > score_deep,
            "shallow ({score_shallow}) should beat deep ({score_deep})"
        );
    }

    #[test]
    fn filename_match_boosts_score() {
        let reranker = Reranker::with_defaults();

        let with_match = RankingSignals {
            bm25f_score: 1.0,
            filename_match: true,
            ..Default::default()
        };
        let without_match = RankingSignals {
            bm25f_score: 1.0,
            filename_match: false,
            ..Default::default()
        };

        let score_with = reranker.compute_rerank_score(&with_match);
        let score_without = reranker.compute_rerank_score(&without_match);

        assert!(
            score_with > score_without,
            "filename match ({score_with}) should beat no match ({score_without})"
        );
    }

    #[test]
    fn frequently_accessed_file_scores_higher() {
        let reranker = Reranker::with_defaults();

        let frequent = RankingSignals {
            bm25f_score: 1.0,
            access_count: 100,
            ..Default::default()
        };
        let rare = RankingSignals {
            bm25f_score: 1.0,
            access_count: 0,
            ..Default::default()
        };

        let score_frequent = reranker.compute_rerank_score(&frequent);
        let score_rare = reranker.compute_rerank_score(&rare);

        assert!(
            score_frequent > score_rare,
            "frequent ({score_frequent}) should beat rare ({score_rare})"
        );
    }

    #[test]
    fn all_zero_signals_returns_roughly_zero() {
        let reranker = Reranker::with_defaults();

        let signals = RankingSignals {
            bm25f_score: 0.0,
            recency_days: 0.0,
            path_depth: 0,
            access_count: 0,
            extension_match: false,
            filename_match: false,
        };

        let score = reranker.compute_rerank_score(&signals);

        // recency_score = exp(0) = 1.0  => 0.15 * 1.0 = 0.15
        // depth_score   = 1/(1+0) = 1.0 => 0.05 * 1.0 = 0.05
        // access_score  = ln(1) = 0.0   => 0.0
        // So "all-zero" signals still produce a small positive value from
        // recency and depth, but the result should still be small.
        let expected = 0.15 + 0.05; // 0.20
        assert!(
            (score - expected).abs() < 1e-12,
            "expected ~{expected}, got {score}"
        );
    }

    // -- path_depth tests ---------------------------------------------------

    #[test]
    fn path_depth_windows() {
        assert_eq!(path_depth(r"C:\Users\foo\bar.txt"), 4);
        assert_eq!(path_depth(r"D:\"), 1);
        assert_eq!(path_depth(r"C:\file.txt"), 2);
    }

    #[test]
    fn path_depth_unix() {
        assert_eq!(path_depth("/home/user/file.txt"), 3);
        assert_eq!(path_depth("/"), 0);
        assert_eq!(path_depth("/file.txt"), 1);
    }

    // -- rerank in-place test -----------------------------------------------

    #[test]
    fn rerank_sorts_by_new_score() {
        let reranker = Reranker::with_defaults();

        let mut results = vec![
            (
                "old_deep".to_string(),
                100.0, // high original score
                RankingSignals {
                    bm25f_score: 0.5,
                    recency_days: 365.0,
                    path_depth: 10,
                    access_count: 0,
                    extension_match: false,
                    filename_match: false,
                },
            ),
            (
                "recent_shallow".to_string(),
                1.0, // low original score
                RankingSignals {
                    bm25f_score: 0.5,
                    recency_days: 0.0,
                    path_depth: 1,
                    access_count: 50,
                    extension_match: true,
                    filename_match: true,
                },
            ),
        ];

        reranker.rerank(&mut results);

        // The "recent_shallow" result has many positive signals and should
        // rank first despite having a lower original score.
        assert_eq!(results[0].0, "recent_shallow");
        assert_eq!(results[1].0, "old_deep");
    }

    // -- rrf_fuse_with_scores test ------------------------------------------

    #[test]
    fn rrf_fuse_with_scores_assigns_ranks_correctly() {
        let reranker = Reranker::with_defaults();
        let k = reranker.config.rrf_k;

        let scored_lists = vec![
            vec![
                ("a".to_string(), 5.0),
                ("b".to_string(), 10.0), // b has higher score => rank 1
            ],
            vec![
                ("a".to_string(), 8.0), // a has higher score => rank 1
                ("b".to_string(), 3.0),
            ],
        ];

        let fused = reranker.rrf_fuse_with_scores(&scored_lists);

        // In list 1: b=rank1, a=rank2.  In list 2: a=rank1, b=rank2.
        // Both appear in both lists symmetrically, so they should have the
        // same fused score.
        let score_a = fused.iter().find(|(id, _)| id == "a").unwrap().1;
        let score_b = fused.iter().find(|(id, _)| id == "b").unwrap().1;

        let expected = 1.0 / (k + 1.0) + 1.0 / (k + 2.0);
        assert!(
            (score_a - expected).abs() < 1e-12,
            "expected {expected}, got {score_a}"
        );
        assert!(
            (score_a - score_b).abs() < 1e-12,
            "symmetric docs should have equal scores: a={score_a}, b={score_b}"
        );
    }
}
