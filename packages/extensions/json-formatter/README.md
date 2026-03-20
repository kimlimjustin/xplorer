# JSON Formatter Extension

**Type**: Action | **Category**: `action`

Format, minify, and validate JSON files from the context menu.

## Features

- **Format**: Pretty-print with 2-space indentation
- **Minify**: Compress to single line (shows bytes saved)
- **Validate**: Check syntax and report error location (line/column)
- Right-click any `.json` file to access

## API Features Demonstrated

- **File reading AND writing** (`api.files.readText`, `api.files.write`)
- **In-place file transformation** (read → transform → write back)
- **Context menu with file extension filter** (`when: "fileExtension:.json"`)
- **Error handling** with user-friendly messages
- **Command registration** (`api.commands.register`)

## Build

```bash
npm install
npm run build
```
