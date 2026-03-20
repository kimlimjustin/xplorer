# Image Gallery Extension

**Type**: Preview | **Category**: `preview`

Enhanced image preview with zoom controls, dimensions display, and navigation.

## Features

- Supports: PNG, JPG, JPEG, GIF, WebP, BMP, SVG, ICO, AVIF
- Zoom in/out with percentage display
- Checkerboard background for transparency
- Image dimensions and file size in info bar
- Prev/next navigation between images
- Pixelated rendering at high zoom (for pixel art)

## API Features Demonstrated

- **Preview extension pattern** (`canPreview`, `render`, `getPriority`)
- **Binary file reading** (`api.files.read` — ArrayBuffer)
- **Blob URL creation** (`URL.createObjectURL`)
- **React component rendering** with state (`useState`, `useEffect`, `useCallback`)
- **Cleanup patterns** (revoking object URLs)

## Build

```bash
npm install
npm run build
```
