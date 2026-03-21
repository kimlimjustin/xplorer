import React, { useState, useEffect, useCallback } from 'react';
import { TauriAPI, type FileEntry, type DuplicateFinderResult } from '@/lib/tauri-api';
import { getFileIcon, cn } from '@/lib/utils';
import { listenToEvent } from '@/lib/transport';
import {
  Copy,
  Trash2,
  FolderOpen,
  Search,
  Check,
  ChevronDown,
  ChevronRight,
  X,
  ClipboardCopy,
  Loader2,
} from 'lucide-react';

interface RecommendationsPanelProps {
  selectedFile: FileEntry | null;
  currentPath?: string;
  onFileClick?: (path: string) => void;
}

interface FileRecommendation {
  path: string;
  name: string;
  score: number;
  snippet: string;
}

// ── Duplicate finder types ──────────────────────────────────────────────────

interface ScanProgress {
  currentFile: string;
  processedFiles: number;
  totalFiles: number;
  currentPhase: string;
  duplicatesFound: number;
  totalWastedSpace: number;
}

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const sizeBadgeColor = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 100) return 'bg-xp-red/20 text-xp-red border-xp-red/30';
  if (bytes >= 1024 * 1024 * 10) return 'bg-xp-orange/20 text-xp-orange border-xp-orange/30';
  if (bytes >= 1024 * 1024) return 'bg-xp-yellow/20 text-xp-yellow border-xp-yellow/30';
  if (bytes >= 1024 * 100) return 'bg-xp-blue/20 text-xp-blue border-xp-blue/30';
  return 'bg-xp-surface text-xp-text-muted border-xp-border';
};

// ── Similar Files Tab ───────────────────────────────────────────────────────

const SimilarFilesTab = ({
  selectedFile,
  onFileClick,
}: {
  selectedFile: FileEntry | null;
  onFileClick?: (path: string) => void;
}) => {
  const [recommendations, setRecommendations] = useState<FileRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecommendations = async () => {
      if (!selectedFile || selectedFile.is_dir) {
        setRecommendations([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const results = await TauriAPI.getFileRecommendations(selectedFile.path, 10);
        setRecommendations(
          results.map((r) => ({
            path: r.path,
            name: r.path.split(/[/\\]/).pop() || r.path,
            score: r.score,
            snippet: 'snippet' in r ? String((r as unknown as Record<string, string>).snippet) : '',
          })),
        );
      } catch (err) {
        console.error('Failed to load recommendations:', err);
        setError(err instanceof Error ? err.message : String(err));
        setRecommendations([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.path]);

  if (!selectedFile || selectedFile.is_dir) {
    return (
      <div className="text-xp-text-muted flex flex-1 items-center justify-center text-sm">
        <div className="px-4 text-center">
          <Search className="mx-auto mb-2 h-10 w-10 opacity-40" />
          <p>Select a file to see similar files</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-xp-text-muted flex flex-1 items-center justify-center">
        <div className="text-center">
          <Loader2 className="text-xp-blue mx-auto mb-2 h-8 w-8 animate-spin" />
          <p className="text-sm">Finding similar files...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xp-red flex flex-1 items-center justify-center p-4 text-sm">
        <div className="text-center">
          <X className="mx-auto mb-2 h-8 w-8" />
          <p>Failed to load recommendations</p>
          <p className="text-xp-text-muted mt-1 text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-xp-text-muted flex flex-1 items-center justify-center text-sm">
        <div className="px-4 text-center">
          <Search className="mx-auto mb-2 h-10 w-10 opacity-40" />
          <p>No similar files found</p>
          <p className="mt-1 text-xs">Try indexing more directories</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-xp-border bg-xp-surface/30 border-b px-4 py-2">
        <p className="text-xp-text-muted text-xs">
          Similar to <span className="text-xp-blue">{selectedFile.name}</span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {recommendations.map((rec, index) => (
          <div
            key={rec.path}
            onClick={() => onFileClick?.(rec.path)}
            className="hover:bg-xp-surface border-xp-border/30 cursor-pointer border-b px-4 py-2.5 transition-colors"
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex-shrink-0">
                {getFileIcon({ path: rec.path, name: rec.name, is_dir: false } as FileEntry)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="text-xp-text truncate text-xs">{rec.name}</span>
                  <span className="bg-xp-blue/20 text-xp-blue border-xp-blue/30 flex-shrink-0 rounded border px-1.5 py-0.5 text-[10px]">
                    {Math.round(rec.score * 100)}%
                  </span>
                </div>
                <p className="text-xp-text-muted truncate text-[10px]" title={rec.path}>
                  {rec.path}
                </p>
                {rec.snippet && (
                  <p className="text-xp-text-muted bg-xp-surface mt-1 line-clamp-2 rounded px-2 py-1 text-[10px]">
                    {rec.snippet}
                  </p>
                )}
              </div>
              <div className="text-xp-text-muted flex-shrink-0 text-[10px]">#{index + 1}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-xp-border bg-xp-surface/30 border-t px-4 py-1.5">
        <p className="text-xp-text-muted text-[10px]">
          {recommendations.length} similar file{recommendations.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};

// ── Duplicates Tab ──────────────────────────────────────────────────────────

const DuplicatesTab = ({ currentPath }: { currentPath: string }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [results, setResults] = useState<DuplicateFinderResult | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [scanPath, setScanPath] = useState(currentPath || '');
  const [minFileSize, setMinFileSize] = useState(1024);

  useEffect(() => {
    if (currentPath) setScanPath(currentPath);
  }, [currentPath]);

  const handleStartScan = useCallback(async () => {
    if (!scanPath.trim()) return;

    setIsScanning(true);
    setProgress(null);
    setResults(null);
    setSelectedFiles(new Set());
    setExpandedGroups(new Set());

    let unlisten: (() => void) | null = null;

    try {
      unlisten = await listenToEvent<ScanProgress>('duplicate-finder-progress', (payload) => {
        setProgress(payload);
      });

      const result = await TauriAPI.findDuplicates(scanPath, minFileSize);
      setResults(result);
    } catch (error) {
      const msg = `${error}`;
      if (!msg.includes('cancelled')) {
        console.error('Duplicate scan error:', error);
      }
    } finally {
      if (unlisten) unlisten();
      setIsScanning(false);
      setProgress(null);
    }
  }, [scanPath, minFileSize]);

  const handleCancelScan = useCallback(async () => {
    try {
      await TauriAPI.cancelDuplicateScan();
    } catch (err) {
      console.warn('Failed to cancel duplicate scan:', err);
    }
  }, []);

  const toggleFile = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const selectAllDuplicatesInGroup = useCallback(
    (group: DuplicateFinderResult['duplicate_groups'][0]) => {
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
    },
    [],
  );

  const toggleGroupExpansion = useCallback((hash: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  }, []);

  const handleMoveToTrash = useCallback(async () => {
    if (selectedFiles.size === 0) return;
    const confirmed = window.confirm(`Move ${selectedFiles.size} duplicate file(s) to trash?`);
    if (!confirmed) return;

    try {
      await TauriAPI.moveDuplicateFilesToTrash(Array.from(selectedFiles));

      if (results) {
        const deletedSet = new Set(selectedFiles);
        const updatedGroups = results.duplicate_groups
          .map((g) => ({
            ...g,
            files: g.files.filter((f) => !deletedSet.has(f.path)),
            total_wasted_space:
              Math.max(0, g.files.filter((f) => !deletedSet.has(f.path)).length - 1) * g.size,
          }))
          .filter((g) => g.files.length >= 2);

        const total_duplicates = updatedGroups.reduce((sum, g) => sum + g.files.length, 0);
        const total_wasted_space = updatedGroups.reduce((sum, g) => sum + g.total_wasted_space, 0);
        setResults({
          ...results,
          duplicate_groups: updatedGroups,
          total_duplicates,
          total_wasted_space,
        });
      }
      setSelectedFiles(new Set());
      window.dispatchEvent(new CustomEvent('files-changed'));
    } catch (err) {
      console.error('Failed to move duplicate files to trash:', err);
    }
  }, [selectedFiles, results]);

  const handleOpenFolder = useCallback(async (filePath: string) => {
    try {
      const separator = filePath.includes('\\') ? '\\' : '/';
      const parentDir = filePath.substring(0, filePath.lastIndexOf(separator));
      if (parentDir) await TauriAPI.openFile(parentDir);
    } catch (err) {
      console.warn('Failed to open folder:', err);
    }
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Controls */}
      <div className="border-xp-border space-y-1.5 border-b px-3 py-2">
        <input
          type="text"
          value={scanPath}
          onChange={(e) => setScanPath(e.target.value)}
          placeholder="Path to scan..."
          className="bg-xp-surface border-xp-border focus:border-xp-blue w-full rounded border px-2 py-1 text-xs transition-colors focus:outline-none"
          disabled={isScanning}
        />
        <div className="flex items-center gap-2">
          <label className="text-xp-text-muted flex items-center gap-1 text-[10px]">
            <span>Min:</span>
            <input
              type="number"
              value={minFileSize}
              onChange={(e) => setMinFileSize(parseInt(e.target.value) || 0)}
              className="bg-xp-surface border-xp-border focus:border-xp-blue w-16 rounded border px-1 py-0.5 text-[10px] focus:outline-none"
              disabled={isScanning}
            />
            <span>B</span>
          </label>
          <span className="flex-1" />
          {isScanning ? (
            <button
              onClick={handleCancelScan}
              className="bg-xp-red/10 text-xp-red border-xp-red/20 hover:bg-xp-red/20 flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium transition-colors"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          ) : (
            <button
              onClick={handleStartScan}
              className="bg-xp-blue hover:bg-xp-blue/80 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-white transition-colors"
            >
              <Search className="h-3 w-3" />
              Scan
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {isScanning && progress && (
        <div className="border-xp-border bg-xp-surface/50 border-b px-3 py-1.5">
          <div className="text-xp-text-muted mb-1 flex items-center justify-between text-[10px]">
            <span className="capitalize">{progress.currentPhase}</span>
            <span>
              {progress.processedFiles}
              {progress.totalFiles > 0 ? ` / ${progress.totalFiles}` : ''} files
            </span>
          </div>
          <div className="bg-xp-surface h-1 w-full rounded-full">
            <div
              className="bg-xp-blue h-1 rounded-full transition-all duration-300"
              style={{
                width:
                  progress.totalFiles > 0
                    ? `${Math.min(100, (progress.processedFiles / progress.totalFiles) * 100)}%`
                    : '60%',
                animation:
                  progress.totalFiles === 0
                    ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                    : undefined,
              }}
            />
          </div>
        </div>
      )}

      {/* Summary */}
      {results && results.duplicate_groups.length > 0 && (
        <div className="border-xp-border bg-xp-surface/30 border-b px-3 py-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <span className="text-xp-text-muted">
              <span className="text-xp-text font-medium">{results.duplicate_groups.length}</span>{' '}
              groups
            </span>
            <span className="text-xp-border">|</span>
            <span className="text-xp-text-muted">
              <span className="text-xp-text font-medium">{results.total_duplicates}</span> files
            </span>
            <span className="text-xp-border">|</span>
            <span className="text-xp-red font-medium">
              {formatSize(results.total_wasted_space)} wasted
            </span>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {results && results.duplicate_groups.length > 0 && (
          <div>
            {results.duplicate_groups.map((group) => {
              const isExpanded = expandedGroups.has(group.hash);
              const fileCount = group.files.length;
              const allDupsSelected = group.files.slice(1).every((f) => selectedFiles.has(f.path));

              return (
                <div key={group.hash} className="border-xp-border/50 border-b">
                  <div
                    className="hover:bg-xp-surface/50 flex cursor-pointer items-center gap-1.5 px-3 py-1.5 transition-colors"
                    onClick={() => toggleGroupExpansion(group.hash)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="text-xp-text-muted h-3 w-3 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="text-xp-text-muted h-3 w-3 flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        'rounded border px-1 py-0.5 font-mono text-[10px]',
                        sizeBadgeColor(group.size),
                      )}
                    >
                      {formatSize(group.size)}
                    </span>
                    <span
                      className="text-xp-text-muted max-w-[60px] truncate font-mono text-[10px]"
                      title={group.hash}
                    >
                      {group.hash.slice(0, 8)}
                    </span>
                    <span className="text-xp-text-muted text-[10px]">{fileCount}x</span>
                    <span className="flex-1" />
                    <span className="text-xp-red text-[10px] font-medium">
                      -{formatSize(group.total_wasted_space)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        selectAllDuplicatesInGroup(group);
                      }}
                      className={cn(
                        'rounded border px-1 py-0.5 text-[10px] transition-colors',
                        allDupsSelected
                          ? 'bg-xp-blue/20 text-xp-blue border-xp-blue/30'
                          : 'bg-xp-surface border-xp-border text-xp-text-muted hover:border-xp-blue/50',
                      )}
                    >
                      {allDupsSelected ? 'Undo' : 'Select'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="space-y-0.5 pb-1.5 pl-5 pr-3">
                      {group.files.map((file, index) => {
                        const isKeep = index === 0;
                        return (
                          <div
                            key={file.path}
                            className={cn(
                              'flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] transition-colors',
                              selectedFiles.has(file.path)
                                ? 'bg-xp-blue/10 border-xp-blue/20 border'
                                : 'hover:bg-xp-surface/50',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={selectedFiles.has(file.path)}
                              onChange={() => toggleFile(file.path)}
                              className="accent-xp-blue h-3 w-3 flex-shrink-0"
                            />
                            {isKeep ? (
                              <Check className="text-xp-green h-3 w-3 flex-shrink-0" />
                            ) : (
                              <Copy className="text-xp-text-muted h-3 w-3 flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-xp-text truncate">
                                {file.name}
                                {isKeep && (
                                  <span className="text-xp-green ml-1 text-[10px]">(keep)</span>
                                )}
                              </div>
                              <div className="text-xp-text-muted truncate text-[10px]">
                                {file.path}
                              </div>
                            </div>
                            <button
                              onClick={() => handleOpenFolder(file.path)}
                              className="hover:bg-xp-surface flex-shrink-0 rounded p-0.5 transition-colors"
                              title="Open folder"
                            >
                              <FolderOpen className="text-xp-text-muted h-3 w-3" />
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

        {results && results.duplicate_groups.length === 0 && (
          <div className="text-xp-text-muted flex flex-col items-center justify-center py-10">
            <Check className="text-xp-green mb-2 h-8 w-8" />
            <div className="text-xs font-medium">No duplicates found</div>
          </div>
        )}

        {!isScanning && !results && (
          <div className="text-xp-text-muted flex flex-col items-center justify-center py-10">
            <Search className="mb-2 h-8 w-8 opacity-40" />
            <div className="text-xs">Set path and click Scan</div>
          </div>
        )}
      </div>

      {/* Actions */}
      {results && results.duplicate_groups.length > 0 && selectedFiles.size > 0 && (
        <div className="border-xp-border bg-xp-surface/30 flex items-center gap-2 border-t px-3 py-1.5">
          <span className="text-xp-text-muted text-[10px]">{selectedFiles.size} selected</span>
          <button
            onClick={handleMoveToTrash}
            className="bg-xp-red/10 text-xp-red border-xp-red/20 hover:bg-xp-red/20 flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
          <span className="flex-1" />
          <button
            onClick={() => {
              if (!results) return;
              const lines = results.duplicate_groups.flatMap((g, i) => [
                `Group ${i + 1}: ${formatSize(g.size)} x${g.files.length}`,
                ...g.files.map((f, j) => `  ${j === 0 ? '[KEEP]' : '[DUP] '} ${f.path}`),
                '',
              ]);
              navigator.clipboard.writeText(lines.join('\n'));
            }}
            className="hover:bg-xp-surface rounded p-1 transition-colors"
            title="Copy report"
          >
            <ClipboardCopy className="text-xp-text-muted h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
};

// ── Main Panel ──────────────────────────────────────────────────────────────

type TabMode = 'similar' | 'duplicates';

const RecommendationsPanel = ({
  selectedFile,
  currentPath = '',
  onFileClick,
}: RecommendationsPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabMode>('similar');

  return (
    <div className="text-xp-text flex h-full flex-col">
      {/* Tab switcher */}
      <div className="border-xp-border flex flex-shrink-0 border-b">
        <button
          onClick={() => setActiveTab('similar')}
          className={cn(
            'flex-1 px-3 py-2 text-xs font-medium transition-colors',
            activeTab === 'similar'
              ? 'text-xp-blue border-xp-blue bg-xp-surface/50 border-b-2'
              : 'text-xp-text-muted hover:text-xp-text hover:bg-xp-surface/30',
          )}
        >
          Similar
        </button>
        <button
          onClick={() => setActiveTab('duplicates')}
          className={cn(
            'flex-1 px-3 py-2 text-xs font-medium transition-colors',
            activeTab === 'duplicates'
              ? 'text-xp-blue border-xp-blue bg-xp-surface/50 border-b-2'
              : 'text-xp-text-muted hover:text-xp-text hover:bg-xp-surface/30',
          )}
        >
          Duplicates
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'similar' ? (
        <SimilarFilesTab selectedFile={selectedFile} onFileClick={onFileClick} />
      ) : (
        <DuplicatesTab currentPath={currentPath} />
      )}
    </div>
  );
};

export default RecommendationsPanel;
