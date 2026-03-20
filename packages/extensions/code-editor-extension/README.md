# Xplorer Code Editor Extension

A VS Code-like code editor for the Xplorer file manager. Opens as a full-screen overlay with syntax highlighting, file tree, multiple tabs, and VS Code settings import.

## Features

- Full-screen editor overlay (opens in the main content area)
- Syntax highlighting via CodeMirror 6 (15+ languages)
- Tokyo Night color theme
- File explorer sidebar with lazy-loading directories
- Multiple file tabs with unsaved change indicators
- Cursor position tracking (line, column)
- Configurable settings (font size, font family, tab size, word wrap)
- Import settings from VS Code (`settings.json`)
- Keyboard shortcuts (Ctrl+S save, Ctrl+F search, Ctrl+H replace, Ctrl+B toggle sidebar)
- Activity bar with Explorer and Settings views

## Screenshot

```
┌────────────────────────────────────────────────────────────────────┐
│ 📝 Code Editor — index.ts                          [≡] [×]       │
├──────┬─────────────────────────────────────────────────────────────┤
│ 📂   │ ┌─ index.ts ──┬─ app.tsx ──┐                              │
│ ⚙    │ │  1  import React from 'react';                          │
│      │ │  2                                                      │
│ src/ │ │  3  function App() {                                    │
│  ├─ components/ │  4    const [count, setCount] = useState(0);   │
│  ├─ index.ts    │  5    return <div>{count}</div>;               │
│  └─ utils.ts    │  6  }                                         │
│ package.json    │                                                │
├──────┴──────────┴────────────────────────────────────────────────┤
│ Ln 3, Col 1   Spaces: 2   UTF-8   TypeScript       12 lines     │
└──────────────────────────────────────────────────────────────────┘
```

## Supported Languages

TypeScript, JavaScript, JSX/TSX, HTML, CSS/SCSS, JSON, Python, Rust, C/C++, Java, XML, SQL, Markdown, and more (plain text fallback for others).

## Installation

### From Marketplace

1. Open Xplorer
2. Click the Marketplace icon in the left sidebar
3. Search for "Code Editor"
4. Click Install

### From Local Folder

1. Clone or download this folder
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
3. In Xplorer, go to Extensions panel > "Install from Folder"
4. Select this folder

## Development

```bash
# Install dependencies
npm install

# Build once
npm run build

# Watch mode (rebuild on changes)
npm run watch
```

### Project Structure

```
code-editor-extension/
├── package.json          # Manifest with xplorer config + dependencies
├── tsconfig.json         # TypeScript configuration
├── src/
│   └── index.tsx         # Extension source (single file, ~750 lines)
├── dist/
│   └── index.js          # Compiled bundle (ES module)
└── README.md
```

## Usage

1. The extension adds a "Code Editor" panel in the right sidebar
2. Click **"Open Editor"** (or press `Ctrl+Shift+E`) to launch the full-screen editor
3. Use the file explorer in the left sidebar to open files
4. Edit with full syntax highlighting, search (Ctrl+F), and replace (Ctrl+H)
5. Save with `Ctrl+S`, close tabs with `Ctrl+W`
6. Toggle the sidebar with `Ctrl+B`
7. Go to Settings (gear icon) to customize font, tab size, word wrap
8. Use **"Import from VS Code"** in Settings to bring over your VS Code preferences

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+E` | Open/focus Code Editor |
| `Ctrl+S` | Save current file |
| `Ctrl+W` | Close current tab |
| `Ctrl+F` | Find in file |
| `Ctrl+H` | Find and replace |
| `Ctrl+B` | Toggle sidebar |
| `Escape` | Close editor overlay |

## VS Code Settings Import

The editor can import these settings from your VS Code `settings.json`:

| VS Code Setting | Editor Setting |
|---|---|
| `editor.fontSize` | Font size |
| `editor.fontFamily` | Font family |
| `editor.tabSize` | Tab size |
| `editor.wordWrap` | Word wrap on/off |
| `editor.lineNumbers` | Line numbers on/off |

Default paths detected automatically:
- **Windows**: `C:\Users\<username>\AppData\Roaming\Code\User\settings.json`
- **macOS**: `~/Library/Application Support/Code/User/settings.json`
- **Linux**: `~/.config/Code/User/settings.json`

## Permissions

| Permission | Used For |
|---|---|
| `file:read` | Reading file contents and directory listings |
| `file:write` | Saving edited file contents |
| `ui:panels` | Registering the Code Editor panel |
| `ui:notifications` | Showing save success/failure messages |

## License

MIT
