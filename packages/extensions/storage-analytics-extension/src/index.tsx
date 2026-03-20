import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar, type XplorerAPI, type SidebarRenderProps } from '@xplorer/extension-sdk';

interface TypeDistribution { extension: string; count: number; total_size: number; }
interface LargeFile { path: string; name: string; size: number; }
interface SizeCategory { label: string; count: number; total_size: number; }
interface StorageAnalytics {
  total_size: number; used_size: number; free_size: number;
  file_count: number; dir_count: number;
  file_type_distribution: TypeDistribution[];
  largest_files: LargeFile[];
  size_categories: SizeCategory[];
}

const BAR_COLORS = ['var(--xp-blue)', 'var(--xp-green)', 'var(--xp-purple)', 'var(--xp-orange)', 'var(--xp-red)', 'var(--xp-cyan)', 'var(--xp-yellow)', 'var(--xp-green)', 'var(--xp-cyan)', 'var(--xp-text)'];
const CAT_COLORS = ['var(--xp-cyan)', 'var(--xp-green)', 'var(--xp-blue)', 'var(--xp-orange)', 'var(--xp-red)'];

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function truncatePath(p: string, max: number): string {
  if (p.length <= max) return p;
  const sep = p.includes('\\') ? '\\' : '/';
  const parts = p.split(sep);
  if (parts.length <= 3) return '...' + p.slice(-(max - 3));
  return parts[0] + sep + '...' + sep + parts.slice(-2).join(sep);
}

const card: React.CSSProperties = { background: 'var(--xp-surface-light, #2f334d)', borderRadius: 10, padding: 10, border: '1px solid var(--xp-border, #414868)' };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--xp-text, #c0caf5)', marginBottom: 8 };

function StorageAnalyticsPanel({ currentPath, api }: { currentPath: string; api: XplorerAPI }) {
  const [analytics, setAnalytics] = useState<StorageAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzedPath, setAnalyzedPath] = useState('');

  const run = useCallback(async () => {
    if (!currentPath) return;
    setLoading(true);
    setError(null);
    setAnalytics(null);
    try {
      const result = await api.analytics.analyzeStorage(currentPath) as StorageAnalytics;
      setAnalytics(result);
      setAnalyzedPath(currentPath);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [currentPath, api]);

  useEffect(() => {
    if (currentPath && currentPath !== analyzedPath) run();
  }, [currentPath, analyzedPath, run]);

  const handleFileClick = (filePath: string) => {
    const sep = filePath.includes('\\') ? '\\' : '/';
    const parent = filePath.substring(0, filePath.lastIndexOf(sep));
    if (parent) api.navigation.navigateTo(parent);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, height: '100%', padding: 16 }}>
        <style>{`@keyframes xp-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 28, height: 28, border: '2px solid var(--xp-blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'xp-spin 1s linear infinite' }} />
        <span style={{ fontSize: 13, color: 'var(--xp-text-muted)' }}>Analyzing storage...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ padding: 10, borderRadius: 8, border: '1px solid color-mix(in srgb, var(--xp-red) 20%, transparent)', background: 'color-mix(in srgb, var(--xp-red) 7%, transparent)' }}>
          <span style={{ fontSize: 13, color: 'var(--xp-red)' }}>Analysis failed: {error}</span>
        </div>
        <button onClick={run} style={{ padding: '8px 12px', fontSize: 13, borderRadius: 6, border: 'none', background: 'var(--xp-surface-light)', color: 'var(--xp-text)', cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, height: '100%', padding: 16, textAlign: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--xp-text-muted)" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
        <span style={{ fontSize: 13, color: 'var(--xp-text-muted)' }}>{currentPath ? 'Click Analyze to scan storage' : 'Navigate to a folder to analyze'}</span>
        {currentPath && (
          <button onClick={run} style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, border: 'none', background: 'var(--xp-blue)', color: '#fff', cursor: 'pointer' }}>Analyze Storage</button>
        )}
      </div>
    );
  }

  const { total_size, used_size, free_size, file_count, dir_count, file_type_distribution, largest_files, size_categories } = analytics;
  const usedPct = total_size > 0 ? Math.round((used_size / total_size) * 100) : 0;
  const hasDisk = free_size > 0 || total_size > used_size;
  const top10 = file_type_distribution.slice(0, 10);
  const maxTypeSize = top10.length > 0 ? top10[0].total_size : 1;
  const totalFilesSize = file_type_distribution.reduce((s, t) => s + t.total_size, 0);
  const maxCatSize = size_categories.reduce((m, c) => Math.max(m, c.total_size), 1);

  return (
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', maxHeight: '100%', fontSize: 13, color: 'var(--xp-text, #c0caf5)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--xp-text)' }}>Storage Analytics</div>
          <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={analyzedPath}>{analyzedPath}</div>
        </div>
        <button onClick={run} style={{ marginLeft: 8, padding: '4px 8px', fontSize: 11, borderRadius: 4, border: '1px solid var(--xp-border)', background: 'var(--xp-surface-light)', color: 'var(--xp-text)', cursor: 'pointer' }} title="Refresh">Refresh</button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {[
          { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>, val: formatSize(hasDisk ? total_size : used_size), label: hasDisk ? 'Disk Total' : 'Total Size' },
          { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7Z"/><path d="M14 2v4a2 2 0 002 2h4"/></svg>, val: formatNumber(file_count), label: 'Files' },
          { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20a2 2 0 002-2V8a2 2 0 00-2-2h-7.9a2 2 0 01-1.69-.9L9.6 3.9A2 2 0 007.93 3H4a2 2 0 00-2 2v13a2 2 0 002 2Z"/><path d="M2 10h20"/></svg>, val: formatNumber(dir_count), label: 'Folders' },
        ].map(({ icon, val, label }) => (
          <div key={label} style={card}>
            <div style={{ marginBottom: 2, color: 'var(--xp-text-muted)' }}>{icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--xp-text)' }}>{val}</div>
            <div style={{ fontSize: 10, color: 'var(--xp-text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Disk usage bar */}
      {hasDisk && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}>
            <span style={{ fontWeight: 500, color: 'var(--xp-text)' }}>Disk Usage</span>
            <span style={{ color: 'var(--xp-text-muted)' }}>{formatSize(used_size)} / {formatSize(total_size)}</span>
          </div>
          <div style={{ width: '100%', height: 10, borderRadius: 5, background: 'var(--xp-bg, #1a1b26)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 5, transition: 'width 0.5s',
              width: `${usedPct}%`,
              background: usedPct > 90 ? 'linear-gradient(90deg, var(--xp-orange), var(--xp-red))' : usedPct > 70 ? 'linear-gradient(90deg, var(--xp-blue), var(--xp-orange))' : 'linear-gradient(90deg, var(--xp-blue), var(--xp-green))',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--xp-text-muted)' }}>
            <span>Used: {usedPct}%</span>
            <span>Free: {100 - usedPct}% ({formatSize(free_size)})</span>
          </div>
        </div>
      )}

      {/* File types */}
      {top10.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}>File Types (Top 10 by Size)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {top10.map((t, i) => {
              const pct = totalFilesSize > 0 ? (t.total_size / totalFilesSize) * 100 : 0;
              const barW = maxTypeSize > 0 ? (t.total_size / maxTypeSize) * 100 : 0;
              const color = BAR_COLORS[i % BAR_COLORS.length];
              return (
                <div key={t.extension}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--xp-text)', minWidth: 50 }}>.{t.extension}</span>
                    <span style={{ fontSize: 10, color: 'var(--xp-text-muted)', marginLeft: 'auto', flexShrink: 0 }}>{formatSize(t.total_size)} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'var(--xp-bg, #1a1b26)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, transition: 'width 0.3s', width: `${barW}%`, background: color }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--xp-text-muted)', marginTop: 1 }}>{formatNumber(t.count)} files</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Size distribution */}
      {size_categories.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}>Size Distribution</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {size_categories.map((cat, i) => {
              const barW = maxCatSize > 0 ? (cat.total_size / maxCatSize) * 100 : 0;
              const color = CAT_COLORS[i % CAT_COLORS.length];
              return (
                <div key={cat.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 11 }}>
                    <span style={{ color: 'var(--xp-text)' }}>{cat.label}</span>
                    <span style={{ color: 'var(--xp-text-muted)' }}>{formatNumber(cat.count)} files / {formatSize(cat.total_size)}</span>
                  </div>
                  <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'var(--xp-bg)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, transition: 'width 0.3s', width: `${barW}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Largest files */}
      {largest_files.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}>Largest Files (Top {largest_files.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 250, overflowY: 'auto' }}>
            {largest_files.map((file, i) => (
              <div key={file.path} onClick={() => handleFileClick(file.path)} title={file.path}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>
                <span style={{ fontSize: 10, color: 'var(--xp-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--xp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--xp-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.6 }}>{truncatePath(file.path, 45)}</div>
                </div>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--xp-orange)', flexShrink: 0 }}>{formatSize(file.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

let api: XplorerAPI;

Sidebar.register({
  id: 'storage-analytics',
  title: 'Storage Analytics',
  description: 'Analyze storage usage and file distribution',
  icon: 'chart',
  location: 'right',
  permissions: ['file:read', 'ui:panels'],
  render: (props: SidebarRenderProps) => React.createElement(StorageAnalyticsPanel, { currentPath: (props.currentPath as string) || '', api }),
  onActivate: (injectedApi: XplorerAPI) => { api = injectedApi; },
});
