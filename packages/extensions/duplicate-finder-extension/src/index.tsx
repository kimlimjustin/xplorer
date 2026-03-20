/**
 * Xplorer Duplicate Finder Extension
 *
 * Finds and manages duplicate files across directories.
 * Registers via Sidebar.register() to provide a panel in the right sidebar.
 */

import React from 'react';
import { Sidebar, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Types ──────────────────────────────────────────────────────────────────────

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

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0 || !isFinite(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** Returns an inline style object for the file-size badge color. */
function sizeBadgeStyle(bytes: number): React.CSSProperties {
  if (bytes >= 1024 * 1024 * 100) return { backgroundColor: 'rgba(247, 118, 142, 0.2)', color: '#f7768e', border: '1px solid rgba(247, 118, 142, 0.3)' };
  if (bytes >= 1024 * 1024 * 10) return { backgroundColor: 'rgba(255, 158, 100, 0.2)', color: '#ff9e64', border: '1px solid rgba(255, 158, 100, 0.3)' };
  if (bytes >= 1024 * 1024) return { backgroundColor: 'rgba(224, 175, 104, 0.2)', color: '#e0af68', border: '1px solid rgba(224, 175, 104, 0.3)' };
  if (bytes >= 1024 * 100) return { backgroundColor: 'rgba(122, 162, 247, 0.2)', color: '#7aa2f7', border: '1px solid rgba(122, 162, 247, 0.3)' };
  return { backgroundColor: 'var(--xp-surface)', color: 'var(--xp-text-muted)', border: '1px solid var(--xp-border)' };
}

// ── SVG Icons (inline to avoid lucide-react dependency) ────────────────────────

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

function IconSearch({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
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

function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
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

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    color: 'var(--xp-text)',
    fontFamily: 'sans-serif',
    fontSize: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--xp-border)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'var(--xp-text)',
  },
  headerPath: {
    fontSize: 10,
    color: 'var(--xp-text-muted)',
    maxWidth: 140,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  controls: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--xp-border)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  input: {
    flex: 1,
    padding: '6px 8px',
    fontSize: 12,
    backgroundColor: 'var(--xp-surface)',
    border: '1px solid var(--xp-border)',
    borderRadius: 4,
    color: 'var(--xp-text)',
    outline: 'none',
  },
  minSizeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  minSizeLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: 'var(--xp-text-muted)',
  },
  minSizeInput: {
    width: 80,
    padding: '4px 6px',
    fontSize: 12,
    backgroundColor: 'var(--xp-surface)',
    border: '1px solid var(--xp-border)',
    borderRadius: 4,
    color: 'var(--xp-text)',
    outline: 'none',
  },
  scanBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    fontSize: 12,
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
    gap: 6,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 4,
    backgroundColor: 'rgba(247, 118, 142, 0.1)',
    color: '#f7768e',
    border: '1px solid rgba(247, 118, 142, 0.2)',
    cursor: 'pointer',
  },
  progress: {
    padding: '8px 16px',
    borderBottom: '1px solid var(--xp-border)',
    backgroundColor: 'rgba(var(--xp-surface), 0.5)',
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
    height: 6,
    overflow: 'hidden' as const,
  },
  progressBarInner: {
    backgroundColor: 'var(--xp-blue)',
    height: 6,
    borderRadius: 6,
    transition: 'width 0.3s ease',
  },
  progressFile: {
    fontSize: 10,
    color: 'var(--xp-text-muted)',
    marginTop: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  summary: {
    padding: '8px 16px',
    borderBottom: '1px solid var(--xp-border)',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    flexWrap: 'wrap' as const,
  },
  summaryMuted: { color: 'var(--xp-text-muted)' },
  summaryBold: { color: 'var(--xp-text)', fontWeight: 500 },
  summaryRed: { color: '#f7768e', fontWeight: 500 },
  summaryDivider: { color: 'var(--xp-border)' },
  summarySubtext: { fontSize: 10, color: 'var(--xp-text-muted)', marginTop: 2 },
  resultsList: {
    flex: 1,
    overflowY: 'auto' as const,
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
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
    maxWidth: 80,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  groupFileCount: {
    fontSize: 12,
    color: 'var(--xp-text-muted)',
  },
  spacer: { flex: 1 },
  wastedBadge: {
    fontSize: 10,
    color: '#f7768e',
    fontWeight: 500,
  },
  selectBtn: {
    padding: '2px 6px',
    fontSize: 10,
    borderRadius: 4,
    cursor: 'pointer',
    border: '1px solid var(--xp-border)',
    backgroundColor: 'var(--xp-surface)',
    color: 'var(--xp-text-muted)',
  },
  selectBtnActive: {
    padding: '2px 6px',
    fontSize: 10,
    borderRadius: 4,
    cursor: 'pointer',
    border: '1px solid rgba(122, 162, 247, 0.3)',
    backgroundColor: 'rgba(122, 162, 247, 0.2)',
    color: '#7aa2f7',
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 12,
  },
  fileRowSelected: {
    backgroundColor: 'rgba(122, 162, 247, 0.1)',
    border: '1px solid rgba(122, 162, 247, 0.2)',
  },
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
    padding: 4,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: 'var(--xp-text-muted)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    paddingBottom: 48,
    color: 'var(--xp-text-muted)',
  },
  emptyIcon: {
    marginBottom: 12,
    opacity: 0.4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 500,
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  actionsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    borderTop: '1px solid var(--xp-border)',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  selectedCount: {
    fontSize: 10,
    color: 'var(--xp-text-muted)',
    marginRight: 4,
  },
  deleteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 500,
    borderRadius: 4,
    backgroundColor: 'rgba(247, 118, 142, 0.1)',
    color: '#f7768e',
    border: '1px solid rgba(247, 118, 142, 0.2)',
    cursor: 'pointer',
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 500,
    borderRadius: 4,
    backgroundColor: 'var(--xp-surface)',
    color: 'var(--xp-text-muted)',
    border: '1px solid var(--xp-border)',
    cursor: 'pointer',
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

let _api: XplorerAPI;

function DuplicateFinderPanel({ currentPath = '' }: { currentPath?: string }) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [progress, setProgress] = React.useState<ScanProgress | null>(null);
  const [results, setResults] = React.useState<DuplicateFinderResult | null>(null);
  const [selectedFiles, setSelectedFiles] = React.useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());

  const [scanPath, setScanPath] = React.useState(currentPath || '');
  const [minFileSize, setMinFileSize] = React.useState(1024);

  // Sync scan path with currentPath prop
  React.useEffect(() => {
    if (currentPath) setScanPath(currentPath);
  }, [currentPath]);

  // ── Scan ──────────────────────────────────────────────────────────────────

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

    // Listen for progress events from the backend.
    // The host exposes listenToEvent on the TauriAPI, but since built-in
    // extensions run in the host context we can access it via the global.
    let unlisten: (() => void) | null = null;

    try {
      // Access the host transport layer for event listening
      const hostTransport = (window as any).__xplorer_transport__;
      if (hostTransport && hostTransport.listenToEvent) {
        unlisten = await hostTransport.listenToEvent('duplicate-finder-progress', (payload: ScanProgress) => {
          setProgress(payload);
        });
      }

      const result = await _api.search.findDuplicates(scanPath, { minFileSize }) as DuplicateFinderResult;
      setResults(result);

      _api.ui.showMessage(
        `Found ${result.duplicate_groups.length} duplicate groups | ${result.total_duplicates} files | ${formatFileSize(result.total_wasted_space)} wasted`,
        'info',
      );
    } catch (error) {
      const msg = `${error}`;
      if (msg.includes('cancelled')) {
        _api.ui.showMessage('Duplicate scan was cancelled', 'info');
      } else {
        console.error('Duplicate scan error:', error);
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
      // Cancel via the host TauriAPI global
      const TauriAPI = (window as any).__xplorer_tauri_api__?.default || (window as any).__xplorer_tauri_api__;
      if (TauriAPI && TauriAPI.cancelDuplicateScan) {
        await TauriAPI.cancelDuplicateScan();
      }
    } catch (error) {
      console.error('Failed to cancel scan:', error);
      _api.ui.showMessage(`Failed to cancel scan: ${error}`, 'error');
    }
  }, []);

  // ── Selection helpers ─────────────────────────────────────────────────────

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

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleMoveToTrash = React.useCallback(async () => {
    if (selectedFiles.size === 0) {
      _api.ui.showMessage('Select duplicate files to move to trash', 'error');
      return;
    }

    const confirmed = await _api.dialog.confirm(
      `Move ${selectedFiles.size} duplicate file(s) to trash?`,
      'Confirm Deletion',
    );
    if (!confirmed) return;

    try {
      // Use the host TauriAPI for trash operation
      const TauriAPI = (window as any).__xplorer_tauri_api__?.default || (window as any).__xplorer_tauri_api__;
      if (TauriAPI && TauriAPI.moveDuplicateFilesToTrash) {
        await TauriAPI.moveDuplicateFilesToTrash(Array.from(selectedFiles));
      }

      _api.ui.showMessage(`${selectedFiles.size} file(s) moved to trash`, 'info');

      // Remove deleted files from results
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
    } catch (error) {
      _api.ui.showMessage(`Failed: ${error}`, 'error');
    }
  }, [selectedFiles, results]);

  const handleExportReport = React.useCallback(() => {
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
      lines.push(`  Size: ${formatFileSize(group.size)} each | ${group.files.length} files | ${formatFileSize(group.total_wasted_space)} wasted`);
      group.files.forEach((f, idx) => {
        lines.push(`  ${idx === 0 ? '[KEEP]' : '[DUP] '} ${f.path}`);
      });
      lines.push('');
    });

    navigator.clipboard.writeText(lines.join('\n')).then(
      () => _api.ui.showMessage('Report copied to clipboard', 'info'),
      () => _api.ui.showMessage('Could not copy to clipboard', 'error'),
    );
  }, [results, scanPath]);

  const handleOpenFolder = React.useCallback(async (filePath: string) => {
    try {
      const separator = filePath.includes('\\') ? '\\' : '/';
      const parentDir = filePath.substring(0, filePath.lastIndexOf(separator));
      if (parentDir) {
        _api.navigation.navigateTo(parentDir);
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
      _api.ui.showMessage(`Failed to navigate: ${error}`, 'error');
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={{ color: 'var(--xp-blue)' }}><IconCopy size={16} /></span>
          <h3 style={styles.headerTitle}>Duplicate Finder</h3>
        </div>
        {scanPath && (
          <span style={styles.headerPath} title={scanPath}>{scanPath}</span>
        )}
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            value={scanPath}
            onChange={(e) => setScanPath(e.target.value)}
            placeholder="Path to scan..."
            style={styles.input}
            disabled={isScanning}
          />
        </div>

        <div style={styles.minSizeRow}>
          <label style={styles.minSizeLabel}>
            <span>Min:</span>
            <input
              type="number"
              value={minFileSize}
              onChange={(e) => setMinFileSize(parseInt(e.target.value) || 0)}
              style={styles.minSizeInput}
              disabled={isScanning}
            />
            <span>B</span>
          </label>

          {isScanning ? (
            <button onClick={handleCancelScan} style={styles.cancelBtn}>
              <IconX size={12} />
              Cancel
            </button>
          ) : (
            <button onClick={handleStartScan} style={styles.scanBtn}>
              <IconSearch size={12} />
              Scan
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {isScanning && progress && (
        <div style={styles.progress}>
          <div style={styles.progressRow}>
            <span style={{ textTransform: 'capitalize' }}>{progress.currentPhase}</span>
            <span>
              {progress.processedFiles}
              {progress.totalFiles > 0 ? ` / ${progress.totalFiles}` : ''} files
            </span>
          </div>
          <div style={styles.progressBarOuter}>
            <div
              style={{
                ...styles.progressBarInner,
                width: progress.totalFiles > 0
                  ? `${Math.min(100, (progress.processedFiles / progress.totalFiles) * 100)}%`
                  : '60%',
              }}
            />
          </div>
          {progress.currentFile && (
            <div style={styles.progressFile} title={progress.currentFile}>
              {progress.currentFile}
            </div>
          )}
        </div>
      )}

      {/* Summary Row */}
      {results && results.duplicate_groups.length > 0 && (
        <div style={styles.summary}>
          <div style={styles.summaryRow}>
            <span style={styles.summaryMuted}>
              Found <span style={styles.summaryBold}>{results.duplicate_groups.length}</span> duplicate groups
            </span>
            <span style={styles.summaryDivider}>|</span>
            <span style={styles.summaryMuted}>
              <span style={styles.summaryBold}>{results.total_duplicates}</span> duplicate files
            </span>
            <span style={styles.summaryDivider}>|</span>
            <span style={styles.summaryRed}>{formatFileSize(results.total_wasted_space)} wasted</span>
          </div>
          <div style={styles.summarySubtext}>
            Scanned {results.files_scanned} files in {results.scan_time_ms}ms
          </div>
        </div>
      )}

      {/* Results List */}
      <div style={styles.resultsList}>
        {results && results.duplicate_groups.length > 0 && (
          <div>
            {results.duplicate_groups.map((group) => {
              const isExpanded = expandedGroups.has(group.hash);
              const fileCount = group.files.length;
              const allDupsSelected = group.files.slice(1).every((f) => selectedFiles.has(f.path));

              return (
                <div key={group.hash} style={{ borderBottom: '1px solid rgba(128,128,128,0.2)' }}>
                  {/* Group header */}
                  <div
                    style={styles.groupHeader}
                    onClick={() => toggleGroupExpansion(group.hash)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(128,128,128,0.1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{ flexShrink: 0, color: 'var(--xp-text-muted)' }}>
                      {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                    </span>

                    {/* Size badge */}
                    <span style={{ ...styles.sizeBadge, ...sizeBadgeStyle(group.size) }}>
                      {formatFileSize(group.size)}
                    </span>

                    {/* Hash (truncated) */}
                    <span style={styles.hashText} title={group.hash}>
                      {group.hash.slice(0, 8)}...
                    </span>

                    {/* File count */}
                    <span style={styles.groupFileCount}>{fileCount} files</span>

                    <span style={styles.spacer} />

                    {/* Wasted space */}
                    <span style={styles.wastedBadge}>-{formatFileSize(group.total_wasted_space)}</span>

                    {/* Select all duplicates toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        selectAllDuplicatesInGroup(group);
                      }}
                      style={allDupsSelected ? styles.selectBtnActive : styles.selectBtn}
                      title={allDupsSelected ? 'Deselect duplicates' : 'Select all duplicates'}
                    >
                      {allDupsSelected ? 'Deselect' : 'Select'}
                    </button>
                  </div>

                  {/* Expanded file list */}
                  {isExpanded && (
                    <div style={{ paddingLeft: 24, paddingRight: 16, paddingBottom: 8 }}>
                      {group.files.map((file, index) => {
                        const isKeep = index === 0;
                        const isSelected = selectedFiles.has(file.path);

                        return (
                          <div
                            key={file.path}
                            style={{
                              ...styles.fileRow,
                              ...(isSelected ? styles.fileRowSelected : {}),
                              marginBottom: 2,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFile(file.path)}
                              style={styles.checkbox}
                            />

                            <span style={{ flexShrink: 0, color: isKeep ? '#9ece6a' : 'var(--xp-text-muted)' }}>
                              {isKeep ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            </span>

                            <div style={styles.fileName}>
                              <div style={styles.fileNameText}>
                                {file.name}
                                {isKeep && <span style={styles.keepBadge}>(keep)</span>}
                              </div>
                              <div style={styles.filePathText}>{file.path}</div>
                            </div>

                            <button
                              onClick={() => handleOpenFolder(file.path)}
                              style={styles.openFolderBtn}
                              title="Open containing folder"
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

        {/* Empty results state */}
        {results && results.duplicate_groups.length === 0 && (
          <div style={styles.emptyState}>
            <div style={{ ...styles.emptyIcon, color: '#9ece6a' }}>
              <IconCheck size={40} />
            </div>
            <div style={styles.emptyTitle}>No duplicates found</div>
            <div style={styles.emptySubtitle}>All files in this directory are unique</div>
          </div>
        )}

        {/* Initial empty state */}
        {!isScanning && !results && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <IconSearch size={40} />
            </div>
            <div style={styles.emptyTitle}>Configure path and click Scan</div>
            <div style={styles.emptySubtitle}>to find duplicate files</div>
          </div>
        )}
      </div>

      {/* Actions Bar (bottom) */}
      {results && results.duplicate_groups.length > 0 && (
        <div style={styles.actionsBar}>
          {selectedFiles.size > 0 && (
            <>
              <span style={styles.selectedCount}>{selectedFiles.size} selected</span>
              <button onClick={handleMoveToTrash} style={styles.deleteBtn}>
                <IconTrash size={12} />
                Delete Selected
              </button>
            </>
          )}
          <span style={styles.spacer} />
          <button onClick={handleExportReport} style={styles.exportBtn}>
            <IconClipboard size={12} />
            Export Report
          </button>
        </div>
      )}
    </div>
  );
}

// ── Register Extension ─────────────────────────────────────────────────────────

Sidebar.register({
  id: 'duplicate-finder',
  title: 'Duplicate Finder',
  description: 'Find and manage duplicate files in your directories',
  icon: 'search',
  location: 'right',
  permissions: ['file:read', 'search:duplicates', 'ui:panels'],
  render: ({ currentPath }) => React.createElement(DuplicateFinderPanel, { currentPath }),
  onActivate: (api) => { _api = api; },
});
