# Xplorer

Tauri 2.x desktop file manager. React 18 + TypeScript frontend, Rust backend, pnpm monorepo.

## Project structure

- `apps/client/` -- React frontend (Vite + TypeScript + Tailwind CSS)
- `apps/src-tauri/` -- Rust backend (Tauri 2.x commands + operations)
- `apps/web/` -- Next.js marketplace server (Prisma, Stripe billing, admin dashboard)
- `packages/sdk/` -- Internal service layer (`@xplorer/sdk`), wraps Tauri invoke()
- `packages/extension-sdk/` -- Sandboxed extension SDK (`@xplorer/extension-sdk`)
- `packages/create-extension/` -- Extension scaffolder CLI
- `packages/extensions/` -- Built-in extension packages
- `e2e/` -- Playwright end-to-end tests
- `infra/` -- Docker Compose for local PostgreSQL
- `scripts/` -- Extension signing and utility scripts

## Path aliases

- `@/` -> `apps/client/src/`
- `@xplorer/sdk` -> `packages/sdk/src/index.ts`
- `@xplorer/extension-sdk` -> `packages/extension-sdk/src/index.ts`

## Commands

```
pnpm install                     # Install deps -- NEVER use npm
pnpm run dev                     # Frontend + Tauri dev server
pnpm run build                   # Production build
npx vitest run                   # Frontend unit tests
npx vitest run <path>            # Run a single test file
cd apps/src-tauri && cargo test  # Rust tests
pnpm run lint                    # ESLint
pnpm run lint:fix                # ESLint autofix
pnpm run format                  # Prettier
npx tsc --noEmit                 # TypeScript type check
cd apps/web && pnpm dev          # Marketplace dev server
```

## Verification

IMPORTANT: After making code changes, always verify by running the relevant subset:
1. `npx tsc --noEmit` -- typecheck passes
2. `npx vitest run <changed-test>` -- affected tests pass
3. `pnpm run lint` -- no lint errors

Do NOT run the full test suite unless asked. Prefer running single test files for speed.

## Architecture rules

- **TauriAPI facade**: `apps/client/src/lib/tauri-api.ts` delegates to `@xplorer/sdk`. Add new Tauri commands through SDK services, NEVER call `invoke()` directly from components.
- **Rust commands**: Register in `apps/src-tauri/src/main.rs`. Logic goes in `apps/src-tauri/src/operations/` modules.
- **Context menus**: Define in `apps/client/src/lib/context-menu-factory.ts` using `i18n.t()` for labels.
- **State**: React hooks + localStorage (`xplorer:settings` key). No Redux/Zustand.
- **Routing**: wouter (not react-router). Protocol URLs: `xplorer://home`, `xplorer://trash`, etc.
- **Extensions**: Sandboxed, access `window.XplorerSDK`. Use JSX + inline styles + CSS variables in extensions. NEVER use Tailwind inside extensions.

## Code style

- Arrow functions for all new functions and components. Do not use `function` keyword.
- Files under 1000 lines. Extract hooks/helpers/sub-components when approaching limit.
- TypeScript strict mode. Use `unknown` with narrowing, not `any`.
- Prefix unused params with underscore: `_param`.
- `const` by default; `let` only for reassignment; never `var`.
- Triple-equals (`===`) always. Exception: `== null` is allowed.
- PascalCase component filenames. `use-kebab-case.ts` for hooks.
- Only `console.warn()` and `console.error()` allowed. No `console.log()`.

## i18n

- i18next + react-i18next. Locales: `en`, `zh`, `ja`, `id`.
- Files: `apps/client/src/locales/{lang}.json`.
- Components: `const { t } = useTranslation()` then `t('namespace.key')`.
- Non-React: `import i18n from '@/i18n'` then `i18n.t('key')`.
- Add new keys to ALL 4 locale files when adding translatable strings.

## Styling

- Tailwind CSS with `--xp-*` CSS variables (defined in `apps/client/src/styles/tokyo-night.css`).
- Utility classes: `.bg-xp-*`, `.text-xp-*`, `.border-xp-*`.
- Theme classes on `document.documentElement`: `.theme-glass` (default), `.theme-tokyo-night`, `.theme-dracula`, `.theme-nord`, `.theme-catppuccin`.
- Default: Xplorer Glass (semi-transparent RGBA + backdrop-filter blur).
- Toggle via `applyTheme()` in `apps/client/src/lib/utils.ts`.

## Rust conventions

- `chrono` for date/time (not `time` crate).
- `zip` 0.6 for archives.
- Guard all Mutex: `.lock().unwrap_or_else(|e| e.into_inner())` to prevent poisoned panics.
- Do not modify `Cargo.lock` manually.
- Operation modules in `apps/src-tauri/src/operations/`. Register through `mod.rs`.

## Testing

- Vitest + jsdom. Tests in `apps/client/src/__tests__/`.
- Setup at `apps/client/src/__tests__/setup.ts` mocks Tauri APIs, lucide-react, wouter, react-i18next.
- Mock `t()` returns last dot-segment of key: `t('sidebar.home')` -> `"home"`.
- When adding new lucide-react icons to components, add them to the mock in setup.ts.

## Commits

- Do NOT include Co-Authored-By tags.
- Concise commit messages focused on the "why", not the "what".
- Use conventional style: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.

## Common gotchas

- Windows paths: this runs on Windows. Use forward slashes in JS/TS, but be aware Rust paths use `\\`.
- Tauri v2 uses `@tauri-apps/api` (not `@tauri-apps/api/tauri`). Check imports carefully.
- The test setup mocks `@tauri-apps/api/core` invoke. If a new Tauri command is added, the mock must handle it.
- Mutex poisoning in Rust is a real risk in this codebase. Always use the guard pattern above.
