import { useState, useEffect, useCallback, useRef } from 'react';
import { TauriAPI, type FileOperationProgress } from '@/lib/tauri-api';
import { formatFileSize } from '@/lib/utils';
import { X } from 'lucide-react';

const formatSpeed = (bytesPerSecond: number) : string => {
  if (bytesPerSecond <= 0) return '—';
  return formatFileSize(bytesPerSecond) + '/s';
}

const formatETA = (seconds?: number) : string => {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

const getStatusColor = (status: string) : string => {
  switch (status) {
    case 'Completed':
      return 'bg-green-500';
    case 'Failed':
      return 'bg-red-500';
    case 'Cancelled':
      return 'bg-yellow-500';
    default:
      return 'bg-xp-blue';
  }
}

const FileOperationProgressDialog = () => {
  const [operations, setOperations] = useState<Map<string, FileOperationProgress>>(new Map());
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Clean up all pending dismiss timers on unmount
  useEffect(() => {
    const timers = dismissTimers.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const handleProgress = useCallback((progress: FileOperationProgress) => {
    setOperations((prev) => {
      const next = new Map(prev);
      next.set(progress.operation_id, progress);
      return next;
    });

    // Auto-dismiss completed/failed after 4s
    if (progress.status === 'Completed' || progress.status === 'Failed') {
      // Clear any existing timer for this operation
      const existingTimer = dismissTimers.current.get(progress.operation_id);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        dismissTimers.current.delete(progress.operation_id);
        setOperations((prev) => {
          const next = new Map(prev);
          next.delete(progress.operation_id);
          return next;
        });
      }, 4000);
      dismissTimers.current.set(progress.operation_id, timer);
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    TauriAPI.listenToFileOperationProgress(handleProgress).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [handleProgress]);

  const dismiss = (id: string) => {
    setOperations((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  if (operations.size === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {Array.from(operations.values()).map((op) => {
        const fileName =
          op.current_file?.split(/[/\\]/).pop() ||
          op.source_path?.split(/[/\\]/).pop() ||
          'Unknown';
        const isActive = op.status === 'Starting' || op.status === 'InProgress';
        const isDone = op.status === 'Completed';
        const isFailed = op.status === 'Failed';

        return (
          <div
            key={op.operation_id}
            className="bg-xp-surface border border-xp-border rounded-lg shadow-xl p-3 backdrop-blur-sm"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(op.status)} ${isActive ? 'animate-pulse' : ''}`}
                />
                <span className="text-xs font-medium text-xp-text capitalize truncate">
                  {op.operation_type || 'File Operation'}
                </span>
              </div>
              <button
                onClick={() => dismiss(op.operation_id)}
                className="text-xp-text-muted hover:text-xp-text p-0.5 transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            {/* Current file */}
            <div className="text-[11px] text-xp-text-muted truncate mb-1.5" title={op.current_file}>
              {fileName}
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-xp-bg rounded-full overflow-hidden mb-1.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isDone ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-xp-blue'
                }`}
                style={{ width: `${Math.min(100, op.progress_percentage || 0)}%` }}
              />
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-[10px] text-xp-text-muted">
              <span>
                {isDone
                  ? 'Done'
                  : isFailed
                    ? op.error_message || 'Failed'
                    : `${Math.round(op.progress_percentage || 0)}%`}
                {isActive &&
                  op.total_files > 1 &&
                  ` (${op.files_processed}/${op.total_files} files)`}
              </span>
              {isActive && (
                <span>
                  {formatSpeed(op.speed_bytes_per_second)}
                  {op.estimated_remaining_seconds
                    ? ` \u00B7 ${formatETA(op.estimated_remaining_seconds)}`
                    : ''}
                </span>
              )}
              {isDone && op.total_bytes > 0 && <span>{formatFileSize(op.total_bytes)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FileOperationProgressDialog;
