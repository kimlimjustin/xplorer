# Plan: Open-Source the Private Folder

## 1. Overview

### What
Dissolve the `private` git submodule and merge its web marketplace server and infrastructure into the main Xplorer monorepo. The premium extensions are **out of scope** (they'll be extracted to a separate public repo in a different effort).

### Why
Xplorer is transitioning from open-core to fully open-source. All code that runs the marketplace, billing, cloud sync, and infrastructure should be publicly visible and contributable.

### Scope Table

| Component | Source | Destination | Action |
|-----------|--------|-------------|--------|
| Web marketplace | `private/web/` | `apps/web/` | Copy source files, update paths |
| Docker Compose | `private/infra/docker-compose.yml` | `infra/docker-compose.yml` | Copy |
| Scripts | `private/scripts/*.mjs` | `scripts/*.mjs` | Copy |
| Git submodule | `.gitmodules` + `private/` | N/A | Remove entirely |
| CI workflow | `.github/workflows/web.yml` | Same file | Update paths, remove private token |
| Workspace config | `pnpm-workspace.yaml` | Same file | Update package paths |
| Root package.json | `package.json` | Same file | Update script paths |

### Out of Scope
- Premium extensions (`private/extensions/`) — separate repo effort
- The nested `private/xplorer/` submodule (circular reference, irrelevant)
- Database migration or production deployment
- Stripe/billing changes (keep as-is, it's generic)

---

## 2. Architecture

### Before (Current)
```
xplorer/                          ← public repo
├── apps/client/                  ← React frontend (React 18)
├── apps/src-tauri/               ← Rust backend
├── packages/                     ← SDK, extension-sdk, extensions
├── private/                      ← GIT SUBMODULE → xplorer-private.git
│   ├── web/                      ← Next.js marketplace (React 19)
│   ├── extensions/               ← 12 premium extensions
│   ├── infra/                    ← Docker Compose
│   ├── scripts/                  ← Signing + DB scripts
│   └── xplorer/                  ← Nested submodule (circular)
└── .gitmodules                   ← References private submodule
```

### After (Target)
```
xplorer/                          ← public repo (everything open)
├── apps/client/                  ← React frontend — React 18 (unchanged)
├── apps/src-tauri/               ← Rust backend (unchanged)
├── apps/web/                     ← Next.js marketplace — React 19 (NEW LOCATION)
│   ├── prisma/
│   ├── src/
│   ├── scripts/
│   ├── .env.example
│   ├── package.json
│   └── ...
├── packages/                     ← SDK, extension-sdk, extensions (unchanged)
├── infra/
│   └── docker-compose.yml        ← Local dev PostgreSQL (NEW LOCATION)
├── scripts/
│   ├── sign-extension.mjs        ← Extension signing (NEW LOCATION)
│   └── wait-for-db.mjs           ← DB readiness check (NEW LOCATION)
└── (NO .gitmodules, NO private/)
```

### Key Decisions

**React 18 vs 19 coexistence**: The desktop app uses React 18 (root `package.json`), the web app uses React 19 (Next.js 15 requirement). pnpm workspaces handle this — each workspace resolves its own React version. React 18 is hoisted at root, React 19 is installed in `apps/web/node_modules/`. No overrides needed.

**pnpm version**: The web app's `package.json` declares `"packageManager": "pnpm@9.15.0"` — this must be removed since the monorepo uses pnpm 10. Only the root should declare packageManager.

**Lockfile**: The web app has its own `pnpm-lock.yaml` (5141 lines) which is invalid in a workspace. It must be excluded from the copy. After workspace config changes, `pnpm install` regenerates the root lockfile.

**postinstall**: The web app's `postinstall` (`prisma generate && node scripts/link-prisma.mjs`) will run for ALL `pnpm install` invocations. This needs to be guarded so desktop-only contributors aren't blocked by Prisma binary issues.

---

## 3. Data Model

No changes to the Prisma schema. The `.env.example` is already properly templated.

**Secret handling**: The `.env` file (with real Neon credentials) is NOT copied. Only `.env.example` is included.

---

## 4. Task Breakdown

### Task 1: Remove git submodule
**Acceptance Criteria**:
- `private/` removed from git tracking
- `.gitmodules` deleted
- `.git/modules/private` cleaned up

**Method**: `git submodule deinit -f private && git rm -f private && rm -rf .git/modules/private`

**Files**: `.gitmodules`, `private/`

---

### Task 2: Copy all files to new locations
**Acceptance Criteria**:
- All source files from `private/web/` exist at `apps/web/`
- Excluded: `.env`, `.env.local`, `node_modules/`, `.next/`, `.tsbuildinfo`, `pnpm-lock.yaml`, `.client-components/`
- Included: `.env.example`, `DEPLOY.md`, `prisma/`, `src/`, `scripts/`, `public/`, `content/`, config files
- `infra/docker-compose.yml` exists at project root level
- `scripts/sign-extension.mjs` and `scripts/wait-for-db.mjs` exist at project root level

**Files**: `apps/web/**` (new), `infra/docker-compose.yml` (new), `scripts/*.mjs` (new)

---

### Task 3: Update web app for new monorepo location
**Acceptance Criteria**:
- `package.json` — remove `"packageManager": "pnpm@9.15.0"` field
- `package.json` — guard `postinstall` so it doesn't block desktop-only contributors (e.g., `prisma generate 2>/dev/null || true`)
- `vercel.json` — `installCommand` updated: `cd ../.. && pnpm install` (two levels up from `apps/web/` to reach monorepo root)
- `next.config.ts` — `outputFileTracingRoot` updated from `path.join(__dirname, '../')` to `path.join(__dirname, '../../')` (point to monorepo root)
- `scripts/prepare-client-components.sh` — source path updated from `$WEB_DIR/../xplorer/apps/client/src` to `$WEB_DIR/../client/src` (apps/web and apps/client are siblings under apps/)
- `tsconfig.json` — remove stale `../xplorer/apps/client/src/*` path from `@client/*` mapping

**Files**: `apps/web/package.json`, `apps/web/vercel.json`, `apps/web/next.config.ts`, `apps/web/scripts/prepare-client-components.sh`, `apps/web/tsconfig.json`

---

### Task 4: Update monorepo configs
**Acceptance Criteria**:
- `pnpm-workspace.yaml` — replace `private/web` with `apps/web`, remove `private/extensions/**`, remove submodule comment
- `package.json` — `marketplace:dev` simplified (remove fallback message), `marketplace:db` path updated to `infra/docker-compose.yml` (remove fallback)
- `.github/workflows/web.yml` — paths trigger on `apps/web/**`, checkout removes `submodules: true` and `token`, working dirs `cd private/web` → `cd apps/web`
- `.prettierignore` — update `private` entry (remove or replace with appropriate entry)

**Files**: `pnpm-workspace.yaml`, `package.json`, `.github/workflows/web.yml`, `.prettierignore`

---

### Task 5: Update all documentation
**Acceptance Criteria**:
- `CLAUDE.md` — update project structure to include `apps/web/` and `infra/`, remove references to `private/`, add web-related commands
- `README.md` — rewrite "Open-Core Model" section (no longer applicable), mention web marketplace is open source, update clone/setup instructions (remove submodule), remove `pnpm dev:full` (doesn't exist)
- `CONTRIBUTING.md` — remove "The `private/` directory is a Git submodule..." section, update contributor setup
- `apps/web/DEPLOY.md` — update any submodule-specific instructions, path references
- `docs/deployment-manual.md` — update ALL `private/web/` references to `apps/web/`, remove `PRIVATE_REPO_TOKEN` references, update Vercel root directory instructions
- `docs/deployment-plan.md` — update `private/web/**` and `private/scripts/` references
- `CHANGELOG.md` — update "Premium extensions and marketplace server in private submodule" note

**Files**: `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `apps/web/DEPLOY.md`, `docs/deployment-manual.md`, `docs/deployment-plan.md`, `CHANGELOG.md`

---

### Task 6: Run pnpm install to regenerate lockfile
**Acceptance Criteria**:
- `pnpm install` succeeds with the new workspace config
- Root `pnpm-lock.yaml` is regenerated with web app dependencies
- No React version conflicts or peer dependency errors

**Files**: `pnpm-lock.yaml`

---

### Task 7: Verify — grep for stale `private/` references
**Acceptance Criteria**:
- No remaining references to `private/web`, `private/infra`, `private/extensions`, `private/scripts` in any tracked files
- No references to `PRIVATE_REPO_TOKEN` in workflows (except possibly as a comment about it being removed)
- No references to `xplorer-private.git`

---

### Dependency Graph
```
Task 1 (remove submodule)
  ↓
Task 2 (copy files) ────→ Task 3 (update web paths)
                    ────→ Task 4 (update monorepo configs)
                              ↓
                         Task 5 (update docs) — parallel with Tasks 3, 4
                              ↓
                         Task 6 (pnpm install) — after Tasks 3, 4
                              ↓
                         Task 7 (verify grep)
```

---

## 5. Execution Plan

### Wave 1 — Submodule Removal + File Copy
**Tasks**: 1, 2
**Model**: Sonnet

1. Remove git submodule via `git submodule deinit -f && git rm -f && rm -rf .git/modules/private`
2. Copy files: `private/web/` → `apps/web/`, `private/infra/` → `infra/`, `private/scripts/` → `scripts/`

### Wave 2 — Path Updates + Config Changes + Docs (all parallel)
**Tasks**: 3, 4, 5
**Model**: Sonnet

1. Update web app paths (vercel.json, next.config.ts, prepare-client-components.sh, tsconfig.json, package.json)
2. Update monorepo configs (pnpm-workspace.yaml, root package.json, web.yml workflow, .prettierignore)
3. Update all documentation (CLAUDE.md, README.md, CONTRIBUTING.md, DEPLOY.md, deployment-manual.md, deployment-plan.md, CHANGELOG.md)

### Wave 3 — Lockfile + Verification
**Tasks**: 6, 7
**Model**: Sonnet

1. Run `pnpm install` to regenerate lockfile
2. Grep for stale `private/` references, fix any stragglers

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| React 18/19 workspace conflict | Low | High | pnpm isolates per-workspace; each gets own React version |
| Missed `private/` reference | Medium | Low | Task 7 greps entire codebase for stragglers |
| `.env` accidentally committed | Low | Critical | Excluded from copy; root `.gitignore` covers `*.env*` recursively |
| Vercel build breaks post-migration | Medium | Medium | Correct `installCommand` path (`cd ../..`); user updates Vercel root dir |
| pnpm install fails (lockfile regen) | Low | Medium | Remove web's own lockfile, remove stale `packageManager` field |
| postinstall blocks desktop contributors | Medium | Medium | Guard prisma generate with `|| true` fallback |
| wait-for-db.mjs can't find compose file | Low | Low | Update script to specify `-f infra/docker-compose.yml` or document usage |

---

## 7. Manual Steps (User Action Required)

These are NOT automated by orchestrate — the user must do them:

1. **Rotate Neon database credentials** — The current password is in the private repo's git history
2. **Update Vercel project settings** — Change root directory from `private/web` to `apps/web`
3. **Remove `PRIVATE_REPO_TOKEN` secret** from GitHub repo settings (no longer needed)
4. **Delete or archive the `xplorer-private` GitHub repo** (optional, once extensions are extracted)
5. **Run `pnpm install`** after the migration to verify workspace resolution

---

## 8. Battle-Test Findings (Incorporated)

### Critical Issues (Fixed)
- **React 18 vs 19**: pnpm workspace isolation handles this naturally. No overrides needed.
- **Lockfile**: Web app's `pnpm-lock.yaml` excluded from copy. Root lockfile regenerated in Task 6.
- **pnpm version mismatch**: `packageManager: pnpm@9.15.0` removed from web's package.json in Task 3.
- **Vercel installCommand path**: Corrected to `cd ../..` (two levels up from `apps/web/`).

### Discovered Missing Files (Added to Task 5)
- `CONTRIBUTING.md` — references private submodule
- `CHANGELOG.md` — mentions private submodule
- `docs/deployment-manual.md` — 14+ references to `private/web/`
- `docs/deployment-plan.md` — 8 references to `private/`
- `.prettierignore` — has `private` entry (added to Task 4)

### Optimization Applied
- `/donate` page already exists in the web app with GitHub Sponsors link — no need for a new `/sponsor` page (Task 9 eliminated)
- Root `.gitignore` already covers `.env`, `node_modules`, `.next` recursively — no gitignore task needed (Task 11 eliminated)
- Tasks 4+5 (infra + scripts copy) merged into Task 2 (single file copy wave)

---

## 9. Status Tracking

| Phase | Status |
|-------|--------|
| Phase 0: Understand project | ✅ Complete |
| Phase 1: Clarify & scope | ✅ Complete |
| Phase 2: Draft plan | ✅ Complete |
| Phase 3: Battle-test | ✅ Complete |
| Phase 4: User approval | ⬜ Pending |
| Phase 5: Execute | ⬜ Pending |
| Phase 6: Test | ⬜ Pending |
| Phase 7: Commit & report | ⬜ Pending |
