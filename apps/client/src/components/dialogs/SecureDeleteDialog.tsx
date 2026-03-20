import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';
import { ShieldAlert, AlertTriangle, Trash2 } from 'lucide-react';

interface SecureDeleteProgress {
  file: string;
  pass: number;
  total_passes: number;
  pass_label: string;
  bytes_written: number;
  file_size: number;
}

interface SecureDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  files: FileEntry[];
}

const SecureDeleteDialog = ({
  isOpen,
  onClose,
  onComplete,
  files,
}: SecureDeleteDialogProps) => {
  const { toast } = useToast();
  const [passes, setPasses] = useState(3);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SecureDeleteProgress | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const unlistenRef = useRef<(() => void) | null>(null);

  const fileCount = files.length;
  const fileNames = files.map((f) => f.name);
  const displayNames =
    fileNames.length <= 3
      ? fileNames.join(', ')
      : `${fileNames.slice(0, 3).join(', ')} and ${fileNames.length - 3} more`;

  useEffect(() => {
    if (isOpen) {
      setPasses(3);
      setProcessing(false);
      setError(null);
      setProgress(null);
      setConfirmed(false);
    }
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!confirmed) return;

    setProcessing(true);
    setError(null);
    setProgress(null);

    try {
      const { listenToEvent } = await import('@/lib/transport');
      const unlisten = await listenToEvent<SecureDeleteProgress>(
        'secure-delete-progress',
        (event) => {
          setProgress(event);
        },
      );
      unlistenRef.current = unlisten;

      const paths = files.map((f) => f.path);
      const result = await TauriAPI.secureDelete(paths, passes);

      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }

      if (result.errors.length > 0 && result.files_deleted === 0) {
        setError(result.errors.join('\n'));
        toast({
          title: 'Secure Delete Failed',
          description: result.errors[0],
          variant: 'destructive',
        });
      } else {
        const errSuffix =
          result.errors.length > 0
            ? ` (${result.errors.length} error${result.errors.length > 1 ? 's' : ''})`
            : '';
        toast({
          title: 'Securely Deleted',
          description: `${result.files_deleted} file${result.files_deleted > 1 ? 's' : ''} securely wiped with ${result.passes} passes${errSuffix}`,
        });
        onComplete?.();
        onClose();
      }
    } catch (err) {
      const message = (err as Error).message || String(err);
      setError(message);
      toast({
        title: 'Secure Delete Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    }
  };

  const handleClose = () => {
    if (processing) return;
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !processing && confirmed) {
      handleSubmit();
    }
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!isOpen || files.length === 0) return null;

  const progressPercentage = progress
    ? Math.round((progress.pass / progress.total_passes) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-xp-surface rounded-lg shadow-2xl w-[520px] max-w-[90vw] overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-xp-border">
          <div className="flex items-center space-x-3">
            <ShieldAlert size={20} className="text-red-400" />
            <h2 className="text-xl font-semibold text-xp-text">Secure Delete</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={processing}
            className="p-2 hover:bg-xp-surface-light rounded-md transition-colors disabled:opacity-50"
            aria-label="Close secure delete dialog"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Warning banner */}
          <div className="flex items-start space-x-3 p-4 rounded-lg bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30">
            <AlertTriangle size={20} className="text-red-400 mt-0.5 shrink-0" />
            <div className="text-sm text-red-300">
              <p className="font-semibold mb-1">This action is irreversible.</p>
              <p>
                Secure delete overwrites file data multiple times before deletion using the DoD
                5220.22-M standard. The data cannot be recovered by any means after this operation
                completes.
              </p>
            </div>
          </div>

          {/* File info */}
          <div className="bg-xp-bg rounded-lg p-4">
            <div className="text-sm text-xp-text-muted mb-1">
              {fileCount === 1 ? 'File' : `Files (${fileCount})`}
            </div>
            <div
              className="text-sm text-xp-text font-medium truncate"
              title={files.map((f) => f.path).join('\n')}
            >
              {displayNames}
            </div>
          </div>

          {/* Passes selector */}
          <div>
            <label className="block text-sm font-medium text-xp-text mb-2">Overwrite Passes</label>
            <div className="flex items-center space-x-4">
              <select
                value={passes}
                onChange={(e) => setPasses(Number(e.target.value))}
                disabled={processing}
                className="px-3 py-2 border border-xp-border rounded-md bg-xp-bg text-xp-text focus:ring-2 focus:ring-xp-blue focus:border-xp-blue"
              >
                <option value={1}>1 pass (quick)</option>
                <option value={3}>3 passes (DoD 5220.22-M)</option>
                <option value={7}>7 passes (maximum)</option>
              </select>
              <span className="text-xs text-xp-text-muted">
                {passes === 1 && 'Single random overwrite'}
                {passes === 3 && 'Zeros, ones, then random data'}
                {passes === 7 && 'Extended multi-pass overwrite'}
              </span>
            </div>
          </div>

          {/* Overwrite method description */}
          <div className="text-xs text-xp-text-muted bg-xp-bg rounded-lg p-3 space-y-1">
            <div className="font-medium text-xp-text mb-1">Overwrite pattern per cycle:</div>
            <div>Pass 1: Fill with zeros (0x00)</div>
            <div>Pass 2: Fill with ones (0xFF)</div>
            <div>Pass 3: Fill with random data</div>
            {passes > 3 && <div>Passes 4-{passes}: Pattern repeats</div>}
            <div className="mt-1">Each pass flushes and syncs to disk before proceeding.</div>
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start space-x-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={processing}
              className="mt-1 rounded border-xp-border text-red-500 focus:ring-red-500"
            />
            <span className="text-sm text-xp-text">
              I understand that this will permanently destroy the selected{' '}
              {fileCount === 1 ? 'file' : `${fileCount} files`} and the data cannot be recovered.
            </span>
          </label>

          {/* Error message */}
          {error && (
            <div className="flex items-start space-x-2 p-3 rounded-md bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30">
              <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <span className="text-sm text-red-400 whitespace-pre-wrap">{error}</span>
            </div>
          )}

          {/* Progress indicator */}
          {processing && progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-xp-text-muted">
                <span className="truncate max-w-[260px]" title={progress.file}>
                  {progress.file}
                </span>
                <span>
                  Pass {progress.pass}/{progress.total_passes} ({progress.pass_label})
                </span>
              </div>
              <div className="w-full h-2 bg-xp-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}

          {processing && !progress && (
            <div className="flex items-center justify-center py-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-400"></div>
              <span className="ml-3 text-sm text-xp-text-muted">Preparing secure deletion...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-xp-border bg-xp-bg">
          <button
            onClick={handleClose}
            disabled={processing}
            className="px-4 py-2 text-xp-text hover:bg-xp-surface-light rounded transition-colors disabled:opacity-50"
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={processing || !confirmed}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            aria-label="Securely delete files"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Wiping...</span>
              </>
            ) : (
              <>
                <Trash2 size={14} />
                <span>Secure Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecureDeleteDialog;
