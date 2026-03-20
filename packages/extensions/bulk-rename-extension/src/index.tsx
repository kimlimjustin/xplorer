import React from 'react';
import { Dialog, type XplorerAPI, type DialogRenderProps } from '@xplorer/extension-sdk';

interface BulkRenameResult {
  original_path: string;
  new_path: string;
  original_name: string;
  new_name: string;
  success: boolean;
  error: string | null;
}

interface FileEntry { path: string; name: string; is_dir: boolean; }

interface Preset { label: string; description: string; pattern: string; replacement: string; }

const PRESETS: Preset[] = [
  { label: 'Add prefix', description: 'Add text before filename', pattern: '^(.+)$', replacement: 'prefix_$1' },
  { label: 'Add suffix', description: 'Add text before extension', pattern: '^(.+)(\\.[^.]+)$', replacement: '$1_suffix$2' },
  { label: 'Replace text', description: 'Find and replace in filename', pattern: 'find', replacement: 'replace' },
  { label: 'Sequential numbering', description: 'Rename to prefix_001, prefix_002...', pattern: '^.*$', replacement: 'file_{N}' },
];

const base: React.CSSProperties = { fontSize: 13, color: 'var(--xp-text, #c0caf5)' };
const muted: React.CSSProperties = { fontSize: 12, color: 'var(--xp-text-muted, #9aa5ce)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--xp-border, #414868)', borderRadius: 6, background: 'var(--xp-bg, #1a1b26)', color: 'var(--xp-text)', fontFamily: 'monospace', fontSize: 13 };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: 'var(--xp-blue, #7aa2f7)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '8px 16px', border: '1px solid var(--xp-border, #414868)', background: 'none', color: 'var(--xp-text)', borderRadius: 6, fontSize: 13, cursor: 'pointer' };
const disabledStyle = { opacity: 0.5, cursor: 'not-allowed' };

let _api: XplorerAPI;

Dialog.register({
  id: 'bulk-rename-dialog',
  title: 'Bulk Rename',
  icon: 'file-text',
  permissions: ['file:read', 'file:write', 'ui:panels'],
  onActivate(api) { _api = api; },

  render({ isOpen, onClose, data }: DialogRenderProps) {
    const files = (data.files || []) as FileEntry[];
    const [pattern, setPattern] = React.useState('');
    const [replacement, setReplacement] = React.useState('');
    const [preview, setPreview] = React.useState<BulkRenameResult[]>([]);
    const [results, setResults] = React.useState<BulkRenameResult[] | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [renaming, setRenaming] = React.useState(false);
    const [patternError, setPatternError] = React.useState<string | null>(null);

    React.useEffect(() => {
      if (isOpen) { setPattern(''); setReplacement(''); setPreview([]); setResults(null); setPatternError(null); }
    }, [isOpen]);

    const fetchPreview = React.useCallback(async () => {
      if (!pattern.trim() || files.length === 0) { setPreview([]); setPatternError(null); return; }
      try {
        const r = await (_api as any).fileUtils.bulkRename(files.map(f => f.path), pattern, replacement, true);
        setPreview(r as BulkRenameResult[]);
        setPatternError(null);
      } catch (err) { setPatternError((err as Error).message || String(err)); setPreview([]); }
    }, [pattern, replacement, files]);

    React.useEffect(() => {
      if (!isOpen) return;
      const t = setTimeout(fetchPreview, 300);
      return () => clearTimeout(t);
    }, [fetchPreview, isOpen]);

    const handleRename = async () => {
      if (!pattern.trim()) { _api.ui.showMessage('Enter a regex pattern.', 'error'); return; }
      setRenaming(true);
      try {
        const r = await (_api as any).fileUtils.bulkRename(files.map(f => f.path), pattern, replacement, false) as BulkRenameResult[];
        setResults(r);
        const ok = r.filter(x => x.success).length, fail = r.filter(x => !x.success).length;
        _api.ui.showMessage(fail === 0 ? `Renamed ${ok} file${ok !== 1 ? 's' : ''}.` : `${ok} succeeded, ${fail} failed.`, fail === 0 ? 'info' : 'error');
      } catch (err) { _api.ui.showMessage(String(err), 'error'); }
      finally { setRenaming(false); }
    };

    const applyPreset = (p: Preset) => { setPattern(p.pattern); setReplacement(p.replacement); setResults(null); };
    const handleClose = () => { if (renaming) return; setPattern(''); setReplacement(''); setPreview([]); setResults(null); setPatternError(null); onClose(); };

    const displayData = results || preview;
    const hasChanges = displayData.some(r => r.original_name !== r.new_name);

    if (!isOpen) return null;

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
        <div style={{ background: 'var(--xp-surface, #24283b)', borderRadius: 8, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', width: 660, maxWidth: '90vw', maxHeight: '90vh', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--xp-border, #414868)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--xp-text)', margin: 0 }}>Bulk Rename</h2>
            <button onClick={handleClose} disabled={renaming} style={{ background: 'none', border: 'none', color: 'var(--xp-text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>{'\u2715'}</button>
          </div>

          {/* Body */}
          <div style={{ padding: 20, maxHeight: '60vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--xp-bg, #1a1b26)', borderRadius: 8, padding: 10 }}>
                <span style={muted}>{files.length} file{files.length !== 1 ? 's' : ''} selected for renaming</span>
              </div>

              {/* Presets */}
              <div>
                <div style={{ ...base, fontWeight: 500, marginBottom: 8 }}>Quick Presets</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {PRESETS.map((p) => (
                    <button key={p.label} onClick={() => applyPreset(p)} disabled={renaming}
                      style={{ padding: 10, borderRadius: 6, border: '1px solid var(--xp-border, #414868)', background: 'none', cursor: 'pointer', textAlign: 'left', ...(renaming ? disabledStyle : {}) }}
                    >
                      <div style={{ ...base, fontWeight: 500 }}>{p.label}</div>
                      <div style={{ ...muted, fontSize: 11, marginTop: 2 }}>{p.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pattern */}
              <div>
                <div style={{ ...base, fontWeight: 500, marginBottom: 6 }}>Pattern (Regex)</div>
                <input
                  value={pattern}
                  onChange={(e: any) => { setPattern(e.target.value); setResults(null); }}
                  disabled={renaming}
                  style={{ ...inputStyle, borderColor: patternError ? 'var(--xp-red, #f7768e)' : 'var(--xp-border, #414868)' }}
                  placeholder="e.g. ^(.+)\.txt$ or find_this"
                />
                {patternError && <div style={{ fontSize: 11, color: 'var(--xp-red, #f7768e)', marginTop: 4 }}>{patternError}</div>}
                <div style={{ ...muted, fontSize: 11, marginTop: 4 }}>Applied to filename only (not full path). Uses regex syntax.</div>
              </div>

              {/* Replacement */}
              <div>
                <div style={{ ...base, fontWeight: 500, marginBottom: 6 }}>Replacement</div>
                <input
                  value={replacement}
                  onChange={(e: any) => { setReplacement(e.target.value); setResults(null); }}
                  disabled={renaming}
                  style={inputStyle}
                  placeholder="e.g. $1_renamed.txt or new_name"
                />
                <div style={{ ...muted, fontSize: 11, marginTop: 4 }}>
                  Supports $1, $2 (capture groups), {'{n}'} (seq number), {'{N}'} (zero-padded), {'{date}'} (YYYY-MM-DD)
                </div>
              </div>

              {/* Preview/Results table */}
              {displayData.length > 0 && (
                <div>
                  <div style={{ ...base, fontWeight: 500, marginBottom: 6 }}>{results ? 'Results' : 'Preview'}</div>
                  <div style={{ background: 'var(--xp-bg, #1a1b26)', borderRadius: 8, border: '1px solid var(--xp-border, #414868)', overflow: 'hidden' }}>
                    <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--xp-border, #414868)', background: 'var(--xp-surface, #24283b)', position: 'sticky', top: 0 }}>
                            <th style={{ textAlign: 'left', padding: 8, color: 'var(--xp-text-muted)', fontWeight: 500 }}>Original</th>
                            <th style={{ textAlign: 'center', padding: 8, color: 'var(--xp-text-muted)', fontWeight: 500, width: 30 }} />
                            <th style={{ textAlign: 'left', padding: 8, color: 'var(--xp-text-muted)', fontWeight: 500 }}>New Name</th>
                            {results && <th style={{ textAlign: 'center', padding: 8, color: 'var(--xp-text-muted)', fontWeight: 500, width: 50 }}>Status</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {displayData.map((item, i) => {
                            const changed = item.original_name !== item.new_name;
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid var(--xp-border, #414868)', background: results && !item.success ? 'color-mix(in srgb, var(--xp-red) 10%, transparent)' : 'transparent' }}>
                                <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 11, color: 'var(--xp-text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.original_name}>{item.original_name}</td>
                                <td style={{ padding: 8, textAlign: 'center', color: 'var(--xp-text-muted)' }}>{changed ? '\u2192' : '='}</td>
                                <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 11, color: changed ? 'var(--xp-blue, #7aa2f7)' : 'var(--xp-text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.new_name}>{item.new_name}</td>
                                {results && (
                                  <td style={{ padding: 8, textAlign: 'center' }}>
                                    {item.success
                                      ? <span style={{ color: 'var(--xp-green, #9ece6a)', fontSize: 11 }}>OK</span>
                                      : <span style={{ color: 'var(--xp-red, #f7768e)', fontSize: 11, cursor: 'help' }} title={item.error || 'Failed'}>ERR</span>}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {results && results.some(r => !r.success) && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {results.filter(r => !r.success).map((r, i) => (
                        <div key={i} style={{ fontSize: 11, color: 'var(--xp-red, #f7768e)', background: 'color-mix(in srgb, var(--xp-red) 8%, transparent)', padding: '4px 8px', borderRadius: 4 }}>
                          <span style={{ fontWeight: 600 }}>{r.original_name}:</span> {r.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid var(--xp-border, #414868)', background: 'var(--xp-bg, #1a1b26)' }}>
            <div style={{ ...muted, fontSize: 11 }}>
              {preview.length > 0 && !results && hasChanges && `${preview.filter(r => r.original_name !== r.new_name).length} file(s) will be renamed`}
              {results && `${results.filter(r => r.success).length} of ${results.length} renamed successfully`}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleClose} disabled={renaming} style={{ ...btnSecondary, ...(renaming ? disabledStyle : {}) }}>{results ? 'Close' : 'Cancel'}</button>
              {!results && (
                <button onClick={handleRename} disabled={renaming || loading || !pattern.trim() || !hasChanges}
                  style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 6, ...((renaming || !pattern.trim() || !hasChanges) ? disabledStyle : {}) }}>
                  {renaming && <span style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'xp-spin 1s linear infinite', display: 'inline-block' }} />}
                  {renaming ? 'Renaming...' : 'Rename'}
                </button>
              )}
            </div>
          </div>
          <style>{`@keyframes xp-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  },
});
