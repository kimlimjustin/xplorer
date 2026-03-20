# File Hasher Extension

**Type**: Action | **Category**: `action`

Calculate SHA-256, SHA-1, and MD5 file hashes from the context menu.

## Features

- Right-click any file to calculate its hash
- Supports SHA-256, SHA-1, and MD5 algorithms
- Copies hash to clipboard automatically
- Shows file size alongside the hash

## API Features Demonstrated

- **Context menu integration** (contributes.context_menus)
- **Binary file reading** (`api.files.read` — ArrayBuffer)
- **Web Crypto API** (`crypto.subtle.digest`)
- **Clipboard access** (`navigator.clipboard.writeText`)
- **UI notifications** (`api.ui.showMessage`)
- **`when` conditions** for context menu visibility

## Build

```bash
npm install
npm run build
```
