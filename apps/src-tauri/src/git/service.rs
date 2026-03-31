use std::path::{Path, PathBuf};
use std::process::Command;

use super::parsing;
use super::types::*;
use super::validation::{validate_git_path, validate_git_ref};

pub struct GitService;

impl Default for GitService {
    fn default() -> Self {
        Self::new()
    }
}

impl GitService {
    pub fn new() -> Self {
        Self
    }

    pub fn find_git_repository(&self, path: &Path) -> Option<PathBuf> {
        let mut current_path = path.to_path_buf();

        loop {
            let git_dir = current_path.join(".git");
            if git_dir.exists() {
                return Some(current_path);
            }

            if let Some(parent) = current_path.parent() {
                current_path = parent.to_path_buf();
            } else {
                break;
            }
        }

        None
    }

    pub fn get_repository_info(&self, repo_path: &Path) -> Result<GitRepositoryInfo, String> {
        let current_branch = self.get_current_branch(repo_path)?;
        let remote_url = self.get_remote_url(repo_path).ok();
        let last_commit = self.get_latest_commit(repo_path).ok();

        let status = self.get_git_status(repo_path)?;

        // Count total commits
        let total_commits = self.count_total_commits(repo_path)?;

        // Count contributors
        let total_contributors = self.count_contributors(repo_path)?;

        Ok(GitRepositoryInfo {
            root_path: repo_path.to_string_lossy().to_string(),
            current_branch,
            remote_url,
            total_commits,
            total_contributors,
            last_commit,
            uncommitted_changes: !status.modified_files.is_empty()
                || !status.staged_files.is_empty(),
            untracked_files: status.untracked_files,
            modified_files: status.modified_files,
            staged_files: status.staged_files,
        })
    }

    pub fn get_file_history(
        &self,
        repo_path: &Path,
        file_path: &str,
        limit: Option<usize>,
    ) -> Result<GitFileHistory, String> {
        validate_git_path(file_path, "File path")?;
        let limit_str = limit
            .map(|l| l.to_string())
            .unwrap_or_else(|| "100".to_string());

        let output = Command::new("git")
            .current_dir(repo_path)
            .args([
                "log",
                "--follow",
                "--pretty=format:%H|%h|%an|%ae|%cn|%ce|%ad|%at|%s|%b",
                "--date=iso",
                "--stat=1000",
                &format!("-{}", limit_str),
                "--",
                file_path,
            ])
            .output()
            .map_err(|e| format!("Failed to execute git log: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Git log failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let log_output = String::from_utf8_lossy(&output.stdout);
        let commits = parsing::parse_git_log(&log_output, file_path)?;

        let total_lines_added = commits.iter().map(|c| c.insertions).sum();
        let total_lines_deleted = commits.iter().map(|c| c.deletions).sum();

        Ok(GitFileHistory {
            file_path: file_path.to_string(),
            total_commits: commits.len(),
            first_commit: commits.last().cloned(),
            last_commit: commits.first().cloned(),
            total_lines_added,
            total_lines_deleted,
            commits,
        })
    }

    pub fn get_file_blame(
        &self,
        repo_path: &Path,
        file_path: &str,
    ) -> Result<GitFileBlame, String> {
        validate_git_path(file_path, "File path")?;
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["blame", "--porcelain", "--line-porcelain", "--", file_path])
            .output()
            .map_err(|e| format!("Failed to execute git blame: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Git blame failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let blame_output = String::from_utf8_lossy(&output.stdout);
        let lines = parsing::parse_git_blame(&blame_output)?;

        let mut unique_authors = lines
            .iter()
            .map(|line| line.author_name.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        unique_authors.sort();

        Ok(GitFileBlame {
            file_path: file_path.to_string(),
            total_lines: lines.len(),
            unique_authors,
            lines,
        })
    }

    pub fn get_file_diff(
        &self,
        repo_path: &Path,
        file_path: &str,
        commit_hash: Option<&str>,
    ) -> Result<GitDiff, String> {
        validate_git_path(file_path, "File path")?;
        if let Some(hash) = commit_hash {
            validate_git_ref(hash, "Commit hash")?;
        }

        let mut args = vec!["diff"];

        if let Some(hash) = commit_hash {
            args.push(hash);
            args.push("HEAD");
        }

        args.extend_from_slice(&["--no-color", "--no-ext-diff", "-U3", "--", file_path]);

        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to execute git diff: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Git diff failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let diff_output = String::from_utf8_lossy(&output.stdout);
        parsing::parse_git_diff(&diff_output, file_path)
    }

    pub fn get_commit_diff(
        &self,
        repo_path: &Path,
        commit_hash: &str,
    ) -> Result<Vec<GitDiff>, String> {
        validate_git_ref(commit_hash, "Commit hash")?;
        let output = Command::new("git")
            .current_dir(repo_path)
            .args([
                "show",
                "--no-color",
                "--no-ext-diff",
                "-U3",
                "--format=",
                commit_hash,
            ])
            .output()
            .map_err(|e| format!("Failed to execute git show: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Git show failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let diff_output = String::from_utf8_lossy(&output.stdout);
        parsing::parse_multiple_git_diffs(&diff_output)
    }

    pub fn get_detailed_file_status(&self, repo_path: &Path) -> Result<Vec<GitFileStatus>, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["status", "--porcelain=v1", "-z"])
            .output()
            .map_err(|e| format!("Failed to get git status: {}", e))?;

        if !output.status.success() {
            return Err("Failed to get git status".to_string());
        }

        let status_output = String::from_utf8_lossy(&output.stdout);
        Ok(parsing::parse_detailed_git_status(&status_output))
    }

    pub fn get_branches(&self, repo_path: &Path) -> Result<Vec<GitBranch>, String> {
        // Get local branches using simpler approach
        let local_output = Command::new("git")
            .current_dir(repo_path)
            .args(["branch", "-v"])
            .output()
            .map_err(|e| format!("Failed to get branches: {}", e))?;

        let mut branches = Vec::new();

        if local_output.status.success() {
            let branch_output = String::from_utf8_lossy(&local_output.stdout);
            branches.extend(parsing::parse_simple_branches(&branch_output, false)?);
        }

        // Get remote branches
        let remote_output = Command::new("git")
            .current_dir(repo_path)
            .args(["branch", "-r", "-v"])
            .output()
            .map_err(|e| format!("Failed to get remote branches: {}", e))?;

        if remote_output.status.success() {
            let remote_branch_output = String::from_utf8_lossy(&remote_output.stdout);
            branches.extend(parsing::parse_simple_branches(&remote_branch_output, true)?);
        }

        Ok(branches)
    }

    pub fn create_branch(
        &self,
        repo_path: &Path,
        branch_name: &str,
        from_commit: Option<&str>,
    ) -> Result<(), String> {
        validate_git_ref(branch_name, "Branch name")?;
        if let Some(commit) = from_commit {
            validate_git_ref(commit, "Source commit")?;
        }
        let mut args = vec!["checkout", "-b", branch_name];
        if let Some(commit) = from_commit {
            args.push(commit);
        }

        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to create branch: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to create branch: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn switch_branch(&self, repo_path: &Path, branch_name: &str) -> Result<(), String> {
        validate_git_ref(branch_name, "Branch name")?;
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["checkout", branch_name])
            .output()
            .map_err(|e| format!("Failed to switch branch: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to switch branch: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn delete_branch(
        &self,
        repo_path: &Path,
        branch_name: &str,
        force: bool,
    ) -> Result<(), String> {
        validate_git_ref(branch_name, "Branch name")?;
        let flag = if force { "-D" } else { "-d" };
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["branch", flag, branch_name])
            .output()
            .map_err(|e| format!("Failed to delete branch: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to delete branch: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn stage_file(&self, repo_path: &Path, file_path: &str) -> Result<(), String> {
        validate_git_path(file_path, "File path")?;
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["add", "--", file_path])
            .output()
            .map_err(|e| format!("Failed to stage file: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to stage file: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn unstage_file(&self, repo_path: &Path, file_path: &str) -> Result<(), String> {
        validate_git_path(file_path, "File path")?;
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["reset", "HEAD", "--", file_path])
            .output()
            .map_err(|e| format!("Failed to unstage file: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to unstage file: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn commit_changes(
        &self,
        repo_path: &Path,
        message: &str,
        amend: bool,
    ) -> Result<String, String> {
        if message.is_empty() {
            return Err("Commit message cannot be empty".to_string());
        }
        if message.contains('\0') {
            return Err("Commit message contains null byte".to_string());
        }
        let mut args = vec!["commit", "-m", message];
        if amend {
            args.insert(1, "--amend");
        }

        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to commit: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            Err(format!(
                "Failed to commit: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn get_stashes(&self, repo_path: &Path) -> Result<Vec<GitStash>, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["stash", "list", "--pretty=format:%gd|%s|%cr|%at"])
            .output()
            .map_err(|e| format!("Failed to get stashes: {}", e))?;

        if !output.status.success() {
            return Ok(Vec::new()); // No stashes
        }

        let stash_output = String::from_utf8_lossy(&output.stdout);
        parsing::parse_stashes(&stash_output)
    }

    pub fn create_stash(
        &self,
        repo_path: &Path,
        message: Option<&str>,
        include_untracked: bool,
    ) -> Result<(), String> {
        if let Some(msg) = message {
            if msg.contains('\0') {
                return Err("Stash message contains null byte".to_string());
            }
        }
        let mut args = vec!["stash", "push"];
        if include_untracked {
            args.push("-u");
        }
        if let Some(msg) = message {
            args.extend_from_slice(&["-m", msg]);
        }

        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to create stash: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to create stash: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn apply_stash(&self, repo_path: &Path, stash_index: u32, pop: bool) -> Result<(), String> {
        let command = if pop { "pop" } else { "apply" };
        let stash_ref = format!("stash@{{{}}}", stash_index);

        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["stash", command, &stash_ref])
            .output()
            .map_err(|e| format!("Failed to apply stash: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to apply stash: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn drop_stash(&self, repo_path: &Path, stash_index: u32) -> Result<(), String> {
        let stash_ref = format!("stash@{{{}}}", stash_index);

        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["stash", "drop", &stash_ref])
            .output()
            .map_err(|e| format!("Failed to drop stash: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Failed to drop stash: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    pub fn get_all_commits(
        &self,
        repo_path: &Path,
        limit: Option<usize>,
        branch: Option<&str>,
    ) -> Result<Vec<GitCommit>, String> {
        if let Some(b) = branch {
            validate_git_ref(b, "Branch")?;
        }
        let limit_str = limit
            .map(|l| l.to_string())
            .unwrap_or_else(|| "100".to_string());
        let branch_or_all = branch.unwrap_or("--all");

        let output = Command::new("git")
            .current_dir(repo_path)
            .args([
                "log",
                branch_or_all,
                "--pretty=format:%H|%h|%an|%ae|%cn|%ce|%ad|%at|%s|%b|%P",
                "--date=iso",
                "--stat=1000",
                &format!("-{}", limit_str),
            ])
            .output()
            .map_err(|e| format!("Failed to execute git log: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Git log failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let log_output = String::from_utf8_lossy(&output.stdout);
        parsing::parse_git_log(&log_output, "")
    }

    // ── Private helper methods ─────────────────────────────────────────────

    fn get_current_branch(&self, repo_path: &Path) -> Result<String, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["branch", "--show-current"])
            .output()
            .map_err(|e| format!("Failed to get current branch: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err("Failed to get current branch".to_string())
        }
    }

    fn get_remote_url(&self, repo_path: &Path) -> Result<String, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["remote", "get-url", "origin"])
            .output()
            .map_err(|e| format!("Failed to get remote URL: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err("No remote URL found".to_string())
        }
    }

    fn get_latest_commit(&self, repo_path: &Path) -> Result<GitCommit, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args([
                "log",
                "-1",
                "--pretty=format:%H|%h|%an|%ae|%cn|%ce|%ad|%at|%s|%b",
                "--date=iso",
            ])
            .output()
            .map_err(|e| format!("Failed to get latest commit: {}", e))?;

        if !output.status.success() {
            return Err("Failed to get latest commit".to_string());
        }

        let log_output = String::from_utf8_lossy(&output.stdout);
        let commits = parsing::parse_git_log(&log_output, "")?;

        commits
            .into_iter()
            .next()
            .ok_or_else(|| "No commits found".to_string())
    }

    fn get_git_status(&self, repo_path: &Path) -> Result<GitStatus, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["status", "--porcelain=v1"])
            .output()
            .map_err(|e| format!("Failed to get git status: {}", e))?;

        if !output.status.success() {
            return Err("Failed to get git status".to_string());
        }

        let status_output = String::from_utf8_lossy(&output.stdout);
        Ok(parsing::parse_porcelain_status(&status_output))
    }

    fn count_total_commits(&self, repo_path: &Path) -> Result<usize, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["rev-list", "--count", "HEAD"])
            .output()
            .map_err(|e| format!("Failed to count commits: {}", e))?;

        if output.status.success() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            let count_str = output_str.trim();
            count_str
                .parse::<usize>()
                .map_err(|e| format!("Failed to parse commit count: {}", e))
        } else {
            Ok(0)
        }
    }

    fn count_contributors(&self, repo_path: &Path) -> Result<usize, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["shortlog", "-sn", "--all"])
            .output()
            .map_err(|e| format!("Failed to count contributors: {}", e))?;

        if output.status.success() {
            let contributors = String::from_utf8_lossy(&output.stdout)
                .lines()
                .filter(|line| !line.trim().is_empty())
                .count();
            Ok(contributors)
        } else {
            Ok(0)
        }
    }
}
