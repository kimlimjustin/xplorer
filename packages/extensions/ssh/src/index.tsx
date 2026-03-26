/**
 * SSH Manager Extension for Xplorer
 *
 * Provides SSH connection management and SFTP file browsing via a native plugin.
 * All SSH operations go through api.nativeInvoke() which calls the compiled
 * ssh-plugin shared library (.dll/.so/.dylib).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, type XplorerAPI } from '@xplorer/extension-sdk';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  keyPath?: string;
  password?: string;
  isConnected: boolean;
  lastConnected?: string;
  backendConnectionId?: string;
}

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  file_type: string;
  mime_type?: string;
}

interface SSHConnectionResult {
  success: boolean;
  message: string;
  output: string;
  connection_id?: string;
  error_type?: Record<string, string>;
  retry_suggested: boolean;
}

// ExtensionAPI alias for backward compat within this file
type ExtensionAPI = XplorerAPI;

// ─── Utility Functions ─────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getFileIcon(file: FileEntry): string {
  if (file.is_dir) return '\u{1F4C1}';
  const ext = file.file_type.toLowerCase();
  const icons: Record<string, string> = {
    js: '\u{1F7E8}', ts: '\u{1F535}', py: '\u{1F40D}', rs: '\u{1F9E0}',
    json: '{}', md: '\u{1F4DD}', txt: '\u{1F4C4}', html: '\u{1F310}',
    css: '\u{1F3A8}', sh: '$_', yml: '\u{2699}', yaml: '\u{2699}',
    toml: '\u{2699}', xml: '</>',
    jpg: '\u{1F5BC}', jpeg: '\u{1F5BC}', png: '\u{1F5BC}', gif: '\u{1F5BC}', svg: '\u{1F5BC}',
    zip: '\u{1F4E6}', tar: '\u{1F4E6}', gz: '\u{1F4E6}',
    pdf: '\u{1F4D5}', doc: '\u{1F4D8}', docx: '\u{1F4D8}',
  };
  return icons[ext] || '\u{1F4C4}';
}

// ─── Password Prompt Component ─────────────────────────────────────────────────

function PasswordPrompt({
  isOpen,
  onSubmit,
  onCancel,
  connectionName
}: {
  isOpen: boolean;
  onSubmit: (password: string, remember: boolean) => void;
  onCancel: () => void;
  connectionName: string;
}) {
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e: React.MouseEvent) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          backgroundColor: '#1a1b26', border: '1px solid #3b3d57',
          borderRadius: 8, padding: 24, width: 400,
          color: '#a9b1d6', fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h3 style={{ margin: '0 0 8px', color: '#c0caf5', fontSize: 16 }}>Password Required</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.7 }}>{`Enter password for ${connectionName}`}</p>
        <input
          type="password"
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' && password) onSubmit(password, remember); }}
          placeholder="Password"
          autoFocus={true}
          style={{
            width: '100%', padding: '8px 12px', backgroundColor: '#24283b',
            border: '1px solid #3b3d57', borderRadius: 6, color: '#c0caf5',
            fontSize: 14, outline: 'none', boxSizing: 'border-box' as const,
          }}
        />
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemember(e.target.checked)}
          />
          Remember password
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 16px', backgroundColor: '#24283b', border: '1px solid #3b3d57',
              borderRadius: 6, color: '#a9b1d6', cursor: 'pointer', fontSize: 13,
            }}
          >Cancel</button>
          <button
            onClick={() => { if (password) onSubmit(password, remember); }}
            disabled={!password}
            style={{
              padding: '6px 16px', backgroundColor: '#7aa2f7', border: 'none',
              borderRadius: 6, color: '#1a1b26', cursor: password ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 600, opacity: password ? 1 : 0.5,
            }}
          >Connect</button>
        </div>
      </div>
    </div>
  );
}

// ─── Connection Dialog Component ───────────────────────────────────────────────

function ConnectionDialog({
  isOpen,
  onClose,
  onSubmit,
  editConnection
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: { target: string; name: string; password?: string; remember: boolean }) => void;
  editConnection?: SSHConnection;
}) {
  const [target, setTarget] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (isOpen && editConnection) {
      setTarget(`${editConnection.username}@${editConnection.host}:${editConnection.port}`);
      setName(editConnection.name);
      setPassword(editConnection.password || '');
      setRemember(!!editConnection.password);
    } else if (isOpen) {
      setTarget('');
      setName('');
      setPassword('');
      setRemember(false);
    }
  }, [isOpen, editConnection]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!target.trim()) return;
    onSubmit({ target: target.trim(), name: name.trim(), password: password || undefined, remember });
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: '#1a1b26', border: '1px solid #3b3d57',
          borderRadius: 8, padding: 24, width: 440,
          color: '#a9b1d6', fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h3 style={{ margin: '0 0 16px', color: '#c0caf5', fontSize: 16 }}>
          {editConnection ? 'Edit Connection' : 'New SSH Connection'}
        </h3>
        {/* Target input */}
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>SSH Target</span>
          <input
            type="text"
            value={target}
            autoFocus={true}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTarget(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="user@hostname:22"
            style={{
              width: '100%', padding: '8px 12px', backgroundColor: '#24283b',
              border: '1px solid #3b3d57', borderRadius: 6, color: '#c0caf5',
              fontSize: 14, outline: 'none', boxSizing: 'border-box' as const,
            }}
          />
        </label>
        {/* Display name */}
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Display Name (optional)</span>
          <input
            type="text"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            placeholder="My Server"
            style={{
              width: '100%', padding: '8px 12px', backgroundColor: '#24283b',
              border: '1px solid #3b3d57', borderRadius: 6, color: '#c0caf5',
              fontSize: 14, outline: 'none', boxSizing: 'border-box' as const,
            }}
          />
        </label>
        {/* Password */}
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Password (optional)</span>
          <input
            type="password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            placeholder="Leave empty for key auth"
            style={{
              width: '100%', padding: '8px 12px', backgroundColor: '#24283b',
              border: '1px solid #3b3d57', borderRadius: 6, color: '#c0caf5',
              fontSize: 14, outline: 'none', boxSizing: 'border-box' as const,
            }}
          />
        </label>
        {/* Remember */}
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13, cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemember(e.target.checked)}
          />
          Remember password
        </label>
        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px', backgroundColor: '#24283b', border: '1px solid #3b3d57',
              borderRadius: 6, color: '#a9b1d6', cursor: 'pointer', fontSize: 13,
            }}
          >Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!target.trim()}
            style={{
              padding: '6px 16px', backgroundColor: '#7aa2f7', border: 'none',
              borderRadius: 6, color: '#1a1b26', cursor: target.trim() ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 600, opacity: target.trim() ? 1 : 0.5,
            }}
          >{editConnection ? 'Save' : 'Connect'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── SSH File Browser (Full-screen Overlay) ────────────────────────────────────

function SSHFileBrowser({
  api,
  connection,
  onClose
}: {
  api: ExtensionAPI;
  connection: SSHConnection;
  onClose: () => void;
}) {
  const [currentPath, setCurrentPath] = useState('~');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<string | null>(null);

  const sortFiles = useCallback((fileList: FileEntry[]) => {
    return [...fileList].sort((a, b) => {
      // Directories first
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      else if (sortBy === 'size') cmp = a.size - b.size;
      else if (sortBy === 'modified') cmp = a.modified - b.modified;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [sortBy, sortOrder]);

  const loadDirectory = useCallback(async (path: string, password?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.nativeInvoke('read_directory', {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        remote_path: path,
        password: password || connection.password || null,
        key_path: connection.keyPath || null,
      });
      const response = result as { ok?: FileEntry[]; error?: string };
      if (response.error) {
        if (response.error.includes('Authentication') || response.error.includes('auth')) {
          setPendingPath(path);
          setShowPasswordPrompt(true);
          setIsLoading(false);
          return;
        }
        throw new Error(response.error);
      }
      const fileList = response.ok || [];
      setFiles(sortFiles(fileList));
      setCurrentPath(path);
      setSelectedFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [api, connection, sortFiles]);

  useEffect(() => { loadDirectory('~'); }, []);

  const navigateUp = () => {
    if (currentPath === '~' || currentPath === '/') return;
    if (currentPath.startsWith('~/')) {
      const parts = currentPath.split('/');
      parts.pop();
      const parent = parts.length <= 1 ? '~' : parts.join('/');
      loadDirectory(parent);
    } else {
      const parts = currentPath.split('/');
      parts.pop();
      loadDirectory(parts.join('/') || '/');
    }
  };

  const handleDoubleClick = (file: FileEntry) => {
    if (file.is_dir) {
      loadDirectory(file.path);
    } else {
      // View file content
      viewFile(file);
    }
  };

  const viewFile = async (file: FileEntry) => {
    try {
      const result = await api.nativeInvoke('get_file_content', {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        remote_path: file.path,
        password: connection.password || null,
        key_path: connection.keyPath || null,
      });
      const response = result as { ok?: string; error?: string };
      if (response.error) throw new Error(response.error);
      setFileContent(response.ok || '');
      setViewingFile(file.name);
    } catch (err) {
      api.ui.showMessage(`Failed to read file: ${err}`, 'error');
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setFiles(prev => sortFiles(prev));
  };

  const handlePasswordSubmit = (password: string, remember: boolean) => {
    setShowPasswordPrompt(false);
    if (remember) {
      connection.password = password;
    }
    if (pendingPath) {
      loadDirectory(pendingPath, password);
      setPendingPath(null);
    }
  };

  const handleCreateFolder = async () => {
    const name = prompt('New folder name:');
    if (!name) return;
    try {
      const path = currentPath === '~' ? `~/${name}` : `${currentPath}/${name}`;
      const result = await api.nativeInvoke('create_directory', {
        host: connection.host, port: connection.port, username: connection.username,
        remote_path: path, password: connection.password || null, key_path: connection.keyPath || null,
      });
      const response = result as { ok?: unknown; error?: string };
      if (response.error) throw new Error(response.error);
      loadDirectory(currentPath);
    } catch (err) {
      api.ui.showMessage(`Failed to create folder: ${err}`, 'error');
    }
  };

  const handleDelete = async (file: FileEntry) => {
    if (!confirm(`Delete ${file.is_dir ? 'folder' : 'file'} "${file.name}"?`)) return;
    try {
      const cmd = file.is_dir ? 'delete_directory' : 'delete_file';
      const result = await api.nativeInvoke(cmd, {
        host: connection.host, port: connection.port, username: connection.username,
        remote_path: file.path, password: connection.password || null, key_path: connection.keyPath || null,
      });
      const response = result as { ok?: unknown; error?: string };
      if (response.error) throw new Error(response.error);
      loadDirectory(currentPath);
    } catch (err) {
      api.ui.showMessage(`Failed to delete: ${err}`, 'error');
    }
  };

  const handleRename = async (file: FileEntry) => {
    const newName = prompt('New name:', file.name);
    if (!newName || newName === file.name) return;
    try {
      const parentPath = file.path.substring(0, file.path.lastIndexOf('/'));
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      const result = await api.nativeInvoke('rename', {
        host: connection.host, port: connection.port, username: connection.username,
        old_path: file.path, new_path: newPath,
        password: connection.password || null, key_path: connection.keyPath || null,
      });
      const response = result as { ok?: unknown; error?: string };
      if (response.error) throw new Error(response.error);
      loadDirectory(currentPath);
    } catch (err) {
      api.ui.showMessage(`Failed to rename: ${err}`, 'error');
    }
  };

  // File content viewer overlay
  if (viewingFile && fileContent !== null) {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: '#1a1b26', display: 'flex', flexDirection: 'column' as const,
          fontFamily: 'system-ui, sans-serif', color: '#a9b1d6',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px', backgroundColor: '#16161e', borderBottom: '1px solid #3b3d57',
          }}
        >
          <span style={{ fontSize: 14, color: '#c0caf5' }}>{viewingFile}</span>
          <button
            onClick={() => { setFileContent(null); setViewingFile(null); }}
            style={{
              padding: '4px 12px', backgroundColor: '#24283b', border: '1px solid #3b3d57',
              borderRadius: 4, color: '#a9b1d6', cursor: 'pointer', fontSize: 12,
            }}
          >Close</button>
        </div>
        {/* Content */}
        <pre
          style={{
            flex: 1, margin: 0, padding: 16, overflow: 'auto',
            fontSize: 13, lineHeight: 1.6, fontFamily: "'Cascadia Code', 'Fira Code', monospace",
            whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const,
          }}
        >{fileContent}</pre>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: '#1a1b26', display: 'flex', flexDirection: 'column' as const,
        fontFamily: 'system-ui, sans-serif', color: '#a9b1d6',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', backgroundColor: '#16161e', borderBottom: '1px solid #3b3d57',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
              backgroundColor: connection.isConnected ? '#9ece6a' : '#f7768e',
            }}
          />
          <span style={{ fontWeight: 600, color: '#c0caf5', fontSize: 14 }}>{connection.name}</span>
          <span style={{ fontSize: 12, opacity: 0.6 }}>
            {`${connection.username}@${connection.host}:${connection.port}`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleCreateFolder}
            title="New Folder"
            style={{
              padding: '4px 10px', backgroundColor: '#24283b', border: '1px solid #3b3d57',
              borderRadius: 4, color: '#a9b1d6', cursor: 'pointer', fontSize: 12,
            }}
          >+ Folder</button>
          <button
            onClick={() => loadDirectory(currentPath)}
            title="Refresh"
            style={{
              padding: '4px 10px', backgroundColor: '#24283b', border: '1px solid #3b3d57',
              borderRadius: 4, color: '#a9b1d6', cursor: 'pointer', fontSize: 12,
            }}
          >{'\u{21BB}'}</button>
          <button
            onClick={onClose}
            style={{
              padding: '4px 12px', backgroundColor: '#f7768e', border: 'none',
              borderRadius: 4, color: '#1a1b26', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >Close</button>
        </div>
      </div>
      {/* Path bar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 16px', backgroundColor: '#1f2335', borderBottom: '1px solid #292e42',
        }}
      >
        <button
          onClick={navigateUp}
          disabled={currentPath === '~' || currentPath === '/'}
          style={{
            padding: '2px 8px', backgroundColor: '#24283b', border: '1px solid #3b3d57',
            borderRadius: 4, color: '#a9b1d6', cursor: 'pointer', fontSize: 14,
            opacity: (currentPath === '~' || currentPath === '/') ? 0.4 : 1,
          }}
        >{'\u{2191}'}</button>
        <code
          style={{
            flex: 1, padding: '4px 10px', backgroundColor: '#24283b', borderRadius: 4,
            fontSize: 13, color: '#7aa2f7', fontFamily: 'monospace',
          }}
        >{currentPath}</code>
      </div>
      {/* Column headers */}
      <div
        style={{
          display: 'grid', gridTemplateColumns: '1fr 100px 160px 80px',
          padding: '6px 16px', backgroundColor: '#1f2335', borderBottom: '1px solid #292e42',
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, color: '#565f89',
        }}
      >
        <span
          onClick={() => handleSort('name')}
          style={{ cursor: 'pointer', color: sortBy === 'name' ? '#7aa2f7' : undefined }}
        >{`Name ${sortBy === 'name' ? (sortOrder === 'asc' ? '\u2191' : '\u2193') : ''}`}</span>
        <span
          onClick={() => handleSort('size')}
          style={{ cursor: 'pointer', textAlign: 'right' as const, color: sortBy === 'size' ? '#7aa2f7' : undefined }}
        >{`Size ${sortBy === 'size' ? (sortOrder === 'asc' ? '\u2191' : '\u2193') : ''}`}</span>
        <span
          onClick={() => handleSort('modified')}
          style={{ cursor: 'pointer', color: sortBy === 'modified' ? '#7aa2f7' : undefined }}
        >{`Modified ${sortBy === 'modified' ? (sortOrder === 'asc' ? '\u2191' : '\u2193') : ''}`}</span>
        <span style={{ textAlign: 'right' as const }}>Actions</span>
      </div>
      {/* File list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading
          ? <div style={{ padding: 40, textAlign: 'center' as const, opacity: 0.6 }}>Loading...</div>
          : error
          ? (
            <div style={{ padding: 40, textAlign: 'center' as const }}>
              <div style={{ color: '#f7768e', marginBottom: 12 }}>{error}</div>
              <button
                onClick={() => loadDirectory(currentPath)}
                style={{
                  padding: '6px 16px', backgroundColor: '#7aa2f7', border: 'none',
                  borderRadius: 6, color: '#1a1b26', cursor: 'pointer', fontSize: 13,
                }}
              >Retry</button>
            </div>
          )
          : files.length === 0
          ? <div style={{ padding: 40, textAlign: 'center' as const, opacity: 0.5 }}>Directory is empty</div>
          : files.map((file, i) => (
            <div
              key={file.path}
              onClick={() => setSelectedFile(file.path)}
              onDoubleClick={() => handleDoubleClick(file)}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 160px 80px',
                padding: '6px 16px', fontSize: 13, cursor: 'pointer',
                backgroundColor: selectedFile === file.path ? 'rgba(122,162,247,0.15)' : (i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'),
                borderBottom: '1px solid rgba(59,61,87,0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{getFileIcon(file)}</span>
                <span
                  style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    color: file.is_dir ? '#7aa2f7' : '#c0caf5',
                  }}
                >{file.name}</span>
              </div>
              <span style={{ textAlign: 'right' as const, opacity: 0.6 }}>
                {file.is_dir ? '--' : formatFileSize(file.size)}
              </span>
              <span style={{ opacity: 0.6 }}>{formatDate(file.modified)}</span>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleRename(file); }}
                  title="Rename"
                  style={{
                    padding: '2px 6px', backgroundColor: 'transparent', border: '1px solid #3b3d57',
                    borderRadius: 3, color: '#a9b1d6', cursor: 'pointer', fontSize: 11,
                  }}
                >{'\u270F'}</button>
                <button
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDelete(file); }}
                  title="Delete"
                  style={{
                    padding: '2px 6px', backgroundColor: 'transparent', border: '1px solid #f7768e33',
                    borderRadius: 3, color: '#f7768e', cursor: 'pointer', fontSize: 11,
                  }}
                >{'\u{1F5D1}'}</button>
              </div>
            </div>
          ))
        }
      </div>
      {/* Password prompt */}
      <PasswordPrompt
        isOpen={showPasswordPrompt}
        onSubmit={handlePasswordSubmit}
        onCancel={() => { setShowPasswordPrompt(false); setPendingPath(null); }}
        connectionName={`${connection.username}@${connection.host}`}
      />
    </div>
  );
}

// ─── SSH Panel (Sidebar) ───────────────────────────────────────────────────────

function SSHPanel({ api }: { api: ExtensionAPI }) {
  const [connections, setConnections] = useState<SSHConnection[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingConnection, setEditingConnection] = useState<SSHConnection | undefined>();
  const [connectingIds, setConnectingIds] = useState<Set<string>>(new Set());
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [browsing, setBrowsing] = useState<SSHConnection | null>(null);
  const [sshAvailable, setSshAvailable] = useState<boolean | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<SSHConnection | null>(null);

  const loadConnections = useCallback(async () => {
    const saved = await api.settings.get<SSHConnection[]>('connections', []);
    setConnections(saved || []);
  }, [api]);

  const saveConnections = useCallback(async (conns: SSHConnection[]) => {
    setConnections(conns);
    await api.settings.set('connections', conns);
  }, [api]);

  useEffect(() => {
    loadConnections();
    // Check SSH availability
    (async () => {
      try {
        const result = await api.nativeInvoke('check_availability');
        const response = result as { ok?: boolean; error?: string };
        setSshAvailable(response.ok === true);
      } catch {
        setSshAvailable(false);
      }
    })();
    // Sync connection states periodically
    const interval = setInterval(syncStates, 30000);
    return () => clearInterval(interval);
  }, []);

  const syncStates = async () => {
    try {
      const result = await api.nativeInvoke('get_all_connections');
      const response = result as { ok?: Array<{ id: string; state: string }>; error?: string };
      if (!response.ok) return;
      const backendConns = response.ok;
      setConnections(prev => {
        let changed = false;
        const updated = prev.map(conn => {
          const backend = backendConns.find(b => b.id === conn.backendConnectionId);
          const isConnected = backend ? backend.state === 'Connected' : false;
          if (conn.isConnected !== isConnected) {
            changed = true;
            return { ...conn, isConnected };
          }
          return conn;
        });
        return changed ? updated : prev;
      });
    } catch { /* ignore sync errors */ }
  };

  const parseTarget = (target: string): { host: string; port: number; username: string } | null => {
    const match = target.match(/^([^@]+)@([^:]+)(?::(\d+))?$/);
    if (!match) return null;
    return { username: match[1], host: match[2], port: parseInt(match[3] || '22', 10) };
  };

  const handleSaveConnection = async (values: { target: string; name: string; password?: string; remember: boolean }) => {
    const parsed = parseTarget(values.target);
    if (!parsed) {
      api.ui.showMessage('Invalid SSH target. Use format: user@host:port', 'error');
      return;
    }

    const id = editingConnection?.id || `ssh-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const conn: SSHConnection = {
      id,
      name: values.name || `${parsed.username}@${parsed.host}`,
      host: parsed.host,
      port: parsed.port,
      username: parsed.username,
      password: values.remember ? values.password : undefined,
      isConnected: false,
    };

    // Try to connect immediately
    setShowDialog(false);
    setEditingConnection(undefined);
    setConnectingIds(prev => new Set(prev).add(id));

    try {
      const result = await api.nativeInvoke('connect', {
        host: conn.host,
        port: conn.port,
        username: conn.username,
        password: values.password || null,
        key_path: conn.keyPath || null,
        timeout: 10,
      });
      const response = result as { ok?: SSHConnectionResult; error?: string };
      const connResult = response.ok;
      if (connResult?.success) {
        conn.isConnected = true;
        conn.backendConnectionId = connResult.connection_id;
        conn.lastConnected = new Date().toISOString();
        api.ui.showMessage(`Connected to ${conn.name}`, 'info');
      } else {
        api.ui.showMessage(`Connection failed: ${connResult?.message || response.error}`, 'error');
      }
    } catch (err) {
      api.ui.showMessage(`Connection error: ${err}`, 'error');
    } finally {
      setConnectingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }

    // Save connection
    const existing = connections.findIndex(c => c.id === id);
    let updated: SSHConnection[];
    if (existing >= 0) {
      updated = [...connections];
      updated[existing] = conn;
    } else {
      updated = [...connections, conn];
    }
    await saveConnections(updated);
  };

  const handleConnect = async (conn: SSHConnection) => {
    if (!conn.password && !conn.keyPath) {
      setPendingConnection(conn);
      setShowPasswordPrompt(true);
      return;
    }

    setConnectingIds(prev => new Set(prev).add(conn.id));
    try {
      const result = await api.nativeInvoke('connect', {
        host: conn.host, port: conn.port, username: conn.username,
        password: conn.password || null, key_path: conn.keyPath || null, timeout: 10,
      });
      const response = result as { ok?: SSHConnectionResult; error?: string };
      const connResult = response.ok;
      if (connResult?.success) {
        const updated = connections.map(c =>
          c.id === conn.id ? { ...c, isConnected: true, backendConnectionId: connResult.connection_id, lastConnected: new Date().toISOString() } : c
        );
        await saveConnections(updated);
        api.ui.showMessage(`Connected to ${conn.name}`, 'info');
      } else {
        api.ui.showMessage(`Connection failed: ${connResult?.message || response.error}`, 'error');
      }
    } catch (err) {
      api.ui.showMessage(`Connection error: ${err}`, 'error');
    } finally {
      setConnectingIds(prev => { const s = new Set(prev); s.delete(conn.id); return s; });
    }
  };

  const handlePasswordConnect = async (password: string, remember: boolean) => {
    setShowPasswordPrompt(false);
    if (!pendingConnection) return;
    const conn = pendingConnection;
    setPendingConnection(null);

    if (remember) {
      conn.password = password;
    }

    setConnectingIds(prev => new Set(prev).add(conn.id));
    try {
      const result = await api.nativeInvoke('connect', {
        host: conn.host, port: conn.port, username: conn.username,
        password, key_path: conn.keyPath || null, timeout: 10,
      });
      const response = result as { ok?: SSHConnectionResult; error?: string };
      const connResult = response.ok;
      if (connResult?.success) {
        const updated = connections.map(c =>
          c.id === conn.id ? {
            ...c, isConnected: true,
            backendConnectionId: connResult.connection_id,
            lastConnected: new Date().toISOString(),
            password: remember ? password : c.password,
          } : c
        );
        await saveConnections(updated);
        api.ui.showMessage(`Connected to ${conn.name}`, 'info');
      } else {
        api.ui.showMessage(`Connection failed: ${connResult?.message || response.error}`, 'error');
      }
    } catch (err) {
      api.ui.showMessage(`Connection error: ${err}`, 'error');
    } finally {
      setConnectingIds(prev => { const s = new Set(prev); s.delete(conn.id); return s; });
    }
  };

  const handleDisconnect = async (conn: SSHConnection) => {
    try {
      if (conn.backendConnectionId) {
        await api.nativeInvoke('disconnect', { connection_id: conn.backendConnectionId });
      }
      const updated = connections.map(c =>
        c.id === conn.id ? { ...c, isConnected: false } : c
      );
      await saveConnections(updated);
      api.ui.showMessage(`Disconnected from ${conn.name}`, 'info');
    } catch (err) {
      api.ui.showMessage(`Disconnect error: ${err}`, 'error');
    }
  };

  const handleTest = async (conn: SSHConnection) => {
    setTestingIds(prev => new Set(prev).add(conn.id));
    try {
      const result = await api.nativeInvoke('test_connection', {
        host: conn.host, port: conn.port, timeout: 10,
      });
      const response = result as { ok?: SSHConnectionResult; error?: string };
      const testResult = response.ok;
      if (testResult?.success) {
        api.ui.showMessage(`${conn.name}: SSH server reachable`, 'info');
      } else {
        api.ui.showMessage(`${conn.name}: ${testResult?.message || 'unreachable'}`, 'error');
      }
    } catch (err) {
      api.ui.showMessage(`Test failed: ${err}`, 'error');
    } finally {
      setTestingIds(prev => { const s = new Set(prev); s.delete(conn.id); return s; });
    }
  };

  const handleDelete = async (conn: SSHConnection) => {
    if (!confirm(`Remove connection "${conn.name}"?`)) return;
    if (conn.isConnected && conn.backendConnectionId) {
      await api.nativeInvoke('disconnect', { connection_id: conn.backendConnectionId }).catch(() => {});
    }
    const updated = connections.filter(c => c.id !== conn.id);
    await saveConnections(updated);
  };

  const handleBrowse = (conn: SSHConnection) => {
    setBrowsing(conn);
  };

  // File browser overlay
  if (browsing) {
    return (
      <SSHFileBrowser
        api={api}
        connection={browsing}
        onClose={() => setBrowsing(null)}
      />
    );
  }

  return (
    <div
      style={{
        padding: 12, fontFamily: 'system-ui, sans-serif', color: '#a9b1d6',
        height: '100%', display: 'flex', flexDirection: 'column' as const,
      }}
    >
      {/* Header */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}
      >
        <h3 style={{ margin: 0, fontSize: 14, color: '#c0caf5' }}>SSH Connections</h3>
        <button
          onClick={() => { setEditingConnection(undefined); setShowDialog(true); }}
          disabled={sshAvailable === false}
          style={{
            padding: '4px 10px', backgroundColor: '#7aa2f7', border: 'none',
            borderRadius: 4, color: '#1a1b26', cursor: sshAvailable === false ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 600, opacity: sshAvailable === false ? 0.4 : 1,
          }}
        >+ New</button>
      </div>
      {/* SSH unavailable warning */}
      {sshAvailable === false && (
        <div
          style={{
            padding: 8, backgroundColor: '#f7768e22', border: '1px solid #f7768e44',
            borderRadius: 6, fontSize: 12, marginBottom: 8, color: '#f7768e',
          }}
        >SSH client not found. Install OpenSSH to use this extension.</div>
      )}
      {/* Connection list */}
      {connections.length === 0
        ? (
          <div
            style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>{'\u{1F5A5}'}</div>
            <div style={{ fontSize: 13 }}>No SSH connections</div>
            <button
              onClick={() => setShowDialog(true)}
              disabled={sshAvailable === false}
              style={{
                marginTop: 12, padding: '6px 16px', backgroundColor: '#24283b',
                border: '1px solid #3b3d57', borderRadius: 6, color: '#a9b1d6',
                cursor: 'pointer', fontSize: 12,
              }}
            >Add Connection</button>
          </div>
        )
        : (
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            {connections.map(conn => (
              <div
                key={conn.id}
                style={{
                  padding: 10, backgroundColor: '#24283b', borderRadius: 6,
                  border: '1px solid #3b3d57',
                }}
              >
                {/* Connection info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: conn.isConnected ? '#9ece6a' : '#565f89',
                    }}
                  />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div
                      style={{ fontSize: 13, fontWeight: 600, color: '#c0caf5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}
                    >{conn.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>
                      {`${conn.username}@${conn.host}:${conn.port}`}
                    </div>
                  </div>
                </div>
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                  {/* Test button */}
                  <button
                    onClick={() => handleTest(conn)}
                    disabled={testingIds.has(conn.id)}
                    title="Test Connection"
                    style={{
                      padding: '3px 8px', backgroundColor: 'transparent', border: '1px solid #3b3d57',
                      borderRadius: 4, color: '#a9b1d6', cursor: 'pointer', fontSize: 11,
                      opacity: testingIds.has(conn.id) ? 0.5 : 1,
                    }}
                  >{testingIds.has(conn.id) ? '...' : '\u{1F50D}'}</button>
                  {/* Edit button */}
                  <button
                    onClick={() => { setEditingConnection(conn); setShowDialog(true); }}
                    title="Edit"
                    style={{
                      padding: '3px 8px', backgroundColor: 'transparent', border: '1px solid #3b3d57',
                      borderRadius: 4, color: '#a9b1d6', cursor: 'pointer', fontSize: 11,
                    }}
                  >{'\u270F'}</button>
                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(conn)}
                    title="Delete"
                    style={{
                      padding: '3px 8px', backgroundColor: 'transparent', border: '1px solid #f7768e33',
                      borderRadius: 4, color: '#f7768e', cursor: 'pointer', fontSize: 11,
                    }}
                  >{'\u{1F5D1}'}</button>
                  {/* Spacer */}
                  <div style={{ flex: 1 }} />
                  {/* Browse button (only when connected) */}
                  {conn.isConnected && (
                    <button
                      onClick={() => handleBrowse(conn)}
                      title="Browse Files"
                      style={{
                        padding: '3px 10px', backgroundColor: '#9ece6a22', border: '1px solid #9ece6a44',
                        borderRadius: 4, color: '#9ece6a', cursor: 'pointer', fontSize: 11,
                      }}
                    >{'\u{1F4C2} Browse'}</button>
                  )}
                  {/* Connect/Disconnect button */}
                  <button
                    onClick={() => conn.isConnected ? handleDisconnect(conn) : handleConnect(conn)}
                    disabled={connectingIds.has(conn.id)}
                    style={{
                      padding: '3px 10px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      backgroundColor: conn.isConnected ? '#f7768e33' : '#7aa2f7',
                      color: conn.isConnected ? '#f7768e' : '#1a1b26',
                      opacity: connectingIds.has(conn.id) ? 0.5 : 1,
                    }}
                  >{connectingIds.has(conn.id) ? '...' : conn.isConnected ? 'Disconnect' : 'Connect'}</button>
                </div>
                {/* Last connected */}
                {conn.lastConnected && (
                  <div
                    style={{ fontSize: 10, opacity: 0.4, marginTop: 4 }}
                  >{`Last: ${new Date(conn.lastConnected).toLocaleString()}`}</div>
                )}
              </div>
            ))}
          </div>
        )
      }
      {/* Dialogs */}
      <ConnectionDialog
        isOpen={showDialog}
        onClose={() => { setShowDialog(false); setEditingConnection(undefined); }}
        onSubmit={handleSaveConnection}
        editConnection={editingConnection}
      />
      <PasswordPrompt
        isOpen={showPasswordPrompt}
        onSubmit={handlePasswordConnect}
        onCancel={() => { setShowPasswordPrompt(false); setPendingConnection(null); }}
        connectionName={pendingConnection ? `${pendingConnection.username}@${pendingConnection.host}` : ''}
      />
    </div>
  );
}

// ─── Extension Entry Point ─────────────────────────────────────────────────────

let extensionApi: ExtensionAPI | null = null;

Sidebar.register({
  id: 'xplorer-ssh',
  title: 'SSH Manager',
  icon: 'SSH',

  onActivate: (api) => { extensionApi = api as ExtensionAPI; },

  render: () => {
    if (!extensionApi) {
      return (
        <div
          style={{ padding: 20, color: '#f7768e', fontFamily: 'system-ui, sans-serif' }}
        >SSH extension not initialized. Native plugin may not be loaded.</div>
      );
    }
    return <SSHPanel api={extensionApi} />;
  },
});
