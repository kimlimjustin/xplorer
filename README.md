<div align="center">
<img height=150 src="apps/src-tauri/icons/icon.png" />
</div>

<p align="center"><span><b>Xplorer</b>, a customizable, modern and cross-platform File Explorer.</span></p>
<h4 align="center"><span><a href="https://xplorer.space">Website</a></span> • <span><a href="https://github.com/kimlimjustin/xplorer/discussions">Discussions</a></span> • <span><a href="https://xplorer.space/docs">Documentation</a></span> • <span><a href="https://discord.gg/MHGtSWvfUS">Discord</a></span></h4>

<div align="center">

[![LICENSE](https://img.shields.io/github/license/kimlimjustin/xplorer.svg?style=for-the-badge)](https://github.com/kimlimjustin/xplorer/blob/next/LICENSE) [![Download Counts](https://img.shields.io/github/downloads/kimlimjustin/xplorer/total.svg?style=for-the-badge)](https://github.com/kimlimjustin/xplorer/releases) [![Stars Count](https://img.shields.io/github/stars/kimlimjustin/xplorer.svg?style=for-the-badge)](https://github.com/kimlimjustin/xplorer/stargazers) [![Forks Count](https://img.shields.io/github/forks/kimlimjustin/xplorer.svg?style=for-the-badge)](https://github.com/kimlimjustin/xplorer/network/members) [![Watchers Count](https://img.shields.io/github/watchers/kimlimjustin/xplorer.svg?style=for-the-badge)](https://github.com/kimlimjustin/xplorer/watchers) [![Issues Count](https://img.shields.io/github/issues/kimlimjustin/xplorer.svg?style=for-the-badge)](https://github.com/kimlimjustin/xplorer/issues) [![Pull Request Count](https://img.shields.io/github/issues-pr/kimlimjustin/xplorer.svg?style=for-the-badge)](https://github.com/kimlimjustin/xplorer/pulls) [![Follow](https://img.shields.io/github/followers/kimlimjustin.svg?style=for-the-badge&label=Follow&maxAge=2592000)](https://github.com/kimlimjustin) [![Discord Server](https://img.shields.io/discord/893135322093871104?style=for-the-badge)](https://discord.gg/MHGtSWvfUS) [![Ko-Fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/kimlimjustin)

[![Windows Support](https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/kimlimjustin/xplorer/releases) [![Ubuntu Support](https://img.shields.io/badge/Ubuntu-E95420?style=for-the-badge&logo=ubuntu&logoColor=white)](https://github.com/kimlimjustin/xplorer/releases) [![Arch Linux Support](https://img.shields.io/badge/Arch_Linux-1793D1?style=for-the-badge&logo=arch-linux&logoColor=white)](https://github.com/kimlimjustin/xplorer/releases) [![macOS Support](https://img.shields.io/badge/MACOS-adb8c5?style=for-the-badge&logo=macos&logoColor=white)](https://github.com/kimlimjustin/xplorer/releases)

</div>

---

> **This is the `next` branch** — a ground-up rewrite of Xplorer using Tauri 2, React 18, and a new extension system. The previous version is available on the [`master`](https://github.com/kimlimjustin/xplorer/tree/master) branch. This version will heavily support AI features and a more open extension ecosystem. This is not yet production-ready, but you can try it out by following the instructions below. Part of the app is vibe codedly, so expect some rough edges and missing features. Feedback is very welcome!

# What is Xplorer?

Xplorer is a cross-platform file manager built with Rust, Tauri 2, and React 18. It combines fast native file operations with AI assistance, Git integration, and a flexible extension system — all in a single desktop application.

## Features

- **Multiple view modes** — Grid, List, Details, Column, Gallery, and Tree views
- **Hardware-accelerated file operations** — memory-mapped I/O, parallel chunked transfers, SIMD-optimized paths
- **Archive support** — ZIP, TAR, TAR.GZ, TAR.BZ2, TAR.XZ with compression controls and password protection
- **File preview** — images, code (syntax highlighted), Markdown, PDF, Word, spreadsheets, audio, video
- **Search and indexing** — background tokenizer, keyword/fuzzy/semantic/natural language search
- **Git integration** — branch management, staging, commits, diffs, blame, stash, and commit history
- **AI chat and agent** — Claude and Ollama support for file analysis and agentic file operations
- **Duplicate finder** — SHA-256 content hashing with parallel scanning
- **Extension system** — install, activate, and manage extensions; build your own with the Extension SDK
- **Themes** — Tokyo Night, Dracula, Nord, Cyberpunk, Ocean Deep, and more
- **Multi-tab browsing** — tabs persist across restarts
- **Keyboard shortcuts** — fully configurable shortcut profiles
- **Terminal** — integrated terminal panel with SSH support

## Open-Core Model

Xplorer uses an open-core model:

- **Core desktop app** (AGPL-3.0): The full Tauri desktop file explorer with 28 free extensions, the Extension SDK, and the create-extension CLI.
- **Premium extensions**: Advanced features like AI chat, SSH, Google Drive integration, collaboration, and more are available through the Xplorer marketplace.
- **Marketplace server**: The web-based extension marketplace is proprietary.

The desktop app is fully functional without premium components.

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- Rust (latest stable via rustup)

### Development

```bash
# Clone the repository
git clone https://github.com/kimlimjustin/xplorer.git -b next
cd xplorer

# Install dependencies
pnpm install

# Start the development server (frontend + Tauri backend)
pnpm dev
```

### For maintainers (with private submodule)

```bash
git clone --recurse-submodules https://github.com/kimlimjustin/xplorer.git -b next
cd xplorer
pnpm install
pnpm dev:full    # includes marketplace server
```

### Building for Production

```bash
pnpm build
```

### Running Tests

```bash
pnpm test         # frontend unit tests (Vitest)
pnpm test:tauri   # Rust backend tests
```

---

## Architecture

```
xplorer/
├── apps/
│   ├── client/              # React 18 + TypeScript frontend (Vite)
│   └── src-tauri/           # Rust backend (Tauri 2)
├── packages/
│   ├── sdk/                 # @xplorer/sdk — internal service layer
│   ├── extension-sdk/       # @xplorer/extension-sdk — public extension API
│   ├── create-extension/    # CLI for scaffolding new extensions
│   └── extensions/          # 28 free extensions (themes, tools, previews)
├── e2e/                     # Playwright end-to-end tests
└── private/                 # [submodule] premium extensions + marketplace
```

| Layer | Technology |
|---|---|
| Desktop framework | Tauri 2 |
| Backend | Rust (async via Tokio) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Build tool | Vite |
| AI (cloud) | Anthropic Claude API |
| AI (local) | Ollama |
| Parallel processing | Rayon |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

We welcome contributions! Please use [GitHub Issues](https://github.com/kimlimjustin/xplorer/issues) for bug reports and [Discussions](https://github.com/kimlimjustin/xplorer/discussions) for feature requests.

---

## License

AGPL-3.0 License. See [LICENSE](LICENSE) for details.
