# Performance Optimization Plan — 22 Research-Backed Changes

## 1. Overview

Apply 22 performance optimizations across 5 domains: file I/O, search engine, frontend rendering, Rust concurrency, and WASM runtime. Every change is backed by benchmarks from the research report.

**Correction**: Item #1 (serde_json → bincode) is already implemented. The index cache uses `bincode::serialize`/`bincode::deserialize`. Removed from scope.

**Branch**: `perf/research-backed-optimizations`

## 2. Wave Plan

### Wave 1 — Instant Wins (6 tasks, all parallel, different files)

| Task | File | Change | Impact |
|------|------|--------|--------|
| W1-A | directory_ops.rs | sort_by_cached_key + eliminate redundant is_dir + iterative get_dir_size | 7.5x sort, ~2x fewer syscalls, fix stack overflow |
| W1-B | file_watcher.rs | Single event emission + reduce debounce to 200ms | 50% fewer IPC events |
| W1-C | storage/ (SQLite init) | Add WAL + PRAGMA tuning where Connection::open is called | 5-10x write throughput |
| W1-D | extensions_storage.rs | Debounce JSON writes (spawn async write-behind) | Eliminate blocking I/O under mutex |
| W1-E | Cargo.toml | Add jwalk, dashmap, rustc-hash dependencies | Enable Wave 2 |
| W1-F | vite.config.ts | Add React Compiler + additional vendor chunks | 2.5x faster interactions |

### Wave 2 — Search Engine + WASM (5 tasks, parallel by file)

| Task | File | Change | Impact |
|------|------|--------|--------|
| W2-A | search/compat.rs | Replace walkdir with jwalk for parallel traversal | ~4x faster file walk |
| W2-B | search/compat.rs | Batch index writes — collect locally, merge under single lock | Eliminate lock contention |
| W2-C | search/mod.rs + search/reranker.rs | Replace RRF with convex combination + FxHashMap for synonyms | Better retrieval quality + O(1) synonyms |
| W2-D | wasm_runtime.rs | DashMap<String, Mutex<WasmInstance>> for per-extension concurrency | Unblock concurrent extensions |
| W2-E | DetailsView.tsx | Flatten grouped lists + virtualize + first-order callbacks + startTransition | 5.7-48x faster grouped view |

### Wave 3 — Advanced Search + Remaining (4 tasks)

| Task | File | Change | Impact |
|------|------|--------|--------|
| W3-A | search/index.rs | DashMap for internal postings map | 7.5x concurrent throughput |
| W3-B | search/mod.rs | Manual SIMD-friendly cosine similarity (f64 → f32, loop unrolling) | Faster vector search |
| W3-C | concurrency | Semaphore-bounded spawn_blocking | Prevent thread pool saturation |
| W3-D | directory_ops.rs | rayon par_iter for parallel metadata() | 2-4x multicore speedup |

## 3. Execution Strategy

- Wave 1 tasks touch completely separate files → all 6 run in parallel
- Wave 2: W2-A and W2-B both touch compat.rs → run as single agent. Others parallel.
- Wave 3: All independent → parallel
- User pre-approved ("orchestrate all of them") → skip Phase 4

## 4. Status

- [x] Phase 0: Read context
- [x] Phase 2: Write plan
- [ ] Phase 5: Wave 1
- [ ] Phase 5: Wave 2
- [ ] Phase 5: Wave 3
- [ ] Phase 6: Test
- [ ] Phase 7: Commit
