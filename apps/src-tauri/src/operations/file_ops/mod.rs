pub mod batch;
pub mod copy_move;
pub mod delete;
pub mod read;
pub mod write;

pub use batch::*;
pub use copy_move::*;
pub(crate) use copy_move::copy_dir_recursive;
pub use delete::*;
pub use read::*;
pub use write::*;

// ─── Shared Types ────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictFileInfo {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictInfo {
    pub source: ConflictFileInfo,
    pub destination: ConflictFileInfo,
}

pub(crate) fn file_info_from_path(p: &Path) -> Result<ConflictFileInfo, String> {
    let meta = fs::metadata(p)
        .map_err(|e| format!("Failed to read metadata for {}: {}", p.display(), e))?;
    let modified = {
        let sys_time = meta.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        sys_time
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0)
    };
    let size = if meta.is_dir() {
        dir_total_size(p)
    } else {
        meta.len()
    };
    Ok(ConflictFileInfo {
        path: p.to_string_lossy().to_string(),
        name: p
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default(),
        is_dir: meta.is_dir(),
        size,
        modified,
    })
}

fn dir_total_size(dir: &Path) -> u64 {
    let mut total = 0u64;
    for entry in WalkDir::new(dir)
        .min_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Ok(m) = entry.metadata() {
                total += m.len();
            }
        }
    }
    total
}

pub(crate) fn generate_rename_destination(dir: &Path, name: &str) -> Result<String, String> {
    let dot = name.rfind('.');
    let (base, ext) = match dot {
        Some(i) if i > 0 => (&name[..i], &name[i..]),
        _ => (name, ""),
    };
    let mut n = 1u32;
    loop {
        if n > 9999 {
            return Err("Could not generate unique filename".to_string());
        }
        let candidate_name = format!("{} ({}){}", base, n, ext);
        let candidate = dir.join(&candidate_name);
        if !candidate.exists() {
            return Ok(candidate.to_string_lossy().to_string());
        }
        n += 1;
    }
}
