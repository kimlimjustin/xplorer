import React, { useState, useEffect } from 'react';
import { Dialog, type XplorerAPI, type DialogRenderProps } from '@xplorer/extension-sdk';

interface ArchiveFileEntry { path: string; size: number; is_directory: boolean; }
interface ArchiveInfo { format: string; total_files: number; total_directories: number; total_size: number; compressed_size: number; is_encrypted: boolean; created: number; modified: number; files: ArchiveFileEntry[]; }

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

const inputStyle: React.CSSProperties = { flex: 1, padding: '8px 12px', border: '1px solid var(--xp-border, #414868)', borderRadius: 6, background: 'var(--xp-bg, #1a1b26)', color: 'var(--xp-text, #c0caf5)', fontSize: 13 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--xp-text, #c0caf5)', marginBottom: 6 };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: 'var(--xp-blue, #7aa2f7)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const disabledOp = { opacity: 0.5, cursor: 'not-allowed' as const };

let api: XplorerAPI;

function ExtractDialogContent({ isOpen, onClose, data }: DialogRenderProps) {
  const archivePath: string = (data.archivePath as string) || '';
  const onComplete = data.onComplete as (() => void) | undefined;

  const [archiveInfo, setArchiveInfo] = useState<ArchiveInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputDir, setOutputDir] = useState('');
  const [password, setPassword] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [preservePerms, setPreservePerms] = useState(true);
  const [includeHidden, setIncludeHidden] = useState(true);

  useEffect(() => {
    if (!isOpen || !archivePath) return;
    setLoading(true);
    setError(null);
    (api as any).fileUtils.getArchiveInfo(archivePath)
      .then((info: ArchiveInfo) => setArchiveInfo(info))
      .catch((e: Error) => { setError(e.message); api.ui.showMessage(`Failed: ${e.message}`, 'error'); })
      .finally(() => setLoading(false));

    const dir = archivePath.split(/[/\\]/).slice(0, -1).join('/');
    const name = archivePath.split(/[/\\]/).pop()?.replace(/\.(zip|tar|tar\.gz|tar\.bz2|tar\.xz|7z)$/i, '') || 'extracted';
    setOutputDir(`${dir}/${name}`);
  }, [isOpen, archivePath]);

  const handleExtract = async () => {
    if (!outputDir.trim()) { api.ui.showMessage('Specify an output directory.', 'error'); return; }
    if (archiveInfo?.is_encrypted && !password.trim()) { api.ui.showMessage('This archive requires a password.', 'error'); return; }
    setExtracting(true);
    try {
      const result = await (api as any).fileUtils.extract(archivePath, {
        output_directory: outputDir, password: password.trim() || undefined,
        overwrite_existing: overwrite, preserve_permissions: preservePerms, include_hidden: includeHidden,
      });
      api.ui.showMessage(`Extracted to ${(result as string).split(/[/\\]/).pop()}`, 'info');
      onComplete?.();
      onClose();
    } catch (err) { api.ui.showMessage(`Failed: ${(err as Error).message}`, 'error'); }
    finally { setExtracting(false); }
  };

  const handleClose = () => { if (extracting) return; setOutputDir(''); setPassword(''); setError(null); onClose(); };
  const browseDir = async () => { try { const r = await api.dialog.pickFile({ multiple: false }); if (r?.length) setOutputDir(r[0]); } catch {} };
  const ratio = archiveInfo && archiveInfo.total_size > 0 ? `${Math.round((archiveInfo.compressed_size / archiveInfo.total_size) * 100)}% of original` : '';

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <style>{`@keyframes xp-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ background: 'var(--xp-surface, #24283b)', borderRadius: 8, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', width: 560, maxWidth: '90vw', maxHeight: '90vh', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--xp-border, #414868)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--xp-text)', margin: 0 }}>Extract Archive</h2>
          <button onClick={handleClose} disabled={extracting} style={{ background: 'none', border: 'none', color: 'var(--xp-text-muted)', cursor: 'pointer', fontSize: 18, padding: 4, ...(extracting ? disabledOp : {}) }}>{'\u2715'}</button>
        </div>

        <div style={{ padding: 20, maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--xp-border)', borderTopColor: 'var(--xp-blue)', borderRadius: '50%', animation: 'xp-spin 1s linear infinite' }} />
              <span style={{ color: 'var(--xp-text-muted)', fontSize: 13 }}>Analyzing archive...</span>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--xp-red)" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div style={{ color: 'var(--xp-text)', fontSize: 14, marginTop: 8 }}>{error}</div>
              <button onClick={() => { setError(null); setLoading(true); }} style={{ ...btnPrimary, marginTop: 12 }}>Try Again</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Archive summary */}
              {archiveInfo && (
                <div style={{ background: 'var(--xp-bg, #1a1b26)', borderRadius: 8, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--xp-orange, #ff9e64)" strokeWidth="2"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8"/><path d="M10 12h4"/></svg>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--xp-text)' }}>{archivePath.split(/[/\\]/).pop()}</div>
                      <div style={{ fontSize: 12, color: 'var(--xp-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {archiveInfo.format} Archive
                        {archiveInfo.is_encrypted && (
                          <span style={{ color: 'var(--xp-yellow, #e0af68)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                            Encrypted
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                    <div><span style={{ color: 'var(--xp-text-muted)' }}>Files:</span> <span style={{ color: 'var(--xp-text)' }}>{archiveInfo.total_files.toLocaleString()}</span></div>
                    <div><span style={{ color: 'var(--xp-text-muted)' }}>Directories:</span> <span style={{ color: 'var(--xp-text)' }}>{archiveInfo.total_directories.toLocaleString()}</span></div>
                    <div><span style={{ color: 'var(--xp-text-muted)' }}>Compressed:</span> <span style={{ color: 'var(--xp-text)' }}>{formatFileSize(archiveInfo.compressed_size)}</span></div>
                    <div><span style={{ color: 'var(--xp-text-muted)' }}>Uncompressed:</span> <span style={{ color: 'var(--xp-text)' }}>{formatFileSize(archiveInfo.total_size)} </span><span style={{ color: 'var(--xp-green)', fontSize: 11 }}>({ratio})</span></div>
                  </div>
                </div>
              )}

              {/* Output directory */}
              <div>
                <label style={labelStyle}>Extract to Directory</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={outputDir} onChange={(e: any) => setOutputDir(e.target.value)} style={inputStyle} placeholder="Enter output directory..." />
                  <button onClick={browseDir} style={{ padding: '8px 12px', border: '1px solid var(--xp-border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--xp-text)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 14l1.45-2.9A2 2 0 019.24 10H20a2 2 0 011.94 2.5l-1.55 6a2 2 0 01-1.94 1.5H4a2 2 0 01-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 011.66.9l.82 1.2A2 2 0 0012.07 6H18a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>

              {/* Password */}
              {archiveInfo?.is_encrypted && (
                <div>
                  <label style={labelStyle}>Archive Password</label>
                  <input type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} style={{ ...inputStyle, width: '100%' }} placeholder="Enter archive password..." />
                  <div style={{ fontSize: 11, color: 'var(--xp-yellow, #e0af68)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    Encrypted archive requires a password
                  </div>
                </div>
              )}

              {/* Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--xp-text)' }}>Extraction Options</div>
                {[
                  { label: 'Overwrite existing files', checked: overwrite, onChange: setOverwrite },
                  { label: 'Preserve file permissions', checked: preservePerms, onChange: setPreservePerms },
                  { label: 'Include hidden files', checked: includeHidden, onChange: setIncludeHidden },
                ].map(({ label, checked, onChange }) => (
                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--xp-text)' }}>
                    <input type="checkbox" checked={checked} onChange={(e: any) => onChange(e.target.checked)} style={{ width: 16, height: 16 }} />
                    {label}
                  </label>
                ))}
              </div>

              {/* Archive contents preview */}
              {archiveInfo && archiveInfo.files.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--xp-text)', marginBottom: 6 }}>Archive Contents ({archiveInfo.files.length} items)</div>
                  <div style={{ maxHeight: 120, overflowY: 'auto', background: 'var(--xp-bg)', borderRadius: 6, border: '1px solid var(--xp-border)' }}>
                    {archiveInfo.files.slice(0, 20).map((file, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', fontSize: 11, borderBottom: '1px solid var(--xp-border)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--xp-text-muted)" strokeWidth="2">
                          {file.is_directory
                            ? <path d="M20 20a2 2 0 002-2V8a2 2 0 00-2-2h-7.93a2 2 0 01-1.66-.9l-.82-1.2A2 2 0 007.93 3H4a2 2 0 00-2 2v13c0 1.1.9 2 2 2Z"/>
                            : <><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></>}
                        </svg>
                        <span style={{ flex: 1, color: 'var(--xp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.path}</span>
                        <span style={{ color: 'var(--xp-text-muted)', flexShrink: 0 }}>{file.is_directory ? '' : formatFileSize(file.size)}</span>
                      </div>
                    ))}
                    {archiveInfo.files.length > 20 && (
                      <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--xp-text-muted)', textAlign: 'center' }}>
                        ... and {archiveInfo.files.length - 20} more files
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 20px', borderTop: '1px solid var(--xp-border, #414868)', background: 'var(--xp-bg, #1a1b26)' }}>
          <button onClick={handleClose} disabled={extracting} style={{ padding: '8px 16px', border: 'none', background: 'none', color: 'var(--xp-text)', borderRadius: 6, fontSize: 13, cursor: 'pointer', ...(extracting ? disabledOp : {}) }}>Cancel</button>
          <button onClick={handleExtract} disabled={extracting || loading || !outputDir.trim() || (archiveInfo?.is_encrypted === true && !password.trim())}
            style={{ ...btnPrimary, ...((extracting || loading || !outputDir.trim()) ? disabledOp : {}) }}>
            {extracting && <span style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'xp-spin 1s linear infinite', display: 'inline-block' }} />}
            {extracting ? 'Extracting...' : 'Extract'}
          </button>
        </div>
      </div>
    </div>
  );
}

Dialog.register({
  id: 'extract-dialog',
  title: 'Extract Archive',
  icon: 'package',
  permissions: ['file:read', 'file:write', 'ui:panels'],
  onActivate(injectedApi: XplorerAPI) { api = injectedApi; },
  render(props: DialogRenderProps) { return <ExtractDialogContent {...props} />; },
});
