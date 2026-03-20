import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { type FileEntry } from '@/lib/tauri-api';
import { gdriveManager } from '@/lib/gdrive-plugin';
import {
  Cloud,
  RefreshCw,
  ChevronUp,
  Download,
  Upload,
  FolderPlus,
  FolderOpen,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// @tauri-apps/plugin-dialog save/open removed — not used directly here
import { formatFileSize, formatDate, getFileIcon, sortFiles } from '@/lib/utils';
import { GDriveDownloadDialog } from '@/components/gdrive/GDriveDownloadDialog';
import { GDriveUploadDialog } from '@/components/gdrive/GDriveUploadDialog';

interface BreadcrumbEntry {
  id: string;
  name: string;
}

interface GDriveFileBrowserProps {
  accountId: string;
  initialFolderId?: string;
  onNavigate?: (path: string) => void;
  onFileSelect?: (file: FileEntry) => void;
}

const GDriveFileBrowser = ({
  accountId,
  initialFolderId,
  onNavigate,
  onFileSelect,
}: GDriveFileBrowserProps) => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string>(initialFolderId || 'root');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileEntry } | null>(
    null,
  );
  const [accountEmail, setAccountEmail] = useState<string>('');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<{ fileId: string; fileName: string } | null>(
    null,
  );

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const loadFiles = useCallback(
    async (folderId: string) => {
      setError(null);
      setSelectedFile(null);
      setCurrentFolderId(folderId);
      onNavigate?.(folderId);

      // Show cached data instantly if available
      const cached = gdriveManager.getCachedFiles(accountId, folderId);
      if (cached) {
        setFiles(cached);
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const result = await gdriveManager.listFiles(accountId, folderId);
        setFiles(result);
      } catch (err) {
        // Only show error if we had no cached data
        if (!cached) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setError(errorMessage);
          toast({
            title: 'Google Drive Error',
            description: `Failed to load files: ${errorMessage}`,
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accountId, onNavigate, toast],
  );

  // Load account info and files on mount
  useEffect(() => {
    const loadAccount = async () => {
      try {
        const accounts = await gdriveManager.getAccounts();
        const account = accounts.find((a) => a.id === accountId);
        if (account) {
          setAccountEmail(account.email);
        }
      } catch {
        // Silently ignore — email is just for display
      }
    };

    loadAccount();
    loadFiles(initialFolderId || 'root');
    // Only reload when the account changes, not when loadFiles reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const sortedFiles = useMemo(
    () => sortFiles([...files], sortBy, sortOrder),
    [files, sortBy, sortOrder],
  );

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRefresh = () => {
    loadFiles(currentFolderId);
  };

  const navigateUp = () => {
    if (breadcrumbs.length <= 1) return;
    const newBreadcrumbs = breadcrumbs.slice(0, -1);
    setBreadcrumbs(newBreadcrumbs);
    const parentFolder = newBreadcrumbs[newBreadcrumbs.length - 1];
    loadFiles(parentFolder.id);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === breadcrumbs.length - 1) return; // Already there
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    loadFiles(newBreadcrumbs[index].id);
  };

  const handleFileClick = (file: FileEntry) => {
    if (selectedFile?.path === file.path) {
      setSelectedFile(null);
    } else {
      setSelectedFile(file);
    }
    onFileSelect?.(file);
  };

  const handleFileDoubleClick = (file: FileEntry) => {
    if (file.is_dir) {
      setBreadcrumbs((prev) => [...prev, { id: file.path, name: file.name }]);
      loadFiles(file.path);
    } else {
      onFileSelect?.(file);
    }
  };

  const handleSortChange = (newSortBy: string) => {
    if (newSortBy === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, file: FileEntry) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
    setSelectedFile(file);
  };

  const handleNewFolder = async () => {
    const folderName = prompt('Enter folder name:');
    if (!folderName?.trim()) return;

    try {
      await gdriveManager.createFolder(accountId, folderName.trim(), currentFolderId);
      toast({
        title: 'Folder Created',
        description: `Created folder "${folderName.trim()}"`,
      });
      loadFiles(currentFolderId);
    } catch (err) {
      toast({
        title: 'Error',
        description: `Failed to create folder: ${(err as Error).message}`,
        variant: 'destructive',
      });
    }
  };

  const handleUpload = () => {
    setShowUploadDialog(true);
  };

  const handleDownload = () => {
    if (!selectedFile || selectedFile.is_dir) return;
    setDownloadTarget({ fileId: selectedFile.path, fileName: selectedFile.name });
    setShowDownloadDialog(true);
  };

  const handleDelete = async (file?: FileEntry) => {
    const targetFile = file || selectedFile;
    if (!targetFile) return;

    const confirmed = confirm(`Are you sure you want to delete "${targetFile.name}"?`);
    if (!confirmed) return;

    try {
      await gdriveManager.deleteFile(accountId, targetFile.path);
      toast({
        title: 'Deleted',
        description: `"${targetFile.name}" has been deleted.`,
      });
      setSelectedFile(null);
      loadFiles(currentFolderId);
    } catch (err) {
      toast({
        title: 'Error',
        description: `Failed to delete: ${(err as Error).message}`,
        variant: 'destructive',
      });
    }
  };

  const handleRename = async (file?: FileEntry) => {
    const targetFile = file || selectedFile;
    if (!targetFile) return;

    const newName = prompt('Enter new name:', targetFile.name);
    if (!newName?.trim() || newName.trim() === targetFile.name) return;

    try {
      await gdriveManager.renameFile(accountId, targetFile.path, newName.trim());
      toast({
        title: 'Renamed',
        description: `Renamed to "${newName.trim()}"`,
      });
      loadFiles(currentFolderId);
    } catch (err) {
      toast({
        title: 'Error',
        description: `Failed to rename: ${(err as Error).message}`,
        variant: 'destructive',
      });
    }
  };

  const handleContextMenuAction = (action: string) => {
    if (!contextMenu) return;
    const file = contextMenu.file;
    setContextMenu(null);

    switch (action) {
      case 'open':
        if (file.is_dir) {
          handleFileDoubleClick(file);
        }
        break;
      case 'download':
        if (!file.is_dir) {
          setDownloadTarget({ fileId: file.path, fileName: file.name });
          setShowDownloadDialog(true);
        }
        break;
      case 'rename':
        handleRename(file);
        break;
      case 'delete':
        handleDelete(file);
        break;
    }
  };

  const sortLabels: Record<string, string> = { name: 'Name', size: 'Size', modified: 'Modified' };

  return (
    <div className="flex-1 flex flex-col h-full bg-xp-bg">
      {/* Operation Bar — matches normal file explorer style */}
      <div className="bg-xp-surface border-b border-xp-border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center space-x-2 px-3 py-2 bg-xp-bg border border-xp-border rounded hover:bg-xp-surface-light"
              >
                <span className="text-sm">{sortLabels[sortBy] || 'Name'}</span>
                {sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {isSortDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 bg-xp-popover border border-xp-border rounded shadow-xl backdrop-blur-xl z-50 min-w-[160px]">
                  {(['name', 'size', 'modified'] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        handleSortChange(key);
                        setIsSortDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2 text-left hover:bg-xp-surface-light ${
                        sortBy === key ? 'bg-xp-blue bg-opacity-20 text-xp-blue' : ''
                      }`}
                    >
                      <span className="text-sm">{sortLabels[key]}</span>
                      {sortBy === key &&
                        (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center space-x-1 text-sm text-xp-text overflow-x-auto ml-2">
              <Cloud className="w-4 h-4 text-xp-blue flex-shrink-0" />
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={crumb.id}>
                  {index > 0 && <span className="text-xp-text-muted">/</span>}
                  <button
                    onClick={() => navigateToBreadcrumb(index)}
                    className={`px-1.5 py-0.5 rounded hover:bg-xp-surface-light whitespace-nowrap ${
                      index === breadcrumbs.length - 1
                        ? 'font-medium text-xp-blue'
                        : 'text-xp-text-muted hover:text-xp-text'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
              {accountEmail && (
                <span className="text-xs text-xp-text-muted ml-2">({accountEmail})</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-1">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 hover:bg-xp-surface-light rounded"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading || refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={navigateUp}
              disabled={breadcrumbs.length <= 1}
              className="p-2 hover:bg-xp-surface-light rounded disabled:opacity-50"
              title="Go Up"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-xp-border mx-0.5" />
            <button
              onClick={handleNewFolder}
              className="p-2 hover:bg-xp-surface-light rounded"
              title="New Folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <button
              onClick={handleUpload}
              className="p-2 hover:bg-xp-surface-light rounded"
              title="Upload"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              disabled={!selectedFile || selectedFile.is_dir}
              className="p-2 hover:bg-xp-surface-light rounded disabled:opacity-50"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-xp-border mx-0.5" />
            <button
              onClick={() => handleRename()}
              disabled={!selectedFile}
              className="p-2 hover:bg-xp-surface-light rounded disabled:opacity-50"
              title="Rename"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete()}
              disabled={!selectedFile}
              className="p-2 hover:bg-xp-surface-light rounded disabled:opacity-50 hover:text-xp-red"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Close dropdown on outside click */}
        {isSortDropdownOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setIsSortDropdownOpen(false)} />
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto" onClick={() => setContextMenu(null)}>
        {error ? (
          <div className="p-8 text-center">
            <div className="text-xp-red text-6xl mb-4">
              <Cloud className="w-16 h-16 mx-auto opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-xp-text mb-2">Connection Error</h3>
            <p className="text-xp-text-muted mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-xp-blue text-white rounded hover:bg-xp-blue-dark transition-colors focus:outline-none focus:ring-1 focus:ring-xp-blue"
              aria-label="Retry loading files"
            >
              Try Again
            </button>
          </div>
        ) : loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin text-xp-blue" />
            <p className="text-xp-text-muted">Loading files...</p>
          </div>
        ) : sortedFiles.length === 0 ? (
          <div className="p-8 text-center text-xp-text-muted">
            <Cloud className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">This folder is empty</p>
            <p className="text-sm mt-2">Upload files or create a new folder to get started.</p>
          </div>
        ) : (
          <div className="p-2">
            {sortedFiles.map((file) => (
              <div
                key={file.path}
                tabIndex={0}
                className={`flex items-center p-3 hover:bg-xp-surface-light rounded-md cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-xp-blue ${
                  selectedFile?.path === file.path
                    ? 'bg-xp-blue bg-opacity-20 border border-xp-blue'
                    : 'border border-transparent'
                }`}
                onClick={() => handleFileClick(file)}
                onDoubleClick={() => handleFileDoubleClick(file)}
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                <div className="flex items-center flex-1 min-w-0">
                  <div className="text-2xl mr-3 flex-shrink-0">{getFileIcon(file)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xp-text truncate">{file.name}</div>
                    {file.is_dir && <div className="text-xs text-xp-text-muted">Folder</div>}
                  </div>
                </div>

                <div className="flex items-center space-x-6 text-sm text-xp-text-muted">
                  <div className="w-20 text-right">
                    {file.is_dir ? '\u2014' : formatFileSize(file.size)}
                  </div>

                  <div className="w-32 text-right">{formatDate(file.modified)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-xp-surface border border-xp-border rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.file.is_dir && (
            <button
              onClick={() => handleContextMenuAction('open')}
              className="w-full px-4 py-2 text-left text-sm text-xp-text hover:bg-xp-surface-light transition-colors flex items-center space-x-2 focus:outline-none focus:ring-1 focus:ring-xp-blue"
              aria-label="Open folder"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Open</span>
            </button>
          )}
          {!contextMenu.file.is_dir && (
            <button
              onClick={() => handleContextMenuAction('download')}
              className="w-full px-4 py-2 text-left text-sm text-xp-text hover:bg-xp-surface-light transition-colors flex items-center space-x-2 focus:outline-none focus:ring-1 focus:ring-xp-blue"
              aria-label="Download file"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
          )}
          <button
            onClick={() => handleContextMenuAction('rename')}
            className="w-full px-4 py-2 text-left text-sm text-xp-text hover:bg-xp-surface-light transition-colors flex items-center space-x-2 focus:outline-none focus:ring-1 focus:ring-xp-blue"
            aria-label="Rename file"
          >
            <Pencil className="w-4 h-4" />
            <span>Rename</span>
          </button>
          <div className="border-t border-xp-border my-1" />
          <button
            onClick={() => handleContextMenuAction('delete')}
            className="w-full px-4 py-2 text-left text-sm text-xp-red hover:bg-xp-surface-light transition-colors flex items-center space-x-2 focus:outline-none focus:ring-1 focus:ring-xp-blue"
            aria-label="Delete file"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Download Dialog */}
      {downloadTarget && (
        <GDriveDownloadDialog
          isOpen={showDownloadDialog}
          onClose={() => {
            setShowDownloadDialog(false);
            setDownloadTarget(null);
          }}
          accountId={accountId}
          fileId={downloadTarget.fileId}
          fileName={downloadTarget.fileName}
        />
      )}

      {/* Upload Dialog */}
      <GDriveUploadDialog
        isOpen={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        accountId={accountId}
        parentFolderId={currentFolderId}
        onUploadComplete={() => loadFiles(currentFolderId)}
      />
    </div>
  );
}

export default GDriveFileBrowser;
