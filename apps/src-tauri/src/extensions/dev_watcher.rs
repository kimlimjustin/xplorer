use notify::RecursiveMode;
use notify_debouncer_full::{new_debouncer, DebounceEventResult, DebouncedEvent};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tracing::{info, warn};

type WatcherHandle = notify_debouncer_full::Debouncer<
    notify::RecommendedWatcher,
    notify_debouncer_full::RecommendedCache,
>;

/// Payload emitted via the `extension-dev-reload` Tauri event.
#[derive(Debug, Clone, Serialize)]
pub struct DevReloadEvent {
    pub path: String,
    pub id: String,
}

/// Info about a dev-mode extension discovered via `.hotreload` sentinel.
#[derive(Debug, Clone, Serialize)]
pub struct DevExtensionInfo {
    pub id: String,
    pub path: String,
    pub main_file: String,
}

struct DevWatcherEntry {
    _handle: WatcherHandle,
    _extension_path: String,
}

/// Active dev-mode watchers keyed by extension directory path.
static DEV_WATCHERS: LazyLock<Arc<Mutex<HashMap<String, DevWatcherEntry>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(HashMap::new())));

/// Read the extension ID from `package.json` in the given directory.
/// Falls back to the directory name if parsing fails.
fn read_extension_id(extension_dir: &Path) -> String {
    let pkg_path = extension_dir.join("package.json");
    if let Ok(raw) = std::fs::read_to_string(&pkg_path) {
        if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&raw) {
            if let Some(id) = pkg
                .get("xplorer")
                .and_then(|x| x.get("id"))
                .and_then(|v| v.as_str())
            {
                return id.to_string();
            }
        }
    }
    extension_dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

/// Read the `main` field from `package.json`, defaulting to `dist/index.js`.
fn read_main_file(extension_dir: &Path) -> String {
    let pkg_path = extension_dir.join("package.json");
    if let Ok(raw) = std::fs::read_to_string(&pkg_path) {
        if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&raw) {
            if let Some(main) = pkg.get("main").and_then(|v| v.as_str()) {
                return main.to_string();
            }
            // Also check xplorer.main
            if let Some(main) = pkg
                .get("xplorer")
                .and_then(|x| x.get("main"))
                .and_then(|v| v.as_str())
            {
                return main.to_string();
            }
        }
    }
    "dist/index.js".to_string()
}

/// Scan a directory for subdirectories containing `.hotreload` sentinel files.
fn scan_for_hotreload(extensions_dir: &Path) -> Vec<DevExtensionInfo> {
    let mut results = Vec::new();
    let entries = match std::fs::read_dir(extensions_dir) {
        Ok(entries) => entries,
        Err(_) => return results,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let hotreload = path.join(".hotreload");
        if hotreload.exists() {
            let id = read_extension_id(&path);
            let main_file = read_main_file(&path);
            results.push(DevExtensionInfo {
                id,
                path: path.to_string_lossy().to_string(),
                main_file,
            });
        }
    }
    results
}

/// Start watching a single extension's build output for changes.
fn watch_extension(app_handle: &AppHandle, info: &DevExtensionInfo) -> Result<(), String> {
    let ext_path = PathBuf::from(&info.path);
    let main_path = ext_path.join(&info.main_file);

    // Determine what to watch: the file itself or its parent directory
    let watch_target = if main_path.exists() {
        main_path.clone()
    } else {
        // Watch the dist directory (or extension root) so we catch the file being created
        let dist_dir = main_path
            .parent()
            .unwrap_or(&ext_path);
        if dist_dir.exists() {
            dist_dir.to_path_buf()
        } else {
            // Create the dist directory so we can watch it
            let _ = std::fs::create_dir_all(dist_dir);
            dist_dir.to_path_buf()
        }
    };

    let ext_id = info.id.clone();
    let ext_path_str = info.path.clone();
    let main_file_name = main_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "index.js".to_string());
    let handle = app_handle.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(500),
        None,
        move |result: DebounceEventResult| match result {
            Ok(events) => {
                let mut should_reload = false;
                for event in &events {
                    let DebouncedEvent { event: ev, .. } = event;
                    // Only trigger on modifications/creates, not on deletions
                    match ev.kind {
                        notify::EventKind::Modify(_) | notify::EventKind::Create(_) => {}
                        _ => continue,
                    }
                    for p in &ev.paths {
                        let fname = p
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_default();
                        if fname == main_file_name {
                            should_reload = true;
                        }
                    }
                }
                if should_reload {
                    info!(
                        "[dev_watcher] Detected change in {}, emitting reload for {}",
                        main_file_name, ext_id
                    );
                    let payload = DevReloadEvent {
                        path: ext_path_str.clone(),
                        id: ext_id.clone(),
                    };
                    let _ = handle.emit("extension-dev-reload", &payload);
                }
            }
            Err(errors) => {
                for err in errors {
                    warn!("[dev_watcher] watch error: {err:?}");
                }
            }
        },
    )
    .map_err(|e| format!("Failed to create dev watcher: {e}"))?;

    let mode = if watch_target.is_dir() {
        RecursiveMode::NonRecursive
    } else {
        RecursiveMode::NonRecursive
    };

    debouncer
        .watch(&watch_target, mode)
        .map_err(|e| format!("Failed to watch {}: {e}", watch_target.display()))?;

    // Also watch the parent dir if we are watching a specific file,
    // so we catch file replacements (atomic write = delete + create)
    if watch_target.is_file() {
        if let Some(parent) = watch_target.parent() {
            let _ = debouncer.watch(parent, RecursiveMode::NonRecursive);
        }
    }

    let entry = DevWatcherEntry {
        _handle: debouncer,
        _extension_path: info.path.clone(),
    };

    let mut watchers = DEV_WATCHERS.lock().unwrap_or_else(|e| e.into_inner());
    watchers.insert(info.path.clone(), entry);

    info!(
        "[dev_watcher] Watching extension '{}' at {}",
        info.id, info.path
    );

    Ok(())
}

/// Remove a watcher for an extension that no longer has `.hotreload`.
fn unwatch_extension(extension_path: &str) {
    let mut watchers = DEV_WATCHERS.lock().unwrap_or_else(|e| e.into_inner());
    if watchers.remove(extension_path).is_some() {
        info!(
            "[dev_watcher] Stopped watching extension at {}",
            extension_path
        );
    }
}

/// Start the dev watcher background loop. This scans the given extensions
/// directory every 5 seconds for `.hotreload` sentinel files. When a new
/// sentinel is found, a file watcher is set up on the extension's build
/// output. When a sentinel is removed, the watcher is cleaned up.
///
/// This function blocks forever and should be called from a spawned thread.
pub fn start_dev_watcher(app_handle: AppHandle, extensions_dir: PathBuf) {
    info!(
        "[dev_watcher] Starting dev mode watcher, scanning {}",
        extensions_dir.display()
    );

    loop {
        // Scan for .hotreload sentinels
        let dev_extensions = scan_for_hotreload(&extensions_dir);
        let active_paths: Vec<String> = dev_extensions.iter().map(|e| e.path.clone()).collect();

        // Start watchers for new dev extensions
        for info in &dev_extensions {
            let already_watching = {
                let watchers = DEV_WATCHERS.lock().unwrap_or_else(|e| e.into_inner());
                watchers.contains_key(&info.path)
            };

            if !already_watching {
                if let Err(e) = watch_extension(&app_handle, info) {
                    warn!(
                        "[dev_watcher] Failed to watch extension '{}': {}",
                        info.id, e
                    );
                }
            }
        }

        // Clean up watchers for extensions that no longer have .hotreload
        let stale_paths: Vec<String> = {
            let watchers = DEV_WATCHERS.lock().unwrap_or_else(|e| e.into_inner());
            watchers
                .keys()
                .filter(|p| !active_paths.contains(p))
                .cloned()
                .collect()
        };
        for path in stale_paths {
            unwatch_extension(&path);
        }

        // Sleep 5 seconds before re-scanning
        std::thread::sleep(Duration::from_secs(5));
    }
}

/// Stop all dev watchers. Called during app shutdown.
pub fn stop_all_dev_watchers() {
    let mut watchers = DEV_WATCHERS.lock().unwrap_or_else(|e| e.into_inner());
    let count = watchers.len();
    watchers.clear();
    if count > 0 {
        info!("[dev_watcher] Stopped {} dev watcher(s)", count);
    }
}
