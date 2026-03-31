use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use dashmap::DashMap;
use tracing::{info, warn};

use super::bitmap_filters::FileMetaEntry;
use super::index::SearchIndex;
use super::index_types::{DocId, IndexCache, PostingEntry, INDEX_CACHE_VERSION};

/// Path to the on-disk index cache file.
fn index_cache_path() -> PathBuf {
    let base = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("xplorer").join("search_index.bin")
}

impl SearchIndex {
    /// Save the current index to disk as a bincode file.
    ///
    /// Uses atomic write (tmp + rename) to prevent corruption.
    pub fn save_to_disk(&self) {
        let path = index_cache_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let postings_snapshot: HashMap<String, Vec<PostingEntry>> = self
            .postings
            .iter()
            .map(|r| (r.key().clone(), r.value().clone()))
            .collect();

        let cache = IndexCache {
            version: INDEX_CACHE_VERSION,
            documents: self.documents.clone(),
            path_to_id: self.path_to_id.clone(),
            next_id: self.next_id,
            postings: postings_snapshot,
            positions: self.positions.clone(),
            doc_field_lengths: self.doc_field_lengths.clone(),
            doc_content: self.doc_content.clone(),
            total_tokens: self.total_tokens,
            doc_terms: self.doc_terms.clone(),
        };

        let tmp_path = path.with_extension("bin.tmp");
        match bincode::serialize(&cache) {
            Ok(bytes) => {
                let size_mb = bytes.len() as f64 / (1024.0 * 1024.0);
                if std::fs::write(&tmp_path, &bytes).is_ok() {
                    if std::fs::rename(&tmp_path, &path).is_ok() {
                        info!(
                            "[SearchIndex] Saved index cache ({:.1} MB, {} docs, {} terms)",
                            size_mb,
                            self.documents.len(),
                            self.postings.len()
                        );
                    } else {
                        let _ = std::fs::remove_file(&tmp_path);
                        warn!("[SearchIndex] Failed to rename cache file");
                    }
                } else {
                    warn!("[SearchIndex] Failed to write cache file");
                }
            }
            Err(e) => {
                warn!("[SearchIndex] Failed to serialize index cache: {e}");
            }
        }
    }

    /// Load the index from disk cache, rebuilding FST/bitmap/scorer.
    ///
    /// Returns `None` if no cache exists, version mismatches, or deserialization fails.
    pub fn load_from_disk() -> Option<Self> {
        let path = index_cache_path();
        let bytes = match std::fs::read(&path) {
            Ok(b) => b,
            Err(_) => return None,
        };

        let cache: IndexCache = match bincode::deserialize(&bytes) {
            Ok(c) => c,
            Err(e) => {
                warn!("[SearchIndex] Failed to deserialize cache: {e}");
                return None;
            }
        };

        if cache.version != INDEX_CACHE_VERSION {
            info!(
                "[SearchIndex] Cache version mismatch (got {}, expected {}), rebuilding",
                cache.version, INDEX_CACHE_VERSION
            );
            return None;
        }

        let doc_count = cache.documents.len();
        let term_count = cache.postings.len();

        let postings: DashMap<String, Vec<PostingEntry>> = cache.postings.into_iter().collect();

        // Rebuild doc_terms reverse index if not present in cache (migration)
        let doc_terms = if cache.doc_terms.is_empty() {
            let mut dt: HashMap<DocId, HashSet<String>> = HashMap::new();
            for entry_ref in postings.iter() {
                let term = entry_ref.key();
                let entries = entry_ref.value();
                for entry in entries {
                    dt.entry(entry.doc_id).or_default().insert(term.clone());
                }
            }
            for (term, doc_positions) in &cache.positions {
                for &doc_id in doc_positions.keys() {
                    dt.entry(doc_id).or_default().insert(term.clone());
                }
            }
            dt
        } else {
            cache.doc_terms
        };

        let mut index = Self::new_from_parts(
            cache.documents,
            cache.path_to_id,
            cache.next_id,
            postings,
            cache.positions,
            doc_terms,
            cache.doc_field_lengths,
            cache.doc_content,
            cache.total_tokens,
        );

        // Rebuild derived structures from loaded data.
        index.rebuild_fst();
        index.update_scorer_stats();

        // Rebuild bitmap filters from document metadata.
        for doc in index.documents.values() {
            index.bitmap_index.add_file(&FileMetaEntry {
                doc_id: doc.doc_id,
                extension: doc.extension.clone(),
                size: doc.file_size,
                modified: doc.modified,
            });
        }

        info!(
            "[SearchIndex] Loaded cached index ({} docs, {} terms)",
            doc_count, term_count
        );

        Some(index)
    }
}
