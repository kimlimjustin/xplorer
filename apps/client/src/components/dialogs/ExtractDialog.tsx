import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TauriAPI, type ExtractionOptions, type ArchiveInfo } from '@/lib/tauri-api';
import { formatFileSize } from '@/lib/utils';
import {
  AlertTriangle,
  FolderOpen,
  Archive,
  FolderClosed,
  File as FileIcon,
  Lock,
  CheckSquare,
  Square,
} from 'lucide-react';

interface ExtractDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  archivePath: string;
}

const ExtractDialog = ({
  isOpen,
  onClose,
  onComplete,
  archivePath,
}: ExtractDialogProps) => {
  const { toast } = useToast();
  const [archiveInfo, setArchiveInfo] = useState<ArchiveInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [outputDirectory, setOutputDirectory] = useState('');
  const [password, setPassword] = useState('');
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [preservePermissions, setPreservePermissions] = useState(true);
  const [includeHidden, setIncludeHidden] = useState(true);

  // Selection state for partial extraction
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

  const allEntryPaths = useMemo(() => {
    if (!archiveInfo) return [];
    return archiveInfo.files.map((f) => f.path);
  }, [archiveInfo]);

  const allSelected = allEntryPaths.length > 0 && selectedEntries.size === allEntryPaths.length;
  const selectionCount = selectedEntries.size;

  const toggleEntry = useCallback((path: string) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedEntries(new Set(allEntryPaths));
  }, [allEntryPaths]);

  const deselectAll = useCallback(() => {
    setSelectedEntries(new Set());
  }, []);

  useEffect(() => {
    if (isOpen && archivePath) {
      loadArchiveInfo();
      generateDefaultOutputDirectory();
      setSelectedEntries(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, archivePath]);

  const loadArchiveInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const info = await TauriAPI.getArchiveInfo(archivePath);
      setArchiveInfo(info);
    } catch (err) {
      setError((err as Error).message);
      toast({
        title: 'Error Loading Archive Info',
        description: `Failed to analyze archive: ${(err as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultOutputDirectory = () => {
    if (!archivePath) return;

    // Default to the same directory as the archive, with the archive name as folder
    const archiveDir = archivePath.split(/[/\\]/).slice(0, -1).join('/');
    const archiveName =
      archivePath
        .split(/[/\\]/)
        .pop()
        ?.replace(/\.(zip|tar|tar\.gz|tar\.bz2|tar\.xz|7z|rar)$/i, '') || 'extracted';
    setOutputDirectory(`${archiveDir}/${archiveName}`);
  };

  const handleExtract = async () => {
    if (!outputDirectory.trim()) {
      toast({
        title: 'Output Directory Required',
        description: 'Please specify an output directory for the extracted files.',
        variant: 'destructive',
      });
      return;
    }

    if (archiveInfo?.is_encrypted && !password.trim()) {
      toast({
        title: 'Password Required',
        description: 'This archive is encrypted and requires a password.',
        variant: 'destructive',
      });
      return;
    }

    setExtracting(true);

    try {
      const options: ExtractionOptions = {
        output_directory: outputDirectory,
        password: password.trim() || undefined,
        overwrite_existing: overwriteExisting,
        preserve_permissions: preservePermissions,
        include_hidden: includeHidden,
      };

      const resultPath = await TauriAPI.extractArchive(archivePath, options);

      toast({
        title: 'Extraction Complete',
        description: `Successfully extracted to ${resultPath.split(/[/\\]/).pop()}`,
      });

      onComplete?.();
      onClose();
    } catch (err) {
      toast({
        title: 'Extraction Failed',
        description: `Failed to extract archive: ${(err as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleExtractSelected = async () => {
    if (!outputDirectory.trim()) {
      toast({
        title: 'Output Directory Required',
        description: 'Please specify an output directory for the extracted files.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedEntries.size === 0) {
      toast({
        title: 'No Files Selected',
        description: 'Please select at least one file to extract.',
        variant: 'destructive',
      });
      return;
    }

    if (archiveInfo?.is_encrypted && !password.trim()) {
      toast({
        title: 'Password Required',
        description: 'This archive is encrypted and requires a password.',
        variant: 'destructive',
      });
      return;
    }

    setExtracting(true);

    try {
      const resultPath = await TauriAPI.extractSelectedEntries(
        archivePath,
        Array.from(selectedEntries),
        outputDirectory,
        overwriteExisting,
      );

      toast({
        title: 'Extraction Complete',
        description: `Successfully extracted ${selectedEntries.size} item${selectedEntries.size !== 1 ? 's' : ''} to ${resultPath.split(/[/\\]/).pop()}`,
      });

      onComplete?.();
      onClose();
    } catch (err) {
      toast({
        title: 'Extraction Failed',
        description: `Failed to extract selected entries: ${(err as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleClose = () => {
    if (extracting) return;

    setOutputDirectory('');
    setPassword('');
    setError(null);
    setSelectedEntries(new Set());
    onClose();
  };

  const handleBrowseOutputDirectory = async () => {
    try {
      const result = await TauriAPI.showOpenDialog({
        directory: true,
        multiple: false,
      });

      if (result && result.length > 0) {
        setOutputDirectory(result[0]);
      }
    } catch (err) {
      console.error('Failed to open directory dialog:', err);
    }
  };

  const getCompressionRatio = (): string => {
    if (!archiveInfo || archiveInfo.total_size === 0) return '';
    const ratio = (archiveInfo.compressed_size / archiveInfo.total_size) * 100;
    return `${Math.round(ratio)}% of original size`;
  };

  const getArchiveIcon = (): React.ReactNode => {
    return <Archive size={24} className="inline-block text-xp-orange" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-xp-surface rounded-lg shadow-2xl w-[600px] max-w-[90vw] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-xp-border">
          <h2 className="text-xl font-semibold text-xp-text">Extract Archive</h2>
          <button
            onClick={handleClose}
            disabled={extracting}
            className="p-2 hover:bg-xp-surface-light rounded-md transition-colors disabled:opacity-50"
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
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xp-blue"></div>
              <span className="ml-3 text-xp-text-muted">Analyzing archive...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400 text-4xl mb-4">
                <AlertTriangle size="1em" className="inline-block" />
              </div>
              <h3 className="text-lg font-medium text-xp-text mb-2">Error Analyzing Archive</h3>
              <p className="text-xp-text-muted mb-4">{error}</p>
              <button
                onClick={loadArchiveInfo}
                className="px-4 py-2 bg-xp-blue text-white rounded hover:bg-xp-blue-dark transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Archive Summary */}
              {archiveInfo && (
                <div className="bg-xp-bg rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-3">{getArchiveIcon()}</span>
                    <div>
                      <h3 className="text-md font-medium text-xp-text">
                        {archivePath.split(/[/\\]/).pop()}
                      </h3>
                      <p className="text-sm text-xp-text-muted">
                        {archiveInfo.format} Archive
                        {archiveInfo.is_encrypted && (
                          <span className="ml-2 text-yellow-400 inline-flex items-center gap-1">
                            <Lock size={14} /> Encrypted
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xp-text-muted">Files:</span>
                      <span className="ml-2 text-xp-text">
                        {archiveInfo.total_files.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-xp-text-muted">Directories:</span>
                      <span className="ml-2 text-xp-text">
                        {archiveInfo.total_directories.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-xp-text-muted">Compressed size:</span>
                      <span className="ml-2 text-xp-text">
                        {formatFileSize(archiveInfo.compressed_size)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xp-text-muted">Uncompressed size:</span>
                      <span className="ml-2 text-xp-text">
                        {formatFileSize(archiveInfo.total_size)}
                        <span className="ml-1 text-xp-green text-xs">
                          ({getCompressionRatio()})
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Output Directory */}
              <div>
                <label className="block text-sm font-medium text-xp-text mb-2">
                  Extract to Directory
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={outputDirectory}
                    onChange={(e) => setOutputDirectory(e.target.value)}
                    className="flex-1 px-3 py-2 border border-xp-border rounded-md bg-xp-bg text-xp-text focus:ring-xp-blue focus:border-xp-blue"
                    placeholder="Enter output directory..."
                  />
                  <button
                    onClick={handleBrowseOutputDirectory}
                    className="px-3 py-2 border border-xp-border rounded-md hover:bg-xp-surface-light transition-colors"
                  >
                    <FolderOpen size={16} />
                  </button>
                </div>
              </div>

              {/* Password (if encrypted) */}
              {archiveInfo?.is_encrypted && (
                <div>
                  <label className="block text-sm font-medium text-xp-text mb-2">
                    Archive Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-xp-border rounded-md bg-xp-bg text-xp-text focus:ring-xp-blue focus:border-xp-blue"
                    placeholder="Enter archive password..."
                  />
                  <p className="text-xs text-yellow-400 mt-1">
                    <Lock size={12} className="inline-block mr-1" /> This archive is encrypted and
                    requires a password to extract
                  </p>
                </div>
              )}

              {/* Options */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-xp-text">Extraction Options</h4>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overwriteExisting}
                      onChange={(e) => setOverwriteExisting(e.target.checked)}
                      className="w-4 h-4 text-xp-blue bg-xp-bg border-xp-border rounded focus:ring-xp-blue"
                    />
                    <span className="text-sm text-xp-text">Overwrite existing files</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preservePermissions}
                      onChange={(e) => setPreservePermissions(e.target.checked)}
                      className="w-4 h-4 text-xp-blue bg-xp-bg border-xp-border rounded focus:ring-xp-blue"
                    />
                    <span className="text-sm text-xp-text">Preserve file permissions</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeHidden}
                      onChange={(e) => setIncludeHidden(e.target.checked)}
                      className="w-4 h-4 text-xp-blue bg-xp-bg border-xp-border rounded focus:ring-xp-blue"
                    />
                    <span className="text-sm text-xp-text">Include hidden files</span>
                  </label>
                </div>
              </div>

              {/* Archive Contents with Selection */}
              {archiveInfo && archiveInfo.files.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-xp-text">
                      Archive Contents ({archiveInfo.files.length} items)
                      {selectionCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-xp-blue text-white">
                          {selectionCount} selected
                        </span>
                      )}
                    </h4>
                    <button
                      onClick={allSelected ? deselectAll : selectAll}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-xp-blue hover:text-xp-blue-dark transition-colors"
                    >
                      {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto bg-xp-bg rounded border border-xp-border">
                    {archiveInfo.files.map((file, index) => (
                      <div
                        key={index}
                        className={`flex items-center space-x-2 px-3 py-1 text-xs border-b border-xp-border last:border-b-0 cursor-pointer hover:bg-xp-surface-light transition-colors ${selectedEntries.has(file.path) ? 'bg-xp-blue/10' : ''}`}
                        onClick={() => toggleEntry(file.path)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEntries.has(file.path)}
                          onChange={() => toggleEntry(file.path)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-3.5 h-3.5 text-xp-blue bg-xp-bg border-xp-border rounded focus:ring-xp-blue flex-shrink-0"
                        />
                        <span className="text-xp-text-muted flex-shrink-0">
                          {file.is_directory ? (
                            <FolderClosed size={12} className="inline-block" />
                          ) : (
                            <FileIcon size={12} className="inline-block" />
                          )}
                        </span>
                        <span className="flex-1 text-xp-text truncate">{file.path}</span>
                        <span className="text-xp-text-muted flex-shrink-0">
                          {file.is_directory ? '' : formatFileSize(file.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-xp-border bg-xp-bg">
          <button
            onClick={handleClose}
            disabled={extracting}
            className="px-4 py-2 text-xp-text hover:bg-xp-surface-light rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {selectionCount > 0 && (
            <button
              onClick={handleExtractSelected}
              disabled={
                extracting ||
                loading ||
                !outputDirectory.trim() ||
                (archiveInfo?.is_encrypted && !password.trim())
              }
              className="px-4 py-2 bg-xp-green text-white rounded hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {extracting && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              <span>{extracting ? 'Extracting...' : `Extract Selected (${selectionCount})`}</span>
            </button>
          )}
          <button
            onClick={handleExtract}
            disabled={
              extracting ||
              loading ||
              !outputDirectory.trim() ||
              (archiveInfo?.is_encrypted && !password.trim())
            }
            className="px-4 py-2 bg-xp-blue text-white rounded hover:bg-xp-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {extracting && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            <span>{extracting ? 'Extracting...' : 'Extract All'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExtractDialog;
