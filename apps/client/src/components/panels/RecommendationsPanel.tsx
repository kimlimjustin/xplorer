import React, { useState, useEffect, useCallback } from 'react';
import { TauriAPI, type FileEntry, type DuplicateFinderResult } from '@/lib/tauri-api';
import { getFileIcon } from '@/lib/utils';
import { listenToEvent } from '@/lib/transport';
import { cn } from '@/lib/utils';
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

const formatSize = (bytes: number) : string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const sizeBadgeColor = (bytes: number) : string => {
  if (bytes >= 1024 * 1024 * 100) return 'bg-xp-red/20 text-xp-red border-xp-red/30';
  if (bytes >= 1024 * 1024 * 10) return 'bg-xp-orange/20 text-xp-orange border-xp-orange/30';
  if (bytes >= 1024 * 1024) return 'bg-xp-yellow/20 text-xp-yellow border-xp-yellow/30';
  if (bytes >= 1024 * 100) return 'bg-xp-blue/20 text-xp-blue border-xp-blue/30';
  return 'bg-xp-surface text-xp-text-muted border-xp-border';
}

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
      <div className="flex-1 flex items-center justify-center text-xp-text-muted text-sm">
        <div className="text-center px-4">
          <Search className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Select a file to see similar files</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-xp-text-muted">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-xp-blue" />
          <p className="text-sm">Finding similar files...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-xp-red text-sm p-4">
        <div className="text-center">
          <X className="w-8 h-8 mx-auto mb-2" />
          <p>Failed to load recommendations</p>
          <p className="text-xs mt-1 text-xp-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xp-text-muted text-sm">
        <div className="text-center px-4">
          <Search className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No similar files found</p>
          <p className="text-xs mt-1">Try indexing more directories</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b border-xp-border bg-xp-surface/30">
        <p className="text-xs text-xp-text-muted">
          Similar to <span className="text-xp-blue">{selectedFile.name}</span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {recommendations.map((rec, index) => (
          <div
            key={rec.path}
            onClick={() => onFileClick?.(rec.path)}
            className="px-4 py-2.5 hover:bg-xp-surface cursor-pointer border-b border-xp-border/30 transition-colors"
          >
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                {getFileIcon({ path: rec.path, name: rec.name, is_dir: false } as FileEntry)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-xp-text truncate">{rec.name}</span>
                  <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-xp-blue/20 text-xp-blue border border-xp-blue/30">
                    {Math.round(rec.score * 100)}%
                  </span>
                </div>
                <p className="text-[10px] text-xp-text-muted truncate" title={rec.path}>
                  {rec.path}
                </p>
                {rec.snippet && (
                  <p className="text-[10px] text-xp-text-muted line-clamp-2 bg-xp-surface px-2 py-1 rounded mt-1">
                    {rec.snippet}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 text-[10px] text-xp-text-muted">#{index + 1}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-1.5 border-t border-xp-border bg-xp-surface/30">
        <p className="text-[10px] text-xp-text-muted">
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Controls */}
      <div className="px-3 py-2 border-b border-xp-border space-y-1.5">
        <input
          type="text"
          value={scanPath}
          onChange={(e) => setScanPath(e.target.value)}
          placeholder="Path to scan..."
          className="w-full px-2 py-1 text-xs bg-xp-surface border border-xp-border rounded focus:border-xp-blue focus:outline-none transition-colors"
          disabled={isScanning}
        />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[10px] text-xp-text-muted">
            <span>Min:</span>
            <input
              type="number"
              value={minFileSize}
              onChange={(e) => setMinFileSize(parseInt(e.target.value) || 0)}
              className="w-16 px-1 py-0.5 bg-xp-surface border border-xp-border rounded text-[10px] focus:border-xp-blue focus:outline-none"
              disabled={isScanning}
            />
            <span>B</span>
          </label>
          <span className="flex-1" />
          {isScanning ? (
            <button
              onClick={handleCancelScan}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-xp-red/10 text-xp-red border border-xp-red/20 hover:bg-xp-red/20 transition-colors"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          ) : (
            <button
              onClick={handleStartScan}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-xp-blue text-white hover:bg-xp-blue/80 transition-colors"
            >
              <Search className="w-3 h-3" />
              Scan
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {isScanning && progress && (
        <div className="px-3 py-1.5 border-b border-xp-border bg-xp-surface/50">
          <div className="flex items-center justify-between text-[10px] text-xp-text-muted mb-1">
            <span className="capitalize">{progress.currentPhase}</span>
            <span>
              {progress.processedFiles}
              {progress.totalFiles > 0 ? ` / ${progress.totalFiles}` : ''} files
            </span>
          </div>
          <div className="w-full bg-xp-surface rounded-full h-1">
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
        <div className="px-3 py-1.5 border-b border-xp-border bg-xp-surface/30">
          <div className="flex items-center gap-2 text-[10px] flex-wrap">
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
                <div key={group.hash} className="border-b border-xp-border/50">
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-xp-surface/50 cursor-pointer transition-colors"
                    onClick={() => toggleGroupExpansion(group.hash)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-xp-text-muted flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-xp-text-muted flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        'px-1 py-0.5 text-[10px] font-mono rounded border',
                        sizeBadgeColor(group.size),
                      )}
                    >
                      {formatSize(group.size)}
                    </span>
                    <span
                      className="text-[10px] text-xp-text-muted font-mono truncate max-w-[60px]"
                      title={group.hash}
                    >
                      {group.hash.slice(0, 8)}
                    </span>
                    <span className="text-[10px] text-xp-text-muted">{fileCount}x</span>
                    <span className="flex-1" />
                    <span className="text-[10px] text-xp-red font-medium">
                      -{formatSize(group.total_wasted_space)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        selectAllDuplicatesInGroup(group);
                      }}
                      className={cn(
                        'px-1 py-0.5 text-[10px] rounded border transition-colors',
                        allDupsSelected
                          ? 'bg-xp-blue/20 text-xp-blue border-xp-blue/30'
                          : 'bg-xp-surface border-xp-border text-xp-text-muted hover:border-xp-blue/50',
                      )}
                    >
                      {allDupsSelected ? 'Undo' : 'Select'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="pl-5 pr-3 pb-1.5 space-y-0.5">
                      {group.files.map((file, index) => {
                        const isKeep = index === 0;
                        return (
                          <div
                            key={file.path}
                            className={cn(
                              'flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] transition-colors',
                              selectedFiles.has(file.path)
                                ? 'bg-xp-blue/10 border border-xp-blue/20'
                                : 'hover:bg-xp-surface/50',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={selectedFiles.has(file.path)}
                              onChange={() => toggleFile(file.path)}
                              className="w-3 h-3 accent-xp-blue flex-shrink-0"
                            />
                            {isKeep ? (
                              <Check className="w-3 h-3 text-xp-green flex-shrink-0" />
                            ) : (
                              <Copy className="w-3 h-3 text-xp-text-muted flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="truncate text-xp-text">
                                {file.name}
                                {isKeep && (
                                  <span className="text-xp-green ml-1 text-[10px]">(keep)</span>
                                )}
                              </div>
                              <div className="truncate text-[10px] text-xp-text-muted">
                                {file.path}
                              </div>
                            </div>
                            <button
                              onClick={() => handleOpenFolder(file.path)}
                              className="p-0.5 rounded hover:bg-xp-surface transition-colors flex-shrink-0"
                              title="Open folder"
                            >
                              <FolderOpen className="w-3 h-3 text-xp-text-muted" />
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
          <div className="flex flex-col items-center justify-center py-10 text-xp-text-muted">
            <Check className="w-8 h-8 mb-2 text-xp-green" />
            <div className="text-xs font-medium">No duplicates found</div>
          </div>
        )}

        {!isScanning && !results && (
          <div className="flex flex-col items-center justify-center py-10 text-xp-text-muted">
            <Search className="w-8 h-8 mb-2 opacity-40" />
            <div className="text-xs">Set path and click Scan</div>
          </div>
        )}
      </div>

      {/* Actions */}
      {results && results.duplicate_groups.length > 0 && selectedFiles.size > 0 && (
        <div className="px-3 py-1.5 border-t border-xp-border bg-xp-surface/30 flex items-center gap-2">
          <span className="text-[10px] text-xp-text-muted">{selectedFiles.size} selected</span>
          <button
            onClick={handleMoveToTrash}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-xp-red/10 text-xp-red border border-xp-red/20 hover:bg-xp-red/20 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
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
            className="p-1 rounded hover:bg-xp-surface transition-colors"
            title="Copy report"
          >
            <ClipboardCopy className="w-3 h-3 text-xp-text-muted" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────────────

type TabMode = 'similar' | 'duplicates';

const RecommendationsPanel = ({
  selectedFile,
  currentPath = '',
  onFileClick,
}: RecommendationsPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabMode>('similar');

  return (
    <div className="h-full flex flex-col text-xp-text">
      {/* Tab switcher */}
      <div className="flex border-b border-xp-border flex-shrink-0">
        <button
          onClick={() => setActiveTab('similar')}
          className={cn(
            'flex-1 px-3 py-2 text-xs font-medium transition-colors',
            activeTab === 'similar'
              ? 'text-xp-blue border-b-2 border-xp-blue bg-xp-surface/50'
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
              ? 'text-xp-blue border-b-2 border-xp-blue bg-xp-surface/50'
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
}

export default RecommendationsPanel;
