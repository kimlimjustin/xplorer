# Xplorer Deployment Plan

**Date:** 2026-03-25
**Scope:** Extension Marketplace Backend, Website, Desktop App Integration, CI/CD Pipeline

---

## Current State Assessment

### What Already Exists

**Monorepo:**
- `apps/web/` -- Next.js 15 marketplace website (already built, Vercel-ready)
- `infra/` -- Docker Compose for PostgreSQL (dev)
- `scripts/` -- `sign-extension.mjs` (SHA-256 checksums), `wait-for-db.mjs`

**Website (`apps/web/`):**
- Tech stack: Next.js 15, React 19, Prisma (PostgreSQL), NextAuth (GitHub OAuth), Vercel Blob (file storage), Tailwind CSS
- **Payments**: NOT using Stripe for now. All extensions are free. Authors who want to monetize should use [GitHub Sponsors](https://github.com/sponsors). Stripe integration is an ongoing/future feature.
- Routes: `(marketing)`, `(marketplace)`, `(dashboard)`, `(admin)`, `(docs)`, `api/`
- API routes: `auth/`, `extensions/`, `categories/`, `billing/`, `webhooks/`, `sponsors/`, `sync/`, `trial/`, `user/`, `admin/`
- Full Prisma schema with: User, Extension, ExtensionVersion, Category, Tag, Review, Download, Purchase, Trial, Donation, SyncedBookmark, SyncedTag
- `DEPLOY.md` -- comprehensive 9-step deployment guide already written
- `vercel.json` -- configured for Vercel deployment
- `.env.example` -- documents all required env vars

**Desktop app (extension system):**
- `apps/src-tauri/src/extensions/manager.rs` -- full install/uninstall/activate/deactivate lifecycle
- Ed25519 signature verification on extension load (`signing.rs`)
- WASM runtime for extension backends (`wasm_runtime.rs`)
- Permission system with sandboxing (`permissions.rs`)
- Native plugin loading disabled until code signing implemented (CRIT-04)

**CI/CD:**
- `.github/workflows/ci.yml` -- lint, typecheck, unit tests, e2e, security audit, Rust check
- `.github/workflows/release.yml` -- cross-platform builds on `v*` tag push (Linux, Windows, macOS via `tauri-apps/tauri-action`)

---

## A. Extension Marketplace Backend

### A1. API (already partially built in `apps/web/src/app/api/`)

**Existing endpoints:**
- `api/extensions/` -- extension CRUD, search, download
- `api/categories/` -- category management
- `api/billing/` -- Stripe checkout, purchase verification
- `api/webhooks/` -- Stripe webhook handler
- `api/sponsors/` -- GitHub Sponsors status check
- `api/auth/` -- NextAuth GitHub OAuth
- `api/sync/` -- cloud bookmark/tag sync
- `api/trial/` -- trial management
- `api/user/` -- user profile
- `api/admin/` -- admin operations

**Needed additions:**

| Endpoint | Purpose | Priority |
|----------|---------|----------|
| `POST /api/extensions/submit` | Accept .xtension upload, validate manifest, queue for review | P0 |
| `GET /api/extensions/[slug]/versions` | List all versions with changelogs | P1 |
| `GET /api/extensions/check-updates` | Batch check: given `{id: version}[]`, return available updates | P0 |
| `POST /api/extensions/[slug]/report` | Flag malicious/broken extensions | P2 |
| `GET /api/extensions/featured` | Curated featured extensions list | P2 |
| `GET /api/extensions/stats` | Marketplace-wide stats (total extensions, downloads) | P3 |

### A2. Storage

**Already configured:**
- **CDN / File storage:** Vercel Blob (`BLOB_READ_WRITE_TOKEN` env var). Extension `.xtension` files are uploaded and served from Vercel's edge CDN.
- **Metadata DB:** Neon PostgreSQL (serverless, auto-scaling). Schema supports versioned downloads with `ExtensionVersion.downloadUrl` and `ExtensionVersion.blobUrl`.
- **Checksums:** `Extension.checksum` and `ExtensionVersion.checksum` fields exist in schema.

**Recommended improvements:**

| Improvement | Rationale | Priority |
|-------------|-----------|----------|
| Add SHA-256 checksum verification on download endpoint | Integrity verification beyond what Blob provides | P1 |
| Set Vercel Blob cache headers for `.xtension` files (1 year, immutable for versioned URLs) | Reduce bandwidth, faster installs | P2 |
| Add download rate limiting per IP (already indexed: `@@index([extensionId, ip, createdAt])`) | Prevent abuse | P1 |
| Consider R2/S3 migration if Blob costs exceed $50/mo at scale | Vercel Blob is 5x more expensive than R2 at volume | P3 |

### A3. Signing Pipeline

**Current state:**
- `scripts/sign-extension.mjs` -- SHA-256 checksum of `dist/index.js`, stored in `package.json xplorer.checksum`
- Desktop app: `signing.rs` performs Ed25519 signature verification + `.sig` file checking
- Each built-in extension has a `.sig` file in `apps/src-tauri/data/extensions/`

**Recommended signing pipeline:**

```
Developer submits .xtension
    |
    v
[API: /api/extensions/submit]
    |-- Validate manifest (name, version, permissions)
    |-- Malware scan (static analysis: no eval, no network in non-permitted)
    |-- Store unsigned package in Blob (staging bucket)
    |
    v
[Review Queue -- Admin Dashboard at /admin]
    |-- Manual review for PENDING extensions
    |-- Check permissions match declared functionality
    |-- Approve or reject with reason
    |
    v
[CI Signing Job -- GitHub Action]
    |-- Triggered by admin approval webhook
    |-- Pull package from staging
    |-- Generate SHA-256 checksum of dist/index.js
    |-- Sign checksum with Ed25519 private key (stored as GitHub Secret)
    |-- Generate .sig file
    |-- Upload signed package + .sig to production Blob bucket
    |-- Update DB: Extension.status = APPROVED, Extension.checksum, downloadUrl
    |
    v
[Available in Marketplace]
```

**Action items:**

| Task | Priority | Effort |
|------|----------|--------|
| Move Ed25519 private key to GitHub Secrets (never in repo) | P0 | S |
| Create `sign-and-publish.yml` GitHub Action for the signing pipeline | P0 | M |
| Add `ExtensionStatus.APPROVED` check to download endpoint | P1 | S |
| Implement static analysis scan (check for eval, unauthorized network access) | P1 | M |
| Add re-signing on version update (new version = new review required) | P1 | S |

### A4. Review Process

**Already built:** Admin route group at `(admin)/` in the web app.

**Recommended process:**

1. **Automated checks (on submit):**
   - Manifest validation (required fields, semver version, valid permissions list)
   - File size limit (e.g., 50MB -- already configured in `next.config.ts` bodySize)
   - Duplicate check (same name/slug)
   - Permission risk scoring (network + filesystem = high risk, theme-only = low risk)

2. **Manual review (admin dashboard):**
   - View source code (dist/index.js is readable)
   - Check permissions vs actual functionality
   - Verify screenshots/description accuracy
   - Approve / Reject with reason (author notification via email)

3. **Post-publish monitoring:**
   - Report endpoint (`/api/extensions/[slug]/report`)
   - Auto-delist after N reports (configurable threshold)
   - Download anomaly detection (spike = possible exploit)

---

## B. Website

### B1. Tech Stack (already decided and built)

| Layer | Technology | Status |
|-------|-----------|--------|
| Framework | Next.js 15 (App Router) | Built |
| UI | React 19 + Tailwind CSS | Built |
| Auth | NextAuth v4 (GitHub OAuth) | Built |
| Database | Prisma + Neon PostgreSQL | Built |
| File storage | Vercel Blob | Configured |
| Payments | Stripe (Checkout + Connect) | Deferred — use GitHub Sponsors for now |
| Content | MDX (next-mdx-remote + rehype-pretty-code + shiki) | Built |
| Hosting | Vercel | Configured |
| Tests | Vitest + Testing Library | Setup exists |

### B2. Hosting

**Decision: Vercel** (already configured)

- `vercel.json` exists with `buildCommand`, `installCommand`, `framework: "nextjs"`
- Security headers configured in `next.config.ts` (X-Frame-Options, X-Content-Type-Options, etc.)
- Vercel Blob for extension file CDN
- Auto-deploys on push (once connected to repo)
- Serverless functions for API routes
- Edge runtime available for performance-critical routes

**Alternative consideration:** Cloudflare Pages would reduce CDN costs at scale but requires migrating from Vercel Blob to R2 and losing Vercel-specific features. Not recommended until monthly costs exceed ~$100.

### B3. Features (by route group)

| Route Group | Features | Status |
|-------------|----------|--------|
| `(marketing)` | Landing page, feature showcase | Built |
| `(marketplace)` | Browse extensions, search, categories, extension detail, install instructions | Partially built (routes: `dashboard/`, `extensions/`, `publish/`) |
| `(dashboard)` | User's installed extensions, purchase history, settings | Built |
| `(admin)` | Extension review queue, user management, analytics | Built |
| `(docs)` | MDX documentation pages | Built |
| `api/` | 10 route groups for backend logic | Built |

**Needed additions:**

| Feature | Priority | Effort |
|---------|----------|--------|
| Extension search with filters (category, pricing, rating, compatibility) | P1 | M |
| `xplorer://` deep link handler (click "Install" on website, opens desktop app) | P1 | M |
| Extension comparison page (side-by-side features/permissions) | P3 | M |
| Author profile pages with published extensions list | P2 | S |
| Extension analytics for authors (downloads over time, ratings trend) | P2 | M |
| API rate limiting middleware | P1 | S |

---

## C. Desktop App Integration

### C1. Extension Discovery and Download

**Current flow (from `manager.rs`):**
1. `ExtensionManager::new()` scans `extensions_dir` on startup
2. `install_extension()` takes a local path, reads `package.json`, validates manifest, validates extension ID (path traversal protection), copies to `extensions_dir`, verifies Ed25519 signature
3. Extensions tracked in `installed_extensions` vec, active list persisted to `active_extensions.json`

**Needed: Marketplace integration flow:**

```
User clicks "Install" in desktop app ExtensionsPanel
    |
    v
[Frontend: ExtensionsPanel.tsx / MarketplacePanel.tsx]
    |-- Fetch extension metadata from marketplace API
    |-- Show extension details, permissions, reviews
    |-- User confirms install
    |
    v
[SDK: @xplorer/sdk extension service]
    |-- invoke("download_extension", { url, expected_checksum })
    |
    v
[Rust: new command in extensions/commands.rs]
    |-- Download .xtension from marketplace CDN
    |-- Verify SHA-256 checksum matches
    |-- Extract to temp directory
    |-- Verify Ed25519 signature (.sig file)
    |-- Call ExtensionManager::install_extension()
    |
    v
[Activation prompt]
    |-- Show ExtensionPermissionDialog.tsx (already exists)
    |-- User reviews and approves permissions
    |-- Call activate_extension()
```

**Action items:**

| Task | Priority | Effort |
|------|----------|--------|
| Add `download_extension` Tauri command (download + verify + install) | P0 | M |
| Add `check_extension_updates` Tauri command (batch version check) | P0 | S |
| Connect MarketplacePanel to live marketplace API (currently may use mock data) | P1 | M |
| Add `xplorer://install/<extension-slug>` URL handler for deep links from website | P1 | M |
| Add download progress events (Tauri event system) | P2 | S |

### C2. Update Checking

**Recommended approach:**

1. **On startup (delayed):** 5 seconds after app loads, background check all installed extensions against marketplace API
2. **Periodic:** Check every 24 hours while app is running
3. **Manual:** User clicks "Check for Updates" in ExtensionsPanel

```rust
// New Tauri command
#[tauri::command]
async fn check_extension_updates(
    installed: Vec<(String, String)>, // Vec<(extension_id, current_version)>
) -> Result<Vec<ExtensionUpdate>, String> {
    // POST to marketplace API /api/extensions/check-updates
    // Returns list of extensions with available updates
}
```

**Auto-update behavior:**
- Theme extensions: auto-update silently (low risk, no permissions change)
- Panel/command extensions with same permissions: prompt user with changelog
- Extensions requesting new permissions: require explicit approval via PermissionDialog
- Never auto-update extensions with `filesystem` or `network` permissions without user consent

| Task | Priority | Effort |
|------|----------|--------|
| Implement startup update check (delayed background task) | P1 | M |
| Add update notification badge on ExtensionsPanel icon | P2 | S |
| Implement permission-diff for updates (detect new permission requests) | P1 | M |
| Add "auto-update themes" setting | P3 | S |

---

## D. CI/CD Pipeline

### D1. Extension Pipeline: Submit -> Review -> Sign -> Publish

**Trigger:** Admin approves extension in web dashboard

```yaml
# .github/workflows/sign-extension.yml (new)
name: Sign Extension

on:
  repository_dispatch:
    types: [extension-approved]

env:
  ED25519_PRIVATE_KEY: ${{ secrets.EXTENSION_SIGNING_KEY }}

jobs:
  sign:
    runs-on: ubuntu-latest
    steps:
      - name: Download unsigned package
        run: curl -o extension.xtension "${{ github.event.client_payload.blob_url }}"

      - name: Extract and verify
        run: |
          mkdir -p ext
          unzip extension.xtension -d ext/
          # Validate manifest
          node -e "const m = require('./ext/package.json'); if (!m.xplorer?.id) process.exit(1)"

      - name: Sign with Ed25519
        run: |
          # Generate .sig file
          node scripts/sign-extension.mjs ext/
          # Ed25519 sign the checksum
          echo "$ED25519_PRIVATE_KEY" | node scripts/ed25519-sign.mjs ext/


      - name: Repackage and upload
        run: |
          cd ext && zip -r ../signed.xtension .
          # Upload to production Blob
          curl -X PUT "${{ github.event.client_payload.upload_url }}" \
            -H "Authorization: Bearer $BLOB_TOKEN" \
            --data-binary @../signed.xtension

      - name: Update database
        run: |
          curl -X POST "$MARKETPLACE_URL/api/admin/extensions/publish" \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -d '{"extensionId": "${{ github.event.client_payload.extension_id }}"}'
```

### D2. Website Pipeline: Deploy on Merge

**Already configured:** Vercel auto-deploys from the repo.

**Recommended enhancements:**

```yaml
# Add to existing ci.yml or create .github/workflows/web.yml
name: Web CI

on:
  push:
    paths: ['apps/web/**']
    branches: [next]
  pull_request:
    paths: ['apps/web/**']

jobs:
  test-web:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: xplorer
          POSTGRES_PASSWORD: xplorer
          POSTGRES_DB: xplorer
        ports: ['5432:5432']
        options: --health-cmd pg_isready
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: cd apps/web && pnpm db:push
        env:
          DATABASE_URL: postgresql://xplorer:xplorer@localhost:5432/xplorer
      - run: cd apps/web && pnpm test:run
        env:
          DATABASE_URL: postgresql://xplorer:xplorer@localhost:5432/xplorer
```

**Vercel deployment flow:**
- Preview deploys on PR (auto)
- Production deploy on merge to `next` (auto)
- Database migrations: run `pnpm db:push` or `pnpm db:migrate` manually before deploy if schema changes

### D3. Desktop App Pipeline: Build on Tag

**Already configured** in `.github/workflows/release.yml`:
- Triggers on `v*` tag push
- Runs full CI first (lint, typecheck, unit tests, Rust check)
- Builds for 3 platforms: `x86_64-unknown-linux-gnu`, `x86_64-pc-windows-msvc`, `aarch64-apple-darwin`
- Uses `tauri-apps/tauri-action@v0` for cross-platform builds
- Creates draft GitHub release with artifacts (.deb, .AppImage, .msi, .exe, .dmg)

**Recommended improvements:**

| Improvement | Priority | Effort |
|-------------|----------|--------|
| Add `x86_64-apple-darwin` target (Intel Macs still significant market) | ✅ Done | S |
| Add code signing for macOS (Apple Developer notarization) | Optional | M |
| Add code signing for Windows (Authenticode certificate) | Optional | M |
| Add auto-update via Tauri updater (check GitHub releases API) | P1 | L |
| Add Rust tests to release gate (currently only in CI, not release) | ✅ Done | S |
| Publish release notes from CHANGELOG.md instead of generic message | P2 | S |
| Add Homebrew cask formula update automation | P3 | M |
| Add AUR package update automation | P3 | M |

---

## Deployment Checklist (Recommended Order)

### Phase 1: Foundation (Week 1-2)
- [x] Add `download_extension` Tauri command — ✅ implemented
- [x] Add `check_extension_updates` Tauri command — ✅ implemented
- [x] Create `sign-extension.yml` GitHub Action — ✅ implemented
- [x] Create `web.yml` CI workflow for apps/web — ✅ implemented
- [x] Add Intel Mac build target in release.yml — ✅ implemented
- [x] Add Rust tests to release gate — ✅ implemented
- [ ] Fix 8 failing Rust tests (security URL validation + command sanitization)
- [ ] Move Ed25519 signing key to GitHub Secrets (see `docs/deployment-manual.md`)
- [ ] Deploy marketplace website to Vercel (follow `apps/web/DEPLOY.md`)
- [ ] Push Prisma schema to Neon, run seed

### Phase 2: Security + Integration (Week 2-3)
- [ ] Implement static analysis scan for submitted extensions
- [ ] Add download rate limiting to API
- [ ] Add checksum verification to download endpoint
- [ ] Connect MarketplacePanel to live marketplace API
- [ ] Implement startup update checking (background task)
- [ ] Add `xplorer://install/<slug>` deep link handler

### Phase 3: Polish (Week 3-5)
- [ ] Implement permission-diff for extension updates
- [ ] Add extension search with filters to website
- [ ] Add Tauri auto-updater for desktop app
- [ ] Add author profile pages to website
- [ ] Add extension analytics dashboard for authors
- [ ] Write extension publishing guide for third-party developers
- [ ] Add update notification badge to ExtensionsPanel

### Phase 4: Scale (Ongoing)
- [ ] Monitor Vercel Blob costs, evaluate R2 migration if needed
- [ ] Add download anomaly detection
- [ ] Add Homebrew/AUR package automation
- [ ] Add extension comparison page

### Optional: Code Signing (when needed)
- [ ] macOS: Apple Developer account + notarization ($99/yr)
- [ ] Windows: Authenticode certificate (~$200/yr)
- [ ] App works fine without signing — users just click through OS warning
