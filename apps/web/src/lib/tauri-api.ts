// Mock TauriAPI for web landing page — provides types and demo data
// so the real Xplorer components can render in a Next.js context.

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  file_type: string;
  mime_type?: string;
  is_readonly: boolean;
}

export interface SearchResult {
  path: string;
  name: string;
  filename: string;
  is_dir: boolean;
  size: number;
  modified: number;
  file_type: string;
  mime_type?: string;
  is_readonly: boolean;
  score?: number;
  snippet?: string;
  relevance_type?: string;
  matches?: Array<{
    field: string;
    indices: Array<[number, number]>;
    token?: string;
    context?: string;
  }>;
}

export interface FolderSizeInfo {
  total_size: number;
  file_count: number;
  dir_count: number;
  is_cached: boolean;
  cache_timestamp: number;
}

export interface FileTag {
  name: string;
  color: string;
}

export interface BookmarkEntry {
  path: string;
  name: string;
  added_at: string;
  is_dir: boolean;
}

export interface RecentFile {
  path: string;
  name: string;
  accessed_at: number;
  file_type: string;
  size: number;
}

export interface FileProperties {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  created: number;
  modified: number;
  accessed: number;
  readonly: boolean;
  hidden: boolean;
  file_type: string;
  mime_type?: string;
}

export interface GitRepositoryInfo {
  root_path: string;
  current_branch: string;
  remote_url?: string;
  total_commits: number;
  total_contributors: number;
  uncommitted_changes: boolean;
  untracked_files: string[];
  modified_files: string[];
  staged_files: string[];
}

export interface ExtensionManifestInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon?: string;
  permissions: string[];
  entry_point: string;
  extension_type: string;
  enabled: boolean;
}

export type CompressionFormat = 'Zip' | 'Tar' | 'TarGz' | 'TarBz2' | 'TarXz' | 'SevenZ';

export interface FileSystemNode {
  path: string;
  name: string;
  is_dir: boolean;
  size: number;
  modified: number;
  content?: string;
  children?: FileSystemNode[];
  error?: string;
}

export interface AgentProgress {
  path: string;
  status: string;
}

export interface GitCommit {
  hash: string;
  short_hash: string;
  author_name: string;
  author_email: string;
  committer_name: string;
  committer_email: string;
  date: string;
  timestamp: number;
  message: string;
  summary: string;
  body?: string;
  parent_hashes: string[];
  files_changed: string[];
  insertions: number;
  deletions: number;
}

export interface GitFileHistory {
  file_path: string;
  commits: GitCommit[];
  total_commits: number;
  first_commit?: GitCommit;
  last_commit?: GitCommit;
  total_lines_added: number;
  total_lines_deleted: number;
}

export interface GitBlameLine {
  line_number: number;
  content: string;
  commit_hash: string;
  short_hash: string;
  author_name: string;
  author_email: string;
  date: string;
  timestamp: number;
  summary: string;
}

export interface GitFileBlame {
  file_path: string;
  lines: GitBlameLine[];
  unique_authors: string[];
  total_lines: number;
}

// Mock TauriAPI — all methods return demo data
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TauriAPI {
  static async getUserDirectories() {
    return {
      home: 'C:\\Users\\User',
      documents: 'C:\\Users\\User\\Documents',
      downloads: 'C:\\Users\\User\\Downloads',
      desktop: 'C:\\Users\\User\\Desktop',
      pictures: 'C:\\Users\\User\\Pictures',
      videos: 'C:\\Users\\User\\Videos',
      music: 'C:\\Users\\User\\Music',
    };
  }

  static async listDrives() {
    return [
      { letter: 'C', label: 'Local Disk', path: 'C:\\', total_space: 512_110_190_592, free_space: 199_715_979_264 },
      { letter: 'D', label: 'Data', path: 'D:\\', total_space: 1_099_511_627_776, free_space: 687_194_767_360 },
    ];
  }

  static async readDirectory(_path: string): Promise<FileEntry[]> {
    return [];
  }

  static async getBookmarks(): Promise<BookmarkEntry[]> {
    return [
      { path: 'C:\\Projects\\xplorer', name: 'xplorer', added_at: '2026-03-01T00:00:00Z', is_dir: true },
      { path: 'C:\\Projects\\design-assets', name: 'design-assets', added_at: '2026-02-15T00:00:00Z', is_dir: true },
    ];
  }

  static async removeBookmark(_path: string) { return; }

  static async getRecentFiles(_limit?: number): Promise<RecentFile[]> {
    return [
      { path: 'C:\\Projects\\xplorer\\package.json', name: 'package.json', accessed_at: Date.now() - 3600000, file_type: 'json', size: 2100 },
      { path: 'C:\\Projects\\xplorer\\README.md', name: 'README.md', accessed_at: Date.now() - 7200000, file_type: 'md', size: 4300 },
    ];
  }

  static async findGitRepository(_path: string) {
    return 'C:\\Projects\\xplorer';
  }

  static async getRepositoryInfo(_path: string): Promise<GitRepositoryInfo> {
    return {
      root_path: 'C:\\Projects\\xplorer',
      current_branch: 'main',
      total_commits: 142,
      total_contributors: 3,
      uncommitted_changes: true,
      untracked_files: [],
      modified_files: ['src/App.tsx', 'package.json'],
      staged_files: ['src/theme.ts'],
    };
  }

  static async listInstalledExtensions(): Promise<ExtensionManifestInfo[]> {
    return [];
  }

  static async getFileTags(_path: string): Promise<FileTag[]> { return []; }
  static async setFileTags(_path: string, _tags: FileTag[]) { return; }
  static async getFileProperties(_path: string): Promise<FileProperties | null> { return null; }
  static async openFile(_path: string) { return; }
  static async getGitStatusForFiles(_paths: string[]): Promise<Record<string, string>> { return {}; }

  // Git history methods
  static async getFileHistory(_repoPath: string, _filePath: string, _limit?: number): Promise<GitFileHistory> {
    const now = Math.floor(Date.now() / 1000);
    return {
      file_path: _filePath,
      total_commits: 4,
      total_lines_added: 180,
      total_lines_deleted: 199,
      commits: [
        { hash: 'a3f8c21e7b4d098c2f56b8d3', short_hash: 'a3f8c21', author_name: 'Sarah', author_email: 'sarah@example.com', committer_name: 'Sarah', committer_email: 'sarah@example.com', date: '2026-03-10', timestamp: now - 7200, message: 'feat: add dark mode toggle', summary: 'feat: add dark mode toggle', parent_hashes: ['e7b4d09'], files_changed: ['src/App.tsx', 'src/theme.ts'], insertions: 42, deletions: 8 },
        { hash: 'e7b4d09a3f8c21b8d3a74c56', short_hash: 'e7b4d09', author_name: 'Alex', author_email: 'alex@example.com', committer_name: 'Alex', committer_email: 'alex@example.com', date: '2026-03-10', timestamp: now - 18000, message: 'fix: resolve search indexing bug', summary: 'fix: resolve search indexing bug', parent_hashes: ['91c2f56'], files_changed: ['src/search.ts'], insertions: 15, deletions: 23 },
        { hash: '91c2f56e7b4d09a3f8c21b8d', short_hash: '91c2f56', author_name: 'Sarah', author_email: 'sarah@example.com', committer_name: 'Sarah', committer_email: 'sarah@example.com', date: '2026-03-09', timestamp: now - 86400, message: 'refactor: optimize file listing', summary: 'refactor: optimize file listing', parent_hashes: ['b8d3a74'], files_changed: ['src/App.tsx', 'src/utils.ts', 'src/components/FileGrid.tsx'], insertions: 89, deletions: 156 },
        { hash: 'b8d3a7491c2f56e7b4d09a3f', short_hash: 'b8d3a74', author_name: 'Jordan', author_email: 'jordan@example.com', committer_name: 'Jordan', committer_email: 'jordan@example.com', date: '2026-03-08', timestamp: now - 172800, message: 'docs: update API reference', summary: 'docs: update API reference', parent_hashes: [], files_changed: ['docs/api.md', 'README.md'], insertions: 34, deletions: 12 },
      ],
    };
  }

  static async getFileBlame(_repoPath: string, _filePath: string): Promise<GitFileBlame> {
    const now = Math.floor(Date.now() / 1000);
    return {
      file_path: _filePath,
      total_lines: 5,
      unique_authors: ['Sarah', 'Alex'],
      lines: [
        { line_number: 1, content: "import React from 'react';", commit_hash: 'a3f8c21', short_hash: 'a3f8c21', author_name: 'Sarah', author_email: 'sarah@example.com', date: '2026-03-10', timestamp: now - 7200, summary: 'feat: add dark mode toggle' },
        { line_number: 2, content: "import { useState } from 'react';", commit_hash: 'a3f8c21', short_hash: 'a3f8c21', author_name: 'Sarah', author_email: 'sarah@example.com', date: '2026-03-10', timestamp: now - 7200, summary: 'feat: add dark mode toggle' },
        { line_number: 3, content: '', commit_hash: '91c2f56', short_hash: '91c2f56', author_name: 'Sarah', author_email: 'sarah@example.com', date: '2026-03-09', timestamp: now - 86400, summary: 'refactor: optimize file listing' },
        { line_number: 4, content: 'export function App() {', commit_hash: 'e7b4d09', short_hash: 'e7b4d09', author_name: 'Alex', author_email: 'alex@example.com', date: '2026-03-10', timestamp: now - 18000, summary: 'fix: resolve search indexing bug' },
        { line_number: 5, content: '  const [count, setCount] = useState(0);', commit_hash: 'a3f8c21', short_hash: 'a3f8c21', author_name: 'Sarah', author_email: 'sarah@example.com', date: '2026-03-10', timestamp: now - 7200, summary: 'feat: add dark mode toggle' },
      ],
    };
  }

  // AI/Agent methods
  static async getAiModels() {
    return [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', available: true },
      { id: 'llama3.2', name: 'Llama 3.2', provider: 'ollama', available: true },
    ];
  }
  static async checkOllamaStatus() { return true; }
  static async chatWithAI(_model: string, _messages: unknown[], _fileContext?: unknown) { return 'Demo response.'; }
  static async analyzeFileWithAI(_model: string, _fileContext: unknown) { return 'Demo analysis.'; }
  static async getFileHelp(_model: string, _fileName: string, _fileType: string) { return 'Demo help.'; }
  static async agentReadFileTree(_path: string, _maxRecursion: number, _includeContent: boolean) {
    return { tree: { path: _path, name: 'demo', is_dir: true, size: 0, modified: Date.now() }, progress: [] };
  }
  static async agentRequestWritePermission(_filePath: string, _content: string, _reason: string) { return 'req-1'; }
  static async agentWriteFileWithPermission(_filePath: string, _content: string, _approved: boolean) {}
  static async isDir(_path: string) { return false; }
  static async readTextFile(_path: string) { return ''; }
  static async readBinaryFile(_path: string): Promise<Uint8Array> { return new Uint8Array(); }
  static async createChatFile(_dir: string, _name?: string): Promise<string> { return ''; }
  static async copy(_source: string | string[], _destination: string): Promise<void> {}
  static async rename(_oldPath: string, _newPath: string): Promise<void> {}
  static async moveToTrash(_paths: string | string[]): Promise<void> {}
  static async fileExists(_path: string): Promise<boolean> { return false; }
  static async ejectVolume(_path: string): Promise<void> {}
  static async enhancedSearch(_query: string, _path?: string, _limit?: number, _options?: unknown): Promise<{ results: SearchResult[]; parsed_query?: { file_type_filter?: string; sort_hint?: string; keywords?: string[] } }> { return { results: [] }; }
  static async searchTokens(_query: string, _limit?: number): Promise<SearchResult[]> { return []; }
  static async semanticSearch(_query: string, _limit?: number): Promise<SearchResult[]> { return []; }

  // Extension methods
  static async uninstallExtensionById(_id: string) {}
  static async showOpenDialog(_options: { directory?: boolean }): Promise<string[]> { return []; }
  static async validateExtensionPath(_path: string): Promise<ExtensionManifestInfo> {
    return { id: 'demo', name: 'Demo', version: '1.0.0', description: 'Demo', author: 'Demo', permissions: [], entry_point: 'index.js', extension_type: 'panel', enabled: false };
  }
  static async installExtensionFromPath(_path: string) {
    return { manifest: { id: 'demo', name: 'Demo', version: '1.0.0', description: 'Demo', author: 'Demo', permissions: [], entry_point: 'index.js', extension_type: 'panel' }, code: '', basePath: '' };
  }
}
