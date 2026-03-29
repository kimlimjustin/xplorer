# Next Sprint Plan — Architecture Refactoring + Finder Gap Sprint 2

## Current State (post-session)
- **Score**: 87/100 (B+)
- **Security**: 90 (A) — all P0s fixed, sandbox hardened
- **Performance**: 92 (A) — ~2.7MB deferred, memos added
- **Architecture**: 80 (B) — settings split done, but 4 major refactors remain
- **12 commits** this session across security, perf, features, architecture

---

## What's Left from the Iterate Roadmap

### Architecture P1s (all L-effort, the last B→A push)

| # | ID | What | Effort | Impact |
|---|-----|------|--------|--------|
| 1 | ARCH-1.1 | **MainLayout 105-prop context refactor** — Create ExplorerContext to replace prop drilling through MainLayout → SplitContainer → PaneFileExplorer | L | High |
| 2 | ARCH-1.2 | **DialogsOverlay simplification** — 50-prop interface duplicated in DialogLayer. Create DialogContext that provides dialog state + dispatch | M | Medium |
| 3 | ARCH-3.1 | **Split LeftSidebar** (1,438 lines) — Extract: SidebarDrives, SidebarBookmarks, SidebarRecent, SidebarCollections, SidebarFileTree as sub-components | L | Medium |
| 4 | ARCH-4.3 | **Event bus consolidation** — Create useWindowEvent hook, centralize the 15+ scattered event subscriptions | S | Medium |
| 5 | ARCH-5.2 | **localStorage constants** — Centralize all scattered key strings into a constants file | S | Low |

### Performance P2s (diminishing returns but still valuable)

| # | ID | What | Effort |
|---|-----|------|--------|
| 6 | PERF-08 | Memo TreeView sortedFiles | S |
| 7 | PERF-09 | Virtualize GalleryView filmstrip | M |
| 8 | PERF-12 | Memo ChatPanel contextableFiles | S |
| 9 | PERF-15 | Memo ChatMessage components | S |
| 10 | PERF-17 | Memo ColumnFileRow | S |

### Security P2s (defense-in-depth)

| # | ID | What | Effort |
|---|-----|------|--------|
| 11 | SEC-03 | Rust-side extension storage isolation check | S |
| 12 | SEC-08 | isPathAllowed: includes → startsWith | S |
| 13 | SEC-11 | Gate cross-extension command execution | S |
| 14 | SEC-12 | Add isPathAllowed to database.executeQuery | S |
| 15 | SEC-13 | Add permission check to gdrive.getSettings | S |

### Finder Gap Sprint 2 (medium effort, high UX value)

| # | What | Effort |
|---|------|--------|
| 16 | Tags section in sidebar (browse by tag) | M |
| 17 | Group by kind/type (not just date) | M |
| 18 | Per-folder view memory | M |
| 19 | Resizable column widths (Details + Column view) | M |
| 20 | macOS Share Sheet integration | M |
| 21 | Trash restore + empty on macOS/Linux | S |

---

## Recommended Execution Order

### Wave 1: Quick Architecture + Security (all S-effort, 7 items)
*Parallel: 2 agents*
- Agent A: ARCH-4.3 (useWindowEvent hook) + ARCH-5.2 (localStorage constants)
- Agent B: SEC-03, SEC-08, SEC-11, SEC-12, SEC-13 (5 security P2 one-liners)

### Wave 2: Performance Memos (all S-effort, 5 items)
*Parallel: 1 agent*
- PERF-08, PERF-12, PERF-15, PERF-17 + PERF-09 (filmstrip virtualization)

### Wave 3: Architecture Big Refactors (L-effort, 3 items)
*Parallel: 3 agents*
- Agent A: ARCH-1.1 — ExplorerContext (MainLayout prop drilling)
- Agent B: ARCH-3.1 — Split LeftSidebar into 5 sub-components
- Agent C: ARCH-1.2 — DialogContext (DialogsOverlay simplification)

### Wave 4: Finder Gap Sprint 2 (M-effort, 6 items)
*Parallel: 3 agents*
- Agent A: Tags sidebar + Group by kind
- Agent B: Per-folder view memory + Resizable columns
- Agent C: macOS Share Sheet + Trash restore/empty

---

## Expected Outcome

After this sprint:
- **Architecture**: 80 → **90+ (A)** — all god components split, prop drilling eliminated
- **Performance**: 92 → **95+ (A)** — all memo P2s done, filmstrip virtualized
- **Security**: 90 → **95+ (A)** — all P2 defense-in-depth items closed
- **Overall**: 87 (B+) → **92+ (A)** — production-quality codebase
- **Finder gap**: 8 more features closed (total 16/54 gaps addressed)

## Timeline Estimate
- Wave 1: ~10 min (parallel S-effort)
- Wave 2: ~10 min (parallel S-effort)
- Wave 3: ~30 min (parallel L-effort)
- Wave 4: ~20 min (parallel M-effort)
- Total: ~70 min with 4 waves, 10 parallel agents
