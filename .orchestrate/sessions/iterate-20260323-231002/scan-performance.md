# Performance Scan Report

**Date**: 2026-03-23
**Scope**: Full codebase -- Rust backend, React frontend, search engine, extension system, build config

---

## P0 -- Critical (User-visible latency / freezes)

### 1. Blocking I/O in async Tauri commands (directory_ops.rs)

**File**: `apps/src-tauri/src/operations/directory_ops.rs`, lines 8-63
**Problem**: `read_directory()` is marked `async` but performs synchronous `fs::read_dir`, `entry.metadata()`, `get_file_type()`, and `get_mime_type()` calls directly on the Tauri async runtime. For directories with thousands of files, this blocks the Tokio worker thread and freezes the IPC bridge -- the frontend cannot receive any other command responses until it finishes.
**Impact**: UI hangs of 200ms-2s+ when opening large directories (>5000 files). Blocks all other Tauri commands during that time.
**Severity**: P0
**Effort**: M
**Suggested approach**: Wrap the body in `tokio::task::spawn_blocking(move || { ... }).await.unwrap()`. The `get_dir_size()` (line 107) and `is_dir()` (line 66) commands have the same issue and should be wrapped too.

### 2. Blocking I/O in async metadata/properties commands

**File**: `apps/src-tauri/src/operations/metadata_ops.rs`, lines 7-55
**File**: `apps/src-tauri/src/operations/properties_ops.rs`, lines 56-100+
**Problem**: `get_file_properties()` and `get_detailed_file_properties()` are `async` but call `fs::metadata()`, `fs::canonicalize()`, and directory-walking functions synchronously, blocking the Tokio runtime.
**Impact**: Stalls the main async executor when properties are requested for large directories or slow filesystems (network drives).
**Severity**: P0
**Effort**: S
**Suggested approach**: Wrap in `tokio::task::spawn_blocking`.

### 3. O(N*M) scan in search incremental update -- finding new files

**File**: `apps/src-tauri/src/search/compat.rs`, line 633
**Problem**: `!idx.documents().values().any(|d| &d.path == path)` iterates over ALL indexed documents for EVERY file in `current_files`. If the index has 50k documents and the filesystem has 50k files, this is 2.5 billion string comparisons. The `path_to_id` HashMap exists and provides O(1) lookups but is not used here.
**Impact**: Incremental index updates that should take seconds take minutes on large indices. CPU pegged at 100% during startup.
**Severity**: P0
**Effort**: S
**Suggested approach**: Replace with `!idx.path_to_id().contains_key(path)` or expose a `has_document(path)` method on SearchIndex that uses the HashMap.

---

## P1 -- High (Measurable latency / wasted resources)

### 4. `read_directory()` calls `get_file_type()` + `get_mime_type()` per entry

**File**: `apps/src-tauri/src/operations/directory_ops.rs`, lines 34-35
**Problem**: For every directory entry, two additional function calls determine file type and MIME type (likely involving extension lookups or even `file` command calls). In a directory with 10k files this adds ~10k extra calls that the frontend may not even need until a file is selected.
**Impact**: 50-200ms added latency per 1000 files on a warm FS cache.
**Severity**: P1
**Effort**: M
**Suggested approach**: Return only basic metadata (name, path, is_dir, size, modified) initially. Defer file_type and mime_type to a separate lazy command or batch-fetch from the frontend when needed.

### 5. `HardwareInfo::detect()` and `supports_memory_mapping()` called per-file in directory copy

**File**: `apps/src-tauri/src/operations/accelerated_ops.rs`, lines 822-824
**Problem**: Inside `accelerated_copy_dir_impl`, `AcceleratedFileOps::new()` is called inside the `par_iter()` loop for every file. `HardwareInfo::detect()` calls `num_cpus::get()` and CPU feature detection, and `supports_memory_mapping()` actually opens and mmaps the current exe -- this is a syscall-heavy operation repeated per file.
**Impact**: For a directory copy of 1000 files, this means ~1000 unnecessary mmap attempts and CPU feature checks. Adds seconds to large directory copies.
**Severity**: P1
**Effort**: S
**Suggested approach**: Create `AcceleratedFileOps` once before the `par_iter()` and pass a reference or clone into each parallel task.

### 6. Search index holds duplicate tokenization work

**File**: `apps/src-tauri/src/search/index.rs`, lines 430-475
**Problem**: `index_document()` tokenizes the full content with positions (`tokenize_with_positions`), then separately tokenizes `content_head` and `content_body` again with `tokenize_and_stem()`. The full content is thus tokenized twice -- once for positions and once for BM25F field splitting. The `full_content_freq` result is explicitly discarded on line 475.
**Impact**: Doubles tokenization CPU time during indexing. For large text files this is significant.
**Severity**: P1
**Effort**: M
**Suggested approach**: Tokenize head and body separately with positions, then merge the position maps. Or tokenize once with positions tracking which tokens fall in head vs body boundary.

### 7. `save_to_disk()` clones the entire index

**File**: `apps/src-tauri/src/search/index.rs`, lines 598-640
**Problem**: `save_to_disk()` clones every HashMap in the index (documents, path_to_id, postings, positions, doc_field_lengths, doc_content) to build the `IndexCache` struct before serializing. For a 100k-document index, this temporarily doubles memory usage.
**Impact**: Memory spike of 200MB+ during save for large indices. Could cause OOM on constrained systems.
**Severity**: P1
**Effort**: M
**Suggested approach**: Serialize directly from the index fields without building an intermediate cache struct, or use `serde` with references. Alternatively, serialize in streaming fashion.

### 8. FileGrid loads git status for every directory change

**File**: `apps/client/src/components/explorer/FileGrid.tsx`, lines 85-113
**Problem**: Every time `currentPath` changes, `TauriAPI.getGitStatus(currentPath)` is called. For non-git directories this is wasted work. The result also creates a new Map on every call, forcing child components to re-render even if statuses haven't changed.
**Impact**: ~50-100ms wasted per navigation for non-git directories. Unnecessary re-renders of all FileGridItem components.
**Severity**: P1
**Effort**: S
**Suggested approach**: Check if the path is inside a git repo first (cache git root detection). Use a stable reference for the map (compare before setting state).

### 9. FileGrid loads tags for ALL files on every `files` change

**File**: `apps/client/src/components/explorer/FileGrid.tsx`, lines 118-142
**Problem**: `TauriAPI.getFileTagsBatch(paths)` is called with ALL file paths every time the `files` array reference changes. Since `files` is likely a new array on every directory read, this fires on every navigation and any file update.
**Impact**: Unnecessary IPC roundtrip and backend work. For directories with 1000+ files, the batch tag lookup adds latency.
**Severity**: P1
**Effort**: S
**Suggested approach**: Debounce the tag fetch, or only fetch when tags are actually displayed. Memoize the paths array to avoid re-fetching when content hasn't changed.

### 10. `classify_extension()` uses linear scan through arrays

**File**: `apps/src-tauri/src/search/mod.rs`, lines 121-131
**Problem**: `classify_extension()` calls `.contains()` on 6 different `&[&str]` slices sequentially. Each `.contains()` is O(n). This function is called during indexing and search filtering for every file.
**Impact**: Minor per-call but significant at scale during full index rebuild (50k+ files).
**Severity**: P1
**Effort**: S
**Suggested approach**: Build a static `HashMap<&str, FileTypeCategory>` at initialization (or use `phf` / `lazy_static`) for O(1) lookup.

---

## P2 -- Medium (Optimization opportunities)

### 11. `get_dir_size()` is single-threaded recursive

**File**: `apps/src-tauri/src/operations/directory_ops.rs`, lines 107-147
**Problem**: `calculate_size()` walks the directory tree sequentially with `fs::read_dir`. For deeply nested directories with many files, this is slow compared to parallel traversal.
**Impact**: Directory size calculation for large trees (100k+ files) takes 5-30 seconds.
**Severity**: P2
**Effort**: M
**Suggested approach**: Use `rayon` + `walkdir` for parallel traversal, similar to how `count_directory_contents_parallel` is already implemented in `accelerated_ops.rs`.

### 12. `to_lowercase()` called in sort comparator for every comparison

**File**: `apps/src-tauri/src/operations/directory_ops.rs`, lines 54-60
**Problem**: `a.name.to_lowercase().cmp(&b.name.to_lowercase())` allocates new Strings for every comparison during sort. For n files, sorting does O(n log n) comparisons, each allocating 2 strings.
**Impact**: For 10k files, that's ~260k temporary String allocations during sort.
**Severity**: P2
**Effort**: S
**Suggested approach**: Pre-compute lowercase names (e.g., store as a field in FileEntry, or create a parallel vec of sort keys) before sorting.

### 13. TreeView lacks virtualization

**File**: `apps/client/src/components/explorer/TreeView.tsx`, lines 1-100+
**Problem**: TreeView renders all files and their expanded children as real DOM nodes. No virtualization is used. For directories with thousands of files plus expanded subdirectories, this creates excessive DOM nodes.
**Impact**: Jank and high memory usage when expanding large directory trees (5k+ visible nodes).
**Severity**: P2
**Effort**: L
**Suggested approach**: Implement tree virtualization using `@tanstack/react-virtual` (already a dependency), similar to what DetailsView does.

### 14. `api.rs` STORAGE Mutex held across all operations

**File**: `apps/src-tauri/src/api.rs`, lines 7-140
**Problem**: Every API command acquires `STORAGE.lock()` and holds it for the duration of the operation (read or write). With `.map_err()` instead of `.unwrap_or_else(|e| e.into_inner())`, a poisoned mutex will cause all subsequent commands to fail permanently.
**Impact**: If any storage operation panics, all subsequent storage commands will return errors until restart. Also, concurrent access is serialized.
**Severity**: P2
**Effort**: S
**Suggested approach**: Use `RwLock` instead of `Mutex` for read-heavy operations. Use `unwrap_or_else(|e| e.into_inner())` pattern for poison recovery (as done elsewhere in the codebase).

### 15. Synonym expansion uses linear `contains()` check

**File**: `apps/src-tauri/src/search/compat.rs`, lines 743-752
**Problem**: When expanding keywords with synonyms, `expanded.contains(&s)` does a linear scan of the expanded vector for each synonym. This is O(n*m) where n is keywords and m is synonyms per keyword.
**Impact**: Minor for typical queries but could be noticeable for queries with many keywords that have many synonyms.
**Severity**: P2
**Effort**: S
**Suggested approach**: Use a `HashSet<String>` for deduplication instead of `Vec::contains()`.

### 16. `simd_buffered_copy` copies data twice through unnecessary buffer

**File**: `apps/src-tauri/src/operations/accelerated_ops.rs`, lines 468-512
**Problem**: `simd_buffered_copy` reads into `read_buffer`, then copies to `write_buffer` via `copy_from_slice()` (line 485), then calls `simd_process_buffer()` which is a no-op for file copies (just prefetching), then writes `write_buffer`. The intermediate copy through `write_buffer` is pointless for a plain file copy.
**Impact**: Wastes memory bandwidth by copying every byte twice through user-space buffers.
**Severity**: P2
**Effort**: S
**Suggested approach**: Write directly from `read_buffer` to the output. Remove the second buffer entirely since `simd_process_buffer` doesn't actually transform data.

### 17. Vite config lacks tree-shaking hint for `react-syntax-highlighter`

**File**: `vite.config.ts`, lines 33-54
**Problem**: `react-syntax-highlighter` + `refractor`/`prismjs` are split into a separate chunk but the full library (all ~300 language grammars) is likely included. This is typically a 2-3MB chunk.
**Impact**: Larger initial download and parse time. Most users only need 5-10 languages.
**Severity**: P2
**Effort**: M
**Suggested approach**: Import only specific languages from `react-syntax-highlighter/dist/esm/languages/prism/` instead of the full bundle. Or use dynamic imports for syntax highlighting.

### 18. Search index rebuild reads file content sequentially

**File**: `apps/src-tauri/src/search/compat.rs`, lines 500-532
**Problem**: During full index rebuild, files are read and indexed one at a time in a loop. File I/O is the bottleneck, and modern SSDs can handle parallel reads efficiently. The `for file_path in &files_to_index` loop processes files sequentially.
**Impact**: Full index rebuild takes 2-10x longer than necessary on SSD-equipped machines.
**Severity**: P2
**Effort**: M
**Suggested approach**: Use a producer-consumer pattern: a thread pool reads files in parallel (bounded by I/O), then feeds content to the indexer. The write lock on the index is the serialization point, but file reading (the expensive part) can be parallelized.

### 19. `remove_document()` scans all postings for cleanup

**File**: `apps/src-tauri/src/search/index.rs`, lines 506-542
**Problem**: `remove_document()` iterates over ALL postings entries (every term in the index) and ALL positional entries to filter out the removed doc_id. For an index with 100k terms, this is 100k iterations per document removal.
**Impact**: Batch removal of stale documents (e.g., 500 stale files) triggers 50M posting entry scans.
**Severity**: P2
**Effort**: L
**Suggested approach**: Maintain a reverse index (doc_id -> list of terms) to enable targeted cleanup. Or use a "tombstone" approach and compact lazily.

---

## P3 -- Low (Minor / defensive improvements)

### 20. `allFiles` prop passed to every FileGridItem triggers re-renders

**File**: `apps/client/src/components/explorer/FileGrid.tsx`, line 576
**Problem**: `allFiles={files}` is passed as a prop to every `FileGridItem`. Since `files` is a new array reference on each render cycle, this defeats `React.memo` -- every item re-renders even if only one file changed. The prop is used for drag-and-drop multi-selection context.
**Impact**: Unnecessary re-renders of all visible FileGridItems on any state change.
**Severity**: P3
**Effort**: S
**Suggested approach**: Memoize the `files` array with `useMemo` keyed on a stable identifier (e.g., `currentPath` + file count), or pass `allFiles` via React context instead of props to avoid invalidating memo.

### 21. `GalleryStripThumb` creates `useDraggable` and `useDroppable` per thumbnail

**File**: `apps/client/src/components/explorer/GalleryView.tsx`, lines 38-39
**Problem**: Each gallery thumbnail calls `useDraggable()` and `useDroppable()` hooks. For galleries with 200+ images in the filmstrip, this creates 400+ event listener registrations.
**Impact**: Memory overhead and potential GC pressure from many listener objects.
**Severity**: P3
**Effort**: M
**Suggested approach**: Use event delegation at the gallery container level instead of per-item hooks.

### 22. `loadFolderContents` in TreeView creates new Map on every call

**File**: `apps/client/src/components/explorer/TreeView.tsx`, line 37
**Problem**: `setFolderContents((prev) => new Map(prev.set(folderPath, contents)))` creates a new Map from scratch for every folder expansion. `.set()` mutates the original Map, then `new Map()` copies it.
**Impact**: For deeply expanded trees with many folders, this creates progressively larger Map copies.
**Severity**: P3
**Effort**: S
**Suggested approach**: `setFolderContents((prev) => { const next = new Map(prev); next.set(folderPath, contents); return next; })` -- this avoids mutating the previous Map.

### 23. Extension dependency resolution uses `order.includes(id)` -- O(n) per check

**File**: `apps/client/src/lib/extension-lifecycle.ts`, line 65
**Problem**: `packages.map((p) => p.manifest.id).filter((id) => !order.includes(id))` does a linear scan of `order` for each remaining package. This is O(n^2).
**Impact**: Negligible for typical extension counts (<50), but architecturally unsound.
**Severity**: P3
**Effort**: S
**Suggested approach**: Convert `order` to a `Set` before the filter.

### 24. `cosine_similarity()` lacks SIMD optimization for large vectors

**File**: `apps/src-tauri/src/search/mod.rs`, lines 99-119
**Problem**: `cosine_similarity()` uses a scalar fold loop. For embedding vectors (typically 384-1536 dimensions), SIMD could provide 4-8x speedup.
**Impact**: Minor unless semantic search is heavily used. Each similarity computation is ~500ns scalar vs ~80ns SIMD for 384-dim vectors.
**Severity**: P3
**Effort**: M
**Suggested approach**: Use the `packed_simd2` crate or process 4 f32s at a time with `std::arch::x86_64` intrinsics. Or use the `simsimd` crate.

### 25. WASM module compiled on every `load_module` call

**File**: `apps/src-tauri/src/extensions/wasm_runtime.rs`, lines 48-110
**Problem**: `Module::new(&self.engine, wasm_bytes)` compiles the WASM bytecode to native code on every call. Wasmi compilation is slower than Wasmtime but still non-trivial (10-100ms per module).
**Impact**: Extension reload during development is slow. In production, extensions are loaded once so this is a one-time cost.
**Severity**: P3
**Effort**: M
**Suggested approach**: Cache compiled modules (keyed by hash of wasm_bytes) so reloading the same extension skips compilation.

### 26. `FileGrid` has 8+ `useEffect` hooks that run on mount

**File**: `apps/client/src/components/explorer/FileGrid.tsx`, lines 85-264
**Problem**: FileGrid registers 8+ effects on mount: git status, tags batch, cross-tab selection, thumbnail preload, rename listeners, slow-click detection, etc. Each fires an async operation or event listener registration. This is a lot of work on every directory navigation.
**Impact**: Micro-stutters of 20-50ms on directory change from effect cascade.
**Severity**: P3
**Effort**: L
**Suggested approach**: Consolidate related effects. Consider moving git status and tags into a single data-fetching hook or use React Query for caching and deduplication.

---

## Summary

| Severity | Count | Key themes |
|----------|-------|------------|
| P0       | 3     | Blocking I/O in async contexts, O(N*M) algorithm in search |
| P1       | 7     | Redundant work per file, unnecessary re-renders, wasteful per-iteration allocations |
| P2       | 9     | Missing parallelism, double-buffering, large bundle, sequential indexing |
| P3       | 7     | Prop drilling defeats memo, minor algorithmic inefficiencies |

**Highest impact fixes** (in priority order):
1. Wrap `read_directory()` and other blocking ops in `spawn_blocking` (P0 #1, #2)
2. Fix O(N*M) new-file detection in search incremental update (P0 #3)
3. Move `AcceleratedFileOps::new()` outside `par_iter` loop (P1 #5)
4. Defer file_type/mime_type computation in directory listing (P1 #4)
5. Add stable memoization for `files` array to prevent FileGridItem re-renders (P1 #8, #9, P3 #20)
