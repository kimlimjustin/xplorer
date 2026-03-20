import { transport } from '../transport';
import type {
  GitRepositoryInfo,
  GitFileHistory,
  GitFileBlame,
  GitDiff,
  GitCommit,
  GitFileStatus,
  GitRepoInfo,
} from '../types';

export const findGitRepository = async (path: string): Promise<string | null> => {
  return await transport('find_git_repository', { path });
};

export const getRepositoryInfo = async (repoPath: string): Promise<GitRepositoryInfo> => {
  return await transport('get_repository_info', { repoPath });
};

export const getFileHistory = async (
  repoPath: string,
  filePath: string,
  limit?: number,
): Promise<GitFileHistory> => {
  return await transport('get_file_history', { repoPath, filePath, limit });
};

export const getFileBlame = async (repoPath: string, filePath: string): Promise<GitFileBlame> => {
  return await transport('get_file_blame', { repoPath, filePath });
};

export const getFileDiff = async (
  repoPath: string,
  filePath: string,
  commitHash?: string,
): Promise<GitDiff> => {
  return await transport('get_file_diff', { repoPath, filePath, commitHash });
};

export const getCommitDiff = async (repoPath: string, commitHash: string): Promise<GitDiff[]> => {
  return await transport('get_commit_diff', { repoPath, commitHash });
};

export const getAllCommits = async (
  repoPath: string,
  limit?: number,
  branch?: string,
): Promise<GitCommit[]> => {
  return await transport('get_all_commits', { repoPath, limit, branch });
};

export const getFileStatus = async (
  repoPath: string,
): Promise<Array<{ path: string; status: string; old_path?: string }>> => {
  return await transport('get_file_status', { repoPath });
};

export const getBranches = async (
  repoPath: string,
): Promise<
  Array<{
    name: string;
    is_current: boolean;
    is_remote: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    last_commit?: any;
    upstream?: string;
    ahead: number;
    behind: number;
  }>
> => {
  return await transport('get_branches', { repoPath });
};

export const createBranch = async (
  repoPath: string,
  branchName: string,
  fromCommit?: string,
): Promise<void> => {
  return await transport('create_branch', { repoPath, branchName, fromCommit });
};

export const switchBranch = async (repoPath: string, branchName: string): Promise<void> => {
  return await transport('switch_branch', { repoPath, branchName });
};

export const deleteBranch = async (
  repoPath: string,
  branchName: string,
  force: boolean = false,
): Promise<void> => {
  return await transport('delete_branch', { repoPath, branchName, force });
};

export const stageFile = async (repoPath: string, filePath: string): Promise<void> => {
  return await transport('stage_file', { repoPath, filePath });
};

export const unstageFile = async (repoPath: string, filePath: string): Promise<void> => {
  return await transport('unstage_file', { repoPath, filePath });
};

export const commitChanges = async (
  repoPath: string,
  message: string,
  amend: boolean = false,
): Promise<string> => {
  return await transport('commit_changes', { repoPath, message, amend });
};

export const getStashes = async (
  repoPath: string,
): Promise<
  Array<{
    index: number;
    message: string;
    branch: string;
    timestamp: number;
    files_changed: string[];
  }>
> => {
  return await transport('get_stashes', { repoPath });
};

export const createStash = async (
  repoPath: string,
  message?: string,
  includeUntracked: boolean = false,
): Promise<void> => {
  return await transport('create_stash', { repoPath, message, includeUntracked });
};

export const applyStash = async (
  repoPath: string,
  stashIndex: number,
  pop: boolean = false,
): Promise<void> => {
  return await transport('apply_stash', { repoPath, stashIndex, pop });
};

export const dropStash = async (repoPath: string, stashIndex: number): Promise<void> => {
  return await transport('drop_stash', { repoPath, stashIndex });
};

export const getGitStatus = async (directory: string): Promise<GitFileStatus[]> => {
  return await transport('get_git_status', { directory });
};

export const getGitRepoInfo = async (directory: string): Promise<GitRepoInfo> => {
  return await transport('get_git_repo_info', { directory });
};

export interface GitRemoteInfo {
  name: string;
  url: string;
}

export const gitPull = async (directory: string): Promise<string> => {
  return await transport('git_pull', { directory });
};

export const gitPush = async (directory: string, force: boolean = false): Promise<string> => {
  return await transport('git_push', { directory, force });
};

export const gitFetch = async (directory: string): Promise<string> => {
  return await transport('git_fetch', { directory });
};

export const getGitRemotes = async (directory: string): Promise<GitRemoteInfo[]> => {
  return await transport('git_get_remotes', { directory });
};
