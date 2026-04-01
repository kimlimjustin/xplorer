/**
 * Folder Statistics Extension
 *
 * Demonstrates: Sidebar.register() for panel UI, api.files.list() for
 * directory reading, bar chart visualization, dynamic updates.
 *
 * Usage: Open the "Folder Stats" panel from the extensions bar.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Types ───────────────────────────────────────────────────────────────────

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extension: string;
}

interface TypeStats {
  extension: string;
  count: number;
  totalSize: number;
  color: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const EXTENSION_COLORS: Record<string, string> = {
  // Documents
  pdf: '#f7768e', doc: '#f7768e', docx: '#f7768e', txt: '#c0caf5', md: '#c0caf5',
  // Images
  png: '#bb9af7', jpg: '#bb9af7', jpeg: '#bb9af7', gif: '#bb9af7', svg: '#bb9af7', webp: '#bb9af7',
  // Code
  js: '#e0af68', ts: '#7aa2f7', tsx: '#7aa2f7', jsx: '#e0af68', py: '#9ece6a', rs: '#ff9e64',
  css: '#73daca', html: '#ff9e64', json: '#e0af68', xml: '#ff9e64',
  // Media
  mp4: '#f7768e', mp3: '#73daca', wav: '#73daca', avi: '#f7768e',
  // Archives
  zip: '#e0af68', rar: '#e0af68', '7z': '#e0af68', tar: '#e0af68', gz: '#e0af68',
  // Other
  exe: '#f7768e', dll: '#565f89', sys: '#565f89',
};

function getExtColor(ext: string): string {
  return EXTENSION_COLORS[ext.toLowerCase()] || '#565f89';
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return 'Unknown';
  const d = new Date(timestamp * 1000);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Components ──────────────────────────────────────────────────────────────

function BarChart({ stats, maxCount }: { stats: TypeStats[]; maxCount: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {stats.map((s) => (
        <div key={s.extension} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ width: 50, textAlign: 'right' as const, color: s.color, fontFamily: 'monospace', flexShrink: 0 }}>
            .{s.extension}
          </span>
          <div style={{
            flex: 1, height: 16, borderRadius: 3,
            background: 'var(--xp-surface-light, #1e1e2e)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.max(2, (s.count / maxCount) * 100)}%`,
              height: '100%',
              background: s.color,
              opacity: 0.7,
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ width: 30, fontSize: 11, color: 'var(--xp-text-muted, #888)', flexShrink: 0 }}>
            {s.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function FolderStatsPanel({ currentPath }: { currentPath: string }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentPath || currentPath.startsWith('xplorer://') || currentPath.startsWith('gdrive://')) {
      setFiles([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api.files.list(currentPath)
      .then((result) => {
        if (!cancelled) {
          setFiles(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [currentPath]);

  const stats = useMemo(() => {
    const fileOnly = files.filter(f => !f.is_dir);
    const dirOnly = files.filter(f => f.is_dir);
    const totalSize = fileOnly.reduce((sum, f) => sum + (f.size || 0), 0);

    // Group by extension
    const extMap = new Map<string, { count: number; totalSize: number }>();
    for (const f of fileOnly) {
      const ext = f.extension || f.name.split('.').pop()?.toLowerCase() || 'no-ext';
      const entry = extMap.get(ext) || { count: 0, totalSize: 0 };
      entry.count++;
      entry.totalSize += f.size || 0;
      extMap.set(ext, entry);
    }

    const typeStats: TypeStats[] = Array.from(extMap.entries())
      .map(([ext, data]) => ({ extension: ext, count: data.count, totalSize: data.totalSize, color: getExtColor(ext) }))
      .sort((a, b) => b.count - a.count);

    // Top 5 largest files
    const largest = [...fileOnly].sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 5);

    // Newest and oldest
    const withDates = fileOnly.filter(f => f.modified);
    const newest = withDates.length > 0 ? withDates.reduce((a, b) => (a.modified > b.modified ? a : b)) : null;
    const oldest = withDates.length > 0 ? withDates.reduce((a, b) => (a.modified < b.modified ? a : b)) : null;

    return { fileCount: fileOnly.length, dirCount: dirOnly.length, totalSize, typeStats, largest, newest, oldest };
  }, [files]);

  const folderName = currentPath.split(/[/\\]/).filter(Boolean).pop() || currentPath;

  if (loading) {
    return (
      <div style={{ padding: 16, color: 'var(--xp-text-muted, #888)', fontSize: 13 }}>
        Loading statistics...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, color: 'var(--xp-red, #f7768e)', fontSize: 13 }}>
        Error: {error}
      </div>
    );
  }

  if (!currentPath || currentPath.startsWith('xplorer://')) {
    return (
      <div style={{ padding: 16, color: 'var(--xp-text-muted, #888)', fontSize: 13, textAlign: 'center' as const }}>
        <div style={{ marginBottom: 8, fontSize: 24 }}>📊</div>
        Navigate to a folder to see statistics
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', fontSize: 13, color: 'var(--xp-text, #c0caf5)' }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--xp-border, #333)',
        fontWeight: 600,
        fontSize: 12,
      }}>
        📁 {folderName}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '12px 12px 8px' }}>
        {[
          { label: 'Files', value: String(stats.fileCount), color: 'var(--xp-blue, #7aa2f7)' },
          { label: 'Folders', value: String(stats.dirCount), color: 'var(--xp-green, #9ece6a)' },
          { label: 'Total Size', value: formatSize(stats.totalSize), color: 'var(--xp-orange, #ff9e64)' },
          { label: 'Types', value: String(stats.typeStats.length), color: 'var(--xp-purple, #bb9af7)' },
        ].map((card) => (
          <div key={card.label} style={{
            background: 'var(--xp-surface-light, #1e1e2e)',
            borderRadius: 6,
            padding: '8px 10px',
            textAlign: 'center' as const,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 10, color: 'var(--xp-text-muted, #888)', marginTop: 2 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* File type distribution */}
      {stats.typeStats.length > 0 && (
        <div style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--xp-text-muted, #888)', marginBottom: 8, textTransform: 'uppercase' as const }}>
            File Types
          </div>
          <BarChart
            stats={stats.typeStats.slice(0, 10)}
            maxCount={stats.typeStats[0]?.count || 1}
          />
        </div>
      )}

      {/* Top 5 largest files */}
      {stats.largest.length > 0 && (
        <div style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--xp-text-muted, #888)', marginBottom: 8, textTransform: 'uppercase' as const }}>
            Largest Files
          </div>
          {stats.largest.map((f, i) => (
            <div key={f.path} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '4px 0', fontSize: 12,
              borderBottom: i < stats.largest.length - 1 ? '1px solid var(--xp-surface-light, #1e1e2e)' : 'none',
            }}>
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1, marginRight: 8,
              }}>
                {f.name}
              </span>
              <span style={{ color: 'var(--xp-text-muted, #888)', flexShrink: 0, fontFamily: 'monospace', fontSize: 11 }}>
                {formatSize(f.size || 0)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Dates */}
      {(stats.newest || stats.oldest) && (
        <div style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--xp-text-muted, #888)', marginBottom: 8, textTransform: 'uppercase' as const }}>
            Timeline
          </div>
          {stats.newest && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
              <span style={{ color: 'var(--xp-green, #9ece6a)' }}>Newest</span>
              <span style={{ color: 'var(--xp-text-muted, #888)' }}>
                {stats.newest.name} ({formatDate(stats.newest.modified)})
              </span>
            </div>
          )}
          {stats.oldest && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
              <span style={{ color: 'var(--xp-orange, #ff9e64)' }}>Oldest</span>
              <span style={{ color: 'var(--xp-text-muted, #888)' }}>
                {stats.oldest.name} ({formatDate(stats.oldest.modified)})
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Extension Registration ──────────────────────────────────────────────────

let api: XplorerAPI;

Sidebar.register({
  id: 'xplorer-folder-stats',
  title: 'Folder Stats',
  description: 'File type distribution, size breakdown, and top files for the current directory',
  icon: 'bar-chart-3',
  permissions: ['file:read', 'directory:list', 'ui:panels'],
  onActivate: (injectedApi) => { api = injectedApi; },
  render: (props) => {
    const currentPath = (props.currentPath as string) || '';
    return <FolderStatsPanel currentPath={currentPath} />;
  },
});
