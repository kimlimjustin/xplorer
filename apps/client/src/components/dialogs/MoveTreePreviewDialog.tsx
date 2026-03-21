/**
 * MoveTreePreviewDialog — shows a split-panel preview of the resulting
 * directory structure before executing a move or copy operation.
 *
 * Left panel:  source tree (files being moved/copied, with current locations)
 * Right panel: destination tree (result after merge, with conflict markers)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FolderInput,
  Copy,
  AlertTriangle,
  FolderClosed,
  FolderOpen,
  FileIcon,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';
import { formatFileSize } from '@/lib/utils';
import { detectSep } from '@/lib/constants';
import {
  computeMoveTree,
  unresolvedConflictCount,
  type TreeNode,
  type ConflictResolutionType,
  type MoveTreeResult,
} from '@/lib/move-tree-preview';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MoveTreePreviewData {
  sourceFiles: FileEntry[];
  destPath: string;
  operation: 'move' | 'copy';
}

export interface MoveTreePreviewDialogProps {
  isOpen: boolean;
  data: MoveTreePreviewData | null;
  onConfirm: (resolutions: Map<string, ConflictResolutionType>) => void;
  onCancel: () => void;
}

// ── Inline styles ────────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  dialog: {
    backgroundColor: 'var(--xp-surface)',
    border: '1px solid var(--xp-border)',
    borderRadius: '10px',
    width: '820px',
    maxWidth: '92vw',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column' as const,
    outline: 'none',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--xp-border)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--xp-text)',
    margin: 0,
  },
  subtitle: {
    fontSize: '12px',
    color: 'var(--xp-text-secondary)',
    marginTop: '2px',
  },
  closeBtn: {
    padding: '6px',
    background: 'none',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: 'var(--xp-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.15s',
  },
  body: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  panel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    minWidth: 0,
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '8px 16px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'var(--xp-text-secondary)',
    borderBottom: '1px solid var(--xp-border)',
    flexShrink: 0,
  },
  panelContent: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '8px 4px',
  },
  divider: {
    width: '1px',
    backgroundColor: 'var(--xp-border)',
    flexShrink: 0,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderTop: '1px solid var(--xp-border)',
    flexShrink: 0,
  },
  footerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontSize: '12px',
    color: 'var(--xp-text-secondary)',
  },
  footerActions: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  cancelBtn: {
    padding: '7px 16px',
    fontSize: '13px',
    background: 'none',
    border: '1px solid var(--xp-border)',
    borderRadius: '6px',
    color: 'var(--xp-text)',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  confirmBtn: {
    padding: '7px 20px',
    fontSize: '13px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'opacity 0.15s',
  },
  confirmBtnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 0',
    color: 'var(--xp-text-secondary)',
    fontSize: '13px',
    gap: '8px',
  },
  conflictBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '1px 6px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
  },
  // Tree row styles
  treeRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: '4px',
    gap: '4px',
    minHeight: '28px',
    cursor: 'default',
    fontSize: '13px',
  },
  indentGuide: {
    display: 'inline-block',
    width: '1px',
    height: '28px',
    backgroundColor: 'var(--xp-border)',
    marginLeft: '9px',
    marginRight: '9px',
    flexShrink: 0,
  },
  chevron: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    flexShrink: 0,
    color: 'var(--xp-text-secondary)',
    cursor: 'pointer',
  },
  chevronPlaceholder: {
    width: '16px',
    height: '16px',
    flexShrink: 0,
  },
  iconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    flexShrink: 0,
  },
  nodeName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  rightSlot: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
    marginLeft: 'auto',
  },
  sizeLabel: {
    fontSize: '11px',
    color: 'var(--xp-text-secondary)',
    whiteSpace: 'nowrap' as const,
  },
  resolutionSelect: {
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid var(--xp-border)',
    backgroundColor: 'var(--xp-bg)',
    color: 'var(--xp-text)',
    cursor: 'pointer',
    outline: 'none',
  },
};

// ── Status colors ────────────────────────────────────────────────────────────

const getStatusColor = (status: TreeNode['status']): string => {
  switch (status) {
    case 'incoming':
      return 'var(--xp-green)';
    case 'conflict':
      return 'var(--xp-red)';
    case 'existing':
    default:
      return 'var(--xp-text)';
  }
};

const getStatusBg = (status: TreeNode['status']): string => {
  switch (status) {
    case 'incoming':
      return 'rgba(34, 197, 94, 0.08)';
    case 'conflict':
      return 'rgba(239, 68, 68, 0.08)';
    default:
      return 'transparent';
  }
};

// ── SourceTreeNode (memoized) ────────────────────────────────────────────────

interface SourceNodeProps {
  file: FileEntry;
}

const SourceTreeNode = React.memo(function SourceTreeNode({ file }: SourceNodeProps) {
  const parentPath = useMemo(() => {
    const sep = detectSep(file.path);
    const parts = file.path.split(sep);
    parts.pop();
    return parts.join(sep);
  }, [file.path]);

  return (
    <div style={{ ...S.treeRow }}>
      <div style={S.iconWrap}>
        {file.is_dir ? (
          <FolderClosed size={15} style={{ color: 'var(--xp-blue)' }} />
        ) : (
          <FileIcon size={15} style={{ color: 'var(--xp-text-secondary)' }} />
        )}
      </div>
      <div style={{ ...S.nodeName, color: 'var(--xp-text)' }} title={file.name}>
        {file.name}
      </div>
      <div style={S.rightSlot}>
        <span style={S.sizeLabel}>{file.is_dir ? '--' : formatFileSize(file.size)}</span>
      </div>
      <div
        style={{
          fontSize: '10px',
          color: 'var(--xp-text-secondary)',
          marginLeft: '4px',
          maxWidth: '140px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
        }}
        title={parentPath}
      >
        {parentPath}
      </div>
    </div>
  );
});

// ── DestTreeNode (memoized) ──────────────────────────────────────────────────

interface DestNodeProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onResolutionChange: (path: string, resolution: ConflictResolutionType) => void;
}

const DestTreeNode = React.memo(function DestTreeNode({
  node,
  depth,
  expanded,
  onToggle,
  onResolutionChange,
}: DestNodeProps) {
  const [hovered, setHovered] = useState(false);
  const isExpanded = expanded.has(node.path);
  const statusColor = getStatusColor(node.status);
  const statusBg = getStatusBg(node.status);

  const rowStyle: React.CSSProperties = {
    ...S.treeRow,
    backgroundColor: hovered ? 'var(--xp-surface-light)' : statusBg,
  };

  return (
    <>
      <div
        style={rowStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Indent guides */}
        {Array.from({ length: depth }, (_, i) => (
          <div key={i} style={S.indentGuide} />
        ))}

        {/* Chevron */}
        {node.isDir && node.children.length > 0 ? (
          <div style={S.chevron} onClick={() => onToggle(node.path)}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        ) : (
          <div style={S.chevronPlaceholder} />
        )}

        {/* Icon */}
        <div style={S.iconWrap}>
          {/* eslint-disable-next-line no-nested-ternary */}
          {node.isDir ? (
            isExpanded ? (
              <FolderOpen size={15} style={{ color: 'var(--xp-blue)' }} />
            ) : (
              <FolderClosed size={15} style={{ color: 'var(--xp-blue)' }} />
            )
          ) : (
            <FileIcon size={15} style={{ color: statusColor }} />
          )}
        </div>

        {/* Name */}
        <div style={{ ...S.nodeName, color: statusColor }} title={node.name}>
          {node.name}
        </div>

        {/* Right slot */}
        <div style={S.rightSlot}>
          {/* Status badge */}
          {node.status === 'incoming' && (
            <span
              style={{
                ...S.conflictBadge,
                color: 'var(--xp-green)',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
              }}
            >
              NEW
            </span>
          )}
          {node.status === 'conflict' && (
            <>
              <span
                style={{
                  ...S.conflictBadge,
                  color: 'var(--xp-red)',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                }}
              >
                <AlertTriangle size={10} />
                CONFLICT
              </span>
              {/* Resolution dropdown */}
              <select
                style={S.resolutionSelect}
                value={node.conflictResolution ?? ''}
                onChange={(e) => {
                  e.stopPropagation();
                  onResolutionChange(node.path, e.target.value as ConflictResolutionType);
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">Resolve...</option>
                <option value="skip">Skip</option>
                <option value="overwrite">Overwrite</option>
                <option value="rename">Rename</option>
              </select>
            </>
          )}

          {/* Size */}
          <span style={S.sizeLabel}>{node.isDir ? '' : formatFileSize(node.size)}</span>
        </div>
      </div>

      {/* Children */}
      {node.isDir &&
        isExpanded &&
        node.children.map((child) => (
          <DestTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onResolutionChange={onResolutionChange}
          />
        ))}
    </>
  );
});

// ── Main Dialog Component ────────────────────────────────────────────────────

const MoveTreePreviewDialog = ({
  isOpen,
  data,
  onConfirm,
  onCancel,
}: MoveTreePreviewDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [treeResult, setTreeResult] = useState<MoveTreeResult | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Focus dialog when opened
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  // Compute the tree when data changes
  useEffect(() => {
    if (!isOpen || !data) {
      setTreeResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Read existing destination directory contents
        const destFiles = await TauriAPI.readDirectory(data.destPath);
        if (cancelled) return;

        const result = computeMoveTree(data.sourceFiles, data.destPath, destFiles);
        setTreeResult(result);

        // Auto-expand all directories in the destination tree
        const allDirs = new Set<string>();
        for (const node of result.tree) {
          if (node.isDir) allDirs.add(node.path);
        }
        setExpanded(allDirs);
      } catch (err) {
        console.error('Failed to compute move tree preview:', err);
        // Still show dialog even if dest read fails (empty dest)
        if (!cancelled) {
          const result = computeMoveTree(data.sourceFiles, data.destPath, []);
          setTreeResult(result);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, data]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleResolutionChange = useCallback((path: string, resolution: ConflictResolutionType) => {
    setTreeResult((prev) => {
      if (!prev) return prev;
      // Mutate the conflict node in place and return a shallow copy to trigger re-render
      for (const node of prev.tree) {
        if (node.path === path && node.status === 'conflict') {
          node.conflictResolution = resolution;
        }
      }
      for (const node of prev.conflicts) {
        if (node.path === path) {
          node.conflictResolution = resolution;
        }
      }
      return { ...prev };
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!treeResult) return;
    const resolutions = new Map<string, ConflictResolutionType>();
    for (const conflict of treeResult.conflicts) {
      if (conflict.conflictResolution) {
        resolutions.set(conflict.sourcePath ?? conflict.path, conflict.conflictResolution);
      }
    }
    onConfirm(resolutions);
  }, [treeResult, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel],
  );

  // Derived values
  const conflictsCount = treeResult ? treeResult.conflicts.length : 0;
  const unresolvedCount = treeResult ? unresolvedConflictCount(treeResult.conflicts) : 0;
  const canConfirm = treeResult && unresolvedCount === 0 && !loading;

  if (!isOpen || !data) return null;

  const isCopy = data.operation === 'copy';
  const verb = isCopy ? 'Copy' : 'Move';
  const Icon = isCopy ? Copy : FolderInput;
  const destName = data.destPath.split(/[/\\]/).filter(Boolean).pop() || data.destPath;

  return (
    <div style={S.overlay} role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby="move-tree-preview-title"
        aria-modal="true"
        tabIndex={-1}
        style={S.dialog}
        onKeyDown={handleKeyDown}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={S.header}>
          <div style={S.headerLeft}>
            <Icon size={20} style={{ color: isCopy ? 'var(--xp-blue)' : 'var(--xp-yellow)' }} />
            <div>
              <h2 id="move-tree-preview-title" style={S.title}>
                {verb} {data.sourceFiles.length} file{data.sourceFiles.length > 1 ? 's' : ''} to{' '}
                {destName}
              </h2>
              <div style={S.subtitle}>
                Preview the resulting directory structure before {verb.toLowerCase()}ing
              </div>
            </div>
          </div>
          <button
            style={S.closeBtn}
            onClick={onCancel}
            aria-label="Close"
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--xp-surface-light)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div style={S.body}>
          {/* Left panel: Source tree */}
          <div style={S.panel}>
            <div style={S.panelHeader}>Source ({data.sourceFiles.length} items)</div>
            <div style={S.panelContent}>
              {data.sourceFiles.map((file) => (
                <SourceTreeNode key={file.path} file={file} />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={S.divider} />

          {/* Right panel: Destination tree */}
          <div style={S.panel}>
            <div style={S.panelHeader}>Destination: {destName}</div>
            <div style={S.panelContent}>
              {/* eslint-disable-next-line no-nested-ternary */}
              {loading ? (
                <div style={S.loading}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ animation: 'spin 1s linear infinite' }}
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Loading destination contents...
                </div>
              ) : treeResult ? (
                treeResult.tree.map((node) => (
                  <DestTreeNode
                    key={node.path}
                    node={node}
                    depth={0}
                    expanded={expanded}
                    onToggle={toggleExpand}
                    onResolutionChange={handleResolutionChange}
                  />
                ))
              ) : (
                <div style={S.loading}>No data available</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={S.footer}>
          <div style={S.footerInfo}>
            {treeResult && (
              <>
                <span>
                  {verb}ing {formatFileSize(treeResult.totalIncomingSize)} into{' '}
                  {formatFileSize(treeResult.totalExistingSize)} folder
                </span>
                {conflictsCount > 0 && (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: unresolvedCount > 0 ? 'var(--xp-red)' : 'var(--xp-green)',
                    }}
                  >
                    <AlertTriangle size={12} />
                    {unresolvedCount > 0
                      ? `${unresolvedCount} unresolved conflict${unresolvedCount > 1 ? 's' : ''}`
                      : `${conflictsCount} conflict${conflictsCount > 1 ? 's' : ''} resolved`}
                  </span>
                )}
              </>
            )}
          </div>
          <div style={S.footerActions}>
            <button
              style={S.cancelBtn}
              onClick={onCancel}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = 'var(--xp-surface-light)')
              }
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Cancel
            </button>
            <button
              style={{
                ...S.confirmBtn,
                backgroundColor: isCopy ? 'var(--xp-blue)' : 'var(--xp-yellow)',
                ...(canConfirm ? {} : S.confirmBtnDisabled),
              }}
              onClick={canConfirm ? handleConfirm : undefined}
              disabled={!canConfirm}
              onMouseEnter={(e) => {
                if (canConfirm) e.currentTarget.style.opacity = '0.85';
              }}
              onMouseLeave={(e) => {
                if (canConfirm) e.currentTarget.style.opacity = '1';
              }}
            >
              <Icon size={14} />
              {verb}
            </button>
          </div>
        </div>
      </div>

      {/* Keyframe for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default MoveTreePreviewDialog;
