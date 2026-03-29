# Xplorer Codebase Improvement Roadmap

## Executive Summary

The Xplorer codebase is in **good health** overall. Security is solid (DOMPurify, no XSS, no hardcoded secrets), architecture is clean (SDK facade pattern respected, Tauri v2 imports correct), and there's decent test coverage (103 test files). CI/CD pipeline is comprehensive.

The main areas needing attention are **file size violations** (12 files over 1000 lines) and **scattered error handling** (empty catches, unhandled promises).

## Project Strengths

- Proper DOMPurify sanitization on all dangerouslySetInnerHTML
- No eval(), no XSS vectors, no hardcoded secrets
- Clean SDK facade — no direct invoke() from components
- Correct Tauri v2 imports throughout
- 103 test files with good module coverage
- Comprehensive CI/CD (lint, typecheck, unit tests, E2E, Rust checks)
- Modern dependencies (React 18.3, TypeScript 5.6, Tauri 2.10, Vite 5.4)
- Proper Mutex guard pattern in Rust (with one exception)

---

## Quick Wins (< 1 hour, high impact)

| # | Item | Effort | Impact | Files |
|---|------|--------|--------|-------|
| Q1 | Fix Rust mutex poisoning risk in `watcher.rs:616` | S | High | 1 |
| Q2 | Fix empty catch blocks (5 instances) | S | Medium | 5 |
| Q3 | Add .catch() to unhandled promise chains (6 instances) | S | Medium | 5 |
| Q4 | Fix single `any` type in `tauri-api.ts:970` | S | Low | 1 |
| Q5 | Convert `function` keyword in React.memo to arrow functions (10 instances) | S | Low | 6 |

---

## Detailed Roadmap

### P0 — Critical (Fix Now)

*No P0 issues found. The codebase has no critical security vulnerabilities or blocking bugs.*

### P1 — Important (Next Sprint)

| # | Item | Effort | Impact | Category |
|---|------|--------|--------|----------|
| 1 | **Split 12 files exceeding 1000-line limit** | L | High | Code Quality |
|   | tauri-api.ts (1793), extension-host.ts (1685), settings.tsx (1666), UndoHistoryPanel.tsx (1450), LeftSidebar.tsx (1438), PerformanceDashboard.tsx (1286), SearchResultsPanel.tsx (1285), BulkRenameDialog.tsx (1268), extension-sandbox.ts (1251), FileComparisonPage.tsx (1249), ExtensionPermissionDialog.tsx (1241), extension-lifecycle.ts (1173) | | |
| 2 | **Add tests for Architect feature** | M | Medium | Testing |
|   | ArchitectView, ArchitectCanvas, ArchitectNode, ArchitectSidebarTree, use-architect-scanner — all untested | | |
| 3 | **Consolidate localStorage access** | M | Medium | Architecture |
|   | 30+ files access localStorage directly instead of through centralized hooks. Create a unified storage service. | | |

### P2 — Nice to Have (Backlog)

| # | Item | Effort | Impact | Category |
|---|------|--------|--------|----------|
| 4 | **Environment-variable driven URLs** | S | Low | Infrastructure |
|   | Replace hardcoded localhost URLs (marketplace API, Ollama endpoint, transport API) with env vars | | |
| 5 | **Improve type safety on `unknown` casts** | M | Low | Code Quality |
|   | 7+ instances of `as unknown` could use proper type narrowing or generics | | |
| 6 | **Safe Rust regex compilation** | S | Low | Code Quality |
|   | Replace `.unwrap()` on regex in document_extractor.rs with `lazy_static!` or `OnceCell` | | |

### P3 — Future

| # | Item | Effort | Impact | Category |
|---|------|--------|--------|----------|
| 7 | **Extension theme standardization** | M | Medium | Architecture |
|   | Create a theme variable contract that all extension themes must implement (prevent the --xp-bg-gradient bug class) | | |
| 8 | **Extension hot-reload for development** | L | Medium | DX |
|   | Currently must rebuild + copy to install dir. Add a dev mode that loads from source path. | | |

---

## Metrics Summary

| Metric | Count |
|--------|-------|
| Files over 1000 lines | 12 |
| Empty catch blocks | 5 |
| Unhandled promise chains | 6 |
| `function` keyword violations | 10+ |
| `any` type usage | 1 |
| Security issues | 0 |
| Test files | 103 |
| Total roadmap items | 8 |
| Quick wins | 5 |
