# Xplorer Extensions

A collection of 42 extensions for [Xplorer](https://github.com/kimlimjustin/xplorer), the modern file explorer.

> **Note:** All of these extensions are vibe coded. They were built rapidly with AI assistance and may contain rough edges. Contributions and bug reports are welcome!

## Extensions

### Themes
| Extension | Description |
|-----------|-------------|
| `cyberpunk-theme` | Neon-lit cyberpunk color scheme |
| `dracula-theme` | Classic Dracula dark theme |
| `nord-theme` | Arctic, north-bluish color palette |
| `ocean-deep-theme` | Deep ocean blue theme |
| `tokyo-night-theme` | Tokyo Night inspired theme |

### File Tools
| Extension | Description |
|-----------|-------------|
| `batch-image` | Batch image processing (resize, convert, compress) |
| `bulk-rename-extension` | Powerful bulk file renaming with patterns |
| `code-editor-extension` | Built-in code editor with syntax highlighting |
| `compare-files-extension` | Side-by-side file comparison |
| `compress-extension` | File compression (ZIP, TAR, 7Z) |
| `extract-extension` | Archive extraction |
| `file-comparison-extension` | Advanced file diff viewer |
| `file-hasher` | Calculate file checksums (MD5, SHA-256, etc.) |
| `file-organizer-extension` | Auto-organize files by type, date, or rules |
| `file-properties-extension` | Detailed file properties panel |
| `file-tags-extension` | Tag files with custom labels |
| `folder-stats` | Folder size and file count statistics |
| `image-editor` | Basic image editing (crop, rotate, filters) |
| `image-gallery` | Photo gallery view with lightbox |
| `json-formatter` | Pretty-print and validate JSON files |
| `markdown-preview` | Live Markdown preview |
| `notes-extension` | Attach notes to files and folders |
| `open-with-extension` | Open files with external applications |
| `word-counter` | Word, character, and line count for text files |

### Integrations
| Extension | Description |
|-----------|-------------|
| `ai-chat` | AI chat assistant powered by local LLMs |
| `claude-code` | Claude Code integration for AI-assisted development |
| `docker` | Docker container and image management |
| `gdrive` | Google Drive file browser and sync |
| `git-extension` | Full Git UI (status, commit, branches, blame) |
| `ssh` | SSH remote file browsing |
| `collaboration` | Real-time collaboration (experimental) |

### Productivity
| Extension | Description |
|-----------|-------------|
| `3d-viewer` | 3D model file viewer (GLB, OBJ, STL) |
| `architect` | Project architecture visualizer |
| `audio-waveform-extension` | Audio file waveform visualization |
| `backup` | File backup and restore |
| `duplicate-finder-extension` | Find and manage duplicate files |
| `ide-mode` | IDE-like workspace with split editors |
| `problems-panel` | Code problems and diagnostics panel |
| `recommendations-extension` | Smart file recommendations |
| `software-finder` | Discover installed applications |
| `sqlite-browser` | SQLite database browser and query runner |
| `storage-analytics-extension` | Disk usage analytics and visualization |

## Development

Every extension supports hot-reload development:

```bash
cd packages/extensions/<extension-name>
pnpm install
pnpm dev
```

This creates a `.hotreload` sentinel file, starts esbuild in watch mode, and Xplorer will automatically detect and hot-reload the extension on every change (~600ms reload time).

### Creating a New Extension

```bash
pnpm create @xplorer/extension my-extension
cd my-extension
pnpm dev
```

### Building

```bash
# Build a single extension
cd packages/extensions/<name>
pnpm build

# Build all extensions
pnpm run build:extensions
```

## Architecture

Extensions are sandboxed JavaScript bundles executed via `new Function()` in the Xplorer webview. They communicate with the host app through the `@xplorer/extension-sdk` API:

```typescript
import { Extension, Sidebar, Command } from '@xplorer/extension-sdk';

const MyExtension = Extension.create({
  name: 'my-extension',
  activate(ctx) {
    Sidebar.registerTab({ ... });
    Command.register('my-command', () => { ... });
  },
  deactivate() { ... }
});

export default MyExtension;
```

## License

AGPL-3.0 - Same as Xplorer.
