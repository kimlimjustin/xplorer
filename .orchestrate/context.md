# Project Context

## Basic Info
- **Project**: Xplorer
- **Type**: Monorepo (Tauri 2.x desktop file manager)
- **Languages**: TypeScript (~622 source files), Rust (~113 source files)
- **Frameworks**: React 18, Vite 5, Tauri 2.10, Tailwind CSS 3.4
- **Database**: SQLite (rusqlite) + localStorage on frontend
- **Package Manager**: pnpm
- **License**: AGPL-3.0
- **LOC**: ~234K (source), ~262K (including JSON/CSS)

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Desktop App (Tauri 2.x)                │
├──────────────────────────┬───────────────────────────────┤
│   React Frontend         │   Rust Backend                │
│   (apps/client/)         │   (apps/src-tauri/)           │
│                          │                               │
│   Vite + TypeScript      │   26 modules in lib.rs        │
│   Tailwind CSS           │   23 operation modules        │
│   wouter routing         │   10 extension modules        │
│   @tanstack/react-query  │   Search engine (FST+roaring) │
│   lucide-react icons     │   Git integration (git2)      │
│   i18next (4 locales)    │   AI (ollama-rs)              │
│                          │   WASM runtime (wasmi)        │
├──────────────────────────┼───────────────────────────────┤
│   Extension Host         │   Extension Backend           │
│   (sandbox + iframe)     │   (WASM modules)              │
│   @xplorer/extension-sdk │   host_functions.rs           │
├──────────────────────────┴───────────────────────────────┤
│   Packages                                               │
│   packages/sdk/          — internal SDK wrapping invoke() │
│   packages/extension-sdk/ — sandboxed extension API       │
│   packages/create-extension/ — scaffolder CLI             │
│   packages/extensions/   — ~25 built-in extensions        │
│   private/extensions/    — unreleased extension prototypes│
│   private/web/           — marketplace website            │
└──────────────────────────────────────────────────────────┘
```

## Key Subsystems
- **File Operations**: 23 ops modules (file, directory, trash, compression, encryption, image, docker, etc.)
- **Extension System**: Package-based, WASM backend support, permission model, signing, marketplace
- **Search Engine**: Full-text search with FST indexes, roaring bitmaps, AI-powered semantic search
- **AI Integration**: Ollama-based chat, file analysis, filename suggestions, auto-tagging
- **Git Integration**: Full git UI (history, blame, branches, stash, commit) via git2 crate
- **Storage**: SQLite-backed tags, notes, annotations, bookmarks, chat history, extension storage
- **Cloud Sync**: Google Drive integration, bookmark/tag sync

## Codebase Metrics
- **Total source files**: ~735 (622 TS/TSX + 113 RS)
- **Test files**: ~116
- **Test-to-source ratio**: ~15.8% (decent for TS, low for Rust)
- **Largest files** (over 1000 lines):
  - search/compat.rs: 2330 lines
  - compression_ops.rs: 2242 lines
  - search/index.rs: 2036 lines
  - tauri-api.ts: 1802 lines
  - extension-host.ts: 1751 lines
  - UndoHistoryPanel.tsx: 1450 lines
  - file_ops.rs: 1447 lines
  - git_history.rs: 1347 lines
  - extension commands.rs: 1323 lines
  - PerformanceDashboard.tsx: 1319 lines
  - extension-sandbox.ts: 1293 lines
  - SearchResultsPanel.tsx: 1284 lines
- **`any` type usage**: ~55 occurrences (low — good discipline)
- **Extensions**: ~25 built-in public + ~10 private prototypes

## Quality Infrastructure
- **CI/CD**: GitHub Actions — lint+typecheck, unit tests, E2E (Playwright), Rust check+clippy+fmt+test
- **Linting**: ESLint + Prettier (TS), clippy + rustfmt (Rust)
- **Pre-commit**: Husky + lint-staged
- **Testing**: Vitest + jsdom (frontend), cargo test (Rust), Playwright (E2E)
- **Type checking**: TypeScript strict mode

## Git Activity
- **Branch**: `next` (main development branch)
- **Recent focus**: Extension system (WASM backends, permissions, signing), search engine, git integration, security hardening, performance optimization
- **Change hotspots**: TopBar.tsx, OperationBar.tsx, tauri-api.ts, extension-host.ts, ChatPanel.tsx, LeftSidebar.tsx
- **Commit style**: Conventional commits (feat/fix/refactor/chore)

## Extension Pattern
- `package.json` with `xplorer` manifest field (id, category, icon, permissions, activationEvents, contributes)
- `src/index.tsx` with SDK imports and registration calls
- Build: esbuild (IIFE format, externals: react, react-dom, @xplorer/extension-sdk)
- API injected via `onActivate(api)`, provides: files, navigation, ui, storage, events
- WASM backends for compute-heavy operations (compress, extract, hash, git, etc.)

## Key APIs
- `api.navigation.navigateTo(path)` — navigate main pane to folder
- `api.navigation.openFile(path)` — open a file
- `api.files.exists(path)` — check if path exists
- `api.files.list(path)` — list directory
- `api.storage.get/set` — persisted extension storage

## Key Strengths (Initial)
- Well-structured monorepo with clear separation of concerns
- Comprehensive CI/CD pipeline
- Good TypeScript discipline (few `any` types)
- Conventional commits
- Extensive feature set for a file manager
- Extension system with permission model and sandboxing

## Key Concerns (Initial)
- Multiple files over 1000 lines (need splitting)
- Low Rust test coverage (lib.rs has trivial placeholder tests)
- Massive main.rs invoke_handler (~380 commands registered)
- Extension system complexity (10 modules, WASM runtime)
- Search engine has large compat layer (2330 lines)
