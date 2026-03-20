import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Trash2,
  FolderInput,
  FileEdit,
  ShieldAlert,
  FolderClosed,
  FileIcon,
  ArrowRight,
} from 'lucide-react';
import type { FileEntry } from '@/lib/tauri-api';
import { formatFileSize } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

export type BatchOperationType = 'delete' | 'move' | 'rename' | 'secure-delete' | string;

export interface BatchConfirmDialogProps {
  isOpen: boolean;
  operation: BatchOperationType;
  files: FileEntry[];
  /** Optional destination path for move operations */
  destination?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const OPERATION_META: Record<
  string,
  {
    label: string;
    icon: React.ReactNode;
    destructive: boolean;
    warning?: string;
    confirmLabel: string;
    confirmClass: string;
  }
> = {
  delete: {
    label: 'Delete',
    icon: <Trash2 size={20} className="text-red-400" />,
    destructive: true,
    warning: 'These items will be moved to the Recycle Bin. You can restore them later.',
    confirmLabel: 'Delete All',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
  move: {
    label: 'Move',
    icon: <FolderInput size={20} className="text-xp-blue" />,
    destructive: false,
    confirmLabel: 'Move All',
    confirmClass: 'bg-xp-blue hover:opacity-90 text-white',
  },
  rename: {
    label: 'Rename',
    icon: <FileEdit size={20} className="text-xp-yellow" />,
    destructive: false,
    confirmLabel: 'Rename All',
    confirmClass: 'bg-xp-blue hover:opacity-90 text-white',
  },
  'secure-delete': {
    label: 'Secure Delete',
    icon: <ShieldAlert size={20} className="text-red-400" />,
    destructive: true,
    warning: 'These items will be permanently and irreversibly destroyed. This cannot be undone.',
    confirmLabel: 'Secure Delete All',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
};

const getOperationMeta = (operation: BatchOperationType) => {
  return (
    OPERATION_META[operation] ?? {
      label: operation.charAt(0).toUpperCase() + operation.slice(1),
      icon: <AlertTriangle size={20} className="text-xp-yellow" />,
      destructive: false,
      confirmLabel: `Confirm ${operation}`,
      confirmClass: 'bg-xp-blue hover:opacity-90 text-white',
    }
  );
}

const getExtension = (name: string) : string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : '';
}

// ── Component ────────────────────────────────────────────────────────────────

const BatchConfirmDialog = ({
  isOpen,
  operation,
  files,
  destination,
  onConfirm,
  onCancel,
}: BatchConfirmDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen || files.length === 0) return null;

  const meta = getOperationMeta(operation);
  const totalSize = files.reduce((sum, f) => sum + (f.is_dir ? 0 : f.size), 0);
  const dirCount = files.filter((f) => f.is_dir).length;
  const fileCount = files.length - dirCount;

  // Build summary text
  const parts: string[] = [];
  if (fileCount > 0) parts.push(`${fileCount} file${fileCount > 1 ? 's' : ''}`);
  if (dirCount > 0) parts.push(`${dirCount} folder${dirCount > 1 ? 's' : ''}`);
  const summaryText = parts.join(', ');
  const sizeText = totalSize > 0 ? formatFileSize(totalSize) : null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
    if (e.key === 'Enter') {
      onConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby="batch-confirm-title"
        aria-modal="true"
        tabIndex={-1}
        className="bg-xp-surface border border-xp-border rounded-lg w-[540px] max-w-[90vw] max-h-[80vh] flex flex-col outline-none shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-xp-border shrink-0">
          <div className="flex items-center gap-3">
            {meta.icon}
            <h2 id="batch-confirm-title" className="text-lg font-semibold text-xp-text">
              {meta.label} {files.length} Items
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-xp-surface-light rounded-md transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4 text-xp-text-muted" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Warning Banner (destructive ops only) */}
        {meta.destructive && meta.warning && (
          <div className="mx-5 mt-4 flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 shrink-0">
            <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-300">{meta.warning}</p>
          </div>
        )}

        {/* Destination (move operations) */}
        {operation === 'move' && destination && (
          <div className="mx-5 mt-4 flex items-center gap-2 p-3 rounded-lg bg-xp-surface-light border border-xp-border shrink-0">
            <ArrowRight size={16} className="text-xp-blue shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-xp-text-muted">Destination</div>
              <div className="text-sm text-xp-text truncate" title={destination}>
                {destination}
              </div>
            </div>
          </div>
        )}

        {/* File list */}
        <div className="mx-5 mt-4 flex-1 min-h-0 overflow-hidden">
          <div className="text-xs font-medium text-xp-text-muted mb-2 uppercase tracking-wide">
            Affected Items
          </div>
          <div className="max-h-[280px] overflow-y-auto rounded-lg border border-xp-border bg-xp-bg">
            {files.map((file, index) => (
              <div
                key={file.path}
                className={`flex items-center gap-3 px-3 py-2 text-sm ${
                  index < files.length - 1 ? 'border-b border-xp-border/50' : ''
                }`}
              >
                {/* Icon */}
                {file.is_dir ? (
                  <FolderClosed size={16} className="text-xp-blue shrink-0" />
                ) : (
                  <FileIcon size={16} className="text-xp-text-muted shrink-0" />
                )}

                {/* Name + path */}
                <div className="min-w-0 flex-1">
                  <div className="text-xp-text truncate" title={file.name}>
                    {file.name}
                  </div>
                  <div className="text-xs text-xp-text-muted truncate" title={file.path}>
                    {file.path}
                  </div>
                </div>

                {/* Type */}
                <div className="text-xs text-xp-text-muted shrink-0 w-12 text-right">
                  {file.is_dir ? 'Folder' : getExtension(file.name) || 'File'}
                </div>

                {/* Size */}
                <div className="text-xs text-xp-text-muted shrink-0 w-16 text-right">
                  {file.is_dir ? '--' : formatFileSize(file.size)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary line */}
        <div className="mx-5 mt-3 text-xs text-xp-text-muted shrink-0">
          {summaryText}
          {sizeText ? `, ${sizeText} total` : ''}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-xp-border mt-4 shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-xp-text hover:bg-xp-surface-light rounded-md transition-colors border border-xp-border"
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${meta.confirmClass}`}
            aria-label={meta.confirmLabel}
          >
            {meta.icon}
            <span>{meta.confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default BatchConfirmDialog;
