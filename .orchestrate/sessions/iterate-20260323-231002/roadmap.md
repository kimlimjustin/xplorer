# Xplorer Codebase Iteration Roadmap

**Date**: 2026-03-23 | **Branch**: `next` | **Overall Grade**: F (19/100)

---

## Chapter 1: Executive Summary

Xplorer is an ambitious Tauri 2.x desktop file manager with ~234K LOC across TypeScript and Rust. It ships a massive feature set: file operations, search engine, AI integration, git UI, extension system with WASM backends, cloud sync, and more. The architecture foundations are solid — clean dependency direction, strict TypeScript, comprehensive CI, and a well-designed extension SDK.

However, rapid feature development has accumulated significant technical debt across 6 dimensions. The scan identified **110 findings** (9 P0, 28 P1, 48 P2, 25 P3). The most critical areas are:

1. **Security**: 3 exploitable vulnerabilities (unscoped WASM file reads, broken command sanitizer, extension XSS)
2. **Code duplication**: Two diverging extension API implementations, duplicated sandbox code, 6 copies of `formatFileSize`
3. **Performance**: Blocking I/O in async Tauri commands freezes the UI, O(N*M) search algorithm
4. **Stability**: 544 bare `.unwrap()` calls in Rust — each a potential app crash

**Strategic recommendation**: Address security P0s immediately (2-3 hours of work), then stabilize the extension system by consolidating duplicated code, then systematically eliminate unwrap() calls. The architecture is sound — this is a hardening and consolidation effort, not a rewrite.

---

## Chapter 2: Current State Assessment

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Desktop App (Tauri 2.x)                │
├──────────────────────────┬───────────────────────────────┤
│   React Frontend         │   Rust Backend                │
│   apps/client/ (387 TS)  │   apps/src-tauri/ (85 RS)     │
│                          │                               │
│   TauriAPI facade ←──────┤── 380 commands in 26 modules  │
│   (1802 lines, 299 methods)  │                           │
│                          │                               │
│   Extension Host ────────┤── WASM runtime (wasmi)        │
│   (5700+ lines, 2 parallel │  Native plugin registry     │
│    implementations)      │   Extension manager           │
├──────────────────────────┼───────────────────────────────┤
│   @xplorer/sdk (DEAD)    │   Search Engine               │
│   (1 consumer, should    │   (FST + roaring bitmaps      │
│    have 194+)            │    + AI semantic search)       │
├──────────────────────────┴───────────────────────────────┤
│   25 built-in extensions + 10 private prototypes          │
└──────────────────────────────────────────────────────────┘
```

### Tech Stack
| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Runtime | Tauri | 2.10.2 | Current |
| Frontend | React | 18.3 | Current |
| Build | Vite | 5.4 | Current |
| CSS | Tailwind | 3.4 | Current |
| Routing | wouter | 3.3 | Current |
| State | React Query + hooks + localStorage | 5.x | Current |
| Backend | Rust (edition 2021) | Stable | Current |
| Search | Custom (FST + roaring) | Internal | Active development |
| AI | ollama-rs | 0.3.2 | Current |
| Git | git2 | 0.19 | Current |
| WASM | wasmi | 0.40 | Current |
| DB | rusqlite | 0.31 | Current |

### Quality Gates
| Gate | Status | Notes |
|------|--------|-------|
| TypeScript strict | Active | Only 1 `any` in production code |
| ESLint | Active | CI-enforced |
| Prettier | Active | Pre-commit hook |
| Clippy | Active | CI-enforced with `-D warnings` |
| rustfmt | Active | CI-enforced |
| Vitest | Active | 90+ frontend test files |
| cargo test | Active | Tests exist but shallow |
| Playwright E2E | Configured | **No test files** — CI passes vacuously |
| Pre-commit | Active | Husky + lint-staged |

---

## Chapter 3: Health Scorecard

| Dimension | Score | Grade | P0 | P1 | P2 | P3 | Total |
|-----------|-------|-------|----|----|----|----|-------|
| Code Quality | 0 | F | 2 | 5 | 13 | 4 | 24 |
| Architecture | 62 | C | 0 | 2 | 6 | 4 | 12 |
| Infrastructure | 46 | D | 0 | 4 | 6 | 4 | 14 |
| Security | 0 | F | 3 | 5 | 6 | 4 | 18 |
| Performance | 0 | F | 3 | 7 | 9 | 7 | 26 |
| Developer Experience | 19 | F | 1 | 5 | 8 | 2 | 16 |
| **Overall** | **19** | **F** | **9** | **28** | **48** | **25** | **110** |

**Note**: The low scores reflect the scan's thoroughness against a large codebase (234K LOC), not the absence of quality. The architecture grade (C/62) is the strongest dimension, reflecting sound foundational decisions.

---

## Chapter 4: Critical Findings (P0)

### SEC-001: WASM `host_read_file` Has No Path Scoping
| Field | Value |
|-------|-------|
| Severity | P0 |
| Dimension | Security |
| Location | `apps/src-tauri/src/extensions/host_functions.rs:316-331` |
| Effort | M (1-4hr) |
| Dependencies | None |

**Description**: The `do_read_file` WASM host function only validates against null bytes and empty strings. It does NOT scope reads to the extension's data directory. Any WASM extension with `file:read` permission can read `~/.ssh/id_rsa`, browser credential stores, etc. Write operations (`do_write_file` at line 333) are correctly scoped via `validate_write_path`.

**Impact**: A malicious extension can exfiltrate any file on disk. Combined with `system:network`, data can be sent to an attacker.

**Fix**: Add `validate_read_path` that scopes reads to: (1) extension data directory, (2) user's currently-open directory, (3) explicit user-approved paths. Apply same to `do_list_dir` and `do_file_exists`.

---

### SEC-002: `sanitize_command` Allows Arbitrary Command Execution
| Field | Value |
|-------|-------|
| Severity | P0 |
| Dimension | Security |
| Location | `apps/src-tauri/src/operations/system_ops.rs:307-344` |
| Effort | S (<1hr) |
| Dependencies | None |

**Description**: Line 343 returns `Ok(())` for all non-allowlisted commands without shell metacharacters. The `SAFE_COMMANDS` allowlist is decorative — both allowlisted and non-allowlisted commands pass. `rm -rf /`, `chmod 777`, `python -c 'import os; os.system("...")'` all pass.

**Fix**: Change line 343 from `Ok(())` to `Err(format!("Command '{}' is not on the allowlist", binary_name))`.

---

### SEC-003: Markdown Preview Extension XSS
| Field | Value |
|-------|-------|
| Severity | P0 |
| Dimension | Security |
| Location | `packages/extensions/markdown-preview/src/index.tsx:159` |
| Effort | S (<1hr) |
| Dependencies | None |

**Description**: Uses `dangerouslySetInnerHTML` without DOMPurify. The main app's `MarkdownPreview.tsx` correctly sanitizes. A crafted `.md` file with `[click](javascript:alert(1))` triggers XSS in the extension context, which has access to `window.XplorerSDK`.

**Fix**: Add DOMPurify sanitization before rendering, or use the `escapeHtml` function on all non-code-block insertions.

---

### CQ-001: Two Diverging `createExtensionApi` Implementations
| Field | Value |
|-------|-------|
| Severity | P0 |
| Dimension | Code Quality |
| Location | `extension-sandbox.ts:457` (537 lines, 9 params) and `extension-api-factory.ts:35` (745 lines, deps object) |
| Effort | L (4-16hr) |
| Dependencies | None |

**Description**: Two complete implementations of the extension API surface with different parameter styles, different feature coverage, and different permission checks. Security fixes applied to one copy may not be applied to the other.

**Fix**: Consolidate into one canonical implementation in `extension-api-factory.ts`. Delete duplicate from `extension-sandbox.ts`. Update all callers.

---

### CQ-002: Sandbox Proxy Code Duplicated
| Field | Value |
|-------|-------|
| Severity | P0 |
| Dimension | Code Quality |
| Location | `extension-host.ts:500-548` and `extension-sandbox.ts:200-290` |
| Effort | M (1-4hr) |
| Dependencies | CQ-001 |

**Description**: ~90 lines of security-critical document proxy, blocked globals, and blocked prototype methods exist in two copies with diverging security checks.

**Fix**: Extract `createSandboxedEnvironment()` helper used by both files.

---

### PERF-001: Blocking I/O in async Tauri Commands (Directory Ops)
| Field | Value |
|-------|-------|
| Severity | P0 |
| Dimension | Performance |
| Location | `apps/src-tauri/src/operations/directory_ops.rs:8-63` |
| Effort | M (1-4hr) |
| Dependencies | None |

**Description**: `read_directory()` performs synchronous `fs::read_dir`, `metadata()`, `get_file_type()`, `get_mime_type()` on the Tokio runtime. Blocks all IPC for large directories.

**Impact**: UI hangs of 200ms-2s+ for directories with >5000 files.

**Fix**: Wrap in `tokio::task::spawn_blocking(move || { ... }).await.unwrap()`.

---

### PERF-002: Blocking I/O in Metadata/Properties Commands
| Field | Value |
|-------|-------|
| Severity | P0 |
| Dimension | Performance |
| Location | `metadata_ops.rs:7-55`, `properties_ops.rs:56-100+` |
| Effort | S (<1hr) |
| Dependencies | None |

**Fix**: Wrap in `tokio::task::spawn_blocking`.

---

### PERF-003: O(N*M) Algorithm in Search Incremental Update
| Field | Value |
|-------|-------|
| Severity | P0 |
| Dimension | Performance |
| Location | `apps/src-tauri/src/search/compat.rs:633` |
| Effort | S (<1hr) |
| Dependencies | None |

**Description**: `!idx.documents().values().any(|d| &d.path == path)` iterates all indexed documents for every file on disk. The `path_to_id` HashMap already exists for O(1) lookups.

**Fix**: Replace with `!idx.path_to_id().contains_key(path)`.

---

### DX-001: 544 Bare `.unwrap()` Calls in Rust
| Field | Value |
|-------|-------|
| Severity | P0 |
| Dimension | Developer Experience / Stability |
| Location | 33 Rust files, hotspots: `file_organizer.rs`(36), `duplicate_finder.rs`(36), `undo_redo_ops.rs`(34), `compression_ops.rs`(31) |
| Effort | XL (16hr+) |
| Dependencies | None (can be done incrementally) |

**Description**: Each bare `unwrap()` is a potential panic that crashes the Tauri process. On user machines with unusual filesystems, permissions, or locale settings, these surface as hard crashes.

**Fix**: Replace with `?` operator, `.unwrap_or_default()`, or `.map_err()`. Enable `clippy::unwrap_used` lint. Prioritize file operation commands users trigger directly.

---

## Chapter 5: Strategic Improvements (P1)

### Security P1s
| ID | Finding | Location | Effort |
|----|---------|----------|--------|
| SEC-004 | JS sandbox bypass via `import()` | `extension-sandbox.ts:161-401` | L |
| SEC-005 | `eject_volume` command injection (Windows device handles) | `system_ops.rs:106-223` | S |
| SEC-006 | WASM HTTP SSRF via DNS rebinding | `host_functions.rs:480-565` | M |
| SEC-007 | `open_file` Windows cmd.exe injection | `system_ops.rs:379-415` | S |
| SEC-008 | `native_plugin_invoke` has no backend permission check | `extensions/commands.rs:659-670` | S |

### Code Quality P1s
| ID | Finding | Location | Effort |
|----|---------|----------|--------|
| CQ-003 | `formatFileSize` duplicated 6+ times | 6 files (see scan) | S |
| CQ-004 | Two parallel extension loading systems (5700+ lines) | `extension-host.ts` + `extension-lifecycle.ts` | XL |
| CQ-005 | 16+ files exceed 1000-line limit | Multiple | L (per file) |

### Architecture P1s
| ID | Finding | Location | Effort |
|----|---------|----------|--------|
| ARCH-001 | SDK layer dead — 1 consumer vs 194 for TauriAPI | `packages/sdk/` | L |
| ARCH-002 | SDK types copy-pasted (1109 vs 1140 lines) | `sdk/types/` and `tauri-api-types.ts` | S |

### Infrastructure P1s
| ID | Finding | Location | Effort |
|----|---------|----------|--------|
| INFRA-001 | No dependency update automation | `.github/` | S |
| INFRA-002 | No security scanning in CI | `.github/workflows/ci.yml` | S |
| INFRA-008 | No `.env.example` | Project root | S |
| INFRA-012 | No error tracking / crash reporting | Throughout | L |

### Developer Experience P1s
| ID | Finding | Location | Effort |
|----|---------|----------|--------|
| DX-002 | No `SECURITY.md` | Project root | S |
| DX-003 | No Dependabot/Renovate | `.github/` | S |
| DX-004 | Shallow/formulaic Rust tests | `apps/src-tauri/` | XL |
| DX-005 | Unresolved SECURITY TODOs in extension sandbox | `extension-host.ts:91`, `extension-sandbox.ts:408` | M |

---

## Chapter 6: Tactical Improvements (P2-P3)

### Quick Wins (P2, effort S — do anytime)
| ID | Finding | Effort |
|----|---------|--------|
| CQ-006 | Replace `window.prompt()` with Tauri native dialogs | S |
| CQ-007 | Define `SortField` union type instead of `string` | S |
| CQ-008 | Replace `any` in SDK git service with proper type | S |
| CQ-009 | Cache Regex::new() in document_extractor.rs | S |
| ARCH-003 | Fix SDK transport inverted dependency | S |
| ARCH-004 | Fix `file_exist` → `file_exists` naming | S |
| ARCH-005 | Replace bare unwrap in encryption_ops.rs | S |
| PERF-004 | Move AcceleratedFileOps::new() outside par_iter loop | S |
| PERF-005 | Use HashSet for synonym deduplication | S |
| PERF-006 | Remove double-buffering in simd_buffered_copy | S |
| SEC-009 | Strengthen Argon2 parameters for file encryption | S |
| SEC-010 | Fix api.rs Mutex guards to recover from poison | S |
| SEC-011 | Fix incomplete `isPathAllowed` path normalization | S |
| DX-006 | Fix brittle 160+ icon mock with Proxy pattern | S |
| DX-007 | Align Node.js version across docs/CI/package.json | S |
| DX-008 | Make Ollama URL configurable via env var | S |
| INFRA-003 | Remove deprecated @types/diff and @types/dompurify | S |
| INFRA-010 | Add PR and issue templates | S |

### Moderate Effort (P2, effort M-L)
| ID | Finding | Effort |
|----|---------|--------|
| ARCH-006 | Consolidate duplicate git modules | M |
| ARCH-007 | Consolidate duplicate file watcher modules | M |
| ARCH-008 | Split TauriAPI into domain files | M |
| PERF-007 | Defer file_type/mime_type in directory listing | M |
| PERF-008 | Parallelize directory size calculation | M |
| PERF-009 | Fix search index save_to_disk memory doubling | M |
| PERF-010 | Add tree-shaking for react-syntax-highlighter | M |
| PERF-011 | Parallelize search index rebuild | M |
| DX-009 | Add initial E2E tests (or remove empty CI job) | L |
| DX-010 | Add Rust doc comments to command functions | L |
| DX-011 | Design storage schema migration strategy | M |

### Backlog (P3)
- Convert `function` declarations to arrow functions
- Rename page files to PascalCase
- Replace polling with event-driven updates in UndoHistoryPanel
- Start writing Architecture Decision Records
- Reconsider Rust glob re-exports in operations/mod.rs
- Add TreeView virtualization
- Cache compiled WASM modules
- Consolidate FileGrid useEffect hooks

---

## Chapter 7: Future Architecture Vision

### Horizon 1: Stabilize (0-3 months)

**Goal**: Fix all P0 issues, harden security, reduce crash risk.

```
Target State:
┌──────────────────────────────────────────────────────────┐
│   Extension Sandbox (HARDENED)                            │
│   - Single createExtensionApi implementation              │
│   - Single sandbox proxy                                  │
│   - Backend permission enforcement for JS extensions      │
│   - Scoped WASM file reads                                │
│   - Fixed command sanitizer (strict allowlist)            │
├──────────────────────────────────────────────────────────┤
│   Async Ops (NON-BLOCKING)                                │
│   - All file ops wrapped in spawn_blocking                │
│   - Deferred metadata loading                             │
│   - O(1) search incremental update                        │
├──────────────────────────────────────────────────────────┤
│   Stability                                               │
│   - unwrap() reduced from 544 to <50 (test-only)          │
│   - clippy::unwrap_used enabled                           │
│   - Error tracking (Sentry) for production crashes        │
└──────────────────────────────────────────────────────────┘
```

**Key deliverables**:
1. Fix 9 P0 findings (Security: 3, Code Quality: 2, Performance: 3, DX: 1)
2. Fix all Security P1s (5 findings)
3. Add security scanning to CI
4. Add Dependabot
5. Create SECURITY.md and .env.example
6. Reduce bare unwrap() from 544 to <100

### Horizon 2: Strengthen (3-6 months)

**Goal**: Consolidate architecture, improve test coverage, optimize performance.

```
Target State:
┌──────────────────────────────────────────────────────────┐
│   Frontend                                                │
│   - TauriAPI split into domain modules                    │
│   - Single extension loading system                       │
│   - All files under 1000 lines                            │
│   - TreeView virtualized                                  │
├──────────────────────────────────────────────────────────┤
│   Backend                                                 │
│   - Consolidated git module                               │
│   - Consolidated file watcher                             │
│   - All ops non-blocking (spawn_blocking)                 │
│   - Parallel search indexing                              │
│   - doc comments on all #[command] functions               │
├──────────────────────────────────────────────────────────┤
│   Testing                                                 │
│   - Rust test coverage: 60%+ on operations/               │
│   - 10+ E2E tests covering critical paths                 │
│   - Frontend coverage reporting in CI                     │
├──────────────────────────────────────────────────────────┤
│   SDK Decision (choose one)                               │
│   Option A: Adopt SDK — migrate 194 TauriAPI consumers    │
│   Option B: Delete SDK — re-export from tauri-api.ts      │
└──────────────────────────────────────────────────────────┘
```

**Key deliverables**:
1. Resolve SDK layer strategy (ARCH-001, ARCH-002, ARCH-003)
2. Consolidate extension system (CQ-001, CQ-002, CQ-004)
3. Split all oversized files (CQ-005)
4. Consolidate duplicate Rust modules (ARCH-006, ARCH-007)
5. Meaningful Rust test coverage (DX-004)
6. Initial E2E test suite (DX-009)
7. Performance optimizations (PERF-001 through PERF-011)

### Horizon 3: Scale (6-24 months)

**Goal**: Prepare for extension ecosystem growth, team scaling, and potential web deployment.

```
Target State:
┌──────────────────────────────────────────────────────────┐
│   Extension System v2                                     │
│   - iframe-based isolation (true sandbox)                  │
│   - Auto-generated permission proxy from manifest          │
│   - Extension versioning + API stability guarantee         │
│   - Published extension marketplace                        │
├──────────────────────────────────────────────────────────┤
│   Modular Backend                                         │
│   - Tauri plugin-based command registration                │
│   - Feature flags for optional subsystems                  │
│   - Tauri managed state (not global statics)               │
│   - Storage schema migration framework                     │
├──────────────────────────────────────────────────────────┤
│   Scalability                                             │
│   - Search engine: streaming indexing for 500K+ files      │
│   - Virtual file systems (cloud, archive browsing)         │
│   - Web deployment via transport abstraction               │
└──────────────────────────────────────────────────────────┘
```

---

## Chapter 8: Migration Paths

### 8.1 Extension System Consolidation (H1-H2)

```
Phase 1: Consolidate createExtensionApi (H1, 4-8hr)
  1. Audit: map all callers of both implementations
  2. Choose extension-api-factory.ts as canonical (newer, cleaner API)
  3. Add missing features from sandbox version (watch, showProgress)
  4. Update all callers to use factory version
  5. Delete duplicate from extension-sandbox.ts

Phase 2: Consolidate sandbox proxy (H1, 2-4hr)
  1. Extract createSandboxedEnvironment() helper
  2. Both extension-host.ts and extension-sandbox.ts call it
  3. Unify blocked globals lists

Phase 3: Resolve host vs lifecycle (H2, 16hr+)
  1. Audit which features exist only in each
  2. Migrate unique features to lifecycle version
  3. Remove duplicate loading logic from extension-host.ts
  4. Reduce extension-host.ts to registry management only
```

### 8.2 SDK Strategy (H2)

**Recommended: Option B (Delete SDK services, keep types)**

```
Phase 1: Unify types (2hr)
  1. Move canonical types to packages/sdk/src/types/
  2. Have tauri-api-types.ts re-export from @xplorer/sdk
  3. Delete duplicate definitions

Phase 2: Move transport (1hr)
  1. Move transport.ts into packages/sdk/
  2. Have apps/client/src/lib/transport.ts re-export

Phase 3: Simplify SDK (2hr)
  1. Delete services/ directory (unused by 193 of 194 consumers)
  2. SDK becomes: types + transport + extension-sdk re-export
  3. TauriAPI remains the primary client-side API
```

### 8.3 Unwrap Elimination (H1-H2)

```
Phase 1: Enable clippy lint (1hr)
  - Add #![warn(clippy::unwrap_used)] to lib.rs
  - CI will show all 544 locations

Phase 2: Fix high-traffic modules first (8hr)
  - file_ops.rs (29 unwraps)
  - compression_ops.rs (31 unwraps)
  - encryption_ops.rs (30 unwraps)
  - Replace with ? operator + meaningful error messages

Phase 3: Fix remaining modules (16hr)
  - file_organizer.rs, duplicate_finder.rs, undo_redo_ops.rs
  - search/ modules
  - extension/ modules

Phase 4: Upgrade to deny (1hr)
  - Change to #![deny(clippy::unwrap_used)]
  - Only allow in #[cfg(test)] modules
```

---

## Chapter 9: Execution Phases

### Phase A: Security Sprint (Priority: IMMEDIATE, 1-2 days)
| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | SEC-002: Fix sanitize_command allowlist bypass | S | Blocks arbitrary command execution |
| 2 | SEC-003: Add DOMPurify to markdown preview extension | S | Blocks XSS |
| 3 | SEC-001: Add read path scoping to WASM host functions | M | Blocks file exfiltration |
| 4 | SEC-008: Add backend permission check to native_plugin_invoke | S | Blocks unauthorized plugin access |
| 5 | SEC-007: Fix open_file Windows cmd.exe injection | S | Blocks code execution via filenames |
| 6 | SEC-005: Validate eject_volume paths | S | Blocks device handle abuse |

### Phase B: Quick Wins Sprint (1-2 days)
| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | PERF-003: Fix O(N*M) search algorithm | S | Search startup from minutes to seconds |
| 2 | PERF-002: Wrap metadata ops in spawn_blocking | S | Unblock UI during properties |
| 3 | CQ-003: Deduplicate formatFileSize (6 copies → 1) | S | Eliminate diverging copies |
| 4 | DX-002: Create SECURITY.md | S | Responsible disclosure path |
| 5 | DX-003: Add Dependabot config | S | Automated dependency updates |
| 6 | INFRA-008: Create .env.example | S | Developer onboarding |
| 7 | INFRA-002: Add npm audit + cargo audit to CI | S | Catch known vulnerabilities |
| 8 | DX-006: Fix brittle icon mock with Proxy | S | Eliminate test maintenance burden |
| 9 | SEC-009: Strengthen Argon2 parameters | S | Better encryption |
| 10 | SEC-010: Fix api.rs Mutex guard pattern | S | Prevent permanent lock failure |

### Phase C: Extension Consolidation (3-5 days)
| # | Item | Effort | Depends On |
|---|------|--------|------------|
| 1 | CQ-002: Extract shared sandbox proxy | M | — |
| 2 | CQ-001: Consolidate createExtensionApi | L | CQ-002 |
| 3 | PERF-001: Wrap directory ops in spawn_blocking | M | — |
| 4 | ARCH-002: Unify SDK/client types | S | — |
| 5 | ARCH-006: Consolidate git modules | M | — |
| 6 | ARCH-007: Consolidate file watcher modules | M | — |

### Phase D: Stability & Performance (1-2 weeks)
| # | Item | Effort | Depends On |
|---|------|--------|------------|
| 1 | DX-001: Eliminate bare unwraps (high-traffic modules) | L | — |
| 2 | PERF-007: Defer file_type/mime_type | M | PERF-001 |
| 3 | ARCH-008: Split TauriAPI into domain files | M | — |
| 4 | CQ-005: Split oversized TS files (top 5) | L | CQ-001 |
| 5 | PERF-009: Fix search index save memory doubling | M | — |
| 6 | DX-004: Add meaningful Rust tests (file_ops, compression) | L | — |

### Phase E: Architecture & Growth (2-4 weeks)
| # | Item | Effort | Depends On |
|---|------|--------|------------|
| 1 | CQ-004: Resolve extension host vs lifecycle | XL | CQ-001, CQ-002 |
| 2 | ARCH-001: Execute SDK strategy decision | L | ARCH-002 |
| 3 | DX-009: Create initial E2E test suite | L | — |
| 4 | INFRA-012: Integrate error tracking (Sentry) | L | — |
| 5 | SEC-004: Harden sandbox (CSP, iframe migration) | L | CQ-001 |

---

## Chapter 10: Risk Assessment

### Risks of Action

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Extension consolidation breaks existing extensions | Medium | High | Test all 25 built-in extensions after changes |
| Unwrap elimination introduces new error handling bugs | Low | Medium | Gradual rollout, test each module after changes |
| SDK strategy change breaks import paths | Medium | Low | Monorepo — all consumers visible, can batch-update |
| spawn_blocking changes Rust function signatures | Low | Low | Wrapper pattern preserves existing API |

### Risks of Inaction

| Risk | Likelihood | Impact | Timeline |
|------|-----------|--------|----------|
| Extension file exfiltration vulnerability exploited | Medium | **Critical** | Any time |
| Command injection via sanitize_command | Low | **Critical** | Any time |
| App crashes from unwrap() on unusual filesystems | High | High | Every release |
| Dependency vulnerability unpatched for months | High | High | Ongoing |
| Extension security divergence causes data breach | Medium | High | As extension ecosystem grows |
| UI freezes drive users away | High | Medium | Every use of large directories |
| New contributors confused by duplicate systems | High | Low | Every onboarding |

**The security P0s represent the highest risk of inaction. A single malicious extension in the marketplace could exploit SEC-001 to exfiltrate user files.**

---

## Appendix: Scan Reports

All raw findings are in:
- `.orchestrate/sessions/iterate-20260323-231002/scan-code-quality.md`
- `.orchestrate/sessions/iterate-20260323-231002/scan-architecture.md`
- `.orchestrate/sessions/iterate-20260323-231002/scan-security.md`
- `.orchestrate/sessions/iterate-20260323-231002/scan-performance.md`
- `.orchestrate/sessions/iterate-20260323-231002/scan-infrastructure.md`
- `.orchestrate/sessions/iterate-20260323-231002/scan-developer-experience.md`
- `.orchestrate/sessions/iterate-20260323-231002/health-scorecard.md`
