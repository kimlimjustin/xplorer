// Xplorer Search Engine -- Segment-Based Incremental Indexing
//
// Divides the inverted index into immutable segments that can be built
// incrementally and merged in the background. Each segment holds a partial
// inverted index mapping terms to document IDs together with per-document
// term frequency counts used for scoring.
//
// The `SegmentManager` maintains a list of segments and exposes helpers to
// add documents, search across all segments, and compact small segments
// into larger ones.

use std::collections::HashMap;

use tracing::info;

use super::DocId;

// ===== Constants =============================================================

/// When the active segment reaches this many documents it is sealed and a new
/// active segment is created.
const SEGMENT_DOC_THRESHOLD: usize = 1000;

/// Segments with fewer than this many documents are candidates for compaction
/// (merging together).
const COMPACT_THRESHOLD: usize = 500;

// ===== Segment ===============================================================

/// A single segment of the inverted index.
///
/// Each segment is either *active* (still accepting new documents) or
/// *immutable* (sealed). Once sealed, a segment's data is never modified in
/// place -- it can only be merged with another segment to produce a new one.
#[derive(Debug, Clone)]
pub struct Segment {
    /// Unique identifier for this segment.
    pub id: u64,
    /// Partial inverted index: term -> list of doc_ids that contain the term.
    index: HashMap<String, Vec<DocId>>,
    /// Per-document term frequency: (doc_id, term) -> count.
    term_freqs: HashMap<(DocId, String), u32>,
    /// Number of documents in this segment.
    doc_count: usize,
    /// Unix timestamp (seconds) when this segment was created.
    created_at: u64,
}

impl Segment {
    /// Create a new empty segment with the given id.
    pub fn new(id: u64) -> Self {
        Self {
            id,
            index: HashMap::new(),
            term_freqs: HashMap::new(),
            doc_count: 0,
            created_at: now_secs(),
        }
    }

    /// Add a document with its tokenised terms to this segment.
    ///
    /// Each token is recorded in the inverted index and the per-document
    /// term-frequency map is updated.
    pub fn add_document(&mut self, doc_id: DocId, tokens: &[String]) {
        // Count term frequencies for this document.
        let mut tf_map: HashMap<&str, u32> = HashMap::new();
        for token in tokens {
            *tf_map.entry(token.as_str()).or_insert(0) += 1;
        }

        for (term, count) in tf_map {
            let posting_list = self.index.entry(term.to_string()).or_default();
            if !posting_list.contains(&doc_id) {
                posting_list.push(doc_id);
            }
            self.term_freqs
                .insert((doc_id, term.to_string()), count);
        }

        self.doc_count += 1;
    }

    /// Number of documents in this segment.
    pub fn doc_count(&self) -> usize {
        self.doc_count
    }

    /// Unix timestamp (seconds) when this segment was created.
    pub fn created_at(&self) -> u64 {
        self.created_at
    }

    /// Look up the posting list for a single term. Returns an empty slice if
    /// the term is not present.
    pub fn get_postings(&self, term: &str) -> &[DocId] {
        self.index.get(term).map(|v| v.as_slice()).unwrap_or(&[])
    }

    /// Return the term frequency of `term` in `doc_id`, or 0 if absent.
    pub fn term_frequency(&self, doc_id: DocId, term: &str) -> u32 {
        self.term_freqs
            .get(&(doc_id, term.to_string()))
            .copied()
            .unwrap_or(0)
    }

    /// Return every unique term stored in this segment.
    pub fn terms(&self) -> Vec<String> {
        self.index.keys().cloned().collect()
    }

    /// Merge two segments into a single new segment.
    ///
    /// The new segment receives `new_id` and contains the union of all
    /// documents and postings from both inputs.
    pub fn merge(seg_a: &Segment, seg_b: &Segment, new_id: u64) -> Segment {
        let mut merged = Segment::new(new_id);
        merged.created_at = now_secs();

        // Start with a clone of seg_a's data.
        merged.index = seg_a.index.clone();
        merged.term_freqs = seg_a.term_freqs.clone();
        merged.doc_count = seg_a.doc_count;

        // Fold in seg_b.
        for (term, doc_ids) in &seg_b.index {
            let list = merged.index.entry(term.clone()).or_default();
            for &doc_id in doc_ids {
                if !list.contains(&doc_id) {
                    list.push(doc_id);
                }
            }
        }

        for ((doc_id, term), &count) in &seg_b.term_freqs {
            let entry = merged
                .term_freqs
                .entry((*doc_id, term.clone()))
                .or_insert(0);
            // If the same doc appears in both segments (shouldn't normally
            // happen, but be defensive) keep the higher TF.
            *entry = (*entry).max(count);
        }

        merged.doc_count += seg_b.doc_count;

        merged
    }
}

// ===== SegmentManager ========================================================

/// Manages a collection of segments and provides a unified search interface.
///
/// Documents are added to the currently active segment. When the active
/// segment's document count exceeds [`SEGMENT_DOC_THRESHOLD`] it is sealed
/// and a new active segment is created.
pub struct SegmentManager {
    /// All segments (both sealed and the current active one).
    segments: Vec<Segment>,
    /// Index into `segments` for the currently active (writable) segment.
    active_index: usize,
    /// Monotonically increasing counter for generating segment IDs.
    next_id: u64,
}

impl SegmentManager {
    /// Create a new `SegmentManager` with a single empty active segment.
    pub fn new() -> Self {
        let first = Segment::new(0);
        Self {
            segments: vec![first],
            active_index: 0,
            next_id: 1,
        }
    }

    /// Add a document to the active segment. If the active segment exceeds
    /// the document threshold a new active segment is created.
    pub fn add_document(&mut self, doc_id: DocId, tokens: &[String]) {
        self.segments[self.active_index].add_document(doc_id, tokens);

        if self.segments[self.active_index].doc_count() >= SEGMENT_DOC_THRESHOLD {
            info!(
                "[search::segment] sealing segment {} ({} docs)",
                self.segments[self.active_index].id,
                self.segments[self.active_index].doc_count(),
            );
            let new_seg = Segment::new(self.next_id);
            self.next_id += 1;
            self.segments.push(new_seg);
            self.active_index = self.segments.len() - 1;
        }
    }

    /// Search across all segments for documents matching `query_tokens`.
    ///
    /// For each query token the posting lists from every segment are merged.
    /// Documents are scored by the sum of their term frequencies across all
    /// matched tokens (a simple TF score). Results are returned sorted by
    /// score descending.
    pub fn search(&self, query_tokens: &[String]) -> Vec<(DocId, f32)> {
        // Accumulate scores per doc_id.
        let mut scores: HashMap<DocId, f32> = HashMap::new();

        for token in query_tokens {
            for segment in &self.segments {
                let postings = segment.get_postings(token);
                for &doc_id in postings {
                    let tf = segment.term_frequency(doc_id, token) as f32;
                    *scores.entry(doc_id).or_insert(0.0) += tf;
                }
            }
        }

        let mut results: Vec<(DocId, f32)> = scores.into_iter().collect();
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        results
    }

    /// Merge two specific segments by their IDs, replacing them with a single
    /// merged segment. Returns `Ok(new_id)` on success or `Err` if either
    /// segment ID is not found.
    pub fn merge_segments(&mut self, id_a: u64, id_b: u64) -> Result<u64, String> {
        let pos_a = self
            .segments
            .iter()
            .position(|s| s.id == id_a)
            .ok_or_else(|| format!("segment {} not found", id_a))?;
        let pos_b = self
            .segments
            .iter()
            .position(|s| s.id == id_b)
            .ok_or_else(|| format!("segment {} not found", id_b))?;

        if pos_a == pos_b {
            return Err("cannot merge a segment with itself".into());
        }

        // Remember the active segment's ID before any removals.
        let active_seg_id = self.segments[self.active_index].id;
        let removed_active = self.active_index == pos_a || self.active_index == pos_b;

        let new_id = self.next_id;
        self.next_id += 1;

        let merged = Segment::merge(&self.segments[pos_a], &self.segments[pos_b], new_id);

        // Remove the two old segments (remove higher index first to avoid
        // index shift issues).
        let (first, second) = if pos_a < pos_b {
            (pos_a, pos_b)
        } else {
            (pos_b, pos_a)
        };
        self.segments.remove(second);
        self.segments.remove(first);

        // Add the merged segment.
        self.segments.push(merged);

        if removed_active {
            // The active segment was one of the merged ones -- create a new one.
            let fresh = Segment::new(self.next_id);
            self.next_id += 1;
            self.segments.push(fresh);
            self.active_index = self.segments.len() - 1;
        } else {
            // Find the active segment again by its ID.
            self.active_index = self
                .segments
                .iter()
                .position(|s| s.id == active_seg_id)
                .unwrap_or(self.segments.len() - 1);
        }

        info!(
            "[search::segment] merged segments {id_a} + {id_b} -> {new_id}"
        );

        Ok(new_id)
    }

    /// Compact small segments: any sealed segments with fewer than
    /// [`COMPACT_THRESHOLD`] documents are merged together pairwise.
    ///
    /// Returns the number of merge operations performed.
    pub fn compact(&mut self) -> usize {
        let mut merges = 0;

        loop {
            // Collect IDs of small segments (excluding the active segment).
            let small: Vec<u64> = self
                .segments
                .iter()
                .enumerate()
                .filter(|(i, s)| *i != self.active_index && s.doc_count() < COMPACT_THRESHOLD)
                .map(|(_, s)| s.id)
                .collect();

            if small.len() < 2 {
                break;
            }

            // Merge the first two small segments.
            let id_a = small[0];
            let id_b = small[1];
            match self.merge_segments(id_a, id_b) {
                Ok(_) => merges += 1,
                Err(e) => {
                    tracing::warn!("[search::segment] compact merge failed: {e}");
                    break;
                }
            }
        }

        if merges > 0 {
            info!("[search::segment] compacted {merges} segment pair(s)");
        }

        merges
    }

    /// Total number of segments (including the active one).
    pub fn segment_count(&self) -> usize {
        self.segments.len()
    }

    /// Total number of documents across all segments.
    pub fn total_docs(&self) -> usize {
        self.segments.iter().map(|s| s.doc_count()).sum()
    }

    /// Read-only access to all segments.
    pub fn segments(&self) -> &[Segment] {
        &self.segments
    }
}

impl Default for SegmentManager {
    fn default() -> Self {
        Self::new()
    }
}

// ===== Helpers ===============================================================

use crate::utils::now_secs;

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -- Segment creation -----------------------------------------------------

    #[test]
    fn segment_new_is_empty() {
        let seg = Segment::new(42);
        assert_eq!(seg.id, 42);
        assert_eq!(seg.doc_count(), 0);
        assert!(seg.terms().is_empty());
        assert!(seg.created_at() > 0);
    }

    // -- Document addition ----------------------------------------------------

    #[test]
    fn segment_add_document_basic() {
        let mut seg = Segment::new(1);
        let tokens = vec!["hello".to_string(), "world".to_string(), "hello".to_string()];
        seg.add_document(100, &tokens);

        assert_eq!(seg.doc_count(), 1);
        assert_eq!(seg.get_postings("hello"), &[100]);
        assert_eq!(seg.get_postings("world"), &[100]);
        assert_eq!(seg.term_frequency(100, "hello"), 2);
        assert_eq!(seg.term_frequency(100, "world"), 1);
        assert_eq!(seg.term_frequency(100, "missing"), 0);
    }

    #[test]
    fn segment_add_multiple_documents() {
        let mut seg = Segment::new(1);
        seg.add_document(1, &["alpha".into(), "beta".into()]);
        seg.add_document(2, &["beta".into(), "gamma".into()]);
        seg.add_document(3, &["alpha".into(), "gamma".into()]);

        assert_eq!(seg.doc_count(), 3);

        // "alpha" appears in docs 1 and 3.
        let postings = seg.get_postings("alpha");
        assert!(postings.contains(&1));
        assert!(postings.contains(&3));
        assert!(!postings.contains(&2));

        // "beta" appears in docs 1 and 2.
        let postings = seg.get_postings("beta");
        assert!(postings.contains(&1));
        assert!(postings.contains(&2));

        // "gamma" appears in docs 2 and 3.
        let postings = seg.get_postings("gamma");
        assert!(postings.contains(&2));
        assert!(postings.contains(&3));
    }

    #[test]
    fn segment_empty_postings_for_missing_term() {
        let seg = Segment::new(1);
        assert!(seg.get_postings("nonexistent").is_empty());
    }

    // -- Segment merging ------------------------------------------------------

    #[test]
    fn segment_merge_combines_postings() {
        let mut seg_a = Segment::new(1);
        seg_a.add_document(1, &["apple".into(), "banana".into()]);
        seg_a.add_document(2, &["apple".into()]);

        let mut seg_b = Segment::new(2);
        seg_b.add_document(3, &["banana".into(), "cherry".into()]);
        seg_b.add_document(4, &["cherry".into()]);

        let merged = Segment::merge(&seg_a, &seg_b, 99);

        assert_eq!(merged.id, 99);
        assert_eq!(merged.doc_count(), 4); // 2 + 2

        // "apple" from seg_a only.
        let apple = merged.get_postings("apple");
        assert!(apple.contains(&1));
        assert!(apple.contains(&2));

        // "banana" from both segments.
        let banana = merged.get_postings("banana");
        assert!(banana.contains(&1));
        assert!(banana.contains(&3));

        // "cherry" from seg_b only.
        let cherry = merged.get_postings("cherry");
        assert!(cherry.contains(&3));
        assert!(cherry.contains(&4));

        // TF preserved.
        assert_eq!(merged.term_frequency(1, "apple"), 1);
        assert_eq!(merged.term_frequency(3, "banana"), 1);
    }

    #[test]
    fn segment_merge_empty_segments() {
        let seg_a = Segment::new(1);
        let seg_b = Segment::new(2);
        let merged = Segment::merge(&seg_a, &seg_b, 3);
        assert_eq!(merged.doc_count(), 0);
        assert!(merged.terms().is_empty());
    }

    // -- SegmentManager creation ----------------------------------------------

    #[test]
    fn manager_new_has_one_segment() {
        let mgr = SegmentManager::new();
        assert_eq!(mgr.segment_count(), 1);
        assert_eq!(mgr.total_docs(), 0);
    }

    // -- SegmentManager add_document ------------------------------------------

    #[test]
    fn manager_add_document_searchable() {
        let mut mgr = SegmentManager::new();
        mgr.add_document(10, &["rust".into(), "search".into()]);
        mgr.add_document(20, &["rust".into(), "index".into()]);

        assert_eq!(mgr.total_docs(), 2);

        let results = mgr.search(&["rust".into()]);
        assert_eq!(results.len(), 2);
        let doc_ids: Vec<DocId> = results.iter().map(|(id, _)| *id).collect();
        assert!(doc_ids.contains(&10));
        assert!(doc_ids.contains(&20));
    }

    // -- SegmentManager auto-seal on threshold --------------------------------

    #[test]
    fn manager_seals_active_segment_at_threshold() {
        let mut mgr = SegmentManager::new();

        // Add exactly SEGMENT_DOC_THRESHOLD documents.
        for i in 0..SEGMENT_DOC_THRESHOLD as u32 {
            mgr.add_document(i, &["token".into()]);
        }

        // The first segment should have been sealed and a new active segment created.
        assert_eq!(
            mgr.segment_count(),
            2,
            "expected 2 segments after reaching threshold"
        );
        assert_eq!(mgr.total_docs(), SEGMENT_DOC_THRESHOLD);

        // The old segment should have SEGMENT_DOC_THRESHOLD docs.
        assert_eq!(
            mgr.segments()[0].doc_count(),
            SEGMENT_DOC_THRESHOLD,
        );

        // The new active segment should be empty.
        assert_eq!(mgr.segments()[1].doc_count(), 0);
    }

    // -- SegmentManager search across segments --------------------------------

    #[test]
    fn manager_search_across_segments() {
        let mut mgr = SegmentManager::new();

        // Fill the first segment until it seals.
        for i in 0..SEGMENT_DOC_THRESHOLD as u32 {
            mgr.add_document(i, &["common".into()]);
        }

        // Add a document to the new active segment.
        mgr.add_document(9999, &["common".into(), "unique".into()]);

        // "common" should be found in both segments.
        let results = mgr.search(&["common".into()]);
        assert_eq!(results.len(), SEGMENT_DOC_THRESHOLD + 1);

        // "unique" should be found only in the second segment.
        let results = mgr.search(&["unique".into()]);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, 9999);
    }

    // -- SegmentManager search scoring ----------------------------------------

    #[test]
    fn manager_search_scores_by_tf() {
        let mut mgr = SegmentManager::new();
        // doc 1: "rust" appears 3 times
        mgr.add_document(1, &["rust".into(), "rust".into(), "rust".into()]);
        // doc 2: "rust" appears 1 time
        mgr.add_document(2, &["rust".into(), "other".into()]);

        let results = mgr.search(&["rust".into()]);
        assert_eq!(results.len(), 2);
        // doc 1 should score higher (higher TF).
        assert_eq!(results[0].0, 1);
        assert!(results[0].1 > results[1].1);
    }

    #[test]
    fn manager_search_no_results() {
        let mut mgr = SegmentManager::new();
        mgr.add_document(1, &["hello".into()]);

        let results = mgr.search(&["nonexistent".into()]);
        assert!(results.is_empty());
    }

    #[test]
    fn manager_search_empty_query() {
        let mut mgr = SegmentManager::new();
        mgr.add_document(1, &["hello".into()]);

        let results = mgr.search(&[]);
        assert!(results.is_empty());
    }

    // -- SegmentManager merge_segments ----------------------------------------

    #[test]
    fn manager_merge_segments_reduces_count() {
        let mut mgr = SegmentManager::new();

        // Create two sealed segments by filling past the threshold twice.
        for i in 0..(SEGMENT_DOC_THRESHOLD * 2) as u32 {
            mgr.add_document(i, &["data".into()]);
        }

        // Should have 3 segments: 2 sealed + 1 active.
        assert_eq!(mgr.segment_count(), 3);

        let id_0 = mgr.segments()[0].id;
        let id_1 = mgr.segments()[1].id;

        let new_id = mgr.merge_segments(id_0, id_1).unwrap();

        // After merging two sealed segments, count should decrease by 1.
        // (merged replaces 2, but a new active may have been created)
        let total_docs_after = mgr.total_docs();
        assert_eq!(total_docs_after, SEGMENT_DOC_THRESHOLD * 2);

        // The merged segment should be searchable.
        let results = mgr.search(&["data".into()]);
        assert_eq!(results.len(), SEGMENT_DOC_THRESHOLD * 2);
    }

    #[test]
    fn manager_merge_nonexistent_segment_returns_error() {
        let mut mgr = SegmentManager::new();
        let result = mgr.merge_segments(999, 888);
        assert!(result.is_err());
    }

    // -- SegmentManager compact -----------------------------------------------

    #[test]
    fn manager_compact_merges_small_segments() {
        let mut mgr = SegmentManager::new();

        // Manually create several small segments by adding a few docs, then
        // forcing a new segment.
        mgr.add_document(1, &["a".into()]);
        mgr.add_document(2, &["b".into()]);

        // Force a new segment by manipulating the internal state.
        let new_seg = Segment::new(mgr.next_id);
        mgr.next_id += 1;
        mgr.segments.push(new_seg);
        let new_active = mgr.segments.len() - 1;
        mgr.active_index = new_active;

        mgr.add_document(3, &["c".into()]);
        mgr.add_document(4, &["d".into()]);

        // Force another new segment.
        let new_seg2 = Segment::new(mgr.next_id);
        mgr.next_id += 1;
        mgr.segments.push(new_seg2);
        let new_active2 = mgr.segments.len() - 1;
        mgr.active_index = new_active2;

        // We should have 3 segments now: two small sealed ones + active.
        assert_eq!(mgr.segment_count(), 3);

        let merges = mgr.compact();
        assert!(merges >= 1, "expected at least one compaction merge");

        // All documents should still be searchable.
        let results_a = mgr.search(&["a".into()]);
        assert_eq!(results_a.len(), 1);
        let results_d = mgr.search(&["d".into()]);
        assert_eq!(results_d.len(), 1);
    }

    #[test]
    fn manager_compact_no_small_segments_is_noop() {
        let mut mgr = SegmentManager::new();

        // Fill past threshold so the sealed segment has >= COMPACT_THRESHOLD docs.
        for i in 0..SEGMENT_DOC_THRESHOLD as u32 {
            mgr.add_document(i, &["word".into()]);
        }

        let merges = mgr.compact();
        assert_eq!(merges, 0, "no small segments to compact");
    }

    // -- Default trait --------------------------------------------------------

    #[test]
    fn manager_default_works() {
        let mgr = SegmentManager::default();
        assert_eq!(mgr.segment_count(), 1);
        assert_eq!(mgr.total_docs(), 0);
    }

    // -- Multi-token search scoring -------------------------------------------

    #[test]
    fn manager_search_multi_token_scoring() {
        let mut mgr = SegmentManager::new();
        // doc 1: contains both "rust" and "search"
        mgr.add_document(1, &["rust".into(), "search".into()]);
        // doc 2: contains only "rust"
        mgr.add_document(2, &["rust".into(), "other".into()]);
        // doc 3: contains only "search"
        mgr.add_document(3, &["search".into(), "other".into()]);

        let results = mgr.search(&["rust".into(), "search".into()]);

        // doc 1 should score highest (matches both tokens).
        assert_eq!(results[0].0, 1);
        assert!(results[0].1 > results[1].1);

        // All three docs should appear.
        assert_eq!(results.len(), 3);
    }
}
