/**
 * Git Extension for Xplorer — GitHub Desktop style
 *
 * Two-tab layout: Changes (file list + diff + commit area) and History (commit list + diff).
 * Uses api.git.* methods. All inline styles + CSS variables. BottomTab.register().
 */
import {
  BottomTab,
  Command,
  type XplorerAPI,
} from '@xplorer/extension-sdk';

const React = (window as unknown as Record<string, unknown>).React as typeof import('react');
const { useState, useEffect, useCallback, useRef, useMemo } = React;

// ── Types ────────────────────────────────────────────────────────────

interface GitCommit {
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

interface GitBranchInfo {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  last_commit?: { hash: string; message: string; author: string; date: string } | null;
  upstream?: string;
  ahead: number;
  behind: number;
}

interface GitDiffHunk {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  header: string;
  lines: GitDiffLine[];
}

interface GitDiffLine {
  line_type: string;
  content: string;
  old_line_number?: number;
  new_line_number?: number;
}

interface GitDiff {
  file_path: string;
  old_path?: string;
  change_type: string;
  hunks: GitDiffHunk[];
  lines_added: number;
  lines_deleted: number;
  binary: boolean;
}

interface FileStatusEntry {
  path: string;
  status: string;
  old_path?: string;
}

interface GitRepositoryInfo {
  root_path: string;
  current_branch: string;
  remote_url?: string;
  total_commits: number;
  total_contributors: number;
  last_commit?: GitCommit;
  uncommitted_changes: boolean;
  untracked_files: string[];
  modified_files: string[];
  staged_files: string[];
}

// ── Utilities ────────────────────────────────────────────────────────

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
};

const statusLabel = (s: string): string => {
  const map: Record<string, string> = {
    modified: 'M', added: 'A', deleted: 'D', renamed: 'R',
    copied: 'C', untracked: '?', conflicted: 'U',
    new_file: 'A', new: 'A',
  };
  return map[s.toLowerCase()] ?? s.charAt(0).toUpperCase();
};

const statusColor = (s: string): string => {
  const label = statusLabel(s);
  if (label === 'M') return 'var(--xp-orange)';
  if (label === 'A' || label === '?') return 'var(--xp-green)';
  if (label === 'D') return 'var(--xp-red)';
  if (label === 'R') return 'var(--xp-cyan)';
  if (label === 'U') return 'var(--xp-red)';
  return 'var(--xp-text-muted)';
};

const basename = (p: string): string => {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
};

const dirname = (p: string): string => {
  const parts = p.replace(/\\/g, '/').split('/');
  parts.pop();
  return parts.join('/');
};

// ── WASM Backend Wrapper ─────────────────────────────────────────────

let wasmAvailable: boolean | null = null;

const gitCall = async (
  api: XplorerAPI,
  method: string,
  args: Record<string, unknown>,
): Promise<unknown> => {
  if (wasmAvailable === null) {
    try {
      wasmAvailable = await (api as Record<string, unknown> as { backend: { isLoaded: () => Promise<boolean> } }).backend.isLoaded();
    } catch {
      wasmAvailable = false;
    }
  }

  if (wasmAvailable) {
    try {
      const result = await (api as Record<string, unknown> as { backend: { call: (m: string, a: Record<string, unknown>) => Promise<unknown> } }).backend.call(method, args);
      if (result && typeof result === 'object') {
        if ('error' in result) throw new Error((result as { error: string }).error);
        if ('ok' in result) return (result as { ok: unknown }).ok;
      }
      return result;
    } catch {
      // fall through to direct API
    }
  }

  const g = (api as Record<string, unknown>).git as Record<string, (...a: unknown[]) => Promise<unknown>>;
  switch (method) {
    case 'find_repository': return g.findRepository(args.path);
    case 'get_all_commits': return g.getAllCommits(args.repo_path, args.limit, args.branch);
    case 'get_branches': return g.getBranches(args.repo_path);
    case 'get_repository_info': return g.getRepositoryInfo(args.repo_path);
    case 'get_file_history': return g.getFileHistory(args.repo_path, args.file_path, args.limit);
    case 'get_file_blame': return g.getFileBlame(args.repo_path, args.file_path);
    case 'get_file_status': return g.getFileStatus(args.repo_path);
    case 'get_file_diff': return g.getFileDiff(args.repo_path, args.file_path, args.commit_hash);
    case 'get_commit_diff': return g.getCommitDiff(args.repo_path, args.commit_hash);
    case 'switch_branch': return g.switchBranch(args.repo_path, args.branch);
    case 'create_branch': return g.createBranch(args.repo_path, args.branch_name, args.from_commit);
    case 'delete_branch': return g.deleteBranch(args.repo_path, args.branch_name, args.force);
    case 'stage_file': return g.stageFile(args.repo_path, args.file_path);
    case 'unstage_file': return g.unstageFile(args.repo_path, args.file_path);
    case 'commit_changes': return g.commitChanges(args.repo_path, args.message, args.amend);
    case 'pull': return g.pull(args.repo_path);
    case 'push': return g.push(args.repo_path, args.force);
    case 'fetch': return g.fetch(args.repo_path);
    default: throw new Error(`Unknown git method: ${method}`);
  }
};

// ── SVG Icons ────────────────────────────────────────────────────────

const Icon = ({ d, size = 14 }: { d: string; size?: number }) => (
  <svg width={size} height={size} fill="currentColor" viewBox="0 0 16 16">
    <path fillRule="evenodd" d={d} />
  </svg>
);

const Icons = {
  branch: 'M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z',
  refresh: 'M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1zM8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z',
  check: 'M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z',
  file: 'M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H4zm0 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z',
  chevronDown: 'M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z',
  upload: 'M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5zM7.646.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 1.707V10.5a.5.5 0 0 1-1 0V1.707L5.354 3.854a.5.5 0 1 1-.708-.708l3-3z',
  download: 'M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5zM7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z',
  clock: 'M8 3.5a.5.5 0 0 0-1 0V8a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 7.71V3.5zM8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z',
  plus: 'M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z',
  minus: 'M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z',
  person: 'M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z',
  noEntry: 'M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z',
};

const SpinnerIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" style={{ animation: 'xpgit-spin 1s linear infinite' }}>
    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// ── Shared Styles ────────────────────────────────────────────────────

const S = {
  text: { color: 'var(--xp-text)' } as React.CSSProperties,
  textMuted: { color: 'var(--xp-text-muted)' } as React.CSSProperties,
  bg: { background: 'var(--xp-bg)' } as React.CSSProperties,
  surface: { background: 'var(--xp-surface)' } as React.CSSProperties,
  surfaceLight: { background: 'var(--xp-surface-light)' } as React.CSSProperties,
  borderB: { borderBottom: '1px solid var(--xp-border)' } as React.CSSProperties,
  borderR: { borderRight: '1px solid var(--xp-border)' } as React.CSSProperties,
  borderAll: { border: '1px solid var(--xp-border)' } as React.CSSProperties,
  rounded: { borderRadius: '4px' } as React.CSSProperties,
  roundedSm: { borderRadius: '3px' } as React.CSSProperties,
  fontMono: { fontFamily: 'monospace' } as React.CSSProperties,
  textXs: { fontSize: '11px' } as React.CSSProperties,
  textSm: { fontSize: '13px' } as React.CSSProperties,
  text12: { fontSize: '12px' } as React.CSSProperties,
  truncate: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as React.CSSProperties,
  flexCenter: { display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
  flexRow: { display: 'flex', alignItems: 'center' } as React.CSSProperties,
  flexCol: { display: 'flex', flexDirection: 'column' } as React.CSSProperties,
  flex1: { flex: 1, minWidth: 0, minHeight: 0 } as React.CSSProperties,
  gap1: { gap: '4px' } as React.CSSProperties,
  gap2: { gap: '8px' } as React.CSSProperties,
  gap3: { gap: '12px' } as React.CSSProperties,
  p2: { padding: '8px' } as React.CSSProperties,
  p3: { padding: '12px' } as React.CSSProperties,
  px2: { paddingLeft: '8px', paddingRight: '8px' } as React.CSSProperties,
  px3: { paddingLeft: '12px', paddingRight: '12px' } as React.CSSProperties,
  py1: { paddingTop: '4px', paddingBottom: '4px' } as React.CSSProperties,
  py2: { paddingTop: '8px', paddingBottom: '8px' } as React.CSSProperties,
  noShrink: { flexShrink: 0 } as React.CSSProperties,
  overflowAuto: { overflow: 'auto' } as React.CSSProperties,
  overflowHidden: { overflow: 'hidden' } as React.CSSProperties,
  pointer: { cursor: 'pointer' } as React.CSSProperties,
  w100: { width: '100%' } as React.CSSProperties,
  h100: { height: '100%' } as React.CSSProperties,
};

// ── Inject keyframes ─────────────────────────────────────────────────

const injectStyles = (() => {
  let injected = false;
  return () => {
    if (injected) return;
    injected = true;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes xpgit-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .xpgit-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
      .xpgit-scroll::-webkit-scrollbar-track { background: transparent; }
      .xpgit-scroll::-webkit-scrollbar-thumb { background: var(--xp-border); border-radius: 3px; }
      .xpgit-scroll::-webkit-scrollbar-thumb:hover { background: var(--xp-text-muted); }
    `;
    document.head.appendChild(style);
  };
})();

// ── Button component ─────────────────────────────────────────────────

const ToolbarBtn = ({
  children,
  onClick,
  title,
  disabled,
  style: extra,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    style={{
      ...S.flexRow, ...S.gap1, ...S.text12, ...S.roundedSm,
      padding: '3px 10px',
      border: '1px solid var(--xp-border)',
      background: 'var(--xp-surface)',
      color: disabled ? 'var(--xp-text-muted)' : 'var(--xp-text)',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      fontWeight: 500,
      height: '26px',
      ...extra,
    }}
  >
    {children}
  </button>
);

// ── Diff Viewer ──────────────────────────────────────────────────────

const DiffViewer = ({ diff }: { diff: GitDiff | null }) => {
  if (!diff) {
    return (
      <div style={{ ...S.flexCenter, ...S.h100, ...S.textMuted, ...S.text12 }}>
        Select a file to view diff
      </div>
    );
  }

  if (diff.binary) {
    return (
      <div style={{ ...S.flexCenter, ...S.h100, ...S.textMuted, ...S.text12 }}>
        Binary file — cannot display diff
      </div>
    );
  }

  if (diff.hunks.length === 0) {
    return (
      <div style={{ ...S.flexCenter, ...S.h100, ...S.textMuted, ...S.text12 }}>
        No changes
      </div>
    );
  }

  return (
    <div className="xpgit-scroll" style={{ ...S.flex1, overflowY: 'auto', overflowX: 'auto' }}>
      {/* Diff header */}
      <div style={{
        ...S.px3, ...S.py1, ...S.surface, ...S.borderB,
        ...S.fontMono, ...S.textXs, ...S.textMuted, ...S.noShrink,
      }}>
        {diff.file_path}
        <span style={{ marginLeft: '12px' }}>
          <span style={{ color: 'var(--xp-green)' }}>+{diff.lines_added}</span>
          {' '}
          <span style={{ color: 'var(--xp-red)' }}>-{diff.lines_deleted}</span>
        </span>
      </div>
      {/* Hunks */}
      {diff.hunks.map((hunk: GitDiffHunk, hi: number) => (
        <div key={hi}>
          {/* Hunk header */}
          <div style={{
            ...S.fontMono, ...S.textXs, ...S.px3, ...S.py1,
            background: 'rgba(var(--xp-blue-rgb, 59, 130, 246), 0.08)',
            color: 'var(--xp-blue)',
            borderTop: hi > 0 ? '1px solid var(--xp-border)' : 'none',
            borderBottom: '1px solid var(--xp-border)',
          }}>
            {hunk.header}
          </div>
          {/* Lines */}
          {hunk.lines.map((line: GitDiffLine, li: number) => {
            const isAdd = line.line_type === 'add' || line.line_type === 'addition' || line.line_type === '+';
            const isDel = line.line_type === 'delete' || line.line_type === 'deletion' || line.line_type === '-';
            const bgColor = isAdd
              ? 'rgba(var(--xp-green-rgb, 74, 222, 128), 0.12)'
              : isDel
                ? 'rgba(var(--xp-red-rgb, 248, 113, 113), 0.12)'
                : 'transparent';
            const prefix = isAdd ? '+' : isDel ? '-' : ' ';
            const lineColor = isAdd
              ? 'var(--xp-green)'
              : isDel
                ? 'var(--xp-red)'
                : 'var(--xp-text)';

            return (
              <div
                key={li}
                style={{
                  ...S.fontMono, ...S.textXs, ...S.flexRow,
                  background: bgColor,
                  minHeight: '20px',
                  lineHeight: '20px',
                  whiteSpace: 'pre',
                }}
              >
                {/* Old line number */}
                <span style={{
                  width: '44px', textAlign: 'right', paddingRight: '8px',
                  color: 'var(--xp-text-muted)', opacity: 0.5,
                  userSelect: 'none', ...S.noShrink,
                  borderRight: '1px solid var(--xp-border)',
                }}>
                  {isDel ? (line.old_line_number ?? '') : isAdd ? '' : (line.old_line_number ?? '')}
                </span>
                {/* New line number */}
                <span style={{
                  width: '44px', textAlign: 'right', paddingRight: '8px',
                  color: 'var(--xp-text-muted)', opacity: 0.5,
                  userSelect: 'none', ...S.noShrink,
                  borderRight: '1px solid var(--xp-border)',
                }}>
                  {isAdd ? (line.new_line_number ?? '') : isDel ? '' : (line.new_line_number ?? '')}
                </span>
                {/* Prefix */}
                <span style={{
                  width: '20px', textAlign: 'center',
                  color: lineColor, fontWeight: 600, userSelect: 'none', ...S.noShrink,
                }}>
                  {prefix}
                </span>
                {/* Content */}
                <span style={{ color: lineColor, paddingRight: '12px' }}>
                  {line.content}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ── Changes Tab ──────────────────────────────────────────────────────

const ChangesTab = ({ api, repoPath, branch }: { api: XplorerAPI; repoPath: string; branch: string }) => {
  const [files, setFiles] = useState<FileStatusEntry[]>([]);
  const [staged, setStaged] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<GitDiff | null>(null);
  const [commitMsg, setCommitMsg] = useState('');
  const [commitDesc, setCommitDesc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const statusList = await gitCall(api, 'get_file_status', { repo_path: repoPath }) as FileStatusEntry[];
      setFiles(statusList);
      // Determine which are already staged from repo info
      try {
        const info = await gitCall(api, 'get_repository_info', { repo_path: repoPath }) as GitRepositoryInfo;
        const stagedSet = new Set(info.staged_files ?? []);
        setStaged(stagedSet);
      } catch {
        // ignore — staged info is best-effort
      }
    } catch (err: unknown) {
      console.error('Failed to load file status:', err);
    } finally {
      setIsLoading(false);
    }
  }, [api, repoPath]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const loadDiff = useCallback(async (filePath: string) => {
    setIsDiffLoading(true);
    try {
      const d = await gitCall(api, 'get_file_diff', { repo_path: repoPath, file_path: filePath }) as GitDiff;
      setDiff(d);
    } catch (err: unknown) {
      console.error('Failed to load diff:', err);
      setDiff(null);
    } finally {
      setIsDiffLoading(false);
    }
  }, [api, repoPath]);

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFile(path);
    loadDiff(path);
  }, [loadDiff]);

  const handleToggleStage = useCallback(async (path: string) => {
    const isStaged = staged.has(path);
    try {
      if (isStaged) {
        await gitCall(api, 'unstage_file', { repo_path: repoPath, file_path: path });
        setStaged((prev) => { const next = new Set(prev); next.delete(path); return next; });
      } else {
        await gitCall(api, 'stage_file', { repo_path: repoPath, file_path: path });
        setStaged((prev) => new Set(prev).add(path));
      }
    } catch (err: unknown) {
      console.error('Stage/unstage failed:', err);
    }
  }, [api, repoPath, staged]);

  const handleStageAll = useCallback(async () => {
    try {
      for (const f of files) {
        if (!staged.has(f.path)) {
          await gitCall(api, 'stage_file', { repo_path: repoPath, file_path: f.path });
        }
      }
      setStaged(new Set(files.map((f) => f.path)));
    } catch (err: unknown) {
      console.error('Stage all failed:', err);
    }
  }, [api, repoPath, files, staged]);

  const handleUnstageAll = useCallback(async () => {
    try {
      for (const path of staged) {
        await gitCall(api, 'unstage_file', { repo_path: repoPath, file_path: path });
      }
      setStaged(new Set());
    } catch (err: unknown) {
      console.error('Unstage all failed:', err);
    }
  }, [api, repoPath, staged]);

  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim()) return;
    const msg = commitDesc.trim() ? `${commitMsg.trim()}\n\n${commitDesc.trim()}` : commitMsg.trim();
    setIsCommitting(true);
    try {
      // Stage all checked files that aren't staged yet
      for (const f of files) {
        if (staged.has(f.path)) {
          try {
            await gitCall(api, 'stage_file', { repo_path: repoPath, file_path: f.path });
          } catch { /* might already be staged */ }
        }
      }
      await gitCall(api, 'commit_changes', { repo_path: repoPath, message: msg, amend: false });
      setCommitMsg('');
      setCommitDesc('');
      setDiff(null);
      setSelectedFile(null);
      await loadFiles();
      api.ui.showMessage('Commit created successfully', 'info');
    } catch (err: unknown) {
      api.ui.showMessage(`Commit failed: ${err}`, 'error');
    } finally {
      setIsCommitting(false);
    }
  }, [api, repoPath, commitMsg, commitDesc, files, staged, loadFiles]);

  const stagedFiles = useMemo(() => files.filter((f) => staged.has(f.path)), [files, staged]);
  const unstagedFiles = useMemo(() => files.filter((f) => !staged.has(f.path)), [files, staged]);

  // ── File list item ──
  const FileItem = ({ file, isStaged }: { file: FileStatusEntry; isStaged: boolean }) => (
    <div
      onClick={() => handleSelectFile(file.path)}
      style={{
        ...S.flexRow, ...S.px2, ...S.py1, ...S.pointer, ...S.gap2,
        background: selectedFile === file.path ? 'rgba(var(--xp-blue-rgb, 59, 130, 246), 0.15)' : 'transparent',
        borderLeft: selectedFile === file.path ? '2px solid var(--xp-blue)' : '2px solid transparent',
        minHeight: '28px',
      }}
    >
      {/* Checkbox */}
      <div
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleToggleStage(file.path); }}
        style={{
          ...S.flexCenter, ...S.pointer, ...S.noShrink,
          width: '16px', height: '16px', ...S.roundedSm,
          border: `1px solid ${isStaged ? 'var(--xp-blue)' : 'var(--xp-border)'}`,
          background: isStaged ? 'var(--xp-blue)' : 'transparent',
        }}
      >
        {isStaged && <Icon d={Icons.check} size={10} />}
      </div>
      {/* File info */}
      <div style={{ ...S.flex1, ...S.truncate }}>
        <span style={{ ...S.text12, ...S.text }}>{basename(file.path)}</span>
        <span style={{ ...S.textXs, ...S.textMuted, marginLeft: '6px' }}>{dirname(file.path)}</span>
      </div>
      {/* Status badge */}
      <span style={{
        ...S.textXs, ...S.noShrink, fontWeight: 600,
        color: statusColor(file.status),
        padding: '0 4px',
      }}>
        {statusLabel(file.status)}
      </span>
    </div>
  );

  return (
    <div style={{ ...S.flexRow, ...S.h100, ...S.w100 }}>
      {/* Left: file list + commit area */}
      <div style={{
        ...S.flexCol, width: '300px', ...S.noShrink, ...S.borderR,
        ...S.h100, ...S.bg,
      }}>
        {/* File list */}
        <div className="xpgit-scroll" style={{ ...S.flex1, overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ ...S.flexCenter, ...S.p3 }}>
              <SpinnerIcon size={14} />
              <span style={{ ...S.textXs, ...S.textMuted, marginLeft: '6px' }}>Loading changes...</span>
            </div>
          ) : files.length === 0 ? (
            <div style={{ ...S.flexCenter, ...S.p3, ...S.textMuted, ...S.text12 }}>
              No changes
            </div>
          ) : (
            <>
              {/* Staged section */}
              {stagedFiles.length > 0 && (
                <div>
                  <div style={{
                    ...S.flexRow, justifyContent: 'space-between',
                    ...S.px2, ...S.py1, ...S.surface, ...S.borderB,
                  }}>
                    <span style={{ ...S.textXs, fontWeight: 600, ...S.textMuted }}>
                      Staged ({stagedFiles.length})
                    </span>
                    <button
                      onClick={handleUnstageAll}
                      style={{
                        ...S.textXs, ...S.pointer,
                        border: 'none', background: 'transparent',
                        color: 'var(--xp-text-muted)',
                        textDecoration: 'underline',
                      }}
                    >
                      Unstage all
                    </button>
                  </div>
                  {stagedFiles.map((f) => <FileItem key={`s-${f.path}`} file={f} isStaged={true} />)}
                </div>
              )}
              {/* Unstaged section */}
              {unstagedFiles.length > 0 && (
                <div>
                  <div style={{
                    ...S.flexRow, justifyContent: 'space-between',
                    ...S.px2, ...S.py1, ...S.surface, ...S.borderB,
                    borderTop: stagedFiles.length > 0 ? '1px solid var(--xp-border)' : 'none',
                  }}>
                    <span style={{ ...S.textXs, fontWeight: 600, ...S.textMuted }}>
                      Changed ({unstagedFiles.length})
                    </span>
                    <button
                      onClick={handleStageAll}
                      style={{
                        ...S.textXs, ...S.pointer,
                        border: 'none', background: 'transparent',
                        color: 'var(--xp-text-muted)',
                        textDecoration: 'underline',
                      }}
                    >
                      Stage all
                    </button>
                  </div>
                  {unstagedFiles.map((f) => <FileItem key={`u-${f.path}`} file={f} isStaged={false} />)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Commit area */}
        <div style={{
          ...S.noShrink, ...S.borderB, ...S.p2, ...S.flexCol, ...S.gap1,
          borderTop: '1px solid var(--xp-border)',
          background: 'var(--xp-surface)',
        }}>
          {/* Summary input */}
          <input
            type="text"
            value={commitMsg}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCommitMsg(e.target.value)}
            placeholder="Summary (required)"
            style={{
              ...S.w100, ...S.text12, ...S.rounded, ...S.px2, ...S.py1,
              ...S.bg, ...S.text, ...S.borderAll,
              outline: 'none', height: '28px',
            }}
          />
          {/* Description textarea */}
          <textarea
            ref={textareaRef}
            value={commitDesc}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCommitDesc(e.target.value)}
            placeholder="Description"
            rows={2}
            style={{
              ...S.w100, ...S.text12, ...S.rounded, ...S.px2, ...S.py1,
              ...S.bg, ...S.text, ...S.borderAll,
              outline: 'none', resize: 'vertical', minHeight: '40px',
              fontFamily: 'inherit',
            }}
          />
          {/* Commit button */}
          <button
            onClick={handleCommit}
            disabled={!commitMsg.trim() || staged.size === 0 || isCommitting}
            style={{
              ...S.w100, ...S.text12, ...S.rounded, ...S.flexCenter, ...S.gap1,
              padding: '6px 12px',
              border: 'none',
              fontWeight: 600,
              cursor: (!commitMsg.trim() || staged.size === 0 || isCommitting) ? 'default' : 'pointer',
              background: (!commitMsg.trim() || staged.size === 0) ? 'var(--xp-surface-light)' : 'var(--xp-blue)',
              color: (!commitMsg.trim() || staged.size === 0) ? 'var(--xp-text-muted)' : '#ffffff',
              opacity: isCommitting ? 0.6 : 1,
              height: '30px',
            }}
          >
            {isCommitting ? <SpinnerIcon size={12} /> : <Icon d={Icons.check} size={12} />}
            <span>Commit to {branch}</span>
          </button>
        </div>
      </div>

      {/* Right: diff view */}
      <div style={{ ...S.flex1, ...S.flexCol, ...S.h100, ...S.bg }}>
        {isDiffLoading ? (
          <div style={{ ...S.flexCenter, ...S.h100 }}>
            <SpinnerIcon size={16} />
            <span style={{ ...S.textXs, ...S.textMuted, marginLeft: '8px' }}>Loading diff...</span>
          </div>
        ) : (
          <DiffViewer diff={diff} />
        )}
      </div>
    </div>
  );
};

// ── History Tab ──────────────────────────────────────────────────────

// ── GitLens-style helpers ────────────────────────────────────────────

const getDateLabel = (timestamp: number): string => {
  const d = new Date(timestamp * 1000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const commitDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - commitDay.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const avatarColors = [
  '#e06c75', '#98c379', '#e5c07b', '#61afef', '#c678dd',
  '#56b6c2', '#d19a66', '#be5046', '#7ec699', '#f08d49',
];

const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

type GroupedCommits = Array<{ label: string; commits: GitCommit[] }>;

const groupByDate = (commits: GitCommit[]): GroupedCommits => {
  const groups: Map<string, GitCommit[]> = new Map();
  for (const c of commits) {
    const label = getDateLabel(c.timestamp);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(c);
  }
  return Array.from(groups.entries()).map(([label, grp]) => ({ label, commits: grp }));
};

// ── HistoryTab (GitLens style) ──────────────────────────────────────

const HistoryTab = ({ api, repoPath, branch }: { api: XplorerAPI; repoPath: string; branch: string }) => {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [commitDiffs, setCommitDiffs] = useState<GitDiff[]>([]);
  const [selectedDiffFile, setSelectedDiffFile] = useState<GitDiff | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);

  const loadCommits = useCallback(async () => {
    setIsLoading(true);
    try {
      const allCommits = await gitCall(api, 'get_all_commits', {
        repo_path: repoPath, limit: 200, branch: branch === 'All Branches' ? undefined : branch,
      }) as GitCommit[];
      setCommits(allCommits);
    } catch (err: unknown) {
      console.error('Failed to load commits:', err);
    } finally {
      setIsLoading(false);
    }
  }, [api, repoPath, branch]);

  useEffect(() => { loadCommits(); }, [loadCommits]);

  const handleSelectCommit = useCallback(async (commit: GitCommit) => {
    setSelectedCommit(commit);
    setSelectedDiffFile(null);
    setExpandedCommit((prev) => prev === commit.hash ? null : commit.hash);
    setIsLoadingDiff(true);
    try {
      const diffs = await gitCall(api, 'get_commit_diff', {
        repo_path: repoPath, commit_hash: commit.hash,
      }) as GitDiff[];
      setCommitDiffs(diffs);
      if (diffs.length > 0) setSelectedDiffFile(diffs[0]);
    } catch (err: unknown) {
      console.error('Failed to load commit diff:', err);
      setCommitDiffs([]);
    } finally {
      setIsLoadingDiff(false);
    }
  }, [api, repoPath]);

  const filteredCommits = useMemo(() => {
    if (!searchQuery) return commits;
    const q = searchQuery.toLowerCase();
    return commits.filter((c) =>
      c.summary.toLowerCase().includes(q) ||
      c.author_name.toLowerCase().includes(q) ||
      c.short_hash.toLowerCase().includes(q)
    );
  }, [commits, searchQuery]);

  const grouped = useMemo(() => groupByDate(filteredCommits), [filteredCommits]);

  return (
    <div style={{ ...S.flexRow, ...S.h100, ...S.w100 }}>
      {/* Left: GitLens-style commit graph */}
      <div style={{
        ...S.flexCol, width: '420px', ...S.noShrink, ...S.borderR, ...S.h100, ...S.bg,
      }}>
        {/* Search */}
        <div style={{ ...S.px2, ...S.py1, ...S.borderB, ...S.surface, ...S.flexRow, ...S.gap1 }}>
          <Icon d={Icons.search} size={12} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="Search commits..."
            style={{
              ...S.w100, ...S.text12, ...S.rounded, ...S.px2, ...S.py1,
              ...S.bg, ...S.text, border: 'none', outline: 'none', height: '24px',
              background: 'transparent',
            }}
          />
        </div>

        {/* Commit list with graph */}
        <div className="xpgit-scroll" style={{ ...S.flex1, overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ ...S.flexCenter, ...S.p3 }}>
              <SpinnerIcon size={14} />
              <span style={{ ...S.textXs, ...S.textMuted, marginLeft: '6px' }}>Loading history...</span>
            </div>
          ) : grouped.length === 0 ? (
            <div style={{ ...S.flexCenter, ...S.p3, ...S.textMuted, ...S.text12 }}>
              {searchQuery ? 'No matches found' : 'No commits'}
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.label}>
                {/* Date group header */}
                <div style={{
                  ...S.px3, ...S.py1, ...S.surface,
                  fontSize: '11px', fontWeight: 600, letterSpacing: '0.3px',
                  color: 'var(--xp-text-muted)',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--xp-border)',
                  position: 'sticky', top: 0, zIndex: 1,
                }}>
                  {group.label}
                  <span style={{ marginLeft: '6px', fontWeight: 400, opacity: 0.6 }}>
                    ({group.commits.length})
                  </span>
                </div>

                {group.commits.map((commit, idx) => {
                  const isSelected = selectedCommit?.hash === commit.hash;
                  const isExpanded = expandedCommit === commit.hash;
                  const isLast = idx === group.commits.length - 1;
                  const avatarBg = getAvatarColor(commit.author_name);

                  return (
                    <div key={commit.hash}>
                      {/* Commit row */}
                      <div
                        onClick={() => handleSelectCommit(commit)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '0',
                          cursor: 'pointer', position: 'relative',
                          background: isSelected
                            ? 'rgba(var(--xp-blue-rgb, 59, 130, 246), 0.1)'
                            : 'transparent',
                        }}
                      >
                        {/* Graph line + dot */}
                        <div style={{
                          width: '32px', flexShrink: 0,
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          position: 'relative', alignSelf: 'stretch',
                        }}>
                          {/* Top line */}
                          <div style={{
                            width: '2px', height: '12px', flexShrink: 0,
                            background: idx === 0 ? 'transparent' : 'var(--xp-border)',
                          }} />
                          {/* Dot */}
                          <div style={{
                            width: isSelected ? '10px' : '8px',
                            height: isSelected ? '10px' : '8px',
                            borderRadius: '50%', flexShrink: 0,
                            background: isSelected ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
                            border: isSelected ? '2px solid var(--xp-blue)' : 'none',
                            boxShadow: isSelected ? '0 0 6px rgba(59, 130, 246, 0.5)' : 'none',
                          }} />
                          {/* Bottom line */}
                          <div style={{
                            width: '2px', flex: 1,
                            background: isLast && !isExpanded ? 'transparent' : 'var(--xp-border)',
                          }} />
                        </div>

                        {/* Avatar */}
                        <div style={{
                          width: '26px', height: '26px', borderRadius: '50%',
                          background: avatarBg, flexShrink: 0, marginTop: '6px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 700, color: '#fff',
                          letterSpacing: '-0.5px',
                        }}>
                          {getInitials(commit.author_name)}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0, padding: '6px 10px 8px 8px' }}>
                          <div style={{
                            ...S.text12, ...S.text, fontWeight: 500,
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            display: '-webkit-box', WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: '16px',
                          }}>
                            {commit.summary}
                          </div>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            marginTop: '3px', flexWrap: 'wrap',
                          }}>
                            <span style={{ ...S.textXs, color: avatarBg, fontWeight: 500 }}>
                              {commit.author_name}
                            </span>
                            <span style={{ ...S.textXs, ...S.textMuted }}>
                              {formatRelativeTime(commit.timestamp)}
                            </span>
                            <span style={{
                              ...S.fontMono, fontSize: '10px', ...S.textMuted,
                              background: 'var(--xp-surface)', padding: '1px 5px',
                              borderRadius: '3px',
                            }}>
                              {commit.short_hash}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Inline file list (expanded) */}
                      {isExpanded && isSelected && (
                        <div style={{ marginLeft: '32px', borderLeft: isLast ? 'none' : '2px solid var(--xp-border)' }}>
                          {isLoadingDiff ? (
                            <div style={{ ...S.flexRow, ...S.gap1, padding: '4px 12px' }}>
                              <SpinnerIcon size={10} />
                              <span style={{ ...S.textXs, ...S.textMuted }}>Loading...</span>
                            </div>
                          ) : commitDiffs.map((d) => (
                            <div
                              key={d.file_path}
                              onClick={(e) => { e.stopPropagation(); setSelectedDiffFile(d); }}
                              style={{
                                ...S.flexRow, gap: '6px', padding: '2px 12px',
                                cursor: 'pointer', fontSize: '11px',
                                background: selectedDiffFile?.file_path === d.file_path
                                  ? 'rgba(var(--xp-blue-rgb, 59, 130, 246), 0.08)'
                                  : 'transparent',
                              }}
                            >
                              <Icon d={Icons.file} size={10} />
                              <span style={{
                                ...S.flex1, ...S.truncate, color: 'var(--xp-text)',
                              }}>
                                {d.file_path.split('/').pop()}
                              </span>
                              <span style={{ ...S.textMuted, fontSize: '10px', ...S.noShrink }}>
                                {d.file_path.includes('/') ? d.file_path.split('/').slice(0, -1).join('/') : ''}
                              </span>
                              <span style={{ ...S.noShrink, fontSize: '10px' }}>
                                <span style={{ color: 'var(--xp-green)' }}>+{d.lines_added}</span>
                                <span style={{ color: 'var(--xp-red)', marginLeft: '3px' }}>-{d.lines_deleted}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: diff viewer */}
      <div style={{ ...S.flex1, ...S.flexCol, ...S.h100, ...S.bg }}>
        {selectedCommit ? (
          <>
            {/* Commit detail header */}
            <div style={{
              ...S.noShrink, ...S.px3, ...S.py2, ...S.surface, ...S.borderB,
              display: 'flex', gap: '10px', alignItems: 'flex-start',
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: getAvatarColor(selectedCommit.author_name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {getInitials(selectedCommit.author_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...S.textSm, ...S.text, fontWeight: 600 }}>
                  {selectedCommit.summary}
                </div>
                {selectedCommit.body && (
                  <div style={{ ...S.text12, ...S.textMuted, marginTop: '3px', whiteSpace: 'pre-wrap' }}>
                    {selectedCommit.body}
                  </div>
                )}
                <div style={{ ...S.flexRow, ...S.gap3, marginTop: '4px', ...S.textXs, ...S.textMuted }}>
                  <span style={{ fontWeight: 500, color: getAvatarColor(selectedCommit.author_name) }}>
                    {selectedCommit.author_name}
                  </span>
                  <span>{formatRelativeTime(selectedCommit.timestamp)}</span>
                  <span style={{ ...S.fontMono }}>{selectedCommit.hash.slice(0, 10)}</span>
                </div>
              </div>
            </div>

            {/* Diff view */}
            <div style={{ ...S.flex1, ...S.flexCol, ...S.overflowHidden }}>
              {isLoadingDiff ? (
                <div style={{ ...S.flexCenter, ...S.h100 }}>
                  <SpinnerIcon size={16} />
                  <span style={{ ...S.textXs, ...S.textMuted, marginLeft: '8px' }}>Loading diff...</span>
                </div>
              ) : (
                <DiffViewer diff={selectedDiffFile} />
              )}
            </div>
          </>
        ) : (
          <div style={{ ...S.flexCenter, ...S.h100, ...S.textMuted, ...S.text12, ...S.flexCol, gap: '8px' }}>
            <Icon d={Icons.clock} size={24} />
            <span>Select a commit to view details</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Branch dropdown ──────────────────────────────────────────────────

const BranchDropdown = ({
  branches,
  currentBranch,
  onSwitch,
}: {
  branches: GitBranchInfo[];
  currentBranch: string;
  onSwitch: (name: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const localBranches = branches.filter((b) => !b.is_remote);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          ...S.flexRow, ...S.gap1, ...S.text12, ...S.roundedSm, ...S.pointer,
          padding: '3px 10px',
          border: '1px solid var(--xp-border)',
          background: 'var(--xp-surface)',
          color: 'var(--xp-text)',
          fontWeight: 600,
          height: '26px',
          minWidth: '100px',
        }}
      >
        <Icon d={Icons.branch} size={12} />
        <span style={{ ...S.truncate, maxWidth: '140px' }}>{currentBranch}</span>
        <Icon d={Icons.chevronDown} size={10} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '30px', left: 0, zIndex: 100,
          minWidth: '200px', maxHeight: '240px', overflowY: 'auto',
          background: 'var(--xp-surface)',
          border: '1px solid var(--xp-border)',
          borderRadius: '6px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }} className="xpgit-scroll">
          {localBranches.map((b) => (
            <div
              key={b.name}
              onClick={() => { onSwitch(b.name); setOpen(false); }}
              style={{
                ...S.flexRow, ...S.px3, ...S.py1, ...S.pointer, ...S.gap2,
                ...S.text12,
                background: b.name === currentBranch ? 'rgba(var(--xp-blue-rgb, 59, 130, 246), 0.15)' : 'transparent',
                color: b.name === currentBranch ? 'var(--xp-blue)' : 'var(--xp-text)',
                minHeight: '30px',
              }}
            >
              {b.is_current && <Icon d={Icons.check} size={12} />}
              {!b.is_current && <span style={{ width: '12px' }} />}
              <span style={S.truncate}>{b.name}</span>
              {b.ahead > 0 && <span style={{ ...S.textXs, color: 'var(--xp-green)' }}>{'\u2191'}{b.ahead}</span>}
              {b.behind > 0 && <span style={{ ...S.textXs, color: 'var(--xp-red)' }}>{'\u2193'}{b.behind}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── No Repo placeholder ──────────────────────────────────────────────

const NoRepo = () => (
  <div style={{ ...S.flexCenter, ...S.h100, ...S.textMuted }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: '12px', opacity: 0.4 }}>
        <Icon d={Icons.branch} size={48} />
      </div>
      <div style={S.textSm}>No Git repository found</div>
      <div style={{ ...S.textXs, marginTop: '4px', opacity: 0.75 }}>
        Navigate to a Git repository to see changes
      </div>
    </div>
  </div>
);

// ── Main Panel ───────────────────────────────────────────────────────

type MainTab = 'changes' | 'history';

const GitPanel = ({ api, currentPath }: { api: XplorerAPI; currentPath?: string }) => {
  const [tab, setTab] = useState<MainTab>('changes');
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [currentBranch, setCurrentBranch] = useState('main');
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [branchAhead, setBranchAhead] = useState(0);
  const [branchBehind, setBranchBehind] = useState(0);
  const changesKeyRef = useRef(0);

  injectStyles();

  // Discover repo + load branches
  useEffect(() => {
    if (!currentPath) return;
    let cancelled = false;
    (async () => {
      try {
        const found = await gitCall(api, 'find_repository', { path: currentPath }) as string | null;
        if (cancelled) return;
        if (found) {
          setRepoPath(found);
          try {
            const branchList = await gitCall(api, 'get_branches', { repo_path: found }) as GitBranchInfo[];
            if (cancelled) return;
            setBranches(branchList);
            const current = branchList.find((b: GitBranchInfo) => b.is_current);
            if (current) {
              setCurrentBranch(current.name);
              setBranchAhead(current.ahead);
              setBranchBehind(current.behind);
            }
          } catch {
            // ignore branch load failure
          }
        } else {
          setRepoPath(null);
        }
      } catch {
        setRepoPath(null);
      }
    })();
    return () => { cancelled = true; };
  }, [currentPath, api]);

  const handleSwitchBranch = useCallback(async (name: string) => {
    if (!repoPath) return;
    try {
      await gitCall(api, 'switch_branch', { repo_path: repoPath, branch: name });
      setCurrentBranch(name);
      // Notify status bar to refresh
      window.dispatchEvent(new CustomEvent('git-branch-changed', { detail: { branch: name } }));
      // Refresh branch info
      const branchList = await gitCall(api, 'get_branches', { repo_path: repoPath }) as GitBranchInfo[];
      setBranches(branchList);
      const current = branchList.find((b: GitBranchInfo) => b.is_current);
      if (current) {
        setBranchAhead(current.ahead);
        setBranchBehind(current.behind);
      }
      // Force-refresh changes tab
      changesKeyRef.current += 1;
    } catch (err: unknown) {
      api.ui.showMessage(`Switch branch failed: ${err}`, 'error');
    }
  }, [api, repoPath]);

  const handleFetch = useCallback(async () => {
    if (!repoPath) return;
    setIsFetching(true);
    try {
      await gitCall(api, 'fetch', { repo_path: repoPath });
      // Refresh branch info after fetch
      const branchList = await gitCall(api, 'get_branches', { repo_path: repoPath }) as GitBranchInfo[];
      setBranches(branchList);
      const current = branchList.find((b: GitBranchInfo) => b.is_current);
      if (current) {
        setBranchAhead(current.ahead);
        setBranchBehind(current.behind);
      }
      api.ui.showMessage('Fetch complete', 'info');
    } catch (err: unknown) {
      api.ui.showMessage(`Fetch failed: ${err}`, 'error');
    } finally {
      setIsFetching(false);
    }
  }, [api, repoPath]);

  const handlePush = useCallback(async () => {
    if (!repoPath) return;
    setIsPushing(true);
    try {
      await gitCall(api, 'push', { repo_path: repoPath, force: false });
      // Refresh branch info after push
      const branchList = await gitCall(api, 'get_branches', { repo_path: repoPath }) as GitBranchInfo[];
      setBranches(branchList);
      const current = branchList.find((b: GitBranchInfo) => b.is_current);
      if (current) {
        setBranchAhead(current.ahead);
        setBranchBehind(current.behind);
      }
      api.ui.showMessage('Push complete', 'info');
    } catch (err: unknown) {
      api.ui.showMessage(`Push failed: ${err}`, 'error');
    } finally {
      setIsPushing(false);
    }
  }, [api, repoPath]);

  if (!repoPath) return <NoRepo />;

  const tabStyle = (t: MainTab): React.CSSProperties => ({
    ...S.text12, ...S.pointer, ...S.px3,
    padding: '5px 14px',
    border: 'none',
    fontWeight: tab === t ? 600 : 400,
    background: tab === t ? 'var(--xp-bg)' : 'transparent',
    color: tab === t ? 'var(--xp-text)' : 'var(--xp-text-muted)',
    borderBottom: tab === t ? '2px solid var(--xp-blue)' : '2px solid transparent',
  });

  return (
    <div style={{ ...S.flexCol, ...S.h100, ...S.w100, ...S.text }}>
      {/* ── Top toolbar ── */}
      <div style={{
        ...S.flexRow, ...S.noShrink, ...S.px3,
        justifyContent: 'space-between',
        height: '38px',
        background: 'var(--xp-surface)',
        borderBottom: '1px solid var(--xp-border)',
      }}>
        {/* Left: branch + fetch/push */}
        <div style={{ ...S.flexRow, ...S.gap2 }}>
          <BranchDropdown
            branches={branches}
            currentBranch={currentBranch}
            onSwitch={handleSwitchBranch}
          />
          <ToolbarBtn onClick={handleFetch} disabled={isFetching} title="Fetch origin">
            {isFetching ? <SpinnerIcon size={11} /> : <Icon d={Icons.download} size={11} />}
            <span>Fetch</span>
            {branchBehind > 0 && (
              <span style={{
                ...S.textXs, fontWeight: 700,
                background: 'var(--xp-blue)', color: '#fff',
                borderRadius: '8px', padding: '0 5px', minWidth: '16px',
                textAlign: 'center', lineHeight: '16px',
              }}>
                {branchBehind}
              </span>
            )}
          </ToolbarBtn>
          <ToolbarBtn onClick={handlePush} disabled={isPushing} title="Push to origin">
            {isPushing ? <SpinnerIcon size={11} /> : <Icon d={Icons.upload} size={11} />}
            <span>Push</span>
            {branchAhead > 0 && (
              <span style={{
                ...S.textXs, fontWeight: 700,
                background: 'var(--xp-green)', color: '#fff',
                borderRadius: '8px', padding: '0 5px', minWidth: '16px',
                textAlign: 'center', lineHeight: '16px',
              }}>
                {branchAhead}
              </span>
            )}
          </ToolbarBtn>
        </div>
        {/* Right: tab switches */}
        <div style={{ ...S.flexRow }}>
          <button onClick={() => setTab('changes')} style={tabStyle('changes')}>
            Changes
          </button>
          <button onClick={() => setTab('history')} style={tabStyle('history')}>
            <span style={S.flexRow}>
              <Icon d={Icons.clock} size={11} />
              <span style={{ marginLeft: '4px' }}>History</span>
            </span>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ ...S.flex1, ...S.overflowHidden }}>
        {tab === 'changes' && (
          <ChangesTab key={changesKeyRef.current} api={api} repoPath={repoPath} branch={currentBranch} />
        )}
        {tab === 'history' && (
          <HistoryTab api={api} repoPath={repoPath} branch={currentBranch} />
        )}
      </div>
    </div>
  );
};

// ── Registration ─────────────────────────────────────────────────────

let gitApi: XplorerAPI;

BottomTab.register({
  id: 'git',
  title: 'GIT',
  icon: 'git-branch',
  permissions: ['git:read', 'git:write'],
  render: (props) => <GitPanel api={gitApi} currentPath={props.currentPath} />,
  onActivate: (api) => { gitApi = api; },
});

Command.register({
  id: 'git-open-changes',
  title: 'Git: Show Changes',
  action: (_api) => {
    window.dispatchEvent(new CustomEvent('xplorer-set-bottom-tab', { detail: { tab: 'git' } }));
  },
});

Command.register({
  id: 'git-open-history',
  title: 'Git: Show History',
  action: (_api) => {
    window.dispatchEvent(new CustomEvent('xplorer-set-bottom-tab', { detail: { tab: 'git' } }));
  },
});
