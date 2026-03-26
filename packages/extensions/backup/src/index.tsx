import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sidebar, type XplorerAPI, type SidebarRenderProps } from '@xplorer/extension-sdk';

interface BackupFileEntry {
  path: string;
  size: number;
  modified: number;
  hash: string;
  is_new: boolean;
  is_modified: boolean;
}

interface BackupManifest {
  backup_id: string;
  timestamp: string;
  source_dir: string;
  files: BackupFileEntry[];
  total_size: number;
  backup_type: 'full' | 'incremental';
}

interface BackupProgress {
  phase: string;
  current: number;
  total: number;
  current_file: string;
  percentage: number;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatTimestamp(ts: string): string {
  const match = ts.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!match) return ts;
  const [, y, mo, d, h, mi, s] = match;
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

function truncatePath(p: string, max: number): string {
  if (p.length <= max) return p;
  const sep = p.includes('\\') ? '\\' : '/';
  const parts = p.split(sep);
  if (parts.length <= 3) return '...' + p.slice(-(max - 3));
  return parts[0] + sep + '...' + sep + parts.slice(-2).join(sep);
}

const card: React.CSSProperties = {
  background: 'var(--xp-surface-light, #2f334d)',
  borderRadius: 10,
  padding: 12,
  border: '1px solid var(--xp-border, #414868)',
};

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--xp-text, #c0caf5)',
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid var(--xp-border, #414868)',
  background: 'var(--xp-bg, #1a1b26)',
  color: 'var(--xp-text, #c0caf5)',
  outline: 'none',
  boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 6,
  border: 'none',
  background: 'var(--xp-blue, #7aa2f7)',
  color: '#fff',
  cursor: 'pointer',
  width: '100%',
};

const btnSmall: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 11,
  borderRadius: 4,
  border: '1px solid var(--xp-border, #414868)',
  background: 'var(--xp-surface-light, #2f334d)',
  color: 'var(--xp-text, #c0caf5)',
  cursor: 'pointer',
};

const btnDanger: React.CSSProperties = {
  ...btnSmall,
  borderColor: 'var(--xp-red, #f7768e)',
  color: 'var(--xp-red, #f7768e)',
};

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--xp-blue, #7aa2f7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const FullBackupIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--xp-green, #9ece6a)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2"/>
    <path d="M8 12h8"/>
    <path d="M12 8v8"/>
  </svg>
);

const IncrementalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--xp-orange, #ff9e64)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20"/>
    <path d="M2 12h20"/>
    <path d="M7 7l10 10"/>
  </svg>
);

const RestoreIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

function BackupPanel({ currentPath, api }: { currentPath: string; api: XplorerAPI }) {
  const [sourceDir, setSourceDir] = useState(currentPath || '');
  const [backupDir, setBackupDir] = useState('');
  const [backupName, setBackupName] = useState('my-backup');
  const [backups, setBackups] = useState<BackupManifest[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [restorePath, setRestorePath] = useState('');
  const progressDisposer = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    if (currentPath && !sourceDir) {
      setSourceDir(currentPath);
    }
  }, [currentPath, sourceDir]);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMsg(null);
  }, []);

  const loadBackups = useCallback(async () => {
    if (!backupDir || !backupName) return;
    try {
      const list = await api.backup.list(backupDir, backupName);
      setBackups(list);
    } catch (e: unknown) {
      setBackups([]);
    }
  }, [backupDir, backupName, api]);

  useEffect(() => {
    if (backupDir && backupName) {
      loadBackups();
    }
  }, [backupDir, backupName, loadBackups]);

  const handleCreateBackup = useCallback(async () => {
    if (!sourceDir || !backupDir || !backupName) {
      setError('Please fill in all fields: source directory, backup directory, and backup name.');
      return;
    }
    clearMessages();
    setLoading(true);
    setProgress(null);

    if (progressDisposer.current) {
      progressDisposer.current.dispose();
    }
    progressDisposer.current = api.backup.onProgress((p: BackupProgress) => {
      setProgress(p);
    });

    try {
      const manifest = await api.backup.create(sourceDir, backupDir, backupName);
      const fileCount = manifest.files.length;
      const changedCount = manifest.files.filter(f => f.is_new || f.is_modified).length;
      setSuccessMsg(
        manifest.backup_type === 'full'
          ? `Full backup created: ${fileCount} files (${formatSize(manifest.total_size)})`
          : `Incremental backup created: ${changedCount} changed files out of ${fileCount} total (${formatSize(manifest.total_size)})`
      );
      await loadBackups();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setProgress(null);
      if (progressDisposer.current) {
        progressDisposer.current.dispose();
        progressDisposer.current = null;
      }
    }
  }, [sourceDir, backupDir, backupName, api, loadBackups, clearMessages]);

  const handleRestore = useCallback(async (backupId: string) => {
    if (!restorePath) {
      setError('Please enter a restore destination path.');
      return;
    }
    clearMessages();
    setLoading(true);
    setProgress(null);

    if (progressDisposer.current) {
      progressDisposer.current.dispose();
    }
    progressDisposer.current = api.backup.onProgress((p: BackupProgress) => {
      setProgress(p);
    });

    try {
      await api.backup.restore(backupId, backupDir, backupName, restorePath);
      setSuccessMsg(`Backup "${backupId}" restored to ${restorePath}`);
      setRestoreTarget(null);
      setRestorePath('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setProgress(null);
      if (progressDisposer.current) {
        progressDisposer.current.dispose();
        progressDisposer.current = null;
      }
    }
  }, [restorePath, backupDir, backupName, api, clearMessages]);

  const handleDelete = useCallback(async (backupId: string) => {
    clearMessages();
    try {
      await api.backup.delete(backupId, backupDir, backupName);
      setSuccessMsg(`Backup "${backupId}" deleted.`);
      await loadBackups();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [backupDir, backupName, api, loadBackups, clearMessages]);

  useEffect(() => {
    return () => {
      if (progressDisposer.current) {
        progressDisposer.current.dispose();
      }
    };
  }, []);

  return (
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', maxHeight: '100%', fontSize: 13, color: 'var(--xp-text, #c0caf5)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldIcon />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--xp-text)' }}>Incremental Backup</div>
          <div style={{ fontSize: 11, color: 'var(--xp-text-muted)' }}>Track changes and create efficient backups</div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div style={{ padding: 10, borderRadius: 8, border: '1px solid color-mix(in srgb, var(--xp-red) 30%, transparent)', background: 'color-mix(in srgb, var(--xp-red) 8%, transparent)' }}>
          <span style={{ fontSize: 12, color: 'var(--xp-red, #f7768e)' }}>{error}</span>
        </div>
      )}
      {successMsg && (
        <div style={{ padding: 10, borderRadius: 8, border: '1px solid color-mix(in srgb, var(--xp-green) 30%, transparent)', background: 'color-mix(in srgb, var(--xp-green) 8%, transparent)' }}>
          <span style={{ fontSize: 12, color: 'var(--xp-green, #9ece6a)' }}>{successMsg}</span>
        </div>
      )}

      {/* Configuration */}
      <div style={card}>
        <div style={sectionTitle}>Backup Configuration</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--xp-text-muted)', display: 'block', marginBottom: 3 }}>Source Directory</label>
            <input
              type="text"
              value={sourceDir}
              onChange={(e) => setSourceDir((e.target as HTMLInputElement).value)}
              placeholder="/path/to/source"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--xp-text-muted)', display: 'block', marginBottom: 3 }}>Backup Directory</label>
            <input
              type="text"
              value={backupDir}
              onChange={(e) => setBackupDir((e.target as HTMLInputElement).value)}
              placeholder="/path/to/backups"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--xp-text-muted)', display: 'block', marginBottom: 3 }}>Backup Name</label>
            <input
              type="text"
              value={backupName}
              onChange={(e) => setBackupName((e.target as HTMLInputElement).value)}
              placeholder="my-backup"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Progress */}
      {loading && progress && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}>
            <span style={{ fontWeight: 500, color: 'var(--xp-text)', textTransform: 'capitalize' }}>{progress.phase}...</span>
            <span style={{ color: 'var(--xp-text-muted)' }}>{Math.round(progress.percentage)}%</span>
          </div>
          <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--xp-bg, #1a1b26)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              borderRadius: 4,
              transition: 'width 0.2s',
              width: `${progress.percentage}%`,
              background: 'linear-gradient(90deg, var(--xp-blue, #7aa2f7), var(--xp-cyan, #7dcfff))',
            }} />
          </div>
          {progress.current_file && (
            <div style={{ fontSize: 10, color: 'var(--xp-text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {truncatePath(progress.current_file, 50)}
            </div>
          )}
          <div style={{ fontSize: 10, color: 'var(--xp-text-muted)', marginTop: 2 }}>
            {progress.current} / {progress.total} files
          </div>
        </div>
      )}

      {/* Create Button */}
      <button
        onClick={handleCreateBackup}
        disabled={loading || !sourceDir || !backupDir || !backupName}
        style={{
          ...btnPrimary,
          opacity: (loading || !sourceDir || !backupDir || !backupName) ? 0.5 : 1,
          cursor: (loading || !sourceDir || !backupDir || !backupName) ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Backing up...' : 'Create Backup'}
      </button>

      {/* Backup History */}
      {backups.length > 0 && (
        <div style={card}>
          <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Backup History ({backups.length})</span>
            <button onClick={loadBackups} style={btnSmall}>Refresh</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {backups.map((backup) => {
              const changedFiles = backup.files.filter(f => f.is_new || f.is_modified).length;
              const isRestoring = restoreTarget === backup.backup_id;
              return (
                <div key={backup.backup_id} style={{
                  padding: 10,
                  borderRadius: 8,
                  background: 'var(--xp-bg, #1a1b26)',
                  border: '1px solid var(--xp-border, #414868)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {backup.backup_type === 'full' ? <FullBackupIcon /> : <IncrementalIcon />}
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--xp-text)' }}>
                      {formatTimestamp(backup.backup_id)}
                    </span>
                    <span style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: backup.backup_type === 'full'
                        ? 'color-mix(in srgb, var(--xp-green) 15%, transparent)'
                        : 'color-mix(in srgb, var(--xp-orange) 15%, transparent)',
                      color: backup.backup_type === 'full'
                        ? 'var(--xp-green, #9ece6a)'
                        : 'var(--xp-orange, #ff9e64)',
                    }}>
                      {backup.backup_type}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', marginBottom: 2 }}>
                    {backup.files.length} files | {formatSize(backup.total_size)}
                    {backup.backup_type === 'incremental' && ` | ${changedFiles} changed`}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--xp-text-muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={backup.source_dir}>
                    Source: {truncatePath(backup.source_dir, 40)}
                  </div>

                  {isRestoring && (
                    <div style={{ marginBottom: 6 }}>
                      <label style={{ fontSize: 10, color: 'var(--xp-text-muted)', display: 'block', marginBottom: 3 }}>Restore to:</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          type="text"
                          value={restorePath}
                          onChange={(e) => setRestorePath((e.target as HTMLInputElement).value)}
                          placeholder="/path/to/restore"
                          style={{ ...inputStyle, fontSize: 11 }}
                        />
                        <button
                          onClick={() => handleRestore(backup.backup_id)}
                          disabled={loading || !restorePath}
                          style={{
                            ...btnSmall,
                            background: 'var(--xp-green, #9ece6a)',
                            color: '#1a1b26',
                            border: 'none',
                            fontWeight: 600,
                            opacity: (loading || !restorePath) ? 0.5 : 1,
                            flexShrink: 0,
                          }}
                        >
                          Go
                        </button>
                        <button onClick={() => { setRestoreTarget(null); setRestorePath(''); }} style={btnSmall}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6 }}>
                    {!isRestoring && (
                      <button
                        onClick={() => { setRestoreTarget(backup.backup_id); setRestorePath(backup.source_dir); }}
                        disabled={loading}
                        style={btnSmall}
                        title="Restore this backup"
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <RestoreIcon /> Restore
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(backup.backup_id)}
                      disabled={loading}
                      style={btnDanger}
                      title="Delete this backup"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <TrashIcon /> Delete
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {backups.length === 0 && backupDir && backupName && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--xp-text-muted)' }}>No backups found for "{backupName}".</div>
          <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', marginTop: 4 }}>Create your first backup above.</div>
        </div>
      )}
    </div>
  );
}

let api: XplorerAPI;

Sidebar.register({
  id: 'backup',
  title: 'Incremental Backup',
  description: 'Create and manage incremental backups with change tracking',
  icon: 'archive',
  location: 'right',
  permissions: ['file:read', 'file:write', 'ui:panels'],
  render: (props: SidebarRenderProps) => React.createElement(BackupPanel, { currentPath: (props.currentPath as string) || '', api }),
  onActivate: (injectedApi: XplorerAPI) => { api = injectedApi; },
});
