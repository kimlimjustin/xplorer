import React, { useState, useEffect } from 'react';
import { Dialog, type XplorerAPI, type DialogRenderProps } from '@xplorer/extension-sdk';

type CompressionFormat = 'Zip' | 'Tar' | 'TarGz' | 'TarBz2' | 'TarXz' | 'SevenZ';
interface FileItem { path: string; name: string; is_dir: boolean; size: number; }
interface CompressionInfo { total_files: number; total_directories: number; total_size: number; estimated_compressed_size: number; }

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

const EXT_MAP: Record<CompressionFormat, string> = { Zip: 'zip', Tar: 'tar', TarGz: 'tar.gz', TarBz2: 'tar.bz2', TarXz: 'tar.xz', SevenZ: '7z' };

const inputStyle: React.CSSProperties = { flex: 1, padding: '8px 12px', border: '1px solid var(--xp-border, #414868)', borderRadius: 6, background: 'var(--xp-bg, #1a1b26)', color: 'var(--xp-text, #c0caf5)', fontSize: 13 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--xp-text, #c0caf5)', marginBottom: 6 };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: 'var(--xp-blue, #7aa2f7)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const disabledOp = { opacity: 0.5, cursor: 'not-allowed' as const };

let api: XplorerAPI;

function CompressDialogContent({ isOpen, onClose, data }: DialogRenderProps) {
  const files: FileItem[] = (data.files as FileItem[]) || [];
  const onComplete = data.onComplete as (() => void) | undefined;

  const [info, setInfo] = useState<CompressionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState('');
  const [format, setFormat] = useState<CompressionFormat>('Zip');
  const [level, setLevel] = useState(6);
  const [password, setPassword] = useState('');
  const [includeHidden, setIncludeHidden] = useState(false);
  const [followSymlinks, setFollowSymlinks] = useState(true);

  useEffect(() => {
    if (!isOpen || files.length === 0) return;
    setLoading(true);
    setError(null);
    (api as any).fileUtils.getCompressionInfo(files.map(f => f.path))
      .then((r: CompressionInfo) => setInfo(r))
      .catch((e: Error) => { setError(e.message); api.ui.showMessage(`Failed: ${e.message}`, 'error'); })
      .finally(() => setLoading(false));

    const base = files.length === 1 ? (files[0].is_dir ? files[0].name : files[0].name.split('.')[0]) : `archive_${files.length}_files`;
    const dir = files[0].path.split(/[/\\]/).slice(0, -1).join('/');
    setOutputPath(`${dir}/${base}.${EXT_MAP[format]}`);
  }, [isOpen, files.length]);

  const handleFormatChange = (f: CompressionFormat) => {
    setFormat(f);
    if (outputPath) {
      const base = outputPath.replace(/\.(zip|tar|tar\.gz|tar\.bz2|tar\.xz|7z)$/i, '');
      setOutputPath(`${base}.${EXT_MAP[f]}`);
    }
  };

  const handleCompress = async () => {
    if (!outputPath.trim()) { api.ui.showMessage('Specify an output path.', 'error'); return; }
    setCompressing(true);
    try {
      const result = await (api as any).fileUtils.compress(files.map(f => f.path), outputPath, {
        format, compression_level: level, password: password.trim() || undefined, include_hidden: includeHidden, follow_symlinks: followSymlinks,
      });
      api.ui.showMessage(`Created ${(result as string).split(/[/\\]/).pop()}`, 'info');
      onComplete?.();
      onClose();
    } catch (err) { api.ui.showMessage(`Failed: ${(err as Error).message}`, 'error'); }
    finally { setCompressing(false); }
  };

  const handleClose = () => { if (compressing) return; setOutputPath(''); setPassword(''); setError(null); onClose(); };

  const browseOutput = async () => {
    try {
      const r = await api.dialog.pickFile({ multiple: false });
      if (r?.length) { const fn = outputPath.split(/[/\\]/).pop() || `archive.${EXT_MAP[format]}`; setOutputPath(`${r[0]}/${fn}`); }
    } catch {}
  };

  const reduction = info ? `~${Math.round(((info.total_size - info.estimated_compressed_size) / info.total_size) * 100)}% reduction` : '';

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <style>{`@keyframes xp-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ background: 'var(--xp-surface, #24283b)', borderRadius: 8, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', width: 560, maxWidth: '90vw', maxHeight: '90vh', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--xp-border, #414868)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--xp-text)', margin: 0 }}>Compress Files</h2>
          <button onClick={handleClose} disabled={compressing} style={{ background: 'none', border: 'none', color: 'var(--xp-text-muted)', cursor: 'pointer', fontSize: 18, padding: 4, ...(compressing ? disabledOp : {}) }}>{'\u2715'}</button>
        </div>

        <div style={{ padding: 20, maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--xp-border)', borderTopColor: 'var(--xp-blue)', borderRadius: '50%', animation: 'xp-spin 1s linear infinite' }} />
              <span style={{ color: 'var(--xp-text-muted)', fontSize: 13 }}>Analyzing files...</span>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--xp-red)" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div style={{ color: 'var(--xp-text)', fontSize: 14, marginTop: 8 }}>{error}</div>
              <button onClick={() => { setError(null); setLoading(true); }} style={{ ...btnPrimary, marginTop: 12 }}>Try Again</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {info && (
                <div style={{ background: 'var(--xp-bg, #1a1b26)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--xp-text)', marginBottom: 8 }}>Files to compress:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                    <div><span style={{ color: 'var(--xp-text-muted)' }}>Files:</span> <span style={{ color: 'var(--xp-text)' }}>{info.total_files.toLocaleString()}</span></div>
                    <div><span style={{ color: 'var(--xp-text-muted)' }}>Directories:</span> <span style={{ color: 'var(--xp-text)' }}>{info.total_directories.toLocaleString()}</span></div>
                    <div><span style={{ color: 'var(--xp-text-muted)' }}>Total size:</span> <span style={{ color: 'var(--xp-text)' }}>{formatFileSize(info.total_size)}</span></div>
                    <div><span style={{ color: 'var(--xp-text-muted)' }}>Estimated:</span> <span style={{ color: 'var(--xp-text)' }}>{formatFileSize(info.estimated_compressed_size)} </span><span style={{ color: 'var(--xp-green, #9ece6a)', fontSize: 11 }}>({reduction})</span></div>
                  </div>
                </div>
              )}

              <div>
                <label style={labelStyle}>Output Path</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={outputPath} onChange={(e: any) => setOutputPath(e.target.value)} style={inputStyle} placeholder="Enter output path..." />
                  <button onClick={browseOutput} style={{ padding: '8px 12px', border: '1px solid var(--xp-border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--xp-text)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 14l1.45-2.9A2 2 0 019.24 10H20a2 2 0 011.94 2.5l-1.55 6a2 2 0 01-1.94 1.5H4a2 2 0 01-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 011.66.9l.82 1.2A2 2 0 0012.07 6H18a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Compression Format</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {(['Zip', 'TarGz', 'TarBz2'] as CompressionFormat[]).map((f) => (
                    <button key={f} onClick={() => handleFormatChange(f)}
                      style={{ padding: 10, borderRadius: 6, cursor: 'pointer', border: format === f ? '1px solid var(--xp-blue)' : '1px solid var(--xp-border, #414868)', background: format === f ? 'color-mix(in srgb, var(--xp-blue) 15%, transparent)' : 'transparent', color: format === f ? 'var(--xp-blue)' : 'var(--xp-text)' }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{f}</div>
                      <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', marginTop: 2 }}>.{EXT_MAP[f]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Compression Level: {level}</label>
                <input type="range" min="1" max="9" value={level} onChange={(e: any) => setLevel(parseInt(e.target.value))} style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--xp-text-muted)', marginTop: 4 }}>
                  <span>Fastest (1)</span><span>Best (9)</span>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Password Protection (Optional)</label>
                <input type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} style={{ ...inputStyle, width: '100%' }} placeholder="Enter password..." />
                <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', marginTop: 4 }}>Password may not be supported by all formats</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--xp-text)' }}>Options</div>
                {[{ label: 'Include hidden files', checked: includeHidden, onChange: setIncludeHidden }, { label: 'Follow symbolic links', checked: followSymlinks, onChange: setFollowSymlinks }].map(({ label, checked, onChange }) => (
                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--xp-text)' }}>
                    <input type="checkbox" checked={checked} onChange={(e: any) => onChange(e.target.checked)} style={{ width: 16, height: 16 }} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 20px', borderTop: '1px solid var(--xp-border, #414868)', background: 'var(--xp-bg, #1a1b26)' }}>
          <button onClick={handleClose} disabled={compressing} style={{ padding: '8px 16px', border: 'none', background: 'none', color: 'var(--xp-text)', borderRadius: 6, fontSize: 13, cursor: 'pointer', ...(compressing ? disabledOp : {}) }}>Cancel</button>
          <button onClick={handleCompress} disabled={compressing || loading || !outputPath.trim()} style={{ ...btnPrimary, ...((compressing || loading || !outputPath.trim()) ? disabledOp : {}) }}>
            {compressing && <span style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'xp-spin 1s linear infinite', display: 'inline-block' }} />}
            {compressing ? 'Compressing...' : 'Compress'}
          </button>
        </div>
      </div>
    </div>
  );
}

Dialog.register({
  id: 'compress-dialog',
  title: 'Compress Files',
  icon: 'package',
  permissions: ['file:read', 'file:write', 'ui:panels'],
  onActivate(injectedApi: XplorerAPI) { api = injectedApi; },
  render(props: DialogRenderProps) { return <CompressDialogContent {...props} />; },
});
