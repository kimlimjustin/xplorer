# Code Quality Scan Report

**Date:** 2026-03-25
**Branch:** `next`
**Scope:** `apps/client/src` (TS/TSX), `apps/src-tauri/src` (Rust), `packages/` (SDK/extensions)

---

## 1. Large Files (over 1000 lines violate project rule)

Convention: "Files under 1000 lines." 28 TypeScript files and 14 Rust files exceed this limit.

### TypeScript -- files over 1000 lines

| File | Lines | Severity | Effort |
|------|-------|----------|--------|
| `apps/client/src/lib/extension-host.ts` | 1550 | P2 | L |
| `apps/client/src/components/panels/UndoHistoryPanel.tsx` | 1450 | P2 | L |
| `apps/client/src/components/panels/PerformanceDashboard.tsx` | 1319 | P2 | M |
| `apps/client/src/components/explorer/SearchResultsPanel.tsx` | 1284 | P2 | M |
| `apps/client/src/components/dialogs/BulkRenameDialog.tsx` | 1268 | P2 | M |
| `apps/client/src/pages/FileComparisonPage.tsx` | 1241 | P2 | M |
| `apps/client/src/components/dialogs/ExtensionPermissionDialog.tsx` | 1241 | P2 | M |
| `apps/client/src/lib/extension-lifecycle.ts` | 1174 | P2 | M |
| `apps/client/src/lib/context-menu-factory.ts` | 1162 | P2 | M |
| `apps/client/src/lib/tauri-api-types.ts` | 1140 | P3 (types file) | M |
| `apps/client/src/lib/extension-sandbox.ts` | 1088 | P2 | M |

### TypeScript -- files 500-999 lines (approaching limit, watch list)

28 additional files are in the 500-999 range. The most concerning (over 900 lines):

| File | Lines |
|------|-------|
| `apps/client/src/components/SmartSearch.tsx` | 980 |
| `apps/client/src/components/panels/ChatPanel.tsx` | 934 |
| `apps/client/src/hooks/use-split-layout.ts` | 932 |
| `apps/client/src/components/previews/ComparePreview.tsx` | 923 |
| `apps/client/src/hooks/use-xplorer-actions.ts` | 922 |
| `apps/client/src/pages/HomePage.tsx` | 920 |
| `apps/client/src/components/dialogs/FileDetailsDialog.tsx` | 905 |
| `apps/client/src/hooks/use-file-operations.ts` | 903 |

### Rust -- files over 1000 lines

| File | Lines | Severity | Effort |
|------|-------|----------|--------|
| `apps/src-tauri/src/search/compat.rs` | 2330 | P2 | XL |
| `apps/src-tauri/src/operations/compression_ops.rs` | 2242 | P2 | XL |
| `apps/src-tauri/src/search/index.rs` | 2036 | P2 | L |
| `apps/src-tauri/src/git_history.rs` | 1527 | P2 | L |
| `apps/src-tauri/src/operations/file_ops.rs` | 1447 | P2 | L |
| `apps/src-tauri/src/extensions/commands.rs` | 1356 | P2 | L |
| `apps/src-tauri/src/search/ai_pipeline.rs` | 1270 | P2 | L |
| `apps/src-tauri/src/ai.rs` | 1225 | P2 | L |
| `apps/src-tauri/src/operations/system_ops.rs` | 1198 | P2 | L |
| `apps/src-tauri/src/operations/undo_redo_ops.rs` | 1179 | P2 | L |
| `apps/src-tauri/src/agent/tool_executor.rs` | 1117 | P2 | L |
| `apps/src-tauri/src/google_drive.rs` | 1069 | P2 | L |
| `apps/src-tauri/src/agent/mod.rs` | 1061 | P2 | L |
| `apps/src-tauri/src/file_organizer.rs` | 1031 | P2 | M |

---

## 2. `any` Type Usage

**Result: 0 violations found.** No `: any`, `as any`, or `<any>` usage detected in `apps/client/src` or `packages/sdk/src`. This is clean.

---

## 3. Console.log Violations

**Result: 0 violations found in `apps/client/src`.** The convention (only `console.warn` and `console.error`) is being followed.

One instance in `packages/extension-sdk/src/core/Extension.ts:78` uses `console.log` intentionally for the extension `log()` API. This is acceptable as it is the SDK's logging interface for extensions.

---

## 4. Empty/Silent Catch Blocks

Most catch blocks either set error state, log via `console.error`, or return a fallback value. The following are truly silent catches that swallow errors without any handling or logging:

| File:Line | Pattern | Severity | Effort |
|-----------|---------|----------|--------|
| `apps/client/src/i18n.ts:22` | `catch { /* ignore */ }` | P3 | S |
| `apps/client/src/i18n.ts:33` | `catch { /* ignore */ }` | P3 | S |
| `apps/client/src/components/ui/TokenizerStatusIndicator.tsx:13` | `catch { // Silently ignore }` | P3 | S |
| `apps/client/src/components/CommandPalette.tsx:385` | `catch { /* ignore */ }` (fallback search) | P3 | S |
| `apps/client/src/components/CommandPalette.tsx:399` | `catch { /* ignore */ }` | P3 | S |
| `apps/client/src/components/panels/PreviewPanel.tsx:92` | `catch { // Not a text file }` | P3 | S |

**Verdict:** All silent catches are in non-critical paths (i18n init, search fallbacks, preview sniffing). Low risk but could mask real bugs. Consider adding `console.warn` to these for debuggability.

---

## 5. `function` Keyword Violations

**Result: 1 violation found.**

| File:Line | What | Severity | Effort |
|-----------|------|----------|--------|
| `apps/client/src/components/explorer/SearchResultsPanel.tsx:403` | `function SearchResultsPanel(...)` inside `React.forwardRef` | P3 | S |

This is a named function used inside `React.forwardRef()` for better DevTools display names. This is a common React pattern and arguably acceptable. Converting to an arrow function would lose the display name unless a separate `displayName` assignment is added.

---

## 6. `var` Usage

**Result: 0 violations found.** All variable declarations use `const` or `let`.

---

## 7. `==` Instead of `===`

**Result: 0 violations found** (excluding `== null` which is allowed by convention).

---

## 8. Dead Exports

No dead exports were detected in `apps/client/src/lib/`. All exported identifiers are imported by at least one other file.

---

## 9. Bare `unwrap()` in Rust Production Code

### Regex::new().unwrap() -- Acceptable

5 instances in `apps/src-tauri/src/document_extractor.rs` use `Regex::new(...).unwrap()` on hardcoded regex patterns. These are compile-time constant patterns that cannot fail. Acceptable.

1 instance in `apps/src-tauri/src/search/index.rs:119` -- same pattern, acceptable.

### SystemTime::now().unwrap() -- Low Risk

| File:Line | What | Severity | Effort |
|-----------|------|----------|--------|
| `apps/src-tauri/src/google_drive.rs:317` | `SystemTime::now().duration_since(UNIX_EPOCH).unwrap()` | P3 | S |
| `apps/src-tauri/src/google_drive.rs:572` | Same pattern | P3 | S |

This can only fail if the system clock is before UNIX epoch (1970). Extremely unlikely but technically possible on misconfigured systems.

### Mutex Lock Patterns -- GOOD

| Pattern | Count |
|---------|-------|
| `.lock().unwrap_or_else(\|e\| e.into_inner())` (correct poison guard) | 104 |
| `.lock().map_err(...)` (propagates error) | 29 |
| `if let Ok(...)` (graceful degradation) | 9 |
| `.lock().unwrap()` (panic risk) | **0** |

All Mutex locks follow the project convention. No poisoning risk.

---

## 10. Test Coverage Gaps

### Components WITHOUT tests (7 files, 3,850 total lines)

| File | Lines | Severity | Effort |
|------|-------|----------|--------|
| `apps/client/src/components/CommandPalette.tsx` | 725 | P1 | L |
| `apps/client/src/components/QuickLookOverlay.tsx` | 658 | P2 | M |
| `apps/client/src/components/TokenizerSettings.tsx` | 613 | P2 | M |
| `apps/client/src/components/command-palette-helpers.tsx` | 445 | P2 | M |
| `apps/client/src/components/KeyboardShortcutsSettings.tsx` | 383 | P2 | M |
| `apps/client/src/components/TrashPage.tsx` | 359 | P2 | M |
| `apps/client/src/components/ErrorBoundary.tsx` | 67 | P3 | S |

### Pages WITHOUT tests (3 files, 1,683 total lines)

| File | Lines | Severity | Effort |
|------|-------|----------|--------|
| `apps/client/src/pages/HomePage.tsx` | 920 | P1 | XL |
| `apps/client/src/pages/gdrive-accounts.tsx` | 527 | P2 | M |
| `apps/client/src/pages/ChatFileView.tsx` | 236 | P3 | M |

### Hooks WITHOUT tests (21 files, 5,586 total lines)

| File | Lines | Severity | Effort |
|------|-------|----------|--------|
| `apps/client/src/hooks/use-xplorer-actions.ts` | 922 | P1 | XL |
| `apps/client/src/hooks/use-file-operations.ts` | 903 | P1 | XL |
| `apps/client/src/hooks/use-xplorer-effects.ts` | 863 | P1 | L |
| `apps/client/src/hooks/use-dialogs.ts` | 530 | P2 | M |
| `apps/client/src/hooks/use-chat-file.ts` | 408 | P2 | M |
| `apps/client/src/hooks/use-chat-state.ts` | 408 | P2 | M |
| `apps/client/src/hooks/use-shortcuts.ts` | 290 | P2 | M |
| `apps/client/src/hooks/use-chat.ts` | 281 | P2 | M |
| `apps/client/src/hooks/use-search-tokens.ts` | 238 | P2 | M |
| `apps/client/src/hooks/use-smart-view.ts` | 183 | P2 | S |
| `apps/client/src/hooks/use-layout-state.ts` | 182 | P3 | S |
| `apps/client/src/hooks/use-folder-sizes.ts` | 156 | P3 | S |
| `apps/client/src/hooks/use-navigation.ts` | 149 | P3 | S |
| `apps/client/src/hooks/use-sidebar-resize.ts` | 111 | P3 | S |
| `apps/client/src/hooks/use-context-menu.ts` | 111 | P3 | S |
| `apps/client/src/hooks/use-architect-context.ts` | 93 | P3 | S |
| `apps/client/src/hooks/use-terminal.ts` | 93 | P3 | S |
| `apps/client/src/hooks/use-draggable.ts` | 81 | P3 | S |
| `apps/client/src/hooks/use-theme-manager.ts` | 48 | P3 | S |
| `apps/client/src/hooks/use-window-event.ts` | 39 | P3 | S |
| `apps/client/src/hooks/use-droppable.ts` | 39 | P3 | S |

### Lib modules WITHOUT tests (16 files, 7,602 total lines)

| File | Lines | Severity | Effort |
|------|-------|----------|--------|
| `apps/client/src/lib/extension-lifecycle.ts` | 1174 | P1 | XL |
| `apps/client/src/lib/extension-sandbox.ts` | 1088 | P1 | XL |
| `apps/client/src/lib/extension-api-factory.ts` | 782 | P1 | L |
| `apps/client/src/lib/context-menu-factory.ts` | 1162 | P1 | XL |
| `apps/client/src/lib/tauri-api-types.ts` | 1140 | P3 (types only) | S |
| `apps/client/src/lib/ai-service.ts` | 361 | P2 | M |
| `apps/client/src/lib/extension-host-types.ts` | 315 | P3 (types only) | S |
| `apps/client/src/lib/extension-sandbox-env.ts` | 311 | P2 | M |
| `apps/client/src/lib/agent-service.ts` | 296 | P2 | M |
| `apps/client/src/lib/extension-permissions.ts` | 201 | P2 | M |
| `apps/client/src/lib/transport.ts` | 135 | P3 | S |
| `apps/client/src/lib/extension-host-icon.ts` | 123 | P3 | S |
| `apps/client/src/lib/constants.ts` | 120 | P3 | S |
| `apps/client/src/lib/storage-keys.ts` | 69 | P3 | S |
| `apps/client/src/lib/queryClient.ts` | 15 | P3 | S |
| `apps/client/src/lib/tauri-api.ts` | 3 | P3 | S |

---

## 11. Security TODOs

| File:Line | What | Severity | Effort |
|-----------|------|----------|--------|
| `apps/client/src/lib/extension-sandbox.ts:203` | "SECURITY TODO in executeSandboxed" -- defense-in-depth hardening for sandbox escapes | P1 | L |
| `apps/client/src/lib/extension-host.ts:92` | "SECURITY TODO in loadExtensionScript" -- same pattern | P1 | L |

These are flagged inline as security-relevant hardening that is not yet fully addressed.

---

## Summary

### What's Clean
- **Zero** `any` type usage in client source
- **Zero** `console.log` violations in client source
- **Zero** `var` usage
- **Zero** `==` (non-strict equality) violations
- **Zero** bare `Mutex.lock().unwrap()` in Rust production code
- **Zero** dead exports detected in lib/
- **Zero** direct `invoke()` calls from components (all go through SDK)

### Top Priority Findings

| # | Category | Count | P0-P1 Items | Recommendation |
|---|----------|-------|-------------|----------------|
| 1 | **Test coverage gaps** | 47 untested files | 7 P1 files (use-xplorer-actions, use-file-operations, use-xplorer-effects, HomePage, CommandPalette, extension-lifecycle, extension-sandbox, context-menu-factory) | Prioritize tests for the 7 P1 files -- they are large, complex, and untested |
| 2 | **Large files** | 11 TS + 14 RS over 1000 lines | All P2 | Split into sub-modules; extract hooks/helpers from components |
| 3 | **Security TODOs** | 2 in extension sandbox | P1 | Audit and resolve sandbox hardening TODOs |
| 4 | **Silent catch blocks** | 6 | All P3 | Add `console.warn` for debuggability |
| 5 | **Function keyword** | 1 | P3 | Acceptable for forwardRef display name |

### Estimated Total Effort

- **P1 items:** ~7 test suites to write + 2 security TODOs to address = **L-XL effort**
- **P2 items:** ~25 files to split + 20 test suites to write = **XL effort (ongoing)**
- **P3 items:** Minor cleanup = **S effort**
