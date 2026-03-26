# Changelog

## v2.0.0 (Unreleased)

Complete ground-up rewrite of Xplorer.

### Architecture
- Migrated from Tauri 1.x to **Tauri 2**
- Frontend rewritten from scratch with **React 18** + TypeScript + Vite
- Backend rewritten in **Rust** with async Tokio runtime
- Monorepo structure: `apps/client` (frontend), `apps/src-tauri` (backend), `packages/` (SDK, extensions)
- pnpm workspaces replacing yarn

### New Features
- **Extension system** with marketplace, SDK, and CLI scaffolding tool
- **AI chat and agent** — Claude and Ollama integration for file analysis and autonomous file operations
- **Git integration** — branch management, staging, commits, diffs, blame, stash, commit history
- **SSH remote access** — connection management, remote file browsing via SFTP, SSH terminal
- **Search and indexing** — background tokenizer, fuzzy/semantic/natural language search
- **Duplicate finder** — SHA-256 content hashing with parallel scanning
- **File organizer** — AI-powered directory analysis and reorganization suggestions
- **Storage analytics** — disk space breakdown, type distribution, size categories
- **Hardware-accelerated file operations** — memory-mapped I/O, SIMD-optimized paths, parallel transfers
- **Archive support** — ZIP, TAR, TAR.GZ, TAR.BZ2, TAR.XZ with password protection
- **File comparison** — side-by-side diff view with SHA-256 hash verification
- **File tags and colors** — custom tag system with per-file color categorization
- **Advanced selection** — filter by extension, size, date, glob/regex patterns
- **Bookmarks** — persistent path bookmarks with custom names
- **Bulk rename** — regex pattern-based renaming with live preview
- **Recycle bin management** — browse, restore, permanently delete

### UI Improvements
- **Multiple view modes** — Grid, List, Details, Column, Gallery, Tree
- **Split pane** — side-by-side directory browsing
- **Bottom panel system** — Terminal, Activity Log, Clipboard, Notifications, Changes
- **Right sidebar** — Preview, Properties, Extensions panels
- **Command palette** — quick access to all commands
- **6 built-in themes** — Tokyo Night, Dracula, Nord, Cyberpunk, Ocean Deep, Catppuccin
- **Integrated terminal** — with SSH terminal support
- **Vim mode** — keyboard navigation for power users

### Developer Experience
- **Extension SDK** (`@xplorer/extension-sdk`) — public API for building extensions
- **Create Extension CLI** (`@xplorer/create-extension`) — scaffold new extensions
- **IIFE extension format** — sandboxed execution with require() shim
- **28 free extensions** included (themes, tools, previews)
- **CI/CD** — GitHub Actions for lint, test, build across Windows/macOS/Linux

### Security
- Tauri IPC boundary for all file operations
- Extension sandbox with Proxy-based global blocking
- CSRF protection on API routes
- Extension permission model
- No telemetry or data collection

### Open Source
- Fully open source under **AGPL-3.0** — desktop app, Extension SDK, and web marketplace (`apps/web/`)
- Extensions are distributed through a separate public repository
