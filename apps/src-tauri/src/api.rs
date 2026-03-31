// This module has been removed.
//
// The in-memory Storage CRUD commands (get_files, get_extensions, etc.) were
// dead code — no frontend component ever invoked them.  They originated from
// an old Express/Next.js web server that was replaced by Tauri IPC.
//
// The real storage layer lives in the sub-modules under `storage/` (tags,
// bookmarks, notes, metadata, recent, extensions_storage, chat).
