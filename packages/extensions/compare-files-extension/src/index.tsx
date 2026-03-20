import React from 'react';
import { Dialog, type XplorerAPI, type DialogRenderProps } from '@xplorer/extension-sdk';

const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes, i = 0;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
};

interface FileInfo { name: string; size: number; isDir: boolean; }

let extensionApi: XplorerAPI;

Dialog.register({
  id: 'compare-files-dialog',
  title: 'Compare Files',
  icon: 'file-text',
  permissions: ['file:read', 'ui:panels'],
  onActivate(api) { extensionApi = api; },

  render({ isOpen, onClose, data }: DialogRenderProps) {
    const api = extensionApi;
    const onCompare = data.onCompare as ((f1: string, f2: string) => void) | undefined;
    const initialFile1 = (data.initialFile1 as string) || '';
    const initialFile2 = (data.initialFile2 as string) || '';

    const [file1Path, setFile1Path] = React.useState(initialFile1);
    const [file2Path, setFile2Path] = React.useState(initialFile2);
    const [file1Info, setFile1Info] = React.useState<FileInfo | null>(null);
    const [file2Info, setFile2Info] = React.useState<FileInfo | null>(null);

    const validateFile = async (path: string, num: 1 | 2) => {
      const setInfo = num === 1 ? setFile1Info : setFile2Info;
      if (!path) { setInfo(null); return; }
      try {
        const exists = await api.files.exists(path);
        if (!exists) { setInfo(null); return; }
        const isDir = await (api as any).fileUtils.isDir(path);
        if (isDir) { setInfo(null); return; }
        const props = await (api as any).fileUtils.getBasicProperties(path);
        setInfo({ name: props.name, size: props.size, isDir: false });
      } catch { setInfo(null); }
    };

    React.useEffect(() => {
      setFile1Path(initialFile1);
      setFile2Path(initialFile2);
      if (initialFile1) validateFile(initialFile1, 1);
      if (initialFile2) validateFile(initialFile2, 2);
    }, [initialFile1, initialFile2, isOpen]);

    const handleChange = (value: string, num: 1 | 2) => {
      (num === 1 ? setFile1Path : setFile2Path)(value);
      validateFile(value, num);
    };

    const selectFile = async (num: 1 | 2) => {
      try {
        const selected = await api.dialog.pickFile({ multiple: false });
        if (selected?.length) handleChange(selected[0], num);
      } catch {}
    };

    const canCompare = file1Path && file2Path && file1Info && file2Info && !file1Info.isDir && !file2Info.isDir;

    const renderFileInfo = (info: FileInfo | null, path: string) => {
      if (!path) return null;
      if (!info) return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, color: 'var(--xp-red, #f7768e)', background: 'color-mix(in srgb, var(--xp-red) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--xp-red) 30%, transparent)' }}>Invalid file or directory</span>;
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, color: 'var(--xp-text)', border: '1px solid var(--xp-border, #414868)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          {formatFileSize(info.size)}
        </span>
      );
    };

    if (!isOpen) return null;

    const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--xp-text, #c0caf5)', marginBottom: 6 };
    const inputStyle: React.CSSProperties = { flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--xp-border, #414868)', background: 'var(--xp-bg, #1a1b26)', color: 'var(--xp-text)', fontSize: 13 };
    const browseBtn: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: '1px solid var(--xp-border, #414868)', background: 'var(--xp-surface, #24283b)', color: 'var(--xp-text)', fontSize: 13, cursor: 'pointer', flexShrink: 0 };

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
        onClick={(e: any) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ background: 'var(--xp-surface, #24283b)', borderRadius: 8, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', border: '1px solid var(--xp-border, #414868)', width: '100%', maxWidth: 600, margin: '0 16px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--xp-border, #414868)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--xp-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><path d="M14 14h7v7h-7z"/><path d="M3 14h7v7H3z"/>
              </svg>
              Compare Files
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--xp-text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>{'\u2715'}</button>
          </div>

          {/* Body */}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* File 1 */}
            <div>
              <label style={labelStyle}>First File</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={file1Path} onChange={(e: any) => handleChange(e.target.value, 1)} placeholder="Select or enter path..." style={inputStyle} />
                <button onClick={() => selectFile(1)} style={browseBtn}>Browse</button>
              </div>
              <div style={{ minHeight: 24, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                {renderFileInfo(file1Info, file1Path)}
                {file1Path && file1Info && <span style={{ fontSize: 11, color: 'var(--xp-text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file1Info.name}</span>}
              </div>
            </div>

            {/* File 2 */}
            <div>
              <label style={labelStyle}>Second File</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={file2Path} onChange={(e: any) => handleChange(e.target.value, 2)} placeholder="Select or enter path..." style={inputStyle} />
                <button onClick={() => selectFile(2)} style={browseBtn}>Browse</button>
              </div>
              <div style={{ minHeight: 24, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                {renderFileInfo(file2Info, file2Path)}
                {file2Path && file2Info && <span style={{ fontSize: 11, color: 'var(--xp-text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file2Info.name}</span>}
              </div>
            </div>

            {/* Same-file warning */}
            {file1Path && file2Path && file1Path === file2Path && (
              <div style={{ padding: 10, background: 'color-mix(in srgb, var(--xp-yellow) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--xp-yellow) 30%, transparent)', borderRadius: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--xp-yellow, #e0af68)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Same file selected for both. Please select two different files.
                </div>
              </div>
            )}

            {/* Tips */}
            <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', lineHeight: 1.8 }}>
              {'\u2022'} Both files must be regular files (not directories){'\n'}
              {'\u2022'} Large files may take longer to compare{'\n'}
              {'\u2022'} Binary files compared byte-by-byte, text files line-by-line
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--xp-border, #414868)' }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--xp-border)', background: 'var(--xp-surface)', color: 'var(--xp-text)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={() => { if (canCompare && onCompare) onCompare(file1Path, file2Path); }}
              disabled={!canCompare || file1Path === file2Path}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--xp-blue, #7aa2f7)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: (!canCompare || file1Path === file2Path) ? 'not-allowed' : 'pointer', opacity: (!canCompare || file1Path === file2Path) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/></svg>
              Compare Files
            </button>
          </div>
        </div>
      </div>
    );
  },
});
