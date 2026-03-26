import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sidebar, type XplorerAPI, type SidebarRenderProps } from '@xplorer/extension-sdk';

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  created: string;
}

interface ImageInfo {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

type Tab = 'containers' | 'images';

const REFRESH_INTERVAL = 5000;

function isRunning(status: string): boolean {
  return status.toLowerCase().startsWith('up');
}

function statusColor(status: string): string {
  if (isRunning(status)) return 'var(--xp-green)';
  if (status.toLowerCase().includes('exited')) return 'var(--xp-red)';
  if (status.toLowerCase().includes('created')) return 'var(--xp-yellow)';
  if (status.toLowerCase().includes('paused')) return 'var(--xp-orange)';
  return 'var(--xp-text-muted)';
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s;
}

function ContainerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <polyline points="16 3 12 7 8 3" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

function LogIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  );
}

function DockerLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--xp-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13h4v-2H2zm5 0h4v-2H7zm5 0h4v-2h-4zm5 0h4v-2h-4zM7 10h4V8H7zm5 0h4V8h-4zm-5-3h4V5H7zm5 0h4V5h-4zm12 5.5c-.3-1.5-1.4-2.2-2.8-2.5.3-.8.1-1.7-.4-2.3l-.5-.5-.5.5c-.6.6-.8 1.7-.4 2.4-1 .5-2.1.5-6.3.5C2.6 13 2 13.6 2 14.4c0 3.3 2 6.1 5.5 6.6h.8c2.6 0 4.8-.8 6.4-2.5 1.3-1.3 1.9-3.1 2.2-4.5h2c1 0 2-.4 2.4-1.4l.2-.5-.5-.1z" />
    </svg>
  );
}

const card: React.CSSProperties = {
  background: 'var(--xp-surface-light, #2f334d)',
  borderRadius: 8,
  border: '1px solid var(--xp-border, #414868)',
  overflow: 'hidden',
};

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  padding: '3px 6px',
  fontSize: 11,
  lineHeight: 1,
  transition: 'opacity 0.15s',
};

function ActionButton({ onClick, title, color, disabled, children }: {
  onClick: () => void;
  title: string;
  color: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        ...btnBase,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        color: color,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function DockerPanel({ api }: { api: XplorerAPI }) {
  const [tab, setTab] = useState<Tab>('containers');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [showAll, setShowAll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const checkAvailability = useCallback(async () => {
    try {
      const result = await api.docker.isAvailable();
      setAvailable(result);
      return result;
    } catch {
      setAvailable(false);
      return false;
    }
  }, [api]);

  const loadContainers = useCallback(async () => {
    try {
      const result = await api.docker.listContainers(showAll);
      setContainers(result);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, showAll]);

  const loadImages = useCallback(async () => {
    try {
      const result = await api.docker.listImages();
      setImages(result);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api]);

  const refresh = useCallback(async () => {
    setLoading(true);
    if (tab === 'containers') {
      await loadContainers();
    } else {
      await loadImages();
    }
    setLoading(false);
  }, [tab, loadContainers, loadImages]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await checkAvailability();
      if (ok && mounted) {
        setLoading(true);
        await loadContainers();
        await loadImages();
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [checkAvailability, loadContainers, loadImages]);

  useEffect(() => {
    if (available) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(refresh, REFRESH_INTERVAL);
      return () => {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
      };
    }
  }, [available, refresh]);

  const startContainer = useCallback(async (id: string) => {
    setActionInProgress(id);
    try {
      await api.docker.startContainer(id);
      await loadContainers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setActionInProgress(null);
  }, [api, loadContainers]);

  const stopContainer = useCallback(async (id: string) => {
    setActionInProgress(id);
    try {
      await api.docker.stopContainer(id);
      await loadContainers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setActionInProgress(null);
  }, [api, loadContainers]);

  const removeContainer = useCallback(async (id: string) => {
    setActionInProgress(id);
    try {
      await api.docker.removeContainer(id, false);
      await loadContainers();
      if (expandedLogs === id) {
        setExpandedLogs(null);
        setLogs('');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setActionInProgress(null);
  }, [api, loadContainers, expandedLogs]);

  const removeImage = useCallback(async (id: string) => {
    setActionInProgress(id);
    try {
      await api.docker.removeImage(id, false);
      await loadImages();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setActionInProgress(null);
  }, [api, loadImages]);

  const viewLogs = useCallback(async (id: string) => {
    if (expandedLogs === id) {
      setExpandedLogs(null);
      setLogs('');
      return;
    }
    setExpandedLogs(id);
    setLogsLoading(true);
    try {
      const result = await api.docker.containerLogs(id, 50);
      setLogs(result);
    } catch (e: unknown) {
      setLogs(e instanceof Error ? e.message : String(e));
    }
    setLogsLoading(false);
  }, [api, expandedLogs]);

  if (available === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, height: '100%', padding: 16 }}>
        <style>{`@keyframes xp-docker-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 28, height: 28, border: '2px solid var(--xp-blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'xp-docker-spin 1s linear infinite' }} />
        <span style={{ fontSize: 13, color: 'var(--xp-text-muted)' }}>Checking Docker...</span>
      </div>
    );
  }

  if (!available) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%', padding: 24, textAlign: 'center' }}>
        <DockerLogo />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--xp-text)' }}>Docker Not Available</div>
        <div style={{ fontSize: 12, color: 'var(--xp-text-muted)', lineHeight: 1.5 }}>
          Docker CLI was not found or is not running. Please install Docker Desktop and ensure the Docker daemon is started.
        </div>
        <button
          onClick={checkAvailability}
          style={{
            marginTop: 4,
            padding: '8px 16px',
            fontSize: 13,
            borderRadius: 6,
            border: 'none',
            background: 'var(--xp-blue)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '7px 0',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    border: 'none',
    borderBottom: active ? '2px solid var(--xp-blue)' : '2px solid transparent',
    background: 'transparent',
    color: active ? 'var(--xp-text)' : 'var(--xp-text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    transition: 'color 0.15s, border-color 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 13, color: 'var(--xp-text)' }}>
      {/* Header */}
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--xp-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <DockerLogo />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Docker</span>
        </div>
        <button
          onClick={refresh}
          title="Refresh"
          style={{
            ...btnBase,
            background: 'var(--xp-surface-light)',
            color: 'var(--xp-text-muted)',
            padding: '4px 6px',
          }}
        >
          <RefreshIcon />
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--xp-border)' }}>
        <button style={tabStyle(tab === 'containers')} onClick={() => setTab('containers')}>
          <ContainerIcon />
          Containers ({containers.length})
        </button>
        <button style={tabStyle(tab === 'images')} onClick={() => setTab('images')}>
          <ImageIcon />
          Images ({images.length})
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ margin: '8px 10px 0', padding: '6px 10px', borderRadius: 6, border: '1px solid color-mix(in srgb, var(--xp-red) 25%, transparent)', background: 'color-mix(in srgb, var(--xp-red) 8%, transparent)', fontSize: 11, color: 'var(--xp-red)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{truncate(error, 120)}</span>
          <button onClick={() => setError(null)} style={{ ...btnBase, background: 'transparent', color: 'var(--xp-red)', fontSize: 14, padding: '0 4px' }}>&times;</button>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--xp-text-muted)', textAlign: 'center' }}>Loading...</div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tab === 'containers' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 11, color: 'var(--xp-text-muted)' }}>
                {containers.filter(c => isRunning(c.status)).length} running
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--xp-text-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(e) => { setShowAll(e.target.checked); }}
                  style={{ width: 12, height: 12, accentColor: 'var(--xp-blue)' }}
                />
                Show all
              </label>
            </div>
            {containers.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--xp-text-muted)', fontSize: 12 }}>
                No containers found
              </div>
            )}
            {containers.map((c) => {
              const running = isRunning(c.status);
              const busy = actionInProgress === c.id;
              return (
                <div key={c.id} style={card}>
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {/* Row 1: name + status dot */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: statusColor(c.status),
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--xp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={c.name}>
                        {c.name}
                      </span>
                    </div>
                    {/* Row 2: image + status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--xp-text-muted)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={c.image}>{c.image}</span>
                      <span style={{ color: statusColor(c.status), flexShrink: 0, marginLeft: 6, fontWeight: 500 }}>{c.status}</span>
                    </div>
                    {/* Row 3: ports */}
                    {c.ports && (
                      <div style={{ fontSize: 10, color: 'var(--xp-text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.ports}>
                        {c.ports}
                      </div>
                    )}
                    {/* Row 4: actions */}
                    <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                      {running ? (
                        <ActionButton onClick={() => stopContainer(c.id)} title="Stop" color="var(--xp-orange)" disabled={busy}>
                          <StopIcon />
                        </ActionButton>
                      ) : (
                        <ActionButton onClick={() => startContainer(c.id)} title="Start" color="var(--xp-green)" disabled={busy}>
                          <PlayIcon />
                        </ActionButton>
                      )}
                      <ActionButton onClick={() => viewLogs(c.id)} title={expandedLogs === c.id ? 'Hide Logs' : 'View Logs'} color="var(--xp-blue)">
                        <LogIcon />
                      </ActionButton>
                      <ActionButton onClick={() => removeContainer(c.id)} title="Remove" color="var(--xp-red)" disabled={busy || running}>
                        <TrashIcon />
                      </ActionButton>
                    </div>
                  </div>
                  {/* Logs */}
                  {expandedLogs === c.id && (
                    <div style={{ borderTop: '1px solid var(--xp-border)', background: 'var(--xp-bg, #1a1b26)', maxHeight: 200, overflowY: 'auto' }}>
                      {logsLoading ? (
                        <div style={{ padding: 10, fontSize: 11, color: 'var(--xp-text-muted)', textAlign: 'center' }}>Loading logs...</div>
                      ) : (
                        <pre style={{ margin: 0, padding: 8, fontSize: 10, fontFamily: 'monospace', color: 'var(--xp-text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>
                          {logs || '(no logs)'}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {tab === 'images' && (
          <>
            {images.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--xp-text-muted)', fontSize: 12 }}>
                No images found
              </div>
            )}
            {images.map((img) => {
              const busy = actionInProgress === img.id;
              const displayName = img.repository === '<none>' && img.tag === '<none>'
                ? truncate(img.id, 24)
                : `${img.repository}:${img.tag}`;
              return (
                <div key={img.id} style={card}>
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {/* Row 1: repo:tag */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ImageIcon />
                      <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--xp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={displayName}>
                        {displayName}
                      </span>
                    </div>
                    {/* Row 2: size + created */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--xp-text-muted)' }}>
                      <span>{img.size}</span>
                      <span>{img.created}</span>
                    </div>
                    {/* Row 3: id */}
                    <div style={{ fontSize: 10, color: 'var(--xp-text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={img.id}>
                      {truncate(img.id, 40)}
                    </div>
                    {/* Row 4: actions */}
                    <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                      <ActionButton onClick={() => removeImage(img.id)} title="Remove image" color="var(--xp-red)" disabled={busy}>
                        <TrashIcon />
                        <span style={{ marginLeft: 3 }}>Remove</span>
                      </ActionButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

let api: XplorerAPI;

Sidebar.register({
  id: 'docker-manager',
  title: 'Docker',
  description: 'Manage Docker containers and images',
  icon: 'package',
  location: 'right',
  permissions: ['system:exec'],
  render: (_props: SidebarRenderProps) => React.createElement(DockerPanel, { api }),
  onActivate: (injectedApi: XplorerAPI) => { api = injectedApi; },
});
