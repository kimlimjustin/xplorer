import React, { useState, useEffect, useRef } from 'react';
import { gdriveManager } from '@/lib/gdrive-plugin';
import { open } from '@tauri-apps/plugin-dialog';
import { Upload, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GDriveUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  parentFolderId: string;
  onUploadComplete: () => void;
}

type UploadState = 'idle' | 'picking' | 'uploading' | 'success' | 'error';

export const GDriveUploadDialog = ({
  isOpen,
  onClose,
  accountId,
  parentFolderId,
  onUploadComplete,
}: GDriveUploadDialogProps) => {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setUploadState('idle');
      setErrorMessage('');
      setSelectedFileName('');
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      return;
    }

    // Auto-start the upload flow when dialog opens
    startUpload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Clean up auto-close timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, []);

  const startUpload = async () => {
    setUploadState('picking');
    setErrorMessage('');

    try {
      const selected = await open({ multiple: false });

      if (!selected) {
        // User cancelled the file picker
        onClose();
        return;
      }

      const filePath = Array.isArray(selected) ? selected[0] : selected;
      const fileName = filePath.split(/[/\\]/).pop() || 'file';
      setSelectedFileName(fileName);
      setUploadState('uploading');

      await gdriveManager.uploadFile(accountId, filePath, parentFolderId);

      setUploadState('success');

      toast({
        title: 'Upload Complete',
        description: `"${fileName}" has been uploaded successfully.`,
      });

      onUploadComplete();

      // Auto-close after a short delay on success
      autoCloseTimerRef.current = setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const message = (err as Error).message;
      setErrorMessage(message);
      setUploadState('error');

      toast({
        title: 'Upload Failed',
        description: `Failed to upload file: ${message}`,
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    if (uploadState === 'uploading') return; // Don't allow closing during upload
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-xp-surface border border-xp-border rounded-lg p-6 w-96 max-w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-xp-text">Upload File</h3>
          <button
            onClick={handleClose}
            disabled={uploadState === 'uploading'}
            className="text-xp-text-muted hover:text-xp-text disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-xp-blue"
            aria-label="Close upload dialog"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center py-4">
          {(uploadState === 'idle' || uploadState === 'picking') && (
            <>
              <Upload className="w-12 h-12 mx-auto mb-3 text-xp-blue animate-pulse" />
              <p className="text-sm text-xp-text mb-1">Select a file to upload...</p>
              <p className="text-xs text-xp-text-muted">Choose a file from your computer</p>
            </>
          )}

          {uploadState === 'uploading' && (
            <>
              <div className="w-12 h-12 mx-auto mb-3">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-xp-border border-t-tokyo-blue" />
              </div>
              <p className="text-sm text-xp-text mb-1">Uploading...</p>
              <p className="text-xs text-xp-text-muted">{selectedFileName}</p>
            </>
          )}

          {uploadState === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-xp-green" />
              <p className="text-sm text-xp-text mb-1">Upload complete!</p>
              <p className="text-xs text-xp-text-muted">{selectedFileName}</p>
            </>
          )}

          {uploadState === 'error' && (
            <>
              <XCircle className="w-12 h-12 mx-auto mb-3 text-xp-red" />
              <p className="text-sm text-xp-text mb-1">Upload failed</p>
              <p className="text-xs text-xp-text-muted mb-3">{errorMessage}</p>
              <div className="flex justify-center space-x-2">
                <button
                  onClick={startUpload}
                  className="px-4 py-2 text-sm bg-xp-blue text-white rounded hover:bg-xp-blue-dark transition-colors focus:outline-none focus:ring-1 focus:ring-xp-blue"
                  aria-label="Retry upload"
                >
                  Retry
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm border border-xp-border rounded hover:bg-xp-surface-light transition-colors text-xp-text focus:outline-none focus:ring-1 focus:ring-xp-blue"
                  aria-label="Cancel upload"
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
