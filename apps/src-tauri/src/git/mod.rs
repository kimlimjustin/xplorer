mod parsing;
pub(crate) mod service;
pub mod types;
pub(crate) mod validation;

pub mod branch_ops;
pub mod history;
pub mod staging;
pub mod stash_ops;
pub mod status;

// Re-export all types
pub use types::*;

// Re-export GitService for use by other modules
pub use service::GitService;
