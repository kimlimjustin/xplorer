# Security & Code Quality Scan Results

Date: 2026-03-25
Branch: `next`
Scope: All `.rs`, `.ts`, `.tsx`, `.json`, `.yml` files in the repository

---

## 1. Hardcoded Secrets

### CRITICAL: Placeholder Ed25519 Public Key (all zeros)

- **File:** `apps/src-tauri/src/extensions/signing.rs`, lines 23-28
- **Issue:** `OFFICIAL_PUBLIC_KEY` is set to 32 zero bytes. This means Ed25519 signature verification will ALWAYS fail (no valid key can produce a signature verifiable with the zero key). Any call to `verify_extension()` will reject all signed extensions, and the fallback is hash-only (legacy mode) which provides no cryptographic authenticity.
- **Fix:** Generate a real keypair (`cargo test generate_signing_keypair -- --nocapture`) and set the public key here. Store the private key as a GitHub Secret.

### LOW: Test Password in Test Code

- **File:** `apps/src-tauri/src/operations/encryption_ops.rs`, line 334
- **Content:** `let password = "strong_password_123";`
- **Issue:** This is inside `#[cfg(test)]` (line 273), so it is a test fixture, not a production secret. **No action required** -- this is acceptable.

### LOW: CI-Only Test Credentials

- **File:** `.github/workflows/web.yml`, lines 18, 39, 44-45
- **Content:** `POSTGRES_PASSWORD: xplorer`, `NEXTAUTH_SECRET: test-secret`, `DATABASE_URL: postgresql://xplorer:xplorer@localhost:5432/xplorer_test`
- **Issue:** These are ephemeral CI service container credentials and a test-only NextAuth secret. They never reach production. **No action required** -- standard CI practice.

- **File:** `private/infra/docker-compose.yml`, line 9
- **Content:** `POSTGRES_PASSWORD: xplorer`
- **Issue:** Local dev docker-compose with simple password. **Low risk** but consider documenting that this should never be used in production.

### CLEAN: No Leaked Secrets Found

- No `sk_live_`, `pk_live_`, `ghp_`, `gho_`, `AKIA*` tokens found in source code.
- No `.env` files committed (only `.env.example` with placeholder comments).
- No `.pem`, `.key`, `.p12` files in git history.
- All GitHub workflow secrets use `${{ secrets.* }}` references properly.
- Google Drive OAuth `client_secret` is stored in OS keychain (`apps/src-tauri/src/google_drive.rs`, line 250-262), not hardcoded.
- AI API keys are configured via environment variables/settings, not embedded.

---

## 2. AI-Generated Comments

### No Banned AI Comments Found

Searched for: "AI generated", "Claude:", "Based on research", "Recommended by", "Refactored for clarity", "Improved by AI", "Note: this was auto", "research-backed", "paper-backed", "benchmark-validated"

**Result:** No matches in source code (`.rs`, `.ts`, `.tsx` files).

Note: The `docs/performance-optimizations.md` file contains phrases like "Inspired by" and "Schwartzian transform" with academic references, but these are documentation explaining algorithmic choices, not banned AI-attribution comments in source code.

The string "Copilot" appears in `apps/src-tauri/src/ai.rs` (line 481) and several UI components, but this refers to the product feature name "Copilot Assistant", not an AI-attribution comment.

---

## 3. Legacy / Dead Code

### 3a. Unreachable Code Block Behind Early Return

- **File:** `apps/src-tauri/src/extensions/native_plugin.rs`, lines 55-111
- **Issue:** The `NativePlugin::load()` function has an early `return Err(...)` on line 57 for security reasons (CRIT-04), followed by `#[allow(unreachable_code)]` and ~50 lines of actual loading logic that can NEVER execute. This is dead code preserved intentionally with a security comment.
- **Fix:** Consider moving the disabled implementation to a doc comment or a separate `_load_impl` marked `#[cfg(feature = "native_plugins")]` so the dead code is not compiled at all. Alternatively, keep as-is if the intent is to re-enable after code signing is implemented.

### 3b. `#[allow(dead_code)]` Annotations

| File | Line | Symbol | Status |
|------|------|--------|--------|
| `apps/src-tauri/src/extensions/native_plugin.rs` | 17 | `PluginInitFn` type alias | Unused (unreachable load path) |
| `apps/src-tauri/src/extensions/native_plugin.rs` | 24 | `NativePlugin` struct | Used only via dead load path |
| `apps/src-tauri/src/extensions/native_plugin.rs` | 53 | `NativePlugin::load()` | Contains unreachable code |
| `apps/src-tauri/src/extensions/plugin_registry.rs` | 82 | `load_native_plugin()` | Called from `manager.rs:154`, but the function it calls (`NativePlugin::load()`) always returns `Err` |
| `apps/src-tauri/src/extensions/plugin_registry.rs` | 141 | `loaded_plugin_ids()` | **Never called anywhere** -- true dead code |
| `apps/src-tauri/src/search/ollama_client.rs` | 50 | `OllamaGenerateResponse::done` field | Deserialized but never read |
| `apps/src-tauri/src/operations/undo_redo_ops.rs` | 168 | `get_staging_dir()` | Called by `soft_delete()` which is tested but also `#[allow(dead_code)]` |
| `apps/src-tauri/src/operations/undo_redo_ops.rs` | 189 | `soft_delete()` | Used only in tests (lines 1130-1167). Not called from production code paths |

- **Fix for `loaded_plugin_ids()`:** Remove or add a test that exercises it. It has zero callers.
- **Fix for `soft_delete()` / `get_staging_dir()`:** These appear to be pre-built infrastructure for undo operations. If they are awaiting integration, add a TODO. If abandoned, remove them.

### 3c. SECURITY TODO References to Nonexistent Annotations

- **File:** `apps/client/src/lib/extension-host.ts`, line 92
- **File:** `apps/client/src/lib/extension-sandbox.ts`, line 203
- **Issue:** Both say "see the SECURITY TODO in loadExtensionScript" / "in executeSandboxed", but there is no `SECURITY TODO` comment in either `loadExtensionScript` (line 409 of extension-host.ts) or `executeSandboxed` (line 162 of extension-sandbox.ts). The referenced TODO appears to have been resolved or removed but the cross-references were not updated.
- **Fix:** Remove the stale cross-references or add the actual SECURITY TODO where it belongs.

### 3d. `console.log()` Violations

Per CLAUDE.md: "Only `console.warn()` and `console.error()` allowed. No `console.log()`."

- **File:** `packages/extension-sdk/src/core/Extension.ts`, line 78
- **Content:** `console.log(\`[\${this.manifest.name}] \${message}\`, ...args);`
- **Issue:** Extension SDK's `log()` method uses `console.log`. This is the extension SDK (not the client app), so the rule may not strictly apply here. However, if the rule is intended to be project-wide, this should be changed.

- **File:** `packages/create-extension/src/index.ts`, lines 94, 189, 244, 250-263
- **Content:** Multiple `console.log(chalk.*)` calls
- **Issue:** This is a CLI scaffolding tool, so `console.log` is appropriate here. **No action required.**

### 3e. Excessive `eslint-disable` Comments

The following files have 3+ `eslint-disable` annotations. While individually justified (mostly `react-hooks/exhaustive-deps` and `react/no-array-index-key`), the volume suggests these hooks may need refactoring:

- `apps/client/src/pages/FileComparisonPage.tsx` -- 10 eslint-disable comments
- `apps/client/src/components/previews/CsvPreview.tsx` -- 3
- `apps/client/src/components/previews/SpreadsheetPreview.tsx` -- 3

### 3f. Legacy Code Explicitly Marked

These are intentionally preserved for backward compatibility and are not dead code:

- `apps/src-tauri/src/shortcuts/types.rs`, line 77: Legacy shortcut action variants
- `apps/client/src/lib/tauri-api-types.ts`, line 794: Legacy shortcut action types
- `apps/src-tauri/src/operations/file_ops.rs`, line 446: Legacy copy/move commands

---

## 4. Additional Observations

### 4a. `.sig` Files in Git

Six `.sig` files are tracked in git under `apps/src-tauri/data/extensions/`. These contain SHA-256 hashes and Ed25519 signatures for built-in extensions. They are public metadata (not secrets), but given the `OFFICIAL_PUBLIC_KEY` is all zeros, these signatures cannot actually be verified at runtime. They will become meaningful once a real key is deployed.

### 4b. Bare `.unwrap()` Count

331 bare `.unwrap()` calls across 20 Rust source files (outside `#[cfg(test)]`). The highest counts are in:
- `apps/src-tauri/src/duplicate_finder.rs` (36)
- `apps/src-tauri/src/file_organizer.rs` (36)
- `apps/src-tauri/src/agent/planner.rs` (23)
- `apps/src-tauri/src/extensions/commands.rs` (21)

Per CLAUDE.md convention, Mutex locks should use `.unwrap_or_else(|e| e.into_inner())`. The non-Mutex `.unwrap()` calls are a crash risk in production on unexpected input.

---

## Summary of Actionable Items

| Priority | Issue | File(s) | Action |
|----------|-------|---------|--------|
| **P0** | Placeholder all-zero public key breaks extension signature verification | `signing.rs:23-28` | Generate and deploy real keypair |
| **P1** | 50+ lines unreachable dead code in native plugin loader | `native_plugin.rs:55-111` | Feature-gate or remove |
| **P1** | `loaded_plugin_ids()` has zero callers | `plugin_registry.rs:141-147` | Remove or add caller |
| **P1** | Stale SECURITY TODO cross-references | `extension-host.ts:92`, `extension-sandbox.ts:203` | Remove or fix references |
| **P2** | `soft_delete()` + `get_staging_dir()` only used in tests | `undo_redo_ops.rs:168-210` | Integrate into undo flow or document intent |
| **P2** | `OllamaGenerateResponse::done` field never read | `ollama_client.rs:50` | Minor, keep for API completeness |
| **P3** | 331 bare `.unwrap()` calls in Rust | Multiple files | Gradually replace with proper error handling |
| **P3** | Extension SDK uses `console.log` | `Extension.ts:78` | Change to `console.warn` if rule is project-wide |
