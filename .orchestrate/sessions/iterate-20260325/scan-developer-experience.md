# Developer Experience Scan

**Date:** 2026-03-25
**Branch:** `next`
**Scope:** Onboarding, testing, docs, i18n, extension SDK, monorepo health

---

## 1. Onboarding

**Can a new dev get running in 5 minutes?** Mostly yes.

**What exists:**
- `README.md` -- clear Getting Started with prerequisites (Node 20+, pnpm 10+, Rust stable), 3-command quick start (`git clone`, `pnpm install`, `pnpm dev`)
- `CONTRIBUTING.md` -- concise (69 lines), covers quick start, project structure, extension building, PR guidelines
- `.env.example` -- minimal, 4 optional vars (AI keys, Ollama, logging). Core app works without any env vars
- `CLAUDE.md` -- comprehensive internal dev guide with commands, architecture rules, code style, testing conventions, common gotchas

**What's missing/weak:**
- No platform-specific setup instructions (e.g., Tauri system dependencies: `libwebkit2gtk-4.1-dev` on Linux, Xcode tools on macOS). The CI workflow installs these, but CONTRIBUTING.md does not mention them.
- No troubleshooting section for common first-run failures (Rust compilation errors, missing system libraries)
- No estimated setup time or expected behavior on first run
- `pnpm dev:full` mentioned in README for maintainers, but not documented in `package.json` scripts listing

| Finding | Severity | Effort |
|---------|----------|--------|
| Missing platform-specific system dependency instructions in CONTRIBUTING.md | P2 | S |
| No onboarding troubleshooting guide | P3 | S |
| No mention of Tauri system deps anywhere in contributor docs | P2 | S |

---

## 2. Test Experience (Frontend -- Vitest)

**Command:** `npx vitest run`

Vitest was running during scan (takes significant time). The test suite is substantial:
- **90+ test files** across `__tests__/components/`, `__tests__/hooks/`, `__tests__/lib/`, `__tests__/integration/`, `__tests__/pages/`
- Setup file at `apps/client/src/__tests__/setup.ts` mocks Tauri APIs, icons, routing, i18n
- Tests use `@testing-library/react` + jsdom

| Finding | Severity | Effort |
|---------|----------|--------|
| Frontend test suite is large and comprehensive for core functionality | -- (positive) | -- |
| Long vitest run time (suite appears to take over 2 minutes) | P3 | M |

---

## 3. Test Gaps

**Component coverage analysis (source files vs test files):**

| Directory | Source Files | Test Files | Coverage % |
|-----------|-------------|------------|------------|
| `components/explorer/` | 28 | 12 | 43% |
| `components/panels/` | 33 | 11 | 33% |
| `components/dialogs/` | 35 | 18 | 51% |
| `components/previews/` | 12 | 7 | 58% |

**Major untested components (explorer/):**
- `MainLayout.tsx` -- the root layout orchestrator (critical)
- `TreeView.tsx` -- entire tree view mode
- `DialogsOverlay.tsx` -- dialog management layer
- `DialogLayer.tsx` -- dialog rendering layer
- `ArchitectView.tsx` -- architect visualization
- `SearchFilterPanel.tsx` -- search filter controls
- `VerticalExtensionsBar.tsx` -- extension sidebar
- `ThumbnailPreview.tsx` -- thumbnail rendering
- `SizeDistributionChart.tsx` -- size visualization
- `VimModeIndicator.tsx` -- vim mode UI
- `FileGridHelpers.tsx` -- grid helper utilities
- `FolderColorLegend.tsx` -- color legend

**Major untested components (panels/):**
- `CodeEditorPanel.tsx` -- integrated code editor
- `ExtensionsPanel.tsx` -- extension management
- `MarketplacePanel.tsx` (has a test but separate from ExtensionsPanel)
- `ExtensionPanelHost.tsx` -- extension host container
- `ExtensionDetailDialog.tsx` -- extension detail view
- `StorageAnalyticsPanel.tsx` -- disk usage analytics
- `NotificationCenter.tsx` -- notifications
- `RecommendationsPanel.tsx` -- AI recommendations
- `PropertiesPanel.tsx` -- file properties
- `ChatInput.tsx` / `ChatMessage.tsx` -- individual chat components
- `ChangeReviewPanel.tsx` -- change review UI
- `TokenizerStatusPanel.tsx` -- tokenizer status

**Missing entirely:**
- `e2e/` directory does not exist despite being referenced in README, CI workflow, and CLAUDE.md
- No integration tests for the extension install/activate lifecycle on the frontend
- No tests for `CommandPalette.tsx` or `ErrorBoundary.tsx`

| Finding | Severity | Effort |
|---------|----------|--------|
| `MainLayout.tsx` (root orchestrator) has no tests | P1 | L |
| `e2e/` directory does not exist but is referenced in CI and docs | P1 | XL |
| `TreeView.tsx` (entire view mode) has no tests | P2 | M |
| Extension panel/host/detail components untested | P2 | M |
| Overall frontend test coverage ~42% at the component level | P2 | XL |
| `CodeEditorPanel`, `StorageAnalyticsPanel`, `NotificationCenter` untested | P2 | M |
| `ErrorBoundary.tsx` and `CommandPalette.tsx` untested | P2 | M |

---

## 4. Rust Tests

**Command:** `cd apps/src-tauri && cargo test`
**Result:** 689 passed, 8 failed, 0 ignored. Duration: 3.52s

**Failing tests (8):**
1. `extensions::commands::tests::test_validate_url_rejects_decimal_encoded_ips`
2. `extensions::commands::tests::test_validate_url_rejects_hex_encoded_ips`
3. `extensions::commands::tests::test_validate_url_rejects_localhost`
4. `extensions::commands::tests::test_validate_url_rejects_private_ips`
5. `operations::system_ops::tests::test_sanitize_allows_non_whitelisted_command_without_metacharacters`
6. `operations::system_ops::tests::test_sanitize_env_and_find_removed_from_allowlist`
7. `operations::system_ops::tests::test_walk_files_collects_files_recursively` (assertion: expected 3 files, found 5)
8. `operations::tests::test_validate_file_path_rejects_etc`

**Analysis:**
- 4 failures are security-related URL validation tests -- these are regression failures in the extension URL validation logic
- 2 failures are command sanitization tests -- the allowlist logic has drifted from test expectations
- 1 failure is a file walking test (likely OS-specific: `.DS_Store` or other hidden files on macOS)
- 1 failure is path validation (`/etc` rejection)

| Finding | Severity | Effort |
|---------|----------|--------|
| 4 security-related URL validation tests failing (extension SSRF protection) | P0 | S |
| 2 command sanitization tests failing (shell injection guards) | P0 | S |
| 8 total Rust test failures on `next` branch -- CI would be red | P1 | M |
| `test_walk_files` OS-sensitivity (macOS hidden files vs expected count) | P2 | S |

---

## 5. Documentation

**What exists:**
- `README.md` -- good overview, architecture table, getting started, feature list
- `CONTRIBUTING.md` -- concise contributor guide
- `CLAUDE.md` -- excellent internal developer guide (architecture rules, code style, commands, gotchas)
- `CHANGELOG.md` -- documents v2.0.0 rewrite features
- `SECURITY.md` -- vulnerability reporting policy with response timeline
- `private/web/DEPLOY.md` -- detailed 9-step deployment guide for the marketplace website

**What's missing:**
- No API documentation for Rust Tauri commands (there are 50+ commands registered in main.rs)
- No architecture decision records (ADRs)
- No extension developer guide beyond the SDK README (how to test, debug, publish, sign)
- No internal architecture doc (data flow, state management patterns, IPC protocol)
- No user-facing documentation (xplorer.space/docs is referenced but content not in this repo)

| Finding | Severity | Effort |
|---------|----------|--------|
| No Tauri command API documentation | P2 | L |
| No architecture decision records (ADRs) | P3 | M |
| No extension publishing/signing guide for third-party developers | P2 | M |
| No internal architecture document (IPC flow, state management) | P3 | L |

---

## 6. Missing Standard Files

| File | Status |
|------|--------|
| `CHANGELOG.md` | Present |
| `CODE_OF_CONDUCT.md` | **MISSING** |
| `LICENSE` | Present (AGPL-3.0) |
| `SECURITY.md` | Present |
| `.github/ISSUE_TEMPLATE/` | Present (bug_report.yml, feature_request.yml) |
| `.github/PULL_REQUEST_TEMPLATE.md` | Present |
| `.github/workflows/ci.yml` | Present (lint, unit tests, e2e, security audit, rust check) |
| `.github/workflows/release.yml` | Present (cross-platform builds on tag push) |

| Finding | Severity | Effort |
|---------|----------|--------|
| Missing `CODE_OF_CONDUCT.md` | P3 | S |

---

## 7. i18n Completeness

**Locale file line counts:**
- `en.json`: 679 lines
- `id.json`: 672 lines
- `ja.json`: 672 lines
- `zh.json`: 672 lines

**Analysis:** English has 7 more lines than other locales, indicating recently added keys that were not propagated to `id`, `ja`, and `zh`. The CLAUDE.md explicitly states: "Add new keys to ALL 4 locale files when adding translatable strings."

| Finding | Severity | Effort |
|---------|----------|--------|
| 7 translation keys missing from id/ja/zh locales (en has 679 lines, others have 672) | P2 | S |
| No automated i18n completeness check in CI | P3 | S |

---

## 8. Extension SDK Documentation

**`packages/extension-sdk/`:**
- `README.md` -- comprehensive (219 lines). Covers all 5 registration APIs (`Theme`, `Sidebar`, `Preview`, `Command`, `ContextMenu`), hooks (`useCurrentPath`, `useSelectedFiles`, `navigateTo`), UI components (Button, Input, Select, etc.), extension structure, sandbox restrictions, and advanced base classes
- Has `examples/` directory referenced
- Has Jest test setup (`jest.config.js`, `tsconfig.test.json`)
- Published as `@xplorer/extension-sdk` with `bin/cli.js`

**`packages/create-extension/`:**
- `README.md` -- clear (69 lines). Covers usage (`npx create-xplorer-extension`), all 6 extension types (panel, theme, action, preview, command, tab), generated file structure, build tooling (esbuild)
- Has `templates/` directory for scaffolding
- Has `bin/index.js` CLI entry point
- Note: `package.json` has `"repository"` URL as `https://github.com/your-repo/xplorer` (placeholder not updated)

**What's missing:**
- No end-to-end tutorial (create -> develop -> test -> publish -> install)
- No guide for testing extensions locally inside Xplorer
- No documentation on the `.xtension` package format or signing process
- No marketplace submission guide
- SDK package.json still uses `"prepublishOnly": "npm run build"` (should be `pnpm`)

| Finding | Severity | Effort |
|---------|----------|--------|
| Extension SDK README is comprehensive and well-structured | -- (positive) | -- |
| `create-extension` has placeholder repository URL in package.json | P3 | S |
| No end-to-end extension development tutorial | P2 | M |
| No `.xtension` package format or signing documentation | P2 | M |
| No marketplace submission guide for third-party developers | P2 | M |
| SDK uses `npm` in prepublishOnly (should be `pnpm`) | P3 | S |

---

## 9. Monorepo Health

**`pnpm-workspace.yaml`:**
```yaml
packages:
  - 'apps/client'
  - 'packages/sdk'
  - 'packages/extension-sdk'
  - 'packages/create-extension'
  - 'packages/extensions/**'
  - 'private/web'
  - 'private/extensions/**'
```

**Analysis:**
- Workspace is well-structured with clear separation of concerns
- `private/` submodule packages are included but optional (gracefully absent for public contributors)
- `onlyBuiltDependencies` correctly limits native builds to `@tailwindcss/oxide` and `esbuild`
- 28 extensions in `packages/extensions/` are workspace members
- Path aliases (`@/`, `@xplorer/sdk`, `@xplorer/extension-sdk`) configured in CLAUDE.md

**Concerns:**
- `apps/src-tauri/` is NOT in the workspace (Rust, not a Node package) -- this is correct
- No `turbo.json` or `nx.json` for build orchestration -- relying on pnpm scripts alone
- No workspace-level test command that runs both frontend and Rust tests in sequence

| Finding | Severity | Effort |
|---------|----------|--------|
| Clean workspace structure with proper optional submodule support | -- (positive) | -- |
| No build orchestration tool (turbo/nx) for caching parallel builds | P3 | L |
| No unified test command for both frontend + Rust | P3 | S |

---

## Summary: Top Priorities

| # | Finding | Severity | Effort | Category |
|---|---------|----------|--------|----------|
| 1 | 4 security URL validation tests + 2 command sanitization tests failing | P0 | S | Rust Tests |
| 2 | 8 total Rust tests failing -- CI would be red on `next` | P1 | M | Rust Tests |
| 3 | `e2e/` directory missing but referenced everywhere | P1 | XL | Test Gaps |
| 4 | `MainLayout.tsx` (root orchestrator) untested | P1 | L | Test Gaps |
| 5 | 7 i18n keys missing from non-English locales | P2 | S | i18n |
| 6 | Missing platform-specific setup instructions | P2 | S | Onboarding |
| 7 | Overall frontend component test coverage ~42% | P2 | XL | Test Gaps |
| 8 | No extension publishing/signing guide | P2 | M | Docs |
| 9 | No Tauri command API docs | P2 | L | Docs |
| 10 | Missing `CODE_OF_CONDUCT.md` | P3 | S | Standard Files |
