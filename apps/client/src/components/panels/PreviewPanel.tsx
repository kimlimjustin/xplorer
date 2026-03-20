import React, { useState, useEffect, useRef } from 'react';
import { FileEntry, TauriAPI, FolderSizeInfo } from '@/lib/tauri-api';
import { getFileIcon } from '@/lib/utils';
import { defaultPreviewFactory, PreviewProps, PreviewType } from '@/lib/preview-factory';
import { extensionHost } from '@/lib/extension-host';
import { PreviewSkeleton } from '@/components/ui/Skeleton';
import PreviewActionBar from './PreviewActionBar';

// Module-level cache for preview components by file type, avoiding redundant dynamic imports
const previewComponentCache = new Map<PreviewType, React.ComponentType<PreviewProps>>();

/** Delay in ms before committing a file selection for preview loading. */
const PREVIEW_DEBOUNCE_MS = 200;

interface PreviewPanelProps {
  selectedFile: FileEntry | null;
  formatFileSize: (bytes: number) => string;
  formatDate: (timestamp: number) => string;
  getFolderSize?: (path: string) => FolderSizeInfo | null;
  isCalculatingSize?: (path: string) => boolean;
  currentPath?: string;
}

// Enhanced file preview component using the preview factory
const EnhancedFilePreview: React.FC<{
  file: FileEntry;
  category: PreviewType;
  currentPath?: string;
}> = ({ file, category: _category, currentPath }) => {
  const [PreviewComponent, setPreviewComponent] =
    useState<React.ComponentType<PreviewProps> | null>(null);
  const [extensionPreviewElement, setExtensionPreviewElement] = useState<React.ReactElement | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPreviewComponent = async () => {
      try {
        setLoading(true);
        setError(null);
        setExtensionPreviewElement(null);

        // Check extension previews first (extension > built-in > fallback)
        const extPreview = extensionHost.queryPreview({
          name: file.name,
          path: file.path,
          is_dir: file.is_dir,
          size: file.size,
        });

        if (extPreview) {
          // Try to load text content for text-like files
          let fileContent: string | null = null;
          const textExts = [
            'txt',
            'log',
            'ini',
            'cfg',
            'conf',
            'md',
            'json',
            'csv',
            'xml',
            'yaml',
            'yml',
            'toml',
            'js',
            'ts',
            'jsx',
            'tsx',
            'py',
            'java',
            'cpp',
            'c',
            'cs',
            'php',
            'rb',
            'go',
            'rs',
            'html',
            'css',
            'scss',
          ];
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          if (textExts.includes(ext) && file.size < 2 * 1024 * 1024) {
            try {
              fileContent = await TauriAPI.readTextFile(file.path);
            } catch {
              // Not a text file or read failed; pass null
            }
          }

          if (!cancelled) {
            const element = extPreview.render({
              filePath: file.path,
              fileContent,
              currentPath,
              selectedFiles: [
                { name: file.name, path: file.path, is_dir: file.is_dir, size: file.size },
              ],
            });
            setExtensionPreviewElement(element);
            setLoading(false);
          }
          return;
        }

        // Fall back to built-in preview factory
        if (!defaultPreviewFactory.canPreview(file)) {
          if (!cancelled) {
            setPreviewComponent(null);
            setLoading(false);
          }
          return;
        }

        const fileType = defaultPreviewFactory.getFileType(file);

        // Check module-level cache first to avoid redundant dynamic imports
        const cached = previewComponentCache.get(fileType);
        if (cached) {
          if (!cancelled) {
            setPreviewComponent(() => cached);
            setLoading(false);
          }
          return;
        }

        const component = await defaultPreviewFactory.getPreviewComponent(file);
        if (!cancelled) {
          if (component) {
            previewComponentCache.set(fileType, component);
          }
          setPreviewComponent(() => component);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load preview component:', err);
          setError(err instanceof Error ? err.message : 'Failed to load preview');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPreviewComponent();
    return () => {
      cancelled = true;
    };
    // file.path and file.name are sufficient to determine preview type
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.path, file.name, currentPath]);

  const handlePreviewError = (error: Error) => {
    console.error('Preview error:', error);
    setError(error.message);
  };

  const handlePreviewLoad = () => {
    setError(null);
  };

  if (loading) {
    return <PreviewSkeleton />;
  }

  if (error) {
    return (
      <div className="mt-4">
        <h4 className="text-xs font-semibold mb-2 text-xp-text">Preview Error</h4>
        <div
          className="bg-xp-surface border border-xp-border rounded p-4 text-center text-xp-text-secondary"
          role="alert"
        >
          <svg
            className="w-8 h-8 mx-auto mb-2"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs">Preview failed</p>
          <p className="text-xs mt-1 opacity-70">{error}</p>
        </div>
      </div>
    );
  }

  // Extension preview takes priority over built-in previews
  if (extensionPreviewElement) {
    return extensionPreviewElement;
  }

  if (PreviewComponent) {
    return <PreviewComponent file={file} onError={handlePreviewError} onLoad={handlePreviewLoad} />;
  }

  // Fallback for unsupported file types
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">{getFileIcon(file)}</div>
        <p className="text-sm text-xp-text-secondary mb-2">No preview available</p>
        <p className="text-xs text-xp-text-secondary">
          {file.size > 50 * 1024 * 1024
            ? 'File is too large for preview'
            : 'Preview not supported for this file type'}
        </p>
        <p className="text-xs text-xp-text-secondary mt-1">Double-click to open</p>
      </div>
    </div>
  );
};

// Folder details component
const FolderDetails: React.FC<{
  file: FileEntry;
  getFolderSize?: (path: string) => FolderSizeInfo | null;
  isCalculatingSize?: (path: string) => boolean;
  formatFileSize: (bytes: number) => string;
}> = ({ file, getFolderSize, isCalculatingSize, formatFileSize }) => {
  const folderSize = getFolderSize?.(file.path);
  const calculating = isCalculatingSize?.(file.path) || false;

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-center bg-xp-surface border border-xp-border rounded p-6 max-w-sm">
        <div className="text-4xl mb-4">{getFileIcon(file)}</div>
        <h4 className="text-sm font-medium mb-4 text-xp-text">Folder Contents</h4>
        <div className="space-y-3 text-sm">
          {folderSize && (
            <>
              <div className="flex justify-between">
                <span className="text-xp-text-secondary">Total Size:</span>
                <span>{formatFileSize(folderSize.total_size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xp-text-secondary">Files:</span>
                <span>{folderSize.file_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xp-text-secondary">Folders:</span>
                <span>{folderSize.dir_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xp-text-secondary">Total Items:</span>
                <span>{folderSize.file_count + folderSize.dir_count}</span>
              </div>
            </>
          )}
          {calculating && (
            <div className="text-center py-2">
              <div className="inline-flex items-center text-xp-text-secondary">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Calculating size...
              </div>
            </div>
          )}
          {!folderSize && !calculating && (
            <div className="text-center py-2 text-xp-text-secondary text-xs">
              Click to calculate folder size
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PreviewPanel = ({
  selectedFile,
  formatFileSize,
  formatDate,
  getFolderSize,
  isCalculatingSize,
  currentPath,
}: PreviewPanelProps) => {
  const [showProperties, setShowProperties] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up copy feedback timer on unmount
  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  // Lazy preview: debounce the selected file so quick navigation skips heavy loads
  const [confirmedFile, setConfirmedFile] = useState<FileEntry | null>(selectedFile);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any pending timer when selectedFile changes
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // If the file is cleared, confirm immediately (no delay for deselection)
    if (!selectedFile) {
      setConfirmedFile(null);
      return;
    }

    // If the confirmed file is already the same path, no need to debounce
    if (confirmedFile && confirmedFile.path === selectedFile.path) {
      return;
    }

    // Start a debounce timer; only confirm the file after PREVIEW_DEBOUNCE_MS
    debounceTimerRef.current = setTimeout(() => {
      setConfirmedFile(selectedFile);
      debounceTimerRef.current = null;
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
    // Debounce only on path change; confirmedFile check is a guard inside the effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.path]);

  // Whether we are in the debounce waiting period (selected != confirmed)
  const isDebouncing =
    selectedFile !== null && (confirmedFile === null || confirmedFile.path !== selectedFile.path);

  const handleCopyPath = async () => {
    if (selectedFile) {
      try {
        await navigator.clipboard.writeText(selectedFile.path);
        setCopyFeedback(true);
        if (copyFeedbackTimerRef.current) {
          clearTimeout(copyFeedbackTimerRef.current);
        }
        copyFeedbackTimerRef.current = setTimeout(() => {
          setCopyFeedback(false);
          copyFeedbackTimerRef.current = null;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy path:', err);
      }
    }
  };

  if (!selectedFile) {
    return (
      <div
        className="flex items-center justify-center h-full text-center text-xp-text-secondary"
        role="region"
        aria-label="No file selected for preview"
      >
        <div>
          <svg
            className="w-12 h-12 mx-auto mb-3"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
              clipRule="evenodd"
            />
          </svg>
          <p>Select a file to preview</p>
        </div>
      </div>
    );
  }

  // Use selectedFile for the properties section (always instant), but
  // confirmedFile for the heavy preview content area (debounced).
  const previewFile = isDebouncing ? null : confirmedFile;
  const category = defaultPreviewFactory.getFileType(selectedFile);

  return (
    <div
      className="flex flex-col h-full"
      role="region"
      aria-label={`Preview of ${selectedFile.name}`}
    >
      {/* Main Preview Area - Takes most of the space */}
      <div
        className="flex-1 min-h-0 overflow-auto"
        aria-label={`${selectedFile.is_dir ? 'Folder' : 'File'} preview: ${selectedFile.name}`}
      >
        {isDebouncing ? (
          /* Shimmer skeleton during debounce delay */
          <PreviewSkeleton />
        ) : previewFile && previewFile.is_dir ? (
          <div className="h-full flex items-center justify-center">
            <FolderDetails
              file={previewFile}
              getFolderSize={getFolderSize}
              isCalculatingSize={isCalculatingSize}
              formatFileSize={formatFileSize}
            />
          </div>
        ) : previewFile ? (
          <div className="h-full">
            <EnhancedFilePreview file={previewFile} category={category} currentPath={currentPath} />
          </div>
        ) : null}
      </div>

      {/* Quick Actions Bar */}
      <PreviewActionBar file={selectedFile} />

      {/* Collapsible File Properties Section */}
      <div className="border-t border-xp-border bg-xp-surface">
        {/* Properties Header - Always visible */}
        <button
          onClick={() => setShowProperties(!showProperties)}
          className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-xp-surface-light transition-colors"
          aria-expanded={showProperties}
          aria-label={`${showProperties ? 'Hide' : 'Show'} file properties`}
        >
          <div className="flex items-center">
            <div className="text-lg mr-2">{getFileIcon(selectedFile)}</div>
            <div>
              <h3 className="text-sm font-medium truncate" title={selectedFile.name}>
                {selectedFile.name}
              </h3>
              <p className="text-xs text-xp-text-secondary">
                {selectedFile.is_dir ? 'Folder' : formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>
          <svg
            className={`w-4 h-4 transition-transform ${showProperties ? 'rotate-180' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Properties Content - Collapsible */}
        {showProperties && (
          <div className="px-3 pb-3">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-xp-text-secondary">Type:</span>
                <span>{selectedFile.is_dir ? 'Folder' : 'File'}</span>
              </div>

              {!selectedFile.is_dir && (
                <div className="flex justify-between">
                  <span className="text-xp-text-secondary">Size:</span>
                  <span>{formatFileSize(selectedFile.size)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-xp-text-secondary">Modified:</span>
                <span>{formatDate(selectedFile.modified)}</span>
              </div>

              {selectedFile.mime_type && (
                <div className="flex justify-between">
                  <span className="text-xp-text-secondary">MIME Type:</span>
                  <span className="break-all">{selectedFile.mime_type}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-xp-text-secondary">Category:</span>
                <span className="capitalize">{category}</span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xp-text-secondary">Path:</span>
                  <button
                    onClick={handleCopyPath}
                    className={`px-2 py-1 border border-xp-border rounded text-xs transition-colors ${
                      copyFeedback
                        ? 'bg-xp-green bg-opacity-20 border-xp-border text-xp-green'
                        : 'bg-xp-bg hover:bg-xp-surface-light'
                    }`}
                    title="Copy path to clipboard"
                    aria-label={
                      copyFeedback ? 'Path copied to clipboard' : 'Copy file path to clipboard'
                    }
                  >
                    {copyFeedback ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="text-xs font-mono break-all bg-xp-bg p-2 rounded border border-xp-border">
                  {selectedFile.path}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PreviewPanel;
