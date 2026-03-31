use notify::RecursiveMode;
use notify_debouncer_full::{new_debouncer, DebounceEventResult, DebouncedEvent};
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;
use tauri::{command, AppHandle, Emitter};
use tracing::{error, info, warn};

type WatcherHandle = notify_debouncer_full::Debouncer<
    notify::RecommendedWatcher,
    notify_debouncer_full::RecommendedCache,
>;

#[derive(Debug, Clone, Serialize)]
pub struct FileChangeEvent {
    pub watcher_id: String,
    pub path: String,
    pub event_type: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct WatcherInfo {
    pub id: String,
    pub path: String,
    pub recursive: bool,
}

struct WatcherEntry {
    _handle: WatcherHandle,
    path: String,
    recursive: bool,
}

static WATCHERS: LazyLock<Arc<Mutex<HashMap<String, WatcherEntry>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(HashMap::new())));

// ─── Primary watcher (single-directory facade) ─────────────────────────────
//
// The "primary watcher" is the watcher started by the legacy `start_watching` /
// `stop_watching` commands.  It maps onto a single multi-directory watcher entry
// stored in `WATCHERS` above, using a dedicated slot for its ID.

static PRIMARY_WATCHER_ID: LazyLock<Mutex<Option<String>>> = LazyLock::new(|| Mutex::new(None));

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

/// Stop the current primary watcher (if any). Safe to call even if nothing is
/// watching.  Used from the synchronous `on_window_event` close handler.
pub fn stop_primary_watcher() {
    if let Some(id) = take_primary_id() {
        let _ = std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("failed to build temp tokio runtime");
            let _ = rt.block_on(unwatch_directory(id));
        })
        .join();
    }
}

#[command]
pub async fn start_watching(path: String, app_handle: AppHandle) -> Result<(), String> {
    // Stop any previous primary watcher first.
    if let Some(old_id) = take_primary_id() {
        let _ = unwatch_directory(old_id).await;
    }

    // Delegate to the multi-directory watcher (non-recursive, matching original behaviour).
    let watcher_id = watch_directory(path, false, app_handle).await?;

    set_primary_id(watcher_id);

    Ok(())
}

#[command]
pub async fn stop_watching() -> Result<(), String> {
    if let Some(id) = take_primary_id() {
        unwatch_directory(id).await?;
    }
    Ok(())
}

// ─── Multi-directory watcher API ────────────────────────────────────────────

fn generate_watcher_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let r: u32 = rand::random();
    format!("watcher-{ts}-{r:08x}")
}

fn map_event_kind(kind: &notify::EventKind) -> &'static str {
    use notify::event::{ModifyKind, RenameMode};
    use notify::EventKind::*;
    match kind {
        Create(_) => "file-created",
        Remove(_) => "file-deleted",
        Modify(ModifyKind::Name(RenameMode::Both)) => "file-renamed",
        Modify(ModifyKind::Name(RenameMode::From)) => "file-deleted",
        Modify(ModifyKind::Name(RenameMode::To)) => "file-created",
        Modify(_) => "file-modified",
        _ => "file-modified",
    }
}

fn now_millis() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

#[command]
pub async fn watch_directory(
    path: String,
    recursive: bool,
    app_handle: AppHandle,
) -> Result<String, String> {
    let dir = Path::new(&path);
    if !dir.exists() {
        return Err(format!("Directory does not exist: {path}"));
    }
    if !dir.is_dir() {
        return Err(format!("Path is not a directory: {path}"));
    }

    let watcher_id = generate_watcher_id();
    let id_for_callback = watcher_id.clone();
    let handle = app_handle.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(200),
        None,
        move |result: DebounceEventResult| match result {
            Ok(events) => {
                for event in events {
                    let DebouncedEvent { event: ev, .. } = &event;
                    let event_type = map_event_kind(&ev.kind);
                    for p in &ev.paths {
                        let payload = FileChangeEvent {
                            watcher_id: id_for_callback.clone(),
                            path: p.to_string_lossy().to_string(),
                            event_type: event_type.to_string(),
                            timestamp: now_millis(),
                        };
                        let _ = handle.emit("fs-change", &payload);
                    }
                }
            }
            Err(errors) => {
                for err in errors {
                    error!("[file_watcher] error: {err:?}");
                }
            }
        },
    )
    .map_err(|e| format!("Failed to create file watcher: {e}"))?;

    let mode = if recursive {
        RecursiveMode::Recursive
    } else {
        RecursiveMode::NonRecursive
    };

    debouncer
        .watch(dir, mode)
        .map_err(|e| format!("Failed to watch directory {path}: {e}"))?;

    info!(
        "[file_watcher] Started watcher '{}' on '{}' (recursive={})",
        watcher_id, path, recursive
    );

    let entry = WatcherEntry {
        _handle: debouncer,
        path: path.clone(),
        recursive,
    };

    {
        let mut guard = WATCHERS.lock().unwrap_or_else(|e| e.into_inner());
        guard.insert(watcher_id.clone(), entry);
    }

    Ok(watcher_id)
}

#[command]
pub async fn unwatch_directory(watcher_id: String) -> Result<(), String> {
    let mut guard = WATCHERS.lock().unwrap_or_else(|e| e.into_inner());
    if guard.remove(&watcher_id).is_some() {
        info!("[file_watcher] Removed watcher '{}'", watcher_id);
        Ok(())
    } else {
        warn!(
            "[file_watcher] Watcher '{}' not found (may have already been removed)",
            watcher_id
        );
        Ok(())
    }
}

#[command]
pub async fn get_active_watchers() -> Result<Vec<WatcherInfo>, String> {
    let guard = WATCHERS.lock().unwrap_or_else(|e| e.into_inner());
    let infos: Vec<WatcherInfo> = guard
        .iter()
        .map(|(id, entry)| WatcherInfo {
            id: id.clone(),
            path: entry.path.clone(),
            recursive: entry.recursive,
        })
        .collect();
    Ok(infos)
}

pub fn stop_all_watchers() {
    let mut guard = WATCHERS.lock().unwrap_or_else(|e| e.into_inner());
    let count = guard.len();
    guard.clear();
    if count > 0 {
        info!("[file_watcher] Stopped all {} watchers on shutdown", count);
    }
}
