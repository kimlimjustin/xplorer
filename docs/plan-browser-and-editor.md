# Plan: Browser Extension + Code Editor Upgrade

Two new extensions that make Xplorer more than a file manager — a lightweight development environment.

---

## Part 1: Browser Extension

**Goal**: Embedded web browser panel, like VS Code's Simple Browser.

### What it does
- Opens as a sidebar tab or bottom tab in Xplorer
- URL bar with back/forward/refresh/home buttons
- Renders web content via `<iframe>`
- Opens local HTML files directly from the file manager
- Bookmarks saved via extension storage
- Context menu: "Open in Browser" for .html/.htm files

### Technical approach
- **Rendering**: `<iframe>` inside extension panel. No multi-webview (Tauri single-window).
  - Limitation: some sites block iframe embedding (X-Frame-Options). Acceptable for a file manager browser.
  - Local HTML files: use `tauri://localhost/` asset protocol or direct file path
- **Extension type**: `BottomTab.register()` (always visible at bottom, like a terminal)
- **Storage**: Bookmarks + history stored via `api.storage.get/set`
- **Context menu**: Register "Open in Browser" for `.html`, `.htm`, `.svg` files
- **Permissions needed**: `ui:panels`, `storage:read`, `storage:write`, `file:read`

### Files to create
```
packages/extensions/browser-extension/
├── package.json          (manifest + esbuild script)
├── src/
│   └── index.tsx         (main extension: BrowserPanel component + registration)
└── dist/
    └── index.js          (built output)
```

### UI design (inline styles + CSS variables)
```
┌─────────────────────────────────────────────────┐
│ ← → ↻ 🏠 │ https://example.com_____________ │ ★ │
├─────────────────────────────────────────────────┤
│                                                 │
│              <iframe> content                   │
│                                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Effort: ~2-3 hours

---

## Part 2: Code Editor Upgrade

**Goal**: VS Code-level code editing with syntax highlighting, extensible language support.

### Current state
- `apps/src-tauri/data/extensions/xplorer-code-editor/` — existing editor extension
- `apps/client/src/components/panels/CodeEditorPanel.tsx` — built-in editor panel
- Currently uses `react-syntax-highlighter` for display (read-only highlighting)
- No real editing capabilities beyond basic textarea

### What to build
1. **Monaco Editor integration** (the same editor engine as VS Code)
   - Full syntax highlighting for 50+ languages out of the box
   - IntelliSense / autocomplete
   - Multi-cursor, find & replace, minimap
   - Diff view (already have a diff library)
   - Theme support (map Xplorer themes to Monaco themes)

2. **Extension API for language support**
   - Add `Editor.registerLanguage()` to extension SDK
   - Extensions can contribute: syntax definitions, snippets, formatters
   - Built-in languages via Monaco (JS, TS, Python, Rust, JSON, HTML, CSS, etc.)
   - Third-party extensions can add more (e.g., TOML, Dockerfile, etc.)

3. **File editing flow**
   - Double-click a text file → opens in Monaco editor tab
   - Save (Ctrl+S) → writes via Tauri backend
   - Unsaved changes indicator (dot on tab)
   - Multiple editor tabs (already supported via EditorGroupPane)

### Technical approach

**Option A: Monaco Editor (recommended)**
- `@monaco-editor/react` — React wrapper, ~2MB (loads Monaco from CDN or bundled)
- Pros: VS Code's actual engine, best-in-class, huge language support
- Cons: Large (~10MB bundled), CDN dependency or big bundle increase
- Mitigation: Lazy-load Monaco only when editor opens (dynamic import)

**Option B: CodeMirror 6**
- `@codemirror/view` + language packs — modular, ~500KB base
- Pros: Smaller, more modular, better for custom themes
- Cons: Less "VS Code-like", fewer built-in languages
- Good middle ground if bundle size is a concern

**Recommendation**: Monaco with lazy loading. Users opening a code editor expect VS Code quality. CodeMirror is a fallback if bundle size proves unacceptable.

### Files to modify/create
```
Modified:
  apps/client/src/components/panels/CodeEditorPanel.tsx  (replace textarea with Monaco)
  packages/extension-sdk/src/api/index.ts               (add Editor.registerLanguage)

New:
  apps/client/src/components/editor/MonacoEditor.tsx     (lazy-loaded Monaco wrapper)
  apps/client/src/lib/editor-themes.ts                   (Xplorer theme → Monaco theme mapping)
  packages/extensions/code-editor-extension/src/index.tsx (upgraded extension)
```

### Effort: ~1-2 days

---

## Execution Order

| Phase | What | Depends on | Effort |
|-------|------|-----------|--------|
| 1 | Browser extension | Nothing | 2-3 hours |
| 2 | Monaco Editor integration | Nothing | 4-8 hours |
| 3 | Editor extension API (registerLanguage) | Phase 2 | 2-4 hours |
| 4 | Theme mapping (Xplorer themes → Monaco) | Phase 2 | 1-2 hours |
| 5 | Context menu integration (both extensions) | Phases 1+2 | 1 hour |

Phase 1 and Phase 2 can run in parallel since they're independent.

---

## Open Questions

1. **Monaco bundle strategy**: Bundle with app (~10MB increase) or load from CDN on first use?
2. **File save**: Should the editor auto-save or require explicit Ctrl+S?
3. **Tab management**: Use existing EditorGroupPane or build a new tab system?
4. **Browser extension**: Should it support multiple tabs or single-page only?
