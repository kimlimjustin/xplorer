# Xplorer Health Scorecard

**Date:** 2026-03-25
**Branch:** `next` (HEAD: `738125d`)
**Methodology:** Automated scan of 6 dimensions, scored per finding severity

---

## Scoring Formula

- Start at 100 per dimension
- P0: -15 | P1: -8 | P2: -3 | P3: -1
- Floor: 0

Overall = weighted average (Security 25%, Architecture 20%, Code Quality 20%, Performance 15%, Infrastructure 10%, Developer Experience 10%)

Grades: A = 90-100, B = 75-89, C = 60-74, D = 40-59, F = 0-39

---

## Dimension Scores

### Security

| Severity | Count | Deduction |
|----------|-------|-----------|
| P0 | 0 | 0 |
| P1 | 3 | -24 |
| P2 | 4 | -12 |
| P3 | 4 | -4 |

**Findings:**
- P1: Same-realm JS sandbox escapable (extension-sandbox.ts)
- P1: `isPathAllowed` no canonicalization -- symlink bypass (extension-host-types.ts)
- P1: Git API has no path/permission checks (extension-api-factory.ts)
- P2: 11 Rust commands missing `validate_file_path` (system_ops.rs, directory_ops.rs, metadata_ops.rs)
- P2: CSP allows `blob:` in script-src (tauri.conf.json)
- P2: `.gitignore` missing key/credential patterns
- P2: `backend.call` has no permission check (extension-api-factory.ts)
- P3: Docker ops unsanitized container IDs (docker_ops.rs)
- P3: Asset protocol scope covers entire filesystem (tauri.conf.json)
- P3: SQL `is_read_only_query` allows PRAGMA/WITH writes (database_ops.rs)
- P3: Terminal allowlist enables sensitive file reads (system_ops.rs)

**Score: 60 (C)**

---

### Architecture

| Severity | Count | Deduction |
|----------|-------|-----------|
| P0 | 0 | 0 |
| P1 | 2 | -16 |
| P2 | 7 | -21 |
| P3 | 2 | -2 |

**Findings:**
- P1: main.rs registers 382 commands in one macro block
- P1: SDK package (`@xplorer/sdk`) is dead -- bypassed by all 195 consumers
- P2: TauriAPI static class is 310-line delegation boilerplate
- P2: extension-host.ts is 1,550 lines with 15+ registries
- P2: 11 TypeScript files exceed 1,000-line limit (overlap with code quality, counted once here for arch impact)
- P2: 2 hardcoded localStorage keys outside STORAGE_KEYS
- P2: Flat 25-module lib.rs + 2 dead facade modules
- P2: compression_ops.rs at 2,242 lines
- P2: AppError/AppResult defined but unused -- 118 commands use raw String errors
- P3: context-menu-factory.ts at 1,162 lines (acceptable for context menus)
- P3: No localStorage abstraction layer (60+ callsites)

Note: Extension system coupling (P2, XL effort) overlaps with the extension-host.ts finding and is not double-counted.

**Score: 61 (C)**

---

### Code Quality

| Severity | Count | Deduction |
|----------|-------|-----------|
| P0 | 0 | 0 |
| P1 | 11 | -88 |
| P2 | 41 | -123 |
| P3 | 31 | -31 |

**Breakdown:**

*P1 (11 findings):* 9 critical untested files (CommandPalette, HomePage, use-xplorer-actions, use-file-operations, use-xplorer-effects, extension-lifecycle, extension-sandbox, extension-api-factory, context-menu-factory) + 2 security TODOs in sandbox code

*P2 (41 findings):* 10 oversized TS files + 14 oversized Rust files + 17 untested files with P2 severity (QuickLookOverlay, TokenizerSettings, command-palette-helpers, KeyboardShortcutsSettings, TrashPage, gdrive-accounts, use-dialogs, use-chat-file, use-chat-state, use-shortcuts, use-chat, use-search-tokens, use-smart-view, ai-service, extension-sandbox-env, agent-service, extension-permissions)

*P3 (31 findings):* 1 types-only large file + 6 silent catch blocks + 1 function keyword + 2 SystemTime unwrap + 21 untested files with P3 severity

**Note:** The score bottoms out at 0 because the scan counted every untested file individually. The codebase has zero `any` types, zero `console.log` violations, zero `var` usage, zero bare mutex unwraps, and zero dead exports -- discipline is strong, but test coverage is the dominant gap.

**Score: 0 (F)**

---

### Performance

| Severity | Count | Deduction |
|----------|-------|-----------|
| P0 | 2 | -30 |
| P1 | 4 | -32 |
| P2 | 6 | -18 |
| P3 | 4 | -4 |

**Findings (post-optimization scan -- excludes items fixed in 5b8da0e/738125d):**
- P0: 12 file_ops commands do blocking `std::fs` on async runtime (no `spawn_blocking`)
- P0: Google Drive commands do sync FS on async runtime
- P1: FileGrid not memoized (733 lines, 20+ props)
- P1: Inline style objects created on every render in FileGrid
- P1: Search index rebuild is single-threaded sequential
- P1: `get_directory_sizes()` blocks async runtime with WalkDir
- P2: O(n^2) synonym dedup in search via `Vec::contains`
- P2: Linear scan for bitmap metadata-only search results
- P2: Missing manualChunks for i18next, dompurify in Vite config
- P2: 5 oversized components (>1000 LOC) risk poor memoization
- P2: SmartSearch re-creates pure functions on every render
- P2: Backup operations block async runtime
- P3: allFiles array prop passed to every FileGridItem
- P3: Tags effect re-runs on every files reference change
- P3: Search WalkDir uses walkdir instead of jwalk
- P3: PaneTabBar (866 lines) not memoized

**Score: 16 (F)**

---

### Infrastructure

| Severity | Count | Deduction |
|----------|-------|-----------|
| P0 | 1 | -15 |
| P1 | 4 | -32 |
| P2 | 11 | -33 |
| P3 | 6 | -6 |

**RESOLVED (not counted):**
- ~~I-1 (P0): Tauri build broken -- WASM_RUNTIME module missing~~ -- `wasm_runtime.rs` now exists, `cargo check` passes

**Remaining P0:**
- `xlsx` has two HIGH CVEs with NO npm-resolvable fix -- must replace library

**Remaining P1 (4):**
- pnpm audit `continue-on-error: true` -- HIGH JS vulns never block CI
- `vite` <=5.4.19 path-traversal bypass -- needs upgrade
- `mammoth` > `underscore` HIGH DoS -- needs update to >=1.12
- Pre-commit hook has no typecheck (`tsc --noEmit`)

**Remaining P2 (11):**
- No macOS runner in CI
- `tauri-apps/tauri-action@v0` unpinned in release
- Release workflow skips cargo tests
- No Dependabot/Renovate configured
- vitest v2 drags in HIGH-severity transitive deps
- lint script excludes packages/sdk, extension-sdk, e2e
- `noUncheckedIndexedAccess` not enabled in tsconfig
- Test files excluded from tsconfig
- No pre-push hook
- Clippy not enforced locally
- PDF.js chunk 762 kB -- confirm lazy-loaded

**Remaining P3 (6):**
- Deprecated @types/diff, @types/dompurify
- E2E tests chromium-only
- cargo-audit no caching in CI
- No .clippy.toml
- No bundle analyzer
- `check` script no explicit `--noEmit`

**Score: 14 (F)**

---

### Developer Experience

| Severity | Count | Deduction |
|----------|-------|-----------|
| P0 | 2 | -30 |
| P1 | 3 | -24 |
| P2 | 15 | -45 |
| P3 | 9 | -9 |

**P0 (2):** 4 security URL validation tests failing + 2 command sanitization tests failing (Rust tests red on `next` branch)

**P1 (3):** 8 total Rust test failures blocking CI, MainLayout.tsx untested, e2e/ directory missing but referenced

**P2 (15):** Missing platform-specific setup docs (2), test gaps in explorer/panel components (5), documentation gaps (3), i18n incomplete (1), OS-specific test failure (1), extension SDK docs (3)

**P3 (9):** Troubleshooting guide, ADRs, CODE_OF_CONDUCT.md, i18n CI check, create-extension placeholder URL, SDK npm->pnpm, turbo/nx, unified test command, vitest run time

**Score: 0 (F)**

---

## Overall Scorecard

| Dimension | Weight | Score | Grade | Weighted |
|-----------|--------|-------|-------|----------|
| Security | 25% | 60 | C | 15.00 |
| Architecture | 20% | 61 | C | 12.20 |
| Code Quality | 20% | 0 | F | 0.00 |
| Performance | 15% | 16 | F | 2.40 |
| Infrastructure | 10% | 14 | F | 1.40 |
| Developer Experience | 10% | 0 | F | 0.00 |
| **Overall** | **100%** | **31** | **F** | **31.00** |

---

## Score Interpretation

The F grade reflects a mathematically honest application of the formula. Key context:

**What the score captures well:**
- Significant test coverage gaps (47+ untested files, 8 failing Rust tests, no e2e)
- Blocking async runtime with sync FS in 14+ Rust commands
- Real security gaps in extension system (sandbox, path validation, git API)
- Vulnerable dependency (`xlsx`) with no fix available

**What the score overstates:**
- Code discipline is actually excellent: zero `any`, zero `console.log`, zero bare mutex unwraps, zero `var`, zero dead exports
- The codebase has 90+ test files and 689 passing Rust tests -- coverage is partial, not absent
- Architecture is well-structured (no circular deps, clean module boundaries, good context usage)
- Recent commits show active improvement trajectory (security hardening, perf optimization, refactoring)

**The dominant failure mode is breadth of untested code, not depth of defects.** The codebase is well-engineered but undertested, with security hardening of the extension system still in progress.
