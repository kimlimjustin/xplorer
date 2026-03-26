# Xplorer Codebase Improvement Roadmap

## Health Scorecard

| Dimension | Score | Grade | P0 | P1 | P2 | P3 | Total |
|-----------|-------|-------|-----|-----|-----|-----|-------|
| Security | 55 | D | 3 | 3 | 6 | 2 | 14 |
| Architecture | 72 | C | 0 | 5 | 10 | 4 | 19 |
| Performance | 70 | C | 1 | 7 | 9 | 3 | 20 |
| Code Quality | 80 | B | 0 | 1 | 2 | 1 | 4 |
| Infrastructure | 88 | B | 0 | 0 | 0 | 0 | 0 |
| **Overall** | **71** | **C** | **4** | **16** | **27** | **10** | **57** |

**Weighted overall: 71/100 (C)**. Security drags the score — 3 P0s need immediate attention. Architecture and performance are the next priorities. Code quality and infrastructure are solid.

---

## P0 — Critical (Fix Immediately)

### SEC-14: API keys returned to frontend in plaintext
- **File:** `apps/src-tauri/src/agent/mod.rs:873`
- **What:** `get_agent_settings` returns full `AgentSettings` struct including `api_key` and `openai_api_key` to any frontend caller. Any extension (even without sandbox escape) can read these via `TauriAPI.getAgentSettings()`.
- **Fix:** Return `safe_settings` with keys redacted. Only expose a `has_key: bool` flag.
- **Effort:** S

### SEC-16: Shell execution exposed without restriction
- **File:** `apps/src-tauri/src/operations/system_ops.rs:355`
- **What:** `execute_command` is a registered Tauri command callable by any JS in the webview. `sanitize_command` blocks metacharacters but allows arbitrary binaries.
- **Fix:** Verify Tauri capabilities restrict this command. Add user confirmation prompt for shell commands.
- **Effort:** M

### SEC-17: Agent settings writable by any extension
- **File:** `apps/src-tauri/src/main.rs:353`
- **What:** `update_agent_settings` can change API keys and model. Combined with SEC-14, extensions can redirect all AI calls to attacker-controlled endpoints.
- **Fix:** Gate `update_agent_settings` behind a capability check or require user confirmation.
- **Effort:** S

### PERF-06: react-syntax-highlighter (~500KB) loaded at app startup
- **File:** `apps/client/src/components/QuickLookOverlay.tsx:6`
- **What:** Full Prism bundle with all language grammars imported synchronously. Loaded even if user never previews code.
- **Fix:** `React.lazy(() => import(...))` + switch to `PrismLight` with only needed languages.
- **Effort:** S

---

## P1 — Important (Next Sprint)

### Security P1s

| ID | File | What | Effort |
|----|------|------|--------|
| SEC-01 | extension-host.ts:636 | `new Function()` sandbox is bypassable — not a hard security boundary | L |
| SEC-02 | extension-host.ts:542 | `Object.getPrototypeOf` bypasses proxy blocking | M |
| SEC-06 | directory_ops.rs:73 | `remove_dir` and `create_dir_recursive` missing `validate_file_path` | S |
| SEC-07 | accelerated_ops.rs:122 | `accelerated_copy_file/directory` bypass path validation | S |

### Architecture P1s

| ID | File | What | Effort |
|----|------|------|--------|
| ARCH-1.1 | MainLayout.tsx:38 | 105-prop interface — pure pass-through, needs context refactor | L |
| ARCH-1.2 | DialogsOverlay.tsx:1 | 50-prop interface duplicated in DialogLayer | M |
| ARCH-1.3 | SplitContainer.tsx:10 | 43 props including 8 tab callbacks | L |
| ARCH-3.1 | LeftSidebar.tsx | 1,438 lines — data fetch + business logic + render mixed | L |
| ARCH-3.2 | settings.tsx | 1,666 lines — 7 inline component defs recreated every render | L |
| ARCH-5.5 | settings.tsx:296 | Inline component definitions break memo + reset state on parent re-render | S |

### Performance P1s

| ID | File | What | Effort |
|----|------|------|--------|
| PERF-01 | DetailsView.tsx:14 | `FileRow` not memoized — all rows re-render on selection change | S |
| PERF-02 | use-activity-feed.ts:167 | `filteredEntries` + `recentCount` inline, no useMemo, runs on every fs event | S |
| PERF-03 | use-performance-stats.ts:70 | `directoryStats` IIFE recomputes on every render | S |
| PERF-04 | HomePage.tsx:451 | 1s clock setInterval re-renders entire 917-line page | S |
| PERF-05 | LeftSidebar.tsx:256 | mousemove listener not cleaned up if unmount mid-drag | S |
| PERF-07 | DocumentPreview + 4 others | mammoth/xlsx/pdfjs/papaparse/DOMPurify sync imports at sidebar-open | M |
| PERF-18 | react-syntax-highlighter | All Prism grammars included — use PrismLight + registerLanguage | S |
| PERF-19 | xlsx@0.18.5 | ~700KB, only used in SpreadsheetPreview — should be dynamic import | S |

---

## P2 — Improvements (Backlog)

### Security P2s (6 items)
- SEC-03: Cross-extension storage access (requires sandbox escape)
- SEC-04: Extension DOM outside container writable
- SEC-08: `isPathAllowed` uses `includes` instead of `startsWith`
- SEC-11: Cross-extension command execution via namespaced IDs
- SEC-12: `database.executeQuery` no `isPathAllowed` check
- SEC-13: `gdrive.getSettings` requires no permission

### Architecture P2s (10 items)
- ARCH-1.4/1.5: BottomPanel (22 props), PaneFileExplorer (29 props) — prop drilling
- ARCH-3.3/3.4: use-xplorer-actions (921 lines), use-xplorer-effects (861 lines) — god hooks
- ARCH-4.1: Toast: `useToast()` vs `toast` prop inconsistency
- ARCH-4.3: Custom event bus scattered across 8+ components, no registry
- ARCH-4.4: View components (GalleryView, ColumnView, FileGrid) fetch data directly
- ARCH-5.1: No shared `useWindowEvent` hook — pattern repeated 15+ times
- ARCH-5.2: localStorage key strings scattered, no constants
- ARCH-5.4/6.1/6.2: Facade missing `showSaveDialog`, GDrive dialogs bypass facade

### Performance P2s (9 items)
- PERF-08: TreeView sortedFiles not memoized
- PERF-09: GalleryView filmstrip no virtualization
- PERF-10/11: GalleryView listener re-registration + AI poll re-renders
- PERF-12: ChatPanel contextableFiles not memoized (runs on every stream token)
- PERF-13/14: ActivityFeedPanel groupByBucket + 15s timer re-renders
- PERF-15: ChatMessage components not memoized
- PERF-17: ColumnFileRow not memoized

---

## Execution Phases

### Phase 1: Security Hardening (P0s — do first)
1. SEC-14: Redact API keys from `get_agent_settings` response
2. SEC-16: Audit Tauri capabilities for `execute_command`
3. SEC-17: Gate `update_agent_settings` with capability check
4. SEC-06/07: Add `validate_file_path` to 4 Rust commands
5. PERF-06: Lazy-load react-syntax-highlighter

### Phase 2: Performance Quick Wins (P1 S-effort)
6. PERF-01: Memo FileRow
7. PERF-02: useMemo filteredEntries
8. PERF-03: useMemo directoryStats
9. PERF-04: Extract Clock component
10. PERF-05: Fix mousemove listener cleanup
11. PERF-18/19: PrismLight + dynamic xlsx import

### Phase 3: Architecture Refactoring (P1 L-effort)
12. ARCH-5.5: Extract settings inline components
13. ARCH-1.1: Introduce ExplorerContext to replace MainLayout prop drilling
14. ARCH-3.1: Split LeftSidebar into sub-components
15. ARCH-3.2: Split settings.tsx into tab modules
16. ARCH-1.2: Simplify DialogsOverlay with dialog context

### Phase 4: Sandbox Hardening (P1 security)
17. SEC-01/02: Migrate extension execution to iframe/Worker sandbox
