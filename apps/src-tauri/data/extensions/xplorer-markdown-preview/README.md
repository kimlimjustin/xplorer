# Markdown Preview Extension

**Type**: Preview | **Category**: `preview`

Preview Markdown files with formatted headings, code blocks, links, and more.

## Features

- Renders `.md`, `.markdown`, `.mdx` files
- Supports: headings, bold, italic, strikethrough, links, images
- Fenced code blocks with language labels
- Blockquotes, horizontal rules, task lists
- Word and line count in header
- Zero external dependencies (inline parser)

## API Features Demonstrated

- **Preview extension pattern** (`canPreview`, `render`, `getPriority`)
- **File text reading** (`api.files.readText`)
- **React component rendering** (`React.createElement` without JSX)
- **Panel registration** via manifest `contributes.panels`
- **Dynamic content updates** on file selection change

## Build

```bash
npm install
npm run build
```
