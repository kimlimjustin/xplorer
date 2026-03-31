// Storage module - comprehensive file and data management
//
// This module is split into sub-modules for maintainability:
//   - recent:             Recently accessed files tracking
//   - bookmarks:          Bookmark/favorites management
//   - tags:               File tags & hierarchical tag categories
//   - notes:              File notes & file annotations
//   - metadata:           Custom metadata fields
//   - extensions_storage: Extension-scoped key-value storage
//   - chat:               Chat history sessions
//   - chat_files:         Chat-as-files (filesystem-backed)

mod bookmarks;
mod chat;
pub mod chat_files;
mod extensions_storage;
mod metadata;
mod notes;
mod recent;
mod tags;

// Re-export everything so downstream code using `crate::storage::*` keeps working.
pub use bookmarks::*;
pub use chat::*;
pub use extensions_storage::*;
pub use metadata::*;
pub use notes::*;
pub use recent::*;
pub use tags::*;

// ─── Shared helper ───────────────────────────────────────────────────────────

pub(crate) fn generate_id() -> String {
    format!("{}", chrono::Utc::now().timestamp_millis())
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bookmark_entry_serialization() {
        let bookmark = BookmarkEntry {
            path: "/home/user/docs".to_string(),
            name: "Documents".to_string(),
            added_at: "2026-03-01T00:00:00Z".to_string(),
            is_dir: true,
        };
        let json = serde_json::to_string(&bookmark).unwrap();
        let deserialized: BookmarkEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.path, bookmark.path);
        assert_eq!(deserialized.name, bookmark.name);
        assert_eq!(deserialized.is_dir, bookmark.is_dir);
    }

    #[test]
    fn test_file_tag_serialization() {
        let tag = FileTag {
            name: "important".to_string(),
            color: "#ff5555".to_string(),
        };
        let json = serde_json::to_string(&tag).unwrap();
        let deserialized: FileTag = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "important");
        assert_eq!(deserialized.color, "#ff5555");
    }

    #[test]
    fn test_file_note_serialization() {
        let note = FileNote {
            id: "12345".to_string(),
            title: "My Note".to_string(),
            content: "Some content here".to_string(),
            created_at: "2026-03-01T00:00:00Z".to_string(),
            updated_at: "2026-03-01T00:00:00Z".to_string(),
        };
        let json = serde_json::to_string(&note).unwrap();
        let deserialized: FileNote = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "12345");
        assert_eq!(deserialized.title, "My Note");
        assert_eq!(deserialized.content, "Some content here");
    }

    #[test]
    fn test_recent_file_serialization() {
        let recent = RecentFile {
            path: "/home/user/file.txt".to_string(),
            name: "file.txt".to_string(),
            accessed_at: 1709251200000,
            file_type: "txt".to_string(),
            size: 1024,
        };
        let json = serde_json::to_string(&recent).unwrap();
        let deserialized: RecentFile = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.path, recent.path);
        assert_eq!(deserialized.accessed_at, recent.accessed_at);
        assert_eq!(deserialized.size, 1024);
    }
}
