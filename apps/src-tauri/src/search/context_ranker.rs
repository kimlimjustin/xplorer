use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// UserContext
// ---------------------------------------------------------------------------

/// Captures the user's current browsing context so search results can be
/// re-ranked to surface the most relevant hits first.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UserContext {
    /// Current working directory the user is browsing
    pub current_directory: Option<String>,
    /// Recently opened/accessed file paths (most recent first)
    pub recent_files: Vec<String>,
    /// Number of times each path has been opened (from storage)
    pub access_counts: HashMap<String, u64>,
}

// ---------------------------------------------------------------------------
// ContextRankConfig
// ---------------------------------------------------------------------------

/// Tunable weights for each contextual signal.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextRankConfig {
    /// Boost for results in the same directory tree as current_directory
    pub same_tree_boost: f64,
    /// Boost for results in a sibling directory
    pub sibling_dir_boost: f64,
    /// Boost multiplier for recently accessed files (decays with position in recents list)
    pub recent_access_boost: f64,
    /// Maximum number of recent files to consider
    pub max_recent_depth: usize,
    /// Boost for files with high access count (log-scaled)
    pub access_frequency_boost: f64,
}

impl Default for ContextRankConfig {
    fn default() -> Self {
        Self {
            same_tree_boost: 0.15,
            sibling_dir_boost: 0.08,
            recent_access_boost: 0.12,
            max_recent_depth: 50,
            access_frequency_boost: 0.10,
        }
    }
}

// ---------------------------------------------------------------------------
// ContextualRanker
// ---------------------------------------------------------------------------

pub struct ContextualRanker {
    config: ContextRankConfig,
}

impl ContextualRanker {
    /// Create a ranker with default configuration.
    pub fn new() -> Self {
        Self {
            config: ContextRankConfig::default(),
        }
    }

    /// Create a ranker with a custom configuration.
    pub fn with_config(config: ContextRankConfig) -> Self {
        Self { config }
    }

    /// Compute the total contextual boost that should be added to a search
    /// result located at `result_path`, given the supplied `context`.
    ///
    /// The returned value is always >= 0.0.
    pub fn compute_context_boost(&self, result_path: &str, context: &UserContext) -> f64 {
        let norm_result = normalize_path(result_path);
        let mut boost: f64 = 0.0;

        // -- Same-tree boost --------------------------------------------------
        if let Some(ref cwd) = context.current_directory {
            let norm_cwd = normalize_path(cwd);
            if is_same_tree(&norm_result, &norm_cwd) {
                let shared = shared_path_prefix_len(&norm_result, &norm_cwd);
                let total = path_components(&norm_result).count();
                if total > 0 {
                    let depth_similarity = shared as f64 / total as f64;
                    boost += self.config.same_tree_boost * depth_similarity;
                }
            }

            // -- Sibling directory boost --------------------------------------
            if is_sibling(&norm_result, &norm_cwd) {
                boost += self.config.sibling_dir_boost;
            }
        }

        // -- Recent access boost (decays with position) -----------------------
        let max_depth = self.config.max_recent_depth.min(context.recent_files.len());
        for (position, recent_path) in context.recent_files[..max_depth].iter().enumerate() {
            let norm_recent = normalize_path(recent_path);
            if norm_recent == norm_result {
                boost += self.config.recent_access_boost * (1.0 / (1.0 + position as f64));
                break; // only count the first (most recent) occurrence
            }
        }

        // -- Access frequency boost (log-scaled) ------------------------------
        // We check both the raw path and the normalized form so callers do not
        // have to pre-normalize their access_counts keys.
        let count = context
            .access_counts
            .get(result_path)
            .or_else(|| context.access_counts.get(&norm_result))
            .copied()
            .unwrap_or(0);

        if count > 0 {
            boost += self.config.access_frequency_boost * (1.0 + count as f64).ln();
        }

        boost
    }

    /// Mutate `results` in-place: add each result's contextual boost to its
    /// score, then re-sort descending by the updated score.
    pub fn apply_context_ranking(
        &self,
        results: &mut [super::SearchResult],
        context: &UserContext,
    ) {
        for result in results.iter_mut() {
            let boost = self.compute_context_boost(&result.path, context);
            result.score += boost;
        }
        // Sort descending by score (highest first). Use total_cmp for a
        // well-defined order even if NaN somehow sneaks in.
        results.sort_by(|a, b| b.score.total_cmp(&a.score));
    }

    /// Convenience constructor: build a `UserContext` from a flat list of
    /// recently-accessed paths and an optional current directory.
    pub fn build_context_from_recents(
        recent_paths: &[String],
        current_dir: Option<&str>,
    ) -> UserContext {
        let mut access_counts: HashMap<String, u64> = HashMap::new();
        let mut seen = std::collections::HashSet::new();
        let mut deduped: Vec<String> = Vec::new();

        for p in recent_paths {
            let norm = normalize_path(p);
            *access_counts.entry(norm.clone()).or_insert(0) += 1;
            if seen.insert(norm.clone()) {
                deduped.push(norm);
            }
        }

        UserContext {
            current_directory: current_dir.map(normalize_path),
            recent_files: deduped,
            access_counts,
        }
    }
}

impl Default for ContextualRanker {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/// Normalize a path to use `/` separators and strip a trailing slash (unless
/// the path is just `/`).
fn normalize_path(path: &str) -> String {
    let mut s = path.replace('\\', "/");
    if s.len() > 1 && s.ends_with('/') {
        s.pop();
    }
    s
}

/// Iterate over the components of a normalized path, splitting on `/`.
/// Empty components (from leading `/`) are filtered out.
fn path_components(path: &str) -> impl Iterator<Item = &str> {
    path.split('/').filter(|c| !c.is_empty())
}

/// Count the number of leading path components that `a` and `b` share.
fn shared_path_prefix_len(a: &str, b: &str) -> usize {
    let a_norm = normalize_path(a);
    let b_norm = normalize_path(b);
    path_components(&a_norm)
        .zip(path_components(&b_norm))
        .take_while(|(ca, cb)| ca.eq_ignore_ascii_case(cb))
        .count()
}

/// Return the parent directory of `path`, or `None` if the path has no
/// parent (e.g. it is a root like `/` or `C:/`).
fn parent_dir(path: &str) -> Option<String> {
    let norm = normalize_path(path);
    if let Some(pos) = norm.rfind('/') {
        let parent = &norm[..pos];
        if parent.is_empty() {
            // e.g. "/file" -> parent is "/"
            Some("/".to_string())
        } else {
            Some(parent.to_string())
        }
    } else {
        None
    }
}

/// Return `true` if `path` is located somewhere under `tree_root`.
fn is_same_tree(path: &str, tree_root: &str) -> bool {
    let p = normalize_path(path).to_ascii_lowercase();
    let t = normalize_path(tree_root).to_ascii_lowercase();
    if p == t {
        return true;
    }
    // Ensure tree_root acts as a directory prefix (not just a string prefix).
    let prefix = if t.ends_with('/') {
        t
    } else {
        format!("{}/", t)
    };
    p.starts_with(&prefix)
}

/// Return `true` if the parents of `path_a` and `path_b` share the same
/// grandparent directory.
fn is_sibling(path_a: &str, path_b: &str) -> bool {
    let parent_a = match parent_dir(path_a) {
        Some(p) => p,
        None => return false,
    };
    let parent_b = match parent_dir(path_b) {
        Some(p) => p,
        None => return false,
    };
    // If the two parents are the same directory they are trivially siblings,
    // but the same-tree boost already covers that case. We still return true
    // so callers get the boost if they want it.
    let grandparent_a = parent_dir(&parent_a);
    let grandparent_b = parent_dir(&parent_b);
    match (grandparent_a, grandparent_b) {
        (Some(ga), Some(gb)) => ga.eq_ignore_ascii_case(&gb),
        _ => false,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: create a minimal SearchResult with a given path and score.
    fn make_result(path: &str, score: f64) -> super::super::SearchResult {
        super::super::SearchResult {
            path: path.to_string(),
            filename: path.rsplit('/').next().unwrap_or(path).to_string(),
            matches: vec![],
            score,
            relevance_type: String::new(),
            snippet: None,
        }
    }

    // -- test_same_tree_boost -------------------------------------------------

    #[test]
    fn test_same_tree_boost() {
        let ranker = ContextualRanker::new();
        let ctx = UserContext {
            current_directory: Some("/home/user/projects".to_string()),
            recent_files: vec![],
            access_counts: HashMap::new(),
        };

        // A file deep inside the same tree should get a positive boost.
        let boost = ranker.compute_context_boost("/home/user/projects/src/main.rs", &ctx);
        assert!(
            boost > 0.0,
            "Expected positive same-tree boost, got {}",
            boost
        );

        // A file outside the tree should get zero (no other signals present).
        let boost_outside = ranker.compute_context_boost("/var/log/syslog", &ctx);
        assert!(
            boost_outside < f64::EPSILON,
            "Expected no boost for path outside tree, got {}",
            boost_outside
        );
    }

    // -- test_sibling_boost ---------------------------------------------------

    #[test]
    fn test_sibling_boost() {
        let ranker = ContextualRanker::new();
        let ctx = UserContext {
            current_directory: Some("/home/user/projects/alpha/src".to_string()),
            recent_files: vec![],
            access_counts: HashMap::new(),
        };

        // /home/user/projects/beta/readme.md shares grandparent /home/user/projects
        // with /home/user/projects/alpha/src (parent of cwd is /home/user/projects/alpha,
        // parent of result is /home/user/projects/beta, both have grandparent /home/user/projects).
        let boost = ranker.compute_context_boost("/home/user/projects/beta/readme.md", &ctx);
        assert!(
            boost >= ranker.config.sibling_dir_boost - f64::EPSILON,
            "Expected sibling boost >= {}, got {}",
            ranker.config.sibling_dir_boost,
            boost
        );
    }

    // -- test_recent_access_boost ---------------------------------------------

    #[test]
    fn test_recent_access_boost() {
        let ranker = ContextualRanker::new();
        let ctx = UserContext {
            current_directory: None,
            recent_files: vec![
                "/a/b/c.txt".to_string(),
                "/d/e/f.txt".to_string(),
                "/g/h/i.txt".to_string(),
            ],
            access_counts: HashMap::new(),
        };

        // First recent file gets the highest boost.
        let boost_0 = ranker.compute_context_boost("/a/b/c.txt", &ctx);
        // Second recent file gets a smaller boost.
        let boost_1 = ranker.compute_context_boost("/d/e/f.txt", &ctx);
        // A file not in recents gets zero.
        let boost_none = ranker.compute_context_boost("/x/y/z.txt", &ctx);

        assert!(boost_0 > boost_1, "First recent should get larger boost");
        assert!(boost_1 > 0.0, "Second recent should get a positive boost");
        assert!(
            boost_none < f64::EPSILON,
            "Non-recent should get zero boost"
        );
    }

    // -- test_access_frequency_boost ------------------------------------------

    #[test]
    fn test_access_frequency_boost() {
        let ranker = ContextualRanker::new();
        let mut counts = HashMap::new();
        counts.insert("/docs/report.pdf".to_string(), 20);
        counts.insert("/docs/notes.txt".to_string(), 1);

        let ctx = UserContext {
            current_directory: None,
            recent_files: vec![],
            access_counts: counts,
        };

        let boost_high = ranker.compute_context_boost("/docs/report.pdf", &ctx);
        let boost_low = ranker.compute_context_boost("/docs/notes.txt", &ctx);
        let boost_zero = ranker.compute_context_boost("/docs/other.txt", &ctx);

        assert!(
            boost_high > boost_low,
            "Higher access count -> larger boost"
        );
        assert!(boost_low > 0.0, "Count of 1 should still produce a boost");
        assert!(boost_zero < f64::EPSILON, "No access count -> no boost");
    }

    // -- test_no_context_no_boost ---------------------------------------------

    #[test]
    fn test_no_context_no_boost() {
        let ranker = ContextualRanker::new();
        let ctx = UserContext::default();

        let boost = ranker.compute_context_boost("/any/path/file.txt", &ctx);
        assert!(
            boost.abs() < f64::EPSILON,
            "Empty context should produce zero boost, got {}",
            boost
        );
    }

    // -- test_apply_context_ranking_reorders -----------------------------------

    #[test]
    fn test_apply_context_ranking_reorders() {
        let ranker = ContextualRanker::new();
        let ctx = UserContext {
            current_directory: Some("/projects/web".to_string()),
            recent_files: vec!["/projects/web/src/app.tsx".to_string()],
            access_counts: {
                let mut m = HashMap::new();
                m.insert("/projects/web/src/app.tsx".to_string(), 10);
                m
            },
        };

        let mut results = vec![
            make_result("/var/log/system.log", 1.0),
            make_result("/projects/web/src/app.tsx", 0.8),
            make_result("/tmp/random.txt", 0.9),
        ];

        ranker.apply_context_ranking(&mut results, &ctx);

        // After boosting, the file in the user's tree with recent access and
        // frequency should float to the top despite starting with a lower score.
        assert_eq!(
            results[0].path, "/projects/web/src/app.tsx",
            "Contextually relevant result should be ranked first"
        );
    }

    // -- test_shared_path_prefix_len ------------------------------------------

    #[test]
    fn test_shared_path_prefix_len() {
        assert_eq!(
            shared_path_prefix_len("/a/b/c/d", "/a/b/x/y"),
            2,
            "Should share 'a' and 'b'"
        );
        assert_eq!(
            shared_path_prefix_len("/a/b/c", "/a/b/c"),
            3,
            "Identical paths share all components"
        );
        assert_eq!(
            shared_path_prefix_len("/a/b", "/x/y"),
            0,
            "No shared prefix"
        );
        // Windows-style paths
        assert_eq!(
            shared_path_prefix_len("C:\\Users\\me\\docs", "C:\\Users\\me\\pics"),
            3,
            "Windows paths should be normalized and share C:, Users, me"
        );
    }

    // -- test_build_context_from_recents --------------------------------------

    #[test]
    fn test_build_context_from_recents() {
        let recents = vec![
            "/a/b.txt".to_string(),
            "/c/d.txt".to_string(),
            "/a/b.txt".to_string(), // duplicate
            "/e/f.txt".to_string(),
            "/c/d.txt".to_string(), // duplicate
        ];

        let ctx = ContextualRanker::build_context_from_recents(&recents, Some("C:\\Users\\me"));

        // Deduplication: should have 3 unique entries, order preserved.
        assert_eq!(ctx.recent_files.len(), 3);
        assert_eq!(ctx.recent_files[0], "/a/b.txt");
        assert_eq!(ctx.recent_files[1], "/c/d.txt");
        assert_eq!(ctx.recent_files[2], "/e/f.txt");

        // Access counts
        assert_eq!(ctx.access_counts.get("/a/b.txt"), Some(&2));
        assert_eq!(ctx.access_counts.get("/c/d.txt"), Some(&2));
        assert_eq!(ctx.access_counts.get("/e/f.txt"), Some(&1));

        // Current directory should be normalized
        assert_eq!(ctx.current_directory.as_deref(), Some("C:/Users/me"));
    }

    // -- test_windows_path_normalization --------------------------------------

    #[test]
    fn test_windows_path_normalization() {
        let ranker = ContextualRanker::new();
        let ctx = UserContext {
            current_directory: Some("D:\\Projects\\Web".to_string()),
            recent_files: vec!["D:\\Projects\\Web\\index.html".to_string()],
            access_counts: HashMap::new(),
        };

        let boost = ranker.compute_context_boost("D:\\Projects\\Web\\src\\app.js", &ctx);
        assert!(
            boost > 0.0,
            "Windows paths should be normalized and produce a boost, got {}",
            boost
        );
    }

    // -- test_parent_dir ------------------------------------------------------

    #[test]
    fn test_parent_dir() {
        assert_eq!(parent_dir("/a/b/c"), Some("/a/b".to_string()));
        assert_eq!(parent_dir("/a"), Some("/".to_string()));
        assert_eq!(parent_dir("C:/Users/me"), Some("C:/Users".to_string()));
        assert_eq!(parent_dir("noslash"), None);
    }

    // -- test_is_same_tree ----------------------------------------------------

    #[test]
    fn test_is_same_tree() {
        assert!(is_same_tree("/a/b/c/d.txt", "/a/b"));
        assert!(is_same_tree("/a/b", "/a/b")); // same path counts
        assert!(!is_same_tree("/a/bc/d.txt", "/a/b")); // prefix but not tree
        assert!(!is_same_tree("/x/y", "/a/b"));
    }

    // -- test_is_sibling ------------------------------------------------------

    #[test]
    fn test_is_sibling() {
        // /projects/alpha/file.txt and /projects/beta/other.txt share
        // grandparent /projects
        assert!(is_sibling(
            "/projects/alpha/file.txt",
            "/projects/beta/other.txt"
        ));
        assert!(!is_sibling("/a/b/c.txt", "/x/y/z.txt"));
    }

    // -- test_combined_boosts_accumulate --------------------------------------

    #[test]
    fn test_combined_boosts_accumulate() {
        let ranker = ContextualRanker::new();
        let path = "/home/user/projects/src/main.rs";
        let ctx = UserContext {
            current_directory: Some("/home/user/projects".to_string()),
            recent_files: vec![path.to_string()],
            access_counts: {
                let mut m = HashMap::new();
                m.insert(path.to_string(), 5);
                m
            },
        };

        let boost = ranker.compute_context_boost(path, &ctx);

        // All four signals should fire: same-tree, sibling (parent of result
        // and cwd share grandparent), recent (position 0), and frequency.
        // The exact value depends on the math, but it should be substantially
        // more than any single boost weight.
        let max_single = ranker
            .config
            .same_tree_boost
            .max(ranker.config.sibling_dir_boost)
            .max(ranker.config.recent_access_boost)
            .max(ranker.config.access_frequency_boost);

        assert!(
            boost > max_single,
            "Combined boost ({}) should exceed any single weight ({})",
            boost,
            max_single
        );
    }
}
