# Infrastructure Scan — 2026-03-25

## 1. CI/CD Pipeline

**Files:** `.github/workflows/ci.yml`, `.github/workflows/release.yml`

### What runs

`ci.yml` runs on push/PR to `next` branch. Jobs:
- `lint-and-typecheck` — tsc, prettier check, eslint (ubuntu-latest)
- `unit-tests` — vitest run with JUnit reporter + artifact upload
- `e2e-tests` — Playwright chromium-only, depends on unit-tests passing
- `security-audit` — pnpm audit (high level, continue-on-error=true) + cargo audit
- `rust-check` — cargo check, clippy -D warnings, rustfmt check, cargo test

`release.yml` triggers on `v*` tags. Re-runs lint/unit/rust checks, then builds on ubuntu/windows/macos (matrix). Uses `tauri-apps/tauri-action@v0`.

### Findings

| Finding | File | Severity | Effort |
|---------|------|----------|--------|
| `security-audit` job has `continue-on-error: true` on `pnpm audit` — high-severity JS vulns never block CI | `.github/workflows/ci.yml:147` | P1 | S |
| No `macos-latest` runner in CI (only ubuntu). Rust/Tauri builds on macOS only happen in release, so Mac-specific Rust bugs ship undetected until tag | `.github/workflows/ci.yml` | P2 | S |
| E2E tests only run `chromium` browser — other platforms not exercised | `.github/workflows/ci.yml:102` | P3 | S |
| `tauri-apps/tauri-action@v0` — unpinned major version; upstream changes can break release builds silently | `.github/workflows/release.yml:149` | P2 | S |
| Release workflow does NOT run cargo tests before building artifacts | `.github/workflows/release.yml` | P2 | S |
| No dependency-update automation (Dependabot/Renovate) configured | `.github/` | P2 | S |
| No branch protection / required status checks enforced in workflow itself (workflow config side only) | `.github/workflows/ci.yml` | P3 | S |

---

## 2. Outdated Dependencies

Run: `pnpm outdated`

### Major version gaps (breaking changes possible)

| Package | Current | Latest | Type |
|---------|---------|--------|------|
| `@vitejs/plugin-react` | 4.7.0 | **6.0.1** | devDep |
| `@vitest/coverage-v8` | 2.1.9 | **4.1.1** | devDep |
| `@vitest/ui` | 2.1.9 | **4.1.1** | devDep |
| `jsdom` | 25.0.1 | **29.0.1** | devDep |
| `@types/node` | 20.16.11 | **25.5.0** | devDep |
| `@types/react` | 18.3.24 | **19.2.14** | devDep (still on React 18) |
| `@types/react-dom` | 18.3.7 | **19.2.3** | devDep |
| `react-pdf` | 10.1.0 | **10.4.1** | dep |
| `wouter` | 3.7.1 | **3.9.0** | dep |

### Minor/patch gaps

| Package | Current | Latest |
|---------|---------|--------|
| `@tanstack/react-query` | 5.85.5 | 5.95.2 |
| `dompurify` | 3.3.1 | 3.3.3 |
| `mammoth` | 1.10.0 | 1.12.0 |
| `pdfjs-dist` | 5.4.54 | 5.5.207 |
| `i18next` | 25.8.20 | 25.10.9 |
| `react-i18next` | 16.5.8 | 16.6.6 |

### Deprecated packages

| Package | Note |
|---------|------|
| `@types/diff` | Deprecated — types now included in `diff` itself |
| `@types/dompurify` | Deprecated — types now included in `dompurify` itself |

| Finding | Severity | Effort |
|---------|----------|--------|
| `@vitejs/plugin-react` 4→6, `vitest`/`@vitest/*` 2→4, `jsdom` 25→29 are all major bumps requiring coordinated test/build upgrade | P2 | M |
| `@types/react`/`@types/react-dom` at React 18 types while repo is on React 18 — safe to stay, but tracking React 19 types without upgrading React causes confusion | P3 | S |
| Two deprecated `@types/*` packages adding dead weight | P3 | S |

---

## 3. Dependency Security Audit

Run: `pnpm audit` — **29 vulnerabilities: 13 high, 12 moderate, 4 low**

### Critical production dependencies

| Package | Severity | Issue | Path | Fix Available |
|---------|----------|-------|------|---------------|
| `xlsx` (SheetJS) | HIGH | Prototype Pollution (GHSA-4r6h-8v6p-xvw6) | direct dep | No (`<0.0.0` patched) |
| `xlsx` (SheetJS) | HIGH | ReDoS (GHSA-5pgg-2g8v-p4x9) | direct dep | No (`<0.0.0` patched) |
| `mammoth` > `underscore` | HIGH | Unlimited recursion DoS in `_.flatten` | direct dep chain | Update mammoth ≥1.12 |
| `react-syntax-highlighter` > `prismjs` | MODERATE | DOM Clobbering (GHSA) | direct dep | Update prismjs ≥1.30 |
| `vite` | LOW | `server.fs.deny` bypass via backslash (GHSA-jqfw-vq24-v9c3) | direct dep | Upgrade vite ≥5.4.20 |

### Dev-only (lower real-world risk, but block audit-level=high in CI if fixed)

| Package | Severity | Issue | Path |
|---------|----------|-------|------|
| `glob` | HIGH | Command injection via `-c/--cmd` | `@vitest/coverage-v8>test-exclude>glob` |
| `minimatch` | HIGH | ReDoS (3 advisories) | `@vitest/coverage-v8>test-exclude>minimatch` |
| `rollup` | HIGH | Arbitrary file write via path traversal | `vite>rollup` |
| `flatted` | HIGH (×2) | Unbounded recursion DoS + Prototype Pollution | `@vitest/ui>flatted` |
| `esbuild` | MODERATE | Dev server CORS bypass | `packages/extensions/audio-waveform-extension>esbuild` |

### Private submodule dependencies (isolated)

| Package | Severity | Path |
|---------|----------|------|
| `next-mdx-remote` | HIGH | `private__web>next-mdx-remote` |
| `undici` | HIGH (×2) | `private__web>@vercel/blob>undici` |

| Finding | File | Severity | Effort |
|---------|------|----------|--------|
| `xlsx` 0.18.5 has two HIGH vulnerabilities with NO fix available in npm registry (SheetJS moved to proprietary licensing, no public patched version). Must replace with alternative (e.g. `exceljs`, `@e965/xlsx`) | `package.json:61` | P0 | L |
| `vite` ≤5.4.19 path traversal bypass — upgrade to ≥5.4.20 | `package.json:115` | P1 | S |
| `mammoth` > `underscore` DoS — update mammoth to ≥1.12 | `package.json:51` | P1 | S |
| `vitest` v2 toolchain drags in vulnerable `glob`, `minimatch`, `rollup`, `flatted` — upgrading to vitest v4 resolves all | `package.json:116` | P2 | M |
| pnpm audit runs with `continue-on-error: true` so these HIGH findings never block merges | `.github/workflows/ci.yml:147` | P1 | S |

---

## 4. Rust Dependency Audit

`cargo-audit` is **not installed** locally. Cannot run.

CI installs it fresh on every run (`cargo install cargo-audit`) — this adds ~2-3 minutes to the `security-audit` job unnecessarily.

| Finding | File | Severity | Effort |
|---------|------|----------|--------|
| `cargo-audit` not installed locally — developers cannot run Rust audit without CI | local env | P3 | S |
| CI installs `cargo-audit` from scratch each run (no caching) — slow | `.github/workflows/ci.yml:153` | P3 | S |

---

## 5. Build Scripts

Root `package.json` scripts section:

| Script | Present | Notes |
|--------|---------|-------|
| `dev` | Yes | Runs frontend + tauri + marketplace concurrently |
| `dev:app` | Yes | Frontend + tauri only (no marketplace) |
| `build` | Yes | `pnpm frontend:build && pnpm tauri:build` |
| `test` | Yes | vitest watch mode |
| `test:run` | Yes | vitest run (one-shot) |
| `test:coverage` | Yes | vitest with coverage |
| `test:tauri` | Yes | `cargo test` |
| `test:e2e` | Yes | Playwright |
| `lint` | Yes | ESLint on `apps/client/src/` only |
| `lint:fix` | Yes | |
| `format` | Yes | Prettier write |
| `format:check` | Yes | Prettier check |
| `check` | Yes | `tsc` (no `--noEmit` flag — will try to emit, but `noEmit: true` is in tsconfig) |

| Finding | File | Severity | Effort |
|---------|------|----------|--------|
| `pnpm run build` currently **fails** — Rust compilation errors due to `WASM_RUNTIME` being referenced in `commands.rs` but `wasm_runtime.rs` module is not registered in `mod.rs` and missing `has_wasm_backend` field in `ExtensionPackage`. The full Tauri build is broken. | `apps/src-tauri/src/extensions/mod.rs`, `commands.rs`, `types.rs` | P0 | M |
| `lint` script only covers `apps/client/src/` — `packages/sdk/src/`, `packages/extension-sdk/src/`, `e2e/` are not linted by `pnpm run lint` | `package.json:31` | P2 | S |
| `check` script invokes `tsc` without `--noEmit` — relies on tsconfig setting; brittle if tsconfig is accidentally changed | `package.json:23` | P3 | S |
| No `preinstall` or `engines` enforcement script to prevent `npm install` from being used (only engine field on Node version) | `package.json` | P3 | S |

---

## 6. Pre-Commit Hooks

**File:** `.husky/pre-commit`

Content: `npx lint-staged`

`lint-staged` config (in `package.json`):
- `apps/client/src/**/*.{ts,tsx}` → prettier + eslint --fix
- `apps/client/src/**/*.css` → prettier
- `e2e/**/*.ts` → prettier
- `*.{json,md,yml,yaml}` → prettier

| Finding | File | Severity | Effort |
|---------|------|----------|--------|
| Pre-commit only runs prettier + eslint; no typecheck (`tsc --noEmit`) — type errors can be committed freely | `.husky/pre-commit` | P1 | S |
| `packages/sdk/` and `packages/extension-sdk/` TypeScript are not covered by lint-staged patterns | `package.json:63-77` | P2 | S |
| No pre-push hook — broken Rust builds (see P0 above) can be pushed since CI is the only gate | `.husky/` | P2 | S |

---

## 7. TypeScript Strictness

**File:** `/Users/kimlim/Projects/xplorer/tsconfig.json`

```json
"strict": true
```

`"strict": true` enables the full strict suite: `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis`, `alwaysStrict`, `useUnknownInCatchVariables`.

Additional options present:
- `skipLibCheck: true` — skips type-checking of `.d.ts` in node_modules (standard practice)
- `esModuleInterop: true`
- `noEmit: true` — no output, type-check only

Missing strictness options:
- `noUncheckedIndexedAccess` — not set (array index access returns `T`, not `T | undefined`)
- `exactOptionalPropertyTypes` — not set
- `noImplicitReturns` — not set
- `noFallthroughCasesInSwitch` — not set

Test files excluded from tsconfig (`**/*.test.ts`, `__tests__/**/*`) — tests have no type checking from root tsconfig.

| Finding | File | Severity | Effort |
|---------|------|----------|--------|
| `noUncheckedIndexedAccess` not enabled — array bounds bugs won't surface as type errors | `tsconfig.json` | P2 | S |
| Test files excluded from root tsconfig — type errors in tests are invisible to `tsc --noEmit` | `tsconfig.json:7-8` | P2 | S |
| `vitest.config.ts` has its own include that picks up tests; there's no separate `tsconfig.test.json` — tests run through vitest's bundler type resolution only | `apps/client/vitest.config.ts` | P3 | S |

---

## 8. Rust Clippy Configuration

No `.clippy.toml` found anywhere in the repository.

CI runs: `cargo clippy --manifest-path apps/src-tauri/Cargo.toml -- -D warnings`

This uses clippy defaults — all lints are at their default level, `warnings` are treated as errors in CI only.

| Finding | Severity | Effort |
|---------|----------|--------|
| No `.clippy.toml` — no project-wide clippy configuration. Cannot enable stricter lints (e.g. `clippy::pedantic`, `clippy::cargo`) or suppress false positives consistently | P3 | S |
| Clippy `-D warnings` only enforced in CI, not locally (no pre-commit hook for it) | P2 | S |

---

## 9. Bundle Size

Run: `pnpm run frontend:build`

### Large chunks flagged by Rollup (>500 kB after minification)

| Chunk | Raw Size | Gzipped |
|-------|----------|---------|
| `index-B3GaQJqV.js` (PDF.js vendor) | **762.16 kB** | 220.53 kB |
| `index-BSaedhEP.js` (unknown large vendor) | 493.15 kB | 129.15 kB |
| `xlsx-D_0l8YDs.js` | **429.03 kB** | 143.08 kB |
| `index-CPAPSxBy.js` (main app bundle) | 406.65 kB | 122.06 kB |
| `vendor-radix-yl0e7cd6.js` | 207.60 kB | 68.69 kB |
| `vendor-syntax-highlight-EGi3IP13.js` | 99.05 kB | 32.68 kB |
| `settings-BbUxzALa.js` | 87.99 kB | 20.14 kB |
| `vendor-icons-D4tzBoDd.js` (lucide-react) | 81.72 kB | 17.08 kB |

**Total JS (gzipped estimate): ~780 kB+** — heavy for a desktop app but acceptable given it's Tauri (no bandwidth cost after initial download).

| Finding | File | Severity | Effort |
|---------|------|----------|--------|
| `xlsx` bundle is 429 kB raw / 143 kB gzip — and has unresolvable HIGH CVEs. Replacing xlsx eliminates both the security risk and bundle weight | `package.json:61` | P0 | L |
| PDF.js chunk at 762 kB is the largest — only loaded for PDF preview; confirm it's lazy-loaded or make it so | `apps/client/src/` | P2 | M |
| `index-BSaedhEP.js` at 493 kB is unnamed — likely a vendor chunk that could be split further | Vite config | P3 | M |
| Rollup emits warning about chunks >500 kB — no `build.chunkSizeWarningLimit` set and no `manualChunks` strategy in vite config | `apps/client/vite.config.ts` | P3 | S |
| No bundle analysis tool configured (no `rollup-plugin-visualizer` or similar) | devDependencies | P3 | S |

---

## Summary Table

| ID | Finding | File/Location | Severity | Effort |
|----|---------|---------------|----------|--------|
| I-1 | Full Tauri build is broken: `WASM_RUNTIME` referenced but module missing; `has_wasm_backend` field missing | `extensions/mod.rs`, `commands.rs`, `types.rs` | **P0** | M |
| I-2 | `xlsx` has two HIGH CVEs with no npm-resolvable fix — must replace | `package.json:61` | **P0** | L |
| I-3 | pnpm audit `continue-on-error: true` — HIGH JS vulns never block CI | `ci.yml:147` | P1 | S |
| I-4 | `vite` ≤5.4.19 path-traversal bypass — upgrade to ≥5.4.20 | `package.json:115` | P1 | S |
| I-5 | `mammoth` > `underscore` HIGH DoS — update mammoth ≥1.12 | `package.json:51` | P1 | S |
| I-6 | Pre-commit hook has no typecheck — type errors commit freely | `.husky/pre-commit` | P1 | S |
| I-7 | No macOS runner in CI — Mac-specific Rust bugs undetected until release | `ci.yml` | P2 | S |
| I-8 | `tauri-apps/tauri-action@v0` unpinned major version in release | `release.yml:149` | P2 | S |
| I-9 | Release workflow skips cargo tests | `release.yml` | P2 | S |
| I-10 | No Dependabot/Renovate configured | `.github/` | P2 | S |
| I-11 | `vitest` v2 drags in HIGH-severity glob/minimatch/rollup/flatted | `package.json:116` | P2 | M |
| I-12 | `lint` script excludes `packages/sdk/`, `extension-sdk/`, `e2e/` | `package.json:31` | P2 | S |
| I-13 | `noUncheckedIndexedAccess` not enabled in tsconfig | `tsconfig.json` | P2 | S |
| I-14 | Test files excluded from tsconfig — no tsc coverage of tests | `tsconfig.json:7-8` | P2 | S |
| I-15 | No pre-push hook — broken Rust can be pushed | `.husky/` | P2 | S |
| I-16 | Clippy not run locally (no pre-commit), only in CI | `.husky/pre-commit` | P2 | S |
| I-17 | PDF.js chunk 762 kB — confirm lazy-loaded | `apps/client/src/` | P2 | M |
| I-18 | `@types/diff`, `@types/dompurify` deprecated — remove | `package.json` | P3 | S |
| I-19 | E2E tests chromium-only | `ci.yml:102` | P3 | S |
| I-20 | `cargo-audit` reinstalled from scratch on every CI run (no cache) | `ci.yml:153` | P3 | S |
| I-21 | No `.clippy.toml` for project-wide lint configuration | repo root | P3 | S |
| I-22 | No bundle analyzer configured | devDependencies | P3 | S |
| I-23 | `check` script doesn't pass `--noEmit` explicitly | `package.json:23` | P3 | S |
