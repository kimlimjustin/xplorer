use chrono::Local;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupConfig {
    pub source_dir: String,
    pub backup_dir: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupManifest {
    pub backup_id: String,
    pub timestamp: String,
    pub source_dir: String,
    pub files: Vec<BackupFileEntry>,
    pub total_size: u64,
    pub backup_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupFileEntry {
    pub path: String,
    pub size: u64,
    pub modified: u64,
    pub hash: String,
    pub is_new: bool,
    pub is_modified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupProgress {
    phase: String,
    current: u64,
    total: u64,
    current_file: String,
    percentage: f64,
}

fn compute_sha256(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| format!("Failed to open file for hashing: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let n = file.read(&mut buffer).map_err(|e| format!("Failed to read file for hashing: {e}"))?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn collect_files(source_dir: &Path) -> Result<Vec<(PathBuf, u64, u64)>, String> {
    let mut files = Vec::new();
    for entry in WalkDir::new(source_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path().to_path_buf();
        if path.is_file() {
            let metadata = fs::metadata(&path).map_err(|e| format!("Failed to read metadata for {}: {e}", path.display()))?;
            let size = metadata.len();
            let modified = metadata
                .modified()
                .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())
                .unwrap_or(0);
            files.push((path, size, modified));
        }
    }
    Ok(files)
}

fn get_backup_base_dir(backup_dir: &str, name: &str) -> PathBuf {
    Path::new(backup_dir).join(name)
}

fn load_latest_manifest(backup_dir: &str, name: &str) -> Option<BackupManifest> {
    let base = get_backup_base_dir(backup_dir, name);
    if !base.exists() {
        return None;
    }
    let mut entries: Vec<_> = fs::read_dir(&base)
        .ok()?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .collect();
    entries.sort_by(|a, b| b.file_name().cmp(&a.file_name()));
    for entry in entries {
        let manifest_path = entry.path().join("manifest.json");
        if manifest_path.exists() {
            if let Ok(content) = fs::read_to_string(&manifest_path) {
                if let Ok(manifest) = serde_json::from_str::<BackupManifest>(&content) {
                    return Some(manifest);
                }
            }
        }
    }
    None
}

fn load_manifest_by_id(backup_dir: &str, name: &str, backup_id: &str) -> Option<BackupManifest> {
    let base = get_backup_base_dir(backup_dir, name);
    let manifest_path = base.join(backup_id).join("manifest.json");
    if manifest_path.exists() {
        let content = fs::read_to_string(&manifest_path).ok()?;
        serde_json::from_str(&content).ok()
    } else {
        None
    }
}

fn emit_progress(app: &AppHandle, phase: &str, current: u64, total: u64, current_file: &str) {
    let percentage = if total > 0 { (current as f64 / total as f64) * 100.0 } else { 0.0 };
    let _ = app.emit(
        "backup-progress",
        BackupProgress {
            phase: phase.to_string(),
            current,
            total,
            current_file: current_file.to_string(),
            percentage,
        },
    );
}

#[tauri::command]
pub async fn create_backup(
    app: AppHandle,
    source_dir: String,
    backup_dir: String,
    name: String,
) -> Result<BackupManifest, String> {
    let source_path = Path::new(&source_dir);
    if !source_path.exists() || !source_path.is_dir() {
        return Err(format!("Source directory does not exist: {source_dir}"));
    }

    let timestamp = Local::now().format("%Y-%m-%d_%H%M%S").to_string();
    let backup_id = timestamp.clone();
    let backup_path = get_backup_base_dir(&backup_dir, &name).join(&backup_id);
    fs::create_dir_all(&backup_path).map_err(|e| format!("Failed to create backup directory: {e}"))?;

    emit_progress(&app, "scanning", 0, 0, "");

    let files = collect_files(source_path)?;
    let total_files = files.len() as u64;

    let previous_manifest = load_latest_manifest(&backup_dir, &name);
    let is_incremental = previous_manifest.is_some();

    let prev_file_map: HashMap<String, (u64, u64)> = if let Some(ref prev) = previous_manifest {
        prev.files
            .iter()
            .map(|f| (f.path.clone(), (f.size, f.modified)))
            .collect()
    } else {
        HashMap::new()
    };

    emit_progress(&app, "comparing", 0, total_files, "");

    let mut manifest_entries = Vec::new();
    let mut total_size: u64 = 0;
    let mut files_to_copy: Vec<(PathBuf, String, bool, bool)> = Vec::new();

    for (i, (file_path, size, modified)) in files.iter().enumerate() {
        let relative = file_path
            .strip_prefix(source_path)
            .map_err(|e| format!("Failed to compute relative path: {e}"))?
            .to_string_lossy()
            .to_string();

        let relative_normalized = relative.replace('\\', "/");

        let (is_new, is_modified) = if is_incremental {
            if let Some(&(prev_size, prev_modified)) = prev_file_map.get(&relative_normalized) {
                if prev_size != *size || prev_modified != *modified {
                    (false, true)
                } else {
                    (false, false)
                }
            } else {
                (true, false)
            }
        } else {
            (true, false)
        };

        let needs_copy = !is_incremental || is_new || is_modified;

        if needs_copy {
            files_to_copy.push((file_path.clone(), relative_normalized.clone(), is_new, is_modified));
        }

        manifest_entries.push((relative_normalized, *size, *modified, is_new, is_modified, needs_copy));

        if (i + 1) % 100 == 0 {
            emit_progress(&app, "comparing", (i + 1) as u64, total_files, &relative);
        }
    }

    let copy_total = files_to_copy.len() as u64;
    emit_progress(&app, "copying", 0, copy_total, "");

    for (i, (file_path, relative, _is_new, _is_modified)) in files_to_copy.iter().enumerate() {
        let dest = backup_path.join(relative);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory {}: {e}", parent.display()))?;
        }
        fs::copy(file_path, &dest).map_err(|e| format!("Failed to copy {}: {e}", file_path.display()))?;

        if (i + 1) % 10 == 0 || i + 1 == files_to_copy.len() {
            emit_progress(&app, "copying", (i + 1) as u64, copy_total, relative);
        }
    }

    emit_progress(&app, "hashing", 0, total_files, "");

    let mut final_entries = Vec::new();
    for (i, (relative, size, modified, is_new, is_modified, needs_copy)) in manifest_entries.into_iter().enumerate() {
        let hash = if needs_copy {
            let dest = backup_path.join(&relative);
            compute_sha256(&dest).unwrap_or_default()
        } else {
            if let Some(ref prev) = previous_manifest {
                prev.files
                    .iter()
                    .find(|f| f.path == relative)
                    .map(|f| f.hash.clone())
                    .unwrap_or_default()
            } else {
                String::new()
            }
        };

        total_size += size;

        final_entries.push(BackupFileEntry {
            path: relative.clone(),
            size,
            modified,
            hash,
            is_new,
            is_modified,
        });

        if (i + 1) % 100 == 0 {
            emit_progress(&app, "hashing", (i + 1) as u64, total_files, &relative);
        }
    }

    let manifest = BackupManifest {
        backup_id,
        timestamp,
        source_dir: source_dir.clone(),
        files: final_entries,
        total_size,
        backup_type: if is_incremental { "incremental".to_string() } else { "full".to_string() },
    };

    let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|e| format!("Failed to serialize manifest: {e}"))?;
    let manifest_path = backup_path.join("manifest.json");
    fs::write(&manifest_path, manifest_json).map_err(|e| format!("Failed to write manifest: {e}"))?;

    emit_progress(&app, "complete", total_files, total_files, "");

    Ok(manifest)
}

#[tauri::command]
pub async fn list_backups(backup_dir: String, name: String) -> Result<Vec<BackupManifest>, String> {
    let base = get_backup_base_dir(&backup_dir, &name);
    if !base.exists() {
        return Ok(Vec::new());
    }

    let mut entries: Vec<_> = fs::read_dir(&base)
        .map_err(|e| format!("Failed to read backup directory: {e}"))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .collect();
    entries.sort_by(|a, b| b.file_name().cmp(&a.file_name()));

    let mut manifests = Vec::new();
    for entry in entries {
        let manifest_path = entry.path().join("manifest.json");
        if manifest_path.exists() {
            if let Ok(content) = fs::read_to_string(&manifest_path) {
                if let Ok(manifest) = serde_json::from_str::<BackupManifest>(&content) {
                    manifests.push(manifest);
                }
            }
        }
    }

    Ok(manifests)
}

#[tauri::command]
pub async fn restore_backup(
    app: AppHandle,
    backup_id: String,
    backup_dir: String,
    name: String,
    restore_to: String,
) -> Result<(), String> {
    let restore_path = Path::new(&restore_to);
    fs::create_dir_all(restore_path).map_err(|e| format!("Failed to create restore directory: {e}"))?;

    let target_manifest = load_manifest_by_id(&backup_dir, &name, &backup_id)
        .ok_or_else(|| format!("Backup not found: {backup_id}"))?;

    let chain = build_restore_chain(&backup_dir, &name, &target_manifest)?;

    let mut file_map: HashMap<String, (String, String)> = HashMap::new();

    for manifest in &chain {
        for entry in &manifest.files {
            if entry.is_new || entry.is_modified || manifest.backup_type == "full" {
                file_map.insert(
                    entry.path.clone(),
                    (manifest.backup_id.clone(), entry.hash.clone()),
                );
            }
        }
    }

    let total = file_map.len() as u64;
    emit_progress(&app, "restoring", 0, total, "");

    let base = get_backup_base_dir(&backup_dir, &name);
    let mut count: u64 = 0;

    for (relative_path, (bid, expected_hash)) in &file_map {
        let source_file = base.join(bid).join(relative_path);
        let dest_file = restore_path.join(relative_path);

        if !source_file.exists() {
            return Err(format!("Backup file missing: {}", source_file.display()));
        }

        if !expected_hash.is_empty() {
            let actual_hash = compute_sha256(&source_file)?;
            if actual_hash != *expected_hash {
                return Err(format!(
                    "Hash mismatch for {}: expected {}, got {}",
                    relative_path, expected_hash, actual_hash
                ));
            }
        }

        if let Some(parent) = dest_file.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory {}: {e}", parent.display()))?;
        }
        fs::copy(&source_file, &dest_file).map_err(|e| format!("Failed to restore {}: {e}", relative_path))?;

        count += 1;
        if count % 10 == 0 || count == total {
            emit_progress(&app, "restoring", count, total, relative_path);
        }
    }

    emit_progress(&app, "complete", total, total, "");
    Ok(())
}

fn build_restore_chain(
    backup_dir: &str,
    name: &str,
    target_manifest: &BackupManifest,
) -> Result<Vec<BackupManifest>, String> {
    let base = get_backup_base_dir(backup_dir, name);
    if !base.exists() {
        return Err("Backup directory does not exist".to_string());
    }

    let mut all_manifests: Vec<BackupManifest> = Vec::new();
    let mut entries: Vec<_> = fs::read_dir(&base)
        .map_err(|e| format!("Failed to read backup directory: {e}"))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .collect();
    entries.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

    for entry in entries {
        let manifest_path = entry.path().join("manifest.json");
        if manifest_path.exists() {
            if let Ok(content) = fs::read_to_string(&manifest_path) {
                if let Ok(manifest) = serde_json::from_str::<BackupManifest>(&content) {
                    all_manifests.push(manifest);
                }
            }
        }
    }

    let mut chain: Vec<BackupManifest> = Vec::new();
    let mut found_full = false;

    for manifest in all_manifests.iter().rev() {
        if manifest.backup_id <= target_manifest.backup_id {
            chain.push(manifest.clone());
            if manifest.backup_type == "full" {
                found_full = true;
                break;
            }
        }
    }

    if !found_full {
        return Err("Could not find a full backup in the chain. Backup data may be corrupted.".to_string());
    }

    chain.reverse();
    Ok(chain)
}

#[tauri::command]
pub async fn delete_backup(
    backup_id: String,
    backup_dir: String,
    name: String,
) -> Result<(), String> {
    let base = get_backup_base_dir(&backup_dir, &name);
    let backup_path = base.join(&backup_id);

    if !backup_path.exists() {
        return Err(format!("Backup not found: {backup_id}"));
    }

    let manifest = load_manifest_by_id(&backup_dir, &name, &backup_id);
    if let Some(m) = manifest {
        if m.backup_type == "full" {
            let mut has_dependent_incrementals = false;
            if let Ok(entries) = fs::read_dir(&base) {
                for entry in entries.filter_map(|e| e.ok()) {
                    if entry.path().is_dir() && *entry.file_name().to_string_lossy() > *backup_id.as_str() {
                        let dep_manifest_path = entry.path().join("manifest.json");
                        if dep_manifest_path.exists() {
                            if let Ok(content) = fs::read_to_string(&dep_manifest_path) {
                                if let Ok(dep_manifest) = serde_json::from_str::<BackupManifest>(&content) {
                                    if dep_manifest.backup_type == "incremental" {
                                        has_dependent_incrementals = true;
                                        break;
                                    }
                                    if dep_manifest.backup_type == "full" {
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if has_dependent_incrementals {
                return Err("Cannot delete this full backup because incremental backups depend on it. Delete the dependent incremental backups first.".to_string());
            }
        }
    }

    fs::remove_dir_all(&backup_path).map_err(|e| format!("Failed to delete backup: {e}"))?;
    Ok(())
}
