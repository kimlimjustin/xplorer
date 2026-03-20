use notify::RecursiveMode;
use notify_debouncer_full::{new_debouncer, DebouncedEvent, DebounceEventResult};
use serde::Serialize;
use std::path::Path;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;
use tauri::{command, AppHandle, Emitter};
use tracing::error;

/// Payload emitted to the frontend on filesystem changes.
#[derive(Debug, Clone, Serialize)]
pub struct FsChangeEvent {
    pub path: String,
    pub kind: String,
}

/// Maps a `notify` event kind to one of the four canonical strings.
fn event_kind_str(kind: &notify::EventKind) -> &'static str {
    use notify::EventKind::*;
    match kind {
        Create(_) => "create",
        Modify(_) => "modify",
        Remove(_) => "remove",
        _ => "modify", // Access, Other, Any → treat as modify
    }
}

type WatcherHandle = notify_debouncer_full::Debouncer<notify::RecommendedWatcher, notify_debouncer_full::FileIdMap>;

static WATCHER: LazyLock<Arc<Mutex<Option<WatcherHandle>>>> = LazyLock::new(|| Arc::new(Mutex::new(None)));

/// Stop the current watcher (if any). Safe to call even if nothing is watching.
pub fn stop_watcher() {
    let mut guard = WATCHER.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_some() {
        // Dropping the debouncer stops the watcher and joins its thread.
        *guard = None;
    }
}

#[command]
pub async fn start_watching(path: String, app_handle: AppHandle) -> Result<(), String> {
    // Stop any previous watcher first.
    stop_watcher();

    let watched_path = path.clone();
    let handle = app_handle.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(500),
        None,
        move |result: DebounceEventResult| {
            match result {
                Ok(events) => {
                    for event in events {
                        let DebouncedEvent { event: ev, .. } = &event;
                        let kind_str = event_kind_str(&ev.kind);
                        for p in &ev.paths {
                            let payload = FsChangeEvent {
                                path: p.to_string_lossy().to_string(),
                                kind: kind_str.to_string(),
                            };
                            let _ = handle.emit("fs-change", &payload);
                        }
                    }
                }
                Err(errors) => {
                    for err in errors {
                        error!("[watcher] error: {err:?}");
                    }
                }
            }
        },
    )
    .map_err(|e| format!("Failed to create file watcher: {e}"))?;

    // Watch the target directory non-recursively (only the directory the user is viewing).
    debouncer
        .watch(Path::new(&watched_path), RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch path {watched_path}: {e}"))?;

    // Store the debouncer so it stays alive.
    let mut guard = WATCHER.lock().unwrap_or_else(|e| e.into_inner());
    *guard = Some(debouncer);

    Ok(())
}

#[command]
pub async fn stop_watching() -> Result<(), String> {
    stop_watcher();
    Ok(())
}
