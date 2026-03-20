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

const CompressDialog = ({
  isOpen,
  onClose,
  onComplete,
  files,
}: CompressDialogProps) => {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-xp-surface rounded-lg shadow-2xl w-[600px] max-w-[90vw] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-xp-border">
          <h2 className="text-xl font-semibold text-xp-text">Compress Files</h2>
          <button
            onClick={handleClose}
            disabled={compressing}
            className="p-2 hover:bg-xp-surface-light rounded-md transition-colors disabled:opacity-50"
            aria-label="Close compress dialog"
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
              <span className="ml-3 text-xp-text-muted">Analyzing files...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400 text-4xl mb-4">
                <AlertTriangle size="1em" className="inline-block" />
              </div>
              <h3 className="text-lg font-medium text-xp-text mb-2">Error Analyzing Files</h3>
              <p className="text-xp-text-muted mb-4">{error}</p>
              <button
                onClick={loadCompressionInfo}
                className="px-4 py-2 bg-xp-blue text-white rounded hover:bg-xp-blue-dark transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Files Summary */}
              {compressionInfo && (
                <div className="bg-xp-bg rounded-lg p-4">
                  <h3 className="text-md font-medium text-xp-text mb-3">Files to compress:</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xp-text-muted">Files:</span>
                      <span className="ml-2 text-xp-text">
                        {compressionInfo.total_files.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-xp-text-muted">Directories:</span>
                      <span className="ml-2 text-xp-text">
                        {compressionInfo.total_directories.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-xp-text-muted">Total size:</span>
                      <span className="ml-2 text-xp-text">
                        {formatFileSize(compressionInfo.total_size)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xp-text-muted">Estimated size:</span>
                      <span className="ml-2 text-xp-text">
                        {formatFileSize(compressionInfo.estimated_compressed_size)}
                        <span className="ml-1 text-xp-green text-xs">({getSizeReduction()})</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Output Path */}
              <div>
                <label className="block text-sm font-medium text-xp-text mb-2">Output Path</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    className="flex-1 px-3 py-2 border border-xp-border rounded-md bg-xp-bg text-xp-text focus:ring-2 focus:ring-xp-blue focus:border-xp-blue"
                    placeholder="Enter output path..."
                  />
                  <button
                    onClick={handleBrowseOutputPath}
                    className="px-3 py-2 border border-xp-border rounded-md hover:bg-xp-surface-light transition-colors"
                    aria-label="Browse for output directory"
                  >
                    <FolderOpen size={16} />
                  </button>
                </div>
              </div>

              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-xp-text mb-2">
                  Compression Format
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Zip', 'TarGz', 'TarBz2', 'SevenZ'] as CompressionFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => handleFormatChange(fmt)}
                      className={`p-3 rounded-md border transition-colors ${
                        format === fmt
                          ? 'border-xp-blue bg-xp-blue bg-opacity-20 text-xp-blue'
                          : 'border-xp-border hover:bg-xp-surface-light text-xp-text'
                      }`}
                    >
                      <div className="font-medium">{fmt === 'SevenZ' ? '7z' : fmt}</div>
                      <div className="text-xs text-xp-text-muted">
                        .{getExtensionForFormat(fmt)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Compression Level */}
              <div>
                <label className="block text-sm font-medium text-xp-text mb-2">
                  Compression Level: {compressionLevel}
                </label>
                <input
                  type="range"
                  min="1"
                  max="9"
                  value={compressionLevel}
                  onChange={(e) => setCompressionLevel(parseInt(e.target.value))}
                  className="w-full h-2 bg-xp-surface-light rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-xp-text-muted mt-1">
                  <span>Fastest (1)</span>
                  <span>Best (9)</span>
                </div>
              </div>

              {/* Password Protection */}
              <div>
                <label className="block text-sm font-medium text-xp-text mb-2">
                  Password Protection (Optional)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-xp-border rounded-md bg-xp-bg text-xp-text focus:ring-2 focus:ring-xp-blue focus:border-xp-blue"
                  placeholder="Enter password to protect archive..."
                />
                <p className="text-xs text-xp-text-muted mt-1">
                  Note: Password protection may not be supported by all formats
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-xp-text">Options</h4>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeHidden}
                      onChange={(e) => setIncludeHidden(e.target.checked)}
                      className="w-4 h-4 text-xp-blue bg-xp-bg border-xp-border rounded focus:ring-xp-blue"
                    />
                    <span className="text-sm text-xp-text">Include hidden files</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={followSymlinks}
                      onChange={(e) => setFollowSymlinks(e.target.checked)}
                      className="w-4 h-4 text-xp-blue bg-xp-bg border-xp-border rounded focus:ring-xp-blue"
                    />
                    <span className="text-sm text-xp-text">Follow symbolic links</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-xp-border bg-xp-bg">
          <button
            onClick={handleClose}
            disabled={compressing}
            className="px-4 py-2 text-xp-text hover:bg-xp-surface-light rounded transition-colors disabled:opacity-50"
            aria-label="Cancel compression"
          >
            Cancel
          </button>
          <button
            onClick={handleCompress}
            disabled={compressing || loading || !outputPath.trim()}
            className="px-4 py-2 bg-xp-blue text-white rounded hover:bg-xp-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            aria-label={compressing ? 'Compressing files' : 'Compress files'}
          >
            {compressing && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            <span>{compressing ? 'Compressing...' : 'Compress'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default CompressDialog;
