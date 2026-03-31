// Legacy watcher module — the primary watcher concept has been consolidated
// into file_watcher.rs.  This module re-exports everything for backward
// compatibility so that `crate::watcher::start_watching`, etc. still resolve.

pub use crate::file_watcher::{start_watching, stop_primary_watcher as stop_watcher, stop_watching};
