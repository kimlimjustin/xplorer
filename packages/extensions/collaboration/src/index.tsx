/**
 * Collaboration Extension for Xplorer
 *
 * Multi-user collaboration: host/join sessions via WebSocket,
 * presence tracking, shared workspace, file transfer, and chat.
 * All network ops go through api.nativeInvoke() which calls the
 * collaboration native plugin (.dll/.so/.dylib).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, Command, ContextMenu, useCurrentPath, useSelectedFiles, type XplorerAPI } from '@xplorer/extension-sdk';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Member {
  user_id: string;
  username: string;
  role: string;
  avatar_color: string;
  online: boolean;
  current_path: string;
  selected_files: string[];
}

interface ChatMsg {
  user_id: string;
  username: string;
  text: string;
  timestamp: number;
}

interface FileTransfer {
  id: string;
  from_user: string;
  from_username: string;
  to_user: string;
  file_name: string;
  file_size: number;
  status: string;
  progress: number;
}

interface Company {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  members: Array<{
    user_id: string;
    username: string;
    role: string;
    avatar_color: string;
    joined_at: number;
  }>;
}

interface CollabEvent {
  event: string;
  member?: Member;
  user_id?: string;
  path?: string;
  files?: string[];
  msg?: ChatMsg;
  transfer?: FileTransfer;
  transfer_id?: string;
  progress?: number;
  reason?: string;
  bookmarks?: unknown;
  tags?: unknown;
  notes?: unknown;
}

interface StatusInfo {
  role: string;
  user_id: string;
  username: string;
  invite_code: string;
  port: number;
  member_count: number;
}

type View = 'main' | 'host' | 'join' | 'company';

// ─── Helpers ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#7aa2f7', '#bb9af7', '#f7768e', '#9ece6a', '#e0af68', '#7dcfff', '#ff9e64', '#2ac3de'];

function randomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function timeAgo(ts: number): string {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ─── Inline Styles ──────────────────────────────────────────────────────────────

const S = {
  panel: {
    height: '100%', display: 'flex', flexDirection: 'column' as const,
    color: 'var(--xp-text)', fontSize: 13, fontFamily: 'inherit',
    overflow: 'hidden',
  },
  header: {
    padding: '10px 12px', borderBottom: '1px solid var(--xp-border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  title: { fontWeight: 600, fontSize: 13 },
  body: { flex: 1, overflow: 'auto', padding: '8px 10px' },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const,
    color: 'var(--xp-text-muted)', letterSpacing: '0.05em',
    marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    cursor: 'pointer', userSelect: 'none' as const,
  },
  card: {
    background: 'var(--xp-surface-light)', borderRadius: 6,
    padding: '8px 10px', marginBottom: 6,
  },
  btn: (variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'secondary') => ({
    padding: '5px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
    border: variant === 'primary' || variant === 'danger' ? 'none' : '1px solid var(--xp-border)',
    background: variant === 'primary' ? 'var(--xp-blue)' : variant === 'danger' ? 'var(--xp-red)' : 'var(--xp-surface-light)',
    color: variant === 'primary' || variant === 'danger' ? '#fff' : 'var(--xp-text)',
    fontFamily: 'inherit',
  }),
  input: {
    width: '100%', padding: '6px 10px', fontSize: 13,
    background: 'var(--xp-bg)', color: 'var(--xp-text)',
    border: '1px solid var(--xp-border)', borderRadius: 4,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  },
  avatar: (color: string, size = 28) => ({
    width: size, height: size, borderRadius: '50%', background: color,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: size * 0.4, flexShrink: 0,
  }),
  dot: (online: boolean) => ({
    width: 7, height: 7, borderRadius: '50%',
    background: online ? 'var(--xp-green)' : 'var(--xp-text-muted)',
    flexShrink: 0,
  }),
  row: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  chatBubble: (isOwn: boolean) => ({
    background: isOwn ? 'var(--xp-blue)' : 'var(--xp-surface-light)',
    color: isOwn ? '#fff' : 'var(--xp-text)',
    borderRadius: 8, padding: '4px 8px', fontSize: 12,
    maxWidth: '85%', wordBreak: 'break-word' as const,
    alignSelf: isOwn ? 'flex-end' as const : 'flex-start' as const,
  }),
  transferBar: (pct: number) => ({
    height: 3, borderRadius: 2, background: 'var(--xp-border)',
    position: 'relative' as const, overflow: 'hidden' as const, marginTop: 4,
  }),
  transferFill: (pct: number) => ({
    position: 'absolute' as const, left: 0, top: 0, bottom: 0,
    width: `${pct}%`, background: 'var(--xp-blue)',
    transition: 'width 0.3s',
  }),
};

// ─── Avatar Component ───────────────────────────────────────────────────────────

function Avatar({ username, color, size = 28 }: { username: string; color: string; size?: number }) {
  return (
    <div style={S.avatar(color, size)}>
      {username.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Main Panel Component ───────────────────────────────────────────────────────

function CollabPanel({ api }: { api: XplorerAPI }) {
  // State
  const [view, setView] = useState<View>('main');
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [company, setCompany] = useState<Company | null>(null);

  // Form state
  const [username, setUsername] = useState(() => `User${Math.floor(Math.random() * 9000 + 1000)}`);
  const [joinCode, setJoinCode] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [serverPort, setServerPort] = useState('9847');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');

  // Section collapse state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentPath = useCurrentPath();
  const selectedFiles = useSelectedFiles();

  // ─── Native invoke helper ───────────────────────────────────────────────

  const invoke = useCallback(async (command: string, args: Record<string, unknown> = {}): Promise<unknown> => {
    try {
      const result = await api.nativeInvoke(command, args);
      setError('');
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    }
  }, [api]);

  // ─── Polling for events ─────────────────────────────────────────────────

  const processEvents = useCallback(async () => {
    const result = await invoke('get_events') as { events?: CollabEvent[] } | null;
    if (!result?.events?.length) return;

    for (const ev of result.events) {
      switch (ev.event) {
        case 'MemberJoined':
          if (ev.member) setMembers(prev => [...prev.filter(m => m.user_id !== ev.member!.user_id), ev.member!]);
          break;
        case 'MemberLeft':
          setMembers(prev => prev.filter(m => m.user_id !== ev.user_id));
          break;
        case 'MemberNavigated':
          setMembers(prev => prev.map(m => m.user_id === ev.user_id ? { ...m, current_path: ev.path || '' } : m));
          break;
        case 'MemberSelected':
          setMembers(prev => prev.map(m => m.user_id === ev.user_id ? { ...m, selected_files: ev.files || [] } : m));
          break;
        case 'ChatReceived':
          if (ev.msg) setChatMessages(prev => [...prev, ev.msg!]);
          break;
        case 'TransferRequest':
          if (ev.transfer) setTransfers(prev => [...prev, ev.transfer!]);
          break;
        case 'TransferProgress':
          if (ev.transfer_id != null) {
            setTransfers(prev => prev.map(t =>
              t.id === ev.transfer_id ? { ...t, progress: ev.progress || 0, status: 'transferring' } : t
            ));
          }
          break;
        case 'TransferComplete':
          if (ev.transfer_id != null) {
            setTransfers(prev => prev.map(t =>
              t.id === ev.transfer_id ? { ...t, progress: 100, status: 'complete' } : t
            ));
          }
          break;
        case 'TransferRejected':
          if (ev.transfer_id != null) {
            setTransfers(prev => prev.map(t =>
              t.id === ev.transfer_id ? { ...t, status: 'rejected' } : t
            ));
          }
          break;
        case 'Connected':
          refreshStatus();
          break;
        case 'Disconnected':
          setStatus(null);
          setMembers([]);
          setError(ev.reason || 'Disconnected');
          break;
      }
    }
  }, [invoke]);

  // ─── Refresh status & members ───────────────────────────────────────────

  const refreshStatus = useCallback(async () => {
    const s = await invoke('get_status') as StatusInfo | null;
    if (s) setStatus(s);
    const m = await invoke('get_members') as { members?: Member[] } | null;
    if (m?.members) setMembers(m.members);
    const c = await invoke('get_company') as Company | null;
    if (c?.id) setCompany(c);
  }, [invoke]);

  // ─── Start/stop polling ─────────────────────────────────────────────────

  useEffect(() => {
    if (status && status.role !== 'none') {
      pollRef.current = setInterval(processEvents, 2000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [status?.role, processEvents]);

  // ─── Broadcast path on navigation ──────────────────────────────────────

  useEffect(() => {
    if (status && status.role !== 'none' && currentPath) {
      invoke('broadcast_path', { path: currentPath });
    }
  }, [currentPath, status?.role]);

  // ─── Broadcast selection changes ───────────────────────────────────────

  useEffect(() => {
    if (status && status.role !== 'none' && selectedFiles.length > 0) {
      invoke('broadcast_selection', { files: selectedFiles.map(f => f.path) });
    }
  }, [selectedFiles, status?.role]);

  // ─── Scroll chat to bottom ─────────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // ─── Actions ───────────────────────────────────────────────────────────

  const handleHost = async () => {
    const port = parseInt(serverPort) || 9847;
    const result = await invoke('start_server', { port, username }) as { invite_code?: string } | null;
    if (result?.invite_code) {
      await refreshStatus();
      setView('main');
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    await invoke('join_server', { invite_code: joinCode.trim(), username });
    // Wait a moment for connection
    setTimeout(async () => {
      await refreshStatus();
      const hist = await invoke('get_chat_history') as { messages?: ChatMsg[] } | null;
      if (hist?.messages) setChatMessages(hist.messages);
      setView('main');
    }, 1000);
  };

  const handleDisconnect = async () => {
    if (status?.role === 'host') {
      await invoke('stop_server');
    } else {
      await invoke('leave_server');
    }
    setStatus(null);
    setMembers([]);
    setChatMessages([]);
    setTransfers([]);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    await invoke('send_chat', { text: chatInput.trim() });
    setChatInput('');
  };

  const handleSendFile = async (toUserId: string, filePath: string) => {
    await invoke('send_file', { to_user_id: toUserId, file_path: filePath });
  };

  const handleAcceptTransfer = async (transferId: string) => {
    // Save to Downloads by default — could prompt user for path
    await invoke('accept_transfer', { transfer_id: transferId, save_path: '' });
  };

  const handleRejectTransfer = async (transferId: string) => {
    await invoke('reject_transfer', { transfer_id: transferId });
  };

  const handleCreateCompany = async () => {
    if (!companyName.trim()) return;
    const result = await invoke('create_company', { name: companyName.trim() }) as Company | null;
    if (result) {
      setCompany(result);
      setView('main');
    }
  };

  const toggleSection = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Connected state (main view) ─────────────────────────────────────

  const isConnected = status && status.role !== 'none';

  // ─── Render: Host setup view ──────────────────────────────────────────

  if (view === 'host') {
    return (
      <div style={S.panel}>
        <div style={S.header}>
          <span style={S.title}>Host Session</span>
          <button style={S.btn('ghost')} onClick={() => setView('main')}>Back</button>
        </div>
        <div style={S.body}>
          <div style={S.card}>
            <label style={{ fontSize: 11, color: 'var(--xp-text-muted)', display: 'block', marginBottom: 4 }}>
              Your Name
            </label>
            <input
              style={S.input}
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
          <div style={S.card}>
            <label style={{ fontSize: 11, color: 'var(--xp-text-muted)', display: 'block', marginBottom: 4 }}>
              Port (default: 9847)
            </label>
            <input
              style={S.input}
              value={serverPort}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServerPort(e.target.value)}
              placeholder="9847"
            />
          </div>
          {error && <div style={{ color: 'var(--xp-red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <button
            style={{ ...S.btn('primary'), width: '100%', padding: '8px 12px' }}
            onClick={handleHost}
            disabled={!username.trim()}
          >
            Start Hosting
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Join view ────────────────────────────────────────────────

  if (view === 'join') {
    return (
      <div style={S.panel}>
        <div style={S.header}>
          <span style={S.title}>Join Session</span>
          <button style={S.btn('ghost')} onClick={() => setView('main')}>Back</button>
        </div>
        <div style={S.body}>
          <div style={S.card}>
            <label style={{ fontSize: 11, color: 'var(--xp-text-muted)', display: 'block', marginBottom: 4 }}>
              Your Name
            </label>
            <input
              style={S.input}
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
          <div style={S.card}>
            <label style={{ fontSize: 11, color: 'var(--xp-text-muted)', display: 'block', marginBottom: 4 }}>
              Invite Code
            </label>
            <input
              style={S.input}
              value={joinCode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJoinCode(e.target.value)}
              placeholder="e.g. abc123@192.168.1.10:9847"
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleJoin(); }}
            />
          </div>
          {error && <div style={{ color: 'var(--xp-red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <button
            style={{ ...S.btn('primary'), width: '100%', padding: '8px 12px' }}
            onClick={handleJoin}
            disabled={!username.trim() || !joinCode.trim()}
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Company settings view ────────────────────────────────────

  if (view === 'company') {
    return (
      <div style={S.panel}>
        <div style={S.header}>
          <span style={S.title}>Company / Organization</span>
          <button style={S.btn('ghost')} onClick={() => setView('main')}>Back</button>
        </div>
        <div style={S.body}>
          {company ? (
            <>
              <div style={S.card}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{company.name}</div>
                <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', marginBottom: 8 }}>
                  Invite Code: <code style={{ color: 'var(--xp-blue)' }}>{company.invite_code}</code>
                  <button
                    style={{ ...S.btn('ghost'), marginLeft: 8, padding: '2px 6px', fontSize: 10 }}
                    onClick={() => navigator.clipboard?.writeText(company.invite_code)}
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div style={S.sectionTitle}>Members ({company.members.length})</div>
              {company.members.map(m => (
                <div key={m.user_id} style={{ ...S.row, marginBottom: 6 }}>
                  <Avatar username={m.username} color={m.avatar_color} size={24} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{m.username}</div>
                    <div style={{ fontSize: 10, color: 'var(--xp-text-muted)' }}>{m.role}</div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={S.card}>
              <label style={{ fontSize: 11, color: 'var(--xp-text-muted)', display: 'block', marginBottom: 4 }}>
                Company Name
              </label>
              <input
                style={{ ...S.input, marginBottom: 8 }}
                value={companyName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyName(e.target.value)}
                placeholder="Enter company name"
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleCreateCompany(); }}
              />
              <button
                style={{ ...S.btn('primary'), width: '100%' }}
                onClick={handleCreateCompany}
                disabled={!companyName.trim()}
              >
                Create Company
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Render: Main panel ───────────────────────────────────────────────

  return (
    <div style={S.panel}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>Collaboration</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {isConnected && (
            <button style={S.btn('ghost')} onClick={() => setView('company')} title="Company settings">
              <span style={{ fontSize: 14 }}>&#9881;</span>
            </button>
          )}
        </div>
      </div>

      <div style={S.body}>
        {/* Connection bar */}
        {!isConnected ? (
          <div style={S.section}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button style={{ ...S.btn('primary'), flex: 1 }} onClick={() => setView('host')}>
                Host
              </button>
              <button style={{ ...S.btn('secondary'), flex: 1 }} onClick={() => setView('join')}>
                Join
              </button>
            </div>
            {error && <div style={{ color: 'var(--xp-red)', fontSize: 11 }}>{error}</div>}
          </div>
        ) : (
          <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                {status.role === 'host' ? 'Hosting' : 'Connected'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--xp-text-muted)' }}>
                {status.role === 'host' && (
                  <>
                    Code: <code style={{ color: 'var(--xp-blue)' }}>{status.invite_code}</code>
                    <button
                      style={{ ...S.btn('ghost'), marginLeft: 4, padding: '1px 4px', fontSize: 9 }}
                      onClick={() => navigator.clipboard?.writeText(status.invite_code)}
                    >
                      Copy
                    </button>
                  </>
                )}
                {status.role === 'member' && `as ${status.username}`}
              </div>
            </div>
            <button style={S.btn('danger')} onClick={handleDisconnect}>
              Leave
            </button>
          </div>
        )}

        {/* Members */}
        {isConnected && (
          <div style={S.section}>
            <div style={S.sectionTitle} onClick={() => toggleSection('members')}>
              <span>Members ({members.length})</span>
              <span style={{ fontSize: 9 }}>{collapsed.members ? '\u25B6' : '\u25BC'}</span>
            </div>
            {!collapsed.members && members.map(m => (
              <div
                key={m.user_id}
                style={{
                  ...S.card, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  padding: '6px 8px',
                }}
                onClick={() => {
                  // Follow this member's navigation
                  if (m.current_path && m.user_id !== status.user_id) {
                    api.navigation.navigateTo(m.current_path);
                  }
                }}
                title={m.user_id === status.user_id ? 'You' : `Click to follow ${m.username}`}
              >
                <Avatar username={m.username} color={m.avatar_color} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.username}
                    </span>
                    {m.user_id === status.user_id && (
                      <span style={{ fontSize: 9, color: 'var(--xp-blue)' }}>(you)</span>
                    )}
                    <span style={{ marginLeft: 'auto', ...S.dot(m.online) }} />
                  </div>
                  {m.current_path && m.user_id !== status.user_id && (
                    <div style={{ fontSize: 10, color: 'var(--xp-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.current_path.split(/[/\\]/).pop() || m.current_path}
                    </div>
                  )}
                </div>
                {/* Send file button */}
                {m.user_id !== status.user_id && m.online && selectedFiles.length > 0 && (
                  <button
                    style={{ ...S.btn('ghost'), padding: '2px 6px', fontSize: 11 }}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      selectedFiles.forEach(f => handleSendFile(m.user_id, f.path));
                    }}
                    title={`Send ${selectedFiles.length} file(s) to ${m.username}`}
                  >
                    &#8593;
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* File Transfers */}
        {isConnected && transfers.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionTitle} onClick={() => toggleSection('transfers')}>
              <span>Transfers ({transfers.filter(t => t.status !== 'complete' && t.status !== 'rejected').length})</span>
              <span style={{ fontSize: 9 }}>{collapsed.transfers ? '\u25B6' : '\u25BC'}</span>
            </div>
            {!collapsed.transfers && transfers
              .filter(t => t.status !== 'rejected')
              .slice(-10)
              .map(t => (
                <div key={t.id} style={{ ...S.card, padding: '6px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {t.file_name}
                      <span style={{ color: 'var(--xp-text-muted)', marginLeft: 4 }}>
                        ({formatSize(t.file_size)})
                      </span>
                    </div>
                    {t.status === 'pending' && t.to_user === status?.user_id && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={{ ...S.btn('primary'), padding: '2px 6px', fontSize: 10 }} onClick={() => handleAcceptTransfer(t.id)}>Accept</button>
                        <button style={{ ...S.btn('ghost'), padding: '2px 6px', fontSize: 10 }} onClick={() => handleRejectTransfer(t.id)}>Reject</button>
                      </div>
                    )}
                    {t.status === 'complete' && (
                      <span style={{ fontSize: 10, color: 'var(--xp-green)' }}>Done</span>
                    )}
                  </div>
                  {(t.status === 'transferring' || t.status === 'accepted') && (
                    <div style={S.transferBar(t.progress)}>
                      <div style={S.transferFill(t.progress)} />
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--xp-text-muted)', marginTop: 2 }}>
                    {t.from_username} &rarr; {t.to_user === status?.user_id ? 'you' : 'member'}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Chat */}
        {isConnected && (
          <div style={{ ...S.section, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={S.sectionTitle} onClick={() => toggleSection('chat')}>
              <span>Chat</span>
              <span style={{ fontSize: 9 }}>{collapsed.chat ? '\u25B6' : '\u25BC'}</span>
            </div>
            {!collapsed.chat && (
              <>
                <div style={{
                  flex: 1, overflowY: 'auto', minHeight: 80, maxHeight: 200,
                  display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6,
                }}>
                  {chatMessages.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', textAlign: 'center', padding: 12 }}>
                      No messages yet
                    </div>
                  )}
                  {chatMessages.map((msg, i) => {
                    const isOwn = msg.user_id === status?.user_id;
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                        {!isOwn && (
                          <div style={{ fontSize: 9, color: 'var(--xp-text-muted)', marginBottom: 1, marginLeft: 2 }}>
                            {msg.username}
                          </div>
                        )}
                        <div style={S.chatBubble(isOwn)}>{msg.text}</div>
                        <div style={{ fontSize: 8, color: 'var(--xp-text-muted)', marginTop: 1, marginLeft: 2, marginRight: 2 }}>
                          {timeAgo(msg.timestamp)}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <input
                    style={{ ...S.input, flex: 1 }}
                    value={chatInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSendChat(); }}
                  />
                  <button style={S.btn('primary')} onClick={handleSendChat} disabled={!chatInput.trim()}>
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Register Extension ─────────────────────────────────────────────────────────

let globalApi: XplorerAPI | null = null;

Sidebar.register({
  id: 'collab-panel',
  title: 'Collaboration',
  icon: 'users',
  location: 'right',
  permissions: ['file:read', 'file:write', 'ui:panels', 'ui:notifications', 'ui:commands', 'native:invoke', 'system:network'],

  onActivate: (api) => {
    globalApi = api;
  },

  render: () => {
    if (!globalApi) return null;
    return <CollabPanel api={globalApi} />;
  },
});

// ─── Commands ───────────────────────────────────────────────────────────────────

Command.register({
  id: 'collab.host',
  title: 'Host Collaboration Session',
  permissions: ['native:invoke'],
  action: async (api) => {
    api.ui.showMessage('Use the Collaboration panel to host a session', 'info');
  },
});

Command.register({
  id: 'collab.join',
  title: 'Join Collaboration Session',
  permissions: ['native:invoke'],
  action: async (api) => {
    const code = await api.ui.showInputBox({ prompt: 'Enter invite code', placeholder: 'e.g. abc123@192.168.1.10:9847' });
    if (code) {
      api.ui.showMessage(`Joining session: ${code}`, 'info');
    }
  },
});

Command.register({
  id: 'collab.disconnect',
  title: 'Disconnect from Session',
  permissions: ['native:invoke'],
  action: async (api) => {
    api.ui.showMessage('Use the Collaboration panel to disconnect', 'info');
  },
});

// ─── Context Menu ───────────────────────────────────────────────────────────────

ContextMenu.register({
  id: 'collab.share-selection',
  title: 'Share Selection with Team',
  when: 'multipleFilesSelected',
  permissions: ['native:invoke'],
  action: async (_files, api) => {
    api.ui.showMessage('Selection shared with team', 'info');
  },
});
