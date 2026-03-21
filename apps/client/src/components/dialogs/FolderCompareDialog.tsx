import React, { useState, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TauriAPI } from '@/lib/tauri-api';
import { formatFileSize, formatDate } from '@/lib/utils';
import { compareFolders, type FolderCompareResult } from '@/lib/folder-compare';
import { FolderOpen, ArrowRight, ArrowLeft, Search, X } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface FolderCompareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDiff?: (file1Path: string, file2Path: string) => void;
  initialLeft?: string;
  initialRight?: string;
}

type FilterMode = 'all' | 'different' | 'missing' | 'identical';

type ResultRow =
  | {
      status: 'only-left';
      name: string;
      leftPath: string;
      rightPath: null;
      leftSize: number;
      rightSize: null;
      leftModified: number;
      rightModified: null;
    }
  | {
      status: 'only-right';
      name: string;
      leftPath: null;
      rightPath: string;
      leftSize: null;
      rightSize: number;
      leftModified: null;
      rightModified: number;
    }
  | {
      status: 'different';
      name: string;
      leftPath: string;
      rightPath: string;
      leftSize: number;
      rightSize: number;
      leftModified: number;
      rightModified: number;
    }
  | {
      status: 'identical';
      name: string;
      leftPath: string;
      rightPath: string;
      leftSize: number;
      rightSize: number;
      leftModified: null;
      rightModified: null;
    };

// ── Styles (CSS variable-driven) ─────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
};

const dialogStyle: React.CSSProperties = {
  backgroundColor: 'var(--xp-surface)',
  borderRadius: 8,
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
  width: 900,
  maxWidth: '95vw',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 24px',
  borderBottom: '1px solid var(--xp-border)',
};

const contentStyle: React.CSSProperties = {
  padding: '16px 24px',
  flex: 1,
  overflowY: 'auto',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 24px',
  borderTop: '1px solid var(--xp-border)',
  backgroundColor: 'var(--xp-bg)',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  border: '1px solid var(--xp-border)',
  borderRadius: 6,
  backgroundColor: 'var(--xp-bg)',
  color: 'var(--xp-text)',
  fontSize: 13,
  outline: 'none',
};

const btnSecondary: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid var(--xp-border)',
  borderRadius: 6,
  backgroundColor: 'transparent',
  color: 'var(--xp-text)',
  cursor: 'pointer',
  fontSize: 13,
  transition: 'background-color 0.15s',
};

const btnPrimary: React.CSSProperties = {
  padding: '6px 16px',
  border: 'none',
  borderRadius: 6,
  backgroundColor: 'var(--xp-blue)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  transition: 'opacity 0.15s',
};

const summaryBarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  padding: '10px 14px',
  borderRadius: 6,
  backgroundColor: 'var(--xp-bg)',
  fontSize: 12,
  color: 'var(--xp-text-muted)',
  marginBottom: 12,
};

const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  marginBottom: 12,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid var(--xp-border)',
  color: 'var(--xp-text-muted)',
  fontWeight: 600,
  position: 'sticky',
  top: 0,
  backgroundColor: 'var(--xp-surface)',
  zIndex: 1,
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--xp-border)',
  color: 'var(--xp-text)',
  verticalAlign: 'middle',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const statusBadge = (status: ResultRow['status']): React.ReactNode => {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    'only-left': { label: 'Left Only', bg: 'rgba(239,68,68,0.15)', fg: '#f87171' },
    'only-right': { label: 'Right Only', bg: 'rgba(239,68,68,0.15)', fg: '#f87171' },
    different: { label: 'Different', bg: 'rgba(234,179,8,0.15)', fg: '#facc15' },
    identical: { label: 'Identical', bg: 'rgba(34,197,94,0.15)', fg: '#4ade80' },
  };
  const s = map[status];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        backgroundColor: s.bg,
        color: s.fg,
      }}
    >
      {s.label}
    </span>
  );
};

const rowBg = (status: ResultRow['status']): string => {
  switch (status) {
    case 'only-left':
    case 'only-right':
      return 'rgba(239,68,68,0.04)';
    case 'different':
      return 'rgba(234,179,8,0.04)';
    case 'identical':
      return 'rgba(34,197,94,0.04)';
  }
};

// ── Component ────────────────────────────────────────────────────────────────

const FolderCompareDialog = ({
  isOpen,
  onClose,
  onOpenDiff,
  initialLeft = '',
  initialRight = '',
}: FolderCompareDialogProps) => {
  const { toast } = useToast();

  // Path inputs
  const [leftPath, setLeftPath] = useState(initialLeft);
  const [rightPath, setRightPath] = useState(initialRight);

  // Comparison state
  const [result, setResult] = useState<FolderCompareResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter / selection
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);

  // ── Browse handlers ──────────────────────────────────────────────────────

  const handleBrowse = useCallback(async (side: 'left' | 'right') => {
    try {
      const result = await TauriAPI.showOpenDialog({
        directory: true,
        multiple: false,
      });
      if (result && result.length > 0) {
        if (side === 'left') setLeftPath(result[0]);
        else setRightPath(result[0]);
      }
    } catch (err) {
      console.error('Failed to open directory dialog:', err);
    }
  }, []);

  // ── Compare ──────────────────────────────────────────────────────────────

  const handleCompare = useCallback(async () => {
    if (!leftPath.trim() || !rightPath.trim()) {
      toast({
        title: 'Paths required',
        description: 'Please enter both left and right folder paths.',
        variant: 'destructive',
      });
      return;
    }
    setComparing(true);
    setError(null);
    setResult(null);
    setSelectedRows(new Set());
    setFilter('all');

    try {
      const r = await compareFolders(leftPath.trim(), rightPath.trim());
      setResult(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast({ title: 'Comparison failed', description: msg, variant: 'destructive' });
    } finally {
      setComparing(false);
    }
  }, [leftPath, rightPath, toast]);

  // ── Build flat rows ──────────────────────────────────────────────────────

  const allRows: ResultRow[] = useMemo(() => {
    if (!result) return [];
    const rows: ResultRow[] = [];

    for (const f of result.onlyInLeft) {
      rows.push({
        status: 'only-left',
        name: f.name,
        leftPath: f.path,
        rightPath: null,
        leftSize: f.size,
        rightSize: null,
        leftModified: f.modifiedAt,
        rightModified: null,
      });
    }
    for (const f of result.onlyInRight) {
      rows.push({
        status: 'only-right',
        name: f.name,
        leftPath: null,
        rightPath: f.path,
        leftSize: null,
        rightSize: f.size,
        leftModified: null,
        rightModified: f.modifiedAt,
      });
    }
    for (const f of result.different) {
      rows.push({
        status: 'different',
        name: f.name,
        leftPath: f.leftPath,
        rightPath: f.rightPath,
        leftSize: f.leftSize,
        rightSize: f.rightSize,
        leftModified: f.leftModified,
        rightModified: f.rightModified,
      });
    }
    for (const f of result.identical) {
      rows.push({
        status: 'identical',
        name: f.name,
        leftPath: f.leftPath,
        rightPath: f.rightPath,
        leftSize: f.size,
        rightSize: f.size,
        leftModified: null,
        rightModified: null,
      });
    }

    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [result]);

  const filteredRows = useMemo(() => {
    switch (filter) {
      case 'different':
        return allRows.filter((r) => r.status === 'different');
      case 'missing':
        return allRows.filter((r) => r.status === 'only-left' || r.status === 'only-right');
      case 'identical':
        return allRows.filter((r) => r.status === 'identical');
      default:
        return allRows;
    }
  }, [allRows, filter]);

  // ── Selection ────────────────────────────────────────────────────────────

  const toggleRow = useCallback((name: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedRows.size === filteredRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredRows.map((r) => r.name)));
    }
  }, [selectedRows, filteredRows]);

  // ── Copy actions ─────────────────────────────────────────────────────────

  const handleCopy = useCallback(
    async (direction: 'left-to-right' | 'right-to-left') => {
      if (selectedRows.size === 0) {
        toast({
          title: 'No files selected',
          description: 'Select files to copy.',
          variant: 'destructive',
        });
        return;
      }

      setCopying(true);
      let copied = 0;
      const errors: string[] = [];

      for (const name of selectedRows) {
        const row = allRows.find((r) => r.name === name);
        if (!row) continue;

        try {
          if (direction === 'left-to-right') {
            if (!row.leftPath) continue;
            const sep = rightPath.includes('/') ? '/' : '\\';
            const dest = `${rightPath}${rightPath.endsWith(sep) ? '' : sep}${name}`;
            await TauriAPI.copy(row.leftPath, dest);
            copied++;
          } else {
            if (!row.rightPath) continue;
            const sep = leftPath.includes('/') ? '/' : '\\';
            const dest = `${leftPath}${leftPath.endsWith(sep) ? '' : sep}${name}`;
            await TauriAPI.copy(row.rightPath, dest);
            copied++;
          }
        } catch (err) {
          errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      setCopying(false);

      if (errors.length === 0) {
        toast({
          title: 'Copy complete',
          description: `${copied} file${copied !== 1 ? 's' : ''} copied.`,
        });
      } else {
        toast({
          title: 'Copy completed with errors',
          description: `${copied} copied, ${errors.length} failed: ${errors.slice(0, 3).join('; ')}`,
          variant: 'destructive',
        });
      }

      // Re-compare to reflect changes
      if (copied > 0) {
        await handleCompare();
      }
    },
    [selectedRows, allRows, leftPath, rightPath, toast, handleCompare],
  );

  // ── Open diff viewer ─────────────────────────────────────────────────────

  const handleOpenDiff = useCallback(
    (row: ResultRow) => {
      if (row.status !== 'different' || !row.leftPath || !row.rightPath) return;
      if (onOpenDiff) {
        onOpenDiff(row.leftPath, row.rightPath);
      }
    },
    [onOpenDiff],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const filterBtnStyle = (mode: FilterMode): React.CSSProperties => ({
    ...btnSecondary,
    backgroundColor: filter === mode ? 'var(--xp-blue)' : 'transparent',
    color: filter === mode ? '#fff' : 'var(--xp-text-muted)',
    borderColor: filter === mode ? 'var(--xp-blue)' : 'var(--xp-border)',
    fontSize: 12,
    padding: '4px 12px',
  });

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--xp-text)', margin: 0 }}>
            Compare Folders
          </h2>
          <button
            onClick={onClose}
            style={{
              ...btnSecondary,
              padding: 6,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Close folder compare dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {/* Path inputs */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
            {/* Left folder */}
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--xp-text-muted)',
                  marginBottom: 4,
                }}
              >
                Left Folder
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="text"
                  value={leftPath}
                  onChange={(e) => setLeftPath(e.target.value)}
                  placeholder="Enter left folder path..."
                  style={inputStyle}
                />
                <button
                  onClick={() => handleBrowse('left')}
                  style={{
                    ...btnSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 8px',
                  }}
                  aria-label="Browse for left folder"
                >
                  <FolderOpen size={14} />
                </button>
              </div>
            </div>

            {/* Right folder */}
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--xp-text-muted)',
                  marginBottom: 4,
                }}
              >
                Right Folder
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="text"
                  value={rightPath}
                  onChange={(e) => setRightPath(e.target.value)}
                  placeholder="Enter right folder path..."
                  style={inputStyle}
                />
                <button
                  onClick={() => handleBrowse('right')}
                  style={{
                    ...btnSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 8px',
                  }}
                  aria-label="Browse for right folder"
                >
                  <FolderOpen size={14} />
                </button>
              </div>
            </div>

            {/* Compare button */}
            <button
              onClick={handleCompare}
              disabled={comparing || !leftPath.trim() || !rightPath.trim()}
              style={{
                ...btnPrimary,
                opacity: comparing || !leftPath.trim() || !rightPath.trim() ? 0.5 : 1,
                cursor:
                  comparing || !leftPath.trim() || !rightPath.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
              aria-label={comparing ? 'Comparing folders' : 'Compare folders'}
            >
              {comparing ? (
                <span
                  style={{
                    display: 'inline-block',
                    width: 14,
                    height: 14,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                  }}
                />
              ) : (
                <Search size={14} />
              )}
              {comparing ? 'Comparing...' : 'Compare'}
            </button>
          </div>

          {/* Error state */}
          {error && (
            <div style={{ padding: 16, textAlign: 'center', color: '#f87171', fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Comparing spinner (standalone, before any results) */}
          {comparing && !result && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 48,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 24,
                  height: 24,
                  border: '2px solid var(--xp-border)',
                  borderTopColor: 'var(--xp-blue)',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                }}
              />
              <span style={{ marginLeft: 10, color: 'var(--xp-text-muted)', fontSize: 13 }}>
                Comparing folders...
              </span>
            </div>
          )}

          {/* Results */}
          {result && !comparing && (
            <>
              {/* Summary bar */}
              <div style={summaryBarStyle}>
                <span>
                  Left:{' '}
                  <strong style={{ color: 'var(--xp-text)' }}>{result.summary.totalLeft}</strong>{' '}
                  files
                </span>
                <span>
                  Right:{' '}
                  <strong style={{ color: 'var(--xp-text)' }}>{result.summary.totalRight}</strong>{' '}
                  files
                </span>
                <span style={{ color: '#facc15' }}>
                  Different: <strong>{result.summary.different}</strong>
                </span>
                <span style={{ color: '#f87171' }}>
                  Only Left: <strong>{result.summary.onlyLeft}</strong>
                </span>
                <span style={{ color: '#f87171' }}>
                  Only Right: <strong>{result.summary.onlyRight}</strong>
                </span>
                <span style={{ color: '#4ade80' }}>
                  Identical: <strong>{result.summary.identical}</strong>
                </span>
              </div>

              {/* Filter buttons */}
              <div style={filterBarStyle}>
                <button onClick={() => setFilter('all')} style={filterBtnStyle('all')}>
                  All ({allRows.length})
                </button>
                <button onClick={() => setFilter('different')} style={filterBtnStyle('different')}>
                  Different ({result.summary.different})
                </button>
                <button onClick={() => setFilter('missing')} style={filterBtnStyle('missing')}>
                  Missing ({result.summary.onlyLeft + result.summary.onlyRight})
                </button>
                <button onClick={() => setFilter('identical')} style={filterBtnStyle('identical')}>
                  Identical ({result.summary.identical})
                </button>
              </div>

              {/* Results table */}
              <div
                style={{
                  maxHeight: 380,
                  overflowY: 'auto',
                  borderRadius: 6,
                  border: '1px solid var(--xp-border)',
                }}
              >
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 32 }}>
                        <input
                          type="checkbox"
                          checked={
                            filteredRows.length > 0 && selectedRows.size === filteredRows.length
                          }
                          onChange={toggleAll}
                          style={{ accentColor: 'var(--xp-blue)' }}
                        />
                      </th>
                      <th style={{ ...thStyle, width: 90 }}>Status</th>
                      <th style={thStyle}>File Name</th>
                      <th style={{ ...thStyle, width: 90, textAlign: 'right' }}>Left Size</th>
                      <th style={{ ...thStyle, width: 90, textAlign: 'right' }}>Right Size</th>
                      <th style={{ ...thStyle, width: 140 }}>Left Modified</th>
                      <th style={{ ...thStyle, width: 140 }}>Right Modified</th>
                      <th style={{ ...thStyle, width: 60 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            ...tdStyle,
                            textAlign: 'center',
                            padding: 24,
                            color: 'var(--xp-text-muted)',
                          }}
                        >
                          No files match the current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr
                          key={row.name}
                          style={{
                            backgroundColor: selectedRows.has(row.name)
                              ? 'rgba(59,130,246,0.08)'
                              : rowBg(row.status),
                            transition: 'background-color 0.1s',
                          }}
                        >
                          <td style={tdStyle}>
                            <input
                              type="checkbox"
                              checked={selectedRows.has(row.name)}
                              onChange={() => toggleRow(row.name)}
                              style={{ accentColor: 'var(--xp-blue)' }}
                            />
                          </td>
                          <td style={tdStyle}>{statusBadge(row.status)}</td>
                          <td style={{ ...tdStyle, fontWeight: 500 }}>{row.name}</td>
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              fontSize: 11,
                            }}
                          >
                            {row.leftSize != null ? formatFileSize(row.leftSize) : '\u2014'}
                          </td>
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              fontSize: 11,
                            }}
                          >
                            {row.rightSize != null ? formatFileSize(row.rightSize) : '\u2014'}
                          </td>
                          <td style={{ ...tdStyle, fontSize: 11 }}>
                            {row.leftModified != null ? formatDate(row.leftModified) : '\u2014'}
                          </td>
                          <td style={{ ...tdStyle, fontSize: 11 }}>
                            {row.rightModified != null ? formatDate(row.rightModified) : '\u2014'}
                          </td>
                          <td style={tdStyle}>
                            {row.status === 'different' && onOpenDiff && (
                              <button
                                onClick={() => handleOpenDiff(row)}
                                style={{
                                  ...btnSecondary,
                                  padding: '2px 8px',
                                  fontSize: 11,
                                  border: '1px solid var(--xp-border)',
                                }}
                                title="Open in Diff Viewer"
                              >
                                Diff
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          {result && selectedRows.size > 0 && (
            <>
              <button
                onClick={() => handleCopy('left-to-right')}
                disabled={copying}
                style={{
                  ...btnSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  opacity: copying ? 0.5 : 1,
                }}
                title="Copy selected files from left folder to right folder"
              >
                Copy Left <ArrowRight size={14} /> Right
              </button>
              <button
                onClick={() => handleCopy('right-to-left')}
                disabled={copying}
                style={{
                  ...btnSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  opacity: copying ? 0.5 : 1,
                }}
                title="Copy selected files from right folder to left folder"
              >
                Copy Right <ArrowLeft size={14} /> Left
              </button>
            </>
          )}
          <button onClick={onClose} style={btnSecondary} aria-label="Close folder compare dialog">
            Close
          </button>
        </div>
      </div>

      {/* Spinner keyframe (injected once) */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default React.memo(FolderCompareDialog);
