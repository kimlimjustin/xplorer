import React, { useState, useEffect } from 'react';
import { Dialog, type XplorerAPI, type DialogRenderProps } from '@xplorer/extension-sdk';

interface Application { name: string; path: string; icon?: string; is_default: boolean; }
interface FileAssociation { extension: string; mime_type?: string; default_app?: Application; available_apps: Application[]; }

let api: XplorerAPI;

Dialog.register({
  id: 'open-with-dialog',
  title: 'Open With',
  icon: 'layout',
  permissions: ['file:read', 'file:execute', 'file:write', 'ui:panels'],
  onActivate: (injectedApi) => { api = injectedApi; },

  render: ({ isOpen, onClose, data }: DialogRenderProps) => {
    const filePath = (data?.filePath as string) || '';
    return <OpenWithDialogContent isOpen={isOpen} onClose={onClose} filePath={filePath} />;
  },
});

function OpenWithDialogContent({ isOpen, onClose, filePath }: { isOpen: boolean; onClose: () => void; filePath: string }) {
  const [assoc, setAssoc] = useState<FileAssociation | null>(null);
  const [systemApps, setSystemApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (isOpen && filePath) loadAssociations();
  }, [isOpen, filePath]);

  const loadAssociations = async () => {
    setLoading(true);
    setError(null);
    try {
      const [associations, apps] = await Promise.all([
        (api as any).fileUtils.getAssociations(filePath) as Promise<FileAssociation>,
        (api as any).fileUtils.getSystemApps() as Promise<Application[]>,
      ]);
      setAssoc(associations);
      setSystemApps(apps);
      setSelectedApp(associations.default_app || associations.available_apps[0] || null);
    } catch (err) {
      const msg = (err as Error).message || String(err);
      setError(msg);
      api.ui.showMessage(`Failed to load applications: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    if (!selectedApp) { api.ui.showMessage('Select an application.', 'warning'); return; }
    try {
      await (api as any).fileUtils.openWith(filePath, selectedApp.path);
      if (remember && assoc) {
        try { await (api as any).fileUtils.setDefaultApp(assoc.extension, selectedApp.path); } catch {}
      }
      const fn = filePath.split(/[/\\]/).pop() || 'file';
      api.ui.showMessage(`Opened ${fn} with ${selectedApp.name}`, 'info');
      onClose();
    } catch (err) {
      api.ui.showMessage(`Failed: ${(err as Error).message || err}`, 'error');
    }
  };

  const handleClose = () => { setSelectedApp(null); setRemember(false); setError(null); onClose(); };
  const fileName = filePath.split(/[/\\]/).pop() || 'Unknown File';

  if (!isOpen) return null;

  const appItem = (app: Application, prefix: string) => (
    <div
      key={`${prefix}-${app.path}`}
      onClick={() => setSelectedApp(app)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 6, cursor: 'pointer',
        border: selectedApp?.path === app.path ? '1px solid var(--xp-blue, #7aa2f7)' : '1px solid transparent',
        background: selectedApp?.path === app.path ? 'color-mix(in srgb, var(--xp-blue) 12%, transparent)' : 'transparent',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--xp-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--xp-text)' }}>{app.name}</div>
        <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.path}</div>
        {app.is_default && (
          <span style={{ display: 'inline-block', fontSize: 10, padding: '1px 6px', borderRadius: 4, color: 'var(--xp-green, #9ece6a)', background: 'color-mix(in srgb, var(--xp-green) 15%, transparent)', marginTop: 2 }}>Default</span>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'var(--xp-surface, #24283b)', borderRadius: 8, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', width: 480, maxWidth: '90vw', maxHeight: '90vh', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--xp-border, #414868)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--xp-text)', margin: 0 }}>Open With</h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'var(--xp-text-muted)', cursor: 'pointer', fontSize: 18, padding: 4 }}>{'\u2715'}</button>
        </div>

        <div style={{ padding: 20, maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--xp-border)', borderTopColor: 'var(--xp-blue)', borderRadius: '50%', animation: 'xp-spin 1s linear infinite' }} />
              <span style={{ color: 'var(--xp-text-muted)', fontSize: 13 }}>Loading applications...</span>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--xp-red)" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div style={{ color: 'var(--xp-text)', fontSize: 14, marginTop: 8 }}>Error Loading Applications</div>
              <div style={{ color: 'var(--xp-text-muted)', fontSize: 12, marginTop: 4, marginBottom: 12 }}>{error}</div>
              <button onClick={loadAssociations} style={{ padding: '8px 16px', background: 'var(--xp-blue)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Try Again</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* File info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--xp-bg, #1a1b26)', borderRadius: 8 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--xp-text-muted)" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/></svg>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--xp-text)' }}>{fileName}</div>
                  {assoc && (
                    <div style={{ fontSize: 12, color: 'var(--xp-text-muted)' }}>
                      {assoc.extension && `.${assoc.extension} file`}{assoc.mime_type && ` (${assoc.mime_type})`}
                    </div>
                  )}
                </div>
              </div>

              {/* Apps list */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--xp-text)', marginBottom: 8 }}>Choose an application:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
                  {assoc?.available_apps && assoc.available_apps.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', padding: '4px 0' }}>Recommended:</div>
                      {assoc.available_apps.map((app) => appItem(app, 'rec'))}
                    </>
                  )}
                  {systemApps.filter(a => !assoc?.available_apps.some(r => r.path === a.path)).length > 0 && (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', padding: '4px 0', marginTop: 8 }}>Other applications:</div>
                      {systemApps.filter(a => !assoc?.available_apps.some(r => r.path === a.path)).slice(0, 10).map((app) => appItem(app, 'sys'))}
                    </>
                  )}
                </div>
              </div>

              {/* Remember */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--xp-text)' }}>
                <input type="checkbox" checked={remember} onChange={(e: any) => setRemember(e.target.checked)} style={{ width: 16, height: 16 }} />
                Always use this application for .{assoc?.extension || 'this'} files
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 20px', borderTop: '1px solid var(--xp-border, #414868)', background: 'var(--xp-bg, #1a1b26)' }}>
          <button onClick={handleClose} style={{ padding: '8px 16px', border: 'none', background: 'none', color: 'var(--xp-text)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleOpen} disabled={!selectedApp || loading}
            style={{ padding: '8px 16px', background: 'var(--xp-blue)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: (!selectedApp || loading) ? 'not-allowed' : 'pointer', opacity: (!selectedApp || loading) ? 0.5 : 1 }}>
            Open
          </button>
        </div>
        <style>{`@keyframes xp-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
