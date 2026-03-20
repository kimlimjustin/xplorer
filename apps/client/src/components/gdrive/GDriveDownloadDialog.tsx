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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-xp-surface border border-xp-border rounded-lg p-6 w-96 max-w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-xp-text">Download File</h3>
          <button
            onClick={handleClose}
            disabled={downloadState === 'downloading'}
            className="text-xp-text-muted hover:text-xp-text disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-xp-blue"
            aria-label="Close download dialog"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center py-4">
          {(downloadState === 'idle' || downloadState === 'picking') && (
            <>
              <Download className="w-12 h-12 mx-auto mb-3 text-xp-blue animate-pulse" />
              <p className="text-sm text-xp-text mb-1">Preparing download...</p>
              <p className="text-xs text-xp-text-muted">{fileName}</p>
            </>
          )}

          {downloadState === 'downloading' && (
            <>
              <div className="w-12 h-12 mx-auto mb-3">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-xp-border border-t-tokyo-blue" />
              </div>
              <p className="text-sm text-xp-text mb-1">Downloading...</p>
              <p className="text-xs text-xp-text-muted">{fileName}</p>
            </>
          )}

          {downloadState === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-xp-green" />
              <p className="text-sm text-xp-text mb-1">Download complete!</p>
              <p className="text-xs text-xp-text-muted">{fileName}</p>
            </>
          )}

          {downloadState === 'error' && (
            <>
              <XCircle className="w-12 h-12 mx-auto mb-3 text-xp-red" />
              <p className="text-sm text-xp-text mb-1">Download failed</p>
              <p className="text-xs text-xp-text-muted mb-3">{errorMessage}</p>
              <div className="flex justify-center space-x-2">
                <button
                  onClick={startDownload}
                  className="px-4 py-2 text-sm bg-xp-blue text-white rounded hover:bg-xp-blue-dark transition-colors focus:outline-none focus:ring-1 focus:ring-xp-blue"
                  aria-label="Retry download"
                >
                  Retry
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm border border-xp-border rounded hover:bg-xp-surface-light transition-colors text-xp-text focus:outline-none focus:ring-1 focus:ring-xp-blue"
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
}
