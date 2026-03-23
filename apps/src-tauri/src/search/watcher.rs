// Xplorer Search Engine — Filesystem Change Watcher
//
// Watches whitelisted directories for file-system changes and emits
// batched `FileChangeEvent`s that the incremental indexer consumes
// to keep the search index up-to-date without full re-scans.
//
// Uses `notify` v7 with a manual 200ms debounce window so that rapid
// bursts of writes (e.g. saves, builds) are collapsed into a single
// callback invocation.

use notify::{
    event::ModifyKind, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant};
use tracing::{warn, error};

// ===== Public types =====

/// Events emitted by the filesystem watcher.
#[derive(Debug, Clone)]
pub enum FileChangeEvent {
    Created(PathBuf),
    Modified(PathBuf),
    Removed(PathBuf),
    Renamed { from: PathBuf, to: PathBuf },
}

/// Callback type for handling batched file change events.
pub type ChangeCallback = Box<dyn Fn(Vec<FileChangeEvent>) + Send + Sync>;

// ===== FileWatcher =====

/// Watches whitelisted directories for file changes with debouncing.
///
/// Lifecycle:
///   1. `FileWatcher::new()`
///   2. `set_callback(cb)` — register the event handler
///   3. `set_blacklisted_extensions(exts)` — optionally configure filters
///   4. `start()` — spin up the watcher + processing thread
///   5. `watch_path(p)` / `unwatch_path(p)` — add/remove watched dirs
///   6. `stop()` — tear down
pub struct FileWatcher {
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
    watched_paths: Arc<Mutex<HashSet<PathBuf>>>,
    callback: Arc<Mutex<Option<ChangeCallback>>>,
    /// Extensions to ignore (binary files, etc.)
    blacklisted_extensions: Arc<Mutex<HashSet<String>>>,
    running: Arc<AtomicBool>,
}

// ===== Helpers =====

/// Returns `true` when the path should be processed (not hidden, not
/// blacklisted, and points to a file rather than a directory).
fn should_process(path: &Path, blacklisted: &HashSet<String>) -> bool {
    // Reject directories — we only care about files.
    if path.is_dir() {
        return false;
    }

    // Reject hidden files (name starts with '.').
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        if name.starts_with('.') {
            return false;
        }
    } else {
        // No file name at all (e.g. bare root path) — skip.
        return false;
    }

    // Reject blacklisted extensions.
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if blacklisted.contains(&ext.to_lowercase()) {
            return false;
        }
    }

    true
}

/// Converts a raw `notify::Event` into zero or more `FileChangeEvent`s.
fn classify_event(event: &notify::Event) -> Vec<FileChangeEvent> {
    let mut out = Vec::new();

    match &event.kind {
        EventKind::Create(_) => {
            for p in &event.paths {
                out.push(FileChangeEvent::Created(p.clone()));
            }
        }

        EventKind::Modify(modify_kind) => {
            match modify_kind {
                // Rename events may carry two paths: old and new.
                ModifyKind::Name(_) => {
                    if event.paths.len() >= 2 {
                        out.push(FileChangeEvent::Renamed {
                            from: event.paths[0].clone(),
                            to: event.paths[1].clone(),
                        });
                    } else {
                        // Single-path rename — treat as a creation (the
                        // "to" side was observed without the "from" side,
                        // which can happen on some platforms).
                        for p in &event.paths {
                            out.push(FileChangeEvent::Modified(p.clone()));
                        }
                    }
                }
                // Data/content/metadata changes.
                ModifyKind::Data(_) | ModifyKind::Any => {
                    for p in &event.paths {
                        out.push(FileChangeEvent::Modified(p.clone()));
                    }
                }
                // Metadata-only changes (permissions, timestamps) — still
                // worth processing since metadata is indexed.
                ModifyKind::Metadata(_) => {
                    for p in &event.paths {
                        out.push(FileChangeEvent::Modified(p.clone()));
                    }
                }
                // Any other modify sub-kind.
                _ => {
                    for p in &event.paths {
                        out.push(FileChangeEvent::Modified(p.clone()));
                    }
                }
            }
        }

        EventKind::Remove(_) => {
            for p in &event.paths {
                out.push(FileChangeEvent::Removed(p.clone()));
            }
        }

        // Access / Other — ignore.
        _ => {}
    }

    out
}

impl FileWatcher {
    /// Create a new `FileWatcher`.  The watcher is inert until `start()` is
    /// called.
    pub fn new() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
            watched_paths: Arc::new(Mutex::new(HashSet::new())),
            callback: Arc::new(Mutex::new(None)),
            blacklisted_extensions: Arc::new(Mutex::new(HashSet::new())),
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Register the callback that receives batched change events.
    pub fn set_callback(&self, cb: ChangeCallback) {
        let mut guard = self.callback.lock().unwrap_or_else(|e| e.into_inner());
        *guard = Some(cb);
    }

    /// Configure which file extensions should be silently ignored.
    /// Extensions should be supplied *without* a leading dot (e.g. `"exe"`).
    pub fn set_blacklisted_extensions(&self, exts: Vec<String>) {
        let mut guard = self
            .blacklisted_extensions
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        *guard = exts.into_iter().map(|e| e.to_lowercase()).collect();
    }

    /// Start watching a directory recursively.  If the path is already
    /// being watched the call is a no-op.
    pub fn watch_path(&self, path: &Path) -> Result<(), String> {
        let canonical = match std::fs::canonicalize(path) {
            Ok(p) => p,
            Err(e) => {
                warn!("[search::watcher] cannot canonicalize {}: {e}", path.display());
                return Err(format!("Path does not exist or is inaccessible: {}", path.display()));
            }
        };

        {
            let guard = self.watched_paths.lock().unwrap_or_else(|e| e.into_inner());
            if guard.contains(&canonical) {
                // Already watching — nothing to do.
                return Ok(());
            }
        }

        {
            let mut watcher_guard = self.watcher.lock().unwrap_or_else(|e| e.into_inner());
            match watcher_guard.as_mut() {
                Some(w) => {
                    w.watch(&canonical, RecursiveMode::Recursive)
                        .map_err(|e| {
                            warn!(
                                "[search::watcher] failed to watch {}: {e}",
                                canonical.display()
                            );
                            format!("Failed to watch {}: {e}", canonical.display())
                        })?;
                }
                None => {
                    return Err("Watcher has not been started yet. Call start() first.".into());
                }
            }
        }

        let mut guard = self.watched_paths.lock().unwrap_or_else(|e| e.into_inner());
        guard.insert(canonical);
        Ok(())
    }

    /// Stop watching a directory.
    pub fn unwatch_path(&self, path: &Path) -> Result<(), String> {
        let canonical = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());

        {
            let guard = self.watched_paths.lock().unwrap_or_else(|e| e.into_inner());
            if !guard.contains(&canonical) {
                return Ok(());
            }
        }

        {
            let mut watcher_guard = self.watcher.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(w) = watcher_guard.as_mut() {
                w.unwatch(&canonical)
                    .map_err(|e| {
                        warn!(
                            "[search::watcher] failed to unwatch {}: {e}",
                            canonical.display()
                        );
                        format!("Failed to unwatch {}: {e}", canonical.display())
                    })?;
            }
        }

        let mut guard = self.watched_paths.lock().unwrap_or_else(|e| e.into_inner());
        guard.remove(&canonical);
        Ok(())
    }

    /// Initialise the underlying `notify` watcher and spawn the event-
    /// processing thread.
    ///
    /// The processing thread uses a simple timer-based debounce: when the
    /// first event arrives a 200ms window opens; all events within that
    /// window are batched together and delivered to the callback in one go.
    pub fn start(&mut self) -> Result<(), String> {
        if self.running.load(Ordering::SeqCst) {
            return Err("Watcher is already running.".into());
        }

        let (tx, rx) = mpsc::channel::<notify::Event>();

        let watcher = notify::RecommendedWatcher::new(
            move |result: Result<notify::Event, notify::Error>| match result {
                Ok(event) => {
                    let _ = tx.send(event);
                }
                Err(e) => {
                    error!("[search::watcher] notify error: {e:?}");
                }
            },
            notify::Config::default(),
        )
        .map_err(|e| format!("Failed to create filesystem watcher: {e}"))?;

        {
            let mut watcher_guard = self.watcher.lock().unwrap_or_else(|e| e.into_inner());
            *watcher_guard = Some(watcher);
        }
        self.running.store(true, Ordering::SeqCst);

        // Clone Arcs for the processing thread.
        let running = Arc::clone(&self.running);
        let callback = Arc::clone(&self.callback);
        let blacklisted = Arc::clone(&self.blacklisted_extensions);

        std::thread::Builder::new()
            .name("search-watcher".into())
            .spawn(move || {
                const DEBOUNCE: Duration = Duration::from_millis(200);

                while running.load(Ordering::SeqCst) {
                    // Block until the first event arrives (or channel closes).
                    let first = match rx.recv_timeout(Duration::from_secs(1)) {
                        Ok(ev) => ev,
                        Err(mpsc::RecvTimeoutError::Timeout) => continue,
                        Err(mpsc::RecvTimeoutError::Disconnected) => break,
                    };

                    // Start collecting a batch.
                    let mut raw_events = vec![first];
                    let deadline = Instant::now() + DEBOUNCE;

                    // Drain until the debounce window closes.
                    loop {
                        let remaining = deadline.saturating_duration_since(Instant::now());
                        if remaining.is_zero() {
                            break;
                        }
                        match rx.recv_timeout(remaining) {
                            Ok(ev) => raw_events.push(ev),
                            Err(mpsc::RecvTimeoutError::Timeout) => break,
                            Err(mpsc::RecvTimeoutError::Disconnected) => {
                                running.store(false, Ordering::SeqCst);
                                break;
                            }
                        }
                    }

                    // --- Classify & filter ---
                    let bl = blacklisted.lock().unwrap_or_else(|e| e.into_inner());
                    let mut batch: Vec<FileChangeEvent> = Vec::new();

                    for raw in &raw_events {
                        let classified = classify_event(raw);
                        for ev in classified {
                            let dominated_path = match &ev {
                                FileChangeEvent::Created(p)
                                | FileChangeEvent::Modified(p)
                                | FileChangeEvent::Removed(p) => p.clone(),
                                FileChangeEvent::Renamed { to, .. } => to.clone(),
                            };

                            // For Removed events the file is gone so
                            // `should_process` would fail the `is_dir`
                            // check (path no longer exists).  We still
                            // want to process removals, so only filter
                            // by extension / hidden-ness.
                            let dominated_ok = match &ev {
                                FileChangeEvent::Removed(_) => {
                                    // Check hidden + extension only.
                                    let name_ok = dominated_path
                                        .file_name()
                                        .and_then(|n| n.to_str())
                                        .map(|n| !n.starts_with('.'))
                                        .unwrap_or(false);
                                    let ext_ok = dominated_path
                                        .extension()
                                        .and_then(|e| e.to_str())
                                        .map(|e| !bl.contains(&e.to_lowercase()))
                                        .unwrap_or(true);
                                    name_ok && ext_ok
                                }
                                _ => should_process(&dominated_path, &bl),
                            };

                            if dominated_ok {
                                batch.push(ev);
                            }
                        }
                    }
                    drop(bl);

                    if batch.is_empty() {
                        continue;
                    }

                    // --- Deliver to callback ---
                    let cb_guard = callback.lock().unwrap_or_else(|e| e.into_inner());
                    if let Some(ref cb) = *cb_guard {
                        cb(batch);
                    }
                }
            })
            .map_err(|e| format!("Failed to spawn watcher thread: {e}"))?;

        Ok(())
    }

    /// Stop the watcher and tear down the processing thread.
    pub fn stop(&mut self) {
        self.running.store(false, Ordering::SeqCst);

        // Dropping the watcher closes the channel, which causes the
        // processing thread to exit.
        {
            let mut watcher_guard = self.watcher.lock().unwrap_or_else(|e| e.into_inner());
            *watcher_guard = None;
        }

        let mut guard = self.watched_paths.lock().unwrap_or_else(|e| e.into_inner());
        guard.clear();
    }

    /// Returns `true` if the watcher is currently running.
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Returns the list of currently watched directory paths.
    pub fn watched_paths(&self) -> Vec<PathBuf> {
        let guard = self.watched_paths.lock().unwrap_or_else(|e| e.into_inner());
        guard.iter().cloned().collect()
    }
}

impl Default for FileWatcher {
    fn default() -> Self {
        Self::new()
    }
}

// ===== Unit tests =====

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    // --- should_process ---

    #[test]
    fn rejects_hidden_files() {
        let bl: HashSet<String> = HashSet::new();
        let path = PathBuf::from("/tmp/.hidden_file.txt");
        // Create a temp file so is_dir returns false
        // For unit tests we use a path that doesn't exist; is_dir() returns
        // false for non-existent paths which is the desired behavior here.
        assert!(!should_process(&path, &bl));
    }

    #[test]
    fn rejects_blacklisted_extensions() {
        let mut bl = HashSet::new();
        bl.insert("exe".to_string());
        bl.insert("dll".to_string());

        let exe = PathBuf::from("/tmp/program.exe");
        let dll = PathBuf::from("/tmp/library.DLL"); // case-insensitive
        assert!(!should_process(&exe, &bl));
        assert!(!should_process(&dll, &bl));
    }

    #[test]
    fn accepts_normal_files() {
        let bl: HashSet<String> = HashSet::new();
        // Non-existent path => is_dir() is false, file_name exists, not
        // hidden, no blacklisted ext.
        let path = PathBuf::from("/tmp/document.txt");
        assert!(should_process(&path, &bl));
    }

    #[test]
    fn accepts_file_without_extension() {
        let mut bl = HashSet::new();
        bl.insert("exe".to_string());
        let path = PathBuf::from("/tmp/Makefile");
        assert!(should_process(&path, &bl));
    }

    // --- classify_event ---

    #[test]
    fn classifies_create_event() {
        let event = notify::Event {
            kind: EventKind::Create(notify::event::CreateKind::File),
            paths: vec![PathBuf::from("/tmp/new_file.txt")],
            attrs: Default::default(),
        };
        let results = classify_event(&event);
        assert_eq!(results.len(), 1);
        match &results[0] {
            FileChangeEvent::Created(p) => {
                assert_eq!(p, &PathBuf::from("/tmp/new_file.txt"));
            }
            other => panic!("Expected Created, got {:?}", other),
        }
    }

    #[test]
    fn classifies_modify_event() {
        let event = notify::Event {
            kind: EventKind::Modify(ModifyKind::Data(
                notify::event::DataChange::Content,
            )),
            paths: vec![PathBuf::from("/tmp/edited.txt")],
            attrs: Default::default(),
        };
        let results = classify_event(&event);
        assert_eq!(results.len(), 1);
        match &results[0] {
            FileChangeEvent::Modified(p) => {
                assert_eq!(p, &PathBuf::from("/tmp/edited.txt"));
            }
            other => panic!("Expected Modified, got {:?}", other),
        }
    }

    #[test]
    fn classifies_modify_any_event() {
        let event = notify::Event {
            kind: EventKind::Modify(ModifyKind::Any),
            paths: vec![PathBuf::from("/tmp/any_change.txt")],
            attrs: Default::default(),
        };
        let results = classify_event(&event);
        assert_eq!(results.len(), 1);
        match &results[0] {
            FileChangeEvent::Modified(p) => {
                assert_eq!(p, &PathBuf::from("/tmp/any_change.txt"));
            }
            other => panic!("Expected Modified, got {:?}", other),
        }
    }

    #[test]
    fn classifies_remove_event() {
        let event = notify::Event {
            kind: EventKind::Remove(notify::event::RemoveKind::File),
            paths: vec![PathBuf::from("/tmp/deleted.txt")],
            attrs: Default::default(),
        };
        let results = classify_event(&event);
        assert_eq!(results.len(), 1);
        match &results[0] {
            FileChangeEvent::Removed(p) => {
                assert_eq!(p, &PathBuf::from("/tmp/deleted.txt"));
            }
            other => panic!("Expected Removed, got {:?}", other),
        }
    }

    #[test]
    fn classifies_rename_event_with_two_paths() {
        let event = notify::Event {
            kind: EventKind::Modify(ModifyKind::Name(
                notify::event::RenameMode::Both,
            )),
            paths: vec![
                PathBuf::from("/tmp/old_name.txt"),
                PathBuf::from("/tmp/new_name.txt"),
            ],
            attrs: Default::default(),
        };
        let results = classify_event(&event);
        assert_eq!(results.len(), 1);
        match &results[0] {
            FileChangeEvent::Renamed { from, to } => {
                assert_eq!(from, &PathBuf::from("/tmp/old_name.txt"));
                assert_eq!(to, &PathBuf::from("/tmp/new_name.txt"));
            }
            other => panic!("Expected Renamed, got {:?}", other),
        }
    }

    #[test]
    fn classifies_rename_event_single_path_as_modified() {
        let event = notify::Event {
            kind: EventKind::Modify(ModifyKind::Name(
                notify::event::RenameMode::To,
            )),
            paths: vec![PathBuf::from("/tmp/appeared.txt")],
            attrs: Default::default(),
        };
        let results = classify_event(&event);
        assert_eq!(results.len(), 1);
        match &results[0] {
            FileChangeEvent::Modified(p) => {
                assert_eq!(p, &PathBuf::from("/tmp/appeared.txt"));
            }
            other => panic!("Expected Modified (single-path rename), got {:?}", other),
        }
    }

    #[test]
    fn ignores_access_events() {
        let event = notify::Event {
            kind: EventKind::Access(notify::event::AccessKind::Read),
            paths: vec![PathBuf::from("/tmp/read.txt")],
            attrs: Default::default(),
        };
        let results = classify_event(&event);
        assert!(results.is_empty());
    }

    // --- FileWatcher ---

    #[test]
    fn new_creates_without_panic() {
        let watcher = FileWatcher::new();
        assert!(!watcher.is_running());
    }

    #[test]
    fn watched_paths_initially_empty() {
        let watcher = FileWatcher::new();
        assert!(watcher.watched_paths().is_empty());
    }

    #[test]
    fn default_trait_works() {
        let watcher = FileWatcher::default();
        assert!(!watcher.is_running());
        assert!(watcher.watched_paths().is_empty());
    }

    #[test]
    fn set_blacklisted_extensions_stores_lowercase() {
        let watcher = FileWatcher::new();
        watcher.set_blacklisted_extensions(vec![
            "EXE".to_string(),
            "Dll".to_string(),
            "so".to_string(),
        ]);
        let guard = watcher.blacklisted_extensions.lock().unwrap_or_else(|e| e.into_inner());
        assert!(guard.contains("exe"));
        assert!(guard.contains("dll"));
        assert!(guard.contains("so"));
        assert!(!guard.contains("EXE"));
    }

    #[test]
    fn watch_path_before_start_returns_error() {
        let watcher = FileWatcher::new();
        // Use a path that exists on all platforms
        let result = watcher.watch_path(&std::env::temp_dir());
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Watcher has not been started yet"));
    }

    #[test]
    fn stop_on_non_running_watcher_is_safe() {
        let mut watcher = FileWatcher::new();
        // Should not panic.
        watcher.stop();
        assert!(!watcher.is_running());
    }
}
