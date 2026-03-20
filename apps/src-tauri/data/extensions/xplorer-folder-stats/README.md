# Folder Statistics Extension

**Type**: Panel | **Category**: `panel`

Displays file statistics and distribution for the current directory in a sidebar panel.

## Features

- Summary cards: file count, folder count, total size, unique types
- File type distribution bar chart (color-coded by extension)
- Top 5 largest files
- Newest and oldest file timeline
- Updates dynamically when navigating directories

## API Features Demonstrated

- **Panel extension pattern** (`render` with React component)
- **Directory listing** (`api.files.list`)
- **Navigation API** (`props.currentPath` from render props)
- **React state management** (`useState`, `useEffect`, `useMemo`)
- **Data visualization** (bar chart with CSS)
- **Panel registration** via manifest `contributes.panels`

## Build

```bash
npm install
npm run build
```
