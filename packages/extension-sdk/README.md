# Xplorer Extension SDK

The Xplorer Extension SDK allows developers to create custom extensions for the Xplorer file manager. Extensions can add new functionality, themes, file previews, sidebar panels, commands, and context menu actions.

## Quick Start

### Creating a Theme

```typescript
import { Theme } from '@xplorer/extension-sdk';

Theme.register({
  id: 'my-theme',
  name: 'My Theme',
  colors: {
    bg: '#1a1a2e', surface: '#16213e', surfaceLight: '#1e2a4a',
    border: '#2a3a5a', text: '#eee', textMuted: '#888',
    blue: '#e94560', green: '#50fa7b', red: '#ff5555',
    orange: '#ffb86c', pink: '#ff79c6', yellow: '#f1fa8c',
    cyan: '#8be9fd', purple: '#bd93f9',
  },
});
```

### Creating a Sidebar Panel

```typescript
import { Sidebar, type XplorerAPI } from '@xplorer/extension-sdk';

let api: XplorerAPI;

Sidebar.register({
  id: 'my-panel',
  title: 'My Panel',
  icon: 'star',
  onActivate: (injectedApi) => { api = injectedApi; },
  render: (props) => React.createElement('div', null, 'Hello from my panel!'),
});
```

### Creating a Command

```typescript
import { Command, type XplorerAPI } from '@xplorer/extension-sdk';

Command.register({
  id: 'my-command',
  title: 'Do Something',
  shortcut: 'ctrl+shift+d',
  action: async (api) => {
    api.ui.showMessage('Command executed!', 'info');
  },
});
```

## High-Level APIs

These are the recommended way to create extensions. Each API handles all the boilerplate (manifest, registration, lifecycle) for you.

| API | Purpose | Example Extensions |
|-----|---------|-------------------|
| `Theme.register()` | Custom color themes | aurora, nord, cyberpunk, dracula |
| `Sidebar.register()` | Sidebar panels with React UI | folder-stats, ssh-manager, code-editor |
| `Preview.register()` | Custom file preview renderers | markdown-preview, image-gallery |
| `Command.register()` | Commands with optional keyboard shortcuts | word-counter, json-formatter |
| `ContextMenu.register()` | Right-click context menu actions | file-hasher |

### `Theme.register(config)`

```typescript
Theme.register({
  id: string;           // unique theme ID (CSS class: .theme-{id})
  name: string;         // display name in theme picker
  colors: {             // auto-generates all --xp-* CSS variables
    bg: string;         surface: string;       surfaceLight: string;
    border: string;     borderLight?: string;
    text: string;       textMuted: string;     textSecondary?: string;
    blue: string;       blueDark?: string;
    green: string;      orange: string;        pink: string;
    red: string;        yellow: string;        cyan: string;
    purple: string;     popover?: string;
  };
  css?: string;          // optional extra CSS (scrollbar, selection, etc.)
  background?: string;   // optional HTML background (gradient, etc.)
});
```

### `Sidebar.register(config)`

```typescript
Sidebar.register({
  id: string;           // unique panel ID
  title: string;        // panel title
  icon?: string;        // icon name or emoji
  onActivate?: (api: XplorerAPI) => void;  // called when API is available
  render: (props: { currentPath?: string; selectedFiles?: unknown[]; }) => React.ReactElement;
});
```

### `Preview.register(config)`

```typescript
Preview.register({
  id: string;           // unique preview ID
  title: string;        // display name
  description?: string;
  icon?: string;
  permissions?: string[];
  canPreview: (file: { path: string; is_dir: boolean }) => boolean;
  priority?: number;    // higher = preferred (default: 0)
  onActivate?: (api: XplorerAPI) => void;
  render: (props: { selectedFiles?: unknown[]; currentPath?: string; }) => React.ReactElement;
});
```

### `Command.register(config)`

```typescript
Command.register({
  id: string;           // unique command ID
  title: string;        // display name
  shortcut?: string;    // e.g. 'ctrl+shift+w'
  action: async (api: XplorerAPI) => void;
});
```

### `ContextMenu.register(config)`

```typescript
ContextMenu.register({
  id: string;           // unique action ID
  title: string;        // menu item label
  icon?: string;
  when?: 'always' | 'singleFileSelected' | 'multipleFilesSelected' | 'directorySelected';
  action: async (files: FileEntry[], api: XplorerAPI) => void;
});
```

## Hooks

React hooks for reading Xplorer state from within extension components.

```typescript
import { useCurrentPath, useSelectedFiles, navigateTo } from '@xplorer/extension-sdk';

function MyComponent() {
  const currentPath = useCurrentPath();           // reactive current directory
  const selectedFiles = useSelectedFiles();       // reactive file selection
  const handleClick = () => navigateTo('/home');  // programmatic navigation
}
```

## UI Components

Pre-built React components styled with Xplorer's CSS variables. They automatically match the active theme.

```typescript
import { Button, Input, Select, Toggle, Spinner, Panel, Card } from '@xplorer/extension-sdk';
```

| Component | Props |
|-----------|-------|
| `Button` | `label`, `onClick`, `variant` (primary/secondary/ghost/danger), `size` (sm/md/lg), `disabled` |
| `Input` | `value`, `onChange`, `placeholder`, `type`, `style` |
| `Select` | `value`, `onChange`, `options: {value, label}[]`, `style` |
| `Toggle` | `checked`, `onChange`, `label` |
| `Spinner` | `size` (number, default 20) |
| `Panel` | `title`, `children`, `style` |
| `Card` | `title`, `children`, `style` |

## Extension Types

1. **Theme Extensions** — Custom themes and color schemes (`Theme.register`)
2. **Preview Extensions** — Custom file preview handlers (`Preview.register`)
3. **Panel Extensions** — Custom sidebar panels (`Sidebar.register`)
4. **Command Extensions** — Commands with keyboard shortcuts (`Command.register`)
5. **Action Extensions** — Context menu items (`ContextMenu.register`)

## Extension Structure

```
my-extension/
├── package.json          # Extension metadata
├── src/
│   └── index.tsx         # Main entry — calls *.register()
└── dist/
    └── index.js          # Built extension
```

## Advanced: Base Classes

For complex extensions that need full lifecycle control, you can use the base classes directly:

```typescript
import { Extension, PanelExtension, PreviewExtension, ThemeExtension, ActionExtension } from '@xplorer/extension-sdk';
import { registerExtension, createExtension } from '@xplorer/extension-sdk';
```

See the [SDK Reference](docs/docs/extensions/sdk.md) for full class documentation.

## Sandbox

Extensions run in a sandboxed environment. The following globals are blocked:
- `fetch`, `XMLHttpRequest`, `WebSocket` (network)
- `localStorage`, `sessionStorage`, `indexedDB` (storage bypass)
- `eval` (code generation)
- `__TAURI__`, `__TAURI_INTERNALS__`, `__TAURI_IPC__` (Tauri IPC bypass)

Extensions access functionality through the `XplorerAPI` object provided via `onActivate`.

## Examples

See the `examples/` directory for complete working extensions:

- **Themes**: aurora, catppuccin, cyberpunk, dracula, high-contrast, nord, ocean-deep, rose-pine, solarized-dark, sunset, tokyo-night
- **Previews**: image-gallery, markdown-preview
- **Panels**: folder-stats, code-editor-extension, ssh-extension
- **Commands**: word-counter, json-formatter, file-hasher
