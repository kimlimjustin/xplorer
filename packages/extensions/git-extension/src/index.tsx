/**
 * Git Extension for Xplorer
 *
 * Provides commit graph, file history, blame, and branch management
 * as a bottom panel tab. Ported from core GitLensPanel, GitHistoryPanel,
 * and BranchManager components.
 */
import {
  BottomTab,
  Command,
  type XplorerAPI,
} from '@xplorer/extension-sdk';

const React = (window as any).React;
const { useState, useEffect, useCallback, useRef } = React;

// ── Interfaces ──────────────────────────────────────────────────────

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

interface GitFileHistory {
  file_path: string;
  commits: GitCommit[];
  total_commits: number;
  first_commit?: GitCommit;
  last_commit?: GitCommit;
  total_lines_added: number;
  total_lines_deleted: number;
}

interface GitBlameLine {
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

interface GitFileBlame {
  file_path: string;
  lines: GitBlameLine[];
  unique_authors: string[];
  total_lines: number;
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

// ── Utilities ───────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

// ── SVG Icons ───────────────────────────────────────────────────────

function GitBranchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="0 0 16 16">
      <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z"/>
    </svg>
  );
}

function GitHubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  );
}

function RefreshIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="0 0 16 16">
      <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
      <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
    </svg>
  );
}

function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="0 0 16 16">
      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
    </svg>
  );
}

function SidebarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="0 0 16 16">
      <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4.414a1 1 0 0 0-.707.293L.854 15.146A.5.5 0 0 1 0 14.793V2z"/>
    </svg>
  );
}

function FileIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="0 0 16 16">
      <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H4zm0 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/>
    </svg>
  );
}

function SpinnerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
    </svg>
  );
}

function PersonIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z"/>
    </svg>
  );
}

// ── Shared Styles ───────────────────────────────────────────────────

const S = {
  bg: { background: 'var(--xp-bg)' },
  surface: { background: 'var(--xp-surface)' },
  surfaceLight: { background: 'var(--xp-surface-light)' },
  text: { color: 'var(--xp-text)' },
  textMuted: { color: 'var(--xp-text-muted)' },
  blue: { color: 'var(--xp-blue)' },
  green: { color: 'var(--xp-green)' },
  red: { color: 'var(--xp-red)' },
  orange: { color: 'var(--xp-orange)' },
  border: { borderColor: 'var(--xp-border)' },
  borderB: { borderBottom: '1px solid var(--xp-border)' },
  borderR: { borderRight: '1px solid var(--xp-border)' },
  borderT: { borderTop: '1px solid var(--xp-border)' },
  borderAll: { border: '1px solid var(--xp-border)' },
  rounded: { borderRadius: '4px' },
  roundedSm: { borderRadius: '2px' },
  fontMono: { fontFamily: 'monospace' },
  textXs: { fontSize: '11px' },
  textSm: { fontSize: '13px' },
  truncate: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  flexCenter: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  flexRow: { display: 'flex', alignItems: 'center' },
  flexCol: { display: 'flex', flexDirection: 'column' as const },
  flex1: { flex: 1, minWidth: 0 },
  gap1: { gap: '4px' },
  gap2: { gap: '8px' },
  gap3: { gap: '12px' },
  p2: { padding: '8px' },
  p3: { padding: '12px' },
  px2: { paddingLeft: '8px', paddingRight: '8px' },
  px3: { paddingLeft: '12px', paddingRight: '12px' },
  py1: { paddingTop: '4px', paddingBottom: '4px' },
  py2: { paddingTop: '8px', paddingBottom: '8px' },
  mb2: { marginBottom: '8px' },
  ml2: { marginLeft: '8px' },
  mt1: { marginTop: '4px' },
  mt2: { marginTop: '8px' },
  w100: { width: '100%' },
  h100: { height: '100%' },
  overflowAuto: { overflow: 'auto' },
  overflowHidden: { overflow: 'hidden' },
  pointer: { cursor: 'pointer' },
  noShrink: { flexShrink: 0 },
};

function btn(active = false): React.CSSProperties {
  return {
    ...S.px2, ...S.py1, ...S.textXs, ...S.roundedSm, ...S.pointer,
    fontWeight: 500,
    border: 'none',
    background: active ? 'rgba(var(--xp-blue-rgb, 59, 130, 246), 0.25)' : 'transparent',
    color: active ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
  };
}

function iconBtn(): React.CSSProperties {
  return {
    padding: '4px', borderRadius: '4px', border: 'none', background: 'transparent',
    color: 'var(--xp-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center',
  };
}

// ── NoRepo placeholder ──────────────────────────────────────────────

function NoRepo() {
  return (
    <div style={{ ...S.flexCenter, ...S.h100, ...S.textMuted }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '12px', opacity: 0.5 }}><GitHubIcon size={48} /></div>
        <div style={{ ...S.textSm }}>No Git repository found</div>
        <div style={{ ...S.textXs, ...S.mt1, opacity: 0.75 }}>Navigate to a Git repository to see commit history</div>
      </div>
    </div>
  );
}

// ── CommitGraph (from GitLensPanel) ─────────────────────────────────

function CommitGraph({ api, currentPath }: { api: XplorerAPI; currentPath: string }) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  const loadCommits = useCallback(async (repo: string, branch?: string) => {
    setIsLoading(true);
    try {
      const allCommits = await api.git.getAllCommits(repo, 100, branch === 'All Branches' ? undefined : branch);
      setCommits(allCommits as GitCommit[]);
    } catch (error: any) {
      api.ui.showMessage(`Failed to load commits: ${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  const loadBranches = useCallback(async (repo: string) => {
    try {
      const branchList = await api.git.getBranches(repo) as GitBranchInfo[];
      setBranches(branchList);
      const current = branchList.find((b: GitBranchInfo) => b.is_current);
      if (current) setSelectedBranch(current.name);
    } catch (error: any) {
      console.error('Failed to load branches:', error);
    }
  }, [api]);

  useEffect(() => {
    if (!currentPath) return;
    (async () => {
      try {
        const foundRepo = await api.git.findRepository(currentPath);
        if (foundRepo) {
          setRepoPath(foundRepo);
          loadCommits(foundRepo);
          loadBranches(foundRepo);
        } else {
          setRepoPath(null);
          setCommits([]);
          setBranches([]);
        }
      } catch {
        setRepoPath(null);
        setCommits([]);
        setBranches([]);
      }
    })();
  }, [currentPath, api, loadCommits, loadBranches]);

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setSelectedBranch(name);
    if (repoPath) loadCommits(repoPath, name);
  };

  const filteredCommits = commits.filter((c: GitCommit) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.summary.toLowerCase().includes(q) || c.author_name.toLowerCase().includes(q) || c.hash.toLowerCase().includes(q) || c.short_hash.toLowerCase().includes(q);
  });

  if (!repoPath) return <NoRepo />;

  return (
    <div style={{ ...S.flexCol, ...S.w100, ...S.text, ...S.h100, background: 'var(--xp-bg)' }}>
      {/* Header */}
      <div style={{ ...S.flexRow, justifyContent: 'space-between', ...S.px3, ...S.py2, ...S.surface, ...S.borderB }}>
        <div style={{ ...S.flexRow, ...S.gap3, ...S.flex1 }}>
          <span style={{ ...S.textXs, fontWeight: 500, ...S.textMuted }}>COMMIT GRAPH</span>
          <select
            value={selectedBranch}
            onChange={handleBranchChange}
            style={{ ...S.textXs, ...S.bg, ...S.text, ...S.borderAll, ...S.roundedSm, padding: '2px 8px', height: '24px', minWidth: '120px', maxWidth: '200px' }}
          >
            <option value="All Branches">All Branches</option>
            {branches.filter((b: GitBranchInfo) => !b.is_remote).map((b: GitBranchInfo) => (
              <option key={b.name} value={b.name}>{b.name}{b.is_current ? ' (current)' : ''}</option>
            ))}
          </select>
          <div style={{ ...S.flex1, maxWidth: '400px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e: any) => setSearchQuery(e.target.value)}
              placeholder="Search commits..."
              style={{ ...S.w100, ...S.bg, ...S.text, ...S.textXs, ...S.px3, ...S.py1, ...S.rounded, ...S.borderAll, outline: 'none' }}
            />
          </div>
        </div>
        <div style={{ ...S.flexRow, ...S.gap2 }}>
          <button onClick={() => setShowSidebar(!showSidebar)} style={iconBtn()} title="Toggle commit details"><SidebarIcon /></button>
          <button onClick={() => repoPath && loadCommits(repoPath, selectedBranch)} style={iconBtn()} title="Refresh"><RefreshIcon /></button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ ...S.flexCenter, ...S.p3 }}>
          <div style={{ ...S.flexRow, ...S.gap2 }}><SpinnerIcon size={14} /><span style={{ ...S.textXs, ...S.textMuted }}>Loading commits...</span></div>
        </div>
      )}

      {/* Main */}
      {!isLoading && (
        <div style={{ ...S.flexRow, ...S.flex1, ...S.overflowHidden }}>
          {/* Commit List */}
          <div style={{ ...S.flexCol, flex: showSidebar ? '0 0 66.67%' : 1, ...S.overflowHidden, ...S.borderR }}>
            {/* Column headers */}
            <div style={{ ...S.flexRow, ...S.px3, ...S.py2, ...S.surface, ...S.borderB, ...S.textXs, fontWeight: 600, ...S.textMuted }}>
              <div style={{ width: '48px' }}>GRAPH</div>
              <div style={{ ...S.flex1 }}>COMMIT MESSAGE</div>
              <div style={{ width: '128px' }}>AUTHOR</div>
              <div style={{ width: '80px' }}>CHANGES</div>
              <div style={{ width: '128px' }}>DATE</div>
              <div style={{ width: '80px' }}>SHA</div>
            </div>
            {/* Rows */}
            <div style={{ ...S.flex1, overflowY: 'auto' }}>
              {filteredCommits.length === 0 ? (
                <div style={{ ...S.flexCenter, padding: '32px', ...S.textMuted }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={S.textSm}>No commits found</div>
                    {searchQuery && <div style={{ ...S.textXs, ...S.mt1 }}>Try a different search term</div>}
                  </div>
                </div>
              ) : filteredCommits.map((commit: GitCommit, index: number) => (
                <div
                  key={commit.hash}
                  onClick={() => setSelectedCommit(commit)}
                  style={{
                    ...S.flexRow, ...S.px3, ...S.py2, ...S.textXs, ...S.pointer,
                    borderBottom: '1px solid rgba(var(--xp-border-rgb, 55, 65, 81), 0.3)',
                    background: selectedCommit?.hash === commit.hash ? 'rgba(var(--xp-blue-rgb, 59, 130, 246), 0.15)' : 'transparent',
                  }}
                >
                  {/* Graph */}
                  <div style={{ width: '48px', ...S.flexCenter, position: 'relative' }}>
                    {index > 0 && <div style={{ position: 'absolute', bottom: '50%', width: '2px', height: '16px', background: 'var(--xp-blue)' }} />}
                    <div style={{ width: '8px', height: '8px', background: 'var(--xp-blue)', borderRadius: '50%', position: 'relative', zIndex: 1 }} />
                    {index < filteredCommits.length - 1 && <div style={{ position: 'absolute', top: '50%', width: '2px', height: '16px', background: 'var(--xp-blue)' }} />}
                  </div>
                  {/* Message */}
                  <div style={{ ...S.flex1, paddingRight: '12px' }}>
                    <div style={{ ...S.text, ...S.truncate }}>{commit.summary}</div>
                  </div>
                  {/* Author */}
                  <div style={{ width: '128px', ...S.textMuted, ...S.truncate }}>{commit.author_name}</div>
                  {/* Changes */}
                  <div style={{ width: '80px', ...S.flexRow, ...S.gap2 }}>
                    {commit.insertions > 0 && <span style={S.green}>+{commit.insertions}</span>}
                    {commit.deletions > 0 && <span style={S.red}>-{commit.deletions}</span>}
                    {commit.files_changed.length > 1 && <span style={S.textMuted}>{commit.files_changed.length}</span>}
                  </div>
                  {/* Date */}
                  <div style={{ width: '128px', ...S.textMuted }}>{formatRelativeTime(commit.timestamp)}</div>
                  {/* SHA */}
                  <div style={{ width: '80px', ...S.fontMono, ...S.textMuted }}>{commit.short_hash}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Commit Details Sidebar */}
          {showSidebar && selectedCommit && (
            <div style={{ width: '33.33%', ...S.flexCol, ...S.overflowHidden, ...S.surface }}>
              <div style={{ ...S.px3, ...S.p3, ...S.borderB }}>
                <div style={{ ...S.flexRow, justifyContent: 'space-between', ...S.mb2 }}>
                  <span style={{ ...S.textSm, fontWeight: 600, ...S.blue, textTransform: 'uppercase' }}>COMMIT DETAILS</span>
                  <button onClick={() => setSelectedCommit(null)} style={iconBtn()}><CloseIcon /></button>
                </div>
                <div style={{ ...S.textXs, ...S.text, wordBreak: 'break-word' }}>{selectedCommit.summary}</div>
              </div>
              <div style={{ ...S.flex1, overflowY: 'auto', ...S.px3, ...S.p3 }}>
                <div style={{ ...S.textXs, ...S.mb2 }}>
                  <span style={S.textMuted}>SHA:</span>
                  <span style={{ ...S.ml2, ...S.fontMono, ...S.text, ...S.bg, padding: '1px 8px', ...S.roundedSm }}>{selectedCommit.hash}</span>
                </div>
                <div style={{ ...S.textXs, ...S.mb2 }}>
                  <span style={S.textMuted}>Author:</span><span style={{ ...S.ml2, ...S.text }}>{selectedCommit.author_name}</span>
                </div>
                <div style={{ ...S.textXs, ...S.mb2 }}>
                  <span style={S.textMuted}>Email:</span><span style={{ ...S.ml2, ...S.text }}>{selectedCommit.author_email}</span>
                </div>
                <div style={{ ...S.textXs, ...S.mb2 }}>
                  <span style={S.textMuted}>Date:</span><span style={{ ...S.ml2, ...S.text }}>{formatDate(selectedCommit.timestamp)}</span>
                </div>
                {selectedCommit.body && (
                  <div style={S.mt2}>
                    <div style={{ ...S.textXs, fontWeight: 600, ...S.blue, textTransform: 'uppercase', ...S.mb2 }}>Message</div>
                    <div style={{ ...S.textXs, ...S.text, whiteSpace: 'pre-wrap', ...S.bg, ...S.p2, ...S.rounded }}>{selectedCommit.body}</div>
                  </div>
                )}
                {selectedCommit.files_changed.length > 0 && (
                  <div style={S.mt2}>
                    <div style={{ ...S.textXs, fontWeight: 600, ...S.blue, textTransform: 'uppercase', ...S.mb2 }}>Files Changed ({selectedCommit.files_changed.length})</div>
                    {selectedCommit.files_changed.map((file: string, idx: number) => (
                      <div key={idx} style={{ ...S.textXs, ...S.text, ...S.truncate, ...S.bg, ...S.px2, ...S.py1, ...S.rounded, marginBottom: '4px', ...S.flexRow, ...S.gap1 }}>
                        <FileIcon />{file}
                      </div>
                    ))}
                  </div>
                )}
                <div style={S.mt2}>
                  <div style={{ ...S.textXs, fontWeight: 600, ...S.blue, textTransform: 'uppercase', ...S.mb2 }}>Changes</div>
                  <div style={{ ...S.flexRow, gap: '16px', ...S.textXs }}>
                    <span><span style={S.green}>+{selectedCommit.insertions}</span> <span style={S.textMuted}>additions</span></span>
                    <span><span style={S.red}>-{selectedCommit.deletions}</span> <span style={S.textMuted}>deletions</span></span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── HistoryView (from GitHistoryPanel) ──────────────────────────────

function HistoryView({ api, currentPath }: { api: XplorerAPI; currentPath: string }) {
  type ViewMode = 'overview' | 'history' | 'blame';
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [repoInfo, setRepoInfo] = useState<GitRepositoryInfo | null>(null);
  const [fileHistory, setFileHistory] = useState<GitFileHistory | null>(null);
  const [fileBlame, setFileBlame] = useState<GitFileBlame | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [repoPath, setRepoPath] = useState<string | null>(null);

  useEffect(() => {
    if (!currentPath) return;
    (async () => {
      try {
        const foundRepo = await api.git.findRepository(currentPath);
        if (foundRepo) {
          setRepoPath(foundRepo);
          const info = await api.git.getRepositoryInfo(foundRepo);
          setRepoInfo(info as GitRepositoryInfo);
        } else {
          setRepoPath(null);
          setRepoInfo(null);
        }
      } catch {
        setRepoPath(null);
        setRepoInfo(null);
      }
    })();
  }, [currentPath, api]);

  const loadFileHistory = useCallback(async (filePath: string) => {
    if (!repoPath) return;
    setIsLoading(true);
    try {
      const relativePath = filePath.startsWith(repoPath) ? filePath.substring(repoPath.length + 1) : filePath;
      const history = await api.git.getFileHistory(repoPath, relativePath, 50);
      setFileHistory(history as GitFileHistory);
      setViewMode('history');
    } catch (error: any) {
      api.ui.showMessage(`Failed to load file history: ${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [repoPath, api]);

  const loadFileBlame = useCallback(async (filePath: string) => {
    if (!repoPath) return;
    setIsLoading(true);
    try {
      const relativePath = filePath.startsWith(repoPath) ? filePath.substring(repoPath.length + 1) : filePath;
      const blame = await api.git.getFileBlame(repoPath, relativePath);
      setFileBlame(blame as GitFileBlame);
      setViewMode('blame');
    } catch (error: any) {
      api.ui.showMessage(`Failed to load file blame: ${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [repoPath, api]);

  // ── Overview sub-view ──
  const renderOverview = () => {
    if (!repoInfo) return <NoRepo />;
    return (
      <div style={{ ...S.p3, overflowY: 'auto' }}>
        <div style={S.mb2}>
          <h4 style={{ ...S.textXs, fontWeight: 600, ...S.text, textTransform: 'uppercase', letterSpacing: '0.05em', ...S.mb2 }}>Repository</h4>
          <div style={{ ...S.textXs, ...S.surface, ...S.rounded, ...S.px3, ...S.py2, ...S.borderAll }}>
            <div style={{ ...S.flexRow, justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={S.textMuted}>Branch:</span>
              <span style={{ ...S.green, fontWeight: 500, ...S.flexRow, ...S.gap1 }}><GitBranchIcon size={12} />{repoInfo.current_branch}</span>
            </div>
            {repoInfo.remote_url && (
              <div style={{ ...S.flexRow, justifyContent: 'space-between', ...S.gap2, marginBottom: '8px' }}>
                <span style={{ ...S.textMuted, ...S.noShrink }}>Remote:</span>
                <span style={{ ...S.blue, textAlign: 'right', wordBreak: 'break-all' }}>{repoInfo.remote_url}</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--xp-border)', paddingTop: '8px' }}>
              <div style={{ ...S.flexRow, justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={S.textMuted}>Commits:</span><span style={{ ...S.text, fontWeight: 500 }}>{repoInfo.total_commits}</span>
              </div>
              <div style={{ ...S.flexRow, justifyContent: 'space-between' }}>
                <span style={S.textMuted}>Contributors:</span><span style={{ ...S.text, fontWeight: 500 }}>{repoInfo.total_contributors}</span>
              </div>
            </div>
          </div>
        </div>
        {repoInfo.last_commit && (
          <div style={S.mb2}>
            <h4 style={{ ...S.textXs, fontWeight: 600, ...S.text, textTransform: 'uppercase', letterSpacing: '0.05em', ...S.mb2 }}>Latest Commit</h4>
            <div style={{ ...S.surface, ...S.rounded, ...S.px3, ...S.py2, ...S.borderAll }}>
              <div style={{ ...S.textXs, ...S.fontMono, ...S.textMuted, ...S.bg, padding: '2px 8px', ...S.roundedSm, display: 'inline-block', marginBottom: '8px' }}>{repoInfo.last_commit.short_hash}</div>
              <div style={{ ...S.textXs, ...S.text }}>{repoInfo.last_commit.summary}</div>
              <div style={{ ...S.textXs, ...S.textMuted, ...S.mt1 }}>by {repoInfo.last_commit.author_name} • {formatRelativeTime(repoInfo.last_commit.timestamp)}</div>
            </div>
          </div>
        )}
        {(repoInfo.uncommitted_changes || repoInfo.untracked_files.length > 0) && (
          <div>
            <h4 style={{ ...S.textXs, fontWeight: 600, ...S.text, textTransform: 'uppercase', letterSpacing: '0.05em', ...S.mb2 }}>Working Directory</h4>
            <div style={{ ...S.surface, ...S.rounded, ...S.px3, ...S.py2, ...S.borderAll }}>
              {repoInfo.modified_files.length > 0 && (
                <div style={{ ...S.flexRow, justifyContent: 'space-between', ...S.textXs, marginBottom: '4px' }}>
                  <span style={S.textMuted}>Modified:</span><span style={{ ...S.orange, fontWeight: 500 }}>{repoInfo.modified_files.length}</span>
                </div>
              )}
              {repoInfo.staged_files.length > 0 && (
                <div style={{ ...S.flexRow, justifyContent: 'space-between', ...S.textXs, marginBottom: '4px' }}>
                  <span style={S.textMuted}>Staged:</span><span style={{ ...S.green, fontWeight: 500 }}>{repoInfo.staged_files.length}</span>
                </div>
              )}
              {repoInfo.untracked_files.length > 0 && (
                <div style={{ ...S.flexRow, justifyContent: 'space-between', ...S.textXs }}>
                  <span style={S.textMuted}>Untracked:</span><span style={{ ...S.red, fontWeight: 500 }}>{repoInfo.untracked_files.length}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── History sub-view ──
  const renderHistory = () => {
    if (!fileHistory) {
      return (
        <div style={{ ...S.flexCenter, ...S.h100, ...S.textMuted }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '12px', opacity: 0.5 }}><FileIcon size={48} /></div>
            <div style={S.textSm}>Select a file to view history</div>
          </div>
        </div>
      );
    }
    return (
      <div style={{ ...S.flexCol, ...S.h100 }}>
        <div style={{ ...S.px3, ...S.py2, ...S.borderB, ...S.surface }}>
          <div style={{ ...S.textXs, ...S.text, ...S.truncate, fontWeight: 500 }}>{fileHistory.file_path}</div>
          <div style={{ ...S.textXs, ...S.textMuted, ...S.mt1 }}>
            {fileHistory.total_commits} commits • <span style={S.green}>+{fileHistory.total_lines_added}</span> / <span style={S.red}>-{fileHistory.total_lines_deleted}</span>
          </div>
        </div>
        <div style={{ ...S.flex1, overflowY: 'auto' }}>
          {fileHistory.commits.map((commit: GitCommit) => (
            <div
              key={commit.hash}
              style={{
                ...S.px3, ...S.py2, ...S.borderB, ...S.pointer,
                background: selectedCommit === commit.hash ? 'rgba(var(--xp-blue-rgb, 59, 130, 246), 0.3)' : 'transparent',
              }}
              onClick={() => setSelectedCommit(selectedCommit === commit.hash ? null : commit.hash)}
            >
              <div style={{ ...S.flexRow, justifyContent: 'space-between', ...S.gap3 }}>
                <div style={{ ...S.flexRow, ...S.gap2, ...S.flex1 }}>
                  <div style={{ width: '8px', height: '8px', background: 'var(--xp-blue)', borderRadius: '50%', ...S.noShrink }} />
                  <div style={S.flex1}>
                    <div style={{ ...S.textXs, ...S.text, ...S.truncate }}>{commit.summary}</div>
                    <div style={{ ...S.textXs, ...S.textMuted, ...S.mt1 }}>{commit.author_name} • {formatRelativeTime(commit.timestamp)}</div>
                  </div>
                </div>
                <div style={{ ...S.flexRow, ...S.gap2, ...S.textXs, ...S.noShrink }}>
                  {commit.insertions > 0 && <span style={S.green}>+{commit.insertions}</span>}
                  {commit.deletions > 0 && <span style={S.red}>-{commit.deletions}</span>}
                  <span style={{ ...S.fontMono, ...S.textMuted, ...S.bg, padding: '1px 8px', ...S.roundedSm }}>{commit.short_hash}</span>
                </div>
              </div>
              {selectedCommit === commit.hash && (
                <div style={{ ...S.mt2, paddingLeft: '16px', borderLeft: '2px solid var(--xp-blue)' }}>
                  <div style={{ ...S.textXs, ...S.fontMono, ...S.textMuted }}>{commit.hash}</div>
                  <div style={{ ...S.textXs, ...S.textMuted }}>{commit.date}</div>
                  {commit.body && <div style={{ ...S.textXs, ...S.text, whiteSpace: 'pre-wrap', ...S.mt2 }}>{commit.body}</div>}
                  {commit.files_changed.length > 0 && (
                    <div style={S.mt2}>
                      <div style={{ ...S.textXs, ...S.textMuted, marginBottom: '4px' }}>Files changed:</div>
                      {commit.files_changed.slice(0, 5).map((file: string, i: number) => (
                        <div key={i} style={{ ...S.textXs, ...S.text, ...S.truncate }}>• {file}</div>
                      ))}
                      {commit.files_changed.length > 5 && <div style={{ ...S.textXs, ...S.textMuted }}>... and {commit.files_changed.length - 5} more</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {fileHistory.commits.length === 0 && (
            <div style={{ ...S.flexCenter, ...S.p3, ...S.textMuted, ...S.textSm }}>No commits found for this file</div>
          )}
        </div>
      </div>
    );
  };

  // ── Blame sub-view ──
  const renderBlame = () => {
    if (!fileBlame) {
      return (
        <div style={{ ...S.flexCenter, ...S.h100, ...S.textMuted }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '12px', opacity: 0.5 }}><PersonIcon size={48} /></div>
            <div style={S.textSm}>Select a file to view blame</div>
          </div>
        </div>
      );
    }
    return (
      <div style={{ ...S.flexCol, ...S.h100 }}>
        <div style={{ ...S.px3, ...S.py2, ...S.borderB, ...S.surface }}>
          <div style={{ ...S.textXs, ...S.text, ...S.truncate, fontWeight: 500 }}>{fileBlame.file_path}</div>
          <div style={{ ...S.textXs, ...S.textMuted, ...S.mt1 }}>{fileBlame.total_lines} lines • {fileBlame.unique_authors.length} contributors</div>
        </div>
        <div style={{ ...S.flex1, overflowY: 'auto', ...S.fontMono, ...S.textXs }}>
          {fileBlame.lines.map((line: GitBlameLine) => (
            <div key={line.line_number} style={{ ...S.flexRow, ...S.borderB }}>
              <div style={{ width: '48px', ...S.noShrink, ...S.px2, ...S.py1, ...S.textMuted, textAlign: 'right', ...S.bg, ...S.borderR }}>{line.line_number}</div>
              <div style={{ width: '80px', ...S.noShrink, ...S.px2, ...S.py1, ...S.blue, ...S.surface, ...S.borderR }}>{line.short_hash}</div>
              <div style={{ width: '96px', ...S.noShrink, ...S.px2, ...S.py1, ...S.textMuted, ...S.surface, ...S.borderR, ...S.truncate }}>{line.author_name}</div>
              <div style={{ ...S.flex1, ...S.px2, ...S.py1, ...S.text, ...S.bg, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line.content}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const modeBtn = (mode: ViewMode, label: string) => ({
    ...S.px3, ...S.py1, ...S.textXs, ...S.pointer,
    border: 'none', borderRight: '1px solid var(--xp-border)',
    background: viewMode === mode ? 'rgba(var(--xp-blue-rgb, 59, 130, 246), 0.25)' : 'var(--xp-surface)',
    color: viewMode === mode ? 'var(--xp-blue)' : 'var(--xp-text)',
    opacity: isLoading ? 0.5 : 1,
    cursor: isLoading ? 'not-allowed' : 'pointer',
  });

  return (
    <div style={{ ...S.flexCol, ...S.w100, ...S.text, ...S.h100, background: 'var(--xp-bg)' }}>
      {/* Header */}
      <div style={{ ...S.flexRow, justifyContent: 'space-between', ...S.px3, ...S.py2, ...S.surface, ...S.borderB }}>
        <div style={{ ...S.flexRow, ...S.gap2 }}>
          <GitHubIcon size={16} />
          <span style={{ ...S.textSm, fontWeight: 500, ...S.text }}>Git History</span>
        </div>
        {repoPath && (
          <div style={{ ...S.flexRow, ...S.borderAll, ...S.roundedSm, overflow: 'hidden' }}>
            <button onClick={() => setViewMode('overview')} style={modeBtn('overview', 'Overview')}>Overview</button>
            <button
              onClick={() => viewMode !== 'history' ? setViewMode('history') : null}
              disabled={isLoading}
              style={modeBtn('history', 'History')}
            >History</button>
            <button
              onClick={() => viewMode !== 'blame' ? setViewMode('blame') : null}
              disabled={isLoading}
              style={{ ...modeBtn('blame', 'Blame'), borderRight: 'none' }}
            >Blame</button>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ ...S.flexCenter, ...S.p3 }}>
          <div style={{ ...S.flexRow, ...S.gap2 }}><SpinnerIcon size={14} /><span style={{ ...S.textXs, ...S.textMuted }}>Loading...</span></div>
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <>
          {viewMode === 'overview' && renderOverview()}
          {viewMode === 'history' && renderHistory()}
          {viewMode === 'blame' && renderBlame()}
        </>
      )}
    </div>
  );
}

// ── BranchesView (from BranchManager) ───────────────────────────────

function BranchesView({ api, currentPath }: { api: XplorerAPI; currentPath: string }) {
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [createFromCommit, setCreateFromCommit] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [repoPath, setRepoPath] = useState<string | null>(null);

  const loadBranches = useCallback(async (repo: string) => {
    setIsLoading(true);
    try {
      const branchList = await api.git.getBranches(repo) as GitBranchInfo[];
      setBranches(branchList);
    } catch (error: any) {
      api.ui.showMessage(`Failed to load branches: ${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!currentPath) return;
    (async () => {
      try {
        const foundRepo = await api.git.findRepository(currentPath);
        if (foundRepo) {
          setRepoPath(foundRepo);
          loadBranches(foundRepo);
        } else {
          setRepoPath(null);
          setBranches([]);
        }
      } catch {
        setRepoPath(null);
        setBranches([]);
      }
    })();
  }, [currentPath, api, loadBranches]);

  const handleSwitchBranch = async (branchName: string) => {
    if (!repoPath) return;
    setIsLoading(true);
    try {
      await api.git.switchBranch(repoPath, branchName);
      await loadBranches(repoPath);
      api.ui.showMessage(`Switched to branch: ${branchName}`, 'success');
    } catch (error: any) {
      api.ui.showMessage(`Failed to switch branch: ${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoPath || !newBranchName.trim()) return;
    setIsCreating(true);
    try {
      await api.git.createBranch(repoPath, newBranchName.trim(), createFromCommit.trim() || undefined);
      await loadBranches(repoPath);
      setNewBranchName('');
      setCreateFromCommit('');
      api.ui.showMessage(`Created branch: ${newBranchName}`, 'success');
    } catch (error: any) {
      api.ui.showMessage(`Failed to create branch: ${error}`, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteBranch = async (branchName: string, force = false) => {
    if (!repoPath) return;
    if (!confirm(`Are you sure you want to delete branch "${branchName}"?${force ? ' This will force delete the branch.' : ''}`)) return;
    setIsLoading(true);
    try {
      await api.git.deleteBranch(repoPath, branchName, force);
      await loadBranches(repoPath);
      api.ui.showMessage(`Deleted branch: ${branchName}`, 'success');
    } catch (error: any) {
      if (!force && String(error).includes('not fully merged')) {
        if (confirm(`Branch "${branchName}" is not fully merged. Force delete?`)) {
          await handleDeleteBranch(branchName, true);
          return;
        }
      }
      api.ui.showMessage(`Failed to delete branch: ${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!repoPath) {
    return (
      <div style={{ ...S.flexCenter, ...S.p3, ...S.textMuted }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '8px' }}><GitBranchIcon size={24} /></div>
          <div>No Git repository found</div>
        </div>
      </div>
    );
  }

  const currentBranch = branches.find((b: GitBranchInfo) => b.is_current);
  const localBranches = branches.filter((b: GitBranchInfo) => !b.is_remote);
  const remoteBranches = branches.filter((b: GitBranchInfo) => b.is_remote);

  const inputStyle: React.CSSProperties = {
    ...S.w100, ...S.px2, ...S.py1, ...S.textXs, ...S.surface, ...S.borderAll, ...S.rounded, ...S.text,
  };

  return (
    <div style={{ ...S.flexCol, ...S.h100, background: 'var(--xp-bg)', ...S.text }}>
      {/* Header */}
      <div style={{ ...S.flexRow, justifyContent: 'space-between', ...S.p3, ...S.borderB }}>
        <span style={{ ...S.textSm, fontWeight: 600, ...S.flexRow, ...S.gap1 }}><GitBranchIcon /> Branches</span>
        <button onClick={() => repoPath && loadBranches(repoPath)} disabled={isLoading} style={{ ...iconBtn(), opacity: isLoading ? 0.5 : 1 }} title="Refresh"><RefreshIcon /></button>
      </div>

      {/* Current branch info */}
      {currentBranch && (
        <div style={{ ...S.p3, background: 'rgba(var(--xp-blue-rgb, 59, 130, 246), 0.2)', ...S.borderB }}>
          <div style={{ ...S.flexRow, gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', background: 'var(--xp-green)', borderRadius: '50%' }} />
            <span style={{ ...S.textSm, fontWeight: 500, ...S.green }}>{currentBranch.name}</span>
          </div>
          {currentBranch.upstream && (
            <div style={{ ...S.textXs, ...S.textMuted, ...S.mt1 }}>
              Tracking: {currentBranch.upstream}
              {currentBranch.ahead > 0 && <span style={S.green}> ↑{currentBranch.ahead}</span>}
              {currentBranch.behind > 0 && <span style={S.red}> ↓{currentBranch.behind}</span>}
            </div>
          )}
        </div>
      )}

      {/* Create branch form */}
      <div style={{ ...S.p3, ...S.borderB }}>
        <form onSubmit={handleCreateBranch}>
          <input type="text" placeholder="New branch name" value={newBranchName} onChange={(e: any) => setNewBranchName(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} />
          <input type="text" placeholder="From commit (optional)" value={createFromCommit} onChange={(e: any) => setCreateFromCommit(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} />
          <button
            type="submit"
            disabled={!newBranchName.trim() || isCreating}
            style={{
              ...S.w100, ...S.px2, ...S.py1, ...S.textXs, ...S.rounded, ...S.pointer,
              background: 'var(--xp-green)', color: '#fff', border: 'none',
              opacity: !newBranchName.trim() || isCreating ? 0.5 : 1,
              cursor: !newBranchName.trim() || isCreating ? 'not-allowed' : 'pointer',
            }}
          >
            {isCreating ? 'Creating...' : 'Create Branch'}
          </button>
        </form>
      </div>

      {/* Branch lists */}
      <div style={{ ...S.flex1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ ...S.flexCenter, ...S.p3, ...S.textXs, ...S.textMuted }}>Loading branches...</div>
        ) : (
          <>
            {/* Local */}
            <div style={S.p2}>
              <h4 style={{ ...S.textXs, fontWeight: 600, ...S.textMuted, ...S.mb2 }}>LOCAL BRANCHES</h4>
              {localBranches.map((branch: GitBranchInfo) => (
                <div
                  key={branch.name}
                  onClick={() => setSelectedBranch(selectedBranch === branch.name ? null : branch.name)}
                  style={{
                    ...S.flexRow, justifyContent: 'space-between', ...S.p2, ...S.rounded, ...S.pointer,
                    background: branch.is_current ? 'rgba(var(--xp-blue-rgb, 59, 130, 246), 0.2)' : selectedBranch === branch.name ? 'var(--xp-surface)' : 'transparent',
                  }}
                >
                  <div style={{ ...S.flexRow, gap: '8px', ...S.flex1 }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', ...S.noShrink, background: branch.is_current ? 'var(--xp-green)' : 'var(--xp-text-muted)' }} />
                    <span style={{ ...S.textXs, ...S.truncate, color: branch.is_current ? 'var(--xp-green)' : 'var(--xp-text)', fontWeight: branch.is_current ? 500 : 400 }}>{branch.name}</span>
                    {branch.upstream && (
                      <span style={{ ...S.textXs, ...S.textMuted }}>
                        {branch.ahead > 0 && <span style={S.green}>↑{branch.ahead}</span>}
                        {branch.behind > 0 && <span style={S.red}>↓{branch.behind}</span>}
                      </span>
                    )}
                  </div>
                  {!branch.is_current && selectedBranch === branch.name && (
                    <div style={{ ...S.flexRow, ...S.gap1 }}>
                      <button
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleSwitchBranch(branch.name); }}
                        style={{ ...S.px2, ...S.py1, ...S.textXs, ...S.roundedSm, border: 'none', background: 'var(--xp-blue)', color: '#fff', ...S.pointer }}
                      >Switch</button>
                      <button
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDeleteBranch(branch.name); }}
                        style={{ ...S.px2, ...S.py1, ...S.textXs, ...S.roundedSm, border: 'none', background: 'var(--xp-red)', color: '#fff', ...S.pointer }}
                      >Delete</button>
                    </div>
                  )}
                </div>
              ))}
              {localBranches.length === 0 && <div style={{ ...S.textXs, ...S.textMuted, ...S.p2 }}>No local branches</div>}
            </div>

            {/* Remote */}
            {remoteBranches.length > 0 && (
              <div style={{ ...S.p2, ...S.borderT }}>
                <h4 style={{ ...S.textXs, fontWeight: 600, ...S.textMuted, ...S.mb2 }}>REMOTE BRANCHES</h4>
                {remoteBranches.map((branch: GitBranchInfo) => (
                  <div key={branch.name} style={{ ...S.flexRow, justifyContent: 'space-between', ...S.p2, ...S.rounded, ...S.pointer }}>
                    <div style={{ ...S.flexRow, gap: '8px', ...S.flex1 }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', ...S.noShrink, background: 'var(--xp-blue)' }} />
                      <span style={{ ...S.textXs, ...S.blue, ...S.truncate }}>{branch.name}</span>
                    </div>
                    <button
                      onClick={() => {
                        const localName = branch.name.replace(/^origin\//, '');
                        setNewBranchName(localName);
                        setCreateFromCommit(branch.name);
                      }}
                      style={{ ...S.px2, ...S.py1, ...S.textXs, ...S.roundedSm, border: 'none', background: 'var(--xp-green)', color: '#fff', ...S.pointer }}
                    >Checkout</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main GitPanel (combines all sub-views) ──────────────────────────

type GitSubTab = 'graph' | 'history' | 'branches';

function GitPanel({ api, currentPath }: { api: XplorerAPI; currentPath?: string }) {
  const [subTab, setSubTab] = useState<GitSubTab>('graph');
  const path = currentPath || '';

  const tabBtn = (tab: GitSubTab, label: string): React.CSSProperties => ({
    ...S.px3, padding: '4px 12px', ...S.textXs, fontWeight: 500,
    border: 'none', cursor: 'pointer',
    background: subTab === tab ? 'var(--xp-bg)' : 'transparent',
    color: subTab === tab ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
    borderBottom: subTab === tab ? '2px solid var(--xp-blue)' : '2px solid transparent',
  });

  return (
    <div style={{ ...S.flexCol, ...S.h100, ...S.w100 }}>
      {/* Sub-tab bar */}
      <div style={{ ...S.flexRow, ...S.borderB, ...S.surface, ...S.noShrink }}>
        <button onClick={() => setSubTab('graph')} style={tabBtn('graph', 'Commit Graph')}>Commit Graph</button>
        <button onClick={() => setSubTab('history')} style={tabBtn('history', 'History')}>History</button>
        <button onClick={() => setSubTab('branches')} style={tabBtn('branches', 'Branches')}>Branches</button>
      </div>
      {/* Content */}
      <div style={{ ...S.flex1, ...S.overflowHidden }}>
        {subTab === 'graph' && <CommitGraph api={api} currentPath={path} />}
        {subTab === 'history' && <HistoryView api={api} currentPath={path} />}
        {subTab === 'branches' && <BranchesView api={api} currentPath={path} />}
      </div>
    </div>
  );
}

// ── Registration ────────────────────────────────────────────────────

let gitApi: XplorerAPI;

BottomTab.register({
  id: 'git',
  title: 'GITLENS',
  icon: 'git-branch',
  permissions: ['git:read', 'git:write'],
  render: (props) => <GitPanel api={gitApi} currentPath={props.currentPath} />,
  onActivate: (api) => { gitApi = api; },
});

Command.register({
  id: 'git-open-graph',
  title: 'Git: Open Commit Graph',
  action: (_api) => {
    window.dispatchEvent(new CustomEvent('xplorer-set-bottom-tab', { detail: { tab: 'git' } }));
  },
});

Command.register({
  id: 'git-open-history',
  title: 'Git: Show File History',
  action: (_api) => {
    window.dispatchEvent(new CustomEvent('xplorer-set-bottom-tab', { detail: { tab: 'git' } }));
  },
});

Command.register({
  id: 'git-open-branches',
  title: 'Git: Branch Manager',
  action: (_api) => {
    window.dispatchEvent(new CustomEvent('xplorer-set-bottom-tab', { detail: { tab: 'git' } }));
  },
});
