# Developer Experience & Future-Readiness Scan

**Project:** Xplorer (Tauri 2.x desktop file manager)
**Date:** 2026-03-23
**Branch:** `next`
**Codebase size:** ~387 TS/TSX frontend files, ~85 Rust source files, ~28 extensions

---

## Developer Happiness Score: 7.0 / 10

**Justification:** The codebase has solid foundations -- clear project structure, excellent CLAUDE.md for AI-assisted development, good test coverage on the frontend, a well-designed extension SDK, and clean separation between frontend/backend/SDK layers. However, several large files violate the stated 1000-line limit, Rust test coverage is shallow, there are no .env.example files to document required API keys, the e2e test directory is empty, and standard community health files (SECURITY.md, PR/issue templates, dependency automation) are missing. A new developer can get running quickly, but will likely hit confusion around API key setup and navigating the larger files.

---

## 1. Onboarding Friction

### F01 -- No .env.example anywhere in the project
- **File/Area:** Project root, `apps/src-tauri/`, `apps/client/`
- **Issue:** The Rust backend reads `CLAUDE_API_KEY`, `OPENAI_API_KEY` from environment variables (see `apps/src-tauri/src/ai.rs` lines 92, 471, 575, 634) and has a hardcoded Ollama base URL (`apps/src-tauri/src/search/ollama_client.rs:13`). There is no `.env.example` file in the root or in `apps/src-tauri/` documenting these variables. The only `.env.example` is inside `private/web/`, which is a private submodule most contributors won't have.
- **Why it matters:** New developers will not know what environment variables to set for AI features to work. They will discover missing keys only at runtime through cryptic errors.
- **Severity:** P1
- **Effort:** S (Small)
- **Suggested approach:** Create `apps/src-tauri/.env.example` listing all optional env vars with comments: `CLAUDE_API_KEY=`, `OPENAI_API_KEY=`, `RUST_LOG=xplorer=info,warn`. Also add a root `.env.example` if any frontend env vars exist. Reference this file from README.md and CONTRIBUTING.md.

### F02 -- README says Node.js 22+ but CI uses Node 20
- **File/Area:** `README.md` (line 56), `CONTRIBUTING.md` (line 9), `.github/workflows/ci.yml` (line 17: `NODE_VERSION: '20'`)
- **Issue:** The README and CONTRIBUTING.md say "Node.js 22+" is required, but CI uses Node 20. `package.json` says `engines.node >= 18`. Three conflicting statements.
- **Why it matters:** New developer installs Node 22 per docs, but build might have different behavior than CI. Or they install Node 20 per CI and wonder if docs are outdated.
- **Severity:** P2
- **Effort:** S
- **Suggested approach:** Align all three sources. Pick one version (recommend Node 20 LTS since that's what CI uses) and update README, CONTRIBUTING.md, and `package.json` engines field to match.

### F03 -- Quick onboarding path is solid
- **File/Area:** `README.md`, `CONTRIBUTING.md`
- **Issue:** This is a **positive finding**. The three-command setup (`git clone`, `pnpm install`, `pnpm dev`) is clean and well-documented. The private submodule is clearly marked as optional. Time-to-running is estimated at ~5 minutes (depending on Rust compile time).
- **Why it matters:** Good first impression for contributors.
- **Severity:** N/A (positive)
- **Effort:** N/A
- **Suggested approach:** Keep maintaining this. Consider adding expected compile times and system dependency notes for Linux (already in CI: `libwebkit2gtk-4.1-dev` etc.) to CONTRIBUTING.md.

---

## 2. Documentation Audit

### F04 -- CLAUDE.md is exceptionally well-structured
- **File/Area:** `/CLAUDE.md`
- **Issue:** **Positive finding.** Covers project structure, commands, architecture rules, code style, i18n, styling, Rust conventions, testing, commits, and common gotchas. This is one of the better AI coding assistant instruction files observed.
- **Why it matters:** Enables consistent AI-assisted development and serves as an effective developer handbook.
- **Severity:** N/A (positive)
- **Effort:** N/A
- **Suggested approach:** Keep it updated as the codebase evolves.

### F05 -- Inline documentation is sparse in Rust command files
- **File/Area:** `apps/src-tauri/src/operations/file_ops.rs` (1447 lines, 0 doc comments), `apps/src-tauri/src/operations/compression_ops.rs` (2242 lines, 1 doc comment)
- **Issue:** The `file_ops.rs` module has zero `///` doc comments across 1447 lines. `compression_ops.rs` has 1 doc comment across 2242 lines. These are core modules containing Tauri commands that form the app's API surface. Overall, across 47,820 lines of Rust, there are only 630 doc comment lines (~1.3%).
- **Why it matters:** Tauri `#[command]` functions are the IPC API boundary. Without doc comments, a new developer must read full function bodies to understand parameters, return types, and error conditions. This slows onboarding and increases the risk of incorrect usage.
- **Severity:** P2
- **Effort:** L (Large -- many files to document)
- **Suggested approach:** Prioritize doc comments on all `#[command]` functions first, since they form the public API. Use `cargo doc` to verify documentation builds. A phased approach: start with `file_ops.rs`, `compression_ops.rs`, and `system_ops.rs`.

### F06 -- Extension SDK API has good documentation
- **File/Area:** `packages/extension-sdk/src/api/index.ts`, `packages/create-extension/README.md`
- **Issue:** **Positive finding.** The extension SDK entry point has JSDoc with examples. The `create-extension` scaffolder README clearly explains extension types, what gets generated, and development workflow. The SDK exports are well-organized with section comments.
- **Why it matters:** Extension developers can be productive quickly.
- **Severity:** N/A (positive)
- **Effort:** N/A
- **Suggested approach:** Consider adding a more comprehensive "Extension Developer Guide" with common patterns and debugging tips.

### F07 -- No architecture decision records (ADRs)
- **File/Area:** Project root
- **Issue:** There are no ADR files documenting key architectural decisions (e.g., why wouter over react-router, why localStorage over Zustand, why the extension sandbox model was chosen, why `chrono` over `time` crate).
- **Why it matters:** As the team grows, people will question or re-litigate past decisions without understanding the context. ADRs prevent repeated discussions and preserve institutional knowledge.
- **Severity:** P3
- **Effort:** M
- **Suggested approach:** Create a `docs/adr/` directory. Start with 3-5 ADRs for the most impactful decisions. Use a lightweight template (title, status, context, decision, consequences).

---

## 3. Testing Experience

### F08 -- Frontend test coverage is broad and well-structured
- **File/Area:** `apps/client/src/__tests__/`
- **Issue:** **Positive finding.** There are 90+ test files covering components, hooks, lib utilities, integration flows, and pages. Tests follow a consistent pattern: clear `describe`/`it` blocks, proper `beforeEach` cleanup, meaningful assertions. The test setup file (`setup.ts`) comprehensively mocks Tauri APIs, i18n, lucide-react icons, and wouter.
- **Why it matters:** Developers can confidently refactor with a safety net.
- **Severity:** N/A (positive)
- **Effort:** N/A
- **Suggested approach:** Continue the pattern. Consider adding test coverage reporting to CI.

### F09 -- Rust tests are shallow and formulaic
- **File/Area:** `apps/src-tauri/src/lib.rs` (lines 29-42), Rust test modules across 39 files
- **Issue:** The root `lib.rs` contains only trivial placeholder tests (`assert_eq!(2 + 2, 4)`, `assert!(test_string.contains("world"))`). While 39 Rust files have `#[cfg(test)]` modules, many contain only basic serialization/deserialization roundtrips. Critical code paths -- file operations, compression, search indexing, extension management -- have minimal or no integration-level tests.
- **Why it matters:** The Rust backend handles file operations, encryption, secure deletion, and search indexing -- all areas where bugs can cause data loss. Without meaningful tests, regressions are caught only at the integration/E2E level (which is also empty, see F10).
- **Severity:** P1
- **Effort:** XL (requires significant investment)
- **Suggested approach:** Prioritize tests for: (1) file_ops.rs copy/move/rename logic, (2) compression_ops.rs archive handling, (3) encryption_ops.rs encrypt/decrypt roundtrips, (4) search/index.rs indexing correctness. Use `tempdir` for filesystem tests. Set a target of 60%+ coverage on operations/ modules.

### F10 -- E2E test directory is empty
- **File/Area:** `e2e/` directory, `.github/workflows/ci.yml` (lines 80-123)
- **Issue:** The `e2e/` directory contains no test files (glob returned zero matches), yet the CI workflow has an entire E2E job that installs Playwright and runs `npx playwright test`. The `package.json` has `test:e2e` and `test:e2e:update` scripts.
- **Why it matters:** CI runs an E2E job that always passes vacuously (no tests = no failures). This gives false confidence. The infrastructure is ready but unused.
- **Severity:** P2
- **Effort:** L
- **Suggested approach:** Either add at least 5-10 critical path E2E tests (app launches, navigate folders, create/rename/delete file, search) or remove the E2E CI job to avoid the misleading green check. The Playwright infrastructure is already in place.

### F11 -- Test setup has a brittle icon mock pattern
- **File/Area:** `apps/client/src/__tests__/setup.ts` (lines 21-203)
- **Issue:** The lucide-react mock manually lists 160+ individual icon names. Every time a new icon is used in a component, the developer must remember to add it to this list, or tests fail with an unhelpful error. The CLAUDE.md documents this gotcha, but it's still a friction point.
- **Why it matters:** This is a recurring source of test failures that has nothing to do with actual code correctness. It slows development velocity.
- **Severity:** P2
- **Effort:** S
- **Suggested approach:** Replace the individual icon mocks with a Proxy-based approach that auto-generates mock icons for any name:
```ts
vi.mock('lucide-react', () => new Proxy({}, {
  get: (_target, name: string) => mockIcon(name),
}));
```
This eliminates the maintenance burden entirely.

---

## 4. Code Organization

### F12 -- Layer-based organization is consistent and navigable
- **File/Area:** `apps/client/src/` structure
- **Issue:** **Positive finding.** The frontend follows a clear convention: `components/` (by feature area: explorer, dialogs, panels, previews, settings, ui), `hooks/` (use-kebab-case), `lib/` (utilities and services), `pages/` (route-level components), `locales/`, `__tests__/` (mirroring source structure). You can generally find a feature's code within 30 seconds.
- **Why it matters:** Reduces cognitive load and onboarding time.
- **Severity:** N/A (positive)
- **Effort:** N/A
- **Suggested approach:** Maintain this structure. Consider co-locating tests next to source files (e.g., `hooks/use-toast.test.ts`) as the test count grows -- the current mirrored `__tests__/` structure is fine at this scale.

### F13 -- SDK service layer is well-separated
- **File/Area:** `packages/sdk/src/services/` (23 service files)
- **Issue:** **Positive finding.** The SDK cleanly wraps Tauri IPC calls into domain-specific service modules (FileSystem, Search, Storage, AI, Git, etc.). The `tauri-api.ts` facade in the client properly delegates to the SDK. This layering means changing IPC details doesn't ripple through components.
- **Why it matters:** Clean separation enables independent testing and future API changes.
- **Severity:** N/A (positive)
- **Effort:** N/A
- **Suggested approach:** Keep this pattern. Ensure new Tauri commands always go through the SDK.

### F14 -- Multiple files exceed the stated 1000-line limit
- **File/Area:**
  - `apps/client/src/lib/tauri-api.ts` -- 1802 lines
  - `apps/client/src/lib/extension-host.ts` -- 1751 lines
  - `apps/client/src/components/panels/UndoHistoryPanel.tsx` -- 1450 lines
  - `apps/client/src/components/panels/PerformanceDashboard.tsx` -- 1319 lines
  - `apps/client/src/lib/extension-sandbox.ts` -- 1293 lines
  - `apps/client/src/components/explorer/SearchResultsPanel.tsx` -- 1284 lines
  - `apps/client/src/components/dialogs/BulkRenameDialog.tsx` -- 1268 lines
  - `apps/client/src/components/dialogs/ExtensionPermissionDialog.tsx` -- 1241 lines
  - `apps/client/src/lib/extension-lifecycle.ts` -- 1174 lines
  - `apps/client/src/lib/context-menu-factory.ts` -- 1161 lines
  - `apps/client/src/lib/tauri-api-types.ts` -- 1140 lines (types file, acceptable)
  - Rust: `compression_ops.rs` (2242), `search/compat.rs` (2330), `file_ops.rs` (1447), `search/index.rs` (2036), `git_history.rs` (1347), `extensions/commands.rs` (1323)
- **Issue:** CLAUDE.md states "Files under 1000 lines. Extract hooks/helpers/sub-components when approaching limit." At least 10 TypeScript and 6 Rust files exceed this limit.
- **Why it matters:** Large files are harder to navigate, review, and maintain. They increase merge conflict likelihood and make code ownership unclear. The discrepancy between stated standards and actual code erodes trust in the conventions.
- **Severity:** P2
- **Effort:** L
- **Suggested approach:** Prioritize splitting the most-edited files. `tauri-api.ts` can be split by domain (file ops, search ops, git ops, etc.). `extension-host.ts` can extract registry logic into separate files. For Rust, `compression_ops.rs` and `search/compat.rs` are the worst offenders. Set up a CI lint check that warns on files exceeding 1000 lines.

### F15 -- Glob re-exports in Rust operations/mod.rs create a flat namespace
- **File/Area:** `apps/src-tauri/src/operations/mod.rs` (lines 23-41)
- **Issue:** The operations module uses `pub use file_ops::*; pub use directory_ops::*; pub use system_ops::*;` etc. for 16 modules. This creates a flat namespace where 200+ functions are re-exported at `operations::*`, making it hard to know which module a function originates from.
- **Why it matters:** IDE auto-imports and code navigation become less helpful. Name collisions become a risk as more operations are added.
- **Severity:** P3
- **Effort:** M
- **Suggested approach:** Consider removing the glob re-exports and using qualified imports (`operations::file_ops::copy_file`) or selective re-exports for the most commonly used items. This is a breaking change that should be done incrementally.

---

## 5. Future-Readiness

### F16 -- 544 bare `unwrap()` calls in Rust backend
- **File/Area:** `apps/src-tauri/src/` (across 33 files)
- **Issue:** There are 544 `.unwrap()` calls across the Rust codebase. While CLAUDE.md correctly warns about Mutex poisoning and prescribes `.lock().unwrap_or_else(|e| e.into_inner())`, the actual code has hundreds of bare unwraps on file I/O, JSON parsing, path operations, and more. Notable hot spots: `file_organizer.rs` (36), `duplicate_finder.rs` (36), `undo_redo_ops.rs` (34), `compression_ops.rs` (31), `encryption_ops.rs` (30), `file_ops.rs` (29).
- **Why it matters:** Each bare `unwrap()` is a potential panic that kills the Tauri process (and the app). On user machines with unusual file systems, permissions, or locale settings, these will surface as crashes rather than graceful error messages. This is the single biggest risk to production stability.
- **Severity:** P0
- **Effort:** XL
- **Suggested approach:** Run `cargo clippy -- -W clippy::unwrap_used` to get a full list. Prioritize replacing unwraps in: (1) file operation commands that users trigger directly, (2) extension loading code, (3) search indexing. Replace with `?` operator, `.unwrap_or_default()`, or `.map_err()` with user-facing error messages. Consider adding `#![deny(clippy::unwrap_used)]` to lib.rs once cleanup is complete.

### F17 -- Hardcoded Ollama URL limits deployment flexibility
- **File/Area:** `apps/src-tauri/src/search/ollama_client.rs` (line 13)
- **Issue:** `const OLLAMA_BASE_URL: &str = "http://localhost:11434";` is hardcoded. There is no way for users to configure a remote Ollama instance or change the port.
- **Why it matters:** Users running Ollama on a different machine, in Docker with a non-default port, or behind a reverse proxy cannot use the AI features without recompiling.
- **Severity:** P2
- **Effort:** S
- **Suggested approach:** Read from environment variable `OLLAMA_BASE_URL` with fallback to the current default: `env::var("OLLAMA_BASE_URL").unwrap_or_else(|_| "http://localhost:11434".to_string())`. Expose this in the settings UI.

### F18 -- Extension system is well-designed for growth
- **File/Area:** `packages/extension-sdk/`, `packages/create-extension/`, `apps/client/src/lib/extension-host.ts`
- **Issue:** **Positive finding.** The extension system supports 6 types (panel, theme, action, preview, command, tab), has a permission model, sandbox isolation, an event bus, and a scaffolding CLI. The SDK provides high-level `.register()` APIs and UI components. This is a solid foundation for a plugin ecosystem.
- **Why it matters:** Extensions are the primary growth vector for the open-core model. The architecture supports this well.
- **Severity:** N/A (positive)
- **Effort:** N/A
- **Suggested approach:** Consider adding extension versioning/compatibility checks and a published extension API stability guarantee.

### F19 -- No database migration strategy visible
- **File/Area:** `apps/src-tauri/src/storage/mod.rs`
- **Issue:** The storage layer uses file-based JSON storage (reading/writing JSON files). There is no migration framework or versioning for storage schema changes. If stored data format changes between releases, existing user data may become unreadable.
- **Why it matters:** As the app matures and user data accumulates, breaking storage format changes will cause data loss or require manual migration by users.
- **Severity:** P2
- **Effort:** M
- **Suggested approach:** Add a schema version field to stored JSON files. Implement a migration system that runs on startup, checking the stored version against the current version and applying transformations sequentially.

### F20 -- Constants file shows good practice for avoiding magic numbers
- **File/Area:** `apps/client/src/lib/constants.ts`
- **Issue:** **Positive finding.** Timing constants, layout constraints, file size thresholds, and search limits are centralized with descriptive names and comments. This makes tuning and reviewing limits straightforward.
- **Why it matters:** Avoids scattered magic numbers that become impossible to find and update.
- **Severity:** N/A (positive)
- **Effort:** N/A
- **Suggested approach:** Continue this practice. Consider moving Rust-side constants to a similar centralized module.

---

## 6. Missing Standard Practices

### F21 -- No SECURITY.md
- **File/Area:** Project root
- **Issue:** There is no `SECURITY.md` file. CONTRIBUTING.md mentions "Security issues: Email kimlimjustin@gmail.com directly" but this is easy to miss. GitHub's security advisory feature requires a SECURITY.md for proper vulnerability disclosure.
- **Why it matters:** Security researchers may publicly disclose vulnerabilities in GitHub issues instead of responsibly, because they cannot find the disclosure process.
- **Severity:** P1
- **Effort:** S
- **Suggested approach:** Create `SECURITY.md` with: supported versions, how to report (email + expected response time), what constitutes a security issue, and a PGP key or GitHub security advisory link.

### F22 -- No PR template or issue templates
- **File/Area:** `.github/` directory
- **Issue:** The `.github/` directory contains only `workflows/`. There are no `PULL_REQUEST_TEMPLATE.md`, `ISSUE_TEMPLATE/bug_report.yml`, or `ISSUE_TEMPLATE/feature_request.yml` files.
- **Why it matters:** Without templates, bug reports arrive with inconsistent information (no OS version, no steps to reproduce). PRs lack a checklist for testing, screenshots, and breaking changes. This wastes reviewer time.
- **Severity:** P2
- **Effort:** S
- **Suggested approach:** Create `.github/PULL_REQUEST_TEMPLATE.md` with sections: Summary, Changes, Test plan, Screenshots. Create `.github/ISSUE_TEMPLATE/bug_report.yml` and `feature_request.yml` with structured fields.

### F23 -- No Dependabot or Renovate configuration
- **File/Area:** `.github/`
- **Issue:** There is no `dependabot.yml` or `renovate.json` for automated dependency updates. The project has 40+ npm dependencies and a Rust `Cargo.toml` with numerous crates.
- **Why it matters:** Without automated dependency updates, security patches for transitive dependencies can sit unpatched for months. Rust crates with `unsafe` code and npm packages with known CVEs are particularly risky for a file manager that handles user files.
- **Severity:** P1
- **Effort:** S
- **Suggested approach:** Add `.github/dependabot.yml` covering both npm and Cargo ecosystems:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly }
    open-pull-requests-limit: 10
  - package-ecosystem: cargo
    directory: /apps/src-tauri
    schedule: { interval: weekly }
    open-pull-requests-limit: 5
```

### F24 -- Pre-commit hook is properly configured
- **File/Area:** `.husky/pre-commit`, `package.json` lint-staged config
- **Issue:** **Positive finding.** Husky runs `lint-staged` on pre-commit, which applies Prettier and ESLint to staged TypeScript/CSS files. This catches formatting and lint issues before they reach CI.
- **Why it matters:** Prevents noisy formatting-only commits and ensures consistent code style.
- **Severity:** N/A (positive)
- **Effort:** N/A
- **Suggested approach:** Consider adding `cargo fmt --check` and `cargo clippy` to pre-commit for Rust files.

### F25 -- CI pipeline is well-structured but missing Rust tests
- **File/Area:** `.github/workflows/ci.yml`
- **Issue:** **Mixed finding.** The CI has four jobs (lint+typecheck, unit tests, E2E tests, Rust check) with proper concurrency control and artifact uploads. However, the E2E job runs no actual tests (F10), and while the Rust job runs `cargo test`, the tests themselves are shallow (F09).
- **Why it matters:** The CI structure is ready for growth, but the actual test coverage leaves gaps.
- **Severity:** See F09, F10
- **Effort:** See F09, F10
- **Suggested approach:** Address F09 and F10 to make the CI pipeline meaningful.

### F26 -- Two unresolved SECURITY TODOs in extension sandbox
- **File/Area:** `apps/client/src/lib/extension-host.ts` (line 91), `apps/client/src/lib/extension-sandbox.ts` (line 408)
- **Issue:** Both files reference unresolved SECURITY TODOs related to defense-in-depth measures in `loadExtensionScript` and `executeSandboxed`. These are explicitly marked as security concerns.
- **Why it matters:** Security-related TODOs in a file manager that handles user files deserve attention. Extensions run user-supplied code, so sandbox escapes could lead to data exfiltration.
- **Severity:** P1
- **Effort:** M
- **Suggested approach:** Investigate and resolve both TODOs. Document the security model in a dedicated `docs/extension-security.md`. Consider adding a security audit checklist for extension-related changes.

---

## Summary Table

| ID | Finding | Severity | Effort | Category |
|----|---------|----------|--------|----------|
| F01 | No .env.example for API keys | P1 | S | Onboarding |
| F02 | Node version mismatch (README vs CI vs package.json) | P2 | S | Onboarding |
| F03 | Quick 3-command setup works well | Positive | -- | Onboarding |
| F04 | CLAUDE.md is exceptionally well-structured | Positive | -- | Documentation |
| F05 | Sparse inline docs in Rust command files | P2 | L | Documentation |
| F06 | Extension SDK has good documentation | Positive | -- | Documentation |
| F07 | No architecture decision records | P3 | M | Documentation |
| F08 | Frontend test coverage is broad | Positive | -- | Testing |
| F09 | Rust tests are shallow/formulaic | P1 | XL | Testing |
| F10 | E2E test directory is empty | P2 | L | Testing |
| F11 | Brittle 160+ icon mock in test setup | P2 | S | Testing |
| F12 | Layer-based organization is consistent | Positive | -- | Code Org |
| F13 | SDK service layer is well-separated | Positive | -- | Code Org |
| F14 | 10+ TS and 6+ Rust files exceed 1000-line limit | P2 | L | Code Org |
| F15 | Glob re-exports flatten Rust namespace | P3 | M | Code Org |
| F16 | 544 bare unwrap() calls in Rust | P0 | XL | Future-ready |
| F17 | Hardcoded Ollama URL | P2 | S | Future-ready |
| F18 | Extension system well-designed for growth | Positive | -- | Future-ready |
| F19 | No storage schema migration strategy | P2 | M | Future-ready |
| F20 | Constants file centralizes magic numbers | Positive | -- | Future-ready |
| F21 | No SECURITY.md | P1 | S | Standards |
| F22 | No PR/issue templates | P2 | S | Standards |
| F23 | No Dependabot/Renovate | P1 | S | Standards |
| F24 | Pre-commit hook properly configured | Positive | -- | Standards |
| F25 | CI pipeline structured but gaps in coverage | Mixed | -- | Standards |
| F26 | Unresolved SECURITY TODOs in extension sandbox | P1 | M | Standards |

---

## Recommended Priority Order

### Immediate (P0 -- this sprint)
1. **F16** -- Start auditing and replacing bare `unwrap()` calls in high-traffic Rust modules

### High Priority (P1 -- next 2 weeks)
2. **F01** -- Create `.env.example` files (30 minutes)
3. **F21** -- Create `SECURITY.md` (30 minutes)
4. **F23** -- Add Dependabot configuration (15 minutes)
5. **F26** -- Resolve SECURITY TODOs in extension sandbox
6. **F09** -- Begin meaningful Rust test coverage for file operations

### Medium Priority (P2 -- next month)
7. **F11** -- Fix brittle icon mock with Proxy pattern (15 minutes)
8. **F02** -- Align Node.js version across docs and CI (15 minutes)
9. **F17** -- Make Ollama URL configurable (30 minutes)
10. **F22** -- Add PR and issue templates (1 hour)
11. **F14** -- Split largest files (ongoing)
12. **F05** -- Add Rust doc comments to command functions (ongoing)
13. **F10** -- Add initial E2E tests or remove empty job
14. **F19** -- Design storage migration strategy

### Low Priority (P3 -- backlog)
15. **F07** -- Start writing ADRs
16. **F15** -- Reconsider Rust glob re-exports
