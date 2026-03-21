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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-xp-surface border-xp-border w-96 max-w-full rounded-lg border p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xp-text text-lg font-medium">Upload File</h3>
          <button
            onClick={handleClose}
            disabled={uploadState === 'uploading'}
            className="text-xp-text-muted hover:text-xp-text focus:ring-xp-blue focus:outline-none focus:ring-1 disabled:opacity-50"
            aria-label="Close upload dialog"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="py-4 text-center">
          {(uploadState === 'idle' || uploadState === 'picking') && (
            <>
              <Upload className="text-xp-blue mx-auto mb-3 h-12 w-12 animate-pulse" />
              <p className="text-xp-text mb-1 text-sm">Select a file to upload...</p>
              <p className="text-xp-text-muted text-xs">Choose a file from your computer</p>
            </>
          )}

          {uploadState === 'uploading' && (
            <>
              <div className="mx-auto mb-3 h-12 w-12">
                <div className="border-xp-border border-t-tokyo-blue h-12 w-12 animate-spin rounded-full border-4" />
              </div>
              <p className="text-xp-text mb-1 text-sm">Uploading...</p>
              <p className="text-xp-text-muted text-xs">{selectedFileName}</p>
            </>
          )}

          {uploadState === 'success' && (
            <>
              <CheckCircle className="text-xp-green mx-auto mb-3 h-12 w-12" />
              <p className="text-xp-text mb-1 text-sm">Upload complete!</p>
              <p className="text-xp-text-muted text-xs">{selectedFileName}</p>
            </>
          )}

          {uploadState === 'error' && (
            <>
              <XCircle className="text-xp-red mx-auto mb-3 h-12 w-12" />
              <p className="text-xp-text mb-1 text-sm">Upload failed</p>
              <p className="text-xp-text-muted mb-3 text-xs">{errorMessage}</p>
              <div className="flex justify-center space-x-2">
                <button
                  onClick={startUpload}
                  className="bg-xp-blue hover:bg-xp-blue-dark focus:ring-xp-blue rounded px-4 py-2 text-sm text-white transition-colors focus:outline-none focus:ring-1"
                  aria-label="Retry upload"
                >
                  Retry
                </button>
                <button
                  onClick={handleClose}
                  className="border-xp-border hover:bg-xp-surface-light text-xp-text focus:ring-xp-blue rounded border px-4 py-2 text-sm transition-colors focus:outline-none focus:ring-1"
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
};
