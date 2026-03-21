import React, { useState, useCallback, useEffect } from 'react';
import { TauriAPI, type OrganizationAnalysis, type OrganizationPlan } from '@/lib/tauri-api';
import { formatFileSize } from '@/lib/utils';
import { FolderClosed, ChevronDown, ChevronRight } from 'lucide-react';
import { usePerformanceStats, type CleanupSuggestion } from '@/hooks/use-performance-stats';
import {
  cardStyle,
  cardTitleStyle,
  smallBtnStyle,
  suggestionRowStyle,
  sectionHeaderStyle,
  StatRow,
  ProgressBar,
  opColor,
  formatRelativeTime,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  OrganizerSectionHeader,
  OrganizerSuggestionItem,
  type PerformanceDashboardProps,
} from './performance-dashboard-helpers';

// ── Organizer Tab Content ────────────────────────────────────────────────────

const OrganizerTabContent = React.memo(function OrganizerTabContent({
  currentPath,
  navigateToPath,
}: {
  currentPath: string;
  navigateToPath?: (path: string) => void;
}) {
  const [analysis, setAnalysis] = useState<OrganizationAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<OrganizationPlan | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [lastAnalyzedPath, setLastAnalyzedPath] = useState<string>('');

  const analyze = useCallback(async () => {
    if (!currentPath) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setShowPreview(false);
    setSelectedSuggestions(new Set());
    try {
      const result = await TauriAPI.analyzeDirectory(currentPath);
      setAnalysis(result);
      setLastAnalyzedPath(currentPath);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  // Auto-analyze when path changes
  useEffect(() => {
    if (currentPath && currentPath !== lastAnalyzedPath) {
      analyze();
    }
  }, [currentPath, lastAnalyzedPath, analyze]);

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const toggleSuggestion = (idx: number) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handlePreview = async () => {
    if (selectedSuggestions.size === 0) return;
    try {
      const indices = Array.from(selectedSuggestions);
      const plan = await TauriAPI.previewOrganization(currentPath, indices);
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
      const count = await TauriAPI.executeOrganization(preview);
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

  const truncatePath = (path: string) => {
    const name = path.split(/[\\/]/).pop() || path;
    return name.length > 30 ? `${name.substring(0, 27)}...` : name;
  };

  return (
    <div
      style={{
        padding: '10px 12px',
        overflowY: 'auto',
        overflowX: 'hidden',
        flex: '1 1 0%',
        minHeight: 0,
      }}
    >
      {/* Header with analyze button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--xp-text)' }}>
          File Organizer
        </span>
        <button
          onClick={analyze}
          disabled={loading}
          style={{
            ...smallBtnStyle,
            opacity: loading ? 0.5 : 1,
            background: 'var(--xp-blue, #3b82f6)',
            color: '#fff',
            border: 'none',
          }}
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {error && (
        <div
          style={{
            ...cardStyle,
            background: 'rgba(239,68,68,0.08)',
            borderColor: 'rgba(239,68,68,0.3)',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 12, color: '#f87171' }}>{error}</span>
        </div>
      )}

      {loading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 0',
            color: 'var(--xp-text-secondary)',
            fontSize: 12,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            style={{ marginRight: 8, animation: 'spin 1s linear infinite' }}
          >
            <circle
              opacity="0.25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              opacity="0.75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Scanning directory...
        </div>
      )}

      {!loading && analysis && (
        <>
          {/* Categories Section */}
          <OrganizerSectionHeader
            title="Categories"
            collapsed={collapsedSections.has('categories')}
            onToggle={() => toggleSection('categories')}
          />
          {!collapsedSections.has('categories') && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}
              >
                {analysis.categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() =>
                      setExpandedCategory(expandedCategory === cat.name ? null : cat.name)
                    }
                    style={{
                      ...cardStyle,
                      marginBottom: 0,
                      padding: '8px 10px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderColor:
                        expandedCategory === cat.name
                          ? 'var(--xp-blue, #3b82f6)'
                          : 'var(--xp-border)',
                      background:
                        expandedCategory === cat.name
                          ? 'rgba(59, 130, 246, 0.08)'
                          : 'var(--xp-surface-light)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center' }}>
                        {CATEGORY_ICONS[cat.name] || (
                          <FolderClosed size={14} className="inline-block" />
                        )}
                      </span>
                      <span
                        style={{
                          fontWeight: 500,
                          fontSize: 12,
                          color: CATEGORY_COLORS[cat.name] || 'var(--xp-text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cat.name}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--xp-text-secondary)' }}>
                      {cat.file_count} file{cat.file_count !== 1 ? 's' : ''} &middot;{' '}
                      {formatFileSize(cat.total_size)}
                    </div>
                  </button>
                ))}
              </div>

              {/* Expanded category file list */}
              {expandedCategory &&
                (() => {
                  const cat = analysis.categories.find((c) => c.name === expandedCategory);
                  if (!cat) return null;
                  return (
                    <div
                      style={{
                        ...cardStyle,
                        marginBottom: 8,
                        borderColor: 'var(--xp-blue, #3b82f6)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          marginBottom: 4,
                          color: CATEGORY_COLORS[cat.name] || 'var(--xp-text-secondary)',
                        }}
                      >
                        {cat.name} files ({cat.extensions.join(', ')})
                      </div>
                      <div style={{ maxHeight: 128, overflowY: 'auto' }}>
                        {cat.example_files.map((file, i) => (
                          <div
                            // eslint-disable-next-line react/no-array-index-key
                            key={i}
                            style={{
                              fontSize: 11,
                              color: 'var(--xp-text-secondary)',
                              padding: '2px 0',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {file}
                          </div>
                        ))}
                        {cat.file_count > 5 && (
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--xp-text-secondary)',
                              fontStyle: 'italic',
                              marginTop: 4,
                            }}
                          >
                            ...and {cat.file_count - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}

          {/* Project Notice */}
          {analysis.is_project && (
            <div
              style={{
                ...cardStyle,
                marginBottom: 16,
                background: 'rgba(59,130,246,0.08)',
                borderColor: 'rgba(59,130,246,0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="#3b82f6">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#3b82f6' }}>
                  {analysis.project_type || 'Software'} Project
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--xp-text-secondary)', lineHeight: 1.5 }}>
                This is a project directory. File organization is skipped to avoid breaking the
                project structure.
              </p>
            </div>
          )}

          {/* Smart Suggestions Section */}
          <OrganizerSectionHeader
            title={`Smart Suggestions (${analysis.suggestions.length})`}
            collapsed={collapsedSections.has('suggestions')}
            onToggle={() => toggleSection('suggestions')}
          />
          {!collapsedSections.has('suggestions') && (
            <div style={{ marginBottom: 16 }}>
              {analysis.suggestions.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--xp-text-secondary)', padding: '8px 0' }}>
                  {analysis.is_project
                    ? 'Organization suggestions disabled for project directories.'
                    : 'No organization suggestions - directory looks well-organized!'}
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 8 }}>
                    {analysis.suggestions.map((suggestion, idx) => (
                      <OrganizerSuggestionItem
                        // eslint-disable-next-line react/no-array-index-key
                        key={idx}
                        suggestion={suggestion}
                        selected={selectedSuggestions.has(idx)}
                        onToggle={() => toggleSuggestion(idx)}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handlePreview}
                      disabled={selectedSuggestions.size === 0}
                      style={{
                        ...smallBtnStyle,
                        flex: 1,
                        textAlign: 'center',
                        opacity: selectedSuggestions.size === 0 ? 0.4 : 1,
                      }}
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => {
                        if (selectedSuggestions.size > 0 && preview) {
                          handleOrganize();
                        } else {
                          handlePreview().then(() => {});
                        }
                      }}
                      disabled={selectedSuggestions.size === 0 || organizing}
                      style={{
                        ...smallBtnStyle,
                        flex: 1,
                        textAlign: 'center',
                        background: 'var(--xp-blue, #3b82f6)',
                        color: '#fff',
                        border: 'none',
                        opacity: selectedSuggestions.size === 0 || organizing ? 0.4 : 1,
                      }}
                    >
                      {organizing ? 'Organizing...' : 'Organize'}
                    </button>
                  </div>

                  {/* Preview panel */}
                  {showPreview && preview && (
                    <div
                      style={{ ...cardStyle, marginTop: 8, borderColor: 'rgba(59,130,246,0.3)' }}
                    >
                      <div
                        style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#3b82f6' }}
                      >
                        Preview: {preview.moves.length} file{preview.moves.length !== 1 ? 's' : ''}{' '}
                        to move
                      </div>
                      {preview.creates.length > 0 && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--xp-text-secondary)',
                            marginBottom: 4,
                          }}
                        >
                          Will create: {preview.creates.map((p) => truncatePath(p)).join(', ')}
                        </div>
                      )}
                      <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                        {preview.moves.map((move, i) => (
                          <div
                            // eslint-disable-next-line react/no-array-index-key
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              color: 'var(--xp-text-secondary)',
                              padding: '2px 0',
                            }}
                          >
                            <span
                              style={{
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {truncatePath(move.from)}
                            </span>
                            <span style={{ color: '#3b82f6', flexShrink: 0 }}>&rarr;</span>
                            <span
                              style={{
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: '#22c55e',
                              }}
                            >
                              {truncatePath(move.to)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => {
                            setShowPreview(false);
                            setPreview(null);
                          }}
                          style={{ ...smallBtnStyle, flex: 1, textAlign: 'center' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleOrganize}
                          disabled={organizing}
                          style={{
                            ...smallBtnStyle,
                            flex: 1,
                            textAlign: 'center',
                            background: '#22c55e',
                            color: '#000',
                            border: 'none',
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

          {/* Duplicate Cleanup Section */}
          <OrganizerSectionHeader
            title="Duplicate Cleanup"
            collapsed={collapsedSections.has('duplicates')}
            onToggle={() => toggleSection('duplicates')}
          />
          {!collapsedSections.has('duplicates') && (
            <div style={{ marginBottom: 16 }}>
              {!analysis.duplicate_summary ? (
                <div style={{ fontSize: 12, color: 'var(--xp-text-secondary)', padding: '8px 0' }}>
                  No duplicates found in this directory.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      ...cardStyle,
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: '#ef4444', fontWeight: 500 }}>
                        {analysis.duplicate_summary.groups.length} group
                        {analysis.duplicate_summary.groups.length !== 1 ? 's' : ''}
                      </span>
                      <span style={{ color: 'var(--xp-text-secondary)' }}> &middot; </span>
                      <span style={{ color: '#eab308', fontWeight: 500 }}>
                        {formatFileSize(analysis.duplicate_summary.total_wasted_space)} wasted
                      </span>
                    </div>
                  </div>
                  {analysis.duplicate_summary.groups.map((group, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i} style={{ ...cardStyle, marginBottom: 4 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'var(--xp-text)',
                          marginBottom: 4,
                        }}
                      >
                        {group.files.length} copies &middot; {formatFileSize(group.size)} each
                      </div>
                      <div style={{ maxHeight: 80, overflowY: 'auto' }}>
                        {group.files.map((file, j) => (
                          <div
                            // eslint-disable-next-line react/no-array-index-key
                            key={j}
                            onClick={() => {
                              const sep = file.path.includes('\\') ? '\\' : '/';
                              const parent = file.path.substring(0, file.path.lastIndexOf(sep));
                              if (parent && navigateToPath) navigateToPath(parent);
                            }}
                            title={file.path}
                            style={{
                              fontSize: 11,
                              color: 'var(--xp-text-secondary)',
                              padding: '2px 0',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                            }}
                          >
                            {file.name}
                            {j === 0 && (
                              <span style={{ color: '#22c55e', marginLeft: 4 }}>(newest)</span>
                            )}
                          </div>
                        ))}
                      </div>
                      {analysis.duplicate_summary!.recommendations[i] && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#eab308',
                            marginTop: 4,
                            fontStyle: 'italic',
                          }}
                        >
                          {analysis.duplicate_summary!.recommendations[i].reason}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Insights Section */}
          <OrganizerSectionHeader
            title="Insights"
            collapsed={collapsedSections.has('insights')}
            onToggle={() => toggleSection('insights')}
          />
          {!collapsedSections.has('insights') && (
            <div style={{ marginBottom: 16 }}>
              {/* Stats cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {[
                  { label: 'Files', value: analysis.insights.total_files.toString() },
                  { label: 'Size', value: formatFileSize(analysis.insights.total_size) },
                  { label: 'Avg', value: formatFileSize(analysis.insights.avg_file_size) },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      ...cardStyle,
                      marginBottom: 0,
                      textAlign: 'center',
                      padding: '8px 6px',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--xp-text)' }}>
                      {value}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--xp-text-secondary)' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Type distribution bar */}
              {analysis.insights.type_distribution.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--xp-text-secondary)', marginBottom: 4 }}>
                    Type distribution
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      height: 16,
                      borderRadius: 4,
                      overflow: 'hidden',
                      background: 'var(--xp-surface-light)',
                    }}
                  >
                    {analysis.insights.type_distribution.map((td) => {
                      const pct =
                        analysis.insights.total_files > 0
                          ? (td.count / analysis.insights.total_files) * 100
                          : 0;
                      if (pct < 1) return null;
                      return (
                        <div
                          key={td.category}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: CATEGORY_COLORS[td.category] || '#94a3b8',
                            transition: 'width 0.3s ease',
                          }}
                          title={`${td.category}: ${td.count} files (${pct.toFixed(1)}%)`}
                        />
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', marginTop: 4 }}>
                    {analysis.insights.type_distribution.map((td) => (
                      <div
                        key={td.category}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          color: 'var(--xp-text-secondary)',
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            display: 'inline-block',
                            backgroundColor: CATEGORY_COLORS[td.category] || '#94a3b8',
                          }}
                        />
                        {td.category} ({td.count})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Largest files */}
              {analysis.insights.largest_files.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--xp-text-secondary)', marginBottom: 4 }}>
                    Largest files
                  </div>
                  {analysis.insights.largest_files.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => {
                        const sep = file.path.includes('\\') ? '\\' : '/';
                        const parent = file.path.substring(0, file.path.lastIndexOf(sep));
                        if (parent && navigateToPath) navigateToPath(parent);
                      }}
                      title={file.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '2px 4px',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--xp-text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          marginRight: 8,
                        }}
                      >
                        {file.name}
                      </span>
                      <span
                        style={{ fontSize: 11, color: 'var(--xp-text-secondary)', flexShrink: 0 }}
                      >
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Oldest files */}
              {analysis.insights.oldest_files.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--xp-text-secondary)', marginBottom: 4 }}>
                    Oldest files
                  </div>
                  {analysis.insights.oldest_files.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => {
                        const sep = file.path.includes('\\') ? '\\' : '/';
                        const parent = file.path.substring(0, file.path.lastIndexOf(sep));
                        if (parent && navigateToPath) navigateToPath(parent);
                      }}
                      title={file.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '2px 4px',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--xp-text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          marginRight: 8,
                        }}
                      >
                        {file.name}
                      </span>
                      <span
                        style={{ fontSize: 11, color: 'var(--xp-text-secondary)', flexShrink: 0 }}
                      >
                        {file.modified > 0
                          ? new Date(file.modified * 1000).toLocaleDateString()
                          : 'Unknown'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!loading && !analysis && !error && (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 0',
            color: 'var(--xp-text-secondary)',
            fontSize: 12,
          }}
        >
          Click "Analyze" to scan the current directory
        </div>
      )}
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

const PerformanceDashboard = React.memo(function PerformanceDashboard({
  currentPath,
  allFiles,
  navigateToPath,
}: PerformanceDashboardProps) {
  const [metricsExpanded, setMetricsExpanded] = useState(true);
  const [organizerExpanded, setOrganizerExpanded] = useState(true);

  const {
    directoryStats,
    indexingStatus,
    recentOps,
    suggestions,
    memoryUsage,
    isLoading,
    refreshStats,
  } = usePerformanceStats(currentPath, allFiles, true);

  const handleReindex = useCallback(async () => {
    try {
      await TauriAPI.rebuildTokenIndex();
    } catch {
      // silently fail
    }
    refreshStats();
  }, [refreshStats]);

  const handleEmptyTrash = useCallback(async () => {
    try {
      await TauriAPI.emptyTrash();
    } catch {
      // silently fail
    }
    refreshStats();
  }, [refreshStats]);

  const handleSuggestionAction = useCallback(
    (suggestion: CleanupSuggestion) => {
      if (suggestion.id === 'trash') {
        handleEmptyTrash();
      } else if (suggestion.id === 'large-files' && navigateToPath) {
        navigateToPath(currentPath);
      } else if (suggestion.id === 'untagged' && navigateToPath) {
        navigateToPath(currentPath);
      }
    },
    [handleEmptyTrash, navigateToPath, currentPath],
  );

  const handleCollapseAll = useCallback(() => {
    setMetricsExpanded(false);
    setOrganizerExpanded(false);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Single scrollable container for both sections */}
      <div
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: '1 1 0%',
          minHeight: 0,
        }}
      >
        {/* ── Performance Metrics Section ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => setMetricsExpanded((v) => !v)}
              className="hover:bg-xp-surface-light"
              style={sectionHeaderStyle}
            >
              {metricsExpanded ? (
                <ChevronDown size={14} style={{ flexShrink: 0 }} />
              ) : (
                <ChevronRight size={14} style={{ flexShrink: 0 }} />
              )}
              Performance Metrics
            </button>
            <button
              onClick={handleCollapseAll}
              style={{
                fontSize: 10,
                color: 'var(--xp-text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                opacity: 0.7,
                transition: 'opacity 0.15s',
              }}
              title="Collapse all sections"
            >
              collapse all
            </button>
          </div>

          {metricsExpanded && (
            <div style={{ padding: '4px 12px 10px' }}>
              {/* Header with refresh */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <button
                  onClick={refreshStats}
                  disabled={isLoading}
                  style={{
                    ...smallBtnStyle,
                    opacity: isLoading ? 0.5 : 1,
                  }}
                  title="Refresh stats"
                >
                  {isLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {/* System Stats Card */}
              <div style={cardStyle}>
                <div style={cardTitleStyle}>System Stats</div>
                <StatRow label="Files" value={directoryStats.fileCount.toLocaleString()} />
                <StatRow label="Folders" value={directoryStats.folderCount.toLocaleString()} />
                <StatRow label="Total Size" value={formatFileSize(directoryStats.totalSize)} />
                <StatRow
                  label="Folders Cached"
                  value={`${directoryStats.cachedFolderCount} folders`}
                />
                {memoryUsage !== null && (
                  <StatRow label="JS Heap Usage" value={formatFileSize(memoryUsage)} />
                )}
              </div>

              {/* Indexing Status Card */}
              <div style={cardStyle}>
                <div style={cardTitleStyle}>Indexing Status</div>

                {/* AI Indexer */}
                <div style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--xp-text-secondary)' }}>
                      AI Indexer
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: indexingStatus.isAiProcessing
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'rgba(34, 197, 94, 0.15)',
                        color: indexingStatus.isAiProcessing ? '#60a5fa' : '#4ade80',
                      }}
                    >
                      {indexingStatus.isAiProcessing ? 'Indexing' : 'Idle'}
                    </span>
                  </div>
                  <StatRow
                    label="Indexed Files"
                    value={indexingStatus.aiIndexed.toLocaleString()}
                  />
                  {indexingStatus.aiQueueLength > 0 && (
                    <StatRow label="Queue" value={indexingStatus.aiQueueLength.toLocaleString()} />
                  )}
                  {indexingStatus.isAiProcessing && indexingStatus.currentAiFile && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--xp-text-secondary)',
                        marginTop: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={indexingStatus.currentAiFile}
                    >
                      Current: {indexingStatus.currentAiFile.split(/[\\/]/).pop()}
                    </div>
                  )}
                  {indexingStatus.isAiProcessing && indexingStatus.aiQueueLength > 0 && (
                    <ProgressBar
                      value={indexingStatus.aiIndexed}
                      max={indexingStatus.aiIndexed + indexingStatus.aiQueueLength}
                      color="#3b82f6"
                    />
                  )}
                </div>

                {/* Separator */}
                <div style={{ borderTop: '1px solid var(--xp-border)', margin: '8px 0' }} />

                {/* Search Tokenizer */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--xp-text-secondary)' }}>
                      Search Tokenizer
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: indexingStatus.isTokenizerIndexing
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'rgba(34, 197, 94, 0.15)',
                        color: indexingStatus.isTokenizerIndexing ? '#60a5fa' : '#4ade80',
                      }}
                    >
                      {indexingStatus.isTokenizerIndexing ? 'Indexing' : 'Ready'}
                    </span>
                  </div>
                  <StatRow
                    label="Indexed Files"
                    value={indexingStatus.tokenTotalFiles.toLocaleString()}
                  />
                  <StatRow
                    label="Total Tokens"
                    value={indexingStatus.tokenTotalTokens.toLocaleString()}
                  />
                  {indexingStatus.tokenLastUpdated > 0 && (
                    <StatRow
                      label="Last Updated"
                      value={new Date(indexingStatus.tokenLastUpdated * 1000).toLocaleTimeString()}
                    />
                  )}
                  {indexingStatus.isTokenizerIndexing && (
                    <ProgressBar value={70} max={100} color="#22c55e" />
                  )}
                </div>

                {/* Reindex button */}
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleReindex}
                    disabled={indexingStatus.isTokenizerIndexing}
                    style={{
                      ...smallBtnStyle,
                      opacity: indexingStatus.isTokenizerIndexing ? 0.5 : 1,
                    }}
                  >
                    Reindex
                  </button>
                </div>
              </div>

              {/* Recent Operations Card */}
              <div style={cardStyle}>
                <div style={cardTitleStyle}>Recent Operations</div>

                {recentOps.length === 0 ? (
                  <div
                    style={{ fontSize: 12, color: 'var(--xp-text-secondary)', padding: '4px 0' }}
                  >
                    No recent operations
                  </div>
                ) : (
                  <>
                    {/* Mini timeline */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        marginBottom: 10,
                        padding: '4px 0',
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: 2,
                          background: 'var(--xp-border)',
                          borderRadius: 1,
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-evenly',
                        }}
                      >
                        {recentOps.map((op, i) => (
                          <div
                            key={op.id || i}
                            title={`${op.operation} - ${op.success ? 'success' : 'failed'}`}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: opColor(op.operation, op.success),
                              border: '1px solid var(--xp-surface)',
                              flexShrink: 0,
                              cursor: 'default',
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Operation list */}
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {recentOps.map((op, i) => (
                        <div
                          key={op.id || i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 0',
                            borderBottom:
                              i < recentOps.length - 1 ? '1px solid var(--xp-border)' : 'none',
                            fontSize: 12,
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: opColor(op.operation, op.success),
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: 'var(--xp-text)',
                            }}
                            title={op.details || op.operation}
                          >
                            {op.operation}
                          </span>
                          {op.paths.length > 0 && (
                            <span
                              style={{
                                color: 'var(--xp-text-secondary)',
                                fontSize: 11,
                                flexShrink: 0,
                              }}
                            >
                              {op.paths.length} file{op.paths.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          <span
                            style={{
                              color: 'var(--xp-text-secondary)',
                              fontSize: 11,
                              flexShrink: 0,
                            }}
                          >
                            {formatRelativeTime(op.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Cleanup Suggestions Card */}
              {suggestions.length > 0 && (
                <div style={cardStyle}>
                  <div style={cardTitleStyle}>Cleanup Suggestions</div>
                  {suggestions.map((s, i) => (
                    <div
                      key={s.id}
                      style={{
                        ...suggestionRowStyle,
                        borderBottom:
                          i < suggestions.length - 1 ? '1px solid var(--xp-border)' : 'none',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--xp-text)',
                            fontWeight: 500,
                          }}
                        >
                          {s.title}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--xp-text-secondary)',
                            marginTop: 2,
                          }}
                        >
                          {s.description}
                          {s.estimatedSize > 0 && (
                            <span style={{ marginLeft: 4 }}>
                              ({formatFileSize(s.estimatedSize)})
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => handleSuggestionAction(s)} style={smallBtnStyle}>
                        {s.actionLabel}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── File Organizer Section ── */}
        <div>
          <button
            onClick={() => setOrganizerExpanded((v) => !v)}
            className="hover:bg-xp-surface-light"
            style={sectionHeaderStyle}
          >
            {organizerExpanded ? (
              <ChevronDown size={14} style={{ flexShrink: 0 }} />
            ) : (
              <ChevronRight size={14} style={{ flexShrink: 0 }} />
            )}
            File Organizer
          </button>

          {organizerExpanded && (
            <OrganizerTabContent currentPath={currentPath} navigateToPath={navigateToPath} />
          )}
        </div>
      </div>
    </div>
  );
});

export default PerformanceDashboard;
