/**
 * Xplorer Recommendations Extension
 *
 * Find similar files and duplicate file detection.
 * Registers via Sidebar.register() to provide a panel in the right sidebar.
 *
 * Two tabs:
 *   - Similar: shows files similar to the currently selected file (via semantic search)
 *   - Duplicates: scans a directory for duplicate files (via findDuplicates API)
 */

import React from 'react';
import { Sidebar, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Types ──────────────────────────────────────────────────────────────────────

interface FileRecommendation {
  path: string;
  name: string;
  score: number;
  snippet: string;
}

interface ScanProgress {
  currentFile: string;
  processedFiles: number;
  totalFiles: number;
  currentPhase: string;
  duplicatesFound: number;
  totalWastedSpace: number;
}

interface DuplicateFile {
  path: string;
  name: string;
  size: number;
  hash: string;
  modified: number;
}

interface DuplicateGroup {
  hash: string;
  size: number;
  files: DuplicateFile[];
  total_wasted_space: number;
}

interface DuplicateFinderResult {
  duplicate_groups: DuplicateGroup[];
  total_duplicates: number;
  total_wasted_space: number;
  scan_time_ms: number;
  files_scanned: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0 || !isFinite(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function sizeBadgeStyle(bytes: number): React.CSSProperties {
  if (bytes >= 1024 * 1024 * 100) return { backgroundColor: 'rgba(247, 118, 142, 0.2)', color: '#f7768e', border: '1px solid rgba(247, 118, 142, 0.3)' };
  if (bytes >= 1024 * 1024 * 10) return { backgroundColor: 'rgba(255, 158, 100, 0.2)', color: '#ff9e64', border: '1px solid rgba(255, 158, 100, 0.3)' };
  if (bytes >= 1024 * 1024) return { backgroundColor: 'rgba(224, 175, 104, 0.2)', color: '#e0af68', border: '1px solid rgba(224, 175, 104, 0.3)' };
  if (bytes >= 1024 * 100) return { backgroundColor: 'rgba(122, 162, 247, 0.2)', color: '#7aa2f7', border: '1px solid rgba(122, 162, 247, 0.3)' };
  return { backgroundColor: 'var(--xp-surface)', color: 'var(--xp-text-muted)', border: '1px solid var(--xp-border)' };
}

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}

function getFileExtension(filePath: string): string {
  const name = getFileName(filePath);
  const dotIdx = name.lastIndexOf('.');
  return dotIdx > 0 ? name.slice(dotIdx + 1).toLowerCase() : '';
}

// ── SVG Icons (inline to avoid lucide-react dependency) ────────────────────────

function IconSearch({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconLoader({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function IconCopy({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function IconTrash({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function IconFolder({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconChevronDown({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconChevronRight({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function IconClipboard({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function IconTarget({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconFile({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

// ── Inline keyframe injection (for spinner animation) ──────────────────────────

let spinStyleInjected = false;
function ensureSpinKeyframes() {
  if (spinStyleInjected) return;
  spinStyleInjected = true;
  const style = document.createElement('style');
  style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    color: 'var(--xp-text)',
    fontFamily: 'sans-serif',
    fontSize: 12,
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid var(--xp-border)',
    flexShrink: 0,
  },
  tab: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center',
    border: 'none',
    backgroundColor: 'transparent',
    color: active ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
    borderBottom: active ? '2px solid var(--xp-blue)' : '2px solid transparent',
    transition: 'color 0.15s, border-color 0.15s',
  }),
  // -- Similar tab styles --
  emptyState: {
    display: 'flex',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--xp-text-muted)',
    fontSize: 12,
    padding: 16,
  },
  emptyInner: {
    textAlign: 'center' as const,
    padding: '0 16px',
  },
  emptyIcon: {
    marginBottom: 8,
    opacity: 0.4,
    display: 'flex',
    justifyContent: 'center',
  },
  similarHeader: {
    padding: '8px 16px',
    borderBottom: '1px solid var(--xp-border)',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  similarHeaderText: {
    fontSize: 11,
    color: 'var(--xp-text-muted)',
  },
  similarHighlight: {
    color: 'var(--xp-blue)',
  },
  resultList: {
    flex: 1,
    overflowY: 'auto' as const,
  },
  resultItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '10px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(128,128,128,0.15)',
    transition: 'background-color 0.15s',
  },
  resultIcon: {
    flexShrink: 0,
    marginTop: 2,
    color: 'var(--xp-text-muted)',
  },
  resultBody: {
    flex: 1,
    minWidth: 0,
  },
  resultNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  resultName: {
    fontSize: 12,
    color: 'var(--xp-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  scoreBadge: {
    flexShrink: 0,
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 4,
    backgroundColor: 'rgba(122, 162, 247, 0.2)',
    color: '#7aa2f7',
    border: '1px solid rgba(122, 162, 247, 0.3)',
  },
  resultPath: {
    fontSize: 10,
    color: 'var(--xp-text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  resultSnippet: {
    fontSize: 10,
    color: 'var(--xp-text-muted)',
    backgroundColor: 'var(--xp-surface)',
    padding: '4px 8px',
    borderRadius: 4,
    marginTop: 4,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
  },
  resultIndex: {
    flexShrink: 0,
    fontSize: 10,
    color: 'var(--xp-text-muted)',
  },
  footer: {
    padding: '6px 16px',
    borderTop: '1px solid var(--xp-border)',
    backgroundColor: 'rgba(0,0,0,0.05)',
    fontSize: 10,
    color: 'var(--xp-text-muted)',
  },
  // -- Duplicates tab styles --
  controls: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--xp-border)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  input: {
    width: '100%',
    padding: '6px 8px',
    fontSize: 12,
    backgroundColor: 'var(--xp-surface)',
    border: '1px solid var(--xp-border)',
    borderRadius: 4,
    color: 'var(--xp-text)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  minSizeLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    color: 'var(--xp-text-muted)',
  },
  minSizeInput: {
    width: 64,
    padding: '3px 6px',
    fontSize: 10,
    backgroundColor: 'var(--xp-surface)',
    border: '1px solid var(--xp-border)',
    borderRadius: 4,
    color: 'var(--xp-text)',
    outline: 'none',
  },
  scanBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    fontSize: 10,
    fontWeight: 500,
    borderRadius: 4,
    backgroundColor: 'var(--xp-blue)',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
  },
  cancelBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    fontSize: 10,
    fontWeight: 500,
    borderRadius: 4,
    backgroundColor: 'rgba(247, 118, 142, 0.1)',
    color: '#f7768e',
    border: '1px solid rgba(247, 118, 142, 0.2)',
    cursor: 'pointer',
  },
  progress: {
    padding: '6px 12px',
    borderBottom: '1px solid var(--xp-border)',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 10,
    color: 'var(--xp-text-muted)',
    marginBottom: 4,
  },
  progressBarOuter: {
    width: '100%',
    backgroundColor: 'var(--xp-surface)',
    borderRadius: 6,
    height: 4,
    overflow: 'hidden' as const,
  },
  progressBarInner: {
    backgroundColor: 'var(--xp-blue)',
    height: 4,
    borderRadius: 6,
    transition: 'width 0.3s ease',
  },
  summary: {
    padding: '6px 12px',
    borderBottom: '1px solid var(--xp-border)',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 10,
    flexWrap: 'wrap' as const,
  },
  summaryMuted: { color: 'var(--xp-text-muted)' },
  summaryBold: { color: 'var(--xp-text)', fontWeight: 500 },
  summaryRed: { color: '#f7768e', fontWeight: 500 },
  summaryDivider: { color: 'var(--xp-border)' },
  groupBorder: { borderBottom: '1px solid rgba(128,128,128,0.2)' },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  sizeBadge: {
    padding: '2px 6px',
    fontSize: 10,
    fontFamily: 'monospace',
    borderRadius: 4,
  },
  hashText: {
    fontSize: 10,
    color: 'var(--xp-text-muted)',
    fontFamily: 'monospace',
    maxWidth: 60,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  fileCount: {
    fontSize: 10,
    color: 'var(--xp-text-muted)',
  },
  spacer: { flex: 1 },
  wastedBadge: {
    fontSize: 10,
    color: '#f7768e',
    fontWeight: 500,
  },
  selectBtn: (active: boolean): React.CSSProperties => ({
    padding: '2px 6px',
    fontSize: 10,
    borderRadius: 4,
    cursor: 'pointer',
    border: active ? '1px solid rgba(122, 162, 247, 0.3)' : '1px solid var(--xp-border)',
    backgroundColor: active ? 'rgba(122, 162, 247, 0.2)' : 'var(--xp-surface)',
    color: active ? '#7aa2f7' : 'var(--xp-text-muted)',
  }),
  fileRow: (selected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 6px',
    borderRadius: 4,
    fontSize: 11,
    marginBottom: 2,
    transition: 'background-color 0.15s',
    ...(selected ? { backgroundColor: 'rgba(122, 162, 247, 0.1)', border: '1px solid rgba(122, 162, 247, 0.2)' } : {}),
  }),
  checkbox: {
    width: 12,
    height: 12,
    accentColor: 'var(--xp-blue)',
    flexShrink: 0,
  },
  fileName: {
    flex: 1,
    minWidth: 0,
  },
  fileNameText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: 'var(--xp-text)',
  },
  filePathText: {
    fontSize: 10,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: 'var(--xp-text-muted)',
  },
  keepBadge: {
    color: '#9ece6a',
    marginLeft: 4,
    fontSize: 10,
  },
  openFolderBtn: {
    padding: 2,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: 'var(--xp-text-muted)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  actionsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderTop: '1px solid var(--xp-border)',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  selectedCount: {
    fontSize: 10,
    color: 'var(--xp-text-muted)',
  },
  deleteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 500,
    borderRadius: 4,
    backgroundColor: 'rgba(247, 118, 142, 0.1)',
    color: '#f7768e',
    border: '1px solid rgba(247, 118, 142, 0.2)',
    cursor: 'pointer',
  },
  exportBtn: {
    padding: 4,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: 'var(--xp-text-muted)',
    cursor: 'pointer',
  },
};

// ── Similar Files Tab ──────────────────────────────────────────────────────────

let _api: XplorerAPI;

interface SelectedFileInfo {
  name: string;
  path: string;
  is_dir: boolean;
}

function SimilarFilesTab({ selectedFiles }: { selectedFiles?: SelectedFileInfo[] }) {
  const [recommendations, setRecommendations] = React.useState<FileRecommendation[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedFile = selectedFiles && selectedFiles.length === 1 ? selectedFiles[0] : null;

  React.useEffect(() => {
    const loadRecommendations = async () => {
      if (!selectedFile || selectedFile.is_dir) {
        setRecommendations([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Try the host TauriAPI first for getFileRecommendations (more accurate)
        const TauriAPI = (window as any).__xplorer_tauri_api__?.default || (window as any).__xplorer_tauri_api__;
        let results: FileRecommendation[];

        if (TauriAPI && TauriAPI.getFileRecommendations) {
          const raw = await TauriAPI.getFileRecommendations(selectedFile.path, 10);
          results = (raw as any[]).map((r: any) => ({
            path: r.path,
            name: r.path.split(/[/\\]/).pop() || r.path,
            score: r.score,
            snippet: r.snippet || '',
          }));
        } else {
          // Fallback: use SDK semantic search with the file name as query
          const fileName = getFileName(selectedFile.path);
          const ext = getFileExtension(selectedFile.path);
          const query = ext ? `${fileName} .${ext}` : fileName;
          const raw = await _api.search.semantic(query, 10);
          results = (raw as any[])
            .filter((r: any) => r.path !== selectedFile.path)
            .map((r: any) => ({
              path: r.path,
              name: r.filename || r.path.split(/[/\\]/).pop() || r.path,
              score: r.score,
              snippet: r.snippet || '',
            }));
        }

        setRecommendations(results);
      } catch (err) {
        console.error('[Recommendations] Failed to load similar files:', err);
        setError(err instanceof Error ? err.message : String(err));
        setRecommendations([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecommendations();
  }, [selectedFile?.path]);

  // No file selected
  if (!selectedFile || selectedFile.is_dir) {
    return (
      <div style={s.emptyState}>
        <div style={s.emptyInner}>
          <div style={s.emptyIcon}><IconSearch size={40} /></div>
          <p>Select a file to see similar files</p>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    ensureSpinKeyframes();
    return (
      <div style={s.emptyState}>
        <div style={s.emptyInner}>
          <div style={{ ...s.emptyIcon, opacity: 1, color: 'var(--xp-blue)' }}>
            <IconLoader size={32} />
          </div>
          <p>Finding similar files...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div style={s.emptyState}>
        <div style={{ ...s.emptyInner, color: '#f7768e' }}>
          <div style={{ ...s.emptyIcon, opacity: 1 }}><IconX size={32} /></div>
          <p>Failed to load recommendations</p>
          <p style={{ fontSize: 10, marginTop: 4, color: 'var(--xp-text-muted)' }}>{error}</p>
        </div>
      </div>
    );
  }

  // No results
  if (recommendations.length === 0) {
    return (
      <div style={s.emptyState}>
        <div style={s.emptyInner}>
          <div style={s.emptyIcon}><IconSearch size={40} /></div>
          <p>No similar files found</p>
          <p style={{ fontSize: 10, marginTop: 4 }}>Try indexing more directories</p>
        </div>
      </div>
    );
  }

  // Results
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Header */}
      <div style={s.similarHeader}>
        <p style={s.similarHeaderText}>
          Similar to <span style={s.similarHighlight}>{selectedFile.name}</span>
        </p>
      </div>

      {/* Result list */}
      <div style={s.resultList}>
        {recommendations.map((rec, index) => (
          <div
            key={rec.path}
            style={s.resultItem}
            onClick={() => {
              const separator = rec.path.includes('\\') ? '\\' : '/';
              const parentDir = rec.path.substring(0, rec.path.lastIndexOf(separator));
              if (parentDir) _api.navigation.navigateTo(parentDir);
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(128,128,128,0.1)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <div style={s.resultIcon}>
              <IconFile size={14} />
            </div>
            <div style={s.resultBody}>
              <div style={s.resultNameRow}>
                <span style={s.resultName}>{rec.name}</span>
                <span style={s.scoreBadge}>{Math.round(rec.score * 100)}%</span>
              </div>
              <p style={s.resultPath} title={rec.path}>{rec.path}</p>
              {rec.snippet && (
                <p style={s.resultSnippet}>{rec.snippet}</p>
              )}
            </div>
            <div style={s.resultIndex}>#{index + 1}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={s.footer}>
        {recommendations.length} similar file{recommendations.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ── Duplicates Tab ─────────────────────────────────────────────────────────────

function DuplicatesTab({ currentPath = '' }: { currentPath?: string }) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [progress, setProgress] = React.useState<ScanProgress | null>(null);
  const [results, setResults] = React.useState<DuplicateFinderResult | null>(null);
  const [selectedFiles, setSelectedFiles] = React.useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
  const [scanPath, setScanPath] = React.useState(currentPath || '');
  const [minFileSize, setMinFileSize] = React.useState(1024);

  React.useEffect(() => {
    if (currentPath) setScanPath(currentPath);
  }, [currentPath]);

  const handleStartScan = React.useCallback(async () => {
    if (!scanPath.trim()) {
      _api.ui.showMessage('Please specify a path to scan', 'error');
      return;
    }

    setIsScanning(true);
    setProgress(null);
    setResults(null);
    setSelectedFiles(new Set());
    setExpandedGroups(new Set());

    let unlisten: (() => void) | null = null;

    try {
      const hostTransport = (window as any).__xplorer_transport__;
      if (hostTransport && hostTransport.listenToEvent) {
        unlisten = await hostTransport.listenToEvent('duplicate-finder-progress', (payload: ScanProgress) => {
          setProgress(payload);
        });
      }

      const result = await _api.search.findDuplicates(scanPath, { minFileSize }) as DuplicateFinderResult;
      setResults(result);
    } catch (error) {
      const msg = `${error}`;
      if (!msg.includes('cancelled')) {
        console.error('[Recommendations] Duplicate scan error:', error);
        _api.ui.showMessage(`Scan failed: ${msg}`, 'error');
      }
    } finally {
      if (unlisten) unlisten();
      setIsScanning(false);
      setProgress(null);
    }
  }, [scanPath, minFileSize]);

  const handleCancelScan = React.useCallback(async () => {
    try {
      const TauriAPI = (window as any).__xplorer_tauri_api__?.default || (window as any).__xplorer_tauri_api__;
      if (TauriAPI && TauriAPI.cancelDuplicateScan) {
        await TauriAPI.cancelDuplicateScan();
      }
    } catch (err) {
      console.warn('[Recommendations] Failed to cancel scan:', err);
    }
  }, []);

  const toggleFile = React.useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const selectAllDuplicatesInGroup = React.useCallback((group: DuplicateGroup) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      const paths = group.files.map((f) => f.path);
      const allSelected = paths.slice(1).every((p) => prev.has(p));
      if (allSelected) {
        paths.forEach((p) => next.delete(p));
      } else {
        paths.slice(1).forEach((p) => next.add(p));
      }
      return next;
    });
  }, []);

  const toggleGroupExpansion = React.useCallback((hash: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  }, []);

  const handleMoveToTrash = React.useCallback(async () => {
    if (selectedFiles.size === 0) return;

    const confirmed = await _api.dialog.confirm(
      `Move ${selectedFiles.size} duplicate file(s) to trash?`,
      'Confirm Deletion',
    );
    if (!confirmed) return;

    try {
      const TauriAPI = (window as any).__xplorer_tauri_api__?.default || (window as any).__xplorer_tauri_api__;
      if (TauriAPI && TauriAPI.moveDuplicateFilesToTrash) {
        await TauriAPI.moveDuplicateFilesToTrash(Array.from(selectedFiles));
      }

      _api.ui.showMessage(`${selectedFiles.size} file(s) moved to trash`, 'info');

      if (results) {
        const deletedSet = new Set(selectedFiles);
        const updatedGroups = results.duplicate_groups
          .map((g) => ({
            ...g,
            files: g.files.filter((f) => !deletedSet.has(f.path)),
            total_wasted_space: Math.max(0, (g.files.filter((f) => !deletedSet.has(f.path)).length - 1)) * g.size,
          }))
          .filter((g) => g.files.length >= 2);

        const total_duplicates = updatedGroups.reduce((sum, g) => sum + g.files.length, 0);
        const total_wasted_space = updatedGroups.reduce((sum, g) => sum + g.total_wasted_space, 0);
        setResults({ ...results, duplicate_groups: updatedGroups, total_duplicates, total_wasted_space });
      }
      setSelectedFiles(new Set());
      window.dispatchEvent(new CustomEvent('files-changed'));
    } catch (err) {
      console.error('[Recommendations] Failed to move duplicates to trash:', err);
      _api.ui.showMessage(`Failed: ${err}`, 'error');
    }
  }, [selectedFiles, results]);

  const handleOpenFolder = React.useCallback((filePath: string) => {
    const separator = filePath.includes('\\') ? '\\' : '/';
    const parentDir = filePath.substring(0, filePath.lastIndexOf(separator));
    if (parentDir) _api.navigation.navigateTo(parentDir);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Controls */}
      <div style={s.controls}>
        <input
          type="text"
          value={scanPath}
          onChange={(e) => setScanPath(e.target.value)}
          placeholder="Path to scan..."
          style={s.input}
          disabled={isScanning}
        />
        <div style={s.controlsRow}>
          <label style={s.minSizeLabel}>
            <span>Min:</span>
            <input
              type="number"
              value={minFileSize}
              onChange={(e) => setMinFileSize(parseInt(e.target.value) || 0)}
              style={s.minSizeInput}
              disabled={isScanning}
            />
            <span>B</span>
          </label>
          <span style={s.spacer} />
          {isScanning ? (
            <button onClick={handleCancelScan} style={s.cancelBtn}>
              <IconX size={12} />
              Cancel
            </button>
          ) : (
            <button onClick={handleStartScan} style={s.scanBtn}>
              <IconSearch size={12} />
              Scan
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {isScanning && progress && (
        <div style={s.progress}>
          <div style={s.progressRow}>
            <span style={{ textTransform: 'capitalize' }}>{progress.currentPhase}</span>
            <span>
              {progress.processedFiles}
              {progress.totalFiles > 0 ? ` / ${progress.totalFiles}` : ''} files
            </span>
          </div>
          <div style={s.progressBarOuter}>
            <div
              style={{
                ...s.progressBarInner,
                width: progress.totalFiles > 0
                  ? `${Math.min(100, (progress.processedFiles / progress.totalFiles) * 100)}%`
                  : '60%',
              }}
            />
          </div>
        </div>
      )}

      {/* Summary */}
      {results && results.duplicate_groups.length > 0 && (
        <div style={s.summary}>
          <div style={s.summaryRow}>
            <span style={s.summaryMuted}>
              <span style={s.summaryBold}>{results.duplicate_groups.length}</span> groups
            </span>
            <span style={s.summaryDivider}>|</span>
            <span style={s.summaryMuted}>
              <span style={s.summaryBold}>{results.total_duplicates}</span> files
            </span>
            <span style={s.summaryDivider}>|</span>
            <span style={s.summaryRed}>{formatSize(results.total_wasted_space)} wasted</span>
          </div>
        </div>
      )}

      {/* Results */}
      <div style={s.resultList}>
        {results && results.duplicate_groups.length > 0 && (
          <div>
            {results.duplicate_groups.map((group) => {
              const isExpanded = expandedGroups.has(group.hash);
              const fileCount = group.files.length;
              const allDupsSelected = group.files.slice(1).every((f) => selectedFiles.has(f.path));

              return (
                <div key={group.hash} style={s.groupBorder}>
                  {/* Group header */}
                  <div
                    style={s.groupHeader}
                    onClick={() => toggleGroupExpansion(group.hash)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(128,128,128,0.1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{ flexShrink: 0, color: 'var(--xp-text-muted)' }}>
                      {isExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                    </span>
                    <span style={{ ...s.sizeBadge, ...sizeBadgeStyle(group.size) }}>
                      {formatSize(group.size)}
                    </span>
                    <span style={s.hashText} title={group.hash}>
                      {group.hash.slice(0, 8)}
                    </span>
                    <span style={s.fileCount}>{fileCount}x</span>
                    <span style={s.spacer} />
                    <span style={s.wastedBadge}>-{formatSize(group.total_wasted_space)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); selectAllDuplicatesInGroup(group); }}
                      style={s.selectBtn(allDupsSelected)}
                    >
                      {allDupsSelected ? 'Undo' : 'Select'}
                    </button>
                  </div>

                  {/* Expanded file list */}
                  {isExpanded && (
                    <div style={{ paddingLeft: 20, paddingRight: 12, paddingBottom: 6 }}>
                      {group.files.map((file, index) => {
                        const isKeep = index === 0;
                        const isSelected = selectedFiles.has(file.path);

                        return (
                          <div key={file.path} style={s.fileRow(isSelected)}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFile(file.path)}
                              style={s.checkbox}
                            />
                            <span style={{ flexShrink: 0, color: isKeep ? '#9ece6a' : 'var(--xp-text-muted)' }}>
                              {isKeep ? <IconCheck size={12} /> : <IconCopy size={12} />}
                            </span>
                            <div style={s.fileName}>
                              <div style={s.fileNameText}>
                                {file.name}
                                {isKeep && <span style={s.keepBadge}>(keep)</span>}
                              </div>
                              <div style={s.filePathText}>{file.path}</div>
                            </div>
                            <button
                              onClick={() => handleOpenFolder(file.path)}
                              style={s.openFolderBtn}
                              title="Open folder"
                            >
                              <IconFolder size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Clean state */}
        {results && results.duplicate_groups.length === 0 && (
          <div style={s.emptyState}>
            <div style={s.emptyInner}>
              <div style={{ ...s.emptyIcon, opacity: 1, color: '#9ece6a' }}>
                <IconCheck size={32} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>No duplicates found</div>
            </div>
          </div>
        )}

        {/* Initial state */}
        {!isScanning && !results && (
          <div style={s.emptyState}>
            <div style={s.emptyInner}>
              <div style={s.emptyIcon}><IconSearch size={32} /></div>
              <div>Set path and click Scan</div>
            </div>
          </div>
        )}
      </div>

      {/* Actions bar */}
      {results && results.duplicate_groups.length > 0 && selectedFiles.size > 0 && (
        <div style={s.actionsBar}>
          <span style={s.selectedCount}>{selectedFiles.size} selected</span>
          <button onClick={handleMoveToTrash} style={s.deleteBtn}>
            <IconTrash size={12} />
            Delete
          </button>
          <span style={s.spacer} />
          <button
            onClick={() => {
              if (!results) return;
              const lines = results.duplicate_groups.flatMap((g, i) => [
                `Group ${i + 1}: ${formatSize(g.size)} x${g.files.length}`,
                ...g.files.map((f, j) => `  ${j === 0 ? '[KEEP]' : '[DUP] '} ${f.path}`),
                '',
              ]);
              navigator.clipboard.writeText(lines.join('\n')).then(
                () => _api.ui.showMessage('Report copied to clipboard', 'info'),
                () => _api.ui.showMessage('Could not copy to clipboard', 'error'),
              );
            }}
            style={s.exportBtn}
            title="Copy report"
          >
            <IconClipboard size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

type TabMode = 'similar' | 'duplicates';

function RecommendationsPanel({
  currentPath = '',
  selectedFiles,
}: {
  currentPath?: string;
  selectedFiles?: SelectedFileInfo[];
}) {
  const [activeTab, setActiveTab] = React.useState<TabMode>('similar');

  return (
    <div style={s.root}>
      {/* Tab switcher */}
      <div style={s.tabBar}>
        <button
          style={s.tab(activeTab === 'similar')}
          onClick={() => setActiveTab('similar')}
        >
          Similar
        </button>
        <button
          style={s.tab(activeTab === 'duplicates')}
          onClick={() => setActiveTab('duplicates')}
        >
          Duplicates
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'similar' ? (
        <SimilarFilesTab selectedFiles={selectedFiles} />
      ) : (
        <DuplicatesTab currentPath={currentPath} />
      )}
    </div>
  );
}

// ── Register Extension ─────────────────────────────────────────────────────────

Sidebar.register({
  id: 'recommendations',
  title: 'Similar & Recommendations',
  description: 'Find similar files and get file recommendations',
  icon: 'search',
  location: 'right',
  permissions: ['file:read', 'search:read', 'search:duplicates', 'ui:panels'],
  render: ({ currentPath, selectedFiles }) =>
    React.createElement(RecommendationsPanel, {
      currentPath: currentPath as string | undefined,
      selectedFiles: selectedFiles as SelectedFileInfo[] | undefined,
    }),
  onActivate: (api) => { _api = api; },
});
