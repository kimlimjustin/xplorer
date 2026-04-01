// Xplorer Search Engine — Watcher & Directory Walking
//
// File-system watcher setup, directory walking, full rebuild,
// and incremental update logic for the SearchEngine.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};

use jwalk::WalkDir;
use rayon::prelude::*;
use tracing::{info, warn};

use super::compat_engine::SearchEngine;
use super::compat_persistence::{
    content_source_for, file_meta, is_text_indexable, read_file_content,
};
use super::compat_types::TokenizerSettings;
use super::index::SearchIndex;
use super::watcher::{FileChangeEvent, FileWatcher};

impl SearchEngine {
    /// Internal: walk whitelisted paths, read files, populate the index from scratch.
    pub(crate) fn rebuild_full_index_inner(
        index: &Arc<RwLock<SearchIndex>>,
        settings_arc: &Arc<Mutex<TokenizerSettings>>,
    ) {
        let settings = settings_arc
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();

        let blacklisted: HashSet<String> = settings
            .blacklisted_extensions
            .iter()
            .map(|e| e.to_lowercase())
            .collect();

        // Collect all indexable files.
        let mut files_to_index: Vec<PathBuf> = Vec::new();

        for root in &settings.whitelisted_paths {
            let root_path = Path::new(root);
            if !root_path.exists() {
                warn!("[SearchEngine] Whitelisted path does not exist: {}", root);
                continue;
            }

            for entry in WalkDir::new(root_path)
                .sort(false)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let path = entry.path();

                // Skip hidden directories.
                if path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with('.'))
                    .unwrap_or(false)
                {
                    continue;
                }

                if is_text_indexable(&path, &blacklisted, settings.max_file_size) {
                    files_to_index.push(path);
                }
            }
        }

        info!(
            "[SearchEngine] Found {} files to index",
            files_to_index.len()
        );

        // Clear the index before a full rebuild.
        {
            let mut idx = match index.write() {
                Ok(g) => g,
                Err(e) => e.into_inner(),
            };
            *idx = SearchIndex::new();
        }

        let memory_limit_bytes = (settings.memory_limit_mb as usize) * 1024 * 1024;

        // Index in batches to avoid loading all file contents into RAM at once.
        // Each batch reads up to BATCH_SIZE files, indexes them, then drops.
        const BATCH_SIZE: usize = 500;
        let mut indexed_count: usize = 0;
        let mut budget_exhausted = false;

        for chunk in files_to_index.chunks(BATCH_SIZE) {
            if budget_exhausted {
                break;
            }

            // Phase 1: parallel content reading for this batch only.
            let file_contents: Vec<_> = chunk
                .par_iter()
                .filter_map(|file_path| {
                    let content = read_file_content(file_path)?;
                    let source = content_source_for(file_path);
                    let (size, modified) = file_meta(file_path);
                    let path_str = file_path.to_string_lossy().to_string();
                    Some((path_str, content, source, size, modified))
                })
                .collect();

            // Phase 2: index this batch under the write lock.
            {
                let mut idx = index.write().unwrap_or_else(|e| e.into_inner());
                for (path_str, content, source, size, modified) in &file_contents {
                    idx.index_document(path_str, content, source, *size, *modified);
                    indexed_count += 1;

                    if memory_limit_bytes > 0 && idx.estimated_memory_bytes() >= memory_limit_bytes {
                        warn!(
                            "[SearchEngine] Memory limit reached ({} MB). Stopping indexing after {} files.",
                            settings.memory_limit_mb,
                            indexed_count
                        );
                        budget_exhausted = true;
                        break;
                    }
                }
            }
            // file_contents dropped here — batch memory freed
        }

        // Rebuild FST and update BM25F corpus stats.
        {
            let mut idx = match index.write() {
                Ok(g) => g,
                Err(e) => e.into_inner(),
            };
            idx.rebuild_fst();
            idx.update_scorer_stats();
        }

        info!(
            "[SearchEngine] Indexed {} / {} files",
            indexed_count,
            files_to_index.len()
        );
    }

    /// Incremental update: compare cached index against filesystem.
    ///
    /// 1. Walk whitelisted paths to find all current indexable files.
    /// 2. Remove stale docs (deleted files or files with changed timestamps).
    /// 3. Index only new or modified files.
    /// 4. Rebuild FST + scorer stats.
    pub(crate) fn incremental_update_inner(
        index: &Arc<RwLock<SearchIndex>>,
        settings_arc: &Arc<Mutex<TokenizerSettings>>,
    ) {
        let settings = settings_arc
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();

        let blacklisted: HashSet<String> = settings
            .blacklisted_extensions
            .iter()
            .map(|e| e.to_lowercase())
            .collect();

        // Collect all currently indexable files with their metadata.
        let mut current_files: HashMap<String, u64> = HashMap::new(); // path -> modified

        for root in &settings.whitelisted_paths {
            let root_path = Path::new(root);
            if !root_path.exists() {
                continue;
            }

            for entry in WalkDir::new(root_path)
                .sort(false)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let path = entry.path();
                if path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with('.'))
                    .unwrap_or(false)
                {
                    continue;
                }
                if is_text_indexable(&path, &blacklisted, settings.max_file_size) {
                    let (_, modified) = file_meta(&path);
                    current_files.insert(path.to_string_lossy().to_string(), modified);
                }
            }
        }

        // Find stale documents (deleted or modified) and new files.
        let mut stale_paths: Vec<String> = Vec::new();
        let mut new_or_modified: Vec<String> = Vec::new();

        {
            let idx = match index.read() {
                Ok(g) => g,
                Err(e) => e.into_inner(),
            };

            // Check cached docs against filesystem.
            for doc in idx.documents().values() {
                match current_files.get(&doc.path) {
                    None => {
                        // File no longer exists or no longer in whitelisted paths.
                        stale_paths.push(doc.path.clone());
                    }
                    Some(&fs_modified) => {
                        if fs_modified != doc.modified {
                            // File was modified since last index.
                            stale_paths.push(doc.path.clone());
                            new_or_modified.push(doc.path.clone());
                        }
                    }
                }
            }

            // Find files not yet in the index.
            for path in current_files.keys() {
                if idx.get_document(path).is_none() {
                    new_or_modified.push(path.clone());
                }
            }
        }

        info!(
            "[SearchEngine] Incremental update: {} stale, {} new/modified (out of {} cached docs, {} current files)",
            stale_paths.len(),
            new_or_modified.len(),
            {
                let idx = match index.read() { Ok(g) => g, Err(e) => e.into_inner() };
                idx.documents().len()
            },
            current_files.len()
        );

        if stale_paths.is_empty() && new_or_modified.is_empty() {
            info!("[SearchEngine] Cache is up to date, no changes needed");
            return;
        }

        // Remove stale documents.
        if !stale_paths.is_empty() {
            let mut idx = match index.write() {
                Ok(g) => g,
                Err(e) => e.into_inner(),
            };
            for path in &stale_paths {
                idx.remove_document(path);
            }
        }

        // Index new/modified files.
        let memory_limit_bytes = (settings.memory_limit_mb as usize) * 1024 * 1024;

        // Index in batches to limit peak memory usage.
        let new_or_mod_vec: Vec<_> = new_or_modified.into_iter().collect();
        let mut indexed_count: usize = 0;
        let mut budget_exhausted = false;

        for chunk in new_or_mod_vec.chunks(500) {
            if budget_exhausted {
                break;
            }

            let file_contents: Vec<_> = chunk
                .par_iter()
                .filter_map(|path_str| {
                    let file_path = Path::new(path_str);
                    let content = read_file_content(file_path)?;
                    let source = content_source_for(file_path);
                    let (size, modified) = file_meta(file_path);
                    Some((path_str.clone(), content, source, size, modified))
                })
                .collect();

            {
                let mut idx = index.write().unwrap_or_else(|e| e.into_inner());
                for (path_str, content, source, size, modified) in &file_contents {
                    idx.index_document(path_str, content, source, *size, *modified);
                    indexed_count += 1;

                    if memory_limit_bytes > 0 && idx.estimated_memory_bytes() >= memory_limit_bytes {
                        warn!(
                            "[SearchEngine] Memory limit reached during incremental update after {} files.",
                            indexed_count
                        );
                        budget_exhausted = true;
                        break;
                    }
                }
            }
        }

        // Rebuild FST and scorer stats.
        {
            let mut idx = match index.write() {
                Ok(g) => g,
                Err(e) => e.into_inner(),
            };
            idx.rebuild_fst();
            idx.update_scorer_stats();
        }

        info!(
            "[SearchEngine] Incremental update complete: removed {}, indexed {}",
            stale_paths.len(),
            indexed_count
        );
    }

    /// Internal directory indexing logic (runs on background thread).
    pub(crate) fn index_directory_inner(
        index: &Arc<RwLock<SearchIndex>>,
        settings_arc: &Arc<Mutex<TokenizerSettings>>,
        path_str: &str,
        depth: u32,
    ) {
        let settings = settings_arc
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();

        let blacklisted: HashSet<String> = settings
            .blacklisted_extensions
            .iter()
            .map(|e| e.to_lowercase())
            .collect();

        let root = Path::new(path_str);
        if !root.exists() || !root.is_dir() {
            return;
        }

        // Check if this path is blacklisted.
        let norm_path = path_str.replace('\\', "/").to_lowercase();
        for bp in &settings.blacklisted_paths {
            let norm_bp = bp.replace('\\', "/").to_lowercase();
            if norm_path.starts_with(&norm_bp) {
                return;
            }
        }

        let mut files_to_index: Vec<PathBuf> = Vec::new();
        let mut dirs_to_index: Vec<PathBuf> = Vec::new();

        for entry in WalkDir::new(root)
            .sort(false)
            .max_depth(depth as usize)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let p = entry.path();
            if p.as_path() == root {
                continue;
            }
            if p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with('.'))
                .unwrap_or(false)
            {
                continue;
            }
            if p.is_dir() {
                dirs_to_index.push(p);
            } else if is_text_indexable(&p, &blacklisted, settings.max_file_size) {
                files_to_index.push(p);
            }
        }

        if files_to_index.is_empty() && dirs_to_index.is_empty() {
            return;
        }

        info!(
            "[SearchEngine] Auto-indexing {} files + {} folders from {}",
            files_to_index.len(),
            dirs_to_index.len(),
            path_str
        );

        // -- PHASE 1: Index filenames only (fast) --
        let mut name_indexed: usize = 0;
        let mut files_needing_content: Vec<PathBuf> = Vec::new();

        // Index directories by name.
        for dir_path in &dirs_to_index {
            let ps = dir_path.to_string_lossy().to_string();
            {
                let idx = match index.read() {
                    Ok(g) => g,
                    Err(e) => e.into_inner(),
                };
                if idx.get_document(&ps).is_some() {
                    continue;
                }
            }
            let dir_name = dir_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
            let (size, modified) = file_meta(dir_path);
            {
                let mut idx = match index.write() {
                    Ok(g) => g,
                    Err(e) => e.into_inner(),
                };
                idx.index_document(&ps, dir_name, "directory", size, modified);
            }
            name_indexed += 1;
        }

        // Index files by filename first (no content read yet).
        for file_path in &files_to_index {
            let ps = file_path.to_string_lossy().to_string();
            {
                let idx = match index.read() {
                    Ok(g) => g,
                    Err(e) => e.into_inner(),
                };
                if idx.get_document(&ps).is_some() {
                    continue;
                }
            }
            let file_name = file_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
            let (size, modified) = file_meta(file_path);
            {
                let mut idx = match index.write() {
                    Ok(g) => g,
                    Err(e) => e.into_inner(),
                };
                idx.index_document(&ps, file_name, "filename_only", size, modified);
            }
            name_indexed += 1;
            files_needing_content.push(file_path.clone());
        }

        // Rebuild FST immediately so name-based search works right away.
        if name_indexed > 0 {
            let mut idx = match index.write() {
                Ok(g) => g,
                Err(e) => e.into_inner(),
            };
            idx.rebuild_fst();
            idx.update_scorer_stats();
            info!(
                "[SearchEngine] Phase 1: indexed {} names from {}",
                name_indexed, path_str
            );
        }

        // -- PHASE 2: Read file content and re-index (slow) --
        let memory_limit_bytes = (settings.memory_limit_mb as usize) * 1024 * 1024;
        let mut content_indexed: usize = 0;
        for file_path in &files_needing_content {
            let content = match read_file_content(file_path) {
                Some(c) => c,
                None => continue,
            };

            let source = content_source_for(file_path);
            let (size, modified) = file_meta(file_path);
            let ps = file_path.to_string_lossy().to_string();

            {
                let mut idx = match index.write() {
                    Ok(g) => g,
                    Err(e) => e.into_inner(),
                };
                idx.index_document(&ps, &content, source, size, modified);

                if memory_limit_bytes > 0 && idx.estimated_memory_bytes() >= memory_limit_bytes {
                    warn!(
                        "[SearchEngine] Memory limit reached ({} MB) during incremental indexing.",
                        settings.memory_limit_mb
                    );
                    content_indexed += 1;
                    break;
                }
            }
            content_indexed += 1;
        }

        if content_indexed > 0 {
            let mut idx = match index.write() {
                Ok(g) => g,
                Err(e) => e.into_inner(),
            };
            idx.rebuild_fst();
            idx.update_scorer_stats();
            info!(
                "[SearchEngine] Phase 2: indexed content for {} files from {}",
                content_indexed, path_str
            );
        }
    }

    /// Start the filesystem watcher on all whitelisted paths.
    pub(crate) fn start_watcher_inner(
        index: &Arc<RwLock<SearchIndex>>,
        settings_arc: &Arc<Mutex<TokenizerSettings>>,
        watcher_arc: &Arc<Mutex<FileWatcher>>,
    ) {
        let settings = settings_arc
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();

        let blacklisted: Vec<String> = settings
            .blacklisted_extensions
            .iter()
            .map(|e| e.to_lowercase())
            .collect();

        let max_file_size = settings.max_file_size;

        let mut watcher = watcher_arc.lock().unwrap_or_else(|e| e.into_inner());

        watcher.set_blacklisted_extensions(blacklisted.clone());

        let index_for_cb = Arc::clone(index);
        let bl_set: HashSet<String> = blacklisted.into_iter().collect();

        watcher.set_callback(Box::new(move |events: Vec<FileChangeEvent>| {
            for event in events {
                match event {
                    FileChangeEvent::Created(ref p) | FileChangeEvent::Modified(ref p) => {
                        if !is_text_indexable(p, &bl_set, max_file_size) {
                            continue;
                        }
                        let content = match read_file_content(p) {
                            Some(c) => c,
                            None => continue,
                        };
                        let source = content_source_for(p);
                        let (size, modified) = file_meta(p);
                        let path_str = p.to_string_lossy().to_string();

                        let mut idx = match index_for_cb.write() {
                            Ok(g) => g,
                            Err(e) => e.into_inner(),
                        };
                        idx.index_document(&path_str, &content, source, size, modified);
                    }
                    FileChangeEvent::Removed(ref p) => {
                        let path_str = p.to_string_lossy().to_string();
                        let mut idx = match index_for_cb.write() {
                            Ok(g) => g,
                            Err(e) => e.into_inner(),
                        };
                        idx.remove_document(&path_str);
                    }
                    FileChangeEvent::Renamed { ref from, ref to } => {
                        let from_str = from.to_string_lossy().to_string();
                        let to_str = to.to_string_lossy().to_string();

                        let mut idx = match index_for_cb.write() {
                            Ok(g) => g,
                            Err(e) => e.into_inner(),
                        };

                        idx.remove_document(&from_str);

                        drop(idx);
                        if is_text_indexable(to, &bl_set, max_file_size) {
                            if let Some(content) = read_file_content(to) {
                                let source = content_source_for(to);
                                let (size, modified) = file_meta(to);
                                let mut idx = match index_for_cb.write() {
                                    Ok(g) => g,
                                    Err(e) => e.into_inner(),
                                };
                                idx.index_document(&to_str, &content, source, size, modified);
                            }
                        }
                    }
                }
            }

            // Rebuild FST and update BM25F corpus stats after processing
            // the batch of file-change events so fuzzy/prefix search and
            // scoring reflect the incremental updates.
            {
                let mut idx = match index_for_cb.write() {
                    Ok(g) => g,
                    Err(e) => e.into_inner(),
                };
                idx.rebuild_fst();
                idx.update_scorer_stats();
            }
        }));

        if let Err(e) = watcher.start() {
            warn!("[SearchEngine] Failed to start watcher: {}", e);
            return;
        }

        for root in &settings.whitelisted_paths {
            if let Err(e) = watcher.watch_path(Path::new(root)) {
                warn!("[SearchEngine] Failed to watch path {}: {}", root, e);
            }
        }
    }
}
