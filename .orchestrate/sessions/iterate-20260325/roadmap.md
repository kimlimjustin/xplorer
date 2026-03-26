# Xplorer Improvement Roadmap

**Date:** 2026-03-25
**Branch:** `next` (HEAD: `738125d`)
**Scope:** All findings from 6-dimension scan, prioritized and sequenced

---

## 1. Executive Summary

Xplorer is a well-engineered Tauri desktop file manager with strong code discipline (zero `any` types, zero bare mutex unwraps, clean module boundaries) but significant gaps in test coverage, async runtime safety, and extension security. The 8 failing Rust tests on the `next` branch represent the most urgent issue -- CI is red. Beyond that, 14+ Rust commands block the Tokio async runtime with synchronous filesystem calls, causing UI freezes during file operations. The extension sandbox, while extensively hardened after recent security fixes, still has three P1 gaps: same-realm escape vectors, symlink-based path traversal, and an ungated Git API. This roadmap sequences 120+ findings into four execution phases, starting with the items that block development (failing tests, broken audit gates) and progressing through security hardening, performance fixes, and ecosystem maturation.

---

## 2. Health Scorecard

| Dimension | Weight | Score | Grade |
|-----------|--------|-------|-------|
| Security | 25% | 60 | C |
| Architecture | 20% | 61 | C |
| Code Quality | 20% | 0 | F |
| Performance | 15% | 16 | F |
| Infrastructure | 10% | 14 | F |
| Developer Experience | 10% | 0 | F |
| **Overall** | **100%** | **31** | **F** |

The F grades are driven primarily by granular counting of untested files (47+ individual findings) and blocking-I/O commands (14+ findings). Code discipline and architectural coherence are strong -- the gaps are in coverage and runtime safety, not in foundational quality.

---

## 3. Critical Findings (P0)

### RESOLVED

| ID | Description | Resolution |
|----|-------------|------------|
| I-1 | Tauri build broken: `WASM_RUNTIME` referenced but module missing | `wasm_runtime.rs` now exists; `cargo check` passes |
| (pre-scan) | 7 security P0s (Ed25519 signing, permission gates, WASM memory limit, etc.) | Fixed in commit `e0b4881` |

### REMAINING

| ID | File:Line | Description | Fix Approach | Effort |
|----|-----------|-------------|--------------|--------|
| DX-1 | `extensions/commands.rs` (4 tests) | URL validation tests failing -- SSRF protection for extensions is broken. `test_validate_url_rejects_localhost`, `_private_ips`, `_hex_encoded_ips`, `_decimal_encoded_ips` all fail. | Fix `validate_url` to correctly reject localhost, private IPs, and encoded IP variants. The regex/parser is likely not handling all RFC formats. | S |
| DX-2 | `operations/system_ops.rs` (2 tests) | Command sanitization tests failing -- `test_sanitize_allows_non_whitelisted_command_without_metacharacters` and `test_sanitize_env_and_find_removed_from_allowlist` diverge from implementation. | Either update `sanitize_command` to match intended policy or update tests to match current behavior. Investigate whether `find` should be in the allowlist. | S |
| I-2 | `package.json:61` | `xlsx` (SheetJS) has 2 HIGH CVEs (Prototype Pollution + ReDoS) with NO npm fix available. SheetJS moved to proprietary licensing. 429 kB bundle weight. | Replace with `exceljs` or `@e965/xlsx`. Update import sites and test any spreadsheet preview/export features. | L |
| P-1 | `operations/file_ops.rs:448-936` | 12 `async fn` Tauri commands (`copy`, `move_file`, `remove_file`, `rename`, `create_file`, `create_file_with_content`, `read_text_file`, `read_binary_file`, `bulk_rename`, `get_directory_sizes`, `check_conflicts`, `create_symlink`) perform blocking `std::fs` calls on the Tokio runtime, freezing the UI. | Wrap each function body in `tokio::task::spawn_blocking(move \|\| { ... }).await.unwrap()`. The `_with_progress` variants already use `thread::spawn` -- follow that pattern. | M |
| P-2 | `google_drive.rs:700,726` | `gdrive_download_file` and `gdrive_upload_file` do `std::fs::write` / `std::fs::read` on async runtime. | Use `tokio::fs` or `spawn_blocking`. | S |

**Total remaining P0: 5** (2 test failures, 1 vulnerable dependency, 2 blocking-I/O)

---

## 4. Strategic Improvements (P1)

### Theme A: Extension Security Hardening

| ID | Finding | Fix Approach | Effort |
|----|---------|--------------|--------|
| S-4 | Git API exposed to extensions without path/permission checks | Add `isPathAllowed` checks to all git API methods in `extension-api-factory.ts:139-170`. Add `git:read`/`git:write` permission types. Add `validate_file_path` on Rust side in `git_history.rs`. | M |
| S-2 | `isPathAllowed` uses string matching without canonicalization -- symlink bypass | Add a Tauri command `canonicalize_path` that calls `std::fs::canonicalize`. Call it before the JS-side blocklist check. Alternatively, move all path validation to the Rust side entirely. | M |
| S-1 | Same-realm JS sandbox fundamentally escapable | Track as tech debt. Plan migration to iframe-based origin isolation or Web Worker sandbox. Document known escape vectors. Short-term: add more prototype freezing for async generators, WeakRef, FinalizationRegistry. | L |
| CQ-S1 | SECURITY TODO in `extension-sandbox.ts:203` | Audit and implement defense-in-depth hardening for sandbox escapes. | L |
| CQ-S2 | SECURITY TODO in `extension-host.ts:92` | Audit and implement hardening for `loadExtensionScript`. | L |

### Theme B: Infrastructure & CI Gates

| ID | Finding | Fix Approach | Effort |
|----|---------|--------------|--------|
| I-3 | pnpm audit `continue-on-error: true` | Remove `continue-on-error` or change to `audit-level=critical` so HIGH findings block merges. | S |
| I-4 | vite <=5.4.19 path-traversal bypass | `pnpm update vite` to >=5.4.20. | S |
| I-5 | mammoth > underscore DoS | `pnpm update mammoth` to >=1.12. | S |
| I-6 | Pre-commit hook has no typecheck | Add `npx tsc --noEmit` to lint-staged or as a separate pre-commit step. Consider running only on changed files for speed. | S |

### Theme C: Test Stability & Coverage

| ID | Finding | Fix Approach | Effort |
|----|---------|--------------|--------|
| DX-3 | 8 total Rust tests failing on `next` | Fix the 6 security/sanitization tests (DX-1, DX-2 above) + `test_walk_files` (filter `.DS_Store`) + `test_validate_file_path_rejects_etc` (fix validation logic or test expectation). | M |
| DX-E2E | `e2e/` directory missing but referenced in CI and docs | Either create a minimal e2e test suite with Playwright or remove e2e references from CI/docs until ready. | XL |
| DX-ML | MainLayout.tsx (root orchestrator) untested | Write integration tests covering layout initialization, pane rendering, and extension panel mounting. | L |
| CQ-T1-T9 | 9 critical untested files (P1) | Prioritize tests for: `use-xplorer-actions.ts`, `use-file-operations.ts`, `use-xplorer-effects.ts`, `extension-lifecycle.ts`, `extension-sandbox.ts`, `extension-api-factory.ts`, `context-menu-factory.ts`, `CommandPalette.tsx`, `HomePage.tsx`. | XL |

### Theme D: Performance -- Rendering

| ID | Finding | Fix Approach | Effort |
|----|---------|--------------|--------|
| P-3 | FileGrid not memoized | Wrap in `React.memo` with shallow comparison. | S |
| P-4 | Inline style objects in FileGrid | Move `crossTabOutlineStyle` and `crossTabBadgeStyle` to module-level constants. | S |
| P-5 | Search index rebuild single-threaded | Use `rayon::par_iter` for file content reading, batch index insertions, replace `WalkDir` with `jwalk`. | M |
| P-6 | `get_directory_sizes` blocks runtime | Wrap in `spawn_blocking`, consider `jwalk` for parallel traversal. | S |

### Theme E: Architecture -- SDK Consolidation

| ID | Finding | Fix Approach | Effort |
|----|---------|--------------|--------|
| A-F4a | SDK package dead -- bypassed by 195 consumers | Decide: either migrate consumers to `@xplorer/sdk` or delete `packages/sdk/` and formalize `lib/tauri-api/` as the canonical SDK. The latter is simpler given current state. | XL |
| A-F2d | main.rs registers 382 commands in one block | Explore Tauri 2.x plugin architecture or create a `register_commands!()` macro that collects from submodules. | L |

---

## 5. Tactical Improvements (P2-P3)

### P2 -- Medium Priority (grouped)

**Security (4):**
- Add `validate_file_path` to 11 Rust commands in system_ops, directory_ops, metadata_ops (S effort)
- Remove `blob:` from CSP `script-src` in tauri.conf.json (S)
- Add `*.pem`, `*.key`, `credentials.json` etc. to `.gitignore` (S)
- Add permission check for `backend.call` / WASM execute (S)

**Architecture (7):**
- Deprecate TauriAPI static class; consumers import from domain modules directly (M)
- Split extension-host.ts into registry sub-modules (L)
- Split 11 TypeScript files exceeding 1000 lines (M each)
- Centralize 2 hardcoded localStorage keys into STORAGE_KEYS (S)
- Clean up flat lib.rs: remove dead `git_integration.rs` facade, group modules (L)
- Split compression_ops.rs (2,242 lines) into zip_ops, tar_ops, etc. (M)
- Adopt AppError/AppResult in Tauri command signatures (L)

**Infrastructure (11):**
- Add macOS runner to CI (S)
- Pin `tauri-apps/tauri-action` to specific version (S)
- Add cargo tests to release workflow (S)
- Configure Dependabot or Renovate (S)
- Upgrade vitest v2 -> v4 to resolve transitive HIGH vulns (M)
- Extend lint script to cover packages/sdk, extension-sdk (S)
- Enable `noUncheckedIndexedAccess` in tsconfig (S)
- Add tsconfig for test files (S)
- Add pre-push hook for Rust checks (S)
- Enforce clippy locally via pre-commit (S)
- Confirm PDF.js chunk is lazy-loaded (M)

**Performance (6):**
- Use HashSet for synonym deduplication in search (S)
- Iterate bitmap set bits instead of all_documents scan (M)
- Add i18next, dompurify to Vite manualChunks (S)
- Split 5 oversized components into memoized sub-components (L)
- Extract SmartSearch pure functions to module level (S)
- Wrap backup operations in spawn_blocking (M)

**Developer Experience (15):**
- Add platform-specific setup instructions to CONTRIBUTING.md (S)
- Write tests for TreeView.tsx, extension panels, CodeEditorPanel, etc. (M each)
- Improve overall frontend test coverage toward 60%+ (XL)
- Document Tauri command API (L)
- Add extension publishing/signing guide (M)
- Fix 7 missing i18n keys in id/ja/zh locales (S)
- Fix test_walk_files OS sensitivity (S)
- Create end-to-end extension development tutorial (M)
- Document .xtension package format and signing (M)

### P3 -- Low Priority (25+ items)

- Add `console.warn` to 6 silent catch blocks
- Remove deprecated `@types/diff`, `@types/dompurify`
- Add i18n completeness check to CI
- Add bundle analyzer plugin
- Add CODE_OF_CONDUCT.md
- Pass allFiles via React context instead of prop
- Derive stable key for tags effect
- Replace walkdir with jwalk in search engine
- Wrap PaneTabBar in React.memo
- Fix create-extension placeholder repository URL
- Fix SDK prepublishOnly to use pnpm
- Consider turbo/nx for build orchestration
- Add unified test command for frontend + Rust
- Add .clippy.toml
- Cache cargo-audit in CI
- Add no-engines enforcement for pnpm-only
- Validate docker container IDs (reject leading `-`)
- Restrict SQL is_read_only_query to SELECT/EXPLAIN only
- Document asset protocol scope risk

---

## 6. Future Architecture Vision

### Horizon 1: Stabilize (0-3 months)

**Goal:** Green CI, zero P0 findings, extension security gated.

- Fix all 8 failing Rust tests (DX-1, DX-2, related)
- Replace `xlsx` with secure alternative
- Wrap 14+ blocking-I/O commands in `spawn_blocking`
- Gate Git API with path validation and permissions
- Canonicalize paths in `isPathAllowed` (symlink fix)
- Remove `continue-on-error` from pnpm audit
- Upgrade vite, mammoth to resolve CVEs
- Add typecheck to pre-commit hook
- Write tests for 9 P1-severity untested files
- Fix or remove e2e references (create minimal suite or defer)

**Exit criteria:** 0 P0, all Rust tests green, pnpm audit passes at HIGH level.

### Horizon 2: Strengthen (3-6 months)

**Goal:** Test coverage 80%+, iframe sandbox, SDK consolidated, typed errors.

- Migrate extension sandbox from `new Function()` to iframe-based origin isolation or Worker sandbox. This eliminates the fundamentally-escapable same-realm problem.
- Consolidate SDK: either delete `packages/sdk/` or migrate consumers. Remove the duplicate API layer.
- Adopt `AppError`/`AppResult` across all 118 Tauri commands for typed error handling on the frontend.
- Reach 80% component-level test coverage with focused test writing sprints.
- Split all files exceeding 1000-line limit.
- Implement Tauri 2.x plugin grouping to replace the 382-command registration block.
- Add Dependabot, macOS CI runner, and pre-push hooks.
- Create extension developer documentation (publishing, signing, testing guide).

**Exit criteria:** Frontend test coverage >=80%, iframe sandbox shipped, SDK is single source of truth, all files under 1000 lines.

### Horizon 3: Scale (6-24 months)

**Goal:** Marketplace launch, extension ecosystem growth, cross-platform polish.

- Launch extension marketplace with third-party submissions.
- Publish extension signing guide and automated signing pipeline.
- Add cross-platform E2E test suite (Playwright on all 3 OS targets).
- Explore WebAssembly-based extension frontend isolation (beyond WASM backends).
- Implement dynamic asset protocol scoping.
- Add Rust integration tests for the full command surface.
- Performance: parallel search indexing with rayon, jwalk everywhere.
- Architecture: extract extension system into standalone Tauri plugin.
- Consider React 19 migration when ecosystem stabilizes.

**Exit criteria:** Marketplace live with 10+ third-party extensions, E2E coverage on all platforms, extension system extractable as independent package.

---

## 7. Execution Phases

### Phase 1: Unblock Development (Week 1-2)

**Priority:** Get CI green and remove blocking issues.

| Task | Effort | Dependencies |
|------|--------|--------------|
| Fix 4 URL validation test failures (DX-1) | S | None |
| Fix 2 command sanitization test failures (DX-2) | S | None |
| Fix `test_validate_file_path_rejects_etc` | S | None |
| Fix `test_walk_files` OS sensitivity | S | None |
| Remove pnpm audit `continue-on-error` (I-3) | S | None |
| Upgrade vite to >=5.4.20 (I-4) | S | None |
| Upgrade mammoth to >=1.12 (I-5) | S | None |
| Add `tsc --noEmit` to pre-commit (I-6) | S | None |

**Estimated effort:** 1-2 dev-days
**Exit criteria:** `cargo test` = 0 failures, `pnpm audit --audit-level=high` = 0 production findings, pre-commit includes typecheck.

### Phase 2: Critical Fixes (Week 3-6)

**Priority:** Eliminate P0s and high-impact P1s.

| Task | Effort | Dependencies |
|------|--------|--------------|
| Replace `xlsx` with secure alternative (I-2) | L | Phase 1 (CI green) |
| Wrap 12 file_ops commands in `spawn_blocking` (P-1) | M | None |
| Wrap 2 GDrive commands in spawn_blocking/tokio::fs (P-2) | S | None |
| Gate Git API with path validation + permissions (S-4) | M | None |
| Add canonicalization to `isPathAllowed` (S-2) | M | S-4 (shared pattern) |
| Add `validate_file_path` to 11 Rust commands (S-3) | S | None |
| Add permission check for `backend.call` (S-10) | S | None |
| Remove `blob:` from CSP script-src (S-6) | S | None |
| Add credential patterns to .gitignore (S-8) | S | None |
| Memo-wrap FileGrid + extract static styles (P-3, P-4) | S | None |
| Wrap `get_directory_sizes` in spawn_blocking (P-6) | S | P-1 (same pattern) |

**Estimated effort:** 2-3 dev-weeks
**Exit criteria:** 0 P0, all security P1s addressed, no blocking-I/O in async commands.

### Phase 3: Test Coverage & Architecture (Week 7-16)

**Priority:** Build confidence through testing, consolidate architecture.

| Task | Effort | Dependencies |
|------|--------|--------------|
| Write tests for 9 P1 untested files | XL | Phase 2 |
| Write tests for MainLayout.tsx | L | Phase 2 |
| Create minimal e2e test suite or defer | L-XL | Phase 1 |
| Resolve SDK duplication (consolidate or remove) | XL | Phase 2 |
| Resolve security TODOs in sandbox code | L | S-1 research |
| Split extension-host.ts into registries | L | Tests written first |
| Split oversized TS files (10 files) | M | Tests written first |
| Split oversized Rust files (14 files, prioritize compression_ops) | L | Rust tests stable |
| Adopt AppError in high-traffic Rust modules | L | None |
| Parallelize search index rebuild (rayon + jwalk) | M | None |
| Upgrade vitest v2 -> v4 | M | Phase 1 |
| Add macOS runner to CI | S | None |
| Pin tauri-action version | S | None |
| Add cargo tests to release workflow | S | None |
| Improve i18n (fix 7 missing keys, add CI check) | S | None |

**Estimated effort:** 6-8 dev-weeks
**Exit criteria:** Frontend test coverage >=60%, all files under 1200 lines, SDK consolidated, vitest v4.

### Phase 4: Polish & Ecosystem (Week 17-26)

**Priority:** Extension ecosystem, developer experience, long-term health.

| Task | Effort | Dependencies |
|------|--------|--------------|
| Plan iframe sandbox migration (S-1) | L | Phase 3 |
| Reach 80% frontend test coverage | XL | Phase 3 |
| Tauri plugin grouping for command registration | L | Phase 3 |
| Extension publishing/signing documentation | M | Phase 2 (security) |
| End-to-end extension development tutorial | M | Phase 3 |
| Tauri command API documentation | L | Phase 3 |
| Platform-specific setup docs in CONTRIBUTING | S | None |
| Enable noUncheckedIndexedAccess | S | Phase 3 (tests) |
| Configure Dependabot/Renovate | S | None |
| Bundle optimization (manualChunks, analyzer) | S-M | None |
| Remaining P3 cleanup | S | None |

**Estimated effort:** 8-10 dev-weeks
**Exit criteria:** Extension docs published, 80% test coverage, iframe sandbox plan approved.

---

## 8. Risk Assessment

### Risks of Action

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| `xlsx` replacement breaks spreadsheet preview | Medium | Medium | Test all spreadsheet features before removing; keep xlsx as fallback behind feature flag during transition |
| `spawn_blocking` changes introduce subtle concurrency bugs | Medium | High | Add integration tests for file operations; test progress reporting still works; review error propagation |
| iframe sandbox migration breaks extensions | High | High | Build in parallel alongside existing sandbox; migrate one extension at a time; maintain backward compat layer |
| vitest v2->v4 upgrade breaks test infrastructure | Medium | Medium | Run full suite before/after; fix breaking changes incrementally |
| SDK consolidation requires touching 195 files | High | Low | Use codemod / find-and-replace; the API surface is identical |
| Enabling `noUncheckedIndexedAccess` surfaces many type errors | High | Low | Fix incrementally; adds real safety against array OOB bugs |

### Risks of Inaction

| Risk | Probability | Impact | Timeframe |
|------|-------------|--------|-----------|
| Extension exploits via ungated Git API or symlink bypass | High | Critical | Any time -- these are exploitable today by any installed extension |
| UI freezes during large file operations due to blocking I/O | Certain | High | Every user encounters this with large directories |
| `xlsx` CVE exploited via crafted spreadsheet file | Medium | High | Any time a user previews a malicious .xlsx |
| CI remains red, blocking all PR merges | Certain | High | Immediate -- 8 tests failing now |
| Test coverage stagnates, regressions accumulate | High | High | Compounds over 3-6 months as features are added without tests |
| SDK divergence causes silent bugs (frontend uses different API than SDK) | Medium | Medium | Gradual -- already diverged, will worsen |
| Extension marketplace launch blocked by missing docs and sandbox gaps | Certain | Medium | Blocks Horizon 3 entirely |
| vite CVE exploited during development (dev server path traversal) | Low | Medium | Only affects dev environment, but still a risk for contributors |

### Summary Risk Statement

The highest-consequence risk is **extension security**: three P1 vulnerabilities (Git API, symlink bypass, same-realm sandbox) are exploitable by any installed extension today. The highest-probability risk is **CI being red**: 8 failing tests on `next` means every PR is flying blind. Both demand immediate action in Phase 1 and Phase 2. The blocking-I/O problem is the most user-visible issue, causing freezes that affect every user with large directories. Together, these three themes -- security, stability, performance -- form the critical path through the roadmap.
