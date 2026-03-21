import React, { useState, useEffect, useRef } from 'react';
import { gdriveManager } from '@/lib/gdrive-plugin';
import { save } from '@tauri-apps/plugin-dialog';
import { Download, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GDriveDownloadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  fileId: string;
  fileName: string;
}

type DownloadState = 'idle' | 'picking' | 'downloading' | 'success' | 'error';

export const GDriveDownloadDialog = ({
  isOpen,
  onClose,
  accountId,
  fileId,
  fileName,
}: GDriveDownloadDialogProps) => {
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setDownloadState('idle');
      setErrorMessage('');
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      return;
    }

    // Auto-start the download flow when dialog opens
    startDownload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Clean up auto-close timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, []);

  const startDownload = async () => {
    setDownloadState('picking');
    setErrorMessage('');

    try {
      const savePath = await save({ defaultPath: fileName });

      if (!savePath) {
        // User cancelled the save dialog
        onClose();
        return;
      }

      setDownloadState('downloading');

      await gdriveManager.downloadFile(accountId, fileId, savePath);

      setDownloadState('success');

      toast({
        title: 'Download Complete',
        description: `"${fileName}" has been downloaded successfully.`,
      });

      // Auto-close after a short delay on success
      autoCloseTimerRef.current = setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const message = (err as Error).message;
      setErrorMessage(message);
      setDownloadState('error');

      toast({
        title: 'Download Failed',
        description: `Failed to download "${fileName}": ${message}`,
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    if (downloadState === 'downloading') return; // Don't allow closing during download
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-xp-surface border-xp-border w-96 max-w-full rounded-lg border p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xp-text text-lg font-medium">Download File</h3>
          <button
            onClick={handleClose}
            disabled={downloadState === 'downloading'}
            className="text-xp-text-muted hover:text-xp-text focus:ring-xp-blue focus:outline-none focus:ring-1 disabled:opacity-50"
            aria-label="Close download dialog"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="py-4 text-center">
          {(downloadState === 'idle' || downloadState === 'picking') && (
            <>
              <Download className="text-xp-blue mx-auto mb-3 h-12 w-12 animate-pulse" />
              <p className="text-xp-text mb-1 text-sm">Preparing download...</p>
              <p className="text-xp-text-muted text-xs">{fileName}</p>
            </>
          )}

          {downloadState === 'downloading' && (
            <>
              <div className="mx-auto mb-3 h-12 w-12">
                <div className="border-xp-border border-t-tokyo-blue h-12 w-12 animate-spin rounded-full border-4" />
              </div>
              <p className="text-xp-text mb-1 text-sm">Downloading...</p>
              <p className="text-xp-text-muted text-xs">{fileName}</p>
            </>
          )}

          {downloadState === 'success' && (
            <>
              <CheckCircle className="text-xp-green mx-auto mb-3 h-12 w-12" />
              <p className="text-xp-text mb-1 text-sm">Download complete!</p>
              <p className="text-xp-text-muted text-xs">{fileName}</p>
            </>
          )}

          {downloadState === 'error' && (
            <>
              <XCircle className="text-xp-red mx-auto mb-3 h-12 w-12" />
              <p className="text-xp-text mb-1 text-sm">Download failed</p>
              <p className="text-xp-text-muted mb-3 text-xs">{errorMessage}</p>
              <div className="flex justify-center space-x-2">
                <button
                  onClick={startDownload}
                  className="bg-xp-blue hover:bg-xp-blue-dark focus:ring-xp-blue rounded px-4 py-2 text-sm text-white transition-colors focus:outline-none focus:ring-1"
                  aria-label="Retry download"
                >
                  Retry
                </button>
                <button
                  onClick={handleClose}
                  className="border-xp-border hover:bg-xp-surface-light text-xp-text focus:ring-xp-blue rounded border px-4 py-2 text-sm transition-colors focus:outline-none focus:ring-1"
                  aria-label="Cancel download"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
