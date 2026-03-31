use std::collections::HashMap;
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
            term_to_id: self.term_to_id.clone(),
            id_to_term: self.id_to_term.clone(),
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

        // Rebuild term interning table and doc_terms if not present in cache (migration).
        let (doc_terms, term_to_id, id_to_term) = if cache.id_to_term.is_empty() {
            // Migration from older cache: rebuild interning table from postings + positions.
            let mut t2id: HashMap<String, u32> = HashMap::new();
            let mut id2t: Vec<String> = Vec::new();
            let mut dt: HashMap<DocId, Vec<u32>> = HashMap::new();

            let mut intern = |term: &str| -> u32 {
                if let Some(&id) = t2id.get(term) {
                    id
                } else {
                    let id = id2t.len() as u32;
                    id2t.push(term.to_string());
                    t2id.insert(term.to_string(), id);
                    id
                }
            };

            for entry_ref in postings.iter() {
                let term = entry_ref.key();
                let entries = entry_ref.value();
                let term_id = intern(term);
                for entry in entries {
                    let ids = dt.entry(entry.doc_id).or_default();
                    if !ids.contains(&term_id) {
                        ids.push(term_id);
                    }
                }
            }
            for (term, doc_positions) in &cache.positions {
                let term_id = intern(term);
                for &doc_id in doc_positions.keys() {
                    let ids = dt.entry(doc_id).or_default();
                    if !ids.contains(&term_id) {
                        ids.push(term_id);
                    }
                }
            }
            (dt, t2id, id2t)
        } else {
            (cache.doc_terms, cache.term_to_id, cache.id_to_term)
        };

        let mut index = Self::new_from_parts(
            cache.documents,
            cache.path_to_id,
            cache.next_id,
            postings,
            cache.positions,
            doc_terms,
            term_to_id,
            id_to_term,
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
