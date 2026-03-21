import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TauriAPI, type Application, type FileAssociation } from '@/lib/tauri-api';
import { getFileIcon } from '@/lib/utils';
import { AlertTriangle, AppWindow } from 'lucide-react';

interface OpenWithDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
}

const OpenWithDialog = ({ isOpen, onClose, filePath }: OpenWithDialogProps) => {
  const { toast } = useToast();
  const [fileAssociation, setFileAssociation] = useState<FileAssociation | null>(null);
  const [systemApps, setSystemApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [rememberChoice, setRememberChoice] = useState(false);

  useEffect(() => {
    if (isOpen && filePath) {
      loadFileAssociations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, filePath]);

  const loadFileAssociations = async () => {
    setLoading(true);
    setError(null);

    try {
      const [associations, apps] = await Promise.all([
        TauriAPI.getFileAssociations(filePath),
        TauriAPI.getSystemApplications(),
      ]);

      setFileAssociation(associations);
      setSystemApps(apps);

      // Set default selected app
      if (associations.default_app) {
        setSelectedApp(associations.default_app);
      } else if (associations.available_apps.length > 0) {
        setSelectedApp(associations.available_apps[0]);
      }
    } catch (err) {
      setError((err as Error).message);
      toast({
        title: 'Error Loading Applications',
        description: `Failed to load available applications: ${(err as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWith = async () => {
    if (!selectedApp) {
      toast({
        title: 'No Application Selected',
        description: 'Please select an application to open the file with.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await TauriAPI.openFileWithApplication(filePath, selectedApp.path);

      // If user wants to remember this choice, set as default
      if (rememberChoice && fileAssociation) {
        try {
          await TauriAPI.setDefaultApplication(fileAssociation.extension, selectedApp.path);
          toast({
            title: 'Default Application Set',
            description: `${selectedApp.name} is now the default application for .${fileAssociation.extension} files.`,
          });
        } catch (err) {
          // Don't show error for setting default - it's not critical
          console.warn('Failed to set default application:', err);
        }
      }

      toast({
        title: 'File Opened',
        description: `Opened ${filePath.split('/').pop()} with ${selectedApp.name}`,
      });

      onClose();
    } catch (err) {
      toast({
        title: 'Error Opening File',
        description: `Failed to open file: ${(err as Error).message}`,
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    setSelectedApp(null);
    setRememberChoice(false);
    setError(null);
    onClose();
  };

  const getFileName = () => {
    return filePath.split(/[/\\]/).pop() || 'Unknown File';
  };

  const getApplicationIcon = (_app: Application): React.ReactNode => {
    return <AppWindow size="1em" className="inline-block" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-xp-surface max-h-[90vh] w-[500px] max-w-[90vw] overflow-hidden rounded-lg shadow-2xl">
        {/* Header */}
        <div className="border-xp-border flex items-center justify-between border-b p-6">
          <h2 className="text-xp-text text-xl font-semibold">Open With</h2>
          <button
            onClick={handleClose}
            className="hover:bg-xp-surface-light rounded-md p-2 transition-colors"
            aria-label="Close open with dialog"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {/* eslint-disable-next-line no-nested-ternary */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="border-xp-blue h-8 w-8 animate-spin rounded-full border-b-2" />
              <span className="text-xp-text-muted ml-3">Loading applications...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <div className="mb-4 text-4xl text-red-400">
                <AlertTriangle size="1em" className="inline-block" />
              </div>
              <h3 className="text-xp-text mb-2 text-lg font-medium">Error Loading Applications</h3>
              <p className="text-xp-text-muted mb-4">{error}</p>
              <button
                onClick={loadFileAssociations}
                className="bg-xp-blue hover:bg-xp-blue-dark rounded px-4 py-2 text-white transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* File Information */}
              <div className="bg-xp-bg flex items-center space-x-4 rounded-lg p-4">
                <div className="text-4xl">
                  {getFileIcon({
                    name: getFileName(),
                    is_dir: false,
                    path: filePath,
                    size: 0,
                    modified: 0,
                    file_type: fileAssociation?.extension || '',
                  })}
                </div>
                <div>
                  <h3 className="text-xp-text text-lg font-medium">{getFileName()}</h3>
                  {fileAssociation && (
                    <p className="text-xp-text-muted text-sm">
                      {fileAssociation.extension && `.${fileAssociation.extension} file`}
                      {fileAssociation.mime_type && ` (${fileAssociation.mime_type})`}
                    </p>
                  )}
                </div>
              </div>

              {/* Available Applications */}
              <div>
                <h4 className="text-md text-xp-text mb-3 font-medium">Choose an application:</h4>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {/* Recommended applications first */}
                  {fileAssociation?.available_apps && fileAssociation.available_apps.length > 0 && (
                    <>
                      <p className="text-xp-text-muted mb-2 px-2 text-xs">Recommended:</p>
                      {fileAssociation.available_apps.map((app) => (
                        <div
                          key={`recommended-${app.path}`}
                          className={`flex cursor-pointer items-center space-x-3 rounded p-3 transition-colors ${
                            selectedApp?.path === app.path
                              ? 'bg-xp-blue border-xp-blue border bg-opacity-20'
                              : 'hover:bg-xp-surface-light border border-transparent'
                          }`}
                          onClick={() => setSelectedApp(app)}
                        >
                          <div className="text-2xl">{getApplicationIcon(app)}</div>
                          <div className="flex-1">
                            <div className="text-xp-text font-medium">{app.name}</div>
                            <div className="text-xp-text-muted truncate text-xs">{app.path}</div>
                            {app.is_default && (
                              <span className="bg-xp-green text-xp-green rounded bg-opacity-20 px-2 py-0.5 text-xs">
                                Default
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Other system applications */}
                  {systemApps.length > 0 && (
                    <>
                      <p className="text-xp-text-muted mb-2 mt-4 px-2 text-xs">
                        Other applications:
                      </p>
                      {systemApps
                        .filter(
                          (app) =>
                            !fileAssociation?.available_apps.some(
                              (recApp) => recApp.path === app.path,
                            ),
                        )
                        .slice(0, 10) // Limit to prevent overwhelming UI
                        .map((app) => (
                          <div
                            key={`system-${app.path}`}
                            className={`flex cursor-pointer items-center space-x-3 rounded p-3 transition-colors ${
                              selectedApp?.path === app.path
                                ? 'bg-xp-blue border-xp-blue border bg-opacity-20'
                                : 'hover:bg-xp-surface-light border border-transparent'
                            }`}
                            onClick={() => setSelectedApp(app)}
                          >
                            <div className="text-2xl">{getApplicationIcon(app)}</div>
                            <div className="flex-1">
                              <div className="text-xp-text font-medium">{app.name}</div>
                              <div className="text-xp-text-muted truncate text-xs">{app.path}</div>
                            </div>
                          </div>
                        ))}
                    </>
                  )}
                </div>
              </div>

              {/* Remember choice option */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="remember-choice"
                  checked={rememberChoice}
                  onChange={(e) => setRememberChoice(e.target.checked)}
                  className="text-xp-blue bg-xp-bg border-xp-border focus:ring-xp-blue h-4 w-4 rounded focus:ring-2"
                />
                <label htmlFor="remember-choice" className="text-xp-text cursor-pointer text-sm">
                  Always use this application for .{fileAssociation?.extension || 'this'} files
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-xp-border bg-xp-bg flex justify-end space-x-3 border-t p-6">
          <button
            onClick={handleClose}
            className="text-xp-text hover:bg-xp-surface-light rounded px-4 py-2 transition-colors"
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleOpenWith}
            disabled={!selectedApp || loading}
            className="bg-xp-blue hover:bg-xp-blue-dark rounded px-4 py-2 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Open file with selected application"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpenWithDialog;
