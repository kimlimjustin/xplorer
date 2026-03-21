import React, { useState, useCallback, useEffect } from 'react';
import { listenToEvent } from '@/lib/transport';
import { TauriAPI, StorageAnalytics, StorageAnalysisProgress } from '@/lib/tauri-api';
import { BarChart3, HardDrive, FileText, FolderClosed } from 'lucide-react';

interface StorageAnalyticsPanelProps {
  currentPath: string;
  navigateToPath?: (path: string) => void;
}

const BAR_COLORS = [
  'var(--xp-blue)', // blue
  'var(--xp-green)', // green
  'var(--xp-purple)', // purple
  'var(--xp-orange)', // orange
  'var(--xp-red)', // red
  'var(--xp-cyan)', // cyan
  'var(--xp-yellow)', // yellow
  'var(--xp-green)', // teal
  'var(--xp-cyan)', // mint
  'var(--xp-text)', // lavender
];

const SIZE_CAT_COLORS = [
  'var(--xp-cyan)', // Tiny - cyan
  'var(--xp-green)', // Small - green
  'var(--xp-blue)', // Medium - blue
  'var(--xp-orange)', // Large - orange
  'var(--xp-red)', // Huge - red
];

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

const truncatePath = (p: string, maxLen: number): string => {
  if (p.length <= maxLen) return p;
  const sep = p.includes('\\') ? '\\' : '/';
  const parts = p.split(sep);
  if (parts.length <= 3) return `...${p.slice(-(maxLen - 3))}`;
  return `${parts[0] + sep}...${sep}${parts.slice(-2).join(sep)}`;
};

const StorageAnalyticsPanel = ({ currentPath, navigateToPath }: StorageAnalyticsPanelProps) => {
  const [analytics, setAnalytics] = useState<StorageAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<StorageAnalysisProgress | null>(null);
  const [analyzedPath, setAnalyzedPath] = useState('');

  const runAnalysis = useCallback(async () => {
    if (!currentPath) return;
    setLoading(true);
    setError(null);
    setAnalytics(null);
    setProgress(null);

    let unlisten: (() => void) | null = null;
    try {
      // Listen for progress events
      unlisten = await listenToEvent<StorageAnalysisProgress>(
        'storage-analysis-progress',
        (payload) => {
          setProgress(payload);
        },
      );

      const result = await TauriAPI.analyzeStorage(currentPath);
      setAnalytics(result);
      setAnalyzedPath(currentPath);

      // Ensure the analyzed path is whitelisted for tokenizer indexing
      TauriAPI.addPathToTokenizer(currentPath).catch(() => {
        /* fire-and-forget */
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (unlisten) unlisten();
      setLoading(false);
      setProgress(null);
    }
  }, [currentPath]);

  // Auto-analyze when the path changes
  useEffect(() => {
    if (currentPath && currentPath !== analyzedPath) {
      runAnalysis();
    }
  }, [currentPath, analyzedPath, runAnalysis]);

  const handleFileClick = (filePath: string) => {
    if (!navigateToPath) return;
    const sep = filePath.includes('\\') ? '\\' : '/';
    const parentDir = filePath.substring(0, filePath.lastIndexOf(sep));
    if (parentDir) navigateToPath(parentDir);
  };

  // --- Loading state ---
  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <div
          className="loading-spinner h-8 w-8 rounded-full border-2 border-current border-t-transparent"
          style={{ borderColor: 'var(--xp-blue)', borderTopColor: 'transparent' }}
        />
        <p className="text-xp-text-muted text-sm">Analyzing storage...</p>
        {progress && (
          <div className="text-xp-text-muted w-full space-y-1 text-xs">
            <p>
              {formatNumber(progress.files_processed)} files /{' '}
              {formatNumber(progress.dirs_processed)} folders scanned
            </p>
            <p>{formatFileSize(progress.bytes_processed)} processed</p>
            <p className="truncate opacity-60" title={progress.current_path}>
              {truncatePath(progress.current_path, 40)}
            </p>
          </div>
        )}
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="space-y-3 p-4">
        <div
          className="rounded-lg border p-3"
          style={{
            borderColor: 'color-mix(in srgb, var(--xp-red) 20%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--xp-red) 7%, transparent)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--xp-red)' }}>
            Analysis failed: {error}
          </p>
        </div>
        <button
          onClick={runAnalysis}
          className="bg-xp-surface-light hover:bg-xp-blue text-xp-text w-full rounded-lg px-3 py-2 text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // --- No data yet ---
  if (!analytics) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
        <div className="text-3xl">
          <BarChart3 size="1em" className="inline-block" />
        </div>
        <p className="text-xp-text-muted text-sm">
          {currentPath ? 'Click Analyze to scan storage' : 'Navigate to a folder to analyze'}
        </p>
        {currentPath && (
          <button
            onClick={runAnalysis}
            className="bg-xp-blue rounded-lg px-4 py-2 text-sm text-white transition-colors hover:opacity-90"
          >
            Analyze Storage
          </button>
        )}
      </div>
    );
  }

  // --- Analytics dashboard ---
  const {
    total_size,
    used_size,
    free_size,
    file_count,
    dir_count,
    file_type_distribution,
    largest_files,
    size_categories,
  } = analytics;
  const usedPercent = total_size > 0 ? Math.round((used_size / total_size) * 100) : 0;
  const freePercent = total_size > 0 ? 100 - usedPercent : 0;
  const hasDiskInfo = free_size > 0 || total_size > used_size;
  const top10Types = file_type_distribution.slice(0, 10);
  const maxTypeSize = top10Types.length > 0 ? top10Types[0].total_size : 1;
  const totalFilesSize = file_type_distribution.reduce((sum, t) => sum + t.total_size, 0);
  const maxCatSize = size_categories.reduce((max, c) => Math.max(max, c.total_size), 1);

  return (
    <div className="space-y-4 overflow-y-auto p-3 text-sm" style={{ maxHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-xp-text text-sm font-semibold">Storage Analytics</h3>
          <p className="text-xp-text-muted truncate text-xs" title={analyzedPath}>
            {analyzedPath}
          </p>
        </div>
        <button
          onClick={runAnalysis}
          className="bg-xp-surface-light hover:bg-xp-blue border-xp-border ml-2 shrink-0 rounded border px-2 py-1 text-xs transition-colors hover:text-white"
          title="Refresh analysis"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        {/* Total Size */}
        <div
          className="border-xp-border rounded-xl border p-2.5"
          style={{
            backgroundColor: 'rgba(var(--xp-surface-rgb, 36, 40, 59), 0.5)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="mb-0.5 text-base">
            <HardDrive size="1em" className="inline-block" />
          </div>
          <div className="text-xp-text text-sm font-bold">
            {formatFileSize(hasDiskInfo ? total_size : used_size)}
          </div>
          <div className="text-xp-text-muted text-[10px]">
            {hasDiskInfo ? 'Disk Total' : 'Total Size'}
          </div>
        </div>
        {/* Files */}
        <div
          className="border-xp-border rounded-xl border p-2.5"
          style={{
            backgroundColor: 'rgba(var(--xp-surface-rgb, 36, 40, 59), 0.5)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="mb-0.5 text-base">
            <FileText size="1em" className="inline-block" />
          </div>
          <div className="text-xp-text text-sm font-bold">{formatNumber(file_count)}</div>
          <div className="text-xp-text-muted text-[10px]">Files</div>
        </div>
        {/* Folders */}
        <div
          className="border-xp-border rounded-xl border p-2.5"
          style={{
            backgroundColor: 'rgba(var(--xp-surface-rgb, 36, 40, 59), 0.5)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="mb-0.5 text-base">
            <FolderClosed size="1em" className="inline-block" />
          </div>
          <div className="text-xp-text text-sm font-bold">{formatNumber(dir_count)}</div>
          <div className="text-xp-text-muted text-[10px]">Folders</div>
        </div>
      </div>

      {/* Disk Usage Bar */}
      {hasDiskInfo && (
        <div
          className="border-xp-border rounded-xl border p-3"
          style={{
            backgroundColor: 'rgba(var(--xp-surface-rgb, 36, 40, 59), 0.5)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xp-text text-xs font-medium">Disk Usage</span>
            <span className="text-xp-text-muted text-xs">
              {formatFileSize(used_size)} / {formatFileSize(total_size)}
            </span>
          </div>
          <div
            className="h-3 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: 'rgba(var(--xp-overlay-rgb, 86, 90, 110), 0.3)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${usedPercent}%`,
                background: (() => {
                  if (usedPercent > 90)
                    {return 'linear-gradient(90deg, var(--xp-orange), var(--xp-red))';}
                  if (usedPercent > 70)
                    {return 'linear-gradient(90deg, var(--xp-blue), var(--xp-orange))';}
                  return 'linear-gradient(90deg, var(--xp-blue), var(--xp-green))';
                })(),
              }}
            />
          </div>
          <div className="text-xp-text-muted mt-1.5 flex justify-between text-[10px]">
            <span>Used: {usedPercent}%</span>
            <span>
              Free: {freePercent}% ({formatFileSize(free_size)})
            </span>
          </div>
        </div>
      )}

      {/* File Type Distribution */}
      {top10Types.length > 0 && (
        <div
          className="border-xp-border rounded-xl border p-3"
          style={{
            backgroundColor: 'rgba(var(--xp-surface-rgb, 36, 40, 59), 0.5)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <h4 className="text-xp-text mb-2 text-xs font-medium">File Types (Top 10 by Size)</h4>
          <div className="space-y-1.5">
            {top10Types.map((t, i) => {
              const pct = totalFilesSize > 0 ? (t.total_size / totalFilesSize) * 100 : 0;
              const barWidth = maxTypeSize > 0 ? (t.total_size / maxTypeSize) * 100 : 0;
              const color = BAR_COLORS[i % BAR_COLORS.length];
              return (
                <div key={t.extension} className="group">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span
                      className="text-xp-text truncate font-mono text-[11px]"
                      style={{ minWidth: 50 }}
                    >
                      .{t.extension}
                    </span>
                    <span className="text-xp-text-muted ml-auto shrink-0 text-[10px]">
                      {formatFileSize(t.total_size)} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: 'rgba(var(--xp-overlay-rgb, 86, 90, 110), 0.2)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${barWidth}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="text-xp-text-muted mt-0.5 text-[10px]">
                    {formatNumber(t.count)} files
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Size Distribution */}
      {size_categories.length > 0 && (
        <div
          className="border-xp-border rounded-xl border p-3"
          style={{
            backgroundColor: 'rgba(var(--xp-surface-rgb, 36, 40, 59), 0.5)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <h4 className="text-xp-text mb-2 text-xs font-medium">Size Distribution</h4>
          <div className="space-y-1.5">
            {size_categories.map((cat, i) => {
              const barWidth = maxCatSize > 0 ? (cat.total_size / maxCatSize) * 100 : 0;
              const color = SIZE_CAT_COLORS[i % SIZE_CAT_COLORS.length];
              return (
                <div key={cat.label}>
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="text-xp-text text-[11px]">{cat.label}</span>
                    <span className="text-xp-text-muted text-[10px]">
                      {formatNumber(cat.count)} files / {formatFileSize(cat.total_size)}
                    </span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: 'rgba(var(--xp-overlay-rgb, 86, 90, 110), 0.2)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${barWidth}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Largest Files */}
      {largest_files.length > 0 && (
        <div
          className="border-xp-border rounded-xl border p-3"
          style={{
            backgroundColor: 'rgba(var(--xp-surface-rgb, 36, 40, 59), 0.5)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <h4 className="text-xp-text mb-2 text-xs font-medium">
            Largest Files (Top {largest_files.length})
          </h4>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {largest_files.map((file, i) => (
              <div
                key={file.path}
                className="hover:bg-xp-surface-light group flex cursor-pointer items-center gap-2 rounded-lg p-1.5 transition-colors"
                onClick={() => handleFileClick(file.path)}
                title={file.path}
              >
                <span className="text-xp-text-muted w-4 shrink-0 text-right text-[10px]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xp-text truncate text-[11px]">{file.name}</p>
                  <p className="text-xp-text-muted truncate text-[10px] opacity-60 group-hover:opacity-100">
                    {truncatePath(file.path, 45)}
                  </p>
                </div>
                <span
                  className="shrink-0 font-mono text-[11px]"
                  style={{ color: 'var(--xp-orange)' }}
                >
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageAnalyticsPanel;
