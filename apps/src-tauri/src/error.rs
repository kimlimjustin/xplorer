//! Shared error types for the Xplorer backend.
//!
//! Provides `AppError` — a typed error enum that replaces ad-hoc `String`
//! errors.  Implements `Into<String>` so existing `Result<T, String>` Tauri
//! commands can adopt it incrementally via the `?` operator.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Path error: {0}")]
    InvalidPath(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Operation failed: {0}")]
    OperationFailed(String),

    #[error("External service error: {0}")]
    External(String),

    #[error("{0}")]
    Other(String),
}

impl From<AppError> for String {
    fn from(e: AppError) -> String {
        e.to_string()
    }
}

/// Convenience alias used throughout the crate.
pub type AppResult<T> = Result<T, AppError>;
