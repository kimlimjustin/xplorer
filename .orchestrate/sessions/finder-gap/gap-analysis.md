# Xplorer vs macOS Finder — Complete Gap Analysis

## Score: Xplorer covers ~70% of Finder's features, and exceeds Finder in several areas.

### Where Xplorer BEATS Finder
- **10 view modes** (Finder has 4): icon, list, details, column, gallery, tree, tiles, content + 3 icon sizes
- **Search engine**: BM25F, fuzzy, semantic/hybrid AI search, NL queries, PDF content indexing
- **Split panes**: Arbitrary H/V split tree (Finder has none)
- **Built-in terminal**: Integrated terminal panel
- **File versioning**: Per-file version history with SHA256 dedup
- **Git integration**: GitHub Desktop-style git panel
- **Extensions**: Full extension system with marketplace
- **AI integration**: Claude/OpenAI/Ollama for file analysis, search, chat
- **Vim mode**: Full vim keybindings

---

## P1 Gaps (High Impact — Should Fix)

| # | Feature | Category | What Finder Has | Effort |
|---|---------|----------|-----------------|--------|
| 1 | Search scope toggle | UI/UX | "This Folder" / "This Mac" toggle | S |
| 2 | Search tokens | UI/UX | `kind:image date:today size:>1MB` formal syntax | M |
| 3 | Trash restore (macOS/Linux) | System | Restore deleted files from trash | S |
| 4 | Trash empty (macOS/Linux) | System | Empty trash programmatically | S |
| 5 | Security-scoped bookmarks | Security | Proper macOS sandbox file access persistence | M |
| 6 | Quarantine xattr | Security | `com.apple.quarantine` on downloaded files | M |
| 7 | TCC graceful degradation | Security | Handle Full Disk Access denial gracefully | M |
| 8 | Markup/annotation | Quick Actions | Draw on images/PDFs inline | L |

## P2 Gaps (Power User Features)

| # | Feature | Category | Effort |
|---|---------|----------|--------|
| 9 | Eject/unmount volumes | Disk | S |
| 10 | File locking toggle | File Info | S |
| 11 | Spring-loaded folders | Drag & Drop | S |
| 12 | Action menu in toolbar | UI/UX | S |
| 13 | Icon size continuous slider | UI/UX | S |
| 14 | High contrast mode | Accessibility | S |
| 15 | Volume disk space on macOS | Disk | S |
| 16 | Tags section in sidebar | UI/UX | M |
| 17 | Group by kind/type | Organization | M |
| 18 | Per-folder view memory | UI/UX | M |
| 19 | Resizable column widths | UI/UX | M |
| 20 | Create PDF from files | Quick Actions | M |
| 21 | macOS Share Sheet | Sharing | M |
| 22 | Spotlight integration | Search | M |
| 23 | iCloud sync status badges | Cloud | M |
| 24 | Screen reader live regions | Accessibility | M |
| 25 | AirDrop | Sharing | L |
| 26 | Connect to Server (SMB/WebDAV) | Network | L |
| 27 | Multiple windows | Window Mgmt | L |
| 28 | Trim video | Quick Actions | L |
| 29 | Gatekeeper verification | Security | M |

## P3 Gaps (Nice to Have)

| # | Feature | Effort |
|---|---------|--------|
| 30 | Show/hide columns in Details view | M |
| 31 | Customizable toolbar (drag rearrange) | L |
| 32 | Share button in toolbar | M |
| 33 | Drag to reorder sidebar | M |
| 34 | Quick Look slideshow | M |
| 35 | Quick Look annotation tools | L |
| 36 | New folder with selection | S |
| 37 | Sort by tags | S |
| 38 | Batch Get Info (aggregate) | M |
| 39 | Spotlight comments (kMDItem xattr) | M |
| 40 | Network drives (SMB/NFS/AFP) | L |
| 41 | APFS snapshots | L |
| 42 | iCloud optimized storage | L |
| 43 | macOS Services menu | M |
| 44 | Automator/AppleScript | L |
| 45 | Spotlight metadata write-back | M |
| 46 | Time Machine browsing | L |
| 47 | Proxy icon drag from title bar | S |
| 48 | RTL layout | M |
| 49 | Printing from file manager | S |
| 50 | Print to PDF | M |
| 51 | Path bar showing selected file | S |
| 52 | Status bar show/hide toggle | S |
| 53 | Merge all windows to tabs | M |
| 54 | Continuity (Handoff, etc.) | L (requires native Swift) |

---

## Recommended Execution Order

### Sprint 1: Quick wins (all S effort, high impact)
1. Search scope toggle ("This Folder" / "Everywhere")
2. Trash restore + empty on macOS/Linux
3. Eject/unmount volumes
4. File locking toggle in Properties
5. Spring-loaded folders (hover timer during drag)
6. Action menu (gear icon) in toolbar
7. Icon size slider
8. High contrast accessibility mode

### Sprint 2: Medium effort, high value
9. Search token syntax (`kind:`, `date:`, `size:`)
10. Tags section in sidebar
11. Group by kind/type
12. Per-folder view memory
13. Resizable column widths
14. macOS Share Sheet integration

### Sprint 3: Platform hardening
15. Security-scoped bookmarks (macOS sandbox)
16. Quarantine xattr handling
17. TCC graceful degradation
18. iCloud sync status badges
19. Spotlight integration

### Sprint 4: Advanced features
20. Markup/annotation on images & PDFs
21. Create PDF
22. Connect to Server (SMB/WebDAV)
23. Multiple windows
24. Video trimming

---

## Summary Counts

| Priority | Count | S Effort | M Effort | L Effort |
|----------|-------|----------|----------|----------|
| P1 | 8 | 3 | 4 | 1 |
| P2 | 21 | 6 | 9 | 6 |
| P3 | 25 | 6 | 11 | 8 |
| **Total** | **54** | **15** | **24** | **15** |
