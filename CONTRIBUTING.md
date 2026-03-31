# Contributing to Xplorer

Thank you for your interest in contributing to Xplorer!

## System Dependencies

Tauri 2 requires platform-specific system libraries. See [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) for full details.

**macOS**: Xcode Command Line Tools (`xcode-select --install`)

**Ubuntu/Debian**:

```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev libayatana-appindicator3-dev librsvg2-dev
```

**Fedora**:

```bash
sudo dnf install webkit2gtk4.1-devel gtk3-devel libsoup3-devel libappindicator-gtk3-devel librsvg2-devel
```

**Arch**:

```bash
sudo pacman -S webkit2gtk-4.1 gtk3 libsoup3 libappindicator-gtk3 librsvg
```

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
- `packages/extensions/` — 40+ free extensions (themes, tools, previews)
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

## Full Stack Setup

The quick start above runs the desktop app only. To work on the marketplace web server or features that interact with it, you need a local PostgreSQL database:

```bash
# 1. Start PostgreSQL via Docker
docker compose -f infra/docker-compose.yml up -d

# 2. Configure environment variables
cp apps/web/.env.example apps/web/.env
# Edit apps/web/.env and fill in DATABASE_URL, NEXTAUTH_SECRET, and any
# Stripe keys needed for billing features.

# 3. Run database migrations
cd apps/web && npx prisma migrate dev

# 4. Start the marketplace dev server
cd apps/web && pnpm dev
```

**`pnpm dev` vs `pnpm dev:app`**: `pnpm dev` starts all services (frontend + Tauri backend + marketplace). If you only need the desktop app without the marketplace server, use `pnpm dev:app` from the repo root. To run the marketplace server separately, use `cd apps/web && pnpm dev`.

## Guidelines

- Write clear commit messages describing the "why", not the "what"
- Add tests for new features when possible
- Follow existing code patterns and conventions
- Keep PRs focused — one feature or fix per PR

## Reporting Issues

- **Bugs**: Open a [GitHub Issue](https://github.com/kimlimjustin/xplorer/issues)
- **Feature requests**: Start a [Discussion](https://github.com/kimlimjustin/xplorer/discussions)
- **Security issues**: Email kimlimjustin@gmail.com directly
