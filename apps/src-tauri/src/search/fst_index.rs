// Xplorer Search Engine -- Memory-Mapped FST Index
//
// Provides a persistent FST (Finite State Transducer) term dictionary that
// can be built from a sorted list of terms, saved to disk, and later loaded
// back via memory-mapping for near-instant startup.
//
// Supports:
//   - Prefix search  (`search_prefix`)
//   - Fuzzy search    (`search_fuzzy`, Levenshtein automaton)
//   - Exact lookup    (`contains`, `get`)
//
// Uses the `fst` crate with the `levenshtein` feature and `memmap2` for
// memory-mapped I/O.

use std::path::Path;

use fst::automaton::{Levenshtein, Str};
use fst::{Automaton, IntoStreamer, Map, MapBuilder, Streamer};
use tracing::{info, warn};

// ===== FstIndex ==============================================================

/// A term dictionary backed by an FST that can be built in memory, persisted
/// to disk, and reloaded via memory-mapping.
pub struct FstIndex {
    /// The underlying FST map. This is `None` when the index is empty.
    inner: FstStorage,
}

/// Internal storage variant -- the FST bytes may live in a `Vec<u8>` (built
/// in memory) or in a memory-mapped file.
enum FstStorage {
    /// No FST loaded.
    Empty,
    /// In-memory FST built from a `Vec<u8>`.
    Memory(Map<Vec<u8>>),
    /// Memory-mapped FST loaded from a file.
    Mmap(Map<memmap2::Mmap>),
}

impl FstIndex {
    // -- Construction ---------------------------------------------------------

    /// Create an empty index with no terms.
    pub fn new() -> Self {
        Self {
            inner: FstStorage::Empty,
        }
    }

    /// Build an FST from a list of `(term, doc_frequency)` pairs.
    ///
    /// The input does **not** need to be sorted -- it will be sorted
    /// lexicographically before construction. Duplicate terms are
    /// deduplicated (first occurrence wins).
    pub fn build(terms: &mut Vec<(String, u64)>) -> Result<Self, String> {
        if terms.is_empty() {
            return Ok(Self::new());
        }

        // FST requires lexicographic byte order.
        terms.sort_by(|a, b| a.0.as_bytes().cmp(b.0.as_bytes()));

        // Deduplicate: keep the first occurrence of each term.
        terms.dedup_by(|b, a| a.0 == b.0);

        let mut builder = MapBuilder::memory();
        for (term, freq) in terms.iter() {
            builder
                .insert(term.as_bytes(), *freq)
                .map_err(|e| format!("FstIndex::build: failed to insert key: {e}"))?;
        }

        let bytes = builder
            .into_inner()
            .map_err(|e| format!("FstIndex::build: failed to finish builder: {e}"))?;
        let map = Map::new(bytes)
            .map_err(|e| format!("FstIndex::build: failed to create Map: {e}"))?;

        Ok(Self {
            inner: FstStorage::Memory(map),
        })
    }

    // -- Persistence ----------------------------------------------------------

    /// Save the FST to disk at the given `path`.
    ///
    /// If the index is empty, no file is written and `Ok(())` is returned.
    pub fn save<P: AsRef<Path>>(&self, path: P) -> Result<(), String> {
        let map = match &self.inner {
            FstStorage::Empty => return Ok(()),
            FstStorage::Memory(m) => m,
            FstStorage::Mmap(m) => {
                // For mmap-backed FSTs, we can read the raw bytes.
                let raw = m.as_fst().as_bytes();
                std::fs::write(path.as_ref(), raw)
                    .map_err(|e| format!("failed to write FST to disk: {e}"))?;
                info!(
                    "[search::fst_index] saved FST to {}",
                    path.as_ref().display()
                );
                return Ok(());
            }
        };

        let raw = map.as_fst().as_bytes();
        if let Some(parent) = path.as_ref().parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("failed to create parent directory: {e}"))?;
        }
        std::fs::write(path.as_ref(), raw)
            .map_err(|e| format!("failed to write FST to disk: {e}"))?;

        info!(
            "[search::fst_index] saved FST ({} bytes) to {}",
            raw.len(),
            path.as_ref().display()
        );

        Ok(())
    }

    /// Load an FST from disk using memory-mapping.
    ///
    /// The file is memory-mapped for fast, zero-copy access without reading
    /// the entire file into user-space memory.
    ///
    /// # Safety
    ///
    /// `memmap2::Mmap` is inherently unsafe (the OS could modify the
    /// underlying file while it is mapped). In practice, FST files written
    /// by this module are treated as immutable artifacts and this is safe.
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let file = std::fs::File::open(path.as_ref()).map_err(|e| {
            format!(
                "failed to open FST file {}: {e}",
                path.as_ref().display()
            )
        })?;

        // SAFETY: The FST file is treated as immutable. We do not modify it
        // while it is mapped.
        let mmap = unsafe {
            memmap2::Mmap::map(&file).map_err(|e| {
                format!(
                    "failed to memory-map FST file {}: {e}",
                    path.as_ref().display()
                )
            })?
        };

        let map = Map::new(mmap).map_err(|e| {
            format!(
                "failed to parse FST from {}: {e}",
                path.as_ref().display()
            )
        })?;

        info!(
            "[search::fst_index] loaded FST from {} ({} terms)",
            path.as_ref().display(),
            map.len()
        );

        Ok(Self {
            inner: FstStorage::Mmap(map),
        })
    }

    // -- Queries --------------------------------------------------------------

    /// Search for all terms starting with `prefix`.
    ///
    /// Returns `(term, value)` pairs. Results are capped at 200 entries.
    pub fn search_prefix(&self, prefix: &str) -> Vec<(String, u64)> {
        if prefix.is_empty() {
            return Vec::new();
        }

        const MAX_PREFIX_RESULTS: usize = 200;

        let prefix_automaton = Str::new(prefix).starts_with();
        self.search_with_automaton(prefix_automaton, MAX_PREFIX_RESULTS)
    }

    /// Search for all terms within Levenshtein edit distance `max_distance`
    /// of `term`.
    ///
    /// Falls back to prefix search if the Levenshtein automaton cannot be
    /// constructed (e.g. the term is too long for the given distance).
    pub fn search_fuzzy(&self, term: &str, max_distance: u32) -> Vec<(String, u64)> {
        if term.is_empty() {
            return Vec::new();
        }

        match Levenshtein::new(term, max_distance) {
            Ok(lev) => self.search_with_automaton(lev, 200),
            Err(e) => {
                warn!(
                    "[search::fst_index] Levenshtein automaton failed for \
                     term={term:?}, dist={max_distance}: {e} -- falling back \
                     to prefix search"
                );
                self.search_prefix(term)
            }
        }
    }

    /// Check whether the index contains `term` exactly.
    pub fn contains(&self, term: &str) -> bool {
        self.get(term).is_some()
    }

    /// Look up the value associated with `term`, or `None` if absent.
    pub fn get(&self, term: &str) -> Option<u64> {
        match &self.inner {
            FstStorage::Empty => None,
            FstStorage::Memory(m) => m.get(term.as_bytes()),
            FstStorage::Mmap(m) => m.get(term.as_bytes()),
        }
    }

    /// Number of terms in the index.
    pub fn len(&self) -> usize {
        match &self.inner {
            FstStorage::Empty => 0,
            FstStorage::Memory(m) => m.len(),
            FstStorage::Mmap(m) => m.len(),
        }
    }

    /// Returns `true` if the index contains no terms.
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    // -- Internal helpers -----------------------------------------------------

    /// Run an FST automaton query and collect up to `limit` results.
    fn search_with_automaton<A: fst::Automaton>(&self, automaton: A, limit: usize) -> Vec<(String, u64)> {
        match &self.inner {
            FstStorage::Empty => Vec::new(),
            FstStorage::Memory(m) => Self::stream_results(m, automaton, limit),
            FstStorage::Mmap(m) => Self::stream_results(m, automaton, limit),
        }
    }

    /// Stream results from a map with an automaton.
    fn stream_results<D: AsRef<[u8]>, A: fst::Automaton>(
        map: &Map<D>,
        automaton: A,
        limit: usize,
    ) -> Vec<(String, u64)> {
        let mut stream = map.search(automaton).into_stream();
        let mut results = Vec::new();
        while let Some((key, value)) = stream.next() {
            if results.len() >= limit {
                break;
            }
            if let Ok(term) = std::str::from_utf8(key) {
                results.push((term.to_owned(), value));
            }
        }
        results
    }
}

impl Default for FstIndex {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: build the canonical test index.
    fn build_test_index() -> FstIndex {
        let mut terms = vec![
            ("apple".to_string(), 10u64),
            ("application".to_string(), 5),
            ("banana".to_string(), 8),
            ("bandana".to_string(), 3),
            ("cherry".to_string(), 15),
            ("chocolate".to_string(), 7),
        ];
        FstIndex::build(&mut terms).expect("test index build should succeed")
    }

    // -- Build ----------------------------------------------------------------

    #[test]
    fn build_creates_valid_index() {
        let idx = build_test_index();
        assert_eq!(idx.len(), 6);
        assert!(!idx.is_empty());
    }

    #[test]
    fn build_empty_terms() {
        let mut terms: Vec<(String, u64)> = Vec::new();
        let idx = FstIndex::build(&mut terms).expect("empty build should succeed");
        assert!(idx.is_empty());
        assert_eq!(idx.len(), 0);
    }

    #[test]
    fn build_unsorted_input() {
        let mut terms = vec![
            ("cherry".to_string(), 1u64),
            ("apple".to_string(), 2),
            ("banana".to_string(), 3),
        ];
        let idx = FstIndex::build(&mut terms).expect("unsorted build should succeed");
        assert_eq!(idx.len(), 3);
        assert!(idx.contains("apple"));
        assert!(idx.contains("banana"));
        assert!(idx.contains("cherry"));
    }

    #[test]
    fn build_deduplicates() {
        let mut terms = vec![
            ("apple".to_string(), 10u64),
            ("apple".to_string(), 99),
            ("banana".to_string(), 5),
        ];
        let idx = FstIndex::build(&mut terms).expect("dedup build should succeed");
        assert_eq!(idx.len(), 2);
        assert_eq!(idx.get("apple"), Some(10)); // first occurrence wins
    }

    // -- contains / get -------------------------------------------------------

    #[test]
    fn contains_existing_term() {
        let idx = build_test_index();
        assert!(idx.contains("apple"));
        assert!(idx.contains("cherry"));
    }

    #[test]
    fn contains_missing_term() {
        let idx = build_test_index();
        assert!(!idx.contains("mango"));
        assert!(!idx.contains(""));
    }

    #[test]
    fn get_returns_value() {
        let idx = build_test_index();
        assert_eq!(idx.get("apple"), Some(10));
        assert_eq!(idx.get("cherry"), Some(15));
        assert_eq!(idx.get("missing"), None);
    }

    // -- Prefix search --------------------------------------------------------

    #[test]
    fn prefix_search_app() {
        let idx = build_test_index();
        let results: Vec<String> = idx
            .search_prefix("app")
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        assert_eq!(results, vec!["apple", "application"]);
    }

    #[test]
    fn prefix_search_ban() {
        let idx = build_test_index();
        let results: Vec<String> = idx
            .search_prefix("ban")
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        assert_eq!(results, vec!["banana", "bandana"]);
    }

    #[test]
    fn prefix_search_ch() {
        let idx = build_test_index();
        let results: Vec<String> = idx
            .search_prefix("ch")
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        assert_eq!(results, vec!["cherry", "chocolate"]);
    }

    #[test]
    fn prefix_search_no_match() {
        let idx = build_test_index();
        let results = idx.search_prefix("xyz");
        assert!(results.is_empty());
    }

    #[test]
    fn prefix_search_empty_prefix() {
        let idx = build_test_index();
        let results = idx.search_prefix("");
        assert!(results.is_empty());
    }

    #[test]
    fn prefix_search_full_term() {
        let idx = build_test_index();
        let results: Vec<String> = idx
            .search_prefix("cherry")
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        assert_eq!(results, vec!["cherry"]);
    }

    // -- Fuzzy search ---------------------------------------------------------

    #[test]
    fn fuzzy_search_exact_match_distance_0() {
        let idx = build_test_index();
        let results: Vec<String> = idx
            .search_fuzzy("apple", 0)
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        assert_eq!(results, vec!["apple"]);
    }

    #[test]
    fn fuzzy_search_one_edit() {
        let idx = build_test_index();
        // "aple" -> "apple" (insert 'p', distance 1)
        let results: Vec<String> = idx
            .search_fuzzy("aple", 1)
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        assert!(results.contains(&"apple".to_string()));
    }

    #[test]
    fn fuzzy_search_two_edits() {
        let idx = build_test_index();
        // "bananna" -> "banana" distance 1, "bandana" distance 2
        let results: Vec<String> = idx
            .search_fuzzy("bananna", 2)
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        assert!(results.contains(&"banana".to_string()));
        assert!(results.contains(&"bandana".to_string()));
    }

    #[test]
    fn fuzzy_search_no_match() {
        let idx = build_test_index();
        let results = idx.search_fuzzy("zzzzzzz", 1);
        assert!(results.is_empty());
    }

    #[test]
    fn fuzzy_search_empty_term() {
        let idx = build_test_index();
        let results = idx.search_fuzzy("", 1);
        assert!(results.is_empty());
    }

    // -- Save and Load (round-trip) -------------------------------------------

    #[test]
    fn save_and_load_round_trip() {
        let idx = build_test_index();

        let dir = std::env::temp_dir().join("xplorer_test_fst_index");
        let _ = std::fs::create_dir_all(&dir);
        let fst_path = dir.join("test.fst");

        // Save
        idx.save(&fst_path).expect("save should succeed");
        assert!(fst_path.exists(), "FST file should exist after save");

        // Load via mmap
        let loaded = FstIndex::load(&fst_path).expect("load should succeed");

        // Verify the loaded index has the same contents.
        assert_eq!(loaded.len(), idx.len());
        assert!(loaded.contains("apple"));
        assert!(loaded.contains("cherry"));
        assert_eq!(loaded.get("apple"), Some(10));
        assert_eq!(loaded.get("cherry"), Some(15));
        assert!(!loaded.contains("missing"));

        // Prefix search should work on the loaded index.
        let results: Vec<String> = loaded
            .search_prefix("app")
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        assert_eq!(results, vec!["apple", "application"]);

        // Fuzzy search should work on the loaded index.
        let results: Vec<String> = loaded
            .search_fuzzy("aple", 1)
            .into_iter()
            .map(|(t, _)| t)
            .collect();
        assert!(results.contains(&"apple".to_string()));

        // Cleanup
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn load_nonexistent_file_returns_error() {
        let result = FstIndex::load("/no/such/file.fst");
        assert!(result.is_err());
    }

    #[test]
    fn save_empty_index_is_noop() {
        let idx = FstIndex::new();
        let dir = std::env::temp_dir().join("xplorer_test_fst_empty");
        let fst_path = dir.join("empty.fst");

        // Should succeed without creating a file.
        idx.save(&fst_path).expect("save empty should succeed");
    }

    // -- Empty index queries --------------------------------------------------

    #[test]
    fn empty_index_queries() {
        let idx = FstIndex::new();
        assert_eq!(idx.get("anything"), None);
        assert!(!idx.contains("anything"));
        assert!(idx.search_prefix("any").is_empty());
        assert!(idx.search_fuzzy("any", 1).is_empty());
    }

    // -- Default trait --------------------------------------------------------

    #[test]
    fn default_creates_empty() {
        let idx = FstIndex::default();
        assert!(idx.is_empty());
    }

    // -- Saved FST can be re-saved from mmap ----------------------------------

    #[test]
    fn resave_from_mmap() {
        let idx = build_test_index();

        let dir = std::env::temp_dir().join("xplorer_test_fst_resave");
        let _ = std::fs::create_dir_all(&dir);

        let path1 = dir.join("original.fst");
        let path2 = dir.join("copy.fst");

        idx.save(&path1).unwrap();
        let loaded = FstIndex::load(&path1).unwrap();

        // Re-save the mmap-backed index to a new file.
        loaded.save(&path2).unwrap();
        assert!(path2.exists());

        let reloaded = FstIndex::load(&path2).unwrap();
        assert_eq!(reloaded.len(), idx.len());
        assert!(reloaded.contains("banana"));

        let _ = std::fs::remove_dir_all(&dir);
    }
}
