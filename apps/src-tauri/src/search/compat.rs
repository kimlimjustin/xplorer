// Xplorer Search Engine — Backward-Compatible API Layer
//
// Thin module that re-exports public types and `SearchEngine` from
// `compat_engine` so that code like `search::compat::SearchEngine` still works.
// Tauri command functions live in `compat_commands` and are referenced
// directly from main.rs as `search::compat_commands::*`.

// Re-export SearchEngine and its singleton accessor.
pub use super::compat_engine::{get_search_engine, SearchEngine};
// Re-export frontend-facing types.
pub use super::compat_types::{
    AISearchResult, CompatStructuredQuery, EnhancedSearchResult, FileToken, TokenizerSettings,
    TokenizerStats,
};
