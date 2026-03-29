# Performance Scan - Remaining Bottlenecks (2026-03-25)

Scanned after commit 5b8da0e optimizations. Findings below exclude already-optimized items.

---

## P0 - Critical

### 1. Tauri commands doing blocking `std::fs` on async runtime (no `spawn_blocking`)
**Severity: P0 | Effort: M**

Multiple `#[command] pub async fn` handlers perform synchronous `std::fs` calls directly on the Tokio async runtime thread. This blocks the entire Tauri command thread pool, causing UI freezes during file operations.

| File:Line | Function | Blocking call |
|---|---|---|
| `apps/src-tauri/src/operations/file_ops.rs:448` | `copy()` | `fs::copy`, `copy_dir_recursive` |
| `apps/src-tauri/src/operations/file_ops.rs:513` | `move_file()` | `fs::rename`, `fs::copy`, `fs::remove_file/dir_all` |
| `apps/src-tauri/src/operations/file_ops.rs:545` | `remove_file()` | `fs::remove_file` |
| `apps/src-tauri/src/operations/file_ops.rs:565` | `rename()` | `fs::rename` |
| `apps/src-tauri/src/operations/file_ops.rs:585` | `create_file()` | `fs::File::create` |
| `apps/src-tauri/src/operations/file_ops.rs:601` | `create_file_with_content()` | `fs::write` |
| `apps/src-tauri/src/operations/file_ops.rs:621` | `read_text_file()` | `fs::read_to_string` |
| `apps/src-tauri/src/operations/file_ops.rs:630` | `read_binary_file()` | `fs::read` |
| `apps/src-tauri/src/operations/file_ops.rs:660` | `bulk_rename()` | `fs::rename` in loop |
| `apps/src-tauri/src/operations/file_ops.rs:823` | `get_directory_sizes()` | `WalkDir` + `fs::read_dir` + metadata for entire tree |
| `apps/src-tauri/src/operations/file_ops.rs:90` | `check_conflicts()` | `fs::metadata`, `dir_total_size()` via WalkDir |
| `apps/src-tauri/src/operations/file_ops.rs:936` | `create_symlink()` | `std::os::unix::fs::symlink` |

Note: `copy_with_progress` and `move_with_progress` correctly use `thread::spawn`, but the legacy `copy()`, `move_file()`, etc. do not.

**Fix:** Wrap all bodies in `tokio::task::spawn_blocking(move || { ... }).await.unwrap()`.

### 2. Google Drive commands doing sync FS on async runtime
**Severity: P0 | Effort: S**

| File:Line | Function | Blocking call |
|---|---|---|
| `apps/src-tauri/src/google_drive.rs:700` | `gdrive_download_file()` | `std::fs::create_dir_all`, `std::fs::write` |
| `apps/src-tauri/src/google_drive.rs:726` | `gdrive_upload_file()` | `std::fs::read` (reads entire file into memory) |

These are `async fn` Tauri commands that block the runtime on disk I/O.

**Fix:** Use `tokio::fs` or `spawn_blocking` for file read/write within these async commands.

---

## P1 - High

### 3. FileGrid component not memoized (733 lines)
**Severity: P1 | Effort: S**

`apps/client/src/components/explorer/FileGrid.tsx` -- the `FileGrid` component (line 56) is a plain arrow function, never wrapped in `React.memo`. It receives 20+ props from the parent. Any parent re-render causes the entire FileGrid (including hook computations for git status, tags, size percentiles, thumbnail cache) to re-execute, even when props haven't changed.

**Fix:** Wrap `FileGrid` in `React.memo` with a shallow comparison. The child `FileGridItem` is already memoized, but the parent recomputes hooks unnecessarily.

### 4. Inline style objects created on every render in FileGrid
**Severity: P1 | Effort: S**

`apps/client/src/components/explorer/FileGrid.tsx:529-551` -- `crossTabOutlineStyle` and `crossTabBadgeStyle` are `React.CSSProperties` objects created on every render inside the component body. These are static objects that never change, yet they create new references on each render, defeating memo comparisons downstream.

**Fix:** Move to module-level `const` or `useMemo` with empty deps.

### 5. Search engine `rebuild_full_index_inner` is single-threaded sequential
**Severity: P1 | Effort: M**

`apps/src-tauri/src/search/compat.rs:503-532` -- The full index rebuild reads files sequentially in a single `for` loop, acquiring a write lock per file. With thousands of files, this is the dominant cost. The `WalkDir` traversal (line 463) is also single-threaded (not using `jwalk`).

Similarly, `incremental_update_inner` (line 670-697) does sequential file reads.

**Fix:** Use `rayon::par_iter` for the file content reading phase, batch the index insertions, and replace `WalkDir` with `jwalk` for parallel directory walking (already a dependency).

### 6. `get_directory_sizes()` blocks async runtime with recursive WalkDir
**Severity: P1 | Effort: S**

`apps/src-tauri/src/operations/file_ops.rs:823-878` -- This Tauri command does a full `WalkDir` traversal of every subdirectory to compute sizes. It runs directly on the async runtime without `spawn_blocking`. For directories with many children, this can block the runtime for seconds.

**Fix:** Wrap in `spawn_blocking` and consider using `jwalk` for parallel traversal.

---

## P2 - Medium

### 7. Synonym expansion uses O(n^2) deduplication via `Vec::contains`
**Severity: P2 | Effort: S**

`apps/src-tauri/src/search/compat.rs:743-752` and `778-787` -- Both `natural_language_search` and `enhanced_search` build expanded keyword lists using:
```rust
if !expanded.contains(&s) { expanded.push(s); }
```
For each synonym, this is O(n) scan. With many keywords and synonyms, this is O(k * s) per query.

**Fix:** Use `HashSet` for deduplication, then collect to Vec.

### 8. `all_documents()` linear scan for bitmap metadata-only search
**Severity: P2 | Effort: M**

`apps/src-tauri/src/search/compat.rs:816-836` -- When a metadata-only query runs through the bitmap index, results are collected by iterating ALL documents and checking `bitmap.contains(doc.doc_id)`. With a 100K-document index, this is a full scan even when the bitmap has only a few bits set.

**Fix:** Iterate the bitmap's set bits and look up documents by ID instead.

### 9. Vite `manualChunks` missing `i18next` and `diff` libraries
**Severity: P2 | Effort: S**

`vite.config.ts:33-52` -- The current `manualChunks` splits syntax-highlighter, lucide, tauri, tanstack, and radix. Missing:
- `i18next` + `react-i18next` (used in 23+ files, loaded eagerly)
- `diff` library (used for file comparison)
- `dompurify` (used in preview components)
- `pdfjs-dist` worker is handled but the main `pdfjs-dist` module should be explicitly chunked

These are bundled into the main chunk, increasing initial load time.

**Fix:** Add `i18next` and `dompurify` to `manualChunks`.

### 10. 5 oversized components (>1000 lines) risk poor memoization
**Severity: P2 | Effort: L**

| Component | Lines | Issue |
|---|---|---|
| `UndoHistoryPanel.tsx` | 1450 | Has extracted helpers but main component still large |
| `PerformanceDashboard.tsx` | 1319 | OrganizerTabContent is memoized but parent is large |
| `SearchResultsPanel.tsx` | 1284 | Good sub-component memoization, but main body is big |
| `BulkRenameDialog.tsx` | 1268 | Single component, many state variables |
| `ExtensionPermissionDialog.tsx` | 1241 | Large conditional rendering |

These violate the 1000-line rule and contain many `useState` hooks in single components, making selective re-rendering difficult.

**Fix:** Extract state-heavy sub-sections into separate memoized child components.

### 11. `SmartSearch` re-creates functions on every render
**Severity: P2 | Effort: S**

`apps/client/src/components/SmartSearch.tsx:222-237` -- `shouldUseEnhancedSearch` and `computeFilesystemScore` are plain functions defined inside the component body without `useCallback`. They are recreated on every render and, while not passed as props, contribute to closure captures.

**Fix:** Extract as module-level pure functions (they don't use any component state).

### 12. Backup operations block async runtime
**Severity: P2 | Effort: M**

`apps/src-tauri/src/backup.rs` -- `create_backup` (line 132), `restore_backup` (line 305), `delete_backup` (line 423) all perform heavy filesystem operations (WalkDir, SHA-256 hashing of every file, fs::copy) without `spawn_blocking`. Backup of a large directory will freeze the Tauri command thread pool.

**Fix:** Wrap each command body in `tokio::task::spawn_blocking`.

---

## P3 - Low

### 13. `FileGrid` passes `allFiles` array to every `FileGridItem`
**Severity: P3 | Effort: S**

`apps/client/src/components/explorer/FileGrid.tsx:576,704` -- The entire `files` array is passed as `allFiles` prop to every `FileGridItem` instance. When any file is added/removed, every item receives a new array reference, potentially busting `React.memo`. The prop is used by `useDraggable` for multi-select drag.

**Fix:** Pass `allFiles` via React context instead of as a prop to each item.

### 14. `FileGrid` re-fetches git status and tags on every `files` change
**Severity: P3 | Effort: M**

`apps/client/src/components/explorer/FileGrid.tsx:118-142` -- The `useEffect` for loading tags depends on `[files]`. Since `files` is a new array reference on each directory listing response, this always re-runs even if the actual file list hasn't changed. Similarly, git status (line 85) depends on `[currentPath]` which is fine, but the tags effect could be optimized.

**Fix:** Derive a stable key (e.g., hash of sorted file paths) to gate the effect.

### 15. Search engine WalkDir traversals use `walkdir` instead of `jwalk`
**Severity: P3 | Effort: S**

`apps/src-tauri/src/search/compat.rs` uses `walkdir::WalkDir` in 5 places (lines 463, 583, 843, 1416). The codebase already depends on `jwalk` for parallel directory traversal in the directory listing code. The search engine's index builds could benefit from the same parallel walker.

**Fix:** Replace `WalkDir::new(...)` with `jwalk::WalkDir::new(...)` in the search engine.

### 16. `PaneTabBar` (866 lines) is not memoized
**Severity: P3 | Effort: S**

`apps/client/src/components/split-view/PaneTabBar.tsx` -- 866 lines with 22+ props, no `React.memo` wrapper. In a multi-pane layout, every keystroke or selection change re-renders all tab bars.

**Fix:** Wrap in `React.memo`.

---

## Summary Table

| ID | Finding | Severity | Effort | Category |
|----|---------|----------|--------|----------|
| 1 | file_ops blocking async runtime (12 commands) | P0 | M | Rust/blocking |
| 2 | Google Drive sync FS on async runtime | P0 | S | Rust/blocking |
| 3 | FileGrid not memoized | P1 | S | React/renders |
| 4 | Inline style objects in FileGrid | P1 | S | React/renders |
| 5 | Search index rebuild is single-threaded | P1 | M | Rust/perf |
| 6 | get_directory_sizes blocks runtime | P1 | S | Rust/blocking |
| 7 | O(n^2) synonym dedup in search | P2 | S | Rust/perf |
| 8 | Linear scan for bitmap results | P2 | M | Rust/perf |
| 9 | Missing manualChunks for i18next, dompurify | P2 | S | Bundle |
| 10 | 5 oversized components (>1000 LOC) | P2 | L | React/arch |
| 11 | SmartSearch re-creates pure functions | P2 | S | React/renders |
| 12 | Backup operations block async runtime | P2 | M | Rust/blocking |
| 13 | allFiles array prop to every FileGridItem | P3 | S | React/renders |
| 14 | Tags effect re-runs on every files reference | P3 | M | React/renders |
| 15 | Search WalkDir not using jwalk | P3 | S | Rust/perf |
| 16 | PaneTabBar not memoized | P3 | S | React/renders |
