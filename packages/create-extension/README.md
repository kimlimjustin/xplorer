# create-xplorer-extension

Scaffold a new Xplorer extension in seconds.

## Usage

```bash
npx create-xplorer-extension
```

Or with a name:

```bash
npx create-xplorer-extension my-extension
```

Or non-interactively:

```bash
npx create-xplorer-extension my-extension --type panel --skip-install
```

## Extension Types

| Type | Description | SDK API |
|------|-------------|---------|
| **panel** | Sidebar panel in the right sidebar | `Sidebar.register()` |
| **theme** | Custom color theme | `Theme.register()` |
| **action** | Right-click context menu action | `ContextMenu.register()` |
| **preview** | Custom file preview handler | `Preview.register()` |
| **command** | Command palette command with keyboard shortcut | `Command.register()` |
| **tab** | Custom tab view with its own URL scheme | `Tab.register()` |

## What Gets Generated

```
my-extension/
  src/
    index.tsx       # Extension source code
  dist/             # Build output (after npm run build)
  package.json      # With xplorer manifest metadata
  tsconfig.json     # TypeScript configuration
  README.md         # Extension documentation
  .gitignore
```

Each generated extension:

- Uses `esbuild` for fast builds (no Vite/Webpack overhead)
- Imports from `@xplorer/extension-sdk` (externalized at build time)
- Uses JSX with `--jsx=transform` (no React import needed at runtime)
- Uses inline styles with CSS variables (`--xp-*`) for theme support
- Uses inline SVG icons (no external icon library dependencies)

## Development

To work on the CLI tool itself:

```bash
cd create-xplorer-extension
npm install
npm run build     # build the CLI
npm run watch     # rebuild on changes
```

## License

MIT
