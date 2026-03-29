# Xplorer Health Scorecard

**Date**: 2026-03-23
**Branch**: `next`
**Codebase**: ~234K LOC (622 TS/TSX + 113 RS files)

---

## Health Scorecard

| Dimension | Score | Grade | P0 | P1 | P2 | P3 | Total |
|-----------|-------|-------|----|----|----|----|-------|
| Code Quality | 0 | F | 2 | 5 | 13 | 4 | 24 |
| Architecture | 62 | C | 0 | 2 | 6 | 4 | 12 |
| Infrastructure | 46 | D | 0 | 4 | 6 | 4 | 14 |
| Security | 0 | F | 3 | 5 | 6 | 4 | 18 |
| Performance | 0 | F | 3 | 7 | 9 | 7 | 26 |
| Developer Experience | 19 | F | 1 | 5 | 8 | 2 | 16 |
| **Overall** | **19** | **F** | **9** | **28** | **48** | **25** | **110** |

### Scoring Formula Applied
- Start at 100 per dimension
- P0: -15 each, P1: -8 each, P2: -3 each, P3: -1 each
- Minimum: 0
- Overall: weighted average (Security 25%, Architecture 20%, Code Quality 20%, Performance 15%, Infrastructure 10%, DX 10%)

### Grading Scale
| Grade | Range | Meaning |
|-------|-------|---------|
| A | 90-100 | Excellent |
| B | 75-89 | Good |
| C | 60-74 | Adequate |
| D | 40-59 | Poor |
| F | 0-39 | Critical |

---

## Context for the Scores

**These scores reflect the quantity and severity of findings, NOT the overall quality of the project.** Xplorer is an ambitious, feature-rich desktop file manager with a massive surface area (380 Tauri commands, 25+ extensions, search engine, AI, git, cloud sync). The team shipped a working product with good architectural foundations. The low scores indicate accumulated technical debt from rapid feature development — not a fundamentally broken codebase.

**Key strengths not captured by the formula:**
- Clean dependency direction (no invoke() in components)
- TypeScript strict mode with only 1 `any` type
- Comprehensive CI pipeline (4 parallel jobs)
- Well-designed extension SDK
- Conventional commits
- Good test infrastructure on the frontend (90+ test files)
- Solid transport abstraction enabling future web deployment

---

## Top 9 P0 Findings (Must Fix)

| ID | Dimension | Finding | Effort |
|----|-----------|---------|--------|
| SEC-P0-1 | Security | WASM `host_read_file` has no path scoping — any extension can read any file | M |
| SEC-P0-2 | Security | `sanitize_command` allows arbitrary command execution (allowlist bypassed) | S |
| SEC-P0-3 | Security | Markdown preview extension XSS via `dangerouslySetInnerHTML` | S |
| CQ-P0-1 | Code Quality | Two diverging `createExtensionApi` implementations (security-critical) | L |
| CQ-P0-2 | Code Quality | Sandbox proxy code duplicated between extension-host and extension-sandbox | M |
| PERF-P0-1 | Performance | Blocking I/O in async Tauri commands freezes UI for large directories | M |
| PERF-P0-2 | Performance | Blocking I/O in metadata/properties commands | S |
| PERF-P0-3 | Performance | O(N*M) algorithm in search incremental update (2.5B string comparisons at 50K files) | S |
| DX-P0-1 | Developer Experience | 544 bare `.unwrap()` calls across 33 Rust files — each is a potential crash | XL |

---

## Dimension Breakdown

### Security (0/F) — Weight: 25%
3 exploitable vulnerabilities, 5 significant risks. The WASM file read bypass and broken command sanitizer are the most critical. The extension sandbox can be escaped via `import()`. Frontend permission checks have no backend enforcement.

### Code Quality (0/F) — Weight: 20%
Duplicated security-critical code (extension API exists in 2 diverging copies), 16+ files over the 1000-line limit, 6 copies of `formatFileSize`, two parallel extension loading systems (5700+ lines, ~2500 redundant).

### Architecture (62/C) — Weight: 20%
Best-scoring dimension. Clean dependency direction and good transport abstraction. Main issues: dead SDK layer (1 consumer vs 194 for TauriAPI), copy-pasted types between SDK and client, duplicate Rust modules (git, watchers), monolithic 380-command invoke_handler.

### Performance (0/F) — Weight: 15%
3 critical blocking I/O patterns that freeze the UI, O(N*M) search algorithm, redundant per-file work in directory operations, search index clones all data on save.

### Infrastructure (46/D) — Weight: 10%
Solid CI/CD pipeline, but no dependency update automation (19 packages outdated), no security scanning in CI, no error/crash tracking, no `.env.example`, E2E tests are vacuously passing (empty directory).

### Developer Experience (19/F) — Weight: 10%
Good foundations (CLAUDE.md, 3-command setup, clean organization), but 544 bare unwraps risk production crashes, shallow Rust tests, missing SECURITY.md, no Dependabot, unresolved security TODOs.
