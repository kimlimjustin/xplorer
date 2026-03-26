// Google Drive Extension for Xplorer
// Provides file browsing, account management, and sidebar navigation for Google Drive.

import { useState, useEffect, useCallback, createElement } from 'react';
import { Tab, Navigation, ContextMenu, Command } from '@xplorer/extension-sdk';
import type { XplorerAPI } from '@xplorer/extension-sdk';

// ── Types ─────────────────────────────────────────────────────────────────

interface GoogleDriveAccount {
  id: string;
  email: string;
  displayName: string;
  isConnected: boolean;
  lastSynced?: string;
}

interface FileEntry {
  path: string;
  name: string;
  size: number;
  modified: number;
  is_dir?: boolean;
  extension?: string;
  mime_type?: string;
  file_type?: string;
}

interface CacheEntry {
  files: FileEntry[];
  timestamp: number;
}

// ── Shared State ──────────────────────────────────────────────────────────

let api: XplorerAPI;
const FILE_CACHE = new Map<string, CacheEntry>();
const ACCOUNTS = new Map<string, GoogleDriveAccount>();

function loadAccounts() {
  try {
    const saved = localStorage.getItem('gdrive-plugin-settings');
    if (saved) {
      const data = JSON.parse(saved);
      for (const acct of data.accounts || []) {
        ACCOUNTS.set(acct.id, acct);
      }
    }
  } catch { /* ignore */ }
}

function saveAccounts() {
  const accounts = Array.from(ACCOUNTS.values());
  localStorage.setItem('gdrive-plugin-settings', JSON.stringify({ accounts }));
}

async function syncAccounts() {
  try {
    const backendAccounts = await api.gdrive.listAccounts();
    for (const ba of backendAccounts) {
      if (!ACCOUNTS.has(ba.id)) {
        ACCOUNTS.set(ba.id, { id: ba.id, email: ba.email, displayName: ba.display_name, isConnected: true });
      } else {
        const existing = ACCOUNTS.get(ba.id)!;
        existing.isConnected = true;
        existing.email = ba.email;
      }
    }
    saveAccounts();
    window.dispatchEvent(new CustomEvent('gdrive-accounts-changed'));
  } catch { /* Backend may not be ready */ }
}

// ── Inline SVG Icons ──────────────────────────────────────────────────────

const CloudIcon = ({ size = 16 }: { size?: number }) =>
  createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    createElement('path', { d: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z' })
  );

const FolderIcon = ({ size = 16 }: { size?: number }) =>
  createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    createElement('path', { d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z' })
  );

const FileIcon = ({ size = 16 }: { size?: number }) =>
  createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    createElement('path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }),
    createElement('polyline', { points: '14 2 14 8 20 8' })
  );

const PlusIcon = ({ size = 16 }: { size?: number }) =>
  createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    createElement('line', { x1: 12, y1: 5, x2: 12, y2: 19 }), createElement('line', { x1: 5, y1: 12, x2: 19, y2: 12 })
  );

const TrashIcon = ({ size = 16 }: { size?: number }) =>
  createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    createElement('path', { d: 'M3 6h18' }), createElement('path', { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' }),
    createElement('path', { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' })
  );

const DownloadIcon = ({ size = 16 }: { size?: number }) =>
  createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    createElement('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    createElement('polyline', { points: '7 10 12 15 17 10' }), createElement('line', { x1: 12, y1: 15, x2: 12, y2: 3 })
  );

const UploadIcon = ({ size = 16 }: { size?: number }) =>
  createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    createElement('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    createElement('polyline', { points: '17 8 12 3 7 8' }), createElement('line', { x1: 12, y1: 3, x2: 12, y2: 15 })
  );

const RefreshIcon = ({ size = 16 }: { size?: number }) =>
  createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    createElement('path', { d: 'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }),
    createElement('path', { d: 'M3 3v5h5' }),
    createElement('path', { d: 'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16' }),
    createElement('path', { d: 'M16 16h5v5' })
  );

const ChevronRightIcon = ({ size = 16 }: { size?: number }) =>
  createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    createElement('polyline', { points: '9 18 15 12 9 6' })
  );

const PencilIcon = ({ size = 16 }: { size?: number }) =>
  createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    createElement('path', { d: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' })
  );

const EyeIcon = ({ size = 16 }: { size?: number }) =>
  createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    createElement('path', { d: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z' }),
    createElement('circle', { cx: 12, cy: 12, r: 3 })
  );

const EyeOffIcon = ({ size = 16 }: { size?: number }) =>
  createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    createElement('path', { d: 'M9.88 9.88a3 3 0 1 0 4.24 4.24' }),
    createElement('path', { d: 'M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68' }),
    createElement('path', { d: 'M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61' }),
    createElement('line', { x1: 2, y1: 2, x2: 22, y2: 22 })
  );

const ExternalLinkIcon = ({ size = 16 }: { size?: number }) =>
  createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    createElement('path', { d: 'M15 3h6v6' }), createElement('path', { d: 'M10 14 21 3' }),
    createElement('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' })
  );

const ChevronDownIcon = ({ size = 16 }: { size?: number }) =>
  createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    createElement('polyline', { points: '6 9 12 15 18 9' })
  );

// ── Utility Functions ─────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Common Styles ─────────────────────────────────────────────────────────

const s = {
  flex: { display: 'flex' } as const,
  flexCol: { display: 'flex', flexDirection: 'column' as const },
  flexCenter: { display: 'flex', alignItems: 'center' } as const,
  flexBetween: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as const,
  flexGrow: { flex: 1 } as const,
  gap4: { gap: '4px' } as const,
  gap8: { gap: '8px' } as const,
  gap12: { gap: '12px' } as const,
  gap16: { gap: '16px' } as const,
  p4: { padding: '16px' } as const,
  p6: { padding: '24px' } as const,
  p8: { padding: '8px' } as const,
  p12: { padding: '12px' } as const,
  px12: { paddingLeft: '12px', paddingRight: '12px' } as const,
  py4: { paddingTop: '4px', paddingBottom: '4px' } as const,
  py8: { paddingTop: '8px', paddingBottom: '8px' } as const,
  rounded: { borderRadius: '6px' } as const,
  roundedSm: { borderRadius: '4px' } as const,
  text: { color: 'var(--xp-text)', fontFamily: 'inherit' } as const,
  textMuted: { color: 'var(--xp-text-muted)' } as const,
  textSm: { fontSize: '13px' } as const,
  textXs: { fontSize: '12px' } as const,
  bg: { backgroundColor: 'var(--xp-bg)' } as const,
  bgSurface: { backgroundColor: 'var(--xp-surface)' } as const,
  bgSurfaceLight: { backgroundColor: 'var(--xp-surface-light)' } as const,
  border: { border: '1px solid var(--xp-border)' } as const,
  borderBottom: { borderBottom: '1px solid var(--xp-border)' } as const,
  overflowAuto: { overflow: 'auto' } as const,
  truncate: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } as const,
  btn: {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--xp-text)',
    padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit',
  } as const,
  btnPrimary: {
    backgroundColor: 'var(--xp-blue)', color: '#fff', border: 'none', cursor: 'pointer',
    padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit',
  } as const,
  btnDanger: {
    backgroundColor: 'var(--xp-red)', color: '#fff', border: 'none', cursor: 'pointer',
    padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit',
  } as const,
  input: {
    width: '100%', padding: '8px 12px', backgroundColor: 'var(--xp-bg)',
    border: '1px solid var(--xp-border)', borderRadius: '6px', fontSize: '13px',
    color: 'var(--xp-text)', fontFamily: 'inherit', outline: 'none',
  } as const,
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px',
  } as const,
  card: {
    backgroundColor: 'var(--xp-surface)', border: '1px solid var(--xp-border)',
    borderRadius: '8px', padding: '16px',
  } as const,
};

// ── GDrive File Browser Component ─────────────────────────────────────────

function GDriveFileBrowser({ accountId, path, onNavigate }: {
  accountId: string;
  path?: string;
  onNavigate?: (path: string, name: string) => void;
}) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folderId, setFolderId] = useState('root');
  const [breadcrumb, setBreadcrumb] = useState<Array<{ id: string; name: string }>>([{ id: 'root', name: 'My Drive' }]);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const loadFiles = useCallback(async (fId: string) => {
    setLoading(true);
    setError(null);
    try {
      // Show cached files immediately
      const cacheKey = `${accountId}:${fId}`;
      const cached = FILE_CACHE.get(cacheKey);
      if (cached) setFiles(cached.files);

      const result = await api.gdrive.listFiles(accountId, fId);
      setFiles(result);
      FILE_CACHE.set(cacheKey, { files: result, timestamp: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { loadFiles(folderId); }, [folderId, loadFiles]);

  const navigateToFolder = (file: FileEntry) => {
    if (!file.is_dir) return;
    const fileId = file.path.split('/').pop() || file.path;
    setBreadcrumb(prev => [...prev, { id: fileId, name: file.name }]);
    setFolderId(fileId);
  };

  const navigateBreadcrumb = (index: number) => {
    setBreadcrumb(prev => prev.slice(0, index + 1));
    setFolderId(breadcrumb[index].id);
  };

  const handleDownload = async (file: FileEntry) => {
    try {
      const fileId = file.path.split('/').pop() || file.path;
      const savePath = await api.dialog.pickSaveFile(file.name);
      if (!savePath) return;
      await api.gdrive.downloadFile(accountId, fileId, savePath);
      api.ui.showMessage(`Downloaded: ${file.name}`);
    } catch (err) {
      api.ui.showMessage(`Download failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handleUpload = async () => {
    try {
      const files = await api.dialog.pickFile({ multiple: false });
      if (!files || files.length === 0) return;
      await api.gdrive.uploadFile(accountId, files[0], folderId);
      api.ui.showMessage('File uploaded successfully');
      loadFiles(folderId);
    } catch (err) {
      api.ui.showMessage(`Upload failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handleDelete = async (file: FileEntry) => {
    if (!confirm(`Delete "${file.name}"?`)) return;
    try {
      const fileId = file.path.split('/').pop() || file.path;
      await api.gdrive.deleteFile(accountId, fileId);
      api.ui.showMessage(`Deleted: ${file.name}`);
      loadFiles(folderId);
    } catch (err) {
      api.ui.showMessage(`Delete failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handleRename = async (file: FileEntry) => {
    const newName = prompt('New name:', file.name);
    if (!newName || newName === file.name) return;
    try {
      const fileId = file.path.split('/').pop() || file.path;
      await api.gdrive.renameFile(accountId, fileId, newName);
      api.ui.showMessage(`Renamed to: ${newName}`);
      loadFiles(folderId);
    } catch (err) {
      api.ui.showMessage(`Rename failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handleNewFolder = async () => {
    const name = prompt('Folder name:');
    if (!name) return;
    try {
      await api.gdrive.createFolder(accountId, name, folderId);
      api.ui.showMessage(`Created folder: ${name}`);
      loadFiles(folderId);
    } catch (err) {
      api.ui.showMessage(`Failed to create folder: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    // Folders first
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;
    let cmp = 0;
    if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortBy === 'size') cmp = (a.size || 0) - (b.size || 0);
    else if (sortBy === 'modified') cmp = (a.modified || 0) - (b.modified || 0);
    return sortAsc ? cmp : -cmp;
  });

  return createElement('div', { style: { ...s.flexCol, height: '100%' } },
    // Toolbar
    createElement('div', { style: { ...s.flexBetween, ...s.p8, ...s.borderBottom, ...s.bgSurface, gap: '8px', flexShrink: 0 } },
      // Breadcrumb
      createElement('div', { style: { ...s.flexCenter, ...s.gap4, ...s.flexGrow, overflow: 'hidden' } },
        breadcrumb.map((crumb, i) =>
          createElement('span', { key: crumb.id, style: s.flexCenter },
            i > 0 && createElement(ChevronRightIcon, { size: 12 }),
            createElement('button', {
              onClick: () => navigateBreadcrumb(i),
              style: { ...s.btn, ...s.textXs, fontWeight: i === breadcrumb.length - 1 ? 600 : 400, color: i === breadcrumb.length - 1 ? 'var(--xp-text)' : 'var(--xp-text-muted)' },
            }, crumb.name)
          )
        )
      ),
      // Actions
      createElement('div', { style: { ...s.flexCenter, ...s.gap4, flexShrink: 0 } },
        createElement('button', { onClick: () => loadFiles(folderId), style: s.btn, title: 'Refresh' }, createElement(RefreshIcon, { size: 14 })),
        createElement('button', { onClick: handleNewFolder, style: s.btn, title: 'New Folder' }, createElement(FolderIcon, { size: 14 })),
        createElement('button', { onClick: handleUpload, style: s.btn, title: 'Upload' }, createElement(UploadIcon, { size: 14 })),
      ),
    ),
    // Content
    createElement('div', { style: { ...s.flexGrow, ...s.overflowAuto } },
      error
        ? createElement('div', { style: { ...s.p4, color: 'var(--xp-red)', ...s.textSm } }, `Error: ${error}`)
        : loading && files.length === 0
          ? createElement('div', { style: { ...s.p4, ...s.textMuted, ...s.textSm } }, 'Loading...')
          : sortedFiles.length === 0
            ? createElement('div', { style: { ...s.p4, ...s.textMuted, ...s.textSm } }, 'This folder is empty')
            : createElement('div', { style: { padding: '4px' } },
                sortedFiles.map(file =>
                  createElement('div', {
                    key: file.path,
                    style: { ...s.flexBetween, padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', gap: '8px' },
                    onMouseEnter: (e: any) => { e.currentTarget.style.backgroundColor = 'var(--xp-surface-light)'; },
                    onMouseLeave: (e: any) => { e.currentTarget.style.backgroundColor = ''; },
                    onDoubleClick: () => file.is_dir ? navigateToFolder(file) : handleDownload(file),
                  },
                    createElement('div', { style: { ...s.flexCenter, ...s.gap8, ...s.flexGrow, minWidth: 0 } },
                      file.is_dir ? createElement(FolderIcon, { size: 16 }) : createElement(FileIcon, { size: 16 }),
                      createElement('span', { style: { ...s.textSm, ...s.truncate } }, file.name),
                    ),
                    createElement('div', { style: { ...s.flexCenter, ...s.gap12, flexShrink: 0 } },
                      !file.is_dir && createElement('span', { style: { ...s.textXs, ...s.textMuted } }, formatFileSize(file.size || 0)),
                      file.modified > 0 && createElement('span', { style: { ...s.textXs, ...s.textMuted, minWidth: '80px' } }, formatDate(file.modified)),
                      createElement('div', { style: { ...s.flexCenter, ...s.gap4 } },
                        !file.is_dir && createElement('button', { onClick: (e: any) => { e.stopPropagation(); handleDownload(file); }, style: s.btn, title: 'Download' }, createElement(DownloadIcon, { size: 13 })),
                        createElement('button', { onClick: (e: any) => { e.stopPropagation(); handleRename(file); }, style: s.btn, title: 'Rename' }, createElement(PencilIcon, { size: 13 })),
                        createElement('button', { onClick: (e: any) => { e.stopPropagation(); handleDelete(file); }, style: { ...s.btn, color: 'var(--xp-red)' }, title: 'Delete' }, createElement(TrashIcon, { size: 13 })),
                      ),
                    ),
                  )
                )
              ),
    ),
  );
}

// ── GDrive Accounts Page Component ────────────────────────────────────────

function GDriveAccountsPage() {
  const [accounts, setAccounts] = useState<GoogleDriveAccount[]>([]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [credentialsConfigured, setCredentialsConfigured] = useState(false);
  const [credentialsSaving, setCredentialsSaving] = useState(false);
  const [showSetup, setShowSetup] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const settings = await api.gdrive.getSettings();
        if (settings.client_id) {
          setClientId(settings.client_id);
          setClientSecret(settings.client_secret);
          setCredentialsConfigured(true);
          setShowSetup(false);
        }
      } catch { /* Not configured */ }
    })();
  }, []);

  const loadAccts = useCallback(() => {
    setAccounts(Array.from(ACCOUNTS.values()));
  }, []);

  useEffect(() => { loadAccts(); }, [loadAccts]);
  useEffect(() => {
    const handler = () => loadAccts();
    window.addEventListener('gdrive-accounts-changed', handler);
    return () => window.removeEventListener('gdrive-accounts-changed', handler);
  }, [loadAccts]);

  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      api.ui.showMessage('Both Client ID and Client Secret are required.', 'warning');
      return;
    }
    setCredentialsSaving(true);
    try {
      await api.gdrive.updateSettings(clientId.trim(), clientSecret.trim());
      setCredentialsConfigured(true);
      api.ui.showMessage('Google Drive API credentials saved.');
    } catch (err) {
      api.ui.showMessage(`Failed to save credentials: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setCredentialsSaving(false);
    }
  };

  const handleAddAccount = async () => {
    if (!credentialsConfigured) {
      api.ui.showMessage('Please configure your Google API credentials first.', 'warning');
      setShowSetup(true);
      return;
    }
    setIsAuthenticating(true);
    try {
      const result = await api.gdrive.authenticate();
      ACCOUNTS.set(result.id, { id: result.id, email: result.email, displayName: result.display_name, isConnected: true });
      saveAccounts();
      loadAccts();
      window.dispatchEvent(new CustomEvent('gdrive-accounts-changed'));
      api.ui.showMessage('Google Drive account connected.');
    } catch (err) {
      api.ui.showMessage(`Authentication failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleDisconnect = async (account: GoogleDriveAccount) => {
    try {
      await api.gdrive.disconnect(account.id);
      ACCOUNTS.delete(account.id);
      saveAccounts();
      loadAccts();
      window.dispatchEvent(new CustomEvent('gdrive-accounts-changed'));
      api.ui.showMessage(`Disconnected from ${account.email}.`);
    } catch (err) {
      api.ui.showMessage(`Disconnect failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handleRemoveAccount = (account: GoogleDriveAccount) => {
    if (!confirm(`Remove "${account.email}"?`)) return;
    ACCOUNTS.delete(account.id);
    saveAccounts();
    loadAccts();
    window.dispatchEvent(new CustomEvent('gdrive-accounts-changed'));
    api.ui.showMessage(`Removed ${account.email}.`);
  };

  const openInExplorer = (account: GoogleDriveAccount) => {
    api.navigation.openTab({
      type: 'gdrive',
      name: account.email,
      path: `gdrive://${account.id}`,
      data: { accountId: account.id, folderId: 'root', folderName: 'My Drive' },
    });
  };

  return createElement('div', { style: { ...s.flexCol, height: '100%', ...s.bg } },
    // Header
    createElement('div', { style: { ...s.flexBetween, ...s.p6, ...s.borderBottom, ...s.bgSurface } },
      createElement('div', null,
        createElement('h1', { style: { fontSize: '18px', fontWeight: 600, color: 'var(--xp-text)', margin: 0 } }, 'Google Drive'),
        createElement('p', { style: { ...s.textSm, ...s.textMuted, margin: '4px 0 0' } }, 'Configure API credentials and manage connected accounts'),
      ),
      createElement('button', {
        onClick: handleAddAccount,
        disabled: isAuthenticating || !credentialsConfigured,
        style: { ...s.btnPrimary, opacity: (isAuthenticating || !credentialsConfigured) ? 0.5 : 1, ...s.flexCenter, ...s.gap8 },
      },
        isAuthenticating
          ? createElement('span', null, 'Connecting...')
          : createElement('span', { style: s.flexCenter }, createElement(PlusIcon, { size: 14 }), ' Add Account'),
      ),
    ),
    // Content
    createElement('div', { style: { ...s.flexGrow, ...s.overflowAuto } },
      // Credentials section
      createElement('div', { style: { ...s.p6, ...s.borderBottom } },
        createElement('button', {
          onClick: () => setShowSetup(!showSetup),
          style: { ...s.btn, ...s.flexCenter, ...s.gap8, width: '100%', textAlign: 'left' as const, padding: 0 },
        },
          showSetup ? createElement(ChevronDownIcon, { size: 14 }) : createElement(ChevronRightIcon, { size: 14 }),
          createElement('span', { style: { fontWeight: 600, ...s.textSm } }, 'API Credentials'),
          credentialsConfigured
            ? createElement('span', { style: { fontSize: '11px', color: 'var(--xp-green)' } }, ' Configured')
            : createElement('span', { style: { fontSize: '11px', color: 'var(--xp-yellow)' } }, ' Not configured'),
        ),
        showSetup && createElement('div', { style: { marginTop: '16px' } },
          // Setup guide
          createElement('div', { style: { ...s.card, marginBottom: '16px' } },
            createElement('h3', { style: { ...s.textSm, fontWeight: 500, marginBottom: '12px', color: 'var(--xp-text)' } }, 'Setup Guide'),
            createElement('ol', { style: { ...s.textSm, ...s.textMuted, paddingLeft: '20px', margin: 0 } },
              createElement('li', { style: { marginBottom: '4px' } }, 'Go to the Google Cloud Console'),
              createElement('li', { style: { marginBottom: '4px' } }, 'Create or select a project'),
              createElement('li', { style: { marginBottom: '4px' } }, 'Enable the Google Drive API'),
              createElement('li', { style: { marginBottom: '4px' } }, 'Create OAuth 2.0 Client ID (Desktop app)'),
              createElement('li', null, 'Copy Client ID & Secret below'),
            ),
          ),
          // Inputs
          createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: '12px' } },
            createElement('div', null,
              createElement('label', { style: { ...s.textSm, fontWeight: 500, color: 'var(--xp-text)', display: 'block', marginBottom: '4px' } }, 'Client ID'),
              createElement('input', { type: 'text', value: clientId, onChange: (e: any) => setClientId(e.target.value), placeholder: 'xxxxxxxxxxxx.apps.googleusercontent.com', style: s.input }),
            ),
            createElement('div', null,
              createElement('label', { style: { ...s.textSm, fontWeight: 500, color: 'var(--xp-text)', display: 'block', marginBottom: '4px' } }, 'Client Secret'),
              createElement('div', { style: { position: 'relative' as const } },
                createElement('input', { type: showSecret ? 'text' : 'password', value: clientSecret, onChange: (e: any) => setClientSecret(e.target.value), placeholder: 'GOCSPX-...', style: { ...s.input, paddingRight: '70px' } }),
                createElement('button', {
                  onClick: () => setShowSecret(!showSecret),
                  style: { ...s.btn, position: 'absolute' as const, right: '4px', top: '50%', transform: 'translateY(-50%)', ...s.textXs, ...s.flexCenter, ...s.gap4 },
                }, showSecret ? createElement(EyeOffIcon, { size: 14 }) : createElement(EyeIcon, { size: 14 }), showSecret ? 'Hide' : 'Show'),
              ),
            ),
            createElement('button', {
              onClick: handleSaveCredentials,
              disabled: credentialsSaving || !clientId.trim() || !clientSecret.trim(),
              style: { ...s.btnPrimary, opacity: (credentialsSaving || !clientId.trim() || !clientSecret.trim()) ? 0.5 : 1, alignSelf: 'flex-start' },
            }, credentialsSaving ? 'Saving...' : 'Save Credentials'),
          ),
        ),
      ),
      // Accounts
      !credentialsConfigured
        ? createElement('div', { style: { ...s.p6, textAlign: 'center' as const, ...s.textMuted } },
            createElement(CloudIcon, { size: 48 }),
            createElement('h3', { style: { fontSize: '16px', fontWeight: 500, color: 'var(--xp-text)', margin: '12px 0 8px' } }, 'Configure API credentials first'),
            createElement('p', { style: s.textSm }, 'Set up your Google Cloud OAuth credentials above to start connecting accounts.'),
          )
        : accounts.length === 0
          ? createElement('div', { style: { ...s.p6, textAlign: 'center' as const, ...s.textMuted } },
              createElement(CloudIcon, { size: 48 }),
              createElement('h3', { style: { fontSize: '16px', fontWeight: 500, color: 'var(--xp-text)', margin: '12px 0 8px' } }, 'Connect your Google Drive'),
              createElement('p', { style: { ...s.textSm, marginBottom: '16px' } }, 'Sign in with your Google account to browse Drive files.'),
              createElement('button', { onClick: handleAddAccount, disabled: isAuthenticating, style: { ...s.btnPrimary, opacity: isAuthenticating ? 0.5 : 1 } }, isAuthenticating ? 'Connecting...' : 'Sign in with Google'),
            )
          : createElement('div', { style: s.p6 },
              createElement('div', { style: s.grid },
                accounts.map(account =>
                  createElement('div', { key: account.id, style: s.card },
                    createElement('div', { style: { ...s.flexBetween, marginBottom: '12px' } },
                      createElement('div', { style: { ...s.flexCenter, ...s.gap8, minWidth: 0 } },
                        createElement(CloudIcon, { size: 18 }),
                        createElement('span', { style: { fontWeight: 500, ...s.truncate, color: 'var(--xp-text)' } }, account.email),
                      ),
                      createElement('button', { onClick: () => handleRemoveAccount(account), style: { ...s.btn, color: 'var(--xp-text-muted)' }, title: 'Remove' }, createElement(TrashIcon, { size: 14 })),
                    ),
                    account.displayName && createElement('div', { style: { ...s.textSm, ...s.textMuted, marginBottom: '4px' } }, account.displayName),
                    createElement('div', { style: { ...s.flexCenter, ...s.gap8, marginTop: '12px' } },
                      createElement('button', {
                        onClick: () => openInExplorer(account),
                        style: { ...s.btnPrimary, ...s.flexCenter, ...s.gap4, flex: 1, justifyContent: 'center' },
                      }, createElement(ExternalLinkIcon, { size: 14 }), 'Open'),
                      createElement('button', { onClick: () => handleDisconnect(account), style: s.btnDanger }, 'Disconnect'),
                    ),
                  )
                ),
              ),
            ),
    ),
  );
}

// ── Extension Registration ────────────────────────────────────────────────

// Register Tab for GDrive file browser
Tab.register({
  id: 'gdrive',
  title: 'Google Drive',
  icon: 'cloud',
  urlScheme: 'gdrive://',
  permissions: ['gdrive:access', 'file:read', 'file:write', 'ui:panels'],
  render: (props) => {
    const data = props.tabData as { accountId?: string; folderId?: string } | undefined;
    const accountId = data?.accountId || '';
    if (!accountId) return createElement('div', { style: { ...s.p4, ...s.textMuted } }, 'No Google Drive account specified.');
    return createElement(GDriveFileBrowser, { accountId, path: props.path, onNavigate: props.onNavigate });
  },
  onActivate: (xplorerApi) => {
    api = xplorerApi;
    loadAccounts();
    syncAccounts();
  },
});

// Register Tab for GDrive accounts management
Tab.register({
  id: 'gdrive-manager',
  title: 'Google Drive Settings',
  icon: 'cloud',
  permissions: ['gdrive:access', 'ui:panels'],
  render: () => {
    return createElement(GDriveAccountsPage);
  },
  onActivate: (xplorerApi) => {
    api = xplorerApi;
  },
});

// Register Navigation for sidebar
Navigation.register({
  id: 'gdrive-nav',
  section: 'GOOGLE DRIVE',
  icon: 'cloud',
  permissions: ['gdrive:access', 'ui:panels'],
  updateEvent: 'gdrive-accounts-changed',
  getEntries: async (xplorerApi) => {
    api = xplorerApi;
    try {
      const backendAccounts = await api.gdrive.listAccounts();
      return backendAccounts.map(account => ({
        id: `gdrive-${account.id}`,
        label: account.display_name || account.email,
        action: () => {
          api.navigation.openTab({
            type: 'gdrive',
            name: account.display_name || account.email,
            path: `gdrive://${account.id}`,
            data: { accountId: account.id, folderId: 'root', folderName: 'My Drive' },
          });
        },
      }));
    } catch {
      return [];
    }
  },
  onManage: async (xplorerApi) => {
    xplorerApi.navigation.openTab({
      type: 'gdrive-manager',
      name: 'Google Drive Settings',
      path: 'xplorer://gdrive-manager',
    });
  },
});

// Register context menu command for quick access
Command.register({
  id: 'gdrive-open-manager',
  title: 'Google Drive: Manage Accounts',
  permissions: ['gdrive:access', 'ui:panels'],
  action: async (xplorerApi) => {
    xplorerApi.navigation.openTab({
      type: 'gdrive-manager',
      name: 'Google Drive Settings',
      path: 'xplorer://gdrive-manager',
    });
  },
});
