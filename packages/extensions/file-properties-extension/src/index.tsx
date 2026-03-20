import React from 'react';
import { Dialog, type XplorerAPI, type DialogRenderProps } from '@xplorer/extension-sdk';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleString();
}

interface FileProperties {
  path: string;
  name: string;
  file_type: string;
  size: number;
  size_formatted: string;
  created: number;
  modified: number;
  accessed: number;
  permissions: { readable: boolean; writable: boolean; executable: boolean; permissions_string: string; mode?: number; attributes?: number };
  is_directory: boolean;
  is_hidden: boolean;
  is_readonly: boolean;
  extension?: string;
  mime_type?: string;
  attributes: { item_count?: number; total_size?: number; symlink_target?: string; device_id?: number; inode?: number; hard_links?: number };
}

const s = {
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  dialog: { background: 'var(--xp-surface, #24283b)', borderRadius: 8, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', width: 560, maxWidth: '90vw', maxHeight: '90vh', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--xp-border, #414868)' },
  title: { fontSize: 16, fontWeight: 600, color: 'var(--xp-text, #c0caf5)', margin: 0 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--xp-text-muted, #9aa5ce)', cursor: 'pointer', padding: 6, borderRadius: 4, fontSize: 18, lineHeight: 1 },
  tabBar: { display: 'flex', borderBottom: '1px solid var(--xp-border, #414868)', background: 'var(--xp-bg, #1a1b26)' },
  tab: (active: boolean) => ({
    padding: '10px 20px', cursor: 'pointer', border: 'none', borderBottom: active ? '2px solid var(--xp-blue, #7aa2f7)' : '2px solid transparent',
    color: active ? 'var(--xp-blue, #7aa2f7)' : 'var(--xp-text-muted, #9aa5ce)',
    background: active ? 'var(--xp-surface, #24283b)' : 'transparent', fontSize: 13, fontWeight: 500, textTransform: 'capitalize' as const,
  }),
  body: { padding: 20, maxHeight: '55vh', overflowY: 'auto' as const },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0' },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--xp-text-muted, #9aa5ce)', width: '35%', flexShrink: 0 },
  value: { fontSize: 13, color: 'var(--xp-text, #c0caf5)', width: '65%', textAlign: 'right' as const, wordBreak: 'break-all' as const },
  badge: (color: string) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500,
    color, background: `color-mix(in srgb, ${color} 15%, transparent)`, marginRight: 6, marginBottom: 4,
  }),
  fileHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--xp-bg, #1a1b26)', borderRadius: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: 'var(--xp-text, #c0caf5)', marginTop: 16, marginBottom: 8 },
  inputRow: { display: 'flex', alignItems: 'center', gap: 8 },
  input: { flex: 1, padding: '6px 10px', border: '1px solid var(--xp-border, #414868)', borderRadius: 6, background: 'var(--xp-bg, #1a1b26)', color: 'var(--xp-text, #c0caf5)', fontSize: 13 },
  btn: (primary: boolean) => ({
    padding: '6px 12px', border: primary ? 'none' : '1px solid var(--xp-border, #414868)', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: primary ? 'var(--xp-blue, #7aa2f7)' : 'var(--xp-surface-light, #2f334d)',
    color: primary ? '#fff' : 'var(--xp-text, #c0caf5)',
  }),
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, flexDirection: 'column' as const, gap: 12 },
  spinner: { width: 28, height: 28, border: '2px solid var(--xp-border, #414868)', borderTopColor: 'var(--xp-blue, #7aa2f7)', borderRadius: '50%', animation: 'xp-spin 1s linear infinite' },
};

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.row}>
      <span style={s.label}>{label}:</span>
      <span style={s.value}>{value}</span>
    </div>
  );
}

let api: XplorerAPI;

Dialog.register({
  id: 'file-properties-dialog',
  title: 'File Properties',
  icon: 'file-text',
  permissions: ['file:read', 'file:write', 'ui:panels'],
  onActivate(injectedApi) { api = injectedApi; },

  render({ isOpen, onClose, data }: DialogRenderProps) {
    const filePath = (data?.filePath as string) || '';
    const [properties, setProperties] = React.useState<FileProperties | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [activeTab, setActiveTab] = React.useState<'general' | 'permissions' | 'details'>('general');
    const [editing, setEditing] = React.useState(false);
    const [permStr, setPermStr] = React.useState('');

    const load = React.useCallback(async () => {
      if (!filePath) return;
      setLoading(true);
      setError(null);
      try {
        const props = await (api as any).fileUtils.getProperties(filePath) as FileProperties;
        setProperties(props);
        setPermStr(props.permissions.permissions_string);
      } catch (err: any) {
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    }, [filePath]);

    React.useEffect(() => {
      if (isOpen && filePath) load();
    }, [isOpen, filePath, load]);

    const savePermissions = async () => {
      try {
        await (api as any).fileUtils.setPermissions(filePath, permStr);
        setEditing(false);
        load();
        api.ui.showMessage('Permissions updated.', 'info');
      } catch (err: any) {
        api.ui.showMessage(`Failed: ${err?.message || err}`, 'error');
      }
    };

    const handleClose = () => {
      setActiveTab('general');
      setEditing(false);
      setProperties(null);
      setError(null);
      onClose();
    };

    if (!isOpen) return null;

    return (
      <div style={s.overlay} onClick={(e: any) => { if (e.target === e.currentTarget) handleClose(); }}>
        <style>{`@keyframes xp-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={s.dialog}>
          <div style={s.header}>
            <h2 style={s.title}>Properties</h2>
            <button style={s.closeBtn} onClick={handleClose}>{'\u2715'}</button>
          </div>

          <div style={s.tabBar}>
            {(['general', 'permissions', 'details'] as const).map((tab) => (
              <button key={tab} style={s.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>{tab}</button>
            ))}
          </div>

          <div style={s.body}>
            {loading ? (
              <div style={s.center}>
                <div style={s.spinner} />
                <span style={{ color: 'var(--xp-text-muted)', fontSize: 13 }}>Loading properties...</span>
              </div>
            ) : error ? (
              <div style={s.center}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--xp-red, #f7768e)" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span style={{ color: 'var(--xp-text)', fontSize: 14 }}>Error Loading Properties</span>
                <span style={{ color: 'var(--xp-text-muted)', fontSize: 12 }}>{error}</span>
                <button style={s.btn(true)} onClick={load}>Try Again</button>
              </div>
            ) : properties ? (
              <div>
                {activeTab === 'general' && (
                  <div>
                    <div style={s.fileHeader}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill={properties.is_directory ? 'var(--xp-yellow, #e0af68)' : 'var(--xp-blue, #7aa2f7)'}>
                        {properties.is_directory
                          ? <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                          : <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>}
                      </svg>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--xp-text)' }}>{properties.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--xp-text-muted)' }}>{properties.file_type}</div>
                      </div>
                    </div>
                    <PropertyRow label="Location" value={properties.path} />
                    <PropertyRow label="Size" value={properties.size_formatted} />
                    {properties.attributes.item_count != null && <PropertyRow label="Contains" value={`${properties.attributes.item_count} items`} />}
                    {properties.attributes.total_size != null && <PropertyRow label="Size on disk" value={formatFileSize(properties.attributes.total_size)} />}
                    <PropertyRow label="Created" value={formatDate(properties.created)} />
                    <PropertyRow label="Modified" value={formatDate(properties.modified)} />
                    <PropertyRow label="Accessed" value={formatDate(properties.accessed)} />
                    {properties.extension && <PropertyRow label="Extension" value={properties.extension} />}
                    {properties.mime_type && <PropertyRow label="MIME Type" value={properties.mime_type} />}
                    <div style={s.sectionTitle}>Attributes</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {properties.is_hidden && <span style={s.badge('var(--xp-yellow, #e0af68)')}>Hidden</span>}
                      {properties.is_readonly && <span style={s.badge('var(--xp-red, #f7768e)')}>Read-only</span>}
                      {properties.is_directory && <span style={s.badge('var(--xp-blue, #7aa2f7)')}>Directory</span>}
                      {properties.attributes.symlink_target && <span style={s.badge('var(--xp-purple, #bb9af7)')}>Symbolic Link</span>}
                    </div>
                  </div>
                )}

                {activeTab === 'permissions' && (
                  <div>
                    <PropertyRow label="Owner can read" value={properties.permissions.readable ? '\u2713 Yes' : '\u2717 No'} />
                    <PropertyRow label="Owner can write" value={properties.permissions.writable ? '\u2713 Yes' : '\u2717 No'} />
                    <PropertyRow label="Owner can execute" value={properties.permissions.executable ? '\u2713 Yes' : '\u2717 No'} />
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--xp-text)', marginBottom: 8 }}>Permissions String</div>
                      <div style={s.inputRow}>
                        <input
                          style={{ ...s.input, opacity: editing ? 1 : 0.6 }}
                          value={editing ? permStr : properties.permissions.permissions_string}
                          onChange={(e: any) => setPermStr(e.target.value)}
                          disabled={!editing}
                          placeholder="e.g., 755 or readonly"
                        />
                        {editing ? (
                          <>
                            <button style={s.btn(true)} onClick={savePermissions}>Save</button>
                            <button style={s.btn(false)} onClick={() => { setEditing(false); setPermStr(properties.permissions.permissions_string); }}>Cancel</button>
                          </>
                        ) : (
                          <button style={s.btn(false)} onClick={() => setEditing(true)}>Edit</button>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', marginTop: 6 }}>
                        Use octal notation (e.g., 755) on Unix, or 'readonly'/'writable' on Windows
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'details' && (
                  <div>
                    {properties.attributes.device_id != null && <PropertyRow label="Device ID" value={String(properties.attributes.device_id)} />}
                    {properties.attributes.inode != null && <PropertyRow label="Inode" value={String(properties.attributes.inode)} />}
                    {properties.attributes.hard_links != null && <PropertyRow label="Hard Links" value={String(properties.attributes.hard_links)} />}
                    {properties.attributes.symlink_target && <PropertyRow label="Symlink Target" value={properties.attributes.symlink_target} />}
                    {properties.permissions.mode != null && <PropertyRow label="Permissions Mode" value={`${Number(properties.permissions.mode).toString(8)} (octal)`} />}
                    {properties.permissions.attributes != null && <PropertyRow label="File Attributes" value={`0x${Number(properties.permissions.attributes).toString(16)} (hex)`} />}
                    <div style={s.sectionTitle}>Raw Timestamps</div>
                    <PropertyRow label="Created (Unix)" value={String(properties.created ?? '')} />
                    <PropertyRow label="Modified (Unix)" value={String(properties.modified ?? '')} />
                    <PropertyRow label="Accessed (Unix)" value={String(properties.accessed ?? '')} />
                    <div style={s.sectionTitle}>Size Information</div>
                    <PropertyRow label="Size (bytes)" value={(properties.size ?? 0).toLocaleString()} />
                    {properties.attributes.total_size != null && <PropertyRow label="Total size (bytes)" value={properties.attributes.total_size.toLocaleString()} />}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  },
});
