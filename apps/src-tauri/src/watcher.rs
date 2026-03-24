// Unified watcher — delegates to file_watcher using a reserved watcher key.
//
// The original single-directory watcher is preserved as a thin facade so the
// frontend API (`start_watching` / `stop_watching`) does not change, but under
// the hood everything goes through the multi-directory `file_watcher` module.

use std::sync::{LazyLock, Mutex};
use tauri::{command, AppHandle};

use crate::file_watcher;

/// Stores the watcher id returned by `file_watcher::watch_directory` so we can
/// tear it down later via `stop_watcher` / `stop_watching`.
static PRIMARY_WATCHER_ID: LazyLock<Mutex<Option<String>>> =
    LazyLock::new(|| Mutex::new(None));

/// Take the current primary watcher id out of the static, if any.
fn take_primary_id() -> Option<String> {
    let mut guard = PRIMARY_WATCHER_ID.lock().unwrap_or_else(|e| e.into_inner());
    guard.take()
}

/// Store a new primary watcher id.
fn set_primary_id(id: String) {
    let mut guard = PRIMARY_WATCHER_ID.lock().unwrap_or_else(|e| e.into_inner());
    *guard = Some(id);
}

/// Stop the current primary watcher (if any). Safe to call even if nothing is watching.
pub fn stop_watcher() {
    if let Some(id) = take_primary_id() {
        // Use a blocking approach: spawn a temporary tokio runtime to call the
        // async unwatch. This is used in the on_window_event close handler which
        // is synchronous.
        let _ = std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("failed to build temp tokio runtime");
            let _ = rt.block_on(file_watcher::unwatch_directory(id));
        })
        .join();
    }
}

#[command]
pub async fn start_watching(path: String, app_handle: AppHandle) -> Result<(), String> {
    // Stop any previous primary watcher first.
    if let Some(old_id) = take_primary_id() {
        let _ = file_watcher::unwatch_directory(old_id).await;
    }

    // Delegate to the multi-directory watcher (non-recursive, matching original behaviour).
    let watcher_id = file_watcher::watch_directory(path, false, app_handle).await?;

    set_primary_id(watcher_id);

    Ok(())
}

#[command]
pub async fn stop_watching() -> Result<(), String> {
    if let Some(id) = take_primary_id() {
        file_watcher::unwatch_directory(id).await?;
    }
    Ok(())
}
