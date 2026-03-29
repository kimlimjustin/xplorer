# Architecture Scan Results

**Date:** 2025-03-25
**Branch:** `next`
**Scanner:** structural analysis of apps/client + apps/src-tauri

---

## 1. Circular Dependencies

**Status: No circular dependencies detected.**

The `apps/client/src/lib/` dependency graph flows cleanly:

- `storage-keys.ts` -- leaf, no imports from lib
- `transport.ts` -- leaf, only imports `@tauri-apps/api`
- `tauri-api/` domain modules -- import only from `transport.ts`
- `tauri-api/index.ts` -- assembles domain modules, re-exports `tauri-api-types.ts`
- `tauri-api.ts` -- thin re-export of `tauri-api/index.ts`
- Consumers (`utils.ts`, `context-menu-factory.ts`, etc.) -- import from `tauri-api` and `storage-keys`, never the reverse

The extension system files have unidirectional imports:
`extension-host.ts` -> `extension-api-factory.ts` -> `extension-sandbox.ts` -> `extension-sandbox-env.ts`

No cycles found in lib/.

---

## 2. God Files

### F2a. `TauriAPI` class -- 344 lines of pure delegation

| Detail | Value |
|---|---|
| **File** | `apps/client/src/lib/tauri-api/index.ts:31-344` |
| **Severity** | P2 |
| **Effort** | M |

The static class has **~310 method assignments** that simply alias domain module functions (`static readDirectory = fileSystem.readDirectory`). The individual domain modules are clean, but this backward-compatible class is a maintenance burden. Any new function requires adding it in 3 places: domain module, static class, and the Rust handler.

**Imported by:** 195 files across the codebase.

**Recommendation:** Deprecate the `TauriAPI` class. Consumers should import named exports directly from `@/lib/tauri-api` or the domain submodules. The tree-shakable exports are already set up on line 18-25.

---

### F2b. `extension-host.ts` -- 1,550 lines

| Detail | Value |
|---|---|
| **File** | `apps/client/src/lib/extension-host.ts` |
| **Severity** | P2 |
| **Effort** | L |

The `ExtensionHost` class manages: panel registry, editor registry, preview registry, command registry, decorator registry, context menu entries, dialog registry, tab registry, theme overrides, status bar items, settings pages, toolbar items, and extension loading/activation. This is a single class with 15+ distinct registries.

**Recommendation:** Extract registries into separate files (e.g., `extension-panel-registry.ts`, `extension-command-registry.ts`) and have `ExtensionHost` compose them.

---

### F2c. `context-menu-factory.ts` -- 1,162 lines

| Detail | Value |
|---|---|
| **File** | `apps/client/src/lib/context-menu-factory.ts` |
| **Severity** | P3 |
| **Effort** | M |

Imports from 10 modules. A large procedural file that builds context menus. Not urgent since context menus are inherently large, but could be split by menu category (file, folder, background, multi-select).

---

### F2d. `main.rs` invoke handler -- 382 registered commands

| Detail | Value |
|---|---|
| **File** | `apps/src-tauri/src/main.rs:140-522` |
| **Severity** | P1 |
| **Effort** | L |

The `invoke_handler` macro registers **382 Tauri commands** in a single block spanning lines 140-522. This is the largest single registration point. Adding or removing commands requires touching this file. No grouping mechanism exists beyond comments.

**Recommendation:** Consider using Tauri 2.x plugin architecture or a macro to auto-register commands from modules. Alternatively, build a `generate_handlers!()` macro that collects from submodules.

---

### F2e. Files exceeding the 1,000-line style limit

| File | Lines |
|---|---|
| `lib/extension-host.ts` | 1,550 |
| `panels/UndoHistoryPanel.tsx` | 1,450 |
| `panels/PerformanceDashboard.tsx` | 1,319 |
| `explorer/SearchResultsPanel.tsx` | 1,284 |
| `dialogs/BulkRenameDialog.tsx` | 1,268 |
| `pages/FileComparisonPage.tsx` | 1,241 |
| `dialogs/ExtensionPermissionDialog.tsx` | 1,241 |
| `lib/extension-lifecycle.ts` | 1,174 |
| `lib/context-menu-factory.ts` | 1,162 |
| `lib/tauri-api-types.ts` | 1,140 |
| `lib/extension-sandbox.ts` | 1,088 |

**Severity:** P2 | **Effort:** M per file

The codebase style guide says "Files under 1,000 lines." 11 files exceed this limit. The type-only file (`tauri-api-types.ts`) is acceptable, but the component and logic files should be split.

---

## 3. Prop Drilling

**Status: Well-mitigated via context.**

The codebase uses `ExplorerContext` (`apps/client/src/contexts/ExplorerContext.tsx`) with 5 sub-contexts (selection, viewSort, splitActions, paneSync, clipboard) and convenience hooks like `useSelectionContext()`. The main `xplorer.tsx` page composes ~15 hooks but passes state through context, not deep prop chains.

No evidence of 3+ level prop drilling in component trees. The split-view system (`EditorGroupPane`, `PaneFileExplorer`) receives callbacks via `SplitActionsContext`.

---

## 4. Module Boundary Violations

### F4a. SDK is bypassed -- TauriAPI used directly instead of SDK

| Detail | Value |
|---|---|
| **File** | 195 files import from `@/lib/tauri-api` |
| **Severity** | P1 |
| **Effort** | XL |

The architecture rule states: "Add new Tauri commands through SDK services, NEVER call `invoke()` directly from components." However, the `@xplorer/sdk` package is only imported by **1 file** (`extension-sandbox.ts`). The entire frontend uses `@/lib/tauri-api` directly, bypassing the SDK entirely.

The SDK (`packages/sdk/`) has a parallel transport layer and service modules but they are essentially unused by the app. The `apps/client/src/lib/tauri-api/` modules and `packages/sdk/src/services/` appear to be duplicate implementations of the same Tauri command wrappers.

**Recommendation:** Either (a) migrate all `@/lib/tauri-api` consumers to `@xplorer/sdk`, or (b) acknowledge that `tauri-api/` IS the SDK and remove the dead `packages/sdk/` code. Currently the two diverge silently.

---

### F4b. No raw `invoke()` calls in components -- transport layer is respected

**Status: Clean.** All Tauri IPC goes through `transport.ts` -> dynamic `import('@tauri-apps/api/core').invoke()`. No component directly calls `invoke()`. The transport abstraction layer (supporting both Tauri and HTTP modes) works correctly.

---

## 5. State Management Coherence

### F5a. localStorage key centralization is mostly good but has gaps

| Detail | Value |
|---|---|
| **File** | `apps/client/src/lib/storage-keys.ts` |
| **Severity** | P2 |
| **Effort** | S |

The `STORAGE_KEYS` constant defines 40+ keys and most files use it properly via `STORAGE_KEYS.SETTINGS`, etc.

**Gaps found:**

1. `apps/client/src/lib/gdrive-plugin.tsx:51` -- uses hardcoded `'gdrive-plugin-settings'` (not in STORAGE_KEYS)
2. `apps/client/src/lib/extension-host.ts:829` -- uses inline template `` `xplorer:ext-consent:${id}` `` (dynamic, but pattern not documented in STORAGE_KEYS)

**Recommendation:** Add `GDRIVE_PLUGIN_SETTINGS: 'gdrive-plugin-settings'` to STORAGE_KEYS. Document the dynamic `xplorer:ext-consent:*` pattern with a helper function.

---

### F5b. localStorage usage volume is high

60+ direct `localStorage.getItem/setItem` calls spread across hooks, lib modules, and components. The pattern is consistent (JSON.stringify/parse with try-catch), but there is no abstraction layer. Each module implements its own load/save logic.

| Detail | Value |
|---|---|
| **Severity** | P3 |
| **Effort** | L |

**Recommendation:** Create a `storage-helpers.ts` with typed `readStorage<T>(key)` / `writeStorage<T>(key, value)` helpers that handle JSON parse, error recovery, and schema validation.

---

## 6. Rust Module Organization

### F6a. 25 top-level modules in lib.rs, flat structure

| Detail | Value |
|---|---|
| **File** | `apps/src-tauri/src/lib.rs:1-27` |
| **Severity** | P2 |
| **Effort** | L |

`lib.rs` declares 25 `pub mod` entries at the top level. Some represent entire features (google_drive, agent, sync) while others are utilities (utils, file_lib). The `operations/` directory is well-organized into sub-modules, but the top level is flat.

**Notable duplication:**
- `watcher.rs` (67 lines) is a thin facade over `file_watcher.rs` (178 lines). The comment says "delegates to file_watcher" -- this is already consolidated but the facade remains for API compatibility.
- `git_integration.rs` (2 lines) just re-exports from `git_history.rs`. Dead module that could be removed once the last commit's re-exports are cleaned up.

---

### F6b. `operations/compression_ops.rs` -- 2,242 lines

| Detail | Value |
|---|---|
| **File** | `apps/src-tauri/src/operations/compression_ops.rs` |
| **Severity** | P2 |
| **Effort** | M |

The largest Rust module. Should be split into `zip_ops.rs`, `tar_ops.rs`, etc.

---

## 7. Extension System Coupling

### F7a. Extension system is tightly coupled to core

| Detail | Value |
|---|---|
| **Severity** | P2 |
| **Effort** | XL |

**Frontend coupling points (18 files import extension-host.ts):**
- `App.tsx` -- initializes extension lifecycle
- `context-menu-factory.ts` -- queries extension context menus
- `LeftSidebar.tsx`, `BottomPanel.tsx`, `RightSidebar.tsx` -- render extension panels
- `StatusBar.tsx` -- renders extension status bar items
- `PreviewPanel.tsx` -- delegates to extension preview providers
- `DialogLayer.tsx` -- renders extension dialogs
- `MarketplacePanel.tsx`, `ExtensionsPanel.tsx` -- extension management UI
- `NavigationBar.tsx` -- extension toolbar items

**Backend coupling:** The Rust `extensions/` module (7 files, ~3,350 lines) has its own WASM runtime (`host_functions.rs`) that exposes `host_read_file`, `host_write_file`, etc., directly calling file system operations. The permission system (`permissions.rs`) is separate but tightly integrated.

**Could it be extracted?** Partially. The frontend extension host, lifecycle, sandbox, registry, and API factory (5 files, ~5,000 lines) form a coherent subsystem. However, they depend on `TauriAPI` for all backend calls and the UI integration points (panels, previews, context menus) are deeply woven into the component tree. Extracting to a separate package would require defining stable interfaces for these 6+ integration points.

---

## 8. API Consistency

### F8a. All Tauri commands use `Result<T, String>` -- no typed errors

| Detail | Value |
|---|---|
| **Severity** | P2 |
| **Effort** | L |

Every `#[tauri::command]` function returns `Result<T, String>`. An `AppError` enum exists in `apps/src-tauri/src/error.rs` with `impl From<AppError> for String`, and an `AppResult<T>` alias is defined. However, **zero commands use it** -- `AppError`/`AppResult` are only referenced in `error.rs` itself. This means:

1. Error messages are ad-hoc strings with no structure
2. The frontend cannot distinguish error types (permission denied vs. not found vs. IO error)
3. The carefully designed `AppError` enum is completely dead code

**118 `#[tauri::command]` functions** across 15 Rust files all use `Result<T, String>`.

**Recommendation:** Incrementally adopt `AppResult<T>` in command signatures. Since `AppError` already implements `Into<String>`, this is backward-compatible with Tauri's serialization. Start with high-traffic modules (file_ops, operations).

---

## Summary Table

| ID | Finding | Severity | Effort | File(s) |
|---|---|---|---|---|
| F2a | TauriAPI static class is 310-line delegation boilerplate | P2 | M | `lib/tauri-api/index.ts` |
| F2b | extension-host.ts is 1,550 lines with 15+ registries | P2 | L | `lib/extension-host.ts` |
| F2c | context-menu-factory.ts at 1,162 lines | P3 | M | `lib/context-menu-factory.ts` |
| F2d | main.rs registers 382 commands in one block | P1 | L | `src/main.rs:140-522` |
| F2e | 11 files exceed 1,000-line limit | P2 | M | (see list above) |
| F4a | SDK package (`@xplorer/sdk`) is dead -- bypassed by all 195 consumers | P1 | XL | `packages/sdk/`, `lib/tauri-api/` |
| F5a | 2 hardcoded localStorage keys outside STORAGE_KEYS | P2 | S | `gdrive-plugin.tsx`, `extension-host.ts` |
| F5b | No localStorage abstraction layer | P3 | L | 60+ callsites |
| F6a | Flat 25-module lib.rs + 2 dead facade modules | P2 | L | `lib.rs`, `git_integration.rs`, `watcher.rs` |
| F6b | compression_ops.rs at 2,242 lines | P2 | M | `operations/compression_ops.rs` |
| F7a | Extension system tightly coupled to core (18 integration points) | P2 | XL | `lib/extension-*.ts` |
| F8a | AppError/AppResult defined but unused -- 118 commands use raw String | P2 | L | `error.rs`, all command modules |

### Priority Actions

1. **P1 -- SDK dead code:** Decide whether `packages/sdk/` or `lib/tauri-api/` is the canonical API layer. Remove the other to prevent silent drift.
2. **P1 -- Command registration scale:** 382 commands in one macro call is a maintenance hazard. Explore Tauri 2.x plugin grouping.
3. **P2 -- Adopt AppError:** Start using the existing typed error enum. It's already compatible with current signatures.
4. **P2 -- Split oversized files:** 11 files exceed the 1,000-line style limit. Prioritize `extension-host.ts` and `UndoHistoryPanel.tsx`.
