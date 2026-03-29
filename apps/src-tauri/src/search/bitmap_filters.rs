// Roaring bitmap-based metadata filter indexes for the Xplorer search engine.
//
// Pre-builds compressed bitmap indexes for common file metadata dimensions
// (type, size range, date range, extension) enabling sub-millisecond filter
// intersection via roaring bitmap AND/OR operations.

use roaring::RoaringBitmap;
use std::collections::HashMap;

use super::{classify_extension, DateFilter, FileTypeCategory, SizeFilter};

// ===== Size bucket thresholds =====

const KB_100: u64 = 100 * 1024;
const MB_1: u64 = 1024 * 1024;
const MB_100: u64 = 100 * 1024 * 1024;
const GB_1: u64 = 1024 * 1024 * 1024;

// ===== Date bucket thresholds (seconds) =====

const SECS_24H: u64 = 24 * 60 * 60;
const SECS_7D: u64 = 7 * 24 * 60 * 60;
const SECS_30D: u64 = 30 * 24 * 60 * 60;
const SECS_365D: u64 = 365 * 24 * 60 * 60;

/// Staleness threshold for date bitmaps: 1 hour in seconds.
const STALENESS_THRESHOLD: u64 = 3600;

/// Metadata for a single file used during bitmap construction.
#[derive(Debug, Clone)]
pub struct FileMetaEntry {
    pub doc_id: u32,
    pub extension: String,
    pub size: u64,
    pub modified: u64, // unix timestamp
}

/// Pre-built bitmap indexes for fast metadata filtering.
///
/// Each bitmap stores a set of `doc_id` values that match a given metadata
/// predicate. At query time the engine intersects the relevant bitmaps (a
/// few microseconds even for millions of documents) instead of scanning
/// the full file list.
pub struct BitmapFilterIndex {
    /// File type bitmaps: category -> bitmap of matching doc_ids
    type_bitmaps: HashMap<FileTypeCategory, RoaringBitmap>,

    /// Size range bitmaps (pre-computed buckets)
    size_tiny: RoaringBitmap, // < 100 KB
    size_small: RoaringBitmap,  // 100 KB ..< 1 MB
    size_medium: RoaringBitmap, // 1 MB ..< 100 MB
    size_large: RoaringBitmap,  // 100 MB ..< 1 GB
    size_huge: RoaringBitmap,   // >= 1 GB

    /// Date range bitmaps (pre-computed relative ranges)
    date_today: RoaringBitmap, // modified within 24 h
    date_this_week: RoaringBitmap,  // modified within 7 days
    date_this_month: RoaringBitmap, // modified within 30 days
    date_this_year: RoaringBitmap,  // modified within 365 days
    date_old: RoaringBitmap,        // modified > 1 year ago

    /// Extension bitmaps: lower-case extension -> bitmap
    extension_bitmaps: HashMap<String, RoaringBitmap>,

    /// Universe bitmap containing every known doc_id.
    universe: RoaringBitmap,

    /// When these bitmaps were computed (unix timestamp, seconds).
    computed_at: u64,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

use crate::utils::now_secs;

/// Classify a file size into its bucket index (tiny=0 .. huge=4).
fn size_bucket(size: u64) -> u8 {
    if size < KB_100 {
        0
    } else if size < MB_1 {
        1
    } else if size < MB_100 {
        2
    } else if size < GB_1 {
        3
    } else {
        4
    }
}

/// Classify a modification timestamp into its date bucket index relative to
/// `now` (today=0 .. old=4).
fn date_bucket(modified: u64, now: u64) -> u8 {
    if modified > now {
        // Future timestamps are treated as "today".
        return 0;
    }
    let age = now - modified;
    if age <= SECS_24H {
        0
    } else if age <= SECS_7D {
        1
    } else if age <= SECS_30D {
        2
    } else if age <= SECS_365D {
        3
    } else {
        4
    }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

impl BitmapFilterIndex {
    // -- 1. new() ----------------------------------------------------------

    /// Create an empty index.
    pub fn new() -> Self {
        Self {
            type_bitmaps: HashMap::new(),
            size_tiny: RoaringBitmap::new(),
            size_small: RoaringBitmap::new(),
            size_medium: RoaringBitmap::new(),
            size_large: RoaringBitmap::new(),
            size_huge: RoaringBitmap::new(),
            date_today: RoaringBitmap::new(),
            date_this_week: RoaringBitmap::new(),
            date_this_month: RoaringBitmap::new(),
            date_this_year: RoaringBitmap::new(),
            date_old: RoaringBitmap::new(),
            extension_bitmaps: HashMap::new(),
            universe: RoaringBitmap::new(),
            computed_at: now_secs(),
        }
    }

    // -- 2. build() --------------------------------------------------------

    /// Build all bitmap indexes from a slice of file metadata entries.
    pub fn build(files: &[FileMetaEntry]) -> Self {
        let now = now_secs();
        let mut idx = Self {
            type_bitmaps: HashMap::new(),
            size_tiny: RoaringBitmap::new(),
            size_small: RoaringBitmap::new(),
            size_medium: RoaringBitmap::new(),
            size_large: RoaringBitmap::new(),
            size_huge: RoaringBitmap::new(),
            date_today: RoaringBitmap::new(),
            date_this_week: RoaringBitmap::new(),
            date_this_month: RoaringBitmap::new(),
            date_this_year: RoaringBitmap::new(),
            date_old: RoaringBitmap::new(),
            extension_bitmaps: HashMap::new(),
            universe: RoaringBitmap::new(),
            computed_at: now,
        };

        for entry in files {
            idx.insert_entry(entry, now);
        }

        idx
    }

    // -- 3. add_file() -----------------------------------------------------

    /// Incrementally add a single file to all relevant bitmaps.
    pub fn add_file(&mut self, entry: &FileMetaEntry) {
        let now = self.computed_at; // use the index's reference timestamp
        self.insert_entry(entry, now);
    }

    // -- 4. remove_file() --------------------------------------------------

    /// Remove a `doc_id` from every bitmap in the index.
    pub fn remove_file(&mut self, doc_id: u32) {
        self.universe.remove(doc_id);

        // Type bitmaps
        for bm in self.type_bitmaps.values_mut() {
            bm.remove(doc_id);
        }

        // Size bitmaps
        self.size_tiny.remove(doc_id);
        self.size_small.remove(doc_id);
        self.size_medium.remove(doc_id);
        self.size_large.remove(doc_id);
        self.size_huge.remove(doc_id);

        // Date bitmaps
        self.date_today.remove(doc_id);
        self.date_this_week.remove(doc_id);
        self.date_this_month.remove(doc_id);
        self.date_this_year.remove(doc_id);
        self.date_old.remove(doc_id);

        // Extension bitmaps
        for bm in self.extension_bitmaps.values_mut() {
            bm.remove(doc_id);
        }
    }

    // -- 5. filter_type() --------------------------------------------------

    /// Get the bitmap for a file type category.
    ///
    /// Returns a reference to a static empty bitmap when the category has no
    /// entries so that callers always receive a valid `&RoaringBitmap`.
    pub fn filter_type(&self, category: FileTypeCategory) -> &RoaringBitmap {
        // We use a trick: if the category is not present we return a
        // lazily-initialised static empty bitmap.
        static EMPTY: std::sync::LazyLock<RoaringBitmap> =
            std::sync::LazyLock::new(RoaringBitmap::new);
        self.type_bitmaps.get(&category).unwrap_or(&EMPTY)
    }

    // -- 6. filter_size() --------------------------------------------------

    /// Compute a bitmap for a size range by combining pre-computed buckets.
    ///
    /// The result is the union of every size bucket whose range overlaps with
    /// `[min_bytes, max_bytes]`. If both bounds are `None` the universe
    /// bitmap is returned (no filtering).
    pub fn filter_size(&self, filter: &SizeFilter) -> RoaringBitmap {
        let min = filter.min_bytes.unwrap_or(0);
        let max = filter.max_bytes.unwrap_or(u64::MAX);

        // Each bucket contributes if its range intersects [min, max].
        //   tiny:   [0, 100KB)
        //   small:  [100KB, 1MB)
        //   medium: [1MB, 100MB)
        //   large:  [100MB, 1GB)
        //   huge:   [1GB, +inf)
        let mut result = RoaringBitmap::new();

        // bucket overlaps [min, max] iff bucket_start < max AND bucket_end > min
        if min < KB_100 && max > 0 {
            result |= &self.size_tiny;
        }
        if min < MB_1 && max >= KB_100 {
            result |= &self.size_small;
        }
        if min < MB_100 && max >= MB_1 {
            result |= &self.size_medium;
        }
        if min < GB_1 && max >= MB_100 {
            result |= &self.size_large;
        }
        if max >= GB_1 {
            result |= &self.size_huge;
        }

        result
    }

    // -- 7. filter_date() --------------------------------------------------

    /// Compute a bitmap for a date range.
    ///
    /// For the common "recent window" patterns (e.g. `after = now - 7d,
    /// before = None`) the pre-computed buckets are used directly for speed.
    /// For arbitrary ranges the closest encompassing pre-computed bucket is
    /// returned as an approximation, which is always a super-set of the
    /// precise answer (safe for subsequent refinement).
    pub fn filter_date(&self, filter: &DateFilter) -> RoaringBitmap {
        let now = self.computed_at;

        match (filter.after, filter.before) {
            (None, None) => {
                // No date constraint → return everything.
                self.universe.clone()
            }
            (Some(after), None) => {
                // "Modified after X" — files younger than `now - after` seconds.
                if after > now {
                    return RoaringBitmap::new();
                }
                let age = now - after;
                if age <= SECS_24H {
                    self.date_today.clone()
                } else if age <= SECS_7D {
                    self.date_today.clone() | &self.date_this_week
                } else if age <= SECS_30D {
                    self.date_today.clone() | &self.date_this_week | &self.date_this_month
                } else if age <= SECS_365D {
                    self.date_today.clone()
                        | &self.date_this_week
                        | &self.date_this_month
                        | &self.date_this_year
                } else {
                    // after is more than a year ago → everything qualifies
                    self.universe.clone()
                }
            }
            (None, Some(before)) => {
                // "Modified before X" — files older than `now - before` seconds.
                if before >= now {
                    // before is in the future → everything qualifies
                    return self.universe.clone();
                }
                let age = now - before;
                if age > SECS_365D {
                    self.date_old.clone()
                } else if age > SECS_30D {
                    self.date_old.clone() | &self.date_this_year
                } else if age > SECS_7D {
                    self.date_old.clone() | &self.date_this_year | &self.date_this_month
                } else if age > SECS_24H {
                    self.date_old.clone()
                        | &self.date_this_year
                        | &self.date_this_month
                        | &self.date_this_week
                } else {
                    // before is very recent → everything qualifies
                    self.universe.clone()
                }
            }
            (Some(after), Some(before)) => {
                // Arbitrary window — intersect the two half-ranges.
                let after_bm = self.filter_date(&DateFilter {
                    after: Some(after),
                    before: None,
                });
                let before_bm = self.filter_date(&DateFilter {
                    after: None,
                    before: Some(before),
                });
                after_bm & before_bm
            }
        }
    }

    // -- 8. filter_extension() ---------------------------------------------

    /// Get the bitmap for a specific file extension. Returns an empty bitmap
    /// if the extension has no indexed files.
    pub fn filter_extension(&self, ext: &str) -> RoaringBitmap {
        let key = ext.to_lowercase();
        self.extension_bitmaps
            .get(&key)
            .cloned()
            .unwrap_or_default()
    }

    // -- 9. apply_filters() ------------------------------------------------

    /// Intersect all applicable filters and return the resulting doc_id set.
    ///
    /// If `base` is provided the intersection starts from that bitmap,
    /// otherwise the full universe is used.
    pub fn apply_filters(
        &self,
        base: Option<&RoaringBitmap>,
        file_type: Option<FileTypeCategory>,
        size: Option<&SizeFilter>,
        date: Option<&DateFilter>,
        extensions: &[String],
    ) -> RoaringBitmap {
        let mut result = match base {
            Some(bm) => bm.clone(),
            None => self.universe.clone(),
        };

        if let Some(cat) = file_type {
            result &= self.filter_type(cat);
        }

        if let Some(sf) = size {
            result &= self.filter_size(sf);
        }

        if let Some(df) = date {
            result &= self.filter_date(df);
        }

        if !extensions.is_empty() {
            // Union the bitmaps for all requested extensions, then intersect.
            let mut ext_union = RoaringBitmap::new();
            for ext in extensions {
                ext_union |= self.filter_extension(ext);
            }
            result &= ext_union;
        }

        result
    }

    // -- 10. needs_refresh() -----------------------------------------------

    /// Check whether the date bitmaps are stale.
    ///
    /// Date buckets are relative to `computed_at`; if the index was built
    /// more than one hour ago the buckets may have drifted and should be
    /// rebuilt.
    pub fn needs_refresh(&self) -> bool {
        let now = now_secs();
        now.saturating_sub(self.computed_at) > STALENESS_THRESHOLD
    }

    // -- 11. len() ---------------------------------------------------------

    /// Total unique doc_ids tracked by the index.
    pub fn len(&self) -> usize {
        self.universe.len() as usize
    }

    /// Whether the index contains zero documents.
    pub fn is_empty(&self) -> bool {
        self.universe.is_empty()
    }

    // -- internal helpers --------------------------------------------------

    /// Insert a single entry into all relevant bitmaps using the given
    /// reference `now` timestamp for date bucket classification.
    fn insert_entry(&mut self, entry: &FileMetaEntry, now: u64) {
        let id = entry.doc_id;

        self.universe.insert(id);

        // --- Type bitmap ---
        if let Some(cat) = classify_extension(&entry.extension) {
            self.type_bitmaps.entry(cat).or_default().insert(id);
        }

        // --- Size bitmap ---
        match size_bucket(entry.size) {
            0 => self.size_tiny.insert(id),
            1 => self.size_small.insert(id),
            2 => self.size_medium.insert(id),
            3 => self.size_large.insert(id),
            _ => self.size_huge.insert(id),
        };

        // --- Date bitmap ---
        match date_bucket(entry.modified, now) {
            0 => self.date_today.insert(id),
            1 => self.date_this_week.insert(id),
            2 => self.date_this_month.insert(id),
            3 => self.date_this_year.insert(id),
            _ => self.date_old.insert(id),
        };

        // --- Extension bitmap ---
        let ext = entry.extension.to_lowercase();
        if !ext.is_empty() {
            self.extension_bitmaps.entry(ext).or_default().insert(id);
        }
    }
}

impl Default for BitmapFilterIndex {
    fn default() -> Self {
        Self::new()
    }
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: generate a fixed "now" timestamp for deterministic tests.
    const TEST_NOW: u64 = 1_700_000_000; // ~2023-11-14

    fn make_entries() -> Vec<FileMetaEntry> {
        vec![
            // 0: tiny image, modified today
            FileMetaEntry {
                doc_id: 0,
                extension: "png".into(),
                size: 50 * 1024,           // 50 KB
                modified: TEST_NOW - 3600, // 1 hour ago
            },
            // 1: small code file, modified this week
            FileMetaEntry {
                doc_id: 1,
                extension: "rs".into(),
                size: 500 * 1024, // 500 KB
                modified: TEST_NOW - 3 * SECS_24H,
            },
            // 2: medium document, modified this month
            FileMetaEntry {
                doc_id: 2,
                extension: "pdf".into(),
                size: 5 * MB_1, // 5 MB
                modified: TEST_NOW - 15 * SECS_24H,
            },
            // 3: large video, modified this year
            FileMetaEntry {
                doc_id: 3,
                extension: "mp4".into(),
                size: 200 * MB_1, // 200 MB
                modified: TEST_NOW - 200 * SECS_24H,
            },
            // 4: huge archive, old
            FileMetaEntry {
                doc_id: 4,
                extension: "zip".into(),
                size: 2 * GB_1, // 2 GB
                modified: TEST_NOW - 500 * SECS_24H,
            },
            // 5: large image, modified today
            FileMetaEntry {
                doc_id: 5,
                extension: "jpg".into(),
                size: 150 * MB_1,          // 150 MB
                modified: TEST_NOW - 7200, // 2 hours ago
            },
            // 6: tiny audio, modified this week
            FileMetaEntry {
                doc_id: 6,
                extension: "mp3".into(),
                size: 80 * 1024, // 80 KB
                modified: TEST_NOW - 5 * SECS_24H,
            },
        ]
    }

    /// Build an index with a fixed `computed_at` for reproducible date buckets.
    fn build_test_index() -> BitmapFilterIndex {
        let entries = make_entries();
        let mut idx = BitmapFilterIndex::new();
        idx.computed_at = TEST_NOW;
        for e in &entries {
            idx.insert_entry(e, TEST_NOW);
        }
        idx
    }

    // -- type bitmaps correct ----------------------------------------------

    #[test]
    fn type_bitmaps_correct() {
        let idx = build_test_index();

        let images = idx.filter_type(FileTypeCategory::Images);
        assert!(images.contains(0)); // png
        assert!(images.contains(5)); // jpg
        assert_eq!(images.len(), 2);

        let code = idx.filter_type(FileTypeCategory::Code);
        assert!(code.contains(1)); // rs
        assert_eq!(code.len(), 1);

        let documents = idx.filter_type(FileTypeCategory::Documents);
        assert!(documents.contains(2)); // pdf
        assert_eq!(documents.len(), 1);

        let videos = idx.filter_type(FileTypeCategory::Videos);
        assert!(videos.contains(3)); // mp4
        assert_eq!(videos.len(), 1);

        let archives = idx.filter_type(FileTypeCategory::Archives);
        assert!(archives.contains(4)); // zip
        assert_eq!(archives.len(), 1);

        let audio = idx.filter_type(FileTypeCategory::Audio);
        assert!(audio.contains(6)); // mp3
        assert_eq!(audio.len(), 1);
    }

    // -- size filter: "large" returns only > 100 MB files ------------------

    #[test]
    fn size_filter_large_only() {
        let idx = build_test_index();
        let result = idx.filter_size(&SizeFilter {
            min_bytes: Some(MB_100),
            max_bytes: None,
        });
        // doc 3 (200 MB) and doc 4 (2 GB) and doc 5 (150 MB)
        assert!(result.contains(3));
        assert!(result.contains(4));
        assert!(result.contains(5));
        assert!(!result.contains(0)); // 50 KB
        assert!(!result.contains(1)); // 500 KB
        assert!(!result.contains(2)); // 5 MB
    }

    // -- date filter: "today" returns only recent files --------------------

    #[test]
    fn date_filter_today() {
        let idx = build_test_index();
        let result = idx.filter_date(&DateFilter {
            after: Some(TEST_NOW - SECS_24H),
            before: None,
        });
        // Only docs modified within the last 24 hours: doc 0 and doc 5
        assert!(result.contains(0));
        assert!(result.contains(5));
        assert!(!result.contains(1));
        assert!(!result.contains(4));
    }

    // -- extension filter: "pdf" returns only pdf doc_ids ------------------

    #[test]
    fn extension_filter_pdf() {
        let idx = build_test_index();
        let result = idx.filter_extension("pdf");
        assert!(result.contains(2));
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn extension_filter_case_insensitive() {
        let idx = build_test_index();
        let result = idx.filter_extension("PDF");
        assert!(result.contains(2));
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn extension_filter_missing_returns_empty() {
        let idx = build_test_index();
        let result = idx.filter_extension("xyz");
        assert!(result.is_empty());
    }

    // -- intersection: large AND images ------------------------------------

    #[test]
    fn intersection_large_and_images() {
        let idx = build_test_index();
        let result = idx.apply_filters(
            None,
            Some(FileTypeCategory::Images),
            Some(&SizeFilter {
                min_bytes: Some(MB_100),
                max_bytes: None,
            }),
            None,
            &[],
        );
        // Only doc 5: 150 MB jpg
        assert!(result.contains(5));
        assert!(!result.contains(0)); // 50 KB png — too small
        assert!(!result.contains(3)); // 200 MB mp4 — not an image
        assert_eq!(result.len(), 1);
    }

    // -- add_file adds to correct bitmaps ----------------------------------

    #[test]
    fn add_file_inserts_correctly() {
        let mut idx = BitmapFilterIndex::new();
        idx.computed_at = TEST_NOW;

        let entry = FileMetaEntry {
            doc_id: 42,
            extension: "rs".into(),
            size: 2 * MB_1,
            modified: TEST_NOW - 3600,
        };
        idx.add_file(&entry);

        assert_eq!(idx.len(), 1);
        assert!(idx.filter_type(FileTypeCategory::Code).contains(42));
        assert!(idx.size_medium.contains(42));
        assert!(idx.date_today.contains(42));
        assert!(idx.filter_extension("rs").contains(42));
    }

    // -- remove_file removes from all bitmaps ------------------------------

    #[test]
    fn remove_file_clears_all() {
        let mut idx = build_test_index();
        assert!(idx.universe.contains(0));

        idx.remove_file(0);

        assert!(!idx.universe.contains(0));
        assert!(!idx.filter_type(FileTypeCategory::Images).contains(0));
        assert!(!idx.size_tiny.contains(0));
        assert!(!idx.date_today.contains(0));
        assert!(!idx.filter_extension("png").contains(0));
    }

    // -- empty filters return full set -------------------------------------

    #[test]
    fn empty_filters_return_universe() {
        let idx = build_test_index();
        let result = idx.apply_filters(None, None, None, None, &[]);
        assert_eq!(result.len(), idx.universe.len());
        assert_eq!(result, idx.universe);
    }

    // -- apply_filters with multiple conditions ----------------------------

    #[test]
    fn apply_filters_multiple_conditions() {
        let idx = build_test_index();
        // Images, modified this week, small or tiny size
        let result = idx.apply_filters(
            None,
            Some(FileTypeCategory::Images),
            Some(&SizeFilter {
                min_bytes: None,
                max_bytes: Some(MB_1),
            }),
            Some(&DateFilter {
                after: Some(TEST_NOW - SECS_7D),
                before: None,
            }),
            &[],
        );
        // doc 0: png, 50 KB, 1 hour ago → matches all three
        // doc 5: jpg, 150 MB, 2 hours ago → too large
        assert!(result.contains(0));
        assert!(!result.contains(5));
        assert_eq!(result.len(), 1);
    }

    // -- apply_filters with extension filter -------------------------------

    #[test]
    fn apply_filters_with_extensions() {
        let idx = build_test_index();
        let result = idx.apply_filters(None, None, None, None, &["png".into(), "jpg".into()]);
        // Only image files by extension: doc 0 (png) and doc 5 (jpg)
        assert!(result.contains(0));
        assert!(result.contains(5));
        assert_eq!(result.len(), 2);
    }

    // -- apply_filters with a base bitmap ----------------------------------

    #[test]
    fn apply_filters_with_base() {
        let idx = build_test_index();

        // Start with only doc_ids 0, 1, 2
        let mut base = RoaringBitmap::new();
        base.insert(0);
        base.insert(1);
        base.insert(2);

        let result =
            idx.apply_filters(Some(&base), Some(FileTypeCategory::Images), None, None, &[]);
        // Of {0,1,2}, only 0 is an image
        assert!(result.contains(0));
        assert_eq!(result.len(), 1);
    }

    // -- len and is_empty --------------------------------------------------

    #[test]
    fn len_and_is_empty() {
        let idx = build_test_index();
        assert_eq!(idx.len(), 7);
        assert!(!idx.is_empty());

        let empty = BitmapFilterIndex::new();
        assert_eq!(empty.len(), 0);
        assert!(empty.is_empty());
    }

    // -- needs_refresh -----------------------------------------------------

    #[test]
    fn needs_refresh_fresh() {
        let mut idx = BitmapFilterIndex::new();
        idx.computed_at = now_secs();
        assert!(!idx.needs_refresh());
    }

    #[test]
    fn needs_refresh_stale() {
        let mut idx = BitmapFilterIndex::new();
        idx.computed_at = now_secs() - STALENESS_THRESHOLD - 1;
        assert!(idx.needs_refresh());
    }

    // -- build() produces same results as incremental add ------------------

    #[test]
    fn build_vs_incremental_equivalence() {
        let entries = make_entries();

        // Build all at once (but with our fixed timestamp).
        let mut batch = BitmapFilterIndex::new();
        batch.computed_at = TEST_NOW;
        for e in &entries {
            batch.insert_entry(e, TEST_NOW);
        }

        // Build incrementally.
        let mut incr = BitmapFilterIndex::new();
        incr.computed_at = TEST_NOW;
        for e in &entries {
            incr.add_file(e);
        }

        assert_eq!(batch.universe, incr.universe);
        assert_eq!(batch.size_tiny, incr.size_tiny);
        assert_eq!(batch.size_large, incr.size_large);
        assert_eq!(batch.date_today, incr.date_today);
        assert_eq!(batch.date_old, incr.date_old);
    }

    // -- size filter edge: exact boundaries --------------------------------

    #[test]
    fn size_filter_exact_boundary() {
        let mut idx = BitmapFilterIndex::new();
        idx.computed_at = TEST_NOW;

        // File exactly at 100 KB boundary → falls into "small" bucket
        idx.insert_entry(
            &FileMetaEntry {
                doc_id: 10,
                extension: "txt".into(),
                size: KB_100,
                modified: TEST_NOW,
            },
            TEST_NOW,
        );
        // File at 99,999 bytes → "tiny" bucket
        idx.insert_entry(
            &FileMetaEntry {
                doc_id: 11,
                extension: "txt".into(),
                size: KB_100 - 1,
                modified: TEST_NOW,
            },
            TEST_NOW,
        );

        assert!(idx.size_small.contains(10));
        assert!(!idx.size_tiny.contains(10));
        assert!(idx.size_tiny.contains(11));
        assert!(!idx.size_small.contains(11));
    }

    // -- date filter: no constraint returns universe -----------------------

    #[test]
    fn date_filter_no_constraint() {
        let idx = build_test_index();
        let result = idx.filter_date(&DateFilter {
            after: None,
            before: None,
        });
        assert_eq!(result, idx.universe);
    }

    // -- unknown extension does not crash ----------------------------------

    #[test]
    fn unknown_extension_no_type_bitmap() {
        let mut idx = BitmapFilterIndex::new();
        idx.computed_at = TEST_NOW;
        idx.insert_entry(
            &FileMetaEntry {
                doc_id: 99,
                extension: "weirdext".into(),
                size: 1024,
                modified: TEST_NOW,
            },
            TEST_NOW,
        );
        // Should be in the universe and the extension bitmap but NOT in any
        // type bitmap.
        assert!(idx.universe.contains(99));
        assert!(idx.filter_extension("weirdext").contains(99));
        assert!(idx.filter_type(FileTypeCategory::Images).is_empty());
        assert!(idx.filter_type(FileTypeCategory::Code).is_empty());
    }
}
