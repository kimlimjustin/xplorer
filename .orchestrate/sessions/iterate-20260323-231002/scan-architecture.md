# Architecture Scan Report

**Scanner**: Architecture
**Date**: 2026-03-23
**Scope**: Dependency directions, API design, pattern consistency, scalability, module boundaries

---

## Executive Summary

The codebase has a well-intentioned layered architecture (Components -> TauriAPI/SDK -> transport -> Rust), but the layers are **incompletely adopted** and have **significant duplication**. The dependency direction discipline is good (no `invoke()` in components), but the SDK layer is essentially dead code used by only 1 file. Two parallel git modules and two parallel file-watcher modules exist with overlapping responsibilities. The single 380-command `invoke_handler` and 1802-line TauriAPI facade are scalability bottlenecks that will get worse as features are added.

---

## Findings

### F-ARCH-01: SDK layer is dead -- nearly unused

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Effort** | L |
| **Files** | `packages/sdk/src/index.ts`, `apps/client/src/lib/tauri-api.ts` |

**Problem**: The SDK package (`@xplorer/sdk`) exports 22 service namespaces and a full type system, but **only 1 file** in the entire frontend imports from it (`extension-sandbox.ts`). Meanwhile, **194 files** import from `@/lib/tauri-api` directly. The SDK was intended to be the canonical abstraction layer but was never adopted.

**Impact**: Two parallel API surfaces maintained in sync. The 1802-line `TauriAPI` class with 299 static methods is the de facto API, making the SDK package pointless overhead.

**Suggested fix**: Choose one canonical layer. Either (a) migrate all consumers to SDK and deprecate TauriAPI class, or (b) delete the SDK services layer and have the SDK re-export from tauri-api.ts. Option (a) is architecturally cleaner but higher effort; option (b) eliminates duplication immediately.

---

### F-ARCH-02: SDK types are copy-pasted, not shared

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Effort** | S |
| **Files** | `packages/sdk/src/types/index.ts` (1109 lines), `apps/client/src/lib/tauri-api-types.ts` (1140 lines) |

**Problem**: The SDK has its own `types/index.ts` (1109 lines) described as "mirrored from tauri-api.ts". These are manually duplicated from `tauri-api-types.ts` (1140 lines), not imported or auto-generated. Any type change requires updating both files.

**Impact**: Type drift between the two files will cause subtle runtime bugs. This is a maintenance trap.

**Suggested fix**: Make SDK types the single source of truth. Have `tauri-api-types.ts` re-export from the SDK, or extract types into a shared `packages/types` package.

---

### F-ARCH-03: SDK transport.ts re-exports from client app (inverted dependency)

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Effort** | S |
| **Files** | `packages/sdk/src/transport.ts` |

**Problem**: The SDK's `transport.ts` is a single line:
```typescript
export { transport, listenToEvent, convertAssetUrl, isTauri, getApiUrl } from '../../../apps/client/src/lib/transport';
```
A package (`packages/sdk`) imports from the application (`apps/client`). This is an **inverted dependency** -- the package layer depends on the application layer rather than the other way around.

**Impact**: The SDK cannot be consumed outside the monorepo. It cannot be published to npm. It cannot be tested independently. The layering is architecturally backwards.

**Suggested fix**: Move `transport.ts` into the SDK package. Have `apps/client/src/lib/transport.ts` re-export from `@xplorer/sdk` (or import directly).

---

### F-ARCH-04: Duplicate git modules (git_history + git_integration)

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Effort** | M |
| **Files** | `apps/src-tauri/src/git_history.rs` (1347 lines), `apps/src-tauri/src/git_integration.rs` (180 lines) |

**Problem**: Two Rust modules handle git functionality:
- `git_history.rs`: Full git operations (commits, branches, blame, diff, stash) using `git2` crate -- 20 commands registered
- `git_integration.rs`: Status bar info (repo status, branch) also using `git2` -- 2 commands registered

Both open `git2::Repository` independently. The frontend has separate `Git` service (from SDK) and git-related TauriAPI methods. On the Rust side, `git_history` exposes `find_git_repository`, `get_repository_info`, `get_file_status`, `get_branches` -- functionality that overlaps with what `git_integration` provides at a simpler level.

**Impact**: Duplicated repo-opening logic, potential for inconsistent behavior between the two modules, confusing API surface.

**Suggested fix**: Merge `git_integration.rs` into `git_history.rs` as a lightweight subset, or extract shared `git2::Repository` access into a utility module.

---

### F-ARCH-05: Duplicate file watcher modules (watcher + file_watcher)

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Effort** | M |
| **Files** | `apps/src-tauri/src/watcher.rs`, `apps/src-tauri/src/file_watcher.rs` |

**Problem**: Two nearly identical file-watching modules exist:
- `watcher.rs`: Single-directory watcher using `notify_debouncer_full`, emits `FsChangeEvent`, stores in a single `Option<WatcherHandle>` global
- `file_watcher.rs`: Multi-directory watcher using the same `notify_debouncer_full`, emits `FileChangeEvent`, stores in a `HashMap<String, WatcherEntry>` global

Both use the same underlying crate, the same debouncing strategy, and emit similar event structures. The multi-watcher (`file_watcher`) is strictly more capable.

**Impact**: Confusing API surface, duplicated code, two global watcher states that could interfere. Both are shut down on `CloseRequested` but independently.

**Suggested fix**: Remove `watcher.rs`. Migrate its consumers to use `file_watcher.rs` (the multi-watcher version). If a "current directory" semantic is needed, it can be a named watcher in the multi-watcher.

---

### F-ARCH-06: Monolithic 380-command invoke_handler

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Effort** | L |
| **Files** | `apps/src-tauri/src/main.rs` (lines 140-522) |

**Problem**: All 380 Tauri commands are registered in a single `tauri::generate_handler![]` macro invocation spanning ~380 lines of main.rs. This is the largest compile-time macro expansion in the codebase.

**Impact**:
1. **Compile time**: The `generate_handler!` macro processes all 380 commands at once, likely contributing to long compile times.
2. **Readability**: While comments section the commands, it's a wall of registrations.
3. **Feature gating impossible**: Cannot conditionally compile subsets (e.g., skip Docker commands on non-Docker systems).

**Suggested fix**: Tauri 2.x supports plugins for command namespacing. Group related commands into internal Tauri plugins (e.g., `tauri-plugin-git`, `tauri-plugin-ai`). This enables:
- Conditional compilation with feature flags
- Smaller incremental rebuilds when only one plugin changes
- Natural API namespacing on the frontend

---

### F-ARCH-07: TauriAPI facade is a 1802-line god class

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Effort** | M |
| **Files** | `apps/client/src/lib/tauri-api.ts` (1802 lines, 299 static methods) |

**Problem**: The `TauriAPI` class has 299 static methods covering every domain (file system, AI, git, search, extensions, docker, etc.) in a single file. It violates the project's own rule of "files under 1000 lines" and is the largest TypeScript file in the codebase.

**Impact**: Hard to navigate, poor IDE performance on this file, merge conflicts when multiple features touch it, single responsibility principle violation.

**Suggested fix**: If keeping TauriAPI (vs migrating to SDK), split it into domain files that the main file re-exports:
```
lib/tauri-api/index.ts      (re-exports)
lib/tauri-api/file-system.ts
lib/tauri-api/git.ts
lib/tauri-api/ai.ts
...etc
```
This mirrors what the SDK already does with its services/ directory.

---

### F-ARCH-08: Extension system has 4264 lines of host-side code in 5 files

| Field | Value |
|-------|-------|
| **Severity** | P3 |
| **Effort** | L |
| **Files** | `extension-host.ts` (1751), `extension-sandbox.ts` (1293), `extension-api-factory.ts` (782), `extension-host-types.ts` (315), `extension-host-icon.ts` (123) |

**Problem**: The extension host system totals 4264 lines across 5 tightly-coupled files. The `ExtensionHost` class alone manages 13+ registries (panels, editors, previews, commands, decorators, context menus, dialogs, tabs, sidebar tabs, bottom tabs, schemes, events). The sandbox creates a full API surface by gating every TauriAPI method behind permission checks.

**Impact**: Adding a new extension capability requires touching 3-4 files. The sandbox has to manually proxy every TauriAPI method. Extension loading happens in the main thread's JS context (not a Web Worker or iframe), limiting isolation.

**Suggested fix**:
1. Short-term: Extract each registry into its own module (`panel-registry.ts`, `command-registry.ts`, etc.)
2. Medium-term: Auto-generate the sandbox API surface from the permission manifest instead of manually proxying each method
3. Long-term: Consider iframe-based isolation for true sandboxing

---

### F-ARCH-09: Naming inconsistency in Rust commands

| Field | Value |
|-------|-------|
| **Severity** | P3 |
| **Effort** | S |
| **Files** | `apps/src-tauri/src/main.rs` |

**Problem**: Command naming conventions are inconsistent:
- Some use `get_` prefix: `get_file_properties`, `get_trash_items`, `get_ai_models`
- Some omit it: `find_files`, `search_in_files`, `list_drives`
- Google Drive commands are prefixed with `gdrive_`: `gdrive_authenticate`, `gdrive_list_files`
- Agent commands mix `agent_` prefix and no prefix: `agent_chat`, `agent_respond_approval` vs `get_agent_settings`
- Docker commands prefixed with `docker_`: `docker_is_available`, `docker_list_containers`
- Some use `is_` for booleans: `is_dir`, `is_archive`, `is_encrypted_file`
- One uses `file_exist` (not `file_exists`)

**Impact**: Inconsistent API makes it harder to discover and remember command names. The `file_exist` typo is particularly confusing.

**Suggested fix**: Establish a naming convention document. Fix `file_exist` -> `file_exists`. Consider namespacing via Tauri plugins (see F-ARCH-06) which would naturally solve the prefix issue.

---

### F-ARCH-10: Bare .unwrap() in production Rust code (non-test)

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Effort** | S |
| **Files** | `apps/src-tauri/src/operations/encryption_ops.rs:168` |

**Problem**: Line 168 of `encryption_ops.rs` contains:
```rust
let output_path = path.strip_suffix(".enc").unwrap().to_string();
```
While there is a guard at line 164 that checks `path.ends_with(".enc")`, the `unwrap()` is still fragile -- a refactor that moves the guard could introduce a panic. The overall codebase has 544 `.unwrap()` calls across 33 Rust files, though most are in test code. The Mutex guarding pattern is done correctly (`.unwrap_or_else(|e| e.into_inner())`), which is good.

**Impact**: A panic in a Tauri command crashes the IPC handler, potentially freezing the UI. The guard-before-unwrap pattern is brittle.

**Suggested fix**: Replace with `.ok_or_else(|| "...".to_string())?` pattern for production code. Run `clippy::unwrap_used` lint on non-test code to catch these.

---

### F-ARCH-11: No dependency injection -- all modules use global statics

| Field | Value |
|-------|-------|
| **Severity** | P3 |
| **Effort** | XL |
| **Files** | `watcher.rs`, `file_watcher.rs`, `duplicate_finder.rs`, `shortcuts/mod.rs`, `extensions/manager.rs` |

**Problem**: Rust modules use `LazyLock<Arc<Mutex<...>>>` for global singletons. While this works and the Mutex guards are properly handled, it means:
- Modules cannot be tested in isolation (global state leaks between tests)
- Cannot run multiple instances (e.g., for integration testing)
- Module replacement requires code changes, not configuration

**Impact**: Lower testability, harder to swap implementations (e.g., replacing file watcher for testing).

**Suggested fix**: Use Tauri's built-in `app.manage()` state system for module state instead of global statics. This enables per-app-handle state and cleaner testing.

---

### F-ARCH-12: Extension-sandbox imports from both TauriAPI and SDK

| Field | Value |
|-------|-------|
| **Severity** | P3 |
| **Effort** | S |
| **Files** | `apps/client/src/lib/extension-sandbox.ts` |

**Problem**: `extension-sandbox.ts` is the only file that imports from `@xplorer/sdk` (for `Duplicates`, `Organizer`, `Analytics` services and some types), while also importing from `@/lib/tauri-api` (for `TauriAPI` class). This mixed usage makes the dependency graph confusing.

**Impact**: Unclear which layer is canonical for the extension sandbox. Increases coupling to both layers simultaneously.

**Suggested fix**: When resolving F-ARCH-01 (SDK adoption), ensure extension-sandbox uses one consistent layer.

---

## Positive Findings

### Good: No invoke() calls in components
Zero instances of direct `invoke()` calls in `apps/client/src/components/`. All calls go through `TauriAPI` static methods or the transport layer. The dependency direction discipline is clean.

### Good: No invoke() calls in hooks
Zero instances of direct `invoke()` calls in `apps/client/src/hooks/`. Hooks properly use `TauriAPI`.

### Good: Transport abstraction is well-designed
`transport.ts` (136 lines) cleanly abstracts Tauri IPC vs HTTP, supports both modes, handles asset URLs and event listeners. The dual-mode capability enables future web-only deployment.

### Good: Mutex guard pattern consistently applied
No instances of bare `.lock().unwrap()` found. All Mutex guards use the `.unwrap_or_else(|e| e.into_inner())` pattern as specified in the project's CLAUDE.md.

### Good: SDK service structure is clean
The SDK's `services/` directory has well-separated domain modules (22 files). If adopted, this structure would provide a much better API than the monolithic TauriAPI class.

---

## Priority Summary

| ID | Severity | Effort | Finding |
|----|----------|--------|---------|
| F-ARCH-01 | P1 | L | SDK layer is dead -- nearly unused (1 consumer vs 194 for TauriAPI) |
| F-ARCH-02 | P1 | S | SDK types are copy-pasted, not shared (1109 vs 1140 lines) |
| F-ARCH-03 | P2 | S | SDK transport.ts has inverted dependency on apps/client |
| F-ARCH-04 | P2 | M | Duplicate git modules (git_history + git_integration) |
| F-ARCH-05 | P2 | M | Duplicate file watcher modules (watcher + file_watcher) |
| F-ARCH-06 | P2 | L | Monolithic 380-command invoke_handler |
| F-ARCH-07 | P2 | M | TauriAPI is a 1802-line god class with 299 methods |
| F-ARCH-08 | P3 | L | Extension host system is 4264 lines across 5 tightly-coupled files |
| F-ARCH-09 | P3 | S | Naming inconsistency in Rust commands (file_exist typo) |
| F-ARCH-10 | P2 | S | Bare .unwrap() in production encryption code |
| F-ARCH-11 | P3 | XL | No dependency injection -- all modules use global statics |
| F-ARCH-12 | P3 | S | Extension-sandbox imports from both TauriAPI and SDK |

## Recommended Action Order

1. **F-ARCH-02** (S effort, P1): Make types a single source of truth -- quick win, eliminates drift risk
2. **F-ARCH-03** (S effort, P2): Fix inverted dependency in SDK transport
3. **F-ARCH-10** (S effort, P2): Replace bare unwrap in encryption module
4. **F-ARCH-09** (S effort, P3): Fix `file_exist` -> `file_exists` naming
5. **F-ARCH-05** (M effort, P2): Consolidate file watchers
6. **F-ARCH-04** (M effort, P2): Consolidate git modules
7. **F-ARCH-07** (M effort, P2): Split TauriAPI into domain files
8. **F-ARCH-01** (L effort, P1): Decide and execute SDK adoption strategy
9. **F-ARCH-06** (L effort, P2): Move to Tauri plugin-based command registration
10. **F-ARCH-08** (L effort, P3): Refactor extension host registries
11. **F-ARCH-11** (XL effort, P3): Migrate to Tauri managed state (do opportunistically)
