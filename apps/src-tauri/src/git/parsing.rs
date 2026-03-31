use std::collections::HashMap;

use super::types::*;

/// Parse git log output into a list of commits.
pub(super) fn parse_git_log(log_output: &str, _file_path: &str) -> Result<Vec<GitCommit>, String> {
    let mut commits = Vec::new();
    let mut current_commit_lines = Vec::new();

    for line in log_output.lines() {
        if line.contains('|')
            && line
                .chars()
                .nth(0)
                .map(|c| c.is_alphanumeric())
                .unwrap_or(false)
        {
            // Process previous commit if exists
            if !current_commit_lines.is_empty() {
                if let Ok(commit) = parse_single_commit(&current_commit_lines) {
                    commits.push(commit);
                }
                current_commit_lines.clear();
            }
            current_commit_lines.push(line.to_string());
        } else {
            current_commit_lines.push(line.to_string());
        }
    }

    // Process final commit
    if !current_commit_lines.is_empty() {
        if let Ok(commit) = parse_single_commit(&current_commit_lines) {
            commits.push(commit);
        }
    }

    Ok(commits)
}

/// Parse a single commit block from git log output.
fn parse_single_commit(lines: &[String]) -> Result<GitCommit, String> {
    let first_line = lines.first().ok_or("Empty commit data")?;
    let parts: Vec<&str> = first_line.split('|').collect();

    if parts.len() < 9 {
        return Err("Invalid commit format".to_string());
    }

    let hash = parts[0].to_string();
    let short_hash = parts[1].to_string();
    let author_name = parts[2].to_string();
    let author_email = parts[3].to_string();
    let committer_name = parts[4].to_string();
    let committer_email = parts[5].to_string();
    let date = parts[6].to_string();
    let timestamp = parts[7].parse::<i64>().unwrap_or(0);
    let summary = parts[8].to_string();

    let body = if parts.len() > 9 && !parts[9].trim().is_empty() {
        Some(parts[9].to_string())
    } else {
        None
    };

    // Extract stats from remaining lines
    let mut insertions = 0;
    let mut deletions = 0;
    let mut files_changed = Vec::new();

    for line in lines.iter().skip(1) {
        if line.contains("file changed") || line.contains("files changed") {
            // Parse insertions and deletions from git stat line
            if let Some(ins_pos) = line.find(" insertion") {
                if let Some(start) = line[..ins_pos].rfind(' ') {
                    if let Ok(count) = line[start + 1..ins_pos].trim().parse::<u32>() {
                        insertions = count;
                    }
                }
            }
            if let Some(del_pos) = line.find(" deletion") {
                if let Some(start) = line[..del_pos].rfind(' ') {
                    if let Ok(count) = line[start + 1..del_pos].trim().parse::<u32>() {
                        deletions = count;
                    }
                }
            }
        } else if line.contains(" | ") {
            // File change line
            if let Some(pipe_pos) = line.find(" | ") {
                let file_name = line[..pipe_pos].trim();
                if !file_name.is_empty() {
                    files_changed.push(file_name.to_string());
                }
            }
        }
    }

    Ok(GitCommit {
        hash,
        short_hash,
        author_name,
        author_email,
        committer_name,
        committer_email,
        date,
        timestamp,
        message: format!("{}\n{}", summary, body.as_deref().unwrap_or("")),
        summary,
        body,
        parent_hashes: Vec::new(), // Could be extracted with additional git commands
        files_changed,
        insertions,
        deletions,
    })
}

/// Parse git blame --line-porcelain output into blame lines.
pub(super) fn parse_git_blame(blame_output: &str) -> Result<Vec<GitBlameLine>, String> {
    let mut lines = Vec::new();
    let mut current_commit_info: HashMap<String, String> = HashMap::new();
    let mut line_number = 1;

    for line in blame_output.lines() {
        if let Some(stripped) = line.strip_prefix('\t') {
            // This is the actual code line
            let content = stripped.to_string(); // Remove the tab

            let commit_hash = current_commit_info
                .get("hash")
                .unwrap_or(&String::new())
                .clone();
            let short_hash = if commit_hash.len() >= 8 {
                commit_hash[..8].to_string()
            } else {
                commit_hash.clone()
            };

            lines.push(GitBlameLine {
                line_number,
                content,
                commit_hash: commit_hash.clone(),
                short_hash,
                author_name: current_commit_info
                    .get("author")
                    .unwrap_or(&String::new())
                    .clone(),
                author_email: current_commit_info
                    .get("author-mail")
                    .unwrap_or(&String::new())
                    .clone(),
                date: current_commit_info
                    .get("author-time")
                    .unwrap_or(&String::new())
                    .clone(),
                timestamp: current_commit_info
                    .get("author-time")
                    .unwrap_or(&String::new())
                    .parse::<i64>()
                    .unwrap_or(0),
                summary: current_commit_info
                    .get("summary")
                    .unwrap_or(&String::new())
                    .clone(),
            });

            line_number += 1;
        } else if let Some(space_pos) = line.find(' ') {
            if line
                .chars()
                .all(|c| c.is_alphanumeric() || c.is_whitespace())
                && space_pos == 40
            {
                // This is a commit hash line
                current_commit_info.insert("hash".to_string(), line[..space_pos].to_string());
            } else if let Some(value_pos) = line.find(' ') {
                // This is a metadata line
                let key = &line[..value_pos];
                let value = &line[value_pos + 1..];
                current_commit_info.insert(key.to_string(), value.to_string());
            }
        }
    }

    Ok(lines)
}

/// Parse a unified diff into a structured GitDiff.
pub(super) fn parse_git_diff(diff_output: &str, file_path: &str) -> Result<GitDiff, String> {
    let mut hunks = Vec::new();
    let mut current_hunk: Option<GitDiffHunk> = None;
    let mut lines_added = 0;
    let mut lines_deleted = 0;
    let mut change_type = "modified".to_string();
    let old_path = None;
    let mut binary = false;

    for line in diff_output.lines() {
        if line.starts_with("@@") {
            // Save previous hunk if exists
            if let Some(hunk) = current_hunk.take() {
                hunks.push(hunk);
            }

            // Parse hunk header
            if let Some(header_match) = parse_hunk_header(line) {
                current_hunk = Some(GitDiffHunk {
                    old_start: header_match.0,
                    old_lines: header_match.1,
                    new_start: header_match.2,
                    new_lines: header_match.3,
                    header: line.to_string(),
                    lines: Vec::new(),
                });
            }
        } else if line.starts_with('+') && !line.starts_with("+++") {
            lines_added += 1;
            if let Some(ref mut hunk) = current_hunk {
                hunk.lines.push(GitDiffLine {
                    line_type: "addition".to_string(),
                    content: line[1..].to_string(),
                    old_line_number: None,
                    new_line_number: Some(hunk.new_start + hunk.lines.len() as u32),
                });
            }
        } else if line.starts_with('-') && !line.starts_with("---") {
            lines_deleted += 1;
            if let Some(ref mut hunk) = current_hunk {
                hunk.lines.push(GitDiffLine {
                    line_type: "deletion".to_string(),
                    content: line[1..].to_string(),
                    old_line_number: Some(hunk.old_start + hunk.lines.len() as u32),
                    new_line_number: None,
                });
            }
        } else if let Some(stripped) = line.strip_prefix(' ') {
            if let Some(ref mut hunk) = current_hunk {
                hunk.lines.push(GitDiffLine {
                    line_type: "context".to_string(),
                    content: stripped.to_string(),
                    old_line_number: Some(hunk.old_start + hunk.lines.len() as u32),
                    new_line_number: Some(hunk.new_start + hunk.lines.len() as u32),
                });
            }
        } else if line.starts_with("new file mode") {
            change_type = "added".to_string();
        } else if line.starts_with("deleted file mode") {
            change_type = "deleted".to_string();
        } else if line.contains("Binary files") {
            binary = true;
        }
    }

    // Save final hunk
    if let Some(hunk) = current_hunk {
        hunks.push(hunk);
    }

    Ok(GitDiff {
        file_path: file_path.to_string(),
        old_path,
        change_type,
        hunks,
        lines_added,
        lines_deleted,
        binary,
    })
}

/// Parse output containing multiple diffs (e.g. from `git show`).
pub(super) fn parse_multiple_git_diffs(diff_output: &str) -> Result<Vec<GitDiff>, String> {
    let mut diffs = Vec::new();
    let mut current_file: Option<String> = None;
    let mut current_diff_lines = Vec::new();

    for line in diff_output.lines() {
        if line.starts_with("diff --git") {
            // Process previous file if exists
            if let Some(file_path) = current_file.take() {
                let diff_text = current_diff_lines.join("\n");
                if let Ok(diff) = parse_git_diff(&diff_text, &file_path) {
                    diffs.push(diff);
                }
                current_diff_lines.clear();
            }

            // Extract file path from diff header
            if let Some(file_path) = extract_file_path_from_diff_header(line) {
                current_file = Some(file_path);
            }
        }

        current_diff_lines.push(line.to_string());
    }

    // Process final file
    if let Some(file_path) = current_file {
        let diff_text = current_diff_lines.join("\n");
        if let Ok(diff) = parse_git_diff(&diff_text, &file_path) {
            diffs.push(diff);
        }
    }

    Ok(diffs)
}

/// Parse a hunk header line: @@ -old_start,old_lines +new_start,new_lines @@
fn parse_hunk_header(header: &str) -> Option<(u32, u32, u32, u32)> {
    let parts: Vec<&str> = header.split_whitespace().collect();
    if parts.len() >= 3 {
        let old_part = parts[1].strip_prefix('-')?;
        let new_part = parts[2].strip_prefix('+')?;

        let old_parts: Vec<&str> = old_part.split(',').collect();
        let new_parts: Vec<&str> = new_part.split(',').collect();

        let old_start = old_parts[0].parse::<u32>().ok()?;
        let old_lines = if old_parts.len() > 1 {
            old_parts[1].parse::<u32>().ok()?
        } else {
            1
        };

        let new_start = new_parts[0].parse::<u32>().ok()?;
        let new_lines = if new_parts.len() > 1 {
            new_parts[1].parse::<u32>().ok()?
        } else {
            1
        };

        Some((old_start, old_lines, new_start, new_lines))
    } else {
        None
    }
}

/// Extract the file path from a "diff --git a/path b/path" header.
fn extract_file_path_from_diff_header(header: &str) -> Option<String> {
    let parts: Vec<&str> = header.split_whitespace().collect();
    if parts.len() >= 4 {
        let a_path = parts[2].strip_prefix("a/")?;
        Some(a_path.to_string())
    } else {
        None
    }
}

/// Parse `git status --porcelain=v1 -z` output into detailed file statuses.
pub(super) fn parse_detailed_git_status(status_output: &str) -> Vec<GitFileStatus> {
    let mut file_statuses = Vec::new();

    for entry in status_output.split('\0') {
        if entry.is_empty() || entry.len() < 3 {
            continue;
        }

        let status_chars = &entry[..2];
        let file_path = &entry[3..];

        let (status, old_path) = match status_chars {
            "??" => ("untracked".to_string(), None),
            " M" => ("modified".to_string(), None),
            "M " => ("staged".to_string(), None),
            "MM" => ("staged_and_modified".to_string(), None),
            "A " => ("added".to_string(), None),
            "D " => ("deleted_staged".to_string(), None),
            " D" => ("deleted".to_string(), None),
            "R " => {
                // Renamed file: "R  old_name -> new_name"
                if let Some(arrow_pos) = file_path.find(" -> ") {
                    let old_name = file_path[..arrow_pos].to_string();
                    let new_name = file_path[arrow_pos + 4..].to_string();
                    file_statuses.push(GitFileStatus {
                        path: new_name,
                        status: "renamed".to_string(),
                        old_path: Some(old_name),
                    });
                    continue;
                } else {
                    ("renamed".to_string(), None)
                }
            }
            "C " => ("copied".to_string(), None),
            "U " | " U" | "UU" => ("conflicted".to_string(), None),
            _ => ("unknown".to_string(), None),
        };

        file_statuses.push(GitFileStatus {
            path: file_path.to_string(),
            status,
            old_path,
        });
    }

    file_statuses
}

/// Parse `git branch -v` output into branch info.
pub(super) fn parse_simple_branches(
    branch_output: &str,
    is_remote: bool,
) -> Result<Vec<GitBranch>, String> {
    let mut branches = Vec::new();

    for line in branch_output.lines() {
        if line.trim().is_empty() {
            continue;
        }

        // Parse format: "* main    abcd123 Latest commit message"
        // or           "  feature abcd123 Feature commit message"
        let line = line.trim();
        let is_current = line.starts_with('*');

        // Remove the current marker and extra spaces
        let clean_line = if is_current { line[1..].trim() } else { line };

        // Split by whitespace and take first part as branch name
        let parts: Vec<&str> = clean_line.split_whitespace().collect();
        if !parts.is_empty() {
            let name = parts[0].to_string();

            branches.push(GitBranch {
                name,
                is_current: is_current && !is_remote,
                is_remote,
                last_commit: None,
                upstream: None, // Could be determined with additional git commands
                ahead: 0,
                behind: 0,
            });
        }
    }

    Ok(branches)
}

/// Parse `git stash list` output into stash entries.
pub(super) fn parse_stashes(stash_output: &str) -> Result<Vec<GitStash>, String> {
    let mut stashes = Vec::new();

    for line in stash_output.lines() {
        if line.trim().is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 4 {
            // Parse stash@{0} format
            let stash_ref = parts[0].trim();
            let index = if let Some(start) = stash_ref.find('{') {
                if let Some(end) = stash_ref.find('}') {
                    stash_ref[start + 1..end].parse::<u32>().unwrap_or(0)
                } else {
                    0
                }
            } else {
                0
            };

            let message = parts[1].trim().to_string();
            let _relative_time = parts[2].trim(); // "2 hours ago"
            let timestamp = parts[3].trim().parse::<i64>().unwrap_or(0);

            stashes.push(GitStash {
                index,
                message,
                branch: "unknown".to_string(), // Could be parsed from stash message
                timestamp,
                files_changed: Vec::new(), // Could be populated with file list
            });
        }
    }

    Ok(stashes)
}

/// Parse `git status --porcelain=v1` output into categorized file lists.
pub(super) fn parse_porcelain_status(status_output: &str) -> GitStatus {
    let mut untracked_files = Vec::new();
    let mut modified_files = Vec::new();
    let mut staged_files = Vec::new();

    for line in status_output.lines() {
        if line.len() >= 3 {
            let status_chars = &line[..2];
            let file_path = &line[3..];

            match status_chars {
                "??" => untracked_files.push(file_path.to_string()),
                " M" => modified_files.push(file_path.to_string()),
                "M " => staged_files.push(file_path.to_string()),
                "MM" => {
                    staged_files.push(file_path.to_string());
                    modified_files.push(file_path.to_string());
                }
                "A " => staged_files.push(file_path.to_string()),
                "D " => staged_files.push(file_path.to_string()),
                " D" => modified_files.push(file_path.to_string()),
                _ => {}
            }
        }
    }

    GitStatus {
        untracked_files,
        modified_files,
        staged_files,
    }
}
