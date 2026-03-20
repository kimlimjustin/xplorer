/**
 * Xplorer File Organizer Extension
 *
 * AI-powered file organization panel that analyzes directories,
 * suggests folder structures, detects duplicates, and provides
 * directory insights. Registers as a sidebar panel via
 * Sidebar.register() from the Xplorer Extension SDK.
 */

import React from 'react';
import { Sidebar, type XplorerAPI, type SidebarRenderProps } from '@xplorer/extension-sdk';

// ---------------------------------------------------------------------------
// Types (mirroring the backend response shapes)
// ---------------------------------------------------------------------------

interface FileCategory {
  name: string;
  file_count: number;
  total_size: number;
  extensions: string[];
  example_files: string[];
}

interface FolderSuggestion {
  suggested_name: string;
  target_path: string;
  files_to_move: string[];
  reason: string;
  category: string;
}

interface DuplicateFileInfo {
  path: string;
  name: string;
  size: number;
  hash: string;
  modified: number;
}

interface DuplicateGroupInfo {
  hash: string;
  size: number;
  files: DuplicateFileInfo[];
  total_wasted_space: number;
}

interface CleanupAction {
  action_type: string;
  files: string[];
  reason: string;
}

interface DuplicateCleanupRec {
  groups: DuplicateGroupInfo[];
  total_wasted_space: number;
  recommendations: CleanupAction[];
}

interface OrganizerFileInfo {
  path: string;
  name: string;
  size: number;
  modified: number;
}

interface CategoryDistribution {
  category: string;
  count: number;
  total_size: number;
}

interface DirectoryInsights {
  total_files: number;
  total_size: number;
  largest_files: OrganizerFileInfo[];
  oldest_files: OrganizerFileInfo[];
  newest_files: OrganizerFileInfo[];
  type_distribution: CategoryDistribution[];
  avg_file_size: number;
}

interface OrganizationAnalysis {
  categories: FileCategory[];
  suggestions: FolderSuggestion[];
  duplicate_summary: DuplicateCleanupRec | null;
  insights: DirectoryInsights;
  is_project: boolean;
  project_type: string | null;
}

interface PlannedMove {
  from: string;
  to: string;
  reason: string;
}

interface OrganizationPlan {
  moves: PlannedMove[];
  creates: string[];
}

// ---------------------------------------------------------------------------
// Backend transport
// ---------------------------------------------------------------------------

/**
 * Invoke a Tauri command via the host-provided transport.
 *
 * Extensions run in a sandbox that blocks direct access to
 * `__TAURI_INTERNALS__`.  The host app exposes a safe invoke
 * proxy at `window.__xplorer_tauri_api__` which the extension
 * can use for commands that are not part of the standard
 * XplorerAPI surface.
 */
async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const w = window as Record<string, unknown>;

  // Primary: host-provided transport proxy
  if (typeof w.__xplorer_tauri_api__ === 'object' && w.__xplorer_tauri_api__ !== null) {
    const api = w.__xplorer_tauri_api__ as { invoke: <R>(cmd: string, args?: Record<string, unknown>) => Promise<R> };
    if (typeof api.invoke === 'function') {
      return api.invoke<T>(command, args);
    }
  }

  // Fallback: try global transport (available when loaded as a builtin)
  if (typeof w.__xplorer_transport__ === 'function') {
    return (w.__xplorer_transport__ as <R>(cmd: string, args?: Record<string, unknown>) => Promise<R>)<T>(command, args);
  }

  // Last resort: try Tauri invoke directly (works outside the sandbox, e.g. dev mode)
  try {
    const core = await import('@tauri-apps/api/core');
    return core.invoke<T>(command, args);
  } catch {
    throw new Error(`[File Organizer] Cannot invoke "${command}": no transport available.`);
  }
}

async function analyzeDirectory(path: string): Promise<OrganizationAnalysis> {
  return tauriInvoke<OrganizationAnalysis>('analyze_directory', { path });
}

async function previewOrganization(path: string, suggestionIndices: number[]): Promise<OrganizationPlan> {
  return tauriInvoke<OrganizationPlan>('preview_organization', { path, suggestionIndices });
}

async function executeOrganization(plan: OrganizationPlan): Promise<number> {
  return tauriInvoke<number>('execute_organization', { plan });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  Images:    'var(--xp-purple, #bb9af7)',
  Videos:    'var(--xp-blue, #7aa2f7)',
  Audio:     'var(--xp-yellow, #e0af68)',
  Documents: 'var(--xp-green, #9ece6a)',
  Code:      'var(--xp-cyan, #7dcfff)',
  Archives:  'var(--xp-red, #f7768e)',
  Data:      'var(--xp-orange, #ff9e64)',
  Other:     'var(--xp-text-secondary, #565f89)',
};

const CATEGORY_ICONS: Record<string, string> = {
  Images:    '\uD83D\uDDBC\uFE0F',
  Videos:    '\uD83C\uDFA5',
  Audio:     '\uD83C\uDFB5',
  Documents: '\uD83D\uDCC4',
  Code:      '\uD83D\uDCBB',
  Archives:  '\uD83D\uDDDC\uFE0F',
  Data:      '\uD83D\uDCC8',
  Other:     '\uD83D\uDCC1',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

function truncatePath(path: string): string {
  const name = path.split(/[\\/]/).pop() || path;
  return name.length > 30 ? name.substring(0, 27) + '...' : name;
}

function parentDir(filePath: string): string {
  const sep = filePath.includes('\\') ? '\\' : '/';
  return filePath.substring(0, filePath.lastIndexOf(sep));
}

// ---------------------------------------------------------------------------
// Inline SVG Icons
// ---------------------------------------------------------------------------

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 20 20" fill="currentColor"
      style={{
        transition: 'transform 150ms ease',
        transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
        flexShrink: 0,
      }}
    >
      <path
        fillRule="evenodd"
        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
      <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        opacity="0.75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
      <style>{`@keyframes fo-spin { to { transform: rotate(360deg); } }`}</style>
      <animateTransform
        attributeName="transform" type="rotate"
        from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0, color: 'var(--xp-blue, #7aa2f7)' }}>
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ title, collapsed, onToggle }: { title: string; collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        width: '100%', padding: '4px 0', marginBottom: 4,
        fontSize: 12, fontWeight: 500,
        color: 'var(--xp-text-muted, #a9b1d6)',
        background: 'none', border: 'none', cursor: 'pointer',
        transition: 'color 150ms ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--xp-text, #c0caf5)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--xp-text-muted, #a9b1d6)'; }}
    >
      <ChevronIcon collapsed={collapsed} />
      {title}
    </button>
  );
}

function SuggestionItem({ suggestion, selected, onToggle }: { suggestion: FolderSuggestion; selected: boolean; onToggle: () => void }) {
  const categoryTag = suggestion.category === 'type' ? '\uD83D\uDCC2' : suggestion.category === 'date' ? '\uD83D\uDCC5' : '\uD83C\uDFF7\uFE0F';

  return (
    <div
      onClick={onToggle}
      style={{
        padding: 8, borderRadius: 6, cursor: 'pointer',
        transition: 'border-color 150ms ease, background-color 150ms ease',
        border: selected
          ? '1px solid var(--xp-blue, #7aa2f7)'
          : '1px solid var(--xp-border, #292e42)',
        backgroundColor: selected
          ? 'rgba(122, 162, 247, 0.1)'
          : 'var(--xp-surface-light, #1f2335)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          onClick={e => e.stopPropagation()}
          style={{ flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12 }}>{categoryTag}</span>
            <span style={{
              fontSize: 12, fontWeight: 500,
              color: 'var(--xp-text, #c0caf5)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {suggestion.suggested_name}/
            </span>
            <span style={{ fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)', flexShrink: 0 }}>
              ({suggestion.files_to_move.length} files)
            </span>
          </div>
          <div style={{
            fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginTop: 2,
          }}>
            {suggestion.reason}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: 8, borderRadius: 6, textAlign: 'center',
      backgroundColor: 'var(--xp-surface-light, #1f2335)',
      border: '1px solid var(--xp-border, #292e42)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--xp-text, #c0caf5)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)' }}>{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Panel Component
// ---------------------------------------------------------------------------

function FileOrganizerPanel({ currentPath, navigateTo }: { currentPath: string; navigateTo?: (path: string) => void }) {
  const [analysis, setAnalysis] = React.useState<OrganizationAnalysis | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = React.useState<Set<number>>(new Set());
  const [preview, setPreview] = React.useState<OrganizationPlan | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [organizing, setOrganizing] = React.useState(false);
  const [expandedCategory, setExpandedCategory] = React.useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = React.useState<Set<string>>(new Set());
  const [lastAnalyzedPath, setLastAnalyzedPath] = React.useState('');

  // ── Analyze ──────────────────────────────────────────────────────────────

  const analyze = React.useCallback(async () => {
    if (!currentPath) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setShowPreview(false);
    setSelectedSuggestions(new Set());
    try {
      const result = await analyzeDirectory(currentPath);
      setAnalysis(result);
      setLastAnalyzedPath(currentPath);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  // Auto-analyze when path changes
  React.useEffect(() => {
    if (currentPath && currentPath !== lastAnalyzedPath) {
      analyze();
    }
  }, [currentPath, lastAnalyzedPath, analyze]);

  // ── Section toggling ────────────────────────────────────────────────────

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const toggleSuggestion = (idx: number) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // ── Preview & organize ─────────────────────────────────────────────────

  const handlePreview = async () => {
    if (selectedSuggestions.size === 0) return;
    try {
      const indices = Array.from(selectedSuggestions);
      const plan = await previewOrganization(currentPath, indices);
      setPreview(plan);
      setShowPreview(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleOrganize = async () => {
    if (!preview) return;
    setOrganizing(true);
    try {
      const count = await executeOrganization(preview);
      setShowPreview(false);
      setPreview(null);
      await analyze();
      setError(null);
      window.dispatchEvent(new CustomEvent('files-changed'));
      alert(`Successfully organized ${count} file${count !== 1 ? 's' : ''}!`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOrganizing(false);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────

  const btnBase: React.CSSProperties = {
    padding: '4px 12px', fontSize: 12, borderRadius: 4,
    cursor: 'pointer', border: 'none', transition: 'background-color 150ms ease, opacity 150ms ease',
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    backgroundColor: 'var(--xp-blue, #7aa2f7)', color: '#fff',
  };

  const btnSecondary: React.CSSProperties = {
    ...btnBase,
    backgroundColor: 'var(--xp-surface-light, #1f2335)',
    border: '1px solid var(--xp-border, #292e42)',
    color: 'var(--xp-text-muted, #a9b1d6)',
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 12, fontSize: 13, color: 'var(--xp-text, #c0caf5)', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontWeight: 500, fontSize: 14, color: 'var(--xp-text, #c0caf5)' }}>
          File Organizer
        </h3>
        <button
          onClick={analyze}
          disabled={loading}
          style={{ ...btnPrimary, opacity: loading ? 0.5 : 1 }}
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginBottom: 12, padding: 8,
          backgroundColor: 'rgba(247, 118, 142, 0.1)',
          border: '1px solid rgba(247, 118, 142, 0.3)',
          borderRadius: 6, color: '#f7768e', fontSize: 12,
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '32px 0', color: 'var(--xp-text-muted, #a9b1d6)',
        }}>
          <SpinnerIcon />
          Scanning directory...
        </div>
      )}

      {/* Analysis results */}
      {!loading && analysis && (
        <>
          {/* ── Categories ─────────────────────────────────────────── */}
          <SectionHeader
            title="Categories"
            collapsed={collapsedSections.has('categories')}
            onToggle={() => toggleSection('categories')}
          />
          {!collapsedSections.has('categories') && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                {analysis.categories.map(cat => (
                  <button
                    key={cat.name}
                    onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)}
                    style={{
                      padding: 8, borderRadius: 6, textAlign: 'left',
                      cursor: 'pointer', transition: 'border-color 150ms ease',
                      background: expandedCategory === cat.name
                        ? 'rgba(122, 162, 247, 0.1)'
                        : 'var(--xp-surface-light, #1f2335)',
                      border: expandedCategory === cat.name
                        ? '1px solid var(--xp-blue, #7aa2f7)'
                        : '1px solid var(--xp-border, #292e42)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>{CATEGORY_ICONS[cat.name] || '\uD83D\uDCC1'}</span>
                      <span style={{
                        fontWeight: 500, fontSize: 12,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: CATEGORY_COLORS[cat.name] || 'var(--xp-text-secondary, #565f89)',
                      }}>
                        {cat.name}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)' }}>
                      {cat.file_count} file{cat.file_count !== 1 ? 's' : ''} &middot; {formatFileSize(cat.total_size)}
                    </div>
                  </button>
                ))}
              </div>

              {/* Expanded category file list */}
              {expandedCategory && (() => {
                const cat = analysis.categories.find(c => c.name === expandedCategory);
                if (!cat) return null;
                return (
                  <div style={{
                    padding: 8, borderRadius: 6, marginBottom: 8,
                    backgroundColor: 'var(--xp-surface-light, #1f2335)',
                    border: '1px solid var(--xp-border, #292e42)',
                  }}>
                    <div style={{
                      fontSize: 12, fontWeight: 500, marginBottom: 4,
                      color: CATEGORY_COLORS[cat.name] || 'var(--xp-text-secondary, #565f89)',
                    }}>
                      {cat.name} files ({cat.extensions.join(', ')})
                    </div>
                    <div style={{ maxHeight: 128, overflowY: 'auto' }}>
                      {cat.example_files.map((file, i) => (
                        <div key={i} style={{
                          fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)',
                          padding: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {file}
                        </div>
                      ))}
                      {cat.file_count > 5 && (
                        <div style={{ fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)', fontStyle: 'italic', marginTop: 4 }}>
                          ...and {cat.file_count - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Project Notice ────────────────────────────────────── */}
          {analysis.is_project && (
            <div style={{
              marginBottom: 16, padding: 10,
              backgroundColor: 'rgba(122, 162, 247, 0.1)',
              border: '1px solid rgba(122, 162, 247, 0.3)',
              borderRadius: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <InfoIcon />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--xp-blue, #7aa2f7)' }}>
                  {analysis.project_type || 'Software'} Project
                </span>
              </div>
              <p style={{
                margin: 0, fontSize: 12, lineHeight: 1.5,
                color: 'var(--xp-text-muted, #a9b1d6)',
              }}>
                This is a project directory. File organization is skipped to avoid breaking the project structure.
              </p>
            </div>
          )}

          {/* ── Smart Suggestions ─────────────────────────────────── */}
          <SectionHeader
            title={`Smart Suggestions (${analysis.suggestions.length})`}
            collapsed={collapsedSections.has('suggestions')}
            onToggle={() => toggleSection('suggestions')}
          />
          {!collapsedSections.has('suggestions') && (
            <div style={{ marginBottom: 16 }}>
              {analysis.suggestions.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)', padding: '8px 0' }}>
                  {analysis.is_project
                    ? 'Organization suggestions disabled for project directories.'
                    : 'No organization suggestions - directory looks well-organized!'}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    {analysis.suggestions.map((suggestion, idx) => (
                      <SuggestionItem
                        key={idx}
                        suggestion={suggestion}
                        selected={selectedSuggestions.has(idx)}
                        onToggle={() => toggleSuggestion(idx)}
                      />
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handlePreview}
                      disabled={selectedSuggestions.size === 0}
                      style={{ ...btnSecondary, flex: 1, opacity: selectedSuggestions.size === 0 ? 0.4 : 1 }}
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => {
                        if (selectedSuggestions.size > 0 && preview) {
                          handleOrganize();
                        } else {
                          handlePreview();
                        }
                      }}
                      disabled={selectedSuggestions.size === 0 || organizing}
                      style={{
                        ...btnPrimary, flex: 1,
                        opacity: (selectedSuggestions.size === 0 || organizing) ? 0.4 : 1,
                      }}
                    >
                      {organizing ? 'Organizing...' : 'Organize'}
                    </button>
                  </div>

                  {/* Preview panel */}
                  {showPreview && preview && (
                    <div style={{
                      marginTop: 8, padding: 8, borderRadius: 6,
                      backgroundColor: 'var(--xp-surface-light, #1f2335)',
                      border: '1px solid rgba(122, 162, 247, 0.3)',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--xp-blue, #7aa2f7)' }}>
                        Preview: {preview.moves.length} file{preview.moves.length !== 1 ? 's' : ''} to move
                      </div>
                      {preview.creates.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)', marginBottom: 4 }}>
                          Will create: {preview.creates.map(p => truncatePath(p)).join(', ')}
                        </div>
                      )}
                      <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {preview.moves.map((move, i) => (
                          <div key={i} style={{
                            fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                            color: 'var(--xp-text-muted, #a9b1d6)',
                          }}>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {truncatePath(move.from)}
                            </span>
                            <span style={{ color: 'var(--xp-blue, #7aa2f7)', flexShrink: 0 }}>&rarr;</span>
                            <span style={{
                              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              color: 'var(--xp-green, #9ece6a)',
                            }}>
                              {truncatePath(move.to)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => { setShowPreview(false); setPreview(null); }}
                          style={{ ...btnSecondary, flex: 1 }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleOrganize}
                          disabled={organizing}
                          style={{
                            ...btnBase, flex: 1,
                            backgroundColor: 'var(--xp-green, #9ece6a)',
                            color: 'var(--xp-bg, #1a1b26)',
                            opacity: organizing ? 0.4 : 1,
                          }}
                        >
                          {organizing ? 'Moving...' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Duplicate Cleanup ────────────────────────────────── */}
          <SectionHeader
            title="Duplicate Cleanup"
            collapsed={collapsedSections.has('duplicates')}
            onToggle={() => toggleSection('duplicates')}
          />
          {!collapsedSections.has('duplicates') && (
            <div style={{ marginBottom: 16 }}>
              {!analysis.duplicate_summary ? (
                <div style={{ fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)', padding: '8px 0' }}>
                  No duplicates found in this directory.
                </div>
              ) : (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 8, padding: 8, borderRadius: 6,
                    backgroundColor: 'var(--xp-surface-light, #1f2335)',
                    border: '1px solid var(--xp-border, #292e42)',
                  }}>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--xp-red, #f7768e)', fontWeight: 500 }}>
                        {analysis.duplicate_summary.groups.length} group{analysis.duplicate_summary.groups.length !== 1 ? 's' : ''}
                      </span>
                      <span style={{ color: 'var(--xp-text-muted, #a9b1d6)' }}> &middot; </span>
                      <span style={{ color: 'var(--xp-yellow, #e0af68)', fontWeight: 500 }}>
                        {formatFileSize(analysis.duplicate_summary.total_wasted_space)} wasted
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {analysis.duplicate_summary.groups.map((group, i) => (
                      <div key={i} style={{
                        padding: 8, borderRadius: 6,
                        backgroundColor: 'var(--xp-surface-light, #1f2335)',
                        border: '1px solid var(--xp-border, #292e42)',
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--xp-text, #c0caf5)', marginBottom: 4 }}>
                          {group.files.length} copies &middot; {formatFileSize(group.size)} each
                        </div>
                        <div style={{ maxHeight: 80, overflowY: 'auto' }}>
                          {group.files.map((file, j) => (
                            <div
                              key={j}
                              style={{
                                fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)',
                                padding: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                cursor: 'pointer',
                              }}
                              onClick={() => {
                                const parent = parentDir(file.path);
                                if (parent && navigateTo) navigateTo(parent);
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--xp-text, #c0caf5)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--xp-text-muted, #a9b1d6)'; }}
                              title={file.path}
                            >
                              {file.name}
                              {j === 0 && <span style={{ color: 'var(--xp-green, #9ece6a)', marginLeft: 4 }}>(newest)</span>}
                            </div>
                          ))}
                        </div>
                        {analysis.duplicate_summary!.recommendations[i] && (
                          <div style={{ fontSize: 12, color: 'var(--xp-yellow, #e0af68)', marginTop: 4, fontStyle: 'italic' }}>
                            {analysis.duplicate_summary!.recommendations[i].reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Insights ─────────────────────────────────────────── */}
          <SectionHeader
            title="Insights"
            collapsed={collapsedSections.has('insights')}
            onToggle={() => toggleSection('insights')}
          />
          {!collapsedSections.has('insights') && (
            <div style={{ marginBottom: 16 }}>
              {/* Stats cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                <StatCard label="Files" value={analysis.insights.total_files.toString()} />
                <StatCard label="Size" value={formatFileSize(analysis.insights.total_size)} />
                <StatCard label="Avg" value={formatFileSize(analysis.insights.avg_file_size)} />
              </div>

              {/* Type distribution bar */}
              {analysis.insights.type_distribution.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)', marginBottom: 4 }}>
                    Type distribution
                  </div>
                  <div style={{
                    display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden',
                    backgroundColor: 'var(--xp-surface-light, #1f2335)',
                  }}>
                    {analysis.insights.type_distribution.map(td => {
                      const pct = analysis.insights.total_files > 0
                        ? (td.count / analysis.insights.total_files) * 100
                        : 0;
                      if (pct < 1) return null;
                      return (
                        <div
                          key={td.category}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: CATEGORY_COLORS[td.category] || 'var(--xp-text-secondary, #565f89)',
                            transition: 'width 300ms ease',
                          }}
                          title={`${td.category}: ${td.count} files (${pct.toFixed(1)}%)`}
                        />
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', marginTop: 4 }}>
                    {analysis.insights.type_distribution.map(td => (
                      <div key={td.category} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)' }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                          backgroundColor: CATEGORY_COLORS[td.category] || 'var(--xp-text-secondary, #565f89)',
                        }} />
                        {td.category} ({td.count})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Largest files */}
              {analysis.insights.largest_files.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)', marginBottom: 4 }}>
                    Largest files
                  </div>
                  {analysis.insights.largest_files.map((file, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '2px 4px', cursor: 'pointer', borderRadius: 4,
                      }}
                      onClick={() => {
                        const parent = parentDir(file.path);
                        if (parent && navigateTo) navigateTo(parent);
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-surface-light, #1f2335)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      title={file.path}
                    >
                      <span style={{
                        fontSize: 12, color: 'var(--xp-text, #c0caf5)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, marginRight: 8,
                      }}>
                        {file.name}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)', flexShrink: 0 }}>
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Oldest files */}
              {analysis.insights.oldest_files.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)', marginBottom: 4 }}>
                    Oldest files
                  </div>
                  {analysis.insights.oldest_files.map((file, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '2px 4px', cursor: 'pointer', borderRadius: 4,
                      }}
                      onClick={() => {
                        const parent = parentDir(file.path);
                        if (parent && navigateTo) navigateTo(parent);
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-surface-light, #1f2335)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      title={file.path}
                    >
                      <span style={{
                        fontSize: 12, color: 'var(--xp-text, #c0caf5)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, marginRight: 8,
                      }}>
                        {file.name}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--xp-text-muted, #a9b1d6)', flexShrink: 0 }}>
                        {file.modified > 0 ? new Date(file.modified * 1000).toLocaleDateString() : 'Unknown'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !analysis && !error && (
        <div style={{
          textAlign: 'center', padding: '32px 0',
          color: 'var(--xp-text-muted, #a9b1d6)', fontSize: 12,
        }}>
          Click "Analyze" to scan the current directory
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Extension Registration
// ---------------------------------------------------------------------------

let xplorerApi: XplorerAPI;

Sidebar.register({
  id: 'file-organizer',
  title: 'File Organizer',
  description: 'AI-powered file organization suggestions',
  icon: 'folder',
  location: 'right',
  permissions: ['file:read', 'file:write', 'ui:panels'],

  render: (props: SidebarRenderProps) => {
    const currentPath = (props.currentPath as string) || '';

    // Build a navigate function from either the injected API or props
    const navigateTo = React.useCallback((path: string) => {
      if (xplorerApi?.navigation?.navigateTo) {
        xplorerApi.navigation.navigateTo(path);
      }
    }, []);

    return React.createElement(FileOrganizerPanel, { currentPath, navigateTo });
  },

  onActivate: (api: XplorerAPI) => {
    xplorerApi = api;
  },
});
