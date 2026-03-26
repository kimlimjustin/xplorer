# Screenshot Capture Guide

Save all screenshots as PNG files in this directory (`web/public/screenshots/`).
Recommended resolution: 1280x800 or 1920x1080, then crop to the relevant area.

## Required Screenshots

### 1. `main-interface.png`
**Used in**: Introduction page
**What to capture**: Full Xplorer window showing the glassmorphic theme with files visible in the main grid, left sidebar, and top bar. Pick a directory with varied file types (images, folders, documents) for visual interest.

### 2. `file-browser.png`
**Used in**: File Browsing page
**What to capture**: Full window showing the file grid with a mix of files and folders. Should show the left sidebar, top bar with address bar, and file grid area clearly.

### 3. `view-grid.png`
**Used in**: File Browsing > Grid View
**What to capture**: Close-up of the file grid in **grid mode** showing file cards with icons and names. Crop to just the grid area.

### 4. `view-list.png`
**Used in**: File Browsing > List View
**What to capture**: Close-up of the file grid in **list mode** showing compact single-line entries. Crop to just the list area.

### 5. `view-details.png`
**Used in**: File Browsing > Details View
**What to capture**: Close-up of the file grid in **details/table mode** with sortable column headers (Name, Size, Date, Type). Crop to the table area.

### 6. `address-bar.png`
**Used in**: File Browsing > Navigation
**What to capture**: Close-up of the top bar showing the address bar with breadcrumb path, back/forward/up buttons. Crop to just the top bar area.

### 7. `left-sidebar.png`
**Used in**: File Browsing > Quick Access
**What to capture**: Close-up of the left sidebar showing Home, Desktop, Documents, Downloads, Pictures, drives, and bookmarks. Crop to just the sidebar.

### 8. `preview-image.png`
**Used in**: File Previews page
**What to capture**: Select an image file and show the right sidebar preview panel displaying the image. Should show both the file grid (with image selected) and the preview panel.

### 9. `preview-code.png`
**Used in**: File Previews > Code
**What to capture**: Select a code file (.ts, .rs, .py, etc.) and show the syntax-highlighted code preview in the right sidebar. Should clearly show line numbers and syntax colors.

### 10. `context-menu.png`
**Used in**: File Operations page
**What to capture**: Right-click on a file to show the context menu with options like Copy, Cut, Paste, Rename, Delete, Compress, Open With, etc.

### 11. `duplicate-finder.png`
**Used in**: File Operations > Duplicate Finder
**What to capture**: Open the Duplicate Finder panel from the bottom bar and show results with duplicate file groups.

### 12. `search-bar.png`
**Used in**: Search & Tokenizer page
**What to capture**: The smart search bar (Ctrl+K or click search) in the top bar, either in its focused/expanded state or showing the search modal.

### 13. `search-results.png`
**Used in**: Search & Tokenizer > Natural Language Search
**What to capture**: Search results from a natural language query like "large images" or "documents from last week". Show the results list with file matches.

### 14. `ai-chat.png`
**Used in**: AI Integration page
**What to capture**: The AI chat panel in the bottom/right panel showing a conversation. Best if it shows a question about files and an AI response. Requires Ollama running.

### 15. `ai-organizer.png`
**Used in**: AI Integration > File Organizer
**What to capture**: The File Organizer panel showing analysis results — file categories, organization suggestions, or directory insights. Requires Ollama running.

### 16. `git-history.png`
**Used in**: Git Integration page
**What to capture**: The Git History panel showing commit log with author names, dates, and commit messages. Navigate to a git repo first.

### 17. `git-branches.png`
**Used in**: Git Integration > Branch Management
**What to capture**: The Branch Manager showing local/remote branches. Navigate to a git repo with multiple branches.

### 18. `extensions-panel.png`
**Used in**: Extension System page
**What to capture**: The Extensions panel (right sidebar) showing installed extensions, both built-in and any third-party. Should show extension names, icons, and toggle states.

## Tips

- Use the **Glass theme** (default) for all screenshots — it looks best in docs
- If a feature requires setup (AI, Git), capture it in a directory where it works
- For panels, expand them to a good size before capturing
- Crop tightly to the relevant area — avoid excess whitespace
- Use Windows Snipping Tool (`Win+Shift+S`) for quick region capture
- Save as PNG (not JPG) for sharp text
