# Plan: Software Path Finder Extension

## Overview
Create a public Xplorer extension that provides a searchable sidebar panel listing common software installation paths. Users type a name (e.g., "chrome") and see matching apps with their install location. Clicking an entry navigates to that folder.

## Tier: 1 (Small — single extension, 2 files)

## Architecture
- **Location**: `packages/extensions/software-finder/`
- **Registration**: `Sidebar.register()` (right panel)
- **Data**: Embedded catalog of ~50 popular apps with paths for macOS, Windows, Linux
- **Detection**: On render, check `api.files.exists()` for each app's path on current platform
- **UI**: Search bar + categorized list with status indicators (installed/not found)

## Tasks

### Task 1: Create extension package (package.json + build config)
- Files: `packages/extensions/software-finder/package.json`
- AC: Valid xplorer manifest, esbuild config, correct permissions

### Task 2: Implement extension UI (src/index.tsx)
- Files: `packages/extensions/software-finder/src/index.tsx`
- AC: Search bar filters apps, shows install status, click navigates to folder
- ~50 apps across 6 categories (browsers, dev, comms, productivity, media, system)

### Task 3: Build and verify
- AC: `pnpm run build` succeeds, TypeScript valid

## Execution: Single wave, 1 Executive (Sonnet)
