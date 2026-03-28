import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Sidebar, Command, useCurrentPath, useSelectedFiles, type XplorerAPI } from '@xplorer/extension-sdk';

let api: XplorerAPI;

// ── Types ──

interface Segment {
  type: 'thinking' | 'text' | 'tool_use' | 'tool_result' | 'cost' | 'error';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolStatus?: 'pending' | 'approved' | 'rejected' | 'done';
  isError?: boolean;
  cost?: number;
  duration?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  segments: Segment[];
  timestamp: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface StreamEvent {
  type: string;
  subtype?: string;
  // assistant events wrap content in message.content[]
  message?: {
    content?: Array<{ type: string; text?: string; thinking?: string }>;
    [key: string]: unknown;
  };
  // tool_use / tool_result events
  name?: string;
  input?: Record<string, unknown>;
  content?: unknown;
  is_error?: boolean;
  // result event
  total_cost_usd?: number;
  duration_ms?: number;
  duration_api_ms?: number;
  result?: string;
  // error
  errors?: string[];
  session_id?: string;
  [key: string]: unknown;
}

// ── Theme ──

const C = {
  border: 'rgba(var(--xp-border-rgb, 41, 46, 66), 0.5)',
  borderLight: 'rgba(var(--xp-border-rgb, 41, 46, 66), 0.3)',
  text: 'var(--xp-text, #c0caf5)',
  dim: 'var(--xp-text-muted, #565f89)',
  blue: 'var(--xp-blue, #7aa2f7)',
  blueBg: 'rgba(122, 162, 247, 0.08)',
  blueBorder: 'rgba(122, 162, 247, 0.3)',
  accent: '#d97706',
  green: '#9ece6a',
  red: '#f7768e',
  codeBg: 'rgba(0, 0, 0, 0.25)',
  codeBorder: 'rgba(255, 255, 255, 0.06)',
  msgBg: 'rgba(var(--xp-border-rgb, 41, 46, 66), 0.12)',
  mono: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace",
};

// ── PTY streaming layer — claude -p with --include-partial-messages ──

const PTY_SESSION = 'claude-code-ext';
let _listenersAttached = false;
let _lineBuf = '';
let _thinkingBuf = '';
let _textBuf = '';
let _isThinking = false;
let _sessionId: string | null = null;
let _onThinking: ((text: string, isThinking: boolean) => void) | null = null;
let _onChunk: ((text: string) => void) | null = null;
let _onDone: ((text: string) => void) | null = null;

const processLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('{')) return;

  let ev: Record<string, unknown>;
  try { ev = JSON.parse(trimmed); } catch { return; }

  if (ev.session_id && !_sessionId) _sessionId = ev.session_id as string;

  if (ev.type === 'stream_event') {
    const event = ev.event as Record<string, unknown> | undefined;
    if (!event) return;

    // Thinking block starts
    if (event.type === 'content_block_start') {
      const block = event.content_block as Record<string, unknown> | undefined;
      if (block?.type === 'thinking') {
        _isThinking = true;
        _thinkingBuf = '';
        if (_onThinking) _onThinking('', true);
      }
      if (block?.type === 'text') {
        _isThinking = false;
        if (_onThinking) _onThinking(_thinkingBuf, false);
      }
    }

    // Content deltas
    if (event.type === 'content_block_delta') {
      const delta = event.delta as Record<string, unknown> | undefined;
      if (delta?.type === 'thinking_delta' && typeof delta.thinking === 'string') {
        _thinkingBuf += delta.thinking;
        if (_onThinking) _onThinking(_thinkingBuf, true);
      }
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
        _textBuf += delta.text;
        if (_onChunk) _onChunk(_textBuf.trim());
      }
    }
  }

  if (ev.type === 'result') {
    const text = (ev.result as string) ?? _textBuf.trim();
    if (_onDone) _onDone(text.trim());
    _onChunk = null;
    _onDone = null;
    _onThinking = null;
  }
};

const ensureListeners = async () => {
  if (_listenersAttached) return;
  _listenersAttached = true;
  const { listen } = await import('@tauri-apps/api/event');

  await listen('pty-output', (ev: { payload: { session_id: string; data: string } }) => {
    if (ev.payload.session_id !== PTY_SESSION) return;
    _lineBuf += ev.payload.data;
    const lines = _lineBuf.split('\n');
    _lineBuf = lines.pop() ?? '';
    for (const line of lines) processLine(line);
  });

  await listen('pty-exit', (ev: { payload: string }) => {
    if (ev.payload !== PTY_SESSION) return;
    // Process remaining buffer
    if (_lineBuf.trim()) processLine(_lineBuf);
    if (_onDone) _onDone(_textBuf.trim() || 'No response.');
    _lineBuf = '';
    _onChunk = null;
    _onDone = null;
    _onThinking = null;
  });
};

const sendMessage = async (
  prompt: string,
  cwd: string,
  callbacks: {
    onThinking: (text: string, isThinking: boolean) => void;
    onChunk: (text: string) => void;
    onDone: (text: string) => void;
  },
) => {
  const { invoke } = await import('@tauri-apps/api/core');
  await ensureListeners();

  await invoke('pty_kill', { sessionId: PTY_SESSION }).catch(() => {});
  await invoke('pty_spawn', { sessionId: PTY_SESSION, cwd, cols: 200, rows: 50 });
  _lineBuf = '';
  _textBuf = '';
  _thinkingBuf = '';
  _isThinking = false;
  _onThinking = callbacks.onThinking;
  _onChunk = callbacks.onChunk;
  _onDone = callbacks.onDone;

  const escaped = prompt.replace(/'/g, "'\\''");
  const resume = _sessionId ? ` --resume '${_sessionId.replace(/'/g, "'\\''")}'` : '';
  const cmd = `claude -p '${escaped}' --output-format stream-json --verbose --include-partial-messages${resume} 2>&1; exit\n`;
  await invoke('pty_write', { sessionId: PTY_SESSION, data: cmd });
};

const killClaude = async () => {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('pty_kill', { sessionId: PTY_SESSION }).catch(() => {});
  _lineBuf = '';
  _textBuf = '';
  _onChunk = null;
  _onDone = null;
  _sessionId = null;
};

const writeToPty = async (data: string) => {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('pty_write', { sessionId: PTY_SESSION, data });
};

// ── Collapsible wrapper ──

const Collapsible: React.FC<{
  title: React.ReactNode;
  defaultOpen?: boolean;
  headerStyle?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ title, defaultOpen = false, headerStyle, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { setOpen(defaultOpen); }, [defaultOpen]);
  return (
    <div style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.codeBorder}`, margin: '6px 0' }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'pointer', userSelect: 'none',
          background: 'rgba(0,0,0,0.15)', fontSize: 11, color: C.dim,
          ...headerStyle,
        }}
      >
        <span style={{ fontSize: 8, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
        {title}
      </div>
      {open && <div style={{ padding: '8px 10px' }}>{children}</div>}
    </div>
  );
};

// ── Segment renderers ──

const ThinkingBlock: React.FC<{ content: string; isStreaming: boolean }> = ({ content, isStreaming }) => (
  <Collapsible
    defaultOpen={isStreaming}
    title={<span style={{ fontStyle: 'italic' }}>Thinking{isStreaming ? '...' : ''}</span>}
    headerStyle={{ borderLeft: `2px solid ${C.accent}` }}
  >
    <div style={{
      fontSize: 11.5, lineHeight: 1.55, fontFamily: C.mono, color: C.dim,
      fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }}>
      {content}
    </div>
  </Collapsible>
);

const TOOL_ICONS: Record<string, string> = {
  Read: '📄', Edit: '✏️', Write: '📝', Bash: '⚡', Glob: '🔍',
  Grep: '🔎', Agent: '🤖', WebSearch: '🌐', WebFetch: '🌐',
};

const ToolCard: React.FC<{
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'done';
  onApprove: () => void;
  onReject: () => void;
}> = ({ name, input, status, onApprove, onReject }) => {
  const icon = TOOL_ICONS[name] ?? '🔧';
  // Show the most relevant input field as preview
  const preview = input.command ?? input.file_path ?? input.path ?? input.pattern ?? input.prompt ?? '';
  const previewStr = typeof preview === 'string' ? preview : JSON.stringify(preview);

  return (
    <div style={{
      margin: '6px 0', borderRadius: 6, border: `1px solid ${C.blueBorder}`,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6,
        background: C.blueBg, fontSize: 11, fontWeight: 600,
      }}>
        <span>{icon}</span>
        <span style={{ color: C.blue }}>{name}</span>
        {previewStr && (
          <span style={{
            color: C.dim, fontFamily: C.mono, fontSize: 10, fontWeight: 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {previewStr.length > 60 ? previewStr.slice(0, 60) + '...' : previewStr}
          </span>
        )}
        {status === 'pending' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              onClick={onApprove}
              style={{
                padding: '2px 8px', fontSize: 10, borderRadius: 4, cursor: 'pointer',
                border: `1px solid ${C.green}`, background: 'rgba(158, 206, 106, 0.1)',
                color: C.green, fontFamily: 'inherit',
              }}
            >Accept</button>
            <button
              onClick={onReject}
              style={{
                padding: '2px 8px', fontSize: 10, borderRadius: 4, cursor: 'pointer',
                border: `1px solid ${C.red}`, background: 'rgba(247, 118, 142, 0.1)',
                color: C.red, fontFamily: 'inherit',
              }}
            >Reject</button>
          </div>
        )}
        {status === 'approved' && <span style={{ marginLeft: 'auto', fontSize: 9, color: C.green, flexShrink: 0 }}>Approved</span>}
        {status === 'rejected' && <span style={{ marginLeft: 'auto', fontSize: 9, color: C.red, flexShrink: 0 }}>Rejected</span>}
      </div>
    </div>
  );
};

const ToolResult: React.FC<{ content: string; isError: boolean }> = ({ content, isError }) => (
  <Collapsible
    defaultOpen={false}
    title={
      <span style={{ color: isError ? C.red : C.dim }}>
        {isError ? 'Error' : 'Result'} ({content.split('\n').length} lines)
      </span>
    }
    headerStyle={isError ? { borderLeft: `2px solid ${C.red}` } : {}}
  >
    <pre style={{
      margin: 0, fontSize: 10.5, lineHeight: 1.5, fontFamily: C.mono,
      color: isError ? C.red : C.dim, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      maxHeight: 200, overflow: 'auto',
    }}>
      {content}
    </pre>
  </Collapsible>
);

const CostFooter: React.FC<{ cost: number; duration: number }> = ({ cost, duration }) => (
  <div style={{
    fontSize: 10, color: C.dim, padding: '4px 0', marginTop: 4,
    display: 'flex', gap: 8, opacity: 0.7,
  }}>
    {cost > 0 && <span>${cost.toFixed(4)}</span>}
    {duration > 0 && <span>{(duration / 1000).toFixed(1)}s</span>}
  </div>
);

const ErrorBlock: React.FC<{ message: string }> = ({ message }) => (
  <div style={{
    margin: '6px 0', padding: '8px 10px', borderRadius: 6, fontSize: 12, lineHeight: 1.5,
    background: 'rgba(247, 118, 142, 0.08)', border: `1px solid rgba(247, 118, 142, 0.2)`,
    borderLeft: `2px solid ${C.red}`, color: C.red, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  }}>
    {message}
  </div>
);

// ── Markdown renderer ──

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        padding: '2px 8px', fontSize: 10, borderRadius: 4,
        border: `1px solid ${C.codeBorder}`, background: 'rgba(255,255,255,0.04)',
        color: copied ? C.green : 'rgba(255,255,255,0.4)', cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >{copied ? 'Copied!' : 'Copy'}</button>
  );
};

const renderInline = (text: string): React.ReactNode =>
  text.split(/(`[^`\n]+`)/g).map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`')) {
      return (
        <code key={i} style={{
          padding: '1px 5px', borderRadius: 4, fontSize: '0.9em',
          background: 'rgba(255,255,255,0.07)', fontFamily: C.mono, color: C.text,
        }}>{p.slice(1, -1)}</code>
      );
    }
    return p.split(/(\*\*[^*]+\*\*)/g).map((b, bi) => {
      if (b.startsWith('**') && b.endsWith('**')) {
        return <strong key={`${i}-${bi}`} style={{ fontWeight: 600 }}>{b.slice(2, -2)}</strong>;
      }
      return b.split(/(\*[^*]+\*)/g).map((it, ii) => {
        if (it.startsWith('*') && it.endsWith('*') && !it.startsWith('**')) {
          return <em key={`${i}-${bi}-${ii}`}>{it.slice(1, -1)}</em>;
        }
        return <React.Fragment key={`${i}-${bi}-${ii}`}>{it}</React.Fragment>;
      });
    });
  });

const renderMarkdown = (raw: string): React.ReactNode[] => {
  const parts = raw.split(/(```[\s\S]*?```)/g);
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, pi) => {
    if (part.startsWith('```')) {
      const lines = part.slice(3, -3).split('\n');
      const lang = /^[a-zA-Z0-9_+-]+$/.test(lines[0]?.trim() ?? '') ? lines[0].trim() : '';
      const code = (lang ? lines.slice(1) : lines).join('\n').trim();
      nodes.push(
        <div key={pi} style={{ margin: '8px 0', borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.codeBorder}` }}>
          <div style={{
            padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(0,0,0,0.35)', borderBottom: `1px solid ${C.codeBorder}`,
          }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{lang || 'code'}</span>
            <CopyButton text={code} />
          </div>
          <pre style={{
            margin: 0, padding: '12px 14px', fontSize: 11.5, lineHeight: 1.55,
            background: C.codeBg, overflowX: 'auto', whiteSpace: 'pre', fontFamily: C.mono, color: C.text,
          }}>{code}</pre>
        </div>,
      );
    } else if (part.trim()) {
      const lineNodes: React.ReactNode[] = [];
      part.split('\n').forEach((line, li) => {
        const hm = line.match(/^(#{1,3})\s+(.+)$/);
        if (hm) {
          const sz = ({ 1: 15, 2: 13.5, 3: 12.5 } as Record<number, number>)[hm[1].length] ?? 12;
          lineNodes.push(<div key={`${pi}-${li}`} style={{ fontSize: sz, fontWeight: 600, margin: '10px 0 4px', color: C.text }}>{renderInline(hm[2])}</div>);
          return;
        }
        const ul = line.match(/^(\s*)[-*]\s+(.+)$/);
        if (ul) {
          lineNodes.push(
            <div key={`${pi}-${li}`} style={{ display: 'flex', gap: 6, paddingLeft: Math.floor((ul[1]?.length ?? 0) / 2) * 14, margin: '2px 0' }}>
              <span style={{ color: C.dim, flexShrink: 0 }}>-</span>
              <span>{renderInline(ul[2])}</span>
            </div>,
          );
          return;
        }
        const ol = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
        if (ol) {
          lineNodes.push(
            <div key={`${pi}-${li}`} style={{ display: 'flex', gap: 6, paddingLeft: Math.floor((ol[1]?.length ?? 0) / 2) * 14, margin: '2px 0' }}>
              <span style={{ color: C.dim, flexShrink: 0 }}>{ol[2]}.</span>
              <span>{renderInline(ol[3])}</span>
            </div>,
          );
          return;
        }
        if (line.startsWith('> ')) {
          lineNodes.push(<div key={`${pi}-${li}`} style={{ borderLeft: `2px solid ${C.dim}`, paddingLeft: 10, margin: '4px 0', color: C.dim, fontStyle: 'italic' }}>{renderInline(line.slice(2))}</div>);
          return;
        }
        if (line.trim() === '') { lineNodes.push(<div key={`${pi}-${li}`} style={{ height: 6 }} />); return; }
        lineNodes.push(<div key={`${pi}-${li}`} style={{ margin: 0 }}>{renderInline(line)}</div>);
      });
      nodes.push(<div key={pi}>{lineNodes}</div>);
    }
  });
  return nodes;
};

const TextBlock: React.FC<{ content: string }> = ({ content }) => (
  <div style={{ fontSize: 12.5, lineHeight: 1.6, wordBreak: 'break-word' }}>
    {renderMarkdown(content)}
  </div>
);

// ── Chat history ──

const HISTORY_KEY = 'claude-code:conversations';
const MAX_HISTORY = 50;

// Generate UUID v4 format required by claude --resume
const genId = (): string => {
  const hex = () => Math.random().toString(16).slice(2, 6);
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex().slice(1)}-${hex()}${hex()}${hex()}`;
};

const loadConversations = (): Conversation[] => {
  try {
    const raw = api?.settings?.get<Conversation[]>(HISTORY_KEY, []);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const saveConversations = async (convos: Conversation[]) => {
  try {
    await api?.settings?.set(HISTORY_KEY, convos.slice(0, MAX_HISTORY));
  } catch {
    // Settings API may not be available during init
  }
};

const saveConversation = async (convo: Conversation) => {
  const convos = loadConversations();
  const idx = convos.findIndex((c) => c.id === convo.id);
  if (idx >= 0) {
    convos[idx] = convo;
  } else {
    convos.unshift(convo);
  }
  await saveConversations(convos);
};

// ── Suggestions ──

const SUGGESTIONS = [
  'Explain this project',
  'Find bugs in the selected file',
  'What can be improved here?',
  'Write tests for this code',
];

const ThinkingDots: React.FC = () => {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const id = setInterval(() => setDots((d) => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(id);
  }, []);
  return <span style={{ color: C.dim, fontSize: 12 }}>Thinking{dots}</span>;
};

// ── Panel ──

const ClaudeCodePanel: React.FC = () => {
  const currentPath = useCurrentPath();
  const selectedFiles = useSelectedFiles();

  // Current conversation state
  const [convoId, setConvoId] = useState(genId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Conversation[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new content
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = taRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`; }
  }, [input]);

  // Load history when dropdown opens
  useEffect(() => {
    if (showHistory) setHistory(loadConversations());
  }, [showHistory]);

  // Persist conversation after each message
  const persistConvo = useCallback((msgs: Message[]) => {
    if (msgs.length === 0) return;
    const firstUserMsg = msgs.find((m) => m.role === 'user');
    const title = firstUserMsg
      ? firstUserMsg.segments[0]?.content.slice(0, 40) || 'New Chat'
      : 'New Chat';
    saveConversation({
      id: convoId,
      title,
      messages: msgs,
      createdAt: msgs[0]?.timestamp ?? Date.now(),
      updatedAt: Date.now(),
    });
  }, [convoId]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isLoading) return;
    setInput('');
    setIsLoading(true);

    // Add user message
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      segments: [{ type: 'text', content: msg }],
      timestamp: Date.now(),
    };
    const assistantMsg: Message = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      segments: [],
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    // Build prompt with file context
    let prompt = msg;
    if (selectedFiles.length > 0) {
      prompt = selectedFiles.map((f) => `@${f.path}`).join(' ') + ' ' + msg;
    }

    try {
      await sendMessage(prompt, currentPath || '.', {
        onThinking: (thinkingText, isThinking) => {
          setMessages((prev) => prev.map((m) => {
            if (m.id !== assistantMsg.id) return m;
            const segs: Segment[] = [];
            if (thinkingText || isThinking) {
              segs.push({ type: 'thinking', content: thinkingText || 'Thinking...' });
            }
            return { ...m, segments: segs };
          }));
        },
        onChunk: (content) => {
          setMessages((prev) => prev.map((m) => {
            if (m.id !== assistantMsg.id) return m;
            // Keep thinking segment if it exists, add/update text segment
            const thinkingSeg = m.segments.find((s) => s.type === 'thinking');
            const segs: Segment[] = [];
            if (thinkingSeg) segs.push(thinkingSeg);
            segs.push({ type: 'text', content });
            return { ...m, segments: segs };
          }));
        },
        onDone: (content) => {
          setMessages((prev) => {
            const updated = prev.map((m) => {
              if (m.id !== assistantMsg.id) return m;
              const thinkingSeg = m.segments.find((s) => s.type === 'thinking');
              const segs: Segment[] = [];
              if (thinkingSeg) segs.push(thinkingSeg);
              segs.push({ type: 'text', content: content || 'No response received.' });
              return { ...m, segments: segs };
            });
            persistConvo(updated);
            return updated;
          });
          setIsLoading(false);
        },
      });
    } catch (err) {
      const errMsg: Message = {
        id: `e-${Date.now()}`,
        role: 'system',
        segments: [{
          type: 'error',
          content: `Failed to start Claude Code: ${err instanceof Error ? err.message : String(err)}\n\nInstall: npm i -g @anthropic-ai/claude-code`,
        }],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev.slice(0, -1), errMsg]);
      setIsLoading(false);
    }
  }, [input, isLoading, currentPath, selectedFiles, convoId, persistConvo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleToolAction = useCallback((msgId: string, segIdx: number, approved: boolean) => {
    setMessages((prev) => prev.map((m) => {
      if (m.id !== msgId) return m;
      const segs = [...m.segments];
      segs[segIdx] = { ...segs[segIdx], toolStatus: approved ? 'approved' : 'rejected' };
      return { ...m, segments: segs };
    }));
    // Send approval/rejection keystroke to PTY
    writeToPty(approved ? 'y\n' : 'n\n');
  }, []);

  const startNewChat = useCallback(() => {
    // Persist current if it has messages
    if (messages.length > 0) persistConvo(messages);
    setMessages([]);
    setInput('');
    setIsLoading(false);
    setConvoId(genId());
    setShowHistory(false);
    killClaude();
  }, [messages, persistConvo]);

  const loadChat = useCallback((convo: Conversation) => {
    // Persist current first
    if (messages.length > 0) persistConvo(messages);
    setMessages(convo.messages);
    setConvoId(convo.id);
    setIsLoading(false);
    setShowHistory(false);
    killClaude();
  }, [messages, persistConvo]);

  // ── Header ──
  const headerEl = (
    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6,
        background: `linear-gradient(135deg, ${C.accent}, #f59e0b)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, color: '#fff', fontWeight: 700, flexShrink: 0,
      }}>C</div>
      <span style={{ fontSize: 13, fontWeight: 600 }}>Claude Code</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
        <button
          onClick={() => setShowHistory((s) => !s)}
          style={{
            padding: '4px 8px', fontSize: 10, fontWeight: 500, borderRadius: 5,
            border: `1px solid ${C.borderLight}`, backgroundColor: showHistory ? C.blueBg : 'transparent',
            color: showHistory ? C.blue : C.dim, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >{showHistory ? '▾' : '▸'} History</button>
        <button
          onClick={startNewChat}
          style={{
            padding: '4px 10px', fontSize: 10, fontWeight: 500, borderRadius: 5,
            border: `1px solid ${C.borderLight}`, backgroundColor: 'transparent',
            color: C.dim, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >New Chat</button>
      </div>
    </div>
  );

  // ── History dropdown ──
  const historyEl = showHistory && (
    <div style={{
      maxHeight: 200, overflow: 'auto', borderBottom: `1px solid ${C.border}`,
      background: 'rgba(0,0,0,0.15)',
    }}>
      {history.length === 0 ? (
        <div style={{ padding: '12px 14px', fontSize: 11, color: C.dim }}>No previous conversations</div>
      ) : history.map((c) => (
        <div
          key={c.id}
          onClick={() => loadChat(c)}
          style={{
            padding: '8px 14px', cursor: 'pointer', fontSize: 11,
            borderBottom: `1px solid ${C.codeBorder}`,
            background: c.id === convoId ? C.blueBg : 'transparent',
            color: c.id === convoId ? C.blue : C.text,
          }}
        >
          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
          <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>
            {new Date(c.updatedAt).toLocaleDateString()} · {c.messages.length} messages
          </div>
        </div>
      ))}
    </div>
  );

  // ── Context bar ──
  const contextEl = (selectedFiles.length > 0 || currentPath) && (
    <div style={{
      padding: '6px 14px', borderBottom: `1px solid ${C.borderLight}`,
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.dim, overflow: 'hidden',
    }}>
      {selectedFiles.length > 0 ? (
        <>
          <span style={{ opacity: 0.5, flexShrink: 0 }}>Files:</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', overflow: 'hidden' }}>
            {selectedFiles.map((f) => (
              <span key={f.path} style={{
                padding: '1px 6px', borderRadius: 3, background: C.blueBg,
                border: `1px solid ${C.blueBorder}`, color: C.blue, fontFamily: C.mono,
                fontSize: 10, whiteSpace: 'nowrap',
              }}>{f.name}</span>
            ))}
          </div>
        </>
      ) : (
        <>
          <span style={{ opacity: 0.5 }}>Path:</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: C.mono }}>{currentPath}</span>
        </>
      )}
    </div>
  );

  // ── Input bar ──
  const inputEl = (
    <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 6, alignItems: 'flex-end' }}>
      <textarea
        ref={taRef} value={input}
        onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
        placeholder="Ask Claude Code..." rows={1} disabled={isLoading}
        style={{
          flex: 1, padding: '8px 12px', fontSize: 12, borderRadius: 8,
          border: `1px solid ${C.border}`, backgroundColor: 'rgba(var(--xp-bg-rgb, 26, 27, 38), 0.5)',
          color: C.text, outline: 'none', fontFamily: 'inherit',
          resize: 'none', lineHeight: 1.5, boxSizing: 'border-box',
          opacity: isLoading ? 0.5 : 1,
        }}
      />
      <button
        onClick={() => handleSend()} disabled={!input.trim() || isLoading}
        style={{
          width: 32, height: 32, borderRadius: 8, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: input.trim() && !isLoading ? 'pointer' : 'default',
          background: input.trim() && !isLoading ? `linear-gradient(135deg, ${C.accent}, #f59e0b)` : 'rgba(255,255,255,0.04)',
          color: input.trim() && !isLoading ? '#fff' : C.dim, flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
        </svg>
      </button>
    </div>
  );

  // ── Render segments ──
  const renderSegments = (msg: Message, isLastAssistant: boolean) =>
    msg.segments.map((seg, si) => {
      switch (seg.type) {
        case 'thinking':
          return <ThinkingBlock key={si} content={seg.content} isStreaming={isLastAssistant && isLoading} />;
        case 'text':
          return <TextBlock key={si} content={seg.content} />;
        case 'tool_use':
          return (
            <ToolCard
              key={si}
              name={seg.toolName ?? 'Tool'}
              input={seg.toolInput ?? {}}
              status={seg.toolStatus ?? 'done'}
              onApprove={() => handleToolAction(msg.id, si, true)}
              onReject={() => handleToolAction(msg.id, si, false)}
            />
          );
        case 'tool_result':
          return <ToolResult key={si} content={seg.content} isError={seg.isError ?? false} />;
        case 'cost':
          return null;
        case 'error':
          return <ErrorBlock key={si} message={seg.content} />;
        default:
          return null;
      }
    });

  // ── Empty state ──
  if (messages.length === 0 && !isLoading && !showHistory) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: C.text, fontSize: 13 }}>
        {headerEl}
        {historyEl}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28, textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.accent}, #f59e0b)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color: '#fff', fontWeight: 700,
            boxShadow: '0 4px 20px rgba(217, 119, 6, 0.15)',
          }}>C</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>Claude Code</div>
          <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6, maxWidth: 260 }}>
            Runs the real Claude Code CLI with full project context, tools, and slash commands.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 260, marginTop: 4 }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => handleSend(s)} style={{
                padding: '8px 12px', fontSize: 11, borderRadius: 6,
                border: `1px solid ${C.borderLight}`,
                backgroundColor: 'rgba(var(--xp-border-rgb, 41, 46, 66), 0.12)',
                cursor: 'pointer', color: C.dim, textAlign: 'left', fontFamily: 'inherit',
              }}>{s}</button>
            ))}
          </div>
        </div>
        {inputEl}
      </div>
    );
  }

  // ── Chat state ──
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: C.text, fontSize: 13 }}>
      {headerEl}
      {historyEl}
      {contextEl}

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 0' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ padding: '6px 14px', margin: '4px 0' }}>
            {msg.role !== 'system' && (
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                marginBottom: 4, color: msg.role === 'user' ? C.blue : C.accent,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {msg.role === 'user' ? 'You' : 'Claude'}
                {isLoading && msg.id === lastAssistantId && msg.segments.length === 0 && (
                  <span style={{ fontWeight: 400, fontSize: 9, textTransform: 'none', letterSpacing: 0, color: C.dim }}>streaming...</span>
                )}
              </div>
            )}

            {msg.role === 'user' ? (
              <div style={{
                fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                padding: '8px 12px', borderRadius: 8, background: C.blueBg, borderLeft: `2px solid ${C.blue}`,
              }}>
                {msg.segments[0]?.content ?? ''}
              </div>
            ) : msg.role === 'system' ? (
              <div>{renderSegments(msg, false)}</div>
            ) : (
              <div style={{
                padding: '10px 12px', borderRadius: 8, background: C.msgBg,
                border: `1px solid ${C.codeBorder}`,
              }}>
                {msg.segments.length > 0
                  ? renderSegments(msg, msg.id === lastAssistantId)
                  : isLoading ? <ThinkingDots /> : null}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {inputEl}
    </div>
  );
};

// ── Registration ──

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
