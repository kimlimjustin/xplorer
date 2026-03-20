import { useEffect, useRef } from 'react';
import { AlertTriangle, FileIcon, FolderClosed, Replace, Copy, X, ArrowRight } from 'lucide-react';
import type { ConflictFileInfo } from '@/lib/tauri-api';

export type ConflictResolution = 'replace' | 'keep-both' | 'skip';
export type ConflictApplyTo = 'single' | 'all';

interface FileConflictDialogProps {
  isOpen: boolean;
  fileName: string;
  isDir: boolean;
  destination: string;
  remaining: number;
  sourceInfo?: ConflictFileInfo | null;
  destInfo?: ConflictFileInfo | null;
  onResolve: (resolution: ConflictResolution, applyToAll: boolean) => void;
}

const formatSize = (bytes: number) : string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const formatDate = (epoch: number) : string => {
  if (!epoch) return 'Unknown';
  const d = new Date(epoch * 1000);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const MetadataRow = ({
  label,
  sourceVal,
  destVal,
  highlight,
}: {
  label: string;
  sourceVal: string;
  destVal: string;
  highlight?: 'source' | 'dest' | null;
}) => {
  return (
    <div className="grid grid-cols-[80px_1fr_20px_1fr] items-center gap-1 text-xs">
      <span className="text-xp-text-muted">{label}</span>
      <span
        className={`truncate ${highlight === 'source' ? 'text-xp-green font-medium' : 'text-xp-text'}`}
      >
        {sourceVal}
      </span>
      <ArrowRight className="w-3 h-3 text-xp-text-muted mx-auto" />
      <span
        className={`truncate ${highlight === 'dest' ? 'text-xp-green font-medium' : 'text-xp-text'}`}
      >
        {destVal}
      </span>
    </div>
  );
}

export const FileConflictDialog = ({
  isOpen,
  fileName,
  isDir,
  destination: _destination,
  remaining,
  sourceInfo,
  destInfo,
  onResolve,
}: FileConflictDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasMetadata = sourceInfo && destInfo;
  let sizeHighlight: 'source' | 'dest' | null = null;
  let dateHighlight: 'source' | 'dest' | null = null;

  if (hasMetadata) {
    if (sourceInfo.size > destInfo.size) sizeHighlight = 'source';
    else if (destInfo.size > sourceInfo.size) sizeHighlight = 'dest';

    if (sourceInfo.modified > destInfo.modified) dateHighlight = 'source';
    else if (destInfo.modified > sourceInfo.modified) dateHighlight = 'dest';
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby="conflict-title"
        aria-modal="true"
        tabIndex={-1}
        className="bg-xp-surface border border-xp-border rounded-lg p-6 w-[480px] max-w-[90vw] outline-none"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onResolve('skip', false);
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-xp-yellow flex-shrink-0 mt-0.5" />
          <div>
            <h3 id="conflict-title" className="text-base font-semibold text-xp-text">
              File Conflict
            </h3>
            <p className="text-sm text-xp-text-muted mt-1">
              The destination already has a {isDir ? 'folder' : 'file'} named:
            </p>
          </div>
        </div>

        {/* File name */}
        <div className="flex items-center gap-2 px-3 py-2.5 mb-3 rounded-md bg-xp-surface-light border border-xp-border">
          {isDir ? (
            <FolderClosed className="w-5 h-5 text-xp-blue flex-shrink-0" />
          ) : (
            <FileIcon className="w-5 h-5 text-xp-text-muted flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-xp-text truncate">{fileName}</span>
        </div>

        {/* Metadata comparison */}
        {hasMetadata && (
          <div className="mb-4 px-3 py-2.5 rounded-md bg-xp-surface-light border border-xp-border space-y-1.5">
            <div className="grid grid-cols-[80px_1fr_20px_1fr] items-center gap-1 text-xs font-medium text-xp-text-muted mb-1">
              <span></span>
              <span>Source</span>
              <span></span>
              <span>Existing</span>
            </div>
            <MetadataRow
              label="Size"
              sourceVal={formatSize(sourceInfo.size)}
              destVal={formatSize(destInfo.size)}
              highlight={sizeHighlight}
            />
            <MetadataRow
              label="Modified"
              sourceVal={formatDate(sourceInfo.modified)}
              destVal={formatDate(destInfo.modified)}
              highlight={dateHighlight}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onResolve('replace', false)}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-md text-sm text-left
              bg-xp-surface-light hover:bg-xp-red/15 border border-xp-border hover:border-xp-red/40
              transition-colors"
            aria-label="Replace existing file"
          >
            <Replace className="w-4 h-4 text-xp-red flex-shrink-0" />
            <div>
              <div className="font-medium text-xp-text">Replace</div>
              <div className="text-xs text-xp-text-muted">
                Overwrite the existing {isDir ? 'folder' : 'file'}
              </div>
            </div>
          </button>

          <button
            onClick={() => onResolve('keep-both', false)}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-md text-sm text-left
              bg-xp-surface-light hover:bg-xp-blue/15 border border-xp-border hover:border-xp-blue/40
              transition-colors"
            aria-label="Keep both files"
          >
            <Copy className="w-4 h-4 text-xp-blue flex-shrink-0" />
            <div>
              <div className="font-medium text-xp-text">Keep Both</div>
              <div className="text-xs text-xp-text-muted">
                Save with a renamed copy (e.g. &quot;{getKeepBothName(fileName)}&quot;)
              </div>
            </div>
          </button>

          <button
            onClick={() => onResolve('skip', false)}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-md text-sm text-left
              bg-xp-surface-light hover:bg-xp-surface border border-xp-border
              transition-colors"
            aria-label="Skip this file"
          >
            <X className="w-4 h-4 text-xp-text-muted flex-shrink-0" />
            <div>
              <div className="font-medium text-xp-text">Skip</div>
              <div className="text-xs text-xp-text-muted">
                Don&apos;t paste this {isDir ? 'folder' : 'file'}
              </div>
            </div>
          </button>
        </div>

        {/* Apply to all -- only show when there are more conflicts */}
        {remaining > 0 && (
          <div className="mt-4 pt-3 border-t border-xp-border">
            <p className="text-xs text-xp-text-muted mb-2">
              {remaining} more conflict{remaining > 1 ? 's' : ''} remaining
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onResolve('replace', true)}
                className="flex-1 px-3 py-1.5 text-xs rounded border border-xp-border
                  hover:bg-xp-red/15 hover:border-xp-red/40 text-xp-text transition-colors"
              >
                Replace All
              </button>
              <button
                onClick={() => onResolve('keep-both', true)}
                className="flex-1 px-3 py-1.5 text-xs rounded border border-xp-border
                  hover:bg-xp-blue/15 hover:border-xp-blue/40 text-xp-text transition-colors"
              >
                Rename All
              </button>
              <button
                onClick={() => onResolve('skip', true)}
                className="flex-1 px-3 py-1.5 text-xs rounded border border-xp-border
                  hover:bg-xp-surface text-xp-text transition-colors"
              >
                Skip All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const getKeepBothName = (name: string) : string => {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  return `${base} (1)${ext}`;
}
