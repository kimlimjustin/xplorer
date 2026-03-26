# Code Quality Scan Report

**Date:** 2026-03-23
**Branch:** `next`
**Scope:** `apps/client/src/`, `apps/src-tauri/src/`, `packages/sdk/src/`, `packages/extension-sdk/src/`

---

## 1. Complexity Analysis

### 1.1 Files Over 1000 Lines (Violating CLAUDE.md Rule)

CLAUDE.md mandates files under 1000 lines. **16 files** exceed this limit.

| File | Lines | Severity |
|------|-------|----------|
| `apps/src-tauri/src/search/compat.rs` | 2330 | P1 |
| `apps/src-tauri/src/operations/compression_ops.rs` | 2242 | P1 |
| `apps/src-tauri/src/search/index.rs` | 2036 | P1 |
| `apps/client/src/lib/tauri-api.ts` | 1802 | P1 |
| `apps/client/src/lib/extension-host.ts` | 1751 | P1 |
| `apps/client/src/components/panels/UndoHistoryPanel.tsx` | 1450 | P1 |
| `apps/src-tauri/src/operations/file_ops.rs` | 1447 | P1 |
| `apps/src-tauri/src/git_history.rs` | 1347 | P1 |
| `apps/src-tauri/src/extensions/commands.rs` | 1323 | P1 |
| `apps/client/src/components/panels/PerformanceDashboard.tsx` | 1319 | P1 |
| `apps/client/src/lib/extension-sandbox.ts` | 1293 | P1 |
| `apps/client/src/components/explorer/SearchResultsPanel.tsx` | 1284 | P1 |
| `apps/client/src/components/dialogs/BulkRenameDialog.tsx` | 1268 | P1 |
| `apps/src-tauri/src/search/ai_pipeline.rs` | 1270 | P1 |
| `apps/client/src/pages/FileComparisonPage.tsx` | 1249 | P1 |
| `apps/client/src/components/dialogs/ExtensionPermissionDialog.tsx` | 1241 | P1 |
| `apps/client/src/lib/extension-lifecycle.ts` | 1174 | P1 |
| `apps/client/src/lib/context-menu-factory.ts` | 1161 | P1 |
| `apps/client/src/lib/tauri-api-types.ts` | 1140 | P1 |
| `packages/sdk/src/types/index.ts` | 1109 | P2 |

- **Severity:** P1
- **Effort:** L per file (4-16hr each, XL total)
- **Impact:** Violates project rules. Files this large are harder to navigate, review, and test.
- **Approach:** Extract sub-modules. For `tauri-api.ts`, split into domain-specific facades (e.g., `tauri-api-files.ts`, `tauri-api-search.ts`). For React components, extract sub-components and helper functions into sibling files.

### 1.2 Functions Over 100 Lines (Top Offenders)

| Function | File | Lines |
|----------|------|-------|
| `BulkRenameDialog` | `components/dialogs/BulkRenameDialog.tsx` | 1240 |
| `ChatPanel` | `components/panels/ChatPanel.tsx` | 886 |
| `SearchResultsPanel` | `components/explorer/SearchResultsPanel.tsx` | 856 |
| `useXplorerActions` | `hooks/use-xplorer-actions.ts` | 817 |
| `useFileOperations` | `hooks/use-file-operations.ts` | 806 |
| `createExtensionApi` | `lib/extension-api-factory.ts` | 745 |
| `useXplorerEffects` | `hooks/use-xplorer-effects.ts` | 702 |
| `FileGrid` | `components/explorer/FileGrid.tsx` | 676 |
| `CommandPaletteInner` | `components/CommandPalette.tsx` | 669 |
| `enhanced_search` | Rust `search/compat.rs` | 282 |
| `index_directory` | Rust `search/compat.rs` | 212 |

- **Severity:** P2
- **Effort:** M-L per function
- **Impact:** Cognitive overload, impossible to unit test individual behaviors.
- **Approach:** Extract helper functions, sub-components, and custom hooks. `useXplorerActions` (817 lines) should be split into domain-specific hooks (clipboard actions, layout actions, file actions, etc.).

### 1.3 Functions With Excessive Parameters (> 4)

| Function | File | Params |
|----------|------|--------|
| `executeCustomCommand` | `components/explorer/TerminalCommands.tsx:62` | 7 params |
| `handleChangeDirectory` | `components/explorer/TerminalCommands.tsx:200` | 5 params |
| `createExtensionApi` (sandbox) | `lib/extension-sandbox.ts:457` | 9 params |

- **Severity:** P2
- **Effort:** S-M
- **Impact:** Hard to call correctly, easy to swap argument order.
- **Approach:** Refactor to accept a single options/context object. `executeCustomCommand` should take a `TerminalContext` object. The sandbox `createExtensionApi` should use a deps object like the factory version already does.

### 1.4 `XplorerActionsDeps` Interface is Massive

**File:** `apps/client/src/hooks/use-xplorer-actions.ts:35-104`

The `XplorerActionsDeps` interface has **~30 properties** including 15+ `React.Dispatch<React.SetStateAction<...>>` setters. This is a code smell indicating the hook is a god-object.

- **Severity:** P2
- **Effort:** L
- **Impact:** Any change to parent component state signature cascades. Impossible to test in isolation.
- **Approach:** Break into smaller focused hooks, each with 3-5 deps. Group related state into reducer patterns.

---

## 2. Duplication Detection

### 2.1 CRITICAL: `formatFileSize` Duplicated 6 Times

The exact same function logic is copy-pasted across 6 locations with minor variations:

1. `apps/client/src/lib/utils.ts:340` -- canonical `export const formatFileSize`
2. `apps/client/src/components/TokenizerSettings.tsx:189` -- local copy
3. `apps/client/src/components/panels/StorageAnalyticsPanel.tsx:32` -- local copy
4. `apps/client/src/components/dialogs/CompareFilesDialog.tsx:118` -- local copy
5. `apps/client/src/components/dialogs/FileComparisonDialog.tsx:71` -- local copy
6. `apps/client/src/components/explorer/TerminalCommands.tsx:392` -- local copy
7. `apps/client/src/pages/FileComparisonPage.tsx:164` (named `formatSize`) -- local copy
8. `apps/client/src/lib/ai-service.ts:359` -- static class method copy

- **Severity:** P1
- **Effort:** S (< 1hr)
- **Impact:** Bug fixes (e.g., handling negative bytes, NaN) must be applied 6+ times. Some copies already diverge (different unit arrays, rounding strategies).
- **Approach:** Remove all local copies. Import from `@/lib/utils` everywhere.

### 2.2 CRITICAL: `createExtensionApi` Duplicated in 2 Files

Two completely separate implementations:
- `apps/client/src/lib/extension-sandbox.ts:457` (537 lines, 9 params, older version)
- `apps/client/src/lib/extension-api-factory.ts:35` (745 lines, cleaner deps object)

Both implement the same permission-gated file/UI/command API but diverge in:
- Parameter style (positional vs deps object)
- Feature coverage (sandbox version has `watch`, `showProgress`; factory version has `showInputBox`)
- Permission strings

- **Severity:** P0
- **Effort:** L (4-16hr)
- **Impact:** Security-critical divergence. A permission check fixed in one copy may not be fixed in the other. Both are used by different callers (`extension-host.ts` uses factory, `extension-lifecycle.ts` uses sandbox).
- **Approach:** Consolidate into one canonical implementation in `extension-api-factory.ts` with the deps-object pattern. Delete the duplicate from `extension-sandbox.ts`.

### 2.3 HIGH: Sandbox/Document Proxy Code Duplicated

The document proxy with createElement interception, blocked globals lists, and `blockedPrototypeMethods` appear in both:
- `apps/client/src/lib/extension-host.ts:500-548`
- `apps/client/src/lib/extension-sandbox.ts:200-290`

Nearly identical ~90 lines of security-critical sandbox code.

- **Severity:** P0
- **Effort:** M (1-4hr)
- **Impact:** A sandbox escape vulnerability fixed in one location won't be fixed in the other. This is a security risk.
- **Approach:** Extract a single `createSandboxedEnvironment()` helper. Both `extension-host.ts` and `extension-sandbox.ts` should call it.

### 2.4 HIGH: Extension Loading/Registration Duplicated

`extension-host.ts` and `extension-lifecycle.ts` both contain:
- `registerExternalExtension()` method (~60 lines, nearly identical)
- Extension bundle loading with MAX_EXTENSION_SIZE check
- `__xplorer_register__` capture pattern
- Extension execution with timeout

- **Severity:** P1
- **Effort:** L (4-16hr)
- **Impact:** 5713 total lines across 5 extension files. The lifecycle version has features (integrity check, hot-reload) that the host version lacks, suggesting the host version is stale.
- **Approach:** Determine which version is canonical. If `extension-lifecycle.ts` is the intended replacement, deprecate and remove the duplicate logic from `extension-host.ts`.

### 2.5 Hardcoded `http://localhost:3000` in Multiple Places

The marketplace URL `http://localhost:3000` appears hardcoded in:
- `apps/client/src/pages/settings.tsx:96` -- `DEFAULT_MARKETPLACE_URL`
- `apps/client/src/components/panels/MarketplacePanel.tsx:32` -- `DEFAULT_MARKETPLACE_API`
- `apps/client/src/components/panels/MarketplacePanel.tsx:556,753` -- inline in `window.open()`
- `apps/client/src/components/panels/ExtensionDetailDialog.tsx:158`

- **Severity:** P2
- **Effort:** S
- **Impact:** When marketplace URL changes, multiple files need updating. The inline `window.open` calls won't respect user-configured URLs.
- **Approach:** Define a single `MARKETPLACE_BASE_URL` constant, derive API and browser URLs from it.

---

## 3. Error Handling Audit

### 3.1 Swallowed Catches With Only Comments

Multiple `catch` blocks that discard errors with only a comment. While some are legitimate (localStorage unavailable), others mask real bugs:

| File | Line | Comment |
|------|------|---------|
| `hooks/use-performance-stats.ts` | 194 | `// Tag batch may fail silently` |
| `hooks/use-performance-stats.ts` | 207 | `// Silently handle errors` |
| `hooks/use-chat-file.ts` | 142 | `// Auto-save is best-effort` |
| `hooks/use-chat.ts` | 103 | `// Silently fail` |
| `pages/FileEditorView.tsx` | 89 | `// fallback` |
| `lib/file-comparison.ts` | 578 | `// Hash failed -- treat as different` |
| `components/panels/UndoHistoryPanel.tsx` | 586 | (empty catch, sets snapshot to null) |

- **Severity:** P2
- **Effort:** M
- **Impact:** Silent failures make debugging impossible. Users see no feedback when operations fail.
- **Approach:** Add `console.warn()` with error context to all catch blocks. For user-facing operations, show a toast notification.

### 3.2 Rust: `category.unwrap()` After `is_none()` Check -- Race Condition Pattern

**File:** `apps/src-tauri/src/agent/memory.rs:126,137`

```rust
.filter(|e| category.is_none() || e.category == category.unwrap())
```

This uses `category.unwrap()` after checking `is_none()`. While logically safe due to short-circuit evaluation, this is fragile and non-idiomatic. Any refactoring that separates the check from the unwrap will panic.

- **Severity:** P2
- **Effort:** S
- **Impact:** Potential panic if refactored carelessly.
- **Approach:** Use `category.as_ref().map_or(true, |c| e.category == *c)` or `if let Some(cat) = &category`.

### 3.3 Rust: `SystemTime::now().duration_since(UNIX_EPOCH).unwrap()` in Production

**File:** `apps/src-tauri/src/google_drive.rs:317,572`

`duration_since(UNIX_EPOCH)` can technically fail if system clock is before 1970. While unlikely, using `.unwrap()` in production code violates the project's error handling conventions.

- **Severity:** P3
- **Effort:** S
- **Impact:** Will panic with a corrupted system clock.
- **Approach:** Use `.unwrap_or_default()` or propagate with `?` and `.map_err()`.

### 3.4 Rust: Regex Compiled on Every Call in `document_extractor.rs`

**File:** `apps/src-tauri/src/document_extractor.rs:104,427,445,453`

Four `Regex::new(...)` calls with `.unwrap()` are executed on every invocation. Only one (line 116) is properly cached with `OnceLock`.

- **Severity:** P2
- **Effort:** S
- **Impact:** Performance: regex compilation is expensive. The `.unwrap()` is safe (valid patterns) but non-idiomatic.
- **Approach:** Use `OnceLock<Regex>` or `lazy_static!` for all regex patterns, matching the pattern already used on line 115-116.

### 3.5 `window.prompt()` Used for File Dialogs

**Files:**
- `apps/client/src/lib/extension-sandbox.ts:578,936,952`
- `apps/client/src/lib/extension-api-factory.ts:100`

Using `window.prompt()` for file save/open dialogs in a Tauri desktop app. This is inappropriate -- Tauri has native file dialogs via `@tauri-apps/plugin-dialog`.

- **Severity:** P2
- **Effort:** M
- **Impact:** Poor UX. `window.prompt()` is a blocking browser dialog, not a native file picker.
- **Approach:** Use Tauri's `dialog.save()` / `dialog.open()` APIs.

---

## 4. Type Safety Audit

### 4.1 `any` Types

Only **1 `any`** found in non-test production code:

- `packages/sdk/src/services/git.ts:66` -- `last_commit?: any`

- **Severity:** P2
- **Effort:** S
- **Impact:** Loses type safety for git commit objects.
- **Approach:** Define a `GitCommitInfo` type with `hash`, `message`, `author`, `date` fields.

### 4.2 Type Assertions (`as Type`) -- 57 Occurrences

Key unsafe assertions:

| Location | Assertion | Risk |
|----------|-----------|------|
| `lib/extension-host.ts:532` | `(value as Function).apply(target, args)` | Runtime crash if not a function |
| `lib/extension-sandbox.ts:256` | `(value as Function).apply(target, args)` | Same |
| `lib/utils.ts:398-399` | `a as FileEntry & { folder_size?: ... }` | Silent data loss |
| `lib/file-templates.ts:243` | `parsed as FileTemplate[]` | No runtime validation |
| `lib/folder-colors.ts:50` | `JSON.parse(raw) as FolderColor[]` | No validation |
| `lib/extension-sandbox.ts:802,823,994` | `options as CompressionOptions` etc. | Trusting extension input |

- **Severity:** P2
- **Effort:** M
- **Impact:** The extension sandbox assertions are most concerning -- they trust untrusted extension input without runtime validation. Could cause crashes or unexpected behavior.
- **Approach:** Add runtime type guards (Zod schemas or manual checks) before type assertions, especially for extension-provided data.

### 4.3 Loose String Types Where Unions Are Appropriate

**File:** `apps/client/src/lib/utils.ts:378`

```typescript
sortBy: string
```

`sortBy` accepts any string but only handles `'name' | 'dateModified' | 'size' | 'dateCreated' | 'type' | 'extension'`. A typo like `'Name'` would silently fall through to the default case.

- **Severity:** P2
- **Effort:** S
- **Impact:** Type errors caught at compile time instead of silent bugs.
- **Approach:** Define `type SortField = 'name' | 'dateModified' | 'size' | 'dateCreated' | 'type' | 'extension'` and use it in the function signature.

---

## 5. Dead Code / Stale Code Detection

### 5.1 Extension System Has Two Parallel Implementations

The extension loading system exists in two versions:

1. **Original:** `extension-host.ts` (1751 lines) -- singleton class with inline sandbox
2. **New:** `extension-lifecycle.ts` (1174 lines) + `extension-sandbox.ts` (1293 lines) + `extension-registry.ts` (713 lines) + `extension-api-factory.ts` (782 lines) = 3962 lines total

Both are imported. The newer version has features the old one lacks (integrity verification, dependency resolution, hot-reload, tracked timers). The old version has features the new one lacks (inline sandbox, file watching API).

- **Severity:** P1
- **Effort:** XL (16hr+)
- **Impact:** 5713 total lines of extension code where ~2500 are redundant. Maintenance burden is doubled. Security fixes must be applied to both.
- **Approach:** Audit all consumers to determine which version is active. Migrate all callers to the newer modular version. Remove dead code from `extension-host.ts`.

### 5.2 `function` Keyword Used Instead of Arrow Functions

CLAUDE.md requires arrow functions. 7 components and ~15 standalone functions use `function`:

| Location | Function |
|----------|----------|
| `components/settings/VersioningSettings.tsx:6` | `export default function VersioningSettings()` |
| `components/TokenizerSettings.tsx:10` | `export default function TokenizerSettingsComponent()` |
| `components/panels/NotificationCenter.tsx:102` | `export default function NotificationCenter()` |
| `components/panels/UndoHistoryPanel.tsx:569` | `export default function UndoHistoryPanel()` |
| `components/TrashPage.tsx:13` | `export default function RecycleBin()` |
| `pages/settings.tsx:150` | `export default function Settings()` |
| `components/explorer/TerminalCommands.tsx` | 9 functions use `function` keyword |

- **Severity:** P3
- **Effort:** S
- **Impact:** Style inconsistency. Violates project coding standards.
- **Approach:** Convert to `const ComponentName = () => { ... }; export default ComponentName;`

---

## 6. Naming and Readability

### 6.1 Inconsistent File Naming

CLAUDE.md specifies PascalCase for component filenames and `use-kebab-case.ts` for hooks. These conventions are mostly followed, but:

- `apps/client/src/pages/not-found.tsx` -- kebab-case page (should be `NotFound.tsx`)
- `apps/client/src/pages/gdrive-accounts.tsx` -- kebab-case (should be `GDriveAccounts.tsx`)
- `apps/client/src/pages/xplorer.tsx` -- lowercase (should be `Xplorer.tsx`)
- `apps/client/src/pages/file-comparison-helpers.ts` -- non-component uses kebab-case (acceptable per convention for utils, but mixes with PascalCase pages)
- `apps/client/src/pages/settings.tsx` -- lowercase (should be `Settings.tsx`)

- **Severity:** P3
- **Effort:** S
- **Impact:** Makes file navigation inconsistent.
- **Approach:** Rename page files to PascalCase.

### 6.2 `handlePreview().then(() => {})` Pattern

**File:** `apps/client/src/components/panels/PerformanceDashboard.tsx:414`

```typescript
handlePreview().then(() => {});
```

Using `.then(() => {})` to silence a Promise is a code smell. Errors are silently swallowed.

- **Severity:** P2
- **Effort:** S
- **Impact:** Unhandled promise rejection -- any error in `handlePreview` is silently discarded.
- **Approach:** Use `void handlePreview()` or add `.catch(console.error)`.

### 6.3 Polling Instead of Event-Driven Updates

**File:** `apps/client/src/components/panels/UndoHistoryPanel.tsx:599`

```typescript
const interval = setInterval(refresh, 2000);
```

Polling every 2 seconds for undo history changes is wasteful. The undo system should emit events when history changes.

- **Severity:** P3
- **Effort:** M
- **Impact:** Unnecessary CPU/IPC overhead, especially when the panel is visible but idle.
- **Approach:** Use Tauri event system to push undo history changes to the frontend.

---

## 7. Security Concerns

### 7.1 Extension Sandbox Divergence (Already Covered in 2.3)

The two sandbox implementations have different blocked globals lists and security checks. This is the highest-priority security issue.

### 7.2 Hardcoded `localhost` URLs in Production Code

`http://localhost:3000` and `http://localhost:8080` appear in production source files (not just dev config). These could be exploited if a local service runs on these ports.

- **Severity:** P2
- **Effort:** S
- **Impact:** In production, these URLs won't work and create confusing UX. If another app runs on port 3000, it could receive marketplace API calls.
- **Approach:** Guard with environment checks. Default to empty/disabled when not in development mode.

---

## Summary Statistics

| Category | P0 | P1 | P2 | P3 |
|----------|----|----|----|----|
| Complexity | 0 | 2 | 3 | 0 |
| Duplication | 2 | 2 | 1 | 0 |
| Error Handling | 0 | 0 | 4 | 1 |
| Type Safety | 0 | 0 | 3 | 0 |
| Dead Code | 0 | 1 | 0 | 1 |
| Naming/Readability | 0 | 0 | 1 | 2 |
| Security | 0 | 0 | 1 | 0 |
| **Total** | **2** | **5** | **13** | **4** |

## Priority Actions

### Immediate (P0 -- do this first)
1. **Consolidate `createExtensionApi`** -- Two diverging security-critical implementations (sandbox + factory)
2. **Consolidate sandbox proxy code** -- Two diverging document/window proxy implementations

### High Priority (P1 -- this sprint)
3. **Deduplicate `formatFileSize`** -- 6 copies, already diverging
4. **Resolve extension host vs lifecycle duplication** -- 5700+ lines, half redundant
5. **Split oversized files** -- 16+ files over 1000 lines

### Medium Priority (P2 -- next sprint)
6. Add proper error handling to silent catch blocks
7. Cache `Regex::new()` calls in `document_extractor.rs`
8. Replace `window.prompt()` with Tauri native dialogs
9. Fix loose `string` types to use unions
10. Add runtime validation for extension API type assertions

### Low Priority (P3 -- backlog)
11. Convert `function` declarations to arrow functions
12. Rename page files to PascalCase
13. Replace polling with event-driven updates
