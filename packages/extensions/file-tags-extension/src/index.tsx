import React, { useState, useEffect, useRef } from 'react';
import { Dialog, type XplorerAPI, type DialogRenderProps } from '@xplorer/extension-sdk';

interface FileTag {
  name: string;
  color: string;
}

const PRESET_COLORS = [
  { label: 'Blue', value: '#7aa2f7' },
  { label: 'Green', value: '#9ece6a' },
  { label: 'Red', value: '#f7768e' },
  { label: 'Orange', value: '#ff9e64' },
  { label: 'Purple', value: '#bb9af7' },
  { label: 'Yellow', value: '#e0af68' },
];

let api: XplorerAPI;

Dialog.register({
  id: 'file-tags-dialog',
  title: 'File Tags',
  icon: 'tag',
  permissions: ['file:read', 'file:write', 'ui:panels'],
  onActivate: (injectedApi) => { api = injectedApi; },

  render: ({ isOpen, onClose, data }: DialogRenderProps) => {
    const filePath = (data?.filePath as string) || '';
    const onSaved = data?.onSaved as ((tags: FileTag[]) => void) | undefined;
    return <FileTagsDialogContent isOpen={isOpen} onClose={onClose} filePath={filePath} onSaved={onSaved} />;
  },
});

function FileTagsDialogContent({ isOpen, onClose, filePath, onSaved }: { isOpen: boolean; onClose: () => void; filePath: string; onSaved?: (tags: FileTag[]) => void }) {
  const [tags, setTags] = useState<FileTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !filePath) return;
    setError(null);
    setNewTagName('');
    setSelectedColor(PRESET_COLORS[0].value);
    setLoading(true);
    (api as any).fileUtils.getTags(filePath)
      .then((result: FileTag[]) => setTags(result))
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [isOpen, filePath]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  const handleAddTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setError(`Tag "${name}" already exists.`);
      return;
    }
    setTags((prev) => [...prev, { name, color: selectedColor }]);
    setNewTagName('');
    setError(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
    else if (e.key === 'Escape') onClose();
  };

  const handleRemoveTag = (index: number) => setTags((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await (api as any).fileUtils.setTags(filePath, tags);
      onSaved?.(tags);
      api.ui.showMessage('Tags saved successfully', 'info');
      onClose();
    } catch (err) {
      setError(String(err));
      api.ui.showMessage(`Failed to save tags: ${err}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}
      onClick={(e: any) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--xp-surface, #24283b)', border: '1px solid var(--xp-border, #414868)', borderRadius: 8, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', width: 420, maxWidth: '90vw', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--xp-border, #414868)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--xp-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--xp-text, #c0caf5)' }}>Manage Tags</div>
              <div style={{ fontSize: 11, color: 'var(--xp-text-muted, #9aa5ce)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={filePath}>{fileName}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', padding: 4, borderRadius: 4, color: 'var(--xp-text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>{'\u2715'}</button>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Current tags */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--xp-text-muted, #9aa5ce)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>Current Tags</div>
            {loading ? (
              <div style={{ fontSize: 13, color: 'var(--xp-text-muted)' }}>Loading...</div>
            ) : tags.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--xp-text-muted)', fontStyle: 'italic' }}>No tags -- add one below.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tags.map((tag, idx) => (
                  <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 12, fontSize: 12, fontWeight: 500, color: '#fff', background: tag.color }}>
                    <span>{tag.name}</span>
                    <button
                      onClick={() => handleRemoveTag(idx)}
                      style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 2, borderRadius: '50%', fontSize: 11, lineHeight: 1, opacity: 0.8 }}
                      title={`Remove "${tag.name}"`}
                    >{'\u2715'}</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--xp-border, #414868)' }} />

          {/* Add new tag */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--xp-text-muted, #9aa5ce)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>Add Tag</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setSelectedColor(c.value)}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', border: selectedColor === c.value ? '2px solid #fff' : '2px solid transparent',
                    background: c.value, cursor: 'pointer', boxShadow: selectedColor === c.value ? `0 0 0 1px ${c.value}` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title={c.label}
                >
                  {selectedColor === c.value && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  )}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, borderRadius: '50%', background: selectedColor }} />
                <input
                  ref={inputRef}
                  type="text"
                  value={newTagName}
                  onChange={(e: any) => { setNewTagName(e.target.value); setError(null); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Tag name..."
                  maxLength={32}
                  style={{ width: '100%', background: 'var(--xp-bg, #1a1b26)', border: '1px solid var(--xp-border, #414868)', borderRadius: 6, paddingLeft: 26, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 13, color: 'var(--xp-text, #c0caf5)' }}
                />
              </div>
              <button
                onClick={handleAddTag}
                disabled={!newTagName.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'var(--xp-blue, #7aa2f7)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: newTagName.trim() ? 'pointer' : 'not-allowed', opacity: newTagName.trim() ? 1 : 0.4 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                Add
              </button>
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--xp-red, #f7768e)', background: 'color-mix(in srgb, var(--xp-red) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--xp-red) 30%, transparent)', borderRadius: 6, padding: '4px 8px' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--xp-border, #414868)' }}>
          <button onClick={onClose} style={{ padding: '6px 12px', background: 'none', border: 'none', color: 'var(--xp-text-muted)', cursor: 'pointer', fontSize: 13, borderRadius: 6 }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--xp-blue, #7aa2f7)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: (saving || loading) ? 'not-allowed' : 'pointer', opacity: (saving || loading) ? 0.5 : 1 }}
          >
            {saving ? (
              <><span style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'xp-spin 1s linear infinite', display: 'inline-block' }} />Saving...</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Save Tags</>
            )}
          </button>
        </div>
        <style>{`@keyframes xp-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
