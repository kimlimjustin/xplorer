# Infrastructure & DevOps Scan Report

**Date**: 2026-03-23
**Scanner**: Infrastructure & DevOps
**Session**: iterate-20260323-231002

---

## Summary

**Total findings**: 14 (0 P0, 4 P1, 6 P2, 4 P3)

The CI/CD pipeline is well-structured with good parallelism and caching. The main gaps are around dependency update automation, missing `.env.example`, and some CI/CD hardening.

---

## 1. CI/CD Pipeline Audit

### Strengths
- **Well-structured CI** (`.github/workflows/ci.yml`): 4 parallel jobs — lint+typecheck, unit tests, E2E (after unit), Rust check+clippy+fmt+test
- **Good concurrency control**: `cancel-in-progress: true` prevents wasted runners
- **Proper caching**: pnpm cache via `setup-node`, Rust cache via `Swatinem/rust-cache@v2`
- **Release pipeline** (`.github/workflows/release.yml`): Multi-platform builds (Linux, Windows, macOS) with CI gates
- **Artifact uploads**: Test results and E2E screenshots preserved

### INFRA-001: No dependency update automation
- **File**: `.github/` (missing `dependabot.yml` or `renovate.json`)
- **Severity**: P1
- **Impact**: Dependencies go stale silently. 19 packages currently outdated. 2 `@types` packages deprecated (`@types/diff`, `@types/dompurify`).
- **Effort**: S
- **Fix**: Add `dependabot.yml` with weekly updates for npm and cargo, grouped by ecosystem.

### INFRA-002: No security scanning in CI
- **File**: `.github/workflows/ci.yml`
- **Severity**: P1
- **Impact**: Known vulnerabilities in dependencies won't be caught until manual audit. No SAST/DAST integration.
- **Effort**: S
- **Fix**: Add `pnpm audit --audit-level=high` and `cargo audit` steps. Consider GitHub's built-in CodeQL for SAST.

### INFRA-003: E2E tests only run on ubuntu-latest
- **File**: `.github/workflows/ci.yml:76-112`
- **Severity**: P2
- **Impact**: This is a cross-platform desktop app. E2E tests only validate Linux behavior. macOS and Windows regressions go undetected.
- **Effort**: M
- **Fix**: Add matrix strategy for E2E tests on macOS and Windows runners.

### INFRA-004: Release pipeline duplicates CI checks
- **File**: `.github/workflows/release.yml:13-98`
- **Severity**: P3
- **Impact**: Release runs lint, typecheck, unit tests, and Rust checks again despite being triggered by a tag (which should already be on a CI-verified commit). Adds ~5 min to release.
- **Effort**: S
- **Fix**: Gate release on the CI workflow passing for the same commit instead of re-running checks.

---

## 2. Dependency Management

### INFRA-005: Deprecated @types packages
- **File**: `package.json:87-88`
- **Severity**: P2
- **Impact**: `@types/diff` and `@types/dompurify` are deprecated — the libraries now ship their own types. Using deprecated types risks type mismatches.
- **Effort**: S
- **Fix**: Remove both packages. `diff@8` and `dompurify@3` include built-in types.

### INFRA-006: TypeScript pinned to 5.6.3 while other deps use ranges
- **File**: `package.json:114`
- **Severity**: P3
- **Impact**: Minor inconsistency. Pinned TS means manual updates but stable builds. Not a problem per se, but latest is 5.8.x with performance improvements.
- **Effort**: S
- **Fix**: Consider updating to `~5.8` for latest features/perf while staying on the minor.

### INFRA-007: 19 outdated npm packages
- **File**: `package.json` (various)
- **Severity**: P2
- **Impact**: Includes security-relevant packages like `dompurify` (3.3.1 → 3.3.3), `@tanstack/react-query` (5.85 → 5.95), `pdfjs-dist` major update. Most are minor/patch updates.
- **Effort**: M
- **Fix**: Batch update with `pnpm update`. Test after updating.

---

## 3. Development Tooling

### Strengths
- **Husky + lint-staged**: Pre-commit hooks run Prettier and ESLint on staged files
- **Comprehensive scripts**: dev, build, test, lint, format, typecheck all present
- **Path aliases**: Clean `@/` and `@xplorer/*` aliases configured in both tsconfig and vite
- **Strict TypeScript**: `strict: true` in tsconfig
- **Vitest configured**: jsdom environment, setup files, proper includes

### INFRA-008: No `.env.example` file
- **File**: Project root (missing)
- **Severity**: P1
- **Impact**: New developers don't know which environment variables are needed. The app uses `dotenvy::dotenv()` in main.rs and references `CLAUDE_API_KEY`, `OPENAI_API_KEY`, Ollama settings in AI modules.
- **Effort**: S
- **Fix**: Create `.env.example` documenting all optional env vars with comments.

### INFRA-009: No `.editorconfig`
- **File**: Project root (missing)
- **Severity**: P3
- **Impact**: Minor — Prettier handles most formatting. But editors without Prettier integration may use wrong indent/charset settings.
- **Effort**: S
- **Fix**: Add standard `.editorconfig` matching Prettier config.

### INFRA-010: No PR or issue templates
- **File**: `.github/` (missing `PULL_REQUEST_TEMPLATE.md`, `ISSUE_TEMPLATE/`)
- **Severity**: P2
- **Impact**: PRs and issues lack consistent structure. For an open-source project, templates help contributors provide necessary info.
- **Effort**: S
- **Fix**: Add PR template with checklist (tests, lint, description) and issue templates for bugs/features.

---

## 4. Build System

### Strengths
- **Good Vite config**: Manual chunks for vendor splitting (syntax-highlighter, icons, tauri, tanstack, radix)
- **Fixed port**: Tauri expects `127.0.0.1:5174`, properly configured with `strictPort: true`
- **Asset handling**: PDF worker and WASM files handled correctly
- **Incremental TS**: `incremental: true` with `.tsbuildinfo`

### INFRA-011: No build size tracking
- **File**: Vite config / CI
- **Severity**: P2
- **Impact**: Bundle size regressions go unnoticed. With react-syntax-highlighter, pdfjs-dist, xlsx in the bundle, size can creep up.
- **Effort**: M
- **Fix**: Add `vite-plugin-bundle-analyzer` or `bundlesize` CI check with size budgets.

---

## 5. Monitoring and Observability

### Strengths
- **Rust tracing**: Structured logging with `tracing` + `tracing-subscriber` with env filter
- **Log levels**: Proper `warn!()` macro usage

### INFRA-012: No error tracking service integration
- **File**: Throughout
- **Severity**: P1
- **Impact**: Production crashes and errors are invisible to the developer. No Sentry, Bugsnag, or equivalent crash reporting for the desktop app.
- **Effort**: L
- **Fix**: Integrate Sentry for Tauri (sentry-rust + @sentry/browser) or use Tauri's plugin-log with crash reporting.

### INFRA-013: No frontend structured logging
- **File**: `apps/client/src/`
- **Severity**: P2
- **Impact**: Frontend uses only `console.warn()` and `console.error()` (per CLAUDE.md rules). No structured log collection, no way to diagnose user-reported issues.
- **Effort**: M
- **Fix**: Add a thin logging facade that captures structured events and optionally ships them to a backend/file.

### INFRA-014: No health check or telemetry
- **File**: Throughout
- **Severity**: P3
- **Impact**: No way to know if the app is working correctly in production. No opt-in telemetry to understand usage patterns.
- **Effort**: L
- **Fix**: Consider opt-in anonymous telemetry (crash reports, feature usage) with clear user consent.

---

## Infrastructure Maturity Matrix

| Area | Maturity | Notes |
|------|----------|-------|
| CI/CD | **Good** | 4-job pipeline, caching, concurrency control |
| Release | **Good** | Multi-platform builds, draft releases |
| Linting | **Excellent** | TS + Rust, pre-commit hooks, CI enforcement |
| Testing | **Good** | Vitest + Playwright + cargo test, but Linux-only E2E |
| Dependency Mgmt | **Needs Work** | No automation, 19 outdated, 2 deprecated |
| Dev Tooling | **Good** | Most tools present, missing .env.example |
| Monitoring | **Poor** | No error tracking, no crash reporting |
| Security Scanning | **Missing** | No audit in CI, no SAST/DAST |
