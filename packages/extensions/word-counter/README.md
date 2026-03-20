# Word Counter Extension

**Type**: Tool | **Category**: `tool`

Count words, lines, characters, and paragraphs in text files.

## Features

- Counts words, lines, characters, and paragraphs
- Works on 50+ text file types (code, docs, config files)
- Keyboard shortcut: `Ctrl+Shift+W`
- Persists last count via settings API

## API Features Demonstrated

- **Command registration** (`api.commands.register`)
- **Keyboard shortcuts** (`api.shortcuts.register`)
- **File reading** (`api.files.readText`)
- **UI notifications** (`api.ui.showMessage`)
- **Settings persistence** (`api.settings.set/get`)
- **Global state access** (`window.__xplorer_state__`)

## Build

```bash
npm install
npm run build
```

## Install

Copy this folder to your Xplorer extensions directory, or install via:
```bash
xplorer-sdk install --dev .
```
