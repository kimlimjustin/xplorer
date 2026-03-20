import { useState, useEffect, useCallback } from 'react';
import { TauriAPI, type DuplicateFinderResult } from '@/lib/tauri-api';
import { listenToEvent } from '@/lib/transport';
import { useToast } from '@/hooks/use-toast';
import { cn, formatFileSize } from '@/lib/utils';
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
} from 'lucide-react';

interface ScanProgress {
  currentFile: string;
  processedFiles: number;
  totalFiles: number;
  currentPhase: string;
  duplicatesFound: number;
  totalWastedSpace: number;
}

interface DuplicateFinderPanelProps {
  currentPath?: string;
}

/** Colored badge for file-size categories. */
const sizeBadgeColor = (bytes: number) : string => {
  if (bytes >= 1024 * 1024 * 100) return 'bg-xp-red/20 text-xp-red border-xp-red/30';
  if (bytes >= 1024 * 1024 * 10) return 'bg-xp-orange/20 text-xp-orange border-xp-orange/30';
  if (bytes >= 1024 * 1024) return 'bg-xp-yellow/20 text-xp-yellow border-xp-yellow/30';
  if (bytes >= 1024 * 100) return 'bg-xp-blue/20 text-xp-blue border-xp-blue/30';
  return 'bg-xp-surface text-xp-text-muted border-xp-border';
}

const DuplicateFinderPanel = ({ currentPath = '' }: DuplicateFinderPanelProps) => {
  const { toast } = useToast();

  // State
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [results, setResults] = useState<DuplicateFinderResult | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Settings
  const [scanPath, setScanPath] = useState(currentPath || '');
  const [minFileSize, setMinFileSize] = useState(1024); // 1 KB default

  // Keep scan path in sync with currentPath prop
  useEffect(() => {
    if (currentPath) setScanPath(currentPath);
  }, [currentPath]);

  // ── Scan ────────────────────────────────────────────────────────────────────
  const handleStartScan = useCallback(async () => {
    if (!scanPath.trim()) {
      toast({
        title: 'Error',
        description: 'Please specify a path to scan',
        variant: 'destructive',
      });
      return;
    }

    setIsScanning(true);
    setProgress(null);
    setResults(null);
    setSelectedFiles(new Set());
    setExpandedGroups(new Set());

    let unlisten: (() => void) | null = null;

    try {
      // Listen for progress events emitted by the Rust backend
      unlisten = await listenToEvent<ScanProgress>('duplicate-finder-progress', (payload) => {
        setProgress(payload);
      });

      const result = await TauriAPI.findDuplicates(scanPath, minFileSize);
      setResults(result);

      toast({
        title: 'Scan Complete',
        description: `Found ${result.duplicate_groups.length} duplicate groups | ${result.total_duplicates} files | ${formatFileSize(result.total_wasted_space)} wasted`,
      });
    } catch (error) {
      const msg = `${error}`;
      if (msg.includes('cancelled')) {
        toast({ title: 'Scan Cancelled', description: 'Duplicate scan was cancelled' });
      } else {
        console.error('Duplicate scan error:', error);
        toast({ title: 'Scan Failed', description: msg, variant: 'destructive' });
      }
    } finally {
      if (unlisten) unlisten();
      setIsScanning(false);
      setProgress(null);
    }
  }, [scanPath, minFileSize, toast]);

  const handleCancelScan = useCallback(async () => {
    try {
      await TauriAPI.cancelDuplicateScan();
    } catch (error) {
      console.error('Failed to cancel scan:', error);
      toast({
        variant: 'destructive',
        title: 'Cancel Failed',
        description: `Failed to cancel scan: ${error}`,
      });
    }
  }, [toast]);

  // ── Selection helpers ───────────────────────────────────────────────────────
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
        // Select all except the first (the "keep" file)
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

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleMoveToTrash = useCallback(async () => {
    if (selectedFiles.size === 0) {
      toast({
        title: 'No files selected',
        description: 'Select duplicate files to move to trash',
        variant: 'destructive',
      });
      return;
    }

    const confirmed = window.confirm(`Move ${selectedFiles.size} duplicate file(s) to trash?`);
    if (!confirmed) return;

    try {
      await TauriAPI.moveDuplicateFilesToTrash(Array.from(selectedFiles));
      toast({
        title: 'Moved to Trash',
        description: `${selectedFiles.size} file(s) moved to trash`,
      });

      // Remove deleted files from results
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
    } catch (error) {
      toast({ title: 'Failed', description: `${error}`, variant: 'destructive' });
    }
  }, [selectedFiles, results, toast]);

  const handleExportReport = useCallback(() => {
    if (!results || results.duplicate_groups.length === 0) return;

    const lines: string[] = [
      '=== Duplicate File Report ===',
      `Scan path: ${scanPath}`,
      `Scanned: ${results.files_scanned} files in ${results.scan_time_ms}ms`,
      `Duplicate groups: ${results.duplicate_groups.length}`,
      `Total duplicates: ${results.total_duplicates}`,
      `Wasted space: ${formatFileSize(results.total_wasted_space)}`,
      '',
    ];

    results.duplicate_groups.forEach((group, i) => {
      lines.push(`--- Group ${i + 1} ---`);
      lines.push(`  Hash: ${group.hash}`);
      lines.push(
        `  Size: ${formatFileSize(group.size)} each | ${group.files.length} files | ${formatFileSize(group.total_wasted_space)} wasted`,
      );
      group.files.forEach((f, idx) => {
        lines.push(`  ${idx === 0 ? '[KEEP]' : '[DUP] '} ${f.path}`);
      });
      lines.push('');
    });

    navigator.clipboard.writeText(lines.join('\n')).then(
      () => toast({ title: 'Copied', description: 'Report copied to clipboard' }),
      () =>
        toast({
          title: 'Failed',
          description: 'Could not copy to clipboard',
          variant: 'destructive',
        }),
    );
  }, [results, scanPath, toast]);

  const handleOpenFolder = useCallback(
    async (filePath: string) => {
      try {
        const separator = filePath.includes('\\') ? '\\' : '/';
        const parentDir = filePath.substring(0, filePath.lastIndexOf(separator));
        if (parentDir) {
          await TauriAPI.openFile(parentDir);
        }
      } catch (error) {
        console.error('Failed to open folder:', error);
        toast({
          variant: 'destructive',
          title: 'Open Folder Failed',
          description: `Failed to open containing folder: ${error}`,
        });
      }
    },
    [toast],
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full text-xp-text">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-xp-border">
        <div className="flex items-center gap-2">
          <Copy className="w-4 h-4 text-xp-blue" />
          <h3 className="text-xs font-semibold text-xp-text uppercase tracking-wider">
            Duplicate Finder
          </h3>
        </div>
        {scanPath && (
          <span className="text-[10px] text-xp-text-muted truncate max-w-[140px]" title={scanPath}>
            {scanPath}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-b border-xp-border space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={scanPath}
            onChange={(e) => setScanPath(e.target.value)}
            placeholder="Path to scan..."
            className="flex-1 px-2 py-1.5 text-xs bg-xp-surface border border-xp-border rounded focus:border-xp-blue focus:outline-none transition-colors"
            disabled={isScanning}
            aria-label="Path to scan for duplicates"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs text-xp-text-muted">
            <span>Min:</span>
            <input
              type="number"
              value={minFileSize}
              onChange={(e) => setMinFileSize(parseInt(e.target.value) || 0)}
              className="w-20 px-1.5 py-1 bg-xp-surface border border-xp-border rounded text-xs focus:border-xp-blue focus:outline-none"
              disabled={isScanning}
              aria-label="Minimum file size in bytes"
            />
            <span>B</span>
          </label>

          {isScanning ? (
            <button
              onClick={handleCancelScan}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-xp-red/10 text-xp-red border border-xp-red/20 hover:bg-xp-red/20 transition-colors"
              aria-label="Cancel duplicate scan"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          ) : (
            <button
              onClick={handleStartScan}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-xp-blue text-white hover:bg-xp-blue/80 transition-colors"
              aria-label="Start duplicate scan"
            >
              <Search className="w-3 h-3" />
              Scan
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {isScanning && progress && (
        <div className="px-4 py-2 border-b border-xp-border bg-xp-surface/50">
          <div className="flex items-center justify-between text-[10px] text-xp-text-muted mb-1">
            <span className="capitalize">{progress.currentPhase}</span>
            <span>
              {progress.processedFiles}
              {progress.totalFiles > 0 ? ` / ${progress.totalFiles}` : ''} files
            </span>
          </div>
          <div className="w-full bg-xp-surface rounded-full h-1.5">
            <div
              className="bg-xp-blue h-1.5 rounded-full transition-all duration-300"
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
          {progress.currentFile && (
            <div
              className="text-[10px] text-xp-text-muted mt-1 truncate"
              title={progress.currentFile}
            >
              {progress.currentFile}
            </div>
          )}
        </div>
      )}

      {/* Summary Row */}
      {results && results.duplicate_groups.length > 0 && (
        <div className="px-4 py-2 border-b border-xp-border bg-xp-surface/30">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-xp-text-muted">
              Found{' '}
              <span className="text-xp-text font-medium">{results.duplicate_groups.length}</span>{' '}
              duplicate groups
            </span>
            <span className="text-xp-border">|</span>
            <span className="text-xp-text-muted">
              <span className="text-xp-text font-medium">{results.total_duplicates}</span> duplicate
              files
            </span>
            <span className="text-xp-border">|</span>
            <span className="text-xp-red font-medium">
              {formatFileSize(results.total_wasted_space)} wasted
            </span>
          </div>
          <div className="text-[10px] text-xp-text-muted mt-0.5">
            Scanned {results.files_scanned} files in {results.scan_time_ms}ms
          </div>
        </div>
      )}

      {/* Results List */}
      <div className="flex-1 overflow-y-auto">
        {results && results.duplicate_groups.length > 0 && (
          <div>
            {results.duplicate_groups.map((group) => {
              const isExpanded = expandedGroups.has(group.hash);
              const fileCount = group.files.length;
              const allDupsSelected = group.files.slice(1).every((f) => selectedFiles.has(f.path));

              return (
                <div key={group.hash} className="border-b border-xp-border/50">
                  {/* Group header */}
                  <div
                    className="flex items-center gap-2 px-4 py-2 hover:bg-xp-surface/50 cursor-pointer transition-colors"
                    onClick={() => toggleGroupExpansion(group.hash)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-xp-text-muted flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-xp-text-muted flex-shrink-0" />
                    )}

                    {/* Size badge */}
                    <span
                      className={cn(
                        'px-1.5 py-0.5 text-[10px] font-mono rounded border',
                        sizeBadgeColor(group.size),
                      )}
                    >
                      {formatFileSize(group.size)}
                    </span>

                    {/* Hash (truncated) */}
                    <span
                      className="text-[10px] text-xp-text-muted font-mono truncate max-w-[80px]"
                      title={group.hash}
                    >
                      {group.hash.slice(0, 8)}...
                    </span>

                    {/* File count */}
                    <span className="text-xs text-xp-text-muted">{fileCount} files</span>

                    <span className="flex-1" />

                    {/* Wasted space */}
                    <span className="text-[10px] text-xp-red font-medium">
                      -{formatFileSize(group.total_wasted_space)}
                    </span>

                    {/* Select all duplicates toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        selectAllDuplicatesInGroup(group);
                      }}
                      className={cn(
                        'px-1.5 py-0.5 text-[10px] rounded border transition-colors',
                        allDupsSelected
                          ? 'bg-xp-blue/20 text-xp-blue border-xp-blue/30'
                          : 'bg-xp-surface border-xp-border text-xp-text-muted hover:border-xp-blue/50',
                      )}
                      title={allDupsSelected ? 'Deselect duplicates' : 'Select all duplicates'}
                      aria-label={
                        allDupsSelected
                          ? 'Deselect all duplicates in group'
                          : 'Select all duplicates in group'
                      }
                    >
                      {allDupsSelected ? 'Deselect' : 'Select'}
                    </button>
                  </div>

                  {/* Expanded file list */}
                  {isExpanded && (
                    <div className="pl-6 pr-4 pb-2 space-y-0.5">
                      {group.files.map((file, index) => {
                        const isKeep = index === 0;

                        return (
                          <div
                            key={file.path}
                            className={cn(
                              'flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors',
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
                              aria-label={`Select ${file.name} for deletion`}
                            />

                            {isKeep ? (
                              <Check className="w-3.5 h-3.5 text-xp-green flex-shrink-0" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-xp-text-muted flex-shrink-0" />
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
                              className="p-1 rounded hover:bg-xp-surface-light transition-colors flex-shrink-0"
                              title="Open containing folder"
                              aria-label={`Open folder containing ${file.name}`}
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

        {/* Empty results state */}
        {results && results.duplicate_groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-xp-text-secondary">
            <Check className="w-10 h-10 mb-3 text-xp-green" />
            <div className="text-sm font-medium">No duplicates found</div>
            <div className="text-xs mt-1">All files in this directory are unique</div>
          </div>
        )}

        {/* Initial empty state */}
        {!isScanning && !results && (
          <div className="flex flex-col items-center justify-center py-12 text-xp-text-secondary">
            <Search className="w-10 h-10 mb-3 opacity-40" />
            <div className="text-sm">Configure path and click Scan</div>
            <div className="text-xs mt-1">to find duplicate files</div>
          </div>
        )}
      </div>

      {/* Actions Bar (bottom) */}
      {results && results.duplicate_groups.length > 0 && (
        <div className="px-4 py-2 border-t border-xp-border bg-xp-surface/30 flex items-center gap-2">
          {selectedFiles.size > 0 && (
            <>
              <span className="text-[10px] text-xp-text-muted mr-1">
                {selectedFiles.size} selected
              </span>
              <button
                onClick={handleMoveToTrash}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded bg-xp-red/10 text-xp-red border border-xp-red/20 hover:bg-xp-red/20 transition-colors"
                aria-label={`Delete ${selectedFiles.size} selected duplicate files`}
              >
                <Trash2 className="w-3 h-3" />
                Delete Selected
              </button>
            </>
          )}
          <span className="flex-1" />
          <button
            onClick={handleExportReport}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded bg-xp-surface border border-xp-border text-xp-text-muted hover:text-xp-text hover:border-xp-blue/50 transition-colors"
            aria-label="Export duplicate report to clipboard"
          >
            <ClipboardCopy className="w-3 h-3" />
            Export Report
          </button>
        </div>
      )}
    </div>
  );
};

export default DuplicateFinderPanel;
