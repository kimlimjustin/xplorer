import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TauriAPI, type FileVersion } from '@/lib/tauri-api';
import {
  History,
  RotateCcw,
  Trash2,
  Eye,
  X,
  Clock,
  HardDrive,
  AlertTriangle,
  Plus,
  Trash,
} from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

interface VersionHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  onRefetch?: () => void;
}

const formatTimestamp = (ts: string) : string => {
  if (!ts || ts.length < 15) return ts;
  const year = ts.slice(0, 4);
  const month = ts.slice(4, 6);
  const day = ts.slice(6, 8);
  const hour = ts.slice(9, 11);
  const min = ts.slice(11, 13);
  const sec = ts.slice(13, 15);
  return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
}

const VersionHistoryDialog = ({
  isOpen,
  onClose,
  filePath,
  onRefetch,
}: VersionHistoryDialogProps) => {
  const { toast } = useToast();
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  const loadVersions = useCallback(async () => {
    if (!filePath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await TauriAPI.listVersions(filePath);
      setVersions(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    if (isOpen && filePath) {
      loadVersions();
      setPreviewContent(null);
      setPreviewVersion(null);
    }
  }, [isOpen, filePath, loadVersions]);

  const handleCreateVersion = async () => {
    setActionInProgress('creating');
    try {
      await TauriAPI.createVersion(filePath);
      toast({ title: 'Version created', description: `Snapshot of "${fileName}" saved` });
      await loadVersions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Failed to create version', description: msg, variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRestore = async (versionNumber: number) => {
    setActionInProgress(`restore-${versionNumber}`);
    try {
      await TauriAPI.restoreVersion(filePath, versionNumber);
      toast({
        title: 'Version restored',
        description: `Restored version ${versionNumber} of "${fileName}"`,
      });
      await loadVersions();
      onRefetch?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Failed to restore version', description: msg, variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (versionNumber: number) => {
    setActionInProgress(`delete-${versionNumber}`);
    try {
      await TauriAPI.deleteVersion(filePath, versionNumber);
      toast({ title: 'Version deleted', description: `Deleted version ${versionNumber}` });
      await loadVersions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Failed to delete version', description: msg, variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteAll = async () => {
    setActionInProgress('delete-all');
    try {
      const count = await TauriAPI.deleteAllVersions(filePath);
      toast({
        title: 'All versions deleted',
        description: `Removed ${count} version${count !== 1 ? 's' : ''}`,
      });
      await loadVersions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Failed to delete versions', description: msg, variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePreview = async (versionNumber: number) => {
    if (previewVersion === versionNumber) {
      setPreviewContent(null);
      setPreviewVersion(null);
      return;
    }
    setActionInProgress(`preview-${versionNumber}`);
    try {
      const content = await TauriAPI.readVersionContent(filePath, versionNumber);
      setPreviewContent(content);
      setPreviewVersion(versionNumber);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Failed to read version', description: msg, variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-xp-bg border border-xp-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-xp-border/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-xp-accent/10">
              <History size={18} className="text-xp-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-xp-text">Version History</h2>
              <p
                className="text-xs text-xp-text-secondary mt-0.5 truncate max-w-[360px]"
                title={filePath}
              >
                {fileName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-md text-xp-text-secondary hover:bg-xp-surface hover:text-xp-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Actions bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-xp-border/30">
          <button
            onClick={handleCreateVersion}
            disabled={!!actionInProgress}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-xp-accent/10 text-xp-accent hover:bg-xp-accent/20 transition-colors disabled:opacity-50"
          >
            <Plus size={14} />
            Create Snapshot
          </button>
          {versions.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={!!actionInProgress}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Trash size={14} />
              Delete All
            </button>
          )}
          <div className="ml-auto text-xs text-xp-text-secondary">
            {versions.length} version{versions.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-xp-accent border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-xp-text-secondary">Loading versions...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <AlertTriangle size={24} className="text-red-400 mb-2" />
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={loadVersions}
                className="mt-3 text-xs text-xp-accent hover:underline"
              >
                Try again
              </button>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <History size={32} className="text-xp-text-secondary/40 mb-3" />
              <p className="text-sm text-xp-text-secondary">No versions saved yet</p>
              <p className="text-xs text-xp-text-secondary/60 mt-1">
                Click "Create Snapshot" to save the current state of this file
              </p>
            </div>
          ) : (
            <div className="divide-y divide-xp-border/30">
              {versions.map((version) => (
                <div
                  key={version.version_number}
                  className="group px-5 py-3 hover:bg-xp-surface-light/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-xp-surface shrink-0">
                        <span className="text-xs font-bold text-xp-text-secondary">
                          v{version.version_number}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-xp-text">
                            Version {version.version_number}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-xp-text-secondary">
                            <Clock size={11} />
                            {formatTimestamp(version.timestamp)}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-xp-text-secondary">
                            <HardDrive size={11} />
                            {formatFileSize(version.size)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handlePreview(version.version_number)}
                        disabled={!!actionInProgress}
                        title="Preview"
                        className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors disabled:opacity-50 ${
                          previewVersion === version.version_number
                            ? 'bg-xp-accent/20 text-xp-accent'
                            : 'text-xp-text-secondary hover:bg-xp-surface hover:text-xp-text'
                        }`}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => handleRestore(version.version_number)}
                        disabled={!!actionInProgress}
                        title="Restore this version"
                        className="flex items-center justify-center w-7 h-7 rounded-md text-xp-text-secondary hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(version.version_number)}
                        disabled={!!actionInProgress}
                        title="Delete this version"
                        className="flex items-center justify-center w-7 h-7 rounded-md text-xp-text-secondary hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Inline preview */}
                  {previewVersion === version.version_number && previewContent !== null && (
                    <div className="mt-3 rounded-md border border-xp-border/50 bg-xp-bg overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-1.5 border-b border-xp-border/30 bg-xp-surface/50">
                        <span className="text-[10px] font-medium text-xp-text-secondary uppercase tracking-wider">
                          Preview - v{version.version_number}
                        </span>
                        <button
                          onClick={() => {
                            setPreviewContent(null);
                            setPreviewVersion(null);
                          }}
                          className="text-xp-text-secondary hover:text-xp-text"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <pre className="px-3 py-2 text-xs text-xp-text font-mono overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words">
                        {previewContent.length > 10000
                          ? previewContent.slice(0, 10000) + '\n\n... (truncated)'
                          : previewContent}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-xp-border/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs font-medium text-xp-text-secondary hover:bg-xp-surface transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryDialog;
