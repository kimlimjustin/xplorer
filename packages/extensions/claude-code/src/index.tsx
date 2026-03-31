import React from 'react';
import { Sidebar, Command, useCurrentPath, useSelectedFiles, type XplorerAPI } from '@xplorer/extension-sdk';

let api: XplorerAPI;

interface Msg { id: string; role: 'user' | 'assistant'; content: string; done?: boolean; }

const SESSION = 'claude-code-live';
let _msgs: Msg[] = [];
let _loading = false;
let _input = '';
let _spawned = false;
let _currentId = '';
let _buffer = '';
let _rerender: (() => void) | null = null;
let _listening = false;

const notify = () => { if (_rerender) _rerender(); };

const spawnClaude = async (cwd: string) => {
  if (_spawned) return;
  _spawned = true;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('pty_kill', { sessionId: SESSION }).catch(() => {});
    await invoke('pty_spawn', { sessionId: SESSION, cwd, cols: 120, rows: 40 });
    // Start claude in interactive mode
    await invoke('pty_write', { sessionId: SESSION, data: 'claude\n' });

    if (!_listening) {
      _listening = true;
      const { listen } = await import('@tauri-apps/api/event');

      await listen('pty-output', (e: { payload: { session_id: string; data: string } }) => {
        if (e.payload.session_id !== SESSION) return;
        _buffer += e.payload.data;

        if (_currentId) {
          // Strip ANSI and update the current assistant message
          const clean = _buffer.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\].*?\x07/g, '').replace(/\x1b\[.*?[a-zA-Z]/g, '');
          _msgs = _msgs.map((m) => m.id === _currentId ? { ...m, content: clean } : m);
          notify();
        }
      });

      await listen('pty-exit', (e: { payload: string }) => {
        if (e.payload === SESSION) {
          _spawned = false;
          _loading = false;
          notify();
        }
      });
    }
  } catch (err) {
    _spawned = false;
    _msgs = [..._msgs, { id: `err-${Date.now()}`, role: 'assistant', content: `Failed to start claude: ${err instanceof Error ? err.message : String(err)}\n\nInstall: npm i -g @anthropic-ai/claude-code`, done: true }];
    notify();
  }
};

const sendMessage = async (text: string, cwd: string) => {
  if (_loading) return;
  _input = '';

  await spawnClaude(cwd);

  // Add user message
  _msgs = [..._msgs, { id: `u-${Date.now()}`, role: 'user', content: text, done: true }];
  _loading = true;
  _buffer = '';

  // Add empty assistant message for streaming
  _currentId = `a-${Date.now()}`;
  _msgs = [..._msgs, { id: _currentId, role: 'assistant', content: '', done: false }];
  notify();

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    // Send the message to claude's stdin — it's already running interactively
    const escaped = text.replace(/\n/g, ' ');
    await invoke('pty_write', { sessionId: SESSION, data: escaped + '\n' });

    // Claude will respond via the pty-output listener above
    // We detect "done" when output stops for a bit
    let lastLen = 0;
    const checkDone = setInterval(() => {
      const msg = _msgs.find((m) => m.id === _currentId);
      if (!msg) { clearInterval(checkDone); return; }
      if (msg.content.length === lastLen && msg.content.length > 0) {
        // Output hasn't changed — likely done
        clearInterval(checkDone);
        _msgs = _msgs.map((m) => m.id === _currentId ? { ...m, done: true } : m);
        _loading = false;
        _currentId = '';
        _buffer = '';
        notify();
      }
      lastLen = msg.content.length;
    }, 2000);

  } catch (err) {
    _loading = false;
    _currentId = '';
    notify();
  }
};

const c = {
  bg: 'var(--xp-bg, #1a1b26)',
  surface: 'var(--xp-surface, #1e1e2e)',
  border: 'rgba(var(--xp-border-rgb, 41,46,66), 0.5)',
  text: 'var(--xp-text, #c0caf5)',
  muted: 'var(--xp-text-muted, #565f89)',
  blue: 'var(--xp-blue, #7aa2f7)',
  orange: '#d97706',
};

const ClaudeCodePanel = () => {
  const currentPath = useCurrentPath();
  const selectedFiles = useSelectedFiles();
  const [, setTick] = React.useState(0);
  const endRef = React.useRef<HTMLDivElement>(null);
  _rerender = () => { setTick((n) => n + 1); setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 30); };

  const send = () => {
    let prompt = _input.trim();
    if (!prompt || _loading) return;
    if (selectedFiles.length > 0) {
      prompt += ` (files: ${selectedFiles.map((f) => f.path).join(', ')})`;
    }
    sendMessage(prompt, currentPath || '.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: c.text, fontSize: 13, backgroundColor: c.bg }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: `linear-gradient(135deg, ${c.orange}, #f59e0b)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700 }}>C</div>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Claude Code</span>
        <button onClick={() => {
          _msgs = []; _loading = false; _spawned = false; _currentId = ''; _buffer = '';
          import('@tauri-apps/api/core').then(({ invoke }) => invoke('pty_kill', { sessionId: SESSION }).catch(() => {}));
          setTick((n) => n + 1);
        }} style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 10, borderRadius: 4, border: `1px solid ${c.border}`, backgroundColor: 'transparent', color: c.muted, cursor: 'pointer' }}>
          New Chat
        </button>
      </div>

      {/* File chips */}
      {selectedFiles.length > 0 && (
        <div style={{ padding: '6px 14px', borderBottom: `1px solid ${c.border}`, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {selectedFiles.map((f) => (
            <span key={f.path} style={{ padding: '2px 8px', fontSize: 10, borderRadius: 4, backgroundColor: 'rgba(122,162,247,0.1)', border: '1px solid rgba(122,162,247,0.2)', color: c.blue }}>{f.name}</span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 0' }}>
        {_msgs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 24, textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${c.orange}, #f59e0b)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff', fontWeight: 700 }}>C</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Claude Code</div>
            <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.6, maxWidth: 280 }}>
              Live Claude Code session.<br />Responses stream in real-time.<br />Uses your Claude auth.
            </div>
          </div>
        ) : (
          _msgs.map((m) => (
            <div key={m.id} style={{ padding: '8px 14px', margin: '2px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: m.role === 'user' ? c.blue : c.orange, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {m.role === 'user' ? 'You' : 'Claude'}
                {!m.done && m.role === 'assistant' && <span style={{ marginLeft: 6, color: c.orange, fontSize: 9 }}>streaming...</span>}
              </div>
              <div style={{
                fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: c.text,
                ...(m.role === 'assistant' ? { padding: '10px 12px', borderRadius: 8, backgroundColor: 'rgba(var(--xp-border-rgb, 41,46,66), 0.2)', border: `1px solid ${c.border}` } : {}),
              }}>
                {m.content || (m.role === 'assistant' && !m.done ? '...' : '')}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: `1px solid ${c.border}`, display: 'flex', gap: 8 }}>
        <input
          value={_input}
          onChange={(e) => { _input = e.target.value; setTick((n) => n + 1); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask Claude..."
          disabled={_loading}
          style={{ flex: 1, padding: '9px 12px', fontSize: 12, borderRadius: 8, border: `1px solid ${c.border}`, backgroundColor: c.surface, color: c.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <button onClick={send} disabled={!_input.trim() || _loading}
          style={{ padding: '9px 16px', fontSize: 14, fontWeight: 600, borderRadius: 8, border: 'none', cursor: _input.trim() && !_loading ? 'pointer' : 'default', backgroundColor: _input.trim() && !_loading ? c.orange : `${c.orange}40`, color: '#fff', flexShrink: 0 }}>
          ↑
        </button>
      </div>
    </div>
  );
};

Sidebar.register({
  id: 'claude-code',
  title: 'Claude Code',
  icon: 'terminal',
  location: 'right',
  permissions: ['file:read', 'ui:panels', 'system:exec'],
  render: () => <ClaudeCodePanel />,
  onActivate: (xplorerApi) => { api = xplorerApi; },
});

Command.register({
  id: 'claude-code.open',
  title: 'Open Claude Code',
  shortcut: 'ctrl+shift+c',
  permissions: ['ui:panels'],
  action: async () => { api?.ui.showMessage('Claude Code panel is in the right sidebar', 'info'); },
});
