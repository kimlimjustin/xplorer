// Xplorer Search Engine — Compatibility Layer Persistence
//
// Disk persistence helpers for SearchEngine settings and file I/O
// utilities used during indexing (content reading, metadata extraction).

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use super::compat_types::TokenizerSettings;

// ===== Persistence helpers ==================================================

fn data_dir() -> PathBuf {
    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("xplorer");
    fs::create_dir_all(&dir).ok();
    dir
}

fn settings_path() -> PathBuf {
    data_dir().join("tokenizer_settings.json")
}

pub(crate) fn load_settings() -> TokenizerSettings {
    fs::read_to_string(settings_path())
        .ok()
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

/// Atomically persist settings to disk (write temp file, then rename).
pub(crate) fn save_settings(settings: &TokenizerSettings) {
    if let Ok(json) = serde_json::to_string_pretty(settings) {
        let target = settings_path();
        let tmp = target.with_extension("json.tmp");
        if fs::write(&tmp, &json).is_ok() && fs::rename(&tmp, &target).is_err() {
            let _ = fs::remove_file(&tmp);
        }
    }
}

// ===== Document extraction extensions =======================================

const EXTRACTABLE_DOC_EXTENSIONS: &[&str] =
    &["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "rtf"];

// ===== File I/O helpers =====================================================

/// Check whether a file should be considered text-readable for content
/// indexing.  Binary extensions and files exceeding `max_size` are skipped.
pub(crate) fn is_text_indexable(path: &Path, blacklisted: &HashSet<String>, max_size: u64) -> bool {
    // Skip hidden files.
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        if name.starts_with('.') {
            return false;
        }
    } else {
        return false;
    }

    // Skip directories.
    if path.is_dir() {
        return false;
    }

    // Skip files exceeding the size limit.
    if let Ok(meta) = path.metadata() {
        if meta.len() > max_size {
            return false;
        }
    }

    // Skip blacklisted extensions.
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if blacklisted.contains(&ext.to_lowercase()) {
            return false;
        }
    }

    true
}

/// Determine the content source label for a file based on its extension.
pub(crate) fn content_source_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("pdf") => "pdf_extract",
        Some("docx") => "docx_extract",
        Some("xlsx") => "xlsx_extract",
        Some("pptx") => "pptx_extract",
        _ => "text",
    }
}

/// Read content from a file.  For extractable document types (pdf, docx,
/// xlsx, pptx) delegates to `crate::document_extractor::extract_text`.
/// For everything else falls back to `fs::read_to_string`.
pub(crate) fn read_file_content(path: &Path) -> Option<String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());

    let ext_str = ext.as_deref().unwrap_or("");

    if EXTRACTABLE_DOC_EXTENSIONS.contains(&ext_str) {
        // Use the document extractor for rich document types.
        match crate::document_extractor::extract_text(&path.to_string_lossy()) {
            Ok(text) if !text.trim().is_empty() => Some(text),
            _ => None,
        }
    } else {
        // Plain text read — skip files that fail (binary, encoding errors).
        fs::read_to_string(path).ok()
    }
}

/// Collect file metadata (size, modification time) for a path.
pub(crate) fn file_meta(path: &Path) -> (u64, u64) {
    let meta = match path.metadata() {
        Ok(m) => m,
        Err(_) => return (0, 0),
    };
    let size = meta.len();
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    (size, modified)
}
