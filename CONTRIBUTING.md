# Contributing to Xplorer

Thank you for your interest in contributing to Xplorer!

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 10+
- Rust (latest stable via `rustup`)
- Git

### Quick Start

```bash
git clone https://github.com/kimlimjustin/xplorer.git -b next
cd xplorer
pnpm install
pnpm dev
```

This starts the Vite dev server and the Tauri desktop app together. The app will hot-reload on file changes.

### Project Structure

- `apps/client/` — React frontend (components, hooks, pages)
- `apps/src-tauri/` — Rust backend (file operations, Git, search, AI)
- `packages/sdk/` — Internal TypeScript service layer wrapping Tauri IPC
- `packages/extension-sdk/` — Public API for building extensions
- `packages/create-extension/` — CLI to scaffold new extensions
- `packages/extensions/` — 28 free extensions (themes, tools, previews)
- `apps/web/` — Next.js marketplace server (Prisma, billing, admin)
- `infra/` — Docker Compose for local PostgreSQL
- `scripts/` — Extension signing and utility scripts

### Running Tests

```bash
pnpm test         # Vitest unit tests
pnpm test:tauri   # Rust backend tests
pnpm check        # TypeScript type checking
```

### Building Extensions

```bash
# Create a new extension
npx @xplorer/create-extension my-extension

# Build an existing extension
cd packages/extensions/my-extension
pnpm build
```

## Guidelines

- Write clear commit messages describing the "why", not the "what"
- Add tests for new features when possible
- Follow existing code patterns and conventions
- Keep PRs focused — one feature or fix per PR

## Reporting Issues

- **Bugs**: Open a [GitHub Issue](https://github.com/kimlimjustin/xplorer/issues)
- **Feature requests**: Start a [Discussion](https://github.com/kimlimjustin/xplorer/discussions)
- **Security issues**: Email kimlimjustin@gmail.com directly
