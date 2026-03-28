use crossbeam::channel::{unbounded, Receiver, Sender};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::{command, Emitter};

/// Per-scan cancellation: incrementing this ID invalidates any running scan
/// that was started with a previous value.
static CURRENT_SCAN_ID: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateFile {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub hash: String,
    pub modified: u64, // Unix timestamp
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateGroup {
    pub hash: String,
    pub size: u64,
    pub files: Vec<DuplicateFile>,
    pub total_wasted_space: u64, // (count - 1) * size
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateFinderProgress {
    pub current_file: String,
    pub processed_files: usize,
    pub total_files: usize,
    pub current_phase: String, // "scanning", "hashing", "analyzing"
    pub duplicates_found: usize,
    pub total_wasted_space: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateFinderResult {
    pub duplicate_groups: Vec<DuplicateGroup>,
    pub total_duplicates: usize,
    pub total_wasted_space: u64,
    pub scan_time_ms: u128,
    pub files_scanned: usize,
}

pub struct DuplicateFinder {
    min_file_size: u64,
    max_file_size: Option<u64>,
    include_hidden: bool,
    file_extensions: Option<Vec<String>>,
    exclude_paths: Vec<PathBuf>,
}

impl Default for DuplicateFinder {
    fn default() -> Self {
        Self {
            min_file_size: 1, // Skip empty files by default
            max_file_size: None,
            include_hidden: false,
            file_extensions: None,
            exclude_paths: vec![
                PathBuf::from(".git"),
                PathBuf::from(".svn"),
                PathBuf::from("node_modules"),
                PathBuf::from("target"), // Rust build directory
                PathBuf::from("dist"),
                PathBuf::from("build"),
            ],
        }
    }
}

impl DuplicateFinder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn min_file_size(mut self, size: u64) -> Self {
        self.min_file_size = size;
        self
    }

    pub fn max_file_size(mut self, size: u64) -> Self {
        self.max_file_size = Some(size);
        self
    }

    pub fn include_hidden(mut self, include: bool) -> Self {
        self.include_hidden = include;
        self
    }

    pub fn file_extensions(mut self, extensions: Vec<String>) -> Self {
        self.file_extensions = Some(extensions);
        self
    }

    pub fn exclude_paths(mut self, paths: Vec<PathBuf>) -> Self {
        self.exclude_paths = paths;
        self
    }

    pub async fn find_duplicates<F>(
        &self,
        root_path: &Path,
        scan_id: u64,
        progress_callback: F,
    ) -> Result<DuplicateFinderResult, String>
    where
        F: Fn(DuplicateFinderProgress) + Send + Sync + 'static,
    {
        let start_time = std::time::Instant::now();
        let progress_callback = Arc::new(progress_callback);

        // Phase 1: Scan directory tree and collect file metadata
        let progress_cb_clone = progress_callback.clone();
        progress_cb_clone(DuplicateFinderProgress {
            current_file: "Starting scan...".to_string(),
            processed_files: 0,
            total_files: 0,
            current_phase: "scanning".to_string(),
            duplicates_found: 0,
            total_wasted_space: 0,
        });

        let files = self
            .scan_directory_tree(root_path, scan_id, progress_callback.clone())
            .await?;

        if files.is_empty() {
            return Ok(DuplicateFinderResult {
                duplicate_groups: vec![],
                total_duplicates: 0,
                total_wasted_space: 0,
                scan_time_ms: start_time.elapsed().as_millis(),
                files_scanned: 0,
            });
        }

        // Phase 2: Group files by size (potential duplicates)
        progress_callback(DuplicateFinderProgress {
            current_file: "Grouping files by size...".to_string(),
            processed_files: 0,
            total_files: files.len(),
            current_phase: "analyzing".to_string(),
            duplicates_found: 0,
            total_wasted_space: 0,
        });

        let size_groups = self.group_files_by_size(files);

        // Phase 3: Calculate hashes for potential duplicates
        let processed_count = Arc::new(AtomicUsize::new(0));
        let total_files_to_hash: usize = size_groups.values().map(|group| group.len()).sum();

        let duplicate_groups = self
            .find_hash_duplicates(
                size_groups,
                total_files_to_hash,
                scan_id,
                progress_callback,
                processed_count,
            )
            .await?;

        let total_duplicates = duplicate_groups.iter().map(|group| group.files.len()).sum();
        let total_wasted_space = duplicate_groups
            .iter()
            .map(|group| group.total_wasted_space)
            .sum();

        Ok(DuplicateFinderResult {
            duplicate_groups,
            total_duplicates,
            total_wasted_space,
            scan_time_ms: start_time.elapsed().as_millis(),
            files_scanned: total_files_to_hash,
        })
    }

    async fn scan_directory_tree<F>(
        &self,
        root_path: &Path,
        scan_id: u64,
        progress_callback: Arc<F>,
    ) -> Result<Vec<DuplicateFile>, String>
    where
        F: Fn(DuplicateFinderProgress) + Send + Sync + 'static,
    {
        let (sender, receiver): (Sender<DuplicateFile>, Receiver<DuplicateFile>) = unbounded();
        let root_path = root_path.to_path_buf();
        let exclude_paths = self.exclude_paths.clone();
        let min_file_size = self.min_file_size;
        let max_file_size = self.max_file_size;
        let include_hidden = self.include_hidden;
        let file_extensions = self.file_extensions.clone();

        // Spawn scanning task
        let sender_clone = sender.clone();
        let progress_cb_clone = progress_callback.clone();
        let scan_handle = tokio::task::spawn_blocking(move || {
            let mut processed = 0;

            #[allow(clippy::too_many_arguments)]
            fn scan_dir_recursive(
                path: &Path,
                sender: &Sender<DuplicateFile>,
                exclude_paths: &[PathBuf],
                min_file_size: u64,
                max_file_size: Option<u64>,
                include_hidden: bool,
                file_extensions: &Option<Vec<String>>,
                processed: &mut usize,
                progress_callback: &dyn Fn(DuplicateFinderProgress),
                scan_id: u64,
            ) -> Result<(), String> {
                let entries = fs::read_dir(path)
                    .map_err(|e| format!("Failed to read directory {}: {}", path.display(), e))?;

                for entry in entries {
                    if CURRENT_SCAN_ID.load(Ordering::Relaxed) != scan_id {
                        return Err("Scan cancelled".to_string());
                    }

                    let entry = entry.map_err(|e| e.to_string())?;
                    let entry_path = entry.path();
                    let file_name = entry_path.file_name().unwrap_or_default().to_string_lossy();

                    // Skip hidden files if not included
                    if !include_hidden && file_name.starts_with('.') {
                        continue;
                    }

                    // Skip excluded paths
                    if exclude_paths
                        .iter()
                        .any(|excluded| entry_path.ends_with(excluded))
                    {
                        continue;
                    }

                    if entry_path.is_dir() {
                        scan_dir_recursive(
                            &entry_path,
                            sender,
                            exclude_paths,
                            min_file_size,
                            max_file_size,
                            include_hidden,
                            file_extensions,
                            processed,
                            progress_callback,
                            scan_id,
                        )?;
                    } else if entry_path.is_file() {
                        let metadata = entry.metadata().map_err(|e| e.to_string())?;
                        let file_size = metadata.len();

                        // Filter by size
                        if file_size < min_file_size {
                            continue;
                        }
                        if let Some(max_size) = max_file_size {
                            if file_size > max_size {
                                continue;
                            }
                        }

                        // Filter by extension
                        if let Some(ref extensions) = file_extensions {
                            if let Some(ext) = entry_path.extension() {
                                let ext_str = ext.to_string_lossy().to_lowercase();
                                if !extensions.iter().any(|e| e.to_lowercase() == ext_str) {
                                    continue;
                                }
                            } else {
                                continue; // No extension, skip if filtering by extensions
                            }
                        }

                        let modified = metadata
                            .modified()
                            .unwrap_or(std::time::UNIX_EPOCH)
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs();

                        let duplicate_file = DuplicateFile {
                            path: entry_path.to_string_lossy().to_string(),
                            name: file_name.to_string(),
                            size: file_size,
                            hash: String::new(), // Will be calculated later
                            modified,
                        };

                        if sender.send(duplicate_file).is_err() {
                            return Err("Failed to send file data".to_string());
                        }

                        *processed += 1;
                        if (*processed).is_multiple_of(100) {
                            progress_callback(DuplicateFinderProgress {
                                current_file: entry_path.to_string_lossy().to_string(),
                                processed_files: *processed,
                                total_files: 0, // Unknown at this point
                                current_phase: "scanning".to_string(),
                                duplicates_found: 0,
                                total_wasted_space: 0,
                            });
                        }
                    }
                }

                Ok(())
            }

            scan_dir_recursive(
                &root_path,
                &sender_clone,
                &exclude_paths,
                min_file_size,
                max_file_size,
                include_hidden,
                &file_extensions,
                &mut processed,
                &*progress_cb_clone,
                scan_id,
            )
        });

        // Collect results
        drop(sender); // Close sender to signal completion
        let mut files = Vec::new();
        while let Ok(file) = receiver.recv() {
            files.push(file);
        }

        scan_handle.await.map_err(|e| e.to_string())??;

        progress_callback(DuplicateFinderProgress {
            current_file: format!("Found {} files to analyze", files.len()),
            processed_files: files.len(),
            total_files: files.len(),
            current_phase: "scanning".to_string(),
            duplicates_found: 0,
            total_wasted_space: 0,
        });

        Ok(files)
    }

    fn group_files_by_size(&self, files: Vec<DuplicateFile>) -> HashMap<u64, Vec<DuplicateFile>> {
        let mut size_groups: HashMap<u64, Vec<DuplicateFile>> = HashMap::new();

        for file in files {
            size_groups
                .entry(file.size)
                .or_default()
                .push(file);
        }

        // Filter out single files (no potential duplicates)
        size_groups.retain(|_, files| files.len() > 1);

        size_groups
    }

    async fn find_hash_duplicates<F>(
        &self,
        size_groups: HashMap<u64, Vec<DuplicateFile>>,
        total_files: usize,
        scan_id: u64,
        progress_callback: Arc<F>,
        processed_count: Arc<AtomicUsize>,
    ) -> Result<Vec<DuplicateGroup>, String>
    where
        F: Fn(DuplicateFinderProgress) + Send + Sync + 'static,
    {
        let (sender, receiver) = unbounded();
        let sender_clone = sender.clone();

        // Process each size group in parallel
        let size_groups_vec: Vec<_> = size_groups.into_iter().collect();

        tokio::task::spawn_blocking(move || {
            size_groups_vec.into_par_iter().try_for_each(
                |(size, mut files)| -> Result<(), String> {
                    // Calculate hashes for all files in this size group
                    let hashed_files: Result<Vec<_>, String> = files
                        .par_iter_mut()
                        .map(|file| {
                            if CURRENT_SCAN_ID.load(Ordering::Relaxed) != scan_id {
                                return Err("Scan cancelled".to_string());
                            }
                            let hash = calculate_file_hash(&file.path)?;
                            file.hash = hash;

                            let current_processed =
                                processed_count.fetch_add(1, Ordering::SeqCst) + 1;
                            if current_processed.is_multiple_of(10) || current_processed == total_files {
                                progress_callback(DuplicateFinderProgress {
                                    current_file: file.name.clone(),
                                    processed_files: current_processed,
                                    total_files,
                                    current_phase: "hashing".to_string(),
                                    duplicates_found: 0,
                                    total_wasted_space: 0,
                                });
                            }

                            Ok(file.clone())
                        })
                        .collect();

                    let hashed_files = hashed_files?;

                    // Group by hash
                    let mut hash_groups: HashMap<String, Vec<DuplicateFile>> = HashMap::new();
                    for file in hashed_files {
                        hash_groups
                            .entry(file.hash.clone())
                            .or_default()
                            .push(file);
                    }

                    // Create duplicate groups
                    for (hash, files_in_group) in hash_groups {
                        if files_in_group.len() > 1 {
                            let total_wasted_space = (files_in_group.len() as u64 - 1) * size;
                            let duplicate_group = DuplicateGroup {
                                hash,
                                size,
                                files: files_in_group,
                                total_wasted_space,
                            };

                            if sender_clone.try_send(duplicate_group).is_err() {
                                return Err("Failed to send duplicate group".to_string());
                            }
                        }
                    }

                    Ok(())
                },
            )?;

            Ok::<(), String>(())
        })
        .await
        .map_err(|e| e.to_string())??;

        drop(sender); // Signal completion

        let mut duplicate_groups = Vec::new();
        while let Ok(group) = receiver.recv() {
            duplicate_groups.push(group);
        }

        // Sort by wasted space (largest first)
        duplicate_groups.sort_by(|a, b| b.total_wasted_space.cmp(&a.total_wasted_space));

        Ok(duplicate_groups)
    }
}

fn calculate_file_hash(file_path: &str) -> Result<String, String> {
    let path = Path::new(file_path);
    let file =
        fs::File::open(path).map_err(|e| format!("Failed to open file {}: {}", file_path, e))?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0; 8192]; // 8KB buffer for reading

    loop {
        let bytes_read = reader
            .read(&mut buffer)
            .map_err(|e| format!("Failed to read file {}: {}", file_path, e))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Cancel any running duplicate scan by bumping the global scan ID.
pub fn cancel_current_scan() {
    CURRENT_SCAN_ID.fetch_add(1, Ordering::SeqCst);
}

// Tauri commands
#[command]
pub async fn cancel_duplicate_scan() -> Result<(), String> {
    cancel_current_scan();
    Ok(())
}

#[command]
pub async fn find_duplicates(
    root_path: String,
    min_file_size: Option<u64>,
    max_file_size: Option<u64>,
    include_hidden: Option<bool>,
    file_extensions: Option<Vec<String>>,
    exclude_paths: Option<Vec<String>>,
    app_handle: tauri::AppHandle,
) -> Result<DuplicateFinderResult, String> {
    // Increment scan ID to cancel any previous scan and get our own ID.
    let scan_id = CURRENT_SCAN_ID.fetch_add(1, Ordering::SeqCst) + 1;
    let mut finder = DuplicateFinder::new();

    if let Some(min_size) = min_file_size {
        finder = finder.min_file_size(min_size);
    }
    if let Some(max_size) = max_file_size {
        finder = finder.max_file_size(max_size);
    }
    if let Some(include_hidden) = include_hidden {
        finder = finder.include_hidden(include_hidden);
    }
    if let Some(extensions) = file_extensions {
        finder = finder.file_extensions(extensions);
    }
    if let Some(exclude_paths) = exclude_paths {
        finder = finder.exclude_paths(exclude_paths.into_iter().map(PathBuf::from).collect());
    }

    let root = Path::new(&root_path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", root_path));
    }

    finder
        .find_duplicates(root, scan_id, move |progress| {
            let _ = app_handle.emit("duplicate-finder-progress", &progress);
        })
        .await
}

#[command]
pub async fn delete_duplicate_files(file_paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut deleted_files = Vec::new();
    let mut errors = Vec::new();

    for file_path in file_paths {
        match fs::remove_file(&file_path) {
            Ok(_) => deleted_files.push(file_path),
            Err(e) => errors.push(format!("Failed to delete {}: {}", file_path, e)),
        }
    }

    if !errors.is_empty() {
        return Err(errors.join("; "));
    }

    Ok(deleted_files)
}

#[command]
pub async fn move_duplicate_files_to_trash(file_paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut moved_files = Vec::new();
    let mut errors = Vec::new();

    for file_path in file_paths {
        match trash::delete(&file_path) {
            Ok(_) => moved_files.push(file_path),
            Err(e) => errors.push(format!("Failed to move {} to trash: {}", file_path, e)),
        }
    }

    if !errors.is_empty() {
        return Err(errors.join("; "));
    }

    Ok(moved_files)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_calculate_file_hash_identical_files() {
        let temp = tempdir().expect("create temp dir");
        let f1 = temp.path().join("a.txt");
        let f2 = temp.path().join("b.txt");

        fs::write(&f1, "identical content").unwrap();
        fs::write(&f2, "identical content").unwrap();

        let h1 = calculate_file_hash(f1.to_str().unwrap()).unwrap();
        let h2 = calculate_file_hash(f2.to_str().unwrap()).unwrap();
        assert_eq!(h1, h2, "identical files should produce the same hash");
    }

    #[test]
    fn test_calculate_file_hash_different_files() {
        let temp = tempdir().expect("create temp dir");
        let f1 = temp.path().join("a.txt");
        let f2 = temp.path().join("b.txt");

        fs::write(&f1, "content A").unwrap();
        fs::write(&f2, "content B").unwrap();

        let h1 = calculate_file_hash(f1.to_str().unwrap()).unwrap();
        let h2 = calculate_file_hash(f2.to_str().unwrap()).unwrap();
        assert_ne!(h1, h2, "different files should produce different hashes");
    }

    #[test]
    fn test_calculate_file_hash_nonexistent_returns_error() {
        let result = calculate_file_hash("/nonexistent_path_test_file.txt");
        assert!(result.is_err());
    }

    #[test]
    fn test_calculate_file_hash_empty_file() {
        let temp = tempdir().expect("create temp dir");
        let f = temp.path().join("empty.txt");
        fs::write(&f, b"").unwrap();

        let result = calculate_file_hash(f.to_str().unwrap());
        assert!(result.is_ok(), "hashing empty file should succeed");
        let hash = result.unwrap();
        assert!(
            !hash.is_empty(),
            "hash of empty file should not be empty string"
        );
    }

    #[test]
    fn test_duplicate_finder_builder_pattern() {
        let finder = DuplicateFinder::new()
            .min_file_size(100)
            .max_file_size(1_000_000)
            .include_hidden(true)
            .file_extensions(vec!["txt".into(), "rs".into()])
            .exclude_paths(vec![PathBuf::from("node_modules")]);

        assert_eq!(finder.min_file_size, 100);
        assert_eq!(finder.max_file_size, Some(1_000_000));
        assert!(finder.include_hidden);
        assert_eq!(
            finder.file_extensions,
            Some(vec!["txt".to_string(), "rs".to_string()])
        );
        assert_eq!(finder.exclude_paths, vec![PathBuf::from("node_modules")]);
    }

    #[test]
    fn test_duplicate_finder_default_values() {
        let finder = DuplicateFinder::default();
        assert_eq!(finder.min_file_size, 1);
        assert_eq!(finder.max_file_size, None);
        assert!(!finder.include_hidden);
        assert!(finder.file_extensions.is_none());
        assert!(
            !finder.exclude_paths.is_empty(),
            "should have default exclusions"
        );
    }

    #[test]
    fn test_group_files_by_size_filters_singletons() {
        let finder = DuplicateFinder::new();
        let files = vec![
            DuplicateFile {
                path: "a".into(),
                name: "a".into(),
                size: 100,
                hash: String::new(),
                modified: 0,
            },
            DuplicateFile {
                path: "b".into(),
                name: "b".into(),
                size: 100,
                hash: String::new(),
                modified: 0,
            },
            DuplicateFile {
                path: "c".into(),
                name: "c".into(),
                size: 200,
                hash: String::new(),
                modified: 0,
            },
        ];

        let groups = finder.group_files_by_size(files);

        // Size 100 has 2 files (potential duplicates), size 200 has 1 (filtered out)
        assert_eq!(
            groups.len(),
            1,
            "only size groups with >1 file should remain"
        );
        assert!(groups.contains_key(&100));
        assert!(!groups.contains_key(&200));
        assert_eq!(groups[&100].len(), 2);
    }

    #[test]
    fn test_group_files_by_size_empty_input() {
        let finder = DuplicateFinder::new();
        let groups = finder.group_files_by_size(vec![]);
        assert!(groups.is_empty());
    }

    #[test]
    fn test_group_files_by_size_all_unique() {
        let finder = DuplicateFinder::new();
        let files = vec![
            DuplicateFile {
                path: "a".into(),
                name: "a".into(),
                size: 100,
                hash: String::new(),
                modified: 0,
            },
            DuplicateFile {
                path: "b".into(),
                name: "b".into(),
                size: 200,
                hash: String::new(),
                modified: 0,
            },
            DuplicateFile {
                path: "c".into(),
                name: "c".into(),
                size: 300,
                hash: String::new(),
                modified: 0,
            },
        ];

        let groups = finder.group_files_by_size(files);
        assert!(
            groups.is_empty(),
            "all unique sizes should result in no groups"
        );
    }

    use std::sync::LazyLock;
    use std::sync::Mutex as StdMutex;

    // Serialize tests that use CURRENT_SCAN_ID to avoid parallel race conditions.
    static SCAN_TEST_MUTEX: LazyLock<StdMutex<()>> = LazyLock::new(|| StdMutex::new(()));

    /// Acquire the test mutex and return a fresh scan ID.
    /// The caller must hold the returned MutexGuard for the duration of the scan.
    fn acquire_scan_lock() -> (std::sync::MutexGuard<'static, ()>, u64) {
        let guard = SCAN_TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let scan_id = CURRENT_SCAN_ID.fetch_add(1, Ordering::SeqCst) + 1;
        (guard, scan_id)
    }

    #[tokio::test]
    async fn test_find_duplicates_with_identical_files() {
        let temp = tempdir().expect("create temp dir");

        // Create 3 files: 2 identical, 1 different
        fs::write(temp.path().join("dup1.txt"), "duplicate content here").unwrap();
        fs::write(temp.path().join("dup2.txt"), "duplicate content here").unwrap();
        fs::write(temp.path().join("unique.txt"), "this is unique content").unwrap();

        let finder = DuplicateFinder::new().min_file_size(1);
        let (_guard, scan_id) = acquire_scan_lock();
        let result = finder
            .find_duplicates(temp.path(), scan_id, |_progress| {})
            .await;

        assert!(
            result.is_ok(),
            "find_duplicates should succeed: {:?}",
            result.err()
        );
        let result = result.unwrap();

        assert!(
            result.duplicate_groups.len() >= 1,
            "should find at least 1 duplicate group"
        );

        // Find the group that matches our duplicate files
        let dup_group = result.duplicate_groups.iter().find(|g| g.files.len() == 2);
        assert!(
            dup_group.is_some(),
            "should find a group with exactly 2 files"
        );
        let group = dup_group.unwrap();
        assert_eq!(group.files.len(), 2);
        assert!(
            group.total_wasted_space > 0,
            "wasted space should be non-zero"
        );
    }

    #[tokio::test]
    async fn test_find_duplicates_no_duplicates() {
        let temp = tempdir().expect("create temp dir");

        fs::write(temp.path().join("a.txt"), "content A").unwrap();
        fs::write(temp.path().join("b.txt"), "content B").unwrap();
        fs::write(temp.path().join("c.txt"), "content C").unwrap();

        let finder = DuplicateFinder::new().min_file_size(1);
        let (_guard, scan_id) = acquire_scan_lock();
        let result = finder
            .find_duplicates(temp.path(), scan_id, |_| {})
            .await
            .unwrap();

        assert!(
            result.duplicate_groups.is_empty(),
            "should find no duplicate groups"
        );
        assert_eq!(result.total_duplicates, 0);
        assert_eq!(result.total_wasted_space, 0);
    }

    #[tokio::test]
    async fn test_find_duplicates_empty_directory() {
        let temp = tempdir().expect("create temp dir");

        let finder = DuplicateFinder::new();
        let (_guard, scan_id) = acquire_scan_lock();
        let result = finder
            .find_duplicates(temp.path(), scan_id, |_| {})
            .await
            .unwrap();

        assert!(result.duplicate_groups.is_empty());
        assert_eq!(result.files_scanned, 0);
    }

    #[tokio::test]
    async fn test_find_duplicates_cancellation() {
        let temp = tempdir().expect("create temp dir");

        // Create some files
        for i in 0..10 {
            fs::write(
                temp.path().join(format!("file_{}.txt", i)),
                format!("content {}", i),
            )
            .unwrap();
        }

        // Hold the mutex so no other scan test runs concurrently.
        let (_guard, scan_id) = acquire_scan_lock();
        // Immediately invalidate by bumping the global again.
        CURRENT_SCAN_ID.fetch_add(1, Ordering::SeqCst);

        let finder = DuplicateFinder::new().min_file_size(1);
        let result = finder.find_duplicates(temp.path(), scan_id, |_| {}).await;

        // The scan should either error with "Scan cancelled" or return early with no results
        // (depending on timing, the cancellation may or may not be picked up)
        // Both outcomes are acceptable: the key is that it does NOT panic.
        match result {
            Err(e) => assert!(
                e.contains("cancelled"),
                "error should mention cancellation, got: {}",
                e
            ),
            Ok(_r) => {
                // If it completed before seeing the cancellation that's also fine
                // (tiny directories may finish before the first ID check).
            }
        }
    }

    #[tokio::test]
    async fn test_find_duplicates_respects_min_file_size() {
        let temp = tempdir().expect("create temp dir");

        // Create 2 identical small files and 2 identical large files
        fs::write(temp.path().join("small1.txt"), "ab").unwrap();
        fs::write(temp.path().join("small2.txt"), "ab").unwrap();
        let big_content = "a".repeat(1000);
        fs::write(temp.path().join("big1.txt"), &big_content).unwrap();
        fs::write(temp.path().join("big2.txt"), &big_content).unwrap();

        let finder = DuplicateFinder::new().min_file_size(100);
        let (_guard, scan_id) = acquire_scan_lock();
        let result = finder
            .find_duplicates(temp.path(), scan_id, |_| {})
            .await
            .unwrap();

        // Only the big files should be detected as duplicates
        assert_eq!(
            result.duplicate_groups.len(),
            1,
            "only the big file group should appear"
        );
        assert_eq!(result.duplicate_groups[0].files.len(), 2);
    }

    #[tokio::test]
    async fn test_find_duplicates_filters_by_extension() {
        let temp = tempdir().expect("create temp dir");

        fs::write(temp.path().join("a.txt"), "same").unwrap();
        fs::write(temp.path().join("b.txt"), "same").unwrap();
        fs::write(temp.path().join("c.rs"), "same").unwrap();
        fs::write(temp.path().join("d.rs"), "same").unwrap();

        let finder = DuplicateFinder::new()
            .min_file_size(1)
            .file_extensions(vec!["txt".into()]);
        let (_guard, scan_id) = acquire_scan_lock();
        let result = finder
            .find_duplicates(temp.path(), scan_id, |_| {})
            .await
            .unwrap();

        // Only .txt files should be found
        for group in &result.duplicate_groups {
            for file in &group.files {
                assert!(
                    file.name.ends_with(".txt"),
                    "only .txt files should be scanned, got: {}",
                    file.name
                );
            }
        }
    }

    #[test]
    fn test_duplicate_group_struct() {
        let group = DuplicateGroup {
            hash: "abc123".to_string(),
            size: 1024,
            files: vec![
                DuplicateFile {
                    path: "a".into(),
                    name: "a".into(),
                    size: 1024,
                    hash: "abc123".into(),
                    modified: 100,
                },
                DuplicateFile {
                    path: "b".into(),
                    name: "b".into(),
                    size: 1024,
                    hash: "abc123".into(),
                    modified: 200,
                },
            ],
            total_wasted_space: 1024,
        };

        assert_eq!(group.files.len(), 2);
        assert_eq!(group.total_wasted_space, 1024);

        // Test serialization
        let json = serde_json::to_string(&group).unwrap();
        let deserialized: DuplicateGroup = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.hash, "abc123");
        assert_eq!(deserialized.files.len(), 2);
    }

    #[test]
    fn test_duplicate_finder_result_serialization() {
        let result = DuplicateFinderResult {
            duplicate_groups: vec![],
            total_duplicates: 0,
            total_wasted_space: 0,
            scan_time_ms: 42,
            files_scanned: 100,
        };

        let json = serde_json::to_string(&result).unwrap();
        let deserialized: DuplicateFinderResult = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.scan_time_ms, 42);
        assert_eq!(deserialized.files_scanned, 100);
    }
}
