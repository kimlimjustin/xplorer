import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  TauriAPI,
  type CompressionOptions,
  type CompressionFormat,
  type CompressionInfo,
  type FileEntry,
} from '@/lib/tauri-api';
import { formatFileSize } from '@/lib/utils';
import { AlertTriangle, FolderOpen } from 'lucide-react';

interface CompressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  files: FileEntry[];
}

const CompressDialog = ({ isOpen, onClose, onComplete, files }: CompressDialogProps) => {
  const { toast } = useToast();
  const [compressionInfo, setCompressionInfo] = useState<CompressionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [outputPath, setOutputPath] = useState('');
  const [format, setFormat] = useState<CompressionFormat>('Zip');
  const [compressionLevel, setCompressionLevel] = useState(6);
  const [password, setPassword] = useState('');
  const [includeHidden, setIncludeHidden] = useState(false);
  const [followSymlinks, setFollowSymlinks] = useState(true);

  useEffect(() => {
    if (isOpen && files.length > 0) {
      loadCompressionInfo();
      generateDefaultOutputPath();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, files]);

  const loadCompressionInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const filePaths = files.map((f) => f.path);
      const info = await TauriAPI.getCompressionInfo(filePaths);
      setCompressionInfo(info);
    } catch (err) {
      setError((err as Error).message);
      toast({
        title: 'Error Loading Compression Info',
        description: `Failed to analyze files: ${(err as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultOutputPath = () => {
    if (files.length === 0) return;

    let baseName: string;
    if (files.length === 1) {
      const file = files[0];
      baseName = file.is_dir ? file.name : file.name.split('.')[0];
    } else {
      baseName = `archive_${files.length}_files`;
    }

    const extension = getExtensionForFormat(format);
    const firstFileDir = files[0].path.split(/[/\\]/).slice(0, -1).join('/');
    setOutputPath(`${firstFileDir}/${baseName}.${extension}`);
  };

  const getExtensionForFormat = (fmt: CompressionFormat): string => {
    switch (fmt) {
      case 'Zip':
        return 'zip';
      case 'Tar':
        return 'tar';
      case 'TarGz':
        return 'tar.gz';
      case 'TarBz2':
        return 'tar.bz2';
      case 'TarXz':
        return 'tar.xz';
      case 'SevenZ':
        return '7z';
      default:
        return 'zip';
    }
  };

  const handleFormatChange = (newFormat: CompressionFormat) => {
    setFormat(newFormat);
    // Update output path extension
    if (outputPath) {
      const pathParts = outputPath.split('.');
      const basePath = pathParts.slice(0, -1).join('.') || pathParts[0];
      const newExtension = getExtensionForFormat(newFormat);
      setOutputPath(`${basePath}.${newExtension}`);
    }
  };

  const handleCompress = async () => {
    if (!outputPath.trim()) {
      toast({
        title: 'Output Path Required',
        description: 'Please specify an output path for the compressed file.',
        variant: 'destructive',
      });
      return;
    }

    setCompressing(true);

    try {
      const options: CompressionOptions = {
        format,
        compression_level: compressionLevel,
        password: password.trim() || undefined,
        include_hidden: includeHidden,
        follow_symlinks: followSymlinks,
      };

      const filePaths = files.map((f) => f.path);
      const resultPath = await TauriAPI.compressFiles(filePaths, outputPath, options);

      toast({
        title: 'Compression Complete',
        description: `Successfully created ${resultPath.split(/[/\\]/).pop()}`,
      });

      onComplete?.();
      onClose();
    } catch (err) {
      toast({
        title: 'Compression Failed',
        description: `Failed to compress files: ${(err as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setCompressing(false);
    }
  };

  const handleClose = () => {
    if (compressing) return; // Don't allow closing during compression

    setOutputPath('');
    setPassword('');
    setError(null);
    onClose();
  };

  const handleBrowseOutputPath = async () => {
    try {
      const result = await TauriAPI.showOpenDialog({
        directory: true,
        multiple: false,
      });

      if (result && result.length > 0) {
        const selectedDir = result[0];
        const currentFileName =
          outputPath.split(/[/\\]/).pop() || `archive.${getExtensionForFormat(format)}`;
        setOutputPath(`${selectedDir}/${currentFileName}`);
      }
    } catch (err) {
      console.error('Failed to open directory dialog:', err);
    }
  };

  const getSizeReduction = (): string => {
    if (!compressionInfo) return '';
    const reduction =
      ((compressionInfo.total_size - compressionInfo.estimated_compressed_size) /
        compressionInfo.total_size) *
      100;
    return `~${Math.round(reduction)}% reduction`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-xp-surface max-h-[90vh] w-[600px] max-w-[90vw] overflow-hidden rounded-lg shadow-2xl">
        {/* Header */}
        <div className="border-xp-border flex items-center justify-between border-b p-6">
          <h2 className="text-xp-text text-xl font-semibold">Compress Files</h2>
          <button
            onClick={handleClose}
            disabled={compressing}
            className="hover:bg-xp-surface-light rounded-md p-2 transition-colors disabled:opacity-50"
            aria-label="Close compress dialog"
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
              <span className="text-xp-text-muted ml-3">Analyzing files...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <div className="mb-4 text-4xl text-red-400">
                <AlertTriangle size="1em" className="inline-block" />
              </div>
              <h3 className="text-xp-text mb-2 text-lg font-medium">Error Analyzing Files</h3>
              <p className="text-xp-text-muted mb-4">{error}</p>
              <button
                onClick={loadCompressionInfo}
                className="bg-xp-blue hover:bg-xp-blue-dark rounded px-4 py-2 text-white transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Files Summary */}
              {compressionInfo && (
                <div className="bg-xp-bg rounded-lg p-4">
                  <h3 className="text-md text-xp-text mb-3 font-medium">Files to compress:</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xp-text-muted">Files:</span>
                      <span className="text-xp-text ml-2">
                        {compressionInfo.total_files.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-xp-text-muted">Directories:</span>
                      <span className="text-xp-text ml-2">
                        {compressionInfo.total_directories.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-xp-text-muted">Total size:</span>
                      <span className="text-xp-text ml-2">
                        {formatFileSize(compressionInfo.total_size)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xp-text-muted">Estimated size:</span>
                      <span className="text-xp-text ml-2">
                        {formatFileSize(compressionInfo.estimated_compressed_size)}
                        <span className="text-xp-green ml-1 text-xs">({getSizeReduction()})</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Output Path */}
              <div>
                <label className="text-xp-text mb-2 block text-sm font-medium">Output Path</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    className="border-xp-border bg-xp-bg text-xp-text focus:ring-xp-blue focus:border-xp-blue flex-1 rounded-md border px-3 py-2 focus:ring-2"
                    placeholder="Enter output path..."
                  />
                  <button
                    onClick={handleBrowseOutputPath}
                    className="border-xp-border hover:bg-xp-surface-light rounded-md border px-3 py-2 transition-colors"
                    aria-label="Browse for output directory"
                  >
                    <FolderOpen size={16} />
                  </button>
                </div>
              </div>

              {/* Format Selection */}
              <div>
                <label className="text-xp-text mb-2 block text-sm font-medium">
                  Compression Format
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Zip', 'TarGz', 'TarBz2', 'SevenZ'] as CompressionFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => handleFormatChange(fmt)}
                      className={`rounded-md border p-3 transition-colors ${
                        format === fmt
                          ? 'border-xp-blue bg-xp-blue text-xp-blue bg-opacity-20'
                          : 'border-xp-border hover:bg-xp-surface-light text-xp-text'
                      }`}
                    >
                      <div className="font-medium">{fmt === 'SevenZ' ? '7z' : fmt}</div>
                      <div className="text-xp-text-muted text-xs">
                        .{getExtensionForFormat(fmt)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Compression Level */}
              <div>
                <label className="text-xp-text mb-2 block text-sm font-medium">
                  Compression Level: {compressionLevel}
                </label>
                <input
                  type="range"
                  min="1"
                  max="9"
                  value={compressionLevel}
                  onChange={(e) => setCompressionLevel(parseInt(e.target.value))}
                  className="bg-xp-surface-light h-2 w-full cursor-pointer appearance-none rounded-lg"
                />
                <div className="text-xp-text-muted mt-1 flex justify-between text-xs">
                  <span>Fastest (1)</span>
                  <span>Best (9)</span>
                </div>
              </div>

              {/* Password Protection */}
              <div>
                <label className="text-xp-text mb-2 block text-sm font-medium">
                  Password Protection (Optional)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-xp-border bg-xp-bg text-xp-text focus:ring-xp-blue focus:border-xp-blue w-full rounded-md border px-3 py-2 focus:ring-2"
                  placeholder="Enter password to protect archive..."
                />
                <p className="text-xp-text-muted mt-1 text-xs">
                  Note: Password protection may not be supported by all formats
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <h4 className="text-xp-text text-sm font-medium">Options</h4>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={includeHidden}
                      onChange={(e) => setIncludeHidden(e.target.checked)}
                      className="text-xp-blue bg-xp-bg border-xp-border focus:ring-xp-blue h-4 w-4 rounded"
                    />
                    <span className="text-xp-text text-sm">Include hidden files</span>
                  </label>
                  <label className="flex cursor-pointer items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={followSymlinks}
                      onChange={(e) => setFollowSymlinks(e.target.checked)}
                      className="text-xp-blue bg-xp-bg border-xp-border focus:ring-xp-blue h-4 w-4 rounded"
                    />
                    <span className="text-xp-text text-sm">Follow symbolic links</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-xp-border bg-xp-bg flex justify-end space-x-3 border-t p-6">
          <button
            onClick={handleClose}
            disabled={compressing}
            className="text-xp-text hover:bg-xp-surface-light rounded px-4 py-2 transition-colors disabled:opacity-50"
            aria-label="Cancel compression"
          >
            Cancel
          </button>
          <button
            onClick={handleCompress}
            disabled={compressing || loading || !outputPath.trim()}
            className="bg-xp-blue hover:bg-xp-blue-dark flex items-center space-x-2 rounded px-4 py-2 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={compressing ? 'Compressing files' : 'Compress files'}
          >
            {compressing && (
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
            )}
            <span>{compressing ? 'Compressing...' : 'Compress'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompressDialog;
