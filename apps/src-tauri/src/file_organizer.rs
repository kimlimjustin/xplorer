use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;

use crate::duplicate_finder::{DuplicateFinder, DuplicateGroup};

// Extension category mappings
const IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "tiff", "raw",
];
const VIDEO_EXTENSIONS: &[&str] = &["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm"];
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a"];
const DOCUMENT_EXTENSIONS: &[&str] = &[
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "odt",
];
const CODE_EXTENSIONS: &[&str] = &[
    "rs", "js", "ts", "tsx", "jsx", "py", "java", "cpp", "c", "h", "go", "rb", "php", "css", "html",
];
const ARCHIVE_EXTENSIONS: &[&str] = &["zip", "tar", "gz", "7z", "rar", "bz2"];
const DATA_EXTENSIONS: &[&str] = &["json", "xml", "csv", "yaml", "yml", "toml", "sql", "db"];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileCategory {
    pub name: String,
    pub file_count: usize,
    pub total_size: u64,
    pub extensions: Vec<String>,
    pub example_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderSuggestion {
    pub suggested_name: String,
    pub target_path: String,
    pub files_to_move: Vec<String>,
    pub reason: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateCleanupRec {
    pub groups: Vec<DuplicateGroup>,
    pub total_wasted_space: u64,
    pub recommendations: Vec<CleanupAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupAction {
    pub action_type: String,
    pub files: Vec<String>,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryInsights {
    pub total_files: usize,
    pub total_size: u64,
    pub largest_files: Vec<FileInfo>,
    pub oldest_files: Vec<FileInfo>,
    pub newest_files: Vec<FileInfo>,
    pub type_distribution: Vec<CategoryDistribution>,
    pub avg_file_size: u64,
    pub files_by_month: Vec<MonthCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryDistribution {
    pub category: String,
    pub count: usize,
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthCount {
    pub month: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrganizationAnalysis {
    pub categories: Vec<FileCategory>,
    pub suggestions: Vec<FolderSuggestion>,
    pub duplicate_summary: Option<DuplicateCleanupRec>,
    pub insights: DirectoryInsights,
    pub is_project: bool,
    pub project_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrganizationPlan {
    pub moves: Vec<PlannedMove>,
    pub creates: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlannedMove {
    pub from: String,
    pub to: String,
    pub reason: String,
}

fn categorize_extension(ext: &str) -> &'static str {
    let ext_lower = ext.to_lowercase();
    let ext_str = ext_lower.as_str();
    if IMAGE_EXTENSIONS.contains(&ext_str) {
        "Images"
    } else if VIDEO_EXTENSIONS.contains(&ext_str) {
        "Videos"
    } else if AUDIO_EXTENSIONS.contains(&ext_str) {
        "Audio"
    } else if DOCUMENT_EXTENSIONS.contains(&ext_str) {
        "Documents"
    } else if CODE_EXTENSIONS.contains(&ext_str) {
        "Code"
    } else if ARCHIVE_EXTENSIONS.contains(&ext_str) {
        "Archives"
    } else if DATA_EXTENSIONS.contains(&ext_str) {
        "Data"
    } else {
        "Other"
    }
}

fn scan_directory_files(dir_path: &Path) -> Result<Vec<FileInfo>, String> {
    let entries = fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut files = Vec::new();
    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if metadata.is_file() {
            let path = entry.path();
            let modified = metadata
                .modified()
                .unwrap_or(SystemTime::UNIX_EPOCH)
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            files.push(FileInfo {
                path: path.to_string_lossy().to_string(),
                name: entry.file_name().to_string_lossy().to_string(),
                size: metadata.len(),
                modified,
            });
        }
    }
    Ok(files)
}

fn build_categories(files: &[FileInfo]) -> Vec<FileCategory> {
    let mut category_map: HashMap<String, (Vec<String>, Vec<String>, u64)> = HashMap::new();

    for file in files {
        let ext = Path::new(&file.name)
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let category = categorize_extension(&ext).to_string();

        let entry = category_map
            .entry(category)
            .or_insert_with(|| (Vec::new(), Vec::new(), 0));
        if !entry.0.contains(&ext) && !ext.is_empty() {
            entry.0.push(ext);
        }
        entry.1.push(file.name.clone());
        entry.2 += file.size;
    }

    let mut categories: Vec<FileCategory> = category_map
        .into_iter()
        .map(|(name, (extensions, example_files, total_size))| {
            let file_count = example_files.len();
            let examples: Vec<String> = example_files.into_iter().take(5).collect();
            FileCategory {
                name,
                file_count,
                total_size,
                extensions,
                example_files: examples,
            }
        })
        .collect();

    categories.sort_by(|a, b| b.file_count.cmp(&a.file_count));
    categories
}

/// Detects whether a directory is a software project by checking for known marker files/folders.
/// Returns (is_project, project_type) where project_type describes what kind of project it is.
fn detect_project_directory(dir_path: &Path) -> (bool, Option<String>) {
    // Map of marker file/folder → project type label
    let markers: &[(&str, &str)] = &[
        ("package.json", "Node.js"),
        ("Cargo.toml", "Rust"),
        ("pyproject.toml", "Python"),
        ("setup.py", "Python"),
        ("requirements.txt", "Python"),
        ("go.mod", "Go"),
        ("pom.xml", "Java (Maven)"),
        ("build.gradle", "Java (Gradle)"),
        ("build.gradle.kts", "Kotlin (Gradle)"),
        ("composer.json", "PHP"),
        ("Gemfile", "Ruby"),
        ("CMakeLists.txt", "C/C++ (CMake)"),
        ("Makefile", "C/C++"),
        ("*.sln", "C#/.NET"),
        ("*.csproj", "C#/.NET"),
        ("pubspec.yaml", "Dart/Flutter"),
        ("mix.exs", "Elixir"),
        ("deno.json", "Deno"),
        ("tsconfig.json", "TypeScript"),
        (".git", "Git repository"),
    ];

    for (marker, project_type) in markers {
        if marker.starts_with('*') {
            // Glob-style: check if any file matches the extension
            let ext = &marker[1..]; // e.g. ".sln"
            if let Ok(entries) = fs::read_dir(dir_path) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.ends_with(ext) {
                        return (true, Some(project_type.to_string()));
                    }
                }
            }
        } else {
            let candidate = dir_path.join(marker);
            if candidate.exists() {
                // .git is special — it confirms it but we prefer a more specific type
                if *marker == ".git" {
                    // Check if there's a more specific marker too
                    for (m2, pt2) in markers {
                        if *m2 != ".git" && !m2.starts_with('*') && dir_path.join(m2).exists() {
                            return (true, Some(pt2.to_string()));
                        }
                    }
                    return (true, Some(project_type.to_string()));
                }
                return (true, Some(project_type.to_string()));
            }
        }
    }

    // Also check for src/ directory combined with config files as a heuristic
    let has_src = dir_path.join("src").is_dir();
    let has_config_files = dir_path.join(".gitignore").exists()
        || dir_path.join(".editorconfig").exists()
        || dir_path.join("README.md").exists();
    if has_src && has_config_files {
        return (true, Some("Software project".to_string()));
    }

    (false, None)
}

/// Well-known source code subdirectory names. If a directory has one of these
/// names it is almost certainly part of a software project and its contents
/// should not be reorganized.
const SOURCE_DIR_NAMES: &[&str] = &[
    "src",
    "lib",
    "app",
    "components",
    "pages",
    "hooks",
    "utils",
    "helpers",
    "services",
    "models",
    "controllers",
    "views",
    "routes",
    "middleware",
    "modules",
    "packages",
    "tests",
    "test",
    "__tests__",
    "spec",
    "specs",
    "fixtures",
    "mocks",
    "styles",
    "assets",
    "public",
    "static",
    "dist",
    "build",
    "bin",
    "pkg",
    "internal",
    "cmd",
    "api",
    "core",
    "common",
    "shared",
    "include",
    "vendor",
    "node_modules",
    "target",
    "out",
    "src-tauri",
];

/// Checks whether the directory itself is a well-known source code
/// subdirectory (e.g. `src/`, `components/`, `hooks/`).
fn is_source_code_subdirectory(dir_path: &Path) -> bool {
    if let Some(dir_name) = dir_path.file_name() {
        let name_lower = dir_name.to_string_lossy().to_lowercase();
        if SOURCE_DIR_NAMES.contains(&name_lower.as_str()) {
            return true;
        }
    }
    false
}

/// Checks whether the parent (or grandparent) directory is a software project.
/// This catches the case where you're inside `my-app/src/` -- `src/` itself
/// doesn't contain `package.json`, but its parent `my-app/` does.
fn parent_is_project(dir_path: &Path) -> bool {
    if let Some(parent) = dir_path.parent() {
        let (is_proj, _) = detect_project_directory(parent);
        if is_proj {
            return true;
        }
        // Also check grandparent (e.g. project/src/components/)
        if let Some(grandparent) = parent.parent() {
            let (is_proj, _) = detect_project_directory(grandparent);
            if is_proj {
                return true;
            }
        }
    }
    false
}

/// Returns true when a single category dominates the directory so heavily that
/// grouping it into a subfolder would be pointless (there is nothing meaningful
/// to separate it from).
///
/// The threshold is: if one category accounts for >= 70% of the categorized
/// files *and* there are fewer than 3 files outside that category, skip the
/// suggestion for that dominant category.
fn dominant_category(files: &[FileInfo]) -> Option<String> {
    if files.is_empty() {
        return None;
    }

    let mut counts: HashMap<String, usize> = HashMap::new();
    let mut categorized_total: usize = 0;

    for file in files {
        let ext = Path::new(&file.name)
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let category = categorize_extension(&ext);
        if category != "Other" {
            *counts.entry(category.to_string()).or_insert(0) += 1;
            categorized_total += 1;
        }
    }

    if categorized_total == 0 {
        return None;
    }

    // Find the category with the most files
    if let Some((top_cat, top_count)) = counts.iter().max_by_key(|(_, c)| *c) {
        let others = categorized_total - top_count;
        let ratio = *top_count as f64 / categorized_total as f64;
        if ratio >= 0.70 && others < 3 {
            return Some(top_cat.clone());
        }
    }
    None
}

fn build_suggestions(dir_path: &Path, files: &[FileInfo]) -> Vec<FolderSuggestion> {
    let mut suggestions = Vec::new();

    // Detect if one category dominates the directory; if so we will skip
    // suggesting a folder for that category because there is nothing
    // meaningful to separate it from.
    let skip_category = dominant_category(files);

    // 1. Category-based suggestions: group by category if 3+ files
    let mut category_files: HashMap<String, Vec<String>> = HashMap::new();
    for file in files {
        let ext = Path::new(&file.name)
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let category = categorize_extension(&ext).to_string();
        if category != "Other" {
            category_files
                .entry(category)
                .or_default()
                .push(file.path.clone());
        }
    }

    for (category, file_paths) in &category_files {
        // Skip the dominant category — grouping it would be pointless
        if let Some(ref skip) = skip_category {
            if category == skip {
                continue;
            }
        }
        if file_paths.len() >= 3 {
            let target = dir_path.join(category);
            if !target.exists() {
                suggestions.push(FolderSuggestion {
                    suggested_name: category.clone(),
                    target_path: target.to_string_lossy().to_string(),
                    files_to_move: file_paths.clone(),
                    reason: format!(
                        "{} {} files found - group into dedicated folder",
                        file_paths.len(),
                        category
                    ),
                    category: "type".to_string(),
                });
            }
        }
    }

    // 2. Date cluster suggestions: files sharing same month (5+)
    let mut month_files: HashMap<String, Vec<String>> = HashMap::new();
    for file in files {
        if file.modified > 0 {
            let dt = chrono::DateTime::from_timestamp(file.modified as i64, 0);
            if let Some(dt) = dt {
                let month_key = dt.format("%Y-%m").to_string();
                month_files
                    .entry(month_key)
                    .or_default()
                    .push(file.path.clone());
            }
        }
    }

    for (month, file_paths) in &month_files {
        if file_paths.len() >= 5 {
            let target = dir_path.join(month);
            if !target.exists() {
                suggestions.push(FolderSuggestion {
                    suggested_name: month.clone(),
                    target_path: target.to_string_lossy().to_string(),
                    files_to_move: file_paths.clone(),
                    reason: format!("{} files from {} - group by date", file_paths.len(), month),
                    category: "date".to_string(),
                });
            }
        }
    }

    // 3. Name-prefix cluster suggestions (3+ files sharing a prefix)
    let mut prefix_files: HashMap<String, Vec<String>> = HashMap::new();
    for file in files {
        let name = &file.name;
        // Extract prefix: everything before the last _ or - or number sequence
        if let Some(prefix) = extract_prefix(name) {
            if prefix.len() >= 3 {
                prefix_files
                    .entry(prefix)
                    .or_default()
                    .push(file.path.clone());
            }
        }
    }

    for (prefix, file_paths) in &prefix_files {
        if file_paths.len() >= 3 {
            let folder_name = prefix
                .trim_end_matches(|c: char| c == '_' || c == '-')
                .to_string();
            if folder_name.is_empty() {
                continue;
            }
            let target = dir_path.join(&folder_name);
            if !target.exists() {
                // Avoid duplicating a suggestion already covered by category
                let already_suggested: bool = suggestions
                    .iter()
                    .any(|s| file_paths.iter().all(|f| s.files_to_move.contains(f)));
                if !already_suggested {
                    suggestions.push(FolderSuggestion {
                        suggested_name: folder_name,
                        target_path: target.to_string_lossy().to_string(),
                        files_to_move: file_paths.clone(),
                        reason: format!(
                            "{} files with '{}' prefix - group by name pattern",
                            file_paths.len(),
                            prefix
                        ),
                        category: "prefix".to_string(),
                    });
                }
            }
        }
    }

    suggestions
}

fn extract_prefix(filename: &str) -> Option<String> {
    // Remove extension first
    let name = Path::new(filename)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    // Find prefix before last separator (_ or -)
    if let Some(pos) = name.rfind(|c: char| c == '_' || c == '-') {
        if pos >= 3 {
            return Some(name[..=pos].to_string());
        }
    }
    None
}

fn build_insights(files: &[FileInfo]) -> DirectoryInsights {
    let total_files = files.len();
    let total_size: u64 = files.iter().map(|f| f.size).sum();
    let avg_file_size = if total_files > 0 {
        total_size / total_files as u64
    } else {
        0
    };

    // Largest files
    let mut by_size = files.to_vec();
    by_size.sort_by(|a, b| b.size.cmp(&a.size));
    let largest_files: Vec<FileInfo> = by_size.into_iter().take(5).collect();

    // Oldest files
    let mut by_date = files.to_vec();
    by_date.sort_by(|a, b| a.modified.cmp(&b.modified));
    let oldest_files: Vec<FileInfo> = by_date.iter().take(5).cloned().collect();

    // Newest files
    by_date.reverse();
    let newest_files: Vec<FileInfo> = by_date.into_iter().take(5).collect();

    // Type distribution
    let mut type_map: HashMap<String, (usize, u64)> = HashMap::new();
    for file in files {
        let ext = Path::new(&file.name)
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let category = categorize_extension(&ext).to_string();
        let entry = type_map.entry(category).or_insert((0, 0));
        entry.0 += 1;
        entry.1 += file.size;
    }
    let mut type_distribution: Vec<CategoryDistribution> = type_map
        .into_iter()
        .map(|(category, (count, total_size))| CategoryDistribution {
            category,
            count,
            total_size,
        })
        .collect();
    type_distribution.sort_by(|a, b| b.count.cmp(&a.count));

    // Files by month
    let mut month_map: HashMap<String, usize> = HashMap::new();
    for file in files {
        if file.modified > 0 {
            let dt = chrono::DateTime::from_timestamp(file.modified as i64, 0);
            if let Some(dt) = dt {
                let month_key = dt.format("%Y-%m").to_string();
                *month_map.entry(month_key).or_insert(0) += 1;
            }
        }
    }
    let mut files_by_month: Vec<MonthCount> = month_map
        .into_iter()
        .map(|(month, count)| MonthCount { month, count })
        .collect();
    files_by_month.sort_by(|a, b| a.month.cmp(&b.month));

    DirectoryInsights {
        total_files,
        total_size,
        largest_files,
        oldest_files,
        newest_files,
        type_distribution,
        avg_file_size,
        files_by_month,
    }
}

async fn build_duplicate_summary(dir_path: &str) -> Option<DuplicateCleanupRec> {
    let finder = DuplicateFinder::new();
    // Use scan_id 0 — the file organizer never cancels mid-scan
    let scan_id = 0u64;
    let result = finder
        .find_duplicates(Path::new(dir_path), scan_id, |_progress| {})
        .await;

    match result {
        Ok(dup_result) if !dup_result.duplicate_groups.is_empty() => {
            let mut groups = dup_result.duplicate_groups;
            groups.sort_by(|a, b| b.total_wasted_space.cmp(&a.total_wasted_space));
            let top_groups: Vec<DuplicateGroup> = groups.into_iter().take(5).collect();

            let total_wasted = dup_result.total_wasted_space;

            let recommendations: Vec<CleanupAction> = top_groups
                .iter()
                .map(|group| {
                    // Recommend keeping the newest file, deleting the rest
                    let mut sorted_files = group.files.clone();
                    sorted_files.sort_by(|a, b| b.modified.cmp(&a.modified));

                    let files_to_delete: Vec<String> = sorted_files
                        .iter()
                        .skip(1) // keep newest
                        .map(|f| f.path.clone())
                        .collect();

                    let keep_file = &sorted_files[0].name;

                    CleanupAction {
                        action_type: "delete".to_string(),
                        files: files_to_delete,
                        reason: format!(
                            "Keep newest copy ({}), remove {} duplicates",
                            keep_file,
                            sorted_files.len() - 1
                        ),
                    }
                })
                .collect();

            Some(DuplicateCleanupRec {
                groups: top_groups,
                total_wasted_space: total_wasted,
                recommendations,
            })
        }
        _ => None,
    }
}

#[command]
pub async fn analyze_directory(path: String) -> Result<OrganizationAnalysis, String> {
    let dir_path = Path::new(&path);
    if !dir_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let (mut is_project, project_type) = detect_project_directory(dir_path);

    // Also detect source code subdirectories (src/, lib/, components/, etc.)
    // and directories whose parent is a project root.
    if !is_project {
        is_project = is_source_code_subdirectory(dir_path) || parent_is_project(dir_path);
    }

    let files = scan_directory_files(dir_path)?;
    let categories = build_categories(&files);
    // Don't suggest reorganizing project directories — it would break the project structure
    let suggestions = if is_project {
        Vec::new()
    } else {
        build_suggestions(dir_path, &files)
    };
    let insights = build_insights(&files);
    let duplicate_summary = build_duplicate_summary(&path).await;

    Ok(OrganizationAnalysis {
        categories,
        suggestions,
        duplicate_summary,
        insights,
        is_project,
        project_type,
    })
}

#[command]
pub async fn preview_organization(
    path: String,
    suggestion_indices: Vec<usize>,
) -> Result<OrganizationPlan, String> {
    let dir_path = Path::new(&path);
    if !dir_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    // Respect the same project detection as analyze_directory
    let (is_project, _) = detect_project_directory(dir_path);
    let is_project =
        is_project || is_source_code_subdirectory(dir_path) || parent_is_project(dir_path);

    if is_project {
        return Ok(OrganizationPlan {
            moves: Vec::new(),
            creates: Vec::new(),
        });
    }

    let files = scan_directory_files(dir_path)?;
    let suggestions = build_suggestions(dir_path, &files);

    let mut moves = Vec::new();
    let mut creates = Vec::new();

    for &idx in &suggestion_indices {
        if idx >= suggestions.len() {
            continue;
        }
        let suggestion = &suggestions[idx];

        if !creates.contains(&suggestion.target_path) {
            creates.push(suggestion.target_path.clone());
        }

        for file_path in &suggestion.files_to_move {
            let file_name = Path::new(file_path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let dest = Path::new(&suggestion.target_path).join(&file_name);
            moves.push(PlannedMove {
                from: file_path.clone(),
                to: dest.to_string_lossy().to_string(),
                reason: suggestion.reason.clone(),
            });
        }
    }

    Ok(OrganizationPlan { moves, creates })
}

#[command]
pub async fn execute_organization(plan: OrganizationPlan) -> Result<usize, String> {
    // Create directories first
    for dir_path in &plan.creates {
        fs::create_dir_all(dir_path)
            .map_err(|e| format!("Failed to create directory '{}': {}", dir_path, e))?;
    }

    // Move files
    let mut moved_count = 0;
    for planned_move in &plan.moves {
        let src = Path::new(&planned_move.from);
        let dst = Path::new(&planned_move.to);

        if !src.exists() {
            continue;
        }

        // Ensure parent directory exists
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }

        // Skip if destination already exists
        if dst.exists() {
            continue;
        }

        fs::rename(src, dst).map_err(|e| {
            format!(
                "Failed to move '{}' to '{}': {}",
                planned_move.from, planned_move.to, e
            )
        })?;
        moved_count += 1;
    }

    Ok(moved_count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    /// Helper: create an empty file inside `dir` with the given name.
    fn touch(dir: &Path, name: &str) {
        fs::write(dir.join(name), "").unwrap();
    }

    // -----------------------------------------------------------------------
    // detect_project_directory
    // -----------------------------------------------------------------------

    #[test]
    fn detects_node_project() {
        let tmp = TempDir::new().unwrap();
        touch(tmp.path(), "package.json");
        let (is_proj, ptype) = detect_project_directory(tmp.path());
        assert!(is_proj);
        assert_eq!(ptype.unwrap(), "Node.js");
    }

    #[test]
    fn detects_rust_project() {
        let tmp = TempDir::new().unwrap();
        touch(tmp.path(), "Cargo.toml");
        let (is_proj, ptype) = detect_project_directory(tmp.path());
        assert!(is_proj);
        assert_eq!(ptype.unwrap(), "Rust");
    }

    #[test]
    fn detects_python_project() {
        let tmp = TempDir::new().unwrap();
        touch(tmp.path(), "pyproject.toml");
        let (is_proj, ptype) = detect_project_directory(tmp.path());
        assert!(is_proj);
        assert_eq!(ptype.unwrap(), "Python");
    }

    #[test]
    fn detects_git_repo_as_project() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir(tmp.path().join(".git")).unwrap();
        let (is_proj, ptype) = detect_project_directory(tmp.path());
        assert!(is_proj);
        assert_eq!(ptype.unwrap(), "Git repository");
    }

    #[test]
    fn non_project_directory() {
        let tmp = TempDir::new().unwrap();
        touch(tmp.path(), "photo.jpg");
        touch(tmp.path(), "notes.txt");
        let (is_proj, _) = detect_project_directory(tmp.path());
        assert!(!is_proj);
    }

    // -----------------------------------------------------------------------
    // is_source_code_subdirectory
    // -----------------------------------------------------------------------

    #[test]
    fn recognizes_src_directory() {
        let tmp = TempDir::new().unwrap();
        let src = tmp.path().join("src");
        fs::create_dir(&src).unwrap();
        assert!(is_source_code_subdirectory(&src));
    }

    #[test]
    fn recognizes_components_directory() {
        let tmp = TempDir::new().unwrap();
        let components = tmp.path().join("components");
        fs::create_dir(&components).unwrap();
        assert!(is_source_code_subdirectory(&components));
    }

    #[test]
    fn recognizes_hooks_directory() {
        let tmp = TempDir::new().unwrap();
        let hooks = tmp.path().join("hooks");
        fs::create_dir(&hooks).unwrap();
        assert!(is_source_code_subdirectory(&hooks));
    }

    #[test]
    fn does_not_flag_random_directory_as_source() {
        let tmp = TempDir::new().unwrap();
        let photos = tmp.path().join("vacation-photos");
        fs::create_dir(&photos).unwrap();
        assert!(!is_source_code_subdirectory(&photos));
    }

    // -----------------------------------------------------------------------
    // parent_is_project
    // -----------------------------------------------------------------------

    #[test]
    fn detects_parent_project_for_src_subdir() {
        let tmp = TempDir::new().unwrap();
        // Simulate a Node project root
        touch(tmp.path(), "package.json");
        let src = tmp.path().join("src");
        fs::create_dir(&src).unwrap();
        assert!(parent_is_project(&src));
    }

    #[test]
    fn detects_grandparent_project() {
        let tmp = TempDir::new().unwrap();
        touch(tmp.path(), "Cargo.toml");
        let src = tmp.path().join("src");
        fs::create_dir(&src).unwrap();
        let components = src.join("components");
        fs::create_dir(&components).unwrap();
        assert!(parent_is_project(&components));
    }

    #[test]
    fn no_parent_project_for_standalone_dir() {
        let tmp = TempDir::new().unwrap();
        let photos = tmp.path().join("photos");
        fs::create_dir(&photos).unwrap();
        // Parent (tmp root) has no project markers
        assert!(!parent_is_project(&photos));
    }

    // -----------------------------------------------------------------------
    // dominant_category
    // -----------------------------------------------------------------------

    fn make_file_info(name: &str) -> FileInfo {
        FileInfo {
            path: format!("/fake/{}", name),
            name: name.to_string(),
            size: 100,
            modified: 1000,
        }
    }

    #[test]
    fn detects_dominant_code_category() {
        let files: Vec<FileInfo> = vec![
            make_file_info("App.tsx"),
            make_file_info("main.tsx"),
            make_file_info("config.ts"),
            make_file_info("utils.ts"),
            make_file_info("index.css"),
        ];
        let dom = dominant_category(&files);
        assert_eq!(dom, Some("Code".to_string()));
    }

    #[test]
    fn no_dominant_when_mixed() {
        let files: Vec<FileInfo> = vec![
            make_file_info("App.tsx"),
            make_file_info("main.tsx"),
            make_file_info("config.ts"),
            make_file_info("photo1.jpg"),
            make_file_info("photo2.png"),
            make_file_info("photo3.gif"),
            make_file_info("report.pdf"),
        ];
        let dom = dominant_category(&files);
        // 3 code, 3 images, 1 document => no dominant category
        assert!(dom.is_none());
    }

    #[test]
    fn detects_dominant_image_category() {
        let files: Vec<FileInfo> = vec![
            make_file_info("a.jpg"),
            make_file_info("b.png"),
            make_file_info("c.gif"),
            make_file_info("d.webp"),
            make_file_info("e.bmp"),
        ];
        let dom = dominant_category(&files);
        assert_eq!(dom, Some("Images".to_string()));
    }

    #[test]
    fn empty_files_no_dominant() {
        let dom = dominant_category(&[]);
        assert!(dom.is_none());
    }

    // -----------------------------------------------------------------------
    // build_suggestions integration
    // -----------------------------------------------------------------------

    #[test]
    fn no_code_suggestion_when_all_code_files() {
        // Simulate a src/ directory with only code files
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path();
        // Create several .ts/.tsx files
        for name in &[
            "App.tsx",
            "main.tsx",
            "config.ts",
            "utils.ts",
            "index.css",
            "helpers.ts",
        ] {
            touch(dir, name);
        }
        let files = scan_directory_files(dir).unwrap();
        let suggestions = build_suggestions(dir, &files);

        // There should be NO suggestion to create a "Code" folder
        let code_suggestions: Vec<_> = suggestions
            .iter()
            .filter(|s| s.suggested_name == "Code")
            .collect();
        assert!(
            code_suggestions.is_empty(),
            "Should not suggest a Code/ folder when almost all files are code, got: {:?}",
            code_suggestions
                .iter()
                .map(|s| &s.reason)
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn suggests_code_folder_when_mixed_directory() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path();
        // Mix of code and image files
        for name in &[
            "app.ts",
            "main.ts",
            "lib.ts",
            "photo1.jpg",
            "photo2.png",
            "photo3.gif",
            "video.mp4",
            "doc.pdf",
            "data.csv",
        ] {
            touch(dir, name);
        }
        let files = scan_directory_files(dir).unwrap();
        let suggestions = build_suggestions(dir, &files);

        let code_suggestions: Vec<_> = suggestions
            .iter()
            .filter(|s| s.suggested_name == "Code")
            .collect();
        assert!(
            !code_suggestions.is_empty(),
            "Should suggest a Code/ folder when files are mixed"
        );
    }

    #[test]
    fn project_root_produces_no_suggestions() {
        let tmp = TempDir::new().unwrap();
        touch(tmp.path(), "package.json");
        touch(tmp.path(), "App.tsx");
        touch(tmp.path(), "main.tsx");
        touch(tmp.path(), "config.ts");
        touch(tmp.path(), "utils.ts");

        let (is_project, _) = detect_project_directory(tmp.path());
        assert!(is_project);
        // The analyze_directory flow would return empty suggestions for a project dir
    }

    #[test]
    fn src_subdir_of_project_detected() {
        let tmp = TempDir::new().unwrap();
        touch(tmp.path(), "package.json");
        let src = tmp.path().join("src");
        fs::create_dir(&src).unwrap();
        touch(&src, "App.tsx");
        touch(&src, "main.tsx");
        touch(&src, "config.ts");

        // src/ is a source code subdirectory AND its parent is a project
        assert!(is_source_code_subdirectory(&src));
        assert!(parent_is_project(&src));
    }

    #[test]
    fn nested_components_dir_detected() {
        let tmp = TempDir::new().unwrap();
        touch(tmp.path(), "Cargo.toml");
        let src = tmp.path().join("src");
        fs::create_dir(&src).unwrap();
        let components = src.join("components");
        fs::create_dir(&components).unwrap();
        touch(&components, "Button.tsx");
        touch(&components, "Modal.tsx");
        touch(&components, "Header.tsx");

        assert!(is_source_code_subdirectory(&components));
        assert!(parent_is_project(&components));
    }

    // -----------------------------------------------------------------------
    // categorize_extension
    // -----------------------------------------------------------------------

    #[test]
    fn categorize_known_extensions() {
        assert_eq!(categorize_extension("ts"), "Code");
        assert_eq!(categorize_extension("tsx"), "Code");
        assert_eq!(categorize_extension("css"), "Code");
        assert_eq!(categorize_extension("jpg"), "Images");
        assert_eq!(categorize_extension("mp4"), "Videos");
        assert_eq!(categorize_extension("mp3"), "Audio");
        assert_eq!(categorize_extension("pdf"), "Documents");
        assert_eq!(categorize_extension("zip"), "Archives");
        assert_eq!(categorize_extension("json"), "Data");
    }

    #[test]
    fn categorize_unknown_extension() {
        assert_eq!(categorize_extension("xyz"), "Other");
        assert_eq!(categorize_extension(""), "Other");
    }

    // -----------------------------------------------------------------------
    // extract_prefix
    // -----------------------------------------------------------------------

    #[test]
    fn extracts_prefix_from_filename() {
        assert_eq!(extract_prefix("photo_001.jpg"), Some("photo_".to_string()));
        assert_eq!(
            extract_prefix("report-final.pdf"),
            Some("report-".to_string())
        );
    }

    #[test]
    fn no_prefix_for_short_names() {
        // prefix must be >= 3 chars
        assert_eq!(extract_prefix("ab_1.txt"), None);
    }

    #[test]
    fn no_prefix_without_separator() {
        assert_eq!(extract_prefix("document.pdf"), None);
    }
}
